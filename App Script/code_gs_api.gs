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
    
    let contents;
    try {
      contents = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({ status: 'error', message: 'JSON Invalid: ' + parseErr.message }, 400);
    }

    if (!contents || typeof contents !== 'object') {
      return createJsonResponse({ status: 'error', message: 'Payload ត្រូវតែជា JSON Object' }, 400);
    }

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
        // Pass the lock so updateOrderTelegram can release it before slow Telegram API calls.
        // This lets concurrent packers proceed in parallel once Sheet writes are done.
        const updateRes = updateOrderTelegram(updateData, lock);
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

      case 'diagnose':
        return handleDiagnose(contents);

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
          // Release lock BEFORE Drive upload — Drive upload is slow (~10-30s) and doesn't
          // touch the spreadsheet. Holding the script lock during upload blocks all other
          // concurrent requests (e.g. updateOrderTelegram from another packer).
          // The finally block's releaseLock() is a safe no-op if already released.
          lock.releaseLock();

          // 1. Upload to Drive
          const upRes = uploadImageToDrive(contents.fileData, contents.fileName, contents.mimeType, contents.uploadFolderID, contents.userName);
          if (!upRes || !upRes.url) {
            console.error("❌ [uploadImage] Drive upload failed, no URL returned.");
            return createJsonResponse({ status: 'error', message: 'ការបង្ហោះរូបភាពទៅ Drive បរាជ័យ' }, 500);
          }
          console.log("📤 [uploadImage] Upload success: " + upRes.url);

          // 2. Metadata Updates (Sync to Sheets)
          const orderId = contents.orderId || contents.orderID;
          if (orderId) {
             console.log("✅ [uploadImage] Order Drive upload done, updating Sheet for Order: " + orderId);
             
             // Combine photo URL with other metadata (Status, Packed By, etc.)
             const updateData = contents.newData || {};
             if (contents.targetColumn) {
               updateData[contents.targetColumn] = upRes.url;
             } else {
               updateData["Package Photo"] = upRes.url;
             }

             try {
               const updateResult = handleUpdateSheet({
                 sheetName: CONFIG.ALL_ORDERS_SHEET,
                 primaryKey: { "Order ID": orderId },
                 newData: updateData
               });
               
               // Also update the Team-specific sheet if needed
               if (contents.team) {
                 handleUpdateSheet({
                   sheetName: `${CONFIG.ORDER_SHEET_PREFIX}${contents.team}`,
                   primaryKey: { "Order ID": orderId },
                   newData: updateData
                 });
               }
               
               return createJsonResponse({ 
                 status: 'success', 
                 url: upRes.url, 
                 fileID: upRes.fileID,
                 sheetUpdated: updateResult.status === 'success'
               });
             } catch (sheetErr) {
               console.error("⚠️ [uploadImage] Sheet sync failed but Drive OK: " + sheetErr.message);
               return createJsonResponse({ status: 'success', url: upRes.url, fileID: upRes.fileID, warning: "Sheet sync failed" });
             }
          } else if (contents.sheetName && contents.primaryKey && contents.targetColumn) {
             // Handle generic table updates
             const newData = {};
             newData[contents.targetColumn] = upRes.url;
             try {
               handleUpdateSheet({
                 sheetName: contents.sheetName,
                 primaryKey: contents.primaryKey,
                 newData: newData
               });
               console.log("✅ [uploadImage] Generic Sheet updated: " + contents.sheetName);
               return createJsonResponse({ status: 'success', url: upRes.url, fileID: upRes.fileID });
             } catch (sheetErr) {
               console.error("⚠️ [uploadImage] Generic sheet sync failed: " + sheetErr.message);
               return createJsonResponse({ status: 'success', url: upRes.url, warning: "Sheet sync failed" });
             }
          } else if (contents.userName && contents.fileName === 'profile_picture') {
             // Handle user profile picture
             try {
               handleUpdateSheet({
                 sheetName: CONFIG.USERS_SHEET,
                 primaryKey: { "UserName": contents.userName },
                 newData: { "ProfilePictureURL": upRes.url }
               });
               console.log("✅ [uploadImage] User profile updated for: " + contents.userName);
             } catch (sheetErr) {
               console.error("⚠️ [uploadImage] User profile sheet sync failed: " + sheetErr.message);
             }
          } else if (contents.movieId && contents.targetColumn) {
             // Handle movies
             try {
               handleUpdateSheet({
                 sheetName: CONFIG.MOVIES_SHEET,
                 primaryKey: { "ID": contents.movieId },
                 newData: { [contents.targetColumn]: upRes.url }
               });
               console.log("✅ [uploadImage] Movie updated for ID: " + contents.movieId);
             } catch (sheetErr) {
               console.error("⚠️ [uploadImage] Movie sheet sync failed: " + sheetErr.message);
             }
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
  const normalizedHeaders = headers.map(h => normalizeKey(h));
  
  // 1. Identify Primary Key for Idempotency
  let pkField = "id"; // Default
  if (data.sheetName === "Users") pkField = "username";
  else if (data.sheetName === "Stores") pkField = "storename";
  else if (data.sheetName === "Products") pkField = "barcode";
  else if (data.sheetName === "AllOrders" || data.sheetName.indexOf("Orders_") === 0) pkField = "orderid";
  
  const pkValue = data.newData[Object.keys(data.newData).find(k => normalizeKey(k) === pkField)];

  // 2. If PK value exists, check if row already exists to prevent duplicates
  if (pkValue) {
    const pkIdx = normalizedHeaders.indexOf(pkField);
    if (pkIdx !== -1) {
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (normalizeKey(values[i][pkIdx]) === normalizeKey(pkValue)) {
          console.warn("⚠️ [Idempotency] Row already exists for PK: " + pkValue + " in " + data.sheetName + ". Updating instead.");
          return handleUpdateSheet({
            sheetName: data.sheetName,
            primaryKey: { [headers[pkIdx]]: pkValue },
            newData: data.newData
          });
        }
      }
    }
  }

  // 3. Auto-generate numeric ID if required and missing
  const idColIdx = normalizedHeaders.indexOf("id");
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
    if (!sheet) return createJsonResponse({ status: "error", message: "រកមិនឃើញ Sheet: " + data.sheetName }, 404);
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const normalizedHeaders = headers.map(h => normalizeKey(h));
    
    const pkKeys = Object.keys(data.primaryKey);
    let rowIndex = -1;

    // 1. Try to find by 'ID' first if it exists in primaryKey, as it's the most reliable and fastest
    const idKey = pkKeys.find(k => normalizeKey(k) === "id");
    if (idKey) {
      const idVal = data.primaryKey[idKey];
      const idColIdx = normalizedHeaders.indexOf("id");
      if (idColIdx !== -1) {
        const searchRange = sheet.getRange(1, idColIdx + 1, sheet.getLastRow(), 1);
        const finder = searchRange.createTextFinder(String(idVal).trim()).matchEntireCell(true);
        const match = finder.findNext();
        if (match) {
          rowIndex = match.getRow();
          console.log("🚀 [UpdateSheet] ID lookup success! Row: " + rowIndex);
        }
      }
    }

    // 2. Optimized Row Lookup using TextFinder (single-key PK only, if ID not found)
    if (rowIndex === -1 && pkKeys.length === 1) {
      const pkColName = pkKeys[0];
      const pkValue = data.primaryKey[pkColName];
      const pkIdx = normalizedHeaders.indexOf(normalizeKey(pkColName));

      if (pkIdx !== -1) {
        const searchRange = sheet.getRange(1, pkIdx + 1, sheet.getLastRow(), 1);
        const finder = searchRange.createTextFinder(String(pkValue).trim()).matchEntireCell(true);
        const match = finder.findNext();
        if (match) {
          rowIndex = match.getRow();
          console.log("🚀 [UpdateSheet] Fast lookup success! Row: " + rowIndex);
        }
      }
    }

    // 3. Fallback to manual scan if TextFinder fails, composite PK, or column not found
    if (rowIndex === -1) {
      console.log("🔍 [UpdateSheet] Using full scan for PK matching...");
      const values = sheet.getDataRange().getValues();
      const targetPkVals = {};
      for (const [k, v] of Object.entries(data.primaryKey)) { 
        targetPkVals[normalizeKey(k)] = normalizeKey(v); 
      }

      for (let i = 1; i < values.length; i++) {
        let match = true;
        for (const pkKey in targetPkVals) {
          const col = normalizedHeaders.indexOf(pkKey);
          if (col === -1) {
            match = false;
            break;
          }
          
          const cellVal = normalizeKey(values[i][col]);
          const targetVal = targetPkVals[pkKey];
          
          if (cellVal !== targetVal) {
            match = false;
            break;
          }
        }
        if (match) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    // Row not found — for non-Order sheets, upsert (add new row) instead of failing
    if (rowIndex === -1) {
      const isOrderSheet = data.sheetName === 'AllOrders' || String(data.sheetName).indexOf('Orders_') === 0;
      if (!isOrderSheet) {
        console.log("⚡ [UpdateSheet] Row not found — upserting as new row for: " + data.sheetName);
        const upsertData = Object.assign({}, data.primaryKey, data.newData);
        return handleAddRow({ sheetName: data.sheetName, newData: upsertData });
      }
      console.error("❌ [UpdateSheet] Row not found for PK: " + JSON.stringify(data.primaryKey));
      return createJsonResponse({ status: "error", message: "រកមិនឃើញជួរទិន្នន័យដើម្បីកែប្រែ" }, 404);
    }

    {
      let updatedCount = 0;
      const rowRange = sheet.getRange(rowIndex, 1, 1, headers.length);
      const rowData = rowRange.getValues()[0];

      const aliasMap = {
        "packagephotourl": ["packagephoto", "packagephotourl", "packagephotolink", "packagephotoevidence", "packphoto", "package photo"],
        "packagephoto": ["packagephotourl", "packagephoto", "packagephotolink", "packagephotoevidence", "packphoto", "package photo"],
        "orderid": ["orderid", "id", "orderno", "order#", "order id"],
        "deliveryphotourl": ["deliveryphoto", "deliveryphotourl", "deliveryphotolink", "proofofdelivery", "deliveryphotoevidence", "delivery photo url"],
        "deliveryphoto": ["deliveryphotourl", "deliveryphoto", "deliveryphotolink", "proofofdelivery", "deliveryphotoevidence", "delivery photo url"],
        "fulfillmentstatus": ["fulfillmentstatus", "status", "orderstatus", "fulfillment status"],
        "fulfillmentstore": ["fulfillmentstore", "store", "warehouse", "fulfillment store"]
      };

      for (const [key, val] of Object.entries(data.newData)) {
        const nKey = normalizeKey(key);
        // Skip if this key is part of the primaryKey and it already matches
        if (data.primaryKey[key] !== undefined && normalizeKey(data.primaryKey[key]) === normalizeKey(val)) {
          continue;
        }

        let colIdx = normalizedHeaders.indexOf(nKey);
        
        if (colIdx === -1) {
          const aliases = aliasMap[nKey] || [];
          for (const alias of aliases) {
            colIdx = normalizedHeaders.indexOf(normalizeKey(alias));
            if (colIdx !== -1) break;
          }
        }

        if (colIdx !== -1) {
          let v = val;
          // Robust boolean handling
          if (typeof v === 'string') {
            const lowV = v.toLowerCase().trim();
            if (lowV === 'true') v = true;
            else if (lowV === 'false') v = false;
          }
          rowData[colIdx] = v;
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        rowRange.setValues([rowData]);
        SpreadsheetApp.flush();
        console.log("✅ [UpdateSheet] Atomic update success for row " + rowIndex + " (Fields: " + updatedCount + ")");
      } else {
        console.log("ℹ️ [UpdateSheet] No fields actually needed updating for row " + rowIndex);
      }
      return createJsonResponse({ status: "success", updated: updatedCount, rowIndex: rowIndex });
    }
  } catch (e) {
    console.error("❌ [UpdateSheet] FAILED: " + e.message);
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

        // 1. ទាញទិន្នន័យពេញលេញ (fetch ម្ដងគត់ — sendOrderToTelegram នឹងប្រើ forceSync:true)
        const orderData = fetchOrderDataFromSheet(orderId, team);
        if (orderData) {
          // 2. ផ្ញើ Telegram ជាមុន — ប្រសិនបើបរាជ័យ status នៅជា "Scheduled" ដើម្បីអាច retry ម្ដងទៀត
          const msgIds = sendOrderToTelegram({
            orderId: orderId,
            team: team,
            fulfillmentStore: orderData["Fulfillment Store"],
            forceSync: true, // skip duplicate fetchOrderDataFromSheet inside sendOrderToTelegram
            ...orderData
          });

          // 3. ប្តូរ Status ទៅជា Pending — ធ្វើបន្ទាប់ពីព្យាយាមផ្ញើ Telegram
          //    បើ msgIds ទទេ (Telegram fail) សូម log warning — status នៅ Scheduled ដើម្បី retry
          if (msgIds && (msgIds.id1 || msgIds.id2 || msgIds.id3)) {
            updateOrderInSheets(orderId, team, { "Fulfillment Status": "Pending" });
            processedCount++;
          } else {
            Logger.log(`⚠️ Telegram failed for scheduled order ${orderId} — keeping status Scheduled for retry`);
          }
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
    if (!sheet) {
      console.warn("⚠️ [updateOrderInSheets] Sheet not found: " + sheetName);
      return;
    }

    const result = handleUpdateSheet({
      sheetName: sheetName,
      primaryKey: { "Order ID": orderId },
      newData: updatedFields
    });

    // Log failures so they are visible in Apps Script execution logs
    try {
      const parsed = JSON.parse(result.getContent());
      if (parsed.status !== "success") {
        console.error("❌ [updateOrderInSheets] Failed to update sheet=" + sheetName + " orderId=" + orderId + " reason=" + parsed.message);
      }
    } catch (e) {
      // result might not be JSON if handleUpdateSheet returned something unexpected
      console.warn("⚠️ [updateOrderInSheets] Could not parse result for sheet=" + sheetName);
    }
  });
  SpreadsheetApp.flush();
}

function appendRowMapped(sheet, data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Pre-normalize data keys to ensure they match normalized headers
  const normalizedData = {};
  for (let k in data) {
    normalizedData[normalizeKey(k)] = data[k];
  }
  
  const row = headers.map(h => {
    const key = normalizeKey(h);
    return normalizedData[key] !== undefined ? normalizedData[key] : "";
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
    let rawProducts = data.productsJSON || data["Products (JSON)"] || req.products;
    
    if (rawProducts) {
      if (typeof rawProducts === 'string') {
        // CLEANING LOGIC: Remove common JSON-breaking characters
        let cleanedJSON = rawProducts
          .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
          .replace(/[\u2018\u2019]/g, "'") // Replace smart single quotes
          .trim();
        
        try {
          products = JSON.parse(cleanedJSON);
        } catch (innerErr) {
          console.warn("⚠️ [JSON Parse] Standard parse failed, attempting loose cleaning...");
          // Try to handle unescaped newlines or other minor issues
          cleanedJSON = cleanedJSON.replace(/\n/g, "\\n").replace(/\r/g, "\\r");
          products = JSON.parse(cleanedJSON);
        }
      } else {
        products = rawProducts;
      }
    }

    if (Array.isArray(products) && products.length > 0) {
      productsList = products.map(function(p, i) {
        const name = p.productName || p.ProductName || p.name || "N/A";
        const qty = p.quantity || p.Quantity || 1;
        const color = p.colorInfo || p.color || "";
        const price = p.finalPrice !== undefined ? p.finalPrice : (p.price || p.Price || 0);
        const colorText = color ? " (" + color + ")" : "";
        return (i + 1) + ". " + name + colorText + " x" + qty + " = $" + (price * qty).toFixed(2);
      }).join("\n");
    }
  } catch (e) {
    console.warn("❌ [sendTelegramMessage] Critical JSON failure: " + e.message);
    productsList = "⚠️ មិនអាចបង្ហាញបញ្ជីផលិតផលបាន (JSON Error)";
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
    "dispatchedBy": data["Dispatched By"] || "",
    "dispatchedTime": data["Dispatched Time"] || "",
    "deliveredTime": data["Delivered Time"] || "",
    "packagePhotoUrl": data["Package Photo"] || "",
    "deliveryPhotoUrl": data["Delivery Photo URL"] || data["Delivery Photo"] || ""
  };

  function applyTemplate(tpl) {
    if (!tpl) return "";
    return tpl.replace(/\{\{(\w+)\}\}/g, function(m, key) {
      let val = vars[key] !== undefined ? vars[key] : m;
      
      // ESCAPE LOGIC: Protect Telegram Markdown V1 special characters
      // We only escape if the value is a string and not already formatted by our logic
      if (typeof val === 'string' && key !== 'paymentStatus' && key !== 'note' && key !== 'shippingDetails') {
        // Characters to escape: * _ ` [
        return val.replace(/([*_`\[])/g, '\\$1');
      }
      return val;
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
    } else if (data["Fulfillment Status"] === "Ready to Ship" || data["Fulfillment Status"] === "Shipped" || data["Fulfillment Status"] === "Delivered" || data["Package Photo"]) {
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

  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const normalizedHeaders = headers.map(h => normalizeKey(h));
  const idIdx = normalizedHeaders.indexOf(normalizeKey("Order ID"));
  if (idIdx === -1) return null;

  // Fast lookup via TextFinder — avoids loading the entire sheet into memory
  const idColRange = sheet.getRange(2, idIdx + 1, lastRow - 1, 1);
  const match = idColRange.createTextFinder(String(orderId).trim()).matchEntireCell(true).findNext();
  if (!match) return null;

  const rowValues = sheet.getRange(match.getRow(), 1, 1, lastCol).getValues()[0];
  const orderData = {};
  headers.forEach((h, idx) => { orderData[h] = rowValues[idx]; });
  return orderData;
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

// lock is optional — passed from doPost so we can release it before slow Telegram API calls.
// When called without a lock (e.g. from scheduled triggers), it behaves as before.
function updateOrderTelegram(data, lock) {
  try {
    const orderId = data.orderId || data.OrderID;
    let team = data.team || data.Team;
    const updatedFields = data.updatedFields || data.newData || {};

    if (!orderId) {
      console.error("❌ updateOrderTelegram: Missing orderId");
      return { id1: null, id2: null, id3: null };
    }

    // Phase 1: Sheet update (must happen under the script lock to prevent row corruption)
    if (Object.keys(updatedFields).length > 0) {
      // If team is missing from request, try to find it from the main sheet first
      if (!team) {
        const tempOrder = fetchOrderDataFromSheet(orderId, "");
        if (tempOrder) team = tempOrder["Team"];
      }
      
      updateOrderInSheets(orderId, team, updatedFields);
      console.log("✅ updateOrderTelegram: Sheets updated for ID: " + orderId + " (Team: " + team + ")");
    }

    // Fetch full order data while still under lock (fast — uses TextFinder)
    const fullOrderData = fetchOrderDataFromSheet(orderId, team);

    // Phase 2: Release lock BEFORE slow Telegram API calls.
    if (lock) {
      try { lock.releaseLock(); } catch (_) {}
    }

    if (!fullOrderData) {
      console.error("❌ updateOrderTelegram: Order not found for ID: " + orderId);
      return { id1: null, id2: null, id3: null };
    }

    // ✅ SMART MERGE
    const normalizedData = {};
    for (let key in fullOrderData) {
      normalizedData[key] = fullOrderData[key];
    }

    const sheetHeaders = Object.keys(fullOrderData);
    for (let bKey in updatedFields) {
      const normBKey = normalizeKey(bKey);
      let found = false;
      for (let sKey of sheetHeaders) {
        if (normalizeKey(sKey) === normBKey) {
          normalizedData[sKey] = updatedFields[bKey];
          found = true;
          break;
        }
      }
      if (!found) {
        normalizedData[bKey] = updatedFields[bKey];
      }
    }

    normalizedData.orderId = orderId;
    normalizedData.team = team || normalizedData["Team"];
    normalizedData.fulfillmentStore = normalizedData["Fulfillment Store"] || updatedFields["Fulfillment Store"];
    normalizedData.forceSync = updatedFields["Force Sync"] === true || data.forceSync === true;

    return sendOrderToTelegram(normalizedData);
  } catch (e) {
    console.error("❌ updateOrderTelegram Error: " + e.message);
    return { id1: null, id2: null, id3: null };
  }
}

/**
 * មុខងារសម្រាប់តេស្តសិទ្ធិ (Permissions Test)
 * ដើម្បីដឹងថា Script មានសិទ្ធិ Upload ទៅ Drive និងយក Link បានឬនៅ។
 * របៀបប្រើ៖ ជ្រើសរើស function នេះក្នុង Apps Script Editor រួចចុច 'Run'។
 */
function testDriveAccess() {
  console.log("🚀 កំពុងសាកល្បងសិទ្ធិ Google Drive...");
  try {
    // ១. សាកល្បងបង្កើត File ជារូបភាពតូចមួយ
    const blob = Utilities.newBlob("Test Data: Permissions Verification", "text/plain", "Test_Permissions_" + Date.now() + ".txt");
    const file = DriveApp.createFile(blob);
    
    console.log("📁 បង្កើត File ជោគជ័យ: " + file.getName());

    // ២. សាកល្បងកំណត់ Permission ឱ្យមើលបាន (Public Link)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // ៣. បង្ហាញលទ្ធផលក្នុង Log
    console.log("✅ ជោគជ័យ! Script មានសិទ្ធិពេញលេញ។");
    console.log("🔗 Link ឯកសារតេស្ត: " + file.getUrl());
    console.log("🆔 File ID: " + file.getId());
    
    // ៤. លុប File តេស្តចោលវិញ ដើម្បីកុំឱ្យធ្ងន់ Drive
    file.setTrashed(true);
    console.log("🗑️ បានលុប File តេស្តចេញពី Drive វិញរួចរាល់។");
    
  } catch (e) {
    console.error("❌ បរាជ័យ! Script មិនមានសិទ្ធិទេ: " + e.message);
    if (e.message.includes("permission")) {
      console.warn("💡 យោបល់៖ សូមពិនិត្យមើលថា តើលោកអ្នកបានចុច 'Authorize' ឱ្យ Script នេះហើយឬនៅ?");
    }
  }
}


function handleDiagnose(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const sheetNames = sheets.map(s => "'" + s.getName() + "'");
    
    const rolePermSheet = ss.getSheetByName("RolePermissions");
    let sampleData = [];
    let headers = [];
    
    if (rolePermSheet) {
      const lastRow = Math.min(rolePermSheet.getLastRow(), 6);
      const lastCol = rolePermSheet.getLastColumn();
      if (lastRow > 0 && lastCol > 0) {
        const values = rolePermSheet.getRange(1, 1, lastRow, lastCol).getValues();
        headers = values[0];
        sampleData = values.slice(1);
      }
    }

    return createJsonResponse({
      status: "success",
      spreadsheetName: ss.getName(),
      spreadsheetId: ss.getId(),
      allSheetNames: sheetNames,
      rolePermissionsInfo: {
        exists: !!rolePermSheet,
        rowCount: rolePermSheet ? rolePermSheet.getLastRow() : 0,
        headers: headers,
        sampleRows: sampleData
      }
    });
  } catch (e) {
    return createJsonResponse({ status: "error", message: "Diagnose failed: " + e.message });
  }
}
