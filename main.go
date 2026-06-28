package main

import (
	"bytes"
	"context"
	crand "crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"io"
	"log"
	"math"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/fogleman/gg"
	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	backend "github.com/samnangh849-source/Oder_Backend/Backend"

	// Import GORM
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GenerateSecureToken creates a cryptographically secure random token
func GenerateSecureToken(length int) string {
	b := make([]byte, length)
	if _, err := io.ReadFull(crand.Reader, b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}

// generateUploadTokenInternal is the shared logic for creating one-time upload tokens
func generateUploadTokenInternal(orderID string) string {
	token := GenerateSecureToken(16)
	uploadToken := backend.UploadToken{
		Token:     token,
		OrderID:   orderID,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}

	if err := backend.DB.Create(&uploadToken).Error; err != nil {
		log.Printf("❌ Failed to create upload token: %v", err)
		return ""
	}
	log.Printf("🔑 [Token Gen] Successfully created token %s for OrderID %s", token, orderID)
	return token
}

func handleGenerateUploadToken(c *gin.Context) {
	orderID := c.Query("orderId")
	if orderID == "" {
		c.JSON(400, gin.H{"status": "error", "message": "Missing orderId"})
		return
	}

	token := generateUploadTokenInternal(orderID)
	if token == "" {
		c.JSON(500, gin.H{"status": "error", "message": "Failed to create token"})
		return
	}

	c.JSON(200, gin.H{"status": "success", "token": token})
}

func handleVerifyUploadToken(c *gin.Context) {
	token := c.Query("token")
	secret := c.GetHeader("X-Internal-Secret")

	// Apps Script must provide the shared secret
	if secret != backend.AppsScriptSecret {
		c.JSON(401, gin.H{"status": "error", "message": "Unauthorized internal call"})
		return
	}

	var uploadToken backend.UploadToken
	if err := backend.DB.Where("token = ? AND expires_at > ?", token, time.Now()).First(&uploadToken).Error; err != nil {
		c.JSON(404, gin.H{"status": "error", "message": "Invalid or expired token"})
		return
	}

	// Token is valid! Now DELETE it so it can't be used again (One-time use)
	backend.DB.Delete(&uploadToken)

	c.JSON(200, gin.H{"status": "success", "orderId": uploadToken.OrderID})
}

// --- Configuration ---
var (
	appsScriptURL    string
	appsScriptSecret string
)

// =========================================================================
// ម៉ូដែលទិន្នន័យ (GORM Models) - Aliased to Backend package
// =========================================================================

type User = backend.User
type Movie = backend.Movie
type Store = backend.Store
type Setting = backend.Setting
type TeamPage = backend.TeamPage
type Product = backend.Product
type Location = backend.Location
type ShippingMethod = backend.ShippingMethod
type DeliveryGroup = backend.DeliveryGroup
type DriverRecommendation = backend.DriverRecommendation
type Color = backend.Color
type Driver = backend.Driver
type BankAccount = backend.BankAccount
type PhoneCarrier = backend.PhoneCarrier
type TelegramTemplate = backend.TelegramTemplate
type Inventory = backend.Inventory
type StockTransfer = backend.StockTransfer
type ReturnItem = backend.ReturnItem
type Order = backend.Order
type RevenueEntry = backend.RevenueEntry
type ChatMessage = backend.ChatMessage
type EditLog = backend.EditLog
type UserActivityLog = backend.UserActivityLog
type Role = backend.Role
type RolePermission = backend.RolePermission
type IncentiveCalculator = backend.IncentiveCalculator
type IncentiveProject = backend.IncentiveProject
type IncentiveResult = backend.IncentiveResult
type IncentiveManualData = backend.IncentiveManualData
type IncentiveCustomPayout = backend.IncentiveCustomPayout
type DeleteOrderRequest = backend.DeleteOrderRequest
type Promotion = backend.Promotion

type IncentiveRules = backend.IncentiveRules
type IncentiveTier = backend.IncentiveTier
type CommissionTier = backend.CommissionTier

var parseManualDataKey = backend.ParseManualDataKey
var normalizeTeamKey = backend.NormalizeTeamKey
var resolveManualTarget = backend.ResolveManualTarget
var calculatePayout = backend.CalculatePayout

// =========================================================================
// INIT DATABASE & GOOGLE SERVICES
// =========================================================================
func initDB() {
	backend.InitDB()
	// Migrate new tables
	backend.DB.AutoMigrate(&backend.UploadToken{})
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

// cambodianCarrier returns the Cambodian carrier name for a given phone number.
// It strips the +855 country code or leading zero before matching the 2-3 digit prefix.
func cambodianCarrier(phone string) string {
	// Normalise: strip spaces/dashes, remove +855 country code
	p := strings.ReplaceAll(phone, " ", "")
	p = strings.ReplaceAll(p, "-", "")
	if strings.HasPrefix(p, "+855") {
		p = "0" + p[4:]
	} else if strings.HasPrefix(p, "855") {
		p = "0" + p[3:]
	}
	if len(p) < 9 {
		return ""
	}
	prefix3 := p[:3] // e.g. "070"
	carrierMap := map[string]string{
		// Smart
		"010": "Smart", "015": "Smart", "016": "Smart",
		"069": "Smart", "070": "Smart", "081": "Smart",
		"086": "Smart", "087": "Smart", "093": "Smart",
		"096": "Smart", "098": "Smart",
		// Cellcard (Mobitel)
		"011": "Cellcard", "012": "Cellcard", "017": "Cellcard",
		"061": "Cellcard", "076": "Cellcard", "077": "Cellcard",
		"078": "Cellcard", "079": "Cellcard", "085": "Cellcard",
		"089": "Cellcard", "092": "Cellcard", "095": "Cellcard",
		"099": "Cellcard",
		// Metfone (Viettel)
		"031": "Metfone", "038": "Metfone", "068": "Metfone",
		"071": "Metfone", "088": "Metfone", "090": "Metfone",
		"097": "Metfone",
		// Seatel / qb
		"013": "Seatel", "018": "Seatel",
	}
	if carrier, ok := carrierMap[prefix3]; ok {
		return carrier
	}
	return ""
}

func broadcastToAll(payload interface{}) {
	backend.SafeBroadcastJSON(payload)
}

func mapToDBColumn(key string, sheetName string) string {
	specialCases := map[string]string{
		"Order ID":                     "order_id",
		"Discount ($)":                 "discount_usd",
		"Total Product Cost ($)":       "total_product_cost",
		"Shipping Fee (Customer)":      "shipping_fee_customer",
		"Products":                     "products_json",
		"Products (JSON)":              "products_json",
		"Telegram Message ID 1":        "telegram_message_id1",
		"Telegram Message ID 2":        "telegram_message_id2",
		"Telegram Message ID 3":        "telegram_message_id3",
		"Customer Name":                "customer_name",
		"Customer Phone":               "customer_phone",
		"Location":                     "location",
		"Address Details":              "address_details",
		"Fulfillment Status":           "fulfillment_status",
		"fulfillmentStatus":            "fulfillment_status",
		"FulfillmentStatus":            "fulfillment_status",
		"Fulfillment Store":            "fulfillment_store",
		"fulfillmentStore":             "fulfillment_store",
		"FulfillmentStore":             "fulfillment_store",
		"Package Photo":                "package_photo_url",
		"packagePhoto":                 "package_photo_url",
		"PackagePhoto":                 "package_photo_url",
		"Delivery Photo URL":           "delivery_photo_url",
		"deliveryPhoto":                "delivery_photo_url",
		"DeliveryPhoto":                "delivery_photo_url",
		"Cancel Reason":                "cancel_reason",
		"Return Reason":                "return_reason",
		"Return Photo":                 "return_photo_url",
		"Return Received By":           "return_received_by",
		"Return Received Time":         "return_received_time",
		"Delivery Photo Sent Count":    "delivery_photo_sent_count",
		"Delivery Telegram Message ID": "delivery_telegram_message_id",
		"Delivery Daily Sequence":      "delivery_daily_sequence",
		"Delivery Telegram Date":       "delivery_telegram_date",
		"Driver Name":                  "driver_name",
		"Tracking Number":              "tracking_number",
		"Dispatched Time":              "dispatched_time",
		"Dispatched By":                "dispatched_by",
		"Delivered Time":               "delivered_time",
		"Packed By":                    "packed_by",
		"Packed Time":                  "packed_time",
		"IsVerified":                   "is_verified",
		"UserName":                     "user_name",
		"FullName":                     "full_name",
		"ProfilePictureURL":            "profile_picture_url",
		"IsSystemAdmin":                "is_system_admin",
		"TelegramUsername":             "telegram_username",
		"ImageURL":                     "image_url",
		"Image URL":                    "image_url",
		"LogosURL":                     "logo_url",
		"Logos URL":                    "logo_url",
		"LogoURL":                      "logo_url",
		"Thumbnail":                    "thumbnail",
		"Thumbnail URL":                "thumbnail",
		"ID":                           "id",
		"id":                           "id",
		"status":                       "status",
		"Status":                       "status",
		"Description":                  "description",
		"TelegramGroupID":              "telegram_group_id",
		"TelegramTopicID":              "telegram_topic_id",
		"CODAlertGroupID":              "cod_alert_group_id",
		// Incentive System Mappings
		"projectId":              "project_id",
		"ProjectID":              "project_id",
		"rulesJson":              "rules_json",
		"RulesJSON":              "rules_json",
		"projectName":            "project_name",
		"ProjectName":            "project_name",
		"calculatorId":           "calculator_id",
		"CalculatorID":           "calculator_id",
		"startDate":              "start_date",
		"StartDate":              "start_date",
		"endDate":                "end_date",
		"EndDate":                "end_date",
		"targetTeam":             "target_team",
		"TargetTeam":             "target_team",
		"colorCode":              "color_code",
		"ColorCode":              "color_code",
		"dataSource":             "data_source",
		"DataSource":             "data_source",
		"requirePeriodSelection": "require_period_selection",
		"totalOrders":            "total_orders",
		"totalRevenue":           "total_revenue",
		"totalProfit":            "total_profit",
		"calculatedValue":        "calculated_value",
		"breakdownJson":          "breakdown_json",
	}

	// Handle Settings table specifics separately
	if sheetName == "Settings" {
		if strings.EqualFold(key, "Key") {
			return "config_key"
		}
		if strings.EqualFold(key, "Value") {
			return "config_value"
		}
	}

	// Standard mapping logic
	for k, v := range specialCases {
		if strings.EqualFold(strings.TrimSpace(k), strings.TrimSpace(key)) {
			return v
		}
	}

	// If it's already snake_case (no spaces and no uppercase), keep as-is (normalized lower).
	// Otherwise continue with generic converter below so CamelCase like "ProductName"
	// becomes "product_name" instead of "productname".
	if !strings.Contains(key, " ") && key == strings.ToLower(key) {
		return key
	}

	var res []rune
	for i, r := range key {
		if i > 0 && (unicode.IsUpper(r) || r == ' ' || r == '(' || r == ')') {
			if len(res) > 0 && res[len(res)-1] != '_' {
				res = append(res, '_')
			}
		}
		if r != ' ' && r != '(' && r != ')' && r != '$' {
			res = append(res, unicode.ToLower(r))
		}
	}

	final := strings.Trim(string(res), "_")
	final = strings.ReplaceAll(final, "__", "_")
	return final
}

func getTableName(sheetName string) string {
	switch sheetName {
	case "Users":
		return "users"
	case "Stores":
		return "stores"
	case "Settings":
		return "settings"
	case "TeamsPages":
		return "team_pages"
	case "Products":
		return "products"
	case "Locations":
		return "locations"
	case "ShippingMethods":
		return "shipping_methods"
	case "DeliveryGroups":
		return "delivery_groups"
	case "Colors":
		return "colors"
	case "Drivers":
		return "drivers"
	case "BankAccounts":
		return "bank_accounts"
	case "PhoneCarriers":
		return "phone_carriers"
	case "Inventory":
		return "inventories"
	case "StockTransfers":
		return "stock_transfers"
	case "Returns":
		return "returns"
	case "AllOrders":
		return "orders"
	case "Roles":
		return "roles"
	case "RolePermissions":
		return "role_permissions"
	case "DriverRecommendations":
		return "driver_recommendations"
	case "IncentiveCalculators":
		return "incentive_calculators"
	case "IncentiveProjects":
		return "incentive_projects"
	case "Movies":
		return "movies"
	case "Promotions":
		return "promotions"
	case "RevenueDashboard":
		return "revenue_entries"
	case "ChatMessages":
		return "chat_messages"
	case "EditLogs":
		return "edit_logs"
	case "UserActivityLogs":
		return "user_activity_logs"
	case "IncentiveResults":
		return "incentive_results"
	case "IncentiveManualData":
		return "incentive_manual_data"
	case "IncentiveCustomPayouts":
		return "incentive_custom_payouts"
	case "TelegramTemplates":
		return "telegram_templates"
	}
	if strings.HasPrefix(sheetName, "Orders_") {
		return "orders"
	}
	return ""
}

// isValidDBIdentifier allows only lowercase letters, digits, and underscores
// to prevent SQL injection via dynamically constructed column/table identifiers.
func isValidDBIdentifier(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_') {
			return false
		}
	}
	return true
}

func isValidOrderColumn(col string) bool {
	validCols := map[string]bool{
		"order_id": true, "timestamp": true, "user": true, "page": true, "telegram_value": true,
		"customer_name": true, "customer_phone": true, "location": true, "address_details": true,
		"note": true, "shipping_fee_customer": true, "subtotal": true, "grand_total": true,
		"products_json": true, "internal_shipping_method": true, "internal_shipping_details": true,
		"internal_cost": true, "payment_status": true, "payment_info": true, "discount_usd": true,
		"delivery_unpaid": true, "delivery_paid": true, "total_product_cost": true,
		"telegram_message_id1": true, "telegram_message_id2": true, "telegram_message_id3": true, "scheduled_time": true,
		"fulfillment_store": true, "team": true, "is_verified": true, "fulfillment_status": true,
		"packed_by": true, "packed_time": true, "package_photo_url": true, "driver_name": true, "tracking_number": true,
		"dispatched_time": true, "dispatched_by": true, "delivered_time": true, "delivery_photo_url": true,
		"cancel_reason": true, "return_reason": true, "return_photo_url": true, "return_received_by": true, "return_received_time": true,
	}
	return validCols[col]
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

func buildCORSConfig() cors.Config {
	allowedOrigins := map[string]bool{
		"https://dominic0607.github.io": true,
		"http://localhost:3000":         true,
		"http://localhost:4173":         true,
		"http://localhost:5173":         true,
		"http://127.0.0.1:3000":         true,
		"http://127.0.0.1:4173":         true,
		"http://127.0.0.1:5173":         true,
	}

	if envOrigins := os.Getenv("CORS_ALLOWED_ORIGINS"); envOrigins != "" {
		allowedOrigins = map[string]bool{}
		for _, origin := range strings.Split(envOrigins, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				allowedOrigins[origin] = true
			}
		}
	}

	return cors.Config{
		AllowOriginFunc: func(origin string) bool {
			if allowedOrigins["*"] {
				return true
			}
			return allowedOrigins[origin]
		},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Authorization",
			"X-Requested-With",
			"Accept",
			"Cache-Control",
			"Pragma",
			"X-API-Key",
			"X-Internal-Secret",
		},
		ExposeHeaders:             []string{"Content-Length"},
		AllowCredentials:          true,
		MaxAge:                    12 * time.Hour,
		OptionsResponseStatusCode: http.StatusNoContent,
	}
}

// =========================================================================
// AUTHENTICATION, JWT & AUTHORIZATION (RBAC) - Aliased to Backend package
// =========================================================================

type Claims = backend.Claims

var generateJWT = backend.GenerateJWT
var handleLogin = backend.HandleLogin

func DBMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if backend.DB == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status":  "error",
				"message": "សេវាកម្មកំពុងចាប់ផ្តើម (Database is initializing...)",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

var AuthMiddleware = backend.AuthMiddleware
var AdminOnlyMiddleware = backend.AdminOnlyMiddleware
var RequirePermission = backend.RequirePermission
var hasPermissionInternal = backend.HasPermissionInternal

// =========================================================================
// API សម្រាប់គ្រប់គ្រងសិទ្ធិ (Role Permissions) - RBAC - Aliased to Backend package
// =========================================================================

var handleGetRoles = backend.HandleGetRoles
var handleCreateRole = backend.HandleCreateRole
var handleGetAllPermissions = backend.HandleGetAllPermissions
var handleGetUserPermissions = backend.HandleGetUserPermissions
var handleUpdatePermission = backend.HandleUpdatePermission
var handleSyncPermissionsToSheet = backend.HandleSyncPermissionsToSheet
var handleResetPermissions = backend.HandleResetPermissions

// =========================================================================

// =========================================================================
// API សម្រាប់ប្រព័ន្ធ INCENTIVE (ប្រាក់លើកទឹកចិត្ត)
// =========================================================================

func handleGetIncentiveCalculators(c *gin.Context) {
	var calcs []IncentiveCalculator
	backend.DB.Find(&calcs)
	c.JSON(200, gin.H{"status": "success", "data": calcs})
}

func handleCreateIncentiveCalculator(c *gin.Context) {
	var req IncentiveCalculator
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": err.Error()})
		return
	}

	// Always let backend.DB generate unique IDs to avoid collisions when duplicating calculators.
	req.ID = 0
	if strings.TrimSpace(req.Status) == "" {
		req.Status = "Active"
	}

	if err := backend.DB.Create(&req).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success", "data": req})
}

func handleGetIncentiveProjects(c *gin.Context) {
	var projects []IncentiveProject
	backend.DB.Preload("Calculators").Find(&projects)
	c.JSON(200, gin.H{"status": "success", "data": projects})
}

func handleCreateIncentiveProject(c *gin.Context) {
	var req IncentiveProject
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": err.Error()})
		return
	}

	if req.ID == 0 {
		var maxID uint
		backend.DB.Model(&IncentiveProject{}).Select("COALESCE(MAX(id), 0)").Row().Scan(&maxID)
		req.ID = maxID + 1
	}
	if strings.TrimSpace(req.Status) == "" {
		req.Status = "Draft"
	}
	if strings.TrimSpace(req.DataSource) == "" {
		req.DataSource = "system"
	}
	if strings.TrimSpace(req.CreatedAt) == "" {
		req.CreatedAt = time.Now().Format("2006-01-02 15:04:05")
	}

	if err := backend.DB.Create(&req).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success", "data": req})
}

func handleGetIncentiveResults(c *gin.Context) {
	projectId := c.Query("projectId")
	var results []IncentiveResult
	query := backend.DB.Model(&IncentiveResult{})
	if projectId != "" {
		query = query.Where("project_id = ?", projectId)
	}
	query.Find(&results)
	c.JSON(200, gin.H{"status": "success", "data": results})
}

func handleGetIncentiveManualData(c *gin.Context) {
	projectId := c.Query("projectId")
	month := c.Query("month")

	if month != "" {
		matched, _ := regexp.MatchString(`^\d{4}-\d{2}$`, month)
		if !matched {
			c.JSON(400, gin.H{"status": "error", "message": "ទម្រង់ខែមិនត្រឹមត្រូវ (ត្រូវប្រើ YYYY-MM)"})
			return
		}
	}

	var data []IncentiveManualData
	query := backend.DB.Model(&IncentiveManualData{})
	if projectId != "" {
		query = query.Where("project_id = ?", projectId)
	}
	if month != "" {
		query = query.Where("month = ?", month)
	}
	query.Find(&data)
	c.JSON(200, gin.H{"status": "success", "data": data})
}

func handleSaveIncentiveManualData(c *gin.Context) {
	var req IncentiveManualData
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	// Validate Month format (YYYY-MM)
	matched, _ := regexp.MatchString(`^\d{4}-\d{2}$`, req.Month)
	if !matched {
		c.JSON(400, gin.H{"status": "error", "message": "ទម្រង់ខែមិនត្រឹមត្រូវ (ត្រូវប្រើ YYYY-MM)"})
		return
	}

	var existing IncentiveManualData
	err := backend.DB.Where("project_id = ? AND month = ? AND metric_type = ? AND data_key = ?", req.ProjectID, req.Month, req.MetricType, req.DataKey).First(&existing).Error
	if err == nil {
		backend.DB.Model(&existing).Update("value", req.Value)
	} else {
		backend.DB.Create(&req)
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleGetIncentiveCustomPayouts(c *gin.Context) {
	projectId := c.Query("projectId")
	month := c.Query("month")

	if month != "" {
		matched, _ := regexp.MatchString(`^\d{4}-\d{2}$`, month)
		if !matched {
			c.JSON(400, gin.H{"status": "error", "message": "ទម្រង់ខែមិនត្រឹមត្រូវ (ត្រូវប្រើ YYYY-MM)"})
			return
		}
	}

	var payouts []IncentiveCustomPayout
	query := backend.DB.Model(&IncentiveCustomPayout{})
	if projectId != "" {
		query = query.Where("project_id = ?", projectId)
	}
	if month != "" {
		query = query.Where("month = ?", month)
	}
	query.Find(&payouts)
	c.JSON(200, gin.H{"status": "success", "data": payouts})
}

func handleSaveIncentiveCustomPayout(c *gin.Context) {
	var req IncentiveCustomPayout
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	// Validate Month format (YYYY-MM)
	matched, _ := regexp.MatchString(`^\d{4}-\d{2}$`, req.Month)
	if !matched {
		c.JSON(400, gin.H{"status": "error", "message": "ទម្រង់ខែមិនត្រឹមត្រូវ (ត្រូវប្រើ YYYY-MM)"})
		return
	}

	var existing IncentiveCustomPayout
	err := backend.DB.Where("project_id = ? AND month = ? AND user_name = ?", req.ProjectID, req.Month, req.UserName).First(&existing).Error
	if err == nil {
		backend.DB.Model(&existing).Update("value", req.Value)
	} else {
		backend.DB.Create(&req)
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleLockIncentivePayout(c *gin.Context) {
	var req struct {
		ProjectID uint              `json:"projectId"`
		Month     string            `json:"month"`
		Results   []IncentiveResult `json:"results"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	// Validate Month format (YYYY-MM)
	matched, _ := regexp.MatchString(`^\d{4}-\d{2}$`, req.Month)
	if !matched {
		c.JSON(400, gin.H{"status": "error", "message": "ទម្រង់ខែមិនត្រឹមត្រូវ (ត្រូវប្រើ YYYY-MM)"})
		return
	}

	// 1. Delete existing results for this project/month
	backend.DB.Where("project_id = ? AND (timestamp = ? OR timestamp = '')", req.ProjectID, req.Month).Delete(&IncentiveResult{})

	// 2. Save new results
	if len(req.Results) > 0 {
		var maxID uint
		backend.DB.Model(&IncentiveResult{}).Select("COALESCE(MAX(id), 0)").Row().Scan(&maxID)

		for i := range req.Results {
			maxID++
			req.Results[i].ID = maxID
			req.Results[i].Timestamp = req.Month
		}
		backend.DB.Create(&req.Results)

		// 3. Send to Google Sheet
		go func() {
			timestamp := time.Now().Format("2006-01-02 15:04:05")
			for _, res := range req.Results {
				sheetData := map[string]interface{}{
					"Timestamp":       timestamp,
					"ProjectID":       req.ProjectID,
					"UserName":        res.UserName,
					"TotalOrders":     res.TotalOrders,
					"TotalRevenue":    res.TotalRevenue,
					"TotalProfit":     res.TotalProfit,
					"CalculatedValue": res.CalculatedValue,
					"IsCustom":        res.IsCustom,
				}
				// Sync with Google Sheets via managed queue
				enqueueSync("addRow", sheetData, "IncentiveResults", nil)
			}
		}()
	}

	c.JSON(200, gin.H{"status": "success", "message": "បានរក្សាទុករបាយការណ៍ជោគជ័យ!"})
}

func handleCalculateIncentive(c *gin.Context) {
	var req struct {
		ProjectID uint   `json:"projectId"`
		Month     string `json:"month"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	// Validate Month format (YYYY-MM)
	matched, _ := regexp.MatchString(`^\d{4}-\d{2}$`, req.Month)
	if !matched {
		c.JSON(400, gin.H{"status": "error", "message": "ទម្រង់ខែមិនត្រឹមត្រូវ (ត្រូវប្រើ YYYY-MM)"})
		return
	}

	results, err := backend.ProcessIncentiveCalculation(backend.DB, req.ProjectID, req.Month)
	if err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": "success", "data": results})
}

// =========================================================================
// ប្រព័ន្ធ BACKGROUND QUEUE & SCHEDULER - Aliased to Backend package
// =========================================================================

type AppsScriptRequest = backend.AppsScriptRequest
type AppsScriptResponse = backend.AppsScriptResponse
type SyncTask = backend.SyncTask

var callAppsScriptPOST = backend.CallAppsScriptPOST
var enqueueSync = backend.EnqueueSync
var startSyncManager = backend.StartSyncManager

type OrderJob struct {
	JobID     string
	OrderID   string
	UserName  string
	OrderData map[string]interface{}
}

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
			reqBody := AppsScriptRequest{Action: "submitOrder", Secret: backend.AppsScriptSecret, OrderData: job.OrderData}
			jsonData, _ := json.Marshal(reqBody)

			client := &http.Client{Timeout: 45 * time.Second}
			resp, err := client.Post(backend.AppsScriptURL, "application/json", bytes.NewBuffer(jsonData))

			if err != nil {
				log.Printf("❌ Worker error for %s: %v", job.OrderID, err)
				broadcastToAll(map[string]interface{}{"type": "system_notification", "status": "error", "targetUser": job.UserName, "message": "បញ្ជូនទៅ Telegram បរាជ័យ: " + err.Error(), "jobId": job.JobID})
			} else {
				defer resp.Body.Close()
				var scriptResp AppsScriptResponse
				telegramSent := false
				if err := json.NewDecoder(resp.Body).Decode(&scriptResp); err == nil {
					if (scriptResp.MessageIds.ID1 != "" || scriptResp.MessageIds.ID2 != "" || scriptResp.MessageIds.ID3 != "") && backend.DB != nil {
						backend.DB.Model(&Order{}).Where("order_id = ?", job.OrderID).Updates(map[string]interface{}{
							"telegram_message_id1": scriptResp.MessageIds.ID1,
							"telegram_message_id2": scriptResp.MessageIds.ID2,
							"telegram_message_id3": scriptResp.MessageIds.ID3,
						})
						telegramSent = true
					}
				}
				notifStatus := "success"
				notifMsg := "បាញ់ទៅ Telegram ជោគជ័យ!"
				if !telegramSent {
					notifStatus = "warning"
					notifMsg = "កម្មង់បានរក្សាទុក ប៉ុន្តែ Telegram មិនបានផ្ញើ (ពិនិត្យ Stores sheet)"
					log.Printf("⚠️ Worker: Order %s saved but Telegram message was not sent (messageIds empty)", job.OrderID)
				}
				broadcastToAll(map[string]interface{}{"type": "system_notification", "status": notifStatus, "targetUser": job.UserName, "message": notifMsg, "jobId": job.JobID})
			}
		}()
	}
}

func startScheduler() {
	ticker := time.NewTicker(2 * time.Minute)
	reconcileTicker := time.NewTicker(15 * time.Minute)

	go func() {
		for {
			select {
			case <-ticker.C:
				// Sync with Google Sheets via managed queue
				enqueueSync("checkScheduledOrders", nil, "", nil)
			case <-reconcileTicker.C:
				// 🛡️ Self-Healing: Check for missing photo links in Sheets
				backend.ReconcileMissingPhotoLinks(backend.DB)
			}
		}
	}()
}

// =========================================================================
// WEB SOCKET - Aliased to Backend package
// =========================================================================

type Client = backend.Client
type Hub = backend.Hub

var NewHub = backend.NewHub
var serveWs = backend.ServeWs
var upgrader = backend.Upgrader
var hub *Hub

// =========================================================================

// =========================================================================
// MIGRATION SCRIPT
// =========================================================================

func handleGetStaticData(c *gin.Context) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	result := make(map[string]interface{})

	queries := []func(){
		func() { var d []Product; backend.DB.Find(&d); mu.Lock(); result["products"] = d; mu.Unlock() },
		func() { var d []Store; backend.DB.Find(&d); mu.Lock(); result["stores"] = d; mu.Unlock() },
		func() { var d []TeamPage; backend.DB.Find(&d); mu.Lock(); result["pages"] = d; mu.Unlock() },
		func() { var d []Location; backend.DB.Find(&d); mu.Lock(); result["locations"] = d; mu.Unlock() },
		func() {
			var d []ShippingMethod
			backend.DB.Find(&d)
			mu.Lock()
			result["shippingMethods"] = d
			mu.Unlock()
		},
		func() { var d []Color; backend.DB.Find(&d); mu.Lock(); result["colors"] = d; mu.Unlock() },
		func() { var d []Driver; backend.DB.Find(&d); mu.Lock(); result["drivers"] = d; mu.Unlock() },
		func() { var d []BankAccount; backend.DB.Find(&d); mu.Lock(); result["bankAccounts"] = d; mu.Unlock() },
		func() { var d []PhoneCarrier; backend.DB.Find(&d); mu.Lock(); result["phoneCarriers"] = d; mu.Unlock() },
		func() {
			var d []DeliveryGroup
			backend.DB.Find(&d)
			mu.Lock()
			result["deliveryGroups"] = d
			mu.Unlock()
		},
		func() { var d []Inventory; backend.DB.Find(&d); mu.Lock(); result["inventory"] = d; mu.Unlock() },
		func() {
			var d []StockTransfer
			backend.DB.Find(&d)
			mu.Lock()
			result["stockTransfers"] = d
			mu.Unlock()
		},
		func() { var d []ReturnItem; backend.DB.Find(&d); mu.Lock(); result["returns"] = d; mu.Unlock() },
		func() { var d []Role; backend.DB.Find(&d); mu.Lock(); result["roles"] = d; mu.Unlock() },
		func() {
			var d []RolePermission
			backend.DB.Find(&d)
			mu.Lock()
			result["rolePermissions"] = d
			mu.Unlock()
		},
		func() {
			var d []User
			// Use backend.DB directly and explicit table name to avoid cross-package naming issues
			if err := backend.DB.Table("users").Find(&d).Error; err != nil {
				log.Printf("⚠️ Failed to fetch users in StaticData: %v", err)
				d = []User{}
			}
			log.Printf("📊 StaticData: Fetched %d users from backend.DB", len(d))
			for i := range d {
				d[i].Password = ""
			}
			mu.Lock()
			result["users"] = d
			mu.Unlock()
		},
		func() {
			var d []DriverRecommendation
			backend.DB.Find(&d)
			mu.Lock()
			result["driverRecommendations"] = d
			mu.Unlock()
		},
		func() { var d []Movie; backend.DB.Find(&d); mu.Lock(); result["movies"] = d; mu.Unlock() },
		func() {
			var d []TelegramTemplate
			backend.DB.Find(&d)
			mu.Lock()
			result["telegramTemplates"] = d
			mu.Unlock()
		},
		func() {
			var d []RevenueEntry
			backend.DB.Find(&d)
			mu.Lock()
			result["revenueEntries"] = d
			mu.Unlock()
		},
		func() {
			var d []EditLog
			backend.DB.Limit(500).Order("timestamp desc").Find(&d)
			mu.Lock()
			result["editLogs"] = d
			mu.Unlock()
		},
		func() {
			var d []UserActivityLog
			backend.DB.Limit(500).Order("timestamp desc").Find(&d)
			mu.Lock()
			result["actLogs"] = d
			mu.Unlock()
		},
		func() {
			var settings []Setting
			backend.DB.Find(&settings)
			settingsObj := make(map[string]interface{})
			for _, s := range settings {
				settingsObj[s.ConfigKey] = s.ConfigValue
				if s.ConfigKey == "UploadFolderID" {
					envVal := os.Getenv("UPLOAD_FOLDER_ID")
					if envVal != "" {
						backend.UploadFolderID = envVal
					} else {
						backend.UploadFolderID = s.ConfigValue
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

	c.Header("Cache-Control", "public, max-age=60")
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": result})
}

func handleGetSettings(c *gin.Context) {
	var settings []Setting
	if err := backend.DB.Find(&settings).Error; err != nil {
		c.Error(err)
		return
	}
	c.Header("Cache-Control", "public, max-age=300")
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": settings})
}

// ── Promotion Handlers ──────────────────────────────────────────────────────

func handleGetPromotions(c *gin.Context) {
	var promotions []backend.Promotion
	if err := backend.DB.Order("updated_at DESC").Find(&promotions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.Header("Cache-Control", "public, max-age=120")
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": promotions})
}

func handleCreatePromotion(c *gin.Context) {
	var p backend.Promotion
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	p.UpdatedAt = time.Now().Format("2006-01-02 15:04:05")
	if u, exists := c.Get("userName"); exists {
		p.UpdatedBy = u.(string)
	}

	if err := backend.DB.Create(&p).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	// Sync with Google Sheets
	sheetData := map[string]interface{}{
		"ID":          p.ID,
		"Barcode":     p.Barcode,
		"Title":       p.Title,
		"ImageURL":    p.ImageURL,
		"Category":    p.Category,
		"Description": p.Description,
		"UpdatedAt":   p.UpdatedAt,
		"UpdatedBy":   p.UpdatedBy,
	}
	enqueueSync("addRow", sheetData, "Promotions", nil)

	// Notify via WebSocket
	broadcastToAll(gin.H{"type": "promotion_updated", "action": "create", "data": p})

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "បង្កើតប្រូម៉ូសិនជោគជ័យ", "data": p})
}

func handleUpdatePromotion(c *gin.Context) {
	id := c.Param("id")
	var p backend.Promotion
	if err := backend.DB.First(&p, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "រកមិនឃើញប្រូម៉ូសិន"})
		return
	}

	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	p.UpdatedAt = time.Now().Format("2006-01-02 15:04:05")
	if u, exists := c.Get("userName"); exists {
		p.UpdatedBy = u.(string)
	}

	if err := backend.DB.Save(&p).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	// Sync with Google Sheets
	sheetData := map[string]interface{}{
		"ID":          p.ID,
		"Barcode":     p.Barcode,
		"Title":       p.Title,
		"ImageURL":    p.ImageURL,
		"Category":    p.Category,
		"Description": p.Description,
		"UpdatedAt":   p.UpdatedAt,
		"UpdatedBy":   p.UpdatedBy,
	}
	enqueueSync("updateSheet", sheetData, "Promotions", map[string]interface{}{"ID": p.ID})

	// Notify via WebSocket
	broadcastToAll(gin.H{"type": "promotion_updated", "action": "update", "data": p})

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "កែប្រែប្រូម៉ូសិនជោគជ័យ", "data": p})
}

func handleDeletePromotion(c *gin.Context) {
	id := c.Param("id")
	if err := backend.DB.Delete(&backend.Promotion{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}

	// Sync with Google Sheets
	enqueueSync("deleteRow", nil, "Promotions", map[string]interface{}{"ID": id})

	// Notify via WebSocket
	broadcastToAll(gin.H{"type": "promotion_updated", "action": "delete", "id": id})

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "លុបប្រូម៉ូសិនជោគជ័យ"})
}

// =========================================================================
// HANDLERS
// =========================================================================

func handleGetUsers(c *gin.Context) {
	var users []User
	// Use backend.DB directly and explicit table name to avoid cross-package naming issues
	if err := backend.DB.Table("users").Find(&users).Error; err != nil {
		log.Printf("⚠️ Failed to fetch users: %v", err)
		users = []User{} // Ensure non-nil slice so JSON returns [] not null
	}
	for i := range users {
		users[i].Password = ""
	}
	c.JSON(200, gin.H{"status": "success", "data": users})
}

func handleGetAllOrders(c *gin.Context) {
	var orders []Order

	// 1. Pagination Params
	limitStr := c.DefaultQuery("limit", "100")
	offsetStr := c.DefaultQuery("offset", "0")
	limit, _ := strconv.Atoi(limitStr)
	offset, _ := strconv.Atoi(offsetStr)
	if limit < 0 {
		limit = 0
	}
	if limit > 10000 {
		limit = 10000
	}
	if offset < 0 {
		offset = 0
	}

	// 2. Filter Params
	startDate := c.Query("startDate")
	endDate := c.Query("endDate")
	datePreset := c.Query("datePreset")
	view := c.Query("view")
	teamQuery := c.Query("team")
	userQuery := c.Query("user")
	storeQuery := c.Query("fulfillmentStore")
	statusQuery := c.Query("fulfillmentStatus")
	packagingTabQuery := c.Query("packagingTab")
	searchQuery := c.Query("search")

	query := backend.DB.Order("timestamp desc")
	countQuery := backend.DB.Model(&Order{})

	// Handle search across multiple fields
	if searchQuery != "" {
		s := "%" + strings.ToLower(searchQuery) + "%"
		searchCondition := "(LOWER(order_id) LIKE ? OR LOWER(customer_name) LIKE ? OR customer_phone LIKE ?)"
		query = query.Where(searchCondition, s, s, s)
		countQuery = countQuery.Where(searchCondition, s, s, s)
	}

	// Handle Date Presets if startDate/endDate are not provided
	if startDate == "" && endDate == "" {
		now := time.Now()
		// Default to 'this_month' if no preset or custom range is provided
		if datePreset == "" {
			datePreset = "this_month"
		}

		switch datePreset {
		case "today":
			startDate = now.Format("2006-01-02")
		case "yesterday":
			startDate = now.AddDate(0, 0, -1).Format("2006-01-02")
			endDate = startDate
		case "this_week":
			weekday := int(now.Weekday())
			if weekday == 0 {
				weekday = 7
			}
			startDate = now.AddDate(0, 0, -weekday+1).Format("2006-01-02")
		case "last_week":
			weekday := int(now.Weekday())
			if weekday == 0 {
				weekday = 7
			}
			mondayThisWeek := now.AddDate(0, 0, -weekday+1)
			startDate = mondayThisWeek.AddDate(0, 0, -7).Format("2006-01-02")
			endDate = mondayThisWeek.AddDate(0, 0, -1).Format("2006-01-02")
		case "this_month":
			startDate = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
		case "last_month":
			firstOfThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
			lastMonth := firstOfThisMonth.AddDate(0, -1, 0)
			startDate = lastMonth.Format("2006-01-02")
			endDate = firstOfThisMonth.AddDate(0, 0, -1).Format("2006-01-02")
		case "this_year":
			startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
		case "last_year":
			startDate = time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
			endDate = time.Date(now.Year()-1, 12, 31, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
		case "all":
			// No date filter
		}
	}

	if startDate != "" {
		// Use T00:00:00 to be safe with string comparisons against ISO timestamps
		query = query.Where("timestamp >= ?", startDate)
		countQuery = countQuery.Where("timestamp >= ?", startDate)
	}
	if endDate != "" {
		// Use 23:59:59 to include full day. Use both space and T variants to be safe.
		query = query.Where("timestamp <= ? OR timestamp <= ?", endDate+" 23:59:59", endDate+"T23:59:59")
		countQuery = countQuery.Where("timestamp <= ? OR timestamp <= ?", endDate+" 23:59:59", endDate+"T23:59:59")
	}

	// 3. User Identity & RBAC
	role, _ := c.Get("role")
	userTeam, _ := c.Get("team")
	isSystemAdmin, _ := c.Get("isSystemAdmin")

	roleString := fmt.Sprintf("%v", role)
	isAdmin := (isSystemAdmin != nil && isSystemAdmin.(bool))
	if !isAdmin && roleString != "" {
		for _, r := range strings.Split(roleString, ",") {
			if strings.EqualFold(strings.TrimSpace(r), "Admin") {
				isAdmin = true
				break
			}
		}
	}

	hasGlobalView := isAdmin || hasPermissionInternal(roleString, (isSystemAdmin != nil && isSystemAdmin.(bool)), "view_global_orders")

	// Apply Team Filter
	finalTeamFilter := teamQuery
	if !hasGlobalView {
		// Non-admins are locked to their own team(s)
		finalTeamFilter = fmt.Sprintf("%v", userTeam)
	}

	if finalTeamFilter != "" {
		teams := strings.Split(finalTeamFilter, ",")
		var conditions []string
		var args []interface{}
		for _, t := range teams {
			t = strings.TrimSpace(t)
			if t != "" {
				conditions = append(conditions, "team = ?")
				args = append(args, t)
			}
		}
		if len(conditions) > 0 {
			condition := "(" + strings.Join(conditions, " OR ") + ")"
			query = query.Where(condition, args...)
			countQuery = countQuery.Where(condition, args...)
		}
	}

	// Other Filters from Query
	if userQuery != "" {
		users := strings.Split(userQuery, ",")
		var conditions []string
		var args []interface{}
		for _, u := range users {
			u = strings.TrimSpace(u)
			if u != "" {
				conditions = append(conditions, "user = ?")
				args = append(args, u)
			}
		}
		if len(conditions) > 0 {
			condition := "(" + strings.Join(conditions, " OR ") + ")"
			query = query.Where(condition, args...)
			countQuery = countQuery.Where(condition, args...)
		}
	}
	if storeQuery != "" {
		stores := strings.Split(storeQuery, ",")
		var conditions []string
		var args []interface{}
		for _, s := range stores {
			s = strings.TrimSpace(s)
			if s != "" {
				conditions = append(conditions, "fulfillment_store = ?")
				args = append(args, s)
			}
		}
		if len(conditions) > 0 {
			condition := "(" + strings.Join(conditions, " OR ") + ")"
			query = query.Where(condition, args...)
			countQuery = countQuery.Where(condition, args...)
		}
	}
	applyPackagingTabFilter := func(db *gorm.DB, tab string) *gorm.DB {
		switch strings.ToLower(strings.TrimSpace(tab)) {
		case "pending":
			return db.Where("(fulfillment_status IN ? OR (fulfillment_status = ? AND (return_received_by IS NULL OR return_received_by = '') AND (packed_by IS NULL OR packed_by = '') AND (packed_time IS NULL OR packed_time = '')))", []string{"Pending", "Scheduled"}, "Cancelled")
		case "ready", "ready to ship":
			return db.Where("(fulfillment_status = ? OR (fulfillment_status = ? AND (return_received_by IS NULL OR return_received_by = '') AND ((packed_by IS NOT NULL AND packed_by != '') OR (packed_time IS NOT NULL AND packed_time != ''))))", "Ready to Ship", "Cancelled")
		case "shipped":
			return db.Where("fulfillment_status = ?", "Shipped")
		case "returned":
			return db.Where("fulfillment_status = ?", "Returned")
		case "cancelled", "canceled":
			return db.Where("fulfillment_status = ? AND return_received_by IS NOT NULL AND return_received_by != ''", "Cancelled")
		default:
			return db
		}
	}

	if packagingTabQuery != "" {
		query = applyPackagingTabFilter(query, packagingTabQuery)
		countQuery = applyPackagingTabFilter(countQuery, packagingTabQuery)
	} else if statusQuery != "" {
		statuses := strings.Split(statusQuery, ",")
		var conditions []string
		var args []interface{}
		for _, s := range statuses {
			s = strings.TrimSpace(s)
			if s != "" {
				conditions = append(conditions, "fulfillment_status = ?")
				args = append(args, s)
			}
		}
		if len(conditions) > 0 {
			condition := "(" + strings.Join(conditions, " OR ") + ")"
			query = query.Where(condition, args...)
			countQuery = countQuery.Where(condition, args...)
		}
	}

	// 4. Calculate Shipping Counts (before applying the internalShippingMethod filter)
	shippingCounts := make(map[string]int64)
	if storeQuery != "" {
		type ShippingCount struct {
			Method string `gorm:"column:internal_shipping_method"`
			Count  int64  `gorm:"column:count"`
		}
		var sCounts []ShippingCount
		// Use a session clone to avoid mutating countQuery
		countQuery.Session(&gorm.Session{}).
			Select("internal_shipping_method, count(*) as count").
			Group("internal_shipping_method").
			Scan(&sCounts)

		var totalCount int64 = 0
		for _, sc := range sCounts {
			method := sc.Method
			if method == "" {
				method = "Unassigned"
			}
			shippingCounts[method] = sc.Count
			totalCount += sc.Count
		}
		shippingCounts["all"] = totalCount
	}

	// 5. Calculate Packaging Progress Stats & Tab Counts (if storeQuery is specified)
	var packedByUserToday int64 = 0
	var storeTotalToday int64 = 0
	tabCounts := map[string]int64{
		"pending":   0,
		"ready":     0,
		"shipped":   0,
		"returned":  0,
		"cancelled": 0,
	}
	if storeQuery != "" {
		userName, _ := c.Get("userName")
		var user User
		fullName := ""
		if err := backend.DB.Where("user_name = ?", userName).First(&user).Error; err == nil {
			fullName = user.FullName
		}

		// Format today's date in Cambodia timezone (ICT)
		loc := time.FixedZone("ICT", 7*3600)
		now := time.Now().In(loc)
		todayISO := now.Format("2006-01-02")
		dStr1 := fmt.Sprintf("%d/%d/%d", now.Day(), int(now.Month()), now.Year())
		dStr2 := fmt.Sprintf("%02d/%02d/%d", now.Day(), int(now.Month()), now.Year())

		var storeList []string
		for _, s := range strings.Split(storeQuery, ",") {
			s = strings.TrimSpace(s)
			if s != "" {
				storeList = append(storeList, s)
			}
		}

		// Total store orders today
		backend.DB.Model(&Order{}).
			Where("fulfillment_store IN ? AND (timestamp LIKE ? OR timestamp LIKE ?)",
				storeList, todayISO+"%", todayISO+"T%").
			Count(&storeTotalToday)

		// Total packed by user today
		if fullName != "" {
			backend.DB.Model(&Order{}).
				Where("fulfillment_store IN ? AND packed_by = ? AND (packed_time LIKE ? OR packed_time LIKE ?)",
					storeList, fullName, dStr1+"%", dStr2+"%").
				Count(&packedByUserToday)
		}

		// Total counts per tab for the current store using database aggregation
		type TabCountResult struct {
			Pending   int64 `gorm:"column:pending"`
			Ready     int64 `gorm:"column:ready"`
			Shipped   int64 `gorm:"column:shipped"`
			Returned  int64 `gorm:"column:returned"`
			Cancelled int64 `gorm:"column:cancelled"`
		}
		var tcResult TabCountResult
		err := backend.DB.Model(&Order{}).
			Select(`
				COALESCE(SUM(CASE WHEN fulfillment_status IN ('Pending', 'Scheduled') OR (fulfillment_status = 'Cancelled' AND (return_received_by IS NULL OR return_received_by = '') AND (packed_by IS NULL OR packed_by = '') AND (packed_time IS NULL OR packed_time = '')) THEN 1 ELSE 0 END), 0) as pending,
				COALESCE(SUM(CASE WHEN fulfillment_status = 'Ready to Ship' OR (fulfillment_status = 'Cancelled' AND (return_received_by IS NULL OR return_received_by = '') AND ((packed_by IS NOT NULL AND packed_by != '') OR (packed_time IS NOT NULL AND packed_time != ''))) THEN 1 ELSE 0 END), 0) as ready,
				COALESCE(SUM(CASE WHEN fulfillment_status = 'Shipped' THEN 1 ELSE 0 END), 0) as shipped,
				COALESCE(SUM(CASE WHEN fulfillment_status = 'Returned' THEN 1 ELSE 0 END), 0) as returned,
				COALESCE(SUM(CASE WHEN fulfillment_status = 'Cancelled' AND return_received_by IS NOT NULL AND return_received_by != '' THEN 1 ELSE 0 END), 0) as cancelled
			`).
			Where("fulfillment_store IN ?", storeList).
			Scan(&tcResult).Error
		if err == nil {
			tabCounts["pending"] = tcResult.Pending
			tabCounts["ready"] = tcResult.Ready
			tabCounts["shipped"] = tcResult.Shipped
			tabCounts["returned"] = tcResult.Returned
			tabCounts["cancelled"] = tcResult.Cancelled
		}
	}

	// 6. Apply Internal Shipping Method Filter
	shippingMethodQuery := c.Query("internalShippingMethod")
	if shippingMethodQuery != "" {
		methods := strings.Split(shippingMethodQuery, ",")
		var conditions []string
		var args []interface{}
		for _, m := range methods {
			m = strings.TrimSpace(m)
			if m != "" {
				if strings.EqualFold(m, "Unassigned") {
					conditions = append(conditions, "internal_shipping_method = ? OR internal_shipping_method IS NULL")
					args = append(args, "")
				} else {
					conditions = append(conditions, "LOWER(internal_shipping_method) = LOWER(?)")
					args = append(args, m)
				}
			}
		}
		if len(conditions) > 0 {
			condition := "(" + strings.Join(conditions, " OR ") + ")"
			query = query.Where(condition, args...)
			countQuery = countQuery.Where(condition, args...)
		}
	}

	// Field Selection
	if view == "compact" {
		// Include products_json as it's needed for the dashboard display
		query = query.Select("order_id, timestamp, user, page, telegram_value, customer_name, customer_phone, location, address_details, note, shipping_fee_customer, subtotal, grand_total, internal_shipping_method, internal_shipping_details, internal_cost, payment_status, payment_info, discount_usd, delivery_unpaid, delivery_paid, total_product_cost, telegram_message_id1, telegram_message_id2, telegram_message_id3, scheduled_time, fulfillment_store, team, is_verified, fulfillment_status, packed_by, packed_time, package_photo_url, driver_name, tracking_number, dispatched_time, dispatched_by, delivered_time, delivery_photo_url, products_json")
	}

	// Apply Pagination
	if limit > 0 {
		query = query.Limit(limit).Offset(offset)
	}

	if err := query.Find(&orders).Error; err != nil {
		c.Error(err)
		return
	}
	var total int64
	countQuery.Count(&total)
	c.JSON(200, gin.H{
		"status":         "success",
		"data":           orders,
		"total":          total,
		"limit":          limit,
		"offset":         offset,
		"shippingCounts": shippingCounts,
		"progressStats": gin.H{
			"packedByUserToday": packedByUserToday,
			"storeTotalToday":   storeTotalToday,
		},
		"tabCounts": tabCounts,
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
		c.Error(err)
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

	orderID := generateShortID()

	// Default timestamp is NOW in Cambodia Time (ICT)
	ict := time.FixedZone("ICT", 7*3600)
	timestamp := time.Now().In(ict).Format("2006-01-02 15:04:05")

	// If ScheduledTime is provided, parse it and format as local time for the Sheet
	if orderRequest.ScheduledTime != "" {
		if t, err := time.Parse(time.RFC3339, orderRequest.ScheduledTime); err == nil {
			timestamp = t.In(ict).Format("2006-01-02 15:04:05")
		} else if t, err := time.Parse("2006-01-02 15:04", orderRequest.ScheduledTime); err == nil {
			timestamp = t.Format("2006-01-02 15:04:05")
		} else {
			timestamp = orderRequest.ScheduledTime
		}
	}

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

	// Determine initial status based on scheduling
	fulfillmentStatus := "Pending"
	if orderRequest.ScheduledTime != "" {
		var st time.Time
		var err error

		// Use flexible parsing to match the timestamp logic above
		// Prioritize RFC3339 as the frontend now sends UTC ISO strings
		if t, e := time.Parse(time.RFC3339, orderRequest.ScheduledTime); e == nil {
			st = t
		} else if t, e := time.Parse("2006-01-02 15:04", orderRequest.ScheduledTime); e == nil {
			st = t
		} else {
			err = e
		}

		if err == nil && st.After(time.Now().Add(1*time.Minute)) {
			fulfillmentStatus = "Scheduled"
		}
	}

	// Ensure Team is never empty if the user has a team
	finalTeam := orderRequest.SelectedTeam
	if finalTeam == "" && orderRequest.CurrentUser.Team != "" {
		// Take the first team if they have multiple
		parts := strings.Split(orderRequest.CurrentUser.Team, ",")
		finalTeam = strings.TrimSpace(parts[0])
	}

	newOrder := Order{
		OrderID: orderID, Timestamp: timestamp, User: orderRequest.CurrentUser.UserName, Team: finalTeam,
		Page: orderRequest.Page, CustomerName: custName, CustomerPhone: custPhone, Subtotal: orderRequest.Subtotal,
		GrandTotal: orderRequest.GrandTotal, ProductsJSON: string(productsJSON), Note: orderRequest.Note,
		FulfillmentStore: orderRequest.FulfillmentStore, ScheduledTime: timestamp, FulfillmentStatus: fulfillmentStatus,
		PaymentStatus: paymentStatus, PaymentInfo: paymentInfo, InternalCost: shippingCost, DiscountUSD: totalDiscount,
		TotalProductCost: totalProductCost, Location: strings.Join(locationParts, ", "), AddressDetails: addLocation,
		ShippingFeeCustomer: shipFeeCustomer, InternalShippingMethod: internalShipMethod, InternalShippingDetails: internalShipDetails,
	}

	if err := backend.DB.Create(&newOrder).Error; err != nil {
		c.Error(err)
		return
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "new_order", "data": newOrder})
	hub.Broadcast <- eventBytes

	// 🔄 Transform paymentStatus for Telegram display only (DB keeps "Unpaid")
	if paymentStatus == "Unpaid" {
		orderRequest.Payment["status"] = "Unpaid (មិនទាន់បង់ប្រាក់ 💸)"
	}

	// 📱 Append phone carrier for Telegram display only (DB keeps original phone)
	if carrier := cambodianCarrier(custPhone); carrier != "" {
		orderRequest.Customer["phone"] = custPhone + " (" + carrier + ")"
	}

	// 💲 Round all price fields to 2 decimal places for Telegram display only
	round2 := func(v float64) float64 {
		return math.Round(v*100) / 100
	}
	for _, p := range orderRequest.Products {
		priceFields := []string{"originalPrice", "finalPrice", "cost", "price"}
		for _, field := range priceFields {
			if val, ok := p[field].(float64); ok {
				p[field] = round2(val)
			}
		}
	}
	telegramShippingCost := round2(shippingCost)
	telegramTotalDiscount := round2(totalDiscount)
	telegramTotalProductCost := round2(totalProductCost)
	orderRequest.Subtotal = round2(orderRequest.Subtotal)
	orderRequest.GrandTotal = round2(orderRequest.GrandTotal)

	orderChannel <- OrderJob{JobID: fmt.Sprintf("job_%d", time.Now().UnixNano()), OrderID: orderID, UserName: orderRequest.CurrentUser.UserName, OrderData: map[string]interface{}{"orderId": orderID, "timestamp": timestamp, "totalDiscount": telegramTotalDiscount, "totalProductCost": telegramTotalProductCost, "fullLocation": strings.Join(locationParts, ", "), "productsJSON": string(productsJSON), "shippingCost": telegramShippingCost, "originalRequest": orderRequest, "scheduledTime": timestamp}}
	c.JSON(200, gin.H{"status": "success", "orderId": orderID})
}

func handleAdminUpdateOrder(c *gin.Context) {
	var r struct {
		OrderID  string                 `json:"orderId"`
		UserName string                 `json:"userName"`
		NewData  map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.Error(err)
		return
	}

	if r.NewData == nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការទិន្នន័យថ្មី (NewData is required)"})
		return
	}

	var originalOrder Order
	// Use case-insensitive and robust trimming for matching Order IDs
	if err := backend.DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", r.OrderID).First(&originalOrder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "រកមិនឃើញការកម្មង់ " + r.OrderID})
		return
	}

	// ✅ Validate status transitions — only allow valid state machine transitions
	if newStatusRaw, ok := r.NewData["Fulfillment Status"]; ok {
		newStatus := strings.TrimSpace(fmt.Sprintf("%v", newStatusRaw))
		currentStatus := strings.TrimSpace(originalOrder.FulfillmentStatus)
		if currentStatus == "" {
			currentStatus = "Pending"
		}

		validTransitions := map[string][]string{
			"Scheduled":     {"Pending", "Processing", "Ready to Ship", "Cancelled"},
			"Pending":       {"Processing", "Ready to Ship", "Cancelled"},
			"Processing":    {"Ready to Ship", "Pending", "Cancelled"},
			"Ready to Ship": {"Shipped", "Pending", "Cancelled"},
			"Shipped":       {"Delivered", "Ready to Ship", "Returned"},
			"Delivered":     {"Returned"},
			"Returned":      {"Delivered", "Shipped", "Ready to Ship", "Pending"},
			"Cancelled":     {"Pending", "Scheduled"},
		}

		allowed, ok := validTransitions[currentStatus]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ស្ថានភាពបច្ចុប្បន្នមិនត្រឹមត្រូវ"})
			return
		}

		// ✅ Support re-packing / self-updates (allow same status transition)
		transitionValid := (newStatus == currentStatus)
		if !transitionValid {
			for _, s := range allowed {
				if s == newStatus {
					transitionValid = true
					break
				}
			}
		}

		if !transitionValid {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": fmt.Sprintf("មិនអាចផ្លាស់ប្តូរពី '%s' ទៅ '%s' បានទេ", currentStatus, newStatus)})
			return
		}

		// ✅ Validate required fields for each transition
		switch newStatus {
		case "Cancelled":
			cancelReason, _ := r.NewData["Cancel Reason"]
			if cancelReason == nil || strings.TrimSpace(fmt.Sprintf("%v", cancelReason)) == "" {
				if strings.TrimSpace(originalOrder.CancelReason) == "" {
					c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការមូលហេតុដែល Cancel (Cancel Reason)"})
					return
				}
			}
		case "Returned":
			returnReason, _ := r.NewData["Return Reason"]
			if returnReason == nil || strings.TrimSpace(fmt.Sprintf("%v", returnReason)) == "" {
				if strings.TrimSpace(originalOrder.ReturnReason) == "" {
					c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការមូលហេតុដែល Return (Return Reason)"})
					return
				}
			}
		case "Ready to Ship":
			packedBy, _ := r.NewData["Packed By"]
			if packedBy == nil || strings.TrimSpace(fmt.Sprintf("%v", packedBy)) == "" {
				if strings.TrimSpace(originalOrder.PackedBy) == "" {
					c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការឈ្មោះអ្នកវេចខ្ចប់ (Packed By)"})
					return
				}
			}
		case "Shipped":
			dispatchedBy, _ := r.NewData["Dispatched By"]
			if dispatchedBy == nil || strings.TrimSpace(fmt.Sprintf("%v", dispatchedBy)) == "" {
				if strings.TrimSpace(originalOrder.DispatchedBy) == "" {
					c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការឈ្មោះអ្នកបញ្ជូន (Dispatched By)"})
					return
				}
			}
			// Driver assignment is usually done by logistics/dispatch or during delivery confirmation,
			// so we should not strictly require it for the 'Shipped' transition to avoid blocking packers.
		case "Delivered":
			_, hasDriver := r.NewData["Driver Name"]
			_, hasShippingDetails := r.NewData["Internal Shipping Details"]

			driverValid := hasDriver || strings.TrimSpace(originalOrder.DriverName) != ""
			detailsValid := hasShippingDetails || strings.TrimSpace(originalOrder.InternalShippingDetails) != ""

			if !driverValid && !detailsValid {
				c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការអ្នកដឹកជញ្ជូន (Driver Name) ឬព័ត៌មានដឹកជញ្ជូន មុនពេលបញ្ជាក់ការដឹកជញ្ជូន"})
				return
			}
		}
	}

	// Auto-set Delivered Time when transitioning to Delivered (if not already provided)
	if newStatusRaw, ok := r.NewData["Fulfillment Status"]; ok {
		if strings.TrimSpace(fmt.Sprintf("%v", newStatusRaw)) == "Delivered" {
			if _, hasTime := r.NewData["Delivered Time"]; !hasTime {
				r.NewData["Delivered Time"] = time.Now().Format("2006-01-02 15:04:05")
			}
		}
	}

	// ✅ Validate Return Receipt - If confirming receipt, require photo (unless it's just unpacking a Cancelled order)
	if _, hasReceivedBy := r.NewData["Return Received By"]; hasReceivedBy {
		// Determine the target status
		/*
			targetStatus := originalOrder.FulfillmentStatus
			if s, ok := r.NewData["Fulfillment Status"]; ok {
				targetStatus = strings.TrimSpace(fmt.Sprintf("%v", s))
			}
		*/

		// Return Photo is now optional as per user request
		/*
			if targetStatus != "Cancelled" {
				photo, hasPhoto := r.NewData["Return Photo"]
				if (!hasPhoto || strings.TrimSpace(fmt.Sprintf("%v", photo)) == "") && strings.TrimSpace(originalOrder.ReturnPhotoURL) == "" {
					c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការរូបភាពកញ្ចប់ឥវ៉ាន់ដែល Return (Return Photo)"})
					return
				}
			}
		*/
		// Auto-set received time if not provided
		if _, hasTime := r.NewData["Return Received Time"]; !hasTime {
			r.NewData["Return Received Time"] = time.Now().Format("2006-01-02 15:04:05")
		}
	}

	mappedData := make(map[string]interface{})
	for k, v := range r.NewData {
		dbCol := mapToDBColumn(k, "AllOrders")
		if isValidOrderColumn(dbCol) && v != nil {
			if dbCol == "discount_usd" || dbCol == "grand_total" || dbCol == "subtotal" || dbCol == "shipping_fee_customer" || dbCol == "internal_cost" || dbCol == "delivery_unpaid" || dbCol == "delivery_paid" || dbCol == "total_product_cost" {
				if f, ok := v.(float64); ok {
					mappedData[dbCol] = f
				} else if s, ok := v.(string); ok {
					if fVal, err := strconv.ParseFloat(s, 64); err == nil {
						mappedData[dbCol] = fVal
					}
				}
			} else {
				mappedData[dbCol] = fmt.Sprintf("%v", v)
			}
		}
	}

	// Handle 'Force Sync' to trigger Telegram/Google Sheets re-sync
	forceSync := false
	if fs, ok := r.NewData["Force Sync"]; ok {
		if b, ok := fs.(bool); ok && b {
			forceSync = true
		}
	}

	// ─── Generate EditLogs ───
	var origMap map[string]interface{}
	origJSON, _ := json.Marshal(originalOrder)
	json.Unmarshal(origJSON, &origMap)

	var editLogs []EditLog
	currentTime := time.Now().Format("2006-01-02 15:04:05")

	if forceSync {
		editLogs = append(editLogs, EditLog{
			Timestamp:    currentTime,
			OrderID:      r.OrderID,
			Requester:    r.UserName,
			FieldChanged: "Action",
			OldValue:     "Synced",
			NewValue:     "RE-SENT TO TELEGRAM",
		})
	}

	for k, v := range r.NewData {
		if k == "Force Sync" || v == nil {
			continue
		}

		oldValRaw, exists := origMap[k]
		if !exists {
			continue
		}

		oldValStr := strings.TrimSpace(fmt.Sprintf("%v", oldValRaw))
		newValStr := strings.TrimSpace(fmt.Sprintf("%v", v))

		// Normalizing float formatting if possible (e.g. 10 == 10.0)
		if fNew, ok := v.(float64); ok {
			if fOld, okOld := oldValRaw.(float64); okOld {
				if fNew == fOld {
					continue
				}
			}
			newValStr = strings.TrimSpace(fmt.Sprintf("%v", fNew))
		}

		if oldValStr != newValStr {
			editLogs = append(editLogs, EditLog{
				Timestamp:    currentTime,
				OrderID:      r.OrderID,
				Requester:    r.UserName,
				FieldChanged: k,
				OldValue:     oldValStr,
				NewValue:     newValStr,
			})
		}
	}
	// ─────────────────────────

	if len(mappedData) == 0 && !forceSync {
		c.JSON(200, gin.H{"status": "success", "message": "No changes to update"})
		return
	}

	if len(mappedData) > 0 {
		if err := backend.DB.Model(&Order{}).Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", r.OrderID).Updates(mappedData).Error; err != nil {
			c.Error(err)
			return
		}
	}

	// Save EditLogs to DB and Sync (Moved outside len(mappedData) check to support Force Sync logging)
	if len(editLogs) > 0 {
		if err := backend.DB.Create(&editLogs).Error; err != nil {
			log.Println("Error saving edit logs:", err)
		} else {
			for _, el := range editLogs {
				go enqueueSync("addRow", map[string]interface{}{
					"Timestamp":     el.Timestamp,
					"OrderID":       el.OrderID,
					"Requester":     el.Requester,
					"Field Changed": el.FieldChanged,
					"Old Value":     el.OldValue,
					"New Value":     el.NewValue,
				}, "EditLogs", nil)
			}
		}
	}

	if len(mappedData) > 0 {
		// ✅ Auto-log ReturnItems when status changes to Returned
		if newStatusRaw, ok := r.NewData["Fulfillment Status"]; ok {
			newStatusStr := strings.TrimSpace(fmt.Sprintf("%v", newStatusRaw))

			if newStatusStr == "Returned" || newStatusStr == "Cancelled" {
				go AddWatermarkAndEditTelegramMedia(originalOrder, newStatusStr)
			}

			if newStatusStr == "Returned" {
				var products []map[string]interface{}
				if err := json.Unmarshal([]byte(originalOrder.ProductsJSON), &products); err == nil {
					for _, p := range products {
						name, _ := p["name"].(string)
						qty, _ := p["quantity"].(float64)
						if name != "" && qty > 0 {
							reason := ""
							if r, ok := r.NewData["Return Reason"].(string); ok && r != "" {
								reason = r
							} else {
								reason = originalOrder.ReturnReason
							}

							barcode := ""
							if b, ok := p["barcode"].(string); ok {
								barcode = b
							}

							returnItem := ReturnItem{
								Timestamp:   time.Now().Format("2006-01-02 15:04:05"),
								OrderID:     originalOrder.OrderID,
								StoreName:   originalOrder.FulfillmentStore,
								Barcode:     barcode,
								ProductName: name,
								Quantity:    qty,
								Reason:      reason,
								HandledBy:   r.UserName,
								Status:      "Pending Receipt",
							}
							var count int64
							backend.DB.Table("returns").Where("order_id = ? AND product_name = ?", originalOrder.OrderID, name).Count(&count)
							if count == 0 {
								if err := backend.DB.Table("returns").Create(&returnItem).Error; err == nil {
									// Sync with Google Sheets
									go enqueueSync("addRow", map[string]interface{}{
										"Timestamp":   returnItem.Timestamp,
										"OrderID":     returnItem.OrderID,
										"StoreName":   returnItem.StoreName,
										"Barcode":     returnItem.Barcode,
										"ProductName": returnItem.ProductName,
										"Quantity":    returnItem.Quantity,
										"Reason":      returnItem.Reason,
										"HandledBy":   returnItem.HandledBy,
										"Status":      returnItem.Status,
									}, "Returns", nil)
								}
							}
						}
					}
				}
			}
		}

		// ✅ Update ReturnItems status when received
		if _, hasReceivedBy := r.NewData["Return Received By"]; hasReceivedBy {
			backend.DB.Table("returns").Where("order_id = ?", r.OrderID).Update("status", "Received")

			// Sync with Google Sheets
			go enqueueSync("updateSheet", map[string]interface{}{
				"Status": "Received",
			}, "Returns", map[string]string{"OrderID": r.OrderID})
		}

		eventBytes, _ := json.Marshal(map[string]interface{}{"type": "update_order", "orderId": r.OrderID, "newData": r.NewData})
		hub.Broadcast <- eventBytes
	}

	go func() {
		// Build comprehensive sheet data for Packing & Fulfillment
		sheetData := make(map[string]interface{})
		for k, v := range r.NewData {
			if k != "Force Sync" {
				sheetData[k] = v
			}
		}

		var current Order
		if err := backend.DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", r.OrderID).First(&current).Error; err == nil {
			// Helper to fill missing fields from DB if not in the request
			fill := func(key, val, dbField string) {
				if _, exists := sheetData[key]; !exists && val != "" {
					sheetData[key] = val
				}
			}
			fill("Packed By", current.PackedBy, "packed_by")
			fill("Packed Time", current.PackedTime, "packed_time")
			fill("Package Photo", current.PackagePhotoURL, "package_photo_url")
			fill("Fulfillment Status", current.FulfillmentStatus, "fulfillment_status")
			fill("Fulfillment Store", current.FulfillmentStore, "fulfillment_store")
			fill("Team", current.Team, "team")
			fill("Page", current.Page, "page")

			// Crucial: Determine team for sheet routing
			team := current.Team
			if t, ok := r.NewData["Team"].(string); ok && t != "" {
				team = t
			}

			// 🚀 TRIGGER APPS SCRIPT: Update Sheet AND Edit Telegram Message
			enqueueSync("updateOrderTelegram", map[string]interface{}{
				"orderId":       r.OrderID,
				"updatedFields": sheetData,
				"team":          team,
				"Force Sync":    forceSync,
			}, "", nil)
		}
	}()

	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminDeleteOrder(c *gin.Context) {
	var r DeleteOrderRequest
	if err := c.ShouldBindJSON(&r); err != nil {
		c.Error(err)
		return
	}

	// 1. Try to find the order in the local database to get full metadata
	var order Order
	foundLocally := false
	if err := backend.DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", r.OrderID).First(&order).Error; err == nil {
		foundLocally = true
	}

	// 2. Prepare metadata for deletion, prioritizing DB data but falling back to request data
	m1 := r.TelegramMessageID1
	if foundLocally && order.TelegramMessageID1 != "" {
		m1 = order.TelegramMessageID1
	}
	m2 := r.TelegramMessageID2
	if foundLocally && order.TelegramMessageID2 != "" {
		m2 = order.TelegramMessageID2
	}
	m3 := r.TelegramMessageID3
	if foundLocally && order.TelegramMessageID3 != "" {
		m3 = order.TelegramMessageID3
	}

	store := r.FulfillmentStore
	if foundLocally && order.FulfillmentStore != "" {
		store = order.FulfillmentStore
	}

	team := r.Team
	if foundLocally && order.Team != "" {
		team = order.Team
	}

	// 3. Trigger Apps Script deletion (Handles BOTH Sheets and Telegram)
	go func() {
		// We always call this even if not found locally, as it might exist in Sheets
		enqueueSync("deleteOrderTelegram", map[string]interface{}{
			"orderId":          r.OrderID,
			"team":             team,
			"messageId1":       m1,
			"messageId2":       m2,
			"messageId3":       m3,
			"fulfillmentStore": store,
		}, "", nil)
	}()

	// 4. Delete from local DB if it exists
	if foundLocally {
		// ─── Generate EditLog for Deletion ───
		deleteLog := EditLog{
			Timestamp:    time.Now().Format("2006-01-02 15:04:05"),
			OrderID:      r.OrderID,
			Requester:    r.UserName,
			FieldChanged: "Action",
			OldValue:     "Existing",
			NewValue:     "DELETED",
		}
		backend.DB.Create(&deleteLog)

		// Sync deletion log to Google Sheets
		go enqueueSync("addRow", map[string]interface{}{
			"Timestamp":     deleteLog.Timestamp,
			"OrderID":       deleteLog.OrderID,
			"Requester":     deleteLog.Requester,
			"Field Changed": deleteLog.FieldChanged,
			"Old Value":     deleteLog.OldValue,
			"New Value":     deleteLog.NewValue,
		}, "EditLogs", nil)
		// ─────────────────────────────────────

		backend.DB.Delete(&order)
	}

	// 5. Broadcast deletion to all connected clients
	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "delete_order", "orderId": r.OrderID})
	hub.Broadcast <- eventBytes

	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminUpdateSheet(c *gin.Context) {
	var req struct {
		SheetName  string                 `json:"sheetName"`
		PrimaryKey map[string]interface{} `json:"primaryKey"`
		NewData    map[string]interface{} `json:"newData"`
		FullSync   bool                   `json:"fullSync"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	if req.FullSync && req.SheetName != "" {
		go func(sheetName string) {
			log.Printf("🔄 Selective Sync: Starting refresh for sheet %s", sheetName)
			switch sheetName {
			case "Users":
				var items []User
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&User{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "Products":
				var items []Product
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Product{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "Stores":
				var items []Store
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Store{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "TeamsPages":
				var items []TeamPage
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&TeamPage{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "ShippingMethods":
				var items []ShippingMethod
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ShippingMethod{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "Drivers":
				var items []Driver
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Driver{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "BankAccounts":
				var items []BankAccount
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&BankAccount{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "Roles":
				var items []Role
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Role{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "RolePermissions":
				var items []RolePermission
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&RolePermission{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "Locations":
				var items []Location
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Location{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "Colors":
				var items []Color
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Color{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "PhoneCarriers":
				var items []PhoneCarrier
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&PhoneCarrier{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "TelegramTemplates":
				var items []TelegramTemplate
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&TelegramTemplate{})
					backend.DB.CreateInBatches(items, 100)
				}
			case "DeliveryGroups":
				var items []DeliveryGroup
				if err := backend.FetchSheetDataToStruct(sheetName, &items); err == nil {
					backend.DB.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&DeliveryGroup{})
					backend.DB.CreateInBatches(items, 100)
				}
			}
			log.Printf("✅ Selective Sync: Completed refresh for sheet %s", sheetName)
			// Broadcast completion
			if hub != nil {
				msg, _ := json.Marshal(map[string]interface{}{"type": "selective_sync_complete", "sheet": sheetName})
				hub.Broadcast <- msg
			}
		}(req.SheetName)
		c.JSON(200, gin.H{"status": "success", "message": "Selective sync started"})
		return
	}

	tableName := getTableName(req.SheetName)
	if tableName == "" {
		c.Error(fmt.Errorf("unknown sheet"))
		return
	}

	var modelInstance interface{}
	switch req.SheetName {
	case "IncentiveCalculators":
		modelInstance = &IncentiveCalculator{}
	case "IncentiveProjects":
		modelInstance = &IncentiveProject{}
	case "AllOrders":
		modelInstance = &Order{}
	case "Users":
		modelInstance = &User{}
	case "Products":
		modelInstance = &Product{}
	case "Stores":
		modelInstance = &Store{}
	case "Settings":
		modelInstance = &Setting{}
	case "TeamsPages":
		modelInstance = &TeamPage{}
	case "Locations":
		modelInstance = &Location{}
	case "ShippingMethods":
		modelInstance = &ShippingMethod{}
	case "DeliveryGroups":
		modelInstance = &DeliveryGroup{}
	case "Colors":
		modelInstance = &Color{}
	case "Drivers":
		modelInstance = &Driver{}
	case "BankAccounts":
		modelInstance = &BankAccount{}
	case "PhoneCarriers":
		modelInstance = &PhoneCarrier{}
	case "Inventory":
		modelInstance = &Inventory{}
	case "StockTransfers":
		modelInstance = &StockTransfer{}
	case "Returns":
		modelInstance = &ReturnItem{}
	case "Roles":
		modelInstance = &Role{}
	case "RolePermissions":
		modelInstance = &RolePermission{}
	case "DriverRecommendations":
		modelInstance = &DriverRecommendation{}
	case "Movies":
		modelInstance = &Movie{}
	case "Promotions":
		modelInstance = &Promotion{}
	case "RevenueDashboard":
		modelInstance = &RevenueEntry{}
	case "ChatMessages":
		modelInstance = &ChatMessage{}
	case "EditLogs":
		modelInstance = &EditLog{}
	case "UserActivityLogs":
		modelInstance = &UserActivityLog{}
	case "TelegramTemplates":
		modelInstance = &TelegramTemplate{}
	}

	pkCol := ""
	var pkVal interface{}
	for k, v := range req.PrimaryKey {
		pkCol = mapToDBColumn(k, req.SheetName)
		pkVal = v
	}

	// Smart type conversion for known numeric primary keys
	if pkCol == "id" || pkCol == "project_id" || pkCol == "calculator_id" {
		if s, ok := pkVal.(string); ok {
			if i, err := strconv.ParseUint(s, 10, 64); err == nil {
				pkVal = uint(i)
			}
		} else if f, ok := pkVal.(float64); ok {
			pkVal = uint(f)
		}
	}

	if !isValidDBIdentifier(pkCol) {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid primary key field"})
		return
	}
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData {
		dbCol := mapToDBColumn(k, req.SheetName)
		if v == nil {
			continue
		}

		// Smart type conversion for known numeric columns in mappedData
		// We convert all whole-number float64 to int to avoid PG type mismatch
		if f, ok := v.(float64); ok {
			if f == float64(int(f)) {
				v = int(f)
			}
		} else if s, ok := v.(string); ok {
			// Handle boolean strings for columns like is_verified, is_custom, require_period_selection
			lowerS := strings.ToLower(s)
			if lowerS == "true" || lowerS == "false" {
				v = (lowerS == "true")
			}
			// REMOVED: auto-conversion of numeric strings to int, as it causes issues with Postgres text columns
		}

		// Hashing password if updating users table
		if tableName == "users" && dbCol == "password" && v != "" {
			hashed, err := bcrypt.GenerateFromPassword([]byte(fmt.Sprintf("%v", v)), bcrypt.DefaultCost)
			if err == nil {
				v = string(hashed)
			}
		}

		mappedData[dbCol] = v
	}

	dbQuery := backend.DB.Table(tableName)
	if modelInstance != nil {
		dbQuery = backend.DB.Model(modelInstance)
	}

	if err := dbQuery.Where(pkCol+" = ?", pkVal).Updates(mappedData).Error; err != nil {
		log.Printf("[ERROR] handleAdminUpdateSheet (Table: %s, PK: %s=%v): %v", tableName, pkCol, pkVal, err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": fmt.Sprintf("Database update failed for %s: %v", req.SheetName, err),
		})
		return
	}

	// 🚀 CASCADE UPDATE: If RoleName is updated, update RolePermissions and Users tables
	if req.SheetName == "Roles" {
		newNameRaw, hasNewName := req.NewData["RoleName"]
		if hasNewName {
			newName := strings.TrimSpace(fmt.Sprintf("%v", newNameRaw))
			var oldRole Role
			if err := backend.DB.Table("roles").Where(pkCol+" = ?", pkVal).First(&oldRole).Error; err == nil {
				oldName := oldRole.RoleName
				if oldName != "" && oldName != newName {
					log.Printf("🔄 Cascading Role Update: %s -> %s", oldName, newName)

					// 1. Update RolePermissions (by name and ID)
					backend.DB.Table("role_permissions").Where("LOWER(TRIM(role)) = LOWER(TRIM(?))", oldName).Updates(map[string]interface{}{
						"role":    newName,
						"role_id": pkVal,
					})

					// 2. Update Users table (Handle comma-separated roles)
					var users []User
					backend.DB.Table("users").Where("LOWER(role) LIKE LOWER(?)", "%"+oldName+"%").Find(&users)
					for _, u := range users {
						roles := strings.Split(u.Role, ",")
						changed := false
						for i, r := range roles {
							if strings.EqualFold(strings.TrimSpace(r), oldName) {
								roles[i] = newName
								changed = true
							}
						}
						if changed {
							newRoleList := strings.Join(roles, ",")
							backend.DB.Table("users").Where("user_name = ?", u.UserName).Update("role", newRoleList)
						}
					}

					// 3. Trigger full sheet re-sync for these tables to keep Google Sheets in sync
					go func() {
						time.Sleep(2 * time.Second) // Wait for DB updates to settle
						backend.SyncAllPermissionsToSheet()
						// Optionally sync users too if needed
					}()
				}
			}
		}
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "update_sheet", "sheetName": req.SheetName, "primaryKey": req.PrimaryKey, "newData": req.NewData})
	hub.Broadcast <- eventBytes

	// When a RolePermissions row is updated via the generic sheet endpoint, also broadcast
	// the targeted "update_permission" event so connected clients immediately rebuild their
	// permission state — without waiting for the 5-minute background poll.
	if req.SheetName == "RolePermissions" {
		permEvent, _ := json.Marshal(map[string]interface{}{
			"type":      "update_permission",
			"role":      req.NewData["Role"],
			"feature":   req.NewData["Feature"],
			"isEnabled": req.NewData["IsEnabled"],
		})
		hub.Broadcast <- permEvent
	}

	go func() {
		// Prepare PK map for sync
		syncPK := make(map[string]interface{})
		for k, v := range req.PrimaryKey {
			key := k
			if (req.SheetName == "Roles" || req.SheetName == "RolePermissions") && strings.ToLower(k) == "id" {
				key = "ID"
			}
			syncPK[key] = v
		}

		// Sync with Google Sheets via managed queue
		enqueueSync("updateSheet", req.NewData, req.SheetName, syncPK)

		// If updating an Order row, also notify Telegram to keep message in sync
		if req.SheetName == "AllOrders" {
			orderID := fmt.Sprintf("%v", pkVal)
			var order Order
			backend.DB.Where("order_id = ?", orderID).Select("team").First(&order)
			enqueueSync("updateOrderTelegram", map[string]interface{}{
				"orderId":       orderID,
				"updatedFields": req.NewData,
				"team":          order.Team,
			}, "", nil)
		}
	}()
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminAddRow(c *gin.Context) {
	var req struct {
		SheetName string                 `json:"sheetName"`
		NewData   map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	tableName := getTableName(req.SheetName)
	if tableName != "" {
		var modelInstance interface{}
		switch req.SheetName {
		case "IncentiveCalculators":
			modelInstance = &IncentiveCalculator{}
		case "IncentiveProjects":
			modelInstance = &IncentiveProject{}
		case "AllOrders":
			modelInstance = &Order{}
		case "Users":
			modelInstance = &User{}
		case "Products":
			modelInstance = &Product{}
		case "Stores":
			modelInstance = &Store{}
		case "Settings":
			modelInstance = &Setting{}
		case "TeamsPages":
			modelInstance = &TeamPage{}
		case "Locations":
			modelInstance = &Location{}
		case "ShippingMethods":
			modelInstance = &ShippingMethod{}
		case "DeliveryGroups":
			modelInstance = &DeliveryGroup{}
		case "Colors":
			modelInstance = &Color{}
		case "Drivers":
			modelInstance = &Driver{}
		case "BankAccounts":
			modelInstance = &BankAccount{}
		case "PhoneCarriers":
			modelInstance = &PhoneCarrier{}
		case "Inventory":
			modelInstance = &Inventory{}
		case "StockTransfers":
			modelInstance = &StockTransfer{}
		case "Returns":
			modelInstance = &ReturnItem{}
		case "Roles":
			modelInstance = &Role{}
		case "RolePermissions":
			modelInstance = &RolePermission{}
		case "DriverRecommendations":
			modelInstance = &DriverRecommendation{}
		case "Movies":
			modelInstance = &Movie{}
		case "Promotions":
			modelInstance = &Promotion{}
		case "RevenueDashboard":
			modelInstance = &RevenueEntry{}
		case "ChatMessages":
			modelInstance = &ChatMessage{}
		case "EditLogs":
			modelInstance = &EditLog{}
		case "UserActivityLogs":
			modelInstance = &UserActivityLog{}
		case "TelegramTemplates":
			modelInstance = &TelegramTemplate{}
		}

		mappedData := make(map[string]interface{})
		for k, v := range req.NewData {
			colName := mapToDBColumn(k, req.SheetName)
			if v == nil {
				continue
			}

			// Smart type conversion for known numeric columns in mappedData
			// We convert all whole-number float64 to int to avoid PG type mismatch
			if f, ok := v.(float64); ok {
				if f == float64(int(f)) {
					v = int(f)
				}
			} else if s, ok := v.(string); ok {
				// Handle boolean strings
				lowerS := strings.ToLower(s)
				if lowerS == "true" || lowerS == "false" {
					v = (lowerS == "true")
				}
				// REMOVED: auto-conversion of numeric strings to int, as it causes issues with Postgres text columns
			}

			// Hashing password if adding to users table
			if tableName == "users" && colName == "password" && v != "" {
				hashed, err := bcrypt.GenerateFromPassword([]byte(fmt.Sprintf("%v", v)), bcrypt.DefaultCost)
				if err == nil {
					v = string(hashed)
				}
			}
			mappedData[colName] = v
		}

		dbQuery := backend.DB.Table(tableName)
		if modelInstance != nil {
			dbQuery = backend.DB.Model(modelInstance)
		}

		// Use OnConflict to handle duplicate keys (like Product barcode)
		if err := dbQuery.Clauses(clause.OnConflict{UpdateAll: true}).Create(mappedData).Error; err != nil {
			log.Printf("[ERROR] handleAdminAddRow (Table: %s): %v", tableName, err)
			c.JSON(http.StatusInternalServerError, gin.H{
				"status":  "error",
				"message": fmt.Sprintf("Database update/creation failed for %s: %v", req.SheetName, err),
			})
			return
		}
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "add_row", "sheetName": req.SheetName, "newData": req.NewData})
	hub.Broadcast <- eventBytes

	if req.SheetName == "RolePermissions" {
		permEvent, _ := json.Marshal(map[string]interface{}{
			"type":      "update_permission",
			"role":      req.NewData["Role"],
			"feature":   req.NewData["Feature"],
			"isEnabled": req.NewData["IsEnabled"],
		})
		hub.Broadcast <- permEvent
	}

	go func() {
		// Sync with Google Sheets via managed queue
		enqueueSync("addRow", req.NewData, req.SheetName, nil)
	}()
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminDeleteRow(c *gin.Context) {
	var req struct {
		SheetName  string                 `json:"sheetName"`
		PrimaryKey map[string]interface{} `json:"primaryKey"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	pkCol := ""
	var pkVal interface{}
	for k, v := range req.PrimaryKey {
		pkCol = mapToDBColumn(k, req.SheetName)
		pkVal = v
	}
	if !isValidDBIdentifier(pkCol) {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid primary key field"})
		return
	}

	// ── Roles guard: prevent deleting Admin role (check by RoleName in backend.DB) ──
	if req.SheetName == "Roles" {
		var role Role
		if err := backend.DB.Table("roles").Where(pkCol+" = ?", pkVal).First(&role).Error; err == nil {
			if strings.EqualFold(role.RoleName, "Admin") {
				c.JSON(403, gin.H{"status": "error", "message": "មិនអាចលុបតួនាទី Admin បានទេ (Cannot delete Admin role)"})
				return
			}
		}
	}

	// ── Users guard: prevent deleting Admin user ──
	if req.SheetName == "Users" {
		if strings.EqualFold(fmt.Sprintf("%v", pkVal), "admin") {
			c.JSON(403, gin.H{"status": "error", "message": "មិនអាចលុបអ្នកប្រើប្រាស់ Admin បានទេ (Cannot delete Admin user)"})
			return
		}
	}

	tableName := getTableName(req.SheetName)
	if tableName != "" {
		// Use map model so GORM executes DELETE without needing a struct with primary key
		if err := backend.DB.Table(tableName).Where(pkCol+" = ?", pkVal).Delete(map[string]interface{}{}).Error; err != nil {
			c.JSON(500, gin.H{"status": "error", "message": "Delete operation failed: " + err.Error()})
			return
		}
	}

	strPrimaryKey := make(map[string]string)
	for k, v := range req.PrimaryKey {
		sheetKey := k
		if req.SheetName == "Roles" && strings.ToLower(k) == "id" {
			sheetKey = "ID"
		}
		strPrimaryKey[sheetKey] = fmt.Sprintf("%v", v)
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "delete_row", "sheetName": req.SheetName, "primaryKey": strPrimaryKey})
	hub.Broadcast <- eventBytes

	if req.SheetName == "RolePermissions" {
		permEvent, _ := json.Marshal(map[string]interface{}{
			"type":    "update_permission",
			"role":    req.PrimaryKey["Role"],
			"feature": req.PrimaryKey["Feature"],
		})
		hub.Broadcast <- permEvent
	}

	go func() {
		// Sync with Google Sheets via managed queue
		enqueueSync("deleteRow", nil, req.SheetName, strPrimaryKey)
	}()
	c.JSON(200, gin.H{"status": "success"})
}

func handleGetRevenueSummary(c *gin.Context) {
	var revs []RevenueEntry
	backend.DB.Find(&revs)
	c.JSON(200, gin.H{"status": "success", "data": revs})
}

// handleGetProductsOnly returns a read-only list of products for external developers.
// It supports optional API Key authentication via 'X-API-Key' header.
func handleGetProductsOnly(c *gin.Context) {
	// Simple API Key check for external developers
	apiKey := c.GetHeader("X-API-Key")
	expectedKey := os.Getenv("EXTERNAL_PRODUCT_API_KEY")

	// If EXTERNAL_PRODUCT_API_KEY is not set, we require standard Auth or allow public if desired.
	// For now, if expectedKey is set, we strictly enforce it.
	if expectedKey != "" && apiKey != expectedKey {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "លេខកូដសម្ងាត់ API មិនត្រឹមត្រូវ (Invalid API Key)"})
		return
	}

	var products []Product
	if err := backend.DB.Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "បរាជ័យក្នុងការទាញទិន្នន័យផលិតផល: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"data":   products,
	})
}

func handleGetSyncStatus(c *gin.Context) {
	var count int64
	backend.DB.Model(&backend.PendingSync{}).Where("status = 'pending' OR status = 'processing'").Count(&count)

	var permanentFailures int64
	backend.DB.Model(&backend.PendingSync{}).Where("status = 'permanent_failure'").Count(&permanentFailures)

	c.JSON(200, gin.H{
		"status":            "success",
		"pendingCount":      count,
		"permanentFailures": permanentFailures,
	})
}

func handleGetSyncQueue(c *gin.Context) {
	var queue []backend.PendingSync
	backend.DB.Order("created_at DESC").Limit(50).Find(&queue)
	c.JSON(200, gin.H{"status": "success", "data": queue})
}

func handleRetrySyncTask(c *gin.Context) {
	id := c.Param("id")
	if err := backend.DB.Model(&backend.PendingSync{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":             "pending",
		"retry_count":        0,
		"last_error_message": "",
	}).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleRetryAllFailedSyncTasks(c *gin.Context) {
	if err := backend.DB.Model(&backend.PendingSync{}).Where("status = 'failed' OR status = 'permanent_failure'").Updates(map[string]interface{}{
		"status":             "pending",
		"retry_count":        0,
		"last_error_message": "",
	}).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleClearFailedSyncTasks(c *gin.Context) {
	if err := backend.DB.Where("status = 'permanent_failure'").Delete(&backend.PendingSync{}).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleHealthCheck(c *gin.Context) {
	dbStatus := "Stable"
	dbErr := ""
	sqlDB, err := backend.DB.DB()
	if err != nil {
		dbStatus = "Error"
		dbErr = err.Error()
	} else if err := sqlDB.Ping(); err != nil {
		dbStatus = "Unstable"
		dbErr = err.Error()
	}

	sheetStatus := "Authorized"
	sheetErr := ""
	if backend.SheetsService == nil {
		sheetStatus = "Not Initialized"
	} else {
		// Try a very small metadata fetch to verify auth
		_, err := backend.SheetsService.Spreadsheets.Get(backend.SpreadsheetID).Fields("spreadsheetId").Do()
		if err != nil {
			sheetStatus = "Auth Failed"
			sheetErr = err.Error()
		}
	}

	c.JSON(200, gin.H{
		"status": "success",
		"health": gin.H{
			"database": gin.H{
				"status": dbStatus,
				"error":  dbErr,
			},
			"googleSheets": gin.H{
				"status": sheetStatus,
				"error":  sheetErr,
			},
			"uptime": time.Since(startTime).Seconds(),
		},
	})
}

// ─── Telegram Bot Webhook Handlers ───

func handleRegisterTelegramWebhook(c *gin.Context) {
	var r struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.Error(err)
		return
	}

	if r.Token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Bot Token is required"})
		return
	}

	// Use the current request host to determine the webhook URL
	protocol := "https"
	if c.Request.TLS == nil {
		// Fallback check if behind proxy (like Render/Heroku/Cloudflare)
		if c.GetHeader("X-Forwarded-Proto") != "" {
			protocol = c.GetHeader("X-Forwarded-Proto")
		} else if !strings.Contains(c.Request.Host, "localhost") {
			protocol = "https"
		} else {
			protocol = "http"
		}
	}

	webhookURL := fmt.Sprintf("%s://%s/api/telegram/webhook/%s", protocol, c.Request.Host, r.Token)
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook?url=%s", r.Token, webhookURL)

	log.Printf("🔌 [Telegram Setup] Registering webhook: %s", webhookURL)

	resp, err := http.Get(apiURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to call Telegram setWebhook: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var resData map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&resData)

	c.JSON(http.StatusOK, resData)
}

func handleTelegramWebhook(c *gin.Context) {
	token := c.Param("token")
	var update struct {
		Message struct {
			MessageID int `json:"message_id"`
			Chat      struct {
				ID int64 `json:"id"`
			} `json:"chat"`
			Text            string `json:"text"`
			MessageThreadID int    `json:"message_thread_id"`
		} `json:"message"`
		CallbackQuery struct {
			ID   string `json:"id"`
			From struct {
				ID        int64  `json:"id"`
				FirstName string `json:"first_name"`
				LastName  string `json:"last_name"`
				Username  string `json:"username"`
			} `json:"from"`
			Message struct {
				MessageID int `json:"message_id"`
				Chat      struct {
					ID int64 `json:"id"`
				} `json:"chat"`
				Caption string `json:"caption"`
			} `json:"message"`
			Data string `json:"data"`
		} `json:"callback_query"`
	}

	if err := c.ShouldBindJSON(&update); err != nil {
		return
	}

	// 1. Handle Messages (Existing logic)
	if update.Message.Text != "" {
		text := strings.TrimSpace(update.Message.Text)
		if strings.HasPrefix(text, "/id") {
			chatID := update.Message.Chat.ID
			threadID := update.Message.MessageThreadID
			go func(t string, cid int64, tid int) {
				response := fmt.Sprintf("🆔 *Chat Information*\n\n🔹 *Group ID:* `%d`", cid)
				if tid != 0 {
					response += fmt.Sprintf("\n🔹 *Thread ID:* `%d`", tid)
				}
				payload := map[string]interface{}{
					"chat_id":    cid,
					"text":       response,
					"parse_mode": "Markdown",
				}
				if tid != 0 {
					payload["message_thread_id"] = tid
				}
				apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", t)
				jsonData, _ := json.Marshal(payload)
				http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
			}(token, chatID, threadID)
		}
	}

	// 2. Handle Callback Queries (Pick Up Logic)
	if update.CallbackQuery.ID != "" && strings.HasPrefix(update.CallbackQuery.Data, "pickup_") {
		orderID := strings.TrimPrefix(update.CallbackQuery.Data, "pickup_")
		driverName := strings.TrimSpace(update.CallbackQuery.From.FirstName + " " + update.CallbackQuery.From.LastName)
		driverUser := update.CallbackQuery.From.Username
		if driverUser != "" {
			driverUser = "@" + driverUser
		} else {
			driverUser = fmt.Sprintf("ID:%d", update.CallbackQuery.From.ID)
		}

		ict := time.FixedZone("ICT", 7*3600)
		now := time.Now().In(ict).Format("15:04:05")

		// Update DB
		var order Order
		if err := backend.DB.Where("order_id = ?", orderID).First(&order).Error; err == nil {
			// Update locally
			backend.DB.Model(&Order{}).Where("order_id = ?", orderID).Updates(map[string]interface{}{
				"dispatched_by":   driverName + " (" + driverUser + ")",
				"dispatched_time": now,
			})

			// Sync to Sheets
			backend.EnqueueSync("updateSheet", map[string]interface{}{
				"Dispatched By":   driverName + " (" + driverUser + ")",
				"Dispatched Time": now,
			}, "AllOrders", map[string]string{"Order ID": orderID})

			if order.Team != "" {
				backend.EnqueueSync("updateSheet", map[string]interface{}{
					"Dispatched By":   driverName + " (" + driverUser + ")",
					"Dispatched Time": now,
				}, "Orders_"+order.Team, map[string]string{"Order ID": orderID})
			}

			// Edit Message Caption
			newCaption := update.CallbackQuery.Message.Caption + fmt.Sprintf("\n\n✅ *បានមកយកដោយ:* %s\n👤 អ្នកដឹក: %s\n⏰ ម៉ោង: %s", driverName, driverUser, now)

			// Answer callback first to stop loading
			answerURL := fmt.Sprintf("https://api.telegram.org/bot%s/answerCallbackQuery", token)
			answerPayload := map[string]interface{}{
				"callback_query_id": update.CallbackQuery.ID,
				"text":              "✅ បានកត់ត្រាការ Pick Up",
			}
			ajson, _ := json.Marshal(answerPayload)
			http.Post(answerURL, "application/json", bytes.NewBuffer(ajson))

			// Edit Caption (Remove button by not sending reply_markup)
			editURL := fmt.Sprintf("https://api.telegram.org/bot%s/editMessageCaption", token)
			editPayload := map[string]interface{}{
				"chat_id":    update.CallbackQuery.Message.Chat.ID,
				"message_id": update.CallbackQuery.Message.MessageID,
				"caption":    newCaption,
				"parse_mode": "Markdown",
			}
			ejson, _ := json.Marshal(editPayload)
			http.Post(editURL, "application/json", bytes.NewBuffer(ejson))
		}
	}

	c.JSON(200, gin.H{"status": "ok"})
}

func handleTestTelegram(c *gin.Context) {
	var r struct {
		Token    string `json:"token"`
		ChatID   string `json:"chatId"`
		ThreadID string `json:"threadId"`
		Message  string `json:"message"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.Error(err)
		return
	}

	if r.Token == "" || r.ChatID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Bot Token and Chat ID are required"})
		return
	}

	payload := map[string]interface{}{
		"chat_id":    r.ChatID,
		"text":       "🔔 *តេស្តការតភ្ជាប់ (Test Connection)*\n\nប្រព័ន្ធរបស់អ្នកត្រូវបានភ្ជាប់មកកាន់ Group នេះដោយជោគជ័យ!\n\n📍 Message: " + r.Message,
		"parse_mode": "Markdown",
	}

	if r.ThreadID != "" {
		if tid, err := strconv.Atoi(r.ThreadID); err == nil && tid != 0 {
			payload["message_thread_id"] = tid
		}
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", r.Token)
	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Connection error: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var resData map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&resData)

	c.JSON(http.StatusOK, resData)
}

// ─────────────────────────────────────────
func handleUpdateFormulaReport(c *gin.Context)    { c.JSON(200, gin.H{"status": "success"}) }
func handleClearCache(c *gin.Context)             { c.JSON(200, gin.H{"status": "success"}) }
func handleAdminUpdateProductTags(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }

func handleGetGlobalShippingCosts(c *gin.Context) {
	var results []struct {
		OrderID        string  `json:"Order ID"`
		Timestamp      string  `json:"Timestamp"`
		Team           string  `json:"Team"`
		InternalCost   float64 `json:"Internal Cost"`
		ShippingMethod string  `json:"Internal Shipping Method"`
	}

	err := backend.DB.Model(&Order{}).
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
	var req struct {
		UserName string                 `json:"userName"`
		NewData  map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData {
		if k == "Password" {
			continue
		}
		mappedData[mapToDBColumn(k, "Users")] = v
	}
	if err := backend.DB.Model(&User{}).Where("user_name = ?", req.UserName).Updates(mappedData).Error; err != nil {
		c.Error(err)
		return
	}

	// Broadcast profile change so all connected clients refresh their user list / avatar cache.
	profileEvent, _ := json.Marshal(map[string]interface{}{
		"type":       "update_sheet",
		"sheetName":  "Users",
		"primaryKey": map[string]string{"UserName": req.UserName},
		"newData":    req.NewData,
	})
	hub.Broadcast <- profileEvent

	go func() {
		if appsScriptURL != "" {
			// Sync with Google Sheets via managed queue
			enqueueSync("updateSheet", req.NewData, "Users", map[string]string{"UserName": req.UserName})
		}
	}()

	c.JSON(200, gin.H{"status": "success"})
}

func handleChangePassword(c *gin.Context) {
	var req struct {
		UserName    string `json:"userName"`
		NewPassword string `json:"newPassword"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "មិនអាចកំណត់លេខសម្ងាត់ថ្មីបានទេ"})
		return
	}
	if err := backend.DB.Model(&User{}).Where("user_name = ?", req.UserName).Update("password", string(hashedPassword)).Error; err != nil {
		c.Error(err)
		return
	}

	go func() {
		if appsScriptURL != "" {
			enqueueSync("updateSheet", map[string]interface{}{"PasswordChanged": true}, "Users", map[string]string{"UserName": req.UserName})
		}
	}()

	c.JSON(200, gin.H{"status": "success"})
}
func handleGetChatMessages(c *gin.Context) {
	limitParam := c.Query("limit")
	receiverParam := c.Query("receiver")
	currentUser, _ := c.Get("userName")
	var messages []ChatMessage
	query := backend.DB.Order("timestamp desc")
	if receiverParam != "" {
		query = query.Where("(user_name = ? AND receiver = ?) OR (user_name = ? AND receiver = ?)", currentUser, receiverParam, receiverParam, currentUser)
	} else {
		query = query.Where("receiver = ?", "")
	}
	limit, _ := strconv.Atoi(limitParam)
	if limit <= 0 {
		limit = 100
	}
	query.Limit(limit).Find(&messages)
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}
	c.JSON(200, gin.H{"status": "success", "data": messages})
}

func handleGetSingleChatMessage(c *gin.Context) {
	id := c.Param("id")
	var msg ChatMessage
	if err := backend.DB.Where("id = ?", id).First(&msg).Error; err != nil {
		c.JSON(404, gin.H{"error": "message not found"})
		return
	}
	c.JSON(200, gin.H{"status": "success", "data": msg})
}

func handleSendChatMessage(c *gin.Context) {
	var msg ChatMessage
	if err := c.ShouldBindJSON(&msg); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "Invalid format"})
		return
	}
	if sender, exists := c.Get("userName"); exists {
		msg.Sender = sender.(string)
	}
	msg.Timestamp = time.Now().Format(time.RFC3339)

	msgType := strings.ToLower(msg.Type)

	var base64Data string
	if msgType == "audio" || msgType == "image" {
		base64Data = msg.Message
	}

	if (msgType == "audio" || msgType == "image") && msg.FileURL == "" && len(base64Data) > 100 {
		mimeType := "application/octet-stream"
		if strings.Contains(base64Data, "data:") && strings.Contains(base64Data, ";base64,") {
			parts := strings.Split(base64Data, ";base64,")
			mimeType = strings.TrimPrefix(parts[0], "data:")
			base64Data = parts[1]
		}

		// Upload to Drive synchronously
		driveURL, fileId, err := backend.UploadToGoogleDriveDirectly(base64Data, "chat_file", mimeType, nil)
		if err != nil {
			log.Printf("❌ Chat media upload failed: %v", err)
			c.JSON(500, gin.H{"status": "error", "message": "បរាជ័យក្នុងការ Upload មេឌៀ"})
			return
		}

		msg.FileURL = fileId
		if msgType == "image" {
			msg.Message = driveURL
		}

		backend.DB.Create(&msg)
		msgBytes, _ := json.Marshal(map[string]interface{}{"type": "new_message", "data": msg})
		hub.Broadcast <- msgBytes

		c.JSON(200, gin.H{"status": "success", "data": msg})
		return
	}

	backend.DB.Create(&msg)
	msgBytes, _ := json.Marshal(map[string]interface{}{"type": "new_message", "data": msg})
	hub.Broadcast <- msgBytes
	c.JSON(200, gin.H{"status": "success", "data": msg})
}

func handleDeleteChatMessage(c *gin.Context) {
	var req struct {
		ID       uint   `json:"id"`
		UserName string `json:"userName"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	var msg ChatMessage
	if err := backend.DB.First(&msg, req.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "រកមិនឃើញសារ"})
		return
	}

	currentUser, _ := c.Get("userName")
	isSystemAdmin, _ := c.Get("isSystemAdmin")
	if msg.Sender != currentUser.(string) && (isSystemAdmin == nil || !isSystemAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "គ្មានសិទ្ធិលុបសារនេះទេ"})
		return
	}

	if err := backend.DB.Delete(&msg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ការលុបសារបរាជ័យ"})
		return
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type": "delete_message",
		"id":   req.ID,
	})
	hub.Broadcast <- eventBytes

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func handleGetOrderMetadata(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Missing Order ID"})
		return
	}

	var order Order
	// Case-insensitive search for order_id
	if err := backend.DB.Where("UPPER(TRIM(order_id)) = UPPER(TRIM(?))", orderID).First(&order).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Order not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Database error"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": order})
}

// =========================================================================
// GOOGLE SHEETS WEBHOOK (Real-time Sync Sheet -> backend.DB)
// =========================================================================

func handleSheetsWebhook(c *gin.Context) {
	var req struct {
		Secret    string                 `json:"secret"`
		SheetName string                 `json:"sheetName"`
		RowData   map[string]interface{} `json:"rowData"`
		Action    string                 `json:"action"` // "update" or "delete"
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"status": "error", "message": "Invalid format"})
		return
	}

	if subtle.ConstantTimeCompare([]byte(req.Secret), []byte(appsScriptSecret)) != 1 {
		c.JSON(401, gin.H{"status": "error", "message": "Unauthorized"})
		return
	}

	tableName := getTableName(req.SheetName)
	if tableName == "" {
		c.JSON(400, gin.H{"status": "error", "message": "Unknown sheet"})
		return
	}

	mappedData := make(map[string]interface{})
	var pkCol string
	var pkVal interface{}

	// Identify Primary Key based on SheetName
	pkName := "ID"
	if req.SheetName == "Users" {
		pkName = "UserName"
	} else if req.SheetName == "Stores" {
		pkName = "StoreName"
	} else if req.SheetName == "Settings" {
		pkName = "Key"
	} else if req.SheetName == "Products" {
		pkName = "Barcode"
	} else if req.SheetName == "ShippingMethods" {
		pkName = "MethodName"
	} else if req.SheetName == "DeliveryGroups" {
		pkName = "ID"
	} else if req.SheetName == "Colors" {
		pkName = "ColorName"
	} else if req.SheetName == "Drivers" {
		pkName = "DriverName"
	} else if req.SheetName == "BankAccounts" {
		pkName = "BankName"
	} else if req.SheetName == "PhoneCarriers" {
		pkName = "CarrierName"
	} else if req.SheetName == "StockTransfers" {
		pkName = "TransferID"
	} else if req.SheetName == "Returns" {
		pkName = "ReturnID"
	} else if req.SheetName == "TelegramTemplates" {
		pkName = "ID"
	} else if req.SheetName == "AllOrders" || strings.HasPrefix(req.SheetName, "Orders_") {
		pkName = "Order ID"
	} else {
		// Default to "id" (lowercase) for Roles, Permissions, Incentive, etc.
		// if "ID" (uppercase) doesn't find a match in RowData.
		if _, exists := req.RowData["ID"]; !exists {
			if _, lowerExists := req.RowData["id"]; lowerExists {
				pkName = "id"
			}
		}
	}

	for k, v := range req.RowData {
		dbCol := mapToDBColumn(k, "AllOrders")

		normalizedK := strings.ReplaceAll(strings.ToLower(k), " ", "")
		normalizedPK := strings.ReplaceAll(strings.ToLower(pkName), " ", "")

		if normalizedK == normalizedPK {
			pkCol = dbCol
			pkVal = v
			continue
		}

		// Skip empty or nil values to avoid overwriting with blanks
		if v == nil || v == "" {
			continue
		}

		// Handle Numeric fields
		if backend.IsNumericHeader(k) {
			if s, ok := v.(string); ok {
				if f, err := strconv.ParseFloat(s, 64); err == nil {
					mappedData[dbCol] = f
				}
			} else {
				mappedData[dbCol] = v
			}
		} else if backend.IsBoolHeader(k) {
			if s, ok := v.(string); ok {
				mappedData[dbCol] = strings.ToUpper(s) == "TRUE"
			} else {
				mappedData[dbCol] = v
			}
		} else {
			mappedData[dbCol] = fmt.Sprintf("%v", v)
		}
	}

	// --- Status Protection (State Machine Safeguard) ---
	if tableName == "orders" {
		if newStatusRaw, hasNewStatus := mappedData["fulfillment_status"]; hasNewStatus {
			newStatus := fmt.Sprintf("%v", newStatusRaw)

			var currentOrder Order
			// Using TRIM and UPPER for robust matching
			whereClause := fmt.Sprintf("UPPER(TRIM(%s)) = UPPER(TRIM(?))", pkCol)
			if err := backend.DB.Where(whereClause, pkVal).Select("fulfillment_status").First(&currentOrder).Error; err == nil {
				cur := strings.TrimSpace(currentOrder.FulfillmentStatus)
				if cur == "" {
					cur = "Pending"
				}

				statusWeight := map[string]int{
					"Pending":       1,
					"Processing":    2,
					"Ready to Ship": 3,
					"Shipped":       4,
					"Delivered":     5,
					"Cancelled":     0,
				}

				// If we are already at "Ready to Ship" or further, don't let it revert to "Pending"
				if statusWeight[cur] >= 3 && statusWeight[newStatus] < 3 && newStatus != "Cancelled" {
					log.Printf("🛡️  [Webhook Protection] BLOCKED REVERT for Order %v: Current='%s' -> Incoming='%s' (preventing stale sheet data overwrite)", pkVal, cur, newStatus)
					delete(mappedData, "fulfillment_status") // Remove status from update map
				} else {
					log.Printf("✅ [Webhook Sync] Allowed status change for Order %v: '%s' -> '%s'", pkVal, cur, newStatus)
				}
			} else if err != nil {
				log.Printf("⚠️  [Webhook Sync] Error checking current status for Order %v: %v", pkVal, err)
			}
		}

		// --- Fulfillment Data Protection (Crucial for preventing race conditions) ---
		// We protect these fields from being cleared (made empty) by stale sheet webhooks.
		protectedFields := []string{
			"package_photo_url", "delivery_photo_url",
			"packed_by", "packed_time",
			"driver_name", "tracking_number",
			"dispatched_by", "dispatched_time",
			"delivered_time",
		}

		var existingOrder Order
		hasFetchedExisting := false

		for _, field := range protectedFields {
			if incomingVal, hasVal := mappedData[field]; hasVal {
				incomingStr := strings.TrimSpace(fmt.Sprintf("%v", incomingVal))

				// If incoming data is empty, check if we already have data in DB
				if incomingStr == "" || incomingStr == "<nil>" || incomingStr == "undefined" {
					if !hasFetchedExisting {
						whereClause := fmt.Sprintf("UPPER(TRIM(%s)) = UPPER(TRIM(?))", pkCol)
						backend.DB.Where(whereClause, pkVal).First(&existingOrder)
						hasFetchedExisting = true
					}

					// Get existing value for this field
					existingStr := ""
					switch field {
					case "package_photo_url":
						existingStr = existingOrder.PackagePhotoURL
					case "delivery_photo_url":
						existingStr = existingOrder.DeliveryPhotoURL
					case "packed_by":
						existingStr = existingOrder.PackedBy
					case "packed_time":
						existingStr = existingOrder.PackedTime
					case "driver_name":
						existingStr = existingOrder.DriverName
					case "tracking_number":
						existingStr = existingOrder.TrackingNumber
					case "dispatched_by":
						existingStr = existingOrder.DispatchedBy
					case "dispatched_time":
						existingStr = existingOrder.DispatchedTime
					case "delivered_time":
						existingStr = existingOrder.DeliveredTime
					}

					if existingStr != "" {
						log.Printf("🛡️  [Webhook Protection] REJECTED clearing of %s for Order %v (stale sheet update)", field, pkVal)
						delete(mappedData, field) // Don't let sheet clear existing data
					}
				}
			}
		}
	}

	if pkCol == "" || pkVal == nil {
		c.JSON(400, gin.H{"status": "error", "message": "Missing primary key"})
		return
	}

	if req.Action == "delete" {
		whereClause := fmt.Sprintf("UPPER(TRIM(%s)) = UPPER(TRIM(?))", pkCol)
		backend.DB.Table(tableName).Where(whereClause, pkVal).Delete(nil)
	} else {
		// UPSERT logic: Try to update first
		whereClause := fmt.Sprintf("UPPER(TRIM(%s)) = UPPER(TRIM(?))", pkCol)
		result := backend.DB.Table(tableName).Where(whereClause, pkVal).Updates(mappedData)
		if result.Error != nil {
			c.JSON(500, gin.H{"status": "error", "message": result.Error.Error()})
			return
		}

		// If no rows were updated, it's likely a new record. Attempt to Create.
		if result.RowsAffected == 0 {
			// Ensure PK is in mappedData for creation
			mappedData[pkCol] = pkVal
			if err := backend.DB.Table(tableName).Create(mappedData).Error; err != nil {
				// Log but don't fail, as it might have been created by another process/worker
				log.Printf("⚠️ SyncManager: Upsert/Create failed for %s PK %v: %v", tableName, pkVal, err)
			}
		}
	}

	// Broadcast update to all connected clients
	event, _ := json.Marshal(map[string]interface{}{
		"type":      "sheet_webhook_sync",
		"sheetName": req.SheetName,
		"action":    req.Action,
		"pk":        pkVal,
	})
	hub.Broadcast <- event

	// --- NEW: Trigger Telegram Update (if Sheet Edit for an Order) ---
	if tableName == "orders" && req.Action == "update" && pkVal != nil {
		go func(orderId interface{}, sheetName string, rowData map[string]interface{}) {
			// Apps Script re-fetches from the sheet, so we just need Order ID and Team.
			// 1. Try to get team from rowData
			team := ""
			if t, exists := rowData["Team"]; exists {
				team = fmt.Sprintf("%v", t)
			} else if strings.HasPrefix(sheetName, "Orders_") {
				team = strings.TrimPrefix(sheetName, "Orders_")
			}

			// 2. If team is still empty, fetch from backend.DB
			if team == "" {
				var order Order
				whereClause := fmt.Sprintf("UPPER(TRIM(%s)) = UPPER(TRIM(?))", pkCol)
				if err := backend.DB.Where(whereClause, orderId).Select("team").First(&order).Error; err == nil {
					team = order.Team
				}
			}

			if team != "" {
				log.Printf("📢 [Webhook Sync] Triggering Telegram Edit for Order %v (Team: %s)", orderId, team)

				// Prepare updatedFields from rowData to pass along (Apps Script uses this to UpdateSheets first)
				updatedFields := make(map[string]interface{})
				for k, v := range rowData {
					updatedFields[k] = v
				}

				enqueueSync("updateOrderTelegram", map[string]interface{}{
					"orderId":       fmt.Sprintf("%v", orderId),
					"team":          team,
					"updatedFields": updatedFields,
				}, "", nil)
			}
		}(pkVal, req.SheetName, req.RowData)
	}

	c.JSON(200, gin.H{"status": "success"})
}

var startTime time.Time

func main() {
	startTime = time.Now()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	backend.SpreadsheetID = os.Getenv("GOOGLE_SHEET_ID")
	appsScriptURL = os.Getenv("APPS_SCRIPT_URL")
	appsScriptSecret = os.Getenv("APPS_SCRIPT_SECRET")
	backend.AppsScriptURL = appsScriptURL
	backend.AppsScriptSecret = appsScriptSecret

	// ── Wire Video-package injectable dependencies ──────────────────────────
	backend.VideoFetchSheetFunc = backend.FetchSheetDataToStruct
	backend.VideoGenerateIDFunc = generateShortID
	backend.VideoExtractFileIDFunc = backend.ExtractFileIDFromURL

	// ── Wire Upload-package injectable dependencies ──────────────────────────
	backend.UploadGenerateIDFunc = generateShortID
	backend.UploadGenerateTokenFunc = generateUploadTokenInternal // Inject this
	backend.UploadMapToDBColumnFunc = func(k string) string { return mapToDBColumn(k, "") }
	backend.UploadGetTableNameFunc = getTableName
	backend.UploadIsValidOrderColumnFunc = isValidOrderColumn

	// Pre-initialize UploadFolderID from environment for immediate use
	backend.UploadFolderID = os.Getenv("UPLOAD_FOLDER_ID")

	jwtSecretEnv := os.Getenv("JWT_SECRET")
	if jwtSecretEnv == "" {
		jwtSecretEnv = "change-me-in-production"
	}
	backend.JwtSecret = []byte(jwtSecretEnv)

	hub = NewHub()
	backend.HubGlobal = hub
	go hub.Run()

	r := gin.Default()
	r.Use(cors.New(buildCORSConfig()))
	r.Use(gzip.Gzip(gzip.DefaultCompression))
	r.Use(ErrorHandlingMiddleware())

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "message": "pong"})
	})

	// Apply DBMiddleware to all /api routes except root health checks
	api := r.Group("/api", DBMiddleware())
	api.POST("/login", handleLogin)
	api.GET("/settings", handleGetSettings)
	// ── Entertainment / Video Player routes (Backend/video.go) ────────────────────────
	// All video handler logic lives in Backend/video.go (package backend).
	// We call RegisterVideoRoutes to set up both public and admin routes.
	// We pass the public group (api) and the admin group (admin) which already has AdminOnlyMiddleware.
	// But admin group is defined inside protected block, so we'll call it there.
	api.POST("/webhook/sheets-sync", handleSheetsWebhook)
	api.GET("/order-metadata/:id", handleGetOrderMetadata)
	api.POST("/telegram/webhook/:token", handleTelegramWebhook)
	api.GET("/internal/verify-upload-token", handleVerifyUploadToken) // New for Apps Script
	api.GET("/products", handleGetProductsOnly)                       // Read-only Product API for Developers

	protected := api.Group("/")
	protected.Use(AuthMiddleware())
	{
		protected.GET("/r2-proxy", backend.HandleR2Proxy) // Secure proxy for R2 images
		protected.POST("/setup-bot-webhook", handleRegisterTelegramWebhook)
		protected.POST("/test-telegram", handleTestTelegram)
		protected.GET("/users", handleGetUsers)
		protected.GET("/static-data", handleGetStaticData)
		protected.POST("/submit-order", RequirePermission("create_order"), handleSubmitOrder)
		protected.GET("/generate-upload-token", handleGenerateUploadToken) // New for Admin
		protected.POST("/upload-image", backend.HandleImageUploadProxy)
		protected.GET("/proxy-image", backend.HandleProxyImage)
		protected.GET("/permissions", handleGetUserPermissions)
		protected.GET("/roles", handleGetRoles)

		// Promotions
		protected.GET("/promotions", handleGetPromotions)
		protected.POST("/promotions", RequirePermission("manage_promotions"), handleCreatePromotion)
		protected.PUT("/promotions/:id", RequirePermission("manage_promotions"), handleUpdatePromotion)
		protected.DELETE("/promotions/:id", RequirePermission("manage_promotions"), handleDeletePromotion)

		protected.GET("/teams/shipping-costs", RequirePermission("view_revenue"), handleGetGlobalShippingCosts)

		chat := protected.Group("/chat")
		chat.GET("/messages", handleGetChatMessages)
		chat.GET("/message/:id", handleGetSingleChatMessage)
		chat.POST("/send", handleSendChatMessage)
		chat.POST("/delete", handleDeleteChatMessage)

		// ── Admin Group ──
		adminGroup := protected.Group("/admin")
		{
			// Order Management (Accessible by anyone with permission, e.g. Packers/Admins)
			adminGroup.GET("/orders", RequirePermission("view_order_list"), handleGetAllOrders)
			adminGroup.GET("/all-orders", RequirePermission("view_order_list"), handleGetAllOrders)
			adminGroup.POST("/update-order", RequirePermission("edit_order"), handleAdminUpdateOrder)
			adminGroup.POST("/send-delivery-telegram", RequirePermission("edit_order"), handleSendDeliveryTelegram)
			adminGroup.POST("/delete-delivery-telegram", RequirePermission("edit_order"), handleDeleteDeliveryTelegram)

			// ── Shift Management Routes ──
			adminGroup.GET("/shifts/active/:storeName", handleGetActiveShift)
			adminGroup.POST("/shifts/open", handleOpenShift)
			adminGroup.POST("/shifts/close", handleCloseShift)

			// Restricted Admin Actions (Require Admin role)
			restricted := adminGroup.Group("/")
			restricted.Use(AdminOnlyMiddleware())
			{
				// Video/Movie admin routes from backend package
				backend.RegisterVideoRoutes(api, restricted)

				restricted.POST("/migrate-data", backend.HandleMigrateData)
				restricted.GET("/revenue-summary", handleGetRevenueSummary)
				restricted.GET("/sync-status", handleGetSyncStatus)
				restricted.GET("/sync-queue", handleGetSyncQueue)
				restricted.POST("/sync-retry/:id", handleRetrySyncTask)
				restricted.POST("/sync-retry-all", handleRetryAllFailedSyncTasks)
				restricted.DELETE("/sync-clear-failed", handleClearFailedSyncTasks)
				restricted.GET("/health-check", handleHealthCheck)
				restricted.POST("/update-sheet", handleAdminUpdateSheet)
				restricted.POST("/add-row", handleAdminAddRow)
				restricted.POST("/delete-row", handleAdminDeleteRow)
				restricted.POST("/delete-order", RequirePermission("delete_order"), handleAdminDeleteOrder)
				restricted.GET("/permissions", handleGetAllPermissions)
				restricted.POST("/permissions", handleUpdatePermission)
				restricted.POST("/permissions/sync-sheet", handleSyncPermissionsToSheet)
				restricted.POST("/permissions/reset", handleResetPermissions)
				restricted.POST("/roles", handleCreateRole)
				restricted.GET("/incentive/calculators", handleGetIncentiveCalculators)
				restricted.POST("/incentive/calculators", handleCreateIncentiveCalculator)
				restricted.GET("/incentive/projects", handleGetIncentiveProjects)
				restricted.POST("/incentive/projects", handleCreateIncentiveProject)
				restricted.GET("/incentive/results", handleGetIncentiveResults)
				restricted.POST("/incentive/calculate", handleCalculateIncentive)
				restricted.GET("/incentive/manual-data", handleGetIncentiveManualData)
				restricted.POST("/incentive/manual-data", handleSaveIncentiveManualData)
				restricted.GET("/incentive/custom-payout", handleGetIncentiveCustomPayouts)
				restricted.POST("/incentive/custom-payout", handleSaveIncentiveCustomPayout)
				restricted.POST("/incentive/lock", handleLockIncentivePayout)
			}
		}
		profile := protected.Group("/profile")
		profile.POST("/update", handleUpdateProfile)
		profile.POST("/change-password", handleChangePassword)
	}
	api.GET("/chat/ws", AuthMiddleware(), serveWs)
	api.GET("/chat/audio/:fileID", backend.HandleGetAudioProxy)
	go initializeDatabaseAndWorkers()
	r.Run("0.0.0.0:" + port)
}

func initializeDatabaseAndWorkers() {
	initDB()

	startSyncManager(2)
	go startOrderWorker()
	startScheduler()
	backend.CreateGoogleAPIClient(context.Background())

	var userCount int64
	if err := backend.DB.Model(&User{}).Count(&userCount).Error; err == nil && userCount == 0 {
		log.Println("Empty database detected. Starting automatic data migration...")
		backend.PerformDataMigration()
	} else if os.Getenv("AUTO_MIGRATE") == "true" {
		log.Println("🚀 Starting forced automatic data migration on startup...")
		backend.PerformDataMigration()
	} else {
		log.Println("ℹ️ Automatic migration skipped (DB not empty). Set AUTO_MIGRATE=true if you want to wipe and re-sync.")
	}
}

// ── Shift Management Handlers ──────────────────────────────────────────────

func handleGetActiveShift(c *gin.Context) {
	storeName := c.Param("storeName")
	var shift backend.Shift
	if err := backend.DB.Where("store_name = ? AND status = 'Open'", storeName).First(&shift).Error; err != nil {
		c.JSON(200, gin.H{"status": "none"})
		return
	}
	c.JSON(200, gin.H{"status": "success", "shift": shift})
}

func handleOpenShift(c *gin.Context) {
	var r struct {
		UserName  string `json:"userName"`
		Password  string `json:"password"`
		StoreName string `json:"storeName"`
		Photo     string `json:"photo"` // base64
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	// 1. Verify User
	var user User
	if err := backend.DB.Where("user_name = ?", strings.TrimSpace(r.UserName)).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "អ្នកប្រើប្រាស់មិនត្រឹមត្រូវ"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(strings.TrimSpace(r.Password))); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "លេខសម្ងាត់មិនត្រឹមត្រូវ"})
		return
	}

	// Check if already has an open shift for this store
	var existingShift backend.Shift
	if err := backend.DB.Where("store_name = ? AND status = 'Open'", r.StoreName).First(&existingShift).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ឃ្លាំងនេះត្រូវបានបើកវេនរួចហើយដោយ " + existingShift.OpenedBy})
		return
	}

	// 2. Upload Photo
	photoURL := ""
	if r.Photo != "" {
		url, _, err := backend.UploadToGoogleDriveDirectly(r.Photo, "shift_open_"+r.StoreName, "image/jpeg", nil)
		if err == nil {
			photoURL = url
		} else {
			log.Printf("❌ [handleOpenShift] Photo upload failed: %v", err)
		}
	}

	// 3. Save Shift
	shift := backend.Shift{
		StoreName: r.StoreName,
		OpenedBy:  user.FullName,
		OpenedAt:  time.Now(),
		OpenPhoto: photoURL,
		Status:    "Open",
	}
	if err := backend.DB.Create(&shift).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "មិនអាចបើកវេនបានទេ"})
		return
	}

	// 4. Telegram Notification
	go sendShiftTelegramNotification(r.StoreName, "Open", user.FullName, photoURL, "", user.TelegramStickerID)

	// 5. Sync to Google Sheets
	backend.EnqueueSync("addRow", map[string]interface{}{
		"ID":        shift.ID,
		"StoreName": shift.StoreName,
		"OpenedBy":  shift.OpenedBy,
		"OpenedAt":  shift.OpenedAt.Format("2006-01-02 15:04:05"),
		"OpenPhoto": shift.OpenPhoto,
		"Status":    shift.Status,
	}, "Shifts", nil)

	c.JSON(http.StatusOK, gin.H{"status": "success", "shift": shift})
}

func handleCloseShift(c *gin.Context) {
	var r struct {
		ShiftID uint   `json:"shiftId"`
		Summary string `json:"summary"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ"})
		return
	}

	var shift backend.Shift
	if err := backend.DB.First(&shift, r.ShiftID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "រកមិនឃើញវេនដែលត្រូវបិទ"})
		return
	}

	if shift.Status == "Closed" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "វេននេះត្រូវបានបិទរួចហើយ"})
		return
	}

	now := time.Now()
	shift.Status = "Closed"
	shift.ClosedAt = &now
	shift.ClosedBy = shift.OpenedBy // The one who opened it is the one who closes it usually, or current user?
	// User specified "គណនីដែលគាត់ជាអ្នកបើកវេនគឺគាត់ នឹងឃើញមានមុខងារ បិទវេន"

	shift.SummaryJSON = r.Summary

	if err := backend.DB.Save(&shift).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "មិនអាចបិទវេនបានទេ"})
		return
	}

	// Query orders that are 'Packed' but not yet 'Dispatched' for this store
	var pendingOrders []Order
	backend.DB.Where("fulfillment_store = ? AND fulfillment_status = ?", shift.StoreName, "Packed").
		Order("timestamp ASC").Find(&pendingOrders)

	pendingSummary := ""
	if len(pendingOrders) > 0 {
		pendingSummary = "\n\n⚠️ *បញ្ជីអីវ៉ាន់មិនទាន់បញ្ជូនចេញ (Packed but not Dispatched):*"
		for i, o := range pendingOrders {
			phone := o.CustomerPhone
			if phone == "" {
				phone = "N/A"
			}
			if !strings.HasPrefix(phone, "0") && phone != "N/A" && len(phone) >= 8 {
				phone = "0" + phone
			}

			pendingSummary += fmt.Sprintf("\n%d. 📱 %s | 🆔 `%s` | 📍 %s | 👥 %s",
				i+1, phone, o.OrderID, o.Location, o.Team)
		}
	}

	// Telegram Notification
	go sendShiftTelegramNotification(shift.StoreName, "Close", shift.OpenedBy, "", r.Summary+pendingSummary, "")

	// Sync to Google Sheets (Update the existing row)
	backend.EnqueueSync("updateSheet", map[string]interface{}{
		"ClosedBy":    shift.ClosedBy,
		"ClosedAt":    shift.ClosedAt.Format("2006-01-02 15:04:05"),
		"Status":      shift.Status,
		"SummaryJSON": shift.SummaryJSON,
	}, "Shifts", map[string]string{"ID": fmt.Sprintf("%v", shift.ID)})

	c.JSON(http.StatusOK, gin.H{"status": "success", "shift": shift})
}

func convertDriveURLToDirect(url string) string {
	id := backend.ExtractFileIDFromURL(url)
	if id != "" {
		// Use thumbnail link with high resolution (sz=w1000)
		// This is more reliable for Telegram's photo fetcher than the uc?export link
		return fmt.Sprintf("https://drive.google.com/thumbnail?id=%s&sz=w1000", id)
	}
	return url
}

func extractMapLink(text string) string {
	if text == "" {
		return ""
	}
	// Supports standard google.com/maps, maps.app.goo.gl, and goo.gl/maps formats.
	re := regexp.MustCompile(`(?i)https?://(?:www\.)?(?:google\.com/maps|maps\.app\.goo\.gl|goo\.gl/maps)/[^\s"']+`)
	match := re.FindString(text)
	return match
}

var (
	deliveryMutexMap = make(map[string]*sync.Mutex)
	deliveryMapLock  sync.Mutex
)

func getDeliveryMutex(storeName, method string) *sync.Mutex {
	deliveryMapLock.Lock()
	defer deliveryMapLock.Unlock()
	key := storeName + ":" + method
	if m, ok := deliveryMutexMap[key]; ok {
		return m
	}
	m := &sync.Mutex{}
	deliveryMutexMap[key] = m
	return m
}

func handleSendDeliveryTelegram(c *gin.Context) {
	var r struct {
		OrderID string `json:"orderId"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	// 1. Fetch Order and Base Info (Read-only)
	var order Order
	if err := backend.DB.Where("order_id = ?", r.OrderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Order not found"})
		return
	}

	if order.FulfillmentStore == "" || order.InternalShippingMethod == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Order missing store or shipping method"})
		return
	}

	// 2. Acquire Lock for this specific Store+Method to ensure sequential processing
	mu := getDeliveryMutex(order.FulfillmentStore, order.InternalShippingMethod)
	mu.Lock()
	defer mu.Unlock()

	// 3. Re-fetch order within lock to get latest sequence if already processed
	if err := backend.DB.Where("order_id = ?", r.OrderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Order re-fetch failed"})
		return
	}

	var store Store
	if err := backend.DB.Where("store_name = ?", order.FulfillmentStore).First(&store).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Store not found"})
		return
	}

	var delGroup DeliveryGroup
	if err := backend.DB.Where("store_name = ? AND shipping_method = ?", order.FulfillmentStore, order.InternalShippingMethod).First(&delGroup).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Telegram group not defined"})
		return
	}

	if store.TelegramBotToken == "" || delGroup.TelegramGroupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Telegram settings missing"})
		return
	}

	if order.PackagePhotoURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "No package photo found"})
		return
	}

	// 4. Atomic Sequence Generation
	ict := time.FixedZone("ICT", 7*3600)
	todayStr := time.Now().In(ict).Format("2006-01-02")
	var dailySeq int

	if order.DeliveryDailySequence > 0 && order.DeliveryTelegramDate == todayStr {
		dailySeq = order.DeliveryDailySequence
	} else {
		// Use transaction to ensure absolute uniqueness
		txErr := backend.DB.Transaction(func(tx *gorm.DB) error {
			var count int64
			if err := tx.Model(&Order{}).
				Where("fulfillment_store = ? AND internal_shipping_method = ? AND delivery_telegram_date = ? AND delivery_daily_sequence > 0",
					order.FulfillmentStore, order.InternalShippingMethod, todayStr).
				Count(&count).Error; err != nil {
				return err
			}
			dailySeq = int(count) + 1

			// Mark sequence immediately to prevent others from taking it
			return tx.Model(&Order{}).Where("order_id = ?", order.OrderID).Updates(map[string]interface{}{
				"delivery_daily_sequence": dailySeq,
				"delivery_telegram_date":  todayStr,
			}).Error
		})
		if txErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Sequence generation failed"})
			return
		}
	}

	// Prepare message details
	phoneNumber := strings.TrimSpace(order.CustomerPhone)
	if phoneNumber == "" {
		phoneNumber = "N/A"
	} else if !strings.HasPrefix(phoneNumber, "0") && len(phoneNumber) >= 8 {
		phoneNumber = "0" + phoneNumber
	}
	location := order.Location
	if location == "" {
		location = "N/A"
	}
	address := order.AddressDetails
	if address == "" {
		address = "N/A"
	}

	// Prepare message
	text := fmt.Sprintf("📦 *រូបភាពកញ្ចប់បញ្ញើ #%d*\n🏷️ លេខកូដ: `%s`",
		dailySeq, order.OrderID)

	text += fmt.Sprintf("\n\n📱 លេខទូរស័ព្ទ: %s", phoneNumber)
	text += fmt.Sprintf("\n📍 ទីតាំង: *%s*", location)
	text += fmt.Sprintf("\n🏠 អាស័យដ្ឋាន: _%s_", address)

	// Build inline keyboard
	var inlineKeyboard [][]map[string]interface{}

	// 1. Map Link Button (Top Priority)
	mapLink := extractMapLink(order.Location + " " + order.AddressDetails + " " + order.Note)
	if mapLink != "" {
		inlineKeyboard = append(inlineKeyboard, []map[string]interface{}{
			{"text": "📍 បើក Google Map", "url": mapLink},
		})
	}

	// 2. Contact Customer Button
	if phoneNumber != "N/A" {
		re := regexp.MustCompile(`\D`)
		cleanPhone := re.ReplaceAllString(phoneNumber, "")
		cleanPhone = strings.TrimPrefix(cleanPhone, "0")
		if cleanPhone != "" {
			inlineKeyboard = append(inlineKeyboard, []map[string]interface{}{
				{"text": "💬 ទាក់ទងអតិថិជន", "url": "https://t.me/+855" + cleanPhone},
			})
		}
	}

	// 3. Pick Up Button (Action Button)
	inlineKeyboard = append(inlineKeyboard, []map[string]interface{}{
		{"text": "✅ បាន Pick Up", "callback_data": "pickup_" + order.OrderID},
	})

	var replyMarkup map[string]interface{}
	if len(inlineKeyboard) > 0 {
		replyMarkup = map[string]interface{}{
			"inline_keyboard": inlineKeyboard,
		}
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendPhoto", store.TelegramBotToken)
	chatID := strings.TrimSpace(delGroup.TelegramGroupID)
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"parse_mode": "Markdown",
		"photo":      convertDriveURLToDirect(order.PackagePhotoURL),
		"caption":    text,
	}

	if replyMarkup != nil {
		payload["reply_markup"] = replyMarkup
	}

	if delGroup.TelegramTopicID != "" {
		topicID := strings.TrimSpace(delGroup.TelegramTopicID)
		if threadID, err := strconv.Atoi(topicID); err == nil && threadID != 0 {
			payload["message_thread_id"] = threadID
		}
	}

	jsonData, _ := json.Marshal(payload)
	log.Printf("📤 [Telegram Delivery] Sending photo for order %s to chat %v (thread: %v)", order.OrderID, payload["chat_id"], payload["message_thread_id"])

	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("❌ [Telegram Delivery] HTTP Error for order %s, chat %v: %v", order.OrderID, chatID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to call Telegram API: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var resData map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&resData); err != nil {
		log.Printf("❌ [Telegram Delivery] Decode Error for order %s: %v", order.OrderID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to decode Telegram response"})
		return
	}

	if ok, _ := resData["ok"].(bool); !ok {
		log.Printf("❌ [Telegram Delivery] API Error for order %s, chat %v: %v", order.OrderID, chatID, resData)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Telegram API error", "details": resData})
		return
	}

	// Capture the message ID from the response
	var messageID string
	if result, ok := resData["result"].(map[string]interface{}); ok {
		if msgID, ok := result["message_id"].(float64); ok {
			messageID = fmt.Sprintf("%.0f", msgID)
		}
	}

	log.Printf("✅ [Telegram Delivery] Photo sent for order %s, Message ID: %s, Daily Seq: %d", order.OrderID, messageID, dailySeq)

	// Update counter and message ID in database
	newCount := order.DeliveryPhotoSentCount + 1
	if err := backend.DB.Model(&order).Updates(map[string]interface{}{
		"delivery_photo_sent_count":    newCount,
		"delivery_telegram_message_id": messageID,
		"delivery_daily_sequence":      dailySeq,
		"delivery_telegram_date":       todayStr,
	}).Error; err != nil {
		log.Printf("❌ [Telegram Delivery] DB Update Error: %v", err)
	}

	// Trigger Sheet Sync
	backend.EnqueueSync("updateSheet", map[string]interface{}{
		"Delivery Photo Sent Count":    newCount,
		"Delivery Telegram Message ID": messageID,
		"Delivery Daily Sequence":      dailySeq,
		"Delivery Telegram Date":       todayStr,
	}, "AllOrders", map[string]string{"Order ID": order.OrderID})

	// Trigger WebSocket Broadcast - Use the standard structure
	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type":    "update_order",
		"orderId": order.OrderID,
		"newData": map[string]interface{}{
			"Delivery Photo Sent Count":    newCount,
			"Delivery Telegram Message ID": messageID,
			"Delivery Daily Sequence":      dailySeq,
			"Delivery Telegram Date":       todayStr,
		},
	})
	hub.Broadcast <- eventBytes

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "បញ្ជូនរូបភាពកញ្ចប់ទៅ Telegram រួចរាល់!"})
}

func sendShiftTelegramNotification(storeName string, shiftType string, userName string, photoURL string, summary string, stickerID string) {
	var store Store
	if err := backend.DB.Where("store_name = ?", storeName).First(&store).Error; err != nil {
		log.Printf("❌ [Shift Notification] Store not found: %s", storeName)
		return
	}

	if store.TelegramBotToken == "" || store.TelegramGroupID == "" {
		log.Printf("⚠️ [Shift Notification] Telegram settings missing for store: %s", storeName)
		return
	}

	ict := time.FixedZone("ICT", 7*3600)
	now := time.Now().In(ict).Format("03:04 PM")
	var text string
	if shiftType == "Open" {
		text = fmt.Sprintf("👋 ជម្រាបសួរ! ខ្ញុំ %s (Store Assistant)\n\n📍 សាខា: *%s*\n🟢 បើកវេនម៉ោង %s", userName, storeName, now)
	} else {
		text = fmt.Sprintf("👋 ជម្រាបសួរ! ខ្ញុំ %s (Store Assistant)\n\n📍 សាខា: *%s*\n🔴 បិទវេនម៉ោង %s\n\n📊 %s", userName, storeName, now, summary)
	}

	apiURL := ""
	chatID := strings.TrimSpace(store.TelegramGroupID)
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"parse_mode": "Markdown",
	}
	if store.TelegramTopicID != "" {
		topicID := strings.TrimSpace(store.TelegramTopicID)
		if threadID, err := strconv.Atoi(topicID); err == nil && threadID != 0 {
			payload["message_thread_id"] = threadID
		}
	}

	// 1. Send Sticker first if it's an Open Shift and stickerID is provided
	if shiftType == "Open" && stickerID != "" {
		stickerURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendSticker", store.TelegramBotToken)
		stickerPayload := map[string]interface{}{
			"chat_id": chatID,
			"sticker": stickerID,
		}
		if payload["message_thread_id"] != nil {
			stickerPayload["message_thread_id"] = payload["message_thread_id"]
		}
		sData, _ := json.Marshal(stickerPayload)
		http.Post(stickerURL, "application/json", bytes.NewBuffer(sData))
	}

	// 2. Send the main notification (Photo or Text)
	if photoURL != "" && shiftType == "Open" {
		apiURL = fmt.Sprintf("https://api.telegram.org/bot%s/sendPhoto", store.TelegramBotToken)
		payload["photo"] = convertDriveURLToDirect(photoURL)
		payload["caption"] = text
	} else {
		apiURL = fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", store.TelegramBotToken)
		payload["text"] = text
	}

	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("❌ [Shift Notification] HTTP error for %s, chat %v: %v", storeName, chatID, err)
		return
	}
	defer resp.Body.Close()

	var resData map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&resData)
	if ok, _ := resData["ok"].(bool); !ok {
		log.Printf("❌ [Shift Notification] Telegram API error for %s, chat %v: %v", storeName, chatID, resData)
	} else {
		log.Printf("✅ [Shift Notification] Sent successfully for %s to chat %v", storeName, chatID)
	}
}

// AddWatermarkAndEditTelegramMedia modifies the message by adding a watermark to the photo
func AddWatermarkAndEditTelegramMedia(order Order, newStatus string) {
	if order.DeliveryTelegramMessageID == "" {
		return
	}

	if order.FulfillmentStore == "" {
		return
	}

	var store Store
	if err := backend.DB.Where("store_name = ?", order.FulfillmentStore).First(&store).Error; err != nil {
		return
	}

	if order.InternalShippingMethod == "" {
		return
	}

	var delGroup DeliveryGroup
	if err := backend.DB.Where("store_name = ? AND shipping_method = ?", order.FulfillmentStore, order.InternalShippingMethod).First(&delGroup).Error; err != nil {
		return
	}

	if store.TelegramBotToken == "" || delGroup.TelegramGroupID == "" {
		return
	}

	if order.PackagePhotoURL == "" {
		return
	}

	var statusIndicator string
	var watermarkText string
	var watermarkColor color.RGBA

	if newStatus == "Cancelled" {
		statusIndicator = "❌ *ការកម្មង់ត្រូវបានលុបចោល (CANCELLED)* ❌"
		watermarkText = "CANCELLED"
		watermarkColor = color.RGBA{255, 0, 0, 150} // Red with alpha
	} else if newStatus == "Returned" {
		statusIndicator = "🔄 *ការកម្មង់ត្រូវបានបញ្ជូនត្រលប់ (RETURNED)* 🔄"
		watermarkText = "RETURNED"
		watermarkColor = color.RGBA{128, 0, 128, 150} // Purple with alpha
	} else {
		return
	}

	// 1. Download the original photo
	photoURL := convertDriveURLToDirect(order.PackagePhotoURL)
	resp, err := http.Get(photoURL)
	if err != nil {
		log.Printf("❌ Failed to download package photo for watermarking: %v", err)
		return
	}
	defer resp.Body.Close()

	img, _, err := image.Decode(resp.Body)
	if err != nil {
		log.Printf("❌ Failed to decode package photo: %v", err)
		return
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	// 2. Draw the watermark
	dc := gg.NewContext(width, height)
	dc.DrawImage(img, 0, 0)

	// Set font size based on image width (e.g. width / 5)
	fontSize := float64(width) / 5.0
	if fontSize < 20 {
		fontSize = 20
	}

	fontLoaded := false
	fontPaths := []string{"Font/DOMEG.ttf", "../Font/DOMEG.ttf", "Font/DOMKH.ttf", "../Font/DOMKH.ttf"}
	for _, path := range fontPaths {
		if err := dc.LoadFontFace(path, fontSize); err == nil {
			fontLoaded = true
			break
		}
	}

	dc.SetColor(watermarkColor)
	dc.Rotate(gg.Radians(-30))
	if fontLoaded {
		dc.DrawStringAnchored(watermarkText, float64(width)/2.0, float64(height)/2.0, 0.5, 0.5)
	} else {
		// Fallback if no font loaded: draw a big rectangle and text using strokes (gg doesn't have internal fonts)
		// Or just draw a big X
		dc.SetLineWidth(fontSize / 2.0)
		dc.DrawLine(0, 0, float64(width), float64(height))
		dc.DrawLine(0, float64(height), float64(width), 0)
		dc.Stroke()
	}
	dc.Identity() // Reset transformations

	if fontLoaded {
		// Draw border / additional strokes for better visibility
		dc.SetColor(color.RGBA{255, 255, 255, 150})
		dc.SetLineWidth(4)
		dc.Rotate(gg.Radians(-30))
		dc.DrawStringAnchored(watermarkText, float64(width)/2.0, float64(height)/2.0, 0.5, 0.5)
		dc.Stroke()
		dc.Identity()
	}

	// Save to buffer
	buf := new(bytes.Buffer)
	if err := jpeg.Encode(buf, dc.Image(), &jpeg.Options{Quality: 85}); err != nil {
		log.Printf("❌ Failed to encode watermarked image: %v", err)
		return
	}

	// 3. Upload new photo via editMessageMedia
	// Prepare message details
	phoneNumber := strings.TrimSpace(order.CustomerPhone)
	if phoneNumber == "" {
		phoneNumber = "N/A"
	} else if !strings.HasPrefix(phoneNumber, "0") && len(phoneNumber) >= 8 {
		phoneNumber = "0" + phoneNumber
	}
	location := order.Location
	if location == "" {
		location = "N/A"
	}
	address := order.AddressDetails
	if address == "" {
		address = "N/A"
	}

	caption := fmt.Sprintf("%s\n\n📦 *រូបភាពកញ្ចប់បញ្ញើ #%d*\n🏷️ លេខកូដ: `%s`",
		statusIndicator, order.DeliveryDailySequence, order.OrderID)

	caption += fmt.Sprintf("\n\n📱 លេខទូរស័ព្ទ: `%s`", phoneNumber)
	caption += fmt.Sprintf("\n📍 ទីតាំង: *%s*", location)
	caption += fmt.Sprintf("\n🏠 អាស័យដ្ឋាន: _%s_", address)

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/editMessageMedia", store.TelegramBotToken)

	var b bytes.Buffer
	w := multipart.NewWriter(&b)

	// Create media part
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="media"`)
	h.Set("Content-Type", "application/json")
	p, err := w.CreatePart(h)
	if err != nil {
		log.Printf("❌ Multipart create media part error: %v", err)
		return
	}

	mediaJSON := map[string]interface{}{
		"type":       "photo",
		"media":      "attach://photo",
		"caption":    caption,
		"parse_mode": "Markdown",
	}
	mediaBytes, _ := json.Marshal(mediaJSON)
	p.Write(mediaBytes)

	// Create photo file part
	photoPart, err := w.CreateFormFile("photo", "watermarked.jpg")
	if err != nil {
		log.Printf("❌ Multipart create photo file error: %v", err)
		return
	}
	io.Copy(photoPart, buf)

	chatID := strings.TrimSpace(delGroup.TelegramGroupID)
	w.WriteField("chat_id", chatID)
	w.WriteField("message_id", order.DeliveryTelegramMessageID)

	w.Close()

	req, err := http.NewRequest("POST", apiURL, &b)
	if err != nil {
		log.Printf("❌ HTTP request creation error for order %s: %v", order.OrderID, err)
		return
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	client := &http.Client{}
	apiResp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ Failed to update delivery telegram media for order %s, chat %v: %v", order.OrderID, chatID, err)
		return
	}
	defer apiResp.Body.Close()

	var apiResData map[string]interface{}
	json.NewDecoder(apiResp.Body).Decode(&apiResData)
	if ok, _ := apiResData["ok"].(bool); !ok {
		log.Printf("⚠️ Telegram API error updating delivery media for order %s, chat %v: %v", order.OrderID, chatID, apiResData)
	} else {
		log.Printf("✅ Successfully updated delivery telegram photo for %s with %s in chat %v", order.OrderID, newStatus, chatID)
	}
}

func getDeliveryTelegramCaption(order Order, sequence int, statusOverride string) string {
	statusIndicator := ""
	if statusOverride == "Cancelled" {
		statusIndicator = "❌ *ការកម្មង់ត្រូវបានលុបចោល (CANCELLED)* ❌\n\n"
	} else if statusOverride == "Returned" {
		statusIndicator = "🔄 *ការកម្មង់ត្រូវបានបញ្ជូនត្រលប់ (RETURNED)* 🔄\n\n"
	}

	phoneNumber := strings.TrimSpace(order.CustomerPhone)
	if phoneNumber == "" {
		phoneNumber = "N/A"
	} else if !strings.HasPrefix(phoneNumber, "0") && len(phoneNumber) >= 8 {
		phoneNumber = "0" + phoneNumber
	}
	location := order.Location
	if location == "" {
		location = "N/A"
	}
	address := order.AddressDetails
	if address == "" {
		address = "N/A"
	}

	text := fmt.Sprintf("%s📦 *រូបភាពកញ្ចប់បញ្ញើ #%d*\n🏷️ លេខកូដ: `%s`",
		statusIndicator, sequence, order.OrderID)

	text += fmt.Sprintf("\n\n📱 លេខទូរស័ព្ទ: `%s`", phoneNumber)
	text += fmt.Sprintf("\n📍 ទីតាំង: *%s*", location)
	text += fmt.Sprintf("\n🏠 អាស័យដ្ឋាន: _%s_", address)

	return text
}
func handleDeleteDeliveryTelegram(c *gin.Context) {
	var r struct {
		OrderID string `json:"orderId"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	var order Order
	if err := backend.DB.Where("order_id = ?", r.OrderID).First(&order).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Order not found"})
		return
	}

	if order.DeliveryTelegramMessageID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "No telegram message linked to this order"})
		return
	}

	var store Store
	if err := backend.DB.Where("store_name = ?", order.FulfillmentStore).First(&store).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Store not found"})
		return
	}

	var delGroup DeliveryGroup
	if err := backend.DB.Where("store_name = ? AND shipping_method = ?", order.FulfillmentStore, order.InternalShippingMethod).First(&delGroup).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Telegram group not defined for this branch and shipping method"})
		return
	}

	if store.TelegramBotToken == "" || delGroup.TelegramGroupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Telegram settings missing"})
		return
	}

	// 1. Delete the message from Telegram
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/deleteMessage", store.TelegramBotToken)
	chatID := strings.TrimSpace(delGroup.TelegramGroupID)
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"message_id": order.DeliveryTelegramMessageID,
	}
	jsonData, _ := json.Marshal(payload)
	resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("❌ [Delete Delivery] HTTP error for order %s, chat %v: %v", order.OrderID, chatID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to call Telegram API: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	var resData map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&resData)
	if ok, _ := resData["ok"].(bool); !ok {
		// If message is already deleted or too old, we still want to clean up our DB
		log.Printf("⚠️ Telegram Delete API error for order %s, chat %v: %v", order.OrderID, chatID, resData)
	} else {
		log.Printf("✅ Successfully deleted telegram message for order %s from chat %v", order.OrderID, chatID)
	}

	// 2. Clean up current order
	deletedSeq := order.DeliveryDailySequence

	backend.DB.Model(&order).Updates(map[string]interface{}{
		"delivery_telegram_message_id": "",
		"delivery_daily_sequence":      0,
	})

	// Trigger Sheet Sync for current order
	backend.EnqueueSync("updateSheet", map[string]interface{}{
		"Delivery Telegram Message ID": "",
		"Delivery Daily Sequence":      0,
	}, "AllOrders", map[string]string{"Order ID": order.OrderID})

	// Broadcast update
	eventBytes, _ := json.Marshal(map[string]interface{}{
		"type":    "update_order",
		"orderId": order.OrderID,
		"newData": map[string]interface{}{
			"Delivery Telegram Message ID": "",
			"Delivery Daily Sequence":      0,
		},
	})
	hub.Broadcast <- eventBytes

	// 3. Re-sequence subsequent orders
	if deletedSeq > 0 && order.DeliveryTelegramDate != "" {
		var subsequentOrders []Order
		backend.DB.Where("internal_shipping_method = ? AND delivery_telegram_date = ? AND delivery_daily_sequence > ?",
			order.InternalShippingMethod, order.DeliveryTelegramDate, deletedSeq).
			Order("delivery_daily_sequence ASC").
			Find(&subsequentOrders)

		for _, subOrder := range subsequentOrders {
			newSeq := subOrder.DeliveryDailySequence - 1

			// Update DB
			backend.DB.Model(&subOrder).Update("delivery_daily_sequence", newSeq)

			// Update Telegram Caption
			if subOrder.DeliveryTelegramMessageID != "" {
				editCaptionURL := fmt.Sprintf("https://api.telegram.org/bot%s/editMessageCaption", store.TelegramBotToken)

				statusOverride := ""
				if strings.TrimSpace(subOrder.FulfillmentStatus) == "Cancelled" {
					statusOverride = "Cancelled"
				} else if strings.TrimSpace(subOrder.FulfillmentStatus) == "Returned" {
					statusOverride = "Returned"
				}

				newCaption := getDeliveryTelegramCaption(subOrder, newSeq, statusOverride)
				chatID := strings.TrimSpace(delGroup.TelegramGroupID)
				editPayload := map[string]interface{}{
					"chat_id":    chatID,
					"message_id": subOrder.DeliveryTelegramMessageID,
					"caption":    newCaption,
					"parse_mode": "Markdown",
				}
				if delGroup.TelegramTopicID != "" {
					topicID := strings.TrimSpace(delGroup.TelegramTopicID)
					if threadID, err := strconv.Atoi(topicID); err == nil && threadID != 0 {
						editPayload["message_thread_id"] = threadID
					}
				}
				eJson, _ := json.Marshal(editPayload)
				http.Post(editCaptionURL, "application/json", bytes.NewBuffer(eJson))
			}

			// Sync to Sheet
			backend.EnqueueSync("updateSheet", map[string]interface{}{
				"Delivery Daily Sequence": newSeq,
			}, "AllOrders", map[string]string{"Order ID": subOrder.OrderID})

			// Broadcast
			subEvent, _ := json.Marshal(map[string]interface{}{
				"type":    "update_order",
				"orderId": subOrder.OrderID,
				"newData": map[string]interface{}{
					"Delivery Daily Sequence": newSeq,
				},
			})
			hub.Broadcast <- subEvent
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "លុបចេញពី Telegram និងតម្រៀបលេខរៀងឡើងវិញជោគជ័យ!"})
}
