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

type RolePermission struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Role      string `gorm:"index" json:"Role"`
	Feature   string `gorm:"index" json:"Feature"`
	IsEnabled bool   `json:"IsEnabled"`
}

type Role struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	RoleName    string `gorm:"uniqueIndex" json:"RoleName"`
	Description string `json:"Description"`
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

type ChatMessage struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Timestamp   string `gorm:"index" json:"Timestamp"`
	UserName    string `json:"UserName"`
	MessageType string `json:"MessageType"`
	Content     string `gorm:"type:text" json:"Content"`
	FileID      string `json:"FileID,omitempty"`
	IsDeleted   bool   `json:"IsDeleted"`
	IsPinned    bool   `json:"IsPinned"`
}

// --- Middlewares ---

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// Also check query param for WebSockets
			authHeader = c.Query("token")
		}

		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		claims := &JWTClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
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
	if err := DB.Where("\"user_name\" = ? AND \"password\" = ?", loginReq.Username, loginReq.Password).First(&user).Error; err != nil {
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

func handleGetChatMessages(c *gin.Context) {
	var messages []ChatMessage
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	DB.Order("timestamp desc").Limit(limit).Find(&messages)
	
	// Return in chronological order
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	
	c.JSON(200, gin.H{"status": "success", "data": messages})
}

func handleSendChatMessage(c *gin.Context) {
	var msg ChatMessage
	if err := c.ShouldBindJSON(&msg); err != nil {
		c.JSON(400, gin.H{"error": "Invalid message"})
		return
	}
	
	msg.Timestamp = time.Now().UTC().Format(time.RFC3339)
	if err := DB.Create(&msg).Error; err != nil {
		c.JSON(500, gin.H{"error": "Failed to save message"})
		return
	}

	// Broadcast via WebSocket
	broadcastMsg, _ := json.Marshal(map[string]interface{}{
		"action": "new_message",
		"payload": msg,
	})
	hub.broadcast <- broadcastMsg

	c.JSON(200, gin.H{"status": "success", "data": msg})
}

func serveWs(c *gin.Context) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool { return true },
	}
	
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}
	
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}

func handleGetPermissions(c *gin.Context) {
	var permissions []RolePermission
	DB.Find(&permissions)
	c.JSON(200, gin.H{"status": "success", "data": permissions})
}

func handleUpdatePermission(c *gin.Context) {
	var req RolePermission
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "Invalid request"})
		return
	}
	DB.Where("role = ? AND feature = ?", req.Role, req.Feature).
		Assign(map[string]interface{}{"is_enabled": req.IsEnabled}).
		FirstOrCreate(&req)
	c.JSON(200, gin.H{"status": "success"})
}

func handleGetRoles(c *gin.Context) {
	var roles []Role
	DB.Find(&roles)
	c.JSON(200, gin.H{"status": "success", "data": roles})
}

// ... (Other handlers: handleSubmitOrder, handleGetUsers, handleGetStaticData, handleGetRevenueSummary, handleGetAllOrders, etc.)
func handleGetUsers(c *gin.Context) {}
func handleGetStaticData(c *gin.Context) {}
func handleGetRevenueSummary(c *gin.Context) {}
func handleGetAllOrders(c *gin.Context) {}
func handleSubmitOrder(c *gin.Context) {}
func handleAdminUpdateOrder(c *gin.Context) {}
func handleAdminDeleteOrder(c *gin.Context) {}
func handleMigrateData(c *gin.Context) {}
func handleAdminUpdateSheet(c *gin.Context) {}
func handleAdminAddRow(c *gin.Context) {}
func handleAdminDeleteRow(c *gin.Context) {}
func handleUpdateFormulaReport(c *gin.Context) {}
func handleClearCache(c *gin.Context) {}
func handleAdminUpdateProductTags(c *gin.Context) {}
func handleUpdateProfile(c *gin.Context) {}
func handleChangePassword(c *gin.Context) {}

// --- WebSocket Logic ---

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}

// --- Main ---

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn != "" {
		var err error
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			DB.AutoMigrate(&User{}, &Order{}, &RolePermission{}, &Role{}, &ChatMessage{})
		}
	}

	hub = NewHub()
	go hub.run()

	r := gin.Default()
	r.Use(cors.Default())

	r.POST("/api/login", handleLogin)

	auth := r.Group("/api")
	auth.Use(AuthMiddleware())
	{
		auth.GET("/static-data", handleGetStaticData)
		auth.POST("/submit-order", handleSubmitOrder)
		
		chat := auth.Group("/chat")
		{
			chat.GET("/messages", handleGetChatMessages)
			chat.POST("/send", handleSendChatMessage)
			chat.GET("/ws", serveWs)
		}

		admin := auth.Group("/admin")
		admin.Use(AdminOnlyMiddleware())
		{
			admin.GET("/users", handleGetUsers)
			admin.GET("/permissions", handleGetPermissions)
			admin.POST("/permissions/update", handleUpdatePermission)
			admin.GET("/roles", handleGetRoles)
			admin.GET("/all-orders", handleGetAllOrders)
		}
	}

	port := os.Getenv("PORT")
	if port == "" { port = "8080" }
	r.Run(":" + port)
}
