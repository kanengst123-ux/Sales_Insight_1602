/**
 * Google Apps Script Web App Template for Salestable / Trade Log App.
 * Fully supports writeTradeLog (with separate Trade_log_admin for Admin orders),
 * addProduct / updateProduct, addCustomer, deleteOrder, getProducts, and getCustomers.
 */

function doPost(e) {
  try {
    var param = JSON.parse(e.postData.contents);
    var action = param.action;
    
    // 1. Action: addProduct or updateProduct
    if (action === 'addProduct' || action === 'updateProduct' || (!action && param.id)) {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('raw');
      if (!sheet) {
        sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      }
      
      var name = param.name;
      var id = param.id;
      var price = param.price;
      var priceA = param.priceA;
      var priceB = param.priceB;
      var priceC = param.priceC;
      var quantity = param.quantity;
      var remarks = param.remarks;
      var username = param.username || "System";
      
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
      
      function safeParsePrice(val) {
        if (val === undefined || val === null || val.toString().trim() === "") {
          return NaN;
        }
        var cleaned = val.toString().replace('$', '').replace(/,/g, '').trim();
        var parsed = parseFloat(cleaned);
        return isNaN(parsed) ? NaN : parsed;
      }

      var pNum = safeParsePrice(price);
      if (!isNaN(pNum)) {
        sheet.getRange(rowToUpdate, 15).setValue(pNum); // Col O: Price
      }
      
      var pA = safeParsePrice(priceA);
      if (!isNaN(pA)) {
        sheet.getRange(rowToUpdate, 18).setValue(pA); // Col R: A 價 (Gold Price)
      } else if (!isNaN(pNum)) {
        sheet.getRange(rowToUpdate, 18).setValue(pNum);
      }

      var pB = safeParsePrice(priceB);
      if (!isNaN(pB)) {
        sheet.getRange(rowToUpdate, 19).setValue(pB); // Col S: B 價 (Silver Price)
      } else if (!isNaN(pNum)) {
        sheet.getRange(rowToUpdate, 19).setValue(pNum);
      }

      var pC = safeParsePrice(priceC);
      if (!isNaN(pC)) {
        sheet.getRange(rowToUpdate, 20).setValue(pC); // Col T: C 價 (Basic Price)
      } else if (!isNaN(pNum)) {
        sheet.getRange(rowToUpdate, 20).setValue(pNum);
      }
      
      var abVal = (quantity === "" || quantity === undefined) ? 1 : 0;
      var acVal = abVal === 1 ? "" : (quantity || "0");
      
      sheet.getRange(rowToUpdate, 28).setValue(abVal); // Col AB: UnlimitedStock
      sheet.getRange(rowToUpdate, 29).setValue(acVal); // Col AC: Stock / 庫存
      sheet.getRange(rowToUpdate, 30).setValue(remarks || ""); // Col AD: Remarks
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Product synced successfully in row ' + rowToUpdate
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Action: addCustomer
    if (action === 'addCustomer') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('customer_cat') || 
                  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('顧客級數');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'customer_cat or 顧客級數 sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var name = param.name;
      var user = param.user;
      var district = param.district;
      var grade = param.grade;
      
      sheet.appendRow([name, user, grade, district]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Customer added successfully' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. Action: writeTradeLog (Writes to Trade_Log or Trade_log_admin for Admin orders, & deducts inventory)
    if (action === 'writeTradeLog') {
      var rows = param.rows; // Array of arrays
      if (!rows || rows.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'No rows sent' }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      var ss = SpreadsheetApp.getActiveSpreadsheet();

      // Determine target sheet name
      var isTargetAdmin = false;
      if (param.targetSheet === 'Trade_log_admin' || param.isAdmin === true) {
        isTargetAdmin = true;
      } else if (rows[0] && rows[0].length > 10) {
        var userCol = (rows[0][10] || '').toString().trim().toLowerCase();
        if (userCol === 'admin') {
          isTargetAdmin = true;
        }
      }

      var sheet;
      var targetSheetName;

      if (isTargetAdmin) {
        targetSheetName = 'Trade_log_admin';
        sheet = ss.getSheetByName('Trade_log_admin') || 
                ss.getSheetByName('Trade_Log_admin') || 
                ss.getSheetByName('trade_log_admin');
        if (!sheet) {
          sheet = ss.insertSheet('Trade_log_admin');
        }
      } else {
        targetSheetName = 'Trade_Log';
        sheet = ss.getSheetByName('Trade_Log') || 
                ss.getSheetByName('trade_log') || 
                ss.getSheetByName('交易記錄');
        if (!sheet) {
          sheet = ss.getSheetByName('Trade_Log') || ss.getSheets()[0];
        }
      }

      // 3a. Revert previous stock if modifying existing order IDs
      var incomingIds = {};
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].length >= 13) {
          var oId = (rows[i][12] || '').toString().trim();
          if (oId) incomingIds[oId] = true;
        }
      }

      // Delete existing rows with matching order IDs across all trade log tabs
      var uniqueIdsToDelete = Object.keys(incomingIds);
      if (uniqueIdsToDelete.length > 0) {
        var logSheetsToClean = ['Trade_Log', 'trade_log', '交易記錄', 'Trade_log_admin', 'Trade_Log_admin', 'trade_log_admin'];
        logSheetsToClean.forEach(function(sName) {
          var targetLogSheet = ss.getSheetByName(sName);
          if (targetLogSheet) {
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
          }
        });
      }

      // 3b. Append new trade rows
      for (var i = 0; i < rows.length; i++) {
        sheet.appendRow(rows[i]);
      }
      
      // 3c. Deduct inventory quantities automatically from 'raw' sheet
      var rawSheet = ss.getSheetByName('raw');
      if (rawSheet) {
        var rawValues = rawSheet.getDataRange().getValues();
        var rawHeaderRowIdx = 0;
        var rawTitleIdx = 2; // Default Col C
        var rawUnlimitedIdx = 27; // Col AB
        var rawStockIdx = 28; // Col AC
        
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
            rawHeaderRowIdx = i;
            rawTitleIdx = foundIdx;
            for (var j = 0; j < row.length; j++) {
              var cellStr = (row[j] || '').toString().toLowerCase().trim();
              var normed = cellStr.replace(/[\s_-]/g, '');
              if (normed.indexOf('unlimitedstock') !== -1) rawUnlimitedIdx = j;
              else if (normed === 'stock' || cellStr.indexOf('庫存') !== -1) rawStockIdx = j;
            }
            break;
          }
        }

        var prodToIndex = {};
        for (var rIdx = rawHeaderRowIdx + 1; rIdx < rawValues.length; rIdx++) {
          var pName = rawValues[rIdx][rawTitleIdx];
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
          
          var soldQty = 0;
          if (colD !== undefined && colF !== undefined) {
            var parseVal = function(v) {
              if (v === undefined || v === null || v === '') return 0;
              if (typeof v === 'number') return v;
              var cleaned = v.toString().replace('$', '').replace(/,/g, '').trim();
              var parsed = parseFloat(cleaned);
              return isNaN(parsed) ? 0 : parsed;
            };
            soldQty = parseVal(colD) * parseVal(colF);
          }

          if (incomingProdName && soldQty > 0) {
            var targetIndex = prodToIndex[incomingProdName];
            if (targetIndex !== undefined) {
              var rawRow = rawValues[targetIndex];
              var isUnlimited = rawRow[rawUnlimitedIdx] !== undefined && rawRow[rawUnlimitedIdx] !== null && rawRow[rawUnlimitedIdx].toString().trim() === '1';
              if (!isUnlimited) {
                var currentStockStr = rawRow[rawStockIdx];
                var currentStock = 0;
                if (currentStockStr !== undefined && currentStockStr !== null && currentStockStr.toString().trim() !== '') {
                  var parsedStock = parseFloat(currentStockStr.toString().replace('$', '').replace(/,/g, '').trim());
                  if (!isNaN(parsedStock)) {
                    currentStock = parsedStock;
                  }
                }
                var newStock = currentStock - soldQty;
                rawValues[targetIndex][rawStockIdx] = newStock;
                rawSheet.getRange(targetIndex + 1, rawStockIdx + 1).setValue(newStock);
              }
            }
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: 'success', 
        message: 'Trade log written and stock updated in ' + targetSheetName 
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 4. Action: deleteOrder (Replenish stock back to raw sheet on order deletion)
    if (action === 'deleteOrder') {
      var rowValuesToReplenish = param.rows; // Array of arrays containing trade rows deleted
      var orderId = param.orderId;
      var ss = SpreadsheetApp.getActiveSpreadsheet();

      // If orderId is provided, find and gather the rows to delete across trade log sheets
      var logSheetsToCheck = ['Trade_Log', 'trade_log', '交易記錄', 'Trade_log_admin', 'Trade_Log_admin', 'trade_log_admin'];
      
      if (orderId && (!rowValuesToReplenish || rowValuesToReplenish.length === 0)) {
        rowValuesToReplenish = [];
        logSheetsToCheck.forEach(function(sName) {
          var s = ss.getSheetByName(sName);
          if (s) {
            var lRow = s.getLastRow();
            if (lRow > 1) {
              var vals = s.getRange(1, 1, lRow, 14).getValues();
              for (var r = 1; r < lRow; r++) {
                if (vals[r][12] && vals[r][12].toString().trim() === orderId.toString().trim()) {
                  rowValuesToReplenish.push(vals[r]);
                }
              }
            }
          }
        });
      }

      // Replenish stock in 'raw' sheet
      var rawSheet = ss.getSheetByName('raw');
      if (rawSheet && rowValuesToReplenish && rowValuesToReplenish.length > 0) {
        var rawValues = rawSheet.getDataRange().getValues();
        var rawHeaderRowIdx = 0;
        var rawTitleIdx = 2;
        var rawUnlimitedIdx = 27;
        var rawStockIdx = 28;
        
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
            rawHeaderRowIdx = i;
            rawTitleIdx = foundIdx;
            for (var j = 0; j < row.length; j++) {
              var cellStr = (row[j] || '').toString().toLowerCase().trim();
              var normed = cellStr.replace(/[\s_-]/g, '');
              if (normed.indexOf('unlimitedstock') !== -1) rawUnlimitedIdx = j;
              else if (normed === 'stock' || cellStr.indexOf('庫存') !== -1) rawStockIdx = j;
            }
            break;
          }
        }

        var prodToIndex = {};
        for (var rIdx = rawHeaderRowIdx + 1; rIdx < rawValues.length; rIdx++) {
          var pName = rawValues[rIdx][rawTitleIdx];
          if (pName && pName.toString().trim()) {
            prodToIndex[pName.toString().trim()] = rIdx;
          }
        }

        for (var i = 0; i < rowValuesToReplenish.length; i++) {
          var deletedRow = rowValuesToReplenish[i];
          if (deletedRow.length < 6) continue;
          var pName = (deletedRow[1] || '').toString().trim();
          var colD = deletedRow[3];
          var colF = deletedRow[5];
          
          var returnQty = 0;
          if (colD !== undefined && colF !== undefined) {
            var parseVal = function(v) {
              if (v === undefined || v === null || v === '') return 0;
              if (typeof v === 'number') return v;
              var cleaned = v.toString().replace('$', '').replace(/,/g, '').trim();
              var parsed = parseFloat(cleaned);
              return isNaN(parsed) ? 0 : parsed;
            };
            returnQty = parseVal(colD) * parseVal(colF);
          }

          if (pName && returnQty > 0) {
            var targetIndex = prodToIndex[pName];
            if (targetIndex !== undefined) {
              var rawRow = rawValues[targetIndex];
              var isUnlimited = rawRow[rawUnlimitedIdx] !== undefined && rawRow[rawUnlimitedIdx] !== null && rawRow[rawUnlimitedIdx].toString().trim() === '1';
              if (!isUnlimited) {
                var currentStockStr = rawRow[rawStockIdx];
                var currentStock = 0;
                if (currentStockStr !== undefined && currentStockStr !== null && currentStockStr.toString().trim() !== '') {
                  var parsedStock = parseFloat(currentStockStr.toString().replace('$', '').replace(/,/g, '').trim());
                  if (!isNaN(parsedStock)) {
                    currentStock = parsedStock;
                  }
                }
                var newStock = currentStock + returnQty;
                rawValues[targetIndex][rawStockIdx] = newStock;
                rawSheet.getRange(targetIndex + 1, rawStockIdx + 1).setValue(newStock);
              }
            }
          }
        }
      }

      // Delete order rows from sheets
      var deletedCount = 0;
      if (orderId) {
        logSheetsToCheck.forEach(function(sName) {
          var s = ss.getSheetByName(sName);
          if (s) {
            var lastRow = s.getLastRow();
            if (lastRow > 1) {
              var colMValues = s.getRange(2, 13, lastRow - 1, 1).getValues();
              for (var r = lastRow; r >= 2; r--) {
                var cellValue = colMValues[r - 2][0];
                if (cellValue && cellValue.toString().trim() === orderId.toString().trim()) {
                  s.deleteRow(r);
                  deletedCount++;
                }
              }
            }
          }
        });
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Order rows processed and deleted successfully' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = e.parameter ? e.parameter.action : null;
    
    // 1. Action: getCustomers
    if (action === 'getCustomers') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('customer_cat') || 
                  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('顧客級數');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'customer_cat or 顧客級數 sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var values = sheet.getDataRange().getValues();
      var customers = [];
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (row[0]) {
          customers.push({
            name: row[0],
            sales: row[1] || "",
            user: row[1] || "",
            grade: row[2] || "",
            district: row[3] || ""
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify(customers))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Action: getProducts
    if (action === 'getProducts') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('raw');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'raw sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var lastRow = sheet.getLastRow();
      if (lastRow < 1) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var values = sheet.getDataRange().getValues();
      var headerRowIdx = 0;
      var titleIdx = 2; // Col C (index 2) is the item title
      var goldIdx = 17; // Col R
      var silverIdx = 18; // Col S
      var basicIdx = 19; // Col T
      var priceIdx = 14; // Col O
      var discountedPriceIdx = 15; // Col P
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
            if (cellStr.indexOf('gold') !== -1 || cellStr.indexOf('a價') !== -1 || cellStr.indexOf('a 價') !== -1 || cellStr === 'a' || cellStr === 'a價') goldIdx = j;
            else if (cellStr.indexOf('silver') !== -1 || cellStr.indexOf('b價') !== -1 || cellStr.indexOf('b 價') !== -1 || cellStr === 'b' || cellStr === 'b價') silverIdx = j;
            else if (cellStr.indexOf('basic') !== -1 || cellStr.indexOf('c價') !== -1 || cellStr.indexOf('c 價') !== -1 || cellStr === 'c' || cellStr === 'c價') basicIdx = j;
            else if (normed === 'price') priceIdx = j;
            else if (normed === 'discountedprice') discountedPriceIdx = j;
            else if (normed.indexOf('unlimitedstock') !== -1) unlimitedIdx = j;
            else if (normed === 'stock' || cellStr.indexOf('庫存') !== -1) stockIdx = j;
          }
          break;
        }
      }
      
      var parseNum = function(val) {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        var cleaned = val.toString().replace('$', '').replace(/,/g, '').trim();
        var parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      var productsList = [];
      
      for (var rowIdx = headerRowIdx + 1; rowIdx < values.length; rowIdx++) {
        var row = values[rowIdx];
        var name = (row[titleIdx] || "").toString().trim();
        var sku = (row[1] || "").toString().trim();
        var id = sku || ("row-" + rowIdx);
        
        if (name) {
          var basePrice = parseNum(row[priceIdx]);
          var priceA = row[goldIdx] !== undefined && row[goldIdx] !== "" ? parseNum(row[goldIdx]) : basePrice;
          var priceB = row[silverIdx] !== undefined && row[silverIdx] !== "" ? parseNum(row[silverIdx]) : basePrice;
          var priceC = row[basicIdx] !== undefined && row[basicIdx] !== "" ? parseNum(row[basicIdx]) : basePrice;
          
          var hasStock = true;
          var alwaysStock = true;
          var secondaryStockCount = "";
          
          if (row[unlimitedIdx] !== undefined && row[unlimitedIdx] !== null) {
            alwaysStock = row[unlimitedIdx].toString().trim() === "1";
          }
          
          if (!alwaysStock) {
            var sVal = parseNum(row[stockIdx]);
            secondaryStockCount = sVal.toString();
            hasStock = sVal > 0;
          }
          
          var merchantRemark = row[29] || "";
          
          var product = {
            id: id,
            name: name,
            price: basePrice.toString(),
            priceA: priceA.toString(),
            priceB: priceB.toString(),
            priceC: priceC.toString(),
            hasStock: hasStock,
            alwaysStock: alwaysStock,
            secondaryStockCount: secondaryStockCount,
            extraAttributes: {
              "Categories": "Google Sheet Sync",
              "Merchant Remark": merchantRemark,
              "remarks": merchantRemark
            },
            allValues: row.map(function(cell) { return cell.toString(); })
          };
          
          productsList.push(product);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify(productsList))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput("Google Apps Script Web App is active and listening.");
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
