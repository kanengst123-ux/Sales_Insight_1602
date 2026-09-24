/**
 * Google Apps Script Web App Template for Salestable / Trade Log App.
 * Fully backwards-compatible with all existing apps, external automations,
 * Customer Grade managers, Product managers, and Trade Log operations.
 *
 * Supported Actions (via HTTP POST / JSON):
 * 1. addProduct / updateProduct: Add/update product in 'raw' sheet.
 * 2. addCustomer: Add new customer to 'customer_cat' or '顧客級數' sheet.
 * 3. updateGrades: Update customer grade assignments in 'customer_cat' / '顧客級數'.
 *    (Also supports legacy payload `{ "CustomerName": "A", ... }` directly).
 * 4. writeTradeLog: Writes trade rows to 'Trade_Log' (or 'Trade_log_admin') and deducts inventory in 'raw'.
 * 5. deleteOrder: Deletes order rows by orderId and restores inventory in 'raw' (strictly 1x, deduplicated).
 * 6. revertStockForOrders: Reverts/replenishes stock for specific order ID(s) without double counting.
 *
 * Supported Actions (via HTTP GET):
 * 1. getCustomers: Returns list of customers with grade, sales/user, and district.
 * 2. getProducts: Returns all products from 'raw' sheet with prices, stock, and remarks.
 * 3. getProductImage: Finds image in Google Drive by product ID / SKU.
 */

// ==========================================
// 1. HTTP POST Entrypoint
// ==========================================
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Empty post body' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var param = {};
    try {
      param = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid JSON payload: ' + parseErr.toString() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var action = param.action;

    // A. Action: addProduct or updateProduct
    if (action === 'addProduct' || action === 'updateProduct' || (!action && param.id && param.name)) {
      var prodResult = handleAddOrUpdateProduct(param);
      return ContentService.createTextOutput(JSON.stringify(prodResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // B. Action: addCustomer
    if (action === 'addCustomer') {
      var custResult = handleAddCustomer(param);
      return ContentService.createTextOutput(JSON.stringify(custResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // C. Action: updateGrades or Legacy Direct Grade Map
    // (Other apps or CustomerGrades tab send either { action: 'updateGrades', grades: {...} }
    // or directly { "Customer A": "A", "Customer B": "B" })
    var isDirectGradeMap = !action && !param.orderId && !param.rows && !param.id && typeof param === 'object' && Object.keys(param).length > 0;
    if (action === 'updateGrades' || param.grades || isDirectGradeMap) {
      var gradesData = param.grades || param;
      var gradeResult = handleUpdateGrades(gradesData);
      return ContentService.createTextOutput(JSON.stringify(gradeResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // D. Action: writeTradeLog
    if (action === 'writeTradeLog') {
      var logResult = handleWriteTradeLog(param);
      return ContentService.createTextOutput(JSON.stringify(logResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // E. Action: deleteOrder (Deletes order and replenishes stock strictly 1x)
    if (action === 'deleteOrder') {
      var delResult = handleDeleteOrder(param);
      return ContentService.createTextOutput(JSON.stringify(delResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // F. Action: revertStockForOrders / revertStock
    if (action === 'revertStockForOrders' || action === 'revertStock') {
      var orderIds = param.orderIds || (param.orderId ? [param.orderId] : []);
      var revertResult = handleRevertStockForOrders(orderIds);
      return ContentService.createTextOutput(JSON.stringify(revertResult))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 2. HTTP GET Entrypoint
// ==========================================
function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : null;

    // 1. getCustomers
    if (action === 'getCustomers') {
      var customers = handleGetCustomers();
      return ContentService.createTextOutput(JSON.stringify(customers))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. getProducts
    if (action === 'getProducts') {
      var products = handleGetProducts();
      return ContentService.createTextOutput(JSON.stringify(products))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. getProductImage
    if (action === 'getProductImage') {
      var id = e.parameter ? e.parameter.id : null;
      if (!id) {
        return ContentService.createTextOutput(JSON.stringify({ found: false, error: 'missing id' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var foundUrl = null;
      var fileNamesToTry = [id, id + '.jpg', id + '.png', id + '.jpeg', id + '.webp'];
      for (var fIdx = 0; fIdx < fileNamesToTry.length; fIdx++) {
        var files = DriveApp.getFilesByName(fileNamesToTry[fIdx]);
        if (files.hasNext()) {
          var file = files.next();
          foundUrl = "https://lh3.googleusercontent.com/d/" + file.getId();
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ found: !!foundUrl, url: foundUrl, id: id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput("Google Apps Script Web App is active and ready.");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// 3. Core Helper Functions
// ==========================================

/**
 * Safely find all trade log sheets in the active spreadsheet.
 * Strictly deduplicates sheets by Sheet ID so that aliases or case variations
 * NEVER cause the same sheet to be processed multiple times.
 */
function getUniqueTradeLogSheets(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  var allSheets = ss.getSheets();
  var logSheets = [];
  var visitedSheetIds = {};

  for (var i = 0; i < allSheets.length; i++) {
    var s = allSheets[i];
    var sId = s.getSheetId();
    if (visitedSheetIds[sId]) continue;

    var nameNorm = s.getName().toLowerCase().replace(/[\s_-]/g, '');
    if (nameNorm === 'tradelog' || nameNorm === 'tradelogadmin' || s.getName() === '交易記錄') {
      visitedSheetIds[sId] = true;
      logSheets.push(s);
    }
  }
  return logSheets;
}

/**
 * Safely parse numeric value from currency or formatted strings.
 */
function safeParseNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  var cleaned = val.toString().replace('$', '').replace(/,/g, '').trim();
  var parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Safely parse price value (returns NaN if empty, preserving unset prices).
 */
function safeParsePrice(val) {
  if (val === undefined || val === null || val.toString().trim() === '') return NaN;
  var cleaned = val.toString().replace('$', '').replace(/,/g, '').trim();
  var parsed = parseFloat(cleaned);
  return isNaN(parsed) ? NaN : parsed;
}

/**
 * Get customer categorization sheet (supports customer_cat or 顧客級數).
 */
function getCustomerCatSheet(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('customer_cat') ||
         ss.getSheetByName('顧客級數') ||
         ss.getSheetByName('Customer_Cat');
}

// ==========================================
// 4. Feature Handlers
// ==========================================

/**
 * Handle Add or Update Product in 'raw' sheet.
 */
function handleAddOrUpdateProduct(param) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('raw');
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }

  var name = param.name;
  var id = param.id;
  var price = param.price;
  var priceA = param.priceA;
  var priceB = param.priceB;
  var priceC = param.priceC;
  var quantity = param.quantity;
  var remarks = param.remarks;

  var data = sheet.getDataRange().getValues();
  var foundIndex = -1;
  for (var i = 1; i < data.length; i++) {
    var rowName = (data[i][2] || "").toString().trim();
    var rowId = (data[i][1] || "").toString().trim();
    if ((id && rowId === id.toString().trim()) || (name && rowName === name.toString().trim())) {
      foundIndex = i;
      break;
    }
  }

  var rowToUpdate = foundIndex !== -1 ? foundIndex + 1 : sheet.getLastRow() + 1;

  if (foundIndex === -1) {
    sheet.getRange(rowToUpdate, 1).setValue(new Date()); // Col A: Timestamp
    sheet.getRange(rowToUpdate, 2).setValue(id || "");  // Col B: SKU / ID
    sheet.getRange(rowToUpdate, 3).setValue(name || ""); // Col C: Product Name
    sheet.getRange(rowToUpdate, 4).setValue(id || "");  // Col D: Metadata / SKU ID
  } else {
    sheet.getRange(rowToUpdate, 2).setValue(id || "");
    sheet.getRange(rowToUpdate, 3).setValue(name || "");
  }

  var pNum = safeParsePrice(price);
  if (!isNaN(pNum)) sheet.getRange(rowToUpdate, 15).setValue(pNum); // Col O: Price

  var pA = safeParsePrice(priceA);
  if (!isNaN(pA)) sheet.getRange(rowToUpdate, 18).setValue(pA); // Col R: A 價
  else if (!isNaN(pNum)) sheet.getRange(rowToUpdate, 18).setValue(pNum);

  var pB = safeParsePrice(priceB);
  if (!isNaN(pB)) sheet.getRange(rowToUpdate, 19).setValue(pB); // Col S: B 價
  else if (!isNaN(pNum)) sheet.getRange(rowToUpdate, 19).setValue(pNum);

  var pC = safeParsePrice(priceC);
  if (!isNaN(pC)) sheet.getRange(rowToUpdate, 20).setValue(pC); // Col T: C 價
  else if (!isNaN(pNum)) sheet.getRange(rowToUpdate, 20).setValue(pNum);

  var abVal = (quantity === "" || quantity === undefined) ? 1 : 0;
  var acVal = abVal === 1 ? "" : (quantity || "0");

  sheet.getRange(rowToUpdate, 28).setValue(abVal); // Col AB: UnlimitedStock
  sheet.getRange(rowToUpdate, 29).setValue(acVal); // Col AC: Stock / 庫存
  sheet.getRange(rowToUpdate, 30).setValue(remarks || ""); // Col AD: Remarks

  SpreadsheetApp.flush();
  return {
    status: 'success',
    message: 'Product synced successfully in row ' + rowToUpdate
  };
}

/**
 * Handle Add Customer to customer_cat / 顧客級數.
 */
function handleAddCustomer(param) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getCustomerCatSheet(ss);
  if (!sheet) {
    return { status: 'error', message: 'customer_cat or 顧客級數 sheet not found' };
  }

  var name = param.name;
  var user = param.user || param.sales || "";
  var district = param.district || "";
  var grade = param.grade || "C";

  sheet.appendRow([name, user, grade, district]);
  SpreadsheetApp.flush();
  return { status: 'success', message: 'Customer added successfully' };
}

/**
 * Handle Update Customer Grades.
 * Updates customer grades in 'customer_cat' / '顧客級數' without modifying other fields.
 */
function handleUpdateGrades(grades) {
  if (!grades || typeof grades !== 'object') {
    return { status: 'error', message: 'No grades provided' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getCustomerCatSheet(ss);
  if (!sheet) {
    return { status: 'error', message: 'customer_cat or 顧客級數 sheet not found' };
  }

  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { status: 'success', message: 'No customer rows to update' };
  }

  var updatedCount = 0;
  for (var i = 1; i < data.length; i++) {
    var custName = (data[i][0] || '').toString().trim();
    if (custName && grades.hasOwnProperty(custName)) {
      var newGrade = grades[custName];
      if (newGrade !== undefined && newGrade !== null) {
        sheet.getRange(i + 1, 3).setValue(newGrade.toString().trim().toUpperCase()); // Col C: Grade
        updatedCount++;
      }
    }
  }

  SpreadsheetApp.flush();
  return { status: 'success', message: 'Updated ' + updatedCount + ' customer grades successfully' };
}

/**
 * Handle Write Trade Log & Deduct Inventory.
 */
function handleWriteTradeLog(param) {
  var rows = param.rows;
  if (!rows || rows.length === 0) {
    return { status: 'success', message: 'No rows sent' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Determine target sheet
  var isTargetAdmin = false;
  if (param.targetSheet === 'Trade_log_admin' || param.isAdmin === true) {
    isTargetAdmin = true;
  } else if (rows[0] && rows[0].length > 10) {
    var userCol = (rows[0][10] || '').toString().trim().toLowerCase();
    if (userCol === 'admin') isTargetAdmin = true;
  }

  var sheet;
  var targetSheetName;
  if (isTargetAdmin) {
    targetSheetName = 'Trade_log_admin';
    sheet = ss.getSheetByName('Trade_log_admin') ||
            ss.getSheetByName('Trade_Log_admin') ||
            ss.getSheetByName('trade_log_admin');
    if (!sheet) sheet = ss.insertSheet('Trade_log_admin');
  } else {
    targetSheetName = 'Trade_Log';
    sheet = ss.getSheetByName('Trade_Log') ||
            ss.getSheetByName('trade_log') ||
            ss.getSheetByName('交易記錄');
    if (!sheet) sheet = ss.getSheetByName('Trade_Log') || ss.getSheets()[0];
  }

  // Deduplicate and remove existing rows with matching order IDs across all trade log tabs
  var incomingIds = {};
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].length >= 13) {
      var oId = (rows[i][12] || '').toString().trim();
      if (oId) incomingIds[oId] = true;
    }
  }

  var uniqueIdsToDelete = Object.keys(incomingIds);
  if (uniqueIdsToDelete.length > 0) {
    var logSheetsForClean = getUniqueTradeLogSheets(ss);
    logSheetsForClean.forEach(function(targetLogSheet) {
      var lastRow = targetLogSheet.getLastRow();
      if (lastRow > 1) {
        var colMValues = targetLogSheet.getRange(2, 13, lastRow - 1, 1).getValues();
        for (var r = lastRow; r >= 2; r--) {
          var cellValue = colMValues[r - 2][0];
          if (cellValue && incomingIds[cellValue.toString().trim()]) {
            targetLogSheet.deleteRow(r);
          }
        }
      }
    });
  }

  // Append new trade rows
  for (var i = 0; i < rows.length; i++) {
    sheet.appendRow(rows[i]);
  }

  // Deduct inventory quantities from 'raw' sheet
  deductInventoryFromRaw(ss, rows);

  SpreadsheetApp.flush();
  return {
    status: 'success',
    message: 'Trade log written and stock updated in ' + targetSheetName
  };
}

/**
 * Handle Delete Order & Replenish Stock.
 * GUARANTEE: Restores inventory strictly ONCE (no doubling).
 */
function handleDeleteOrder(param) {
  var rowValuesToReplenish = param.rows;
  var orderId = param.orderId ? param.orderId.toString().trim() : null;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheets = getUniqueTradeLogSheets(ss);

  // If trade rows to replenish were not explicitly provided, extract them from the sheets before deleting
  if (orderId && (!rowValuesToReplenish || rowValuesToReplenish.length === 0)) {
    rowValuesToReplenish = [];
    logSheets.forEach(function(s) {
      var lRow = s.getLastRow();
      if (lRow > 1) {
        var vals = s.getRange(1, 1, lRow, 14).getValues();
        for (var r = 1; r < lRow; r++) {
          var rowOrderId = (vals[r][12] || '').toString().trim();
          if (rowOrderId === orderId) {
            rowValuesToReplenish.push(vals[r]);
          }
        }
      }
    });
  }

  // Replenish stock in 'raw' sheet strictly ONCE
  if (rowValuesToReplenish && rowValuesToReplenish.length > 0) {
    replenishInventoryInRaw(ss, rowValuesToReplenish);
  }

  // Delete order rows from all unique log sheets
  var deletedCount = 0;
  if (orderId) {
    logSheets.forEach(function(s) {
      var lastRow = s.getLastRow();
      if (lastRow > 1) {
        var colMValues = s.getRange(2, 13, lastRow - 1, 1).getValues();
        for (var r = lastRow; r >= 2; r--) {
          var cellValue = colMValues[r - 2][0];
          if (cellValue && cellValue.toString().trim() === orderId) {
            s.deleteRow(r);
            deletedCount++;
          }
        }
      }
    });
  }

  SpreadsheetApp.flush();
  return {
    status: 'success',
    message: 'Order rows processed and deleted successfully (deleted ' + deletedCount + ' rows)'
  };
}

/**
 * Handle Revert Stock for Orders.
 * Used by external apps or automations to replenish stock for orders.
 */
function handleRevertStockForOrders(orderIds) {
  if (!orderIds || (Array.isArray(orderIds) && orderIds.length === 0)) {
    return { status: 'error', message: 'No order IDs provided' };
  }

  if (!Array.isArray(orderIds)) {
    orderIds = [orderIds.toString().trim()];
  }

  var idMap = {};
  orderIds.forEach(function(id) {
    if (id) idMap[id.toString().trim()] = true;
  });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var logSheets = getUniqueTradeLogSheets(ss);
  var rowsToReplenish = [];

  logSheets.forEach(function(s) {
    var lRow = s.getLastRow();
    if (lRow > 1) {
      var vals = s.getRange(1, 1, lRow, 14).getValues();
      for (var r = 1; r < lRow; r++) {
        var rowOrderId = (vals[r][12] || '').toString().trim();
        if (rowOrderId && idMap[rowOrderId]) {
          rowsToReplenish.push(vals[r]);
        }
      }
    }
  });

  if (rowsToReplenish.length > 0) {
    replenishInventoryInRaw(ss, rowsToReplenish);
  }

  SpreadsheetApp.flush();
  return {
    status: 'success',
    message: 'Reverted stock for ' + rowsToReplenish.length + ' order items'
  };
}

/**
 * Deduct inventory quantities from 'raw' sheet based on trade log rows.
 */
function deductInventoryFromRaw(ss, rows) {
  var rawSheet = ss.getSheetByName('raw');
  if (!rawSheet || !rows || rows.length === 0) return;

  var rawValues = rawSheet.getDataRange().getValues();
  var headers = findRawSheetHeaders(rawValues);

  var prodToIndex = {};
  for (var rIdx = headers.headerRowIdx + 1; rIdx < rawValues.length; rIdx++) {
    var pName = rawValues[rIdx][headers.titleIdx];
    if (pName && pName.toString().trim()) {
      prodToIndex[pName.toString().trim()] = rIdx;
    }
  }

  for (var i = 0; i < rows.length; i++) {
    var incomingRow = rows[i];
    if (incomingRow.length < 6) continue;
    var incomingProdName = (incomingRow[1] || '').toString().trim();
    var colD = incomingRow[3];
    var colF = incomingRow[5];

    var soldQty = safeParseNumber(colD) * safeParseNumber(colF);
    if (incomingProdName && soldQty > 0) {
      var targetIndex = prodToIndex[incomingProdName];
      if (targetIndex !== undefined) {
        var rawRow = rawValues[targetIndex];
        var isUnlimited = rawRow[headers.unlimitedIdx] !== undefined &&
                          rawRow[headers.unlimitedIdx] !== null &&
                          rawRow[headers.unlimitedIdx].toString().trim() === '1';

        if (!isUnlimited) {
          var currentStock = safeParseNumber(rawRow[headers.stockIdx]);
          var newStock = currentStock - soldQty;
          rawValues[targetIndex][headers.stockIdx] = newStock;
          rawSheet.getRange(targetIndex + 1, headers.stockIdx + 1).setValue(newStock);
        }
      }
    }
  }
}

/**
 * Replenish inventory quantities to 'raw' sheet based on deleted/reverted rows.
 */
function replenishInventoryInRaw(ss, rows) {
  var rawSheet = ss.getSheetByName('raw');
  if (!rawSheet || !rows || rows.length === 0) return;

  var rawValues = rawSheet.getDataRange().getValues();
  var headers = findRawSheetHeaders(rawValues);

  var prodToIndex = {};
  for (var rIdx = headers.headerRowIdx + 1; rIdx < rawValues.length; rIdx++) {
    var pName = rawValues[rIdx][headers.titleIdx];
    if (pName && pName.toString().trim()) {
      prodToIndex[pName.toString().trim()] = rIdx;
    }
  }

  for (var i = 0; i < rows.length; i++) {
    var deletedRow = rows[i];
    if (deletedRow.length < 6) continue;
    var pName = (deletedRow[1] || '').toString().trim();
    var colD = deletedRow[3];
    var colF = deletedRow[5];

    var returnQty = safeParseNumber(colD) * safeParseNumber(colF);
    if (pName && returnQty > 0) {
      var targetIndex = prodToIndex[pName];
      if (targetIndex !== undefined) {
        var rawRow = rawValues[targetIndex];
        var isUnlimited = rawRow[headers.unlimitedIdx] !== undefined &&
                          rawRow[headers.unlimitedIdx] !== null &&
                          rawRow[headers.unlimitedIdx].toString().trim() === '1';

        if (!isUnlimited) {
          var currentStock = safeParseNumber(rawRow[headers.stockIdx]);
          var newStock = currentStock + returnQty;
          rawValues[targetIndex][headers.stockIdx] = newStock;
          rawSheet.getRange(targetIndex + 1, headers.stockIdx + 1).setValue(newStock);
        }
      }
    }
  }
}

/**
 * Locate header column indices in 'raw' sheet dynamically with robust fallbacks.
 */
function findRawSheetHeaders(rawValues) {
  var headerRowIdx = 0;
  var titleIdx = 2; // Default Col C
  var unlimitedIdx = 27; // Default Col AB
  var stockIdx = 28; // Default Col AC

  for (var i = 0; i < Math.min(rawValues.length, 10); i++) {
    var row = rawValues[i];
    var foundIdx = -1;
    for (var j = 0; j < row.length; j++) {
      if (row[j] && row[j].toString().toLowerCase().trim() === 'title') {
        foundIdx = j;
        break;
      }
    }
    if (foundIdx !== -1) {
      headerRowIdx = i;
      titleIdx = foundIdx;
      for (var j = 0; j < row.length; j++) {
        var cellStr = (row[j] || '').toString().toLowerCase().trim();
        var normed = cellStr.replace(/[\s_-]/g, '');
        if (normed.indexOf('unlimitedstock') !== -1) unlimitedIdx = j;
        else if (normed === 'stock' || cellStr.indexOf('庫存') !== -1) stockIdx = j;
      }
      break;
    }
  }

  return {
    headerRowIdx: headerRowIdx,
    titleIdx: titleIdx,
    unlimitedIdx: unlimitedIdx,
    stockIdx: stockIdx
  };
}

/**
 * Handle Get Customers for GET requests.
 */
function handleGetCustomers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getCustomerCatSheet(ss);
  if (!sheet) return [];

  var values = sheet.getDataRange().getValues();
  var customers = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row[0]) {
      customers.push({
        name: row[0].toString().trim(),
        sales: (row[1] || "").toString().trim(),
        user: (row[1] || "").toString().trim(),
        grade: (row[2] || "").toString().trim(),
        district: (row[3] || "").toString().trim()
      });
    }
  }
  return customers;
}

/**
 * Handle Get Products for GET requests.
 */
function handleGetProducts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('raw');
  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];

  var values = sheet.getDataRange().getValues();
  var headerRowIdx = 0;
  var titleIdx = 2; // Col C
  var productIdIdx = 1; // Col B
  var goldIdx = 17; // Col R
  var silverIdx = 18; // Col S
  var basicIdx = 19; // Col T
  var priceIdx = 14; // Col O
  var unlimitedIdx = 27; // Col AB
  var stockIdx = 28; // Col AC

  for (var i = 0; i < Math.min(values.length, 10); i++) {
    var row = values[i];
    var foundIdx = -1;
    for (var j = 0; j < row.length; j++) {
      if (row[j] && row[j].toString().toLowerCase().trim() === 'title') {
        foundIdx = j;
        break;
      }
    }
    if (foundIdx !== -1) {
      headerRowIdx = i;
      titleIdx = foundIdx;
      for (var j = 0; j < row.length; j++) {
        var cellStr = (row[j] || '').toString().toLowerCase().trim();
        var normed = cellStr.replace(/[\s_-]/g, '');
        if (normed === 'productid' || cellStr === 'product id' || normed === 'sku') productIdIdx = j;
        else if (cellStr.indexOf('gold') !== -1 || cellStr.indexOf('a價') !== -1 || cellStr === 'a' || cellStr === 'a價') goldIdx = j;
        else if (cellStr.indexOf('silver') !== -1 || cellStr.indexOf('b價') !== -1 || cellStr === 'b' || cellStr === 'b價') silverIdx = j;
        else if (cellStr.indexOf('basic') !== -1 || cellStr.indexOf('c價') !== -1 || cellStr === 'c' || cellStr === 'c價') basicIdx = j;
        else if (normed === 'price') priceIdx = j;
        else if (normed.indexOf('unlimitedstock') !== -1) unlimitedIdx = j;
        else if (normed === 'stock' || cellStr.indexOf('庫存') !== -1) stockIdx = j;
      }
      break;
    }
  }

  var productsList = [];
  for (var rowIdx = headerRowIdx + 1; rowIdx < values.length; rowIdx++) {
    var row = values[rowIdx];
    var name = (row[titleIdx] || "").toString().trim();
    var sku = (row[productIdIdx] || row[1] || "").toString().trim();
    var id = sku || ("row-" + rowIdx);

    if (name) {
      var basePrice = safeParsePrice(row[priceIdx]);
      if (isNaN(basePrice)) basePrice = 0;

      var pA = safeParsePrice(row[goldIdx]);
      var pB = safeParsePrice(row[silverIdx]);
      var pC = safeParsePrice(row[basicIdx]);

      var priceA = !isNaN(pA) ? pA : basePrice;
      var priceB = !isNaN(pB) ? pB : basePrice;
      var priceC = !isNaN(pC) ? pC : basePrice;

      var alwaysStock = true;
      if (row[unlimitedIdx] !== undefined && row[unlimitedIdx] !== null) {
        alwaysStock = row[unlimitedIdx].toString().trim() === "1";
      }

      var sVal = 0;
      var secondaryStockCount = "";
      if (!alwaysStock) {
        sVal = safeParseNumber(row[stockIdx]);
        secondaryStockCount = sVal.toString();
      }

      var merchantRemark = row[29] || "";

      productsList.push({
        id: id,
        name: name,
        price: basePrice,
        priceA: priceA,
        priceB: priceB,
        priceC: priceC,
        prices: {
          A: priceA,
          B: priceB,
          C: priceC
        },
        unlimitedStock: alwaysStock,
        stock: !alwaysStock ? sVal : undefined,
        hasStock: true,
        alwaysStock: alwaysStock,
        secondaryStockCount: secondaryStockCount,
        extraAttributes: {
          "Categories": "Google Sheet Sync",
          "Merchant Remark": merchantRemark,
          "remarks": merchantRemark
        },
        allValues: row.map(function(cell) { return cell.toString(); })
      });
    }
  }

  return productsList;
}

// ==========================================
// 5. Global Functions (Direct Apps Script Calls)
// ==========================================
// These allow external Apps Script files, triggers, or custom Google Sheets UI
// to invoke functions directly in Apps Script without going through HTTP.

function updateGrades(grades) {
  return handleUpdateGrades(grades);
}

function revertStockForOrders(orderIds) {
  return handleRevertStockForOrders(orderIds);
}

function deleteOrder(orderId, rows) {
  return handleDeleteOrder({ orderId: orderId, rows: rows });
}

function writeTradeLog(rows, targetSheet, isAdmin) {
  return handleWriteTradeLog({ rows: rows, targetSheet: targetSheet, isAdmin: isAdmin });
}

function addProduct(param) {
  return handleAddOrUpdateProduct(param);
}

function addCustomer(param) {
  return handleAddCustomer(param);
}

function getProducts() {
  return handleGetProducts();
}

function getCustomers() {
  return handleGetCustomers();
}
