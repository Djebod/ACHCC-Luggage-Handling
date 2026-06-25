export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  createdAt: string;
}

export interface LuggageItem {
  id: string; // E.g., ASTON-20260625-XXXX
  date: string; // DATE (YYYY-MM-DD)
  time: string; // TIME (HH:MM)
  qrCode: string; // QR CODE content
  receiveBy: string; // RECEIVE BY (Staff Name)
  typeHandling: 'Standard' | 'Fragile' | 'Heavy' | 'High Value'; // TYPE HANDLING
  namaTamu: string; // NAMA TAMU
  photo: string; // PHOTO (Base64 Data URL)
  remark: string; // REMARK
  handleBy: string; // HANDLE BY (Staff Name / Email when returned)
  roomNumber: string; // ROOM NUMBER
  dateDelivered: string; // Date Delivered (YYYY-MM-DD or empty)
  timeDelivered: string; // TIME DELIVERED (HH:MM or empty)
  solvedTimeDay: number | null; // Solved Time (day)
  solvedTimeHourMinutes: string | null; // Solved Time (hour:minutes)
  status: 'Gudang' | 'Sudah Diambil'; // STATUS
  createdAt: string; // Internal Timestamp
}

export interface SyncSettings {
  googleSheetUrl: string;
}
