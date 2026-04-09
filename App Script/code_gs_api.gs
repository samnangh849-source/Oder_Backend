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
        return createJsonResponse({ status: 'success', orderId: result.orderId, messageIds: result.messageIds });
        
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
                   // Search from the bottom as new orders are appended
                   for (let i = vals.length - 1; i >= 1; i--) {
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

      const aliasMap = {
        "packagephotourl": "packagephoto",
        "packagephoto": "packagephotourl",
        "deliveryphotourl": "deliveryphoto",
        "deliveryphoto": "deliveryphotourl"
      };

      for (const [key, val] of Object.entries(data.newData)) {
        const nKey = normalizeKey(key);
        let colIdx = normalizedHeaders.indexOf(nKey);
        
        // Fallback to alias if the exact column name isn't found
        if (colIdx === -1 && aliasMap[nKey]) {
          colIdx = normalizedHeaders.indexOf(aliasMap[nKey]);
        }

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
        SpreadsheetApp.flush(); // Force immediate commit to avoid race conditions
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

  // Ensure fulfillmentStore is set on data for sendOrderToTelegram
  data.fulfillmentStore = fulfillmentStore;

  // Send to Telegram ONLY if it's not scheduled for the future
  let messageIds = { id1: null, id2: null, id3: null };
  if (fulfillmentStatus !== "Scheduled") {
      messageIds = sendOrderToTelegram(data);
  }

  return { orderId: orderId, fulfillmentStore: fulfillmentStore, messageIds: messageIds };
}

/**
 * Helper function to send an order to Telegram
 */
function sendOrderToTelegram(data) {
  const orderId = data.orderId;
  const req = data.originalRequest || {};
  const team = data.team || req.selectedTeam || data["Team"] || "";
  const page = req.page || data["Page"] || "";
  const telegramValue = req.telegramValue || data["TelegramValue"] || "";
  const fulfillmentStore = data.fulfillmentStore || data["Fulfillment Store"];
  const forceSync = data.forceSync === true;
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;

  console.log("📤 [sendOrderToTelegram] orderId=" + orderId + " team=" + team + " page=" + page + " store=" + fulfillmentStore + " forceSync=" + forceSync);

  if (!fulfillmentStore) {
    console.error("❌ [sendOrderToTelegram] fulfillmentStore is empty for order " + orderId + "! Cannot look up Telegram settings.");
    return { id1: null, id2: null, id3: null };
  }

  // Check if already sent
  if (!forceSync) {
    const existingData = fetchOrderDataFromSheet(orderId, team);
    if (existingData) {
      const id1 = existingData["Telegram Message ID 1"];
      const id2 = existingData["Telegram Message ID 2"];
      if (id1 || id2) {
        console.log("ℹ️ [sendOrderToTelegram] Order " + orderId + " already has Telegram IDs. Skipping send (use Force Sync to retry).");
        return { id1: id1, id2: id2 };
      }
    }
  }

  const storeSettings = getStoreSettings(fulfillmentStore);
  if (storeSettings.token && storeSettings.groupID) {
      const finalTopicId = getTeamTopicId(team, page, telegramValue, fulfillmentStore) || storeSettings.topicID;
      const templates = getTelegramTemplates(team);
      console.log("📤 [sendOrderToTelegram] Sending to groupID=" + storeSettings.groupID + " topicID=" + finalTopicId + " (page=" + page + ")");
      const messageIds = sendTelegramMessage({...storeSettings, topicID: finalTopicId}, data, templates);
      if (messageIds.id1 || messageIds.id2 || messageIds.id3) {
          updateMessageIdInSheet(orderSheetName, orderId, messageIds);
          updateMessageIdInSheet(CONFIG.ALL_ORDERS_SHEET, orderId, messageIds);
          console.log("✅ [sendOrderToTelegram] Message IDs updated in sheets for " + orderId);
      } else {
          console.warn("⚠️ [sendOrderToTelegram] Telegram message sent but no IDs returned for " + orderId);
      }
      return messageIds;
  }
  console.error("❌ [sendOrderToTelegram] Telegram settings missing for store '" + fulfillmentStore + "'. Check Stores sheet: TelegramBotToken=" + (storeSettings.token ? "OK" : "EMPTY") + " TelegramGroupID=" + (storeSettings.groupID ? "OK" : "EMPTY"));
  return { id1: null, id2: null, id3: null };
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
           sendOrderToTelegram({
             orderId: orderId,
             team: team,
             fulfillmentStore: orderData["Fulfillment Store"],
             ...orderData
           });
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
    
    // Attempt to set public view access, but don't fail if it's restricted
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      console.log("🔓 [uploadImageToDrive] Sharing set to ANYONE_WITH_LINK");
    } catch (e) {
      console.warn("⚠️ [uploadImageToDrive] Could not set sharing: " + e.message + ". The file was created but may require manual access settings.");
    }

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
  SpreadsheetApp.flush(); // Ensure all updates are committed before any subsequent reads
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
  const labelIdx = headers.indexOf(normalizeKey("LabelPrinterURL"));

  if (nameIdx === -1) return {};

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][nameIdx]).trim() === String(storeName).trim()) {
      return {
        token: data[i][tokenIdx],
        groupID: data[i][groupIdx],
        topicID: data[i][topicIdx],
        labelPrinterURL: labelIdx !== -1 ? data[i][labelIdx] : ""
      };
    }
  }
  return {};
}

/**
 * Parse multi-store TelegramTopicID format: "ACC Store:10617, Flexi Gear:26"
 * Returns the numeric topic ID for the matching store, or the raw value if it's a plain number.
 */
function parseTopicId(rawValue, storeName) {
  if (!rawValue) return null;
  const val = String(rawValue).trim();
  if (!val) return null;

  // Plain number — return as-is
  if (/^\d+$/.test(val)) return val;

  // Multi-store format: "StoreName:TopicID, StoreName:TopicID"
  const parts = val.split(",");
  for (let i = 0; i < parts.length; i++) {
    const colonIdx = parts[i].lastIndexOf(":");
    if (colonIdx === -1) continue;
    const name = parts[i].substring(0, colonIdx).trim();
    const id = parts[i].substring(colonIdx + 1).trim();
    if (name === String(storeName).trim()) {
      return id;
    }
  }

  // No match found — try first entry as fallback
  const firstColon = parts[0].lastIndexOf(":");
  if (firstColon !== -1) {
    const fallbackId = parts[0].substring(firstColon + 1).trim();
    console.log("⚠️ [parseTopicId] No match for store '" + storeName + "' in '" + val + "', falling back to first entry: " + fallbackId);
    return fallbackId;
  }

  return null;
}

function getTeamTopicId(team, page, telegramValue, fulfillmentStore) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.PAGES_SHEET);
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeKey(h));
  const teamIdx = headers.indexOf(normalizeKey("Team"));
  const pageIdx = headers.indexOf(normalizeKey("PageName"));
  const tvIdx = headers.indexOf(normalizeKey("TelegramValue"));
  const topicIdx = headers.indexOf(normalizeKey("TelegramTopicID"));

  if (teamIdx === -1 || topicIdx === -1) return null;

  let teamFallback = null;
  for (let i = 1; i < data.length; i++) {
    const rowTeam = String(data[i][teamIdx]).trim();
    if (rowTeam !== String(team).trim()) continue;

    // Match by TelegramValue first (most specific)
    if (telegramValue && tvIdx !== -1 && String(data[i][tvIdx]).trim() === String(telegramValue).trim()) {
      return parseTopicId(data[i][topicIdx], fulfillmentStore);
    }
    // Match by PageName
    if (page && pageIdx !== -1 && String(data[i][pageIdx]).trim() === String(page).trim()) {
      return parseTopicId(data[i][topicIdx], fulfillmentStore);
    }
    // Keep first team match as fallback
    if (!teamFallback) teamFallback = data[i][topicIdx];
  }
  return parseTopicId(teamFallback, fulfillmentStore);
}

function getTelegramTemplates(team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.TELEGRAM_TEMPLATES_SHEET);
  if (!sheet) return {};

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => normalizeKey(h));
  const teamIdx = headers.indexOf(normalizeKey("Team"));
  const partIdx = headers.indexOf(normalizeKey("Part"));
  const templateIdx = headers.indexOf(normalizeKey("Template"));

  const teamTemplates = {};
  const globalTemplates = {};
  for (let i = 1; i < data.length; i++) {
    const rowTeam = String(data[i][teamIdx]).trim();
    if (rowTeam === String(team).trim()) {
      teamTemplates[data[i][partIdx]] = data[i][templateIdx];
    } else if (rowTeam === "Global") {
      globalTemplates[data[i][partIdx]] = data[i][templateIdx];
    }
  }
  return Object.keys(teamTemplates).length > 0 ? teamTemplates : globalTemplates;
}

function sendTelegramMessage(settings, data, templates) {
  const req = data.originalRequest || {};
  const customer = req.customer || {};
  const shipping = req.shipping || {};
  const payment = req.payment || {};

  // --- Parse products list ---
  let productsList = "";
  try {
    let products = [];
    const rawProducts = data.productsJSON || data["Products (JSON)"] || req.products;
    if (rawProducts) {
      products = typeof rawProducts === 'string' ? JSON.parse(rawProducts) : rawProducts;
    }
    if (products && products.length > 0) {
      productsList = products.map(function(p, i) {
        const name = p.productName || p.ProductName || p.name || "N/A";
        const qty = p.quantity || p.Quantity || 1;
        const price = p.finalPrice !== undefined ? p.finalPrice : (p.price || p.Price || 0);
        return (i + 1) + ". " + name + " x" + qty + " = $" + (price * qty).toFixed(2);
      }).join("\n");
    }
  } catch (e) {
    console.warn("⚠️ [sendTelegramMessage] Failed to parse products: " + e.message);
  }

  // --- Source info ---
  const page = req.page || data["Page"] || "";
  const telegramValue = req.telegramValue || data["TelegramValue"] || "";
  const sourceInfo = telegramValue ? (page + " (" + telegramValue + ")") : page;

  // --- Note ---
  const noteRaw = req.note || data["Note"] || "";
  const noteText = noteRaw ? ("📝 *ចំណាំ:* " + noteRaw) : "";

  // --- Shipping details ---
  const shippingDetailsRaw = shipping.details || data["Internal Shipping Details"] || "";
  const shippingDetailsText = shippingDetailsRaw ? ("\n📋 *ព័ត៌មានដឹក:* " + shippingDetailsRaw) : "";

  // --- Payment ---
  const paymentStatusRaw = payment.status || data["Payment Status"] || "";
  const paymentInfoRaw = payment.info || data["Payment Info"] || "";
  let paymentText = "";
  if (paymentStatusRaw) {
    paymentText = "💵 *ស្ថានភាពបង់ប្រាក់:* " + paymentStatusRaw;
    if (paymentInfoRaw) paymentText += " (" + paymentInfoRaw + ")";
  }

  // --- Date ---
  const timestamp = data.timestamp || data.scheduledTime || data["Timestamp"] || "";
  let dateText = "";
  if (timestamp) {
    try {
      const d = new Date(timestamp);
      dateText = "📅 " + Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    } catch (e) {
      dateText = "📅 " + String(timestamp);
    }
  }

  // --- Build replacement map ---
  const vars = {
    "sourceInfo": sourceInfo,
    "user": (req.currentUser ? req.currentUser.UserName : "") || data["User"] || "",
    "fulfillmentStore": data.fulfillmentStore || data["Fulfillment Store"] || "",
    "shippingMethod": shipping.method || data["Internal Shipping Method"] || "",
    "shippingDetails": shippingDetailsText,
    "note": noteText,
    "orderId": data.orderId || "",
    "customerName": customer.name || data["Customer Name"] || "",
    "customerPhone": formatPhoneNumber(customer.phone || data["Customer Phone"] || ""),
    "location": data.fullLocation || data["Location"] || "",
    "addressDetails": customer.additionalLocation || data["Address Details"] || "",
    "productsList": productsList,
    "subtotal": String(req.subtotal || data["Subtotal"] || "0"),
    "shippingFee": String(customer.shippingFee || data["Shipping Fee (Customer)"] || "0"),
    "grandTotal": String(req.grandTotal || data["Grand Total"] || "0"),
    "paymentStatus": paymentText,
    "date": dateText,
    "packedBy": data["Packed By"] || "",
    "packedTime": data["Packed Time"] || "",
    "driverName": data["Driver Name"] || "",
    "trackingNumber": data["Tracking Number"] || "",
    "packagePhotoUrl": data["Package Photo URL"] || data["Package Photo"] || "",
    "deliveryPhotoUrl": data["Delivery Photo URL"] || data["Delivery Photo"] || ""
  };

  function applyTemplate(tpl) {
    return tpl.replace(/\{\{(\w+)\}\}/g, function(m, key) {
      return vars[key] !== undefined ? vars[key] : m;
    });
  }

  // --- Build inline keyboard (Print Label button) ---
  var inlineKeyboard = null;
  if (settings.labelPrinterURL) {
    const labelParams = {
      id: vars.orderId,
      name: vars.customerName,
      phone: vars.customerPhone,
      location: vars.location,
      address: vars.addressDetails,
      store: vars.fulfillmentStore,
      page: page,
      user: vars.user,
      total: vars.grandTotal,
      shipping: shipping.method || data["Internal Shipping Method"] || "",
      payment: (payment.status || data["Payment Status"] || ""),
      note: (req.note || data["Note"] || "")
    };
    const qs = Object.keys(labelParams).map(function(k) {
      return k + "=" + encodeURIComponent(labelParams[k] || "");
    }).join("&");
    const labelUrl = settings.labelPrinterURL
      + (settings.labelPrinterURL.indexOf("?") === -1 ? "?" : "&")
      + qs;
    inlineKeyboard = {
      inline_keyboard: [[
        { text: "🖨️ ព្រីន Label", url: labelUrl }
      ]]
    };
  }

  // --- Get Part templates ---
  const part1Tpl = templates["Part1"] || templates["part1"];
  const part2Tpl = templates["Part2"] || templates["part2"];
  const part3Tpl = templates["Part3"] || templates["part3"];

  const msgId1Existing = data["Telegram Message ID 1"] || (req && req["Telegram Message ID 1"]);
  const msgId2Existing = data["Telegram Message ID 2"] || (req && req["Telegram Message ID 2"]);
  const msgId3Existing = data["Telegram Message ID 3"] || (req && req["Telegram Message ID 3"]);

  let msgId1 = msgId1Existing || null;
  let msgId2 = msgId2Existing || null;
  let msgId3 = msgId3Existing || null;

  if (part1Tpl) {
    if (msgId1Existing) {
      editSingleTelegramMsg(settings, msgId1Existing, applyTemplate(part1Tpl));
    } else {
      msgId1 = sendSingleTelegramMsg(settings, applyTemplate(part1Tpl));
    }
  }
  if (part2Tpl) {
    if (msgId2Existing) {
      editSingleTelegramMsg(settings, msgId2Existing, applyTemplate(part2Tpl), inlineKeyboard);
    } else {
      msgId2 = sendSingleTelegramMsg(settings, applyTemplate(part2Tpl), inlineKeyboard);
    }
  }
  if (part3Tpl) {
    if (msgId3Existing) {
      editSingleTelegramMsg(settings, msgId3Existing, applyTemplate(part3Tpl));
    } else if (data["Fulfillment Status"] === "Packed" || data["Fulfillment Status"] === "Ready to Ship" || data["Fulfillment Status"] === "Shipped" || data["Fulfillment Status"] === "Delivered" || data["Package Photo URL"]) {
      msgId3 = sendSingleTelegramMsg(settings, applyTemplate(part3Tpl));
    }
  }

  // Fallback if no templates configured
  if (!part1Tpl && !part2Tpl && !part3Tpl) {
    console.warn("⚠️ [sendTelegramMessage] No Part1/Part2/Part3 templates found, using fallback");
    if (msgId1Existing) {
      editSingleTelegramMsg(settings, msgId1Existing, "🛒 *ការកម្មង់ថ្មី*\nID: `" + vars.orderId + "`\n" + vars.customerName + " - " + vars.customerPhone, inlineKeyboard);
    } else {
      msgId1 = sendSingleTelegramMsg(settings, "🛒 *ការកម្មង់ថ្មី*\nID: `" + vars.orderId + "`\n" + vars.customerName + " - " + vars.customerPhone, inlineKeyboard);
    }
  }

  console.log("📨 [sendTelegramMessage] Results: id1=" + msgId1 + " id2=" + msgId2 + " id3=" + msgId3);
  return { id1: msgId1, id2: msgId2, id3: msgId3 };
}

function sendSingleTelegramMsg(settings, text, replyMarkup) {
  const payload = {
    chat_id: settings.groupID,
    text: text,
    parse_mode: "Markdown"
  };
  if (settings.topicID) payload.message_thread_id = settings.topicID;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  const url = "https://api.telegram.org/bot" + settings.token + "/sendMessage";
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resData = JSON.parse(response.getContentText());
    if (resData.ok) {
      console.log("✅ [Telegram] Sent message_id=" + resData.result.message_id);
      return resData.result.message_id;
    }
    console.error("❌ [Telegram] API error: " + JSON.stringify(resData));
  } catch (e) {
    console.error("❌ [Telegram] Fetch error: " + e.message);
  }
  return null;
}

function editSingleTelegramMsg(settings, messageId, text, replyMarkup) {
  const payload = {
    chat_id: settings.groupID,
    message_id: messageId,
    text: text,
    parse_mode: "Markdown"
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  const url = "https://api.telegram.org/bot" + settings.token + "/editMessageText";
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resData = JSON.parse(response.getContentText());
    if (resData.ok) {
      console.log("✅ [Telegram Edit] Edited message_id=" + messageId);
      return messageId;
    }
    console.error("❌ [Telegram Edit] API error: " + JSON.stringify(resData));
  } catch (e) {
    console.error("❌ [Telegram Edit] Fetch error: " + e.message);
  }
  return messageId; // Return same ID even if it fails, to retain state
}

function deleteSingleTelegramMsg(settings, messageId) {
  if (!messageId) return;
  const payload = {
    chat_id: settings.groupID,
    message_id: messageId
  };

  const url = "https://api.telegram.org/bot" + settings.token + "/deleteMessage";
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const resData = JSON.parse(response.getContentText());
    if (resData.ok) {
      console.log("✅ [Telegram Delete] Deleted message_id=" + messageId);
    } else {
      console.error("❌ [Telegram Delete] API error: " + JSON.stringify(resData));
    }
  } catch (e) {
    console.error("❌ [Telegram Delete] Fetch error: " + e.message);
  }
}

function updateMessageIdInSheet(sheetName, orderId, messageIds) {
  handleUpdateSheet({
    sheetName: sheetName,
    primaryKey: { "Order ID": orderId },
    newData: {
      "Telegram Message ID 1": messageIds.id1,
      "Telegram Message ID 2": messageIds.id2,
      "Telegram Message ID 3": messageIds.id3
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
  const orderId = data.orderId;
  const team = data.team;
  const messageId1 = data.messageId1;
  const messageId2 = data.messageId2;
  const messageId3 = data.messageId3; // Access messageId3 if passed from backend
  const fulfillmentStore = data.fulfillmentStore;

  console.log("🗑️ [deleteOrderTelegramMessages] Deleting orderId=" + orderId + " team=" + team);

  // 1. Delete from Sheets
  if (orderId) {
    handleDeleteRow({
      sheetName: CONFIG.ALL_ORDERS_SHEET,
      primaryKey: { "Order ID": orderId }
    });
    if (team) {
      handleDeleteRow({
        sheetName: `${CONFIG.ORDER_SHEET_PREFIX}${team}`,
        primaryKey: { "Order ID": orderId }
      });
    }
    console.log("✅ [deleteOrderTelegramMessages] Deleted from row for " + orderId);
  }

  // 2. Delete from Telegram
  if (fulfillmentStore && (messageId1 || messageId2 || messageId3)) {
    const settings = getStoreSettings(fulfillmentStore);
    if (settings.token && settings.groupID) {
      if (messageId1) deleteSingleTelegramMsg(settings, messageId1);
      if (messageId2) deleteSingleTelegramMsg(settings, messageId2);
      if (messageId3) deleteSingleTelegramMsg(settings, messageId3);
    }
  }
}

function updateOrderTelegram(data) {
  try {
    const orderId = data.orderId || data.OrderID;
    const team = data.team || data.Team;
    const updatedFields = data.updatedFields || data.newData || {};

    if (!orderId) {
      console.error("❌ updateOrderTelegram: Missing orderId");
      return { id1: null, id2: null, id3: null };
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
      return { id1: null, id2: null, id3: null };
    }

    // Prepare normalized data for sendOrderToTelegram
    // ✅ Merge updatedFields with fullOrderData to ensure newly updated info 
    // (like photo URLs) isn't lost if the spreadsheet fetch was slightly stale.
    const normalizedData = {
      ...fullOrderData,
      ...updatedFields,
      orderId: orderId,
      team: team,
      fulfillmentStore: fullOrderData["Fulfillment Store"] || updatedFields["Fulfillment Store"],
      forceSync: updatedFields["Force Sync"] === true
    };

    return sendOrderToTelegram(normalizedData);
  } catch (e) {
    console.error("❌ updateOrderTelegram Error: " + e.message);
    return { id1: null, id2: null, id3: null };
  }
}

