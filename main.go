package main

import (
	"bytes"
	"context"

	// "encoding/base64" // REMOVED (Fix 1: Not used in Hybrid model)
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url" // Needed for label button
	"os"
	"sort"
	"strconv" // Needed for formatting
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	// --- NEW: Telegram Bot API ---
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"

	// --- NEW: WebSocket Library ---
	"github.com/gorilla/websocket"

	// --- Google API Imports ---
	// "google.golang.org/api/drive/v3" // REMOVED (Using Apps Script for upload)
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// --- Configuration ---
var (
	// --- Google API Services ---
	sheetsService *sheets.Service
	// driveService  *drive.Service // REMOVED
	// ---
	spreadsheetID   string
	uploadFolderID  string
	labelPrinterURL string
	// ---
	// *** NEW: Apps Script API Config (for Uploads) ***
	appsScriptURL    string
	appsScriptSecret string
	// ---
	renderBaseURL string // URL of this Render service itself

	// --- Telegram Bot Management ---
	telegramBots   = make(map[string]*tgbotapi.BotAPI)  // Map[TeamName] -> BotInstance
	telegramConfig = make(map[string]map[string]string) // Map[TeamName] -> Map["groupID", "topicID", "archiveID"]

	// --- NEW: WebSocket Hub ---
	hub *Hub

	// --- NEW: Cache for Sheet IDs ---
	sheetIdCache      = make(map[string]int64)
	sheetIdCacheMutex sync.RWMutex
)

// --- Constants from Apps Script Config (Keep consistent) ---
// ... (sheetRanges map remains the same) ...
var sheetRanges = map[string]string{
	"Users":             "Users!A:G",    // Assuming G is IsSystemAdmin
	"Settings":          "Settings!A:B", // Assuming A=Team, B=UploadFolderID
	"TeamsPages":        "TeamsPages!A:C",
	"Products":          "Products!A:E", // A:D -> A:E (Added Cost)
	"Locations":         "Locations!A:C",
	"ShippingMethods":   "ShippingMethods!A:D",
	"Colors":            "Colors!A:A",
	"Drivers":           "Drivers!A:B",
	"BankAccounts":      "BankAccounts!A:B",
	"PhoneCarriers":     "PhoneCarriers!A:C",
	"TelegramTemplates": "TelegramTemplates!A:C",
	"AllOrders":         "AllOrders!A:Y", // A:U -> A:Y (Added 4 new cols)
	"RevenueDashboard":  "RevenueDashboard!A:D",
	// *** UPDATED: Added FileID column ***
	"ChatMessages": "ChatMessages!A:E", // A=Timestamp, B=UserName, C=Type, D=Content, E=FileID
	// Write-only sheets don't need a read range
	"FormulaReportSheet": "FormulaReport!A:Z",    // Use full range for clear/overwrite
	"UserActivityLogs":   "UserActivityLogs!A:Z", // Append only
	"EditLogs":           "EditLogs!A:Z",         // Append only
}

const (
	AllOrdersSheet         = "AllOrders"
	FormulaReportSheet     = "FormulaReport"
	RevenueSheet           = "RevenueDashboard"
	UserActivitySheet      = "UserActivityLogs"
	EditLogsSheet          = "EditLogs"
	TelegramTemplatesSheet = "TelegramTemplates"
	ChatMessagesSheet      = "ChatMessages"
	UsersSheet             = "Users" // *** NEW Constant ***
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

	// *** NEW: Clear sheet ID cache as well ***
	sheetIdCacheMutex.Lock()
	sheetIdCache = make(map[string]int64)
	sheetIdCacheMutex.Unlock()
	log.Println("Sheet ID Cache CLEARED")
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
	Team              string `json:"Team"`     // Comma-separated
	FullName          string `json:"FullName"`
	ProfilePictureURL string `json:"ProfilePictureURL"`
	Role              string `json:"Role"`
	IsSystemAdmin     bool   `json:"IsSystemAdmin"`
}

// *** UPDATED: Product struct ***
type Product struct {
	ProductName string  `json:"ProductName"`
	Barcode     string  `json:"Barcode"` // This will be read as string
	Price       float64 `json:"Price"`
	Cost        float64 `json:"Cost"` // *** NEW ***
	ImageURL    string  `json:"ImageURL"`
}

type Location struct {
	Province string `json:"Province"`
	District string `json:"District"`
	Sangkat  string `json:"Sangkat"`
}

type ShippingMethod struct {
	MethodName             string `json:"MethodName"`
	LogoURL                string `json:"LogosURL"`
	AllowManualDriver      bool   `json:"AllowManualDriver"`
	RequireDriverSelection bool   `json:"RequireDriverSelection"`
}

type TeamPage struct {
	Team          string `json:"Team"`
	PageName      string `json:"PageName"`
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
	CarrierName    string `json:"CarrierName"`
	Prefixes       string `json:"Prefixes"` // Use exact header name
	CarrierLogoURL string `json:"CarrierLogoURL"`
}
type TelegramTemplate struct {
	Team     string `json:"Team"`
	Part     int    `json:"Part"` // Assuming Part is a number
	Template string `json:"Template"`
}

// *** UPDATED: Model for Order data read from AllOrders (for FormulaReport) ***
type Order struct {
	Timestamp               string  `json:"Timestamp"` // Read as ISO string
	OrderID                 string  `json:"Order ID"`
	User                    string  `json:"User"`
	Page                    string  `json:"Page"`
	TelegramValue           string  `json:"TelegramValue"`
	CustomerName            string  `json:"Customer Name"`
	CustomerPhone           string  `json:"Customer Phone"` // This will be read as string
	Location                string  `json:"Location"`
	AddressDetails          string  `json:"Address Details"`
	Note                    string  `json:"Note"`
	ShippingFeeCustomer     float64 `json:"Shipping Fee (Customer)"`
	Subtotal                float64 `json:"Subtotal"`
	GrandTotal              float64 `json:"Grand Total"`
	ProductsJSON            string  `json:"Products (JSON)"`
	InternalShippingMethod  string  `json:"Internal Shipping Method"`
	InternalShippingDetails string  `json:"Internal Shipping Details"`
	InternalCost            float64 `json:"Internal Cost"`
	PaymentStatus           string  `json:"Payment Status"`
	PaymentInfo             string  `json:"Payment Info"`
	TelegramMessageID       string  `json:"Telegram Message ID"`
	Team                    string  `json:"Team"`
	// --- NEW COLUMNS ---
	DiscountUSD      float64 `json:"Discount ($)"`
	DeliveryUnpaid   float64 `json:"Delivery Unpaid"`
	DeliveryPaid     float64 `json:"Delivery Paid"`
	TotalProductCost float64 `json:"Total Product Cost ($)"` // *** NEW ***
}

// *** Model for Revenue data read from RevenueDashboard ***
type RevenueEntry struct {
	Timestamp string  `json:"Timestamp"` // Read as ISO string
	Team      string  `json:"Team"`
	Page      string  `json:"Page"`
	Revenue   float64 `json:"Revenue"`
}

// --- *** UPDATED: Chat Message Model (with FileID) *** ---
type ChatMessage struct {
	Timestamp   string `json:"Timestamp"`
	UserName    string `json:"UserName"`
	MessageType string `json:"MessageType"` // "text", "audio", "image"
	Content     string `json:"Content"`     // The text or the Google Drive URL
	FileID      string `json:"FileID,omitempty"`
}

// *** UPDATED: Struct for report aggregation ***
type ReportSummary struct {
	TotalSales       float64
	TotalExpense     float64 // Shipping Expense
	TotalProductCost float64 // *** NEW ***
}

type RevenueAggregate struct {
	YearlyByTeam  map[int]map[string]float64    `json:"yearlyByTeam"`  // year -> team -> totalRevenue
	YearlyByPage  map[int]map[string]float64    `json:"yearlyByPage"`  // year -> page -> totalRevenue
	MonthlyByTeam map[string]map[string]float64 `json:"monthlyByTeam"` // "YYYY-MM" -> team -> totalRevenue
	MonthlyByPage map[string]map[string]float64 `json:"monthlyByPage"` // "YYYY-MM" -> page -> totalRevenue
	DailyByTeam   map[string]map[string]float64 `json:"dailyByTeam"`   // "YYYY-MM-DD" -> team -> totalRevenue
	DailyByPage   map[string]map[string]float64 `json:"dailyByPage"`   // "YYYY-MM-DD" -> page -> totalRevenue
}

// --- *** NEW: WebSocket Broadcast Struct *** ---
type WebSocketMessage struct {
	Action  string      `json:"action"` // "new_message", "delete_message"
	Payload interface{} `json:"payload"`
}

// --- *** NEW: WebSocket Hub & Client Structs *** ---
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity
	},
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte // Buffered channel of outbound messages
}

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
		clients:    make(map[*Client]bool), // *** FIX 1: Changed from map[string]bool ***
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Println("WebSocket client connected")
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Println("WebSocket client disconnected")
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

// writePump pumps messages from the hub to the websocket connection.
func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()
	for {
		message, ok := <-c.send
		if !ok {
			// The hub closed the channel.
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}
		c.conn.WriteMessage(websocket.TextMessage, message)
	}
}

// serveWs handles websocket requests from the peer.
func serveWs(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade websocket: %v", err)
		return
	}
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	// Start the write pump in a new goroutine
	go client.writePump()
	// Read pump (but we don't expect messages *from* client on this socket, only broadcast)
	// We just need to keep the connection alive
	go func() {
		defer func() {
			client.hub.unregister <- client
			client.conn.Close()
		}()
		for {
			// Read messages just to keep connection alive and detect close
			if _, _, err := client.conn.ReadMessage(); err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				break
			}
		}
	}()
}

// --- *** END: WebSocket Logic *** ---

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
					if cellStr, ok := cell.(string); ok {

						// *** NEW FIX: Clean currency/text from number fields ***
						cleanedStr := cellStr
						// Check all possible number fields
						if header == "Cost" || header == "Price" || header == "Grand Total" || header == "Subtotal" || header == "Shipping Fee (Customer)" || header == "Internal Cost" || header == "Discount ($)" || header == "Delivery Unpaid" || header == "Delivery Paid" || header == "Total Product Cost ($)" {
							cleanedStr = strings.ReplaceAll(cleanedStr, "$", "")
							cleanedStr = strings.ReplaceAll(cleanedStr, ",", "")
							cleanedStr = strings.TrimSpace(cleanedStr)
						}
						// --- END FIX ---

						if f, err := strconv.ParseFloat(cleanedStr, 64); err == nil {
							rowData[header] = f // Store as float
						} else if b, err := strconv.ParseBool(cellStr); err == nil { // Use original cellStr for bool
							rowData[header] = b // Store as bool
						} else {
							rowData[header] = cellStr // Keep original string
						}
					} else {
						// It's likely already a float64 or bool from JSON/API
						rowData[header] = cell
					}

					// *** Specific Fixes for string fields that look like numbers ***
					// *** UPDATED: Added Customer Name, Note, and Content (for Chat) ***
					if header == "Password" || header == "Customer Phone" || header == "Barcode" || header == "Customer Name" || header == "Note" || header == "Content" {
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

	// *** NEW: Invalidate cache on append ***
	invalidateSheetCache(sheetName)

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

	// *** NEW: Invalidate cache on overwrite ***
	invalidateSheetCache(sheetName)

	return nil
}

// --- *** NEW: Helper to get Sheet's numeric ID (for Batch Updates) *** ---
func getSheetIdByName(sheetName string) (int64, error) {
	// Check cache first
	sheetIdCacheMutex.RLock()
	sheetId, found := sheetIdCache[sheetName]
	sheetIdCacheMutex.RUnlock()
	if found {
		return sheetId, nil
	}

	// Fetch from API
	resp, err := sheetsService.Spreadsheets.Get(spreadsheetID).Fields("sheets(properties(title,sheetId))").Do()
	if err != nil {
		log.Printf("Error fetching spreadsheet properties: %v", err)
		return 0, fmt.Errorf("failed to get spreadsheet info")
	}

	for _, sheet := range resp.Sheets {
		if sheet.Properties.Title == sheetName {
			// Cache and return
			sheetIdCacheMutex.Lock()
			sheetIdCache[sheetName] = sheet.Properties.SheetId
			sheetIdCacheMutex.Unlock()
			return sheet.Properties.SheetId, nil
		}
	}

	return 0, fmt.Errorf("sheet '%s' not found in spreadsheet", sheetName)
}

// --- *** NEW: Helper to get all headers for a sheet *** ---
func findHeaderMap(sheetName string) (map[string]int, error) {
	headersResp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, fmt.Sprintf("%s!1:1", sheetName)).Do()
	if err != nil || len(headersResp.Values) == 0 {
		log.Printf("Error fetching headers for %s: %v", sheetName, err)
		return nil, fmt.Errorf("failed to read headers for sheet %s", sheetName)
	}

	headers := headersResp.Values[0]
	headerMap := make(map[string]int)
	for i, header := range headers {
		headerMap[fmt.Sprintf("%v", header)] = i // 0-based column index
	}
	return headerMap, nil
}

// --- *** NEW: Helper to find a row index by Primary Key *** ---
// Returns (0-based row index, numeric sheet ID, error)
func findRowIndexByPK(sheetName string, pkHeader string, pkValue string) (int64, int64, error) {
	// 1. Get Sheet ID
	sheetId, err := getSheetIdByName(sheetName)
	if err != nil {
		return -1, 0, err
	}

	// 2. Get Header Map to find PK column index
	headerMap, err := findHeaderMap(sheetName)
	if err != nil {
		return -1, sheetId, err
	}

	pkColIndex, ok := headerMap[pkHeader]
	if !ok {
		return -1, sheetId, fmt.Errorf("primary key column '%s' not found in sheet '%s'", pkHeader, sheetName)
	}
	pkColLetter := string(rune('A' + pkColIndex))

	// 3. Fetch the PK column to find the row
	readRange := fmt.Sprintf("%s!%s2:%s", sheetName, pkColLetter, pkColLetter) // e.g., "Users!A2:A"
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		log.Printf("Error fetching PK column from %s: %v", sheetName, err)
		return -1, sheetId, fmt.Errorf("failed to read sheet %s", sheetName)
	}

	// 4. Find the row number (0-based)
	for i, row := range resp.Values {
		if len(row) > 0 && fmt.Sprintf("%v", row[0]) == pkValue {
			rowIndex := i + 1 // 0-based index (data starts at row 2, which is index 1)
			return int64(rowIndex), sheetId, nil
		}
	}

	return -1, sheetId, fmt.Errorf("row not found with %s = %s in sheet %s", pkHeader, pkValue, sheetName)
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

// --- *** NEW: Find Row and Update Cell (for Message ID) *** ---
func updateTelegramMessageIDInSheet(team, orderId string, messageId int64) {
	sheetName := "Orders_" + team
	log.Printf("Attempting to save MessageID %d for OrderID %s in sheet %s", messageId, orderId, sheetName)

	// 1. Find Header Map
	headerMap, err := findHeaderMap(sheetName)
	if err != nil {
		log.Printf("Error finding headers for %s: %v", sheetName, err)
		return
	}

	// *** FIX 2: Changed orderIdColIndex to _ ***
	_, okO := headerMap["Order ID"]
	messageIdColIndex, okM := headerMap["Telegram Message ID"]

	if !okO || !okM {
		log.Printf("Error: 'Order ID' or 'Telegram Message ID' column not found in sheet %s", sheetName)
		return
	}
	messageIdColLetter := string(rune('A' + messageIdColIndex))

	// 2. Find the row index (0-based)
	rowIndex, _, err := findRowIndexByPK(sheetName, "Order ID", orderId)
	if err != nil {
		log.Printf("Error finding row for OrderID %s in sheet %s: %v", orderId, sheetName, err)
		return
	}

	// 3. Update the Message ID cell
	targetRow := rowIndex + 1 // Convert 0-based index to 1-based row number
	updateA1Range := fmt.Sprintf("%s!%s%d", sheetName, messageIdColLetter, targetRow) // e.g., "Orders_A!T10"
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{{messageId}}, // Pass messageId as int64
	}
	_, updateErr := sheetsService.Spreadsheets.Values.Update(spreadsheetID, updateA1Range, valueRange).ValueInputOption("RAW").Do()

	if updateErr != nil {
		log.Printf("Error updating MessageID for OrderID %s in sheet %s: %v", orderId, sheetName, updateErr)
	} else {
		log.Printf("Successfully saved MessageID %d for OrderID %s in sheet %s (Row %d)", messageId, orderId, sheetName, targetRow)
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

// --- *** UPDATED: Apps Script Communication (For Uploads Only) *** ---
type AppsScriptRequest struct {
	Action         string `json:"action"`
	Secret         string `json:"secret"`
	UploadFolderID string `json:"uploadFolderID,omitempty"`
	FileData       string `json:"fileData,omitempty"`
	FileName       string `json:"fileName,omitempty"`
	MimeType       string `json:"mimeType,omitempty"`
	UserName       string `json:"userName,omitempty"`   // *** NEW (Point 6) ***
	FileID         string `json:"fileID,omitempty"`     // *** NEW (Point 5) ***
	FileURL        string `json:"fileURL,omitempty"`    // *** NEW (Point 5, Fallback) ***
}

type AppsScriptResponse struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	URL     string `json:"url,omitempty"`     // For image upload response
	FileID  string `json:"fileID,omitempty"`  // *** NEW (Point 5) ***
}

func callAppsScriptPOST(requestData AppsScriptRequest) (AppsScriptResponse, error) {
	requestData.Secret = appsScriptSecret // Ensure secret is included
	jsonData, err := json.Marshal(requestData)
	if err != nil {
		log.Printf("Error marshalling Apps Script POST request (%s): %v", requestData.Action, err)
		return AppsScriptResponse{}, fmt.Errorf("internal error preparing data")
	}

	resp, err := http.Post(appsScriptURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error calling Apps Script POST (%s): %v", requestData.Action, err)
		return AppsScriptResponse{}, fmt.Errorf("failed to connect to Google Apps Script API")
	}
	defer resp.Body.Close()

	// *** UPDATED: Add 'io' import ***
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading Apps Script POST response (%s): %v", requestData.Action, err)
		return AppsScriptResponse{}, fmt.Errorf("failed to read Google Apps Script API response")
	}

	var scriptResponse AppsScriptResponse
	err = json.Unmarshal(body, &scriptResponse)
	if err != nil {
		log.Printf("Error unmarshalling Apps Script POST response (%s): %v. Body: %s", requestData.Action, err, string(body))
		log.Printf("Raw response body: %s", string(body))
		return AppsScriptResponse{}, fmt.Errorf("invalid response format from Google Apps Script API")
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("Apps Script POST request (%s) returned status %d. Body: %s", requestData.Action, resp.StatusCode, string(body))
		if scriptResponse.Status == "locked" {
			return AppsScriptResponse{}, fmt.Errorf("Google Apps Script API is busy, please try again")
		}
		if scriptResponse.Status == "error" && scriptResponse.Message != "" {
			return AppsScriptResponse{}, fmt.Errorf("Google Apps Script API error: %s", scriptResponse.Message)
		}
		return AppsScriptResponse{}, fmt.Errorf("Google Apps Script API returned status %d", resp.StatusCode)
	}

	// Even with 200 OK, check the internal status field
	if scriptResponse.Status != "success" {
		log.Printf("Apps Script POST Error (%s): %s", requestData.Action, scriptResponse.Message)
		return AppsScriptResponse{}, fmt.Errorf("Google Apps Script API error: %s", scriptResponse.Message)
	}

	return scriptResponse, nil
}

// --- *** END: Apps Script Communication *** ---

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
	if err != nil {
		goto handleError
	} // Now safe to jump
	result["pages"] = pages

	err = getCachedSheetData("Products", &products, cacheTTL)
	if err != nil {
		goto handleError
	} // Now safe to jump
	result["products"] = products

	err = getCachedSheetData("Locations", &locations, cacheTTL)
	if err != nil {
		goto handleError
	} // Now safe to jump
	result["locations"] = locations

	err = getCachedSheetData("ShippingMethods", &shippingMethods, cacheTTL)
	if err != nil {
		goto handleError
	} // Now safe to jump
	result["shippingMethods"] = shippingMethods

	// --- Get UploadFolderID from Settings ---
	err = getCachedSheetData("Settings", &settingsMaps, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["settings"] = settingsMaps // Frontend might not even need this now
	// Also set the global variable

	// *** UPDATED: Use the 'uploadFolderID' variable that is already declared globally ***
	if len(settingsMaps) > 0 && len(settingsMaps[0]) > 0 { // Check if map and column exist
		if id, ok := settingsMaps[0]["UploadFolderID"].(string); ok {
			uploadFolderID = id // Get from sheet
		}
	}
	if uploadFolderID == "" {
		uploadFolderID = os.Getenv("UPLOAD_FOLDER_ID") // Use env var as fallback
	}
	if uploadFolderID == "" {
		log.Printf("CRITICAL WARNING: UPLOAD_FOLDER_ID is not set in Settings sheet or Environment Variables. File uploads will fail.")
	}
	// ---

	err = getCachedSheetData("Colors", &colors, cacheTTL)
	if err != nil {
		goto handleError
	} // Now safe to jump
	result["colors"] = colors

	err = getCachedSheetData("Drivers", &drivers, cacheTTL)
	if err != nil {
		goto handleError
	} // Now safe to jump
	result["drivers"] = drivers

	err = getCachedSheetData("BankAccounts", &bankAccounts, cacheTTL)
	if err != nil {
		goto handleError
	} // Now safe to jump
	result["bankAccounts"] = bankAccounts

	err = getCachedSheetData("PhoneCarriers", &phoneCarriers, cacheTTL)
	if err != nil {
		goto handleError
	} // Now safe to jump
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
			// CORRECT way to send to a Topic in v5
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

// ... (handleSubmitOrder remains the same, but sendTelegramNotification is now implemented) ...
func handleSubmitOrder(c *gin.Context) {
	var orderRequest struct {
		CurrentUser   User                     `json:"currentUser"`
		SelectedTeam  string                   `json:"selectedTeam"`
		Page          string                   `json:"page"`
		TelegramValue string                   `json:"telegramValue"`
		Customer      map[string]interface{}   `json:"customer"`
		Products      []map[string]interface{} `json:"products"`
		Shipping      map[string]interface{}   `json:"shipping"`
		Payment       map[string]interface{}   `json:"payment"`
		Telegram      map[string]interface{}   `json:"telegram"`
		Subtotal      float64                  `json:"subtotal"`
		GrandTotal    float64                  `json:"grandTotal"`
		Note          string                   `json:"note"`
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
	timestamp := time.Now().UTC().Format(time.RFC3339)              // Use ISO format
	orderId := fmt.Sprintf("GO-%s-%d", team, time.Now().UnixNano()) // Generate ID in Go

	productsJSON, err := json.Marshal(orderRequest.Products)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to serialize products"})
		return
	}

	// Construct location string safely
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
	fullLocation := strings.Join(locationParts, ", ")

	// Ensure numeric types from frontend are correct
	shippingFee, _ := orderRequest.Customer["shippingFee"].(float64)
	shippingCost, _ := orderRequest.Shipping["cost"].(float64)

	// *** NEW: Calculate Total Discount & Total Product Cost ***
	var totalDiscount float64 = 0
	var totalProductCost float64 = 0
	for _, p := range orderRequest.Products {
		// Data from frontend is map[string]interface{}, must assert type
		originalPrice, opOK := p["originalPrice"].(float64)
		finalPrice, fpOK := p["finalPrice"].(float64)
		quantity, qOK := p["quantity"].(float64)
		cost, cOK := p["cost"].(float64) // *** NEW: Get 'cost' from frontend JSON ***

		if opOK && fpOK && qOK && originalPrice > 0 && quantity > 0 {
			totalDiscount += (originalPrice - finalPrice) * quantity
		}
		if cOK && qOK {
			totalProductCost += (cost * quantity)
		}
	}
	// *** END: Calculate Total Discount & Total Product Cost ***

	// *** UPDATED: rowData slice now includes 3 new columns ***
	rowData := []interface{}{
		timestamp, orderId, orderRequest.CurrentUser.UserName, orderRequest.Page, orderRequest.TelegramValue,
		orderRequest.Customer["name"], orderRequest.Customer["phone"], fullLocation,
		orderRequest.Customer["additionalLocation"], orderRequest.Note, shippingFee,
		orderRequest.Subtotal, orderRequest.GrandTotal, string(productsJSON),
		orderRequest.Shipping["method"], orderRequest.Shipping["details"], shippingCost,
		orderRequest.Payment["status"], orderRequest.Payment["info"],
		// --- NEW COLUMNS ---
		totalDiscount,    // "Discount ($)"
		shippingCost,     // "Delivery Unpaid" (assuming internal cost is the unpaid amount)
		0,                // "Delivery Paid" (defaults to 0 on creation)
		totalProductCost, // *** NEW *** "Total Product Cost ($)"
		// --- END NEW ---
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
		"orderId":       orderId, // Add generated Order ID
		"currentUser":   orderRequest.CurrentUser,
		"selectedTeam":  orderRequest.SelectedTeam,
		"page":          orderRequest.Page,
		"telegramValue": orderRequest.TelegramValue,
		"customer":      orderRequest.Customer,
		"products":      orderRequest.Products,
		"shipping":      orderRequest.Shipping,
		"payment":       orderRequest.Payment,
		"telegram":      orderRequest.Telegram, // Keep scheduling info if needed
		"subtotal":      orderRequest.Subtotal,
		"grandTotal":    orderRequest.GrandTotal,
		"note":          orderRequest.Note,
	}

	// TODO: Check scheduling logic (orderRequest.Telegram)
	isScheduled, _ := orderRequest.Telegram["schedule"].(bool)
	if isScheduled {
		scheduleTimeStr, _ := orderRequest.Telegram["time"].(string)

		// 1. Parse ពេលវេលា (សន្មតថា format គឺ RFC3339/ISO 8601, ឧ: "2025-11-04T15:30:00+07:00")
		scheduleTime, err := time.Parse(time.RFC3339, scheduleTimeStr)
		if err != nil {
			// បើ format ពេលវេលាមិនត្រឹមត្រូវ, ផ្ញើភ្លាមៗ
			log.Printf("Error: Invalid schedule time format for Order %s: %v. Sending now.", orderId, err)
			go sendTelegramNotification(team, fullOrderData)
			go generateAndSendPDF(team, orderId, fullOrderData)
		} else {

			// 2. គណនាពេលរង់ចាំ
			durationToWait := time.Until(scheduleTime)

			if durationToWait <= 0 {
				// បើពេលវេលាដែលកំណត់ ជារឿងអតីតកាល (เลยเวลาแล้ว), ផ្ញើភ្លាមៗ
				log.Printf("Scheduled time %s is in the past for Order %s. Sending now.", scheduleTimeStr, orderId)
				go sendTelegramNotification(team, fullOrderData)
				go generateAndSendPDF(team, orderId, fullOrderData)
			} else {
				// 3. ពេលវេលាត្រឹមត្រូវ! ចាប់ផ្តើម Goroutine ឲ្យរង់ចាំ
				log.Printf("Order %s scheduled for %s. Will send in %v.", orderId, scheduleTimeStr, durationToWait)

				// យើងត្រូវ Copy data ទុក ព្រោះ fullOrderData ដើមអាចនឹងបាត់បង់ពេល function នេះจบ
				scheduledData := fullOrderData
				scheduledTeam := team
				scheduledOrderId := orderId

				// time.AfterFunc នឹងរត់ function ខាងក្រោម បន្ទាប់ពី durationToWait បានកន្លងផុតទៅ
				// វានឹងរត់នៅក្នុង Goroutine ថ្មីដោយស្វ័យប្រវត្តិ
				time.AfterFunc(durationToWait, func() {
					// ដល់ពេលកំណត់แล้ว! ចាប់ផ្តើមផ្ញើ
					log.Printf("EXECUTING SCHEDULED JOB for Order %s", scheduledOrderId)
					sendTelegramNotification(scheduledTeam, scheduledData)
					generateAndSendPDF(scheduledTeam, scheduledOrderId, scheduledData)
				})
			}
		}

	} else {
		// Send notifications immediately (ដូចដើម)
		go sendTelegramNotification(team, fullOrderData)
		go generateAndSendPDF(team, orderId, fullOrderData)
	}

	// ... (Code ខាងក្រោម handleSubmitOrder នឹងបន្តដំណើរការ ហើយ Respond "success" ទៅ User ភ្លាម) ...
	// Invalidate relevant caches (appendRowToSheet already does this)
	// invalidateSheetCache(AllOrdersSheet)
	// invalidateSheetCache(RevenueSheet)
	// invalidateSheetCache(orderSheetName) // Invalidate specific team sheet

	c.JSON(http.StatusOK, gin.H{"status": "success", "orderId": orderId})
}

// --- *** UPDATED: handleImageUploadProxy (Hybrid Model) *** ---
func handleImageUploadProxy(c *gin.Context) {
	var uploadRequest struct {
		FileData string `json:"fileData"`
		FileName string `json:"fileName"`
		MimeType string `json:"mimeType"`
		// Pass through sheet/pk/column info
		SheetName  string            `json:"sheetName"`
		PrimaryKey map[string]string `json:"primaryKey"`
		ColumnName string            `json:"columnName"`
		UserName   string            `json:"userName"` // *** NEW: Get username for traceability ***
	}

	if err := c.ShouldBindJSON(&uploadRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid image upload data format: " + err.Error()})
		return
	}

	// *** UPDATED: Use global uploadFolderID ***
	if uploadFolderID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Upload Folder ID is not configured on the server."})
		return
	}

	// 1. Call Apps Script Upload API
	resp, err := callAppsScriptPOST(AppsScriptRequest{
		Action:         "uploadImage", // Action for Apps Script
		FileData:       uploadRequest.FileData,
		FileName:       uploadRequest.FileName,
		MimeType:       uploadRequest.MimeType,
		UploadFolderID: uploadFolderID, // Pass the folder ID
		UserName:       uploadRequest.UserName, // Pass username
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to upload image via Google Apps Script: " + err.Error()})
		return
	}

	fileUrl := resp.URL // Get the URL returned from Apps Script

	// 2. Update the specific sheet cell (in background)
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

			// --- *** NEW: Use Batch Update logic for cell update *** ---
			// 1. Find Header Map
			headerMap, err := findHeaderMap(uploadRequest.SheetName)
			if err != nil {
				log.Printf("Error finding headers for %s: %v", uploadRequest.SheetName, err)
				return
			}

			// 2. Find Row and Sheet ID
			rowIndex, sheetId, err := findRowIndexByPK(uploadRequest.SheetName, pkHeader, pkValue)
			if err != nil {
				log.Printf("Error finding row for PK %s=%s in sheet %s for image update: %v", pkHeader, pkValue, uploadRequest.SheetName, err)
				return
			}

			// 3. Find Column Index
			colIndex, ok := headerMap[uploadRequest.ColumnName]
			if !ok {
				log.Printf("Error: Column '%s' not found in sheet '%s'", uploadRequest.ColumnName, uploadRequest.SheetName)
				return
			}

			// 4. Build Batch Update Request
			batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{
				Requests: []*sheets.Request{
					{
						UpdateCells: &sheets.UpdateCellsRequest{
							Start: &sheets.GridCoordinate{
								SheetId:     sheetId,
								RowIndex:    rowIndex, // 0-based
								ColumnIndex: int64(colIndex), // 0-based
							},
							Rows: []*sheets.RowData{
								{
									Values: []*sheets.CellData{
										{
											UserEnteredValue: &sheets.ExtendedValue{
												StringValue: &fileUrl,
											},
										},
									},
								},
							},
							Fields: "userEnteredValue",
						},
					},
				},
			}

			// 5. Call API
			_, updateErr := sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
			// --- *** END: New Batch Update logic *** ---

			if updateErr != nil {
				log.Printf("Error updating sheet %s with image URL using BatchUpdate: %v", uploadRequest.SheetName, updateErr)
			} else {
				log.Printf("Successfully updated sheet %s with image URL", uploadRequest.SheetName)
				invalidateSheetCache(uploadRequest.SheetName) // Invalidate cache
			}
		}() // End background update
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "url": fileUrl, "fileID": resp.FileID})
}

// --- *** UPDATED: handleUpdateFormulaReport *** ---
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

	// *** UPDATED: New Headers ***
	reportData := [][]interface{}{
		{"Category", "Period", "Total Sales", "Total Expense (Shipping)", "Total Product Cost", "Net Profit"}, // Header row
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
		yearlyData[year].TotalProductCost += order.TotalProductCost // *** NEW ***

		// Aggregate Monthly (Current Year)
		if year == currentYear {
			if _, ok := monthlyData[yearMonthKey]; !ok {
				monthlyData[yearMonthKey] = &ReportSummary{}
			}
			monthlyData[yearMonthKey].TotalSales += order.GrandTotal
			monthlyData[yearMonthKey].TotalExpense += order.InternalCost
			monthlyData[yearMonthKey].TotalProductCost += order.TotalProductCost // *** NEW ***
		}

		// Aggregate Daily (Current Month of Current Year)
		if year == currentYear && month == currentMonth {
			if _, ok := dailyData[yearMonthDayKey]; !ok {
				dailyData[yearMonthDayKey] = &ReportSummary{}
			}
			dailyData[yearMonthDayKey].TotalSales += order.GrandTotal
			dailyData[yearMonthDayKey].TotalExpense += order.InternalCost
			dailyData[yearMonthDayKey].TotalProductCost += order.TotalProductCost // *** NEW ***
		}
	}

	// 3. Format Output for Sheet
	// (Headers already added)

	// Add Yearly Data
	reportData = append(reportData, []interface{}{"YEARLY REPORT", "", "", "", "", ""})
	years := make([]int, 0, len(yearlyData))
	for y := range yearlyData {
		years = append(years, y)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(years))) // Sort years descending
	for _, year := range years {
		summary := yearlyData[year]
		netProfit := summary.TotalSales - summary.TotalExpense - summary.TotalProductCost
		reportData = append(reportData, []interface{}{
			"", year,
			fmt.Sprintf("%.2f", summary.TotalSales),
			fmt.Sprintf("%.2f", summary.TotalExpense),
			fmt.Sprintf("%.2f", summary.TotalProductCost), // *** NEW ***
			fmt.Sprintf("%.2f", netProfit),                // *** NEW ***
		})
	}
	reportData = append(reportData, []interface{}{}) // Blank row

	// Add Monthly Data (Current Year)
	reportData = append(reportData, []interface{}{fmt.Sprintf("MONTHLY REPORT (%d)", currentYear), "", "", "", "", ""})
	for m := 1; m <= 12; m++ {
		monthKey := fmt.Sprintf("%d-%02d", currentYear, m)
		summary, ok := monthlyData[monthKey]
		monthName := time.Month(m).String() // Get English month name
		if ok {
			netProfit := summary.TotalSales - summary.TotalExpense - summary.TotalProductCost
			reportData = append(reportData, []interface{}{
				"", monthName,
				fmt.Sprintf("%.2f", summary.TotalSales),
				fmt.Sprintf("%.2f", summary.TotalExpense),
				fmt.Sprintf("%.2f", summary.TotalProductCost), // *** NEW ***
				fmt.Sprintf("%.2f", netProfit),                // *** NEW ***
			})
		} else {
			// Show months with zero values
			reportData = append(reportData, []interface{}{"", monthName, "0.00", "0.00", "0.00", "0.00"})
		}
	}

	reportData = append(reportData, []interface{}{}) // Blank row

	// Add Daily Data (Current Month)
	reportData = append(reportData, []interface{}{fmt.Sprintf("DAILY REPORT (%s %d)", currentMonth.String(), currentYear), "", "", "", "", ""})
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
		netProfit := summary.TotalSales - summary.TotalExpense - summary.TotalProductCost
		reportData = append(reportData, []interface{}{
			"", dayLabel,
			fmt.Sprintf("%.2f", summary.TotalSales),
			fmt.Sprintf("%.2f", summary.TotalExpense),
			fmt.Sprintf("%.2f", summary.TotalProductCost), // *** NEW ***
			fmt.Sprintf("%.2f", netProfit),                // *** NEW ***
		})
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
			YearlyByTeam:  make(map[int]map[string]float64),
			YearlyByPage:  make(map[int]map[string]float64),
			MonthlyByTeam: make(map[string]map[string]float64),
			MonthlyByPage: make(map[string]map[string]float64),
			DailyByTeam:   make(map[string]map[string]float64),
			DailyByPage:   make(map[string]map[string]float64),
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
		if team == "" {
			team = "Unknown"
		}
		page := entry.Page
		if page == "" {
			page = "Unknown"
		}
		revenue := entry.Revenue

		// --- Aggregate Yearly ---
		if _, ok := yearlyByTeam[year]; !ok {
			yearlyByTeam[year] = make(map[string]float64)
		}
		yearlyByTeam[year][team] += revenue

		if _, ok := yearlyByPage[year]; !ok {
			yearlyByPage[year] = make(map[string]float64)
		}
		yearlyByPage[year][page] += revenue

		// --- Aggregate Monthly (Current Year Only) ---
		if year == currentYear {
			if _, ok := monthlyByTeam[yearMonthKey]; !ok {
				monthlyByTeam[yearMonthKey] = make(map[string]float64)
			}
			monthlyByTeam[yearMonthKey][team] += revenue

			// *** FIX: Type mismatch error from log ***
			if _, ok := monthlyByPage[yearMonthKey]; !ok {
				monthlyByPage[yearMonthKey] = make(map[string]float64)
			}
			monthlyByPage[yearMonthKey][page] += revenue
		}

		// --- Aggregate Daily (Current Month of Current Year Only) ---
		if year == currentYear && month == currentMonth {
			if _, ok := dailyByTeam[yearMonthDayKey]; !ok {
				dailyByTeam[yearMonthDayKey] = make(map[string]float64)
			}
			dailyByTeam[yearMonthDayKey][team] += revenue

			// *** FIX: Type mismatch error from log ***
			if _, ok := dailyByPage[yearMonthDayKey]; !ok {
				dailyByPage[yearMonthDayKey] = make(map[string]float64)
			}
			dailyByPage[yearMonthDayKey][page] += revenue
		}
	}

	// 3. Prepare response
	response := RevenueAggregate{
		YearlyByTeam:  yearlyByTeam,
		YearlyByPage:  yearlyByPage,
		MonthlyByTeam: monthlyByTeam,
		MonthlyByPage: monthlyByPage,
		DailyByTeam:   dailyByTeam,
		DailyByPage:   dailyByPage,
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": response})
}

// --- *** NEW: Handler to get all orders (for Admin) *** ---
func handleGetAllOrders(c *gin.Context) {
	var allOrders []Order
	// Invalidate cache first to ensure fresh data
	invalidateSheetCache(AllOrdersSheet)
	err := getCachedSheetData(AllOrdersSheet, &allOrders, cacheTTL) // Fetch fresh, then cache
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch all orders: " + err.Error()})
		return
	}

	// Sort by timestamp descending (newest first)
	sort.Slice(allOrders, func(i, j int) bool {
		// Handle potential nil or empty timestamps
		if allOrders[i].Timestamp == "" {
			return false
		}
		if allOrders[j].Timestamp == "" {
			return true
		}
		return allOrders[i].Timestamp > allOrders[j].Timestamp
	})

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": allOrders})
}

// --- *** NEW: Handler to get chat messages *** ---
func handleGetChatMessages(c *gin.Context) {
	var chatMessages []ChatMessage
	// Fetch fresh data, don't cache chat history heavily, or use a short cache
	err := getCachedSheetData(ChatMessagesSheet, &chatMessages, 10*time.Second) // Short cache (10s)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch chat history: " + err.Error()})
		return
	}

	// Sort by timestamp ascending (oldest first)
	sort.Slice(chatMessages, func(i, j int) bool {
		return chatMessages[i].Timestamp < chatMessages[j].Timestamp
	})

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": chatMessages})
}

// --- *** UPDATED: Helper to upload chat media (Hybrid) *** ---
// Returns (fileUrl, fileID, error)
func uploadChatMediaToDrive(base64Data, fileName, mimeType, userName string) (string, string, error) {
	// *** UPDATED: Use global uploadFolderID ***
	if uploadFolderID == "" {
		return "", "", fmt.Errorf("upload Folder ID is not configured on the server")
	}

	// 1. Call Apps Script Upload API
	resp, err := callAppsScriptPOST(AppsScriptRequest{
		Action:         "uploadImage", // Action for Apps Script
		FileData:       base64Data,
		FileName:       fileName,
		MimeType:       mimeType,
		UploadFolderID: uploadFolderID, // Pass the folder ID
		UserName:       userName,       // *** NEW: Pass UserName ***
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to upload media via Google Apps Script: %v", err)
	}

	return resp.URL, resp.FileID, nil // Return the URL and FileID from Apps Script
}

// --- *** UPDATED: Handler to send chat message *** ---
func handleSendChatMessage(c *gin.Context) {
	var request struct {
		UserName    string `json:"userName"`
		MessageType string `json:"type"`    // "text", "audio", "image"
		Content     string `json:"content"` // Text or Base64 data
		MimeType    string `json:"mimeType,omitempty"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid chat message format: " + err.Error()})
		return
	}

	if request.UserName == "" || request.MessageType == "" || request.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Missing userName, type, or content"})
		return
	}

	timestamp := time.Now().UTC().Format(time.RFC3339)
	finalContent := ""
	fileID := "" // *** NEW ***

	switch request.MessageType {
	case "text":
		finalContent = request.Content

	case "audio", "image":
		if request.MimeType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "mimeType is required for audio/image uploads"})
			return
		}
		// Assume content is Base64 data, generate a filename
		fileExt := strings.SplitN(request.MimeType, "/", 2)
		if len(fileExt) < 2 {
			fileExt = []string{"application", "octet-stream"} // Fallback
		}
		// *** UPDATED: Filename includes UserName for traceability (Point 6) ***
		fileName := fmt.Sprintf("chat_%s_%d.%s", request.UserName, time.Now().UnixNano(), fileExt[1])

		// *** UPDATED: Use Hybrid Upload Function ***
		var err error
		finalContent, fileID, err = uploadChatMediaToDrive(request.Content, fileName, request.MimeType, request.UserName)
		if err != nil {
			log.Printf("Chat media upload failed: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to upload media: " + err.Error()})
			return
		}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid messageType"})
		return
	}

	// Save to Google Sheet
	// *** UPDATED: Added fileID ***
	rowData := []interface{}{
		timestamp,
		request.UserName,
		request.MessageType,
		finalContent,
		fileID, // New FileID column
	}

	err := appendRowToSheet(ChatMessagesSheet, rowData)
	if err != nil {
		log.Printf("Failed to save chat message to sheet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to save message: " + err.Error()})
		return
	}

	// Invalidate chat cache (appendRowToSheet already does this)
	// invalidateSheetCache(ChatMessagesSheet)

	// Broadcast message to WebSocket clients
	broadcastMsg := ChatMessage{
		Timestamp:   timestamp,
		UserName:    request.UserName,
		MessageType: request.MessageType,
		Content:     finalContent,
		FileID:      fileID,
	}
	// *** UPDATED: Use new WebSocketMessage struct ***
	wsMsg := WebSocketMessage{
		Action:  "new_message",
		Payload: broadcastMsg,
	}

	broadcastJSON, err := json.Marshal(wsMsg)
	if err == nil {
		hub.broadcast <- broadcastJSON
	} else {
		log.Printf("Failed to marshal chat message for broadcast: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": broadcastMsg})
}

// --- *** NEW: Handler to delete chat message (Point 5) *** ---
func handleDeleteChatMessage(c *gin.Context) {
	var request struct {
		Timestamp string `json:"timestamp"`
		FileID    string `json:"fileID,omitempty"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid delete request: " + err.Error()})
		return
	}
	if request.Timestamp == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Timestamp is required to delete a message"})
		return
	}

	// 1. Delete file from Google Drive (if FileID is provided)
	if request.FileID != "" {
		log.Printf("Attempting to delete file from Drive: %s", request.FileID)
		// Assume an "deleteFile" action exists in Apps Script
		_, err := callAppsScriptPOST(AppsScriptRequest{
			Action: "deleteFile",
			FileID: request.FileID,
		})
		if err != nil {
			// Log the error but continue to delete the sheet row
			log.Printf("Warning: Failed to delete file %s from Google Drive: %v. Proceeding to delete sheet row.", request.FileID, err)
		} else {
			log.Printf("Successfully deleted file %s from Drive.", request.FileID)
		}
	}

	// 2. Delete row from Google Sheet
	log.Printf("Attempting to delete chat message row with Timestamp: %s", request.Timestamp)
	sheetName := ChatMessagesSheet
	pkHeader := "Timestamp"
	pkValue := request.Timestamp

	// Find the row index (0-based) and sheet ID
	rowIndex, sheetId, err := findRowIndexByPK(sheetName, pkHeader, pkValue)
	if err != nil {
		log.Printf("Error finding chat message row to delete: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Message not found in sheet: " + err.Error()})
		return
	}

	// Create Batch Update request to delete the row
	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{
		Requests: []*sheets.Request{
			{
				DeleteDimension: &sheets.DeleteDimensionRequest{
					Range: &sheets.DimensionRange{
						SheetId:    sheetId,
						Dimension:  "ROWS",
						StartIndex: rowIndex, // 0-based
						EndIndex:   rowIndex + 1,
					},
				},
			},
		},
	}

	// Call BatchUpdate API
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
	if err != nil {
		log.Printf("Error deleting row %d from sheet %s: %v", rowIndex, sheetName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to delete message row: " + err.Error()})
		return
	}

	// 3. Invalidate Cache (Point 7)
	invalidateSheetCache(sheetName)

	// 4. Broadcast deletion via WebSocket
	wsMsg := WebSocketMessage{
		Action:  "delete_message",
		Payload: gin.H{"timestamp": request.Timestamp},
	}
	broadcastJSON, err := json.Marshal(wsMsg)
	if err == nil {
		hub.broadcast <- broadcastJSON
	} else {
		log.Printf("Failed to marshal chat delete message for broadcast: %v", err)
	}

	log.Printf("Successfully deleted chat message: %s", request.Timestamp)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Message deleted"})
}

// --- *** NEW: Generic Admin Handler to Update Sheet (Point 1) *** ---
func handleAdminUpdateSheet(c *gin.Context) {
	var request struct {
		SheetName  string                 `json:"sheetName"`
		PrimaryKey map[string]string      `json:"primaryKey"` // e.g., {"UserName": "admin"}
		NewData    map[string]interface{} `json:"newData"`    // e.g., {"Role": "Admin", "Team": "A,B"}
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid update request: " + err.Error()})
		return
	}

	if request.SheetName == "" || len(request.PrimaryKey) != 1 || len(request.NewData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "sheetName, a single primaryKey, and newData are required"})
		return
	}

	pkHeader := ""
	pkValue := ""
	for k, v := range request.PrimaryKey {
		pkHeader, pkValue = k, v
	}

	// 1. Get Header Map
	headerMap, err := findHeaderMap(request.SheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to read sheet headers: " + err.Error()})
		return
	}

	// 2. Get Row Index and Sheet ID
	rowIndex, sheetId, err := findRowIndexByPK(request.SheetName, pkHeader, pkValue)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Row not found: " + err.Error()})
		return
	}

	// 3. Build Batch Update Requests
	var updateRequests []*sheets.Request
	for colName, newValue := range request.NewData {
		colIndex, ok := headerMap[colName]
		if !ok {
			log.Printf("Warning: Column '%s' not found in sheet '%s'. Skipping update for this column.", colName, request.SheetName)
			continue
		}

		// Convert interface{} to ExtendedValue
		extValue := &sheets.ExtendedValue{}
		switch v := newValue.(type) {
		case string:
			extValue.StringValue = &v
		case float64:
			extValue.NumberValue = &v
		case bool:
			extValue.BoolValue = &v
		case int:
			f := float64(v)
			extValue.NumberValue = &f
		case nil:
			extValue.StringValue = new(string) // Set to empty string
		default:
			str := fmt.Sprintf("%v", v)
			extValue.StringValue = &str
		}

		updateReq := &sheets.Request{
			UpdateCells: &sheets.UpdateCellsRequest{
				Start: &sheets.GridCoordinate{
					SheetId:     sheetId,
					RowIndex:    rowIndex, // 0-based
					ColumnIndex: int64(colIndex), // 0-based
				},
				Rows: []*sheets.RowData{
					{
						Values: []*sheets.CellData{
							{
								UserEnteredValue: extValue,
							},
						},
					},
				},
				Fields: "userEnteredValue",
			},
		}
		updateRequests = append(updateRequests, updateReq)
	}

	if len(updateRequests) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "No valid columns found to update"})
		return
	}

	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{
		Requests: updateRequests,
	}

	// 4. Call API
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
	if err != nil {
		log.Printf("Error performing batch update on sheet %s: %v", request.SheetName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to update sheet: " + err.Error()})
		return
	}

	// 5. Invalidate Cache (Point 7)
	invalidateSheetCache(request.SheetName)

	log.Printf("Successfully updated row %s=%s in sheet %s", pkHeader, pkValue, request.SheetName)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Row updated successfully"})
}

// --- *** NEW: Generic Admin Handler to Add Row (Point 2) *** ---
func handleAdminAddRow(c *gin.Context) {
	var request struct {
		SheetName string                 `json:"sheetName"`
		NewData   map[string]interface{} `json:"newData"` // e.g., {"UserName": "new_user", "Role": "Guest"}
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid add request: " + err.Error()})
		return
	}
	if request.SheetName == "" || len(request.NewData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "sheetName and newData are required"})
		return
	}

	// 1. Get Header Map
	headerMap, err := findHeaderMap(request.SheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to read sheet headers: " + err.Error()})
		return
	}

	// 2. Create ordered row slice
	rowData := make([]interface{}, len(headerMap))
	for header, colIndex := range headerMap {
		if value, ok := request.NewData[header]; ok {
			rowData[colIndex] = value
		} else {
			rowData[colIndex] = "" // Fill blanks for missing columns
		}
	}

	// 3. Call Append API
	err = appendRowToSheet(request.SheetName, rowData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to add row: " + err.Error()})
		return
	}

	// 4. Invalidate Cache (Point 7) - appendRowToSheet already does this

	log.Printf("Successfully added new row to sheet %s", request.SheetName)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Row added successfully"})
}

// --- *** NEW: Generic Admin Handler to Delete Row (Point 3) *** ---
func handleAdminDeleteRow(c *gin.Context) {
	var request struct {
		SheetName  string            `json:"sheetName"`
		PrimaryKey map[string]string `json:"primaryKey"` // e.g., {"UserName": "admin"}
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid delete request: " + err.Error()})
		return
	}
	if request.SheetName == "" || len(request.PrimaryKey) != 1 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "sheetName and a single primaryKey are required"})
		return
	}

	pkHeader := ""
	pkValue := ""
	for k, v := range request.PrimaryKey {
		pkHeader, pkValue = k, v
	}

	// 1. Find Row Index and Sheet ID
	rowIndex, sheetId, err := findRowIndexByPK(request.SheetName, pkHeader, pkValue)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Row not found: " + err.Error()})
		return
	}

	// 2. Build Batch Update Request
	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{
		Requests: []*sheets.Request{
			{
				DeleteDimension: &sheets.DeleteDimensionRequest{
					Range: &sheets.DimensionRange{
						SheetId:    sheetId,
						Dimension:  "ROWS",
						StartIndex: rowIndex, // 0-based
						EndIndex:   rowIndex + 1,
					},
				},
			},
		},
	}

	// 3. Call API
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
	if err != nil {
		log.Printf("Error deleting row %d from sheet %s: %v", rowIndex, request.SheetName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to delete row: " + err.Error()})
		return
	}

	// 4. Invalidate Cache (Point 7)
	invalidateSheetCache(request.SheetName)

	log.Printf("Successfully deleted row %s=%s from sheet %s", pkHeader, pkValue, request.SheetName)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Row deleted successfully"})
}

// --- *** NEW: Specific Handler to Update User Profile (Point 4) *** ---
func handleUpdateProfile(c *gin.Context) {
	var request struct {
		UserName          string `json:"userName"` // The PK
		FullName          string `json:"fullName"`
		ProfilePictureURL string `json:"profilePictureURL"`
		// Add other fields like Password if needed
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid profile update request: " + err.Error()})
		return
	}
	if request.UserName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "UserName is required"})
		return
	}

	sheetName := UsersSheet
	pkHeader := "UserName"
	pkValue := request.UserName

	// 1. Get Header Map
	headerMap, err := findHeaderMap(sheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to read Users sheet headers: " + err.Error()})
		return
	}

	// 2. Get Row Index and Sheet ID
	rowIndex, sheetId, err := findRowIndexByPK(sheetName, pkHeader, pkValue)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "User not found: " + err.Error()})
		return
	}

	// 3. Build Batch Update Requests for specific fields
	var updateRequests []*sheets.Request

	// Update FullName
	if colIndex, ok := headerMap["FullName"]; ok {
		updateRequests = append(updateRequests, &sheets.Request{
			UpdateCells: &sheets.UpdateCellsRequest{
				Start: &sheets.GridCoordinate{SheetId: sheetId, RowIndex: rowIndex, ColumnIndex: int64(colIndex)},
				Rows:  []*sheets.RowData{{Values: []*sheets.CellData{{UserEnteredValue: &sheets.ExtendedValue{StringValue: &request.FullName}}}}},
				Fields: "userEnteredValue",
			},
		})
	}
	// Update ProfilePictureURL
	if colIndex, ok := headerMap["ProfilePictureURL"]; ok {
		updateRequests = append(updateRequests, &sheets.Request{
			UpdateCells: &sheets.UpdateCellsRequest{
				Start: &sheets.GridCoordinate{SheetId: sheetId, RowIndex: rowIndex, ColumnIndex: int64(colIndex)},
				Rows:  []*sheets.RowData{{Values: []*sheets.CellData{{UserEnteredValue: &sheets.ExtendedValue{StringValue: &request.ProfilePictureURL}}}}},
				Fields: "userEnteredValue",
			},
		})
	}

	if len(updateRequests) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "No valid profile columns found to update"})
		return
	}

	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{Requests: updateRequests}

	// 4. Call API
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
	if err != nil {
		log.Printf("Error performing batch update on Users sheet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to update profile: " + err.Error()})
		return
	}

	// 5. Invalidate Cache (Point 7)
	invalidateSheetCache(sheetName)

	log.Printf("Successfully updated profile for user %s", request.UserName)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Profile updated successfully"})
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
			if _, ok := telegramConfig[teamName]; !ok {
				telegramConfig[teamName] = make(map[string]string)
			}
			telegramConfig[teamName]["groupID"] = value

		} else if strings.HasPrefix(key, "TELEGRAM_TOPIC_ID_TEAM_") {
			teamName := strings.TrimPrefix(key, "TELEGRAM_TOPIC_ID_TEAM_")
			if _, ok := telegramConfig[teamName]; !ok {
				telegramConfig[teamName] = make(map[string]string)
			}
			telegramConfig[teamName]["topicID"] = value

		} else if strings.HasPrefix(key, "TELEGRAM_ARCHIVE_ID_TEAM_") {
			teamName := strings.TrimPrefix(key, "TELEGRAM_ARCHIVE_ID_TEAM_")
			if _, ok := telegramConfig[teamName]; !ok {
				telegramConfig[teamName] = make(map[string]string)
			}
			telegramConfig[teamName]["archiveID"] = value
		}
	}
	log.Printf("Loaded %d bot configurations.", len(telegramBots))
}

// --- Main Function ---
func main() {
	// --- Load configuration from environment variables ---
	spreadsheetID = os.Getenv("GOOGLE_SHEET_ID")
	// uploadFolderID = os.Getenv("UPLOAD_FOLDER_ID") // REMOVED (Get from Settings sheet now)
	labelPrinterURL = os.Getenv("LABEL_PRINTER_URL")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Default port for local development
	}
	renderBaseURL = os.Getenv("RENDER_EXTERNAL_URL") // Render provides this automatically

	// *** NEW: Load Apps Script Upload API Config ***
	appsScriptURL = os.Getenv("APPS_SCRIPT_URL")
	appsScriptSecret = os.Getenv("APPS_SCRIPT_SECRET")
	// ---

	if spreadsheetID == "" {
		log.Fatal("GOOGLE_SHEET_ID environment variable is required.")
	}
	if appsScriptURL == "" || appsScriptSecret == "" {
		log.Fatal("APPS_SCRIPT_URL and APPS_SCRIPT_SECRET (for uploads) environment variables are required.")
	}
	// Note: GCP_CREDENTIALS is read directly in createGoogleAPIClient

	// --- NEW: Load Telegram Config ---
	loadTelegramConfig()

	// --- NEW: Start WebSocket Hub ---
	hub = NewHub()
	go hub.run()

	// --- Create Google API Clients ---
	ctx := context.Background()
	err := createGoogleAPIClient(ctx)
	if err != nil {
		log.Fatalf("Failed to create Google API clients: %v", err)
	}

	log.Printf("Connected to Google Sheet ID: %s", spreadsheetID)
	log.Printf("Using Apps Script Upload API at: %s", appsScriptURL)
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
		api.GET("/users", handleGetUsers)            // Corresponds to ?action=getUsers
		api.GET("/static-data", handleGetStaticData) // Corresponds to ?action=getStaticData

		api.POST("/submit-order", handleSubmitOrder)      // Corresponds to { action: 'submitOrder', ... }
		api.POST("/upload-image", handleImageUploadProxy) // Proxy for image uploads

		// --- NEW: Chat Endpoints ---
		chat := api.Group("/chat")
		{
			chat.GET("/messages", handleGetChatMessages)
			chat.POST("/send", handleSendChatMessage)
			chat.POST("/delete", handleDeleteChatMessage) // *** NEW (Point 5) ***
			chat.GET("/ws", serveWs)
		}
		// ---

		// *** Admin Endpoints ***
		admin := api.Group("/admin")
		// TODO: Add authentication middleware for admin routes
		{
			admin.POST("/update-formula-report", handleUpdateFormulaReport)
			admin.GET("/revenue-summary", handleGetRevenueSummary)
			admin.GET("/all-orders", handleGetAllOrders)

			// *** NEW: Admin C.R.U.D. Endpoints (Points 1, 2, 3) ***
			admin.POST("/update-sheet", handleAdminUpdateSheet)
			admin.POST("/add-row", handleAdminAddRow)
			admin.POST("/delete-row", handleAdminDeleteRow)
		}

		// *** NEW: Profile Endpoint (Point 4) ***
		profile := api.Group("/profile")
		// TODO: Add authentication middleware
		{
			profile.POST("/update", handleUpdateProfile)
		}

		// TODO: Add POST handlers for:
		// - /login (Implement authentication)
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

