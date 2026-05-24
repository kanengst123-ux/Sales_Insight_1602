const SHEET_NAME = 'Invoice_Log';

// ── MAIN ENTRY POINTS ──

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Determine action based on payload
    if (data.action === 'addCustomer') {
      return handleAddCustomer(data);
    } else if (data.action === 'addProduct') {
      return handleAddProduct(data);
    } else if (data.action === 'updateGrades') {
      return handleCustomerGrades(data);
    } else if (data.meta && data.items) {
      return handleInvoiceSave(data);
    }
    
    throw new Error('Unknown action: ' + JSON.stringify(data));
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action ? e.parameter.action : 'logs';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === 'products') {
      const rawSheet = ss.getSheetByName('raw');
      if (!rawSheet) throw new Error('Sheet "raw" not found');
      // Values from Col C (Product Names)
      const data = rawSheet.getRange(2, 3, rawSheet.getLastRow() - 1, 1).getValues();
      return createJsonResponse({ success: true, products: data.flat().filter(String) });
    }

    const logSheet = ss.getSheetByName(SHEET_NAME);
    if (!logSheet) {
      return createJsonResponse({ success: true, logs: [] });
    }
    const logs = logSheet.getDataRange().getValues();
    return createJsonResponse({ success: true, logs: logs });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ── HANDLERS ──

function handleAddCustomer(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('customer_cat');
  if (!sheet) throw new Error('Sheet "customer_cat" not found');
  
  // Get row number directly from E1 cell
  const nextRow = parseInt(sheet.getRange("E1").getValue(), 10);
  if (isNaN(nextRow) || nextRow <= 0) {
    throw new Error('Cell E1 of "customer_cat" must contain a valid row number. Current value: ' + sheet.getRange("E1").getValue());
  }
  
  sheet.getRange(nextRow, 1).setValue(data.name); // Col A: Customer
  sheet.getRange(nextRow, 11).setValue(data.user); // Col K: User
  sheet.getRange(nextRow, 2).setValue('C'); // Col B: Default Grade C
  
  return createJsonResponse({ status: 'success', message: 'Customer added at row ' + nextRow });
}

function handleAddProduct(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('raw');
  if (!sheet) throw new Error('Sheet "raw" not found');
  
  // Get row number directly from AI1 cell
  const nextRow = parseInt(sheet.getRange("AI1").getValue(), 10);
  if (isNaN(nextRow) || nextRow <= 0) {
    throw new Error('Cell AI1 of "raw" must contain a valid row number. Current value: ' + sheet.getRange("AI1").getValue());
  }
  
  sheet.getRange(nextRow, 3).setValue(data.name); // Col C: Product
  
  return createJsonResponse({ status: 'success', message: 'Product added at row ' + nextRow });
}

function handleCustomerGrades(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('customer_cat');
  const values = sheet.getDataRange().getValues();
  
  const updates = data.updates; // Expecting { "CustomerName": "NewGrade" }
  let count = 0;
  
  for (let i = 1; i < values.length; i++) {
    const custName = values[i][0];
    if (updates[custName]) {
      sheet.getRange(i + 1, 2).setValue(updates[custName]); // Update Col B
      count++;
    }
  }
  return createJsonResponse({ status: 'success', updated: count });
}

function handleInvoiceSave(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Date', 'Customer', 'Role', 'Amount', 'Remark', 'Items JSON']);
  }
  
  sheet.appendRow([
    new Date(),
    data.meta.customerName,
    data.meta.salesName,
    data.meta.totalAmount,
    data.meta.remark,
    JSON.stringify(data.items)
  ]);
  
  return createJsonResponse({ status: 'success' });
}

// ── UTILITIES ──

function createJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
