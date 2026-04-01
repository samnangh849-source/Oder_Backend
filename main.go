package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	backend "github.com/samnangh849-source/Oder_Backend-2-/Backend"

	// Import GORM
	"gorm.io/gorm"
)

// --- Configuration ---
var (
	DB               *gorm.DB
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
type TempImage = backend.TempImage

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
	DB = backend.DB
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
		"Order ID":                  "order_id",
		"Discount ($)":              "discount_usd",
		"Total Product Cost ($)":    "total_product_cost",
		"Shipping Fee (Customer)":   "shipping_fee_customer",
		"Products":                  "products_json",
		"Products (JSON)":           "products_json",
		"Telegram Message ID 1":     "telegram_message_id1",
		"Telegram Message ID 2":     "telegram_message_id2",
		"Customer Name":             "customer_name",
		"Customer Phone":            "customer_phone",
		"Location":                  "location",
		"Address Details":           "address_details",
		"Fulfillment Status":        "fulfillment_status",
		"Fulfillment Store":         "fulfillment_store",
		"Internal Shipping Method":  "internal_shipping_method",
		"Internal Shipping Details": "internal_shipping_details",
		"Internal Cost":             "internal_cost",
		"Payment Status":            "payment_status",
		"Payment Info":              "payment_info",
		"Scheduled Time":            "scheduled_time",
		"Delivery Unpaid":           "delivery_unpaid",
		"Delivery Paid":             "delivery_paid",
		"Package Photo":             "package_photo_url",
		"Package Photo URL":         "package_photo_url",
		"Delivery Photo":            "delivery_photo_url",
		"Delivery Photo URL":        "delivery_photo_url",
		"Driver Name":               "driver_name",
		"Tracking Number":           "tracking_number",
		"Dispatched Time":           "dispatched_time",
		"Dispatched By":             "dispatched_by",
		"Delivered Time":            "delivered_time",
		"Packed By":                 "packed_by",
		"Packed Time":               "packed_time",
		"IsVerified":                "is_verified",
		"UserName":                  "user_name",
		"FullName":                  "full_name",
		"ProfilePictureURL":         "profile_picture_url",
		"IsSystemAdmin":             "is_system_admin",
		"TelegramUsername":          "telegram_username",
		"ImageURL":                  "image_url",
		"Image URL":                 "image_url",
		"LogosURL":                  "logo_url",
		"Logos URL":                 "logo_url",
		"LogoURL":                   "logo_url",
		"Thumbnail":                 "thumbnail",
		"Thumbnail URL":             "thumbnail",
		"ID":                        "id",
		"Key":                       "config_key",
		"Value":                     "config_value",
		"Description":               "description",
	}

	for k, v := range specialCases {
		if strings.EqualFold(k, key) {
			return v
		}
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
		"telegram_message_id1": true, "telegram_message_id2": true, "scheduled_time": true,
		"fulfillment_store": true, "team": true, "is_verified": true, "fulfillment_status": true,
		"packed_by": true, "packed_time": true, "package_photo_url": true, "driver_name": true, "tracking_number": true,
		"dispatched_time": true, "dispatched_by": true, "delivered_time": true, "delivery_photo_url": true,
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

// =========================================================================
// AUTHENTICATION, JWT & AUTHORIZATION (RBAC) - Aliased to Backend package
// =========================================================================

type Claims = backend.Claims

var generateJWT = backend.GenerateJWT
var handleLogin = backend.HandleLogin
var DBMiddleware = backend.DBMiddleware
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

// =========================================================================

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

	// Always let DB generate unique IDs to avoid collisions when duplicating calculators.
	req.ID = 0

	if err := DB.Create(&req).Error; err != nil {
		c.JSON(500, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(200, gin.H{"status": "success", "data": req})
}

func handleGetIncentiveProjects(c *gin.Context) {
	var projects []IncentiveProject
	DB.Preload("Calculators").Find(&projects)
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
		DB.Model(&IncentiveProject{}).Select("COALESCE(MAX(id), 0)").Row().Scan(&maxID)
		req.ID = maxID + 1
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
	query := DB.Model(&IncentiveManualData{})
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
	err := DB.Where("project_id = ? AND month = ? AND metric_type = ? AND data_key = ?", req.ProjectID, req.Month, req.MetricType, req.DataKey).First(&existing).Error
	if err == nil {
		DB.Model(&existing).Update("value", req.Value)
	} else {
		DB.Create(&req)
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
	query := DB.Model(&IncentiveCustomPayout{})
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
	err := DB.Where("project_id = ? AND month = ? AND user_name = ?", req.ProjectID, req.Month, req.UserName).First(&existing).Error
	if err == nil {
		DB.Model(&existing).Update("value", req.Value)
	} else {
		DB.Create(&req)
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

	// 1. Delete existing results for this project/month (assuming results are stored per project, but model lacks month. Let's add month if needed, or rely on Project ID if project is 1 per month. For now, just replace).
	DB.Where("project_id = ?", req.ProjectID).Delete(&IncentiveResult{})

	// 2. Save new results
	if len(req.Results) > 0 {
		var maxID uint
		DB.Model(&IncentiveResult{}).Select("COALESCE(MAX(id), 0)").Row().Scan(&maxID)

		for i := range req.Results {
			maxID++
			req.Results[i].ID = maxID
		}
		DB.Create(&req.Results)

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

	results, err := backend.ProcessIncentiveCalculation(DB, req.ProjectID, req.Month)
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
			} else {
				defer resp.Body.Close()
				var scriptResp AppsScriptResponse
				if err := json.NewDecoder(resp.Body).Decode(&scriptResp); err == nil {
					if (scriptResp.MessageIds.ID1 != "" || scriptResp.MessageIds.ID2 != "") && DB != nil {
						DB.Model(&Order{}).Where("order_id = ?", job.OrderID).Updates(map[string]interface{}{
							"telegram_message_id1": scriptResp.MessageIds.ID1,
							"telegram_message_id2": scriptResp.MessageIds.ID2,
						})
					}
				}
				msgBytes, _ := json.Marshal(map[string]interface{}{"type": "system_notification", "status": "success", "targetUser": job.UserName, "message": "បាញ់ទៅ Telegram ជោគជ័យ!", "jobId": job.JobID})
				if backend.HubGlobal != nil {
					backend.HubGlobal.Broadcast <- msgBytes
				}
			}
		}()
	}
}

func startScheduler() {
	ticker := time.NewTicker(2 * time.Minute)
	cleanupTicker := time.NewTicker(5 * time.Minute)

	go func() {
		for {
			select {
			case <-ticker.C:
				// Sync with Google Sheets via managed queue
				enqueueSync("checkScheduledOrders", nil, "", nil)
			case <-cleanupTicker.C:
				result := DB.Where("expires_at < ?", time.Now()).Delete(&TempImage{})
				if result.RowsAffected > 0 {
					log.Printf("🧹 Cleanup: លុបរូបភាពបណ្ដោះអាសន្នចំនួន %d ឯកសារដែលហួសពេលចេញពី Database", result.RowsAffected)
				}
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
			var d []DriverRecommendation
			DB.Find(&d)
			mu.Lock()
			result["driverRecommendations"] = d
			mu.Unlock()
		},
		func() { var d []Movie; DB.Find(&d); mu.Lock(); result["movies"] = d; mu.Unlock() },
		func() { var d []TelegramTemplate; DB.Find(&d); mu.Lock(); result["telegramTemplates"] = d; mu.Unlock() },
		func() { var d []RevenueEntry; DB.Find(&d); mu.Lock(); result["revenueEntries"] = d; mu.Unlock() },
		func() {
			var d []EditLog
			DB.Limit(500).Order("timestamp desc").Find(&d)
			mu.Lock()
			result["editLogs"] = d
			mu.Unlock()
		},
		func() {
			var d []UserActivityLog
			DB.Limit(500).Order("timestamp desc").Find(&d)
			mu.Lock()
			result["actLogs"] = d
			mu.Unlock()
		},
		func() {
			var settings []Setting
			DB.Find(&settings)
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

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": result})
}

func handleGetSettings(c *gin.Context) {
	var settings []Setting
	if err := DB.Find(&settings).Error; err != nil {
		c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": settings})
}

// =========================================================================
// HANDLERS
// =========================================================================

func handleGetUsers(c *gin.Context) {
	var users []User
	DB.Find(&users)
	for i := range users {
		users[i].Password = ""
	}
	c.JSON(200, gin.H{"status": "success", "data": users})
}

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

	if err := query.Find(&orders).Error; err != nil {
		c.Error(err)
		return
	}
	var total int64
	countQuery.Count(&total)
	c.JSON(200, gin.H{"status": "success", "data": orders, "total": total})
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
		OrderID: orderID, Timestamp: timestamp, User: orderRequest.CurrentUser.UserName, Team: orderRequest.SelectedTeam,
		Page: orderRequest.Page, CustomerName: custName, CustomerPhone: custPhone, Subtotal: orderRequest.Subtotal,
		GrandTotal: orderRequest.GrandTotal, ProductsJSON: string(productsJSON), Note: orderRequest.Note,
		FulfillmentStore: orderRequest.FulfillmentStore, ScheduledTime: orderRequest.ScheduledTime, FulfillmentStatus: "Pending",
		PaymentStatus: paymentStatus, PaymentInfo: paymentInfo, InternalCost: shippingCost, DiscountUSD: totalDiscount,
		TotalProductCost: totalProductCost, Location: strings.Join(locationParts, ", "), AddressDetails: addLocation,
		ShippingFeeCustomer: shipFeeCustomer, InternalShippingMethod: internalShipMethod, InternalShippingDetails: internalShipDetails,
	}

	if err := DB.Create(&newOrder).Error; err != nil {
		c.Error(err)
		return
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "new_order", "data": newOrder})
	hub.Broadcast <- eventBytes

	orderChannel <- OrderJob{JobID: fmt.Sprintf("job_%d", time.Now().UnixNano()), OrderID: orderID, UserName: orderRequest.CurrentUser.UserName, OrderData: map[string]interface{}{"orderId": orderID, "timestamp": timestamp, "totalDiscount": totalDiscount, "totalProductCost": totalProductCost, "fullLocation": strings.Join(locationParts, ", "), "productsJSON": string(productsJSON), "shippingCost": shippingCost, "originalRequest": orderRequest, "scheduledTime": orderRequest.ScheduledTime}}
	c.JSON(200, gin.H{"status": "success", "orderId": orderID})
}

func handleAdminUpdateOrder(c *gin.Context) {
	var r struct {
		OrderID string                 `json:"orderId"`
		NewData map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&r); err != nil {
		c.Error(err)
		return
	}

	var originalOrder Order
	if err := DB.Where("order_id = ?", r.OrderID).First(&originalOrder).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "រកមិនឃើញការកម្មង់"})
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
			"Pending":       {"Processing", "Ready to Ship", "Cancelled"},
			"Processing":    {"Ready to Ship", "Pending", "Cancelled"},
			"Ready to Ship": {"Shipped", "Pending", "Cancelled"},
			"Shipped":       {"Delivered", "Ready to Ship", "Cancelled"},
			"Delivered":     {},
			"Cancelled":     {"Pending"},
		}

		allowed, ok := validTransitions[currentStatus]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ស្ថានភាពបច្ចុប្បន្នមិនត្រឹមត្រូវ"})
			return
		}
		transitionValid := false
		for _, s := range allowed {
			if s == newStatus {
				transitionValid = true
				break
			}
		}
		if !transitionValid {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": fmt.Sprintf("មិនអាចផ្លាស់ប្តូរពី '%s' ទៅ '%s' បានទេ", currentStatus, newStatus)})
			return
		}

		// ✅ Validate required fields for each transition
		switch newStatus {
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
			if !hasDriver && strings.TrimSpace(originalOrder.DriverName) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ត្រូវការអ្នកដឹកជញ្ជូន (Driver Name) មុនពេលបញ្ជាក់ការដឹកជញ្ជូន"})
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

	mappedData := make(map[string]interface{})
	for k, v := range r.NewData {
		dbCol := mapToDBColumn(k)
		if isValidOrderColumn(dbCol) && v != nil {
			// ✅ Prevent overwriting a permanent Google Drive URL with a temporary URL
			if strVal, ok := v.(string); ok && strings.Contains(strVal, "/api/images/temp/") {
				var currentVal string
				DB.Model(&Order{}).Where("order_id = ?", r.OrderID).Select(dbCol).Scan(&currentVal)
				if strings.Contains(currentVal, "drive.google.com") {
					continue // Skip updating this column as we already have the permanent Drive URL
				}
			}

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

	if err := DB.Model(&Order{}).Where("order_id = ?", r.OrderID).Updates(mappedData).Error; err != nil {
		c.Error(err)
		return
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "update_order", "orderId": r.OrderID, "newData": r.NewData})
	hub.Broadcast <- eventBytes

	go func() {
		// Build comprehensive sheet data: start from r.NewData then fill missing
		// fulfillment fields from DB (e.g. Driver Name set in a prior step).
		sheetData := make(map[string]interface{})
		for k, v := range r.NewData {
			sheetData[k] = v
		}
		var current Order
		if err := DB.Where("order_id = ?", r.OrderID).First(&current).Error; err == nil {
			fill := func(key, val string) {
				if val != "" {
					if _, exists := sheetData[key]; !exists {
						sheetData[key] = val
					}
				}
			}
			fill("Packed By", current.PackedBy)
			fill("Packed Time", current.PackedTime)
			fill("Package Photo URL", current.PackagePhotoURL)
			fill("Driver Name", current.DriverName)
			fill("Tracking Number", current.TrackingNumber)
			fill("Dispatched Time", current.DispatchedTime)
			fill("Dispatched By", current.DispatchedBy)
			fill("Delivered Time", current.DeliveredTime)
			fill("Delivery Photo URL", current.DeliveryPhotoURL)
		}

		// SINGLE Sync call to Google Sheets and Telegram.
		// Apps Script's updateOrderTelegram already handles updating AllOrders and the team's specific sheet.
		// This saves Apps Script execution time and quota.
		enqueueSync("updateOrderTelegram", map[string]interface{}{
			"orderId":       r.OrderID,
			"updatedFields": sheetData,
			"team":          originalOrder.Team,
		}, "", nil)
	}()

	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminDeleteOrder(c *gin.Context) {
	var r DeleteOrderRequest
	if err := c.ShouldBindJSON(&r); err != nil {
		c.Error(err)
		return
	}

	var order Order
	if err := DB.Where("order_id = ?", r.OrderID).First(&order).Error; err == nil {
		// Prepare IDs, falling back to request values if DB is empty
		m1 := order.TelegramMessageID1
		if m1 == "" {
			m1 = r.TelegramMessageID1
		}
		m2 := order.TelegramMessageID2
		if m2 == "" {
			m2 = r.TelegramMessageID2
		}

		go func() {
			// ✅ Sync with Google Sheets & Telegram via managed queue.
			// deleteOrderTelegram in Apps Script already handles BOTH Google Sheets and Telegram deletion.
			// This is safer and more efficient than calling deleteRow + deleteOrderTelegram separately.
			enqueueSync("deleteOrderTelegram", map[string]interface{}{
				"orderId":          r.OrderID,
				"team":             order.Team,
				"messageId1":       m1,
				"messageId2":       m2,
				"fulfillmentStore": order.FulfillmentStore,
			}, "", nil)
		}()
		DB.Delete(&order)
		eventBytes, _ := json.Marshal(map[string]interface{}{"type": "delete_order", "orderId": r.OrderID})
		hub.Broadcast <- eventBytes
	}
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminUpdateSheet(c *gin.Context) {
	var req struct {
		SheetName  string                 `json:"sheetName"`
		PrimaryKey map[string]interface{} `json:"primaryKey"`
		NewData    map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}
	tableName := getTableName(req.SheetName)
	if tableName == "" {
		c.Error(fmt.Errorf("unknown sheet"))
		return
	}

	pkCol := ""
	var pkVal interface{}
	originalPKKey := ""
	for k, v := range req.PrimaryKey {
		pkCol = mapToDBColumn(k)
		pkVal = v
		originalPKKey = k
	}
	if !isValidDBIdentifier(pkCol) {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid primary key field"})
		return
	}
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData {
		dbCol := mapToDBColumn(k)
		if v == nil {
			continue
		}

		// ✅ Prevent overwriting a permanent Google Drive URL with a temporary URL
		if strVal, ok := v.(string); ok && strings.Contains(strVal, "/api/images/temp/") {
			var currentVal string
			if pkVal != nil {
				DB.Table(tableName).Where(pkCol+" = ?", pkVal).Select(dbCol).Scan(&currentVal)
				if strings.Contains(currentVal, "drive.google.com") {
					continue // Skip updating this column as we already have the permanent Drive URL
				}
			}
		}

		mappedData[dbCol] = v
	}

	if err := DB.Table(tableName).Where(pkCol+" = ?", pkVal).Updates(mappedData).Error; err != nil {
		c.Error(err)
		return
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "update_sheet", "sheetName": req.SheetName, "primaryKey": req.PrimaryKey, "newData": req.NewData})
	hub.Broadcast <- eventBytes

	go func() {
		sheetPKKey := originalPKKey
		if req.SheetName == "Roles" && strings.ToLower(originalPKKey) == "id" {
			sheetPKKey = "ID"
		}
		// Sync with Google Sheets via managed queue
		enqueueSync("updateSheet", req.NewData, req.SheetName, map[string]string{sheetPKKey: fmt.Sprintf("%v", pkVal)})

		// If updating an Order row, also notify Telegram to keep message in sync
		if req.SheetName == "AllOrders" {
			orderID := fmt.Sprintf("%v", pkVal)
			var order Order
			DB.Where("order_id = ?", orderID).Select("team").First(&order)
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
		mappedData := make(map[string]interface{})
		for k, v := range req.NewData {
			mappedData[mapToDBColumn(k)] = v
		}
		DB.Table(tableName).Create(mappedData)
	}

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "add_row", "sheetName": req.SheetName, "newData": req.NewData})
	hub.Broadcast <- eventBytes

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
		pkCol = mapToDBColumn(k)
		pkVal = v
	}
	if !isValidDBIdentifier(pkCol) {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid primary key field"})
		return
	}

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

	eventBytes, _ := json.Marshal(map[string]interface{}{"type": "delete_row", "sheetName": req.SheetName, "primaryKey": strPrimaryKey})
	hub.Broadcast <- eventBytes

	go func() {
		// Sync with Google Sheets via managed queue
		enqueueSync("deleteRow", nil, req.SheetName, strPrimaryKey)
	}()
	c.JSON(200, gin.H{"status": "success"})
}

func handleGetRevenueSummary(c *gin.Context) {
	var revs []RevenueEntry
	DB.Find(&revs)
	c.JSON(200, gin.H{"status": "success", "data": revs})
}
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
		mappedData[mapToDBColumn(k)] = v
	}
	if err := DB.Model(&User{}).Where("user_name = ?", req.UserName).Updates(mappedData).Error; err != nil {
		c.Error(err)
		return
	}

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
	if err := DB.Model(&User{}).Where("user_name = ?", req.UserName).Update("password", string(hashedPassword)).Error; err != nil {
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
	query := DB.Order("timestamp desc")
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
	if err := DB.Where("id = ?", id).First(&msg).Error; err != nil {
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
		msg.UserName = sender.(string)
	}
	msg.Timestamp = time.Now().Format(time.RFC3339)

	msgType := strings.ToLower(msg.MessageType)

	var base64Data string
	if msgType == "audio" && msg.AudioData != "" {
		base64Data = msg.AudioData
	} else if msgType == "image" {
		base64Data = msg.Content
	}

	if (msgType == "audio" || msgType == "image") && msg.FileID == "" && len(base64Data) > 100 {
		mimeType := "application/octet-stream"
		if strings.Contains(base64Data, "data:") && strings.Contains(base64Data, ";base64,") {
			parts := strings.Split(base64Data, ";base64,")
			mimeType = strings.TrimPrefix(parts[0], "data:")
			base64Data = parts[1]
		}

		tempID := "chat_temp_" + generateShortID() + generateShortID()
		DB.Create(&TempImage{
			ID:        tempID,
			MimeType:  mimeType,
			ImageData: base64Data,
			ExpiresAt: time.Now().Add(30 * time.Minute),
		})

		protocol := "http"
		if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
			protocol = "https"
		}
		tempUrl := fmt.Sprintf("%s://%s/api/images/temp/%s", protocol, c.Request.Host, tempID)

		originalContent := msg.Content
		msg.Content = tempUrl

		DB.Create(&msg)
		msgBytes, _ := json.Marshal(map[string]interface{}{"type": "new_message", "data": msg})
		hub.Broadcast <- msgBytes

		c.JSON(200, gin.H{"status": "success", "data": msg})

		go func(m ChatMessage, b64 string, mt string, tid string, originalContent string) {
			defer func() {
				if rec := recover(); rec != nil {
					log.Printf("🔥 PANIC in chat upload: %v", rec)
				}
			}()

			driveURL, fileId, err := backend.UploadToGoogleDriveDirectly(b64, "chat_file", mt, nil)
			if err == nil {

				finalContent := originalContent
				if strings.ToLower(m.MessageType) == "image" {
					finalContent = driveURL
				}

				DB.Model(&ChatMessage{}).Where("id = ?", m.ID).Updates(map[string]interface{}{
					"file_id": fileId,
					"content": finalContent,
				})

				updateMsg, _ := json.Marshal(map[string]interface{}{
					"type":       "upload_complete",
					"message_id": m.ID,
					"file_id":    fileId,
					"url":        driveURL,
					"receiver":   m.Receiver,
				})
				hub.Broadcast <- updateMsg
				log.Printf("📢 Broadcasted upload_complete for Message ID: %d", m.ID)

				// Removed immediate TempImage deletion to allow client time to load
			} else {
				log.Printf("❌ Chat media upload failed: %v", err)
			}
		}(msg, base64Data, mimeType, tempID, originalContent)

		return
	}

	DB.Create(&msg)
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
	if err := DB.First(&msg, req.ID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "រកមិនឃើញសារ"})
		return
	}

	currentUser, _ := c.Get("userName")
	isSystemAdmin, _ := c.Get("isSystemAdmin")
	if msg.UserName != currentUser.(string) && (isSystemAdmin == nil || !isSystemAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"status": "error", "message": "គ្មានសិទ្ធិលុបសារនេះទេ"})
		return
	}

	if err := DB.Delete(&msg).Error; err != nil {
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

// =========================================================================
// GOOGLE SHEETS WEBHOOK (Real-time Sync Sheet -> DB)
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
		dbCol := mapToDBColumn(k)

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
			if err := DB.Where(whereClause, pkVal).Select("fulfillment_status").First(&currentOrder).Error; err == nil {
				cur := strings.TrimSpace(currentOrder.FulfillmentStatus)
				if cur == "" { cur = "Pending" }
				
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
	}

	if pkCol == "" || pkVal == nil {
		c.JSON(400, gin.H{"status": "error", "message": "Missing primary key"})
		return
	}

	if req.Action == "delete" {
		whereClause := fmt.Sprintf("UPPER(TRIM(%s)) = UPPER(TRIM(?))", pkCol)
		DB.Table(tableName).Where(whereClause, pkVal).Delete(nil)
	} else {
		// UPSERT logic: Try to update first
		whereClause := fmt.Sprintf("UPPER(TRIM(%s)) = UPPER(TRIM(?))", pkCol)
		result := DB.Table(tableName).Where(whereClause, pkVal).Updates(mappedData)
		if result.Error != nil {
			c.JSON(500, gin.H{"status": "error", "message": result.Error.Error()})
			return
		}

		// If no rows were updated, it's likely a new record. Attempt to Create.
		if result.RowsAffected == 0 {
			// Ensure PK is in mappedData for creation
			mappedData[pkCol] = pkVal
			if err := DB.Table(tableName).Create(mappedData).Error; err != nil {
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

	c.JSON(200, gin.H{"status": "success"})
}

func main() {
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
	backend.UploadMapToDBColumnFunc = mapToDBColumn
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

	// Initialize DB in background to allow fast port binding for Render
	go func() {
		initDB()
		// Start Background Workers ONLY after DB is ready (if they depend on it)
		startSyncManager(2)
		go startOrderWorker()
		startScheduler()
		backend.CreateGoogleAPIClient(context.Background())
		log.Println("🚀 Starting automatic data migration on startup...")
		backend.PerformDataMigration()
	}()

	r := gin.Default()
	r.Use(ErrorHandlingMiddleware())
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
		MaxAge:       12 * time.Hour,
	}))

	r.GET("/", func(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) })
	r.GET("/healthz", func(c *gin.Context) { c.String(200, "OK") })

	// Apply DBMiddleware to all /api routes except root health checks
	api := r.Group("/api", DBMiddleware())
	api.POST("/login", handleLogin)
	api.GET("/images/temp/:id", backend.HandleServeTempImage)
	api.GET("/settings", handleGetSettings)
	// ── Entertainment / Video Player routes (Backend/video.go) ────────────────────────
	// All video handler logic lives in Backend/video.go (package backend).
	// We call RegisterVideoRoutes to set up both public and admin routes.
	// We pass the public group (api) and the admin group (admin) which already has AdminOnlyMiddleware.
	// But admin group is defined inside protected block, so we'll call it there.
	api.POST("/webhook/sheets-sync", handleSheetsWebhook)
	protected := api.Group("/")
	protected.Use(AuthMiddleware())
	{
		protected.GET("/users", handleGetUsers)
		protected.GET("/static-data", handleGetStaticData)
		protected.POST("/submit-order", handleSubmitOrder)
		protected.POST("/upload-image", backend.HandleImageUploadProxy)
		protected.GET("/permissions", handleGetUserPermissions)
		protected.GET("/roles", handleGetRoles)
		protected.GET("/orders", RequirePermission("view_order_list"), handleGetAllOrders)
		protected.GET("/teams/shipping-costs", RequirePermission("view_revenue"), handleGetGlobalShippingCosts)

		chat := protected.Group("/chat")
		chat.GET("/messages", handleGetChatMessages)
		chat.GET("/message/:id", handleGetSingleChatMessage)
		chat.POST("/send", handleSendChatMessage)
		chat.POST("/delete", handleDeleteChatMessage)

		admin := protected.Group("/admin")
		admin.Use(AdminOnlyMiddleware())
		{
			// Video/Movie admin routes from backend package
			// This registers both public (/api) and admin (/api/admin) movie routes
			backend.RegisterVideoRoutes(api, admin)

			admin.GET("/orders", RequirePermission("view_order_list"), handleGetAllOrders)
			admin.POST("/update-order", RequirePermission("edit_order"), handleAdminUpdateOrder)
			admin.POST("/migrate-data", backend.HandleMigrateData)
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
			admin.GET("/incentive/manual-data", handleGetIncentiveManualData)
			admin.POST("/incentive/manual-data", handleSaveIncentiveManualData)
			admin.GET("/incentive/custom-payout", handleGetIncentiveCustomPayouts)
			admin.POST("/incentive/custom-payout", handleSaveIncentiveCustomPayout)
			admin.POST("/incentive/lock", handleLockIncentivePayout)
		}
		profile := protected.Group("/profile")
		profile.POST("/update", handleUpdateProfile)
		profile.POST("/change-password", handleChangePassword)
	}
	api.GET("/chat/ws", AuthMiddleware(), serveWs)
	api.GET("/chat/audio/:fileID", backend.HandleGetAudioProxy)
	r.Run("0.0.0.0:" + port)
}
