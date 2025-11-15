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
        // processOrder ឥឡូវនឹងចាត់ចែងការកំណត់เวลา (scheduling)
        const orderId = processOrder(contents.orderData);
        return createJsonResponse({ status: 'success', orderId: orderId });
      
      case 'deleteFile':
         if (!contents.fileID) {
           throw new Error("Missing fileID for deleteFile.");
         }
         deleteFileFromDrive(contents.fileID);
         return createJsonResponse({ status: 'success', message: 'File deleted' });
         
      // --- NEW ACTION: Update Telegram message after sheet update ---
      case 'updateOrderTelegram':
        if (!contents.orderData || !contents.orderData.orderId || !contents.orderData.team) {
          throw new Error("Missing orderData (orderId or team) for updateOrderTelegram.");
        }
        const messageId = updateOrderTelegram(contents.orderData.orderId, contents.orderData.team);
        return createJsonResponse({ status: 'success', message: 'Telegram message update initiated', messageId: messageId });
        
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
    
    Logger.log(`File uploaded via Apps Script: ${fileName}, URL: ${fileUrl}, FileID: ${fileId}`);
    return { url: fileUrl, fileID: fileId };

  } catch (e) {
    Logger.log(`Apps Script Upload Error: ${e.toString()}`);
    if (e.message.includes("File not found") && folderId.length > 15) {
       throw new Error(`Upload Failed. Please ensure the user '${Session.getEffectiveUser().getEmail()}' is added as a 'Content Manager' to the Shared Drive (ID: ${folderId}).`);
    }
    throw new Error(`Apps Script file upload failed. ${e.message}`);
  }
}

function deleteFileFromDrive(fileID) {
  try {
    const file = DriveApp.getFileById(fileID);
    file.setTrashed(true);
    Logger.log(`File ${fileID} moved to trash.`);
  } catch (e) {
    Logger.log(`Failed to delete file ${fileID}: ${e.message}`);
  }
}


// --- Order Processing Logic ---

/**
 * Main function to process the order submitted from main.go
 */
function processOrder(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const orderRequest = data.originalRequest;
  const team = orderRequest.selectedTeam;
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;
  const timestamp = data.timestamp;
  const orderId = data.orderId;
  const totalDiscount = data.totalDiscount;
  const totalProductCost = data.totalProductCost;
  const fullLocation = data.fullLocation;
  const productsJSON = data.productsJSON;
  const shippingCost = data.shippingCost;

  // --- 1. Save to Sheets (ជំហាននេះត្រូវតែកើតឡើងភ្លាមៗ) ---
  try {
    const teamSheet = ss.getSheetByName(orderSheetName);
    if (!teamSheet) throw new Error(`Sheet ${orderSheetName} not found.`);
    
    const rowData = [
      timestamp, orderId, orderRequest.currentUser.UserName, orderRequest.page, orderRequest.telegramValue,
      orderRequest.customer.name, orderRequest.customer.phone, fullLocation,
      orderRequest.customer.additionalLocation, orderRequest.note, orderRequest.customer.shippingFee,
      orderRequest.subtotal, orderRequest.grandTotal, productsJSON,
      orderRequest.shipping.method, orderRequest.shipping.details, shippingCost,
      orderRequest.payment.status, orderRequest.payment.info,
      totalDiscount, shippingCost, 0, totalProductCost, "" 
    ];
    teamSheet.appendRow(rowData);
    
    const allOrdersSheet = ss.getSheetByName(CONFIG.ALL_ORDERS_SHEET);
    allOrdersSheet.appendRow(rowData.concat([team]));

    const revenueSheet = ss.getSheetByName(CONFIG.REVENUE_SHEET);
    revenueSheet.appendRow([timestamp, team, orderRequest.page, orderRequest.grandTotal]);

    const activitySheet = ss.getSheetByName(CONFIG.USER_ACTIVITY_LOGS_SHEET);
    const activityDetails = JSON.stringify({ orderId: orderId, team: team, grandTotal: orderRequest.grandTotal });
    activitySheet.appendRow([timestamp, orderRequest.currentUser.UserName, "SUBMIT_ORDER_GAS", activityDetails]);

  } catch (e) {
    Logger.log(`Error saving order ${orderId} to sheets: ${e.message}`);
    // បើ Save មិនបាន មិនបាច់បន្តទៅផ្ញើ Telegram ទេ
    throw new Error(`Failed to save order to sheet: ${e.message}`);
  }

  // --- 2. Check for Scheduling (ពិនិត្យមើលការកំណត់ពេលវេលា) ---
  const scheduleInfo = orderRequest.telegram;
  const isScheduled = scheduleInfo && scheduleInfo.schedule;
  let scheduleTime = null;

  if (isScheduled && scheduleInfo.time) {
    try {
      scheduleTime = new Date(scheduleInfo.time);
    } catch (e) {
      Logger.log(`Invalid schedule time format for ${orderId}: ${scheduleInfo.time}. Sending now.`);
      scheduleTime = null;
    }
  }

  const now = new Date();
  
  // បើ isScheduled ជា true ហើយ ពេលវេលាកំណត់ គឺនៅពេលអនាគត
  if (isScheduled && scheduleTime && scheduleTime > now) {
    
    Logger.log(`Order ${orderId} is scheduled for ${scheduleTime}. Creating trigger.`);
    // ហៅ Function បង្កើត Trigger
    createScheduleTrigger(scheduleTime, data);

  } else {
    // បើ Send ភ្លាមៗ (isScheduled=false ឬ ពេលវេលាកន្លងផុតទៅហើយ)
    Logger.log(`Order ${orderId} is sending immediately.`);
    
    // 5. Generate PDF (Placeholder)
    generatePdf(orderId, data);

    // 6. Send Telegram Notification
    try {
      const settings = getTelegramSettings(team);
      if (!settings.token || !settings.groupID) {
        Logger.log(`Skipping Telegram for team ${team}: Token or GroupID not found in Settings sheet.`);
      } else {
        const templates = getTelegramTemplates(team);
        const messageId = sendTelegramMessage(settings, data, templates);
        
        if (messageId) {
          // 7. Update Message ID back to sheet
          updateMessageIdInSheet(orderSheetName, orderId, messageId);
        }
      }
    } catch (e) {
      Logger.log(`Error during immediate Telegram process for ${orderId}: ${e.message}`);
    }
  }

  return orderId;
}

// --- *** NEW: Order Update Logic for Telegram *** ---

/**
 * @typedef {object} OrderData
 * @property {string} orderId
 * @property {string} fullLocation
 * @property {object} originalRequest
 * @property {string} originalRequest.selectedTeam
 * @property {string} originalRequest.page
 * @property {string} originalRequest.telegramValue
 * @property {object} originalRequest.customer
 * @property {string} originalRequest.customer.name
 * @property {string} originalRequest.customer.phone
 * @property {string} originalRequest.customer.additionalLocation
 * @property {number} originalRequest.customer.shippingFee
 * @property {object} originalRequest.shipping
 * @property {string} originalRequest.shipping.method
 * @property {string} originalRequest.shipping.details
 * @property {object} originalRequest.payment
 * @property {string} originalRequest.payment.status
 * @property {string} originalRequest.payment.info
 * @property {Array<object>} originalRequest.products
 * @property {number} originalRequest.subtotal
 * @property {number} originalRequest.grandTotal
 * @property {string} originalRequest.note
 * @property {object} originalRequest.currentUser
 * @property {string} originalRequest.currentUser.UserName
 */

/**
 * បម្លែងទិន្នន័យជួរដេកពី Sheet ទៅជា OrderData Object ដែលត្រូវការដោយ Template.
 * @param {Array<string>} headers Headers របស់ Sheet.
 * @param {Array<any>} row ទិន្នន័យជួរដេក.
 * @param {string} team ឈ្មោះក្រុម.
 * @returns {OrderData}
 */
function mapOrderRowToDataObject(headers, row, team) {
  const map = {};
  headers.forEach((header, index) => {
    map[header] = row[index];
  });
  
  let productsArray = [];
  try {
    // Products (JSON) ត្រូវបានរក្សាទុកជា String ត្រូវ Parse មកវិញ
    productsArray = JSON.parse(map["Products (JSON)"] || "[]");
  } catch(e) {
     Logger.log(`Failed to parse Products (JSON) for order ${map["Order ID"]}: ${e.message}`);
  }
  
  // ត្រូវ Mock នូវ originalRequest ឡើងវិញដើម្បីឱ្យ function generateTelegramText អាចប្រើបាន
  return {
      orderId: map["Order ID"],
      fullLocation: map["Location"], // យក Location ទាំងមូលពី Sheet
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

/**
 * មុខងារសំខាន់ដើម្បី Update សារ Telegram
 * @param {string} orderId 
 * @param {string} team 
 * @returns {string | null} messageId បើជោគជ័យ
 */
function updateOrderTelegram(orderId, team) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;
  const sheet = ss.getSheetByName(orderSheetName);

  if (!sheet) {
    Logger.log(`Sheet ${orderSheetName} not found for Telegram update.`);
    return null;
  }

  // 1. រក Message ID
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  const orderIdCol = headers.indexOf("Order ID");
  const msgIdCol = headers.indexOf("Telegram Message ID");
  
  if (orderIdCol === -1 || msgIdCol === -1) {
    Logger.log(`Missing required columns in ${orderSheetName} for Telegram update.`);
    return null;
  }

  let orderRow = null;
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][orderIdCol] == orderId) {
      orderRow = values[i];
      break;
    }
  }

  if (!orderRow) {
    Logger.log(`Order ${orderId} not found in ${orderSheetName}. Cannot update Telegram.`);
    return null;
  }
  
  const messageId = orderRow[msgIdCol];
  if (!messageId || String(messageId).trim() === "") {
    Logger.log(`No Telegram Message ID found for Order ${orderId}. Cannot edit.`);
    return null;
  }
  
  // 2. បម្លែងទិន្នន័យជួរដេកទៅជា Object សម្រាប់ Template
  const orderDataMap = mapOrderRowToDataObject(headers, orderRow, team); 

  // 3. យក Settings និង Templates
  const settings = getTelegramSettings(team);
  if (!settings.token || !settings.groupID) {
    Logger.log(`Skipping Telegram update for team ${team}: Token or GroupID not found.`);
    return null;
  }
  const templates = getTelegramTemplates(team);

  // 4. បង្កើតអត្ថបទសារថ្មី
  const newText = generateTelegramText(orderDataMap, templates);

  // 5. កែសម្រួលសារ Telegram
  return editTelegramMessage(settings, messageId, newText, orderDataMap);
}

/**
 * ហៅទៅកាន់ Telegram API ដើម្បីកែសម្រួលសារ
 * @param {object} settings Telegram settings.
 * @param {string} messageId Message ID របស់សារដែលត្រូវកែ.
 * @param {string} newText អត្ថបទសារថ្មី.
 * @param {OrderData} orderData ទិន្នន័យ Order.
 * @returns {string | null} messageId បើជោគជ័យ
 */
function editTelegramMessage(settings, messageId, newText, orderData) {
  const replyMarkup = createLabelButton(settings, orderData); // បង្កើតប៊ូតុងឡើងវិញ

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
    // ត្រូវតែផ្ញើ reply_markup ទាំងមូលទៅ editMessageText
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
      Logger.log(`Telegram message ${messageId} edited successfully for ${orderData.orderId}.`);
      return messageId;
    } else {
      // ជៀសវាង Error បើគ្មានអ្វីកែប្រែ
      if (result.description.includes("message is not modified")) {
          Logger.log(`Telegram message ${messageId} edit skipped: No modification needed.`);
          return messageId;
      }
      Logger.log(`Error editing Telegram message ${messageId} for ${orderData.orderId}: ${result.description}`);
    }
  } catch (e) {
    Logger.log(`UrlFetchApp error for Telegram edit (${orderData.orderId}): ${e.message}`);
  }
  
  return null;
}


// --- Scheduling Functions (មុខងារកំណត់ពេលថ្មី) ---

/**
 * បង្កើត Trigger ឲ្យដំណើរការនៅពេលកំណត់
 * @param {Date} time The time to execute.
 * @param {object} data The full order data object to save.
 */
function createScheduleTrigger(time, data) {
  try {
    const trigger = ScriptApp.newTrigger('executeScheduledSend')
      .timeBased()
      .at(time)
      .create();
    
    const triggerId = trigger.getUniqueId();
    // រក្សាទុកទិន្នន័យ Order ទាំងមូល ដែលភ្ជាប់ជាមួយ ID របស់ Trigger
    PropertiesService.getScriptProperties().setProperty(triggerId, JSON.stringify(data));
    
    Logger.log(`Trigger ${triggerId} created for Order ${data.orderId} at ${time}`);
  } catch (e) {
    Logger.log(`Failed to create trigger for Order ${data.orderId}: ${e.message}`);
  }
}

/**
 * មុខងារនេះនឹងត្រូវបានហៅដោយ Trigger នៅពេលដល់ម៉ោងកំណត់
 * @param {object} event The event object from the trigger.
 */
function executeScheduledSend(event) {
  const triggerId = event.triggerUid;
  Logger.log(`Executing scheduled job for trigger: ${triggerId}`);
  
  const properties = PropertiesService.getScriptProperties();
  const dataString = properties.getProperty(triggerId);
  
  if (!dataString) {
    Logger.log(`No data found for trigger ${triggerId}. Deleting trigger.`);
    deleteTrigger(triggerId); // លុប Trigger ចោល
    return;
  }
  
  const data = JSON.parse(dataString);
  const orderId = data.orderId;
  const team = data.originalRequest.selectedTeam;
  const orderSheetName = `${CONFIG.ORDER_SHEET_PREFIX}${team}`;
  
  try {
    Logger.log(`Processing scheduled Order ${orderId} for team ${team}`);

    // 1. Generate PDF (Placeholder)
    generatePdf(orderId, data);

    // 2. Send Telegram Notification
    const settings = getTelegramSettings(team);
    if (!settings.token || !settings.groupID) {
      Logger.log(`Skipping scheduled Telegram for ${orderId}: Token or GroupID not found.`);
    } else {
      const templates = getTelegramTemplates(team);
      const messageId = sendTelegramMessage(settings, data, templates);
      
      if (messageId) {
        // 3. Update Message ID back to sheet
        updateMessageIdInSheet(orderSheetName, orderId, messageId);
      }
    }
  } catch (e) {
    Logger.log(`Error during scheduled send for ${orderId}: ${e.message}`);
  } finally {
    // 4. Delete the trigger after execution
    deleteTrigger(triggerId);
  }
}

/**
 * លុប Trigger និង Property ដែលពាក់ព័ន្ធ
 * @param {string} triggerId The unique ID of the trigger to delete.
 */
function deleteTrigger(triggerId) {
  try {
    // Find and delete the trigger
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(trigger);
        Logger.log(`Deleted trigger: ${triggerId}`);
        break;
      }
    }
    // Delete the associated data
    PropertiesService.getScriptProperties().deleteProperty(triggerId);
    Logger.log(`Deleted properties for trigger: ${triggerId}`);
  } catch (e) {
    Logger.log(`Error deleting trigger ${triggerId}: ${e.message}`);
  }
}


// --- PDF and Telegram Functions ---

function generatePdf(orderId, orderData) {
  // TODO: Implement PDF generation logic here
  Logger.log(`Placeholder: Generating PDF for Order ${orderId}...`);
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

  if (teamCol === -1 || tokenCol === -1 || groupCol === -1) {
    Logger.log("Error: Missing required columns in Settings sheet (Team, TelegramBotToken, TelegramGroupID)");
    return {};
  }

  for (const row of data) {
    if (row[teamCol] == teamName) {
      return {
        token: row[tokenCol],
        groupID: row[groupCol],
        topicID: (topicCol > -1) ? row[topicCol] : null,
        labelPrinterURL: (labelCol > -1) ? row[labelCol] : null
      };
    }
  }
  
  Logger.log(`No settings found for team ${teamName}`);
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
  if (!settings.labelPrinterURL) {
    return null;
  }

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
    Logger.log(`Error creating label button for ${orderId}: ${e.message}`);
    return null;
  }
}

/**
 * បង្កើតអត្ថបទសារ Telegram ទាំងមូលដោយផ្អែកលើទិន្នន័យ Order
 * @param {OrderData} data ទិន្នន័យ Order.
 * @param {Map<number, string>} templates Templates.
 * @returns {string} អត្ថបទសារពេញលេញ
 */
function generateTelegramText(data, templates) {
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
  
  // Rebuild productsList correctly from the products array
  let productsList = "";
  orderRequest.products.forEach(p => {
    let name = p.name || "N/A";
    let quantity = p.quantity || 1;
    // Assume finalPrice or price is available. The updated logic should rely on values saved to sheet.
    let finalPrice = p.finalPrice || p.price || 0; 
    let total = finalPrice * quantity; // Calculate total for the line
    
    productsList += `  - ${name} (x${quantity})`;
    if (p.colorInfo) {
      productsList += ` [${p.colorInfo}]`;
    }
    productsList += ` = *$${total.toFixed(2)}*\n`; 
  });
  
  const replacer = (template) => {
    return template
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

  const sortedParts = Array.from(templates.keys()).sort((a, b) => a - b);
  let fullText = "";
    
  for (const part of sortedParts) {
    const template = templates.get(part);
    fullText += replacer(template);
  }
    
  return fullText.trim();
}

/**
 * មុខងារ sendTelegramMessage ត្រូវបានកែប្រែឱ្យប្រើ generateTelegramText
 */
function sendTelegramMessage(settings, data, templates) {
  const orderId = data.orderId;
  const fullText = generateTelegramText(data, templates);
  const replyMarkup = createLabelButton(settings, data);

  const payload = {
    chat_id: settings.groupID,
    text: fullText,
    parse_mode: "Markdown",
    disable_web_page_preview: true
  };

  if (settings.topicID) {
    payload.message_thread_id = settings.topicID;
  }

  if (replyMarkup) {
    // ត្រូវដាក់ reply_markup លើសារទី 1 តែម្តង
    payload.reply_markup = replyMarkup;
  }

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload)
  };
    
  const url = `https://api.telegram.org/bot${settings.token}/sendMessage`;
  let firstMessageId = null;

  try {
    // ផ្ញើសារតែមួយដង ដោយប្រើ fullText
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      Logger.log(`Telegram message sent for ${orderId}`);
      firstMessageId = result.result.message_id;
    } else {
      Logger.log(`Error sending Telegram for ${orderId}: ${result.description}`);
    }
  } catch (e) {
    Logger.log(`UrlFetchApp error for Telegram send (${orderId}): ${e.message}`);
  }
  
  return firstMessageId;
}

function updateMessageIdInSheet(sheetName, orderId, messageId) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    const orderIdCol = headers.indexOf("Order ID");
    const msgIdCol = headers.indexOf("Telegram Message ID");

    if (orderIdCol === -1 || msgIdCol === -1) {
      Logger.log(`Could not find 'Order ID' or 'Telegram Message ID' columns in ${sheetName}`);
      return;
    }

    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][orderIdCol] == orderId) {
        const rowToUpdate = i + 2; 
        sheet.getRange(rowToUpdate, msgIdCol + 1).setValue(messageId);
        Logger.log(`Updated MessageID for ${orderId} in ${sheetName} (Row ${rowToUpdate})`);
        return; 
      }
    }
    Logger.log(`Could not find row for Order ID ${orderId} to update MessageID.`);
  } catch (e) {
    Logger.log(`Error in updateMessageIdInSheet: ${e.message}`);
  }
}
