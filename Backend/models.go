package backend

// =========================================================================
// ម៉ូដែលទិន្នន័យ (GORM Models)
// =========================================================================

type User struct {
	UserName          string `gorm:"primaryKey;column:user_name" json:"UserName" json:"userName"`
	Password          string `gorm:"column:password" json:"Password" json:"password"`
	Team              string `gorm:"column:team" json:"Team" json:"team"`
	FullName          string `gorm:"column:full_name" json:"FullName" json:"fullName"`
	ProfilePictureURL string `gorm:"column:profile_picture_url" json:"ProfilePictureURL" json:"profilePictureUrl"`
	Role              string `gorm:"column:role" json:"Role" json:"role"`
	IsSystemAdmin     bool   `gorm:"column:is_system_admin" json:"IsSystemAdmin" json:"isSystemAdmin"`
	TelegramUsername  string `gorm:"column:telegram_username" json:"TelegramUsername" json:"telegramUsername"`
}

type Movie struct {
	ID          string `gorm:"primaryKey;column:id" json:"ID" json:"id"`
	Title       string `gorm:"column:title" json:"Title" json:"title"`
	Description string `gorm:"column:description" json:"Description" json:"description"`
	Thumbnail   string `gorm:"column:thumbnail" json:"Thumbnail" json:"thumbnail"`
	VideoURL    string `gorm:"column:video_url" json:"VideoURL" json:"videoUrl"`
	Type        string `gorm:"column:type" json:"Type" json:"type"`
	Language    string `gorm:"column:language" json:"Language" json:"language"`
	Country     string `gorm:"column:country" json:"Country" json:"country"`
	Category    string `gorm:"column:category" json:"Category" json:"category"`
	SeriesKey   string `gorm:"column:series_key" json:"SeriesKey" json:"seriesKey"`
	AddedAt     string `gorm:"column:added_at" json:"AddedAt" json:"addedAt"`
}
type Store struct {
	StoreName        string `gorm:"primaryKey;column:store_name" json:"StoreName" json:"storeName"`
	StoreType        string `gorm:"column:store_type" json:"StoreType" json:"storeType"`
	Address          string `gorm:"column:address" json:"Address" json:"address"`
	TelegramBotToken string `gorm:"column:telegram_bot_token" json:"TelegramBotToken" json:"telegramBotToken"`
	TelegramGroupID  string `gorm:"column:telegram_group_id" json:"TelegramGroupID" json:"telegramGroupId"`
	TelegramTopicID  string `gorm:"column:telegram_topic_id" json:"TelegramTopicID" json:"telegramTopicId"`
	LabelPrinterURL  string `gorm:"column:label_printer_url" json:"LabelPrinterURL" json:"labelPrinterUrl"`
	CODAlertGroupID  string `gorm:"column:cod_alert_group_id" json:"CODAlertGroupID" json:"codAlertGroupId"`
}
type Setting struct {
	ConfigKey   string `gorm:"primaryKey;column:config_key" json:"Key" json:"key"`
	ConfigValue string `gorm:"column:config_value" json:"Value" json:"value"`
	Description string `gorm:"column:description" json:"Description" json:"description"`
}

type TeamPage struct {
	ID              uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID" json:"id"`
	Team            string `gorm:"column:team" json:"Team" json:"team"`
	PageName        string `gorm:"column:page_name" json:"PageName" json:"pageName"`
	TelegramValue   string `gorm:"column:telegram_value" json:"TelegramValue" json:"telegramValue"`
	PageLogoURL     string `gorm:"column:page_logo_url" json:"PageLogoURL" json:"pageLogoUrl"`
	DefaultStore    string `gorm:"column:default_store" json:"DefaultStore" json:"defaultStore"`
	TelegramTopicID string `gorm:"column:telegram_topic_id" json:"TelegramTopicID" json:"telegramTopicId"`
}

type Product struct {
	Barcode     string  `gorm:"primaryKey;column:barcode" json:"Barcode" json:"barcode"`
	ProductName string  `gorm:"column:product_name" json:"ProductName" json:"productName"`
	Price       float64 `gorm:"column:price" json:"Price" json:"price"`
	Cost        float64 `gorm:"column:cost" json:"Cost" json:"cost"`
	ImageURL    string  `gorm:"column:image_url" json:"ImageURL" json:"imageUrl"`
	Tags        string  `gorm:"column:tags" json:"Tags" json:"tags"`
}
type Location struct {
	ID       uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID" json:"id"`
	Province string `gorm:"column:province" json:"Province" json:"province"`
	District string `gorm:"column:district" json:"District" json:"district"`
	Sangkat  string `gorm:"column:sangkat" json:"Sangkat" json:"sangkat"`
}
type ShippingMethod struct {
	MethodName                 string  `gorm:"primaryKey;column:method_name" json:"MethodName" json:"methodName"`
	LogoURL                    string  `gorm:"column:logo_url" json:"LogoURL" json:"logoUrl"`
	AllowManualDriver          bool    `gorm:"column:allow_manual_driver" json:"AllowManualDriver" json:"allowManualDriver"`
	RequireDriverSelection     bool    `gorm:"column:require_driver_selection" json:"RequireDriverSelection" json:"requireDriverSelection"`
	InternalCost               float64 `gorm:"column:internal_cost" json:"InternalCost" json:"internalCost"`
	CostShortcuts              string  `gorm:"column:cost_shortcuts" json:"CostShortcuts" json:"costShortcuts"`
	EnableDriverRecommendation bool    `gorm:"column:enable_driver_recommendation" json:"EnableDriverRecommendation" json:"enableDriverRecommendation"`
}

type DriverRecommendation struct {
	ID             uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID" json:"id"`
	DayOfWeek      string `gorm:"column:day_of_week;index" json:"DayOfWeek" json:"dayOfWeek"`
	StoreName      string `gorm:"column:store_name;index" json:"StoreName" json:"storeName"`
	Province       string `gorm:"column:province" json:"Province" json:"province"`
	DriverName     string `gorm:"column:driver_name" json:"DriverName" json:"driverName"`
	ShippingMethod string `gorm:"column:shipping_method" json:"ShippingMethod" json:"shippingMethod"`
}

type Color struct {
	ColorName string `gorm:"primaryKey;column:color_name" json:"ColorName" json:"colorName"`
}
type Driver struct {
	DriverName     string `gorm:"primaryKey;column:driver_name" json:"DriverName" json:"driverName"`
	ImageURL       string `gorm:"column:image_url" json:"ImageURL" json:"imageUrl"`
	Phone          string `gorm:"column:phone" json:"Phone" json:"phone"`
	InternalCost   string `gorm:"column:internal_cost" json:"InternalCost" json:"internalCost"`
	AssignedStores string `gorm:"column:assigned_stores" json:"AssignedStores" json:"assignedStores"`
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
	ID          uint    `gorm:"primaryKey;autoIncrement" json:"ID"`
	StoreName   string  `gorm:"column:store_name;uniqueIndex:idx_inventory_store_barcode" json:"StoreName"`
	Barcode     string  `gorm:"column:barcode;uniqueIndex:idx_inventory_store_barcode" json:"Barcode"`
	Quantity    float64 `gorm:"column:quantity" json:"Quantity"`
	LastUpdated string  `gorm:"column:last_updated" json:"LastUpdated"`
	UpdatedBy   string  `gorm:"column:updated_by" json:"UpdatedBy"`
}

type StockTransfer struct {
	TransferID  string  `gorm:"primaryKey;column:transfer_id" json:"TransferID"`
	Timestamp   string  `gorm:"column:timestamp" json:"Timestamp"`
	FromStore   string  `gorm:"column:from_store;index" json:"FromStore"`
	ToStore     string  `gorm:"column:to_store;index" json:"ToStore"`
	Barcode     string  `gorm:"column:barcode" json:"Barcode"`
	Quantity    float64 `gorm:"column:quantity" json:"Quantity"`
	Status      string  `gorm:"column:status;index" json:"Status"`
	RequestedBy string  `gorm:"column:requested_by" json:"RequestedBy"`
	ApprovedBy  string  `gorm:"column:approved_by" json:"ApprovedBy"`
	ReceivedBy  string  `gorm:"column:received_by" json:"ReceivedBy"`
}

type ReturnItem struct {
	ReturnID    string  `gorm:"primaryKey;column:return_id" json:"ReturnID"`
	Timestamp   string  `gorm:"column:timestamp" json:"Timestamp"`
	OrderID     string  `gorm:"column:order_id;index" json:"OrderID"`
	StoreName   string  `gorm:"column:store_name;index" json:"StoreName"`
	Barcode     string  `gorm:"column:barcode" json:"Barcode"`
	Quantity    float64 `gorm:"column:quantity" json:"Quantity"`
	Reason      string  `gorm:"column:reason" json:"Reason"`
	IsRestocked bool    `gorm:"column:is_restocked" json:"IsRestocked"`
	HandledBy   string  `gorm:"column:handled_by" json:"HandledBy"`
}

func (ReturnItem) TableName() string { return "returns" }

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
	TelegramMessageID3      string  `gorm:"column:telegram_message_id3" json:"Telegram Message ID 3"`
	ScheduledTime           string  `gorm:"column:scheduled_time" json:"Scheduled Time"`
	FulfillmentStore        string  `gorm:"column:fulfillment_store;index" json:"Fulfillment Store"`
	Team                    string  `gorm:"column:team;index" json:"Team"`
	IsVerified              string  `gorm:"column:is_verified" json:"IsVerified"`
	FulfillmentStatus       string  `gorm:"column:fulfillment_status;index" json:"Fulfillment Status"`
	PackedBy                string  `gorm:"column:packed_by" json:"Packed By"`
	PackedTime              string  `gorm:"column:packed_time" json:"Packed Time"`
	PackagePhotoURL         string  `gorm:"column:package_photo_url" json:"Package Photo URL"`
	DriverName              string  `gorm:"column:driver_name" json:"Driver Name"`
	TrackingNumber          string  `gorm:"column:tracking_number" json:"Tracking Number"`
	DispatchedTime          string  `gorm:"column:dispatched_time" json:"Dispatched Time"`
	DispatchedBy            string  `gorm:"column:dispatched_by" json:"Dispatched By"`
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
	ID          uint   `gorm:"primaryKey;autoIncrement" json:"ID" json:"id"`
	RoleName    string `gorm:"uniqueIndex" json:"RoleName" json:"roleName"`
	Description string `json:"Description" json:"description"`
}

type RolePermission struct {
	ID        uint   `gorm:"primaryKey;autoIncrement" json:"ID" json:"id"`
	Role      string `gorm:"index" json:"Role" json:"role"`
	Feature   string `gorm:"index" json:"Feature" json:"feature"`
	IsEnabled bool   `json:"IsEnabled" json:"isEnabled"`
}

type IncentiveCalculator struct {
	ID        uint    `gorm:"primaryKey" json:"id"`
	ProjectID uint    `gorm:"index" json:"projectId"`
	Name      string  `json:"name"`
	Type      string  `json:"type"`
	Value     float64 `json:"value"`
	Status    string  `json:"status"`
	RulesJSON string  `gorm:"type:text" json:"rulesJson"`
}

type IncentiveProject struct {
	ID                     uint                  `gorm:"primaryKey" json:"id"`
	ProjectName            string                `json:"projectName"`
	CalculatorID           uint                  `json:"calculatorId"`
	StartDate              string                `json:"startDate"`
	EndDate                string                `json:"endDate"`
	TargetTeam             string                `json:"targetTeam"`
	Status                 string                `json:"status"`
	ColorCode              string                `json:"colorCode"`
	RequirePeriodSelection bool                  `json:"requirePeriodSelection"`
	DataSource             string                `json:"dataSource"`
	CreatedAt              string                `json:"createdAt"`
	Calculators            []IncentiveCalculator `gorm:"foreignKey:ProjectID" json:"calculators"`
}

type IncentiveResult struct {
	ID              uint    `gorm:"primaryKey" json:"id"`
	ProjectID       uint    `gorm:"index" json:"projectId"`
	UserName        string  `json:"userName"`
	TotalOrders     int     `json:"totalOrders"`
	TotalRevenue    float64 `json:"totalRevenue"`
	TotalProfit     float64 `json:"totalProfit"`
	CalculatedValue float64 `json:"calculatedValue"`
	IsCustom        bool    `json:"isCustom"`
	BreakdownJSON   string  `gorm:"type:text" json:"breakdownJson"`
}

type IncentiveManualData struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	ProjectID  uint    `gorm:"index" json:"projectId"`
	Month      string  `gorm:"index" json:"month"` // Format: YYYY-MM
	MetricType string  `json:"metricType"`
	DataKey    string  `json:"dataKey"` // Format: {period}_{targetId} e.g. "month_TeamA", "W1_user1"
	Value      float64 `json:"value"`
}

type IncentiveCustomPayout struct {
	ID        uint    `gorm:"primaryKey" json:"id"`
	ProjectID uint    `gorm:"index" json:"projectId"`
	Month     string  `gorm:"index" json:"month"` // Format: YYYY-MM
	UserName  string  `json:"userName"`
	Value     float64 `json:"value"`
}

type DeleteOrderRequest struct {
	OrderID            string `json:"orderId"`
	Team               string `json:"team"`
	UserName           string `json:"userName"`
	TelegramMessageID1 string `json:"telegramMessageId1"`
	TelegramMessageID2 string `json:"telegramMessageId2"`
	TelegramMessageID3 string `json:"telegramMessageId3"`
	TelegramChatId     string `json:"telegramChatId"`
}


