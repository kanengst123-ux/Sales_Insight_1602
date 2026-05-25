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
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('顧客級數');
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: '顧客級數 sheet not found' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
      var name = param.name;
      var user = param.user;
      var district = param.district;
      var grade = param.grade;
      
      sheet.appendRow([name, user, grade, district]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Customer added' }))
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
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unknown action: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Google Apps Script Web App is active and listening for POST requests.");
}
