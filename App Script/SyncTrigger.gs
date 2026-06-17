/**
 * មុខងារសម្រាប់ផ្ញើទិន្នន័យដែលបានកែប្រែក្នុង Sheets ទៅកាន់ Backend
 * ត្រូវប្រើជាមួយ Installable Trigger (Edit)
 */
function handleInstallableEdit(e) {
  if (!e) return;
  
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  
  // បញ្ជី Sheet ដែលមិនចាំបាច់ Sync
  const ignoreSheets = ['EditLogs', 'UserActivityLogs', 'ChatMessages'];
  if (ignoreSheets.includes(sheetName)) return;

  const row = range.getRow();
  if (row <= 1) return; // មិន Sync បើកែប្រែក្បាលតារាង (Header)

  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

  const rowData = {};
  headers.forEach((header, index) => {
    if (header) {
      rowData[header] = rowValues[index];
    }
  });

  // រៀបចំទិន្នន័យផ្ញើទៅ Backend
  // RENDER_BASE_URL និង SCRIPT_SECRET_KEY ត្រូវបានយកចេញពី File ផ្សេងទៀតក្នុង Project
  const payload = {
    secret: SCRIPT_SECRET_KEY,
    sheetName: sheetName,
    rowData: rowData,
    action: "update"
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(RENDER_BASE_URL + "/api/webhook/sheets-sync", options);
    console.log(`📤 Sync [${sheetName}] Row ${row}: ${response.getContentText()}`);
  } catch (err) {
    console.error("❌ Sync failed: " + err.message);
  }
}
