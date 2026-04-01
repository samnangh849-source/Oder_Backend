/**
 */

const SCRIPT_SECRET_KEY = "168333@$Oudom"; 

const CONFIG = {
  USERS_SHEET: 'Users',
  STORES_SHEET: 'Stores', 
  SETTINGS_SHEET: 'Settings',
  PAGES_SHEET: 'TeamsPages',
  PRODUCTS_SHEET: 'Products',
  LOCATIONS_SHEET: 'Locations',
  SHIPPING_METHODS_SHEET: 'ShippingMethods',
  COLORS_SHEET: 'Colors',
  DRIVERS_SHEET: 'Drivers',
  BANK_ACCOUNTS_SHEET: 'BankAccounts',
  REVENUE_SHEET: 'RevenueDashboard',
  TELEGRAM_TEMPLATES_SHEET: 'TelegramTemplates',
  PHONE_CARRIERS_SHEET: 'PhoneCarriers',
  EDIT_LOGS_SHEET: 'EditLogs',
  USER_ACTIVITY_LOGS_SHEET: 'UserActivityLogs',
  FORMULA_REPORT_SHEET: 'FormulaReport',
  ALL_ORDERS_SHEET: 'AllOrders',
  ORDER_SHEET_PREFIX: 'Orders_',
  CHAT_MESSAGES_SHEET: 'ChatMessages',
  ROLES_SHEET: 'Roles',
  ROLE_PERMISSIONS_SHEET: 'RolePermissions',
  INVENTORY_SHEET: 'Inventory',
  STOCK_TRANSFERS_SHEET: 'StockTransfers',
  RETURNS_SHEET: 'Returns',
  DRIVER_RECOMMENDATIONS_SHEET: 'DriverRecommendations',
  INCENTIVE_RESULTS_SHEET: 'IncentiveResults',
  MOVIES_SHEET: 'Movies'
};

// --- មុខងារជំនួយ (Helpers) ---

function formatPhoneNumber(phone) {
  if (!phone) return "";
  let p = String(phone).trim();
  p = p.replace(/[\s-]/g, ""); 
  if (p.length > 0 && p.charAt(0) !== '0') return '0' + p;
  return p;
}

function normalizeKey(str) {
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * មុខងារចម្បងសម្រាប់ទទួល Request ពី Backend (Golang)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return createJsonResponse({ status: 'locked' }, 429);

  try {
    if (!e.postData || !e.postData.contents) return createJsonResponse({ status: 'error', message: 'មិនមានទិន្នន័យបញ្ជូនមកទេ' }, 400);
    const contents = JSON.parse(e.postData.contents);

    if (contents.secret !== SCRIPT_SECRET_KEY) return createJsonResponse({ status: 'error', message: 'គ្មានសិទ្ធិអនុញ្ញាតទេ' }, 401);

    let user = contents.userName || "System";

    switch (contents.action) {
      case 'checkScheduledOrders':
        processScheduledOrders(); 
        return createJsonResponse({ status: 'success' });

      case 'submitOrder':
        const submitData = contents.orderData || contents;
        const result = processOrder(submitData);
        logUserActivity(user, "បង្កើតការកម្មង់ថ្មី", `លេខសម្គាល់: ${result.orderId}`);
        return createJsonResponse({ status: 'success', orderId: result.orderId });
        
      case 'updateOrderTelegram':
        const updateData = contents.orderData || contents;
        const updateRes = updateOrderTelegram(updateData);
        return createJsonResponse({ status: 'success', messageIds: updateRes });
        
      case 'deleteOrderTelegram':
        const deleteData = contents.orderData || contents;
        deleteOrderTelegramMessages(deleteData);
        return createJsonResponse({ status: 'success' });
        
      case 'addRow': 
        return handleAddRow(contents);

      case 'deleteRow': 
        return handleDeleteRow(contents);

      case 'updateSheet':
        return handleUpdateSheet(contents);

      case 'renameFile':
        if (!contents.fileID || !contents.newName) {
          return createJsonResponse({ status: 'error', message: 'fileID និង newName ត្រូវតែមាន' });
        }
        try {
          const file = DriveApp.getFileById(contents.fileID);
          file.setName(contents.newName);
          return createJsonResponse({ status: 'success' });
        } catch (e) {
          return createJsonResponse({ status: 'error', message: 'Rename បរាជ័យ: ' + e.message });
        }

      case 'uploadImage':
        console.log("📤 [uploadImage] Request received: fileName=" + contents.fileName + " mimeType=" + contents.mimeType);
        try {
          // 1. Upload to Drive
          const upRes = uploadImageToDrive(contents.fileData, contents.fileName, contents.mimeType, contents.uploadFolderID, contents.userName);
          console.log("📤 [uploadImage] Upload success: " + upRes.url);

          // 2. Metadata Updates (Sync to Sheets)
          const orderId = contents.orderId || contents.orderID;
          if (orderId) {
             console.log("📝 [uploadImage] Syncing Order: " + orderId);
             let team = contents.team || (contents.orderData && contents.orderData.team) || "";

             if (!team) {
               const ss = SpreadsheetApp.getActiveSpreadsheet();
               const allOrders = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);
               if (allOrders) {
                 const vals = allOrders.getDataRange().getValues();
                 const hdrs = vals[0].map(h => normalizeKey(h));
                 const idIdx = hdrs.indexOf(normalizeKey("Order ID"));
                 const teamIdx = hdrs.indexOf(normalizeKey("Team"));
                 if (idIdx !== -1 && teamIdx !== -1) {
                   for (let i = 1; i < vals.length; i++) {
                     if (normalizeKey(vals[i][idIdx]) === normalizeKey(orderId)) {
                       team = String(vals[i][teamIdx]).trim();
                       break;
                     }
                   }
                 }
               }
             }
             
             const updatedFields = {};
             if (contents.targetColumn) updatedFields[contents.targetColumn] = upRes.url;
             if (contents.newData) {
                for (let k in contents.newData) updatedFields[k] = contents.newData[k];
             }
             
             updateOrderInSheets(orderId, team, updatedFields);
             console.log("✅ [uploadImage] Sync finished for: " + orderId);
          } else if (contents.sheetName && contents.primaryKey && contents.targetColumn) {
             // Handle generic table updates
             const newData = {};
             newData[contents.targetColumn] = upRes.url;
             handleUpdateSheet({
               sheetName: contents.sheetName,
               primaryKey: contents.primaryKey,
               newData: newData
             });
             console.log("✅ [uploadImage] Generic Sheet updated: " + contents.sheetName);
          } else if (contents.userName && contents.fileName === 'profile_picture') {
             // Handle user profile picture
             handleUpdateSheet({
               sheetName: CONFIG.USERS_SHEET,
               primaryKey: { "UserName": contents.userName },
               newData: { "ProfilePictureURL": upRes.url }
             });
             console.log("✅ [uploadImage] User profile updated for: " + contents.userName);
          } else if (contents.movieId && contents.targetColumn) {
             // Handle movies
             handleUpdateSheet({
               sheetName: CONFIG.MOVIES_SHEET,
               primaryKey: { "ID": contents.movieId },
               newData: { [contents.targetColumn]: upRes.url }
             });
             console.log("✅ [uploadImage] Movie updated for ID: " + contents.movieId);
          }

          return createJsonResponse({ status: 'success', url: upRes.url, fileID: upRes.fileID, message: 'Upload completed successfully' });
        } catch (e) {
          console.error("📤 [uploadImage] FAILED: " + e.message);
          return createJsonResponse({ status: 'error', message: 'Upload failed: ' + e.message });
        }
        
      default:
         return createJsonResponse({ status: 'error', message: 'Action មិនត្រឹមត្រូវ' });
    }
  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.message }, 500);
  } finally {
    lock.releaseLock();
  }
}

// ✅ [REMOVED] Duplicate processScheduledOrders — kept the newer version below (uses updateOrderInSheets)


// --- ការគ្រប់គ្រងជួរទិន្នន័យទូទៅ (Global Row Management) ---

function handleAddRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(data.sheetName);
  if (!sheet) return createJsonResponse({ status: "error", message: "រកមិនឃើញ Sheet" }, 404);
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColIdx = headers.findIndex(h => normalizeKey(h) === "id");
  
  // Auto-generate ID if missing
  if (idColIdx !== -1 && (!data.newData.ID && !data.newData.id)) {
    const values = sheet.getDataRange().getValues();
    let maxId = 0;
    for (let i = 1; i < values.length; i++) {
      const val = parseInt(values[i][idColIdx]);
      if (!isNaN(val) && val > maxId) maxId = val;
    }
    data.newData.ID = maxId + 1;
  }

  appendRowMapped(sheet, data.newData);
  return createJsonResponse({ status: "success" });
}

function handleDeleteRow(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(data.sheetName);
  if (!sheet) return createJsonResponse({ status: "error", message: "រកមិនឃើញ Sheet" }, 404);

  const pkColName = Object.keys(data.primaryKey)[0];
  const pkValue = data.primaryKey[pkColName];
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const normalizedHeaders = headers.map(h => normalizeKey(h));
  const pkIdx = normalizedHeaders.indexOf(normalizeKey(pkColName));

  if (pkIdx === -1) return createJsonResponse({ status: "error", message: "រកជួរឈរ (Column) មិនឃើញ" }, 400);

  let deletedCount = 0;
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][pkIdx]) === String(pkValue)) {
      sheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  return createJsonResponse({ status: "success", deletedCount: deletedCount });
}

function handleUpdateSheet(data) {
  console.log("📝 [UpdateSheet] Starting: sheetName=" + data.sheetName + " primaryKey=" + JSON.stringify(data.primaryKey) + " newData=" + JSON.stringify(data.newData));
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) {
      console.error("❌ [UpdateSheet] Sheet not found: " + data.sheetName);
      return createJsonResponse({ status: "error", message: "រកមិនឃើញ Sheet: " + data.sheetName }, 404);
    }
    
    console.log("📋 [UpdateSheet] Sheet found: " + data.sheetName + " rows=" + sheet.getLastRow());

    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    const normalizedHeaders = headers.map(h => normalizeKey(h));
    console.log("📑 [UpdateSheet] Headers: " + normalizedHeaders.join(", "));
    
    let rowIndex = -1;
    const targetPkVals = {};
    for (const [k, v] of Object.entries(data.primaryKey)) {
      targetPkVals[normalizeKey(k)] = String(v).trim();
    }

    for (let i = 1; i < values.length; i++) {
      let match = true;
      for (const pkKey in targetPkVals) {
        const colIdx = normalizedHeaders.indexOf(pkKey);
        if (colIdx === -1 || String(values[i][colIdx]).trim() !== targetPkVals[pkKey]) {
          match = false; break;
        }
      }
      if (match) { 
        rowIndex = i + 1; 
        console.log("✅ [UpdateSheet] Row found: " + rowIndex);
        break; 
      }
    }

    if (rowIndex !== -1) {
      let updatedCount = 0;
      const rowData = values[rowIndex - 1]; // Get the existing row data (0-indexed locally)

      for (const [key, val] of Object.entries(data.newData)) {
        const colIdx = normalizedHeaders.indexOf(normalizeKey(key));
        if (colIdx !== -1) {
          let v = val;
          if (typeof v === 'string') {
            if (v.toLowerCase() === 'true') v = true;
            else if (v.toLowerCase() === 'false') v = false;
          }
          rowData[colIdx] = v; // Update the local row array
          updatedCount++;
          console.log("📝 [Batch Update] Changed col " + (colIdx+1) + " (" + key + ") = " + v);
        } else {
          console.warn("⚠️ [Batch Update] Column not found in headers: " + key);
        }
      }

      if (updatedCount > 0) {
        // Write the ENTIRE row back in ONE atomic operation
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
        console.log("✅ [Batch Update] SUCCESS: Atomically updated row " + rowIndex);
      }
      return createJsonResponse({ status: "success", updated: updatedCount });
    }
    console.error("❌ [UpdateSheet] Row not found with PK: " + JSON.stringify(data.primaryKey));
    return createJsonResponse({ status: "error", message: "រកមិនឃើញជួរទិន្នន័យ (Row) ដើម្បីកែប្រែ" }, 404);
  } catch (e) {
    console.error("❌ [UpdateSheet] Exception: " + e.message);
    return createJsonResponse({ status: "error", message: "Update failed: " + e.message }, 500);
  }
}

// --- ដំណើរការកម្មង់ (Order Processing Logic) ---

function processOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderRequest = data.originalRequest;
  const team = orderRequest.selectedTeam; 
  const orderId = data.orderId; 
  
  let fulfillmentStore = orderRequest.fulfillmentStore || getDefaultStoreForTeam(team) || "Unknown";
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;
  
  // Determine initial status based on scheduling
  let fulfillmentStatus = "Pending";
  if (data.scheduledTime) {
      const scheduleDate = new Date(data.scheduledTime);
      if (scheduleDate.getTime() > (new Date().getTime() + 60000)) {
          fulfillmentStatus = "Scheduled";
      }
  }

  const flatData = {};
  flatData[normalizeKey("Timestamp")] = data.scheduledTime || data.timestamp;
  flatData[normalizeKey("Order ID")] = orderId;
  flatData[normalizeKey("User")] = orderRequest.currentUser ? orderRequest.currentUser.UserName : "System";
  flatData[normalizeKey("Page")] = orderRequest.page;
  flatData[normalizeKey("TelegramValue")] = orderRequest.telegramValue;
  flatData[normalizeKey("Customer Name")] = orderRequest.customer ? orderRequest.customer.name : "";
  flatData[normalizeKey("Customer Phone")] = orderRequest.customer ? formatPhoneNumber(orderRequest.customer.phone) : "";
  flatData[normalizeKey("Location")] = data.fullLocation;
  flatData[normalizeKey("Address Details")] = orderRequest.customer ? orderRequest.customer.additionalLocation : "";
  flatData[normalizeKey("Note")] = orderRequest.note;
  flatData[normalizeKey("Shipping Fee (Customer)")] = orderRequest.customer ? orderRequest.customer.shippingFee : 0;
  flatData[normalizeKey("Subtotal")] = orderRequest.subtotal;
  flatData[normalizeKey("Grand Total")] = orderRequest.grandTotal;
  flatData[normalizeKey("Products (JSON)")] = data.productsJSON;
  flatData[normalizeKey("Internal Shipping Method")] = orderRequest.shipping ? orderRequest.shipping.method : "";
  flatData[normalizeKey("Internal Shipping Details")] = orderRequest.shipping ? orderRequest.shipping.details : "";
  flatData[normalizeKey("Internal Cost")] = data.shippingCost;
  flatData[normalizeKey("Payment Status")] = orderRequest.payment ? orderRequest.payment.status : "";
  flatData[normalizeKey("Payment Info")] = orderRequest.payment ? orderRequest.payment.info : "";
  flatData[normalizeKey("Discount ($)")] = data.totalDiscount;
  flatData[normalizeKey("Total Product Cost ($)")] = data.totalProductCost;
  flatData[normalizeKey("Scheduled Time")] = data.scheduledTime;
  flatData[normalizeKey("Fulfillment Store")] = fulfillmentStore;
  flatData[normalizeKey("Team")] = team;
  flatData[normalizeKey("Fulfillment Status")] = fulfillmentStatus;

  const teamSheet = ss.getSheetByName(orderSheetName);
  if (teamSheet) appendRowMapped(teamSheet, flatData);
  
  const allOrdersSheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);
  if (allOrdersSheet) appendRowMapped(allOrdersSheet, flatData);
  
  const revenueSheet = ss.getSheetByName(CONFIG.REVENUE_SHEET);
  if (revenueSheet) {
    const revenueData = {
      "Timestamp": flatData[normalizeKey("Timestamp")],
      "Team": team,
      "Page": orderRequest.page,
      "Revenue": orderRequest.grandTotal,
      "FulfillmentStore": fulfillmentStore
    };
    appendRowMapped(revenueSheet, revenueData);
  }

  // Send to Telegram ONLY if it's not scheduled for the future
  if (fulfillmentStatus !== "Scheduled") {
      sendOrderToTelegram(data);
  }

  return { orderId: orderId, fulfillmentStore: fulfillmentStore };
}

/**
 * Helper function to send an order to Telegram
 */
function sendOrderToTelegram(data) {
  const orderId = data.orderId;
  const team = data.originalRequest ? data.originalRequest.selectedTeam : data.team;
  const fulfillmentStore = data.fulfillmentStore;
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;

  const storeSettings = getStoreSettings(fulfillmentStore);
  if (storeSettings.token && storeSettings.groupID) {
      const finalTopicId = getTeamTopicId(team, fulfillmentStore) || storeSettings.topicID;
      const templates = getTelegramTemplates(team);
      const messageIds = sendTelegramMessage({...storeSettings, topicID: finalTopicId}, data, templates);
      if (messageIds.id1 || messageIds.id2) {
          updateMessageIdInSheet(orderSheetName, orderId, messageIds);
          updateMessageIdInSheet(CONFIG.ALL_ORDERS_SHEET, orderId, messageIds);
      }
      return messageIds;
  }
  return { id1: null, id2: null };
}

/**
 * មុខងារសម្រាប់ឆែក និងរុញការកម្មង់ដែលបានកំណត់ម៉ោង (Scheduled Orders)
 */
function processScheduledOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0].map(h => normalizeKey(h));
  const statusIdx = headers.indexOf(normalizeKey("Fulfillment Status"));
  const timeIdx = headers.indexOf(normalizeKey("Scheduled Time"));
  const idCol = headers.indexOf(normalizeKey("Order ID"));
  const teamCol = headers.indexOf(normalizeKey("Team"));

  if (statusIdx === -1 || timeIdx === -1) return;

  const now = new Date();
  let processedCount = 0;

  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][statusIdx]);
    const scheduledTimeValue = data[i][timeIdx];
    const orderId = data[i][idCol];
    const team = data[i][teamCol];

    if (status === "Scheduled" && scheduledTimeValue) {
      const scheduledDate = new Date(scheduledTimeValue);
      // ប្រសិនបើដល់ពេល ឬហួសពេលកំណត់
      if (scheduledDate <= now) {
        Logger.log(`⏰ ដល់ពេលបញ្ចេញការកម្មង់ដែលកំណត់ម៉ោង: ${orderId}`);
        
        // 1. ប្តូរ Status ទៅជា Pending ក្នុង AllOrders និង Team Sheet
        updateOrderInSheets(orderId, team, { "Fulfillment Status": "Pending" });
        
        // 2. ទាញទិន្នន័យពេញលេញ និងដំណើរការផ្ញើទៅ Telegram
        const orderData = fetchOrderDataFromSheet(orderId, team);
        if (orderData) {
           sendOrderToTelegram(orderData);
           processedCount++;
        }
      }
    }
  }
  
  if (processedCount > 0) {
    Logger.log(`✅ បានរុញការកម្មង់កំណត់ម៉ោងចំនួន ${processedCount} ទៅកាន់ Telegram`);
  }
}

// --- មុខងារជំនួយបន្ថែម (Additional Helper Functions) ---

function createJsonResponse(data, status) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function uploadImageToDrive(base64Data, fileName, mimeType, folderID, userName) {
  try {
    let folder;
    try {
      folder = (folderID && folderID !== "root") ? DriveApp.getFolderById(folderID) : DriveApp.getRootFolder();
    } catch (err) {
      console.warn("⚠️ Folder ID មិនត្រឹមត្រូវ ប្រើ Root ជំនួសវិញ: " + folderID);
      folder = DriveApp.getRootFolder();
    }
    const decodedData = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedData, mimeType, fileName);
    const file = folder.createFile(blob);
    // REMOVED: file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    // Reason: Some organizational policies or Shared Drives restrict public link creation, 
    // causing an "Access denied: DriveApp" error even if the file was created.

    return {
      url: file.getUrl(),
      fileID: file.getId()
    };

  } catch (e) {
    throw new Error("Drive Upload Error: " + e.message);
  }
}

function updateOrderInSheets(orderId, team, updatedFields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToUpdate = [CONFIG.ALL_ORDERS_SHEET];
  if (team) sheetsToUpdate.push(`${CONFIG.ORDER_SHEET_PREFIX}${team}`);

  sheetsToUpdate.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    
    handleUpdateSheet({
      sheetName: sheetName,
      primaryKey: { "Order ID": orderId },
      newData: updatedFields
    });
  });
}

function appendRowMapped(sheet, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    const key = normalizeKey(h);
    return data[key] !== undefined ? data[key] : "";
  });
  sheet.appendRow(row);
}

function getDefaultStoreForTeam(team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.PAGES_SHEET);
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeKey(h));
  const teamIdx = headers.indexOf(normalizeKey("Team"));
  const storeIdx = headers.indexOf(normalizeKey("DefaultStore"));
  
  if (teamIdx === -1 || storeIdx === -1) return null;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][teamIdx]).trim() === String(team).trim()) {
      return data[i][storeIdx];
    }
  }
  return null;
}

function getStoreSettings(storeName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.STORES_SHEET);
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeKey(h));
  const nameIdx = headers.indexOf(normalizeKey("StoreName"));
  const tokenIdx = headers.indexOf(normalizeKey("TelegramBotToken"));
  const groupIdx = headers.indexOf(normalizeKey("TelegramGroupID"));
  const topicIdx = headers.indexOf(normalizeKey("TelegramTopicID"));
  
  if (nameIdx === -1) return {};
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][nameIdx]).trim() === String(storeName).trim()) {
      return {
        token: data[i][tokenIdx],
        groupID: data[i][groupIdx],
        topicID: data[i][topicIdx]
      };
    }
  }
  return {};
}

function getTeamTopicId(team, storeName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.PAGES_SHEET);
  if (!sheet) return null;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeKey(h));
  const teamIdx = headers.indexOf(normalizeKey("Team"));
  const topicIdx = headers.indexOf(normalizeKey("TelegramTopicID"));
  
  if (teamIdx === -1 || topicIdx === -1) return null;
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][teamIdx]).trim() === String(team).trim()) {
      return data[i][topicIdx];
    }
  }
  return null;
}

function getTelegramTemplates(team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TELEGRAM_TEMPLATES_SHEET);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeKey(h));
  const teamIdx = headers.indexOf(normalizeKey("Team"));
  const partIdx = headers.indexOf(normalizeKey("Part"));
  const templateIdx = headers.indexOf(normalizeKey("Template"));
  
  const templates = {};
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][teamIdx]).trim() === String(team).trim()) {
      templates[data[i][partIdx]] = data[i][templateIdx];
    }
  }
  return templates;
}

function sendTelegramMessage(settings, data, templates) {
  // Simplified version — assuming templates and data are handled appropriately
  const message = "Order: " + data.orderId; // Fallback
  const payload = {
    chat_id: settings.groupID,
    text: message,
    parse_mode: "HTML"
  };
  if (settings.topicID) payload.message_thread_id = settings.topicID;
  
  const url = `https://api.telegram.org/bot${settings.token}/sendMessage`;
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const resData = JSON.parse(response.getContentText());
  
  if (resData.ok) {
    return { id1: resData.result.message_id, id2: null };
  }
  return { id1: null, id2: null };
}

function updateMessageIdInSheet(sheetName, orderId, messageIds) {
  handleUpdateSheet({
    sheetName: sheetName,
    primaryKey: { "Order ID": orderId },
    newData: {
      "Telegram Message ID 1": messageIds.id1,
      "Telegram Message ID 2": messageIds.id2
    }
  });
}

function fetchOrderDataFromSheet(orderId, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);
  if (!sheet) return null;
  
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const normalizedHeaders = headers.map(h => normalizeKey(h));
  const idIdx = normalizedHeaders.indexOf(normalizeKey("Order ID"));
  
  if (idIdx === -1) return null;
  
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]).trim() === String(orderId).trim()) {
      const orderData = {};
      headers.forEach((h, idx) => {
        orderData[h] = values[i][idx];
      });
      return orderData;
    }
  }
  return null;
}

function logUserActivity(user, action, details) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.USER_ACTIVITY_LOGS_SHEET);
  if (!sheet) return;
  
  const data = {
    "Timestamp": new Date(),
    "User": user,
    "Action": action,
    "Details": details
  };
  appendRowMapped(sheet, data);
}

function deleteOrderTelegramMessages(data) {
  // Implementation for deleting Telegram messages if needed
}

function updateOrderTelegram(data) {
  try {
    const orderId = data.orderId || data.OrderID;
    const team = data.team || data.Team;
    const updatedFields = data.updatedFields || data.newData || {};

    if (!orderId) {
      console.error("❌ updateOrderTelegram: Missing orderId");
      return { id1: null, id2: null };
    }

    // 1. Update Sheet first
    if (Object.keys(updatedFields).length > 0) {
      updateOrderInSheets(orderId, team, updatedFields);
      console.log("✅ updateOrderTelegram: Sheets updated for ID: " + orderId);
    }

    // 2. Fetch full data and send to Telegram
    const fullOrderData = fetchOrderDataFromSheet(orderId, team);
    if (!fullOrderData) {
      console.error("❌ updateOrderTelegram: Order not found for ID: " + orderId);
      return { id1: null, id2: null };
    }

    // Prepare normalized data for sendOrderToTelegram
    const normalizedData = {
      orderId: orderId,
      team: team,
      fulfillmentStore: fullOrderData["Fulfillment Store"],
      ...fullOrderData
    };

    return sendOrderToTelegram(normalizedData);
  } catch (e) {
    console.error("❌ updateOrderTelegram Error: " + e.message);
    return { id1: null, id2: null };
  }
}

