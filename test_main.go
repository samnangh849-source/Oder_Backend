package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

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
	"gorm.io/gorm/logger"
)

// --- Configuration ---
var (
	DB               *gorm.DB
	sheetsService    *sheets.Service
	driveService     *drive.Service
	spreadsheetID    string
	uploadFolderID   string
	appsScriptURL    string
	appsScriptSecret string
	hub              *Hub
	jwtSecret        []byte
)

var sheetRanges = map[string]string{
	"Users":             "Users!A:Z",
	"Stores":            "Stores!A:Z",
	"Settings":          "Settings!A:Z",
	"TeamsPages":        "TeamsPages!A:Z",
	"Products":          "Products!A:Z",
	"Locations":         "Locations!A:Z",
	"ShippingMethods":   "ShippingMethods!A:Z",
	"Colors":            "Colors!A:Z",
	"Drivers":           "Drivers!A:Z",
	"BankAccounts":      "BankAccounts!A:Z",
	"PhoneCarriers":     "PhoneCarriers!A:Z",
	"TelegramTemplates": "TelegramTemplates!A:Z",
	"Inventory":         "Inventory!A:Z",
	"StockTransfers":    "StockTransfers!A:Z",
	"Returns":           "Returns!A:Z",
	"AllOrders":         "AllOrders!A:AZ",
	"RevenueDashboard":  "RevenueDashboard!A:Z",
	"ChatMessages":      "ChatMessages!A:Z",
	"EditLogs":          "EditLogs!A:Z",
	"UserActivityLogs":  "UserActivityLogs!A:Z",
	"Roles":             "Roles!A:Z",
	"RolePermissions":   "RolePermissions!A:Z",
}

// =========================================================================
// ម៉ូដែលទិន្នន័យ (GORM Models)
// =========================================================================

type User struct { UserName string `gorm:"primaryKey" json:"UserName"`; Password string `json:"Password"`; Team string `json:"Team"`; FullName string `json:"FullName"`; ProfilePictureURL string `json:"ProfilePictureURL"`; Role string `json:"Role"`; IsSystemAdmin bool `json:"IsSystemAdmin"`; TelegramUsername string `json:"TelegramUsername"` }
type Store struct { StoreName string `gorm:"primaryKey" json:"StoreName"`; StoreType string `json:"StoreType"`; Address string `json:"Address"`; TelegramBotToken string `json:"TelegramBotToken"`; TelegramGroupID string `json:"TelegramGroupID"`; TelegramTopicID string `json:"TelegramTopicID"`; LabelPrinterURL string `json:"LabelPrinterURL"`; CODAlertGroupID string `json:"CODAlertGroupID"` }
type Setting struct { ConfigKey string `gorm:"primaryKey" json:"ConfigKey"`; ConfigValue string `json:"ConfigValue"` }

type TeamPage struct { 
	ID              uint   `gorm:"primaryKey;autoIncrement" json:"ID"`
	Team            string `json:"Team"`
	PageName        string `json:"PageName"`
	TelegramValue   string `json:"TelegramValue"`
	PageLogoURL     string `json:"PageLogoURL"`
	DefaultStore    string `json:"DefaultStore"`
	TelegramTopicID string `json:"TelegramTopicID"`
}

type Product struct { Barcode string `gorm:"primaryKey" json:"Barcode"`; ProductName string `json:"ProductName"`; Price float64 `json:"Price"`; Cost float64 `json:"Cost"`; ImageURL string `json:"ImageURL"`; Tags string `json:"Tags"` }
type Location struct { ID uint `gorm:"primaryKey;autoIncrement"`; Province string `json:"Province"`; District string `json:"District"`; Sangkat string `json:"Sangkat"` }
type ShippingMethod struct { MethodName string `gorm:"primaryKey" json:"MethodName"`; LogoURL string `json:"LogosURL"`; AllowManualDriver bool `json:"AllowManualDriver"`; RequireDriverSelection bool `json:"RequireDriverSelection"`; EnableCODAlert bool `json:"EnableCODAlert"`; AlertTopicID string `json:"AlertTopicID"` }
type Color struct { ColorName string `gorm:"primaryKey" json:"ColorName"` }
type Driver struct { DriverName string `gorm:"primaryKey" json:"DriverName"`; ImageURL string `json:"ImageURL"`; Phone string `json:"Phone"`; VehiclePlate string `json:"VehiclePlate"` }
type BankAccount struct { BankName string `gorm:"primaryKey" json:"BankName"`; LogoURL string `json:"LogoURL"`; AssignedStores string `json:"AssignedStores"` }
type PhoneCarrier struct { CarrierName string `gorm:"primaryKey" json:"CarrierName"`; Prefixes string `json:"Prefixes"`; CarrierLogoURL string `json:"CarrierLogoURL"` }
type TelegramTemplate struct { ID uint `gorm:"primaryKey;autoIncrement"`; Team string `json:"Team"`; Part float64 `json:"Part"`; Template string `json:"Template"` }

type Inventory struct { ID uint `gorm:"primaryKey;autoIncrement"`; StoreName string `gorm:"index" json:"StoreName"`; Barcode string `gorm:"index" json:"Barcode"`; Quantity float64 `json:"Quantity"`; LastUpdated string `json:"LastUpdated"`; UpdatedBy string `json:"UpdatedBy"` }
type StockTransfer struct { TransferID string `gorm:"primaryKey" json:"TransferID"`; Timestamp string `json:"Timestamp"`; FromStore string `json:"FromStore"`; ToStore string `json:"ToStore"`; Barcode string `json:"Barcode"`; Quantity float64 `json:"Quantity"`; Status string `json:"Status"`; RequestedBy string `json:"RequestedBy"`; ApprovedBy string `json:"ApprovedBy"`; ReceivedBy string `json:"ReceivedBy"` }
type ReturnItem struct { ReturnID string `gorm:"primaryKey" json:"ReturnID"`; Timestamp string `json:"Timestamp"`; OrderID string `json:"OrderID"`; StoreName string `json:"StoreName"`; Barcode string `json:"Barcode"`; Quantity float64 `json:"Quantity"`; Reason string `json:"Reason"`; IsRestocked bool `json:"IsRestocked"`; HandledBy string `json:"HandledBy"` }

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
	InternalShippingMethod  string  `json:"Internal Shipping Method"` // ប្រើសម្រាប់ Logistics
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

type RevenueEntry struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; Team string `json:"Team"`; Page string `json:"Page"`; Revenue float64 `json:"Revenue"`; FulfillmentStore string `json:"Fulfillment Store"` }

type ChatMessage struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Timestamp   string `gorm:"index" json:"Timestamp"`
	UserName    string `json:"UserName"`
	Receiver    string `json:"Receiver"`
	MessageType string `json:"MessageType"`
	Content     string `gorm:"type:text" json:"Content"`
	FileID      string `json:"FileID,omitempty"`
}

type EditLog struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; OrderID string `json:"OrderID"`; Requester string `json:"Requester"`; FieldChanged string `json:"Field Changed"`; OldValue string `json:"Old Value"`; NewValue string `json:"New Value"` }
type UserActivityLog struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; User string `json:"User"`; Action string `json:"Action"`; Details string `json:"Details"` }

type Role struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	RoleName    string `gorm:"uniqueIndex" json:"RoleName"`
	Description string `json:"Description"`
}

type RolePermission struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Role      string `gorm:"index" json:"Role"`
	Feature   string `gorm:"index" json:"Feature"`
	IsEnabled bool   `json:"IsEnabled"`
}

type DeleteOrderRequest struct { OrderID string `json:"orderId"`; Team string `json:"team"`; UserName string `json:"userName"` }

// =========================================================================
// INIT DATABASE & GOOGLE SERVICES
// =========================================================================
func initDB() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { log.Fatal("❌ DATABASE_URL is not set!") }

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{ Logger: logger.Default.LogMode(logger.Error) })
	if err != nil { log.Fatal("❌ Database connection failed:", err) }

	log.Println("🔄 Auto-migrating ALL tables...")

	if db.Migrator().HasTable(&TeamPage{}) {
		if !db.Migrator().HasColumn(&TeamPage{}, "id") {
			db.Migrator().DropTable(&TeamPage{})
		}
	}

	err = db.AutoMigrate(
		&User{}, &Store{}, &Setting{}, &TeamPage{}, &Product{}, &Location{}, &ShippingMethod{},
		&Color{}, &Driver{}, &BankAccount{}, &PhoneCarrier{}, &TelegramTemplate{},
		&Inventory{}, &StockTransfer{}, &ReturnItem{},
		&Order{}, &RevenueEntry{}, &ChatMessage{}, &EditLog{}, &UserActivityLog{},
		&Role{},             
		&RolePermission{}, 
	)
	if err != nil { log.Fatal("❌ Migration failed:", err) }

	DB = db
	
	var count int64
	DB.Model(&Role{}).Count(&count)
	if count == 0 {
		defaultRoles := []Role{
			{RoleName: "Admin", Description: "Administrator with full access"},
			{RoleName: "Sales", Description: "Sales representative"},
			{RoleName: "Fulfillment", Description: "Warehouse and fulfillment staff"},
		}
		for _, r := range defaultRoles {
			DB.Create(&r)
		}
		log.Println("✅ Created default Roles.")
	}

	log.Println("✅ Successfully connected to PostgreSQL!")
}

func createGoogleAPIClient(ctx context.Context) error {
	credentialsJSON := os.Getenv("GCP_CREDENTIALS")
	if credentialsJSON == "" { return fmt.Errorf("GCP_CREDENTIALS not set") }
	credentialsJSON = strings.Trim(credentialsJSON, "\"")
	credentialsJSON = strings.ReplaceAll(credentialsJSON, "\\\"", "\"")
	
	clientOptions := option.WithCredentialsJSON([]byte(credentialsJSON))
	
	sheetsSrv, err := sheets.NewService(ctx, clientOptions, option.WithScopes(sheets.SpreadsheetsScope))
	if err != nil { return err }
	sheetsService = sheetsSrv
	
	driveSrv, err := drive.NewService(ctx, clientOptions, option.WithScopes(drive.DriveFileScope))
	if err != nil { return err }
	driveService = driveSrv
	
	log.Println("✅ Google API Clients Initialized.")
	return nil
}

// =========================================================================
// UTILS
// =========================================================================

func generateShortID() string {
	const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func mapToDBColumn(key string) string {
	specialCases := map[string]string{
		"Order ID":                "order_id",
		"Discount ($)":            "discount_usd",
		"Total Product Cost ($)":  "total_product_cost",
		"Shipping Fee (Customer)": "shipping_fee_customer",
		"Products":                "products_json",
		"Products (JSON)":         "products_json",
		"Telegram Message ID 1":   "telegram_message_id1",
		"Telegram Message ID 2":   "telegram_message_id2",
		"Customer Name":           "customer_name",
		"Customer Phone":          "customer_phone",
		"Location":                "location",
		"Address Details":         "address_details",
		"Fulfillment Status":      "fulfillment_status",
		"Fulfillment Store":       "fulfillment_store",
		"Internal Shipping Method": "internal_shipping_method",
		"Internal Shipping Details": "internal_shipping_details",
		"Internal Cost":           "internal_cost",
		"Payment Status":          "payment_status",
		"Payment Info":            "payment_info",
		"Scheduled Time":          "scheduled_time",
		"Delivery Unpaid":         "delivery_unpaid",
		"Delivery Paid":           "delivery_paid",
		"Package Photo":           "package_photo_url", 
		"Package Photo URL":       "package_photo_url",
		"Delivery Photo":          "delivery_photo_url",
		"Delivery Photo URL":      "delivery_photo_url",
		"Driver Name":             "driver_name",
		"Tracking Number":         "tracking_number",
		"Dispatched Time":         "dispatched_time",
		"Delivered Time":          "delivered_time",
		"Packed By":               "packed_by",
		"IsVerified":              "is_verified",
		"UserName":                "user_name",
		"FullName":                "full_name",
		"ProfilePictureURL":       "profile_picture_url",
		"IsSystemAdmin":           "is_system_admin",
		"TelegramUsername":        "telegram_username",
	}

	if val, ok := specialCases[key]; ok { return val }

	var res []rune
	for i, r := range key {
		if i > 0 && (unicode.IsUpper(r) || r == ' ' || r == '(' || r == ')') {
			if len(res) > 0 && res[len(res)-1] != '_' { res = append(res, '_') }
		}
		if r != ' ' && r != '(' && r != ')' && r != '$' { res = append(res, unicode.ToLower(r)) }
	}
	
	final := strings.Trim(string(res), "_")
	final = strings.ReplaceAll(final, "__", "_")
	return final
}

func isValidOrderColumn(col string) bool {
	validCols := map[string]bool{
		"order_id": true, "timestamp": true, "user": true, "page": true, "telegram_value": true,
		"customer_name": true, "customer_phone": true, "location": true, "address_details": true,
		"note": true, "shipping_fee_customer": true, "subtotal": true, "grand_total": true,
		"products_json": true, "internal_shipping_method": true, "internal_shipping_details": true,
		"internal_cost": true, "payment_status": true, "payment_info": true, "discount_usd": true,
		"delivery_unpaid": true, "delivery_paid": true, "total_product_cost": true,
		"telegram_message_id1": true, "telegram_message_id2": true, "scheduled_time": true,
		"fulfillment_store": true, "team": true, "is_verified": true, "fulfillment_status": true,
		"packed_by": true, "package_photo_url": true, "driver_name": true, "tracking_number": true,
		"dispatched_time": true, "delivered_time": true, "delivery_photo_url": true,
	}
	return validCols[col]
}

func parseBase64(b64 string) ([]byte, error) {
	cleanB64 := strings.ReplaceAll(b64, " ", "+")
	cleanB64 = strings.ReplaceAll(cleanB64, "\n", "")
	cleanB64 = strings.ReplaceAll(cleanB64, "\r", "")
	return base64.StdEncoding.DecodeString(cleanB64)
}

func ErrorHandlingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			var errMsgs []string
			for _, err := range c.Errors {
				errMsgs = append(errMsgs, err.Error())
				log.Printf("[ERROR] %s: %v\n", c.Request.URL.Path, err.Error())
			}

			if !c.Writer.Written() {
				c.JSON(http.StatusInternalServerError, gin.H{
					"status":  "error",
					"message": strings.Join(errMsgs, "; "),
				})
			}
		}
	}
}

// =========================================================================
// AUTHENTICATION, JWT & AUTHORIZATION (RBAC)
// =========================================================================

type Claims struct {
	UserName      string `json:"userName"`
	Team          string `json:"team"`
	Role          string `json:"role"`
	IsSystemAdmin bool   `json:"isSystemAdmin"`
	jwt.RegisteredClaims
}

func generateJWT(user User) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserName:      user.UserName,
		Team:          user.Team,
		Role:          user.Role,
		IsSystemAdmin: user.IsSystemAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func handleLogin(c *gin.Context) {
	var credentials struct {
		UserName string `json:"userName"`
		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&credentials); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ព័ត៌មានមិនត្រឹមត្រូវ"})
		return
	}

	var user User
	if err := DB.Where("user_name = ?", credentials.UserName).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "អ្នកប្រើប្រាស់មិនត្រឹមត្រូវ"})
		return
	}

	if user.Password != credentials.Password {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "លេខសម្ងាត់មិនត្រឹមត្រូវ"})
		return
	}

	tokenString, err := generateJWT(user)
	if err != nil {
		c.Error(err)
		return
	}

	user.Password = "" 

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"token":  tokenString,
		"user":   user,
	})
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// Also check token query param for WebSocket
			authHeader = c.Query("token")
		}

		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "មិនមានសិទ្ធិចូលប្រើប្រាស់ (Missing Token)"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		// Remove URL encoding if present
		if strings.Contains(tokenString, "%") {
			if decoded, err := strconv.Unquote("\"" + tokenString + "\""); err == nil {
				tokenString = decoded
			}
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "Token អស់សុពលភាព ឬមិនត្រឹមត្រូវ"})
			c.Abort()
			return
		}

		c.Set("userName", claims.UserName)
		c.Set("team", claims.Team)
		c.Set("role", claims.Role)
		c.Set("isSystemAdmin", claims.IsSystemAdmin)

		c.Next()
	}
}

func AdminOnlyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		isSystemAdmin, exists := c.Get("isSystemAdmin")
		role, roleExists := c.Get("role")

		if (!exists || !isSystemAdmin.(bool)) && (!roleExists || !strings.EqualFold(role.(string), "Admin")) {
			c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "គ្មានសិទ្ធិអនុញ្ញាត (Forbidden)"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func RequirePermission(feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		isSystemAdmin, _ := c.Get("isSystemAdmin")
		role, _ := c.Get("role")

		if (isSystemAdmin != nil && isSystemAdmin.(bool)) || (role != nil && strings.EqualFold(role.(string), "Admin")) {
			c.Next()
			return
		}

		var perm RolePermission
		result := DB.Where("LOWER(role) = LOWER(?) AND LOWER(feature) = LOWER(?)", role, feature).First(&perm)

		if result.Error != nil || !perm.IsEnabled {
			c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "អ្នកមិនមានសិទ្ធិសម្រាប់មុខងារនេះទេ (" + feature + ")"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func hasPermissionInternal(role string, isSystemAdmin bool, feature string) bool {
	if isSystemAdmin || strings.EqualFold(role, "Admin") {
		return true
	}
	var perm RolePermission
	result := DB.Where("LOWER(role) = LOWER(?) AND LOWER(feature) = LOWER(?)", role, feature).First(&perm)
	return result.Error == nil && perm.IsEnabled
}

// =========================================================================
// API សម្រាប់គ្រប់គ្រងសិទ្ធិ (Role Permissions) - RBAC
// =========================================================================

func handleGetRoles(c *gin.Context) {
	var roles []Role
	if err := DB.Find(&roles).Error; err != nil {
		c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": roles})
}

func handleCreateRole(c *gin.Context) {
	var req Role
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	req.RoleName = strings.TrimSpace(req.RoleName)
	req.Description = strings.TrimSpace(req.Description)

	if req.RoleName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "សូមបញ្ចូលឈ្មោះ Role"})
		return
	}

	// Check if role already exists
	var existing Role
	if err := DB.Where("LOWER(role_name) = LOWER(?)", strings.ToLower(req.RoleName)).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"status": "error", "message": "Role នេះមានរួចហើយ"})
		return
	}

	if err := DB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "មិនអាចបង្កើត Role បានទេ: " + err.Error()})
		return
	}

	// ✅ Broadcast to WebSocket for Real-time UI update (e.g. User creation dropdown)
	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type":      "add_row",
		"action":    "data_update",
		"sheetName": "Roles",
		"newData": map[string]interface{}{
			"RoleName":    req.RoleName,
			"Description": req.Description,
		},
	})
	hub.broadcast <- eventBytes

	// Sync to Google Sheet
	go func(r Role) {
		appsReq := AppsScriptRequest{
			Action:    "addRow",
			Secret:    appsScriptSecret,
			SheetName: "Roles",
			NewData: map[string]interface{}{
				"RoleName":    r.RoleName,
				"Description": r.Description,
			},
		}
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}(req)

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": req})
}

func handleGetAllPermissions(c *gin.Context) {
	var permissions []RolePermission
	if err := DB.Find(&permissions).Error; err != nil {
		c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": permissions})
}

func handleGetUserPermissions(c *gin.Context) {
	role, _ := c.Get("role")
	var permissions []RolePermission
	
	if err := DB.Where("LOWER(role) = LOWER(?)", role).Find(&permissions).Error; err != nil {
		c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": permissions})
}

func handleUpdatePermission(c *gin.Context) {
	var req RolePermission
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	var existing RolePermission
	result := DB.Where("LOWER(role) = LOWER(?) AND LOWER(feature) = LOWER(?)", req.Role, req.Feature).First(&existing)
	
	if result.Error != nil && result.Error == gorm.ErrRecordNotFound {
		if err := DB.Create(&req).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "មិនអាចបង្កើតសិទ្ធិបាន"})
			return
		}
	} else {
		existing.IsEnabled = req.IsEnabled
		if err := DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "មិនអាចរក្សាទុកបាន"})
			return
		}
	}

	// ✅ Sync Permissions to Sheet
	go func(r RolePermission) {
		// Broadcast to WebSocket for Real-time UI update
		msg, _ := json.Marshal(map[string]interface{}{
			"type": "update_permission",
			"payload": map[string]interface{}{
				"role":      r.Role,
				"feature":   r.Feature,
				"isEnabled": r.IsEnabled,
			},
		})
		hub.broadcast <- msg

		appsReq := AppsScriptRequest{
			Action: "updateSheet",
			Secret: appsScriptSecret,
			SheetName: "RolePermissions",
			PrimaryKey: map[string]string{"Role": r.Role, "Feature": r.Feature},
			NewData: map[string]interface{}{"IsEnabled": r.IsEnabled},
		}
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}(req)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Permission updated successfully"})
}

// =========================================================================
// ប្រព័ន្ធ BACKGROUND QUEUE
// =========================================================================
type AppsScriptRequest struct {
	Action         string      `json:"action"`
	Secret         string      `json:"secret"`
	UploadFolderID string      `json:"uploadFolderID,omitempty"`
	FileData       string      `json:"fileData,omitempty"`
	FileName       string      `json:"fileName,omitempty"`
	MimeType       string      `json:"mimeType,omitempty"`
	UserName       string      `json:"userName,omitempty"`
	OrderData      interface{} `json:"orderData,omitempty"`
	OrderID        string      `json:"orderId,omitempty"`
	TargetColumn   string      `json:"targetColumn,omitempty"`
	SheetName      string                 `json:"sheetName,omitempty"`
	PrimaryKey     map[string]string      `json:"primaryKey,omitempty"`
	NewData        map[string]interface{} `json:"newData,omitempty"`
}

type AppsScriptResponse struct {
	Status     string `json:"status"`
	URL        string `json:"url,omitempty"`
	FileID     string `json:"fileID,omitempty"`
	Message    string `json:"message,omitempty"`
	MessageIds struct {
		ID1 string `json:"id1"`
		ID2 string `json:"id2"`
	} `json:"messageIds,omitempty"`
}

type OrderJob struct { JobID string; OrderID string; UserName string; OrderData map[string]interface{} }

var orderChannel = make(chan OrderJob, 2000)

func startOrderWorker() {
	for job := range orderChannel {
		func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("⚠️ Recovered from panic in OrderWorker for Order %s: %v", job.OrderID, r)
				}
			}()

			log.Printf("☁️ Background Worker: Processing Order %s", job.OrderID)
			reqBody := AppsScriptRequest{ Action: "submitOrder", Secret: appsScriptSecret, OrderData: job.OrderData }
			jsonData, _ := json.Marshal(reqBody)
			
			client := &http.Client{ Timeout: 45 * time.Second }
			resp, err := client.Post(appsScriptURL, "application/json", bytes.NewBuffer(jsonData))
			
			if err != nil {
				log.Printf("❌ Worker error for %s: %v", job.OrderID, err)
			} else {
				defer resp.Body.Close()
				var scriptResp AppsScriptResponse
				if err := json.NewDecoder(resp.Body).Decode(&scriptResp); err == nil {
					if scriptResp.MessageIds.ID1 != "" || scriptResp.MessageIds.ID2 != "" {
						DB.Model(&Order{}).Where("order_id = ?", job.OrderID).Updates(map[string]interface{}{
							"telegram_message_id1": scriptResp.MessageIds.ID1,
							"telegram_message_id2": scriptResp.MessageIds.ID2,
						})
					}
				}
				msgBytes, _ := json.Marshal(map[string]interface{}{"action": "system_notification", "payload": map[string]interface{}{"status": "success", "targetUser": job.UserName, "message": "បាញ់ទៅ Telegram ជោគជ័យ!", "jobId": job.JobID}})
				hub.broadcast <- msgBytes
			}
		}()
	}
}

func startScheduler() {
	ticker := time.NewTicker(1 * time.Minute)
	go func() {
		for range ticker.C {
			callAppsScriptPOST(AppsScriptRequest{Action: "checkScheduledOrders"})
		}
	}()
}

func callAppsScriptPOST(requestData AppsScriptRequest) (AppsScriptResponse, error) {
	requestData.Secret = appsScriptSecret
	jsonData, _ := json.Marshal(requestData)
	client := &http.Client{ Timeout: 30 * time.Second }
	resp, err := client.Post(appsScriptURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil { return AppsScriptResponse{}, err }
	defer resp.Body.Close()
	
	body, _ := io.ReadAll(resp.Body)
	var scriptResponse AppsScriptResponse
	if err := json.Unmarshal(body, &scriptResponse); err != nil {
		return AppsScriptResponse{}, fmt.Errorf("invalid response from apps script")
	}
	return scriptResponse, nil
}

// =========================================================================
// MIGRATION SCRIPT 
// =========================================================================

func fetchSheetDataFromAPI(sheetName string) ([]map[string]interface{}, error) {
	readRange, ok := sheetRanges[sheetName]
	if !ok { return nil, fmt.Errorf("range not defined") }
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil { return nil, err }
	return convertSheetValuesToMaps(resp)
}

func isNumericHeader(h string) bool { return h=="Price" || h=="Cost" || h=="Grand Total" || h=="Subtotal" || h=="Shipping Fee (Customer)" || h=="Internal Cost" || h=="Discount ($)" || h=="Delivery Unpaid" || h=="Delivery Paid" || h=="Total Product Cost ($)" || h=="Revenue" || h=="Quantity" || h=="Part" }
func isBoolHeader(h string) bool { return h=="IsSystemAdmin" || h=="AllowManualDriver" || h=="RequireDriverSelection" || h=="EnableCODAlert" || h=="IsRestocked" || h=="IsEnabled" }

func convertSheetValuesToMaps(values *sheets.ValueRange) ([]map[string]interface{}, error) {
	if values == nil || len(values.Values) < 2 { return []map[string]interface{}{}, nil }
	headers := values.Values[0]
	dataRows := values.Values[1:]
	result := make([]map[string]interface{}, 0, len(dataRows))
	for _, row := range dataRows {
		if len(row) == 0 || (len(row) == 1 && row[0] == "") { continue }
		rowData := make(map[string]interface{})
		for i, cell := range row {
			if i < len(headers) {
				header := fmt.Sprintf("%v", headers[i])
				if header != "" {
					if header == "LogoURL" { rowData["LogosURL"] = fmt.Sprintf("%v", cell) }
					if cellStr, ok := cell.(string); ok {
						if isNumericHeader(header) {
							cleanedStr := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(cellStr), "$", ""), ",", "")
							if f, err := strconv.ParseFloat(cleanedStr, 64); err == nil { rowData[header] = f } else { rowData[header] = 0.0 }
						} else if isBoolHeader(header) {
							rowData[header] = strings.ToUpper(cellStr) == "TRUE"
						} else { rowData[header] = cellStr }
					} else { rowData[header] = cell }
					if header=="Telegram Message ID 1" || header=="Telegram Message ID 2" || header=="Order ID" || header=="Customer Phone" || header=="Barcode" {
						rowData[header] = fmt.Sprintf("%v", cell)
					}
				}
			}
		}
		result = append(result, rowData)
	}
	return result, nil
}

func fetchSheetDataToStruct(sheetName string, target interface{}) error {
	mappedData, err := fetchSheetDataFromAPI(sheetName)
	if err != nil { return err }
	jsonData, _ := json.Marshal(mappedData)
	if err = json.Unmarshal(jsonData, target); err != nil { return err }
	return nil
}

func handleMigrateData(c *gin.Context) {
	go func() {
		ctx := context.Background()
		if sheetsService == nil { createGoogleAPIClient(ctx) }

		log.Println("🗑️ លុបទិន្នន័យចាស់ (Resetting Database)...")
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&User{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Store{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Setting{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&TeamPage{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Product{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Location{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ShippingMethod{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Color{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Driver{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&BankAccount{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&PhoneCarrier{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&TelegramTemplate{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Inventory{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&StockTransfer{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ReturnItem{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&RevenueEntry{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ChatMessage{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&EditLog{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&UserActivityLog{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Order{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Role{})
		DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&RolePermission{})

		log.Println("🔄 ចាប់ផ្តើមទាញទិន្នន័យថ្មីពី Google Sheet...")

		var users []User; if fetchSheetDataToStruct("Users", &users) == nil { for _, u := range users { if u.UserName != "" { DB.Save(&u) } } }
		var stores []Store; if fetchSheetDataToStruct("Stores", &stores) == nil { for _, s := range stores { if s.StoreName != "" { DB.Save(&s) } } }
		
		var settings []Setting; 
		if fetchSheetDataToStruct("Settings", &settings) == nil { 
			for _, s := range settings { 
				if s.ConfigKey != "" { 
					DB.Save(&s) 
					if s.ConfigKey == "UploadFolderID" { uploadFolderID = s.ConfigValue }
				} 
			} 
		}

		var pages []TeamPage; if fetchSheetDataToStruct("TeamsPages", &pages) == nil { for _, p := range pages { if p.PageName != "" { DB.Create(&p) } } }
		var products []Product; if fetchSheetDataToStruct("Products", &products) == nil { for _, p := range products { if p.Barcode != "" { DB.Save(&p) } } }
		var locations []Location; if fetchSheetDataToStruct("Locations", &locations) == nil { for _, l := range locations { DB.Save(&l) } }
		var shipping []ShippingMethod; if fetchSheetDataToStruct("ShippingMethods", &shipping) == nil { for _, s := range shipping { if s.MethodName != "" { DB.Save(&s) } } }
		var colors []Color; if fetchSheetDataToStruct("Colors", &colors) == nil { for _, cl := range colors { if cl.ColorName != "" { DB.Save(&cl) } } }
		var drivers []Driver; if fetchSheetDataToStruct("Drivers", &drivers) == nil { for _, d := range drivers { if d.DriverName != "" { DB.Save(&d) } } }
		var banks []BankAccount; if fetchSheetDataToStruct("BankAccounts", &banks) == nil { for _, b := range banks { if b.BankName != "" { DB.Save(&b) } } }
		var carriers []PhoneCarrier; if fetchSheetDataToStruct("PhoneCarriers", &carriers) == nil { for _, pc := range carriers { if pc.CarrierName != "" { DB.Save(&pc) } } }
		var templates []TelegramTemplate; if fetchSheetDataToStruct("TelegramTemplates", &templates) == nil { for _, t := range templates { DB.Save(&t) } }
		var inventory []Inventory; if fetchSheetDataToStruct("Inventory", &inventory) == nil { for _, inv := range inventory { DB.Save(&inv) } }
		var transfers []StockTransfer; if fetchSheetDataToStruct("StockTransfers", &transfers) == nil { for _, st := range transfers { if st.TransferID != "" { DB.Save(&st) } } }
		var returns []ReturnItem; if fetchSheetDataToStruct("Returns", &returns) == nil { for _, r := range returns { if r.ReturnID != "" { DB.Save(&r) } } }
		var revs []RevenueEntry; if fetchSheetDataToStruct("RevenueDashboard", &revs) == nil { for _, r := range revs { DB.Save(&r) } }
		var chats []ChatMessage; if fetchSheetDataToStruct("ChatMessages", &chats) == nil { for _, c := range chats { DB.Save(&c) } }
		var editLogs []EditLog; if fetchSheetDataToStruct("EditLogs", &editLogs) == nil { for _, e := range editLogs { DB.Save(&e) } }
		var actLogs []UserActivityLog; if fetchSheetDataToStruct("UserActivityLogs", &actLogs) == nil { for _, a := range actLogs { DB.Save(&a) } }
		var orders []Order
		if fetchSheetDataToStruct("AllOrders", &orders) == nil { for _, o := range orders { if o.OrderID != "" { DB.Save(&o) } } }
		
		var roles []Role
		if fetchSheetDataToStruct("Roles", &roles) == nil { for _, r := range roles { if r.RoleName != "" { DB.Save(&r) } } }
		
		var perms []RolePermission
		if fetchSheetDataToStruct("RolePermissions", &perms) == nil { for _, p := range perms { if p.Role != "" && p.Feature != "" { DB.Save(&p) } } }

		log.Println("🎉 Migration (Reset & Sync) ជោគជ័យ ១០០%!")
	}()
	c.JSON(200, gin.H{"status": "success", "message": "Migration started in background. Old data will be reset."})
}

// =========================================================================
// WEB SOCKET 
// =========================================================================
var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
type Client struct { hub *Hub; conn *websocket.Conn; send chan []byte }
type Hub struct { clients map[*Client]bool; broadcast chan []byte; register chan *Client; unregister chan *Client }
func NewHub() *Hub { return &Hub{broadcast: make(chan []byte), register: make(chan *Client), unregister: make(chan *Client), clients: make(map[*Client]bool)} }
func (h *Hub) run() { for { select { case client := <-h.register: h.clients[client] = true; case client := <-h.unregister: if _, ok := h.clients[client]; ok { delete(h.clients, client); close(client.send) }; case message := <-h.broadcast: for client := range h.clients { select { case client.send <- message: default: close(client.send); delete(h.clients, client) } } } } }

func (c *Client) writePump() { 
	defer c.conn.Close()
	for { 
		message, ok := <-c.send
		if !ok { c.conn.WriteMessage(websocket.CloseMessage, []byte{}); return }
		c.conn.WriteMessage(websocket.TextMessage, message) 
	} 
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil { break }
		
		var payload map[string]interface{}
		if err := json.Unmarshal(message, &payload); err == nil {
			if t, ok := payload["type"].(string); ok && t == "typing" {
				c.hub.broadcast <- message 
			}
		}
	}
}

func serveWs(c *gin.Context) { 
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil { c.Error(err); return }
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client
	go client.writePump()
	go client.readPump() 
}

// =========================================================================
// HANDLERS
// =========================================================================

func handleGetUsers(c *gin.Context) { var users []User; DB.Find(&users); c.JSON(200, gin.H{"status": "success", "data": users}) }
func handleGetStaticData(c *gin.Context) {
	result := make(map[string]interface{})
	var products []Product; DB.Find(&products); result["products"] = products
	var stores []Store; DB.Find(&stores); result["stores"] = stores
	var pages []TeamPage; DB.Find(&pages); result["pages"] = pages
	var locations []Location; DB.Find(&locations); result["locations"] = locations
	var shippingMethods []ShippingMethod; DB.Find(&shippingMethods); result["shippingMethods"] = shippingMethods
	var colors []Color; DB.Find(&colors); result["colors"] = colors
	var drivers []Driver; DB.Find(&drivers); result["drivers"] = drivers
	var bankAccounts []BankAccount; DB.Find(&bankAccounts); result["bankAccounts"] = bankAccounts
	var phoneCarriers []PhoneCarrier; DB.Find(&phoneCarriers); result["phoneCarriers"] = phoneCarriers
	var inventory []Inventory; DB.Find(&inventory); result["inventory"] = inventory
	var stockTransfers []StockTransfer; DB.Find(&stockTransfers); result["stockTransfers"] = stockTransfers
	var returns []ReturnItem; DB.Find(&returns); result["returns"] = returns
	
	var roles []Role
	DB.Find(&roles)
	result["roles"] = roles

	var perms []RolePermission
	DB.Find(&perms)
	result["permissions"] = perms

	var settings []Setting; 
	DB.Find(&settings); 
	settingsObj := make(map[string]interface{})
	for _, s := range settings { 
		settingsObj[s.ConfigKey] = s.ConfigValue; 
		if s.ConfigKey == "UploadFolderID" { uploadFolderID = s.ConfigValue } 
	}
	result["settings"] = settingsObj
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": result})
}
func handleGetRevenueSummary(c *gin.Context) { var revs []RevenueEntry; DB.Find(&revs); c.JSON(200, gin.H{"status": "success", "data": revs}) }

func handleGetAllOrders(c *gin.Context) { 
	monthParam := c.Query("month")
	pageParam := c.Query("page")
	limitParam := c.Query("limit")

	var orders []Order
	query := DB.Order("timestamp desc")

	if monthParam != "" { 
		query = query.Where("timestamp LIKE ?", monthParam+"%") 
	}

	if pageParam != "" && limitParam != "" {
		page, _ := strconv.Atoi(pageParam)
		limit, _ := strconv.Atoi(limitParam)
		if page > 0 && limit > 0 {
			offset := (page - 1) * limit
			query = query.Offset(offset).Limit(limit)
		}
	}

	if err := query.Find(&orders).Error; err != nil {
		c.Error(err)
		return
	}

	var total int64
	countQuery := DB.Model(&Order{})
	if monthParam != "" { countQuery = countQuery.Where("timestamp LIKE ?", monthParam+"%") }
	countQuery.Count(&total)

	c.JSON(200, gin.H{
		"status": "success", 
		"data": orders,
		"total": total,
	}) 
}

func handleSubmitOrder(c *gin.Context) {
	var orderRequest map[string]interface{}
	if err := c.ShouldBindJSON(&orderRequest); err != nil { c.Error(err); return }
	
	currentUserMap, _ := orderRequest["currentUser"].(map[string]interface{})
	userName, _ := currentUserMap["UserName"].(string)
	selectedTeam, _ := orderRequest["selectedTeam"].(string)
	page, _ := orderRequest["page"].(string)
	customer, _ := orderRequest["customer"].(map[string]interface{})
	products, _ := orderRequest["products"].([]interface{})
	payment, _ := orderRequest["payment"].(map[string]interface{})
	shipping, _ := orderRequest["shipping"].(map[string]interface{})
	subtotal, _ := orderRequest["subtotal"].(float64)
	grandTotal, _ := orderRequest["grandTotal"].(float64)
	note, _ := orderRequest["note"].(string)
	fulfillmentStore, _ := orderRequest["fulfillmentStore"].(string)
	scheduledTime, _ := orderRequest["scheduledTime"].(string)

	productsJSON, _ := json.Marshal(products)
	var locationParts []string
	if p, ok := customer["province"].(string); ok && p != "" { locationParts = append(locationParts, p) }
	if d, ok := customer["district"].(string); ok && d != "" { locationParts = append(locationParts, d) }
	if s, ok := customer["sangkat"].(string); ok && s != "" { locationParts = append(locationParts, s) }
	
	var shippingCost float64 = 0
	if val, ok := orderRequest["Internal Cost"]; ok {
		switch v := val.(type) {
		case float64: shippingCost = v
		case string: if parsed, err := strconv.ParseFloat(v, 64); err == nil { shippingCost = parsed }
		}
	} else if costVal, ok := shipping["cost"]; ok {
		switch v := costVal.(type) {
		case float64: shippingCost = v
		case string: if parsed, err := strconv.ParseFloat(v, 64); err == nil { shippingCost = parsed }
		}
	}

	var totalDiscount float64 = 0; var totalProductCost float64 = 0
	for _, p := range products {
		pMap, _ := p.(map[string]interface{})
		op, _ := pMap["originalPrice"].(float64); fp, _ := pMap["finalPrice"].(float64); q, _ := pMap["quantity"].(float64); cost, _ := pMap["cost"].(float64)
		if op > 0 && q > 0 { totalDiscount += (op - fp) * q }; totalProductCost += (cost * q)
	}
	
	rand.Seed(time.Now().UnixNano())
	orderID := generateShortID()
	timestamp := time.Now().UTC().Format(time.RFC3339)
	custName, _ := orderRequest["Customer Name"].(string)
	if custName == "" { custName, _ = customer["name"].(string) }
	custPhone, _ := orderRequest["Customer Phone"].(string)
	if custPhone == "" { custPhone, _ = customer["phone"].(string) }

	paymentStatus, _ := orderRequest["Payment Status"].(string)
	if paymentStatus == "" { paymentStatus, _ = payment["status"].(string) }
	paymentInfo, _ := orderRequest["Payment Info"].(string)
	if paymentInfo == "" { paymentInfo, _ = payment["info"].(string) }
	
	addLocation, _ := orderRequest["Address Details"].(string)
	if addLocation == "" { addLocation, _ = customer["additionalLocation"].(string) }
	
	var shipFeeCustomer float64 = 0
	if val, ok := orderRequest["Shipping Fee (Customer)"]; ok {
		switch v := val.(type) {
		case float64: shipFeeCustomer = v
		case string: if parsed, err := strconv.ParseFloat(v, 64); err == nil { shipFeeCustomer = parsed }
		}
	} else if feeVal, ok := customer["shippingFee"]; ok {
		switch v := feeVal.(type) {
		case float64: shipFeeCustomer = v
		case string: if parsed, err := strconv.ParseFloat(v, 64); err == nil { shipFeeCustomer = parsed }
		}
	}

	internalShipMethod, _ := orderRequest["Internal Shipping Method"].(string)
	if internalShipMethod == "" { internalShipMethod, _ = shipping["method"].(string) }
	internalShipDetails, _ := orderRequest["Internal Shipping Details"].(string)
	if internalShipDetails == "" { internalShipDetails, _ = shipping["details"].(string) }

	newOrder := Order{ 
		OrderID: orderID, Timestamp: timestamp, User: userName, Team: selectedTeam, 
		Page: page, CustomerName: custName, CustomerPhone: custPhone, Subtotal: subtotal, 
		GrandTotal: grandTotal, ProductsJSON: string(productsJSON), Note: note, 
		FulfillmentStore: fulfillmentStore, ScheduledTime: scheduledTime, FulfillmentStatus: "Pending",
		PaymentStatus: paymentStatus, PaymentInfo: paymentInfo, InternalCost: shippingCost, DiscountUSD: totalDiscount,
		TotalProductCost: totalProductCost, Location: strings.Join(locationParts, ", "), AddressDetails: addLocation,
		ShippingFeeCustomer: shipFeeCustomer, InternalShippingMethod: internalShipMethod, InternalShippingDetails: internalShipDetails,
	}

	if err := DB.Create(&newOrder).Error; err != nil { c.Error(err); return }

	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type": "new_order",
		"action": "data_update",
		"data": newOrder,
	})
	hub.broadcast <- eventBytes

	orderChannel <- OrderJob{ JobID: fmt.Sprintf("job_%d", time.Now().UnixNano()), OrderID: orderID, UserName: userName, OrderData: map[string]interface{}{ "orderId": orderID, "timestamp": timestamp, "totalDiscount": totalDiscount, "totalProductCost": totalProductCost, "fullLocation": strings.Join(locationParts, ", "), "productsJSON": string(productsJSON), "shippingCost": shippingCost, "originalRequest": orderRequest, "scheduledTime": scheduledTime } }
	c.JSON(200, gin.H{"status": "success", "orderId": orderID})
}

func handleAdminUpdateOrder(c *gin.Context) {
	var r struct { OrderID string `json:"orderId"`; NewData map[string]interface{} `json:"newData"` }
	if err := c.ShouldBindJSON(&r); err != nil { c.Error(err); return }

	var originalOrder Order
	if err := DB.Where("order_id = ?", r.OrderID).First(&originalOrder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "រកមិនឃើញការកម្មង់"})
		return
	}

	if _, ok := r.NewData["IsVerified"]; ok {
		role, _ := c.Get("role")
		isSystemAdmin, _ := c.Get("isSystemAdmin")
		if !hasPermissionInternal(role.(string), isSystemAdmin.(bool), "verify_order") {
			c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "អ្នកមិនមានសិទ្ធិផ្ទៀងផ្ទាត់ (Verify) ការកម្មង់នេះទេ"})
			return
		}
	}

	mappedData := make(map[string]interface{})
	for k, v := range r.NewData { 
		dbCol := mapToDBColumn(k)
		if isValidOrderColumn(dbCol) && v != nil {
			if dbCol == "discount_usd" || dbCol == "grand_total" || dbCol == "subtotal" || dbCol == "shipping_fee_customer" || dbCol == "internal_cost" || dbCol == "delivery_unpaid" || dbCol == "delivery_paid" || dbCol == "total_product_cost" {
				if f, ok := v.(float64); ok { mappedData[dbCol] = f } else if s, ok := v.(string); ok { if fVal, err := strconv.ParseFloat(s, 64); err == nil { mappedData[dbCol] = fVal } }
			} else { mappedData[dbCol] = fmt.Sprintf("%v", v) }
		}
	}
	if len(mappedData) == 0 { c.JSON(200, gin.H{"status": "success"}); return }
	
	if err := DB.Model(&Order{}).Where("order_id = ?", r.OrderID).Updates(mappedData).Error; err != nil {
		c.Error(err); return
	}

	go func() {
		req := AppsScriptRequest{ 
			Action: "updateOrderTelegram", 
			Secret: appsScriptSecret, 
			OrderData: map[string]interface{}{ 
				"orderId": r.OrderID, 
				"updatedFields": r.NewData,
				"team": originalOrder.Team, 
			},
		}
		jsonData, _ := json.Marshal(req)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jsonData))
	}()

	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminDeleteOrder(c *gin.Context) {
	var r DeleteOrderRequest
	if err := c.ShouldBindJSON(&r); err != nil { c.Error(err); return }
	
	var order Order
	if err := DB.Where("order_id = ?", r.OrderID).First(&order).Error; err == nil {
		go func() { 
			callAppsScriptPOST(AppsScriptRequest{ 
				Action: "deleteOrderTelegram", 
				OrderData: map[string]interface{}{ 
					"orderId": r.OrderID, 
					"team": order.Team, 
					"messageId1": order.TelegramMessageID1, 
					"messageId2": order.TelegramMessageID2, 
					"fulfillmentStore": order.FulfillmentStore,
				},
			}) 
		}()
		DB.Delete(&order)
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminUpdateSheet(c *gin.Context) {
	var req struct { SheetName string `json:"sheetName"`; PrimaryKey map[string]string `json:"primaryKey"`; NewData map[string]interface{} `json:"newData"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	var tableName string
	switch req.SheetName {
		case "Users": tableName = "users"
		case "Stores": tableName = "stores"
		case "Settings": tableName = "settings"
		case "TeamsPages": tableName = "team_pages"
		case "Products": tableName = "products"
		case "Locations": tableName = "locations"
		case "ShippingMethods": tableName = "shipping_methods"
		case "Colors": tableName = "colors"
		case "Drivers": tableName = "drivers"
		case "BankAccounts": tableName = "bank_accounts"
		case "PhoneCarriers": tableName = "phone_carriers"
		case "Inventory": tableName = "inventories"
		case "Roles": tableName = "roles"
		case "RolePermissions": tableName = "role_permissions"
		default: c.Error(fmt.Errorf("unknown sheet")); return
	}
	pkCol := ""; pkVal := ""
	for k, v := range req.PrimaryKey { pkCol = mapToDBColumn(k); pkVal = v }
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData { 
		dbCol := mapToDBColumn(k)
		if v == nil { continue }
		if strings.HasPrefix(dbCol, "is_") || dbCol == "is_system_admin" || dbCol == "require_driver_selection" {
			if b, ok := v.(bool); ok { mappedData[dbCol] = b } else if s, ok := v.(string); ok { mappedData[dbCol] = strings.ToLower(s) == "true" }
		} else { mappedData[dbCol] = v }
	}
	
	if err := DB.Table(tableName).Where(pkCol+" = ?", pkVal).Updates(mappedData).Error; err != nil {
		c.Error(err); return
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type": "update_sheet",
		"action": "data_update",
		"sheetName": req.SheetName,
		"primaryKey": req.PrimaryKey,
		"newData": req.NewData,
	})
	hub.broadcast <- eventBytes
	
	go func() {
		appsReq := AppsScriptRequest{
			Action: "updateSheet",
			Secret: appsScriptSecret,
			SheetName: req.SheetName,
			PrimaryKey: req.PrimaryKey,
			NewData: req.NewData,
		}
		jsonData, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jsonData))
	}()

	c.JSON(200, gin.H{"status": "success"})
}

// ✅ UPGRADED: មុខងារ Add Row ពេញលេញ Sync ទៅ Google Sheet
func handleAdminAddRow(c *gin.Context) {
	var req struct { SheetName string `json:"sheetName"`; NewData map[string]interface{} `json:"newData"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	
	var tableName string
	switch req.SheetName {
		case "Users": tableName = "users"
		case "Stores": tableName = "stores"
		case "Settings": tableName = "settings"
		case "TeamsPages": tableName = "team_pages"
		case "Products": tableName = "products"
		case "Locations": tableName = "locations"
		case "ShippingMethods": tableName = "shipping_methods"
		case "Colors": tableName = "colors"
		case "Drivers": tableName = "drivers"
		case "BankAccounts": tableName = "bank_accounts"
		case "PhoneCarriers": tableName = "phone_carriers"
		case "Inventory": tableName = "inventories"
		case "Roles": tableName = "roles"
		case "RolePermissions": tableName = "role_permissions"
		default: c.Error(fmt.Errorf("unknown sheet")); return
	}

	mappedData := make(map[string]interface{})
	for k, v := range req.NewData { 
		dbCol := mapToDBColumn(k)
		if v == nil { continue }
		if strings.HasPrefix(dbCol, "is_") || dbCol == "is_system_admin" || dbCol == "require_driver_selection" {
			if b, ok := v.(bool); ok { mappedData[dbCol] = b } else if s, ok := v.(string); ok { mappedData[dbCol] = strings.ToLower(s) == "true" }
		} else { mappedData[dbCol] = v }
	}

	if err := DB.Table(tableName).Create(mappedData).Error; err != nil {
		c.Error(err); return
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type": "add_row",
		"action": "data_update",
		"sheetName": req.SheetName,
		"newData": req.NewData,
	})
	hub.broadcast <- eventBytes

	go func() {
		appsReq := AppsScriptRequest{
			Action: "addRow",
			Secret: appsScriptSecret,
			SheetName: req.SheetName,
			NewData: req.NewData,
		}
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}()

	c.JSON(200, gin.H{"status": "success"})
}

// ✅ UPGRADED: មុខងារ Delete Row ពេញលេញ Sync ទៅ Google Sheet
func handleAdminDeleteRow(c *gin.Context) {
	var req struct { SheetName string `json:"sheetName"`; PrimaryKey map[string]string `json:"primaryKey"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }

	var tableName string
	switch req.SheetName {
		case "Users": tableName = "users"
		case "Stores": tableName = "stores"
		case "Settings": tableName = "settings"
		case "TeamsPages": tableName = "team_pages"
		case "Products": tableName = "products"
		case "Locations": tableName = "locations"
		case "ShippingMethods": tableName = "shipping_methods"
		case "Colors": tableName = "colors"
		case "Drivers": tableName = "drivers"
		case "BankAccounts": tableName = "bank_accounts"
		case "PhoneCarriers": tableName = "phone_carriers"
		case "Inventory": tableName = "inventories"
		case "Roles": tableName = "roles"
		case "RolePermissions": tableName = "role_permissions"
		default: c.Error(fmt.Errorf("unknown sheet")); return
	}

	pkCol := ""; pkVal := ""
	for k, v := range req.PrimaryKey { pkCol = mapToDBColumn(k); pkVal = v }

	if err := DB.Table(tableName).Where(pkCol+" = ?", pkVal).Delete(nil).Error; err != nil {
		c.Error(err); return
	}

	// ✅ Special Cleanup for Roles (Delete associated permissions too)
	if tableName == "roles" {
		DB.Where("LOWER(role) = LOWER(?)", pkVal).Delete(&RolePermission{})
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type": "delete_row",
		"action": "data_update",
		"sheetName": req.SheetName,
		"primaryKey": req.PrimaryKey,
	})
	hub.broadcast <- eventBytes

	go func() {
		appsReq := AppsScriptRequest{
			Action: "deleteRow",
			Secret: appsScriptSecret,
			SheetName: req.SheetName,
			PrimaryKey: req.PrimaryKey,
		}
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}()

	c.JSON(200, gin.H{"status": "success"})
}

func handleUpdateFormulaReport(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }
func handleClearCache(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }
func handleAdminUpdateProductTags(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }

func handleUpdateProfile(c *gin.Context) {
	var req struct { UserName string `json:"userName"`; NewData map[string]interface{} `json:"newData"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData { if k == "Password" { continue }; mappedData[mapToDBColumn(k)] = v }
	if err := DB.Model(&User{}).Where("user_name = ?", req.UserName).Updates(mappedData).Error; err != nil {
		c.Error(err); return
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleChangePassword(c *gin.Context) {
	var req struct { UserName string `json:"userName"`; NewPassword string `json:"newPassword"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	if err := DB.Model(&User{}).Where("user_name = ?", req.UserName).Update("password", req.NewPassword).Error; err != nil {
		c.Error(err); return
	}
	c.JSON(200, gin.H{"status": "success"})
}

func uploadToGoogleDriveDirectly(base64Data string, fileName string, mimeType string) (string, string, error) {
	if driveService == nil {
		ctx := context.Background()
		if err := createGoogleAPIClient(ctx); err != nil {
			return "", "", fmt.Errorf("failed to init drive client: %v", err)
		}
	}

	if strings.Contains(base64Data, "base64,") {
		parts := strings.Split(base64Data, "base64,")
		base64Data = parts[1]
	}
	
	cleanMimeType := mimeType
	if strings.Contains(mimeType, ";") {
		cleanMimeType = strings.Split(mimeType, ";")[0]
	}

	finalFileName := fileName
	if strings.HasPrefix(cleanMimeType, "audio/webm") && !strings.HasSuffix(finalFileName, ".webm") { finalFileName += ".webm" }
	if strings.HasPrefix(cleanMimeType, "audio/mp3") && !strings.HasSuffix(finalFileName, ".mp3") { finalFileName += ".mp3" }
	if strings.HasPrefix(cleanMimeType, "audio/ogg") && !strings.HasSuffix(finalFileName, ".ogg") { finalFileName += ".ogg" }
	if strings.HasPrefix(cleanMimeType, "audio/mp4") && !strings.HasSuffix(finalFileName, ".m4a") { finalFileName += ".m4a" }
	if strings.HasPrefix(cleanMimeType, "image/jpeg") && !strings.HasSuffix(finalFileName, ".jpg") { finalFileName += ".jpg" }
	if strings.HasPrefix(cleanMimeType, "image/png") && !strings.HasSuffix(finalFileName, ".png") { finalFileName += ".png" }

	decodedBytes, err := parseBase64(base64Data)
	if err != nil {
		return "", "", fmt.Errorf("failed to decode base64: %v", err)
	}

	f := &drive.File{ Name: finalFileName, MimeType: cleanMimeType }
	if uploadFolderID != "" { f.Parents = []string{uploadFolderID} }

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	file, err := driveService.Files.Create(f).Media(bytes.NewReader(decodedBytes)).Context(ctx).Do()
	if err != nil { return "", "", fmt.Errorf("drive api error: %v", err) }

	permission := &drive.Permission{ Type: "anyone", Role: "reader" }
	_, _ = driveService.Permissions.Create(file.Id, permission).Context(ctx).Do()

	return fmt.Sprintf("https://drive.google.com/uc?id=%s", file.Id), file.Id, nil
}

func handleImageUploadProxy(c *gin.Context) {
	var req AppsScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	if req.FileData == "" { 
		c.Error(fmt.Errorf("មិនមានទិន្នន័យឯកសារ"))
		return 
	}
	
	c.JSON(200, gin.H{
		"status": "success", 
		"message": "កំពុងបញ្ជូនឯកសារ...",
	})

	go func(r AppsScriptRequest) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("⚠️ Recovered from panic during upload: %v", rec)
			}
		}()
		
		finalFileName := r.FileName
		if r.OrderID != "" {
			finalFileName = r.OrderID
		}
		
		url, _, err := uploadToGoogleDriveDirectly(r.FileData, finalFileName, r.MimeType)
		if err != nil { log.Printf("❌ Direct Upload Failed: %v", err); return }
		
		if r.OrderID != "" && r.TargetColumn != "" {
			dbCol := mapToDBColumn(r.TargetColumn)
			if isValidOrderColumn(dbCol) {
				var order Order
				if err := DB.Where("order_id = ?", r.OrderID).First(&order).Error; err == nil {
					DB.Model(&order).Update(dbCol, url)

					syncReq := AppsScriptRequest{
						Action: "updateOrderTelegram",
						Secret: appsScriptSecret,
						OrderData: map[string]interface{}{
							"orderId": r.OrderID,
							"team":    order.Team,
							"updatedFields": map[string]interface{}{
								r.TargetColumn: url, 
							},
						},
					}
					jb, _ := json.Marshal(syncReq)
					http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
					log.Printf("✅ Photo URL synced to Google Sheet for Order %s", r.OrderID)
				}
			}
		}
	}(req)
}

func handleGetChatMessages(c *gin.Context) {
	limitParam := c.Query("limit")
	receiverParam := c.Query("receiver") 
	currentUser, _ := c.Get("userName")  

	var messages []ChatMessage
	query := DB.Order("timestamp desc")

	if receiverParam != "" {
		query = query.Where("(user_name = ? AND receiver = ?) OR (user_name = ? AND receiver = ?)", currentUser, receiverParam, receiverParam, currentUser)
	} else {
		query = query.Where("receiver = ?", "")
	}

	if limitParam != "" {
		limit, _ := strconv.Atoi(limitParam)
		if limit > 0 { query = query.Limit(limit) }
	} else {
		query = query.Limit(100) 
	}

	if err := query.Find(&messages).Error; err != nil {
		c.Error(err)
		return
	}
	
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	c.JSON(200, gin.H{"status": "success", "data": messages})
}

func handleSendChatMessage(c *gin.Context) {
	var msg ChatMessage
	if err := c.ShouldBindJSON(&msg); err != nil { 
		c.Error(fmt.Errorf("File too large or invalid format"))
		return 
	}
	
	if sender, exists := c.Get("userName"); exists {
		msg.UserName = sender.(string)
	}

	msg.Timestamp = time.Now().Format(time.RFC3339)
	
	if (msg.MessageType == "audio" || msg.MessageType == "image") && msg.FileID == "" && len(msg.Content) > 100 {
		DB.Create(&msg)
		
		msgBytes, _ := json.Marshal(map[string]interface{}{
			"action": "new_message",
			"payload": msg,
		})
		hub.broadcast <- msgBytes
		c.JSON(200, gin.H{"status": "success", "data": msg})

		go func(m ChatMessage) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("⚠️ Recovered from panic during chat upload: %v", rec)
				}
			}()

			mimeType := "application/octet-stream"
			base64Data := m.Content
			
			if strings.Contains(m.Content, "data:") && strings.Contains(m.Content, ";base64,") {
				parts := strings.Split(m.Content, ";base64,")
				if len(parts) == 2 {
					mimeType = parts[0]
					base64Data = parts[1]
				}
			}
			
			fileName := fmt.Sprintf("chat_%s_%d", m.MessageType, time.Now().Unix())
			_, fileId, err := uploadToGoogleDriveDirectly(base64Data, fileName, mimeType)
			
			if err == nil && fileId != "" {
				DB.Model(&ChatMessage{}).Where("id = ?", m.ID).Updates(map[string]interface{}{ 
					"file_id": fileId, 
					"content": "", 
				})

				updateMsg, _ := json.Marshal(map[string]interface{}{
					"action": "upload_complete",
					"payload": map[string]interface{}{
						"Timestamp": m.Timestamp,
						"id": m.ID,
						"FileID": fileId,
						"Content": fmt.Sprintf("https://drive.google.com/uc?id=%s", fileId),
					},
				})
				hub.broadcast <- updateMsg
			}
		}(msg)
		return
	}

	if err := DB.Create(&msg).Error; err != nil { c.Error(err); return }
	
	msgBytes, _ := json.Marshal(map[string]interface{}{
		"action": "new_message",
		"payload": msg,
	})
	hub.broadcast <- msgBytes
	c.JSON(200, gin.H{"status": "success", "data": msg})
}

func handleDeleteChatMessage(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }

func handleGetAudioProxy(c *gin.Context) {
	fileID := c.Param("fileID"); resp, err := http.Get(fmt.Sprintf("https://drive.google.com/uc?id=%s&export=download", fileID))
	if err != nil || resp.StatusCode != 200 { c.Error(fmt.Errorf("failed to fetch audio")); return }; defer resp.Body.Close()
	c.Writer.Header().Set("Content-Type", resp.Header.Get("Content-Type")); io.Copy(c.Writer, resp.Body)
}

func main() {
	port := os.Getenv("PORT"); if port == "" { port = "8080" }
	spreadsheetID = os.Getenv("GOOGLE_SHEET_ID")
	appsScriptURL = os.Getenv("APPS_SCRIPT_URL")
	appsScriptSecret = os.Getenv("APPS_SCRIPT_SECRET")
	uploadFolderID = os.Getenv("UPLOAD_FOLDER_ID")
	
	jwtSecretEnv := os.Getenv("JWT_SECRET")
	if jwtSecretEnv == "" {
		jwtSecretEnv = "my-super-secret-key-change-me-in-production"
	}
	jwtSecret = []byte(jwtSecretEnv)

	initDB(); hub = NewHub(); go hub.run(); go startOrderWorker(); startScheduler()
	
	r := gin.Default()
	r.Use(ErrorHandlingMiddleware())
	r.MaxMultipartMemory = 100 << 20 // 100MB
	
	cConfig := cors.DefaultConfig(); cConfig.AllowOrigins = []string{"*"}
	cConfig.AllowMethods = []string{"GET", "POST", "OPTIONS", "PUT", "DELETE"}
	cConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization", "Content-Length", "X-Requested-With"}
	r.Use(cors.New(cConfig))

	r.StaticFile("/CustomerAction.html", "./CustomerAction.html")
	
	api := r.Group("/api")
	api.GET("/ping", func(c *gin.Context){ c.JSON(200, gin.H{"message": "Pong"}) })
	
	api.POST("/login", handleLogin)

	protected := api.Group("/")
	protected.Use(AuthMiddleware()) 
	{
		protected.GET("/users", handleGetUsers)
		protected.GET("/static-data", handleGetStaticData)
		protected.POST("/submit-order", handleSubmitOrder) // Removed RequirePermission for create_order
		protected.POST("/upload-image", handleImageUploadProxy)
		protected.GET("/permissions", handleGetUserPermissions)
		protected.GET("/roles", handleGetRoles)
		
		chat := protected.Group("/chat")
		chat.GET("/messages", handleGetChatMessages)
		chat.POST("/send", handleSendChatMessage)
		chat.POST("/delete", handleDeleteChatMessage)
		
		admin := protected.Group("/admin")
		admin.Use(AdminOnlyMiddleware())
		{
			admin.GET("/all-orders", handleGetAllOrders)
			admin.POST("/update-order", RequirePermission("edit_order"), handleAdminUpdateOrder)
			admin.POST("/migrate-data", handleMigrateData)
			admin.POST("/update-formula-report", handleUpdateFormulaReport)
			admin.GET("/revenue-summary", handleGetRevenueSummary)
			admin.POST("/update-sheet", handleAdminUpdateSheet)
			admin.POST("/add-row", handleAdminAddRow)
			admin.POST("/delete-row", handleAdminDeleteRow)
			admin.POST("/clear-cache", handleClearCache)
			admin.POST("/delete-order", RequirePermission("delete_order"), handleAdminDeleteOrder)
			admin.POST("/update-product-tags", handleAdminUpdateProductTags)
			admin.GET("/permissions", handleGetAllPermissions)
			admin.POST("/permissions", handleUpdatePermission)
			admin.POST("/permissions/update", handleUpdatePermission) // Added for compatibility
			admin.POST("/roles", handleCreateRole)
		}

		profile := protected.Group("/profile")
		profile.POST("/update", handleUpdateProfile)
		profile.POST("/change-password", handleChangePassword)
	}

	api.GET("/chat/ws", serveWs)
	api.GET("/chat/audio/:fileID", handleGetAudioProxy)
	
	go func() {
		ctx := context.Background()
		createGoogleAPIClient(ctx)
	}()
	
	log.Println("🚀 Server running on port", port); r.Run(":" + port)
}
