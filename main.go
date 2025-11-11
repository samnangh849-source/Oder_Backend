package main

import (
	"bytes"
	"context"

	// "encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	// "net/url" // REMOVED (No longer used)
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	// --- REMOVED: Telegram Bot API ---

	// --- NEW: WebSocket Library ---
	"github.com/gorilla/websocket"

	// --- Google API Imports ---
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// --- Configuration ---
var (
	// --- Google API Services ---
	sheetsService *sheets.Service
	// ---
	spreadsheetID  string
	uploadFolderID string
	// ---
	// *** Apps Script API Config (for Uploads AND Orders) ***
	appsScriptURL    string
	appsScriptSecret string
	// ---
	renderBaseURL string // URL of this Render service itself

	// --- NEW: WebSocket Hub ---
	hub *Hub

	// --- NEW: Cache for Sheet IDs ---
	sheetIdCache      = make(map[string]int64)
	sheetIdCacheMutex sync.RWMutex
)

// --- Constants from Apps Script Config (Keep consistent) ---
var sheetRanges = map[string]string{
	"Users":            "Users!A:G",
	"Settings":         "Settings!A:F",
	"TeamsPages":       "TeamsPages!A:D",
	"Products":         "Products!A:E",
	"Locations":        "Locations!A:C",
	"ShippingMethods":  "ShippingMethods!A:D",
	"Colors":           "Colors!A:A",
	"Drivers":          "Drivers!A:B",
	"BankAccounts":     "BankAccounts!A:B",
	"PhoneCarriers":    "PhoneCarriers!A:C",
	"AllOrders":        "AllOrders!A:Y",
	"RevenueDashboard": "RevenueDashboard!A:D",
	"ChatMessages":     "ChatMessages!A:E",

	"FormulaReportSheet": "FormulaReport!A:Z",
	"UserActivityLogs":   "UserActivityLogs!A:Z",
	"EditLogs":           "EditLogs!A:Z",
}

const (
	AllOrdersSheet     = "AllOrders"
	FormulaReportSheet = "FormulaReport"
	RevenueSheet       = "RevenueDashboard"
	UserActivitySheet  = "UserActivityLogs"
	ChatMessagesSheet  = "ChatMessages"
	UsersSheet         = "Users"
	EditLogsSheet      = "EditLogs" // NEW: Constant for log sheet
)

// --- Cache ---
// ... (CacheItem, cache, cacheMutex, cacheTTL remain the same) ...
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
		}
		return nil, false
	}
	log.Printf("Cache HIT for key: %s", key)
	return item.Data, true
}

// ... (clearCache remains the same, it correctly clears both) ...
func clearCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	cache = make(map[string]CacheItem)
	log.Println("Cache CLEARED")
	sheetIdCacheMutex.Lock()
	defer sheetIdCacheMutex.Unlock()
	sheetIdCache = make(map[string]int64)
	log.Println("Sheet ID Cache CLEARED")
}

// ... (invalidateSheetCache remains the same) ...
func invalidateSheetCache(sheetName string) {
	// Invalidate data cache
	cacheMutex.Lock()
	delete(cache, "sheet_"+sheetName)
	cacheMutex.Unlock()
	log.Printf("Cache INVALIDATED for key: sheet_%s", sheetName)

	// Invalidate Sheet ID cache
	sheetIdCacheMutex.Lock()
	delete(sheetIdCache, sheetName)
	sheetIdCacheMutex.Unlock()
	log.Printf("Sheet ID Cache INVALIDATED for key: %s", sheetName)
}

// --- Models ---
// ... (All structs: User, Product, Location, ShippingMethod, TeamPage, Color, Driver, BankAccount, PhoneCarrier, Order, RevenueEntry, ChatMessage, ReportSummary, RevenueAggregate remain the same) ...
type User struct {
	UserName          string `json:"UserName"`
	Password          string `json:"Password"`
	Team              string `json:"Team"`
	FullName          string `json:"FullName"`
	ProfilePictureURL string `json:"ProfilePictureURL"`
	Role              string `json:"Role"`
	IsSystemAdmin     bool   `json:"IsSystemAdmin"`
}
type Product struct {
	ProductName string  `json:"ProductName"`
	Barcode     string  `json:"Barcode"`
	Price       float64 `json:"Price"`
	Cost        float64 `json:"Cost"`
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
	PageLogoURL   string `json:"PageLogoURL"`
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
	Prefixes       string `json:"Prefixes"`
	CarrierLogoURL string `json:"CarrierLogoURL"`
}
type Order struct {
	Timestamp               string  `json:"Timestamp"`
	OrderID                 string  `json:"Order ID"`
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
	ProductsJSON            string  `json:"Products (JSON)"`
	InternalShippingMethod  string  `json:"Internal Shipping Method"`
	InternalShippingDetails string  `json:"Internal Shipping Details"`
	InternalCost            float64 `json:"Internal Cost"`
	PaymentStatus           string  `json:"Payment Status"`
	PaymentInfo             string  `json:"Payment Info"`
	TelegramMessageID       string  `json:"Telegram Message ID"`
	Team                    string  `json:"Team"`
	DiscountUSD             float64 `json:"Discount ($)"`
	DeliveryUnpaid          float64 `json:"Delivery Unpaid"`
	DeliveryPaid            float64 `json:"Delivery Paid"`
	TotalProductCost        float64 `json:"Total Product Cost ($)"`
}
type RevenueEntry struct {
	Timestamp string  `json:"Timestamp"`
	Team      string  `json:"Team"`
	Page      string  `json:"Page"`
	Revenue   float64 `json:"Revenue"`
}
type ChatMessage struct {
	Timestamp   string `json:"Timestamp"`
	UserName    string `json:"UserName"`
	MessageType string `json:"MessageType"`
	Content     string `json:"Content"`
	FileID      string `json:"FileID,omitempty"`
}
type ReportSummary struct {
	TotalSales       float64
	TotalExpense     float64
	TotalProductCost float64
}
type RevenueAggregate struct {
	YearlyByTeam  map[int]map[string]float64    `json:"yearlyByTeam"`
	YearlyByPage  map[int]map[string]float64    `json:"yearlyByPage"`
	MonthlyByTeam map[string]map[string]float64 `json:"monthlyByTeam"`
	MonthlyByPage map[string]map[string]float64 `json:"monthlyByPage"`
	DailyByTeam   map[string]map[string]float64 `json:"dailyByTeam"`
	DailyByPage   map[string]map[string]float64 `json:"dailyByPage"`
}

// --- NEW: Struct for Update Order Request ---
type UpdateOrderRequest struct {
	OrderID  string                 `json:"orderId"`
	Team     string                 `json:"team"`
	UserName string                 `json:"userName"` // For logging
	NewData  map[string]interface{} `json:"newData"`
}

// --- WebSocket Structs ---
// ... (WebSocketMessage, upgrader, Client, Hub, NewHub, run, writePump, serveWs structs and functions remain the same) ...
type WebSocketMessage struct {
	Action  string      `json:"action"`
	Payload interface{} `json:"payload"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
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
		clients:    make(map[*Client]bool),
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
func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()
	for {
		message, ok := <-c.send
		if !ok {
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}
		c.conn.WriteMessage(websocket.TextMessage, message)
	}
}
func serveWs(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade websocket: %v", err)
		return
	}
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client
	go client.writePump()
	go func() {
		defer func() {
			client.hub.unregister <- client
			client.conn.Close()
		}()
		for {
			if _, _, err := client.conn.ReadMessage(); err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				break
			}
		}
	}()
}

// --- Google API Client Setup ---
// ... (createGoogleAPIClient remains the same) ...
func createGoogleAPIClient(ctx context.Context) error {
	credentialsJSON := os.Getenv("GCP_CREDENTIALS")
	if credentialsJSON == "" {
		return fmt.Errorf("GCP_CREDENTIALS environment variable is not set")
	}
	creds := []byte(credentialsJSON)
	sheetsSrv, err := sheets.NewService(ctx, option.WithCredentialsJSON(creds), option.WithScopes(sheets.SpreadsheetsScope))
	if err != nil {
		return fmt.Errorf("unable to retrieve Sheets client: %v", err)
	}
	sheetsService = sheetsSrv
	log.Println("Google Sheets API client created successfully.")
	return nil
}

// --- Google Sheets API Helper Functions ---
// ... (convertSheetValuesToMaps remains the same) ...
func convertSheetValuesToMaps(values *sheets.ValueRange) ([]map[string]interface{}, error) {
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
				header := fmt.Sprintf("%v", headers[i])
				if header != "" {
					if cellStr, ok := cell.(string); ok {
						cleanedStr := cellStr
						if header == "Cost" || header == "Price" || header == "Grand Total" || header == "Subtotal" || header == "Shipping Fee (Customer)" || header == "Internal Cost" || header == "Discount ($)" || header == "Delivery Unpaid" || header == "Delivery Paid" || header == "Total Product Cost ($)" {
							cleanedStr = strings.ReplaceAll(cleanedStr, "$", "")
							cleanedStr = strings.ReplaceAll(cleanedStr, ",", "")
							cleanedStr = strings.TrimSpace(cleanedStr)
						}
						if f, err := strconv.ParseFloat(cleanedStr, 64); err == nil {
							rowData[header] = f
						} else if b, err := strconv.ParseBool(cellStr); err == nil {
							rowData[header] = b
						} else {
							rowData[header] = cellStr
						}
					} else {
						rowData[header] = cell
					}
					if header == "Password" || header == "Customer Phone" || header == "Barcode" || header == "Customer Name" || header == "Note" || header == "Content" {
						rowData[header] = fmt.Sprintf("%v", cell)
					}
				}
			}
		}
		result = append(result, rowData)
	}
	return result, nil
}

// ... (fetchSheetDataFromAPI remains the same) ...
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
	mappedData, err := convertSheetValuesToMaps(resp)
	if err != nil {
		log.Printf("Error converting sheet data for %s: %v", sheetName, err)
		return nil, fmt.Errorf("failed to process data structure from Google Sheets")
	}
	return mappedData, nil
}

// ... (appendRowToSheet remains the same) ...
func appendRowToSheet(sheetName string, rowData []interface{}) error {
	writeRange := sheetName
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{rowData},
	}
	_, err := sheetsService.Spreadsheets.Values.Append(spreadsheetID, writeRange, valueRange).ValueInputOption("RAW").Do()
	if err != nil {
		log.Printf("Error calling Sheets API APPEND for %s: %v", sheetName, err)
		return fmt.Errorf("failed to append row to Google Sheets API")
	}
	invalidateSheetCache(sheetName)
	return nil
}

// ... (overwriteSheetDataInAPI remains the same) ...
func overwriteSheetDataInAPI(sheetName string, data [][]interface{}) error {
	clearRange, ok := sheetRanges[sheetName]
	if !ok {
		return fmt.Errorf("no A1 range defined for sheet: %s", sheetName)
	}
	_, err := sheetsService.Spreadsheets.Values.Clear(spreadsheetID, clearRange, &sheets.ClearValuesRequest{}).Do()
	if err != nil {
		log.Printf("Error calling Sheets API CLEAR for %s: %v", sheetName, err)
		return fmt.Errorf("failed to clear sheet %s: %v", sheetName, err)
	}
	if len(data) == 0 {
		log.Printf("No data provided to overwrite sheet %s. Sheet cleared.", sheetName)
		return nil
	}
	writeRange := fmt.Sprintf("%s!A1", sheetName)
	valueRange := &sheets.ValueRange{
		Values: data,
	}
	_, err = sheetsService.Spreadsheets.Values.Update(spreadsheetID, writeRange, valueRange).ValueInputOption("RAW").Do()
	if err != nil {
		log.Printf("Error calling Sheets API UPDATE for %s: %v", sheetName, err)
		return fmt.Errorf("failed to write data to sheet %s: %v", sheetName, err)
	}
	invalidateSheetCache(sheetName)
	return nil
}

// ... (getSheetIdByName remains the same) ...
func getSheetIdByName(sheetName string) (int64, error) {
	// *** This cache is the source of the problem if it gets stale ***
	sheetIdCacheMutex.RLock()
	sheetId, found := sheetIdCache[sheetName]
	sheetIdCacheMutex.RUnlock()
	if found {
		log.Printf("Cache HIT for Sheet ID: %s", sheetName)
		return sheetId, nil
	}

	log.Printf("Cache MISS for Sheet ID: %s. Fetching from API...", sheetName)
	// Fetch from API
	resp, err := sheetsService.Spreadsheets.Get(spreadsheetID).Fields("sheets(properties(title,sheetId))").Do()
	if err != nil {
		log.Printf("Error fetching spreadsheet properties: %v", err)
		return 0, fmt.Errorf("failed to get spreadsheet info")
	}

	for _, sheet := range resp.Sheets {
		// Cache all IDs we find
		sheetIdCacheMutex.Lock()
		sheetIdCache[sheet.Properties.Title] = sheet.Properties.SheetId
		sheetIdCacheMutex.Unlock()

		if sheet.Properties.Title == sheetName {
			log.Printf("Found Sheet ID for %s: %d", sheetName, sheet.Properties.SheetId)
			sheetId = sheet.Properties.SheetId
			found = true
		}
	}

	if found {
		return sheetId, nil
	}

	return 0, fmt.Errorf("sheet '%s' not found in spreadsheet", sheetName)
}

// ... (findHeaderMap remains the same) ...
func findHeaderMap(sheetName string) (map[string]int, error) {
	headersResp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, fmt.Sprintf("%s!1:1", sheetName)).Do()
	if err != nil || len(headersResp.Values) == 0 {
		log.Printf("Error fetching headers for %s: %v", sheetName, err)
		return nil, fmt.Errorf("failed to read headers for sheet %s", sheetName)
	}
	headers := headersResp.Values[0]
	headerMap := make(map[string]int)
	for i, header := range headers {
		headerMap[fmt.Sprintf("%v", header)] = i
	}
	return headerMap, nil
}

// ... (findRowIndexByPK remains the same) ...
func findRowIndexByPK(sheetName string, pkHeader string, pkValue string) (int64, int64, error) {
	sheetId, err := getSheetIdByName(sheetName)
	if err != nil {
		return -1, 0, err
	}
	headerMap, err := findHeaderMap(sheetName)
	if err != nil {
		return -1, sheetId, err
	}
	pkColIndex, ok := headerMap[pkHeader]
	if !ok {
		return -1, sheetId, fmt.Errorf("primary key column '%s' not found in sheet '%s'", pkHeader, sheetName)
	}
	pkColLetter := string(rune('A' + pkColIndex))
	readRange := fmt.Sprintf("%s!%s2:%s", sheetName, pkColLetter, pkColLetter)
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil {
		log.Printf("Error fetching PK column from %s: %v", sheetName, err)
		return -1, sheetId, fmt.Errorf("failed to read sheet %s", sheetName)
	}
	for i, row := range resp.Values {
		if len(row) > 0 && fmt.Sprintf("%v", row[0]) == pkValue {
			rowIndex := i + 1
			return int64(rowIndex), sheetId, nil
		}
	}
	return -1, sheetId, fmt.Errorf("row not found with %s = %s in sheet %s", pkHeader, pkValue, sheetName)
}

// --- Fetch & Cache Sheet Data (Rewritten) ---
// ... (getCachedSheetData remains the same) ...
func getCachedSheetData(sheetName string, target interface{}, duration time.Duration) error {
	cacheKey := "sheet_" + sheetName
	cachedData, found := getCache(cacheKey)
	if found {
		jsonData, err := json.Marshal(cachedData)
		if err == nil {
			err = json.Unmarshal(jsonData, target)
			if err == nil {
				return nil
			}
			log.Printf("Error unmarshalling cached data for %s: %v", sheetName, err)
		} else {
			log.Printf("Error marshalling cached data for %s: %v", sheetName, err)
		}
	}
	log.Printf("Fetching fresh data for %s (via Sheets API)", sheetName)
	mappedData, err := fetchSheetDataFromAPI(sheetName)
	if err != nil {
		return err
	}
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
	setCache(cacheKey, mappedData, duration)
	return nil
}

// --- Apps Script Communication ---
// ... (AppsScriptRequest, AppsScriptResponse, callAppsScriptPOST structs and function remain the same) ...
type AppsScriptRequest struct {
	Action         string      `json:"action"`
	Secret         string      `json:"secret"`
	UploadFolderID string      `json:"uploadFolderID,omitempty"`
	FileData       string      `json:"fileData,omitempty"`
	FileName       string      `json:"fileName,omitempty"`
	MimeType       string      `json:"mimeType,omitempty"`
	UserName       string      `json:"userName,omitempty"`
	FileID         string      `json:"fileID,omitempty"`
	OrderData      interface{} `json:"orderData,omitempty"`
}
type AppsScriptResponse struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
	URL     string `json:"url,omitempty"`
	FileID  string `json:"fileID,omitempty"`
	OrderID string `json:"orderId,omitempty"`
}

func callAppsScriptPOST(requestData AppsScriptRequest) (AppsScriptResponse, error) {
	requestData.Secret = appsScriptSecret
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
	if scriptResponse.Status != "success" {
		log.Printf("Apps Script POST Error (%s): %s", requestData.Action, scriptResponse.Message)
		return AppsScriptResponse{}, fmt.Errorf("Google Apps Script API error: %s", scriptResponse.Message)
	}
	return scriptResponse, nil
}

// --- API Handlers ---

// ... (handlePing remains the same) ...
func handlePing(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Go backend pong"})
}

// ... (handleGetUsers remains the same) ...
func handleGetUsers(c *gin.Context) {
	var users []User
	err := getCachedSheetData("Users", &users, 15*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": users})
}

// ... (handleGetStaticData remains the same) ...
func handleGetStaticData(c *gin.Context) {
	result := make(map[string]interface{})
	var err error
	var pages []TeamPage
	var products []Product
	var locations []Location
	var shippingMethods []ShippingMethod
	var settingsMaps []map[string]interface{}
	var colors []Color
	var drivers []Driver
	var bankAccounts []BankAccount
	var phoneCarriers []PhoneCarrier

	err = getCachedSheetData("TeamsPages", &pages, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["pages"] = pages

	err = getCachedSheetData("Products", &products, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["products"] = products

	err = getCachedSheetData("Locations", &locations, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["locations"] = locations

	err = getCachedSheetData("ShippingMethods", &shippingMethods, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["shippingMethods"] = shippingMethods

	err = getCachedSheetData("Settings", &settingsMaps, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["settings"] = settingsMaps

	if len(settingsMaps) > 0 && len(settingsMaps[0]) > 0 {
		if id, ok := settingsMaps[0]["UploadFolderID"].(string); ok {
			uploadFolderID = id
		}
	}
	if uploadFolderID == "" {
		uploadFolderID = os.Getenv("UPLOAD_FOLDER_ID")
	}
	if uploadFolderID == "" {
		log.Printf("CRITICAL WARNING: UPLOAD_FOLDER_ID is not set in Settings sheet or Environment Variables. File uploads will fail.")
	}

	err = getCachedSheetData("Colors", &colors, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["colors"] = colors

	err = getCachedSheetData("Drivers", &drivers, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["drivers"] = drivers

	err = getCachedSheetData("BankAccounts", &bankAccounts, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["bankAccounts"] = bankAccounts

	err = getCachedSheetData("PhoneCarriers", &phoneCarriers, cacheTTL)
	if err != nil {
		goto handleError
	}
	result["phoneCarriers"] = phoneCarriers

	c.JSON(http.StatusOK, gin.H{"status": "success", "data": result})
	return

handleError:
	c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
}

// --- handleSubmitOrder (Delegates to Apps Script) ---
// ... (handleSubmitOrder remains the same) ...
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
	timestamp := time.Now().UTC().Format(time.RFC3339)
	orderId := fmt.Sprintf("GO-%s-%d", team, time.Now().UnixNano())
	productsJSON, err := json.Marshal(orderRequest.Products)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to serialize products"})
		return
	}
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
	shippingCost, _ := orderRequest.Shipping["cost"].(float64)
	var totalDiscount float64 = 0
	var totalProductCost float64 = 0
	for _, p := range orderRequest.Products {
		originalPrice, opOK := p["originalPrice"].(float64)
		finalPrice, fpOK := p["finalPrice"].(float64)
		quantity, qOK := p["quantity"].(float64)
		cost, cOK := p["cost"].(float64)
		if opOK && fpOK && qOK && originalPrice > 0 && quantity > 0 {
			totalDiscount += (originalPrice - finalPrice) * quantity
		}
		if cOK && qOK {
			totalProductCost += (cost * quantity)
		}
	}
	fullOrderData := map[string]interface{}{
		"orderId":          orderId,
		"timestamp":        timestamp,
		"totalDiscount":    totalDiscount,
		"totalProductCost": totalProductCost,
		"fullLocation":     fullLocation,
		"productsJSON":     string(productsJSON),
		"shippingCost":     shippingCost,
		"originalRequest":  orderRequest,
	}
	_, err = callAppsScriptPOST(AppsScriptRequest{
		Action:    "submitOrder",
		OrderData: fullOrderData,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to submit order to Apps Script: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "orderId": orderId})
}

// --- handleImageUploadProxy ---
// ... (handleImageUploadProxy remains the same) ...
func handleImageUploadProxy(c *gin.Context) {
	var uploadRequest struct {
		FileData   string            `json:"fileData"`
		FileName   string            `json:"fileName"`
		MimeType   string            `json:"mimeType"`
		SheetName  string            `json:"sheetName"`
		PrimaryKey map[string]string `json:"primaryKey"`
		ColumnName string            `json:"columnName"`
		UserName   string            `json:"userName"`
	}
	if err := c.ShouldBindJSON(&uploadRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid image upload data format: " + err.Error()})
		return
	}
	if uploadFolderID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Upload Folder ID is not configured on the server."})
		return
	}
	resp, err := callAppsScriptPOST(AppsScriptRequest{
		Action:         "uploadImage",
		FileData:       uploadRequest.FileData,
		FileName:       uploadRequest.FileName,
		MimeType:       uploadRequest.MimeType,
		UploadFolderID: uploadFolderID,
		UserName:       uploadRequest.UserName,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to upload image via Google Apps Script: " + err.Error()})
		return
	}
	fileUrl := resp.URL
	if uploadRequest.SheetName != "" && uploadRequest.PrimaryKey != nil && uploadRequest.ColumnName != "" {
		go func() {
			pkHeader := ""
			pkValue := ""
			for k, v := range uploadRequest.PrimaryKey {
				pkHeader = k
				pkValue = v
				break
			}
			if pkHeader == "" || pkValue == "" {
				log.Printf("Warning: Missing primary key info for image update. Sheet: %s, Column: %s", uploadRequest.SheetName, uploadRequest.ColumnName)
				return
			}
			headerMap, err := findHeaderMap(uploadRequest.SheetName)
			if err != nil {
				log.Printf("Error finding headers for %s: %v", uploadRequest.SheetName, err)
				return
			}
			rowIndex, sheetId, err := findRowIndexByPK(uploadRequest.SheetName, pkHeader, pkValue)
			if err != nil {
				log.Printf("Error finding row for PK %s=%s in sheet %s for image update: %v", pkHeader, pkValue, uploadRequest.SheetName, err)
				return
			}
			colIndex, ok := headerMap[uploadRequest.ColumnName]
			if !ok {
				log.Printf("Error: Column '%s' not found in sheet '%s'", uploadRequest.ColumnName, uploadRequest.SheetName)
				return
			}
			batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{
				Requests: []*sheets.Request{
					{
						UpdateCells: &sheets.UpdateCellsRequest{
							Start: &sheets.GridCoordinate{
								SheetId:     sheetId,
								RowIndex:    rowIndex,
								ColumnIndex: int64(colIndex),
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
			_, updateErr := sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
			if updateErr != nil {
				log.Printf("Error updating sheet %s with image URL using BatchUpdate: %v", uploadRequest.SheetName, updateErr)
			} else {
				log.Printf("Successfully updated sheet %s with image URL", uploadRequest.SheetName)
				invalidateSheetCache(uploadRequest.SheetName)
			}
		}()
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "url": fileUrl, "fileID": resp.FileID})
}

// --- *** NEW: Audio Proxy Handler *** ---
func handleGetAudioProxy(c *gin.Context) {
	fileID := c.Param("fileID")
	if fileID == "" {
		c.String(http.StatusBadRequest, "File ID is required")
		return
	}

	// Construct the Google Drive download URL
	// Using export=download is sometimes more reliable
	googleURL := fmt.Sprintf("https://drive.google.com/uc?id=%s&export=download", fileID)

	// Create a new request (to handle potential redirects safely)
	// Use a client that follows redirects (default client does)
	resp, err := http.Get(googleURL)
	if err != nil {
		log.Printf("Failed to fetch audio from Google Drive (FileID: %s): %v", fileID, err)
		c.String(http.StatusInternalServerError, "Failed to retrieve audio file")
		return
	}
	defer resp.Body.Close()

	// Check if Google returned an error (e.g., file not found, or a virus warning page)
	if resp.StatusCode != http.StatusOK {
		// It might be a redirect to a consent page (like large files/virus scan)
		// Or just a 404
		log.Printf("Google Drive returned non-OK status %d for FileID: %s", resp.StatusCode, fileID)

		// If it's HTML, it's definitely an error/consent page we can't handle
		if strings.HasPrefix(resp.Header.Get("Content-Type"), "text/html") {
			log.Printf("Google returned an HTML page, probably a consent/error screen.")
			c.String(http.StatusForbidden, "Cannot proxy file. It may require manual download from Google.")
			return
		}

		c.String(resp.StatusCode, "Error from Google Drive")
		return
	}

	// Success! Stream the file.
	// Copy headers from Google's response to our response
	// This tells the browser what kind of file it is.
	c.Writer.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	c.Writer.Header().Set("Content-Length", resp.Header.Get("Content-Length"))
	// This might help force playback
	c.Writer.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", fileID))

	// Stream the audio data
	io.Copy(c.Writer, resp.Body)
}

// --- Report/Admin Handlers ---
// ... (handleUpdateFormulaReport remains the same) ...
func handleUpdateFormulaReport(c *gin.Context) {
	var allOrders []Order
	invalidateSheetCache(AllOrdersSheet)
	err := getCachedSheetData(AllOrdersSheet, &allOrders, cacheTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch order data: " + err.Error()})
		return
	}
	reportData := [][]interface{}{
		{"Category", "Period", "Total Sales", "Total Expense (Shipping)", "Total Product Cost", "Net Profit"},
	}
	if len(allOrders) == 0 {
		err = overwriteSheetDataInAPI(FormulaReportSheet, reportData)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to clear/write headers to report sheet: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Formula Report updated (No order data found)."})
		return
	}
	yearlyData := make(map[int]*ReportSummary)
	monthlyData := make(map[string]*ReportSummary)
	dailyData := make(map[string]*ReportSummary)
	now := time.Now()
	currentYear := now.Year()
	currentMonth := now.Month()
	loc, _ := time.LoadLocation("Asia/Phnom_Penh")
	if loc == nil {
		loc = time.UTC
	}
	for _, order := range allOrders {
		ts, err := time.Parse(time.RFC3339, order.Timestamp)
		if err != nil {
			log.Printf("Warning: Could not parse timestamp '%s' for order %s: %v. Skipping record.", order.Timestamp, order.OrderID, err)
			continue
		}
		ts = ts.In(loc)
		year := ts.Year()
		month := ts.Month()
		yearMonthKey := fmt.Sprintf("%d-%02d", year, month)
		yearMonthDayKey := ts.Format("2006-01-02")
		if _, ok := yearlyData[year]; !ok {
			yearlyData[year] = &ReportSummary{}
		}
		yearlyData[year].TotalSales += order.GrandTotal
		yearlyData[year].TotalExpense += order.InternalCost
		yearlyData[year].TotalProductCost += order.TotalProductCost
		if year == currentYear {
			if _, ok := monthlyData[yearMonthKey]; !ok {
				monthlyData[yearMonthKey] = &ReportSummary{}
			}
			monthlyData[yearMonthKey].TotalSales += order.GrandTotal
			monthlyData[yearMonthKey].TotalExpense += order.InternalCost
			monthlyData[yearMonthKey].TotalProductCost += order.TotalProductCost
		}
		if year == currentYear && month == currentMonth {
			if _, ok := dailyData[yearMonthDayKey]; !ok {
				dailyData[yearMonthDayKey] = &ReportSummary{}
			}
			dailyData[yearMonthDayKey].TotalSales += order.GrandTotal
			dailyData[yearMonthDayKey].TotalExpense += order.InternalCost
			dailyData[yearMonthDayKey].TotalProductCost += order.TotalProductCost
		}
	}
	reportData = append(reportData, []interface{}{"YEARLY REPORT", "", "", "", "", ""})
	years := make([]int, 0, len(yearlyData))
	for y := range yearlyData {
		years = append(years, y)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(years)))
	for _, year := range years {
		summary := yearlyData[year]
		netProfit := summary.TotalSales - summary.TotalExpense - summary.TotalProductCost
		reportData = append(reportData, []interface{}{
			"", year,
			fmt.Sprintf("%.2f", summary.TotalSales),
			fmt.Sprintf("%.2f", summary.TotalExpense),
			fmt.Sprintf("%.2f", summary.TotalProductCost),
			fmt.Sprintf("%.2f", netProfit),
		})
	}
	reportData = append(reportData, []interface{}{})
	reportData = append(reportData, []interface{}{fmt.Sprintf("MONTHLY REPORT (%d)", currentYear), "", "", "", "", ""})
	for m := 1; m <= 12; m++ {
		monthKey := fmt.Sprintf("%d-%02d", currentYear, m)
		summary, ok := monthlyData[monthKey]
		monthName := time.Month(m).String()
		if ok {
			netProfit := summary.TotalSales - summary.TotalExpense - summary.TotalProductCost
			reportData = append(reportData, []interface{}{
				"", monthName,
				fmt.Sprintf("%.2f", summary.TotalSales),
				fmt.Sprintf("%.2f", summary.TotalExpense),
				fmt.Sprintf("%.2f", summary.TotalProductCost),
				fmt.Sprintf("%.2f", netProfit),
			})
		} else {
			reportData = append(reportData, []interface{}{"", monthName, "0.00", "0.00", "0.00", "0.00"})
		}
	}
	reportData = append(reportData, []interface{}{})
	reportData = append(reportData, []interface{}{fmt.Sprintf("DAILY REPORT (%s %d)", currentMonth.String(), currentYear), "", "", "", "", ""})
	dayKeys := make([]string, 0, len(dailyData))
	for d := range dailyData {
		dayKeys = append(dayKeys, d)
	}
	sort.Strings(dayKeys)
	for _, dayKey := range dayKeys {
		summary := dailyData[dayKey]
		t, _ := time.Parse("2006-01-02", dayKey)
		dayLabel := t.Format("Jan 02, 2006")
		netProfit := summary.TotalSales - summary.TotalExpense - summary.TotalProductCost
		reportData = append(reportData, []interface{}{
			"", dayLabel,
			fmt.Sprintf("%.2f", summary.TotalSales),
			fmt.Sprintf("%.2f", summary.TotalExpense),
			fmt.Sprintf("%.2f", summary.TotalProductCost),
			fmt.Sprintf("%.2f", netProfit),
		})
	}
	err = overwriteSheetDataInAPI(FormulaReportSheet, reportData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to write report data: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Formula Report updated successfully."})
}

// ... (handleGetRevenueSummary remains the same) ...
func handleGetRevenueSummary(c *gin.Context) {
	var revenueEntries []RevenueEntry
	invalidateSheetCache(RevenueSheet)
	err := getCachedSheetData(RevenueSheet, &revenueEntries, cacheTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch revenue data: " + err.Error()})
		return
	}
	if len(revenueEntries) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "success", "data": RevenueAggregate{
			YearlyByTeam:  make(map[int]map[string]float64),
			YearlyByPage:  make(map[int]map[string]float64),
			MonthlyByTeam: make(map[string]map[string]float64),
			MonthlyByPage: make(map[string]map[string]float64),
			DailyByTeam:   make(map[string]map[string]float64),
			DailyByPage:   make(map[string]map[string]float64),
		}})
		return
	}
	yearlyByTeam := make(map[int]map[string]float64)
	yearlyByPage := make(map[int]map[string]float64)
	monthlyByTeam := make(map[string]map[string]float64)
	monthlyByPage := make(map[string]map[string]float64)
	dailyByTeam := make(map[string]map[string]float64)
	dailyByPage := make(map[string]map[string]float64)
	now := time.Now()
	currentYear := now.Year()
	currentMonth := now.Month()
	loc, _ := time.LoadLocation("Asia/Phnom_Penh")
	if loc == nil {
		loc = time.UTC
	}
	for _, entry := range revenueEntries {
		ts, err := time.Parse(time.RFC3339, entry.Timestamp)
		if err != nil {
			log.Printf("Warning: Could not parse timestamp '%s' for revenue entry. Skipping.", entry.Timestamp)
			continue
		}
		ts = ts.In(loc)
		year := ts.Year()
		month := ts.Month()
		yearMonthKey := fmt.Sprintf("%d-%02d", year, month)
		yearMonthDayKey := ts.Format("2006-01-02")
		team := entry.Team
		if team == "" {
			team = "Unknown"
		}
		page := entry.Page
		if page == "" {
			page = "Unknown"
		}
		revenue := entry.Revenue
		if _, ok := yearlyByTeam[year]; !ok {
			yearlyByTeam[year] = make(map[string]float64)
		}
		yearlyByTeam[year][team] += revenue
		if _, ok := yearlyByPage[year]; !ok {
			yearlyByPage[year] = make(map[string]float64)
		}
		yearlyByPage[year][page] += revenue
		if year == currentYear {
			if _, ok := monthlyByTeam[yearMonthKey]; !ok {
				monthlyByTeam[yearMonthKey] = make(map[string]float64)
			}
			monthlyByTeam[yearMonthKey][team] += revenue
			if _, ok := monthlyByPage[yearMonthKey]; !ok {
				monthlyByPage[yearMonthKey] = make(map[string]float64)
			}
			monthlyByPage[yearMonthKey][page] += revenue
		}
		if year == currentYear && month == currentMonth {
			if _, ok := dailyByTeam[yearMonthDayKey]; !ok {
				dailyByTeam[yearMonthDayKey] = make(map[string]float64)
			}
			dailyByTeam[yearMonthDayKey][team] += revenue
			if _, ok := dailyByPage[yearMonthDayKey]; !ok {
				dailyByPage[yearMonthDayKey] = make(map[string]float64)
			}
			dailyByPage[yearMonthDayKey][page] += revenue
		}
	}
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

// ... (handleGetAllOrders remains the same) ...
func handleGetAllOrders(c *gin.Context) {
	var allOrders []Order
	invalidateSheetCache(AllOrdersSheet)
	err := getCachedSheetData(AllOrdersSheet, &allOrders, cacheTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch all orders: " + err.Error()})
		return
	}
	sort.Slice(allOrders, func(i, j int) bool {
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

// ... (handleGetChatMessages remains the same) ...
func handleGetChatMessages(c *gin.Context) {
	var chatMessages []ChatMessage
	err := getCachedSheetData(ChatMessagesSheet, &chatMessages, 10*time.Second)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch chat history: " + err.Error()})
		return
	}
	sort.Slice(chatMessages, func(i, j int) bool {
		return chatMessages[i].Timestamp < chatMessages[j].Timestamp
	})
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": chatMessages})
}

// ... (uploadChatMediaToDrive remains the same) ...
func uploadChatMediaToDrive(base64Data, fileName, mimeType, userName string) (string, string, error) {
	if uploadFolderID == "" {
		return "", "", fmt.Errorf("upload Folder ID is not configured on the server")
	}
	resp, err := callAppsScriptPOST(AppsScriptRequest{
		Action:         "uploadImage",
		FileData:       base64Data,
		FileName:       fileName,
		MimeType:       mimeType,
		UploadFolderID: uploadFolderID,
		UserName:       userName,
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to upload media via Google Apps Script: %v", err)
	}
	return resp.URL, resp.FileID, nil
}

// ... (handleSendChatMessage remains the same) ...
func handleSendChatMessage(c *gin.Context) {
	var request struct {
		UserName    string `json:"userName"`
		MessageType string `json:"type"`
		Content     string `json:"content"`
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
	fileID := ""
	switch request.MessageType {
	case "text":
		finalContent = request.Content
	case "audio", "image":
		if request.MimeType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "mimeType is required for audio/image uploads"})
			return
		}
		fileExt := strings.SplitN(request.MimeType, "/", 2)
		if len(fileExt) < 2 {
			fileExt = []string{"application", "octet-stream"}
		}
		fileName := fmt.Sprintf("chat_%s_%d.%s", request.UserName, time.Now().UnixNano(), fileExt[1])
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
	rowData := []interface{}{
		timestamp,
		request.UserName,
		request.MessageType,
		finalContent,
		fileID,
	}
	err := appendRowToSheet(ChatMessagesSheet, rowData)
	if err != nil {
		log.Printf("Failed to save chat message to sheet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to save message: " + err.Error()})
		return
	}
	broadcastMsg := ChatMessage{
		Timestamp:   timestamp,
		UserName:    request.UserName,
		MessageType: request.MessageType,
		Content:     finalContent,
		FileID:      fileID,
	}
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

// ... (handleDeleteChatMessage remains the same) ...
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
	if request.FileID != "" {
		log.Printf("Attempting to delete file from Drive: %s", request.FileID)
		_, err := callAppsScriptPOST(AppsScriptRequest{
			Action: "deleteFile",
			FileID: request.FileID,
		})
		if err != nil {
			log.Printf("Warning: Failed to delete file %s from Google Drive: %v. Proceeding to delete sheet row.", request.FileID, err)
		} else {
			log.Printf("Successfully deleted file %s from Drive.", request.FileID)
		}
	}
	log.Printf("Attempting to delete chat message row with Timestamp: %s", request.Timestamp)
	sheetName := ChatMessagesSheet
	pkHeader := "Timestamp"
	pkValue := request.Timestamp

	// This call will now use a cached ID if available, or fetch a new one if not.
	rowIndex, sheetId, err := findRowIndexByPK(sheetName, pkHeader, pkValue)
	if err != nil {
		log.Printf("Error finding chat message row to delete: %v", err)

		// *** ADDED: If row not found, maybe cache is stale? Clear it and try one more time. ***
		// This is a safety net.
		if strings.Contains(err.Error(), "sheet") {
			log.Printf("Clearing Sheet ID cache for %s and retrying...", sheetName)
			invalidateSheetCache(sheetName)                                         // Clear the potentially bad ID
			rowIndex, sheetId, err = findRowIndexByPK(sheetName, pkHeader, pkValue) // Try again
			if err != nil {
				log.Printf("Error finding row on second attempt: %v", err)
				c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Message not found in sheet: " + err.Error()})
				return
			}
		} else {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Message not found in sheet: " + err.Error()})
			return
		}
	}

	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{
		Requests: []*sheets.Request{
			{
				DeleteDimension: &sheets.DeleteDimensionRequest{
					Range: &sheets.DimensionRange{
						SheetId:    sheetId,
						Dimension:  "ROWS",
						StartIndex: rowIndex,
						EndIndex:   rowIndex + 1,
					},
				},
			},
		},
	}
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
	if err != nil {
		log.Printf("Error deleting row %d from sheet %s: %v", rowIndex, sheetName, err)
		// *** THIS IS WHERE YOUR ERROR HAPPENED ***
		// If the error is "No grid with id", it's a stale cache.
		if strings.Contains(err.Error(), "No grid with id") {
			log.Printf("Stale Sheet ID detected. Clearing Sheet ID cache for %s.", sheetName)
			invalidateSheetCache(sheetName) // Clear the bad ID for next time
		}
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to delete message row: " + err.Error()})
		return
	}

	// *** This call is now fixed and will clear the sheetIdCache ***
	invalidateSheetCache(sheetName)

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

// --- *** NEW: Refactored Helper Function for Updating Rows *** ---
// This function contains the core logic previously in handleAdminUpdateSheet
func updateSheetRow(sheetName string, primaryKey map[string]string, newData map[string]interface{}) error {
	if sheetName == "" || len(primaryKey) != 1 || len(newData) == 0 {
		return fmt.Errorf("sheetName, a single primaryKey, and newData are required")
	}

	pkHeader := ""
	pkValue := ""
	for k, v := range primaryKey {
		pkHeader, pkValue = k, v
	}

	headerMap, err := findHeaderMap(sheetName)
	if err != nil {
		return fmt.Errorf("failed to read sheet headers for %s: %v", sheetName, err)
	}

	rowIndex, sheetId, err := findRowIndexByPK(sheetName, pkHeader, pkValue)
	if err != nil {
		return fmt.Errorf("row not found (%s=%s) in %s: %v", pkHeader, pkValue, sheetName, err)
	}

	var updateRequests []*sheets.Request
	for colName, newValue := range newData {
		colIndex, ok := headerMap[colName]
		if !ok {
			log.Printf("Warning: Column '%s' not found in sheet '%s'. Skipping update for this column.", colName, sheetName)
			continue
		}
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
		case int64:
			f := float64(v)
			extValue.NumberValue = &f
		case nil:
			// Set as empty string
			extValue.StringValue = new(string)
		default:
			// Convert other types to string as a fallback
			str := fmt.Sprintf("%v", v)
			extValue.StringValue = &str
		}
		updateReq := &sheets.Request{
			UpdateCells: &sheets.UpdateCellsRequest{
				Start: &sheets.GridCoordinate{
					SheetId:     sheetId,
					RowIndex:    rowIndex,
					ColumnIndex: int64(colIndex),
				},
				Rows: []*sheets.RowData{
					{
						Values: []*sheets.CellData{
							{UserEnteredValue: extValue},
						},
					},
				},
				Fields: "userEnteredValue",
			},
		}
		updateRequests = append(updateRequests, updateReq)
	}

	if len(updateRequests) == 0 {
		return fmt.Errorf("no valid columns found to update")
	}

	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{Requests: updateRequests}
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()

	if err != nil {
		if strings.Contains(err.Error(), "No grid with id") {
			log.Printf("Stale Sheet ID detected during update. Clearing Sheet ID cache for %s.", sheetName)
			invalidateSheetCache(sheetName)
		}
		return fmt.Errorf("failed to update sheet %s: %v", sheetName, err)
	}

	invalidateSheetCache(sheetName)
	log.Printf("Successfully updated row %s=%s in sheet %s", pkHeader, pkValue, sheetName)
	return nil
}

// --- *** REFACTORED: handleAdminUpdateSheet *** ---
// This handler now uses the helper function
func handleAdminUpdateSheet(c *gin.Context) {
	var request struct {
		SheetName  string                 `json:"sheetName"`
		PrimaryKey map[string]string      `json:"primaryKey"`
		NewData    map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid update request: " + err.Error()})
		return
	}

	err := updateSheetRow(request.SheetName, request.PrimaryKey, request.NewData)
	if err != nil {
		// Return specific error codes based on error message
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": err.Error()})
		} else if strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "columns") {
			c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Row updated successfully"})
}

// --- *** NEW: handleAdminUpdateOrder *** ---
// This is the new endpoint handler you requested
func handleAdminUpdateOrder(c *gin.Context) {
	var request UpdateOrderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid update request: " + err.Error()})
		return
	}

	if request.OrderID == "" || request.Team == "" || request.UserName == "" || len(request.NewData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "orderId, team, userName, and newData are required"})
		return
	}

	teamSheetName := "Orders_" + request.Team
	pk := map[string]string{"Order ID": request.OrderID}

	// 1. Update the Team-specific sheet
	err := updateSheetRow(teamSheetName, pk, request.NewData)
	if err != nil {
		log.Printf("Failed to update team sheet (%s) for order %s: %v", teamSheetName, request.OrderID, err)
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Order not found in team sheet " + teamSheetName + ": " + err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to update team sheet: " + err.Error()})
		}
		return
	}

	// 2. Update the AllOrders sheet
	err = updateSheetRow(AllOrdersSheet, pk, request.NewData)
	if err != nil {
		log.Printf("CRITICAL: Team sheet %s updated, but AllOrders failed for order %s: %v", teamSheetName, request.OrderID, err)
		// Even if this fails, we return success because the primary sheet (team) was updated
		// But we log this as a critical error.
		// We still proceed to log the edit.
	}

	// 3. Log the edit asynchronously
	go func() {
		timestamp := time.Now().UTC().Format(time.RFC3339)
		// Log each changed field as a separate row
		for field, value := range request.NewData {
			logRow := []interface{}{
				timestamp,
				request.OrderID,
				request.UserName,
				"N/A (Auto-Approved)", // Placeholder for approver
				field,
				"N/A", // We don't fetch the old value for performance
				fmt.Sprintf("%v", value),
			}
			if err := appendRowToSheet(EditLogsSheet, logRow); err != nil {
				log.Printf("Failed to append edit log for order %s: %v", request.OrderID, err)
			}
			// Invalidate log sheet cache (already handled by appendRowToSheet)
		}
	}()

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Order updated successfully"})
}

// ... (handleAdminAddRow remains the same) ...
func handleAdminAddRow(c *gin.Context) {
	var request struct {
		SheetName string                 `json:"sheetName"`
		NewData   map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid add request: " + err.Error()})
		return
	}
	if request.SheetName == "" || len(request.NewData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "sheetName and newData are required"})
		return
	}
	headerMap, err := findHeaderMap(request.SheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to read sheet headers: " + err.Error()})
		return
	}
	rowData := make([]interface{}, len(headerMap))
	for header, colIndex := range headerMap {
		if value, ok := request.NewData[header]; ok {
			rowData[colIndex] = value
		} else {
			rowData[colIndex] = ""
		}
	}
	err = appendRowToSheet(request.SheetName, rowData) // This already calls invalidateSheetCache
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to add row: " + err.Error()})
		return
	}
	log.Printf("Successfully added new row to sheet %s", request.SheetName)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Row added successfully"})
}

// ... (handleAdminDeleteRow remains the same) ...
func handleAdminDeleteRow(c *gin.Context) {
	var request struct {
		SheetName  string            `json:"sheetName"`
		PrimaryKey map[string]string `json:"primaryKey"`
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
	rowIndex, sheetId, err := findRowIndexByPK(request.SheetName, pkHeader, pkValue)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "Row not found: " + err.Error()})
		return
	}
	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{
		Requests: []*sheets.Request{
			{
				DeleteDimension: &sheets.DeleteDimensionRequest{
					Range: &sheets.DimensionRange{
						SheetId:    sheetId,
						Dimension:  "ROWS",
						StartIndex: rowIndex,
						EndIndex:   rowIndex + 1,
					},
				},
			},
		},
	}
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
	if err != nil {
		if strings.Contains(err.Error(), "No grid with id") {
			log.Printf("Stale Sheet ID detected during delete. Clearing Sheet ID cache for %s.", request.SheetName)
			invalidateSheetCache(request.SheetName)
		}
		log.Printf("Error deleting row %d from sheet %s: %v", rowIndex, request.SheetName, err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to delete row: " + err.Error()})
		return
	}
	invalidateSheetCache(request.SheetName)
	log.Printf("Successfully deleted row %s=%s from sheet %s", pkHeader, pkValue, request.SheetName)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Row deleted successfully"})
}

// ... (handleUpdateProfile remains the same) ...
func handleUpdateProfile(c *gin.Context) {
	var request struct {
		UserName          string `json:"userName"`
		FullName          string `json:"fullName"`
		ProfilePictureURL string `json:"profilePictureURL"`
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
	headerMap, err := findHeaderMap(sheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to read Users sheet headers: " + err.Error()})
		return
	}
	rowIndex, sheetId, err := findRowIndexByPK(sheetName, pkHeader, pkValue)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"status": "error", "message": "User not found: " + err.Error()})
		return
	}
	var updateRequests []*sheets.Request
	if colIndex, ok := headerMap["FullName"]; ok {
		updateRequests = append(updateRequests, &sheets.Request{
			UpdateCells: &sheets.UpdateCellsRequest{
				Start:  &sheets.GridCoordinate{SheetId: sheetId, RowIndex: rowIndex, ColumnIndex: int64(colIndex)},
				Rows:   []*sheets.RowData{{Values: []*sheets.CellData{{UserEnteredValue: &sheets.ExtendedValue{StringValue: &request.FullName}}}}},
				Fields: "userEnteredValue",
			},
		})
	}
	if colIndex, ok := headerMap["ProfilePictureURL"]; ok {
		updateRequests = append(updateRequests, &sheets.Request{
			UpdateCells: &sheets.UpdateCellsRequest{
				Start:  &sheets.GridCoordinate{SheetId: sheetId, RowIndex: rowIndex, ColumnIndex: int64(colIndex)},
				Rows:   []*sheets.RowData{{Values: []*sheets.CellData{{UserEnteredValue: &sheets.ExtendedValue{StringValue: &request.ProfilePictureURL}}}}},
				Fields: "userEnteredValue",
			},
		})
	}
	if len(updateRequests) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "No valid profile columns found to update"})
		return
	}
	batchUpdateReq := &sheets.BatchUpdateSpreadsheetRequest{Requests: updateRequests}
	_, err = sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, batchUpdateReq).Do()
	if err != nil {
		if strings.Contains(err.Error(), "No grid with id") {
			log.Printf("Stale Sheet ID detected during profile update. Clearing Sheet ID cache for %s.", sheetName)
			invalidateSheetCache(sheetName)
		}
		log.Printf("Error performing batch update on Users sheet: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to update profile: " + err.Error()})
		return
	}
	invalidateSheetCache(sheetName)
	log.Printf("Successfully updated profile for user %s", request.UserName)
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Profile updated successfully"})
}

// --- *** NEW: Handler to clear all server caches *** ---
func handleClearCache(c *gin.Context) {
	clearCache() // This function already clears both data and sheetId caches
	log.Println("All server caches (data and Sheet IDs) have been cleared via API request.")
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "All server caches cleared"})
}

// --- Main Function ---
func main() {
	// --- Load configuration from environment variables ---
	spreadsheetID = os.Getenv("GOOGLE_SHEET_ID")
	// labelPrinterURL = os.Getenv("LABEL_PRINTER_URL") // REMOVED
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	renderBaseURL = os.Getenv("RENDER_EXTERNAL_URL")

	// *** Load Apps Script API Config ***
	appsScriptURL = os.Getenv("APPS_SCRIPT_URL")
	appsScriptSecret = os.Getenv("APPS_SCRIPT_SECRET")

	if spreadsheetID == "" {
		log.Fatal("GOOGLE_SHEET_ID environment variable is required.")
	}
	if appsScriptURL == "" || appsScriptSecret == "" {
		log.Fatal("APPS_SCRIPT_URL and APPS_SCRIPT_SECRET environment variables are required.")
	}

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
	log.Printf("Using Apps Script API at: %s", appsScriptURL)
	log.Printf("Render Base URL: %s", renderBaseURL)

	// --- Setup Gin Router ---
	router := gin.Default()
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{"*"}
	config.AllowMethods = []string{"GET", "POST", "OPTIONS"}
	config.AllowHeaders = []string{"Origin", "Content-Type", "Accept"}
	router.Use(cors.New(config))

	// --- Define API Routes ---
	api := router.Group("/api")
	{
		api.GET("/ping", handlePing)
		api.GET("/users", handleGetUsers)
		api.GET("/static-data", handleGetStaticData)

		api.POST("/submit-order", handleSubmitOrder)
		api.POST("/upload-image", handleImageUploadProxy)

		// --- Chat Endpoints ---
		chat := api.Group("/chat")
		{
			chat.GET("/messages", handleGetChatMessages)
			chat.POST("/send", handleSendChatMessage)
			chat.POST("/delete", handleDeleteChatMessage)
			chat.GET("/ws", serveWs)
			// *** ADDED NEW ENDPOINT FOR AUDIO PROXY ***
			chat.GET("/audio/:fileID", handleGetAudioProxy)
		}

		// --- Admin Endpoints ---
		admin := api.Group("/admin")
		{
			admin.POST("/update-formula-report", handleUpdateFormulaReport)
			admin.GET("/revenue-summary", handleGetRevenueSummary)
			admin.GET("/all-orders", handleGetAllOrders)
			admin.POST("/update-sheet", handleAdminUpdateSheet)
			admin.POST("/add-row", handleAdminAddRow)
			admin.POST("/delete-row", handleAdminDeleteRow)
			admin.POST("/clear-cache", handleClearCache)

			// --- *** THIS IS THE NEW LINE YOU NEEDED *** ---
			admin.POST("/update-order", handleAdminUpdateOrder)
		}

		// --- Profile Endpoint ---
		profile := api.Group("/profile")
		{
			profile.POST("/update", handleUpdateProfile)
		}
	}

	// --- Start Server ---
	log.Printf("Starting Go backend server on port %s", port)
	err = router.Run(":" + port)
	if err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
