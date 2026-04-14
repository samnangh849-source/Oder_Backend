package backend

// =========================================================================
// DATA MIGRATION — Google Sheets → PostgreSQL
// =========================================================================
// ឯកសារនេះរួមបញ្ចូល logic ទាំងអស់ដែលពាក់ព័ន្ធនឹងការ Migrate ទិន្នន័យ
// ពី Google Sheets ទៅ PostgreSQL database:
//
//   - SheetRanges              — map ឈ្មោះ Sheet → range A:Z
//   - SheetsService / DriveService / SpreadsheetID / UploadFolderID
//                              — shared Google API state (set by main.go)
//   - CreateGoogleAPIClient()  — init Google Sheets + Drive clients
//   - FetchSheetDataFromAPI()  — fetch raw rows from one Sheet
//   - FetchSheetDataToStruct() — fetch + unmarshal to typed slice
//   - PerformDataMigration()   — full DB reset + re-import from all Sheets
//   - HandleMigrateData()      — Gin handler → POST /api/admin/migrate-data
// =========================================================================

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

	"github.com/gin-gonic/gin"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
	"gorm.io/gorm"
)

// ── Shared Google API State ───────────────────────────────────────────────
// main.go reads these after CreateGoogleAPIClient() to wire them back.

var (
	SheetsService  *sheets.Service
	DriveService   *drive.Service
	SpreadsheetID  string
	UploadFolderID string
)

// ── Sheet Ranges ──────────────────────────────────────────────────────────
// Maps sheet name to Google Sheets read range.

var SheetRanges = map[string]string{
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

// ── Google API Client ─────────────────────────────────────────────────────

// CreateGoogleAPIClient initialises the Google Sheets and Drive API clients
// using the GCP_CREDENTIALS environment variable (JSON service-account key).
func CreateGoogleAPIClient(ctx context.Context) error {
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
	SheetsService = sheetsSrv

	driveSrv, err := drive.NewService(ctx, clientOptions, option.WithScopes(drive.DriveFileScope))
	if err != nil {
		return err
	}
	DriveService = driveSrv

	log.Println("✅ Google API Clients Initialized.")
	return nil
}

// ── Sheet Data Helpers ────────────────────────────────────────────────────

// isNumericHeader returns true if the column header should be parsed as float64.
func IsNumericHeader(h string) bool {
	h = strings.ToLower(strings.ReplaceAll(strings.TrimSpace(h), " ", ""))
	return h == "price" || h == "cost" || h == "grandtotal" || h == "subtotal" ||
		h == "shippingfeecustomer" || h == "internalcost" ||
		h == "discount" || h == "deliveryunpaid" || h == "deliverypaid" ||
		h == "totalproductcost" || h == "revenue" || h == "quantity" ||
		h == "part" || h == "id" || h == "projectid" ||
		h == "totalorders" || h == "totalrevenue" || h == "calculatedvalue" ||
		h == "calculatorid"
}

// isBoolHeader returns true if the column header should be parsed as bool.
func IsBoolHeader(h string) bool {
	h = strings.ToLower(strings.ReplaceAll(strings.TrimSpace(h), " ", ""))
	return h == "issystemadmin" || h == "allowmanualdriver" || h == "requiredriverselection" ||
		h == "isrestocked" || h == "isenabled" ||
		h == "enabledriverrecommendation" || h == "requireperiodselection" || h == "iscustom"
}

// convertSheetValuesToMaps converts a raw Sheets ValueRange into a slice of
// header→value maps, coercing numeric and bool columns appropriately.
func convertSheetValuesToMaps(sheetName string, values *sheets.ValueRange) ([]map[string]interface{}, error) {
	if values == nil || len(values.Values) < 2 {
		return []map[string]interface{}{}, nil
	}
	headers := values.Values[0]
	dataRows := values.Values[1:]
	result := make([]map[string]interface{}, 0, len(dataRows))

	isIncentiveSheet := strings.HasPrefix(sheetName, "Incentive")

	for _, row := range dataRows {
		if len(row) == 0 || (len(row) == 1 && row[0] == "") {
			continue
		}
		rowData := make(map[string]interface{})
		for i, cell := range row {
			if i < len(headers) {
				header := strings.TrimSpace(fmt.Sprintf("%v", headers[i]))
				if header != "" {
					// Normalize header: Remove spaces and handle common variations
					// Example: "User Name" -> "UserName", "Full Name" -> "FullName"
					targetHeader := strings.ReplaceAll(header, " ", "")

					if isIncentiveSheet {
						// For incentive sheets, we normalize headers to camelCase to match the new tags
						if strings.EqualFold(targetHeader, "ID") {
							targetHeader = "id"
						} else if strings.EqualFold(targetHeader, "ProjectID") {
							targetHeader = "projectId"
						} else if strings.EqualFold(targetHeader, "CalculatorID") {
							targetHeader = "calculatorId"
						} else if strings.EqualFold(targetHeader, "RulesJSON") {
							targetHeader = "rulesJson"
						} else if strings.EqualFold(targetHeader, "BreakdownJSON") {
							targetHeader = "breakdownJson"
						} else if strings.EqualFold(targetHeader, "UserName") {
							targetHeader = "userName"
						} else if strings.EqualFold(targetHeader, "TotalOrders") {
							targetHeader = "totalOrders"
						} else if strings.EqualFold(targetHeader, "TotalRevenue") {
							targetHeader = "totalRevenue"
						} else if strings.EqualFold(targetHeader, "TotalProfit") {
							targetHeader = "totalProfit"
						} else if strings.EqualFold(targetHeader, "CalculatedValue") {
							targetHeader = "calculatedValue"
						} else if strings.EqualFold(targetHeader, "IsCustom") {
							targetHeader = "isCustom"
						} else if strings.EqualFold(targetHeader, "MetricType") {
							targetHeader = "metricType"
						} else if strings.EqualFold(targetHeader, "DataKey") {
							targetHeader = "dataKey"
						} else if strings.EqualFold(targetHeader, "Month") {
							targetHeader = "month"
						} else if len(targetHeader) > 0 {
							targetHeader = strings.ToLower(targetHeader[:1]) + targetHeader[1:]
						}
					}

					if cellStr, ok := cell.(string); ok {
						if IsNumericHeader(header) {
							cleaned := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(cellStr), "$", ""), ",", "")
							if f, err := strconv.ParseFloat(cleaned, 64); err == nil {
								rowData[targetHeader] = f
							} else {
								rowData[targetHeader] = 0.0
							}
						} else if IsBoolHeader(header) {
							rowData[targetHeader] = strings.ToUpper(strings.TrimSpace(cellStr)) == "TRUE"
						} else {
							if strings.ToLower(header) == "value" && (strings.TrimSpace(cellStr) == "" || strings.TrimSpace(cellStr) == "-") {
								rowData[targetHeader] = "0"
							} else {
								rowData[targetHeader] = cellStr
							}
						}
					} else {
						if IsBoolHeader(header) {
							if b, ok := cell.(bool); ok {
								rowData[targetHeader] = b
							} else {
								rowData[targetHeader] = false
							}
						} else {
							if b, ok := cell.(bool); ok {
								if b {
									rowData[targetHeader] = "TRUE"
								} else {
									rowData[targetHeader] = "FALSE"
								}
							} else if f, ok := cell.(float64); ok {
								rowData[targetHeader] = f
							} else {
								rowData[targetHeader] = fmt.Sprintf("%v", cell)
							}
						}
					}
					// Ensure critical IDs are always strings (avoid scientific notation)
					lowHeader := strings.ToLower(strings.TrimSpace(header))
					if lowHeader == "telegram message id 1" || lowHeader == "telegram message id 2" || lowHeader == "telegram message id 3" ||
						lowHeader == "order id" || lowHeader == "customer phone" ||
						lowHeader == "barcode" || (sheetName == "Movies" && lowHeader == "id") {
						rowData[targetHeader] = fmt.Sprintf("%v", cell)
					}
				}
			}
		}
		result = append(result, rowData)
	}
	return result, nil
}

// FetchSheetDataFromAPI reads raw rows from a Google Sheet by name.
// Requires SheetsService and SpreadsheetID to be set.
func FetchSheetDataFromAPI(sheetName string) ([]map[string]interface{}, error) {
	readRange, ok := SheetRanges[sheetName]
	if !ok {
		return nil, fmt.Errorf("range not defined for sheet %q", sheetName)
	}
	resp, err := SheetsService.Spreadsheets.Values.Get(SpreadsheetID, readRange).Do()
	if err != nil {
		return nil, err
	}
	return convertSheetValuesToMaps(sheetName, resp)
}

// FetchSheetDataToStruct fetches a sheet and unmarshals the rows into target
// (a pointer to a typed slice, e.g. *[]User).
func FetchSheetDataToStruct(sheetName string, target interface{}) error {
	mappedData, err := FetchSheetDataFromAPI(sheetName)
	if err != nil {
		return err
	}
	jsonData, _ := json.Marshal(mappedData)
	return json.Unmarshal(jsonData, target)
}

// ── Full Data Migration ───────────────────────────────────────────────────

// PerformDataMigration resets the entire database and re-imports all data
// from Google Sheets within a single transaction.
// Requires SheetsService and SpreadsheetID to be set beforehand.
// broadcastFullSyncProgress sends a real-time WebSocket event to all connected clients
// so the frontend can display live progress (step name, percentage, elapsed time, row count).
// Uses a goroutine to avoid blocking the migration when no clients are connected.
func broadcastFullSyncProgress(step, totalSteps int, stepName string, count int, elapsed float64) {
	if HubGlobal == nil {
		return
	}
	percent := 0
	if totalSteps > 0 {
		percent = int(float64(step) / float64(totalSteps) * 100)
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"type":       "full_sync_progress",
		"step":       step,
		"totalSteps": totalSteps,
		"stepName":   stepName,
		"percent":    percent,
		"count":      count,
		"elapsed":    elapsed,
	})
	go func() { HubGlobal.Broadcast <- payload }()
}

// broadcastFullSyncComplete sends the final result of a full sync to all connected clients.
func broadcastFullSyncComplete(success bool, message string, elapsed float64) {
	if HubGlobal == nil {
		return
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"type":    "full_sync_complete",
		"success": success,
		"message": message,
		"elapsed": elapsed,
	})
	go func() { HubGlobal.Broadcast <- payload }()
}

func PerformDataMigration() {
	startTime := time.Now()
	const totalSteps = 31

	ctx := context.Background()
	if SheetsService == nil {
		if err := CreateGoogleAPIClient(ctx); err != nil {
			log.Println("❌ Migration: Could not initialize Google API client:", err)
			broadcastFullSyncComplete(false, "Could not initialize Google API client: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}

	tx := DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			broadcastFullSyncComplete(false, "Panic during migration", time.Since(startTime).Seconds())
		}
	}()

	broadcastFullSyncProgress(0, totalSteps, "កំពុងលុបទិន្នន័យចាស់...", 0, time.Since(startTime).Seconds())
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
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveCustomPayout{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveManualData{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveResult{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveCalculator{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveProject{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Movie{})

	broadcastFullSyncProgress(1, totalSteps, "កំពុងទាញ Users...", 0, time.Since(startTime).Seconds())
	log.Println("🔄 ចាប់ផ្តើមទាញទិន្នន័យថ្មីពី Google Sheet...")

	// ── Users ──
	var users []User
	if err := FetchSheetDataToStruct("Users", &users); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Users (fetch):", err)
		broadcastFullSyncComplete(false, "Failed to fetch Users: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	log.Printf("📊 Users: Fetched %d rows from sheet", len(users))
	var validUsers []User
	seen := make(map[string]bool)
	for _, x := range users {
		if x.UserName != "" && !seen[x.UserName] {
			seen[x.UserName] = true
			validUsers = append(validUsers, x)
		}
	}
	if len(validUsers) > 0 {
		if err := tx.CreateInBatches(validUsers, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed for Users (save):", err)
			broadcastFullSyncComplete(false, "Failed to save Users: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
		log.Printf("✅ Users: Saved %d valid rows", len(validUsers))
	} else {
		log.Println("⚠️ Users: No valid rows found to save")
	}
	broadcastFullSyncProgress(2, totalSteps, "កំពុងទាញ Stores...", len(validUsers), time.Since(startTime).Seconds())

	// ── Stores ──
	var stores []Store
	if err := FetchSheetDataToStruct("Stores", &stores); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Stores (fetch):", err)
		broadcastFullSyncComplete(false, "Failed to fetch Stores: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	log.Printf("📊 Stores: Fetched %d rows from sheet", len(stores))
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
			log.Println("❌ Migration failed for Stores (save):", err)
			broadcastFullSyncComplete(false, "Failed to save Stores: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
		log.Printf("✅ Stores: Saved %d valid rows", len(validStores))
	}
	broadcastFullSyncProgress(3, totalSteps, "កំពុងទាញ Settings...", len(validStores), time.Since(startTime).Seconds())

	// ── Settings ──
	var settings []Setting
	if err := FetchSheetDataToStruct("Settings", &settings); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Settings:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Settings: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	for _, s := range settings {
		if s.ConfigKey != "" {
			if err := tx.Save(&s).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Migration failed to save Setting:", s.ConfigKey, err)
				broadcastFullSyncComplete(false, "Failed to save Settings: "+err.Error(), time.Since(startTime).Seconds())
				return
			}
			if s.ConfigKey == "UploadFolderID" {
				if envVal := os.Getenv("UPLOAD_FOLDER_ID"); envVal != "" {
					UploadFolderID = envVal
				} else {
					UploadFolderID = s.ConfigValue
				}
			}
		}
	}
	broadcastFullSyncProgress(4, totalSteps, "កំពុងទាញ TeamsPages...", len(settings), time.Since(startTime).Seconds())

	// ── TeamsPages ──
	var pages []TeamPage
	if err := FetchSheetDataToStruct("TeamsPages", &pages); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for TeamsPages (fetch):", err)
		broadcastFullSyncComplete(false, "Failed to fetch TeamsPages: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	log.Printf("📊 TeamsPages: Fetched %d rows from sheet", len(pages))
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
			log.Println("❌ Migration failed for TeamsPages (save):", err)
			broadcastFullSyncComplete(false, "Failed to save TeamsPages: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
		log.Printf("✅ TeamsPages: Saved %d valid rows", len(validPages))
	}
	broadcastFullSyncProgress(5, totalSteps, "កំពុងទាញ Products...", len(validPages), time.Since(startTime).Seconds())

	// ── Products ──
	var products []Product
	if err := FetchSheetDataToStruct("Products", &products); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Products (fetch):", err)
		broadcastFullSyncComplete(false, "Failed to fetch Products: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	log.Printf("📊 Products: Fetched %d rows from sheet", len(products))
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
			log.Println("❌ Migration failed for Products (save):", err)
			broadcastFullSyncComplete(false, "Failed to save Products: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
		log.Printf("✅ Products: Saved %d valid rows", len(validProducts))
	}
	broadcastFullSyncProgress(6, totalSteps, "កំពុងទាញ Locations...", len(validProducts), time.Since(startTime).Seconds())

	// ── Locations ──
	var locations []Location
	if err := FetchSheetDataToStruct("Locations", &locations); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Locations:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Locations: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save Locations: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(7, totalSteps, "កំពុងទាញ ShippingMethods...", len(validLocations), time.Since(startTime).Seconds())

	// ── ShippingMethods ──
	var shipping []ShippingMethod
	if err := FetchSheetDataToStruct("ShippingMethods", &shipping); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for ShippingMethods:", err)
		broadcastFullSyncComplete(false, "Failed to fetch ShippingMethods: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save ShippingMethods: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(8, totalSteps, "កំពុងទាញ Colors...", len(validShipping), time.Since(startTime).Seconds())

	// ── Colors ──
	var colors []Color
	if err := FetchSheetDataToStruct("Colors", &colors); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Colors:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Colors: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save Colors: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(9, totalSteps, "កំពុងទាញ Drivers...", len(validColors), time.Since(startTime).Seconds())

	// ── Drivers ──
	var drivers []Driver
	if err := FetchSheetDataToStruct("Drivers", &drivers); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Drivers:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Drivers: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save Drivers: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(10, totalSteps, "កំពុងទាញ BankAccounts...", len(validDrivers), time.Since(startTime).Seconds())

	// ── BankAccounts ──
	var banks []BankAccount
	if err := FetchSheetDataToStruct("BankAccounts", &banks); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for BankAccounts:", err)
		broadcastFullSyncComplete(false, "Failed to fetch BankAccounts: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save BankAccounts: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(11, totalSteps, "កំពុងទាញ PhoneCarriers...", len(validBanks), time.Since(startTime).Seconds())

	// ── PhoneCarriers ──
	var carriers []PhoneCarrier
	if err := FetchSheetDataToStruct("PhoneCarriers", &carriers); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for PhoneCarriers:", err)
		broadcastFullSyncComplete(false, "Failed to fetch PhoneCarriers: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save PhoneCarriers: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(12, totalSteps, "កំពុងទាញ TelegramTemplates...", len(validCarriers), time.Since(startTime).Seconds())

	// ── TelegramTemplates ──
	var templates []TelegramTemplate
	if err := FetchSheetDataToStruct("TelegramTemplates", &templates); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for TelegramTemplates:", err)
		broadcastFullSyncComplete(false, "Failed to fetch TelegramTemplates: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	var validTemplates []TelegramTemplate
	seenTemplates := make(map[string]bool)
	for _, x := range templates {
		if !seenTemplates[x.TemplateName] {
			if x.TemplateName != "" {
				seenTemplates[x.TemplateName] = true
			}
			validTemplates = append(validTemplates, x)
		}
	}
	if len(validTemplates) > 0 {
		if err := tx.CreateInBatches(validTemplates, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save TelegramTemplates:", err)
			broadcastFullSyncComplete(false, "Failed to save TelegramTemplates: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(13, totalSteps, "កំពុងទាញ Inventory...", len(validTemplates), time.Since(startTime).Seconds())

	// ── Inventory ──
	var inventory []Inventory
	if err := FetchSheetDataToStruct("Inventory", &inventory); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Inventory:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Inventory: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save Inventory: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(14, totalSteps, "កំពុងទាញ StockTransfers...", len(validInventory), time.Since(startTime).Seconds())

	// ── StockTransfers ──
	var transfers []StockTransfer
	if err := FetchSheetDataToStruct("StockTransfers", &transfers); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for StockTransfers:", err)
		broadcastFullSyncComplete(false, "Failed to fetch StockTransfers: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save StockTransfers: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(15, totalSteps, "កំពុងទាញ Returns...", len(validTransfers), time.Since(startTime).Seconds())

	// ── Returns ──
	var returns []ReturnItem
	if err := FetchSheetDataToStruct("Returns", &returns); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Returns:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Returns: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	var validReturns []ReturnItem
	seenReturns := make(map[uint]bool)
	for _, x := range returns {
		if !seenReturns[x.ID] {
			if x.ID != 0 {
				seenReturns[x.ID] = true
			}
			validReturns = append(validReturns, x)
		}
	}
	if len(validReturns) > 0 {
		if err := tx.CreateInBatches(validReturns, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save Returns:", err)
			broadcastFullSyncComplete(false, "Failed to save Returns: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(16, totalSteps, "កំពុងទាញ RevenueDashboard...", len(validReturns), time.Since(startTime).Seconds())

	// ── RevenueDashboard ──
	var revs []RevenueEntry
	if err := FetchSheetDataToStruct("RevenueDashboard", &revs); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for RevenueDashboard:", err)
		broadcastFullSyncComplete(false, "Failed to fetch RevenueDashboard: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save RevenueDashboard: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(17, totalSteps, "កំពុងទាញ ChatMessages...", len(validRevs), time.Since(startTime).Seconds())

	// ── ChatMessages ──
	var chats []ChatMessage
	if err := FetchSheetDataToStruct("ChatMessages", &chats); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for ChatMessages:", err)
		broadcastFullSyncComplete(false, "Failed to fetch ChatMessages: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save ChatMessages: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(18, totalSteps, "កំពុងទាញ EditLogs...", len(validChats), time.Since(startTime).Seconds())

	// ── EditLogs ──
	var editLogs []EditLog
	if err := FetchSheetDataToStruct("EditLogs", &editLogs); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for EditLogs:", err)
		broadcastFullSyncComplete(false, "Failed to fetch EditLogs: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save EditLogs: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(19, totalSteps, "កំពុងទាញ UserActivityLogs...", len(validEditLogs), time.Since(startTime).Seconds())

	// ── UserActivityLogs ──
	var actLogs []UserActivityLog
	if err := FetchSheetDataToStruct("UserActivityLogs", &actLogs); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for UserActivityLogs:", err)
		broadcastFullSyncComplete(false, "Failed to fetch UserActivityLogs: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save UserActivityLogs: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(20, totalSteps, "កំពុងទាញ DriverRecommendations...", len(validActLogs), time.Since(startTime).Seconds())

	// ── DriverRecommendations ──
	var recs []DriverRecommendation
	if err := FetchSheetDataToStruct("DriverRecommendations", &recs); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for DriverRecommendations:", err)
		broadcastFullSyncComplete(false, "Failed to fetch DriverRecommendations: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save DriverRecommendations: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(21, totalSteps, "កំពុងទាញ Roles...", len(validRecs), time.Since(startTime).Seconds())

	// ── Roles ──
	var roles []Role
	if err := FetchSheetDataToStruct("Roles", &roles); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Roles:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Roles: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	var validRoles []Role
	seenRoles := make(map[string]bool)
	for _, x := range roles {
		if x.RoleName != "" && !seenRoles[x.RoleName] {
			seenRoles[x.RoleName] = true
			validRoles = append(validRoles, x)
		}
	}
	if len(validRoles) > 0 {
		if err := tx.CreateInBatches(validRoles, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save Roles:", err)
			broadcastFullSyncComplete(false, "Failed to save Roles: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(22, totalSteps, "កំពុងទាញ RolePermissions...", len(validRoles), time.Since(startTime).Seconds())

	// ── RolePermissions ──
	var perms []RolePermission
	if err := FetchSheetDataToStruct("RolePermissions", &perms); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for RolePermissions:", err)
		broadcastFullSyncComplete(false, "Failed to fetch RolePermissions: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	var validPerms []RolePermission
	seenPermKeys := make(map[string]bool)
	for _, x := range perms {
		key := strings.ToLower(x.Role + "|" + x.Feature)
		if x.Role != "" && x.Feature != "" && !seenPermKeys[key] {
			seenPermKeys[key] = true
			x.ID = 0 // let local DB auto-increment manage PK
			validPerms = append(validPerms, x)
		}
	}
	if len(validPerms) > 0 {
		if err := tx.CreateInBatches(validPerms, 100).Error; err != nil {
			tx.Rollback()
			log.Printf("❌ Migration failed to save RolePermissions: %v", err)
			broadcastFullSyncComplete(false, "Failed to save RolePermissions: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(23, totalSteps, "កំពុងទាញ AllOrders... (ធំជាងគេ)", len(validPerms), time.Since(startTime).Seconds())

	// ── AllOrders ──
	var orders []Order
	if err := FetchSheetDataToStruct("AllOrders", &orders); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for AllOrders (fetch):", err)
		broadcastFullSyncComplete(false, "Failed to fetch AllOrders: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	log.Printf("📊 AllOrders: Fetched %d rows from sheet", len(orders))
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
			log.Println("❌ Migration failed for AllOrders (save):", err)
			broadcastFullSyncComplete(false, "Failed to save AllOrders: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
		log.Printf("✅ AllOrders: Saved %d valid rows", len(validOrders))
	} else {
		log.Println("⚠️ AllOrders: No valid rows found to save")
	}
	broadcastFullSyncProgress(24, totalSteps, "កំពុងទាញ Movies...", len(validOrders), time.Since(startTime).Seconds())

	// ── Movies ──
	var movies []Movie
	if err := FetchSheetDataToStruct("Movies", &movies); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Movies:", err)
		broadcastFullSyncComplete(false, "Failed to fetch Movies: "+err.Error(), time.Since(startTime).Seconds())
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
			broadcastFullSyncComplete(false, "Failed to save Movies: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(25, totalSteps, "កំពុងទាញ IncentiveProjects...", len(validMovies), time.Since(startTime).Seconds())

	// ── Incentive Sheets ──
	var incProjects []IncentiveProject
	if err := FetchSheetDataToStruct("IncentiveProjects", &incProjects); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for IncentiveProjects:", err)
		broadcastFullSyncComplete(false, "Failed to fetch IncentiveProjects: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	if len(incProjects) > 0 {
		if err := tx.CreateInBatches(incProjects, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save IncentiveProjects:", err)
			broadcastFullSyncComplete(false, "Failed to save IncentiveProjects: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(26, totalSteps, "កំពុងទាញ IncentiveCalculators...", len(incProjects), time.Since(startTime).Seconds())

	var incCalcs []IncentiveCalculator
	if err := FetchSheetDataToStruct("IncentiveCalculators", &incCalcs); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for IncentiveCalculators:", err)
		broadcastFullSyncComplete(false, "Failed to fetch IncentiveCalculators: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	if len(incCalcs) > 0 {
		if err := tx.CreateInBatches(incCalcs, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save IncentiveCalculators:", err)
			broadcastFullSyncComplete(false, "Failed to save IncentiveCalculators: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(27, totalSteps, "កំពុងទាញ IncentiveResults...", len(incCalcs), time.Since(startTime).Seconds())

	var incResults []IncentiveResult
	if err := FetchSheetDataToStruct("IncentiveResults", &incResults); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for IncentiveResults:", err)
		broadcastFullSyncComplete(false, "Failed to fetch IncentiveResults: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	if len(incResults) > 0 {
		if err := tx.CreateInBatches(incResults, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save IncentiveResults:", err)
			broadcastFullSyncComplete(false, "Failed to save IncentiveResults: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(28, totalSteps, "កំពុងទាញ IncentiveManualData...", len(incResults), time.Since(startTime).Seconds())

	var incManual []IncentiveManualData
	if err := FetchSheetDataToStruct("IncentiveManualData", &incManual); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for IncentiveManualData:", err)
		broadcastFullSyncComplete(false, "Failed to fetch IncentiveManualData: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	if len(incManual) > 0 {
		if err := tx.CreateInBatches(incManual, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save IncentiveManualData:", err)
			broadcastFullSyncComplete(false, "Failed to save IncentiveManualData: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(29, totalSteps, "កំពុងទាញ IncentiveCustomPayouts...", len(incManual), time.Since(startTime).Seconds())

	var incCustom []IncentiveCustomPayout
	if err := FetchSheetDataToStruct("IncentiveCustomPayouts", &incCustom); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for IncentiveCustomPayouts:", err)
		broadcastFullSyncComplete(false, "Failed to fetch IncentiveCustomPayouts: "+err.Error(), time.Since(startTime).Seconds())
		return
	}
	if len(incCustom) > 0 {
		if err := tx.CreateInBatches(incCustom, 100).Error; err != nil {
			tx.Rollback()
			log.Println("❌ Migration failed to save IncentiveCustomPayouts:", err)
			broadcastFullSyncComplete(false, "Failed to save IncentiveCustomPayouts: "+err.Error(), time.Since(startTime).Seconds())
			return
		}
	}
	broadcastFullSyncProgress(30, totalSteps, "កំពុង Commit និង Seed ទិន្នន័យ...", len(incCustom), time.Since(startTime).Seconds())

	if err := tx.Commit().Error; err != nil {
		log.Println("❌ Migration failed on commit:", err)
		broadcastFullSyncComplete(false, "Database commit failed: "+err.Error(), time.Since(startTime).Seconds())
	} else {
		// Ensure essential roles exist even if sheet was empty
		EnsureSeedData()
		log.Println("🎉 Migration ជោគជ័យ!")
		broadcastFullSyncComplete(true, fmt.Sprintf("Sync ជោគជ័យ! Orders: %d rows", len(validOrders)), time.Since(startTime).Seconds())
	}
}

// HandleMigrateData is the Gin handler for POST /api/admin/migrate-data.
// It triggers a full data migration in the background.
func HandleMigrateData(c *gin.Context) {
	go PerformDataMigration()
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Migration started."})
}

// HandleMigrateMovies migrates Movie data from Google Sheets to the database (Admin only).
// After completion (success or failure), broadcasts a "movie_migration_complete" WebSocket
// event so the frontend can update its UI without relying on a blind timeout.
func HandleMigrateMovies(c *gin.Context) {
	go func() {
		// broadcastResult sends a WebSocket event to all connected clients so the
		// frontend knows the outcome of the background goroutine.
		broadcastResult := func(success bool, message string, count int) {
			if HubGlobal == nil {
				return
			}
			payload, _ := json.Marshal(map[string]interface{}{
				"type":    "movie_migration_complete",
				"success": success,
				"message": message,
				"count":   count,
			})
			HubGlobal.Broadcast <- payload
		}

		tx := DB.Begin()
		defer func() {
			if r := recover(); r != nil {
				tx.Rollback()
				broadcastResult(false, fmt.Sprintf("Panic during migration: %v", r), 0)
			}
		}()

		log.Println("🗑️ លុបទិន្នន័យ Movie ចាស់ (Resetting Movies table within transaction)...")
		tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Movie{})

		log.Println("🔄 ចាប់ផ្តើមទាញទិន្នន័យ Movie ថ្មីពី Google Sheet...")

		var movies []Movie
		if err := FetchSheetDataToStruct("Movies", &movies); err != nil {
			tx.Rollback()
			log.Println("❌ Movie Migration failed for Movies:", err)
			broadcastResult(false, "Failed to fetch data from Google Sheet: "+err.Error(), 0)
			return
		}

		var validMovies []Movie
		seenMovieIDs := make(map[string]bool)
		for _, x := range movies {
			if x.ID != "" && !seenMovieIDs[x.ID] {
				seenMovieIDs[x.ID] = true
				if x.AddedAt == "" {
					x.AddedAt = time.Now().Format(time.RFC3339)
				}
				validMovies = append(validMovies, x)
			}
		}

		if len(validMovies) > 0 {
			if err := tx.CreateInBatches(validMovies, 100).Error; err != nil {
				tx.Rollback()
				log.Println("❌ Movie Migration failed to save Movies:", err)
				broadcastResult(false, "Failed to save movies to database: "+err.Error(), 0)
				return
			}
		}

		if err := tx.Commit().Error; err != nil {
			log.Println("❌ Movie Migration failed on commit:", err)
			broadcastResult(false, "Database commit failed: "+err.Error(), 0)
		} else {
			log.Printf("🎉 Movie Migration ជោគជ័យ! Saved %d movies.", len(validMovies))
			broadcastResult(true, fmt.Sprintf("Sync ជោគជ័យ! បានរក្សាទុក %d ភាពយន្ត។", len(validMovies)), len(validMovies))
		}
	}()

	c.JSON(200, gin.H{"status": "success", "message": "Movie migration started."})
}
