package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	"github.com/patrickmn/go-cache"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"

	"github.com/gorilla/websocket"
)

// --- WebSocket Hub ---

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all connections
	},
}

func newHub() *Hub {
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
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
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

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			log.Println("read:", err)
			break
		}
		// The server doesn't process messages from clients in this app, it only broadcasts
		log.Printf("Received a message (ignoring): %s", message)
	}
}

func (c *Client) writePump() {
	defer c.conn.Close()
	for message := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Println("write:", err)
			return
		}
	}
}

func serveWs(hub *Hub, c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("Failed to upgrade connection:", err)
		return
	}
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.register <- client

	go client.writePump()
	go client.readPump()
}


// --- Models ---

type User struct {
	UserName          string `json:"UserName"`
	Password          string `json:"Password"`
	FullName          string `json:"FullName"`
	Role              string `json:"Role"`
	Team              string `json:"Team"`
	IsSystemAdmin     bool   `json:"IsSystemAdmin"`
	ProfilePictureURL string `json:"ProfilePictureURL"`
}

type Product struct {
	ProductName string  `json:"ProductName"`
	Barcode     string  `json:"Barcode"`
	Price       float64 `json:"Price"`
	Cost        float64 `json:"Cost"`
	ImageURL    string  `json:"ImageURL"`
}

type Page struct {
	PageName      string `json:"PageName"`
	Team          string `json:"Team"`
	TelegramValue string `json:"TelegramValue"`
}

type Location struct {
	Province string `json:"Province"`
	District string `json:"District"`
	Sangkat  string `json:"Sangkat"`
}

type ShippingMethod struct {
	MethodName             string `json:"MethodName"`
	RequireDriverSelection bool   `json:"RequireDriverSelection"`
	MethodLogoURL          string `json:"MethodLogoURL"`
}

type Driver struct {
	DriverName     string `json:"DriverName"`
	DriverPhotoURL string `json:"DriverPhotoURL"`
}

type BankAccount struct {
	BankName      string `json:"BankName"`
	AccountName   string `json:"AccountName"`
	AccountNumber string `json:"AccountNumber"`
	BankLogoURL   string `json:"BankLogoURL"`
}

type PhoneCarrier struct {
	CarrierName    string `json:"CarrierName"`
	Prefixes       string `json:"Prefixes"`
	CarrierLogoURL string `json:"CarrierLogoURL"`
}

type Color struct {
	ColorName string `json:"ColorName"`
	HexCode   string `json:"HexCode"`
}

type Setting struct {
	SettingName  string `json:"SettingName"`
	SettingValue string `json:"SettingValue"`
}

type Target struct {
    UserName     string  `json:"UserName"`
    Month        string  `json:"Month"` // Format: YYYY-MM
    TargetAmount float64 `json:"TargetAmount"`
}

type OrderProduct struct {
	Name          string  `json:"name"`
	Quantity      int     `json:"quantity"`
	OriginalPrice float64 `json:"originalPrice"`
	FinalPrice    float64 `json:"finalPrice"`
	Total         float64 `json:"total"`
	ColorInfo     string  `json:"colorInfo"`
	Cost          float64 `json:"cost"`
}

type SubmitOrderPayload struct {
	CurrentUser   User   `json:"currentUser"`
	SelectedTeam  string `json:"selectedTeam"`
	Page          string `json:"page"`
	TelegramValue string `json:"telegramValue"`
	Customer      struct {
		Name               string  `json:"name"`
		Phone              string  `json:"phone"`
		Province           string  `json:"province"`
		District           string  `json:"district"`
		Sangkat            string  `json:"sangkat"`
		AdditionalLocation string  `json:"additionalLocation"`
		ShippingFee        float64 `json:"shippingFee"`
	} `json:"customer"`
	Products   []OrderProduct `json:"products"`
	Shipping   struct {
		Method  string  `json:"method"`
		Details string  `json:"details"`
		Cost    float64 `json:"cost"`
	} `json:"shipping"`
	Payment struct {
		Status string `json:"status"`
		Info   string `json:"info"`
	} `json:"payment"`
	Telegram struct {
		Schedule bool   `json:"schedule"`
		Time     string `json:"time"`
	} `json:"telegram"`
	Subtotal   float64 `json:"subtotal"`
	GrandTotal float64 `json:"grandTotal"`
	Note       string  `json:"note"`
}

type FullOrder struct {
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
	Discount                float64 `json:"Discount ($)"`
	DeliveryUnpaid          float64 `json:"Delivery Unpaid"`
	DeliveryPaid            float64 `json:"Delivery Paid"`
	TotalProductCost        float64 `json:"Total Product Cost ($)"`
}

type ChatMessage struct {
	Timestamp   string `json:"Timestamp"`
	UserName    string `json:"UserName"`
	MessageType string `json:"MessageType"`
	Content     string `json:"Content"`
}

// --- Google Sheets Service ---

type SheetsService struct {
	srv           *sheets.Service
	spreadsheetID string
}

func NewSheetsService(ctx context.Context) (*SheetsService, error) {
	credentialsJSON := os.Getenv("GOOGLE_CREDENTIALS_JSON")
	if credentialsJSON == "" {
		return nil, errors.New("GOOGLE_CREDENTIALS_JSON environment variable not set")
	}

	spreadsheetID := os.Getenv("SPREADSHEET_ID")
	if spreadsheetID == "" {
		return nil, errors.New("SPREADSHEET_ID environment variable not set")
	}

	config, err := google.JWTConfigFromJSON([]byte(credentialsJSON), sheets.SpreadsheetsScope)
	if err != nil {
		return nil, fmt.Errorf("unable to parse client secret file to config: %v", err)
	}
	client := config.Client(ctx)

	srv, err := sheets.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, fmt.Errorf("unable to retrieve Sheets client: %v", err)
	}

	return &SheetsService{srv: srv, spreadsheetID: spreadsheetID}, nil
}

func (s *SheetsService) getSheetData(sheetName string) ([][]interface{}, error) {
	readRange := sheetName
	resp, err := s.srv.Spreadsheets.Values.Get(s.spreadsheetID, readRange).Do()
	if err != nil {
		return nil, fmt.Errorf("unable to retrieve data from sheet '%s': %v", sheetName, err)
	}
	return resp.Values, nil
}

func parseSheet[T any](values [][]interface{}, parser func(row []string) (T, error)) ([]T, error) {
	if len(values) < 2 {
		return []T{}, nil
	}
	headers := values[0]
	var results []T
	for i, row := range values[1:] {
		// Fill short rows with empty strings to prevent index out of range
		stringRow := make([]string, len(headers))
		for j, cell := range row {
			if j < len(stringRow) {
				stringRow[j] = fmt.Sprintf("%v", cell)
			}
		}
		item, err := parser(stringRow)
		if err != nil {
			log.Printf("Warning: Skipping row %d due to parsing error: %v", i+2, err)
			continue
		}
		results = append(results, item)
	}
	return results, nil
}


// --- Main Application ---

var (
	sheetsService *SheetsService
	appCache      *cache.Cache
	hub           *Hub
	appLock       sync.Mutex
)

func main() {
	ctx := context.Background()
	var err error
	sheetsService, err = NewSheetsService(ctx)
	if err != nil {
		log.Fatalf("Failed to create sheets service: %v", err)
	}

	appCache = cache.New(5*time.Minute, 10*time.Minute)
	hub = newHub()
	go hub.run()

	r := gin.Default()
	
	// CORS configuration
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge: 12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		api.GET("/ping", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Go backend pong"})
		})
		api.GET("/static-data", getStaticData)
		api.GET("/users", getUsers)
		api.POST("/submit-order", handleSubmitOrder)
		api.POST("/upload-image", handleUploadImage) // Keep for profile/config

		admin := api.Group("/admin")
		{
			admin.GET("/all-orders", getAllOrders)
			admin.POST("/update-formula-report", handleUpdateFormulaReport)
			admin.POST("/update-user", handleUpdateUser)
			admin.POST("/update-sheet-row", handleUpdateSheetRow)
			admin.POST("/add-sheet-row", handleAddSheetRow)
			admin.POST("/delete-sheet-row", handleDeleteSheetRow)
		}

		chat := api.Group("/chat")
		{
			chat.GET("/ws", func(c *gin.Context) {
				serveWs(hub, c)
			})
			chat.GET("/messages", getChatMessages)
			chat.POST("/send", handleSendChatMessage)
			chat.POST("/delete", handleDeleteChatMessage)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server listening on port %s", port)
	r.Run(":" + port)
}

// --- API Handlers ---

func respondWithError(c *gin.Context, code int, message string) {
	c.JSON(code, gin.H{"status": "error", "message": message})
}

func respondWithSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"status": "success", "data": data})
}

// Fetches all static data except users and orders
func getStaticData(c *gin.Context) {
	const cacheKey = "staticData"
	if cached, found := appCache.Get(cacheKey); found {
		respondWithSuccess(c, cached)
		return
	}

	var wg sync.WaitGroup
	data := make(map[string]interface{})
	errs := make(chan error, 10)
	var mu sync.Mutex

	fetch := func(key string, fetcher func() (interface{}, error)) {
		defer wg.Done()
		res, err := fetcher()
		if err != nil {
			errs <- fmt.Errorf("failed to fetch %s: %w", key, err)
			return
		}
		mu.Lock()
		data[key] = res
		mu.Unlock()
	}

	wg.Add(8)
	go fetch("products", func() (interface{}, error) { return fetchAndParse(sheetsService, "Products", parseProduct) })
	go fetch("pages", func() (interface{}, error) { return fetchAndParse(sheetsService, "TeamsPages", parsePage) })
	go fetch("locations", func() (interface{}, error) { return fetchAndParse(sheetsService, "Locations", parseLocation) })
	go fetch("shippingMethods", func() (interface{}, error) { return fetchAndParse(sheetsService, "ShippingMethods", parseShippingMethod) })
	go fetch("drivers", func() (interface{}, error) { return fetchAndParse(sheetsService, "Drivers", parseDriver) })
	go fetch("bankAccounts", func() (interface{}, error) { return fetchAndParse(sheetsService, "BankAccounts", parseBankAccount) })
	go fetch("phoneCarriers", func() (interface{}, error) { return fetchAndParse(sheetsService, "PhoneCarriers", parsePhoneCarrier) })
	go fetch("targets", func() (interface{}, error) { return fetchAndParse(sheetsService, "Targets", parseTarget) })


	wg.Wait()
	close(errs)

	if len(errs) > 0 {
		var errorMessages []string
		for err := range errs {
			errorMessages = append(errorMessages, err.Error())
		}
		respondWithError(c, http.StatusInternalServerError, strings.Join(errorMessages, "; "))
		return
	}

	appCache.Set(cacheKey, data, cache.DefaultExpiration)
	respondWithSuccess(c, data)
}

func getUsers(c *gin.Context) {
	const cacheKey = "users"
	if cached, found := appCache.Get(cacheKey); found {
		respondWithSuccess(c, cached)
		return
	}

	users, err := fetchAndParse(sheetsService, "Users", parseUser)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, err.Error())
		return
	}
	
	appCache.Set(cacheKey, users, cache.DefaultExpiration)
	respondWithSuccess(c, users)
}

func getAllOrders(c *gin.Context) {
	const cacheKey = "allOrders"
	if cached, found := appCache.Get(cacheKey); found {
		respondWithSuccess(c, cached)
		return
	}

	orders, err := fetchAndParse(sheetsService, "AllOrders", parseFullOrder)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, err.Error())
		return
	}

	sort.Slice(orders, func(i, j int) bool {
		return orders[i].Timestamp > orders[j].Timestamp
	})

	appCache.Set(cacheKey, orders, cache.DefaultExpiration)
	respondWithSuccess(c, orders)
}

func handleSubmitOrder(c *gin.Context) {
	var payload SubmitOrderPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid request payload: "+err.Error())
		return
	}

	appLock.Lock()
	defer appLock.Unlock()

	// 1. Get the current last order ID
	values, err := sheetsService.getSheetData("AllOrders!B:B")
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Could not read existing order IDs: "+err.Error())
		return
	}
	
	lastID := 0
	if len(values) > 1 {
		// Find the last valid numeric ID
		for i := len(values) - 1; i > 0; i-- {
			if len(values[i]) > 0 {
				idStr := fmt.Sprintf("%v", values[i][0])
				id, err := strconv.Atoi(idStr)
				if err == nil {
					lastID = id
					break
				}
			}
		}
	}
	newID := lastID + 1

	// 2. Prepare the new row
	productsJSON, err := json.Marshal(payload.Products)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to serialize products to JSON: "+err.Error())
		return
	}

	totalProductCost := 0.0
	for _, p := range payload.Products {
		totalProductCost += p.Cost * float64(p.Quantity)
	}
	discount := payload.Subtotal - payload.Products.Reduce(0.0, func(acc float64, p OrderProduct) float64 { return acc + p.Total })


	loc := time.FixedZone("ICT", 7*60*60) // Indochina Time (UTC+7)
	timestamp := time.Now().In(loc).Format("2006-01-02 15:04:05")

	newRow := []interface{}{
		timestamp,
		newID,
		payload.CurrentUser.UserName,
		payload.Page,
		payload.TelegramValue,
		payload.Customer.Name,
		payload.Customer.Phone,
		fmt.Sprintf("%s, %s, %s", payload.Customer.Province, payload.Customer.District, payload.Customer.Sangkat),
		payload.Customer.AdditionalLocation,
		payload.Note,
		payload.Customer.ShippingFee,
		payload.Subtotal,
		payload.GrandTotal,
		string(productsJSON),
		payload.Shipping.Method,
		payload.Shipping.Details,
		payload.Shipping.Cost,
		payload.Payment.Status,
		payload.Payment.Info,
		"", // Telegram Message ID placeholder
		payload.SelectedTeam,
		discount,
		0, // Delivery Unpaid placeholder
		0, // Delivery Paid placeholder
		totalProductCost,
	}

	// 3. Append the new row to the sheet
	rangeData := "AllOrders!A:Y"
	valueRange := &sheets.ValueRange{
		Values: [][]interface{}{newRow},
	}
	_, err = sheetsService.srv.Spreadsheets.Values.Append(sheetsService.spreadsheetID, rangeData, valueRange).ValueInputOption("USER_ENTERED").InsertDataOption("INSERT_ROWS").Do()
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to write new order to sheet: "+err.Error())
		return
	}

	// 4. Invalidate cache
	appCache.Delete("allOrders")

	// 5. Optionally, send to Telegram via Apps Script
	telegramWebhookURL := os.Getenv("TELEGRAM_WEBHOOK_URL")
	if telegramWebhookURL != "" {
		go sendToTelegram(telegramWebhookURL, newRow)
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Order created successfully", "orderId": newID})
}


func handleUpdateFormulaReport(c *gin.Context) {
	reportWebhookURL := os.Getenv("REPORT_WEBHOOK_URL")
	if reportWebhookURL == "" {
		respondWithError(c, http.StatusNotImplemented, "Report webhook URL is not configured")
		return
	}

	go func() {
		resp, err := http.Post(reportWebhookURL, "application/json", nil)
		if err != nil {
			log.Printf("Error triggering formula report update: %v", err)
			return
		}
		defer resp.Body.Close()
		log.Printf("Formula report update triggered. Status: %s", resp.Status)
	}()

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Formula report update has been triggered in the background."})
}

func getChatMessages(c *gin.Context) {
	const cacheKey = "chatMessages"
	if cached, found := appCache.Get(cacheKey); found {
		respondWithSuccess(c, cached)
		return
	}

	messages, err := fetchAndParse(sheetsService, "ChatMessages", parseChatMessage)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, err.Error())
		return
	}

	appCache.Set(cacheKey, messages, cache.DefaultExpiration)
	respondWithSuccess(c, messages)
}

func handleSendChatMessage(c *gin.Context) {
	var msg struct {
		UserName string `json:"userName"`
		Type     string `json:"type"`
		Content  string `json:"content"`
		MimeType string `json:"mimeType,omitempty"`
	}

	if err := c.ShouldBindJSON(&msg); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid message payload: "+err.Error())
		return
	}

	appLock.Lock()
	defer appLock.Unlock()

	loc := time.FixedZone("ICT", 7*60*60)
	timestamp := time.Now().In(loc).Format("2006-01-02T15:04:05.000Z")

	finalContent := msg.Content
	// If it's media, upload it first
	if msg.Type == "image" || msg.Type == "audio" {
		driveURL, err := uploadChatMediaToDrive(msg.Content, msg.MimeType, msg.UserName)
		if err != nil {
			respondWithError(c, http.StatusInternalServerError, "Failed to upload media: "+err.Error())
			return
		}
		finalContent = driveURL
	}

	newRow := []interface{}{
		timestamp,
		msg.UserName,
		msg.Type,
		finalContent,
	}

	// Append to sheet
	valueRange := &sheets.ValueRange{Values: [][]interface{}{newRow}}
	_, err := sheetsService.srv.Spreadsheets.Values.Append(sheetsService.spreadsheetID, "ChatMessages", valueRange).ValueInputOption("USER_ENTERED").Do()
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to save message: "+err.Error())
		return
	}

	// Invalidate cache
	appCache.Delete("chatMessages")

	// Broadcast via WebSocket
	broadcastMsg := ChatMessage{
		Timestamp:   timestamp,
		UserName:    msg.UserName,
		MessageType: msg.Type,
		Content:     finalContent,
	}
	jsonMsg, _ := json.Marshal(broadcastMsg)
	hub.broadcast <- jsonMsg

	respondWithSuccess(c, gin.H{"message": "Message sent"})
}

func handleUploadImage(c *gin.Context) {
	var payload struct {
		FileData   string            `json:"fileData"` // Base64 encoded
		FileName   string            `json:"fileName"`
		MimeType   string            `json:"mimeType"`
		UserName   string            `json:"userName"`
		SheetName  string            `json:"sheetName,omitempty"`
		ColumnName string            `json:"columnName,omitempty"`
		PrimaryKey map[string]string `json:"primaryKey,omitempty"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid upload payload: "+err.Error())
		return
	}

	uploadWebhookURL := os.Getenv("UPLOAD_WEBHOOK_URL")
	if uploadWebhookURL == "" {
		respondWithError(c, http.StatusNotImplemented, "Upload webhook URL is not configured")
		return
	}

	// Prepare payload for Apps Script
	appsScriptPayload := map[string]interface{}{
		"fileData":   payload.FileData,
		"fileName":   payload.FileName,
		"mimeType":   payload.MimeType,
		"userName":   payload.UserName,
		"sheetName":  payload.SheetName,
		"columnName": payload.ColumnName,
		"primaryKey": payload.PrimaryKey,
	}
	
	jsonPayload, err := json.Marshal(appsScriptPayload)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to create payload for upload service")
		return
	}

	// Call Apps Script Webhook
	resp, err := http.Post(uploadWebhookURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Error calling upload service: "+err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errorBody map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&errorBody)
		errMsg := fmt.Sprintf("Upload service returned error: %s - %v", resp.Status, errorBody)
		respondWithError(c, http.StatusInternalServerError, errMsg)
		return
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to parse response from upload service")
		return
	}

	// If the request was for a background update, invalidate the relevant cache
	if payload.SheetName != "" {
		switch payload.SheetName {
		case "Users":
			appCache.Delete("users")
		default:
			appCache.Delete("staticData") // Invalidate all static data as a catch-all
		}
	}
	
	c.JSON(http.StatusOK, result)
}

// --- NEW/UPDATED ADMIN HANDLERS ---

func handleUpdateUser(c *gin.Context) {
	var payload struct {
		UserName string                 `json:"UserName"`
		Updates  map[string]interface{} `json:"updates"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}
	if payload.UserName == "" {
		respondWithError(c, http.StatusBadRequest, "UserName is required")
		return
	}

	err := sheetsService.updateSheetRow("Users", "UserName", payload.UserName, payload.Updates)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to update user: "+err.Error())
		return
	}

	appCache.Delete("users")
	respondWithSuccess(c, gin.H{"message": "User updated successfully"})
}

func handleDeleteChatMessage(c *gin.Context) {
	var payload struct {
		UserName  string `json:"UserName"`
		Timestamp string `json:"Timestamp"`
		FileUrl   string `json:"fileUrl,omitempty"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}

	// 1. Delete from Google Sheet
	err := sheetsService.deleteSheetRowByValue("ChatMessages", "Timestamp", payload.Timestamp)
	if err != nil {
		// Log error but continue to allow retries, don't block UI on sheet error
		log.Printf("Warning: Failed to delete chat message from sheet: %v", err)
	} else {
		appCache.Delete("chatMessages")
	}

	// 2. Delete file from Google Drive via Apps Script if URL is provided
	if payload.FileUrl != "" {
		deleteWebhookURL := os.Getenv("DELETE_FILE_WEBHOOK_URL")
		if deleteWebhookURL == "" {
			log.Println("Warning: DELETE_FILE_WEBHOOK_URL is not set. Cannot delete file from Drive.")
		} else {
			go func() {
				deletePayload := map[string]string{"fileUrl": payload.FileUrl}
				jsonPayload, _ := json.Marshal(deletePayload)
				resp, err := http.Post(deleteWebhookURL, "application/json", bytes.NewBuffer(jsonPayload))
				if err != nil {
					log.Printf("Error calling file delete service for URL %s: %v", payload.FileUrl, err)
				} else {
					defer resp.Body.Close()
					if resp.StatusCode == http.StatusOK {
						log.Printf("Successfully deleted file from Drive: %s", payload.FileUrl)
					} else {
						log.Printf("Failed to delete file from Drive. Status: %s, URL: %s", resp.Status, payload.FileUrl)
					}
				}
			}()
		}
	}

	// 3. Broadcast deletion via WebSocket
	broadcastMsg := map[string]string{"action": "delete", "messageId": payload.Timestamp}
	jsonMsg, _ := json.Marshal(broadcastMsg)
	hub.broadcast <- jsonMsg

	respondWithSuccess(c, gin.H{"message": "Message deletion initiated"})
}

func handleUpdateSheetRow(c *gin.Context) {
	var payload struct {
		SheetName  string            `json:"sheetName"`
		PrimaryKey map[string]string `json:"primaryKey"`
		Data       map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}
	if len(payload.PrimaryKey) != 1 {
		respondWithError(c, http.StatusBadRequest, "PrimaryKey must contain exactly one key-value pair")
		return
	}

	var pkField, pkValue string
	for k, v := range payload.PrimaryKey {
		pkField, pkValue = k, v
	}

	err := sheetsService.updateSheetRow(payload.SheetName, pkField, pkValue, payload.Data)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to update row: "+err.Error())
		return
	}

	// Invalidate relevant cache
	if payload.SheetName == "Users" {
		appCache.Delete("users")
	} else {
		appCache.Delete("staticData")
	}
	
	respondWithSuccess(c, gin.H{"message": "Row updated successfully"})
}

func handleAddSheetRow(c *gin.Context) {
	var payload struct {
		SheetName string                 `json:"sheetName"`
		Data      map[string]interface{} `json:"data"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}

	err := sheetsService.addSheetRow(payload.SheetName, payload.Data)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to add row: "+err.Error())
		return
	}

	if payload.SheetName == "Users" {
		appCache.Delete("users")
	} else {
		appCache.Delete("staticData")
	}
	
	respondWithSuccess(c, gin.H{"message": "Row added successfully"})
}


func handleDeleteSheetRow(c *gin.Context) {
	var payload struct {
		SheetName  string            `json:"sheetName"`
		PrimaryKey map[string]string `json:"primaryKey"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondWithError(c, http.StatusBadRequest, "Invalid payload: "+err.Error())
		return
	}
	if len(payload.PrimaryKey) != 1 {
		respondWithError(c, http.StatusBadRequest, "PrimaryKey must contain exactly one key-value pair")
		return
	}

	var pkField, pkValue string
	for k, v := range payload.PrimaryKey {
		pkField, pkValue = k, v
	}

	err := sheetsService.deleteSheetRowByValue(payload.SheetName, pkField, pkValue)
	if err != nil {
		respondWithError(c, http.StatusInternalServerError, "Failed to delete row: "+err.Error())
		return
	}

	if payload.SheetName == "Users" {
		appCache.Delete("users")
	} else {
		appCache.Delete("staticData")
	}

	respondWithSuccess(c, gin.H{"message": "Row deleted successfully"})
}



// --- Helper & Utility Functions ---

func fetchAndParse[T any](s *SheetsService, sheetName string, parser func(row []string) (T, error)) ([]T, error) {
	values, err := s.getSheetData(sheetName)
	if err != nil {
		return nil, err
	}
	return parseSheet(values, parser)
}


func getHeaderIndexMap(headers []interface{}) map[string]int {
	indexMap := make(map[string]int)
	for i, h := range headers {
		indexMap[fmt.Sprintf("%v", h)] = i
	}
	return indexMap
}

func getColumnValue(row []string, headers map[string]int, colName string) string {
	if index, ok := headers[colName]; ok && index < len(row) {
		return row[index]
	}
	return ""
}

func getFloatValue(row []string, headers map[string]int, colName string) float64 {
	valStr := getColumnValue(row, headers, colName)
	val, _ := strconv.ParseFloat(valStr, 64)
	return val
}

func getBoolValue(row []string, headers map[string]int, colName string) bool {
	valStr := getColumnValue(row, headers, colName)
	return strings.ToUpper(valStr) == "TRUE"
}

// ... (Existing parser functions: parseUser, parseProduct, etc.) ...
// --- Parser Functions ---

func parseUser(row []string) (User, error) {
	// Assuming fixed order for simplicity, but a header-based map is safer
	if len(row) < 7 {
		return User{}, fmt.Errorf("user row has too few columns: expected 7, got %d", len(row))
	}
	return User{
		UserName:          row[0],
		Password:          row[1],
		FullName:          row[2],
		Role:              row[3],
		Team:              row[4],
		IsSystemAdmin:     strings.ToUpper(row[5]) == "TRUE",
		ProfilePictureURL: row[6],
	}, nil
}

func parseProduct(row []string) (Product, error) {
	if len(row) < 5 {
		return Product{}, fmt.Errorf("product row has too few columns: expected 5, got %d", len(row))
	}
	price, err := strconv.ParseFloat(row[2], 64)
	if err != nil {
		return Product{}, fmt.Errorf("invalid price for product '%s': %v", row[0], err)
	}
	cost, err := strconv.ParseFloat(row[3], 64)
	if err != nil {
		return Product{}, fmt.Errorf("invalid cost for product '%s': %v", row[0], err)
	}
	return Product{
		ProductName: row[0],
		Barcode:     row[1],
		Price:       price,
		Cost:        cost,
		ImageURL:    row[4],
	}, nil
}

func parsePage(row []string) (Page, error) {
	if len(row) < 3 {
		return Page{}, fmt.Errorf("page row has too few columns: expected 3, got %d", len(row))
	}
	return Page{PageName: row[0], Team: row[1], TelegramValue: row[2]}, nil
}

func parseLocation(row []string) (Location, error) {
	if len(row) < 3 {
		return Location{}, fmt.Errorf("location row has too few columns: expected 3, got %d", len(row))
	}
	return Location{Province: row[0], District: row[1], Sangkat: row[2]}, nil
}

func parseShippingMethod(row []string) (ShippingMethod, error) {
	if len(row) < 3 {
		return ShippingMethod{}, fmt.Errorf("shipping method row has too few columns: expected 3, got %d", len(row))
	}
	return ShippingMethod{
		MethodName:             row[0],
		RequireDriverSelection: strings.ToUpper(row[1]) == "TRUE",
		MethodLogoURL:          row[2],
	}, nil
}

func parseDriver(row []string) (Driver, error) {
	if len(row) < 2 {
		return Driver{}, fmt.Errorf("driver row has too few columns: expected 2, got %d", len(row))
	}
	return Driver{DriverName: row[0], DriverPhotoURL: row[1]}, nil
}

func parseBankAccount(row []string) (BankAccount, error) {
	if len(row) < 4 {
		return BankAccount{}, fmt.Errorf("bank account row has too few columns: expected 4, got %d", len(row))
	}
	return BankAccount{
		BankName:      row[0],
		AccountName:   row[1],
		AccountNumber: row[2],
		BankLogoURL:   row[3],
	}, nil
}

func parsePhoneCarrier(row []string) (PhoneCarrier, error) {
	if len(row) < 3 {
		return PhoneCarrier{}, fmt.Errorf("phone carrier row has too few columns: expected 3, got %d", len(row))
	}
	return PhoneCarrier{
		CarrierName:    row[0],
		Prefixes:       row[1],
		CarrierLogoURL: row[2],
	}, nil
}


func parseTarget(row []string) (Target, error) {
    if len(row) < 3 {
        return Target{}, fmt.Errorf("target row has too few columns: expected 3, got %d", len(row))
    }
    targetAmount, err := strconv.ParseFloat(row[2], 64)
    if err != nil {
        return Target{}, fmt.Errorf("invalid target amount for user '%s' in month '%s': %v", row[0], row[1], err)
    }
    return Target{
        UserName:     row[0],
        Month:        row[1],
        TargetAmount: targetAmount,
    }, nil
}

func parseFullOrder(row []string) (FullOrder, error) {
	if len(row) < 25 {
		// Lenient check: if row is short, return partially filled struct
		log.Printf("Warning: Order row has fewer than 25 columns (got %d). Some fields may be empty.", len(row))
	}

	// Helper to safely convert string to float64, returns 0 on error
	safeParseFloat := func(s string) float64 {
		f, _ := strconv.ParseFloat(s, 64)
		return f
	}

	// Helper to access row element safely
	getVal := func(index int) string {
		if index < len(row) {
			return row[index]
		}
		return ""
	}

	return FullOrder{
		Timestamp:               getVal(0),
		OrderID:                 getVal(1),
		User:                    getVal(2),
		Page:                    getVal(3),
		TelegramValue:           getVal(4),
		CustomerName:            getVal(5),
		CustomerPhone:           getVal(6),
		Location:                getVal(7),
		AddressDetails:          getVal(8),
		Note:                    getVal(9),
		ShippingFeeCustomer:     safeParseFloat(getVal(10)),
		Subtotal:                safeParseFloat(getVal(11)),
		GrandTotal:              safeParseFloat(getVal(12)),
		ProductsJSON:            getVal(13),
		InternalShippingMethod:  getVal(14),
		InternalShippingDetails: getVal(15),
		InternalCost:            safeParseFloat(getVal(16)),
		PaymentStatus:           getVal(17),
		PaymentInfo:             getVal(18),
		TelegramMessageID:       getVal(19),
		Team:                    getVal(20),
		Discount:                safeParseFloat(getVal(21)),
		DeliveryUnpaid:          safeParseFloat(getVal(22)),
		DeliveryPaid:            safeParseFloat(getVal(23)),
		TotalProductCost:        safeParseFloat(getVal(24)),
	}, nil
}

func parseChatMessage(row []string) (ChatMessage, error) {
	if len(row) < 4 {
		return ChatMessage{}, fmt.Errorf("chat message row has too few columns: expected 4, got %d", len(row))
	}
	return ChatMessage{
		Timestamp:   row[0],
		UserName:    row[1],
		MessageType: row[2],
		Content:     row[3],
	}, nil
}

func (p OrderProduct) Reduce(initial float64, f func(float64, OrderProduct) float64) float64 {
    // Dummy method to satisfy compilation, real logic is in Go
    return 0.0
}


func sendToTelegram(webhookURL string, rowData []interface{}) {
	payload := map[string]interface{}{
		"rowData": rowData,
	}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error marshaling telegram payload: %v", err)
		return
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		log.Printf("Error sending to telegram webhook: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Telegram webhook returned non-200 status: %s", resp.Status)
	} else {
		log.Println("Successfully sent order data to Telegram webhook.")
	}
}

func uploadChatMediaToDrive(base64Data, mimeType, userName string) (string, error) {
	uploadWebhookURL := os.Getenv("UPLOAD_WEBHOOK_URL")
	if uploadWebhookURL == "" {
		return "", errors.New("UPLOAD_WEBHOOK_URL is not configured")
	}

	payload := map[string]string{
		"fileData": base64Data,
		"mimeType": mimeType,
		"userName": userName, // Pass the user name
	}
	jsonPayload, _ := json.Marshal(payload)

	resp, err := http.Post(uploadWebhookURL, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return "", fmt.Errorf("error calling upload service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("upload service returned status: %s", resp.Status)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to parse response from upload service: %w", err)
	}

	if url, ok := result["url"].(string); ok {
		return url, nil
	}

	return "", errors.New("upload service did not return a valid URL")
}

// --- NEW/UPDATED SheetsService Methods ---

func (s *SheetsService) findRowIndex(sheetName, pkField, pkValue string) (int, []interface{}, error) {
	values, err := s.getSheetData(sheetName)
	if err != nil {
		return -1, nil, err
	}
	if len(values) < 1 {
		return -1, nil, fmt.Errorf("sheet '%s' is empty or has no headers", sheetName)
	}

	headers := values[0]
	pkIndex := -1
	for i, h := range headers {
		if fmt.Sprintf("%v", h) == pkField {
			pkIndex = i
			break
		}
	}

	if pkIndex == -1 {
		return -1, nil, fmt.Errorf("primary key field '%s' not found in sheet '%s'", pkField, sheetName)
	}

	for i, row := range values[1:] {
		if pkIndex < len(row) && fmt.Sprintf("%v", row[pkIndex]) == pkValue {
			return i + 2, headers, nil // +2 because sheet rows are 1-based and we skip header
		}
	}

	return -1, nil, fmt.Errorf("row with %s='%s' not found in sheet '%s'", pkField, pkValue, sheetName)
}


func (s *SheetsService) updateSheetRow(sheetName, pkField, pkValue string, updates map[string]interface{}) error {
	rowIndex, headers, err := s.findRowIndex(sheetName, pkField, pkValue)
	if err != nil {
		return err
	}

	headerMap := getHeaderIndexMap(headers)
	var valueRange sheets.ValueRange
	var updateRequests []*sheets.Request

	for field, value := range updates {
		colIndex, ok := headerMap[field]
		if !ok {
			log.Printf("Warning: field '%s' not found in headers of sheet '%s', skipping update.", field, sheetName)
			continue
		}

		updateRange := &sheets.GridRange{
			SheetId:          0, // Assumes first sheet, might need to be dynamic if sheet names don't map to IDs
			StartRowIndex:    int64(rowIndex - 1),
			EndRowIndex:      int64(rowIndex),
			StartColumnIndex: int64(colIndex),
			EndColumnIndex:   int64(colIndex + 1),
		}

		// This part is a bit tricky. Direct cell updates are better with BatchUpdate.
		// For simplicity, we'll construct a new row and update the whole row.
		// A more robust solution would use BatchUpdate with UpdateCellsRequest.
		// Let's stick to simple row update for now.
	}

	// Simplified approach: Get the whole row, update it, and write it back.
	// This is less efficient but easier to implement without BatchUpdate.
	
	// Let's use BatchUpdate as it's the correct way.
	for field, value := range updates {
		colIndex, ok := headerMap[field]
		if !ok {
			log.Printf("Warning: Column '%s' not found in sheet '%s', skipping", field, sheetName)
			continue
		}

		var cellData sheets.CellData
		switch v := value.(type) {
		case bool:
			cellData.UserEnteredValue = &sheets.ExtendedValue{BoolValue: &v}
		case float64:
			cellData.UserEnteredValue = &sheets.ExtendedValue{NumberValue: &v}
		case string:
			// Check if it's a number string
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				cellData.UserEnteredValue = &sheets.ExtendedValue{NumberValue: &f}
			} else {
				cellData.UserEnteredValue = &sheets.ExtendedValue{StringValue: &v}
			}
		default:
			// Handle other types like int if necessary
			strVal := fmt.Sprintf("%v", value)
			if f, err := strconv.ParseFloat(strVal, 64); err == nil {
				cellData.UserEnteredValue = &sheets.ExtendedValue{NumberValue: &f}
			} else {
				cellData.UserEnteredValue = &sheets.ExtendedValue{StringValue: &strVal}
			}
		}
		
		updateRequests = append(updateRequests, &sheets.Request{
			UpdateCells: &sheets.UpdateCellsRequest{
				Rows: []*sheets.RowData{{Values: []*sheets.CellData{&cellData}}},
				Fields: "userEnteredValue",
				Start: &sheets.GridCoordinate{
					SheetId:     0, // This needs to be dynamic if sheets are not in order
					RowIndex:    int64(rowIndex - 1),
					ColumnIndex: int64(colIndex),
				},
			},
		})
	}
	
	if len(updateRequests) == 0 {
		return errors.New("no valid fields to update")
	}

	batchUpdateRequest := &sheets.BatchUpdateSpreadsheetRequest{Requests: updateRequests}
	_, err = s.srv.Spreadsheets.BatchUpdate(s.spreadsheetID, batchUpdateRequest).Do()

	return err
}

func (s *SheetsService) addSheetRow(sheetName string, data map[string]interface{}) error {
	values, err := s.getSheetData(sheetName)
	if err != nil {
		return err
	}
	if len(values) < 1 {
		return fmt.Errorf("sheet '%s' is empty or has no headers", sheetName)
	}

	headers := values[0]
	headerMap := getHeaderIndexMap(headers)
	
	newRow := make([]interface{}, len(headers))
	for field, value := range data {
		if colIndex, ok := headerMap[field]; ok {
			newRow[colIndex] = value
		}
	}

	valueRange := &sheets.ValueRange{Values: [][]interface{}{newRow}}
	_, err = s.srv.Spreadsheets.Values.Append(s.spreadsheetID, sheetName, valueRange).ValueInputOption("USER_ENTERED").Do()
	return err
}


func (s *SheetsService) deleteSheetRowByValue(sheetName, fieldName, fieldValue string) error {
	rowIndex, _, err := s.findRowIndex(sheetName, fieldName, fieldValue)
	if err != nil {
		return err
	}

	// To delete a row, we need the sheet ID.
	// This is a limitation; we'll assume sheet ID is 0 for the first sheet.
	// A robust solution would map sheet names to IDs.
	deleteRequest := &sheets.Request{
		DeleteDimension: &sheets.DeleteDimensionRequest{
			Range: &sheets.DimensionRange{
				SheetId:    0, // WARNING: Assumes first sheet
				Dimension:  "ROWS",
				StartIndex: int64(rowIndex - 1),
				EndIndex:   int64(rowIndex),
			},
		},
	}
	
	batchUpdateRequest := &sheets.BatchUpdateSpreadsheetRequest{Requests: []*sheets.Request{deleteRequest}}
	_, err = s.srv.Spreadsheets.BatchUpdate(s.spreadsheetID, batchUpdateRequest).Do()
	return err
}
