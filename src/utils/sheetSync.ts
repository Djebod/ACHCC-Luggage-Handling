import { db, doc, getDoc } from '../firebase';
import { LuggageItem, PublicDepositItem } from '../types';

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
        type: 'luggage',
        item: {
          id: item.id,
          date: item.date,
          time: item.time,
          qrCode: item.qrCode,
          receiveBy: item.receiveBy,
          typeHandling: item.typeHandling,
          namaTamu: item.namaTamu,
          photo: item.photo ? '[Image Data]' : '', // Avoid bloating Sheets with base64
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
    
    console.log('Sync payload sent successfully for luggage!');
  } catch (err) {
    console.error('Failed to sync luggage to Google Sheet:', err);
  }
}

export async function syncPublicDepositToGoogleSheet(action: 'insert' | 'update', item: PublicDepositItem) {
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

    console.log(`Syncing public deposit to Google Sheet (${action}):`, item.id);

    // Send the post request to Google AppScript
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        type: 'public_deposit',
        item: {
          id: item.id,
          date: item.date,
          time: item.time,
          jenisBarang: item.jenisBarang,
          photo: item.photo ? '[Image Data]' : '',
          namaPengirim: item.namaPengirim,
          noHpPengirim: item.noHpPengirim,
          namaPenerima: item.namaPenerima,
          keterangan: item.keterangan,
          status: item.status,
          handledBy: item.handledBy || '',
          dateDelivered: item.dateDelivered || '',
          timeDelivered: item.timeDelivered || '',
          namaPenerimaAmbil: item.namaPenerimaAmbil || '',
          catatanAmbil: item.catatanAmbil || '',
          photoAmbil: item.photoAmbil ? '[Image Data]' : ''
        }
      })
    });
    
    console.log('Sync payload sent successfully for public deposit!');
  } catch (err) {
    console.error('Failed to sync public deposit to Google Sheet:', err);
  }
}

// Google AppScript source code template for the user
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Google Apps Script for Aston Cirebon Official Luggage & Item Handling Apps
 * Deploy this as a Web App:
 * 1. Open Google Sheets.
 * 2. Extensions -> Apps Script.
 * 3. Delete any code in the editor and paste this script.
 * 4. Click Save.
 * 5. Click Deploy -> New Deployment.
 * 6. Select "Web App" type. Set:
 *    - "Execute as": "Me"
 *    - "Who has access": "Anyone"
 * 7. Click Deploy, Authorize access, and copy the Web App URL into the app's Google Sheet settings in the Admin page.
 */

function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var payload = JSON.parse(jsonString);
    var action = payload.action;
    var type = payload.type || "luggage";
    var item = payload.item;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = type === "public_deposit" ? "Penitipan_Publik" : "Penitipan_Staf";
    var sheet = ss.getSheetByName(sheetName);
    
    var headers;
    if (type === "public_deposit") {
      headers = [
        "ID", "DATE", "TIME", "JENIS BARANG", "PHOTO", "NAMA PENGIRIM", "NO HP PENGIRIM",
        "NAMA PENERIMA", "KETERANGAN", "STATUS", "HANDLED BY", "DATE DELIVERED", "TIME DELIVERED",
        "NAMA PENERIMA AMBIL", "CATATAN AMBIL", "FOTO AMBIL"
      ];
    } else {
      headers = [
        "ID", "DATE", "TIME", "QR CODE", "RECEIVE BY", "TYPE HANDLING", "NAMA TAMU", 
        "PHOTO", "REMARK", "HANDLE BY", "ROOM NUMBER", "DATE DELIVERED", "TIME DELIVERED", 
        "SOLVED TIME (DAY)", "SOLVED TIME (HOUR:MINUTES)", "STATUS"
      ];
    }
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f1f5f9");
      sheet.setFrozenRows(1);
    }
    
    var data = sheet.getDataRange().getValues();
    var colMap = {};
    for (var i = 0; i < data[0].length; i++) {
      colMap[data[0][i].toString().toUpperCase().trim()] = i;
    }
    
    // Ensure all headers exist in the sheet
    for (var h = 0; h < headers.length; h++) {
      var headerName = headers[h];
      if (colMap[headerName] === undefined) {
        sheet.getRange(1, data[0].length + 1).setValue(headerName);
        data[0].push(headerName);
        colMap[headerName] = data[0].length - 1;
      }
    }
    
    if (action === "insert") {
      var newRow = new Array(data[0].length).fill("");
      if (type === "public_deposit") {
        newRow[colMap["ID"]] = item.id;
        newRow[colMap["DATE"]] = item.date;
        newRow[colMap["TIME"]] = item.time;
        newRow[colMap["JENIS BARANG"]] = item.jenisBarang;
        newRow[colMap["PHOTO"]] = item.photo || "";
        newRow[colMap["NAMA PENGIRIM"]] = item.namaPengirim;
        newRow[colMap["NO HP PENGIRIM"]] = item.noHpPengirim;
        newRow[colMap["NAMA PENERIMA"]] = item.namaPenerima;
        newRow[colMap["KETERANGAN"]] = item.keterangan || "";
        newRow[colMap["STATUS"]] = item.status;
        newRow[colMap["HANDLED BY"]] = item.handledBy || "";
        newRow[colMap["DATE DELIVERED"]] = item.dateDelivered || "";
        newRow[colMap["TIME DELIVERED"]] = item.timeDelivered || "";
        newRow[colMap["NAMA PENERIMA AMBIL"]] = item.namaPenerimaAmbil || "";
        newRow[colMap["CATATAN AMBIL"]] = item.catatanAmbil || "";
        newRow[colMap["FOTO AMBIL"]] = item.photoAmbil || "";
      } else {
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
      }
      sheet.appendRow(newRow);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Inserted into " + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === "update") {
      var idColIndex = colMap["ID"];
      var foundRowIndex = -1;
      
      for (var r = 1; r < data.length; r++) {
        if (data[r][idColIndex].toString() === item.id.toString()) {
          foundRowIndex = r + 1; // 1-indexed row index
          break;
        }
      }
      
      if (foundRowIndex !== -1) {
        if (type === "public_deposit") {
          sheet.getRange(foundRowIndex, colMap["STATUS"] + 1).setValue(item.status);
          sheet.getRange(foundRowIndex, colMap["HANDLED BY"] + 1).setValue(item.handledBy || "");
          sheet.getRange(foundRowIndex, colMap["DATE DELIVERED"] + 1).setValue(item.dateDelivered || "");
          sheet.getRange(foundRowIndex, colMap["TIME DELIVERED"] + 1).setValue(item.timeDelivered || "");
          sheet.getRange(foundRowIndex, colMap["NAMA PENERIMA AMBIL"] + 1).setValue(item.namaPenerimaAmbil || "");
          sheet.getRange(foundRowIndex, colMap["CATATAN AMBIL"] + 1).setValue(item.catatanAmbil || "");
          sheet.getRange(foundRowIndex, colMap["FOTO AMBIL"] + 1).setValue(item.photoAmbil || "");
        } else {
          sheet.getRange(foundRowIndex, colMap["HANDLE BY"] + 1).setValue(item.handleBy || "");
          sheet.getRange(foundRowIndex, colMap["DATE DELIVERED"] + 1).setValue(item.dateDelivered || "");
          sheet.getRange(foundRowIndex, colMap["TIME DELIVERED"] + 1).setValue(item.timeDelivered || "");
          sheet.getRange(foundRowIndex, colMap["SOLVED TIME (DAY)"] + 1).setValue(item.solvedTimeDay);
          sheet.getRange(foundRowIndex, colMap["SOLVED TIME (HOUR:MINUTES)"] + 1).setValue(item.solvedTimeHourMinutes || "");
          sheet.getRange(foundRowIndex, colMap["STATUS"] + 1).setValue(item.status);
        }
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Updated in " + sheetName }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        // Fallback: insert if not found
        var newRow = new Array(data[0].length).fill("");
        if (type === "public_deposit") {
          newRow[colMap["ID"]] = item.id;
          newRow[colMap["DATE"]] = item.date;
          newRow[colMap["TIME"]] = item.time;
          newRow[colMap["JENIS BARANG"]] = item.jenisBarang;
          newRow[colMap["PHOTO"]] = item.photo || "";
          newRow[colMap["NAMA PENGIRIM"]] = item.namaPengirim;
          newRow[colMap["NO HP PENGIRIM"]] = item.noHpPengirim;
          newRow[colMap["NAMA PENERIMA"]] = item.namaPenerima;
          newRow[colMap["KETERANGAN"]] = item.keterangan || "";
          newRow[colMap["STATUS"]] = item.status;
          newRow[colMap["HANDLED BY"]] = item.handledBy || "";
          newRow[colMap["DATE DELIVERED"]] = item.dateDelivered || "";
          newRow[colMap["TIME DELIVERED"]] = item.timeDelivered || "";
          newRow[colMap["NAMA PENERIMA AMBIL"]] = item.namaPenerimaAmbil || "";
          newRow[colMap["CATATAN AMBIL"]] = item.catatanAmbil || "";
          newRow[colMap["FOTO AMBIL"]] = item.photoAmbil || "";
        } else {
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
        }
        sheet.appendRow(newRow);
        return ContentService.createTextOutput(JSON.stringify({ success: true, message: "ID not found, inserted to " + sheetName }))
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
