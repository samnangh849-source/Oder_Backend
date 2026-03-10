package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"

	// Import GORM & PostgreSQL Driver
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	DB               *gorm.DB
	sheetsService    *sheets.Service
	driveService     *drive.Service
	spreadsheetID    string
	uploadFolderID   string
	appsScriptURL    string
	appsScriptSecret string
	hub              *Hub
	jwtSecret        = []byte("your-very-secure-secret-key") // Change this in production
)

// --- Models ---

type User struct {
	UserName          string `gorm:"primaryKey" json:"UserName"`
	Password          string `json:"Password"`
	Team              string `json:"Team"`
	FullName          string `json:"FullName"`
	ProfilePictureURL string `json:"ProfilePictureURL"`
	Role              string `json:"Role"`
	IsSystemAdmin     bool   `json:"IsSystemAdmin"`
	TelegramUsername  string `json:"TelegramUsername"`
}

type JWTClaims struct {
	UserName      string `json:"username"`
	Role          string `json:"role"`
	IsSystemAdmin bool   `json:"is_system_admin"`
	Team          string `json:"team"`
	jwt.RegisteredClaims
}

type Order struct {
	OrderID                 string  `gorm:"primaryKey" json:"Order ID"`
	Timestamp               string  `gorm:"index" json:"Timestamp"`
	User                    string  `json:"User"`
	Page                    string  `json:"Page"`
	TelegramValue           string  `json:"TelegramValue"`
	CustomerName            string  `json:"Customer Name"`
	CustomerPhone           string  `json:"Customer Phone"`
	Location                string  `json:"Location"`
	AddressDetails          string  `json:"Address Details"`
	Note                    string  `json:"Note"`
	ShippingFeeCustomer     float64 `json:"Shipping Fee (Customer)"`
	Subtotal                float64 `json:"Subtotal"`
	GrandTotal              float64 `json:"Grand Total"`
	ProductsJSON            string  `gorm:"type:text" json:"Products (JSON)"`
	InternalShippingMethod  string  `json:"Internal Shipping Method"`
	InternalShippingDetails string  `json:"Internal Shipping Details"`
	InternalCost            float64 `json:"Internal Cost"`
	PaymentStatus           string  `json:"Payment Status"`
	PaymentInfo             string  `json:"Payment Info"`
	DiscountUSD             float64 `json:"Discount ($)"`
	DeliveryUnpaid          float64 `json:"Delivery Unpaid"`
	DeliveryPaid            float64 `json:"Delivery Paid"`
	TotalProductCost        float64 `json:"Total Product Cost ($)"`
	TelegramMessageID1      string  `json:"Telegram Message ID 1"`
	TelegramMessageID2      string  `json:"Telegram Message ID 2"`
	ScheduledTime           string  `json:"Scheduled Time"`
	FulfillmentStore        string  `json:"Fulfillment Store"`
	Team                    string  `json:"Team"`
	IsVerified              string  `json:"IsVerified"`
	FulfillmentStatus       string  `json:"Fulfillment Status"`
	PackedBy                string  `json:"Packed By"`
	PackagePhotoURL         string  `json:"Package Photo URL"`
	DriverName              string  `json:"Driver Name"`
	TrackingNumber          string  `json:"Tracking Number"`
	DispatchedTime          string  `json:"Dispatched Time"`
	DeliveredTime           string  `json:"Delivered Time"`
	DeliveryPhotoURL        string  `json:"Delivery Photo URL"`
}

// ... (Other structs: Store, Setting, TeamPage, Product, Location, ShippingMethod, Color, Driver, BankAccount, PhoneCarrier, TelegramTemplate, Inventory, StockTransfer, ReturnItem, RevenueEntry, ChatMessage, EditLog, UserActivityLog)

// --- Middlewares ---

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &JWTClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		c.Set("username", claims.UserName)
		c.Set("role", claims.Role)
		c.Set("is_system_admin", claims.IsSystemAdmin)
		c.Set("team", claims.Team)
		c.Next()
	}
}

func AdminOnlyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		isAdmin, _ := c.Get("is_system_admin")

		if role != "Admin" && isAdmin != true {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// --- Handlers ---

func handleLogin(c *gin.Context) {
	var loginReq struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&loginReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	var user User
	// Note: In a real app, passwords should be hashed (e.g., using bcrypt)
	if err := DB.Where("\"UserName\" = ? AND \"Password\" = ?", loginReq.Username, loginReq.Password).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username or password"})
		return
	}

	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &JWTClaims{
		UserName:      user.UserName,
		Role:          user.Role,
		IsSystemAdmin: user.IsSystemAdmin,
		Team:          user.Team,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  user,
	})
}

func handleSubmitOrder(c *gin.Context) {
	var orderRequest struct {
		CurrentUser      User                     `json:"currentUser"`
		SelectedTeam     string                   `json:"selectedTeam"`
		Page             string                   `json:"page"`
		Customer         map[string]interface{}   `json:"customer"`
		Products         []map[string]interface{} `json:"products"`
		Payment          map[string]interface{}   `json:"payment"`
		Shipping         map[string]interface{}   `json:"shipping"`
		Subtotal         float64                  `json:"subtotal"`
		GrandTotal       float64                  `json:"grandTotal"`
		Note             string                   `json:"note"`
		FulfillmentStore string                   `json:"fulfillmentStore"`
		ScheduledTime    string                   `json:"scheduledTime"`
	}

	if err := c.ShouldBindJSON(&orderRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	productsJSON, _ := json.Marshal(orderRequest.Products)
	var locationParts []string
	if p, ok := orderRequest.Customer["province"].(string); ok && p != "" {
		locationParts = append(locationParts, p)
	}
	if d, ok := orderRequest.Customer["district"].(string); ok && d != "" {
		locationParts = append(locationParts, d)
	}
	if s, ok := orderRequest.Customer["sangkat"].(string); ok && s != "" {
		locationParts = append(locationParts, s)
	}

	var shippingCost float64 = 0
	if costVal, ok := orderRequest.Shipping["cost"]; ok {
		switch v := costVal.(type) {
		case float64:
			shippingCost = v
		case string:
			if parsed, err := strconv.ParseFloat(v, 64); err == nil {
				shippingCost = parsed
			}
		}
	}

	var totalDiscount float64 = 0
	var totalProductCost float64 = 0
	for _, p := range orderRequest.Products {
		op, _ := p["originalPrice"].(float64)
		fp, _ := p["finalPrice"].(float64)
		q, _ := p["quantity"].(float64)
		cost, _ := p["cost"].(float64)
		if op > 0 && q > 0 {
			totalDiscount += (op - fp) * q
		}
		totalProductCost += (cost * q)
	}

	orderID := fmt.Sprintf("ORD-%d", time.Now().Unix())
	timestamp := time.Now().UTC().Format(time.RFC3339)
	custName, _ := orderRequest.Customer["name"].(string)
	custPhone, _ := orderRequest.Customer["phone"].(string)
	paymentStatus, _ := orderRequest.Payment["status"].(string)
	paymentInfo, _ := orderRequest.Payment["info"].(string)
	addLocation, _ := orderRequest.Customer["additionalLocation"].(string)

	var shipFeeCustomer float64 = 0
	if feeVal, ok := orderRequest.Customer["shippingFee"]; ok {
		switch v := feeVal.(type) {
		case float64:
			shipFeeCustomer = v
		case string:
			if parsed, err := strconv.ParseFloat(v, 64); err == nil {
				shipFeeCustomer = parsed
			}
		}
	}

	internalShipMethod, _ := orderRequest.Shipping["method"].(string)
	internalShipDetails, _ := orderRequest.Shipping["details"].(string)

	newOrder := Order{
		OrderID:                 orderID,
		Timestamp:               timestamp,
		User:                    orderRequest.CurrentUser.UserName,
		Team:                    orderRequest.SelectedTeam,
		Page:                    orderRequest.Page,
		CustomerName:            custName,
		CustomerPhone:           custPhone,
		Subtotal:                orderRequest.Subtotal,
		GrandTotal:              orderRequest.GrandTotal,
		ProductsJSON:            string(productsJSON),
		Note:                    orderRequest.Note,
		FulfillmentStore:        orderRequest.FulfillmentStore,
		ScheduledTime:           orderRequest.ScheduledTime,
		FulfillmentStatus:       "Pending",
		PaymentStatus:           paymentStatus,
		PaymentInfo:             paymentInfo,
		InternalCost:            shippingCost,
		DiscountUSD:             totalDiscount,
		TotalProductCost:        totalProductCost,
		Location:                strings.Join(locationParts, ", "),
		AddressDetails:          addLocation,
		ShippingFeeCustomer:     shipFeeCustomer,
		InternalShippingMethod:  internalShipMethod,
		InternalShippingDetails: internalShipDetails,
	}

	if err := DB.Create(&newOrder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to create order"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "orderId": orderID})
}

// ... (Other handlers as empty functions or implemented as needed)
func handleGetUsers(c *gin.Context)           {}
func handleGetStaticData(c *gin.Context)      {}
func handleGetRevenueSummary(c *gin.Context)  {}
func handleGetAllOrders(c *gin.Context)       {}
func handleAdminUpdateOrder(c *gin.Context)   {}
func handleAdminDeleteOrder(c *gin.Context)   {}
func handleMigrateData(c *gin.Context)        {}
func handleAdminUpdateSheet(c *gin.Context)   {}
func handleAdminAddRow(c *gin.Context)        {}
func handleAdminDeleteRow(c *gin.Context)     {}
func handleUpdateFormulaReport(c *gin.Context) {}
func handleClearCache(c *gin.Context)         {}
func handleAdminUpdateProductTags(c *gin.Context) {}
func handleUpdateProfile(c *gin.Context)      {}
func handleChangePassword(c *gin.Context)     {}
func handleGetChatMessages(c *gin.Context)    {}
func handleSendChatMessage(c *gin.Context)    {}
func serveWs(c *gin.Context)                 {}

// --- Main ---

func main() {
	// DSN example: "host=localhost user=gorm password=gorm dbname=gorm port=9920 sslmode=disable TimeZone=Asia/Shanghai"
	// In production, use environment variables
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Println("DATABASE_URL not set")
	} else {
		var err error
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err != nil {
			log.Fatalf("Failed to connect to database: %v", err)
		}
	}

	r := gin.Default()
	r.Use(cors.Default())

	// Public Routes
	r.POST("/api/login", handleLogin)
	r.GET("/ws", serveWs)

	// Protected Routes
	auth := r.Group("/api")
	auth.Use(AuthMiddleware())
	{
		auth.GET("/static-data", handleGetStaticData)
		auth.POST("/submit-order", handleSubmitOrder)
		auth.GET("/chat-messages", handleGetChatMessages)
		auth.POST("/send-chat", handleSendChatMessage)
		auth.POST("/update-profile", handleUpdateProfile)
		auth.POST("/change-password", handleChangePassword)

		// Admin Only Routes
		admin := auth.Group("/admin")
		admin.Use(AdminOnlyMiddleware())
		{
			admin.GET("/users", handleGetUsers)
			admin.GET("/revenue-summary", handleGetRevenueSummary)
			admin.GET("/all-orders", handleGetAllOrders)
			admin.POST("/update-order", handleAdminUpdateOrder)
			admin.POST("/delete-order", handleAdminDeleteOrder)
			admin.POST("/migrate-data", handleMigrateData)
			admin.POST("/update-sheet", handleAdminUpdateSheet)
			admin.POST("/add-row", handleAdminAddRow)
			admin.POST("/delete-row", handleAdminDeleteRow)
			admin.POST("/update-formula", handleUpdateFormulaReport)
			admin.POST("/clear-cache", handleClearCache)
			admin.POST("/update-tags", handleAdminUpdateProductTags)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}

// Hub, Client and other websocket logic would go here...
type Client struct { hub *Hub; conn *websocket.Conn; send chan []byte }
type Hub struct { clients map[*Client]bool; broadcast chan []byte; register chan *Client; unregister chan *Client }
func NewHub() *Hub { return &Hub{ clients: make(map[*Client]bool), broadcast: make(chan []byte), register: make(chan *Client), unregister: make(chan *Client) } }
func (h *Hub) run() {}
