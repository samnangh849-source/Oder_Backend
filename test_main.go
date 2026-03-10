package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
	"google.golang.org/api/sheets/v4"

	// Import GORM & PostgreSQL Driver
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	DB               *gorm.DB
	sheetsService    *sheets.Service
	driveService     *drive.Service
	spreadsheetID    string
	uploadFolderID   string
	appsScriptURL    string
	appsScriptSecret string
	hub              *Hub
)

var sheetRanges = map[string]string{}
type User struct { UserName string `gorm:"primaryKey" json:"UserName"`; Password string `json:"Password"`; Team string `json:"Team"`; FullName string `json:"FullName"`; ProfilePictureURL string `json:"ProfilePictureURL"`; Role string `json:"Role"`; IsSystemAdmin bool `json:"IsSystemAdmin"`; TelegramUsername string `json:"TelegramUsername"` }
type Store struct { StoreName string `gorm:"primaryKey" json:"StoreName"`; StoreType string `json:"StoreType"`; Address string `json:"Address"`; TelegramBotToken string `json:"TelegramBotToken"`; TelegramGroupID string `json:"TelegramGroupID"`; TelegramTopicID string `json:"TelegramTopicID"`; LabelPrinterURL string `json:"LabelPrinterURL"`; CODAlertGroupID string `json:"CODAlertGroupID"` }
type Setting struct { ConfigKey string `gorm:"primaryKey" json:"ConfigKey"`; ConfigValue string `json:"ConfigValue"` }

type TeamPage struct { 
	ID              uint   `gorm:"primaryKey;autoIncrement" json:"ID"`
	Team            string `json:"Team"`
	PageName        string `json:"PageName"`
	TelegramValue   string `json:"TelegramValue"`
	PageLogoURL     string `json:"PageLogoURL"`
	DefaultStore    string `json:"DefaultStore"`
	TelegramTopicID string `json:"TelegramTopicID"`
}

type Product struct { Barcode string `gorm:"primaryKey" json:"Barcode"`; ProductName string `json:"ProductName"`; Price float64 `json:"Price"`; Cost float64 `json:"Cost"`; ImageURL string `json:"ImageURL"`; Tags string `json:"Tags"` }
type Location struct { ID uint `gorm:"primaryKey;autoIncrement"`; Province string `json:"Province"`; District string `json:"District"`; Sangkat string `json:"Sangkat"` }
type ShippingMethod struct { MethodName string `gorm:"primaryKey" json:"MethodName"`; LogoURL string `json:"LogosURL"`; AllowManualDriver bool `json:"AllowManualDriver"`; RequireDriverSelection bool `json:"RequireDriverSelection"`; EnableCODAlert bool `json:"EnableCODAlert"`; AlertTopicID string `json:"AlertTopicID"` }
type Color struct { ColorName string `gorm:"primaryKey" json:"ColorName"` }
type Driver struct { DriverName string `gorm:"primaryKey" json:"DriverName"`; ImageURL string `json:"ImageURL"`; Phone string `json:"Phone"`; VehiclePlate string `json:"VehiclePlate"` }
type BankAccount struct { BankName string `gorm:"primaryKey" json:"BankName"`; LogoURL string `json:"LogoURL"`; AssignedStores string `json:"AssignedStores"` }
type PhoneCarrier struct { CarrierName string `gorm:"primaryKey" json:"CarrierName"`; Prefixes string `json:"Prefixes"`; CarrierLogoURL string `json:"CarrierLogoURL"` }
type TelegramTemplate struct { ID uint `gorm:"primaryKey;autoIncrement"`; Team string `json:"Team"`; Part float64 `json:"Part"`; Template string `json:"Template"` }

type Inventory struct { ID uint `gorm:"primaryKey;autoIncrement"`; StoreName string `gorm:"index" json:"StoreName"`; Barcode string `gorm:"index" json:"Barcode"`; Quantity float64 `json:"Quantity"`; LastUpdated string `json:"LastUpdated"`; UpdatedBy string `json:"UpdatedBy"` }
type StockTransfer struct { TransferID string `gorm:"primaryKey" json:"TransferID"`; Timestamp string `json:"Timestamp"`; FromStore string `json:"FromStore"`; ToStore string `json:"ToStore"`; Barcode string `json:"Barcode"`; Quantity float64 `json:"Quantity"`; Status string `json:"Status"`; RequestedBy string `json:"RequestedBy"`; ApprovedBy string `json:"ApprovedBy"`; ReceivedBy string `json:"ReceivedBy"` }
type ReturnItem struct { ReturnID string `gorm:"primaryKey" json:"ReturnID"`; Timestamp string `json:"Timestamp"`; OrderID string `json:"OrderID"`; StoreName string `json:"StoreName"`; Barcode string `json:"Barcode"`; Quantity float64 `json:"Quantity"`; Reason string `json:"Reason"`; IsRestocked bool `json:"IsRestocked"`; HandledBy string `json:"HandledBy"` }

// ✅ ជួសជុល JSON Tags ដើម្បីឱ្យត្រូវនឹង Google Sheet "AllOrders" ទាំងស្រុងសម្រាប់ការទាញទិន្នន័យ (Migration) និង Frontend
type Order struct {
	OrderID                 string  `gorm:"primaryKey" json:"Order ID"`
	Timestamp               string  `gorm:"index" json:"Timestamp"`
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
	ProductsJSON            string  `gorm:"type:text" json:"Products (JSON)"`
	InternalShippingMethod  string  `json:"Internal Shipping Method"` // ប្រើសម្រាប់ Logistics
	InternalShippingDetails string  `json:"Internal Shipping Details"`
	InternalCost            float64 `json:"Internal Cost"`            // ប្រើសម្រាប់ Exp. Cost
	PaymentStatus           string  `json:"Payment Status"`           // ប្រើសម្រាប់ Status (Paid/Unpaid)
	PaymentInfo             string  `json:"Payment Info"`
	DiscountUSD             float64 `json:"Discount ($)"`
	DeliveryUnpaid          float64 `json:"Delivery Unpaid"`
	DeliveryPaid            float64 `json:"Delivery Paid"`
	TotalProductCost        float64 `json:"Total Product Cost ($)"`
	TelegramMessageID1      string  `json:"Telegram Message ID 1"`
	TelegramMessageID2      string  `json:"Telegram Message ID 2"`
	ScheduledTime           string  `json:"Scheduled Time"`
	FulfillmentStore        string  `json:"Fulfillment Store"`
	Team                    string  `json:"Team"`
	IsVerified              string  `json:"IsVerified"`
	FulfillmentStatus       string  `json:"Fulfillment Status"`
	PackedBy                string  `json:"Packed By"`
	PackagePhotoURL         string  `json:"Package Photo URL"`
	DriverName              string  `json:"Driver Name"`
	TrackingNumber          string  `json:"Tracking Number"`
	DispatchedTime          string  `json:"Dispatched Time"`
	DeliveredTime           string  `json:"Delivered Time"`
	DeliveryPhotoURL        string  `json:"Delivery Photo URL"`
}

type RevenueEntry struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; Team string `json:"Team"`; Page string `json:"Page"`; Revenue float64 `json:"Revenue"`; FulfillmentStore string `json:"Fulfillment Store"` }
type ChatMessage struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `gorm:"index" json:"Timestamp"`; UserName string `json:"UserName"`; MessageType string `json:"MessageType"`; Content string `gorm:"type:text" json:"Content"`; FileID string `json:"FileID,omitempty"` }
type EditLog struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; OrderID string `json:"OrderID"`; Requester string `json:"Requester"`; FieldChanged string `json:"Field Changed"`; OldValue string `json:"Old Value"`; NewValue string `json:"New Value"` }
type UserActivityLog struct { ID uint `gorm:"primaryKey;autoIncrement"`; Timestamp string `json:"Timestamp"`; User string `json:"User"`; Action string `json:"Action"`; Details string `json:"Details"` }

type DeleteOrderRequest struct { OrderID string `json:"orderId"`; Team string `json:"team"`; UserName string `json:"userName"` }

func initDB() {}
func createGoogleAPIClient(ctx context.Context) error { return nil }

func mapToDBColumn(key string) string { return "" }
func isValidOrderColumn(col string) bool { return true }
func parseBase64(b64 string) ([]byte, error) { return nil, nil }

type AppsScriptRequest struct {
	Action         string      `json:"action"`
	Secret         string      `json:"secret"`
	UploadFolderID string      `json:"uploadFolderID,omitempty"`
	FileData       string      `json:"fileData,omitempty"`
	FileName       string      `json:"fileName,omitempty"`
	MimeType       string      `json:"mimeType,omitempty"`
	UserName       string      `json:"userName,omitempty"`
	OrderData      interface{} `json:"orderData,omitempty"`
	OrderID        string      `json:"orderId,omitempty"`
	TargetColumn   string      `json:"targetColumn,omitempty"`
}

type AppsScriptResponse struct {
	Status     string `json:"status"`
	URL        string `json:"url,omitempty"`
	FileID     string `json:"fileID,omitempty"`
	Message    string `json:"message,omitempty"`
	MessageIds struct {
		ID1 string `json:"id1"`
		ID2 string `json:"id2"`
	} `json:"messageIds,omitempty"`
}

type OrderJob struct { JobID string; OrderID string; UserName string; OrderData map[string]interface{} }
var orderChannel = make(chan OrderJob, 1000)

func startOrderWorker() {}
func startScheduler() {}
func callAppsScriptPOST(requestData AppsScriptRequest) (AppsScriptResponse, error) { return AppsScriptResponse{}, nil }
func fetchSheetDataFromAPI(sheetName string) ([]map[string]interface{}, error) { return nil, nil }
func isNumericHeader(h string) bool { return true }
func isBoolHeader(h string) bool { return true }
func convertSheetValuesToMaps(values *sheets.ValueRange) ([]map[string]interface{}, error) { return nil, nil }
func fetchSheetDataToStruct(sheetName string, target interface{}) error { return nil }
func handleMigrateData(c *gin.Context) {}

type Client struct { hub *Hub; conn *websocket.Conn; send chan []byte }
type Hub struct { clients map[*Client]bool; broadcast chan []byte; register chan *Client; unregister chan *Client }
func NewHub() *Hub { return &Hub{} }
func (h *Hub) run() {}
func (c *Client) writePump() {}
func serveWs(c *gin.Context) {}

func handleGetUsers(c *gin.Context) {}
func handleGetStaticData(c *gin.Context) {}
func handleGetRevenueSummary(c *gin.Context) {}
func handleGetAllOrders(c *gin.Context) {}

// ✅ ជួសជុលបញ្ហាដែលបាត់ Payment Status, Info និង Internal Cost
func handleSubmitOrder(c *gin.Context) {
	var orderRequest struct { CurrentUser User `json:"currentUser"`; SelectedTeam string `json:"selectedTeam"`; Page string `json:"page"`; Customer map[string]interface{} `json:"customer"`; Products []map[string]interface{} `json:"products"`; Payment map[string]interface{} `json:"payment"`; Shipping map[string]interface{} `json:"shipping"`; Subtotal float64 `json:"subtotal"`; GrandTotal float64 `json:"grandTotal"`; Note string `json:"note"`; FulfillmentStore string `json:"fulfillmentStore"`; ScheduledTime string `json:"scheduledTime"` }
	if err := c.ShouldBindJSON(&orderRequest); err != nil { c.JSON(400, gin.H{"status": "error"}); return }
	
	productsJSON, _ := json.Marshal(orderRequest.Products)
	var locationParts []string
	if p, ok := orderRequest.Customer["province"].(string); ok && p != "" { locationParts = append(locationParts, p) }
	if d, ok := orderRequest.Customer["district"].(string); ok && d != "" { locationParts = append(locationParts, d) }
	if s, ok := orderRequest.Customer["sangkat"].(string); ok && s != "" { locationParts = append(locationParts, s) }
	
	// ✅ ទាញតម្លៃ Internal Cost (ពីប្រអប់ Cost ដែល Admin បញ្ចូល) ដោយប្រុងប្រយ័ត្ន
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

	var totalDiscount float64 = 0; var totalProductCost float64 = 0
	for _, p := range orderRequest.Products {
		op, _ := p["originalPrice"].(float64); fp, _ := p["finalPrice"].(float64); q, _ := p["quantity"].(float64); cost, _ := p["cost"].(float64)
		if op > 0 && q > 0 { totalDiscount += (op - fp) * q }; totalProductCost += (cost * q)
	}
	
	orderID := fmt.Sprintf("ORD-%d", time.Now().Unix()); timestamp := time.Now().UTC().Format(time.RFC3339)
	custName, _ := orderRequest.Customer["name"].(string); custPhone, _ := orderRequest.Customer["phone"].(string)

	// ✅ ទាញយក Payment Status ពី Request ឱ្យត្រូវ
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

	// ✅ ទាញយក Logistics Method
	internalShipMethod, _ := orderRequest.Shipping["method"].(string)
	internalShipDetails, _ := orderRequest.Shipping["details"].(string)

	newOrder := Order{ 
		OrderID: orderID, 
		Timestamp: timestamp, 
		User: orderRequest.CurrentUser.UserName, 
		Team: orderRequest.SelectedTeam, 
		Page: orderRequest.Page, 
		CustomerName: custName, 
		CustomerPhone: custPhone, 
		Subtotal: orderRequest.Subtotal, 
		GrandTotal: orderRequest.GrandTotal, 
		ProductsJSON: string(productsJSON), 
		Note: orderRequest.Note, 
		FulfillmentStore: orderRequest.FulfillmentStore, 
		ScheduledTime: orderRequest.ScheduledTime, 
		FulfillmentStatus: "Pending",
		PaymentStatus: paymentStatus, 
		PaymentInfo: paymentInfo,     
		InternalCost: shippingCost,    
		DiscountUSD: totalDiscount,
		TotalProductCost: totalProductCost,
		Location: strings.Join(locationParts, ", "),
		AddressDetails: addLocation,
		ShippingFeeCustomer: shipFeeCustomer,
		InternalShippingMethod: internalShipMethod,
		InternalShippingDetails: internalShipDetails,
	}

	if err := DB.Create(&newOrder).Error; err != nil { c.JSON(500, gin.H{"status": "error"}); return }
	orderChannel <- OrderJob{ JobID: fmt.Sprintf("job_%d", time.Now().UnixNano()), OrderID: orderID, UserName: orderRequest.CurrentUser.UserName, OrderData: map[string]interface{}{ "orderId": orderID, "timestamp": timestamp, "totalDiscount": totalDiscount, "totalProductCost": totalProductCost, "fullLocation": strings.Join(locationParts, ", "), "productsJSON": string(productsJSON), "shippingCost": shippingCost, "originalRequest": orderRequest, "scheduledTime": orderRequest.ScheduledTime } }
	c.JSON(200, gin.H{"status": "success", "orderId": orderID})
}

func handleAdminUpdateOrder(c *gin.Context) {}
func handleAdminDeleteOrder(c *gin.Context) {}
func handleAdminUpdateSheet(c *gin.Context) {}
func handleAdminAddRow(c *gin.Context) {}
func handleAdminDeleteRow(c *gin.Context) {}
func handleUpdateFormulaReport(c *gin.Context) {}
func handleClearCache(c *gin.Context) {}
func handleAdminUpdateProductTags(c *gin.Context) {}
func handleUpdateProfile(c *gin.Context) {}
func handleChangePassword(c *gin.Context) {}
func uploadToGoogleDriveDirectly(base64Data string, fileName string, mimeType string) (string, string, error) { return "", "", nil }
func handleImageUploadProxy(c *gin.Context) {}
func handleGetChatMessages(c *gin.Context) {}
func handleSendChatMessage(c *gin.Context) {}
func handleDeleteChatMessage(c *gin.Context) {}
func handleGetAudioProxy(c *gin.Context) {}

func main() {
}
