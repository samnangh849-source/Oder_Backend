package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	// "io" // REMOVED (Fix 1: Not used)
	"log"
	"net/http"
	"net/url" // Needed for label button
	"os"
	"sort"
	"strconv" // ADDED (Fix 2: Was undefined)
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	// --- NEW: Telegram Bot API ---
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"

	// --- Google API Imports ---
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// --- Configuration ---
var (
	// --- Google API Services ---
	sheetsService *sheets.Service
	driveService  *drive.Service
	// ---
	spreadsheetID    string
	uploadFolderID   string
	labelPrinterURL  string // NEW: Loaded from env
	// ---
	renderBaseURL    string // URL of this Render service itself
	
	// --- NEW: Telegram Bot Management ---
	telegramBots   = make(map[string]*tgbotapi.BotAPI)      // Map[TeamName] -> BotInstance
	telegramConfig = make(map[string]map[string]string) // Map[TeamName] -> Map["groupID", "topicID", "archiveID"]
)

// --- Constants from Apps Script Config (Keep consistent) ---
// ... (sheetRanges map remains the same) ...
var sheetRanges = map[string]string{
	"Users":             "Users!A:G", // Assuming G is IsSystemAdmin
	"Settings":          "Settings!A:B", // Assuming A=Team, B=UploadFolderID (BotToken/etc are env vars now)
	"TeamsPages":        "TeamsPages!A:C",
	"Products":          "Products!A:D",
	"Locations":         "Locations!A:C",
	"ShippingMethods":   "ShippingMethods!A:D",
	"Colors":            "Colors!A:A",
	"Drivers":           "Drivers!A:B",
	"BankAccounts":    "BankAccounts!A:B",
	"PhoneCarriers":   "PhoneCarriers!A:C",
	"TelegramTemplates": "TelegramTemplates!A:C",
	"AllOrders":         "AllOrders!A:U", // Assuming Timestamp to Team
	"RevenueDashboard":  "RevenueDashboard!A:D",
	// Write-only sheets don't need a read range
	"FormulaReportSheet": "FormulaReport!A:Z", // Use full range for clear/overwrite
	"UserActivityLogs":   "UserActivityLogs!A:Z", // Append only
	"EditLogs":           "EditLogs!A:Z",         // Append only
}

const (
    AllOrdersSheet     = "AllOrders"
    FormulaReportSheet = "FormulaReport"
    RevenueSheet       = "RevenueDashboard"
    UserActivitySheet  = "UserActivityLogs"
	EditLogsSheet	   = "EditLogs"
    TelegramTemplatesSheet = "TelegramTemplates"
    // ... add others if needed directly in Go
)


// --- Cache ---
// ... (Cache functions setCache, getCache, clearCache, invalidateSheetCache remain the same) ...
type CacheItem struct {
	Data      interface{}
	ExpiresAt time.Time
}

var (
	cache      = make(map[string]CacheItem)
	cacheMutex sync.RWMutex
	cacheTTL   = 5 * time.Minute // Default cache duration
)

func setCache(key string, data interface{}, duration time.Duration) {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	cache[key] = CacheItem{
		Data:      data,
		ExpiresAt: time.Now().Add(duration),
	}
	log.Printf("Cache SET for key: %s", key)
}

func getCache(key string) (interface{}, bool) {
	cacheMutex.RLock()
	defer cacheMutex.RUnlock()
	item, found := cache[key]
	if !found || time.Now().After(item.ExpiresAt) {
		if found {
			log.Printf("Cache EXPIRED for key: %s", key)
		} else {
			//log.Printf("Cache MISS for key: %s", key) // Too noisy maybe
		}
		return nil, false
	}
	log.Printf("Cache HIT for key: %s", key)
	return item.Data, true
}

func clearCache() {
    cacheMutex.Lock()
    defer cacheMutex.Unlock()
    cache = make(map[string]CacheItem)
    log.Println("Cache CLEARED")
}
// Function to invalidate specific sheet cache
func invalidateSheetCache(sheetName string) {
    cacheMutex.Lock()
    defer cacheMutex.Unlock()
    delete(cache, "sheet_"+sheetName)
    log.Printf("Cache INVALIDATED for key: sheet_%s", sheetName)
}


// --- Models (Adjust based on your actual Sheet headers) ---
// ... (All struct definitions remain the same) ...
type User struct {
	UserName          string `json:"UserName"`
	Password          string `json:"Password"` // This will be read as string
	Team              string `json:"Team"` // Comma-separated
	FullName          string `json:"FullName"`
	ProfilePictureURL string `json:"ProfilePictureURL"`
	Role              string `json:"Role"`
	IsSystemAdmin     bool   `json:"IsSystemAdmin"`
}

type Product struct {
	ProductName string  `json:"ProductName"`
	Barcode     string  `json:"Barcode"` // This will be read as string
	Price       float64 `json:"Price"`
	ImageURL    string  `json:"ImageURL"`
}

type Location struct {
	Province string `json:"Province"`
	District string `json:"District"`
	Sangkat  string `json:"Sangkat"`
}

type ShippingMethod struct {
    MethodName            string `json:"MethodName"`
    LogoURL               string `json:"LogoURL"`
    AllowManualDriver     bool   `json:"AllowManualDriver"`
    RequireDriverSelection bool   `json:"RequireDriverSelection"`
}

type TeamPage struct {
    Team           string `json:"Team"`
    PageName       string `json:"PageName"`
    TelegramValue string `json:"TelegramValue"`
}

type Color struct {
    ColorName string `json:"ColorName"`
}
type Driver struct {
    DriverName string `json:"DriverName"`
    ImageURL   string `json:"ImageURL"`
}
type BankAccount struct {
    BankName string `json:"BankName"`
    LogoURL  string `json:"LogoURL"`
}
type PhoneCarrier struct {
    CarrierName string `json:"CarrierName"`
    Prefixes    string `json:"Prefixes (comma-separated)"` // Use exact header name
    CarrierLogoURL string `json:"CarrierLogoURL"`
}
type TelegramTemplate struct {
    Team     string `json:"Team"`
    Part     int    `json:"Part"` // Assuming Part is a number
    Template string `json:"Template"`
}

// *** Model for Order data read from AllOrders (for FormulaReport) ***
type Order struct {
	Timestamp            string  `json:"Timestamp"` // Read as ISO string
	OrderID              string  `json:"Order ID"`
	User                 string  `json:"User"`
	Page                 string  `json:"Page"`
	TelegramValue        string  `json:"TelegramValue"`
	CustomerName         string  `json:"Customer Name"`
	CustomerPhone        string  `json:"Customer Phone"` // This will be read as string
	Location             string  `json:"Location"`
	AddressDetails       string  `json:"Address Details"`
	Note                 string  `json:"Note"`
	ShippingFeeCustomer float64 `json:"Shipping Fee (Customer)"`
	Subtotal             float64 `json:"Subtotal"`
	GrandTotal           float64 `json:"Grand Total"`
	ProductsJSON         string  `json:"Products (JSON)"`
	InternalShippingMethod string `json:"Internal Shipping Method"`
	InternalShippingDetails string `json:"Internal Shipping Details"`
	InternalCost         float64 `json:"Internal Cost"`
	PaymentStatus        string  `json:"Payment Status"`
	PaymentInfo          string  `json:"Payment Info"`
	TelegramMessageID    string  `json:"Telegram Message ID"`
	Team                 string  `json:"Team"`
}

// *** Model for Revenue data read from RevenueDashboard ***
type RevenueEntry struct {
    Timestamp string  `json:"Timestamp"` // Read as ISO string
    Team      string  `json:"Team"`
    Page      string  `json:"Page"`
    Revenue   float64 `json:"Revenue"`
}


// *** Struct for report aggregation ***
type ReportSummary struct {
    TotalSales   float64
    TotalExpense float64 // Used in FormulaReport
}

type RevenueAggregate struct {
    YearlyByTeam   map[int]map[string]float64    `json:"yearlyByTeam"`   // year -> team -> totalRevenue
    YearlyByPage   map[int]map[string]float64    `json:"yearlyByPage"`   // year -> page -> totalRevenue
    MonthlyByTeam  map[string]map[string]float64 `json:"monthlyByTeam"`  // "YYYY-MM" -> team -> totalRevenue
    MonthlyByPage  map[string]map[string]float64 `json:"monthlyByPage"`  // "YYYY-MM" -> page -> totalRevenue
    DailyByTeam    map[string]map[string]float64 `json:"dailyByTeam"`    // "YYYY-MM-DD" -> team -> totalRevenue
    DailyByPage    map[string]map[string]float64 `json:"dailyByPage"`    // "YYYY-MM-DD" -> page -> totalRevenue
}

// --- *** NEW: Google API Client Setup *** ---
func createGoogleAPIClient(ctx context.Context) error {
	credentialsJSON := os.Getenv("GCP_CREDENTIALS")
	if credentialsJSON == "" {
		return fmt.Errorf("GCP_CREDENTIALS environment variable is not set")
	}

	creds := []byte(credentialsJSON)

	// Create Sheets Service
	sheetsSrv, err := sheets.NewService(ctx, option.WithCredentialsJSON(creds), option.WithScopes(sheets.SpreadsheetsScope))
	if err != nil {
		return fmt.Errorf("unable to retrieve Sheets client: %v", err)
	}
	sheetsService = sheetsSrv
	log.Println("Google Sheets API client created successfully.")

	// Create Drive Service
	driveSrv, err := drive.NewService(ctx, option.WithCredentialsJSON(creds), option.WithScopes(drive.DriveScope)) // Use DriveScope for file uploads/permissions
	if err != nil {
		return fmt.Errorf("unable to retrieve Drive client: %v", err)
	}
	driveService = driveSrv
	log.Println("Google Drive API client created successfully.")

	return nil
}

// --- *** NEW: Google Sheets API Helper Functions *** ---

// Converts Sheets API ValueRange (array of rows) to what our app expects (array of maps)
func convertSheetValuesToMaps(values *sheets.ValueRange) ([]map[string]interface{}, error) {
	if values == nil || len(values.Values) < 2 {
		// No data or only headers
		return []map[string]interface{}{}, nil
	}

	headers := values.Values[0] // First row is headers
	dataRows := values.Values[1:]

	result := make([]map[string]interface{}, 0, len(dataRows))

	for _, row := range dataRows {
		if len(row) == 0 || (len(row) == 1 && row[0] == "") {
			continue // Skip empty rows
		}

		rowData := make(map[string]interface{})
		for i, cell := range row {
			if i < len(headers) {
				header := fmt.Sprintf("%v", headers[i]) // Convert header to string
				if header != "" {
					
					// --- Data Type Coercion ---
					// Try to parse numbers (float)
					if cellStr, ok := cell.(string); ok {
						if f, err := strconv.ParseFloat(cellStr, 64); err == nil {
							rowData[header] = f // Store as float
						} else if b, err := strconv.ParseBool(cellStr); err == nil {
							rowData[header] = b // Store as bool
						} else {
							rowData[header] = cellStr // Keep as string
						}
					} else {
						// It's likely already a float64 or bool from JSON/API
						rowData[header] = cell 
					}

					// *** Specific Fixes for string fields that look like numbers ***
					if header == "Password" || header == "Customer Phone" || header == "Barcode" {
						rowData[header] = fmt.Sprintf("%v", cell) // Force to string
					}
					// *** End Fixes ***

				}
			}
		}
		result = append(result, rowData)
	}
	return result, nil
}


// Replaces callAppsScriptGET("getSheetData", ...)
func fetchSheetDataFromAPI(sheetName string) ([]map[string]interface{}, error) {
	readRange, ok := sheetRanges[sheetName]
	if !ok {
		return nil, fmt.Errorf("no A1 range defined for sheet: %s", sheetName)
	}

	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		log.Printf("Error calling Sheets API GET for %s: %v", sheetName, err)
		return nil, fmt.Errorf("failed to retrieve data from Google Sheets API")
	}

	// Convert [][]interface{} to []map[string]interface{}
	mappedData, err := convertSheetValuesToMaps(resp)
	if err != nil {
		log.Printf("Error converting sheet data for %s: %v", sheetName, err)
		return nil, fmt.Errorf("failed to process data structure from Google Sheets")
	}

	return mappedData, nil
}

// Replaces callAppsScriptPOST({Action: "appendRow", ...})
func appendRowToSheet(sheetName string, rowData []interface{}) error {
	// A1 notation for appending to a sheet is just the sheet name
	writeRange := sheetName 
	
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{rowData},
	}

	// Use "USER_ENTERED" to parse values correctly (e.g., convert strings to numbers if sheet cell is formatted as number)
	// Use "RAW" to insert as-is (safer, but might be all strings)
	// Let's stick to RAW to match how Apps Script .appendRow() works
	_, err := sheetsService.Spreadsheets.Values.Append(spreadsheetID, writeRange, valueRange).ValueInputOption("RAW").Do()
	if err != nil {
		log.Printf("Error calling Sheets API APPEND for %s: %v", sheetName, err)
		return fmt.Errorf("failed to append row to Google Sheets API")
	}
	return nil
}

// Replaces callAppsScriptPOST({Action: "overwriteSheetData", ...})
func overwriteSheetDataInAPI(sheetName string, data [][]interface{}) error {
	// 1. Clear the sheet first
	clearRange, ok := sheetRanges[sheetName] // Use the defined range (e.g., "FormulaReport!A:Z")
	if !ok {
		return fmt.Errorf("no A1 range defined for sheet: %s", sheetName)
	}
	
	_, err := sheetsService.Spreadsheets.Values.Clear(spreadsheetID, clearRange, &sheets.ClearValuesRequest{}).Do()
	if err != nil {
		log.Printf("Error calling Sheets API CLEAR for %s: %v", sheetName, err)
		return fmt.Errorf("failed to clear sheet %s: %v", sheetName, err)
	}

	// 2. Write new data
	if len(data) == 0 {
		log.Printf("No data provided to overwrite sheet %s. Sheet cleared.", sheetName)
		return nil // Nothing to write
	}
	
	// Determine the exact range to write (e.g., "FormulaReport!A1:D100")
	// Simple way: just write starting at A1
	writeRange := fmt.Sprintf("%s!A1", sheetName)

	valueRange := &sheets.ValueRange{
		Values: data,
	}

	_, err = sheetsService.Spreadsheets.Values.Update(spreadsheetID, writeRange, valueRange).ValueInputOption("RAW").Do()
	if err != nil {
		log.Printf("Error calling Sheets API UPDATE for %s: %v", sheetName, err)
		return fmt.Errorf("failed to write data to sheet %s: %v", sheetName, err)
	}
	
	return nil
}

// --- *** NEW: Find Row and Update Cell (for Message ID) *** ---
func updateTelegramMessageIDInSheet(team, orderId string, messageId int64) {
    sheetName := "Orders_" + team
	log.Printf("Attempting to save MessageID %d for OrderID %s in sheet %s", messageId, orderId, sheetName)

    // 1. Fetch headers and Order ID column
	headersResp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, fmt.Sprintf("%s!1:1", sheetName)).Do()
	if err != nil || len(headersResp.Values) == 0 {
		log.Printf("Error fetching headers for %s: %v", sheetName, err)
		return
	}
	headers := headersResp.Values[0]

	orderIdColIndex := -1
	messageIdColIndex := -1
	for i, header := range headers {
		headerStr := fmt.Sprintf("%v", header)
		if headerStr == "Order ID" {
			orderIdColIndex = i
		}
		if headerStr == "Telegram Message ID" {
			messageIdColIndex = i
		}
	}

	if orderIdColIndex == -1 || messageIdColIndex == -1 {
		log.Printf("Error: 'Order ID' or 'Telegram Message ID' column not found in sheet %s", sheetName)
		return
	}
	orderIdColLetter := string(rune('A' + orderIdColIndex))
	messageIdColLetter := string(rune('A' + messageIdColIndex))

    // 2. Fetch the Order ID column to find the row
	readRange := fmt.Sprintf("%s!%s2:%s", sheetName, orderIdColLetter, orderIdColLetter) // e.g., "Orders_A!B2:B"
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		log.Printf("Error fetching Order ID column from %s: %v", sheetName, err)
		return
	}

	// 3. Find the row number
	targetRowIndex := -1
	for i, row := range resp.Values {
		if len(row) > 0 && fmt.Sprintf("%v", row[0]) == orderId {
			targetRowIndex = i + 2 // +2 because data starts at row 2
			break
		}
	}

	if targetRowIndex == -1 {
		log.Printf("Error: Could not find row for OrderID %s in sheet %s", orderId, sheetName)
		return
	}

	// 4. Update the Message ID cell
	updateA1Range := fmt.Sprintf("%s!%s%d", sheetName, messageIdColLetter, targetRowIndex) // e.g., "Orders_A!T10"
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{messageId}}, // Pass messageId as int64
	}
	_, updateErr := sheetsService.Spreadsheets.Values.Update(spreadsheetID, updateA1Range, valueRange).ValueInputOption("RAW").Do()
	
	if updateErr != nil {
		log.Printf("Error updating MessageID for OrderID %s in sheet %s: %v", orderId, sheetName, updateErr)
	} else {
		log.Printf("Successfully saved MessageID %d for OrderID %s in sheet %s (Row %d)", messageId, orderId, sheetName, targetRowIndex)
	}
}


// --- Fetch & Cache Sheet Data (Rewritten) ---
func getCachedSheetData(sheetName string, target interface{}, duration time.Duration) error {
	cacheKey := "sheet_" + sheetName
	cachedData, found := getCache(cacheKey)
	if found {
		// Try to cast cached data (which is already []map[string]interface{})
		jsonData, err := json.Marshal(cachedData)
		if err == nil {
			err = json.Unmarshal(jsonData, target)
			if err == nil {
				return nil // Cache hit and conversion successful
			}
			log.Printf("Error unmarshalling cached data for %s: %v", sheetName, err)
		} else {
             log.Printf("Error marshalling cached data for %s: %v", sheetName, err)
        }
	}

	// Fetch from source if not found or cache is invalid
	log.Printf("Fetching fresh data for %s (via Sheets API)", sheetName)
	// *** MODIFIED: Call new API function ***
	mappedData, err := fetchSheetDataFromAPI(sheetName)
	if err != nil {
		return err
	}
	
	// Convert mappedData to the target struct (e.g., []User)
	// This requires the same two-step marshal/unmarshal as before
	jsonData, err := json.Marshal(mappedData)
	if err != nil {
		log.Printf("Error marshalling data from Sheets API for %s: %v", sheetName, err)
		return fmt.Errorf("internal error processing sheet data")
	}
	err = json.Unmarshal(jsonData, target)
	if err != nil {
		log.Printf("Error unmarshalling data for %s: %v. JSON: %s", sheetName, err, string(jsonData))
		return fmt.Errorf("mismatched data structure for %s", sheetName)
	}

	// Cache the *mapped* data
	setCache(cacheKey, mappedData, duration)
	return nil
}

// --- API Handlers ---

func handlePing(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Go backend pong"})
}

func handleGetUsers(c *gin.Context) {
	var users []User
	err := getCachedSheetData("Users", &users, 15*time.Minute) // 15 min cache
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": users})
}

func handleGetStaticData(c *gin.Context) {
	// Fetch all required static data sequentially (safer for Sheets API quotas)
	
	// *** MODIFIED (Fix 2: 'goto' error): Declare all variables at the top ***
	result := make(map[string]interface{})
	var err error

	// Declare all variables here, before any 'goto'
	var pages []TeamPage
	var products []Product
	var locations []Location
	var shippingMethods []ShippingMethod
	var settingsMaps []map[string]interface{} // Settings is special
	var colors []Color
	var drivers []Driver
	var bankAccounts []BankAccount
	var phoneCarriers []PhoneCarrier
	// *** END MODIFICATION ***


	err = getCachedSheetData("TeamsPages", &pages, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["pages"] = pages

	err = getCachedSheetData("Products", &products, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["products"] = products

	err = getCachedSheetData("Locations", &locations, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["locations"] = locations

	err = getCachedSheetData("ShippingMethods", &shippingMethods, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["shippingMethods"] = shippingMethods

	// --- Get UploadFolderID from Settings ---
	err = getCachedSheetData("Settings", &settingsMaps, cacheTTL)
	if err != nil { goto handleError }
	result["settings"] = settingsMaps // Frontend might not even need this now
	// Also set the global variable
	if len(settingsMaps) > 0 {
		if id, ok := settingsMaps[0]["UploadFolderID"].(string); ok {
			uploadFolderID = id // Get from sheet
		}
	}
	if uploadFolderID == "" {
		uploadFolderID = os.Getenv("UPLOAD_FOLDER_ID") // Use env var as fallback
	}
	// ---

	err = getCachedSheetData("Colors", &colors, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["colors"] = colors

	err = getCachedSheetData("Drivers", &drivers, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["drivers"] = drivers

	err = getCachedSheetData("BankAccounts", &bankAccounts, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["bankAccounts"] = bankAccounts

	err = getCachedSheetData("PhoneCarriers", &phoneCarriers, cacheTTL)
	if err != nil { goto handleError } // Now safe to jump
	result["phoneCarriers"] = phoneCarriers

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": result})
	return

handleError:
	c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
}


// --- *** NEW: Helper to format message *** ---
func formatTelegramMessage(template string, data map[string]interface{}) string {
	msg := template

	// Extract data with type safety
	orderId, _ := data["orderId"].(string)
	customer, _ := data["customer"].(map[string]interface{})
	customerName, _ := customer["name"].(string)
	customerPhone, _ := customer["phone"].(string)
	province, _ := customer["province"].(string)
	district, _ := customer["district"].(string)
	sangkat, _ := customer["sangkat"].(string)
	additionalLocation, _ := customer["additionalLocation"].(string)
	if additionalLocation == "" {
		additionalLocation = "(មិនបានបញ្ជាក់)"
	}
	location := strings.Join(filterEmpty([]string{province, district, sangkat}), ", ")

	subtotal, _ := data["subtotal"].(float64)
	shippingFee, _ := customer["shippingFee"].(float64)
	grandTotal, _ := data["grandTotal"].(float64)

	payment, _ := data["payment"].(map[string]interface{})
	paymentStatus, _ := payment["status"].(string)
	paymentInfo, _ := payment["info"].(string)
	var paymentStatusStr string
	if paymentStatus == "Paid" {
		paymentStatusStr = fmt.Sprintf("✅ Paid (%s)", paymentInfo)
	} else {
		paymentStatusStr = "🟥 COD (Unpaid)"
	}

	shipping, _ := data["shipping"].(map[string]interface{})
	shippingMethod, _ := shipping["method"].(string)
	shippingDetails, _ := shipping["details"].(string)
	var shippingDetailsStr string
	if shippingDetails != "" && shippingDetails != shippingMethod {
		shippingDetailsStr = fmt.Sprintf(" (%s)", shippingDetails)
	}

	note, _ := data["note"].(string)
	var noteStr string
	if note != "" {
		noteStr = fmt.Sprintf("\n\n📝 *ចំណាំបន្ថែម:*\n_%s_", note)
	}

	currentUser, _ := data["currentUser"].(User) // Assumes full User struct is passed
	page, _ := data["page"].(string)
	telegramValue, _ := data["telegramValue"].(string)
	var sourceInfo string
	if strings.ToLower(page) == "telegram" {
		sourceInfo = fmt.Sprintf("*Telegram:* %s", telegramValue)
	} else {
		sourceInfo = fmt.Sprintf("*Page:* %s", telegramValue)
	}

	// Build Products List
	var productsList strings.Builder
	products, _ := data["products"].([]map[string]interface{})
	for _, p := range products {
		name, _ := p["name"].(string)
		quantity, _ := p["quantity"].(float64) // JSON numbers are float64
		colorInfo, _ := p["colorInfo"].(string)
		total, _ := p["total"].(float64)
		
		productsList.WriteString(fmt.Sprintf("  - %s (x%.0f)", name, quantity))
		if colorInfo != "" {
			productsList.WriteString(fmt.Sprintf(" [%s]", colorInfo))
		}
		productsList.WriteString(fmt.Sprintf(" = *$%.2f*\n", total))
	}


	// Replacements
	r := strings.NewReplacer(
		"{{orderId}}", orderId,
		"{{customerName}}", customerName,
		"{{customerPhone}}", customerPhone,
		"{{location}}", location,
		"{{addressDetails}}", additionalLocation,
		"{{productsList}}", strings.TrimRight(productsList.String(), "\n"),
		"{{subtotal}}", fmt.Sprintf("%.2f", subtotal),
		"{{shippingFee}}", fmt.Sprintf("%.2f", shippingFee),
		"{{grandTotal}}", fmt.Sprintf("%.2f", grandTotal),
		"{{paymentStatus}}", paymentStatusStr,
		"{{shippingMethod}}", shippingMethod,
		"{{shippingDetails}}", shippingDetailsStr,
		"{{note}}", noteStr,
		"{{user}}", currentUser.UserName,
		"{{sourceInfo}}", sourceInfo,
	)

	return r.Replace(msg)
}
func filterEmpty(s []string) []string {
	var r []string
	for _, str := range s {
		if str != "" {
			r = append(r, str)
		}
	}
	return r
}

// --- *** NEW: Helper to create Label Button *** ---
func createLabelButtonInline(data map[string]interface{}) *tgbotapi.InlineKeyboardMarkup {
	if labelPrinterURL == "" {
		log.Println("LABEL_PRINTER_URL is not set. Skipping label button.")
		return nil
	}

	// Extract data
	orderId, _ := data["orderId"].(string)
	page, _ := data["page"].(string)
	currentUser, _ := data["currentUser"].(User)
	customer, _ := data["customer"].(map[string]interface{})
	customerName, _ := customer["name"].(string)
	customerPhone, _ := customer["phone"].(string)
	province, _ := customer["province"].(string)
	district, _ := customer["district"].(string)
	sangkat, _ := customer["sangkat"].(string)
	additionalLocation, _ := customer["additionalLocation"].(string)
	location := strings.Join(filterEmpty([]string{province, district, sangkat}), ", ")
	payment, _ := data["payment"].(map[string]interface{})
	paymentStatus, _ := payment["status"].(string)
	grandTotal, _ := data["grandTotal"].(float64)
	shipping, _ := data["shipping"].(map[string]interface{})
	shippingMethod, _ := shipping["method"].(string)

	// Build URL parameters
	params := url.Values{}
	params.Add("id", orderId)
	params.Add("page", page)
	params.Add("user", currentUser.UserName)
	params.Add("name", customerName)
	params.Add("phone", customerPhone)
	params.Add("location", location)
	params.Add("address", additionalLocation)
	params.Add("payment", paymentStatus)
	params.Add("total", fmt.Sprintf("%.2f", grandTotal))
	params.Add("shipping", shippingMethod)
	
	fullUrl := fmt.Sprintf("%s?%s", labelPrinterURL, params.Encode())

	// Create button
	button := tgbotapi.NewInlineKeyboardButtonURL("📦 ព្រីន Label (78x50mm)", fullUrl)
	keyboard := tgbotapi.NewInlineKeyboardMarkup(
		tgbotapi.NewInlineKeyboardRow(button),
	)
	return &keyboard
}

// --- *** NEW: Fully Implemented Telegram Function *** ---
func sendTelegramNotification(team string, fullOrderData map[string]interface{}) {
	// 1. Get Config
	bot, botExists := telegramBots[team]
	config, configExists := telegramConfig[team]

	if !botExists || !configExists {
		log.Printf("Error: Telegram config or bot instance not found for team %s", team)
		return
	}
	
	groupIDStr, ok := config["groupID"]
	if !ok {
		log.Printf("Error: Group ID not found for team %s", team)
		return
	}
	groupID, err := strconv.ParseInt(groupIDStr, 10, 64) // Telegram IDs are int64
	if err != nil {
		log.Printf("Error: Invalid Group ID '%s' for team %s", groupIDStr, team)
		return
	}
	
	topicIDStr, hasTopic := config["topicID"]
	var topicID int64 // 0 means no topic
	if hasTopic {
		topicID, _ = strconv.ParseInt(topicIDStr, 10, 64) // Ignore error, will be 0 if invalid
	}

	// 2. Get Templates
	var templates []TelegramTemplate
    err = getCachedSheetData(TelegramTemplatesSheet, &templates, time.Hour) // Cache templates for 1 hour
    if err != nil {
        log.Printf("Error fetching Telegram templates for team %s: %v", team, err)
        return
    }
    
    teamTemplates := []TelegramTemplate{}
    for _, t := range templates {
        if strings.EqualFold(t.Team, team) {
            teamTemplates = append(teamTemplates, t)
        }
    }
    sort.Slice(teamTemplates, func(i, j int) bool {
		return teamTemplates[i].Part < teamTemplates[j].Part
	})

	if len(teamTemplates) == 0 {
		log.Printf("Error: No Telegram templates found for team %s", team)
		return
	}

	// 3. Create Label Button (if applicable)
	labelButton := createLabelButtonInline(fullOrderData)

	// 4. Send Messages
	var firstMessageID int64 = 0
	
	for i, t := range teamTemplates {
		part := t.Part
		formattedText := formatTelegramMessage(t.Template, fullOrderData)

		msg := tgbotapi.NewMessage(groupID, formattedText)
		msg.ParseMode = tgbotapi.ModeMarkdown // Use Markdown
		if topicID != 0 {
			// *** FIX 1: Changed from MessageThreadID to ReplyToMessageID ***
			// This assumes your TopicID is the ID of the first message in a topic,
			// which is how older versions (like v5.5.1) handle topics.
			msg.ReplyToMessageID = int(topicID)
		}

		// Attach Label Button to Part 2 (index 1)
		if i == 1 && labelButton != nil {
			msg.ReplyMarkup = labelButton
		}

		// Send the message
		sentMessage, err := bot.Send(msg)
		if err != nil {
			log.Printf("Error sending Telegram message (Part %d) for team %s: %v", part, team, err)
			// Continue trying to send other parts
		} else {
			// Save the Message ID of the *first* message (Part 1)
			if i == 0 {
				firstMessageID = int64(sentMessage.MessageID)
			}
		}
		
		time.Sleep(300 * time.Millisecond) // Small delay between messages
	}

	// 5. Update Sheet with Message ID (in background)
	if firstMessageID != 0 {
		orderId, _ := fullOrderData["orderId"].(string)
		go updateTelegramMessageIDInSheet(team, orderId, firstMessageID)
	}
}

// --- *** NEW (Fix 2): Add Placeholder Function Back *** ---
func generateAndSendPDF(team string, orderId string, orderData map[string]interface{}) {
    log.Printf("Placeholder: Generating/Sending PDF for team %s, Order ID %s", team, orderId)
    // TODO:
    // 1. Option A: Use a Go PDF library (e.g., gofpdf) to generate PDF directly.
    // 2. Option B: Generate HTML for the invoice (similar to Apps Script).
    //    - Then, either use a Go library to convert HTML to PDF (can be complex, might need headless Chrome)
    //    - OR send the HTML to another microservice dedicated to PDF generation.
    // 3. Send the generated PDF/document via Telegram.
}


// ... (handleSubmitOrder remains the same, but sendTelegramNotification is now implemented) ...
func handleSubmitOrder(c *gin.Context) {
	var orderRequest struct {
		CurrentUser  User                   `json:"currentUser"`
		SelectedTeam string                 `json:"selectedTeam"`
		Page         string                 `json:"page"`
		TelegramValue string                `json:"telegramValue"`
		Customer     map[string]interface{} `json:"customer"`
		Products     []map[string]interface{} `json:"products"`
		Shipping     map[string]interface{} `json:"shipping"`
		Payment      map[string]interface{} `json:"payment"`
		Telegram     map[string]interface{} `json:"telegram"`
		Subtotal     float64                `json:"subtotal"`
		GrandTotal   float64                `json:"grandTotal"`
		Note         string                 `json:"note"`
	}

	if err := c.ShouldBindJSON(&orderRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid order data format: " + err.Error()})
		return
	}

	team := orderRequest.SelectedTeam
	if team == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Team not selected"})
		return
	}
	orderSheetName := "Orders_" + team // Assuming CONFIG.ORDER_SHEET_PREFIX

	// Prepare data row for Apps Script
	timestamp := time.Now().UTC().Format(time.RFC3339) // Use ISO format
	orderId := fmt.Sprintf("GO-%s-%d", team, time.Now().UnixNano()) // Generate ID in Go

	productsJSON, err := json.Marshal(orderRequest.Products)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to serialize products"})
		return
	}
    
    // Construct location string safely
    var locationParts []string
	if p, ok := orderRequest.Customer["province"].(string); ok && p != "" { locationParts = append(locationParts, p) }
	if d, ok := orderRequest.Customer["district"].(string); ok && d != "" { locationParts = append(locationParts, d) }
	if s, ok := orderRequest.Customer["sangkat"].(string); ok && s != "" { locationParts = append(locationParts, s) }
	fullLocation := strings.Join(locationParts, ", ")

    // Ensure numeric types from frontend are correct
    shippingFee, _ := orderRequest.Customer["shippingFee"].(float64)
    shippingCost, _ := orderRequest.Shipping["cost"].(float64)


	rowData := []interface{}{
		timestamp, orderId, orderRequest.CurrentUser.UserName, orderRequest.Page, orderRequest.TelegramValue,
		orderRequest.Customer["name"], orderRequest.Customer["phone"], fullLocation,
		orderRequest.Customer["additionalLocation"], orderRequest.Note, shippingFee,
		orderRequest.Subtotal, orderRequest.GrandTotal, string(productsJSON),
		orderRequest.Shipping["method"], orderRequest.Shipping["details"], shippingCost,
		orderRequest.Payment["status"], orderRequest.Payment["info"],
		"", // Placeholder for Telegram Message ID (Go backend handles sending)
	}

	// Append to the specific team's order sheet
	err = appendRowToSheet(orderSheetName, rowData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to save order to Google Sheet: " + err.Error()})
		return
	}

    // Append to AllOrders sheet
    rowDataWithTeam := append(rowData, team)
    err = appendRowToSheet(AllOrdersSheet, rowDataWithTeam)
    if err != nil {
        log.Printf("Warning: Failed to append to AllOrders sheet: %v", err)
    }

	// Append to Revenue sheet
	err = appendRowToSheet(RevenueSheet, []interface{}{timestamp, team, orderRequest.Page, orderRequest.GrandTotal})
	if err != nil {
		log.Printf("Warning: Failed to append to RevenueDashboard: %v", err)
	}
    
    // Log user activity via Apps Script
    err = appendRowToSheet(UserActivitySheet, []interface{}{
		timestamp,
		orderRequest.CurrentUser.UserName, 
		"SUBMIT_ORDER_GO", 
		fmt.Sprintf(`{"orderId":"%s","team":"%s","grandTotal":%.2f}`, orderId, team, orderRequest.GrandTotal),
	})
    if err != nil {
        log.Printf("Warning: Failed to log user activity for order submission: %v", err)
    }

	// --- Handle Telegram/PDF ---
	// Combine all data needed for notifications/PDF
	fullOrderData := map[string]interface{}{
	    "orderId": orderId, // Add generated Order ID
	    "currentUser": orderRequest.CurrentUser,
	    "selectedTeam": orderRequest.SelectedTeam,
	    "page": orderRequest.Page,
	    "telegramValue": orderRequest.TelegramValue,
	    "customer": orderRequest.Customer,
	    "products": orderRequest.Products,
	    "shipping": orderRequest.Shipping,
	    "payment": orderRequest.Payment,
	    "telegram": orderRequest.Telegram, // Keep scheduling info if needed
	    "subtotal": orderRequest.Subtotal,
	    "grandTotal": orderRequest.GrandTotal,
	    "note": orderRequest.Note,
	}

	// TODO: Check scheduling logic (orderRequest.Telegram)
	isScheduled, _ := orderRequest.Telegram["schedule"].(bool)
	if isScheduled {
		scheduleTimeStr, _ := orderRequest.Telegram["time"].(string)
		// TODO: Implement scheduling logic in Go (e.g., save to DB/queue, use cron)
		log.Printf("Order %s scheduled for %s (Scheduling logic TBD in Go)", orderId, scheduleTimeStr)
	} else {
		// Send notifications immediately (placeholders)
		go sendTelegramNotification(team, fullOrderData)
		go generateAndSendPDF(team, orderId, fullOrderData) // *** THIS IS LINE 977 ***
	}

	// Invalidate relevant caches
	invalidateSheetCache(AllOrdersSheet)
	invalidateSheetCache(RevenueSheet)
	invalidateSheetCache(orderSheetName) // Invalidate specific team sheet


	c.JSON(http.StatusOK, gin.H{"status": "success", "orderId": orderId})
}

// ... (handleImageUploadProxy remains the same) ...
func handleImageUploadProxy(c *gin.Context) {
    var uploadRequest struct {
		FileData string `json:"fileData"`
		FileName string `json:"fileName"`
		MimeType string `json:"mimeType"`
		// Pass through sheet/pk/column info
		SheetName string `json:"sheetName"`
		PrimaryKey map[string]string `json:"primaryKey"`
		ColumnName string `json:"columnName"`
	}

	if err := c.ShouldBindJSON(&uploadRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid image upload data format: " + err.Error()})
		return
	}

	// 1. Decode Base64
	fileData, err := base64.StdEncoding.DecodeString(uploadRequest.FileData)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid base64 data"})
		return
	}
	fileReader := bytes.NewReader(fileData)
	
	if uploadFolderID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Upload Folder ID is not configured on the server."})
		return
	}

	// 2. Upload to Google Drive
	file := &drive.File{
		Name:     uploadRequest.FileName,
		MimeType: uploadRequest.MimeType,
		Parents:  []string{uploadFolderID}, // Set parent folder
	}

	createdFile, err := driveService.Files.Create(file).Media(fileReader).Do()
	if err != nil {
		log.Printf("Error uploading file to Drive: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to upload file to Google Drive: " + err.Error()})
		return
	}

	// 3. Set file permissions to public (Anyone with link can view)
	permission := &drive.Permission{
		Role: "reader",
		Type: "anyone",
	}
	_, err = driveService.Permissions.Create(createdFile.Id, permission).Do()
	if err != nil {
		log.Printf("Error setting permissions on Drive file %s: %v", createdFile.Id, err)
		// Don't fail the whole request, just log a warning
	}

	// 4. Construct the direct download URL
	fileUrl := fmt.Sprintf("https://drive.google.com/uc?id=%s", createdFile.Id)


    // 5. Update the specific sheet cell (in background)
    if uploadRequest.SheetName != "" && uploadRequest.PrimaryKey != nil && uploadRequest.ColumnName != "" {
        go func() { // Update sheet in the background
            pkHeader := ""
            pkValue := ""
            for k, v := range uploadRequest.PrimaryKey {
                pkHeader = k
                pkValue = v
                break // Assuming single primary key
            }
            if pkHeader == "" || pkValue == "" {
                log.Printf("Warning: Missing primary key info for image update. Sheet: %s, Column: %s", uploadRequest.SheetName, uploadRequest.ColumnName)
                return
            }

            var sheetRows []map[string]interface{}
            targetRowIndex := -1
			
			// Fetch fresh data (don't use cache) to find the correct row
			mappedData, err := fetchSheetDataFromAPI(uploadRequest.SheetName)
			if err != nil {
				log.Printf("Error fetching sheet %s to update image URL: %v", uploadRequest.SheetName, err)
				return
			}
			sheetRows = mappedData

            // Find the row index
            for i, row := range sheetRows {
                 if val, ok := row[pkHeader]; ok && fmt.Sprintf("%v", val) == pkValue {
                      targetRowIndex = i + 2 // +2 for 1-based index and header row
                      break
                 }
            }

            if targetRowIndex == -1 {
                 log.Printf("Warning: Row not found for PK %s=%s in sheet %s for image update.", pkHeader, pkValue, uploadRequest.SheetName)
                 return
            }

			// Find the column letter (e.g., "D")
			_, ok := sheetRanges[uploadRequest.SheetName]
			if !ok {
				log.Printf("Error: No A1 range defined for %s, cannot update cell.", uploadRequest.SheetName)
				return
			}
			
			headersResp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, fmt.Sprintf("%s!1:1", uploadRequest.SheetName)).Do()
			if err != nil || len(headersResp.Values) == 0 {
				log.Printf("Error fetching headers for %s: %v", uploadRequest.SheetName, err)
				return
			}
			
			colIndex := -1
			for i, header := range headersResp.Values[0] {
				if fmt.Sprintf("%v", header) == uploadRequest.ColumnName {
					colIndex = i
					break
				}
			}
			if colIndex == -1 {
				log.Printf("Error: Column '%s' not found in sheet '%s'", uploadRequest.ColumnName, uploadRequest.SheetName)
				return
			}
			
			// Convert column index (0-based) to letter (A-based)
			colLetter := string(rune('A' + colIndex))
			updateA1Range := fmt.Sprintf("%s!%s%d", uploadRequest.SheetName, colLetter, targetRowIndex)

            // Call Update in Sheets API
            valueRange := &sheets.ValueRange{
				Values: [][]interface{}{{fileUrl}},
			}
			_, updateErr := sheetsService.Spreadsheets.Values.Update(spreadsheetID, updateA1Range, valueRange).ValueInputOption("RAW").Do()
             
			if updateErr != nil {
                  log.Printf("Error updating sheet %s (Range %s) with image URL: %v", uploadRequest.SheetName, updateA1Range, updateErr)
             } else {
                  log.Printf("Successfully updated sheet %s (Range %s) with image URL", uploadRequest.SheetName, updateA1Range)
                  invalidateSheetCache(uploadRequest.SheetName) // Invalidate cache
             }
        }() // End background update
    }

	c.JSON(http.StatusOK, gin.H{"status": "success", "url": fileUrl})
}


// ... (handleUpdateFormulaReport remains the same) ...
func handleUpdateFormulaReport(c *gin.Context) {
	// 1. Fetch AllOrders data
	var allOrders []Order
	// Invalidate cache first to ensure fresh data for report
	invalidateSheetCache(AllOrdersSheet) 
	err := getCachedSheetData(AllOrdersSheet, &allOrders, cacheTTL) // Fetch fresh, then cache
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch order data: " + err.Error()})
		return
	}

	reportData := [][]interface{}{
		{"Category", "Period", "Total Sales", "Total Expense"}, // Header row
	}

	if len(allOrders) == 0 {
		// Overwrite with headers only if no data
		err = overwriteSheetDataInAPI(FormulaReportSheet, reportData)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to clear/write headers to report sheet: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Formula Report updated (No order data found)."})
		return
	}

	// 2. Process Data in Go
	yearlyData := make(map[int]*ReportSummary)
	monthlyData := make(map[string]*ReportSummary) // Key: "YYYY-MM"
	dailyData := make(map[string]*ReportSummary)   // Key: "YYYY-MM-DD"

	now := time.Now()
	currentYear := now.Year()
	currentMonth := now.Month()
    loc, _ := time.LoadLocation("Asia/Phnom_Penh") // Load Cambodia timezone
	if loc == nil {
		loc = time.UTC // Fallback
	}


	for _, order := range allOrders {
		ts, err := time.Parse(time.RFC3339, order.Timestamp) // Try ISO string first
        if err != nil {
             log.Printf("Warning: Could not parse timestamp '%s' for order %s: %v. Skipping record.", order.Timestamp, order.OrderID, err)
             continue
        }
        ts = ts.In(loc) // Convert to local time for aggregation


		year := ts.Year()
		month := ts.Month()
		// day := ts.Day()
		yearMonthKey := fmt.Sprintf("%d-%02d", year, month)
		yearMonthDayKey := ts.Format("2006-01-02") // Use standard format for daily key

		// Aggregate Yearly
		if _, ok := yearlyData[year]; !ok {
			yearlyData[year] = &ReportSummary{}
		}
		yearlyData[year].TotalSales += order.GrandTotal
		yearlyData[year].TotalExpense += order.InternalCost

		// Aggregate Monthly (Current Year)
		if year == currentYear {
			if _, ok := monthlyData[yearMonthKey]; !ok {
				monthlyData[yearMonthKey] = &ReportSummary{}
			}
			monthlyData[yearMonthKey].TotalSales += order.GrandTotal
			monthlyData[yearMonthKey].TotalExpense += order.InternalCost
		}

		// Aggregate Daily (Current Month of Current Year)
		if year == currentYear && month == currentMonth {
			if _, ok := dailyData[yearMonthDayKey]; !ok {
				dailyData[yearMonthDayKey] = &ReportSummary{}
			}
			dailyData[yearMonthDayKey].TotalSales += order.GrandTotal
			dailyData[yearMonthDayKey].TotalExpense += order.InternalCost
		}
	}

	// 3. Format Output for Sheet
	// (Headers already added)

	// Add Yearly Data
	reportData = append(reportData, []interface{}{"YEARLY REPORT", "", "", ""})
	years := make([]int, 0, len(yearlyData))
	for y := range yearlyData {
		years = append(years, y)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(years))) // Sort years descending
	for _, year := range years {
		summary := yearlyData[year]
		reportData = append(reportData, []interface{}{"", year, fmt.Sprintf("%.2f", summary.TotalSales), fmt.Sprintf("%.2f", summary.TotalExpense)})
	}
	reportData = append(reportData, []interface{}{}) // Blank row

	// Add Monthly Data (Current Year)
	reportData = append(reportData, []interface{}{fmt.Sprintf("MONTHLY REPORT (%d)", currentYear), "", "", ""})
	for m := 1; m <= 12; m++ {
        monthKey := fmt.Sprintf("%d-%02d", currentYear, m)
        summary, ok := monthlyData[monthKey]
        monthName := time.Month(m).String() // Get English month name
		if ok {
		     reportData = append(reportData, []interface{}{"", monthName, fmt.Sprintf("%.2f", summary.TotalSales), fmt.Sprintf("%.2f", summary.TotalExpense)})
		} else {
             // Show months with zero values
             reportData = append(reportData, []interface{}{"", monthName, "0.00", "0.00"})
        }
    }

	reportData = append(reportData, []interface{}{}) // Blank row

	// Add Daily Data (Current Month)
	reportData = append(reportData, []interface{}{fmt.Sprintf("DAILY REPORT (%s %d)", currentMonth.String(), currentYear), "", "", ""})
	dayKeys := make([]string, 0, len(dailyData))
	for d := range dailyData {
		dayKeys = append(dayKeys, d)
	}
	sort.Strings(dayKeys) // Sort days chronologically
	for _, dayKey := range dayKeys {
		summary := dailyData[dayKey]
        // Format date like "Oct 28, 2025"
        t, _ := time.Parse("2006-01-02", dayKey)
		dayLabel := t.Format("Jan 02, 2006")
		reportData = append(reportData, []interface{}{"", dayLabel, fmt.Sprintf("%.2f", summary.TotalSales), fmt.Sprintf("%.2f", summary.TotalExpense)})
	}

	// 4. Write Data to Sheet via Apps Script
	err = overwriteSheetDataInAPI(FormulaReportSheet, reportData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to write report data: " + err.Error()})
		return
	}
    
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Formula Report updated successfully."})
}


// ... (handleGetRevenueSummary remains the same) ...
func handleGetRevenueSummary(c *gin.Context) {
	// 1. Fetch RevenueDashboard data
	var revenueEntries []RevenueEntry
	// Invalidate cache first to ensure fresh data
	invalidateSheetCache(RevenueSheet)
	err := getCachedSheetData(RevenueSheet, &revenueEntries, cacheTTL) // Fetch fresh, then cache
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch revenue data: " + err.Error()})
		return
	}

	if len(revenueEntries) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "success", "data": RevenueAggregate{ // Return empty structure
		    YearlyByTeam:   make(map[int]map[string]float64),
            YearlyByPage:   make(map[int]map[string]float64),
            MonthlyByTeam:  make(map[string]map[string]float64),
            MonthlyByPage:  make(map[string]map[string]float64),
            DailyByTeam:    make(map[string]map[string]float64),
            DailyByPage:    make(map[string]map[string]float64),
		}})
		return
	}

	// 2. Process Data in Go
	yearlyByTeam := make(map[int]map[string]float64)
    yearlyByPage := make(map[int]map[string]float64)
    monthlyByTeam := make(map[string]map[string]float64) // Key: "YYYY-MM"
    monthlyByPage := make(map[string]map[string]float64) // Key: "YYYY-MM"
    dailyByTeam := make(map[string]map[string]float64)   // Key: "YYYY-MM-DD"
    dailyByPage := make(map[string]map[string]float64)   // Key: "YYYY-MM-DD"

	now := time.Now()
	currentYear := now.Year()
	currentMonth := now.Month()
    loc, _ := time.LoadLocation("Asia/Phnom_Penh") // Load Cambodia timezone
	if loc == nil {
		loc = time.UTC // Fallback
	}


	for _, entry := range revenueEntries {
		ts, err := time.Parse(time.RFC3339, entry.Timestamp)
        if err != nil {
             log.Printf("Warning: Could not parse timestamp '%s' for revenue entry. Skipping.", entry.Timestamp)
             continue
        }
        ts = ts.In(loc) // Convert to local time

		year := ts.Year()
		month := ts.Month()
		// day := ts.Day() // Not needed for key directly
		yearMonthKey := fmt.Sprintf("%d-%02d", year, month)
		yearMonthDayKey := ts.Format("2006-01-02") // Use standard format for daily key

        team := entry.Team
		if team == "" { team = "Unknown" }
        page := entry.Page
		if page == "" { page = "Unknown" }
        revenue := entry.Revenue

        // --- Aggregate Yearly ---
        if _, ok := yearlyByTeam[year]; !ok { yearlyByTeam[year] = make(map[string]float64) }
        yearlyByTeam[year][team] += revenue

        if _, ok := yearlyByPage[year]; !ok { yearlyByPage[year] = make(map[string]float64) }
        yearlyByPage[year][page] += revenue

        // --- Aggregate Monthly (Current Year Only) ---
		if year == currentYear {
			if _, ok := monthlyByTeam[yearMonthKey]; !ok { monthlyByTeam[yearMonthKey] = make(map[string]float64) }
            monthlyByTeam[yearMonthKey][team] += revenue

			// *** THIS IS LINE 1383 (approx) ***
            if _, ok := monthlyByPage[yearMonthKey]; !ok { monthlyByPage[yearMonthKey] = make(map[string]float64) } // *** FIX 1: Was map[string]map[string]float64 ***
            monthlyByPage[yearMonthKey][page] += revenue
		}

		// --- Aggregate Daily (Current Month of Current Year Only) ---
		if year == currentYear && month == currentMonth {
			if _, ok := dailyByTeam[yearMonthDayKey]; !ok { dailyByTeam[yearMonthDayKey] = make(map[string]float64) }
            dailyByTeam[yearMonthDayKey][team] += revenue

			// *** THIS IS LINE 1396 (approx) ***
            if _, ok := dailyByPage[yearMonthDayKey]; !ok { dailyByPage[yearMonthDayKey] = make(map[string]float64) } // *** FIX 2: Was map[string]map[string]float64 ***
            dailyByPage[yearMonthDayKey][page] += revenue
		}
	}

    // 3. Prepare response
    response := RevenueAggregate{
        YearlyByTeam:   yearlyByTeam,
        YearlyByPage:   yearlyByPage,
        MonthlyByTeam:  monthlyByTeam,
        MonthlyByPage:  monthlyByPage,
        DailyByTeam:    dailyByTeam,
        DailyByPage:    dailyByPage,
    }

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": response})
}

// --- *** NEW: Load Telegram Config at Startup *** ---
func loadTelegramConfig() {
	log.Println("Loading Telegram configuration from environment variables...")
	
	for _, env := range os.Environ() {
		parts := strings.SplitN(env, "=", 2)
		key := parts[0]
		value := parts[1]

		// Example Key: TELEGRAM_BOT_TOKEN_TEAM_A
		if strings.HasPrefix(key, "TELEGRAM_BOT_TOKEN_TEAM_") {
			teamName := strings.TrimPrefix(key, "TELEGRAM_BOT_TOKEN_TEAM_")
			
			if _, ok := telegramConfig[teamName]; !ok {
				telegramConfig[teamName] = make(map[string]string)
			}
			telegramConfig[teamName]["token"] = value

			// Initialize bot instance
			bot, err := tgbotapi.NewBotAPI(value)
			if err != nil {
				log.Printf("Error: Failed to create Telegram bot instance for team %s: %v", teamName, err)
			} else {
				log.Printf("Successfully created Telegram bot instance for team %s (User: %s)", teamName, bot.Self.UserName)
				telegramBots[teamName] = bot
			}

		} else if strings.HasPrefix(key, "TELEGRAM_GROUP_ID_TEAM_") {
			teamName := strings.TrimPrefix(key, "TELEGRAM_GROUP_ID_TEAM_")
			if _, ok := telegramConfig[teamName]; !ok { telegramConfig[teamName] = make(map[string]string) }
			telegramConfig[teamName]["groupID"] = value

		} else if strings.HasPrefix(key, "TELEGRAM_TOPIC_ID_TEAM_") {
			teamName := strings.TrimPrefix(key, "TELEGRAM_TOPIC_ID_TEAM_")
			if _, ok := telegramConfig[teamName]; !ok { telegramConfig[teamName] = make(map[string]string) }
			telegramConfig[teamName]["topicID"] = value

		} else if strings.HasPrefix(key, "TELEGRAM_ARCHIVE_ID_TEAM_") {
			teamName := strings.TrimPrefix(key, "TELEGRAM_ARCHIVE_ID_TEAM_")
			if _, ok := telegramConfig[teamName]; !ok { telegramConfig[teamName] = make(map[string]string) }
			telegramConfig[teamName]["archiveID"] = value
		}
	}
	log.Printf("Loaded %d bot configurations.", len(telegramBots))
}


// --- Main Function ---
func main() {
	// --- Load configuration from environment variables ---
	spreadsheetID = os.Getenv("GOOGLE_SHEET_ID")
	uploadFolderID = os.Getenv("UPLOAD_FOLDER_ID") // Can be overridden by Settings sheet
	labelPrinterURL = os.Getenv("LABEL_PRINTER_URL") // NEW
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port for local development
	}
	renderBaseURL = os.Getenv("RENDER_EXTERNAL_URL") // Render provides this automatically

	if spreadsheetID == "" {
		log.Fatal("GOOGLE_SHEET_ID environment variable is required.")
	}
	// Note: GCP_CREDENTIALS is read directly in createGoogleAPIClient

	// --- NEW: Load Telegram Config ---
	loadTelegramConfig()

	// --- Create Google API Clients ---
	ctx := context.Background()
	err := createGoogleAPIClient(ctx)
	if err != nil {
		log.Fatalf("Failed to create Google API clients: %v", err)
	}

	log.Printf("Connected to Google Sheet ID: %s", spreadsheetID)
	log.Printf("Render Base URL: %s", renderBaseURL)


	// --- Setup Gin Router ---
	router := gin.Default()

	// CORS configuration (allow requests from your frontend domain)
	config := cors.DefaultConfig()
    // Allow all origins for simplicity during development, restrict in production
	config.AllowOrigins = []string{"*"}
	config.AllowMethods = []string{"GET", "POST", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
	router.Use(cors.New(config))


	// --- Define API Routes ---
	api := router.Group("/api") // Group API routes under /api
	{
		api.GET("/ping", handlePing)
		api.GET("/users", handleGetUsers) // Corresponds to ?action=getUsers
		api.GET("/static-data", handleGetStaticData) // Corresponds to ?action=getStaticData
		
		api.POST("/submit-order", handleSubmitOrder) // Corresponds to { action: 'submitOrder', ... }
        api.POST("/upload-image", handleImageUploadProxy) // Proxy for image uploads

        // *** Admin Endpoints ***
        admin := api.Group("/admin")
        // TODO: Add authentication middleware for admin routes
        {
             admin.POST("/update-formula-report", handleUpdateFormulaReport)
             admin.GET("/revenue-summary", handleGetRevenueSummary) // *** NEW ***
            // TODO: Add other admin endpoints here
            // admin.GET("/all-orders", handleGetAllOrders)
            // admin.POST("/update-order", handleAdminUpdateOrder)
            // admin.POST("/delete-order", handleAdminDeleteOrder)
            // admin.GET("/reports", handleGetReportData) // Endpoint for the specific report view in Index.html?
            // admin.POST("/update-sheet", handleAdminUpdateSheet)
            // admin.POST("/delete-row", handleAdminDeleteRow)
        }

		// TODO: Add POST handlers for:
		// - /login (Implement authentication)
		// - /update-profile
		// - writeLog (maybe combine logging within Go handlers)
	}

	// --- Serve Frontend (Optional, if hosted together) ---
	// router.StaticFS("/", http.Dir("./frontend")) // Assuming frontend files are in ./frontend
    // router.NoRoute(func(c *gin.Context) {
	// 	c.File("./frontend/index.html")
	// })


	// --- Start Server ---
	log.Printf("Starting Go backend server on port %s", port)
	err = router.Run(":" + port)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

