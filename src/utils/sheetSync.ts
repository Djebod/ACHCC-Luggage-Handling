import { db, doc, getDoc } from '../firebase';
import { LuggageItem } from '../types';

export async function syncToGoogleSheet(action: 'insert' | 'update', item: LuggageItem) {
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'sync'));
    if (!settingsDoc.exists()) {
      console.log('Google Sheet Sync URL not configured.');
      return;
    }

    const url = settingsDoc.data().googleSheetUrl;
    if (!url || !url.trim().startsWith('http')) {
      console.log('Invalid Google Sheet Sync URL.');
      return;
    }

    console.log(`Syncing luggage to Google Sheet (${action}):`, item.id);

    // Send the post request to Google AppScript
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Avoids CORS issues with Google App Script Web Apps
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        item: {
          id: item.id,
          date: item.date,
          time: item.time,
          qrCode: item.qrCode,
          receiveBy: item.receiveBy,
          typeHandling: item.typeHandling,
          namaTamu: item.namaTamu,
          photo: item.photo ? '[Image Data]' : '', // Avoid bloating Sheets with base64, or send it if needed
          remark: item.remark,
          handleBy: item.handleBy,
          roomNumber: item.roomNumber,
          dateDelivered: item.dateDelivered,
          timeDelivered: item.timeDelivered,
          solvedTimeDay: item.solvedTimeDay ?? '',
          solvedTimeHourMinutes: item.solvedTimeHourMinutes ?? '',
          status: item.status
        }
      })
    });
    
    console.log('Sync payload sent successfully!');
  } catch (err) {
    console.error('Failed to sync to Google Sheet:', err);
  }
}

// Google AppScript source code template for the user
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script for ASTON Cirebon Luggage Management
 * Deploy this as a Web App:
 * 1. Open Google Sheets.
 * 2. Create a sheet. Ensure the headers in row 1 are:
 *    ID | DATE | TIME | QR CODE | RECEIVE BY | TYPE HANDLING | NAMA TAMU | PHOTO | REMARK | HANDLE BY | ROOM NUMBER | Date Delivered | TIME DELIVERED | Solved Time (day) | Solved Time (hour:minutes) | STATUS
 * 3. Extensions -> Apps Script.
 * 4. Paste this code.
 * 5. Click Deploy -> New Deployment.
 * 6. Select "Web App". Set "Execute as: Me" and "Who has access: Anyone".
 * 7. Deploy, Authorize access, and copy the Web App URL into the app's Google Sheet settings.
 */

function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var payload = JSON.parse(jsonString);
    var action = payload.action;
    var item = payload.item;
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = sheet.getDataRange().getValues();
    
    // Find column indices based on header names (case-insensitive)
    var headers = data[0];
    var colMap = {};
    for (var i = 0; i < headers.length; i++) {
      colMap[headers[i].toString().toUpperCase().trim()] = i;
    }
    
    // Fallback/Default map if headers aren't match
    var defaultHeaders = [
      "ID", "DATE", "TIME", "QR CODE", "RECEIVE BY", "TYPE HANDLING", "NAMA TAMU", 
      "PHOTO", "REMARK", "HANDLE BY", "ROOM NUMBER", "DATE DELIVERED", "TIME DELIVERED", 
      "SOLVED TIME (DAY)", "SOLVED TIME (HOUR:MINUTES)", "STATUS"
    ];
    
    for (var h = 0; h < defaultHeaders.length; h++) {
      var headerName = defaultHeaders[h];
      if (colMap[headerName] === undefined) {
        // If header not found, append to end
        sheet.getRange(1, headers.length + 1).setValue(headerName);
        headers.push(headerName);
        colMap[headerName] = headers.length - 1;
      }
    }
    
    if (action === "insert") {
      // Append a new row
      var newRow = new Array(headers.length).fill("");
      newRow[colMap["ID"]] = item.id;
      newRow[colMap["DATE"]] = item.date;
      newRow[colMap["TIME"]] = item.time;
      newRow[colMap["QR CODE"]] = item.qrCode;
      newRow[colMap["RECEIVE BY"]] = item.receiveBy;
      newRow[colMap["TYPE HANDLING"]] = item.typeHandling;
      newRow[colMap["NAMA TAMU"]] = item.namaTamu;
      newRow[colMap["PHOTO"]] = item.photo || "";
      newRow[colMap["REMARK"]] = item.remark;
      newRow[colMap["HANDLE BY"]] = item.handleBy || "";
      newRow[colMap["ROOM NUMBER"]] = item.roomNumber;
      newRow[colMap["DATE DELIVERED"]] = item.dateDelivered || "";
      newRow[colMap["TIME DELIVERED"]] = item.timeDelivered || "";
      newRow[colMap["SOLVED TIME (DAY)"]] = item.solvedTimeDay !== undefined ? item.solvedTimeDay : "";
      newRow[colMap["SOLVED TIME (HOUR:MINUTES)"]] = item.solvedTimeHourMinutes || "";
      newRow[colMap["STATUS"]] = item.status;
      
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Inserted" }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === "update") {
      // Find row with matching ID
      var idColIndex = colMap["ID"];
      var foundRowIndex = -1;
      
      for (var r = 1; r < data.length; r++) {
        if (data[r][idColIndex].toString() === item.id.toString()) {
          foundRowIndex = r + 1; // 1-indexed
          break;
        }
      }
      
      if (foundRowIndex !== -1) {
        // Update cells
        sheet.getRange(foundRowIndex, colMap["HANDLE BY"] + 1).setValue(item.handleBy);
        sheet.getRange(foundRowIndex, colMap["DATE DELIVERED"] + 1).setValue(item.dateDelivered);
        sheet.getRange(foundRowIndex, colMap["TIME DELIVERED"] + 1).setValue(item.timeDelivered);
        sheet.getRange(foundRowIndex, colMap["SOLVED TIME (DAY)"] + 1).setValue(item.solvedTimeDay);
        sheet.getRange(foundRowIndex, colMap["SOLVED TIME (HOUR:MINUTES)"] + 1).setValue(item.solvedTimeHourMinutes);
        sheet.getRange(foundRowIndex, colMap["STATUS"] + 1).setValue(item.status);
        
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Updated" }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        // If not found, insert as fallback
        var newRow = new Array(headers.length).fill("");
        newRow[colMap["ID"]] = item.id;
        newRow[colMap["DATE"]] = item.date;
        newRow[colMap["TIME"]] = item.time;
        newRow[colMap["QR CODE"]] = item.qrCode;
        newRow[colMap["RECEIVE BY"]] = item.receiveBy;
        newRow[colMap["TYPE HANDLING"]] = item.typeHandling;
        newRow[colMap["NAMA TAMU"]] = item.namaTamu;
        newRow[colMap["PHOTO"]] = item.photo || "";
        newRow[colMap["REMARK"]] = item.remark;
        newRow[colMap["HANDLE BY"]] = item.handleBy || "";
        newRow[colMap["ROOM NUMBER"]] = item.roomNumber;
        newRow[colMap["DATE DELIVERED"]] = item.dateDelivered || "";
        newRow[colMap["TIME DELIVERED"]] = item.timeDelivered || "";
        newRow[colMap["SOLVED TIME (DAY)"]] = item.solvedTimeDay !== undefined ? item.solvedTimeDay : "";
        newRow[colMap["SOLVED TIME (HOUR:MINUTES)"]] = item.solvedTimeHourMinutes || "";
        newRow[colMap["STATUS"]] = item.status;
        
        sheet.appendRow(newRow);
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Not found ID, appended instead" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`;
