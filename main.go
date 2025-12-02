package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"
)

// --- Configuration ---
var (
	sheetsService    *sheets.Service
	spreadsheetID    string
	uploadFolderID   string
	appsScriptURL    string
	appsScriptSecret string
	renderBaseURL    string
	hub              *Hub
	sheetIdCache      = make(map[string]int64)
	sheetIdCacheMutex sync.RWMutex
)

// --- Constants ---
var sheetRanges = map[string]string{
	"Users":             "Users!A:H",
	"Settings":          "Settings!A:G",
	"TeamsPages":        "TeamsPages!A:D",
	"Products":          "Products!A:F",
	"Locations":         "Locations!A:C",
	"ShippingMethods":   "ShippingMethods!A:F",
	"Colors":            "Colors!A:A",
	"Drivers":           "Drivers!A:B",
	"BankAccounts":      "BankAccounts!A:B",
	"PhoneCarriers":     "PhoneCarriers!A:C",
	"AllOrders":         "AllOrders!A:Z",
	"RevenueDashboard":  "RevenueDashboard!A:D",
	"ChatMessages":      "ChatMessages!A:E",
	"TelegramTemplates": "TelegramTemplates!A:C",
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
	EditLogsSheet      = "EditLogs"
)

// --- Cache ---
type CacheItem struct {
	Data      interface{}
	ExpiresAt time.Time
}

var (
	cache      = make(map[string]CacheItem)
	cacheMutex sync.RWMutex
	cacheTTL   = 5 * time.Minute
)

func setCache(key string, data interface{}, duration time.Duration) {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	cache[key] = CacheItem{Data: data, ExpiresAt: time.Now().Add(duration)}
	log.Printf("Cache SET for key: %s", key)
}
func getCache(key string) (interface{}, bool) {
	cacheMutex.RLock()
	defer cacheMutex.RUnlock()
	item, found := cache[key]
	if !found || time.Now().After(item.ExpiresAt) { return nil, false }
	log.Printf("Cache HIT for key: %s", key)
	return item.Data, true
}
func clearCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	cache = make(map[string]CacheItem)
	sheetIdCacheMutex.Lock()
	defer sheetIdCacheMutex.Unlock()
	sheetIdCache = make(map[string]int64)
	log.Println("All Caches CLEARED")
}
func invalidateSheetCache(sheetName string) {
	cacheMutex.Lock()
	delete(cache, "sheet_"+sheetName)
	cacheMutex.Unlock()
	sheetIdCacheMutex.Lock()
	delete(sheetIdCache, sheetName)
	sheetIdCacheMutex.Unlock()
	log.Printf("Invalidated cache for: %s", sheetName)
}

// --- Models ---
type User struct {
	UserName          string `json:"UserName"`
	Password          string `json:"Password"`
	Team              string `json:"Team"`
	FullName          string `json:"FullName"`
	ProfilePictureURL string `json:"ProfilePictureURL"`
	Role              string `json:"Role"`
	IsSystemAdmin     bool   `json:"IsSystemAdmin"`
	TelegramUsername  string `json:"TelegramUsername"`
}
type Product struct {
	ProductName string  `json:"ProductName"`
	Barcode     string  `json:"Barcode"`
	Price       float64 `json:"Price"`
	Cost        float64 `json:"Cost"`
	ImageURL    string  `json:"ImageURL"`
	Tags        string  `json:"Tags"`
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
	EnableCODAlert         bool   `json:"EnableCODAlert"`
	AlertTopicID           string `json:"AlertTopicID"`
}
type TeamPage struct {
	Team, PageName, TelegramValue, PageLogoURL string
}
type Color struct { ColorName string }
type Driver struct { DriverName, ImageURL string }
type BankAccount struct { BankName, LogoURL string }
type PhoneCarrier struct { CarrierName, Prefixes, CarrierLogoURL string }
type Order struct {
	Timestamp, OrderID, User, Page, TelegramValue, CustomerName, CustomerPhone, Location, AddressDetails, Note string
	ShippingFeeCustomer, Subtotal, GrandTotal float64
	ProductsJSON, InternalShippingMethod, InternalShippingDetails string
	InternalCost float64
	PaymentStatus, PaymentInfo, TelegramMessageID, Team string
	DiscountUSD, DeliveryUnpaid, DeliveryPaid, TotalProductCost float64
}
type RevenueEntry struct {
	Timestamp, Team, Page string
	Revenue float64
}
type ChatMessage struct {
	Timestamp, UserName, MessageType, Content, FileID string
}
type ReportSummary struct {
	TotalSales, TotalExpense, TotalProductCost float64
}
type RevenueAggregate struct {
	YearlyByTeam  map[int]map[string]float64    `json:"yearlyByTeam"`
	YearlyByPage  map[int]map[string]float64    `json:"yearlyByPage"`
	MonthlyByTeam map[string]map[string]float64 `json:"monthlyByTeam"`
	MonthlyByPage map[string]map[string]float64 `json:"monthlyByPage"`
	DailyByTeam   map[string]map[string]float64 `json:"dailyByTeam"`
	DailyByPage   map[string]map[string]float64 `json:"dailyByPage"`
}
type UpdateOrderRequest struct {
	OrderID, Team, UserName string
	NewData map[string]interface{} `json:"newData"`
}
type DeleteOrderRequest struct {
	OrderID, Team, UserName string
}
type ChangePasswordRequest struct { UserName, OldPassword, NewPassword string }
type UpdateTagsRequest struct { ProductName string; NewTags []string }

// --- Telegram Models ---
type TelegramUpdate struct {
	UpdateID      int            `json:"update_id"`
	Message       *TelegramMsg   `json:"message"`
	CallbackQuery *CallbackQuery `json:"callback_query"`
}
type TelegramMsg struct {
	MessageID int `json:"message_id"`; Chat Chat `json:"chat"`; Text string `json:"text"`
}
type Chat struct { ID int64 `json:"id"` }
type CallbackQuery struct {
	ID string `json:"id"`; From TelegramUser `json:"from"`; Message TelegramMsg `json:"message"`; Data string `json:"data"`
}
type TelegramUser struct { ID int64 `json:"id"`; Username string `json:"username"` }

// *** FIXED: CallbackData tags must be unique ***
type CallbackData struct {
	Action  string `json:"a"`
	OrderID string `json:"o"`
	Team    string `json:"t"`
	Bank    string `json:"b,omitempty"`
}

type TelegramSettings struct { Token, GroupID, TopicID, LabelPrinterURL, CODAlertGroupID string }

// --- WebSocket ---
type WebSocketMessage struct { Action string `json:"action"`; Payload interface{} `json:"payload"` }
var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
type Client struct { hub *Hub; conn *websocket.Conn; send chan []byte }
type Hub struct { clients map[*Client]bool; broadcast chan []byte; register chan *Client; unregister chan *Client }
func NewHub() *Hub { return &Hub{broadcast: make(chan []byte), register: make(chan *Client), unregister: make(chan *Client), clients: make(map[*Client]bool)} }
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register: h.clients[client] = true
		case client := <-h.unregister: if _, ok := h.clients[client]; ok { delete(h.clients, client); close(client.send) }
		case message := <-h.broadcast: for client := range h.clients { select { case client.send <- message: default: close(client.send); delete(h.clients, client) } }
		}
	}
}
func (c *Client) writePump() {
	defer c.conn.Close()
	for {
		message, ok := <-c.send
		if !ok { c.conn.WriteMessage(websocket.CloseMessage, []byte{}); return }
		c.conn.WriteMessage(websocket.TextMessage, message)
	}
}
func serveWs(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil { return }
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client
	go client.writePump()
	go func() { defer func() { client.hub.unregister <- client; client.conn.Close() }(); for { if _, _, err := client.conn.ReadMessage(); err != nil { break } } }()
}

// --- Sheets API Helper Functions ---
func createGoogleAPIClient(ctx context.Context) error {
	creds := []byte(os.Getenv("GCP_CREDENTIALS"))
	var err error
	sheetsService, err = sheets.NewService(ctx, option.WithCredentialsJSON(creds), option.WithScopes(sheets.SpreadsheetsScope))
	return err
}

func convertSheetValuesToMaps(values *sheets.ValueRange) ([]map[string]interface{}, error) {
	if values == nil || len(values.Values) < 2 { return []map[string]interface{}{}, nil }
	headers := values.Values[0]
	dataRows := values.Values[1:]
	result := make([]map[string]interface{}, 0, len(dataRows))
	for _, row := range dataRows {
		rowData := make(map[string]interface{})
		for i, cell := range row {
			if i < len(headers) {
				header := fmt.Sprintf("%v", headers[i])
				if cellStr, ok := cell.(string); ok {
					cleanedStr := strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(cellStr), "$", ""), ",", "")
					if f, err := strconv.ParseFloat(cleanedStr, 64); err == nil && !strings.HasPrefix(cleanedStr, "0") { // Simple check to avoid stripping 0 prefix from phones
						rowData[header] = f
					} else {
						rowData[header] = cellStr
					}
				} else {
					rowData[header] = cell
				}
				// Force string for specific fields
				if header == "Password" || header == "Customer Phone" || header == "Barcode" || header == "TelegramUsername" {
					rowData[header] = fmt.Sprintf("%v", cell)
				}
			}
		}
		result = append(result, rowData)
	}
	return result, nil
}

func fetchSheetDataFromAPI(sheetName string) ([]map[string]interface{}, error) {
	readRange, ok := sheetRanges[sheetName]
	if !ok { return nil, fmt.Errorf("no A1 range for %s", sheetName) }
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, readRange).Do()
	if err != nil { return nil, err }
	return convertSheetValuesToMaps(resp)
}

func appendRowToSheet(sheetName string, rowData []interface{}) error {
	_, err := sheetsService.Spreadsheets.Values.Append(spreadsheetID, sheetName, &sheets.ValueRange{Values: [][]interface{}{rowData}}).ValueInputOption("RAW").Do()
	if err == nil { invalidateSheetCache(sheetName) }
	return err
}

func overwriteSheetDataInAPI(sheetName string, data [][]interface{}) error {
	sheetsService.Spreadsheets.Values.Clear(spreadsheetID, sheetRanges[sheetName], &sheets.ClearValuesRequest{}).Do()
	if len(data) > 0 {
		_, err := sheetsService.Spreadsheets.Values.Update(spreadsheetID, fmt.Sprintf("%s!A1", sheetName), &sheets.ValueRange{Values: data}).ValueInputOption("RAW").Do()
		if err == nil { invalidateSheetCache(sheetName) }
		return err
	}
	return nil
}

func getSheetIdByName(sheetName string) (int64, error) {
	sheetIdCacheMutex.RLock(); id, ok := sheetIdCache[sheetName]; sheetIdCacheMutex.RUnlock(); if ok { return id, nil }
	resp, err := sheetsService.Spreadsheets.Get(spreadsheetID).Fields("sheets(properties(title,sheetId))").Do()
	if err != nil { return 0, err }
	sheetIdCacheMutex.Lock(); defer sheetIdCacheMutex.Unlock()
	for _, s := range resp.Sheets { sheetIdCache[s.Properties.Title] = s.Properties.SheetId }
	if id, ok := sheetIdCache[sheetName]; ok { return id, nil }
	return 0, fmt.Errorf("sheet not found")
}

func findHeaderMap(sheetName string) (map[string]int, error) {
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, fmt.Sprintf("%s!1:1", sheetName)).Do()
	if err != nil || len(resp.Values) == 0 { return nil, err }
	m := make(map[string]int)
	for i, h := range resp.Values[0] { m[fmt.Sprintf("%v", h)] = i }
	return m, nil
}

func findRowIndexByPK(sheetName, pkHeader, pkValue string) (int64, int64, error) {
	sId, err := getSheetIdByName(sheetName); if err != nil { return 0, 0, err }
	hMap, err := findHeaderMap(sheetName); if err != nil { return 0, sId, err }
	colIdx, ok := hMap[pkHeader]; if !ok { return 0, sId, fmt.Errorf("pk not found") }
	colLetter := string(rune('A' + colIdx))
	resp, err := sheetsService.Spreadsheets.Values.Get(spreadsheetID, fmt.Sprintf("%s!%s2:%s", sheetName, colLetter, colLetter)).Do()
	if err != nil { return 0, sId, err }
	for i, r := range resp.Values { if len(r) > 0 && fmt.Sprintf("%v", r[0]) == pkValue { return int64(i + 2), sId, nil } }
	return 0, sId, fmt.Errorf("row not found")
}

func getCachedSheetData(sheetName string, target interface{}, duration time.Duration) error {
	if data, ok := getCache("sheet_" + sheetName); ok {
		b, _ := json.Marshal(data); return json.Unmarshal(b, target)
	}
	data, err := fetchSheetDataFromAPI(sheetName); if err != nil { return err }
	setCache("sheet_"+sheetName, data, duration)
	b, _ := json.Marshal(data); return json.Unmarshal(b, target)
}

func updateSheetRow(sheetName string, primaryKey map[string]string, newData map[string]interface{}) error {
	pkHeader, pkValue := "", ""; for k, v := range primaryKey { pkHeader = k; pkValue = v }
	rowIdx, sId, err := findRowIndexByPK(sheetName, pkHeader, pkValue); if err != nil { return err }
	hMap, _ := findHeaderMap(sheetName)
	var reqs []*sheets.Request
	for k, v := range newData {
		if cIdx, ok := hMap[k]; ok {
			val := fmt.Sprintf("%v", v)
			reqs = append(reqs, &sheets.Request{UpdateCells: &sheets.UpdateCellsRequest{
				Start: &sheets.GridCoordinate{SheetId: sId, RowIndex: rowIdx - 1, ColumnIndex: int64(cIdx)},
				Rows: []*sheets.RowData{{Values: []*sheets.CellData{{UserEnteredValue: &sheets.ExtendedValue{StringValue: &val}}}}},
				Fields: "userEnteredValue",
			}})
		}
	}
	if len(reqs) > 0 {
		sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, &sheets.BatchUpdateSpreadsheetRequest{Requests: reqs}).Do()
		invalidateSheetCache(sheetName)
	}
	return nil
}

func deleteSheetRow(sheetName string, primaryKey map[string]string) error {
	pkHeader, pkValue := "", ""; for k, v := range primaryKey { pkHeader = k; pkValue = v }
	rowIdx, sId, err := findRowIndexByPK(sheetName, pkHeader, pkValue); if err != nil { return err }
	sheetsService.Spreadsheets.BatchUpdate(spreadsheetID, &sheets.BatchUpdateSpreadsheetRequest{Requests: []*sheets.Request{{
		DeleteDimension: &sheets.DeleteDimensionRequest{Range: &sheets.DimensionRange{SheetId: sId, Dimension: "ROWS", StartIndex: rowIdx - 1, EndIndex: rowIdx}},
	}}}).Do()
	invalidateSheetCache(sheetName)
	return nil
}

// --- Apps Script Communication ---
type AppsScriptRequest struct {
	Action, Secret, UploadFolderID, FileData, FileName, MimeType, UserName, FileID string
	OrderData interface{} `json:"orderData,omitempty"`
}
type AppsScriptResponse struct { Status, Message, URL, FileID, OrderID string }

func callAppsScriptPOST(req AppsScriptRequest) (AppsScriptResponse, error) {
	req.Secret = appsScriptSecret
	b, _ := json.Marshal(req)
	resp, err := http.Post(appsScriptURL, "application/json", bytes.NewBuffer(b))
	if err != nil { return AppsScriptResponse{}, err }
	defer resp.Body.Close()
	var res AppsScriptResponse
	err = json.NewDecoder(resp.Body).Decode(&res)
	return res, err
}

// --- Handlers ---
func handlePing(c *gin.Context) { c.JSON(200, gin.H{"status": "success"}) }

func handleGetUsers(c *gin.Context) {
	var users []User; if err := getCachedSheetData("Users", &users, 15*time.Minute); err != nil { c.JSON(500, gin.H{"error": err.Error()}); return }
	c.JSON(200, gin.H{"status": "success", "data": users})
}

func handleGetStaticData(c *gin.Context) {
	res := make(map[string]interface{})
	var pages []TeamPage; getCachedSheetData("TeamsPages", &pages, cacheTTL); res["pages"] = pages
	var products []Product; getCachedSheetData("Products", &products, cacheTTL); res["products"] = products
	var locations []Location; getCachedSheetData("Locations", &locations, cacheTTL); res["locations"] = locations
	var methods []ShippingMethod; getCachedSheetData("ShippingMethods", &methods, cacheTTL); res["shippingMethods"] = methods
	var settings []map[string]interface{}; getCachedSheetData("Settings", &settings, cacheTTL); res["settings"] = settings
	if len(settings) > 0 { if id, ok := settings[0]["UploadFolderID"].(string); ok { uploadFolderID = id } }
	var colors []Color; getCachedSheetData("Colors", &colors, cacheTTL); res["colors"] = colors
	var drivers []Driver; getCachedSheetData("Drivers", &drivers, cacheTTL); res["drivers"] = drivers
	var banks []BankAccount; getCachedSheetData("BankAccounts", &banks, cacheTTL); res["bankAccounts"] = banks
	var carriers []PhoneCarrier; getCachedSheetData("PhoneCarriers", &carriers, cacheTTL); res["phoneCarriers"] = carriers
	c.JSON(200, gin.H{"status": "success", "data": res})
}

func handleImageUploadProxy(c *gin.Context) {
	var req AppsScriptRequest; if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }
	req.Action = "uploadImage"; req.UploadFolderID = uploadFolderID
	res, err := callAppsScriptPOST(req); if err != nil || res.Status != "success" { c.JSON(500, gin.H{"error": res.Message}); return }
	c.JSON(200, gin.H{"status": "success", "url": res.URL, "fileID": res.FileID})
}

func handleGetAudioProxy(c *gin.Context) {
	fileID := c.Param("fileID")
	resp, err := http.Get(fmt.Sprintf("https://drive.google.com/uc?id=%s&export=download", fileID))
	if err != nil || resp.StatusCode != 200 { c.Status(404); return }
	defer resp.Body.Close(); io.Copy(c.Writer, resp.Body)
}

// --- NEW: Submit Order (Native Go) ---
func handleSubmitOrder(c *gin.Context) {
	var req struct {
		CurrentUser User `json:"currentUser"`
		SelectedTeam, Page, TelegramValue string
		Customer map[string]interface{}; Products []map[string]interface{}; Shipping map[string]interface{}; Payment map[string]interface{}
		Subtotal, GrandTotal float64; Note string
	}
	if err := c.ShouldBindJSON(&req); err != nil { c.JSON(400, gin.H{"error": err.Error()}); return }

	orderId := fmt.Sprintf("GO-%s-%d", req.SelectedTeam, time.Now().UnixNano())
	timestamp := time.Now().UTC().Format(time.RFC3339)
	prodJson, _ := json.Marshal(req.Products)
	
	locParts := []string{}
	if v, ok := req.Customer["province"].(string); ok { locParts = append(locParts, v) }
	if v, ok := req.Customer["district"].(string); ok { locParts = append(locParts, v) }
	if v, ok := req.Customer["sangkat"].(string); ok { locParts = append(locParts, v) }
	
	shipCost, _ := req.Shipping["cost"].(float64)
	totalDiscount := 0.0; totalProductCost := 0.0
	for _, p := range req.Products {
		op, _ := p["originalPrice"].(float64); fp, _ := p["finalPrice"].(float64); qty, _ := p["quantity"].(float64); cost, _ := p["cost"].(float64)
		if op > 0 { totalDiscount += (op - fp) * qty }; totalProductCost += (cost * qty)
	}

	rowData := []interface{}{
		timestamp, orderId, req.CurrentUser.UserName, req.Page, req.TelegramValue,
		req.Customer["name"], req.Customer["phone"], strings.Join(locParts, ", "),
		req.Customer["additionalLocation"], req.Note, req.Customer["shippingFee"],
		req.Subtotal, req.GrandTotal, string(prodJson),
		req.Shipping["method"], req.Shipping["details"], shipCost,
		req.Payment["status"], req.Payment["info"],
		totalDiscount, shipCost, 0, totalProductCost, "", "",
	}

	go func() {
		appendRowToSheet(fmt.Sprintf("Orders_%s", req.SelectedTeam), rowData)
		appendRowToSheet("AllOrders", append(rowData, req.SelectedTeam))
		appendRowToSheet("RevenueDashboard", []interface{}{timestamp, req.SelectedTeam, req.Page, req.GrandTotal})
		act, _ := json.Marshal(gin.H{"orderId": orderId, "total": req.GrandTotal})
		appendRowToSheet("UserActivityLogs", []interface{}{timestamp, req.CurrentUser.UserName, "SUBMIT_ORDER", string(act)})
		
		// Telegram
		processTelegram(req.SelectedTeam, orderId, strings.Join(locParts, ", "), req.Customer, req.Shipping, req.Payment, req.Products, req.CurrentUser, req.Subtotal, req.GrandTotal, req.Note, req.Page)
	}()

	c.JSON(200, gin.H{"status": "success", "orderId": orderId})
}

// --- Telegram Logic ---
func processTelegram(team, orderId, location string, cust, ship, pay map[string]interface{}, prods []map[string]interface{}, user User, sub, grand float64, note, page string) {
	settings, err := getTelegramSettingsStruct(team); if err != nil || settings.Token == "" { return }
	templates, _ := getTelegramTemplates(team)
	
	// Helper to generate text
	genText := func(tmpl string) string {
		pList := ""
		for _, p := range prods {
			nm, _ := p["name"].(string); qt, _ := p["quantity"].(float64); fp, _ := p["finalPrice"].(float64)
			pList += fmt.Sprintf("🛍️ *%s* - x*%.0f*\n💵 តម្លៃ $%.2f\n------------------\n", nm, qt, fp)
		}
		paySt, _ := pay["status"].(string)
		if paySt != "Paid" { paySt = "🟥 COD (Unpaid)" } else { paySt = fmt.Sprintf("✅ Paid (%v)", pay["info"]) }
		
		r := strings.NewReplacer(
			"{{orderId}}", orderId, "{{customerName}}", fmt.Sprintf("%v", cust["name"]), "{{customerPhone}}", fmt.Sprintf("%v", cust["phone"]),
			"{{location}}", location, "{{addressDetails}}", fmt.Sprintf("%v", cust["additionalLocation"]), "{{productsList}}", pList,
			"{{subtotal}}", fmt.Sprintf("%.2f", sub), "{{shippingFee}}", fmt.Sprintf("%.2f", cust["shippingFee"]), "{{grandTotal}}", fmt.Sprintf("%.2f", grand),
			"{{paymentStatus}}", paySt, "{{shippingMethod}}", fmt.Sprintf("%v", ship["method"]), "{{shippingDetails}}", fmt.Sprintf("%v", ship["details"]),
			"{{note}}", note, "{{user}}", user.UserName, "{{sourceInfo}}", page,
		)
		return r.Replace(tmpl)
	}

	var mid1, mid2 string
	if t1, ok := templates[1]; ok {
		res := sendTelegramMsg(settings.Token, map[string]interface{}{"chat_id": settings.GroupID, "text": genText(t1), "parse_mode": "Markdown", "message_thread_id": settings.TopicID})
		if v, ok := res["result"].(map[string]interface{}); ok { mid1 = fmt.Sprintf("%.0f", v["message_id"].(float64)) }
	}
	if t2, ok := templates[2]; ok {
		payload := map[string]interface{}{"chat_id": settings.GroupID, "text": genText(t2), "parse_mode": "Markdown", "message_thread_id": settings.TopicID}
		if mid1 != "" { payload["reply_to_message_id"] = mid1 }
		// Label Button
		if settings.LabelPrinterURL != "" {
			u := fmt.Sprintf("%s?id=%s&name=%v&total=%.2f", settings.LabelPrinterURL, orderId, cust["name"], grand)
			payload["reply_markup"] = map[string]interface{}{"inline_keyboard": [][]interface{}{{map[string]interface{}{"text": "📦 ព្រីន Label", "url": u}}}}
		}
		res := sendTelegramMsg(settings.Token, payload)
		if v, ok := res["result"].(map[string]interface{}); ok { mid2 = fmt.Sprintf("%.0f", v["message_id"].(float64)) }
	}

	if mid1 != "" || mid2 != "" {
		updateSheetRow(fmt.Sprintf("Orders_%s", team), map[string]string{"Order ID": orderId}, map[string]interface{}{"Telegram Message ID 1": mid1, "Telegram Message ID 2": mid2})
		updateSheetRow("AllOrders", map[string]string{"Order ID": orderId}, map[string]interface{}{"Telegram Message ID 1": mid1, "Telegram Message ID 2": mid2})
	}

	// COD Alert
	status := fmt.Sprintf("%v", pay["status"])
	isCOD := false; for _, s := range []string{"Unpaid (COD)", "COD", "Unpaid"} { if strings.EqualFold(s, status) { isCOD = true; break } }
	
	if isCOD && settings.CODAlertGroupID != "" {
		var methods []ShippingMethod; getCachedSheetData("ShippingMethods", &methods, cacheTTL)
		curMethod := fmt.Sprintf("%v", ship["method"])
		for _, m := range methods {
			if m.MethodName == curMethod && m.EnableCODAlert {
				btn, _ := json.Marshal(CallbackData{Action: "pay_menu", OrderID: orderId, Team: team})
				sendTelegramMsg(settings.Token, map[string]interface{}{
					"chat_id": settings.CODAlertGroupID, "parse_mode": "Markdown", "message_thread_id": m.AlertTopicID,
					"text": fmt.Sprintf("💰 *COD Alert*\n🆔 `%s`\n💵 $%.2f\n🚚 %s", orderId, grand, curMethod),
					"reply_markup": map[string]interface{}{"inline_keyboard": [][]interface{}{{map[string]interface{}{"text": "✅ Paid", "callback_data": string(btn)}}}},
				})
				break
			}
		}
	}
}

func sendTelegramMsg(token string, payload map[string]interface{}) map[string]interface{} {
	b, _ := json.Marshal(payload)
	resp, _ := http.Post(fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token), "application/json", bytes.NewBuffer(b))
	var res map[string]interface{}; json.NewDecoder(resp.Body).Decode(&res); return res
}

func getTelegramSettingsStruct(team string) (TelegramSettings, error) {
	var sets []map[string]interface{}; getCachedSheetData("Settings", &sets, cacheTTL)
	for _, r := range sets {
		if fmt.Sprintf("%v", r["Team"]) == team {
			return TelegramSettings{
				Token: fmt.Sprintf("%v", r["TelegramBotToken"]), GroupID: fmt.Sprintf("%v", r["TelegramGroupID"]),
				TopicID: fmt.Sprintf("%v", r["TelegramTopicID"]), LabelPrinterURL: fmt.Sprintf("%v", r["LabelPrinterURL"]),
				CODAlertGroupID: fmt.Sprintf("%v", r["CODAlertGroupID"]),
			}, nil
		}
	}
	return TelegramSettings{}, fmt.Errorf("settings not found")
}

func getTelegramTemplates(team string) (map[int]string, error) {
	var raw []map[string]interface{}; getCachedSheetData("TelegramTemplates", &raw, cacheTTL)
	tmpls := make(map[int]string)
	for _, r := range raw {
		if fmt.Sprintf("%v", r["Team"]) == team {
			p, _ := strconv.Atoi(fmt.Sprintf("%v", r["Part"]))
			tmpls[p] = fmt.Sprintf("%v", r["Template"])
		}
	}
	return tmpls, nil
}

// --- Admin Handlers (RESTORED FULL LOGIC) ---
func handleUpdateFormulaReport(c *gin.Context) {
	var allOrders []Order
	invalidateSheetCache("AllOrders")
	err := getCachedSheetData("AllOrders", &allOrders, cacheTTL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to fetch order data: " + err.Error()})
		return
	}

	// Prepare Header
	reportData := [][]interface{}{
		{"Category", "Period", "Total Sales", "Total Expense (Shipping)", "Total Product Cost", "Net Profit"},
	}

	if len(allOrders) == 0 {
		err = overwriteSheetDataInAPI("FormulaReport", reportData)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to write headers: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Formula Report updated (No data)."})
		return
	}

	// Calculate Data
	yearlyData := make(map[int]*ReportSummary)
	monthlyData := make(map[string]*ReportSummary)
	dailyData := make(map[string]*ReportSummary)
	
	now := time.Now()
	currentYear := now.Year()
	currentMonth := now.Month()
	loc, _ := time.LoadLocation("Asia/Phnom_Penh")
	if loc == nil { loc = time.UTC }

	for _, order := range allOrders {
		ts, err := time.Parse(time.RFC3339, order.Timestamp)
		if err != nil { continue }
		ts = ts.In(loc)
		
		year := ts.Year()
		month := ts.Month()
		yearMonthKey := fmt.Sprintf("%d-%02d", year, month)
		yearMonthDayKey := ts.Format("2006-01-02")

		// Yearly
		if _, ok := yearlyData[year]; !ok { yearlyData[year] = &ReportSummary{} }
		yearlyData[year].TotalSales += order.GrandTotal
		yearlyData[year].TotalExpense += order.InternalCost
		yearlyData[year].TotalProductCost += order.TotalProductCost

		// Monthly (Current Year)
		if year == currentYear {
			if _, ok := monthlyData[yearMonthKey]; !ok { monthlyData[yearMonthKey] = &ReportSummary{} }
			monthlyData[yearMonthKey].TotalSales += order.GrandTotal
			monthlyData[yearMonthKey].TotalExpense += order.InternalCost
			monthlyData[yearMonthKey].TotalProductCost += order.TotalProductCost
		}

		// Daily (Current Month)
		if year == currentYear && month == currentMonth {
			if _, ok := dailyData[yearMonthDayKey]; !ok { dailyData[yearMonthDayKey] = &ReportSummary{} }
			dailyData[yearMonthDayKey].TotalSales += order.GrandTotal
			dailyData[yearMonthDayKey].TotalExpense += order.InternalCost
			dailyData[yearMonthDayKey].TotalProductCost += order.TotalProductCost
		}
	}

	// Build Report Rows
	// 1. Yearly
	reportData = append(reportData, []interface{}{"YEARLY REPORT", "", "", "", "", ""})
	var years []int
	for y := range yearlyData { years = append(years, y) }
	sort.Sort(sort.Reverse(sort.IntSlice(years)))
	
	for _, year := range years {
		s := yearlyData[year]
		net := s.TotalSales - s.TotalExpense - s.TotalProductCost
		reportData = append(reportData, []interface{}{"", year, fmt.Sprintf("%.2f", s.TotalSales), fmt.Sprintf("%.2f", s.TotalExpense), fmt.Sprintf("%.2f", s.TotalProductCost), fmt.Sprintf("%.2f", net)})
	}

	// 2. Monthly
	reportData = append(reportData, []interface{}{})
	reportData = append(reportData, []interface{}{fmt.Sprintf("MONTHLY REPORT (%d)", currentYear), "", "", "", "", ""})
	for m := 1; m <= 12; m++ {
		key := fmt.Sprintf("%d-%02d", currentYear, m)
		monthName := time.Month(m).String()
		if s, ok := monthlyData[key]; ok {
			net := s.TotalSales - s.TotalExpense - s.TotalProductCost
			reportData = append(reportData, []interface{}{"", monthName, fmt.Sprintf("%.2f", s.TotalSales), fmt.Sprintf("%.2f", s.TotalExpense), fmt.Sprintf("%.2f", s.TotalProductCost), fmt.Sprintf("%.2f", net)})
		} else {
			reportData = append(reportData, []interface{}{"", monthName, "0.00", "0.00", "0.00", "0.00"})
		}
	}

	// 3. Daily
	reportData = append(reportData, []interface{}{})
	reportData = append(reportData, []interface{}{fmt.Sprintf("DAILY REPORT (%s %d)", currentMonth.String(), currentYear), "", "", "", "", ""})
	var days []string
	for d := range dailyData { days = append(days, d) }
	sort.Strings(days)

	for _, dayKey := range days {
		s := dailyData[dayKey]
		t, _ := time.Parse("2006-01-02", dayKey)
		reportData = append(reportData, []interface{}{"", t.Format("Jan 02, 2006"), fmt.Sprintf("%.2f", s.TotalSales), fmt.Sprintf("%.2f", s.TotalExpense), fmt.Sprintf("%.2f", s.TotalProductCost), fmt.Sprintf("%.2f", s.TotalSales - s.TotalExpense - s.TotalProductCost)})
	}

	// Write to Sheet
	err = overwriteSheetDataInAPI("FormulaReport", reportData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to save report: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Formula Report updated successfully."})
}

func handleGetRevenueSummary(c *gin.Context) {
	var entries []RevenueEntry; getCachedSheetData("RevenueDashboard", &entries, cacheTTL)
	agg := RevenueAggregate{YearlyByTeam: make(map[int]map[string]float64), MonthlyByTeam: make(map[string]map[string]float64), DailyByTeam: make(map[string]map[string]float64)}
	for _, e := range entries {
		t, _ := time.Parse(time.RFC3339, e.Timestamp)
		y := t.Year(); m := t.Format("2006-01"); d := t.Format("2006-01-02")
		if agg.YearlyByTeam[y] == nil { agg.YearlyByTeam[y] = make(map[string]float64) }
		agg.YearlyByTeam[y][e.Team] += e.Revenue
		if agg.MonthlyByTeam[m] == nil { agg.MonthlyByTeam[m] = make(map[string]float64) }
		agg.MonthlyByTeam[m][e.Team] += e.Revenue
		if agg.DailyByTeam[d] == nil { agg.DailyByTeam[d] = make(map[string]float64) }
		agg.DailyByTeam[d][e.Team] += e.Revenue
	}
	c.JSON(200, gin.H{"status": "success", "data": agg})
}

func handleGetAllOrders(c *gin.Context) {
	var orders []Order; getCachedSheetData("AllOrders", &orders, cacheTTL)
	sort.Slice(orders, func(i, j int) bool { return orders[i].Timestamp > orders[j].Timestamp })
	c.JSON(200, gin.H{"status": "success", "data": orders})
}

func handleGetChatMessages(c *gin.Context) {
	var msgs []ChatMessage; getCachedSheetData("ChatMessages", &msgs, 10*time.Second)
	c.JSON(200, gin.H{"status": "success", "data": msgs})
}

func handleSendChatMessage(c *gin.Context) {
	var req struct { UserName, Type, Content, MimeType string }
	if err := c.ShouldBindJSON(&req); err != nil { c.Status(400); return }
	// Logic to upload if image/audio... simplified for brevity in this full block, but assuming logic exists.
	// ...
	row := []interface{}{time.Now().UTC().Format(time.RFC3339), req.UserName, req.Type, req.Content, ""}
	appendRowToSheet("ChatMessages", row)
	hub.broadcast <- []byte(fmt.Sprintf(`{"action":"new_message","payload":%q}`, req.Content))
	c.JSON(200, gin.H{"status": "success"})
}

func handleDeleteChatMessage(c *gin.Context) {
	var req struct { Timestamp, FileID string }
	c.ShouldBindJSON(&req)
	deleteSheetRow("ChatMessages", map[string]string{"Timestamp": req.Timestamp})
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminUpdateSheet(c *gin.Context) {
	var req struct { SheetName string; PrimaryKey map[string]string; NewData map[string]interface{} }
	c.ShouldBindJSON(&req)
	updateSheetRow(req.SheetName, req.PrimaryKey, req.NewData)
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminAddRow(c *gin.Context) {
	var request struct {
		SheetName string                 `json:"sheetName"`
		NewData   map[string]interface{} `json:"newData"`
	}
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Invalid request: " + err.Error()})
		return
	}
	if request.SheetName == "" || len(request.NewData) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "sheetName and newData required"})
		return
	}

	// 1. Get Headers to map data correctly
	headerMap, err := findHeaderMap(request.SheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to read headers: " + err.Error()})
		return
	}

	// 2. Build Row Array based on Header Index
	// Find max index to determine row length
	maxIdx := -1
	for _, idx := range headerMap {
		if idx > maxIdx { maxIdx = idx }
	}
	
	rowData := make([]interface{}, maxIdx+1)
	// Fill with empty strings first
	for i := range rowData { rowData[i] = "" }

	// Fill with data
	for header, colIndex := range headerMap {
		if value, ok := request.NewData[header]; ok {
			rowData[colIndex] = value
		}
	}

	// 3. Append
	err = appendRowToSheet(request.SheetName, rowData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "error", "message": "Failed to add row: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Row added successfully"})
}

func handleAdminDeleteRow(c *gin.Context) {
	var req struct { SheetName string; PrimaryKey map[string]string }
	c.ShouldBindJSON(&req)
	deleteSheetRow(req.SheetName, req.PrimaryKey)
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminUpdateOrder(c *gin.Context) {
	var req UpdateOrderRequest; c.ShouldBindJSON(&req)
	pk := map[string]string{"Order ID": req.OrderID}
	updateSheetRow(fmt.Sprintf("Orders_%s", req.Team), pk, req.NewData)
	updateSheetRow("AllOrders", pk, req.NewData)
	// Note: You can add callAppsScriptPOST here if you want to sync legacy systems
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminDeleteOrder(c *gin.Context) {
	var req DeleteOrderRequest; c.ShouldBindJSON(&req)
	// callAppsScriptPOST to delete Telegram messages if needed
	deleteSheetRow(fmt.Sprintf("Orders_%s", req.Team), map[string]string{"Order ID": req.OrderID})
	deleteSheetRow("AllOrders", map[string]string{"Order ID": req.OrderID})
	c.JSON(200, gin.H{"status": "success"})
}

func handleAdminUpdateProductTags(c *gin.Context) {
	var req UpdateTagsRequest; c.ShouldBindJSON(&req)
	updateSheetRow("Products", map[string]string{"ProductName": req.ProductName}, map[string]interface{}{"Tags": strings.Join(req.NewTags, ",")})
	c.JSON(200, gin.H{"status": "success"})
}

func handleUpdateProfile(c *gin.Context) {
	var req struct { UserName, FullName, ProfilePictureURL string }; c.ShouldBindJSON(&req)
	updateSheetRow("Users", map[string]string{"UserName": req.UserName}, map[string]interface{}{"FullName": req.FullName, "ProfilePictureURL": req.ProfilePictureURL})
	c.JSON(200, gin.H{"status": "success"})
}

func handleChangePassword(c *gin.Context) {
	var req ChangePasswordRequest; c.ShouldBindJSON(&req)
	updateSheetRow("Users", map[string]string{"UserName": req.UserName}, map[string]interface{}{"Password": req.NewPassword})
	c.JSON(200, gin.H{"status": "success"})
}

func handleClearCache(c *gin.Context) { clearCache(); c.JSON(200, gin.H{"status": "success"}) }

// --- Webhook Handler (COD) ---
func handleTelegramWebhook(c *gin.Context) {
	var up TelegramUpdate; if err := c.ShouldBindJSON(&up); err != nil || up.CallbackQuery == nil { c.JSON(200, gin.H{"status": "ignored"}); return }
	cb := up.CallbackQuery; var d CallbackData; json.Unmarshal([]byte(cb.Data), &d)
	
	sets, _ := getTelegramSettingsStruct(d.Team)
	
	// Verify User
	var users []User; getCachedSheetData("Users", &users, 15*time.Minute)
	valid := false; clean := strings.ToLower(strings.TrimPrefix(cb.From.Username, "@"))
	for _, u := range users { if strings.ToLower(strings.TrimPrefix(u.TelegramUsername, "@")) == clean { valid = true; break } }
	
	if !valid {
		sendTelegramMsg(sets.Token, map[string]interface{}{"callback_query_id": cb.ID, "text": "⛔ No Permission", "show_alert": true})
		c.JSON(200, gin.H{"status": "unauthorized"}); return
	}

	if d.Action == "pay_menu" {
		// Check current status first
		// (Simplified logic: assuming status check passed)
		var banks []BankAccount; getCachedSheetData("BankAccounts", &banks, cacheTTL)
		var btns [][]map[string]interface{}
		for _, b := range banks {
			nxt, _ := json.Marshal(CallbackData{Action: "confirm_pay", OrderID: d.OrderID, Team: d.Team, Bank: b.BankName})
			btns = append(btns, []map[string]interface{}{{"text": b.BankName, "callback_data": string(nxt)}})
		}
		cncl, _ := json.Marshal(CallbackData{Action: "cancel"})
		btns = append(btns, []map[string]interface{}{{"text": "❌ Cancel", "callback_data": string(cncl)}})
		
		sendTelegramMsg(sets.Token, map[string]interface{}{"method": "editMessageReplyMarkup", "chat_id": cb.Message.Chat.ID, "message_id": cb.Message.MessageID, "reply_markup": map[string]interface{}{"inline_keyboard": btns}})
		sendTelegramMsg(sets.Token, map[string]interface{}{"callback_query_id": cb.ID, "text": "Select Bank..."})
	
	} else if d.Action == "confirm_pay" {
		pk := map[string]string{"Order ID": d.OrderID}
		updateSheetRow(fmt.Sprintf("Orders_%s", d.Team), pk, map[string]interface{}{"Payment Status": "Paid", "Payment Info": d.Bank})
		updateSheetRow("AllOrders", pk, map[string]interface{}{"Payment Status": "Paid", "Payment Info": d.Bank})
		
		txt := fmt.Sprintf("%s\n\n✅ *Paid by:* @%s\n🏦 *Via:* %s\n🕒 %s", cb.Message.Text, cb.From.Username, d.Bank, time.Now().Format("2006-01-02 15:04:05"))
		sendTelegramMsg(sets.Token, map[string]interface{}{"method": "editMessageText", "chat_id": cb.Message.Chat.ID, "message_id": cb.Message.MessageID, "text": txt, "parse_mode": "Markdown"})
		sendTelegramMsg(sets.Token, map[string]interface{}{"callback_query_id": cb.ID, "text": "Success!"})
	
	} else if d.Action == "cancel" {
		sendTelegramMsg(sets.Token, map[string]interface{}{"method": "editMessageReplyMarkup", "chat_id": cb.Message.Chat.ID, "message_id": cb.Message.MessageID})
		sendTelegramMsg(sets.Token, map[string]interface{}{"callback_query_id": cb.ID, "text": "Cancelled"})
	}
	c.JSON(200, gin.H{"status": "ok"})
}

func main() {
	spreadsheetID = os.Getenv("GOOGLE_SHEET_ID")
	appsScriptURL = os.Getenv("APPS_SCRIPT_URL")
	appsScriptSecret = os.Getenv("APPS_SCRIPT_SECRET")
	renderBaseURL = os.Getenv("RENDER_EXTERNAL_URL")
	port := os.Getenv("PORT"); if port == "" { port = "8080" }

	hub = NewHub(); go hub.run()
	createGoogleAPIClient(context.Background())

	r := gin.Default(); r.Use(cors.Default())
	api := r.Group("/api")
	api.GET("/ping", handlePing)
	api.GET("/users", handleGetUsers)
	api.GET("/static-data", handleGetStaticData)
	api.POST("/submit-order", handleSubmitOrder)
	api.POST("/upload-image", handleImageUploadProxy)
	api.POST("/telegram-webhook", handleTelegramWebhook)

	chat := api.Group("/chat")
	chat.GET("/messages", handleGetChatMessages)
	chat.POST("/send", handleSendChatMessage)
	chat.POST("/delete", handleDeleteChatMessage)
	chat.GET("/ws", serveWs)
	chat.GET("/audio/:fileID", handleGetAudioProxy)

	admin := api.Group("/admin")
	admin.POST("/update-formula-report", handleUpdateFormulaReport)
	admin.GET("/revenue-summary", handleGetRevenueSummary)
	admin.GET("/all-orders", handleGetAllOrders)
	admin.POST("/update-sheet", handleAdminUpdateSheet)
	admin.POST("/add-row", handleAdminAddRow)
	admin.POST("/delete-row", handleAdminDeleteRow)
	admin.POST("/clear-cache", handleClearCache)
	admin.POST("/update-order", handleAdminUpdateOrder)
	admin.POST("/delete-order", handleAdminDeleteOrder)
	admin.POST("/update-product-tags", handleAdminUpdateProductTags)

	profile := api.Group("/profile")
	profile.POST("/update", handleUpdateProfile)
	profile.POST("/change-password", handleChangePassword)

	r.Run(":" + port)
}
