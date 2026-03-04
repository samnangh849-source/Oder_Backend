
export interface User {
  UserName: string;
  Password?: string; 
  FullName: string;
  Role: string;
  Team: string;
  IsSystemAdmin: boolean;
  ProfilePictureURL: string;
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

export type FulfillmentStatus = 'Pending' | 'Processing' | 'Ready to Ship' | 'Shipped' | 'Delivered' | 'Cancelled';

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
    "Scheduled Time": string;
    "Fulfillment Store": string;
    "Brand/Sales"?: string;
    Team: string;
    IsVerified?: boolean;
    FulfillmentStatus?: FulfillmentStatus;
    "Packed By"?: string;
    "Dispatched By"?: string;
    "Package Photo URL"?: string;
    "Driver Name"?: string;
    "Tracking Number"?: string;
    "Delivery Photo URL"?: string;
}

export interface InventoryItem {
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
  StoreType?: string;
  Address?: string;
  TelegramBotToken?: string;
  TelegramGroupID?: string;
  TelegramTopicID?: string;
  LabelPrinterURL?: string;
  CODAlertGroupID?: string;
  Location?: string;
}

export interface TeamPage {
  PageName: string;
  Team: string;
  TelegramValue: string;
  PageLogoURL: string;
  DefaultStore?: string;
}

export interface ShippingMethod {
  MethodName: string;
  RequireDriverSelection: boolean;
  LogosURL: string; // Matches Go backend conversion
}

export interface Driver {
  DriverName: string;
  ImageURL: string;
}

export interface BankAccount {
  BankName: string;
  AccountName?: string;
  LogoURL: string;
  AssignedStores?: string;
}

// Added Target interface to fix missing member error in performance hooks/pages
export interface Target {
  UserName: string;
  Month: string;
  TargetAmount: number;
}

// Added BackendChatMessage interface to fix missing member error in ChatWidget
export interface BackendChatMessage {
    UserName: string;
    Timestamp: string;
    MessageType: 'text' | 'image' | 'audio' | 'video';
    Content: string;
    FileID?: string;
    IsDeleted?: boolean;
    IsPinned?: boolean;
    ReplyTo?: {
        ID: string;
        User: string;
        Content: string;
        Type: string;
    };
}

// Added ChatMessage interface to fix missing member error in ChatWidget
export interface ChatMessage {
    id: string;
    user: string;
    fullName: string;
    avatar: string;
    content: string;
    timestamp: string;
    type: 'text' | 'image' | 'audio' | 'video';
    fileID?: string;
    duration?: string; // New field for audio/video duration
    isOptimistic?: boolean; // New field for optimistic UI
    isDeleted?: boolean;
    isPinned?: boolean;
    replyTo?: {
        id: string;
        user: string;
        content: string;
        type: string;
    };
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
}

export interface LocationInfo {
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
