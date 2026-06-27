export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'staff';
  approved?: boolean;
  createdAt: string;
}

export interface LuggageItem {
  id: string; // E.g., ASTON-20260625-XXXX
  date: string; // DATE (YYYY-MM-DD)
  time: string; // TIME (HH:MM)
  qrCode: string; // QR CODE content
  receiveBy: string; // RECEIVE BY (Staff Name)
  typeHandling: 'Koper' | 'Kardus' | 'Tas Ransel' | 'Lain Lain'; // TYPE HANDLING
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

export interface PublicDepositItem {
  id: string; // E.g., PUB-YYYYMMDD-XXXX
  date: string; // Tanggal
  time: string; // Jam
  jenisBarang: 'Makanan' | 'Minuman' | 'Barang'; // Jenis barang
  photo: string; // Base64 Data URL
  namaPengirim: string; // Nama pengirim
  noHpPengirim: string; // Nomor Hp pengirim
  namaPenerima: string; // Nama Penerima
  keterangan: string; // Keterangan
  status: 'Menunggu' | 'Sudah Diambil'; // Status
  createdAt: string; // Internal Timestamp
  qrCode: string; // QR code
  handledBy?: string; // staff who returned it
  dateDelivered?: string;
  timeDelivered?: string;
  namaPenerimaAmbil?: string; // actual receiver/picker name
  catatanAmbil?: string; // delivery notes
  photoAmbil?: string; // optional delivery photo
}

