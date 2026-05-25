/**
 * Google Apps Script Web App Template for the Trade Log App.
 * Copy and paste this code into your Google Apps Script editor (found under Extensions > Apps Script in your Spreadsheet),
 * then click "Deploy" > "New deployment" as a "Web app" (Execute as: Me, Who has access: Anyone) to get your new URL.
 */

function doPost(e) {
  try {
    var param = JSON.parse(e.postData.contents);
    var action = param.action;
    
    // 1. Action: addProduct
    if (action === 'addProduct') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('raw');
      if (!sheet) {
        // Fallback in case raw sheet is not named 'raw'
        sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      }
      
      var name = param.name;
      var username = param.username;
      var id = param.id;
      
      // Target Columns format for raw sheet:
      // Col C : Product Name, Col A/B : Metadata or user
      // Append row to 'raw' sheet:
      sheet.appendRow([new Date(), username, name, id]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Product added to raw tab' }))
        .setMimeType(ContentService.MimeType.JSON);
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
    
    // 3. Action: writeTradeLog (Supports INSERT and UPDATE)
    if (action === 'writeTradeLog') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Trade_Log');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Trade_Log sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var rows = param.rows; // Array of arrays representing the rows
      if (!rows || rows.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'No rows sent' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Ensure the sheet has enough columns to hold our 13-column wide schema
      var maxCols = sheet.getMaxColumns();
      var neededCols = Math.max(13, rows[0].length);
      if (maxCols < neededCols) {
        sheet.insertColumnsAfter(maxCols, neededCols - maxCols);
      }
      
      // Gather all unique Order IDs from Column M of the incoming rows (Index 12)
      var incomingIds = {};
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row.length >= 13) {
          var orderId = row[12]; // Col M is index 12 (0-indexed)
          if (orderId) {
            incomingIds[orderId] = true;
          }
        }
      }
      
      // Delete existing rows with these matching order IDs in Column M (13th column)
      var uniqueIdsToDelete = Object.keys(incomingIds);
      if (uniqueIdsToDelete.length > 0) {
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          // Fetch Col M (Column 13) values (from row 2 to lastRow)
          var colMValues = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
          
          // Iterate backward to avoid row index shifting during deletion
          for (var r = lastRow; r >= 2; r--) {
            var cellValue = colMValues[r - 2][0];
            if (cellValue && incomingIds[cellValue.toString().trim()]) {
              sheet.deleteRow(r);
            }
          }
        }
      }
      
      // Append the new rows to the Trade_Log sheet
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Trade log written/edited successfully' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3.5 Action: deleteOrder (Delete matching rows by Order ID in Column M)
    if (action === 'deleteOrder') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Trade_Log');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Trade_Log sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var orderId = param.orderId;
      if (!orderId) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No orderId provided' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      // Ensure the sheet has enough columns to hold our 13-column wide schema
      var maxCols = sheet.getMaxColumns();
      if (maxCols < 13) {
        sheet.insertColumnsAfter(maxCols, 13 - maxCols);
      }
      
      var lastRow = sheet.getLastRow();
      var deletedCount = 0;
      if (lastRow > 1) {
        // Fetch Col M (Column 13) values (from row 2 onwards)
        var colMValues = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
        
        // Iterate backward to avoid row index shifting during deletion
        for (var r = lastRow; r >= 2; r--) {
          var cellValue = colMValues[r - 2][0];
          if (cellValue && cellValue.toString().trim() === orderId.toString().trim()) {
            sheet.deleteRow(r);
            deletedCount++;
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Deleted ' + deletedCount + ' rows for order ID ' + orderId }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 4. Action: updateGrades or Fallback to update grades (when body is raw dictionary of { name: grade })
    if (action === 'updateGrades' || (!action && Object.keys(param).length > 0)) {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('customer_cat') ||
                  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('顧客級數');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'customer_cat or 顧客級數 sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var gradesToUpdate = action === 'updateGrades' ? param.grades : param;
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        // Fetch Col A (Customer Name) values (from row 2 onwards)
        var nameValues = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        var gradeRange = sheet.getRange(2, 3, lastRow - 1, 1);
        var gradeValues = gradeRange.getValues();
        
        var updatedCount = 0;
        for (var idx = 0; idx < nameValues.length; idx++) {
          var nameCell = nameValues[idx][0];
          if (nameCell) {
            var trimmedName = nameCell.toString().trim();
            if (gradesToUpdate[trimmedName] !== undefined) {
              gradeValues[idx][0] = gradesToUpdate[trimmedName];
              updatedCount++;
            }
          }
        }
        
        if (updatedCount > 0) {
          gradeRange.setValues(gradeValues);
        }
        
        return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Updated ' + updatedCount + ' customer grades successfully' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'No rows to update' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    
    // 1. Action: getCustomers
    if (action === 'getCustomers') {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('customer_cat') ||
                  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('顧客級數');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'customer_cat or 顧客級數 sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return ContentService.createTextOutput(JSON.stringify([]))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
      var customers = [];
      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        if (row[0]) {
          customers.push({
            name: row[0].toString().trim(),
            sales: (row[1] || '').toString().trim(),
            grade: (row[2] || 'C').toString().trim(),
            district: (row[3] || '').toString().trim()
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify(customers))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. Action: getProducts (100% live uncached product fetch)
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
      
      // Attempt to locate title row and other index headers dynamically
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
            var cellStr = (row[j] || '').toString().toLowerCase();
            if (cellStr.indexOf('gold') !== -1) goldIdx = j;
            else if (cellStr.indexOf('silver') !== -1) silverIdx = j;
            else if (cellStr.indexOf('basic') !== -1) basicIdx = j;
            else if (cellStr === 'price') priceIdx = j;
            else if (cellStr === 'discounted price') discountedPriceIdx = j;
          }
          break;
        }
      }
      
      var parseNum = function(val) {
        if (val === undefined || val === null || val === '') return 0;
        if (typeof val === 'number') return val;
        var cleaned = val.toString().replace(/[$,\s]/g, '');
        var parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };
      
      var productsMap = {};
      var productsList = [];
      
      for (var rowIdx = headerRowIdx + 1; rowIdx < values.length; rowIdx++) {
        var row = values[rowIdx];
        var productName = row[titleIdx];
        if (productName && productName.toString().trim()) {
          var trimmed = productName.toString().trim();
          if (trimmed.toLowerCase() === 'title') continue;
          if (trimmed.length > 1) {
            
            var getPrice = function(colIdx) {
              var val = row[colIdx];
              if (val !== undefined && val !== null && val.toString().trim() !== '') return parseNum(val);
              var discounted = row[discountedPriceIdx];
              if (discounted !== undefined && discounted !== null && discounted.toString().trim() !== '') return parseNum(discounted);
              return parseNum(row[priceIdx]);
            };
            
            if (!productsMap[trimmed]) {
              productsMap[trimmed] = true;
              productsList.push({
                name: trimmed,
                prices: {
                  A: getPrice(goldIdx),
                  B: getPrice(silverIdx),
                  C: getPrice(basicIdx)
                }
              });
            }
          }
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify(productsList))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput("Google Apps Script Web App is active and listening.");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
