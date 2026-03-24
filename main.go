package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"


	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"

	"github.com/samnangh849-source/Oder_Backend-2-/Backend"

	// Import GORM
	"gorm.io/gorm"
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
)

var sheetRanges = map[string]string{
	"Users":                  "Users!A:Z",
	"Stores":                 "Stores!A:Z",
	"Settings":               "Settings!A:Z",
	"TeamsPages":             "TeamsPages!A:Z",
	"Products":               "Products!A:Z",
	"Locations":              "Locations!A:Z",
	"ShippingMethods":        "ShippingMethods!A:Z",
	"Colors":                 "Colors!A:Z",
	"Drivers":                "Drivers!A:Z",
	"BankAccounts":           "BankAccounts!A:Z",
	"PhoneCarriers":          "PhoneCarriers!A:Z",
	"TelegramTemplates":      "TelegramTemplates!A:Z",
	"Inventory":              "Inventory!A:Z",
	"StockTransfers":         "StockTransfers!A:Z",
	"Returns":                "Returns!A:Z",
	"AllOrders":              "AllOrders!A:AZ",
	"RevenueDashboard":       "RevenueDashboard!A:Z",
	"ChatMessages":           "ChatMessages!A:Z",
	"EditLogs":               "EditLogs!A:Z",
	"UserActivityLogs":       "UserActivityLogs!A:Z",
	"Roles":                  "Roles!A:Z",
	"RolePermissions":        "RolePermissions!A:Z",
	"DriverRecommendations":  "DriverRecommendations!A:Z",
	"IncentiveResults":       "IncentiveResults!A:Z",
	"Movies":                 "Movies!A:Z",
	"IncentiveProjects":      "IncentiveProjects!A:Z",
	"IncentiveCalculators":   "IncentiveCalculators!A:Z",
	"IncentiveManualData":    "IncentiveManualData!A:Z",
	"IncentiveCustomPayouts": "IncentiveCustomPayouts!A:Z",
}

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

// =========================================================================
// INIT DATABASE & GOOGLE SERVICES
// =========================================================================
func initDB() {
	backend.InitDB()
	DB = backend.DB
}

func createGoogleAPIClient(ctx context.Context) error {
	credentialsJSON := os.Getenv("GCP_CREDENTIALS")
	if credentialsJSON == "" {
		return fmt.Errorf("GCP_CREDENTIALS not set")
	}
	credentialsJSON = strings.Trim(credentialsJSON, "\"")
	credentialsJSON = strings.ReplaceAll(credentialsJSON, "\\\"", "\"")

	clientOptions := option.WithCredentialsJSON([]byte(credentialsJSON))

	sheetsSrv, err := sheets.NewService(ctx, clientOptions, option.WithScopes(sheets.SpreadsheetsScope))
	if err != nil {
		return err
	}
	sheetsService = sheetsSrv

	driveSrv, err := drive.NewService(ctx, clientOptions, option.WithScopes(drive.DriveFileScope))
	if err != nil {
		return err
	}
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
		"Delivered Time":            "delivered_time",
		"Packed By":                 "packed_by",
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

	var project IncentiveProject
	if err := DB.Preload("Calculators").First(&project, req.ProjectID).Error; err != nil {
		c.JSON(404, gin.H{"status": "error", "message": "រកគម្រោងមិនឃើញ"})
		return
	}

	// Fetch all users once
	var allUsers []User
	DB.Find(&allUsers)

	// Fetch orders for the month
	startDate := req.Month + "-01T00:00:00Z"
	endDate := req.Month + "-31T23:59:59Z"
	parts := strings.Split(req.Month, "-")
	if len(parts) == 2 {
		year, _ := strconv.Atoi(parts[0])
		month, _ := strconv.Atoi(parts[1])
		firstDay := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
		lastDay := firstDay.AddDate(0, 1, -1)
		endDate = lastDay.Format("2006-01-02") + "T23:59:59Z"
	}

	var orders []Order
	DB.Where("fulfillment_status = ? AND timestamp >= ? AND timestamp <= ?", "Delivered", startDate, endDate).Find(&orders)

	// Fetch Manual Data
	var manualData []IncentiveManualData
	DB.Where("project_id = ? AND month = ?", req.ProjectID, req.Month).Find(&manualData)

	// Custom Payouts
	var customPayouts []IncentiveCustomPayout
	DB.Where("project_id = ? AND month = ?", req.ProjectID, req.Month).Find(&customPayouts)
	customPayoutMap := make(map[string]float64)
	for _, cp := range customPayouts {
		customPayoutMap[cp.UserName] = cp.Value
	}

	// Group results by User
	userRewards := make(map[string]float64)
	userOrders := make(map[string]int)
	userRevenue := make(map[string]float64)
	userProfit := make(map[string]float64)
	userBreakdown := make(map[string][]map[string]interface{})

	// Process each active calculator
	for _, calc := range project.Calculators {
		if calc.Status == "Disable" {
			continue
		}

		var rules IncentiveRules
		if calc.RulesJSON != "" {
			json.Unmarshal([]byte(calc.RulesJSON), &rules)
		}

		// Identify eligible users for this calculator
		eligibleUsers := []User{}
		for _, u := range allUsers {
			isEligible := false
			if len(rules.ApplyTo) == 0 {
				isEligible = true // Applies to all if not specified
			} else {
				for _, target := range rules.ApplyTo {
					if strings.HasPrefix(target, "Role:") && u.Role == strings.TrimPrefix(target, "Role:") {
						isEligible = true
						break
					}
					if strings.HasPrefix(target, "Team:") {
						targetTeam := strings.TrimPrefix(target, "Team:")
						userTeams := strings.Split(u.Team, ",")
						for _, ut := range userTeams {
							if strings.EqualFold(strings.TrimSpace(ut), strings.TrimSpace(targetTeam)) {
								isEligible = true
								break
							}
						}
						if isEligible {
							break
						}
					}
					if strings.HasPrefix(target, "User:") && u.UserName == strings.TrimPrefix(target, "User:") {
						isEligible = true
						break
					}
				}
			}
			if isEligible {
				eligibleUsers = append(eligibleUsers, u)
			}
		}

		if len(eligibleUsers) == 0 {
			continue
		}

		// Metric Calculation
		metricType := rules.MetricType
		if metricType == "" {
			metricType = "Sales Amount"
		}

		// Pre-calculate member counts for teams to distribute team manual data
		teamMemberCount := make(map[string]int)
		for _, u := range eligibleUsers {
			if u.Team != "" {
				userTeams := strings.Split(u.Team, ",")
				for _, ut := range userTeams {
					teamName := normalizeTeamKey(ut)
					if teamName != "" {
						teamMemberCount[teamName]++
					}
				}
			}
		}

		userSet := make(map[string]bool, len(allUsers))
		for _, u := range allUsers {
			userSet[u.UserName] = true
		}

		// Map to store manual data for both users and teams
		userManualPerf := make(map[string]float64)
		teamManualPerf := make(map[string]float64)
		for _, md := range manualData {
			if md.MetricType == metricType {
				_, targetRaw, ok := parseManualDataKey(md.DataKey)
				if !ok {
					continue
				}
				targetType, targetID := resolveManualTarget(targetRaw, userSet)
				if targetType == "user" {
					userManualPerf[targetID] += md.Value
				} else {
					teamManualPerf[targetID] += md.Value
				}
			}
		}

		// Calculate performance for each eligible user (Orders + Individual Manual)
		perfMap := make(map[string]float64)
		for _, u := range eligibleUsers {
			var val float64
			for _, o := range orders {
				if o.User == u.UserName {
					switch strings.ToLower(strings.TrimSpace(metricType)) {
					case "sales amount", "revenue":
						val += o.GrandTotal
						userRevenue[u.UserName] += o.GrandTotal
					case "profit":
						orderProfit := o.GrandTotal - o.TotalProductCost - o.InternalCost
						val += orderProfit
						userProfit[u.UserName] += orderProfit
					default:
						val += 1
						userOrders[u.UserName]++
					}
				}
			}
			// Add User-specific Manual Data
			val += userManualPerf[u.UserName]
			
			// If distribution is Individual, we also add a proportional share of Team Manual Data
			if rules.DistributionRule.Method == "" || rules.DistributionRule.Method == "Individual" {
				if u.Team != "" {
					userTeams := strings.Split(u.Team, ",")
					for _, ut := range userTeams {
						teamName := normalizeTeamKey(ut)
						if teamName != "" && teamManualPerf[teamName] > 0 && teamMemberCount[teamName] > 0 {
							share := teamManualPerf[teamName] / float64(teamMemberCount[teamName])
							val += share
						}
					}
				}
			}

			perfMap[u.UserName] = val
		}

		// Distribution Logic
		distMethod := rules.DistributionRule.Method
		if distMethod == "" {
			distMethod = "Individual" // Default
		}

		if distMethod == "Equal Split" || distMethod == "Percentage Allocation" {
			// Calculate Group Total Performance (Sum of Individual Perfs + Team Manual Data)
			var groupTotalPerf float64
			for _, v := range perfMap {
				groupTotalPerf += v
			}
			// Add Team Manual Data that hasn't been added to individual perfs yet
			for teamID, teamVal := range teamManualPerf {
				// Only add if at least one member of this team is in the eligible group
				if teamMemberCount[teamID] > 0 {
					groupTotalPerf += teamVal
				}
			}

			// Calculate Pool Reward
			poolReward := calculatePayout(calc, groupTotalPerf, "")

			if distMethod == "Equal Split" {
				share := poolReward / float64(len(eligibleUsers))
				for _, u := range eligibleUsers {
					userRewards[u.UserName] += share
					userBreakdown[u.UserName] = append(userBreakdown[u.UserName], map[string]interface{}{
						"name":         calc.Name,
						"calculatorId": calc.ID,
						"key":          fmt.Sprintf("%s#%d", calc.Name, calc.ID),
						"metricType":   metricType,
						"amount":       share,
					})
				}
			} else if distMethod == "Percentage Allocation" {
				for _, u := range eligibleUsers {
					// Find allocation for this user
					found := false
					for _, alloc := range rules.DistributionRule.Allocations {
						if alloc.MemberRoleOrName == u.UserName || alloc.MemberRoleOrName == u.Role {
							share := poolReward * (alloc.Percentage / 100.0)
							userRewards[u.UserName] += share
							userBreakdown[u.UserName] = append(userBreakdown[u.UserName], map[string]interface{}{
								"name":         calc.Name,
								"calculatorId": calc.ID,
								"key":          fmt.Sprintf("%s#%d", calc.Name, calc.ID),
								"metricType":   metricType,
								"amount":       share,
							})
							found = true
							break
						}
					}
					if !found {
						// Fallback or skip
					}
				}
			}
		} else {
			// Individual Calculation (Performance-Based or Default)
			for _, u := range eligibleUsers {
				share := calculatePayout(calc, perfMap[u.UserName], "")
				userRewards[u.UserName] += share
				userBreakdown[u.UserName] = append(userBreakdown[u.UserName], map[string]interface{}{
					"name":         calc.Name,
					"calculatorId": calc.ID,
					"key":          fmt.Sprintf("%s#%d", calc.Name, calc.ID),
					"metricType":   metricType,
					"amount":       share,
				})
			}
		}
	}

	// Final Results Consolidation
	var results []IncentiveResult
	// We need to decide which users to show. Let's show any user that has any stat or reward.
	uniqueUsers := make(map[string]bool)
	for u := range userRewards { uniqueUsers[u] = true }
	for u := range userOrders { uniqueUsers[u] = true }
	for u := range userRevenue { uniqueUsers[u] = true }

	for user := range uniqueUsers {
		payout := userRewards[user]
		isCustom := false
		if customVal, exists := customPayoutMap[user]; exists {
			payout = customVal
			isCustom = true
		}

		breakdownJSON, _ := json.Marshal(userBreakdown[user])

		results = append(results, IncentiveResult{
			ProjectID:       project.ID,
			UserName:        user,
			TotalOrders:     userOrders[user],
			// Keep TotalRevenue compatible for UI; include realized profit if revenue is zero.
			TotalRevenue:    func() float64 { if userRevenue[user] != 0 { return userRevenue[user] }; return userProfit[user] }(),
			CalculatedValue: payout,
			IsCustom:        isCustom,
			BreakdownJSON:   string(breakdownJSON),
		})
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
	ticker := time.NewTicker(1 * time.Minute)
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

func handleGetSettings(c *gin.Context) {
	var settings []Setting
	if err := DB.Find(&settings).Error; err != nil {
		c.Error(err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": settings})
}

func fetchSheetDataFromAPI(sheetName string) ([]map[string]interface{}, error) {
	readRange, ok := sheetRanges[sheetName]
	if !ok {
		return nil, fmt.Errorf("range not defined")
	}
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		return nil, err
	}
	return convertSheetValuesToMaps(sheetName, resp)
}

func isNumericHeader(h string) bool {
	// Trim to be robust against accidental whitespace in the header row (e.g. "id ").
	h = strings.ToLower(strings.TrimSpace(h))
	return h == "price" || h == "cost" || h == "grand total" || h == "subtotal" || h == "shipping fee (customer)" ||
		h == "internal cost" || h == "internalcost" || h == "discount ($)" || h == "delivery unpaid" ||
		h == "delivery paid" || h == "total product cost ($)" || h == "revenue" || h == "quantity" ||
		h == "part" || h == "id" || h == "projectid" ||
		h == "totalorders" || h == "totalrevenue" || h == "calculatedvalue" ||
		h == "calculatorid"
}
func isBoolHeader(h string) bool {
	// Trim to be robust against accidental whitespace in the header row.
	h = strings.ToLower(strings.TrimSpace(h))
	return h == "issystemadmin" || h == "allowmanualdriver" || h == "requiredriverselection" ||
		h == "isrestocked" || h == "isenabled" ||
		h == "enabledriverrecommendation" || h == "requireperiodselection" || h == "iscustom"
}
func convertSheetValuesToMaps(sheetName string, values *sheets.ValueRange) ([]map[string]interface{}, error) {
	if values == nil || len(values.Values) < 2 {
		return []map[string]interface{}{}, nil
	}
	headers := values.Values[0]
	dataRows := values.Values[1:]
	result := make([]map[string]interface{}, 0, len(dataRows))
	for _, row := range dataRows {
		if len(row) == 0 || (len(row) == 1 && row[0] == "") {
			continue
		}
		rowData := make(map[string]interface{})
		for i, cell := range row {
			if i < len(headers) {
				header := strings.TrimSpace(fmt.Sprintf("%v", headers[i]))
				if header != "" {
					if cellStr, ok := cell.(string); ok {
						if isNumericHeader(header) {
							cleanedStr := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(cellStr), "$", ""), ",", "")
							if f, err := strconv.ParseFloat(cleanedStr, 64); err == nil {
								rowData[header] = f
							} else {
								// Default to 0.0 for numeric headers if parsing fails to avoid unmarshal errors
								rowData[header] = 0.0
							}
						} else if isBoolHeader(header) {
							rowData[header] = strings.ToUpper(strings.TrimSpace(cellStr)) == "TRUE"
						} else {
							if strings.ToLower(header) == "value" && (strings.TrimSpace(cellStr) == "" || strings.TrimSpace(cellStr) == "-") {
								rowData[header] = "0"
							} else {
								rowData[header] = cellStr
							}
						}
					} else {
						// If not a string, check if it's already a boolean (sometimes happens with API)
						if isBoolHeader(header) {
							if b, ok := cell.(bool); ok {
								rowData[header] = b
							} else {
								rowData[header] = false
							}
						} else {
							if b, ok := cell.(bool); ok {
								if b {
									rowData[header] = "TRUE"
								} else {
									rowData[header] = "FALSE"
								}
							} else if f, ok := cell.(float64); ok {
								// Preserve numeric types directly
								rowData[header] = f
							} else {
								rowData[header] = fmt.Sprintf("%v", cell)
							}
						}
					}
					// Ensure critical IDs are always strings to avoid scientific notation or rounding issues
					lowHeader := strings.ToLower(strings.TrimSpace(header))
					if lowHeader == "telegram message id 1" || lowHeader == "telegram message id 2" || lowHeader == "order id" || lowHeader == "customer phone" || lowHeader == "barcode" || (sheetName == "Movies" && lowHeader == "id") {
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
	if err != nil {
		return err
	}
	jsonData, _ := json.Marshal(mappedData)
	if err = json.Unmarshal(jsonData, target); err != nil {
		return err
	}
	return nil
}

func handleMigrateData(c *gin.Context) {
	go func() {
		ctx := context.Background()
		if sheetsService == nil {
			createGoogleAPIClient(ctx)
		}

		// Start Transaction
		tx := DB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		log.Println("🗑️ លុបទិន្នន័យចាស់ (Resetting Database within transaction)...")
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&User{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Store{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Setting{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&TeamPage{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Product{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Location{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ShippingMethod{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Color{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Driver{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&BankAccount{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&PhoneCarrier{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&TelegramTemplate{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Inventory{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&StockTransfer{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ReturnItem{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&RevenueEntry{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&ChatMessage{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&EditLog{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&UserActivityLog{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Order{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&DriverRecommendation{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Role{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&RolePermission{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveProject{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveCalculator{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveResult{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveManualData{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveCustomPayout{})
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Movie{})

		log.Println("🔄 ចាប់ផ្តើមទាញទិន្នន័យថ្មីពី Google Sheet...")

		var users []User
		if err := fetchSheetDataToStruct("Users", &users); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Users:", err)
			return
		}
		var validUsers []User
		seenUsers := make(map[string]bool)
		for _, x := range users {
			if x.UserName != "" && !seenUsers[x.UserName] {
				seenUsers[x.UserName] = true
				validUsers = append(validUsers, x)
			}
		}
		if len(validUsers) > 0 {
			if err := tx.CreateInBatches(validUsers, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Users:", err)
				return
			}
		}

		var stores []Store
		if err := fetchSheetDataToStruct("Stores", &stores); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Stores:", err)
			return
		}
		var validStores []Store
		seenStores := make(map[string]bool)
		for _, x := range stores {
			if x.StoreName != "" && !seenStores[x.StoreName] {
				seenStores[x.StoreName] = true
				validStores = append(validStores, x)
			}
		}
		if len(validStores) > 0 {
			if err := tx.CreateInBatches(validStores, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Stores:", err)
				return
			}
		}

		var settings []Setting
		if err := fetchSheetDataToStruct("Settings", &settings); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Settings:", err)
			return
		}
		for _, s := range settings {
			if s.ConfigKey != "" {
				if err := tx.Save(&s).Error; err != nil {
					tx.Rollback()
					log.Println("❌ Migration failed to save Setting:", s.ConfigKey, err)
					return
				}
				if s.ConfigKey == "UploadFolderID" {
					envVal := os.Getenv("UPLOAD_FOLDER_ID")
					if envVal != "" {
						uploadFolderID = envVal
					} else {
						uploadFolderID = s.ConfigValue
					}
				}
			}
		}

		var pages []TeamPage
		if err := fetchSheetDataToStruct("TeamsPages", &pages); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for TeamsPages:", err)
			return
		}
		var validPages []TeamPage
		seenPages := make(map[uint]bool)
		for _, x := range pages {
			if x.PageName != "" && !seenPages[x.ID] {
				if x.ID != 0 {
					seenPages[x.ID] = true
				}
				validPages = append(validPages, x)
			}
		}
		if len(validPages) > 0 {
			if err := tx.CreateInBatches(validPages, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save TeamsPages:", err)
				return
			}
		}

		var products []Product
		if err := fetchSheetDataToStruct("Products", &products); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Products:", err)
			return
		}
		var validProducts []Product
		seenProducts := make(map[string]bool)
		for _, x := range products {
			if x.Barcode != "" && !seenProducts[x.Barcode] {
				seenProducts[x.Barcode] = true
				validProducts = append(validProducts, x)
			}
		}
		if len(validProducts) > 0 {
			if err := tx.CreateInBatches(validProducts, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Products:", err)
				return
			}
		}

		var locations []Location
		if err := fetchSheetDataToStruct("Locations", &locations); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Locations:", err)
			return
		}
		var validLocations []Location
		seenLocations := make(map[uint]bool)
		for _, x := range locations {
			if !seenLocations[x.ID] {
				if x.ID != 0 {
					seenLocations[x.ID] = true
				}
				validLocations = append(validLocations, x)
			}
		}
		if len(validLocations) > 0 {
			if err := tx.CreateInBatches(validLocations, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Locations:", err)
				return
			}
		}

		var shipping []ShippingMethod
		if err := fetchSheetDataToStruct("ShippingMethods", &shipping); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for ShippingMethods:", err)
			return
		}
		var validShipping []ShippingMethod
		seenShipping := make(map[string]bool)
		for _, x := range shipping {
			if x.MethodName != "" && !seenShipping[x.MethodName] {
				seenShipping[x.MethodName] = true
				validShipping = append(validShipping, x)
			}
		}
		if len(validShipping) > 0 {
			if err := tx.CreateInBatches(validShipping, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save ShippingMethods:", err)
				return
			}
		}

		var colors []Color
		if err := fetchSheetDataToStruct("Colors", &colors); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Colors:", err)
			return
		}
		var validColors []Color
		seenColors := make(map[string]bool)
		for _, x := range colors {
			if x.ColorName != "" && !seenColors[x.ColorName] {
				seenColors[x.ColorName] = true
				validColors = append(validColors, x)
			}
		}
		if len(validColors) > 0 {
			if err := tx.CreateInBatches(validColors, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Colors:", err)
				return
			}
		}

		var drivers []Driver
		if err := fetchSheetDataToStruct("Drivers", &drivers); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Drivers:", err)
			return
		}
		var validDrivers []Driver
		seenDrivers := make(map[string]bool)
		for _, x := range drivers {
			if x.DriverName != "" && !seenDrivers[x.DriverName] {
				seenDrivers[x.DriverName] = true
				validDrivers = append(validDrivers, x)
			}
		}
		if len(validDrivers) > 0 {
			if err := tx.CreateInBatches(validDrivers, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Drivers:", err)
				return
			}
		}

		var banks []BankAccount
		if err := fetchSheetDataToStruct("BankAccounts", &banks); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for BankAccounts:", err)
			return
		}
		var validBanks []BankAccount
		seenBanks := make(map[string]bool)
		for _, x := range banks {
			if x.BankName != "" && !seenBanks[x.BankName] {
				seenBanks[x.BankName] = true
				validBanks = append(validBanks, x)
			}
		}
		if len(validBanks) > 0 {
			if err := tx.CreateInBatches(validBanks, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save BankAccounts:", err)
				return
			}
		}

		var carriers []PhoneCarrier
		if err := fetchSheetDataToStruct("PhoneCarriers", &carriers); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for PhoneCarriers:", err)
			return
		}
		var validCarriers []PhoneCarrier
		seenCarriers := make(map[string]bool)
		for _, x := range carriers {
			if x.CarrierName != "" && !seenCarriers[x.CarrierName] {
				seenCarriers[x.CarrierName] = true
				validCarriers = append(validCarriers, x)
			}
		}
		if len(validCarriers) > 0 {
			if err := tx.CreateInBatches(validCarriers, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save PhoneCarriers:", err)
				return
			}
		}

		var templates []TelegramTemplate
		if err := fetchSheetDataToStruct("TelegramTemplates", &templates); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for TelegramTemplates:", err)
			return
		}
		var validTemplates []TelegramTemplate
		seenTemplates := make(map[uint]bool)
		for _, x := range templates {
			if !seenTemplates[x.ID] {
				if x.ID != 0 {
					seenTemplates[x.ID] = true
				}
				validTemplates = append(validTemplates, x)
			}
		}
		if len(validTemplates) > 0 {
			if err := tx.CreateInBatches(validTemplates, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save TelegramTemplates:", err)
				return
			}
		}
		var inventory []Inventory
		if err := fetchSheetDataToStruct("Inventory", &inventory); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Inventory:", err)
			return
		}
		var validInventory []Inventory
		seenInventory := make(map[uint]bool)
		for _, x := range inventory {
			if !seenInventory[x.ID] {
				if x.ID != 0 {
					seenInventory[x.ID] = true
				}
				validInventory = append(validInventory, x)
			}
		}
		if len(validInventory) > 0 {
			if err := tx.CreateInBatches(validInventory, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Inventory:", err)
				return
			}
		}
		var transfers []StockTransfer
		if err := fetchSheetDataToStruct("StockTransfers", &transfers); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for StockTransfers:", err)
			return
		}
		var validTransfers []StockTransfer
		seenTransfers := make(map[string]bool)
		for _, x := range transfers {
			if x.TransferID != "" && !seenTransfers[x.TransferID] {
				seenTransfers[x.TransferID] = true
				validTransfers = append(validTransfers, x)
			}
		}
		if len(validTransfers) > 0 {
			if err := tx.CreateInBatches(validTransfers, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save StockTransfers:", err)
				return
			}
		}
		var returns []ReturnItem
		if err := fetchSheetDataToStruct("Returns", &returns); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Returns:", err)
			return
		}
		var validReturns []ReturnItem
		seenReturns := make(map[string]bool)
		for _, x := range returns {
			if x.ReturnID != "" && !seenReturns[x.ReturnID] {
				seenReturns[x.ReturnID] = true
				validReturns = append(validReturns, x)
			}
		}
		if len(validReturns) > 0 {
			if err := tx.CreateInBatches(validReturns, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Returns:", err)
				return
			}
		}
		var revs []RevenueEntry
		if err := fetchSheetDataToStruct("RevenueDashboard", &revs); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for RevenueDashboard:", err)
			return
		}
		var validRevs []RevenueEntry
		seenRevs := make(map[uint]bool)
		for _, x := range revs {
			if !seenRevs[x.ID] {
				if x.ID != 0 {
					seenRevs[x.ID] = true
				}
				validRevs = append(validRevs, x)
			}
		}
		if len(validRevs) > 0 {
			if err := tx.CreateInBatches(validRevs, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save RevenueDashboard:", err)
				return
			}
		}
		var chats []ChatMessage
		if err := fetchSheetDataToStruct("ChatMessages", &chats); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for ChatMessages:", err)
			return
		}
		var validChats []ChatMessage
		seenChats := make(map[uint]bool)
		for _, x := range chats {
			if !seenChats[x.ID] {
				if x.ID != 0 {
					seenChats[x.ID] = true
				}
				validChats = append(validChats, x)
			}
		}
		if len(validChats) > 0 {
			if err := tx.CreateInBatches(validChats, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save ChatMessages:", err)
				return
			}
		}
		var editLogs []EditLog
		if err := fetchSheetDataToStruct("EditLogs", &editLogs); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for EditLogs:", err)
			return
		}
		var validEditLogs []EditLog
		seenEditLogs := make(map[uint]bool)
		for _, x := range editLogs {
			if !seenEditLogs[x.ID] {
				if x.ID != 0 {
					seenEditLogs[x.ID] = true
				}
				validEditLogs = append(validEditLogs, x)
			}
		}
		if len(validEditLogs) > 0 {
			if err := tx.CreateInBatches(validEditLogs, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save EditLogs:", err)
				return
			}
		}
		var actLogs []UserActivityLog
		if err := fetchSheetDataToStruct("UserActivityLogs", &actLogs); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for UserActivityLogs:", err)
			return
		}
		var validActLogs []UserActivityLog
		seenActLogs := make(map[uint]bool)
		for _, x := range actLogs {
			if !seenActLogs[x.ID] {
				if x.ID != 0 {
					seenActLogs[x.ID] = true
				}
				validActLogs = append(validActLogs, x)
			}
		}
		if len(validActLogs) > 0 {
			if err := tx.CreateInBatches(validActLogs, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save UserActivityLogs:", err)
				return
			}
		}
		var recs []DriverRecommendation
		if err := fetchSheetDataToStruct("DriverRecommendations", &recs); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for DriverRecommendations:", err)
			return
		}
		var validRecs []DriverRecommendation
		seenRecs := make(map[uint]bool)
		for _, x := range recs {
			if !seenRecs[x.ID] {
				if x.ID != 0 {
					seenRecs[x.ID] = true
				}
				validRecs = append(validRecs, x)
			}
		}
		if len(validRecs) > 0 {
			if err := tx.CreateInBatches(validRecs, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save DriverRecommendations:", err)
				return
			}
		}

		var roles []Role
		if err := fetchSheetDataToStruct("Roles", &roles); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Roles:", err)
			return
		}
		var validRoles []Role
		seenRoles := make(map[uint]bool)
		for _, x := range roles {
			if !seenRoles[x.ID] {
				if x.ID != 0 {
					seenRoles[x.ID] = true
				}
				validRoles = append(validRoles, x)
			}
		}
		if len(validRoles) > 0 {
			if err := tx.CreateInBatches(validRoles, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Roles:", err)
				return
			}
		}

		var perms []RolePermission
		if err := fetchSheetDataToStruct("RolePermissions", &perms); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for RolePermissions:", err)
			return
		}
		var validPerms []RolePermission
		seenPermKeys := make(map[string]bool)
		for _, x := range perms {
			// Deduplicate by Role + Feature (normalized) to be robust
			key := strings.ToLower(x.Role + "|" + x.Feature)
			if x.Role != "" && x.Feature != "" && !seenPermKeys[key] {
				seenPermKeys[key] = true
				x.ID = 0 // Zero out ID to let local DB auto-increment manage it, avoiding PK conflicts
				validPerms = append(validPerms, x)
			}
		}
		if len(validPerms) > 0 {
			if err := tx.CreateInBatches(validPerms, 100).Error; err != nil {
				tx.Rollback()
				log.Printf("❌ Migration failed to save RolePermissions: %v", err)
				return
			}
		}

		var orders []Order
		if err := fetchSheetDataToStruct("AllOrders", &orders); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for AllOrders:", err)
			return
		}
		var validOrders []Order
		seenOrderIDs := make(map[string]bool)
		for _, o := range orders {
			if o.OrderID != "" && !seenOrderIDs[o.OrderID] {
				seenOrderIDs[o.OrderID] = true
				validOrders = append(validOrders, o)
			}
		}
		if len(validOrders) > 0 {
			if err := tx.CreateInBatches(validOrders, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save AllOrders:", err)
				return
			}
		}

		var movies []Movie
		if err := fetchSheetDataToStruct("Movies", &movies); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Movies:", err)
			return
		}
		var validMovies []Movie
		seenMovieIDs := make(map[string]bool)
		for _, x := range movies {
			if x.ID != "" && !seenMovieIDs[x.ID] {
				seenMovieIDs[x.ID] = true
				validMovies = append(validMovies, x)
			}
		}
		if len(validMovies) > 0 {
			if err := tx.CreateInBatches(validMovies, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Movies:", err)
				return
			}
		}

		// Incentive Sheets
		var incProjects []IncentiveProject
		if err := fetchSheetDataToStruct("IncentiveProjects", &incProjects); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for IncentiveProjects:", err)
			return
		}
		if len(incProjects) > 0 {
			if err := tx.CreateInBatches(incProjects, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save IncentiveProjects:", err)
				return
			}
		}

		var incCalcs []IncentiveCalculator
		if err := fetchSheetDataToStruct("IncentiveCalculators", &incCalcs); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for IncentiveCalculators:", err)
			return
		}
		if len(incCalcs) > 0 {
			if err := tx.CreateInBatches(incCalcs, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save IncentiveCalculators:", err)
				return
			}
		}

		var incResults []IncentiveResult
		if err := fetchSheetDataToStruct("IncentiveResults", &incResults); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for IncentiveResults:", err)
			return
		}
		if len(incResults) > 0 {
			if err := tx.CreateInBatches(incResults, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save IncentiveResults:", err)
				return
			}
		}

		var incManual []IncentiveManualData
		if err := fetchSheetDataToStruct("IncentiveManualData", &incManual); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for IncentiveManualData:", err)
			return
		}
		if len(incManual) > 0 {
			if err := tx.CreateInBatches(incManual, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save IncentiveManualData:", err)
				return
			}
		}

		var incCustom []IncentiveCustomPayout
		if err := fetchSheetDataToStruct("IncentiveCustomPayouts", &incCustom); err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for IncentiveCustomPayouts:", err)
			return
		}
		if len(incCustom) > 0 {
			if err := tx.CreateInBatches(incCustom, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save IncentiveCustomPayouts:", err)
				return
			}
		}

		if err := tx.Commit().Error; err != nil {
			log.Println("❌ Migration failed on commit:", err)
		} else {
			log.Println("🎉 Migration ជោគជ័យ!")
		}
	}()
	c.JSON(200, gin.H{"status": "success", "message": "Migration started."})
}

func handleMigrateMovies(c *gin.Context) {
	go func() {
		ctx := context.Background()
		if sheetsService == nil {
			createGoogleAPIClient(ctx)
		}

		// Start Transaction
		tx := DB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
			}
		}()

		log.Println("🗑️ លុបទិន្នន័យ Movie ចាស់ (Resetting Movies table within transaction)...")
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Movie{})

		log.Println("🔄 ចាប់ផ្តើមទាញទិន្នន័យ Movie ថ្មីពី Google Sheet...")

		var movies []Movie
		if err := fetchSheetDataToStruct("Movies", &movies); err != nil {
			tx.Rollback()
			log.Println("❌ Movie Migration failed for Movies:", err)
			return
		}
		var validMovies []Movie
		seenMovieIDs := make(map[string]bool)
		for _, x := range movies {
			if x.ID != "" && !seenMovieIDs[x.ID] {
				seenMovieIDs[x.ID] = true
				validMovies = append(validMovies, x)
			}
		}
		if len(validMovies) > 0 {
			if err := tx.CreateInBatches(validMovies, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Movie Migration failed to save Movies:", err)
				return
			}
		}

		if err := tx.Commit().Error; err != nil {
			log.Println("❌ Movie Migration failed on commit:", err)
		} else {
			log.Println("🎉 Movie Migration ជោគជ័យ!")
		}
	}()
	c.JSON(200, gin.H{"status": "success", "message": "Movie migration started."})
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
		// Sync with Google Sheets via managed queue
		// Note: "AllOrders" is the sheet name for orders.
		// The primary key for an order in the sheet is "Order ID".
		enqueueSync("updateSheet", r.NewData, "AllOrders", map[string]string{"Order ID": r.OrderID})

		// Also send to Telegram via Apps Script (this is a separate action)
		// Sync with Telegram via Apps Script (keep separate for now)
		enqueueSync("updateOrderTelegram", map[string]interface{}{
			"orderId":       r.OrderID,
			"updatedFields": r.NewData,
			"team":          originalOrder.Team,
		}, "", nil) // SheetName and PrimaryKey are not directly applicable for Telegram update action
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
		go func() {
			// Sync with Google Sheets via managed queue
			enqueueSync("deleteRow", nil, "AllOrders", map[string]string{"Order ID": r.OrderID})

			// Also send to Telegram via Apps Script (this is a separate action)
			enqueueSync("deleteOrderTelegram", map[string]interface{}{
				"orderId": r.OrderID, "team": order.Team, "messageId1": order.TelegramMessageID1, "messageId2": order.TelegramMessageID2, "fulfillmentStore": order.FulfillmentStore,
			}, "", nil) // SheetName and PrimaryKey are not directly applicable for Telegram delete action
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
	mappedData := make(map[string]interface{})
	for k, v := range req.NewData {
		dbCol := mapToDBColumn(k)
		if v == nil {
			continue
		}

		// ✅ Prevent overwriting a permanent Google Drive URL with a temporary URL
		if strVal, ok := v.(string); ok && strings.Contains(strVal, "/api/images/temp/") {
			var currentVal string
			if pkCol != "" && pkVal != nil {
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

func handleGetTeamSalesRanking(c *gin.Context) {
	period := c.DefaultQuery("period", "today")

	type TeamRevenue struct {
		TeamName     string  `gorm:"column:team_name"`
		TotalRevenue float64 `gorm:"column:total_revenue"`
	}
	var rows []TeamRevenue

	now := time.Now()

	// Build date filter safely with parameterized values
	db := DB.Table("revenue_entries").
		Select("LOWER(TRIM(team)) as team_name, SUM(COALESCE(revenue, 0))::FLOAT as total_revenue").
		Where("team IS NOT NULL AND team <> '' AND team <> 'Unassigned'").
		Group("team_name").
		Order("total_revenue DESC").
		Limit(10)

	switch period {
	case "today":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		db = db.Where("timestamp::date >= ?", start.Format("2006-01-02"))
	case "this_week":
		offset := int(now.Weekday()) - 1
		if offset < 0 {
			offset = 6
		}
		start := now.AddDate(0, 0, -offset)
		db = db.Where("timestamp::date >= ?", start.Format("2006-01-02"))
	case "this_month":
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		db = db.Where("timestamp::date >= ?", start.Format("2006-01-02"))
	// "all" — no date filter
	}

	if err := db.Scan(&rows).Error; err != nil {
		log.Printf("[ERROR] Team Ranking Query Failed: %v", err)
		c.JSON(500, gin.H{"status": "error", "message": "Query failed"})
		return
	}

	// Build response with proper Title Case display names
	type TeamResult struct {
		Team    string  `json:"Team"`
		Revenue float64 `json:"Revenue"`
	}
	results := make([]TeamResult, 0, len(rows))
	for _, row := range rows {
		displayName := row.TeamName
		words := strings.Fields(displayName)
		for i, w := range words {
			if len(w) > 0 {
				runes := []rune(w)
				runes[0] = unicode.ToUpper(runes[0])
				words[i] = string(runes)
			}
		}
		displayName = strings.Join(words, " ")
		results = append(results, TeamResult{Team: displayName, Revenue: row.TotalRevenue})
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": results})
}

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
			// Sync with Google Sheets via managed queue
			enqueueSync("updateSheet", map[string]interface{}{"Password": string(hashedPassword)}, "Users", map[string]string{"UserName": req.UserName})
		}
	}()

	c.JSON(200, gin.H{"status": "success"})
}

func extractFileIDFromURL(url string) string {
	if strings.Contains(url, "id=") {
		parts := strings.Split(url, "id=")
		if len(parts) > 1 {
			return strings.Split(parts[1], "&")[0]
		}
	}
	return ""
}

func extractDriveFolderID(idOrURL string) string {
	idOrURL = strings.TrimSpace(idOrURL)
	if strings.Contains(idOrURL, "drive.google.com") {
		if strings.Contains(idOrURL, "folders/") {
			parts := strings.Split(idOrURL, "folders/")
			if len(parts) > 1 {
				return strings.Split(strings.Split(parts[1], "?")[0], "/")[0]
			}
		}
		if strings.Contains(idOrURL, "id=") {
			parts := strings.Split(idOrURL, "id=")
			if len(parts) > 1 {
				return strings.Split(parts[1], "&")[0]
			}
		}
	}
	return idOrURL
}

func uploadToGoogleDriveDirectly(base64Data string, fileName string, mimeType string) (string, string, error) {
	log.Printf("📤 [Drive Upload via AppsScript] file=%q mime=%q dataLen=%d", fileName, mimeType, len(base64Data))

	if fileName == "" {
		fileName = "upload_" + time.Now().Format("20060102_150405")
	}

	// Resolve target folder ID (env > DB setting)
	targetFolder := ""
	if envFolderID := os.Getenv("UPLOAD_FOLDER_ID"); envFolderID != "" {
		targetFolder = extractDriveFolderID(envFolderID)
		log.Printf("📁 [Drive Upload] Folder from UPLOAD_FOLDER_ID env: %q", targetFolder)
	} else if uploadFolderID != "" {
		targetFolder = extractDriveFolderID(uploadFolderID)
		log.Printf("📁 [Drive Upload] Folder from DB setting: %q", targetFolder)
	} else {
		log.Println("⚠️ [Drive Upload] No UPLOAD_FOLDER_ID set — uploading to Drive root")
	}

	// Call Apps Script to upload via Google user quota (not Service Account quota)
	req := AppsScriptRequest{
		Action:         "uploadImage",
		FileData:       base64Data,
		FileName:       fileName,
		MimeType:       mimeType,
		UploadFolderID: targetFolder,
	}

	log.Printf("🚀 [Drive Upload] Calling Apps Script uploadImage action...")
	resp, err := callAppsScriptPOST(req)
	if err != nil {
		log.Printf("❌ [Drive Upload] Apps Script call error: %v", err)
		return "", "", fmt.Errorf("apps script upload error: %v", err)
	}
	if resp.Status != "success" || resp.URL == "" {
		log.Printf("❌ [Drive Upload] Apps Script returned error: %s", resp.Message)
		return "", "", fmt.Errorf("apps script upload failed: %s", resp.Message)
	}

	log.Printf("✅ [Drive Upload] SUCCESS via Apps Script: fileID=%s url=%s", resp.FileID, resp.URL)
	return resp.URL, resp.FileID, nil
}

func handleServeTempImage(c *gin.Context) {
	id := c.Param("id")
	var temp TempImage
	if err := DB.Where("id = ?", id).First(&temp).Error; err != nil {
		c.JSON(404, gin.H{"error": "រកមិនឃើញរូបភាព ឬផុតកំណត់"})
		return
	}
	decodedBytes, _ := parseBase64(temp.ImageData)
	c.Data(200, temp.MimeType, decodedBytes)
}

func handleImageUploadProxy(c *gin.Context) {
	var req AppsScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		return
	}

	data := req.FileData
	if data == "" {
		data = req.Image
	}
	if data == "" {
		c.Error(fmt.Errorf("មិនមានទិន្នន័យឯកសារ"))
		return
	}

	tempID := generateShortID() + generateShortID()
	DB.Create(&TempImage{ID: tempID, MimeType: req.MimeType, ImageData: data, ExpiresAt: time.Now().Add(15 * time.Minute)})

	protocol := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		protocol = "https"
	}
	tempUrl := fmt.Sprintf("%s://%s/api/images/temp/%s", protocol, c.Request.Host, tempID)

	c.JSON(200, gin.H{
		"status":  "success",
		"message": "Processing upload...",
		"tempUrl": tempUrl,
		"url":     tempUrl,
	})

	go func(r AppsScriptRequest, rawData string, tid string) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("🔥 PANIC in background upload: %v", rec)
			}
		}()

		log.Printf("⏳ [Background Upload] Starting for tempID=%s file=%q mime=%q", tid, r.FileName, r.MimeType)
		driveURL, fileID, err := uploadToGoogleDriveDirectly(rawData, r.FileName, r.MimeType)
		if err != nil {
			log.Printf("❌ [Background Upload] FAILED for tempID=%s: %v", tid, err)
			return
		}
		log.Printf("✅ [Background Upload] SUCCESS tempID=%s fileID=%s driveURL=%s", tid, fileID, driveURL)

		// Save the resolved DriveURL in TempImage for later retrieval (if needed by CreateMovie)
		DB.Model(&TempImage{}).Where("id = ?", tid).UpdateColumn("drive_url", driveURL)

		// 1. Specialized Order Update (Needs Team for Telegram)
		if r.OrderID != "" && r.TargetColumn != "" {
			log.Printf("📦 [Background Update] Specialized Order update: orderId=%s col=%s", r.OrderID, r.TargetColumn)
			dbCol := mapToDBColumn(r.TargetColumn)
			if isValidOrderColumn(dbCol) {
				var order Order
				team := ""
				if err := DB.Where("order_id = ?", r.OrderID).First(&order).Error; err == nil {
					team = order.Team
					DB.Model(&order).UpdateColumn(dbCol, driveURL)
				} else {
					DB.Model(&Order{}).Where("order_id = ?", r.OrderID).UpdateColumn(dbCol, driveURL)
				}

				event, _ := json.Marshal(map[string]interface{}{
					"type":    "update_order",
					"orderId": r.OrderID,
					"newData": map[string]interface{}{r.TargetColumn: driveURL},
				})
				hub.Broadcast <- event

				enqueueSync("updateOrderTelegram", map[string]interface{}{
					"orderId":       r.OrderID,
					"team":          team,
					"updatedFields": map[string]interface{}{r.TargetColumn: driveURL},
				}, "", nil)
			}
		}

		// 2. Specialized User Profile Update
		if r.UserName != "" {
			log.Printf("👤 [Background Update] Specialized User update: userName=%s", r.UserName)
			DB.Model(&User{}).Where("user_name = ?", r.UserName).UpdateColumn("profile_picture_url", driveURL)
			
			notify, _ := json.Marshal(map[string]interface{}{
				"type":     "profile_image_ready",
				"userName": r.UserName,
				"url":      driveURL,
			})
			hub.Broadcast <- notify

			// Also sync with Google Sheets
			enqueueSync("updateSheet", map[string]interface{}{"ProfilePictureURL": driveURL}, "Users", map[string]string{"UserName": r.UserName})
		}

		// 3. Specialized Movie Update
		if r.MovieID != "" && r.TargetColumn != "" {
			log.Printf("🎬 [Background Update] Specialized Movie update: movieId=%s col=%s", r.MovieID, r.TargetColumn)
			dbCol := mapToDBColumn(r.TargetColumn)
			
			// Retry updating the database for up to 1 minute (for new records being created)
			for i := 0; i < 12; i++ {
				res := DB.Model(&Movie{}).Where("id = ?", r.MovieID).UpdateColumn(dbCol, driveURL)
				if res.Error == nil && res.RowsAffected > 0 {
					log.Printf("✅ [Background Update] SUCCESS: Updated movie %s column %s", r.MovieID, dbCol)
					break
				}
				log.Printf("⏳ [Background Update] Waiting for movie record %s... (attempt %d)", r.MovieID, i+1)
				time.Sleep(5 * time.Second)
			}

			// Also sync with Google Sheets if updated or if it's a known record
			enqueueSync("updateSheet", map[string]interface{}{r.TargetColumn: driveURL}, "Movies", map[string]string{"ID": r.MovieID})
			
			// If we have a movie title, rename the file in Drive to match
			fID := extractFileIDFromURL(driveURL)
			if fID != "" {
				var mv Movie
				if err := DB.Where("id = ?", r.MovieID).First(&mv).Error; err == nil && mv.Title != "" {
					log.Printf("📂 [Background Update] Renaming Drive file %s to %q", fID, mv.Title)
					enqueueSync("renameFile", map[string]interface{}{
						"fileID":  fID,
						"newName": mv.Title,
					}, "", nil)
				}
			}

			// Broadcast update
			notify, _ := json.Marshal(map[string]interface{}{
				"type":    "movie_thumbnail_ready",
				"movieId": r.MovieID,
				"url":     driveURL,
			})
			hub.Broadcast <- notify
		}

		// 4. Generic Table/Sheet Update (Handles other tables)
		if r.SheetName != "" && r.PrimaryKey != nil && r.TargetColumn != "" && r.SheetName != "Movies" {
			log.Printf("📝 [Background Update] Generic update for sheet=%s PK=%v col=%s", r.SheetName, r.PrimaryKey, r.TargetColumn)
			
			// Sync with Google Sheets via managed queue
			enqueueSync("updateSheet", map[string]interface{}{r.TargetColumn: driveURL}, r.SheetName, r.PrimaryKey)

			// Update PostgreSQL
			tableName := getTableName(r.SheetName)
			if tableName != "" {
				dbCol := mapToDBColumn(r.TargetColumn)
				query := DB.Table(tableName)
				for k, v := range r.PrimaryKey {
					query = query.Where(mapToDBColumn(k)+" = ?", v)
				}
				res := query.UpdateColumn(dbCol, driveURL)
				if res.Error != nil {
					log.Printf("❌ [Background Update] DB update failed for %s: %v", tableName, res.Error)
				} else if res.RowsAffected == 0 {
					log.Printf("⚠️ [Background Update] No rows affected for %s (PK: %v)", tableName, r.PrimaryKey)
				} else {
					log.Printf("✅ [Background Update] DB updated for %s (%s)", tableName, r.TargetColumn)
				}
			}
		}

		log.Printf("✅ Background upload complete: %s", driveURL)
	}(req, data, tempID)
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

			driveURL, fileId, err := uploadToGoogleDriveDirectly(b64, "chat_file", mt)
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
func handleGetAudioProxy(c *gin.Context) {
	fileID := c.Param("fileID")
	resp, err := http.Get(fmt.Sprintf("https://drive.google.com/uc?id=%s&export=download", fileID))
	if err != nil || resp.StatusCode != 200 {
		c.Error(fmt.Errorf("failed to fetch audio"))
		return
	}
	defer resp.Body.Close()
	c.Writer.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	io.Copy(c.Writer, resp.Body)
}

// =========================================================================
// API សម្រាប់ប្រព័ន្ធ ENTERTAINMENT (HLS & Video Proxy)
// =========================================================================

func handleExtractM3U8(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("🔥 PANIC in handleExtractM3U8: %v", r)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal Server Error during extraction"})
		}
	}()

	targetURL := c.Query("url")
	referer := c.Query("referer")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing url parameter"})
		return
	}

	log.Printf("🔍 Extracting M3U8 from: %s", targetURL)

	u, err := url.Parse(targetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid URL"})
		return
	}

	fetchReferer := referer
	if fetchReferer == "" {
		fetchReferer = u.Scheme + "://" + u.Host
	}

	client := &http.Client{Timeout: 15 * time.Second}
	req, _ := http.NewRequest("GET", targetURL, nil)
	req.Header.Set("Referer", fetchReferer)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	html := string(body)

	var m3u8URL string

	// 1. Check for sitewise specific logic (e.g., khfullhd.co)
	if strings.Contains(targetURL, "khfullhd.co") {
		iframeRe := regexp.MustCompile(`(?i)<iframe.*?src=["']([^"']+)["']`)
		iframes := iframeRe.FindAllStringSubmatch(html, -1)
		for _, iframe := range iframes {
			src := iframe[1]
			if strings.Contains(src, "player.php") || strings.Contains(src, "v.php") {
				playerURL := resolveURL(targetURL, src)
				// Fetch the iframe content
				pReq, _ := http.NewRequest("GET", playerURL, nil)
				pReq.Header.Set("Referer", targetURL)
				pReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
				pResp, pErr := client.Do(pReq)
				if pErr == nil && pResp != nil {
					pBody, _ := io.ReadAll(pResp.Body)
					pResp.Body.Close()
					if len(pBody) > 0 {
						html = string(pBody)
						targetURL = playerURL
					}
				}
				break
			}
		}
	}

	// 2. Advanced Scraping: Look for playlist variables (model from zip)
	if m3u8URL == "" {
		playlistRe := regexp.MustCompile(`var playlist = (\[.*?\]);`)
		playlistMatch := playlistRe.FindStringSubmatch(html)
		if len(playlistMatch) > 1 {
			fileRe := regexp.MustCompile(`file:\s*["']([^"']+(\.m3u8|\.mp4|/hlsplaylist/|/hls/)[^"']*)["']`)
			fileMatch := fileRe.FindStringSubmatch(playlistMatch[1])
			if len(fileMatch) > 1 {
				m3u8URL = fileMatch[1]
			}
		}
	}

	// 3. Dooplay Player Option Extraction
	if m3u8URL == "" && strings.Contains(html, "dooplay_player_option") {
		// Look for dtAjax
		dtAjaxRe := regexp.MustCompile(`var dtAjax = (\{.*?\});`)
		dtAjaxMatch := dtAjaxRe.FindStringSubmatch(html)
		if len(dtAjaxMatch) > 1 {
			var dtAjax struct {
				PlayerAPI string `json:"player_api"`
				URL       string `json:"url"`
			}
			json.Unmarshal([]byte(dtAjaxMatch[1]), &dtAjax)

			// Look for player options
			optionRe := regexp.MustCompile(`class=['"]dooplay_player_option['"].*?data-post=['"](\d+)['"].*?data-nume=['"](\w+)['"].*?data-type=['"](\w+)['"]`)
			options := optionRe.FindAllStringSubmatch(html, -1)

			for _, opt := range options {
				if opt[2] == "trailer" {
					continue
				}
				postID, nume, dtype := opt[1], opt[2], opt[3]
				var apiURL string
				isAjax := false

				if dtAjax.PlayerAPI != "" {
					apiURL = dtAjax.PlayerAPI + postID + "/" + dtype + "/" + nume
				} else if dtAjax.URL != "" {
					apiURL = dtAjax.URL + "?action=doo_player_ajax&post=" + postID + "&nume=" + nume + "&type=" + dtype
					isAjax = true
				}

				if apiURL != "" {
					if strings.HasPrefix(apiURL, "/") {
						apiURL = u.Scheme + "://" + u.Host + apiURL
					}

					var apiReq *http.Request
					if isAjax {
						apiReq, _ = http.NewRequest("POST", apiURL, nil)
					} else {
						apiReq, _ = http.NewRequest("GET", apiURL, nil)
					}
					apiReq.Header.Set("Referer", targetURL)
					apiReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
					apiReq.Header.Set("X-Requested-With", "XMLHttpRequest")

					apiResp, err := client.Do(apiReq)
					if err == nil {
						apiBody, _ := io.ReadAll(apiResp.Body)
						apiResp.Body.Close()
						var result struct {
							EmbedURL string `json:"embed_url"`
						}
						json.Unmarshal(apiBody, &result)
						if result.EmbedURL != "" {
							// If it's an iframe, extract src
							iframeSrcRe := regexp.MustCompile(`src=['"]([^'"]+)['"]`)
							iframeSrcMatch := iframeSrcRe.FindStringSubmatch(result.EmbedURL)
							if len(iframeSrcMatch) > 1 {
								m3u8URL = iframeSrcMatch[1]
							} else {
								m3u8URL = result.EmbedURL
							}
							break
						}
					}
				}
			}
		}
	}

	// 4. Iframe Extraction (Recursive-like search)
	if m3u8URL == "" {
		iframeRe := regexp.MustCompile(`(?i)<iframe.*?src=["']([^"']+)["']`)
		iframes := iframeRe.FindAllStringSubmatch(html, -1)
		for _, iframe := range iframes {
			src := iframe[1]
			if strings.Contains(src, "googletagmanager") || strings.Contains(src, "facebook") || strings.Contains(src, "plugins") {
				continue
			}
			// If it's already a .m3u8, we found it
			if strings.Contains(src, ".m3u8") || strings.Contains(src, "/hlsplaylist/") || strings.Contains(src, "/hls/") {
				m3u8URL = src
				break
			}

			// Deep scrape the iframe (Advanced iframe extraction)
			if strings.HasPrefix(src, "//") {
				src = "https:" + src
			} else if !strings.HasPrefix(src, "http") {
				src = resolveURL(targetURL, src)
			}

			iframeReq, errReq := http.NewRequest("GET", src, nil)
			if errReq != nil || iframeReq == nil {
				continue
			}

			iframeReq.Header.Set("Referer", targetURL)
			iframeReq.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

			iframeResp, err := client.Do(iframeReq)
			if err == nil {
				iframeBody, _ := io.ReadAll(iframeResp.Body)
				iframeResp.Body.Close()
				iframeHtml := string(iframeBody)

				// Standard URL regex
				re := regexp.MustCompile(`(["'])(https?://[^"']+(\.m3u8|\.mp4|/hlsplaylist/|/hls/)[^"']*)\1`)
				matches := re.FindAllStringSubmatch(iframeHtml, -1)
				for _, match := range matches {
					found := strings.ReplaceAll(match[2], "\\/", "/")
					if !strings.Contains(found, "ads") && !strings.Contains(found, "videoAd") {
						m3u8URL = found
						targetURL = src // Update referer for the proxy to use the iframe's URL
						break
					}
				}

				// Special JS file variables
				if m3u8URL == "" {
					fileRe := regexp.MustCompile(`file:\s*["']([^"']+(\.m3u8|\.mp4)[^"']*)["']`)
					fileMatch := fileRe.FindStringSubmatch(iframeHtml)
					if len(fileMatch) > 1 {
						m3u8URL = strings.ReplaceAll(fileMatch[1], "\\/", "/")
						targetURL = src
					}
				}

				// HTML5 Source tag
				if m3u8URL == "" {
					sourceRe := regexp.MustCompile(`(?i)<source.*?src=["']([^"']+(\.m3u8|\.mp4)[^"']*)["']`)
					sourceMatch := sourceRe.FindStringSubmatch(iframeHtml)
					if len(sourceMatch) > 1 {
						m3u8URL = strings.ReplaceAll(sourceMatch[1], "\\/", "/")
						targetURL = src
					}
				}
			}

			if m3u8URL != "" {
				if !strings.HasPrefix(m3u8URL, "http") {
					m3u8URL = resolveURL(src, m3u8URL)
				}
				break
			}

			// Ultimately, fallback to iframe src
			m3u8URL = src
			break
		}
	}

	// 5. Final Regex Search (Improved)
	if m3u8URL == "" {
		// Try playlist regex with broad HLS patterns, ignoring ads
		re := regexp.MustCompile(`(["'])(https?://[^"']+(\.m3u8|\.mp4|/hlsplaylist/|/hls/)[^"']*)\1`)
		matches := re.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			found := match[2]
			if !strings.Contains(found, "ads") && !strings.Contains(found, "videoAd") {
				m3u8URL = found
				break
			}
		}
	}

	if m3u8URL == "" {
		// Try simple regex as fallback
		reSimple := regexp.MustCompile(`https?://[^\s"'<>]+?(\.m3u8|\.mp4|/hlsplaylist/|/hls/)[^\s"'<>]*`)
		matches := reSimple.FindAllString(html, -1)
		for _, found := range matches {
			if !strings.Contains(found, "ads") && !strings.Contains(found, "videoAd") {
				m3u8URL = found
				break
			}
		}
	}

	if m3u8URL != "" {
		if strings.HasPrefix(m3u8URL, "//") {
			m3u8URL = "https:" + m3u8URL
		} else if !strings.HasPrefix(m3u8URL, "http") {
			m3u8URL = resolveURL(targetURL, m3u8URL)
		}
		c.JSON(http.StatusOK, gin.H{
			"m3u8Url": m3u8URL,
			"referer": targetURL,
		})
		return
	}

	c.JSON(http.StatusNotFound, gin.H{"error": "Could not extract HLS link from the page."})
}

func handleProxyM3U8(c *gin.Context) {
	m3u8URL := c.Query("url")
	if m3u8URL == "" {
		c.String(http.StatusBadRequest, "Missing url parameter")
		return
	}

	u, err := url.Parse(m3u8URL)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid URL")
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, _ := http.NewRequest("GET", m3u8URL, nil)

	targetReferer := c.Query("referer")
	if targetReferer != "" {
		req.Header.Set("Referer", targetReferer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.String(resp.StatusCode, "Failed to fetch m3u8")
		return
	}

	var rewrittenLines []string
	var lines []string
	isMasterPlaylist := false

	// Increase scanner buffer to handle long lines in M3U8 files
	scanner := bufio.NewScanner(resp.Body)
	buf := make([]byte, 0, 1024*1024) // 1MB buffer
	scanner.Buffer(buf, 1024*1024)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			rewrittenLines = append(rewrittenLines, "")
			continue
		}
		if strings.Contains(line, "#EXT-X-STREAM-INF") {
			isMasterPlaylist = true
		}
		lines = append(lines, line)
	}

	// Determine absolute backend host URL
	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	backendBaseURL := fmt.Sprintf("%s://%s", scheme, c.Request.Host)

	for _, line := range lines {
		if line == "" {
			rewrittenLines = append(rewrittenLines, "")
			continue
		}

		if strings.HasPrefix(line, "#") {
			// Rewrite URIs in tags like #EXT-X-KEY:URI="...", #EXT-X-MEDIA:URI="...", etc.
			if strings.Contains(line, "URI=") {
				re := regexp.MustCompile(`URI="([^"]+)"`)
				newLine := re.ReplaceAllStringFunc(line, func(match string) string {
					subMatch := re.FindStringSubmatch(match)
					if len(subMatch) > 1 {
						uri := subMatch[1]
						absURL := resolveURL(m3u8URL, uri)

						// Check if it's a playlist or a segment
						lowerAbsURL := strings.ToLower(absURL)
						isImageOrSegment := strings.HasSuffix(lowerAbsURL, ".ts") || strings.HasSuffix(lowerAbsURL, ".jpg") || strings.HasSuffix(lowerAbsURL, ".jpeg") || strings.HasSuffix(lowerAbsURL, ".vtt") || strings.HasSuffix(lowerAbsURL, ".mp4") || strings.HasSuffix(lowerAbsURL, ".m4s")
						isPlaylist := strings.Contains(lowerAbsURL, ".m3u8") || (!isImageOrSegment && (strings.Contains(lowerAbsURL, "/hlsplaylist/") || strings.Contains(lowerAbsURL, "/hls/")))
						endpoint := backendBaseURL + "/api/proxy-ts"
						if isPlaylist {
							endpoint = backendBaseURL + "/api/proxy-m3u8"
						}

						refererParam := ""
						if targetReferer != "" {
							refererParam = fmt.Sprintf("&referer=%s", url.QueryEscape(targetReferer))
						}
						return fmt.Sprintf(`URI="%s?url=%s%s"`, endpoint, url.QueryEscape(absURL), refererParam)
					}
					return match
				})
				rewrittenLines = append(rewrittenLines, newLine)
			} else {
				rewrittenLines = append(rewrittenLines, line)
			}
			continue
		}

		// It's a URL line (segment or sub-playlist)
		absURL := resolveURL(m3u8URL, line)

		refererParam := ""
		if targetReferer != "" {
			refererParam = fmt.Sprintf("&referer=%s", url.QueryEscape(targetReferer))
		}
		lowerAbsURL := strings.ToLower(absURL)
		isImageOrSegment := strings.HasSuffix(lowerAbsURL, ".ts") || strings.HasSuffix(lowerAbsURL, ".jpg") || strings.HasSuffix(lowerAbsURL, ".jpeg") || strings.HasSuffix(lowerAbsURL, ".vtt") || strings.HasSuffix(lowerAbsURL, ".mp4") || strings.HasSuffix(lowerAbsURL, ".m4s")

		if isMasterPlaylist || strings.Contains(lowerAbsURL, ".m3u8") || (!isImageOrSegment && (strings.Contains(lowerAbsURL, "/hlsplaylist/") || strings.Contains(lowerAbsURL, "/hls/"))) {
			rewrittenLines = append(rewrittenLines, fmt.Sprintf("%s/api/proxy-m3u8?url=%s%s", backendBaseURL, url.QueryEscape(absURL), refererParam))
		} else {
			rewrittenLines = append(rewrittenLines, fmt.Sprintf("%s/api/proxy-ts?url=%s%s", backendBaseURL, url.QueryEscape(absURL), refererParam))
		}
	}

	c.Header("Content-Type", "application/vnd.apple.mpegurl")
	c.Header("Access-Control-Allow-Origin", "*")
	c.String(http.StatusOK, strings.Join(rewrittenLines, "\n"))
}

func handleProxyTS(c *gin.Context) {
	tsURL := c.Query("url")
	if tsURL == "" {
		c.String(http.StatusBadRequest, "Missing url parameter")
		return
	}

	u, err := url.Parse(tsURL)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid URL")
		return
	}

	client := &http.Client{Timeout: 60 * time.Second}
	req, _ := http.NewRequest("GET", tsURL, nil)

	// Copy Range header for fragmented MP4 support
	if rangeHeader := c.Request.Header.Get("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	targetReferer := c.Query("referer")
	if targetReferer != "" {
		req.Header.Set("Referer", targetReferer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusPartialContent {
		c.String(resp.StatusCode, "Failed to fetch segment")
		return
	}

	// Forward response headers
	for k, v := range resp.Header {
		if k == "Content-Length" || k == "Content-Range" || k == "Accept-Ranges" {
			c.Header(k, v[0])
		}
	}

	// Force Content-Type to match expected video segments and ignore origin obfuscation
	ext := strings.ToLower(filepath.Ext(tsURL))
	if ext == ".m4s" || ext == ".mp4" || strings.Contains(tsURL, ".m4s") || strings.Contains(tsURL, ".mp4") {
		c.Header("Content-Type", "video/mp4")
	} else if ext == ".m3u8" || strings.Contains(tsURL, ".m3u8") {
		c.Header("Content-Type", "application/vnd.apple.mpegurl")
	} else if ext == ".jpg" || ext == ".jpeg" || strings.Contains(tsURL, "thumbnails") {
		c.Header("Content-Type", "image/jpeg")
	} else if ext == ".vtt" || strings.Contains(tsURL, ".vtt") {
		c.Header("Content-Type", "text/vtt")
	} else {
		// Force MP2T for any other stream chunk (Overrides things like image/png)
		c.Header("Content-Type", "video/MP2T")
	}

	c.Header("Access-Control-Allow-Origin", "*")
	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

func handleFetchJSON(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing url parameter"})
		return
	}

	u, err := url.Parse(targetURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid URL"})
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	var req *http.Request

	// Complex Fetch Logic for AJAX
	if c.Request.Method == "POST" || (u.RawQuery != "" && strings.Contains(targetURL, "admin-ajax.php")) {
		var bodyReader io.Reader
		contentType := "application/x-www-form-urlencoded"

		if u.RawQuery != "" && strings.Contains(targetURL, "admin-ajax.php") {
			// Convert query params to form body for admin-ajax requests
			form := url.Values{}
			for k, v := range u.Query() {
				form.Set(k, v[0])
			}
			bodyReader = strings.NewReader(form.Encode())
			// Clear query from URL
			u.RawQuery = ""
			targetURL = u.String()
		} else {
			body, _ := io.ReadAll(c.Request.Body)
			bodyReader = bytes.NewBuffer(body)
			if ct := c.Request.Header.Get("Content-Type"); ct != "" {
				contentType = ct
			}
		}

		req, _ = http.NewRequest("POST", targetURL, bodyReader)
		req.Header.Set("Content-Type", contentType)
	} else {
		req, _ = http.NewRequest("GET", targetURL, nil)
	}

	referer := c.Query("referer")
	if referer != "" {
		req.Header.Set("Referer", referer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")

	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	// Forward Content-Type from target
	respContentType := resp.Header.Get("Content-Type")
	if respContentType == "" {
		respContentType = "application/json"
	}

	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), body)
}

func handleProxyVideo(c *gin.Context) {
	targetURL := c.Query("url")
	if targetURL == "" {
		c.String(http.StatusBadRequest, "Missing url parameter")
		return
	}

	u, err := url.Parse(targetURL)
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid URL")
		return
	}

	client := &http.Client{
		Timeout: 300 * time.Second, // Longer timeout for video streaming
	}
	req, _ := http.NewRequest("GET", targetURL, nil)

	// Forward Range header and others
	for k, v := range c.Request.Header {
		if k == "Range" || k == "User-Agent" || k == "Accept" {
			req.Header.Set(k, v[0])
		}
	}

	referer := c.Query("referer")
	if referer != "" {
		req.Header.Set("Referer", referer)
	} else {
		req.Header.Set("Referer", u.Scheme+"://"+u.Host)
	}

	resp, err := client.Do(req)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	defer resp.Body.Close()

	// Forward response headers back to the client
	for k, v := range resp.Header {
		if k == "Content-Type" || k == "Content-Length" || k == "Accept-Ranges" || k == "Content-Range" || k == "Last-Modified" || k == "ETag" {
			c.Header(k, v[0])
		}
	}
	c.Header("Access-Control-Allow-Origin", "*")

	c.Status(resp.StatusCode)
	io.Copy(c.Writer, resp.Body)
}

func resolveURL(base, ref string) string {
	baseURL, _ := url.Parse(base)
	refURL, _ := url.Parse(ref)
	return baseURL.ResolveReference(refURL).String()
}

// =========================================================================
// API សម្រាប់ប្រព័ន្ធ ENTERTAINMENT & VIDEO PROXY
// =========================================================================

func handleGetMovies(c *gin.Context) {
	var movies []Movie
	DB.Order("added_at desc").Find(&movies)

	// Inject sample series data for testing UX
	sampleSeries := []Movie{
		{ID: "series-1-ep1", Title: "Squid Game - Ep 1", Description: "Red Light, Green Light.", Thumbnail: "https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "Korean", Country: "South Korea", Category: "Thriller", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-1-ep2", Title: "Squid Game - Ep 2", Description: "Hell.", Thumbnail: "https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "Korean", Country: "South Korea", Category: "Thriller", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-1-ep3", Title: "Squid Game - Ep 3", Description: "The Man with the Umbrella.", Thumbnail: "https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "Korean", Country: "South Korea", Category: "Thriller", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-2-ep1", Title: "Stranger Things - Ep 1", Description: "The Vanishing of Will Byers.", Thumbnail: "https://image.tmdb.org/t/p/original/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "English", Country: "USA", Category: "Sci-Fi", AddedAt: time.Now().Format(time.RFC3339)},
		{ID: "series-2-ep2", Title: "Stranger Things - Ep 2", Description: "The Weirdo on Maple Street.", Thumbnail: "https://image.tmdb.org/t/p/original/x2LSRK2Cm7MZhjluni1msVJ3wDF.jpg", VideoURL: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", Type: "series", Language: "English", Country: "USA", Category: "Sci-Fi", AddedAt: time.Now().Format(time.RFC3339)},
	}

	// Only add sample series if the database has none or very few
	hasSeries := false
	for _, m := range movies {
		if m.Type == "series" {
			hasSeries = true
			break
		}
	}

	if !hasSeries {
		movies = append(sampleSeries, movies...)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": movies})
}

func handleCreateMovie(c *gin.Context) {
	var movie Movie
	if err := c.ShouldBindJSON(&movie); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ទិន្នន័យមិនត្រឹមត្រូវ: " + err.Error()})
		return
	}

	// Smart Image Resolution: If Thumbnail is a temp URL, resolve it to permanent DriveURL
	if strings.Contains(movie.Thumbnail, "/api/images/temp/") {
		parts := strings.Split(movie.Thumbnail, "/api/images/temp/")
		if len(parts) > 1 {
			tempID := parts[1]
			// Robust extraction: remove any trailing slashes or query parameters
			if idx := strings.IndexAny(tempID, "?/"); idx != -1 {
				tempID = tempID[:idx]
			}
			tempID = strings.TrimSpace(tempID)

			var tempImg TempImage

			// Poll database for up to 30 seconds waiting for the background upload to finish
			resolved := false
			for i := 0; i < 30; i++ {
				if err := DB.Where("id = ?", tempID).First(&tempImg).Error; err == nil && tempImg.DriveURL != "" {
					movie.Thumbnail = tempImg.DriveURL
					log.Printf("✨ Resolved temp image %s to permanent URL: %s", tempID, movie.Thumbnail)
					resolved = true
					break
				}
				time.Sleep(1 * time.Second)
			}

			if !resolved {
				log.Printf("⚠️ Warning: Could not resolve permanent Drive URL for temp image %s within timeout. Record will be saved with temporary URL.", tempID)
			}
		}
	}

	if movie.ID == "" {
		movie.ID = generateShortID()
	}
	if movie.AddedAt == "" {
		movie.AddedAt = time.Now().Format(time.RFC3339)
	}

	if err := DB.Create(&movie).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ការរក្សាទុកភាពយន្តបរាជ័យ: " + err.Error()})
		return
	}

	// Send to Google Sheets and Rename Drive file in background
	go func(m Movie) {
		// 1. Sync to Sheets
		enqueueSync("addRow", map[string]interface{}{
			"ID":          m.ID,
			"Title":       m.Title,
			"Description": m.Description,
			"Thumbnail":   m.Thumbnail,
			"VideoURL":    m.VideoURL,
			"Type":        m.Type,
			"Language":    m.Language,
			"Country":     m.Country,
			"Category":    m.Category,
			"SeriesKey":   m.SeriesKey,
			"AddedAt":     m.AddedAt,
		}, "Movies", nil)

		// 2. If thumbnail is a permanent Drive URL, rename it to match movie title
		fileID := extractFileIDFromURL(m.Thumbnail)
		if fileID != "" {
			log.Printf("📂 [Background] Renaming Drive file %s to %q", fileID, m.Title)
			enqueueSync("renameFile", map[string]interface{}{
				"fileID":  fileID,
				"newName": m.Title,
			}, "", nil)
		}
	}(movie)

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": movie})
}

func handleDeleteMovie(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "ID មិនអាចទទេរបានទេ"})
		return
	}

	if err := DB.Where("id = ?", id).Delete(&Movie{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "ការលុបភាពយន្តបរាជ័យ: " + err.Error()})
		return
	}

	// Delete from Google Sheets via managed queue
	go func(movieID string) {
		enqueueSync("deleteRow", nil, "Movies", map[string]string{"ID": movieID})
	}(id)

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "បានលុបភាពយន្តដោយជោគជ័យ"})
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

	if req.Secret != appsScriptSecret {
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
		if isNumericHeader(k) {
			if s, ok := v.(string); ok {
				if f, err := strconv.ParseFloat(s, 64); err == nil {
					mappedData[dbCol] = f
				}
			} else {
				mappedData[dbCol] = v
			}
		} else if isBoolHeader(k) {
			if s, ok := v.(string); ok {
				mappedData[dbCol] = strings.ToUpper(s) == "TRUE"
			} else {
				mappedData[dbCol] = v
			}
		} else {
			mappedData[dbCol] = fmt.Sprintf("%v", v)
		}
	}

	if pkCol == "" || pkVal == nil {
		c.JSON(400, gin.H{"status": "error", "message": "Missing primary key"})
		return
	}

	if req.Action == "delete" {
		DB.Table(tableName).Where(pkCol+" = ?", pkVal).Delete(nil)
	} else {
		// UPSERT logic: Try to update first
		result := DB.Table(tableName).Where(pkCol+" = ?", pkVal).Updates(mappedData)
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
	spreadsheetID = os.Getenv("GOOGLE_SHEET_ID")
	appsScriptURL = os.Getenv("APPS_SCRIPT_URL")
	appsScriptSecret = os.Getenv("APPS_SCRIPT_SECRET")
	backend.AppsScriptURL = appsScriptURL
	backend.AppsScriptSecret = appsScriptSecret
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
		startSyncManager(3)
		go startOrderWorker()
		startScheduler()
		createGoogleAPIClient(context.Background())
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
	api.GET("/images/temp/:id", handleServeTempImage)
	api.GET("/teams/ranking", handleGetTeamSalesRanking)
	api.GET("/settings", handleGetSettings)
	api.GET("/movies", handleGetMovies)
	api.GET("/extract-m3u8", handleExtractM3U8)
	api.GET("/proxy-m3u8", handleProxyM3U8)
	api.GET("/proxy-ts", handleProxyTS)
	api.GET("/proxy-video", handleProxyVideo)
	api.Any("/fetch-json", handleFetchJSON)
	api.POST("/webhook/sheets-sync", handleSheetsWebhook)
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
		protected.GET("/teams/shipping-costs", RequirePermission("view_revenue"), handleGetGlobalShippingCosts)

		chat := protected.Group("/chat")
		chat.GET("/messages", handleGetChatMessages)
		chat.POST("/send", handleSendChatMessage)
		chat.POST("/delete", handleDeleteChatMessage)

		admin := protected.Group("/admin")
		admin.Use(AdminOnlyMiddleware())
		{
			admin.GET("/orders", RequirePermission("view_order_list"), handleGetAllOrders)
			admin.POST("/update-order", RequirePermission("edit_order"), handleAdminUpdateOrder)
			admin.POST("/migrate-data", handleMigrateData)
			admin.POST("/migrate-movies", handleMigrateMovies)
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
			admin.POST("/movies", handleCreateMovie)
			admin.DELETE("/movies/:id", handleDeleteMovie)
		}
		profile := protected.Group("/profile")
		profile.POST("/update", handleUpdateProfile)
		profile.POST("/change-password", handleChangePassword)
	}
	api.GET("/chat/ws", AuthMiddleware(), serveWs)
	api.GET("/chat/audio/:fileID", handleGetAudioProxy)
	r.Run("0.0.0.0:" + port)
}