export interface User {
  UserName: string;
  Password?: string; 
  FullName: string;
  Role: string;
  Team: string;
  IsSystemAdmin: boolean;
  ProfilePictureURL: string;
  TelegramUsername: string; // Added to match Go
  Permissions?: RolePermission[]; // Added for frontend logic
}

export interface MasterProduct {
  ProductName: string;
  Barcode: string;
  Price: number;
  Cost: number;
  ImageURL: string;
  Tags?: string; 
}

export interface Product {
    id: number;
    name: string;
    quantity: number;
    originalPrice: number;
    finalPrice: number;
    total: number;
    discountPercent: number;
    colorInfo: string;
    image: string;
    cost: number; 
    tags?: string;
}

export type FulfillmentStatus = 'Pending' | 'Scheduled' | 'Processing' | 'Ready to Ship' | 'Shipped' | 'Delivered' | 'Cancelled';

// *** CRITICAL: Exact match with Go struct JSON tags ***
export interface FullOrder {
    Timestamp: string;
    "Order ID": string;
    User: string;
    Page: string;
    TelegramValue: string;
    "Customer Name": string;
    "Customer Phone": string;
    Location: string;
    "Address Details": string;
    Note: string;
    "Shipping Fee (Customer)": number;
    Subtotal: number;
    "Grand Total": number;
    "Products (JSON)": string;
    "Internal Shipping Method": string;
    "Internal Shipping Details": string;
    "Internal Cost": number;
    "Payment Status": string;
    "Payment Info": string;
    "Discount ($)": number;
    "Delivery Unpaid": number;
    "Delivery Paid": number;
    "Total Product Cost ($)": number;
    "Telegram Message ID 1": string;
    "Telegram Message ID 2": string;
    "Telegram Message ID 3": string;
    "Scheduled Time": string;
    "Fulfillment Store": string;
    Team: string;
    IsVerified: string; // Changed to string to match Go
    FulfillmentStatus: FulfillmentStatus;
    "Packed By": string;
    "Packed Time": string;
    "Package Photo URL": string;
    "Driver Name": string;
    "Tracking Number": string;
    "Dispatched Time": string;
    "Dispatched By": string;
    "Delivered Time": string;
    "Delivery Photo URL": string;
}

export interface InventoryItem {
    id?: number; // Added for GORM
    StoreName: string;
    Barcode: string;
    Quantity: number;
    LastUpdated?: string;
    UpdatedBy?: string;
}

export interface StockTransfer {
    TransferID: string;
    Timestamp: string;
    FromStore: string;
    ToStore: string;
    Barcode: string;
    Quantity: number;
    Status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
    RequestedBy: string;
    ApprovedBy?: string;
    ReceivedBy?: string;
}

export interface ReturnOrder {
    ReturnID: string;
    Timestamp: string;
    OrderID: string;
    StoreName: string;
    Barcode: string;
    Quantity: number;
    Reason: string;
    IsRestocked: boolean;
    HandledBy: string;
}

export interface ParsedOrder extends Omit<FullOrder, "Products (JSON)"> {
    Products: Product[];
}

export interface Store {
  StoreName: string;
  StoreType: string;
  Address: string;
  TelegramBotToken: string;
  TelegramGroupID: string;
  TelegramTopicID: string;
  LabelPrinterURL: string;
  CODAlertGroupID: string;
}

export interface TeamPage {
  ID?: number; // Added to match Go
  PageName: string;
  Team: string;
  TelegramValue: string;
  PageLogoURL: string;
  DefaultStore?: string;
  TelegramTopicID?: string;
}

export interface ShippingMethod {
  MethodName: string;
  LogoURL: string; // Matches Go backend json tag
  AllowManualDriver: boolean;
  RequireDriverSelection: boolean;
  InternalCost: number;
  CostShortcuts: string;
  EnableDriverRecommendation?: boolean;
}

export interface DriverRecommendation {
  ID: number;
  DayOfWeek: string;
  StoreName: string;
  Province: string;
  DriverName: string;
  ShippingMethod: string;
}

export interface Driver {
  DriverName: string;
  ImageURL: string;
  Phone: string;
  VehiclePlate: string;
}

export interface BankAccount {
  BankName: string;
  LogoURL: string;
  AssignedStores: string;
}

export interface Target {
  UserName: string;
  Month: string;
  TargetAmount: number;
}

export interface UserActivityLog {
    id?: number;
    Timestamp: string;
    User: string;
    Action: string;
    Details: string;
}

export interface EditLog {
    id?: number;
    Timestamp: string;
    OrderID: string;
    Requester: string;
    "Field Changed": string;
    "Old Value": string;
    "New Value": string;
    Approver?: string; // Restored
}

export interface BackendChatMessage {
    id?: number;
    Timestamp: string;
    UserName: string;
    Receiver: string;
    MessageType: string;
    Content: string;
    FileID?: string;
    ReplyTo?: { // Restored
        ID: string;
        User: string;
        Content: string;
        Type: string;
    };
}

export interface ChatMessage {
    id: string;
    backendId?: number;
    user: string;
    fullName: string;
    avatar: string;
    content: string;
    timestamp: string;
    type: 'text' | 'image' | 'audio' | 'video';
    fileID?: string;
    duration?: string;
    isOptimistic?: boolean;
    isDeleted?: boolean;
    isPinned?: boolean;
    replyTo?: {
        id: string;
        user: string;
        content: string;
        type: string;
    };
}

export interface RolePermission {
    id?: number;
    role: string;
    feature: string;
    isEnabled: boolean;
}

export interface Role {
    id?: number;
    roleName: string;
    description: string;
}

export interface Notification {
    id: string;
    message: string;
    type: 'success' | 'info' | 'error';
    title?: string;
    duration?: number;
}

export interface AppData {
    users: User[];
    products: MasterProduct[];
    pages: TeamPage[];
    locations: LocationInfo[];
    shippingMethods: ShippingMethod[];
    drivers: Driver[];
    bankAccounts: BankAccount[];
    phoneCarriers: PhoneCarrier[];
    colors: ColorInfo[];
    stores: Store[];
    settings?: any;
    targets?: Target[];
    inventory?: InventoryItem[];
    stockTransfers?: StockTransfer[];
    returns?: ReturnOrder[];
    permissions?: RolePermission[];
    roles?: Role[];
    orders?: ParsedOrder[];
    driverRecommendations?: DriverRecommendation[];
    movies?: Movie[];
}

export interface LocationInfo {
  id?: number;
  Province: string;
  District: string;
  Sangkat: string;
}

export interface ColorInfo {
  ColorName: string;
}

export interface PhoneCarrier {
  CarrierName: string;
  Prefixes: string;
  CarrierLogoURL: string;
}

// --- Incentive System Types (Aligned with Go + Restored Complexity) ---

export type CalculatorType = 'Achievement' | 'Commission';

export interface IncentiveTier {
    id: string;
    name?: string;
    subPeriod?: string; 
    target: number;
    rewardAmount: number;
    rewardType: 'Fixed Cash' | 'Percentage' | 'Point';
}

export interface CommissionTier {
    id: string;
    from: number;
    to: number | null; 
    rate: number; 
}

export interface DistributionRule {
    method: 'Equal Split' | 'Percentage Allocation' | 'Performance-Based Split';
    allocations?: { memberRoleOrName: string; percentage: number }[];
}

export interface IncentiveCalculator {
    id?: number; // Go uint
    name: string;
    type: string; // Achievement or Commission
    value: number; // Base value
    rulesJson?: string; // For backend storage
    
    // Frontend fields (will be serialized to rulesJson)
    status?: 'Draft' | 'Active' | 'Disable';
    departmentOrRole?: string[];
    applyTo?: string[];
    metricType?: 'Sales Amount' | 'Number of Orders' | 'Number of Videos' | 'Leads Generated' | 'Revenue' | 'Profit' | 'Custom KPI';
    metricUnit?: 'USD' | 'Count' | '%';
    calculationPeriod?: 'Daily' | 'Weekly' | 'Monthly' | 'Per Order' | 'Custom Range';
    resetEveryPeriod?: boolean;
    startDate?: string;
    endDate?: string;
    achievementTiers?: IncentiveTier[];
    commissionType?: 'Flat Commission' | 'Above Target Commission' | 'Tiered Commission' | 'Product-Based Commission';
    commissionMethod?: 'Percentage' | 'Fixed Amount';
    commissionCondition?: 'On Total Sales' | 'Above Target' | 'Per Transaction';
    targetAmount?: number;
    commissionRate?: number;
    commissionTiers?: CommissionTier[];
    minSalesRequired?: number;
    maxCommissionCap?: number;
    isMarathon?: boolean;
    subPeriodCheck?: boolean;
    requireApproval?: boolean;
    excludeRefunded?: boolean;
    includeTax?: boolean;
    distributionRule?: DistributionRule;
}

export interface IncentiveProject {
    id?: number; // Go uint
    projectName: string;
    calculatorId: number;
    startDate: string;
    endDate: string;
    targetTeam: string;
    status: string;
    
    // Frontend fields
    createdAt?: string;
    colorCode?: string;
    requirePeriodSelection?: boolean;
    dataSource?: 'system' | 'manual';
    calculators?: IncentiveCalculator[]; // For frontend display
}

export interface IncentiveResult {
    id: number;
    projectId: number;
    userName: string;
    totalOrders: number;
    totalRevenue: number;
    totalProfit: number;
    calculatedValue: number;
    isCustom?: boolean;
    breakdownJson?: string;
}

export interface Movie {
    ID: string;
    Title: string;
    Description: string;
    Thumbnail: string;
    VideoURL: string; // .m3u8 link
    Type: 'short' | 'long' | 'series';
    Language: string;
    Country: string;
    Category: string;
    AddedAt: string;
    SeriesKey?: string; // For grouping episodes
}

export interface IncentiveManualData {
    id: number;
    projectId: number;
    month: string;
    metricType: string;
    dataKey: string;
    value: number;
}

export interface IncentiveCustomPayout {
    id: number;
    projectId: number;
    month: string;
    userName: string;
    value: number;
}
