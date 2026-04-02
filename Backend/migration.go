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
	h = strings.ToLower(strings.TrimSpace(h))
	return h == "price" || h == "cost" || h == "grand total" || h == "subtotal" ||
		h == "shipping fee (customer)" || h == "internal cost" || h == "internalcost" ||
		h == "discount ($)" || h == "delivery unpaid" || h == "delivery paid" ||
		h == "total product cost ($)" || h == "revenue" || h == "quantity" ||
		h == "part" || h == "id" || h == "projectid" ||
		h == "totalorders" || h == "totalrevenue" || h == "calculatedvalue" ||
		h == "calculatorid"
}

// isBoolHeader returns true if the column header should be parsed as bool.
func IsBoolHeader(h string) bool {
	h = strings.ToLower(strings.TrimSpace(h))
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
					// For incentive sheets, we normalize headers to camelCase to match the new tags
					targetHeader := header
					if isIncentiveSheet {
						if header == "ID" { targetHeader = "id" }
						if header == "ProjectID" { targetHeader = "projectId" }
						if header == "CalculatorID" { targetHeader = "calculatorId" }
						if header == "RulesJSON" { targetHeader = "rulesJson" }
						if header == "BreakdownJSON" { targetHeader = "breakdownJson" }
						if header == "UserName" { targetHeader = "userName" }
						if header == "TotalOrders" { targetHeader = "totalOrders" }
						if header == "TotalRevenue" { targetHeader = "totalRevenue" }
						if header == "TotalProfit" { targetHeader = "totalProfit" }
						if header == "CalculatedValue" { targetHeader = "calculatedValue" }
						if header == "IsCustom" { targetHeader = "isCustom" }
						if header == "MetricType" { targetHeader = "metricType" }
						if header == "DataKey" { targetHeader = "dataKey" }
						if header == "Month" { targetHeader = "month" }
						// Also handle first character lowercase for others
						if targetHeader == header && len(header) > 0 {
							targetHeader = strings.ToLower(header[:1]) + header[1:]
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
func PerformDataMigration() {
	ctx := context.Background()
	if SheetsService == nil {
		if err := CreateGoogleAPIClient(ctx); err != nil {
			log.Println("❌ Migration: Could not initialize Google API client:", err)
			return
		}
	}

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
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveCustomPayout{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveManualData{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveResult{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveCalculator{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&IncentiveProject{})
	tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(&Movie{})

	log.Println("🔄 ចាប់ផ្តើមទាញទិន្នន័យថ្មីពី Google Sheet...")

	// ── Users ──
	var users []User
	if err := FetchSheetDataToStruct("Users", &users); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Users (fetch):", err)
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
			return
		}
		log.Printf("✅ Users: Saved %d valid rows", len(validUsers))
	} else {
		log.Println("⚠️ Users: No valid rows found to save")
	}

	// ── Stores ──
	var stores []Store
	if err := FetchSheetDataToStruct("Stores", &stores); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Stores (fetch):", err)
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
			return
		}
		log.Printf("✅ Stores: Saved %d valid rows", len(validStores))
	}

	// ── Settings ──
	var settings []Setting
	if err := FetchSheetDataToStruct("Settings", &settings); err != nil {
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
				if envVal := os.Getenv("UPLOAD_FOLDER_ID"); envVal != "" {
					UploadFolderID = envVal
				} else {
					UploadFolderID = s.ConfigValue
				}
			}
		}
	}

	// ── TeamsPages ──
	var pages []TeamPage
	if err := FetchSheetDataToStruct("TeamsPages", &pages); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for TeamsPages (fetch):", err)
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
			return
		}
		log.Printf("✅ TeamsPages: Saved %d valid rows", len(validPages))
	}

	// ── Products ──
	var products []Product
	if err := FetchSheetDataToStruct("Products", &products); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for Products (fetch):", err)
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
			return
		}
		log.Printf("✅ Products: Saved %d valid rows", len(validProducts))
	}

	// ── Locations ──
	var locations []Location
	if err := FetchSheetDataToStruct("Locations", &locations); err != nil {
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

	// ── ShippingMethods ──
	var shipping []ShippingMethod
	if err := FetchSheetDataToStruct("ShippingMethods", &shipping); err != nil {
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

	// ── Colors ──
	var colors []Color
	if err := FetchSheetDataToStruct("Colors", &colors); err != nil {
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

	// ── Drivers ──
	var drivers []Driver
	if err := FetchSheetDataToStruct("Drivers", &drivers); err != nil {
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

	// ── BankAccounts ──
	var banks []BankAccount
	if err := FetchSheetDataToStruct("BankAccounts", &banks); err != nil {
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

	// ── PhoneCarriers ──
	var carriers []PhoneCarrier
	if err := FetchSheetDataToStruct("PhoneCarriers", &carriers); err != nil {
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

	// ── TelegramTemplates ──
	var templates []TelegramTemplate
	if err := FetchSheetDataToStruct("TelegramTemplates", &templates); err != nil {
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

	// ── Inventory ──
	var inventory []Inventory
	if err := FetchSheetDataToStruct("Inventory", &inventory); err != nil {
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

	// ── StockTransfers ──
	var transfers []StockTransfer
	if err := FetchSheetDataToStruct("StockTransfers", &transfers); err != nil {
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

	// ── Returns ──
	var returns []ReturnItem
	if err := FetchSheetDataToStruct("Returns", &returns); err != nil {
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

	// ── RevenueDashboard ──
	var revs []RevenueEntry
	if err := FetchSheetDataToStruct("RevenueDashboard", &revs); err != nil {
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

	// ── ChatMessages ──
	var chats []ChatMessage
	if err := FetchSheetDataToStruct("ChatMessages", &chats); err != nil {
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

	// ── EditLogs ──
	var editLogs []EditLog
	if err := FetchSheetDataToStruct("EditLogs", &editLogs); err != nil {
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

	// ── UserActivityLogs ──
	var actLogs []UserActivityLog
	if err := FetchSheetDataToStruct("UserActivityLogs", &actLogs); err != nil {
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

	// ── DriverRecommendations ──
	var recs []DriverRecommendation
	if err := FetchSheetDataToStruct("DriverRecommendations", &recs); err != nil {
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

	// ── Roles ──
	var roles []Role
	if err := FetchSheetDataToStruct("Roles", &roles); err != nil {
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

	// ── RolePermissions ──
	var perms []RolePermission
	if err := FetchSheetDataToStruct("RolePermissions", &perms); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for RolePermissions:", err)
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
			return
		}
	}

	// ── AllOrders ──
	var orders []Order
	if err := FetchSheetDataToStruct("AllOrders", &orders); err != nil {
		tx.Rollback()
		log.Println("❌ Migration failed for AllOrders (fetch):", err)
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
			return
		}
		log.Printf("✅ AllOrders: Saved %d valid rows", len(validOrders))
	} else {
		log.Println("⚠️ AllOrders: No valid rows found to save")
	}

	// ── Movies ──
	var movies []Movie
	if err := FetchSheetDataToStruct("Movies", &movies); err != nil {
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

	// ── Incentive Sheets ──
	var incProjects []IncentiveProject
	if err := FetchSheetDataToStruct("IncentiveProjects", &incProjects); err != nil {
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
	if err := FetchSheetDataToStruct("IncentiveCalculators", &incCalcs); err != nil {
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
	if err := FetchSheetDataToStruct("IncentiveResults", &incResults); err != nil {
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
	if err := FetchSheetDataToStruct("IncentiveManualData", &incManual); err != nil {
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
	if err := FetchSheetDataToStruct("IncentiveCustomPayouts", &incCustom); err != nil {
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
