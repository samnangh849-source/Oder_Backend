/**
 * @OnlyCurrentDoc
 * កូដសម្រាប់រៀបចំរចនាសម្ព័ន្ធទិន្នន័យ (System Setup) ឱ្យស្របតាម Golang Backend ជំនាន់ចុងក្រោយ
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ រៀបចំប្រព័ន្ធ (Admin)')
    .addItem('🚀 បង្កើត/ធ្វើបច្ចុប្បន្នភាព រចនាសម្ព័ន្ធ Sheet', 'initializeSystem')
    .addItem('🔍 ពិនិត្យភាពត្រឹមត្រូវនៃ Header', 'validateSheetStructure')
    .addToUi();
}

const SYSTEM_STRUCTURE = {
  "Users": ["UserName", "Password", "Team", "FullName", "ProfilePictureURL", "Role", "IsSystemAdmin", "TelegramUsername", "TelegramStickerID"],
  "Stores": ["StoreName", "StoreType", "Address", "TelegramBotToken", "TelegramGroupID", "TelegramTopicID", "LabelPrinterURL", "CODAlertGroupID"],
  "Settings": ["Key", "Value", "Description"],
  "TeamsPages": ["ID", "Team", "PageName", "TelegramValue", "PageLogoURL", "DefaultStore", "TelegramTopicID"],
  "Products": ["Barcode", "ProductName", "Price", "Cost", "ImageURL", "Tags"],
  "Locations": ["ID", "Province", "District", "Sangkat"],
  "ShippingMethods": ["MethodName", "LogoURL", "AllowManualDriver", "RequireDriverSelection", "InternalCost", "CostShortcuts", "EnableDriverRecommendation"],
  "DeliveryGroups": ["ID", "StoreName", "ShippingMethod", "TelegramGroupID", "TelegramTopicID"],
  "Colors": ["ColorName"],
  "Drivers": ["DriverName", "ImageURL", "Phone", "InternalCost", "AssignedStores"],
  "BankAccounts": ["BankName", "LogoURL", "AssignedStores"],
  "PhoneCarriers": ["CarrierName", "Prefixes", "CarrierLogoURL"],
  "TelegramTemplates": ["ID", "Team", "Part", "Template"],
  
  // ប្រព័ន្ធស្តុក
  "Inventory": ["ID", "StoreName", "ProductName", "Barcode", "Quantity", "LastUpdated", "UpdatedBy"],
  "StockTransfers": ["TransferID", "Timestamp", "FromStore", "ToStore", "Barcode", "Quantity", "Status", "RequestedBy", "ApprovedBy", "ReceivedBy"],
  "Returns": ["ReturnID", "Timestamp", "OrderID", "StoreName", "Barcode", "Quantity", "Reason", "IsRestocked", "HandledBy"],
  
  // ប្រព័ន្ធគ្រប់គ្រងសិទ្ធិ (RBAC)
  "Roles": ["ID", "RoleName", "Description"],
  "RolePermissions": ["ID", "RoleID", "Role", "Feature", "IsEnabled"],

  // Driver Recommendation Setup
  "DriverRecommendations": ["ID", "DayOfWeek", "StoreName", "Province", "DriverName", "ShippingMethod"],

  // ការកម្មង់ និងចំណូល
  "AllOrders": [
    "Order ID", "Timestamp", "User", "Page", "TelegramValue", "Customer Name", "Customer Phone", 
    "Location", "Address Details", "Note", "Shipping Fee (Customer)", "Subtotal", "Grand Total", 
    "Products (JSON)", "Internal Shipping Method", "Internal Shipping Details", "Internal Cost", 
    "Payment Status", "Payment Info", "Discount ($)", "Delivery Unpaid", "Delivery Paid", 
    "Total Product Cost ($)", "Telegram Message ID 1", "Telegram Message ID 2", "Telegram Message ID 3", "Scheduled Time", 
    "Fulfillment Store", "Team", "IsVerified", "Fulfillment Status", "Packed By", "Packed Time", 
    "Package Photo", "Driver Name", "Tracking Number", "Dispatched Time", "Dispatched By", "Delivered Time", "Delivery Photo URL",
    "Cancel Reason", "Return Reason", "Return Photo", "Return Received By", "Return Received Time", "Delivery Photo Sent Count", "Delivery Telegram Message ID", "Delivery Daily Sequence", "Delivery Telegram Date"
  ],
  "RevenueDashboard": ["ID", "Timestamp", "Team", "Page", "Revenue", "FulfillmentStore"],
  
  // ប្រព័ន្ធប្រាក់លើកទឹកចិត្ត (Incentive)
  "IncentiveProjects": ["ID", "ProjectName", "CalculatorID", "StartDate", "EndDate", "TargetTeam", "Status", "ColorCode", "RequirePeriodSelection", "DataSource", "CreatedAt"],
  "IncentiveCalculators": ["ID", "ProjectID", "Name", "Type", "Value", "Status", "RulesJSON"],
  "IncentiveResults": ["ID", "Timestamp", "ProjectID", "UserName", "TotalOrders", "TotalRevenue", "TotalProfit", "CalculatedValue", "IsCustom"],
  "IncentiveManualData": ["ID", "ProjectID", "Month", "MetricType", "DataKey", "Value"],
  "IncentiveCustomPayouts": ["ID", "ProjectID", "Month", "UserName", "Value"],

  // ប្រព័ន្ធកម្សាន្ត (Entertainment)
  "Movies": ["ID", "Title", "Description", "Thumbnail", "VideoURL", "Type", "Language", "Country", "Category", "SeriesKey", "AddedAt"],

  // ប្រព័ន្ធប្រូម៉ូសិន (Promotions)
  "Promotions": ["ID", "Title", "ImageURL", "Category", "Description", "UpdatedAt", "UpdatedBy"],

  // ឯកសារយោង និង Chat
  "ChatMessages": ["ID", "Timestamp", "UserName", "Receiver", "MessageType", "Content", "FileID"],
  "EditLogs": ["ID", "Timestamp", "OrderID", "Requester", "Field Changed", "Old Value", "New Value"],
  "UserActivityLogs": ["ID", "Timestamp", "User", "Action", "Details"],
  "Shifts": ["ID", "StoreName", "OpenedBy", "OpenedAt", "OpenPhoto", "ClosedBy", "ClosedAt", "Status", "SummaryJSON"]
};

function initializeSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let createdCount = 0;
  let updatedCount = 0;

  for (const sheetName in SYSTEM_STRUCTURE) {
    let sheet = ss.getSheetByName(sheetName);
    const headers = SYSTEM_STRUCTURE[sheetName];

    if (!sheet) {
      // បង្កើត Sheet ថ្មីប្រសិនបើមិនទាន់មាន
      sheet = ss.insertSheet(sheetName);
      createdCount++;
      
      // ដាក់ Headers
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // កំណត់ពណ៌ និង Format ឱ្យ Headers
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground("#4CAF50")
                 .setFontColor("white")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");
      
      sheet.setFrozenRows(1); // Freeze ជួរទី១
    } else {
      // ធ្វើបច្ចុប្បន្នភាព Sheet ចាស់ (បន្ថែម Column ដែលខ្វះ)
      const existingHeadersRange = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1);
      const existingHeaders = existingHeadersRange.getValues()[0];
      
      let columnAdded = false;
      headers.forEach(header => {
        if (!existingHeaders.includes(header)) {
          const newColIndex = existingHeaders.length + 1;
          sheet.getRange(1, newColIndex).setValue(header);
          sheet.getRange(1, newColIndex)
               .setBackground("#FF9800") // ពណ៌ទឹកក្រូចដើម្បីចំណាំថា Column ថ្មី
               .setFontColor("white")
               .setFontWeight("bold");
          existingHeaders.push(header);
          columnAdded = true;
        }
      });
      if (columnAdded) updatedCount++;
    }
  }

  // កំណត់ទិន្នន័យគំរូបឋម (Sample Data)
  setupDefaultSettings(ss);
  setupDefaultTelegramTemplates(ss);
  setupSampleUsers(ss);
  setupSampleStores(ss);
  setupSampleTeamsPages(ss);
  setupSampleProducts(ss);
  setupSampleLocations(ss);
  setupSampleShippingMethods(ss);
  setupSampleColors(ss);
  setupSampleDrivers(ss);
  setupSampleBankAccounts(ss);
  setupSamplePhoneCarriers(ss);
  setupSampleRoles(ss);
  setupSampleRolePermissions(ss);
  setupSampleShifts(ss);

  const ui = SpreadsheetApp.getUi();
  ui.alert('✅ ជោគជ័យ!', `បានបង្កើត Sheet ថ្មីចំនួន: ${createdCount}\nបានធ្វើបច្ចុប្បន្នភាព Sheet ចាស់ចំនួន: ${updatedCount}\n\nរចនាសម្ព័ន្ធទិន្នន័យរបស់អ្នកឥឡូវនេះស៊ីគ្នា ១០០% ជាមួយ Backend ហើយ។\n\n📝 សូមកែប្រែទិន្នន័យគំរូឱ្យត្រឹមត្រូវតាមអាជីវកម្មរបស់អ្នក។`, ui.ButtonSet.OK);
}

function validateSheetStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  let errors = [];

  for (const sheetName in SYSTEM_STRUCTURE) {
    const sheet = ss.getSheetByName(sheetName);
    const requiredHeaders = SYSTEM_STRUCTURE[sheetName];

    if (!sheet) {
      errors.push(`❌ បាត់ Sheet: "${sheetName}"`);
      continue;
    }

    const lastCol = sheet.getLastColumn();
    let actualHeaders = [];
    if (lastCol > 0) {
      actualHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim().toLowerCase());
    }

    const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h.trim().toLowerCase()));
    
    if (missingHeaders.length > 0) {
      errors.push(`⚠️ Sheet "${sheetName}" ខ្វះក្បាលតារាង: ${missingHeaders.join(", ")}`);
    }
  }

  if (errors.length === 0) {
    ui.alert('✅ ត្រឹមត្រូវ!', 'រចនាសម្ព័ន្ធ Sheet ទាំងអស់គឺត្រឹមត្រូវតាមស្ដង់ដារ Backend។', ui.ButtonSet.OK);
  } else {
    ui.alert('❌ បញ្ហាត្រូវបានរកឃើញ', errors.join("\n"), ui.ButtonSet.OK);
  }
}

function setupDefaultSettings(ss) {
  const settingsSheet = ss.getSheetByName("Settings");
  if (!settingsSheet) return;

  const defaultSettings = [
    ["UploadFolderID", "ដាក់_ID_Folder_Google_Drive_របស់អ្នកនៅទីនេះ", "Folder សម្រាប់រក្សាទុករូបភាព"],
    ["StoreName", "My Store", "ឈ្មោះហាងរបស់អ្នក"]
  ];

  const data = settingsSheet.getDataRange().getValues();
  const existingKeys = data.map(row => row[0]);

  defaultSettings.forEach(setting => {
    if (!existingKeys.includes(setting[0])) {
      settingsSheet.appendRow(setting);
    }
  });
}

function setupDefaultTelegramTemplates(ss) {
  const templateSheet = ss.getSheetByName("TelegramTemplates");
  if (!templateSheet) return;

  const defaultTemplates = [
    ["TPL001", "Global", "Part1", "📃 *Page:* {{sourceInfo}}\n👨‍💻 *អ្នកលក់:* {{user}}\n🏪 *ដឹកចេញពី:* {{fulfillmentStore}}\n🚚 *ដឹកដោយ:* {{shippingMethod}}{{shippingDetails}}\n{{note}}\n\n🔔 *ការកម្ម៉ង់ថ្មី* | ID: `{{orderId}}`\n--------------------------------------"],
    ["TPL002", "Global", "Part2", "✅សូមបងពិនិត្យលេខទូរស័ព្ទ និងទីតាំងម្ដងទៀតបង 🙏\n📃 *Page:* {{sourceInfo}}\n👤 *អតិថិជន:* {{customerName}}\n📞 *លេខទូរស័ព្ទ:* {{customerPhone}}\n📍 *ទីតាំង:* {{location}}\n🏠 *អាសយដ្ឋាន:* {{addressDetails}}\n\n *----------- ផលិតផល -----------*\n{{productsList}}\n\n💰 *សរុប:*\n  - តម្លៃទំនិញ: ${{subtotal}}\n  - សេវាដឹក: ${{shippingFee}}\n  - *សរុបចុងក្រោយ: ${{grandTotal}}*\n {{paymentStatus}}\n\n🚚 *វិធីសាស្រ្តដឹកជញ្ជូន:* {{shippingMethod}}\n{{date}}\n--------------------------------------\nអរគុណបង🙏🥰 | ID: `{{orderId}}`"],
    ["TPL003", "Global", "Part3", "📦 *ព័ត៌មានការវេចខ្ចប់*\n🧑‍🔧 *អ្នកវេចខ្ចប់:* *{{packedBy}}*\n⏰ *ពេលវេលា:* *{{packedTime}}*\n🚚 *អ្នកដឹក:* *{{driverName}}*\n🏷️ *លេខកូដដឹកជញ្ជូន:* `{{trackingNumber}}`\n[📷 រូបភាពវេចខ្ចប់]({{packagePhotoUrl}}){{dispatchInfo}}{{deliveryInfo}}"]
  ];

  const lastRow = templateSheet.getLastRow();
  let existingIDs = [];
  if (lastRow > 0) {
    const data = templateSheet.getRange(1, 1, lastRow, 1).getValues();
    existingIDs = data.map(row => String(row[0]));
  }

  defaultTemplates.forEach(template => {
    if (!existingIDs.includes(String(template[0]))) {
      templateSheet.appendRow(template);
    }
  });
}

// --- Helper: បញ្ចូលទិន្នន័យគំរូប្រសិនបើ Sheet ទទេ ---
function insertSampleIfEmpty(ss, sheetName, rows) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() > 1) return; // រំលងប្រសិនបើមានទិន្នន័យរួចហើយ
  rows.forEach(row => sheet.appendRow(row));
}

// --- ទិន្នន័យគំរូសម្រាប់គ្រប់ Sheet ---

function setupSampleUsers(ss) {
  insertSampleIfEmpty(ss, "Users", [
    ["admin", "admin123", "TeamA", "Admin User", "", "Admin", true, ""],
    ["manager1", "manager123", "TeamA", "ប្រធានក្រុម ១", "", "Manager", false, ""],
    ["seller1", "seller123", "TeamA", "អ្នកលក់ ១", "", "Sale", false, ""],
    ["packer1", "packer123", "TeamA", "អ្នកវេចខ្ចប់ ១", "", "Packer", false, ""]
  ]);
}

function setupSampleStores(ss) {
  // Stores.TelegramTopicID = Topic ID default របស់ Store (fallback ប្រសិនបើ Page មិនមាន TopicID)
  insertSampleIfEmpty(ss, "Stores", [
    ["MainStore", "Warehouse", "ភ្នំពេញ", "ដាក់_BOT_TOKEN_នៅទីនេះ", "ដាក់_GROUP_ID_នៅទីនេះ", "ដាក់_TOPIC_ID_នៅទីនេះ", "", ""],
    ["BranchStore", "Branch", "សៀមរាប", "", "", "", "", ""]
  ]);
}

function setupSampleTeamsPages(ss) {
  // TeamsPages.TelegramTopicID = Topic ID ជាក់លាក់សម្រាប់ Page នីមួយៗ
  // ទម្រង់: "StoreName:TopicID, StoreName:TopicID" (ច្រើនឃ្លាំង) ឬ "12345" (មួយឃ្លាំង)
  insertSampleIfEmpty(ss, "TeamsPages", [
    [1, "TeamA", "Page A", "@page_a_telegram", "", "MainStore", "MainStore:10617, BranchStore:20834"],
    [2, "TeamA", "Page B", "@page_b_telegram", "", "MainStore", "MainStore:10618, BranchStore:20835"],
    [3, "TeamB", "Page C", "@page_c_telegram", "", "BranchStore", "30901"]
  ]);
}

function setupSampleProducts(ss) {
  insertSampleIfEmpty(ss, "Products", [
    ["PRD001", "ផលិតផល A", 10.00, 5.00, "", "popular"],
    ["PRD002", "ផលិតផល B", 25.50, 12.00, "", "new"],
    ["PRD003", "ផលិតផល C", 8.00, 3.50, "", ""]
  ]);
}

function setupSampleLocations(ss) {
  insertSampleIfEmpty(ss, "Locations", [
    [1, "ភ្នំពេញ", "ចំការមន", "ទន្លេបាសាក់"],
    [2, "ភ្នំពេញ", "ដូនពេញ", "វត្តភ្នំ"],
    [3, "សៀមរាប", "សៀមរាប", "សាលាកំរើក"]
  ]);
}

function setupSampleShippingMethods(ss) {
  insertSampleIfEmpty(ss, "ShippingMethods", [
    ["Express", "", true, false, 2.00, "1.5,2,2.5,3", false],
    ["Standard", "", false, false, 1.50, "1,1.5,2", false],
    ["Driver", "", true, true, 0, "", true]
  ]);
}

function setupSampleColors(ss) {
  insertSampleIfEmpty(ss, "Colors", [
    ["ក្រហម"], ["ខៀវ"], ["បៃតង"], ["ខ្មៅ"], ["ស"], ["លឿង"]
  ]);
}

function setupSampleDrivers(ss) {
  insertSampleIfEmpty(ss, "Drivers", [
    ["បងឆាយ", "", "012345678", 2.00, "MainStore"],
    ["បងដារា", "", "098765432", 2.50, "MainStore,BranchStore"]
  ]);
}

function setupSampleBankAccounts(ss) {
  insertSampleIfEmpty(ss, "BankAccounts", [
    ["ABA", "", "MainStore"],
    ["ACLEDA", "", "MainStore,BranchStore"],
    ["Wing", "", "MainStore"]
  ]);
}

function setupSamplePhoneCarriers(ss) {
  insertSampleIfEmpty(ss, "PhoneCarriers", [
    ["Smart", "010,015,016,069,070,093,098", ""],
    ["Cellcard", "011,012,014,017,061,076,077,078,079,085,089,092,095,099", ""],
    ["Metfone", "031,060,066,067,068,071,088,090,097", ""]
  ]);
}

function setupSampleRoles(ss) {
  insertSampleIfEmpty(ss, "Roles", [
    [1, "Admin", "System Administrator - Full Access"],
    [2, "Manager", "Store/Team Manager"],
    [3, "Sale", "Sales representative"],
    [4, "Fulfillment", "Order packing & fulfillment staff"],
    [5, "Driver", "Delivery driver"],
    [6, "Packer", "Packaging team member"]
  ]);
}

function setupSampleRolePermissions(ss) {
  const features = [
    "view_order_list", "edit_order", "delete_order", "verify_order", "create_order",
    "access_sales_portal", "access_fulfillment", "view_admin_dashboard", "view_entertainment",
    "manage_roles", "manage_permissions", "view_revenue", "export_data", "migrate_data",
    "manage_inventory", "stock_transfer", "view_team_leaderboard", "set_targets",
    "view_promotions", "manage_promotions"
  ];

  const permissions = [];
  let id = 1;

  // 1. Admin - Everything Enabled
  features.forEach(f => {
    permissions.push([id++, "Admin", f, true]);
  });

  // 2. Manager
  const managerEnabled = {
    "view_order_list": true, "edit_order": true, "delete_order": true, "verify_order": true, "create_order": true,
    "access_sales_portal": true, "access_fulfillment": true, "view_admin_dashboard": true, "view_entertainment": true,
    "view_revenue": true, "export_data": true, "manage_inventory": true, "stock_transfer": true,
    "view_team_leaderboard": true, "set_targets": true,
    "view_promotions": true, "manage_promotions": true
  };
  features.forEach(f => {
    permissions.push([id++, "Manager", f, !!managerEnabled[f]]);
  });

  // 3. Sale
  const saleEnabled = {
    "view_order_list": true, "edit_order": true, "create_order": true,
    "access_sales_portal": true, "view_entertainment": true, "view_team_leaderboard": true
  };
  features.forEach(f => {
    permissions.push([id++, "Sale", f, !!saleEnabled[f]]);
  });

  // 4. Fulfillment
  const fulfillmentEnabled = {
    "view_order_list": true, "edit_order": true, "verify_order": true, "access_fulfillment": true,
    "view_entertainment": true, "manage_inventory": true, "stock_transfer": true
  };
  features.forEach(f => {
    permissions.push([id++, "Fulfillment", f, !!fulfillmentEnabled[f]]);
  });

  // 5. Packer
  const packerEnabled = {
    "view_order_list": true, "access_fulfillment": true, "view_entertainment": true
  };
  features.forEach(f => {
    permissions.push([id++, "Packer", f, !!packerEnabled[f]]);
  });

  // 6. Driver
  const driverEnabled = {
    "view_order_list": true, "access_fulfillment": true, "view_entertainment": true,
    "view_promotions": true
  };
  features.forEach(f => {
    permissions.push([id++, "Driver", f, !!driverEnabled[f]]);
  });

  insertSampleIfEmpty(ss, "RolePermissions", permissions);
}

function setupSampleShifts(ss) {
  insertSampleIfEmpty(ss, "Shifts", [
    [1, "MainStore", "Admin User", "2024-01-01 08:00:00", "", "Admin User", "2024-01-01 17:00:00", "Closed", "ទិន្នន័យសង្ខេបគំរូ: ៥ កញ្ចប់"]
  ]);
}
