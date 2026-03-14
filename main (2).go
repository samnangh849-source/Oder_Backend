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
	"sync" 
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

type RevenueEntry struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; Team string `json:"Team"`; Page string `json:"Page"`; Revenue float64 `json:"Revenue"`; FulfillmentStore string `json:"Fulfillment Store"` }

type ChatMessage struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Timestamp   string `gorm:"index" json:"Timestamp"`
	UserName    string `json:"UserName"`
	Receiver    string `json:"Receiver"`
	MessageType string `json:"MessageType"`
	Content     string `gorm:"type:text" json:"Content"`
	FileID      string `json:"FileID,omitempty"`
	AudioData   string `gorm:"-" json:"AudioData,omitempty"`
}

type EditLog struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; OrderID string `json:"OrderID"`; Requester string `json:"Requester"`; FieldChanged string `json:"Field Changed"`; OldValue string `json:"Old Value"`; NewValue string `json:"New Value"` }
type UserActivityLog struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; User string `json:"User"`; Action string `json:"Action"`; Details string `json:"Details"` }

type Role struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	RoleName    string `gorm:"uniqueIndex" json:"roleName"`
	Description string `json:"description"`
}

type RolePermission struct {
	ID        uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Role      string `gorm:"index" json:"role"`
	Feature   string `gorm:"index" json:"feature"`
	IsEnabled bool   `json:"isEnabled"`
}

type IncentiveCalculator struct {
	ID        uint    `gorm:"primaryKey" json:"id"`
	Name      string  `json:"name"`
	Type      string  `json:"type"` 
	Value     float64 `json:"value"`
	RulesJSON string  `gorm:"type:text" json:"rulesJson"`
}

type IncentiveProject struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	ProjectName  string `json:"projectName"`
	CalculatorID uint   `json:"calculatorId"`
	StartDate    string `json:"startDate"` 
	EndDate      string `json:"endDate"`   
	TargetTeam   string `json:"targetTeam"`
	Status       string `json:"status"`    
}

type IncentiveResult struct {
	ID              uint    `gorm:"primaryKey" json:"id"`
	ProjectID       uint    `gorm:"index" json:"projectId"`
	UserName        string  `json:"userName"`
	TotalOrders     int     `json:"totalOrders"`
	TotalRevenue    float64 `json:"totalRevenue"`
	CalculatedValue float64 `json:"calculatedValue"`
}

type DeleteOrderRequest struct { OrderID string `json:"orderId"`; Team string `json:"team"`; UserName string `json:"userName"` }

type TempImage struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	MimeType  string    `json:"mimeType"`
	ImageData string    `gorm:"type:text" json:"imageData"` 
	ExpiresAt time.Time `gorm:"index" json:"expiresAt"`
}

// =========================================================================
// INIT DATABASE & GOOGLE SERVICES
// =========================================================================
func initDB() {
	log.Println("🔌 Initializing PostgreSQL database connection...")
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" { log.Fatal("❌ DATABASE_URL is not set!") }

	var db *gorm.DB
	var err error
	maxRetries := 10

	for i := 0; i < maxRetries; i++ {
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Error)})
		if err == nil {
			break
		}
		log.Printf("⚠️ ភ្ជាប់ Database មិនបាន (ព្យាយាមលើកទី %d/%d): %v", i+1, maxRetries, err)
		time.Sleep(10 * time.Second) 
	}

	if err != nil {
		log.Fatal("❌ បរាជ័យក្នុងការភ្ជាប់ Database ជាស្ថាពរ:", err)
	}

	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(1)                   
		sqlDB.SetMaxOpenConns(3)                   
		sqlDB.SetMaxOpenConns(3)                   
		sqlDB.SetConnMaxLifetime(10 * time.Minute) 
		log.Println("⚡ Database Connection Pool Optimized (Minimal Limits)!")
	}

	log.Println("✅ Database connection established!")
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
		&IncentiveCalculator{}, 
		&IncentiveProject{},    
		&IncentiveResult{}, 
		&TempImage{}, 
	)
	if err != nil { log.Fatal("❌ Migration failed:", err) }

	DB = db

	// ធានាថាមាន Role "Admin" ជានិច្ច (តែមួយគត់ដែលជាកាតព្វកិច្ច)
	var adminRole Role
	result := DB.Where("LOWER(role_name) = ?", "admin").First(&adminRole)
	if result.Error != nil && result.Error == gorm.ErrRecordNotFound {
		adminRole = Role{RoleName: "Admin", Description: "Administrator with full access"}
		if err := DB.Create(&adminRole).Error; err == nil {
			log.Println("✅ បង្កើតតួនាទី (Admin) ដោយស្វ័យប្រវត្តិបានជោគជ័យ!")
			
			// បញ្ជូនទៅ Google Sheets ផងដែរ
			go func(r Role) {
				// រង់ចាំបន្តិចដើម្បីឱ្យ spreadsheetID និង appsScriptURL ត្រូវបានកំណត់ក្នុង main()
				time.Sleep(2 * time.Second)
				if appsScriptURL != "" {
					appsReq := AppsScriptRequest{
						Action: "addRow",
						Secret: appsScriptSecret,
						SheetName: "Roles",
						NewData: map[string]interface{}{
							"ID":          r.ID,
							"RoleName":    r.RoleName,
							"Description": r.Description,
						},
					}
					jb, _ := json.Marshal(appsReq)
					http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
					log.Println("✅ បញ្ជូន Role Admin ទៅ Google Sheets រួចរាល់!")
				}
			}(adminRole)
		}
	}

	log.Println("✅ Successfully setup database tables!")
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
		"ImageURL":                "image_url", 
		"Image URL":               "image_url",
	}

	for k, v := range specialCases {
		if strings.EqualFold(k, key) {
			return v
		}
	}

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

func getTableName(sheetName string) string {
	switch sheetName {
	case "Users": return "users"
	case "Stores": return "stores"
	case "Settings": return "settings"
	case "TeamsPages": return "team_pages"
	case "Products": return "products"
	case "Locations": return "locations"
	case "ShippingMethods": return "shipping_methods"
	case "Colors": return "colors"
	case "Drivers": return "drivers"
	case "BankAccounts": return "bank_accounts"
	case "PhoneCarriers": return "phone_carriers"
	case "Inventory": return "inventories"
	case "StockTransfers": return "stock_transfers"
	case "Returns": return "returns"
	case "AllOrders": return "orders"
	case "Roles": return "roles"
	case "RolePermissions": return "role_permissions"
	}
	return ""
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
			c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "មិនមានសិទ្ធិចូលប្រើប្រាស់ (Missing Token)"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "ទម្រង់ Token មិនត្រឹមត្រូវ"})
			c.Abort()
			return
		}

		tokenString := parts[1]

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

		if (!exists || !isSystemAdmin.(bool)) && (!roleExists || role.(string) != "Admin") {
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

		if isSystemAdmin != nil && isSystemAdmin.(bool) {
			c.Next()
			return
		}

		if role != nil && role.(string) == "Admin" {
			c.Next()
			return
		}

		var perm RolePermission
		result := DB.Where("role = ? AND feature = ?", role, feature).First(&perm)

		if result.Error != nil || !perm.IsEnabled {
			c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "អ្នកមិនមានសិទ្ធិសម្រាប់មុខងារនេះទេ (" + feature + ")"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func hasPermissionInternal(role string, isSystemAdmin bool, feature string) bool {
	if isSystemAdmin || role == "Admin" {
		return true
	}
	var perm RolePermission
	result := DB.Where("role = ? AND feature = ?", role, feature).First(&perm)
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
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ: " + err.Error()})
		return
	}

	if req.RoleName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ឈ្មោះតួនាទី (Role) មិនអាចទទេរបានទេ"})
		return
	}

	var count int64
	DB.Model(&Role{}).Where("role_name = ?", req.RoleName).Count(&count)
	if count > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ឈ្មោះតួនាទីនេះមានរួចហើយ សូមជ្រើសរើសឈ្មោះផ្សេង!"})
		return
	}

	req.ID = 0
	
	if err := DB.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ការបង្កើត Role បរាជ័យ: " + err.Error()})
		return
	}

	sheetData := map[string]interface{}{
		"ID":          req.ID,
		"RoleName":    req.RoleName,
		"Description": req.Description,
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type": "add_row",
		"sheetName": "Roles",
		"newData": req, 
	})
	hub.broadcast <- eventBytes

	go func() {
		appsReq := AppsScriptRequest{
			Action: "addRow",
			Secret: appsScriptSecret,
			SheetName: "Roles",
			NewData: sheetData,
		}
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}()

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
	
	if err := DB.Where("role = ?", role).Find(&permissions).Error; err != nil {
		c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": permissions})
}

func handleUpdatePermission(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "មិនអាចអានទិន្នន័យបានទេ"})
		return
	}

	var reqs []RolePermission
	var singleReq RolePermission

	if err := json.Unmarshal(body, &reqs); err != nil {
		if err := json.Unmarshal(body, &singleReq); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទម្រង់ទិន្នន័យមិនត្រឹមត្រូវ: " + err.Error()})
			return
		}
		reqs = []RolePermission{singleReq}
	}

	for _, req := range reqs {
		if req.Role == "" || req.Feature == "" {
			continue 
		}

		var existing RolePermission
		result := DB.Where("role = ? AND feature = ?", req.Role, req.Feature).First(&existing)
		
		if result.Error != nil && result.Error == gorm.ErrRecordNotFound {
			req.ID = 0
			
			DB.Create(&req)
			
			go func(r RolePermission) {
				appsReq := AppsScriptRequest{
					Action: "addRow",
					Secret: appsScriptSecret,
					SheetName: "RolePermissions",
					NewData: map[string]interface{}{
						"ID":        r.ID, 
						"Role":      r.Role,
						"Feature":   r.Feature,
						"IsEnabled": r.IsEnabled,
					},
				}
				jb, _ := json.Marshal(appsReq)
				http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
			}(req)

		} else if result.Error == nil {
			DB.Model(&existing).Update("is_enabled", req.IsEnabled)
			
			go func(r RolePermission) {
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
		}

		eventBytes, _ := json.Marshal(map[string]interface{}{
			"type": "update_permission",
			"role": req.Role,
			"feature": req.Feature,
			"isEnabled": req.IsEnabled,
		})
		hub.broadcast <- eventBytes
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "បានរក្សាទុកសិទ្ធិដោយជោគជ័យ"})
}

// =========================================================================
// API សម្រាប់ប្រព័ន្ធ INCENTIVE (ប្រាក់លើកទឹកចិត្ត)
// =========================================================================

func handleGetIncentiveCalculators(c *gin.Context) {
	var calcs []IncentiveCalculator
	DB.Find(&calcs)
	c.JSON(200, gin.H{"status": "success", "data": calcs})
}

func handleCreateIncentiveCalculator(c *gin.Context) {
	var req IncentiveCalculator
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": err.Error()})
		return
	}
	if err := DB.Create(&req).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success", "data": req})
}

func handleGetIncentiveProjects(c *gin.Context) {
	var projects []IncentiveProject
	DB.Find(&projects)
	c.JSON(200, gin.H{"status": "success", "data": projects})
}

func handleCreateIncentiveProject(c *gin.Context) {
	var req IncentiveProject
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": err.Error()})
		return
	}
	if err := DB.Create(&req).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success", "data": req})
}

func handleGetIncentiveResults(c *gin.Context) {
	projectId := c.Query("projectId")
	var results []IncentiveResult
	query := DB.Model(&IncentiveResult{})
	if projectId != "" {
		query = query.Where("project_id = ?", projectId)
	}
	query.Find(&results)
	c.JSON(200, gin.H{"status": "success", "data": results})
}

func handleCalculateIncentive(c *gin.Context) {
	var req struct {
		ProjectID uint `json:"projectId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	var project IncentiveProject
	if err := DB.First(&project, req.ProjectID).Error; err != nil {
		c.JSON(404, gin.H{"status": "error", "message": "រកគម្រោងមិនឃើញ"})
		return
	}

	var calc IncentiveCalculator
	if err := DB.First(&calc, project.CalculatorID).Error; err != nil {
		c.JSON(404, gin.H{"status": "error", "message": "រករូបមន្តមិនឃើញ"})
		return
	}

	startDate := project.StartDate
	if len(startDate) == 10 {
		startDate += "T00:00:00Z"
	}
	endDate := project.EndDate
	if len(endDate) == 10 {
		endDate += "T23:59:59Z"
	}

	var orders []Order
	DB.Where("team = ? AND fulfillment_status = ? AND timestamp >= ? AND timestamp <= ?",
		project.TargetTeam, "Delivered", startDate, endDate).Find(&orders)

	type userStats struct {
		Orders  int
		Revenue float64
	}
	stats := make(map[string]userStats)
	for _, o := range orders {
		s := stats[o.User]
		s.Orders++
		s.Revenue += o.GrandTotal
		stats[o.User] = s
	}

	DB.Where("project_id = ?", project.ID).Delete(&IncentiveResult{})

	var results []IncentiveResult
	for user, s := range stats {
		var val float64
		if calc.Type == "Fixed Per Order" {
			val = float64(s.Orders) * calc.Value
		} else if calc.Type == "Percentage of Revenue" {
			val = s.Revenue * (calc.Value / 100.0)
		}

		results = append(results, IncentiveResult{
			ProjectID:       project.ID,
			UserName:        user,
			TotalOrders:     s.Orders,
			TotalRevenue:    s.Revenue,
			CalculatedValue: val,
		})
	}

	if len(results) > 0 {
		DB.Create(&results)
	}

	c.JSON(200, gin.H{"status": "success", "message": "ការគណនាទទួលបានជោគជ័យ!", "data": results})
}

// =========================================================================
// ប្រព័ន្ធ BACKGROUND QUEUE & SCHEDULER
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
				msgBytes, _ := json.Marshal(map[string]interface{}{"type": "system_notification", "status": "success", "targetUser": job.UserName, "message": "បាញ់ទៅ Telegram ជោគជ័យ!", "jobId": job.JobID})
				hub.broadcast <- msgBytes
			}
		}()
	}
}

func startScheduler() {
	ticker := time.NewTicker(1 * time.Minute)
	cleanupTicker := time.NewTicker(5 * time.Minute) 

	go func() {
		for {
			select {
			case <-ticker.C:
				callAppsScriptPOST(AppsScriptRequest{Action: "checkScheduledOrders"})
			case <-cleanupTicker.C:
				result := DB.Where("expires_at < ?", time.Now()).Delete(&TempImage{})
				if result.RowsAffected > 0 {
					log.Printf("🧹 Cleanup: លុបរូបភាពបណ្ដោះអាសន្នចំនួន %d ឯកសារដែលហួសពេលចេញពី Database", result.RowsAffected)
				}
			}
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

func handleGetStaticData(c *gin.Context) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	result := make(map[string]interface{})

	queries := []func(){
		func() { var d []Product; DB.Find(&d); mu.Lock(); result["products"] = d; mu.Unlock() },
		func() { var d []Store; DB.Find(&d); mu.Lock(); result["stores"] = d; mu.Unlock() },
		func() { var d []TeamPage; DB.Find(&d); mu.Lock(); result["pages"] = d; mu.Unlock() },
		func() { var d []Location; DB.Find(&d); mu.Lock(); result["locations"] = d; mu.Unlock() },
		func() { var d []ShippingMethod; DB.Find(&d); mu.Lock(); result["shippingMethods"] = d; mu.Unlock() },
		func() { var d []Color; DB.Find(&d); mu.Lock(); result["colors"] = d; mu.Unlock() },
		func() { var d []Driver; DB.Find(&d); mu.Lock(); result["drivers"] = d; mu.Unlock() },
		func() { var d []BankAccount; DB.Find(&d); mu.Lock(); result["bankAccounts"] = d; mu.Unlock() },
		func() { var d []PhoneCarrier; DB.Find(&d); mu.Lock(); result["phoneCarriers"] = d; mu.Unlock() },
		func() { var d []Inventory; DB.Find(&d); mu.Lock(); result["inventory"] = d; mu.Unlock() },
		func() { var d []StockTransfer; DB.Find(&d); mu.Lock(); result["stockTransfers"] = d; mu.Unlock() },
		func() { var d []ReturnItem; DB.Find(&d); mu.Lock(); result["returns"] = d; mu.Unlock() },
		func() { var d []Role; DB.Find(&d); mu.Lock(); result["roles"] = d; mu.Unlock() },
		func() { var d []RolePermission; DB.Find(&d); mu.Lock(); result["rolePermissions"] = d; mu.Unlock() },
		func() {
			var settings []Setting
			DB.Find(&settings)
			settingsObj := make(map[string]interface{})
			for _, s := range settings {
				settingsObj[s.ConfigKey] = s.ConfigValue
				if s.ConfigKey == "UploadFolderID" {
					envVal := os.Getenv("UPLOAD_FOLDER_ID")
					if envVal != "" {
						uploadFolderID = envVal
					} else {
						uploadFolderID = s.ConfigValue
					}
				}
			}
			mu.Lock()
			result["settings"] = settingsObj
			mu.Unlock()
		},
	}

	for _, q := range queries {
		wg.Add(1)
		go func(f func()) {
			defer wg.Done()
			f()
		}(q)
	}

	wg.Wait() 

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": result})
}

func fetchSheetDataFromAPI(sheetName string) ([]map[string]interface{}, error) {
	readRange, ok := sheetRanges[sheetName]
	if !ok { return nil, fmt.Errorf("range not defined") }
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil { return nil, err }
	return convertSheetValuesToMaps(resp)
}

func isNumericHeader(h string) bool { return h=="Price" || h=="Cost" || h=="Grand Total" || h=="Subtotal" || h=="Shipping Fee (Customer)" || h=="Internal Cost" || h=="Discount ($)" || h=="Delivery Unpaid" || h=="Delivery Paid" || h=="Total Product Cost ($)" || h=="Revenue" || h=="Quantity" || h=="Part" }
func isBoolHeader(h string) bool { return h=="IsSystemAdmin" || h=="AllowManualDriver" || h=="RequireDriverSelection" || h=="EnableCODAlert" || h=="IsRestocked" }

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

		log.Println("🔄 ចាប់ផ្តើមទាញទិន្នន័យថ្មីពី Google Sheet...")

		var users []User; if fetchSheetDataToStruct("Users", &users) == nil { 
			var valid []User; seen := make(map[string]bool)
			for _, x := range users { if x.UserName != "" && !seen[x.UserName] { seen[x.UserName] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var stores []Store; if fetchSheetDataToStruct("Stores", &stores) == nil { 
			var valid []Store; seen := make(map[string]bool)
			for _, x := range stores { if x.StoreName != "" && !seen[x.StoreName] { seen[x.StoreName] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var settings []Setting; 
		if fetchSheetDataToStruct("Settings", &settings) == nil { 
			for _, s := range settings { 
				if s.ConfigKey != "" { 
					DB.Save(&s) 
					if s.ConfigKey == "UploadFolderID" { 
                        envVal := os.Getenv("UPLOAD_FOLDER_ID")
                        if envVal != "" { uploadFolderID = envVal } else { uploadFolderID = s.ConfigValue }
					} 
				} 
			} 
		}
		
		var pages []TeamPage; if fetchSheetDataToStruct("TeamsPages", &pages) == nil { 
			var valid []TeamPage; for _, x := range pages { if x.PageName != "" { valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var products []Product; if fetchSheetDataToStruct("Products", &products) == nil { 
			var valid []Product; seen := make(map[string]bool)
			for _, x := range products { if x.Barcode != "" && !seen[x.Barcode] { seen[x.Barcode] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var locations []Location; if fetchSheetDataToStruct("Locations", &locations) == nil && len(locations) > 0 { DB.CreateInBatches(locations, 100) }
		
		var shipping []ShippingMethod; if fetchSheetDataToStruct("ShippingMethods", &shipping) == nil { 
			var valid []ShippingMethod; seen := make(map[string]bool)
			for _, x := range shipping { if x.MethodName != "" && !seen[x.MethodName] { seen[x.MethodName] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var colors []Color; if fetchSheetDataToStruct("Colors", &colors) == nil { 
			var valid []Color; seen := make(map[string]bool)
			for _, x := range colors { if x.ColorName != "" && !seen[x.ColorName] { seen[x.ColorName] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var drivers []Driver; if fetchSheetDataToStruct("Drivers", &drivers) == nil { 
			var valid []Driver; seen := make(map[string]bool)
			for _, x := range drivers { if x.DriverName != "" && !seen[x.DriverName] { seen[x.DriverName] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var banks []BankAccount; if fetchSheetDataToStruct("BankAccounts", &banks) == nil { 
			var valid []BankAccount; seen := make(map[string]bool)
			for _, x := range banks { if x.BankName != "" && !seen[x.BankName] { seen[x.BankName] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var carriers []PhoneCarrier; if fetchSheetDataToStruct("PhoneCarriers", &carriers) == nil { 
			var valid []PhoneCarrier; seen := make(map[string]bool)
			for _, x := range carriers { if x.CarrierName != "" && !seen[x.CarrierName] { seen[x.CarrierName] = true; valid = append(valid, x) } }
			if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
		}
		
		var templates []TelegramTemplate; if fetchSheetDataToStruct("TelegramTemplates", &templates) == nil && len(templates) > 0 { DB.CreateInBatches(templates, 100) }
		var inventory []Inventory; if fetchSheetDataToStruct("Inventory", &inventory) == nil && len(inventory) > 0 { DB.CreateInBatches(inventory, 100) }
		var transfers []StockTransfer; if fetchSheetDataToStruct("StockTransfers", &transfers) == nil { var valid []StockTransfer; for _, x := range transfers { if x.TransferID != "" { valid = append(valid, x) } }; if len(valid) > 0 { DB.CreateInBatches(valid, 100) } }
		var returns []ReturnItem; if fetchSheetDataToStruct("Returns", &returns) == nil { var valid []ReturnItem; for _, x := range returns { if x.ReturnID != "" { valid = append(valid, x) } }; if len(valid) > 0 { DB.CreateInBatches(valid, 100) } }
		var revs []RevenueEntry; if fetchSheetDataToStruct("RevenueDashboard", &revs) == nil && len(revs) > 0 { DB.CreateInBatches(revs, 100) }
		var chats []ChatMessage; if fetchSheetDataToStruct("ChatMessages", &chats) == nil && len(chats) > 0 { DB.CreateInBatches(chats, 100) }
		var editLogs []EditLog; if fetchSheetDataToStruct("EditLogs", &editLogs) == nil && len(editLogs) > 0 { DB.CreateInBatches(editLogs, 100) }
		var actLogs []UserActivityLog; if fetchSheetDataToStruct("UserActivityLogs", &actLogs) == nil && len(actLogs) > 0 { DB.CreateInBatches(actLogs, 100) }
		
		var orders []Order
		if fetchSheetDataToStruct("AllOrders", &orders) == nil { 
            var valid []Order
			seen := make(map[string]bool)
            for _, o := range orders { 
				if o.OrderID != "" && !seen[o.OrderID] { 
					seen[o.OrderID] = true
					valid = append(valid, o) 
				}
			}
            if len(valid) > 0 { DB.CreateInBatches(valid, 100) } 
        }
		
		log.Println("🎉 Migration ជោគជ័យ!")
	}()
	c.JSON(200, gin.H{"status": "success", "message": "Migration started."})
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

func handleGetAllOrders(c *gin.Context) { 
	var orders []Order
	query := DB.Order("timestamp desc")
	countQuery := DB.Model(&Order{})

	role, _ := c.Get("role")
	team, _ := c.Get("team")
	isSystemAdmin, _ := c.Get("isSystemAdmin")

	isAdmin := (isSystemAdmin != nil && isSystemAdmin.(bool)) || strings.EqualFold(fmt.Sprintf("%v", role), "Admin")

	if !isAdmin && team != nil {
		teams := strings.Split(fmt.Sprintf("%v", team), ",")
		var teamConditions []string
		var teamArgs []interface{}
		for _, t := range teams {
			t = strings.TrimSpace(t)
			if t != "" {
				teamConditions = append(teamConditions, "LOWER(team) = LOWER(?)")
				teamArgs = append(teamArgs, t)
			}
		}
		if len(teamConditions) > 0 {
			condition := strings.Join(teamConditions, " OR ")
			query = query.Where(condition, teamArgs...)
			countQuery = countQuery.Where(condition, teamArgs...)
		}
	}

	if err := query.Find(&orders).Error; err != nil { c.Error(err); return }
	var total int64
	countQuery.Count(&total)
	c.JSON(200, gin.H{"status": "success", "data": orders, "total": total}) 
}

func handleSubmitOrder(c *gin.Context) {
	var orderRequest struct { CurrentUser User `json:"currentUser"`; SelectedTeam string `json:"selectedTeam"`; Page string `json:"page"`; Customer map[string]interface{} `json:"customer"`; Products []map[string]interface{} `json:"products"`; Payment map[string]interface{} `json:"payment"`; Shipping map[string]interface{} `json:"shipping"`; Subtotal float64 `json:"subtotal"`; GrandTotal float64 `json:"grandTotal"`; Note string `json:"note"`; FulfillmentStore string `json:"fulfillmentStore"`; ScheduledTime string `json:"scheduledTime"` }
	if err := c.ShouldBindJSON(&orderRequest); err != nil { c.Error(err); return }
	
	productsJSON, _ := json.Marshal(orderRequest.Products)
	var locationParts []string
	if p, ok := orderRequest.Customer["province"].(string); ok && p != "" { locationParts = append(locationParts, p) }
	if d, ok := orderRequest.Customer["district"].(string); ok && d != "" { locationParts = append(locationParts, d) }
	if s, ok := orderRequest.Customer["sangkat"].(string); ok && s != "" { locationParts = append(locationParts, s) }
	
	var shippingCost float64 = 0
	if costVal, ok := orderRequest.Shipping["cost"]; ok {
		switch v := costVal.(type) {
		case float64: shippingCost = v
		case string: if parsed, err := strconv.ParseFloat(v, 64); err == nil { shippingCost = parsed }
		}
	}

	var totalDiscount float64 = 0; var totalProductCost float64 = 0
	for _, p := range orderRequest.Products {
		op, _ := p["originalPrice"].(float64); fp, _ := p["finalPrice"].(float64); q, _ := p["quantity"].(float64); cost, _ := p["cost"].(float64)
		if op > 0 && q > 0 { totalDiscount += (op - fp) * q }; totalProductCost += (cost * q)
	}
	
	orderID := generateShortID()
	timestamp := time.Now().UTC().Format(time.RFC3339)
	custName, _ := orderRequest.Customer["name"].(string); custPhone, _ := orderRequest.Customer["phone"].(string)
	paymentStatus, _ := orderRequest.Payment["status"].(string)
	paymentInfo, _ := orderRequest.Payment["info"].(string)
	addLocation, _ := orderRequest.Customer["additionalLocation"].(string)
	
	var shipFeeCustomer float64 = 0
	if feeVal, ok := orderRequest.Customer["shippingFee"]; ok {
		switch v := feeVal.(type) {
		case float64: shipFeeCustomer = v
		case string: if parsed, err := strconv.ParseFloat(v, 64); err == nil { shipFeeCustomer = parsed }
		}
	}

	internalShipMethod, _ := orderRequest.Shipping["method"].(string)
	internalShipDetails, _ := orderRequest.Shipping["details"].(string)

	newOrder := Order{ 
		OrderID: orderID, Timestamp: timestamp, User: orderRequest.CurrentUser.UserName, Team: orderRequest.SelectedTeam, 
		Page: orderRequest.Page, CustomerName: custName, CustomerPhone: custPhone, Subtotal: orderRequest.Subtotal, 
		GrandTotal: orderRequest.GrandTotal, ProductsJSON: string(productsJSON), Note: orderRequest.Note, 
		FulfillmentStore: orderRequest.FulfillmentStore, ScheduledTime: orderRequest.ScheduledTime, FulfillmentStatus: "Pending",
		PaymentStatus: paymentStatus, PaymentInfo: paymentInfo, InternalCost: shippingCost, DiscountUSD: totalDiscount,
		TotalProductCost: totalProductCost, Location: strings.Join(locationParts, ", "), AddressDetails: addLocation,
		ShippingFeeCustomer: shipFeeCustomer, InternalShippingMethod: internalShipMethod, InternalShippingDetails: internalShipDetails,
	}

	if err := DB.Create(&newOrder).Error; err != nil { c.Error(err); return }

	eventBytes, _ := json.Marshal(map[string]interface{}{ "type": "new_order", "data": newOrder })
	hub.broadcast <- eventBytes

	orderChannel <- OrderJob{ JobID: fmt.Sprintf("job_%d", time.Now().UnixNano()), OrderID: orderID, UserName: orderRequest.CurrentUser.UserName, OrderData: map[string]interface{}{ "orderId": orderID, "timestamp": timestamp, "totalDiscount": totalDiscount, "totalProductCost": totalProductCost, "fullLocation": strings.Join(locationParts, ", "), "productsJSON": string(productsJSON), "shippingCost": shippingCost, "originalRequest": orderRequest, "scheduledTime": orderRequest.ScheduledTime } }
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

	mappedData := make(map[string]interface{})
	for k, v := range r.NewData { 
		dbCol := mapToDBColumn(k)
		if isValidOrderColumn(dbCol) && v != nil {
			if dbCol == "discount_usd" || dbCol == "grand_total" || dbCol == "subtotal" || dbCol == "shipping_fee_customer" || dbCol == "internal_cost" || dbCol == "delivery_unpaid" || dbCol == "delivery_paid" || dbCol == "total_product_cost" {
				if f, ok := v.(float64); ok { mappedData[dbCol] = f } else if s, ok := v.(string); ok { if fVal, err := strconv.ParseFloat(s, 64); err == nil { mappedData[dbCol] = fVal } }
			} else { mappedData[dbCol] = fmt.Sprintf("%v", v) }
		}
	}
	
	if err := DB.Model(&Order{}).Where("order_id = ?", r.OrderID).Updates(mappedData).Error; err != nil { c.Error(err); return }

	eventBytes, _ := json.Marshal(map[string]interface{}{ "type": "update_order", "orderId": r.OrderID, "newData": r.NewData })
	hub.broadcast <- eventBytes

	go func() {
		req := AppsScriptRequest{ Action: "updateOrderTelegram", Secret: appsScriptSecret, OrderData: map[string]interface{}{ "orderId": r.OrderID, "updatedFields": r.NewData, "team": originalOrder.Team } }
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
					"orderId": r.OrderID, "team": order.Team, "messageId1": order.TelegramMessageID1, "messageId2": order.TelegramMessageID2, "fulfillmentStore": order.FulfillmentStore,
				},
			}) 
		}()
		DB.Delete(&order)
		eventBytes, _ := json.Marshal(map[string]interface{}{ "type": "delete_order", "orderId": r.OrderID })
		hub.broadcast <- eventBytes
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminUpdateSheet(c *gin.Context) {
	var req struct { SheetName string `json:"sheetName"`; PrimaryKey map[string]interface{} `json:"primaryKey"`; NewData map[string]interface{} `json:"newData"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	tableName := getTableName(req.SheetName)
	if tableName == "" { c.Error(fmt.Errorf("unknown sheet")); return }

	pkCol := ""; var pkVal interface{}
	originalPKKey := ""
	for k, v := range req.PrimaryKey { 
		pkCol = mapToDBColumn(k)
		pkVal = v 
		originalPKKey = k
	}
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData { 
		dbCol := mapToDBColumn(k)
		if v == nil { continue }
		mappedData[dbCol] = v 
	}
	
	if err := DB.Table(tableName).Where(pkCol+" = ?", pkVal).Updates(mappedData).Error; err != nil { c.Error(err); return }
	
	eventBytes, _ := json.Marshal(map[string]interface{}{ "type": "update_sheet", "sheetName": req.SheetName, "primaryKey": req.PrimaryKey, "newData": req.NewData })
	hub.broadcast <- eventBytes

	go func() {
		sheetPKKey := originalPKKey
		if req.SheetName == "Roles" && strings.ToLower(originalPKKey) == "id" {
			sheetPKKey = "ID"
		}
		appsReq := AppsScriptRequest{ Action: "updateSheet", Secret: appsScriptSecret, SheetName: req.SheetName, PrimaryKey: map[string]string{sheetPKKey: fmt.Sprintf("%v", pkVal)}, NewData: req.NewData }
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}()
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminAddRow(c *gin.Context) {
	var req struct { SheetName string `json:"sheetName"`; NewData map[string]interface{} `json:"newData"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	
	tableName := getTableName(req.SheetName)
	if tableName != "" {
		mappedData := make(map[string]interface{})
		for k, v := range req.NewData { mappedData[mapToDBColumn(k)] = v }
		DB.Table(tableName).Create(mappedData)
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{ "type": "add_row", "sheetName": req.SheetName, "newData": req.NewData })
	hub.broadcast <- eventBytes

	go func() {
		appsReq := AppsScriptRequest{ Action: "addRow", Secret: appsScriptSecret, SheetName: req.SheetName, NewData: req.NewData }
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}()
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminDeleteRow(c *gin.Context) {
	var req struct { SheetName string `json:"sheetName"`; PrimaryKey map[string]interface{} `json:"primaryKey"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }

	pkCol := ""; var pkVal interface{}
	for k, v := range req.PrimaryKey { pkCol = mapToDBColumn(k); pkVal = v }

	if req.SheetName == "Roles" && strings.EqualFold(fmt.Sprintf("%v", pkVal), "Admin") {
		c.JSON(403, gin.H{"status": "error", "message": "មិនអាចលុបតួនាទី Admin បានទេ"})
		return
	}

	tableName := getTableName(req.SheetName)
	if tableName != "" {
		DB.Table(tableName).Where(pkCol+" = ?", pkVal).Delete(nil)
	}

	strPrimaryKey := make(map[string]string)
	for k, v := range req.PrimaryKey { 
		sheetKey := k
		if req.SheetName == "Roles" && strings.ToLower(k) == "id" {
			sheetKey = "ID"
		}
		strPrimaryKey[sheetKey] = fmt.Sprintf("%v", v) 
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{ "type": "delete_row", "sheetName": req.SheetName, "primaryKey": strPrimaryKey })
	hub.broadcast <- eventBytes

	go func() {
		appsReq := AppsScriptRequest{ Action: "deleteRow", Secret: appsScriptSecret, SheetName: req.SheetName, PrimaryKey: strPrimaryKey }
		jb, _ := json.Marshal(appsReq)
		http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
	}()
	c.JSON(200, gin.H{"status": "success"})
}

func handleGetRevenueSummary(c *gin.Context) { var revs []RevenueEntry; DB.Find(&revs); c.JSON(200, gin.H{"status": "success", "data": revs}) }
func handleUpdateFormulaReport(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }
func handleClearCache(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }
func handleAdminUpdateProductTags(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }

func handleGetTeamSalesRanking(c *gin.Context) {
	var results []struct {
		Team    string  `json:"Team"`
		Revenue float64 `json:"Revenue"`
	}
	
	// Advanced Query: Use the team from orders if available, otherwise fallback to the user's primary team
	// Quoting "user" because it's a reserved word in many databases including PostgreSQL
	// We also use COALESCE to ensure we don't get NULLs in the final result
	query := `
		SELECT 
			LOWER(TRIM(COALESCE(NULLIF(o.team, ''), u.team, 'Unassigned'))) as team_name, 
			SUM(COALESCE(o.grand_total, 0)) as total_revenue
		FROM orders o
		LEFT JOIN users u ON o."user" = u.user_name
		WHERE o.order_id NOT LIKE '%Opening_Balance%' 
		  AND o.order_id NOT LIKE '%Opening Balance%'
		GROUP BY team_name
		HAVING team_name <> 'unassigned' AND team_name <> ''
		ORDER BY total_revenue DESC
		LIMIT 10
	`

	rows, err := DB.Raw(query).Rows()
	if err != nil {
		log.Printf("[ERROR] Team Ranking Query Failed: %v", err)
		c.JSON(500, gin.H{"status": "error", "message": "Query failed"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var teamName string
		var revenue float64
		if err := rows.Scan(&teamName, &revenue); err != nil {
			log.Printf("[ERROR] Team Ranking Scan Failed: %v", err)
			continue
		}
		
		// Capitalize for display (e.g. "team a" -> "Team a", but we'll try to do better)
		displayName := teamName
		if len(displayName) > 0 {
			// Find original case from users table if possible, or just capitalize
			// For simplicity, just uppercase first letter of each word
			words := strings.Fields(displayName)
			for i, w := range words {
				if len(w) > 0 {
					runes := []rune(w)
					runes[0] = unicode.ToUpper(runes[0])
					words[i] = string(runes)
				}
			}
			displayName = strings.Join(words, " ")
		}

		results = append(results, struct {
			Team    string  `json:"Team"`
			Revenue float64 `json:"Revenue"`
		}{
			Team:    displayName,
			Revenue: revenue,
		})
	}

	if results == nil {
		results = []struct {
			Team    string  `json:"Team"`
			Revenue float64 `json:"Revenue"`
		}{}
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": results})
}

func handleGetGlobalShippingCosts(c *gin.Context) {
	var results []struct {
		OrderID      string  `json:"Order ID"`
		Timestamp    string  `json:"Timestamp"`
		Team         string  `json:"Team"`
		InternalCost float64 `json:"Internal Cost"`
		ShippingMethod string `json:"Internal Shipping Method"`
	}
	
	// Select only necessary fields for all orders
	err := DB.Model(&Order{}).
		Select("order_id, timestamp, team, internal_cost, internal_shipping_method").
		Where("order_id NOT LIKE ? AND order_id NOT LIKE ?", "%Opening_Balance%", "%Opening Balance%").
		Order("timestamp DESC").
		Scan(&results).Error

	if err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "success", "data": results})
}

func handleUpdateProfile(c *gin.Context) {
	var req struct { UserName string `json:"userName"`; NewData map[string]interface{} `json:"newData"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData { if k == "Password" { continue }; mappedData[mapToDBColumn(k)] = v }
	if err := DB.Model(&User{}).Where("user_name = ?", req.UserName).Updates(mappedData).Error; err != nil { c.Error(err); return }
	c.JSON(200, gin.H{"status": "success"})
}

func handleChangePassword(c *gin.Context) {
	var req struct { UserName string `json:"userName"`; NewPassword string `json:"newPassword"` }
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	if err := DB.Model(&User{}).Where("user_name = ?", req.UserName).Update("password", req.NewPassword).Error; err != nil { c.Error(err); return }
	c.JSON(200, gin.H{"status": "success"})
}

func uploadToGoogleDriveDirectly(base64Data string, fileName string, mimeType string) (string, string, error) {
	if driveService == nil {
		ctx := context.Background()
		if err := createGoogleAPIClient(ctx); err != nil { return "", "", fmt.Errorf("failed to init drive client: %v", err) }
	}
	if strings.Contains(base64Data, "base64,") { base64Data = strings.Split(base64Data, "base64,")[1] }
	cleanMimeType := strings.Split(mimeType, ";")[0]
	decodedBytes, err := parseBase64(base64Data)
	if err != nil { return "", "", fmt.Errorf("failed to decode base64: %v", err) }

	f := &drive.File{ Name: fileName, MimeType: cleanMimeType }
    if envFolderID := os.Getenv("UPLOAD_FOLDER_ID"); envFolderID != "" { f.Parents = []string{envFolderID} } else if uploadFolderID != "" { f.Parents = []string{uploadFolderID} }

	file, err := driveService.Files.Create(f).Media(bytes.NewReader(decodedBytes)).Do()
	if err != nil { return "", "", fmt.Errorf("drive api error: %v", err) }
	driveService.Permissions.Create(file.Id, &drive.Permission{ Type: "anyone", Role: "reader" }).Do()
	return fmt.Sprintf("https://drive.google.com/uc?id=%s", file.Id), file.Id, nil
}

func handleServeTempImage(c *gin.Context) {
	id := c.Param("id")
	var temp TempImage
	if err := DB.Where("id = ?", id).First(&temp).Error; err != nil { c.JSON(404, gin.H{"error": "រកមិនឃើញរូបភាព ឬផុតកំណត់"}); return }
	decodedBytes, _ := parseBase64(temp.ImageData)
	c.Data(200, temp.MimeType, decodedBytes)
}

func handleImageUploadProxy(c *gin.Context) {
	var req AppsScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil { c.Error(err); return }
	if req.FileData == "" { c.Error(fmt.Errorf("មិនមានទិន្នន័យឯកសារ")); return }

	tempID := generateShortID() + generateShortID()
	// Store in DB for 15 minutes to give UI instant feedback
	DB.Create(&TempImage{ ID: tempID, MimeType: req.MimeType, ImageData: req.FileData, ExpiresAt: time.Now().Add(15 * time.Minute) })

	protocol := "http"; if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" { protocol = "https" }
	tempUrl := fmt.Sprintf("%s://%s/api/images/temp/%s", protocol, c.Request.Host, tempID)

	c.JSON(200, gin.H{ 
		"status": "success", 
		"message": "Processing upload...", 
		"tempUrl": tempUrl,
		"url": tempUrl, // Fallback for components expecting 'url'
	})

	// Perform actual upload to Google Drive in background
	go func(r AppsScriptRequest, tid string) {
		driveURL, _, err := uploadToGoogleDriveDirectly(r.FileData, r.FileName, r.MimeType)
		if err != nil {
			log.Printf("❌ Background upload error: %v", err)
			return
		}

		// 1. If it's for an Order
		if r.OrderID != "" && r.TargetColumn != "" {
			dbCol := mapToDBColumn(r.TargetColumn)
			if isValidOrderColumn(dbCol) {
				DB.Model(&Order{}).Where("order_id = ?", r.OrderID).UpdateColumn(dbCol, driveURL)

				// Broadcast update to all clients
				event, _ := json.Marshal(map[string]interface{}{ 
					"type": "update_order", 
					"orderId": r.OrderID, 
					"newData": map[string]interface{}{ r.TargetColumn: driveURL },
				})
				hub.broadcast <- event

				// Sync to Telegram/Sheets
				syncReq := AppsScriptRequest{ 
					Action: "updateOrderTelegram", 
					Secret: appsScriptSecret, 
					OrderData: map[string]interface{}{ 
						"orderId": r.OrderID, 
						"updatedFields": map[string]interface{}{ r.TargetColumn: driveURL },
					},
				}
				jb, _ := json.Marshal(syncReq); http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jb))
			}
		}

		// 2. If it's for a Profile (linked by userName)
		if r.UserName != "" {
			DB.Model(&User{}).Where("user_name = ?", r.UserName).Update("profile_picture_url", driveURL)

			// Notify this specific user via WS that their profile pic is permanent now
			notify, _ := json.Marshal(map[string]interface{}{
				"type": "profile_image_ready",
				"userName": r.UserName,
				"url": driveURL,
			})
			hub.broadcast <- notify
		}

		// Cleanup temp image from DB after successful permanent storage
		DB.Where("id = ?", tid).Delete(&TempImage{})
		log.Printf("✅ Background upload complete: %s", driveURL)
	}(req, tempID)
}
func handleGetChatMessages(c *gin.Context) {
	limitParam := c.Query("limit")
	receiverParam := c.Query("receiver") 
	currentUser, _ := c.Get("userName")  
	var messages []ChatMessage
	query := DB.Order("timestamp desc")
	if receiverParam != "" { query = query.Where("(user_name = ? AND receiver = ?) OR (user_name = ? AND receiver = ?)", currentUser, receiverParam, receiverParam, currentUser) } else { query = query.Where("receiver = ?", "") }
	limit, _ := strconv.Atoi(limitParam); if limit <= 0 { limit = 100 }; query.Limit(limit).Find(&messages)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 { messages[i], messages[j] = messages[j], messages[i] }
	c.JSON(200, gin.H{"status": "success", "data": messages})
}

func handleSendChatMessage(c *gin.Context) {
	var msg ChatMessage
	if err := c.ShouldBindJSON(&msg); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "Invalid format"})
		return
	}
	if sender, exists := c.Get("userName"); exists {
		msg.UserName = sender.(string)
	}
	msg.Timestamp = time.Now().Format(time.RFC3339)

	msgType := strings.ToLower(msg.MessageType)
	
	// Data to be uploaded (Base64)
	var base64Data string
	if msgType == "audio" && msg.AudioData != "" {
		base64Data = msg.AudioData
	} else if msgType == "image" {
		base64Data = msg.Content
	}

	// Optimistic handling for Media (Audio/Image)
	if (msgType == "audio" || msgType == "image") && msg.FileID == "" && len(base64Data) > 100 {
		// 1. Extract Base64 and MimeType
		mimeType := "application/octet-stream"
		if strings.Contains(base64Data, "data:") && strings.Contains(base64Data, ";base64,") {
			parts := strings.Split(base64Data, ";base64,")
			mimeType = parts[0]
			base64Data = parts[1]
		}

		// 2. Create Temp Record for instant playback/viewing
		tempID := "chat_temp_" + generateShortID() + generateShortID()
		DB.Create(&TempImage{
			ID:        tempID,
			MimeType:  mimeType,
			ImageData: base64Data,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		})

		// 3. Generate instant proxy URL
		protocol := "http"
		if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
			protocol = "https"
		}
		tempUrl := fmt.Sprintf("%s://%s/api/images/temp/%s", protocol, c.Request.Host, tempID)
		
		// Preserve original content (duration for audio) but use tempUrl for broadcast
		originalContent := msg.Content
		msg.Content = tempUrl
		
		// 4. Save to DB and broadcast immediately
		DB.Create(&msg)
		msgBytes, _ := json.Marshal(map[string]interface{}{"type": "new_message", "data": msg})
		hub.broadcast <- msgBytes
		
		c.JSON(200, gin.H{"status": "success", "data": msg})

		// 5. Upload to Google Drive in background
		go func(m ChatMessage, b64 string, mt string, tid string, oldContent string) {
			driveURL, fileId, err := uploadToGoogleDriveDirectly(b64, "chat_file", mt)
			if err == nil {
				// Final content logic
				finalContent := oldContent
				if strings.ToLower(m.MessageType) == "image" {
					finalContent = driveURL // Images use Drive URL as content
				}

				// Update to permanent storage
				DB.Model(&ChatMessage{}).Where("id = ?", m.ID).Updates(map[string]interface{}{
					"file_id": fileId,
					"content": finalContent,
				})
				
				// Notify all clients that upload is complete
				updateMsg, _ := json.Marshal(map[string]interface{}{
					"type":       "upload_complete",
					"message_id": m.ID,
					"file_id":    fileId,
					"url":        driveURL,
					"receiver":   m.Receiver,
				})
				hub.broadcast <- updateMsg
				log.Printf("📢 Broadcasted upload_complete for Message ID: %d", m.ID)
				
				// Cleanup temp local record
				DB.Where("id = ?", tid).Delete(&TempImage{})
			} else {
				log.Printf("❌ Chat media upload failed: %v", err)
			}
		}(msg, base64Data, mimeType, tempID, originalContent)
		
		return
	}

	// Standard text message
	DB.Create(&msg)
	msgBytes, _ := json.Marshal(map[string]interface{}{"type": "new_message", "data": msg})
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
	jwtSecretEnv := os.Getenv("JWT_SECRET"); if jwtSecretEnv == "" { jwtSecretEnv = "change-me-in-production" }; jwtSecret = []byte(jwtSecretEnv)

	initDB(); hub = NewHub(); go hub.run(); go startOrderWorker(); startScheduler()
	
	r := gin.Default()
	r.Use(ErrorHandlingMiddleware())
	r.Use(cors.New(cors.Config{ AllowOrigins: []string{"*"}, AllowMethods: []string{"GET", "POST", "OPTIONS"}, AllowHeaders: []string{"Origin", "Content-Type", "Authorization"}, MaxAge: 12 * time.Hour }))

	r.GET("/", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.GET("/healthz", func(c *gin.Context) { c.String(200, "OK") })
	
	api := r.Group("/api")
	api.POST("/login", handleLogin)
    api.GET("/images/temp/:id", handleServeTempImage)

	protected := api.Group("/")
	protected.Use(AuthMiddleware()) 
	{
		protected.GET("/users", handleGetUsers)
		protected.GET("/static-data", handleGetStaticData)
		protected.POST("/submit-order", handleSubmitOrder)
		protected.POST("/upload-image", handleImageUploadProxy)
		protected.GET("/permissions", handleGetUserPermissions)
		protected.GET("/roles", handleGetRoles)
		protected.GET("/orders", RequirePermission("view_order_list"), handleGetAllOrders)
		protected.GET("/teams/ranking", handleGetTeamSalesRanking)
		protected.GET("/teams/shipping-costs", handleGetGlobalShippingCosts)
		
		chat := protected.Group("/chat")
		chat.GET("/messages", handleGetChatMessages); chat.POST("/send", handleSendChatMessage); chat.POST("/delete", handleDeleteChatMessage)
		
		admin := protected.Group("/admin")
		admin.Use(AdminOnlyMiddleware())
		{
			admin.GET("/orders", RequirePermission("view_order_list"), handleGetAllOrders)
			admin.POST("/update-order", RequirePermission("edit_order"), handleAdminUpdateOrder)
			admin.POST("/migrate-data", handleMigrateData)
			admin.GET("/revenue-summary", handleGetRevenueSummary)
			admin.POST("/update-sheet", handleAdminUpdateSheet)
			admin.POST("/add-row", handleAdminAddRow)
			admin.POST("/delete-row", handleAdminDeleteRow)
			admin.POST("/delete-order", RequirePermission("delete_order"), handleAdminDeleteOrder)
			admin.GET("/permissions", handleGetAllPermissions)
			admin.POST("/permissions", handleUpdatePermission)
			admin.POST("/roles", handleCreateRole)
			admin.GET("/incentive/calculators", handleGetIncentiveCalculators)
			admin.POST("/incentive/calculators", handleCreateIncentiveCalculator)
			admin.GET("/incentive/projects", handleGetIncentiveProjects)
			admin.POST("/incentive/projects", handleCreateIncentiveProject)
			admin.GET("/incentive/results", handleGetIncentiveResults)
			admin.POST("/incentive/calculate", handleCalculateIncentive)
		}
		profile := protected.Group("/profile"); profile.POST("/update", handleUpdateProfile); profile.POST("/change-password", handleChangePassword)
	}
	api.GET("/chat/ws", serveWs); api.GET("/chat/audio/:fileID", handleGetAudioProxy)
	go func() { createGoogleAPIClient(context.Background()) }()
	r.Run("0.0.0.0:" + port)
}
