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
  "Users": ["UserName", "Password", "Team", "FullName", "ProfilePictureURL", "Role", "IsSystemAdmin", "TelegramUsername"],
  "Stores": ["StoreName", "StoreType", "Address", "TelegramBotToken", "TelegramGroupID", "TelegramTopicID", "LabelPrinterURL", "CODAlertGroupID"],
  "Settings": ["Key", "Value", "Description"],
  "TeamsPages": ["ID", "Team", "PageName", "TelegramValue", "PageLogoURL", "DefaultStore", "TelegramTopicID"],
  "Products": ["Barcode", "ProductName", "Price", "Cost", "ImageURL", "Tags"],
  "Locations": ["ID", "Province", "District", "Sangkat"],
  "ShippingMethods": ["MethodName", "LogoURL", "AllowManualDriver", "RequireDriverSelection", "InternalCost", "CostShortcuts", "EnableDriverRecommendation"],
  "Colors": ["ColorName"],
  "Drivers": ["DriverName", "ImageURL", "Phone", "InternalCost", "AssignedStores"],
  "BankAccounts": ["BankName", "LogoURL", "AssignedStores"],
  "PhoneCarriers": ["CarrierName", "Prefixes", "CarrierLogoURL"],
  "TelegramTemplates": ["ID", "Team", "Part", "Template"],
  
  // ប្រព័ន្ធស្តុក
  "Inventory": ["ID", "StoreName", "Barcode", "Quantity", "LastUpdated", "UpdatedBy"],
  "StockTransfers": ["TransferID", "Timestamp", "FromStore", "ToStore", "Barcode", "Quantity", "Status", "RequestedBy", "ApprovedBy", "ReceivedBy"],
  "Returns": ["ReturnID", "Timestamp", "OrderID", "StoreName", "Barcode", "Quantity", "Reason", "IsRestocked", "HandledBy"],
  
  // ប្រព័ន្ធគ្រប់គ្រងសិទ្ធិ (RBAC)
  "Roles": ["ID", "RoleName", "Description"],
  "RolePermissions": ["ID", "Role", "Feature", "IsEnabled"],

  // Driver Recommendation Setup
  "DriverRecommendations": ["ID", "DayOfWeek", "StoreName", "Province", "DriverName", "ShippingMethod"],

  // ការកម្មង់ និងចំណូល
  "AllOrders": [
    "Order ID", "Timestamp", "User", "Page", "TelegramValue", "Customer Name", "Customer Phone", 
    "Location", "Address Details", "Note", "Shipping Fee (Customer)", "Subtotal", "Grand Total", 
    "Products (JSON)", "Internal Shipping Method", "Internal Shipping Details", "Internal Cost", 
    "Payment Status", "Payment Info", "Discount ($)", "Delivery Unpaid", "Delivery Paid", 
    "Total Product Cost ($)", "Telegram Message ID 1", "Telegram Message ID 2", "Scheduled Time", 
    "Fulfillment Store", "Team", "IsVerified", "Fulfillment Status", "Packed By", 
    "Package Photo URL", "Driver Name", "Tracking Number", "Dispatched Time", "Delivered Time", "Delivery Photo URL"
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

  // ឯកសារយោង និង Chat
  "ChatMessages": ["ID", "Timestamp", "UserName", "Receiver", "MessageType", "Content", "FileID"],
  "EditLogs": ["ID", "Timestamp", "OrderID", "Requester", "Field Changed", "Old Value", "New Value"],
  "UserActivityLogs": ["ID", "Timestamp", "User", "Action", "Details"]
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

  // កំណត់ទិន្នន័យចាំបាច់បឋម (Default Settings)
  setupDefaultSettings(ss);

  const ui = SpreadsheetApp.getUi();
  ui.alert('✅ ជោគជ័យ!', `បានបង្កើត Sheet ថ្មីចំនួន: ${createdCount}\nបានធ្វើបច្ចុប្បន្នភាព Sheet ចាស់ចំនួន: ${updatedCount}\n\nរចនាសម្ព័ន្ធទិន្នន័យរបស់អ្នកឥឡូវនេះស៊ីគ្នា ១០០% ជាមួយ Backend ហើយ។`, ui.ButtonSet.OK);
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
