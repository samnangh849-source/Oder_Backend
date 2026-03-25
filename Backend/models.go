package backend

import (
	"time"
)

// =========================================================================
// ម៉ូដែលទិន្នន័យ (GORM Models)
// =========================================================================

type User struct {
	UserName          string `gorm:"primaryKey;column:user_name" json:"UserName"`
	Password          string `gorm:"column:password" json:"Password"`
	Team              string `gorm:"column:team" json:"Team"`
	FullName          string `gorm:"column:full_name" json:"FullName"`
	ProfilePictureURL string `gorm:"column:profile_picture_url" json:"ProfilePictureURL"`
	Role              string `gorm:"column:role" json:"Role"`
	IsSystemAdmin     bool   `gorm:"column:is_system_admin" json:"IsSystemAdmin"`
	TelegramUsername  string `gorm:"column:telegram_username" json:"TelegramUsername"`
}

type Movie struct {
	ID          string `gorm:"primaryKey;column:id" json:"ID"`
	Title       string `gorm:"column:title" json:"Title"`
	Description string `gorm:"column:description" json:"Description"`
	Thumbnail   string `gorm:"column:thumbnail" json:"Thumbnail"`
	VideoURL    string `gorm:"column:video_url" json:"VideoURL"`
	Type        string `gorm:"column:type" json:"Type"`
	Language    string `gorm:"column:language" json:"Language"`
	Country     string `gorm:"column:country" json:"Country"`
	Category    string `gorm:"column:category" json:"Category"`
	SeriesKey   string `gorm:"column:series_key" json:"SeriesKey"`
	AddedAt     string `gorm:"column:added_at" json:"AddedAt"`
}
type Store struct {
	StoreName        string `gorm:"primaryKey;column:store_name" json:"StoreName"`
	StoreType        string `gorm:"column:store_type" json:"StoreType"`
	Address          string `gorm:"column:address" json:"Address"`
	TelegramBotToken string `gorm:"column:telegram_bot_token" json:"TelegramBotToken"`
	TelegramGroupID  string `gorm:"column:telegram_group_id" json:"TelegramGroupID"`
	TelegramTopicID  string `gorm:"column:telegram_topic_id" json:"TelegramTopicID"`
	LabelPrinterURL  string `gorm:"column:label_printer_url" json:"LabelPrinterURL"`
	CODAlertGroupID  string `gorm:"column:cod_alert_group_id" json:"CODAlertGroupID"`
}
type Setting struct {
	ConfigKey   string `gorm:"primaryKey;column:config_key" json:"Key"`
	ConfigValue string `gorm:"column:config_value" json:"Value"`
	Description string `gorm:"column:description" json:"Description"`
}

type TeamPage struct {
	ID              uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	Team            string `gorm:"column:team" json:"Team"`
	PageName        string `gorm:"column:page_name" json:"PageName"`
	TelegramValue   string `gorm:"column:telegram_value" json:"TelegramValue"`
	PageLogoURL     string `gorm:"column:page_logo_url" json:"PageLogoURL"`
	DefaultStore    string `gorm:"column:default_store" json:"DefaultStore"`
	TelegramTopicID string `gorm:"column:telegram_topic_id" json:"TelegramTopicID"`
}

type Product struct {
	Barcode     string  `gorm:"primaryKey;column:barcode" json:"Barcode"`
	ProductName string  `gorm:"column:product_name" json:"ProductName"`
	Price       float64 `gorm:"column:price" json:"Price"`
	Cost        float64 `gorm:"column:cost" json:"Cost"`
	ImageURL    string  `gorm:"column:image_url" json:"ImageURL"`
	Tags        string  `gorm:"column:tags" json:"Tags"`
}
type Location struct {
	ID       uint   `gorm:"primaryKey;autoIncrement;column:id"`
	Province string `gorm:"column:province" json:"Province"`
	District string `gorm:"column:district" json:"District"`
	Sangkat  string `gorm:"column:sangkat" json:"Sangkat"`
}
type ShippingMethod struct {
	MethodName                 string  `gorm:"primaryKey;column:method_name" json:"MethodName"`
	LogoURL                    string  `gorm:"column:logo_url" json:"LogoURL"`
	AllowManualDriver          bool    `gorm:"column:allow_manual_driver" json:"AllowManualDriver"`
	RequireDriverSelection     bool    `gorm:"column:require_driver_selection" json:"RequireDriverSelection"`
	InternalCost               float64 `gorm:"column:internal_cost" json:"InternalCost"`
	CostShortcuts              string  `gorm:"column:cost_shortcuts" json:"CostShortcuts"`
	EnableDriverRecommendation bool    `gorm:"column:enable_driver_recommendation" json:"EnableDriverRecommendation"`
}

type DriverRecommendation struct {
	ID             uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	DayOfWeek      string `gorm:"column:day_of_week" json:"DayOfWeek"`
	StoreName      string `gorm:"column:store_name" json:"StoreName"`
	Province       string `gorm:"column:province" json:"Province"`
	DriverName     string `gorm:"column:driver_name" json:"DriverName"`
	ShippingMethod string `gorm:"column:shipping_method" json:"ShippingMethod"`
}

type Color struct {
	ColorName string `gorm:"primaryKey;column:color_name" json:"ColorName"`
}
type Driver struct {
	DriverName     string `gorm:"primaryKey;column:driver_name" json:"DriverName"`
	ImageURL       string `gorm:"column:image_url" json:"ImageURL"`
	Phone          string `gorm:"column:phone" json:"Phone"`
	InternalCost   string `gorm:"column:internal_cost" json:"InternalCost"`
	AssignedStores string `gorm:"column:assigned_stores" json:"AssignedStores"`
}
type BankAccount struct {
	BankName       string `gorm:"primaryKey;column:bank_name" json:"BankName"`
	LogoURL        string `gorm:"column:logo_url" json:"LogoURL"`
	AssignedStores string `gorm:"column:assigned_stores" json:"AssignedStores"`
}
type PhoneCarrier struct {
	CarrierName    string `gorm:"primaryKey;column:carrier_name" json:"CarrierName"`
	Prefixes       string `gorm:"column:prefixes" json:"Prefixes"`
	CarrierLogoURL string `gorm:"column:carrier_logo_url" json:"CarrierLogoURL"`
}
type TelegramTemplate struct {
	ID       uint    `gorm:"primaryKey;autoIncrement"`
	Team     string  `json:"Team"`
	Part     float64 `json:"Part"`
	Template string  `json:"Template"`
}

type Inventory struct {
	ID          uint    `gorm:"primaryKey;autoIncrement"`
	StoreName   string  `gorm:"index" json:"StoreName"`
	Barcode     string  `gorm:"index" json:"Barcode"`
	Quantity    float64 `json:"Quantity"`
	LastUpdated string  `json:"LastUpdated"`
	UpdatedBy   string  `json:"UpdatedBy"`
}
type StockTransfer struct {
	TransferID  string  `gorm:"primaryKey" json:"TransferID"`
	Timestamp   string  `json:"Timestamp"`
	FromStore   string  `json:"FromStore"`
	ToStore     string  `json:"ToStore"`
	Barcode     string  `json:"Barcode"`
	Quantity    float64 `json:"Quantity"`
	Status      string  `json:"Status"`
	RequestedBy string  `json:"RequestedBy"`
	ApprovedBy  string  `json:"ApprovedBy"`
	ReceivedBy  string  `json:"ReceivedBy"`
}
type ReturnItem struct {
	ReturnID    string  `gorm:"primaryKey" json:"ReturnID"`
	Timestamp   string  `json:"Timestamp"`
	OrderID     string  `json:"OrderID"`
	StoreName   string  `json:"StoreName"`
	Barcode     string  `json:"Barcode"`
	Quantity    float64 `json:"Quantity"`
	Reason      string  `json:"Reason"`
	IsRestocked bool    `json:"IsRestocked"`
	HandledBy   string  `json:"HandledBy"`
}

type Order struct {
	OrderID                 string  `gorm:"primaryKey;column:order_id" json:"Order ID"`
	Timestamp               string  `gorm:"index;column:timestamp" json:"Timestamp"`
	User                    string  `gorm:"column:user" json:"User"`
	Page                    string  `gorm:"column:page" json:"Page"`
	TelegramValue           string  `gorm:"column:telegram_value" json:"TelegramValue"`
	CustomerName            string  `gorm:"column:customer_name" json:"Customer Name"`
	CustomerPhone           string  `gorm:"column:customer_phone" json:"Customer Phone"`
	Location                string  `gorm:"column:location" json:"Location"`
	AddressDetails          string  `gorm:"column:address_details" json:"Address Details"`
	Note                    string  `gorm:"column:note" json:"Note"`
	ShippingFeeCustomer     float64 `gorm:"column:shipping_fee_customer" json:"Shipping Fee (Customer)"`
	Subtotal                float64 `gorm:"column:subtotal" json:"Subtotal"`
	GrandTotal              float64 `gorm:"column:grand_total" json:"Grand Total"`
	ProductsJSON            string  `gorm:"type:text;column:products_json" json:"Products (JSON)"`
	InternalShippingMethod  string  `gorm:"column:internal_shipping_method" json:"Internal Shipping Method"`
	InternalShippingDetails string  `gorm:"column:internal_shipping_details" json:"Internal Shipping Details"`
	InternalCost            float64 `gorm:"column:internal_cost" json:"Internal Cost"`
	PaymentStatus           string  `gorm:"column:payment_status" json:"Payment Status"`
	PaymentInfo             string  `gorm:"column:payment_info" json:"Payment Info"`
	DiscountUSD             float64 `gorm:"column:discount_usd" json:"Discount ($)"`
	DeliveryUnpaid          float64 `gorm:"column:delivery_unpaid" json:"Delivery Unpaid"`
	DeliveryPaid            float64 `gorm:"column:delivery_paid" json:"Delivery Paid"`
	TotalProductCost        float64 `gorm:"column:total_product_cost" json:"Total Product Cost ($)"`
	TelegramMessageID1      string  `gorm:"column:telegram_message_id1" json:"Telegram Message ID 1"`
	TelegramMessageID2      string  `gorm:"column:telegram_message_id2" json:"Telegram Message ID 2"`
	ScheduledTime           string  `gorm:"column:scheduled_time" json:"Scheduled Time"`
	FulfillmentStore        string  `gorm:"column:fulfillment_store" json:"Fulfillment Store"`
	Team                    string  `gorm:"column:team" json:"Team"`
	IsVerified              string  `gorm:"column:is_verified" json:"IsVerified"`
	FulfillmentStatus       string  `gorm:"column:fulfillment_status" json:"Fulfillment Status"`
	PackedBy                string  `gorm:"column:packed_by" json:"Packed By"`
	PackagePhotoURL         string  `gorm:"column:package_photo_url" json:"Package Photo URL"`
	DriverName              string  `gorm:"column:driver_name" json:"Driver Name"`
	TrackingNumber          string  `gorm:"column:tracking_number" json:"Tracking Number"`
	DispatchedTime          string  `gorm:"column:dispatched_time" json:"Dispatched Time"`
	DeliveredTime           string  `gorm:"column:delivered_time" json:"Delivered Time"`
	DeliveryPhotoURL        string  `gorm:"column:delivery_photo_url" json:"Delivery Photo URL"`
}

type RevenueEntry struct {
	ID               uint    `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	Timestamp        string  `gorm:"column:timestamp" json:"Timestamp"`
	Team             string  `gorm:"column:team" json:"Team"`
	Page             string  `gorm:"column:page" json:"Page"`
	Revenue          float64 `gorm:"column:revenue" json:"Revenue"`
	FulfillmentStore string  `gorm:"column:fulfillment_store" json:"FulfillmentStore"`
}

type ChatMessage struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"ID"`
	Timestamp   string `gorm:"index" json:"Timestamp"`
	UserName    string `json:"UserName"`
	Receiver    string `json:"Receiver"`
	MessageType string `json:"MessageType"`
	Content     string `gorm:"type:text" json:"Content"`
	FileID      string `json:"FileID,omitempty"`
	AudioData   string `gorm:"-" json:"AudioData,omitempty"`
}

type EditLog struct {
	ID           uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Timestamp    string `json:"Timestamp"`
	OrderID      string `json:"OrderID"`
	Requester    string `json:"Requester"`
	FieldChanged string `json:"Field Changed"`
	OldValue     string `json:"Old Value"`
	NewValue     string `json:"New Value"`
}
type UserActivityLog struct {
	ID        uint   `gorm:"primaryKey;autoIncrement" json:"ID"`
	Timestamp string `json:"Timestamp"`
	User      string `json:"User"`
	Action    string `json:"Action"`
	Details   string `json:"Details"`
}

type Role struct {
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"ID"`
	RoleName    string `gorm:"uniqueIndex" json:"RoleName"`
	Description string `json:"Description"`
}

type RolePermission struct {
	ID        uint   `gorm:"primaryKey;autoIncrement" json:"ID"`
	Role      string `gorm:"index" json:"Role"`
	Feature   string `gorm:"index" json:"Feature"`
	IsEnabled bool   `json:"IsEnabled"`
}

type IncentiveCalculator struct {
	ID        uint    `gorm:"primaryKey" json:"ID"`
	ProjectID uint    `gorm:"index" json:"ProjectID"`
	Name      string  `json:"Name"`
	Type      string  `json:"Type"`
	Value     float64 `json:"Value"`
	Status    string  `json:"Status"`
	RulesJSON string  `gorm:"type:text" json:"RulesJSON"`
}

type IncentiveProject struct {
	ID                     uint                  `gorm:"primaryKey" json:"ID"`
	ProjectName            string                `json:"ProjectName"`
	CalculatorID           uint                  `json:"CalculatorID"`
	StartDate              string                `json:"StartDate"`
	EndDate                string                `json:"EndDate"`
	TargetTeam             string                `json:"TargetTeam"`
	Status                 string                `json:"Status"`
	ColorCode              string                `json:"ColorCode"`
	RequirePeriodSelection bool                  `json:"RequirePeriodSelection"`
	DataSource             string                `json:"DataSource"`
	CreatedAt              string                `json:"CreatedAt"`
	Calculators            []IncentiveCalculator `gorm:"foreignKey:ProjectID" json:"Calculators"`
}

type IncentiveResult struct {
	ID              uint    `gorm:"primaryKey" json:"ID"`
	ProjectID       uint    `gorm:"index" json:"ProjectID"`
	UserName        string  `json:"UserName"`
	TotalOrders     int     `json:"TotalOrders"`
	TotalRevenue    float64 `json:"TotalRevenue"`
	TotalProfit     float64 `json:"TotalProfit"`
	CalculatedValue float64 `json:"CalculatedValue"`
	IsCustom        bool    `json:"IsCustom"`
	BreakdownJSON   string  `gorm:"type:text" json:"BreakdownJSON"`
}

type IncentiveManualData struct {
	ID         uint    `gorm:"primaryKey" json:"ID"`
	ProjectID  uint    `gorm:"index" json:"ProjectID"`
	Month      string  `gorm:"index" json:"Month"` // Format: YYYY-MM
	MetricType string  `json:"MetricType"`
	DataKey    string  `json:"DataKey"` // Format: {period}_{targetId} e.g. "month_TeamA", "W1_user1"
	Value      float64 `json:"Value"`
}

type IncentiveCustomPayout struct {
	ID        uint    `gorm:"primaryKey" json:"ID"`
	ProjectID uint    `gorm:"index" json:"ProjectID"`
	Month     string  `gorm:"index" json:"Month"` // Format: YYYY-MM
	UserName  string  `json:"UserName"`
	Value     float64 `json:"Value"`
}

type DeleteOrderRequest struct {
	OrderID            string `json:"orderId"`
	Team               string `json:"team"`
	UserName           string `json:"userName"`
	TelegramMessageID1 string `json:"telegramMessageId1"`
	TelegramMessageID2 string `json:"telegramMessageId2"`
	TelegramChatId     string `json:"telegramChatId"`
}

type TempImage struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	MimeType  string    `json:"mimeType"`
	ImageData string    `gorm:"type:text" json:"imageData"`
	DriveURL  string    `gorm:"column:drive_url" json:"driveUrl"` // Permanent URL resolved later
	ExpiresAt time.Time `gorm:"index" json:"expiresAt"`
}
