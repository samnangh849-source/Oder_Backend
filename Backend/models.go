package backend

// =========================================================================
// ម៉ូដែលទិន្នន័យ (GORM Models)
// =========================================================================

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"
)

type User struct {
	UserName          string `gorm:"primaryKey;column:user_name" json:"UserName"`
	Password          string `gorm:"column:password" json:"Password,omitempty"`
	Team              string `gorm:"column:team" json:"Team"`
	FullName          string `gorm:"column:full_name" json:"FullName"`
	ProfilePictureURL string `gorm:"column:profile_picture_url" json:"ProfilePictureURL"`
	Role              string `gorm:"column:role" json:"Role"`
	IsSystemAdmin     bool   `gorm:"column:is_system_admin" json:"IsSystemAdmin"`
	TelegramUsername  string `gorm:"column:telegram_username" json:"TelegramUsername"`
	TelegramStickerID string `gorm:"column:telegram_sticker_id" json:"TelegramStickerID"`
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
	ID       uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
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
	DayOfWeek      string `gorm:"column:day_of_week;index" json:"DayOfWeek"`
	StoreName      string `gorm:"column:store_name;index" json:"StoreName"`
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
	CarrierName   string `gorm:"primaryKey;column:carrier_name" json:"CarrierName"`
	Prefixes      string `gorm:"column:prefixes" json:"Prefixes"`
	CarrierLogoURL string `gorm:"column:carrier_logo_url" json:"CarrierLogoURL"`
}

type TelegramTemplate struct {
	ID       string `gorm:"primaryKey;column:id" json:"ID"`
	Team     string `gorm:"column:team" json:"Team"`
	Part     string `gorm:"column:part" json:"Part"`
	Template string `gorm:"column:template" json:"Template"`
}

func (t *TelegramTemplate) UnmarshalJSON(data []byte) error {
	type Alias TelegramTemplate
	var aux struct {
		ID       interface{} `json:"ID"`
		Team     interface{} `json:"Team"`
		Part     interface{} `json:"Part"`
		Template interface{} `json:"Template"`
		Alias
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	*t = TelegramTemplate(aux.Alias)

	if aux.ID != nil {
		t.ID = fmt.Sprintf("%v", aux.ID)
	}
	if aux.Team != nil {
		t.Team = fmt.Sprintf("%v", aux.Team)
	}
	if aux.Part != nil {
		t.Part = fmt.Sprintf("%v", aux.Part)
	}
	if aux.Template != nil {
		t.Template = fmt.Sprintf("%v", aux.Template)
	}
	return nil
}

type Inventory struct {
	ID          uint    `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	StoreName   string  `gorm:"index;column:store_name" json:"StoreName"`
	ProductName string  `gorm:"index;column:product_name" json:"ProductName"`
	Barcode     string  `gorm:"index;column:barcode" json:"Barcode"`
	Quantity    float64 `gorm:"column:quantity" json:"Quantity"`
	LastUpdated string  `gorm:"column:last_updated" json:"LastUpdated"`
	UpdatedBy   string  `gorm:"column:updated_by" json:"UpdatedBy"`
}

type StockTransfer struct {
	TransferID  string  `gorm:"primaryKey;column:transfer_id" json:"TransferID"`
	Timestamp   string  `gorm:"index;column:timestamp" json:"Timestamp"`
	FromStore   string  `gorm:"column:from_store" json:"FromStore"`
	ToStore     string  `gorm:"column:to_store" json:"ToStore"`
	ProductName string  `gorm:"column:product_name" json:"ProductName"`
	Quantity    float64 `gorm:"column:quantity" json:"Quantity"`
	RequestedBy string  `gorm:"column:requested_by" json:"RequestedBy"`
	Status      string  `gorm:"column:status" json:"Status"`
}

type ReturnItem struct {
	ID          uint    `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	Timestamp   string  `gorm:"index;column:timestamp" json:"Timestamp"`
	OrderID     string  `gorm:"index;column:order_id" json:"OrderID"`
	ProductName string  `gorm:"column:product_name" json:"ProductName"`
	Quantity    float64 `gorm:"column:quantity" json:"Quantity"`
	Reason      string  `gorm:"column:reason" json:"Reason"`
	HandledBy   string  `gorm:"column:handled_by" json:"HandledBy"`
	Status      string  `gorm:"column:status" json:"Status"`
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
	FulfillmentStore        string  `gorm:"column:fulfillment_store;index:idx_store_status,priority:1" json:"Fulfillment Store"`
	Team                    string  `gorm:"column:team;index" json:"Team"`
	IsVerified              string  `gorm:"column:is_verified" json:"IsVerified"`
	FulfillmentStatus       string  `gorm:"column:fulfillment_status;index:idx_store_status,priority:2" json:"Fulfillment Status"`
	PackedBy                string  `gorm:"column:packed_by" json:"Packed By"`
	PackedTime              string  `gorm:"column:packed_time" json:"Packed Time"`
	PackagePhotoURL         string  `gorm:"column:package_photo_url" json:"Package Photo"`
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
	ID        uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	Timestamp string `gorm:"index;column:timestamp" json:"Timestamp"`
	Sender    string `gorm:"index;column:sender" json:"Sender"`
	Team      string `gorm:"index;column:team" json:"Team"`
	Message   string `gorm:"column:message" json:"Message"`
	Type      string `gorm:"column:type" json:"Type"` // "text", "image", "file"
	FileURL   string `gorm:"column:file_url" json:"FileURL"`
}

type EditLog struct {
	ID           uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	Timestamp    string `gorm:"index;column:timestamp" json:"Timestamp"`
	OrderID      string `gorm:"index;column:order_id" json:"OrderID"`
	Requester    string `gorm:"column:requester" json:"Requester"`
	FieldChanged string `gorm:"column:field_changed" json:"Field Changed"`
	OldValue     string `gorm:"column:old_value" json:"Old Value"`
	NewValue     string `gorm:"column:new_value" json:"New Value"`
}

type UserActivityLog struct {
	ID        uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	Timestamp string `gorm:"index;column:timestamp" json:"Timestamp"`
	User      string `gorm:"index;column:user" json:"User"`
	Action    string `gorm:"column:action" json:"Action"`
	Details   string `gorm:"column:details" json:"Details"`
}

type Role struct {
	ID          uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	RoleName    string `gorm:"uniqueIndex;column:role_name" json:"RoleName"`
	Description string `gorm:"column:description" json:"Description"`
}

type RolePermission struct {
	ID        uint   `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	RoleID    uint   `gorm:"index;column:role_id" json:"RoleID"`
	Role      string `gorm:"index;column:role" json:"Role"`
	Feature   string `gorm:"index;column:feature" json:"Feature"`
	IsEnabled bool   `gorm:"column:is_enabled" json:"IsEnabled"`
}

func (p *RolePermission) UnmarshalJSON(data []byte) error {
	type Alias RolePermission
	var aux struct {
		ID     interface{} `json:"ID"`
		RoleID interface{} `json:"RoleID"`
		Alias
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	*p = RolePermission(aux.Alias)

	// Helper function to convert interface to uint
	toUint := func(v interface{}) uint {
		if v == nil {
			return 0
		}
		switch val := v.(type) {
		case float64:
			return uint(val)
		case string:
			if u, err := strconv.ParseUint(val, 10, 32); err == nil {
				return uint(u)
			}
		}
		return 0
	}

	if aux.ID != nil {
		p.ID = toUint(aux.ID)
	}
	if aux.RoleID != nil {
		p.RoleID = toUint(aux.RoleID)
	}

	return nil
}

type IncentiveCalculator struct {
	ID        uint    `gorm:"primaryKey;column:id" json:"id"`
	ProjectID uint    `gorm:"index;column:project_id" json:"projectId"`
	Name      string  `gorm:"column:name" json:"name"`
	Type      string  `gorm:"column:type" json:"type"`
	Value     float64 `gorm:"column:value" json:"value"`
	Status    string  `gorm:"column:status" json:"status"`
	RulesJSON string  `gorm:"type:text;column:rules_json" json:"rulesJson"`
}

type IncentiveProject struct {
	ID                     uint                  `gorm:"primaryKey;column:id" json:"id"`
	ProjectName            string                `gorm:"column:project_name" json:"projectName"`
	CalculatorID           uint                  `gorm:"column:calculator_id" json:"calculatorId"`
	StartDate              string                `gorm:"column:start_date" json:"startDate"`
	EndDate                string                `gorm:"column:end_date" json:"endDate"`
	TargetTeam             string                `gorm:"column:target_team" json:"targetTeam"`
	Status                 string                `gorm:"column:status" json:"status"`
	ColorCode              string                `gorm:"column:color_code" json:"colorCode"`
	RequirePeriodSelection bool                  `gorm:"column:require_period_selection" json:"requirePeriodSelection"`
	DataSource             string                `gorm:"column:data_source" json:"dataSource"`
	CreatedAt              string                `gorm:"column:created_at" json:"createdAt"`
	Calculators            []IncentiveCalculator `gorm:"foreignKey:ProjectID" json:"calculators"`
}

type IncentiveResult struct {
	ID              uint    `gorm:"primaryKey;column:id" json:"id"`
	Timestamp       string  `gorm:"column:timestamp" json:"Timestamp"`
	ProjectID       uint    `gorm:"index;column:project_id" json:"projectId"`
	UserName        string  `gorm:"column:user_name" json:"userName"`
	TotalOrders     int     `gorm:"column:total_orders" json:"totalOrders"`
	TotalRevenue    float64 `gorm:"column:total_revenue" json:"totalRevenue"`
	TotalProfit     float64 `gorm:"column:total_profit" json:"totalProfit"`
	CalculatedValue float64 `gorm:"column:calculated_value" json:"calculatedValue"`
	IsCustom        bool    `gorm:"column:is_custom" json:"isCustom"`
	BreakdownJSON   string  `gorm:"type:text;column:breakdown_json" json:"breakdownJson"`
}

// Additional Structs for Incentive Logic (Defined in incentive_logic.go)
type IncentiveRules struct {
	Description         string           `json:"description"`
	ApplyTo             []string         `json:"applyTo"`
	MetricType          string           `json:"metricType"`
	MetricUnit          string           `json:"metricUnit"`
	CalculationPeriod   string           `json:"calculationPeriod"`
	ResetEveryPeriod    bool             `json:"resetEveryPeriod"`
	IsMarathon          bool             `json:"isMarathon"`
	AchievementTiers    []IncentiveTier  `json:"achievementTiers"`
	CommissionType      string           `json:"commissionType"`
	CommissionMethod    string           `json:"commissionMethod"`
	CommissionCondition string           `json:"commissionCondition"`
	CommissionRate      float64          `json:"commissionRate"`
	TargetAmount        float64          `json:"targetAmount"`
	CommissionTiers     []CommissionTier `json:"commissionTiers"`
	DistributionRule    DistributionRule `json:"distributionRule"`
	MinSalesRequired    float64          `json:"minSalesRequired"`
	MaxCommissionCap    float64          `json:"maxCommissionCap"`
	RequireApproval     bool             `json:"requireApproval"`
	ExcludeRefunded     bool             `json:"excludeRefunded"`
	IncludeTax          bool             `json:"includeTax"`
}

type DistributionRule struct {
	Method      string       `json:"method"`
	Allocations []Allocation `json:"allocations"`
}

type Allocation struct {
	MemberRoleOrName string  `json:"memberRoleOrName"`
	Percentage       float64 `json:"percentage"`
}

type IncentiveTier struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Target       float64 `json:"target"`
	RewardAmount float64 `json:"rewardAmount"`
	RewardType   string  `json:"rewardType"`
	SubPeriod    string  `json:"subPeriod"`
}

type CommissionTier struct {
	From float64  `json:"from"`
	To   *float64 `json:"to"`
	Rate float64  `json:"rate"`
}

type PayoutResult struct {
	CalculatorID   uint    `json:"calculatorId"`
	CalculatorName string  `json:"name"`
	MetricValue    float64 `json:"metricValue"`
	Amount         float64 `json:"amount"`
	Description    string  `json:"description"`
}

type IncentiveManualData struct {
	ID         uint    `gorm:"primaryKey;column:id" json:"id"`
	ProjectID  uint    `gorm:"index;column:project_id" json:"projectId"`
	Month      string  `gorm:"index;column:month" json:"month"` // Format: YYYY-MM
	MetricType string  `gorm:"column:metric_type" json:"metricType"`
	DataKey    string  `gorm:"column:data_key" json:"dataKey"` // Format: {period}_{targetId} e.g. "month_TeamA", "W1_user1"
	Value      float64 `gorm:"column:value" json:"value"`
}

type IncentiveCustomPayout struct {
	ID        uint    `gorm:"primaryKey;column:id" json:"id"`
	ProjectID uint    `gorm:"index;column:project_id" json:"projectId"`
	Month     string  `gorm:"index;column:month" json:"month"` // Format: YYYY-MM
	UserName  string  `gorm:"column:user_name" json:"userName"`
	Value     float64 `gorm:"column:value" json:"value"`
}

type PendingSync struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Payload    string    `gorm:"type:text" json:"payload"` // JSON of AppsScriptRequest
	Status     string    `gorm:"index;default:'pending'" json:"status"` // pending, processing, failed
	RetryCount int       `gorm:"default:0" json:"retryCount"`
	MaxRetries int       `gorm:"default:5" json:"maxRetries"`
	CreatedAt  time.Time `gorm:"index" json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type Shift struct {
	ID          uint      `gorm:"primaryKey;autoIncrement;column:id" json:"ID"`
	StoreName   string    `gorm:"index;column:store_name" json:"StoreName"`
	OpenedBy    string    `gorm:"column:opened_by" json:"OpenedBy"`
	OpenedAt    time.Time `gorm:"column:opened_at" json:"OpenedAt"`
	OpenPhoto   string    `gorm:"column:open_photo" json:"OpenPhoto"`
	ClosedBy    string    `gorm:"column:closed_by" json:"ClosedBy"`
	ClosedAt    *time.Time `gorm:"column:closed_at" json:"ClosedAt"`
	Status      string    `gorm:"column:status" json:"Status"` // "Open", "Closed"
	SummaryJSON string    `gorm:"type:text;column:summary_json" json:"SummaryJSON"`
}

type DeleteOrderRequest struct {
	OrderID            string `json:"orderId"`
	Team               string `json:"team"`
	UserName           string `json:"userName"`
	FulfillmentStore   string `json:"fulfillmentStore"`
	TelegramMessageID1 string `json:"telegramMessageId1"`
	TelegramMessageID2 string `json:"telegramMessageId2"`
	TelegramMessageID3 string `json:"telegramMessageId3"`
	TelegramChatId     string `json:"telegramChatId"`
}
