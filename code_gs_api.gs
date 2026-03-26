/**
 * @OnlyCurrentDoc
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
        const result = processOrder(contents.orderData);
        logUserActivity(user, "បង្កើតការកម្មង់ថ្មី", `លេខសម្គាល់: ${result.orderId}`);
        return createJsonResponse({ status: 'success', orderId: result.orderId });
        
      case 'updateOrderTelegram':
        const updateRes = updateOrderTelegram(contents.orderData);
        return createJsonResponse({ status: 'success', messageIds: updateRes });
        
      case 'deleteOrderTelegram':
        deleteOrderTelegramMessages(contents.orderData);
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
        console.log("📤 [uploadImage] Request received: fileName=" + contents.fileName + " mimeType=" + contents.mimeType + " folderID=" + contents.uploadFolderID);
        try {
          const upRes = uploadImageToDrive(contents.fileData, contents.fileName, contents.mimeType, contents.uploadFolderID, contents.userName);
          console.log("📤 [uploadImage] SUCCESS: url=" + upRes.url + " fileID=" + upRes.fileID);
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
        
        // 1. ប្តូរ Status ទៅជា Pending ក្នុង Sheet
        sheet.getRange(i + 1, statusIdx + 1).setValue("Pending");
        
        // 2. ទាញទិន្នន័យពេញលេញ និងដំណើរការផ្ញើទៅ Telegram
        const orderData = fetchOrderDataFromSheet(orderId, team);
        if (orderData) {
           processOrder(orderData);
           processedCount++;
        }
      }
    }
  }
  
  if (processedCount > 0) {
    Logger.log(`✅ បានរុញការកម្មង់ចំនួន ${processedCount} ទៅកាន់ Telegram`);
  }
}

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
    for (let i = 1; i < values.length; i++) {
      let match = true;
      for (const [pkKey, pkVal] of Object.entries(data.primaryKey)) {
        const colIdx = normalizedHeaders.indexOf(normalizeKey(pkKey));
        if (colIdx === -1 || String(values[i][colIdx]) !== String(pkVal)) {
          match = false; break;
        }
      }
      if (match) { 
        rowIndex = i + 1; 
        console.log("✅ [UpdateSheet] Row found: " + rowIndex + " data=" + JSON.stringify(values[i]));
        break; 
      }
    }

    if (rowIndex !== -1) {
      let updatedCount = 0;
      for (const [key, val] of Object.entries(data.newData)) {
        const colIdx = normalizedHeaders.indexOf(normalizeKey(key));
        if (colIdx !== -1) {
          let v = val;
          if (typeof v === 'string') {
            if (v.toLowerCase() === 'true') v = true;
            else if (v.toLowerCase() === 'false') v = false;
          }
          sheet.getRange(rowIndex, colIdx + 1).setValue(v);
          updatedCount++;
          console.log("📝 [UpdateSheet] Updated col " + (colIdx+1) + " (" + key + ") = " + v);
        } else {
          console.warn("⚠️ [UpdateSheet] Column not found in headers: " + key);
        }
      }
      console.log("✅ [UpdateSheet] SUCCESS: Updated " + updatedCount + " columns in row " + rowIndex);
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
  flatData[normalizeKey("Fulfillment Status")] = "Pending";

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

  // ផ្ញើសារទៅ Telegram 
  let shouldSendNow = true;
  if (data.scheduledTime) {
      const scheduleDate = new Date(data.scheduledTime);
      if (scheduleDate.getTime() > (new Date().getTime() + 60000)) shouldSendNow = false;
  }

  if (shouldSendNow) {
      const storeSettings = getStoreSettings(fulfillmentStore);
      if (storeSettings.token && storeSettings.groupID) {
          const finalTopicId = getTeamTopicId(team, fulfillmentStore) || storeSettings.topicID;
          const templates = getTelegramTemplates(team);
          const messageIds = sendTelegramMessage({...storeSettings, topicID: finalTopicId}, data, templates);
          if (messageIds.id1 || messageIds.id2) {
              updateMessageIdInSheet(orderSheetName, orderId, messageIds);
              updateMessageIdInSheet(CONFIG.ALL_ORDERS_SHEET, orderId, messageIds);
          }
      }
  }

  return { orderId: orderId, fulfillmentStore: fulfillmentStore };
}

function updateOrderTelegram(orderData) {
  const orderId = orderData.orderId;
  const team = orderData.team;
  const updatedFields = orderData.updatedFields;

  updateOrderInSheets(orderId, team, updatedFields);

  const fullOrderData = fetchOrderDataFromSheet(orderId, team);
  if (!fullOrderData) return { id1: null, id2: null };

  const storeSettings = getStoreSettings(fullOrderData.fulfillmentStore);
  if (!storeSettings.token) return { id1: null, id2: null };

  const finalTopicId = getTeamTopicId(team, fullOrderData.fulfillmentStore) || storeSettings.topicID;
  const messageIds = getMessageIdsFromSheet(orderId);
  const templates = getTelegramTemplates(team);

  const updatedIds = { id1: null, id2: null };
  if (messageIds.id1 && templates.get(1)) {
    const text = generateTelegramTextPart(fullOrderData, templates.get(1), 1);
    updatedIds.id1 = editTelegramMessage({...storeSettings, topicID: finalTopicId}, messageIds.id1, text, fullOrderData, 1);
  }
  if (messageIds.id2 && templates.get(2)) {
    const text = generateTelegramTextPart(fullOrderData, templates.get(2), 2);
    updatedIds.id2 = editTelegramMessage({...storeSettings, topicID: finalTopicId}, messageIds.id2, text, fullOrderData, 2);
  }
  
  return updatedIds;
}

// ✅ UPGRADED: ជួសជុលការលុបសារក្នុង Telegram ឱ្យត្រូវតាមស្តង់ដារ API
function deleteOrderTelegramMessages(orderData) {
  const orderId = orderData.orderId;
  const team = orderData.team;

  // ១. ស្វែងរក Store និង Message IDs មុនពេលលុបជួរចេញពី Sheet
  let fulfillmentStore = orderData.fulfillmentStore;
  if (!fulfillmentStore) fulfillmentStore = getStoreFromOrderSheet(orderId);
  
  const msgIds = getMessageIdsFromSheet(orderId);
  let targetId1 = msgIds.id1 || orderData.messageId1;
  let targetId2 = msgIds.id2 || orderData.messageId2;

  if (fulfillmentStore) {
    const storeSettings = getStoreSettings(fulfillmentStore);
    if (storeSettings.token && storeSettings.groupID) {
      const deleteUrl = `https://api.telegram.org/bot${storeSettings.token}/deleteMessage`;

      const performDelete = (id) => {
        if (!id) return;
        try {
          const resp = UrlFetchApp.fetch(deleteUrl, {
            method: "post", 
            contentType: "application/json",
            payload: JSON.stringify({ 
                chat_id: String(storeSettings.groupID), // ធានាថា Group ID ជាអក្សរ
                message_id: Number(id) // ✅ សំខាន់បំផុត៖ Telegram ទាមទារឱ្យ Message ID ជាលេខ (Integer)
            }),
            muteHttpExceptions: true // ការពារមិនឱ្យ Error បើ Telegram បដិសេធ
          });
          
          const resJson = JSON.parse(resp.getContentText());
          if (!resJson.ok) {
             Logger.log(`⚠️ បរាជ័យក្នុងការលុបសារ Telegram (ID: ${id}): ${resJson.description}`);
          } else {
             Logger.log(`✅ លុបសារ Telegram ជោគជ័យ (ID: ${id})`);
          }
        } catch (e) {
             Logger.log(`❌ Telegram Delete Exception: ${e.message}`);
        }
      };

      // អនុវត្តការលុប
      performDelete(targetId1);
      performDelete(targetId2);
    }
  }

  // ២. បន្ទាប់ពីផ្ញើសំណើលុបទៅ Telegram រួចរាល់ ទើបធ្វើការលុបជួរចេញពី Google Sheet
  deleteOrderFromSheets(orderId, team);
}

// --- ជំនួយការធ្វើសមកាលកម្មទិន្នន័យ (Sync Helpers) ---

function updateOrderInSheets(orderId, team, updatedFields) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToUpdate = [ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET), ss.getSheetByName(CONFIG.ORDER_SHEET_PREFIX + team)];
  
  sheetsToUpdate.forEach(sheet => {
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const normalizedHeaders = headers.map(h => normalizeKey(h));
    const orderIdCol = normalizedHeaders.indexOf(normalizeKey("Order ID"));
    if (orderIdCol === -1) return;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIdCol]) === String(orderId)) {
        for (const [fieldName, newValue] of Object.entries(updatedFields)) {
          const colIndex = normalizedHeaders.indexOf(normalizeKey(fieldName));
          if (colIndex !== -1) {
            sheet.getRange(i + 1, colIndex + 1).setValue(newValue);
          }
        }
        break; 
      }
    }
  });
  
  SpreadsheetApp.flush(); // បង្ខំអោយទិន្នន័យរក្សាទុកភ្លាមៗ
}

function deleteOrderFromSheets(orderId, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetsToDeleteFrom = [ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET), ss.getSheetByName(CONFIG.ORDER_SHEET_PREFIX + team)];
  
  sheetsToDeleteFrom.forEach(sheet => {
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderIdCol = headers.indexOf("Order ID");
    if (orderIdCol === -1) return;

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][orderIdCol]) === String(orderId)) {
        sheet.deleteRow(i + 1);
      }
    }
  });
}

// --- មុខងារ Telegram និងទម្រង់សារ (Telegram & UI Helpers) ---

function sendTelegramMessage(settings, data, templates) {
  const messageIds = {id1: null, id2: null};
  let replyToId = null;
  const sortedParts = Array.from(templates.keys()).sort((a, b) => a - b);

  for (const part of sortedParts) {
    const text = generateTelegramTextPart(data, templates.get(part), part);
    const payload = {
      chat_id: settings.groupID, 
      text: text, 
      parse_mode: "Markdown", 
      disable_web_page_preview: true
    };
    
    if (settings.topicID) payload.message_thread_id = settings.topicID;
    
    if (part === 2) {
        const replyMarkup = createLabelButton(settings, data);
        if (replyMarkup) payload.reply_markup = replyMarkup;
    }
    
    if (part > 1 && replyToId) payload.reply_to_message_id = replyToId;

    let maxRetries = 3;
    let attempt = 0;
    let success = false;

    while (attempt < maxRetries && !success) {
        try {
            const resp = UrlFetchApp.fetch(`https://api.telegram.org/bot${settings.token}/sendMessage`, {
                method: "post", 
                contentType: "application/json", 
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            });
            
            const res = JSON.parse(resp.getContentText());
            
            if (res.ok) {
                messageIds[`id${part}`] = String(res.result.message_id);
                if (part === 1) replyToId = res.result.message_id;
                success = true;
            } else {
                Logger.log(`⚠️ បញ្ហាផ្ញើ Telegram (ការប៉ុនប៉ងលើកទី ${attempt + 1}): ${res.description}`);
                if (res.error_code === 429) Utilities.sleep(2000);
                else if (res.error_code === 400 && res.description.includes("parse")) break; 
                else Utilities.sleep(1000);
            }
        } catch (e) { 
            Logger.log(`❌ បញ្ហាប្រព័ន្ធបណ្តាញបញ្ជូនទៅ Telegram (ការប៉ុនប៉ងលើកទី ${attempt + 1}): ${e.message}`);
            Utilities.sleep(1000);
        }
        attempt++;
    }
    Utilities.sleep(300);
  }
  return messageIds;
}

function editTelegramMessage(settings, messageId, newText, orderData, part) {
    const payload = { 
        chat_id: settings.groupID, 
        message_id: messageId, 
        text: newText, 
        parse_mode: "Markdown",
        disable_web_page_preview: true
    };
    
    if (part === 2) {
        const replyMarkup = createLabelButton(settings, orderData);
        if (replyMarkup) payload.reply_markup = replyMarkup;
    }
    
    try {
        const resp = UrlFetchApp.fetch(`https://api.telegram.org/bot${settings.token}/editMessageText`, {
            method: "post", 
            contentType: "application/json", 
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        });
        
        const resJson = JSON.parse(resp.getContentText());
        if (!resJson.ok) {
             Logger.log(`⚠️ បញ្ហាកែប្រែសារ: ${resJson.description}`);
             return null;
        }
        return messageId;
    } catch(e){ 
        Logger.log(`❌ បញ្ហាប្រព័ន្ធបណ្តាញកែប្រែសារ: ${e.message}`);
        return null; 
    }
}

// ✅ UPGRADED: ជួសជុលបញ្ហាបាត់ {{date}} និងរៀបចំទម្រង់ម៉ោងភ្នំពេញ
function generateTelegramTextPart(data, template, part) {
  const req = data.originalRequest || {};
  const customer = req.customer || {};
  const shipping = req.shipping || {};
  const payment = req.payment || {};
  const currentUser = req.currentUser || {};
  
  const safeNum = (v) => { let n = parseFloat(v); return isNaN(n) ? 0 : n; };

  let productsList = "";
  if(req.products && Array.isArray(req.products)){
    req.products.forEach(p => {
      productsList += `🛍️ *${p.name || p.ProductName || 'មិនមានឈ្មោះ'}* - x*${p.quantity || 1}* ($${safeNum(p.finalPrice || p.price).toFixed(2)})\n`;
      if (p.colorInfo || p.Color) productsList += `🎨 (${p.colorInfo || p.Color})\n`;
      productsList += `--------------------------------------\n`;
    });
  }

  let shippingMethod = shipping.method || "";
  let shippingDetails = shipping.details || "";
  let finalShippingDetails = (shippingDetails && shippingDetails !== shippingMethod) ? ` (${shippingDetails})` : "";
  
  let paymentStatusStr = "🟥 COD (មិនទាន់បង់)";
  if (payment.status === "Paid") {
     paymentStatusStr = `✅ បង់ប្រាក់រួច (${payment.info || ""})`;
  } else if (payment.status) {
     paymentStatusStr = payment.status;
  }

  let dateStr = "";
  let targetTime = data.scheduledTime || data.timestamp;
  if (targetTime) {
    try {
      const d = new Date(targetTime);
      // ទម្រង់: ថ្ងៃ/ខែ/ឆ្នាំ ម៉ោង:នាទី (ឧទាហរណ៍: 11/03/2026 12:30 PM)
      dateStr = Utilities.formatDate(d, "Asia/Phnom_Penh", "dd/MM/yyyy hh:mm a"); 
    } catch (e) {
      dateStr = targetTime; 
    }
  }

  let finalTemplate = template
      .replace(/{{orderid}}/gi, data.orderId || "")
      .replace(/{{customername}}/gi, customer.name || "")
      .replace(/{{customerphone}}/gi, formatPhoneNumber(customer.phone))
      .replace(/{{location}}/gi, data.fullLocation || "")
      .replace(/{{addressdetails}}/gi, customer.additionalLocation || "(មិនមាន)")
      .replace(/{{productslist}}/gi, productsList.trim())
      .replace(/{{subtotal}}/gi, safeNum(req.subtotal).toFixed(2))
      .replace(/{{shippingfee}}/gi, safeNum(customer.shippingFee).toFixed(2))
      .replace(/{{grandtotal}}/gi, safeNum(req.grandTotal).toFixed(2))
      .replace(/{{paymentstatus}}/gi, paymentStatusStr)
      .replace(/{{fulfillmentstore}}/gi, data.fulfillmentStore || req.fulfillmentStore || "")
      .replace(/{{shippingmethod}}/gi, shippingMethod)
      .replace(/{{shippingdetails}}/gi, finalShippingDetails)
      .replace(/{{sourceinfo}}/gi, req.page || "")
      .replace(/{{maplink}}/gi, req.mapLink || "")
      .replace(/{{fulfillmentstatus}}/gi, data.fulfillmentStatus || "Pending")
      .replace(/{{user}}/gi, currentUser.UserName || currentUser.userName || "System")
      .replace(/{{date}}/gi, dateStr) 
      .replace(/{{note}}/gi, req.note ? `\n📝 *ចំណាំ:*\n${req.note}` : "");
      
  return finalTemplate;
}

function createLabelButton(settings, data) {
  if (!settings.labelPrinterURL) return null;
  const req = data.originalRequest || {};
  const customer = req.customer || {};
  
  let mapLink = req.mapLink || "";
  const fullText = (customer.additionalLocation || "") + " " + (data.fullLocation || "") + " " + (req.note || "");
  if (!mapLink) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matches = fullText.match(urlRegex);
      if (matches && matches.length > 0) mapLink = matches[0];
  }
  
  const storeValue = data.fulfillmentStore || req.fulfillmentStore || "";
  
  const params = [
    `id=${encodeURIComponent(data.orderId || "")}`,
    `name=${encodeURIComponent(customer.name || "")}`,
    `phone=${encodeURIComponent(formatPhoneNumber(customer.phone))}`, 
    `location=${encodeURIComponent(data.fullLocation || "")}`,
    `address=${encodeURIComponent(customer.additionalLocation || "")}`,
    `total=${encodeURIComponent(req.grandTotal || 0)}`,
    `payment=${encodeURIComponent((req.payment && req.payment.status) || "")}`,
    `shipping=${encodeURIComponent((req.shipping && req.shipping.method) || "")}`,
    `user=${encodeURIComponent((req.currentUser && (req.currentUser.UserName || req.currentUser.userName)) || "System")}`,
    `page=${encodeURIComponent(req.page || "")}`,
    `store=${encodeURIComponent(storeValue)}`,
    `map=${encodeURIComponent(mapLink)}`,
    `note=${encodeURIComponent(req.note || "")}`
  ];
  return { "inline_keyboard": [[{ "text": "📦 ព្រីន Label", "url": `${settings.labelPrinterURL}?${params.join('&')}` }]] };
}

// --- មុខងារទាញយកទិន្នន័យ (Data Access Helpers) ---

function fetchOrderDataFromSheet(orderId, team) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);
    if (!sheet) return null; 
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => normalizeKey(h));
    const idCol = headers.indexOf(normalizeKey("Order ID"));
    
    for (let i = data.length - 1; i > 0; i--) {
        if (String(data[i][idCol]) === String(orderId)) {
            const row = data[i];
            const get = (key) => row[headers.indexOf(normalizeKey(key))];
            let prods = []; try { prods = JSON.parse(get("Products (JSON)")); } catch(e) {}
            
            return {
                orderId: orderId,
                fullLocation: get("Location"),
                fulfillmentStore: get("Fulfillment Store"),
                originalRequest: {
                    customer: { name: get("Customer Name"), phone: get("Customer Phone"), additionalLocation: get("Address Details"), shippingFee: get("Shipping Fee (Customer)") },
                    products: prods,
                    subtotal: get("Subtotal"),
                    grandTotal: get("Grand Total"),
                    payment: { status: get("Payment Status"), info: get("Payment Info") },
                    shipping: { method: get("Internal Shipping Method"), details: get("Internal Shipping Details") },
                    currentUser: { UserName: get("User") },
                    page: get("Page"),
                    note: get("Note"),
                    fulfillmentStore: get("Fulfillment Store")
                },
                fulfillmentStatus: get("Fulfillment Status"),
                timestamp: get("Timestamp")
            };
        }
    }
    return null;
}

function getStoreSettings(storeName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.STORES_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  for (const row of data) {
    if (row[headers.indexOf("StoreName")] == storeName) {
      return {
        token: row[headers.indexOf("TelegramBotToken")],
        groupID: row[headers.indexOf("TelegramGroupID")],
        topicID: row[headers.indexOf("TelegramTopicID")],
        labelPrinterURL: row[headers.indexOf("LabelPrinterURL")]
      };
    }
  }
  return {};
}

function getTelegramTemplates(team) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TELEGRAM_TEMPLATES_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const map = new Map();
  data.forEach(row => {
    if (row[headers.indexOf("Team")] == team) map.set(row[headers.indexOf("Part")], row[headers.indexOf("Template")]);
  });
  return map;
}

function updateMessageIdInSheet(sheetName, orderId, ids) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("Order ID"), m1 = headers.indexOf("Telegram Message ID 1"), m2 = headers.indexOf("Telegram Message ID 2");
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] == orderId) {
      if (ids.id1) sheet.getRange(i+1, m1+1).setValue(ids.id1);
      if (ids.id2) sheet.getRange(i+1, m2+1).setValue(ids.id2);
      break;
    }
  }
}

function getMessageIdsFromSheet(orderId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ALL_ORDERS_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("Order ID"), m1 = headers.indexOf("Telegram Message ID 1"), m2 = headers.indexOf("Telegram Message ID 2");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(orderId)) return { id1: data[i][m1], id2: data[i][m2] };
  }
  return { id1: null, id2: null };
}

function getStoreFromOrderSheet(orderId) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ALL_ORDERS_SHEET);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf("Order ID"), storeCol = headers.indexOf("Fulfillment Store");
    for (let i = 1; i < data.length; i++) if (String(data[i][idCol]) === String(orderId)) return data[i][storeCol];
    return "Unknown";
}

function getDefaultStoreForTeam(team) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PAGES_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  for (const row of data) if (row[headers.indexOf("Team")] == team) return row[headers.indexOf("DefaultStore")];
  return null;
}

function getTeamTopicId(team, store) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PAGES_SHEET);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const teamCol = headers.indexOf("Team"), topicCol = headers.indexOf("TelegramTopicID");
  for (const row of data) {
    if (row[teamCol] == team) {
      const topics = String(row[topicCol] || "");
      if (!topics.includes(":")) return topics.trim();
      const map = topics.split(",").find(t => t.split(":")[0].trim().toLowerCase() === store.toLowerCase());
      return map ? map.split(":")[1].trim() : null;
    }
  }
  return null;
}

function extractDriveFolderID(idOrURL) {
  if (!idOrURL) return "root";
  idOrURL = String(idOrURL).trim();
  if (idOrURL.indexOf("drive.google.com") !== -1) {
    if (idOrURL.indexOf("folders/") !== -1) {
      return idOrURL.split("folders/")[1].split("?")[0].split("/")[0];
    }
    if (idOrURL.indexOf("id=") !== -1) {
      return idOrURL.split("id=")[1].split("&")[0];
    }
  }
  return idOrURL;
}

function uploadImageToDrive(base64, name, mime, folderId, user) {
  console.log("📤 [Drive Upload] Starting upload: name=" + name + " mime=" + mime + " folderId=" + folderId + " user=" + user);
  
  try {
    const targetFolderId = extractDriveFolderID(folderId);
    let folder;
    
    // ✅ Validate folderId is not a placeholder or empty
    if (!targetFolderId || targetFolderId === "root") {
      console.log("📁 [Drive Upload] Using root folder (no target specified)");
      folder = DriveApp.getRootFolder();
    } else if (!isValidFolderId(targetFolderId)) {
      console.warn("⚠️ [Drive Upload] Invalid Folder ID format: " + targetFolderId + ". Using root folder.");
      folder = DriveApp.getRootFolder();
    } else {
      try {
        console.log("📁 [Drive Upload] Accessing folder: " + targetFolderId);
        folder = DriveApp.getFolderById(targetFolderId);
      } catch (folderError) {
        console.warn("⚠️ [Drive Upload] Folder not accessible, attempting root folder: " + folderError.message);
        folder = DriveApp.getRootFolder();
      }
    }
    
    const decoded = Utilities.base64Decode(base64.includes("base64,") ? base64.split("base64,")[1] : base64);
    const fileName = name || "upload_" + new Date().getTime();
    console.log("💾 [Drive Upload] Creating file: " + fileName + " size=" + decoded.length + " bytes");
    
    const file = folder.createFile(Utilities.newBlob(decoded, mime, fileName));
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    const result = { url: `https://drive.google.com/uc?id=${file.getId()}`, fileID: file.getId() };
    console.log("✅ [Drive Upload] SUCCESS: fileID=" + result.fileID + " url=" + result.url);
    
    return result;
  } catch (e) {
    console.error("❌ [Drive Upload] FAILED: " + e.message);
    // ✅ Provide clearer error message for DriveApp access issues
    let errorDetail = e.message;
    if (e.message.indexOf("Access denied") !== -1 || e.message.indexOf("DriveApp") !== -1) {
      errorDetail = "DriveApp មិនអាចប្រើបានទេ - សូមពិនិត្យ scopes ក្នុង appsscript.json ឱ្យបញ្ចូល https://www.googleapis.com/auth/drive";
      console.error("🔧 [Drive Upload] Fix: Add 'https://www.googleapis.com/auth/drive' to oauthScopes in appsscript.json");
    }
    throw new Error("ការ Upload រូបភាពទៅ Google Drive បានបរាជ័យ: " + errorDetail);
  }
}

/**
 * ពិនិត្យមើលថា folder ID មាន format ត្រឹមត្រូវឬទេ
 * Google Drive folder IDs គឺជា string ប្រវែង 44 characters
 */
function isValidFolderId(id) {
  if (!id || typeof id !== 'string') return false;
  // Skip if it's placeholder text (Khmer characters)
  if (/[\u1780-\u17FF]/.test(id)) return false;
  // Skip if it's the actual placeholder message
  if (id.indexOf("Folder_Google_Drive") !== -1) return false;
  return true;
}

function logUserActivity(user, action, details) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.USER_ACTIVITY_LOGS_SHEET);
  if (sheet) sheet.appendRow([new Date(), user, action, details]);
}

function logEdit(orderId, user, field, oldVal, newVal) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.EDIT_LOGS_SHEET);
  if (sheet) sheet.appendRow([new Date(), orderId, user, field, oldVal, newVal]);
}

function createJsonResponse(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function appendRowMapped(sheet, dataMap) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // ✅ FIX: បំប្លែង Key ទាំងអស់ពី Backend ឱ្យទៅជាអក្សរតូច (Normalize) មុននឹងទាញយក
  const normalizedData = {};
  for (const k in dataMap) {
    normalizedData[normalizeKey(k)] = dataMap[k];
  }

  const row = headers.map(h => {
    const key = normalizeKey(h);
    const val = normalizedData[key]; // ឥឡូវនេះវាទាញយកបាន ១០០%
    return key.includes("phone") ? "'" + (val || "") : (val !== undefined ? val : "");
  });
  sheet.appendRow(row);
}

// =========================================================================
// REAL-TIME SYNC: SHEET -> DB (WEBHOOK)
// =========================================================================

/**
 * មុខងារសម្រាប់កំណត់ URL របស់ Backend (ត្រូវរត់មុខងារនេះម្ដងសិន)
 */
function setupWebhook() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('🔗 កំណត់ URL របស់ Backend', 'សូមបញ្ចូល URL របស់ Backend របស់អ្នក (ឧទាហរណ៍: https://your-app.com):', ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() == ui.Button.OK) {
    const url = response.getResponseText().replace(/\/$/, ""); // លុប / នៅខាងចុង
    PropertiesService.getScriptProperties().setProperty('BACKEND_URL', url);
    ui.alert('✅ បានរក្សាទុក URL ជោគជ័យ!');
  }
}

/**
 * Trigger ពេលមានការកែប្រែលើ Sheet (ប្រើ Installable Trigger "onChange" ឬ "onEdit")
 * សម្គាល់៖ onEdit ធម្មតាមិនអាចប្រើ UrlFetchApp បានទេ ត្រូវបង្កើត "Installable Trigger" ក្នុង Apps Script Console
 */
function handleSheetEdit(e) {
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const row = e.range.getRow();

  // បញ្ជី Sheet ដែលអនុញ្ញាតឱ្យ Sync ទៅ Database វិញ
  const syncSheets = [
    CONFIG.MOVIES_SHEET, 
    CONFIG.USERS_SHEET, 
    CONFIG.STORES_SHEET, 
    CONFIG.PAGES_SHEET,
    CONFIG.PRODUCTS_SHEET,
    CONFIG.SHIPPING_METHODS_SHEET,
    CONFIG.COLORS_SHEET,
    CONFIG.DRIVERS_SHEET,
    CONFIG.BANK_ACCOUNTS_SHEET,
    CONFIG.PHONE_CARRIERS_SHEET,
    CONFIG.TELEGRAM_TEMPLATES_SHEET,
    CONFIG.LOCATIONS_SHEET,
    CONFIG.ROLES_SHEET,
    CONFIG.ROLE_PERMISSIONS_SHEET,
    CONFIG.DRIVER_RECOMMENDATIONS_SHEET,
    CONFIG.SETTINGS_SHEET,
    CONFIG.ALL_ORDERS_SHEET
  ];

  if (!syncSheets.includes(sheetName) || row === 1) return;

  const backendUrl = PropertiesService.getScriptProperties().getProperty('BACKEND_URL');
  if (!backendUrl) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowDataValues = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  const rowData = {};
  headers.forEach((h, i) => {
    if (h) rowData[h] = rowDataValues[i];
  });

  const payload = {
    secret: SCRIPT_SECRET_KEY,
    sheetName: sheetName,
    rowData: rowData,
    action: "update"
  };

  try {
    UrlFetchApp.fetch(`${backendUrl}/api/webhook/sheets-sync`, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    console.error("Webhook Error: " + err.message);
  }
}

// ============================================================
// HLS VIDEO PROXY — Google Drive Folder Streaming (Option C)
// ============================================================

/**
 * Main Web App Entry Point for Apps Script
 * You must deploy this script as a "Web App" (Execute as: Me, Access: Anyone)
 */
function doGet(e) {
  var action = e.parameter.action;

  if (action === 'hls_playlist') {
    var folderId = e.parameter.folderId;
    if (!folderId) return ContentService.createTextOutput("Missing folderId");
    return handleHlsPlaylist(folderId);
  } 

  return ContentService.createTextOutput("System Online. Use action=hls_playlist&folderId=...");
}

/**
 * Serve a rewritten .m3u8 playlist from a Google Drive folder.
 * Changes relative .ts segment paths to direct Google Drive download URLs.
 */
function handleHlsPlaylist(folderId) {
  try {
    var folder = DriveApp.getFolderById(folderId);
    var m3u8File = null;
    
    // 1. Find the .m3u8 file
    var files = folder.getFilesByType('application/x-mpegurl');
    if (files.hasNext()) {
      m3u8File = files.next();
    } else {
      var allFiles = folder.getFiles();
      while (allFiles.hasNext()) {
        var f = allFiles.next();
        if (f.getName().toLowerCase().endsWith('.m3u8')) {
          m3u8File = f;
          break;
        }
      }
    }

    if (!m3u8File) {
      return ContentService.createTextOutput('Error: No .m3u8 file found in folder ' + folderId)
        .setMimeType(ContentService.MimeType.TEXT);
    }

    // 2. Read raw playlist
    var rawPlaylist = m3u8File.getBlob().getDataAsString('UTF-8');

    // 3. Map TS segment filenames to their Drive File IDs
    var segmentMap = {};
    var segFiles = folder.getFiles();
    while (segFiles.hasNext()) {
      var sf = segFiles.next();
      var sfName = sf.getName();
      if (sfName.toLowerCase().endsWith('.ts')) {
        segmentMap[sfName] = sf.getId();
      }
    }

    // 4. Rewrite segments to direct Google Drive download URLs
    var lines = rawPlaylist.split('\n');
    var rewritten = lines.map(function(line) {
      var trimmed = line.trim();
      if (!trimmed.startsWith('#') && trimmed.toLowerCase().endsWith('.ts')) {
        var segmentName = trimmed.replace(/\r$/, '');
        var targetFileId = segmentMap[segmentName] || segmentMap[decodeURIComponent(segmentName)];
        
        if (targetFileId) {
          // Send direct Drive download link so HLS.js can fetch binary TS chunks effortlessly
          return 'https://drive.google.com/uc?export=download&id=' + targetFileId;
        }
      }
      return line;
    });

    var output = rewritten.join('\n');
    
    // Return M3U8 payload
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (e) {
    return ContentService.createTextOutput('Error parsing playlist: ' + e.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
