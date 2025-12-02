/**
 * @OnlyCurrentDoc
 */

// !!! IMPORTANT: Set a strong, unique secret key below !!!
const SCRIPT_SECRET_KEY = "168333@$Oudom"; // Replace with your actual secret

// --- CONFIGURATION (ត្រូវតែដូចគ្នានឹង setup.gs) ---
const CONFIG = {
  USERS_SHEET: 'Users',
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
  CHAT_MESSAGES_SHEET: 'ChatMessages'
};

// --- Main POST Handler ---
function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { 
    Logger.log("Could not acquire lock for doPost (API).");
    return createJsonResponse({ status: 'locked' }, 429);
  }

  try {
    const contents = JSON.parse(e.postData.contents);

    // --- NEW: Check for Telegram Webhook Update (Callback Query) ---
    // NOTE: ផ្នែកនេះលែងដំណើរការហើយដោយសារយើងប្រើ Go Backend សម្រាប់ Webhook
    // ប៉ុន្តែទុកវានៅទីនេះក៏មិនអីដែរ (Dead Code)
    if (contents.callback_query) {
       return handleTelegramCallback(contents.callback_query);
    }
    // ----------------------------------------------------------------

    const action = contents.action;
    const secret = contents.secret;

    if (secret !== SCRIPT_SECRET_KEY) {
      return createJsonResponse({ status: 'error', message: 'Unauthorized' }, 401);
    }

    switch (action) {
      case 'uploadImage':
        if (!contents.fileData || !contents.fileName || !contents.mimeType || !contents.uploadFolderID) {
          throw new Error("Missing fileData, fileName, mimeType, or uploadFolderID for uploadImage.");
        }
        const fileInfo = uploadImageToDrive(contents.fileData, contents.fileName, contents.mimeType, contents.uploadFolderID, contents.userName);
        return createJsonResponse({ status: 'success', url: fileInfo.url, fileID: fileInfo.fileID });

      case 'submitOrder':
        if (!contents.orderData) {
          throw new Error("Missing orderData for submitOrder.");
        }
        const orderId = processOrder(contents.orderData);
        return createJsonResponse({ status: 'success', orderId: orderId });
      
      case 'deleteFile':
         if (!contents.fileID) {
           throw new Error("Missing fileID for deleteFile.");
         }
         deleteFileFromDrive(contents.fileID);
         return createJsonResponse({ status: 'success', message: 'File deleted' });
         
      case 'updateOrderTelegram':
        if (!contents.orderData || !contents.orderData.orderId || !contents.orderData.team) {
          throw new Error("Missing orderData (orderId or team) for updateOrderTelegram.");
        }
        const messageIdResult = updateOrderTelegram(contents.orderData.orderId, contents.orderData.team);
        return createJsonResponse({ status: 'success', message: 'Telegram message update initiated', messageIds: messageIdResult });

      case 'deleteOrderTelegram':
        if (!contents.orderData || !contents.orderData.orderId || !contents.orderData.team) {
          throw new Error("Missing orderData (orderId or team) for deleteOrderTelegram.");
        }
        deleteOrderTelegramMessages(contents.orderData.orderId, contents.orderData.team);
        return createJsonResponse({ status: 'success', message: 'Telegram messages deletion triggered' });
        
      default:
        throw new Error("Invalid post action for API.");
    }

  } catch (error) {
    Logger.log(`doPost Error (API): ${error.toString()}\nStack: ${error.stack}`);
    return createJsonResponse({ status: 'error', message: error.message }, 500);
  } finally {
    lock.releaseLock();
  }
}

// --- Helper Functions ---

function createJsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function uploadImageToDrive(base64Data, fileName, mimeType, folderId, userName = "unknown") {
  try {
    if (!folderId || folderId.includes('YOUR_FOLDER_ID_HERE') || folderId.length < 15) {
         throw new Error("Upload Folder ID is not configured correctly.");
    }

    const decodedData = Utilities.base64Decode(base64Data, Utilities.Charset.UTF_8);
    const blob = Utilities.newBlob(decodedData, mimeType, fileName);
    const folder = DriveApp.getFolderById(folderId);
    const file = folder.createFile(blob);
    
    file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW); 
    file.setDescription(`Uploaded by: ${userName} on ${new Date().toISOString()}`);
    
    const fileId = file.getId();
    const fileUrl = `https://drive.google.com/uc?id=${fileId}`;
    
    return { url: fileUrl, fileID: fileId };

  } catch (e) {
    if (e.message.includes("File not found") && folderId.length > 15) {
       throw new Error(`Upload Failed. Please ensure the user '${Session.getEffectiveUser().getEmail()}' is added as a 'Content Manager' to the Shared Drive.`);
    }
    throw new Error(`Apps Script file upload failed. ${e.message}`);
  }
}

function deleteFileFromDrive(fileID) {
  try {
    const file = DriveApp.getFileById(fileID);
    file.setTrashed(true);
  } catch (e) {
    Logger.log(`Failed to delete file ${fileID}: ${e.message}`);
  }
}


// --- Order Processing Logic ---

function processOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const orderRequest = data.originalRequest;
  const team = orderRequest.selectedTeam;
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;
  
  // --- 1. ផ្លាស់ប្តូរទីតាំង Logic នៃការឆែកម៉ោង Schedule មកដាក់ខាងលើ ---
  const scheduleInfo = orderRequest.telegram;
  const isScheduled = scheduleInfo && scheduleInfo.schedule;
  let scheduleTime = null;

  if (isScheduled && scheduleInfo.time) {
    try {
      scheduleTime = new Date(scheduleInfo.time);
    } catch (e) {
      scheduleTime = null;
    }
  }

  // --- 2. កំណត់ Timestamp ឡើងវិញ ---
  let finalTimestamp = data.timestamp;
  
  if (scheduleTime) {
    finalTimestamp = scheduleTime; 
    data.timestamp = Utilities.formatDate(scheduleTime, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }

  const orderId = data.orderId;
  const totalDiscount = data.totalDiscount;
  const totalProductCost = data.totalProductCost;
  const fullLocation = data.fullLocation;
  const productsJSON = data.productsJSON;
  const shippingCost = data.shippingCost;
  
  const MSG_ID_1_PLACEHOLDER = "";
  const MSG_ID_2_PLACEHOLDER = "";

  // --- 3. Save to Sheets ---
  try {
    const teamSheet = ss.getSheetByName(orderSheetName);
    if (!teamSheet) throw new Error(`Sheet ${orderSheetName} not found.`);
    
    const rowData = [
      finalTimestamp,
      orderId, orderRequest.currentUser.UserName, orderRequest.page, orderRequest.telegramValue,
      orderRequest.customer.name, orderRequest.customer.phone, fullLocation,
      orderRequest.customer.additionalLocation, orderRequest.note, orderRequest.customer.shippingFee,
      orderRequest.subtotal, orderRequest.grandTotal, productsJSON,
      orderRequest.shipping.method, orderRequest.shipping.details, shippingCost,
      orderRequest.payment.status, orderRequest.payment.info,
      totalDiscount, shippingCost, 0, totalProductCost, 
      MSG_ID_1_PLACEHOLDER, MSG_ID_2_PLACEHOLDER
    ];
    teamSheet.appendRow(rowData);
    
    const allOrdersSheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);
    allOrdersSheet.appendRow(rowData.concat([team]));

    const revenueSheet = ss.getSheetByName(CONFIG.REVENUE_SHEET);
    revenueSheet.appendRow([finalTimestamp, team, orderRequest.page, orderRequest.grandTotal]);

    const activitySheet = ss.getSheetByName(CONFIG.USER_ACTIVITY_LOGS_SHEET);
    const activityDetails = JSON.stringify({ orderId: orderId, team: team, grandTotal: orderRequest.grandTotal });
    
    activitySheet.appendRow([finalTimestamp, orderRequest.currentUser.UserName, "SUBMIT_ORDER_GAS", activityDetails]);

  } catch (e) {
    throw new Error(`Failed to save order to sheet: ${e.message}`);
  }

  // --- 4. Logic សម្រាប់បង្កើត Trigger ---
  const now = new Date();
  
  if (isScheduled && scheduleTime && scheduleTime > now) {
    Logger.log(`Order ${orderId} is scheduled for ${scheduleTime}. Creating trigger.`);
    createScheduleTrigger(scheduleTime, data);
  } else {
    // Send Immediately
    
    generatePdf(orderId, data);

    try {
      const settings = getTelegramSettings(team);
      if (!settings.token || !settings.groupID) {
        Logger.log(`Skipping Telegram for team ${team}: Token or GroupID not found in Settings sheet.`);
      } else {
        const templates = getTelegramTemplates(team);
        const messageIds = sendTelegramMessage(settings, data, templates); 
        
        if (messageIds && messageIds.id1) {
          updateMessageIdInSheet(orderSheetName, orderId, messageIds);
          updateMessageIdInSheet(CONFIG.ALL_ORDERS_SHEET, orderId, messageIds);
        }

        // --- COD ALERT LOGIC (UPDATED) ---
        const paymentStatus = String(orderRequest.payment.status).trim();
        Logger.log(`[DEBUG COD] Checking Order ${orderId}. Payment: '${paymentStatus}'`);
        
        // Check allowed statuses for COD
        const allowedStatuses = ["Unpaid (COD)", "COD", "Unpaid"];
        
        // យើងប្រើ .some ដើម្បីផ្ទៀងផ្ទាត់ (Case-insensitive ផងដែរ)
        if (allowedStatuses.some(s => s.toLowerCase() === paymentStatus.toLowerCase())) {
            Logger.log(`[DEBUG COD] Payment matches COD criteria. Invoking sendCODAlert...`);
            sendCODAlert(data, team, settings);
        } else {
             Logger.log(`[DEBUG COD] Payment status '${paymentStatus}' does NOT match allowed COD statuses. Skipping Alert.`);
        }
      }
    } catch (e) {
      Logger.log(`Error during immediate Telegram process for ${orderId}: ${e.message}`);
    }
  }

  return orderId;
}

// --- NEW FUNCTION: Send COD Alert to Extra Group (DEBUGGED) ---
function sendCODAlert(orderData, team, settings) {
  try {
    if (!orderData || !orderData.originalRequest) {
      Logger.log("[DEBUG COD] Error: No orderData provided to sendCODAlert.");
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shippingSheet = ss.getSheetByName(CONFIG.SHIPPING_METHODS_SHEET);
    if (!shippingSheet) {
       Logger.log("[DEBUG COD] Error: ShippingMethods sheet not found.");
       return;
    }

    const dataRange = shippingSheet.getDataRange().getValues();
    const headers = dataRange.shift(); // Remove headers
    
    const methodCol = headers.indexOf("MethodName");
    const enableAlertCol = headers.indexOf("EnableCODAlert");
    const topicCol = headers.indexOf("AlertTopicID");
    
    if (methodCol === -1 || enableAlertCol === -1) {
       Logger.log("[DEBUG COD] Error: Missing 'MethodName' or 'EnableCODAlert' columns in ShippingMethods sheet.");
       return;
    }

    const currentMethod = orderData.originalRequest.shipping.method;
    Logger.log(`[DEBUG COD] Order Shipping Method: '${currentMethod}'`);

    let alertTopic = "";
    let shouldAlert = false;
    
    for (let row of dataRange) {
        const sheetMethod = row[methodCol];
        const isEnabled = row[enableAlertCol];
        
        if (String(sheetMethod).trim() === String(currentMethod).trim()) {
             if (isEnabled === true || String(isEnabled).toLowerCase() === 'true') {
                 shouldAlert = true;
                 alertTopic = (topicCol > -1) ? row[topicCol] : "";
                 Logger.log(`[DEBUG COD] ✅ Match Found! Method: ${sheetMethod}, Alert: ENABLED, Topic: ${alertTopic}`);
                 break;
             } else {
                 Logger.log(`[DEBUG COD] ⚠️ Match Found, but Alert is DISABLED in sheet.`);
             }
        }
    }
    
    if (!shouldAlert) {
        Logger.log(`[DEBUG COD] ❌ No matching enabled method found in ShippingMethods sheet.`);
        return;
    }
    
    // Check Settings
    if (!settings.codAlertGroupID) {
        Logger.log(`[DEBUG COD] ❌ Skipped: No 'CODAlertGroupID' found in Settings for Team ${team}`);
        return;
    }
    
    Logger.log(`[DEBUG COD] Attempting to send message to Group: ${settings.codAlertGroupID}`);

    // Create Message
    const text = `💰 *ទូទាត់ប្រាក់ (COD)*
🆔 Order: \`${orderData.orderId}\`
👤 អតិថិជន: ${orderData.originalRequest.customer.name}
💵 ចំនួនប្រាក់: *$${orderData.originalRequest.grandTotal.toFixed(2)}*
🚚 ដឹកជញ្ជូន: ${currentMethod}
    
👇 សូមចុចប៊ូតុងខាងក្រោមនៅពេលទទួលបានប្រាក់រួច`;

    const keyboard = {
      inline_keyboard: [
        [
          { 
            text: "✅ Paid (បានទទួលប្រាក់)", 
            callback_data: JSON.stringify({
              a: "pay_menu", 
              o: orderData.orderId, 
              t: team 
            })
          }
        ]
      ]
    };

    const payload = {
      chat_id: settings.codAlertGroupID,
      text: text,
      parse_mode: "Markdown",
      reply_markup: keyboard
    };
    
    if (alertTopic && String(alertTopic).trim() !== "") {
        payload.message_thread_id = alertTopic;
    }

    const url = `https://api.telegram.org/bot${settings.token}/sendMessage`;
    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
        Logger.log(`[DEBUG COD] ✅ COD Alert sent successfully!`);
    } else {
        Logger.log(`[DEBUG COD] ❌ Telegram API Error: ${result.description}`);
    }

  } catch (e) {
    Logger.log(`[DEBUG COD] Exception Error: ${e.message}`);
  }
}

// --- Handle Telegram Callback (Button Click) ---
// Function នេះលែងប្រើហើយព្រោះ Go Handle វិញ ប៉ុន្តែទុកក៏មិនអីដែរ
function handleTelegramCallback(callback) {
  try {
    const data = JSON.parse(callback.data);
    const user = callback.from; 
    const settings = getTelegramSettings(data.t); 
    
    if (!verifyTelegramUser(user.username)) {
       answerCallbackQuery(settings.token, callback.id, "⛔ អ្នកមិនមានសិទ្ធិប្រើប្រាស់ប៊ូតុងនេះទេ។", true);
       return createJsonResponse({status: 'ok'});
    }

    if (data.a === "pay_menu") {
       showBankMenu(settings.token, callback.message.chat.id, callback.message.message_id, data.o, data.t);
       answerCallbackQuery(settings.token, callback.id, "សូមជ្រើសរើសធនាគារ...");
    } else if (data.a === "confirm_pay") {
       const bankName = data.b;
       const orderId = data.o;
       const team = data.t;
       
       updatePaymentStatusInSheet(orderId, team, "Paid", bankName);
       
       const confirmText = `${callback.message.text}\n\n✅ *Paid by:* @${user.username || "User"}\n🏦 *Via:* ${bankName}\n🕒 ${new Date().toLocaleString()}`;
       editMessageText(settings.token, callback.message.chat.id, callback.message.message_id, confirmText);
       
       answerCallbackQuery(settings.token, callback.id, "បាន Update ជោគជ័យ!");
    }

    return createJsonResponse({status: 'ok'});

  } catch (e) {
    Logger.log("Error in handleTelegramCallback: " + e.message);
    return createJsonResponse({status: 'error'});
  }
}

function verifyTelegramUser(username) {
  if (!username) return false;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const userSheet = ss.getSheetByName(CONFIG.USERS_SHEET);
  const data = userSheet.getDataRange().getValues();
  const telegramUserCol = 7; 
  
  const apiUsername = username.toLowerCase();

  for (let i = 1; i < data.length; i++) {
     let sheetUsername = String(data[i][telegramUserCol]).trim().toLowerCase();
     if (sheetUsername.startsWith("@")) {
       sheetUsername = sheetUsername.substring(1);
     }
     if (sheetUsername === apiUsername) {
         return true;
     }
  }
  return false;
}

function showBankMenu(token, chatId, messageId, orderId, team) {
   const ss = SpreadsheetApp.getActiveSpreadsheet();
   const bankSheet = ss.getSheetByName(CONFIG.BANK_ACCOUNTS_SHEET);
   const banks = bankSheet.getRange(2, 1, bankSheet.getLastRow() - 1, 1).getValues();
   
   let buttons = [];
   banks.forEach(row => {
      if (row[0]) {
         buttons.push([{
            text: row[0],
            callback_data: JSON.stringify({
               a: "confirm_pay",
               o: orderId,
               t: team,
               b: row[0] 
            })
         }]);
      }
   });
   
   buttons.push([{text: "❌ Cancel", callback_data: JSON.stringify({a: "cancel"})}]); 

   const payload = {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: buttons }
   };
   
   const url = `https://api.telegram.org/bot${token}/editMessageReplyMarkup`;
    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload)
    };
   UrlFetchApp.fetch(url, options);
}

function answerCallbackQuery(token, callbackId, text, showAlert = false) {
    const url = `https://api.telegram.org/bot${token}/answerCallbackQuery`;
    UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
            callback_query_id: callbackId,
            text: text,
            show_alert: showAlert
        })
    });
}

function editMessageText(token, chatId, messageId, text) {
    const url = `https://api.telegram.org/bot${token}/editMessageText`;
    UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [] } 
        })
    });
}

function updatePaymentStatusInSheet(orderId, team, status, info) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetsToUpdate = [
        ss.getSheetByName(`${CONFIG.ORDER_SHEET_PREFIX}${team}`),
        ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET)
    ];
    
    sheetsToUpdate.forEach(sheet => {
        if (!sheet) return;
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const idCol = headers.indexOf("Order ID");
        const statusCol = headers.indexOf("Payment Status");
        const infoCol = headers.indexOf("Payment Info");
        
        if (idCol > -1 && statusCol > -1 && infoCol > -1) {
            for (let i = data.length - 1; i >= 1; i--) {
                if (String(data[i][idCol]) === String(orderId)) {
                    sheet.getRange(i + 1, statusCol + 1).setValue(status);
                    sheet.getRange(i + 1, infoCol + 1).setValue(info);
                    break; 
                }
            }
        }
    });
}


// --- Order Update Logic for Telegram (Existing Functions) ---

function mapOrderRowToDataObject(headers, row, team) {
  const map = {};
  headers.forEach((header, index) => {
    map[header] = row[index];
  });
  
  let productsArray = [];
  try {
    productsArray = JSON.parse(map["Products (JSON)"] || "[]");
  } catch(e) {
     Logger.log(`Failed to parse Products (JSON) for order ${map["Order ID"]}: ${e.message}`);
  }
  
  return {
      orderId: map["Order ID"],
      fullLocation: map["Location"], 
      originalRequest: {
          selectedTeam: team,
          page: String(map["Page"] || ""),
          telegramValue: String(map["TelegramValue"] || ""),
          customer: {
              name: String(map["Customer Name"] || ""),
              phone: String(map["Customer Phone"] || ""),
              additionalLocation: String(map["Address Details"] || ""), 
              shippingFee: parseFloat(map["Shipping Fee (Customer)"] || 0) 
          },
          shipping: {
              method: String(map["Internal Shipping Method"] || ""),
              details: String(map["Internal Shipping Details"] || "")
          },
          payment: {
              status: String(map["Payment Status"] || ""),
              info: String(map["Payment Info"] || "")
          },
          products: productsArray, 
          subtotal: parseFloat(map["Subtotal"] || 0),
          grandTotal: parseFloat(map["Grand Total"] || 0),
          note: String(map["Note"] || ""),
          currentUser: {
             UserName: String(map["User"] || "")
          }
      }
  };
}

function updateOrderTelegram(orderId, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allOrdersSheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);

  if (!allOrdersSheet) return {id1: null, id2: null};

  const dataRange = allOrdersSheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  const orderIdCol = headers.indexOf("Order ID");
  const msgId1Col = headers.indexOf("Telegram Message ID 1"); 
  const msgId2Col = headers.indexOf("Telegram Message ID 2"); 
  
  if (orderIdCol === -1 || msgId1Col === -1 || msgId2Col === -1) return {id1: null, id2: null};

  let orderRow = null;
  
  for (let i = values.length - 1; i >= 1; i--) { 
    if (values[i][orderIdCol] == orderId) {
      orderRow = values[i];
      break;
    }
  }

  if (!orderRow) return {id1: null, id2: null};
  
  const messageId1 = orderRow[msgId1Col];
  const messageId2 = orderRow[msgId2Col];
  
  const orderDataMap = mapOrderRowToDataObject(headers, orderRow, team); 
  const settings = getTelegramSettings(team);
  const templates = getTelegramTemplates(team);
  
  const updatedIds = {id1: null, id2: null};

  const part1Template = templates.get(1);
  if (messageId1 && String(messageId1).trim() !== "" && part1Template) {
    const part1Text = generateTelegramTextPart(orderDataMap, part1Template, 1);
    updatedIds.id1 = editTelegramMessage(settings, messageId1, part1Text, orderDataMap, 1);
  }

  const part2Template = templates.get(2);
  if (messageId2 && String(messageId2).trim() !== "" && part2Template) {
    const part2Text = generateTelegramTextPart(orderDataMap, part2Template, 2);
    updatedIds.id2 = editTelegramMessage(settings, messageId2, part2Text, orderDataMap, 2); 
  }

  return updatedIds;
}

function deleteOrderTelegramMessages(orderId, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allOrdersSheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);

  if (!allOrdersSheet) return;

  const dataRange = allOrdersSheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  const orderIdCol = headers.indexOf("Order ID");
  const msgId1Col = headers.indexOf("Telegram Message ID 1");
  const msgId2Col = headers.indexOf("Telegram Message ID 2");
  
  if (orderIdCol === -1 || msgId1Col === -1 || msgId2Col === -1) return;

  let messageId1 = null;
  let messageId2 = null;

  for (let i = values.length - 1; i >= 1; i--) { 
    if (values[i][orderIdCol] == orderId) {
      messageId1 = values[i][msgId1Col];
      messageId2 = values[i][msgId2Col];
      break;
    }
  }
  
  const settings = getTelegramSettings(team);
  const telegramDeleteUrl = `https://api.telegram.org/bot${settings.token}/deleteMessage`;

  const deleteMessage = (messageId, part) => {
    if (!messageId || String(messageId).trim() === "") return;
    
    const payload = {
      chat_id: settings.groupID,
      message_id: messageId,
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    };
    
    try {
      UrlFetchApp.fetch(telegramDeleteUrl, options);
    } catch (e) {
      Logger.log(`UrlFetchApp error during Telegram deletion: ${e.message}`);
    }
  };

  deleteMessage(messageId1, 1);
  deleteMessage(messageId2, 2);
}

function editTelegramMessage(settings, messageId, newText, orderData, partNumber) {
  let replyMarkup = null;
  if (partNumber === 2) { 
    replyMarkup = createLabelButton(settings, orderData); 
  }

  const payload = {
    chat_id: settings.groupID,
    message_id: messageId,
    text: newText,
    parse_mode: "Markdown",
    disable_web_page_preview: true
  };

  if (settings.topicID) {
    payload.message_thread_id = settings.topicID;
  }
  
  if (replyMarkup) {
    payload.reply_markup = replyMarkup; 
  }

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };
  
  const url = `https://api.telegram.org/bot${settings.token}/editMessageText`;

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    if (result.ok) {
      return messageId;
    }
  } catch (e) {
    Logger.log(`UrlFetchApp error for Telegram edit: ${e.message}`);
  }
  return null;
}

// --- Scheduling Functions ---

function createScheduleTrigger(time, data) {
  try {
    const trigger = ScriptApp.newTrigger('executeScheduledSend')
      .timeBased()
      .at(time)
      .create();
    
    const triggerId = trigger.getUniqueId();
    PropertiesService.getScriptProperties().setProperty(triggerId, JSON.stringify(data));
  } catch (e) {
    Logger.log(`Failed to create trigger: ${e.message}`);
  }
}

function executeScheduledSend(event) {
  const triggerId = event.triggerUid;
  
  const properties = PropertiesService.getScriptProperties();
  const dataString = properties.getProperty(triggerId);
  
  if (!dataString) {
    deleteTrigger(triggerId);
    return;
  }
  
  const data = JSON.parse(dataString);
  const orderId = data.orderId;
  const team = data.originalRequest.selectedTeam;
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;
  
  try {
    generatePdf(orderId, data);
    const settings = getTelegramSettings(team);
    
    if (settings.token && settings.groupID) {
      const templates = getTelegramTemplates(team);
      const messageIds = sendTelegramMessage(settings, data, templates);
      
      if (messageIds && messageIds.id1) {
        updateMessageIdInSheet(orderSheetName, orderId, messageIds);
        updateMessageIdInSheet(CONFIG.ALL_ORDERS_SHEET, orderId, messageIds);
      }
      
      // COD Logic for Scheduled (UPDATED)
      const paymentStatus = String(data.originalRequest.payment.status).trim();
      const allowedStatuses = ["Unpaid (COD)", "COD", "Unpaid"];
        
      if (allowedStatuses.some(s => s.toLowerCase() === paymentStatus.toLowerCase())) {
            sendCODAlert(data, team, settings);
      }
    }
  } catch (e) {
    Logger.log(`Error during scheduled send: ${e.message}`);
  } finally {
    deleteTrigger(triggerId);
  }
}

function deleteTrigger(triggerId) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(trigger);
        break;
      }
    }
    PropertiesService.getScriptProperties().deleteProperty(triggerId);
  } catch (e) {
    Logger.log(`Error deleting trigger: ${e.message}`);
  }
}

// --- Helper Functions (Settings, Templates, etc) ---

function generatePdf(orderId, orderData) {
  // Placeholder
}

function getTelegramSettings(teamName) {
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!settingsSheet) return {};

  const data = settingsSheet.getDataRange().getValues();
  const headers = data.shift(); 

  const teamCol = headers.indexOf("Team");
  const tokenCol = headers.indexOf("TelegramBotToken");
  const groupCol = headers.indexOf("TelegramGroupID");
  const topicCol = headers.indexOf("TelegramTopicID");
  const labelCol = headers.indexOf("LabelPrinterURL"); 
  const codAlertGroupCol = headers.indexOf("CODAlertGroupID"); 

  if (teamCol === -1 || tokenCol === -1 || groupCol === -1) {
    return {};
  }

  for (const row of data) {
    if (row[teamCol] == teamName) {
      return {
        token: row[tokenCol],
        groupID: row[groupCol],
        topicID: (topicCol > -1) ? row[topicCol] : null,
        labelPrinterURL: (labelCol > -1) ? row[labelCol] : null,
        codAlertGroupID: (codAlertGroupCol > -1) ? row[codAlertGroupCol] : null 
      };
    }
  }
  return {};
}

function getTelegramTemplates(teamName) {
  const templateSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.TELEGRAM_TEMPLATES_SHEET);
  const templates = new Map();
  if (!templateSheet) return templates;

  const data = templateSheet.getDataRange().getValues();
  const headers = data.shift();
  const teamCol = headers.indexOf("Team");
  const partCol = headers.indexOf("Part");
  const templateCol = headers.indexOf("Template");

  if (teamCol === -1 || partCol === -1 || templateCol === -1) return templates;

  data.forEach(row => {
    if (row[teamCol] == teamName) {
      templates.set(parseInt(row[partCol]), row[templateCol]);
    }
  });

  return templates;
}

function createLabelButton(settings, data) {
  if (!settings.labelPrinterURL) return null;

  const orderRequest = data.originalRequest;
  const orderId = data.orderId;
  const enc = (str) => encodeURIComponent(str || "");

  try {
    const params = [
      `id=${enc(orderId)}`,
      `page=${enc(orderRequest.page)}`,
      `user=${enc(orderRequest.currentUser.UserName)}`,
      `name=${enc(orderRequest.customer.name)}`,
      `phone=${enc(orderRequest.customer.phone)}`,
      `location=${enc(data.fullLocation)}`,
      `address=${enc(orderRequest.customer.additionalLocation)}`,
      `payment=${enc(orderRequest.payment.status)}`,
      `total=${enc(orderRequest.grandTotal.toFixed(2))}`,
      `shipping=${enc(orderRequest.shipping.method)}`
    ];
    
    const fullUrl = `${settings.labelPrinterURL}?${params.join('&')}`;

    return {
      "inline_keyboard": [
        [
          { "text": "📦 ព្រីន Label (78x50mm)", "url": fullUrl }
        ]
      ]
    };
  } catch (e) {
    return null;
  }
}

function generateTelegramTextPart(data, template, partNumber) {
  const orderRequest = data.originalRequest;

  const customerName = orderRequest.customer.name || "";
  const customerPhone = orderRequest.customer.phone || ""; 
  const location = data.fullLocation || "";
  const addressDetails = orderRequest.customer.additionalLocation || "(មិនបានបញ្ជាក់)";
  const subtotal = orderRequest.subtotal;
  const shippingFee = orderRequest.customer.shippingFee;
  const grandTotal = orderRequest.grandTotal;
  const paymentStatus = orderRequest.payment.status;
  const paymentInfo = orderRequest.payment.info;
  
  let paymentStatusStr = "🟥 COD (Unpaid)";
  if (paymentStatus === "Paid") {
    paymentStatusStr = `✅ Paid (${paymentInfo})`;
  }
  
  const shippingMethod = orderRequest.shipping.method || "";
  const shippingDetails = orderRequest.shipping.details || "";
  let shippingDetailsStr = (shippingDetails && shippingDetails !== shippingMethod) ? ` (${shippingDetails})` : "";
  
  let noteStr = "";
  if (orderRequest.note) {
    noteStr = `\n\n📝 *ចំណាំបន្ថែម:*\n*${orderRequest.note}*`;
  }

  const user = orderRequest.currentUser.UserName;
  const page = orderRequest.page;
  const telegramValue = orderRequest.telegramValue;
  let sourceInfo = `*Page:* ${telegramValue}`;
  if (String(page).toLowerCase() === "telegram") {
    sourceInfo = `*Telegram:* ${telegramValue}`;
  }
  
  // --- កែប្រែត្រង់ចំណុចនេះ (Product List Logic) ---
  let productsList = "";
  orderRequest.products.forEach(p => {
    let name = p.name || "N/A";
    let quantity = p.quantity || 1;
    
    // តម្លៃដើមក្នុងមួយឯកតា (Unit Price)
    let originalPrice = p.price || 0;
    
    // តម្លៃលក់ចុងក្រោយក្នុងមួយឯកតា (Unit Final Price)
    let finalPrice = p.finalPrice || originalPrice; 
    let hasDiscount = originalPrice > finalPrice;

    // បន្ទាត់ទី ១: *Product Name* - x*QTY*
    productsList += `🛍️ *${name}* - x*${quantity}*\n`;
    
    // បន្ទាត់ទី ២: បង្ហាញតម្លៃ
    if (hasDiscount) {
        // ករណីមានបញ្ចុះតម្លៃ: បញ្ចុះតម្លៃនៅសល់ $...
        productsList += `🏷️ បញ្ចុះតម្លៃនៅសល់ $${finalPrice.toFixed(2)}\n`; 
    } else {
        // ករណីតម្លៃធម្មតា
        productsList += `💵 តម្លៃ $${finalPrice.toFixed(2)}\n`;
    }
    
    // បន្ទាត់ទី ៣: បង្ហាញពណ៌ (ប្រសិនបើមាន)
    if (p.colorInfo) {
        productsList += `🎨 (${p.colorInfo})\n`;
    }

    // បន្ទាត់ទី ៤: Separator
    productsList += `--------------------------------------\n`;
  });
  // ------------------------------------------------

  const replacer = (text) => {
    return text
      .replace(/{{orderId}}/g, data.orderId)
      .replace(/{{customerName}}/g, customerName)
      .replace(/{{customerPhone}}/g, customerPhone)
      .replace(/{{location}}/g, location)
      .replace(/{{addressDetails}}/g, addressDetails)
      .replace(/{{productsList}}/g, productsList.trim())
      .replace(/{{subtotal}}/g, subtotal.toFixed(2))
      .replace(/{{shippingFee}}/g, shippingFee.toFixed(2))
      .replace(/{{grandTotal}}/g, grandTotal.toFixed(2))
      .replace(/{{paymentStatus}}/g, paymentStatusStr)
      .replace(/{{shippingMethod}}/g, shippingMethod)
      .replace(/{{shippingDetails}}/g, shippingDetailsStr)
      .replace(/{{note}}/g, noteStr)
      .replace(/{{user}}/g, user)
      .replace(/{{sourceInfo}}/g, sourceInfo);
  };
    
  return replacer(template).trim();
}

function sendTelegramMessage(settings, data, templates) {
  const orderId = data.orderId;
  const sortedParts = Array.from(templates.keys()).sort((a, b) => a - b);
  const messageIds = {id1: null, id2: null};
  let replyToMessageId = null;

  for (const part of sortedParts) {
    const template = templates.get(part);
    if (!template) continue;
      
    const text = generateTelegramTextPart(data, template, part);

    const payload = {
      chat_id: settings.groupID,
      text: text,
      parse_mode: "Markdown",
      disable_web_page_preview: true
    };
      
    if (part === 2) { 
        const replyMarkup = createLabelButton(settings, data);
        if (replyMarkup) { payload.reply_markup = replyMarkup; }
    }

    if (settings.topicID) {
      payload.message_thread_id = settings.topicID;
    }
    
    if (part > 1 && replyToMessageId) {
       payload.reply_to_message_id = replyToMessageId;
    }

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload)
    };
      
    const url = `https://api.telegram.org/bot${settings.token}/sendMessage`;

    try {
      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());
      
      if (result.ok) {
        const newId = result.result.message_id;
        messageIds[`id${part}`] = String(newId);
        
        if (part === 1) {
            replyToMessageId = newId; 
        }
      }
    } catch (e) {
      Logger.log(`UrlFetchApp error for Telegram send: ${e.message}`);
    }
    
    Utilities.sleep(300); 
  }
  
  return messageIds; 
}

function updateMessageIdInSheet(sheetName, orderId, messageIds) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0]; 
    
    const orderIdCol = headers.indexOf("Order ID");
    const msgId1Col = headers.indexOf("Telegram Message ID 1"); 
    const msgId2Col = headers.indexOf("Telegram Message ID 2"); 

    if (orderIdCol === -1 || msgId1Col === -1 || msgId2Col === -1) return;

    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][orderIdCol] == orderId) {
        const rowToUpdate = i + 1; 
        
        if (messageIds.id1) {
           sheet.getRange(rowToUpdate, msgId1Col + 1).setValue(messageIds.id1);
        }
        if (messageIds.id2) {
           sheet.getRange(rowToUpdate, msgId2Col + 1).setValue(messageIds.id2);
        }
        return; 
      }
    }
  } catch (e) {
    Logger.log(`Error in updateMessageIdInSheet: ${e.message}`);
  }
}
