import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { db, doc, getDoc, updateDoc } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { LuggageItem } from '../types';
import { syncToGoogleSheet } from '../utils/sheetSync';
import { 
  QrCode, 
  Search, 
  MapPin, 
  User, 
  Calendar, 
  Clock, 
  CheckCircle, 
  ArrowLeftRight, 
  Camera, 
  AlertCircle,
  Loader2,
  Lock
} from 'lucide-react';

interface LuggageScannerProps {
  currentUser: { uid: string; email: string; name: string; role: 'admin' | 'staff' };
  onStatusUpdated: () => void;
}

export default function LuggageScanner({ currentUser, onStatusUpdated }: LuggageScannerProps) {
  const [manualId, setManualId] = useState('');
  const [scannedItem, setScannedItem] = useState<LuggageItem | null>(null);
  const [searchResults, setSearchResults] = useState<LuggageItem[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingDelivery, setIsProcessingDelivery] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Stop scanning on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = () => {
    setSearchError(null);
    setSuccessMessage(null);
    setScannedItem(null);
    setIsScanning(true);

    // Wait for the container element to render in DOM
    setTimeout(() => {
      try {
        const scanner = new Html5Qrcode('qr-scanner-view');
        scannerRef.current = scanner;

        scanner.start(
          { facingMode: 'environment' },
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 }
          },
          async (decodedText) => {
            console.log('Scanned QR code:', decodedText);
            // Vibrate device if supported
            if (navigator.vibrate) navigator.vibrate(100);
            
            // Stop scanning and lookup ID
            try {
              await scanner.stop();
            } catch (err) {
              console.error('Error stopping scanner on success:', err);
            }
            scannerRef.current = null;
            setIsScanning(false);
            await lookupLuggageItem(decodedText.trim());
          },
          (errorMessage) => {
            // Silence common scanning noise errors
          }
        ).catch((err) => {
          console.error('Failed to start html5-qrcode camera:', err);
          setSearchError('Gagal menyalakan kamera. Pastikan Anda memberikan izin akses kamera pada browser Anda.');
          setIsScanning(false);
          scannerRef.current = null;
        });
      } catch (err) {
        console.error('Failed to initialize html5-qrcode:', err);
        setSearchError('Gagal menyalakan scanner. Periksa izin kamera browser Anda.');
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const lookupLuggageItem = async (queryStr: string) => {
    setSearchError(null);
    setSuccessMessage(null);
    setScannedItem(null);
    setSearchResults([]);

    if (!queryStr) {
      setSearchError('Masukkan ID penitipan barang atau nama tamu.');
      return;
    }

    setIsLoadingSearch(true);
    const trimmedQuery = queryStr.trim();

    try {
      // 1. Cek kecocokan ID secara langsung di Firestore terlebih dahulu
      const docRef = doc(db, 'luggage', trimmedQuery);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setScannedItem(docSnap.data() as LuggageItem);
        setIsLoadingSearch(false);
        return;
      }

      // 2. Jika tidak ditemukan kecocokan ID persis, lakukan pencarian berdasarkan Nama Tamu, ID, atau No Kamar (case-insensitive)
      const querySnapshot = await getDocs(collection(db, 'luggage'));
      const allItems: LuggageItem[] = [];
      querySnapshot.forEach((docSnap) => {
        allItems.push(docSnap.data() as LuggageItem);
      });

      const searchLower = trimmedQuery.toLowerCase();
      const matches = allItems.filter(item => 
        (item.id && item.id.toLowerCase().includes(searchLower)) ||
        (item.namaTamu && item.namaTamu.toLowerCase().includes(searchLower)) ||
        (item.roomNumber && item.roomNumber.toLowerCase().includes(searchLower))
      );

      if (matches.length === 1) {
        setScannedItem(matches[0]);
      } else if (matches.length > 1) {
        setSearchResults(matches);
      } else {
        setSearchError(`Data barang dengan kata kunci "${trimmedQuery}" tidak ditemukan.`);
      }
    } catch (err: any) {
      console.error('Error looking up luggage:', err);
      setSearchError(`Gagal mencari data: ${err.message}`);
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    lookupLuggageItem(manualId.trim());
  };

  const handleDeliverLuggage = async () => {
    if (!scannedItem) return;

    setIsProcessingDelivery(true);
    setSearchError(null);

    const now = new Date();
    const localDate = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const localTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

    try {
      // Calculate Solve Times
      // Form deposit time
      const depositDateTimeStr = `${scannedItem.date}T${scannedItem.time}`;
      const depositDate = new Date(depositDateTimeStr);
      
      let solvedDays = 0;
      let solvedHoursMinsStr = '00:00';

      if (!isNaN(depositDate.getTime())) {
        const diffMs = now.getTime() - depositDate.getTime();
        
        // Days difference
        solvedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        // Hours and Minutes remaining
        const remainingMs = diffMs % (1000 * 60 * 60 * 24);
        const diffHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const diffMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        
        solvedHoursMinsStr = `${String(diffHours).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}`;
      }

      // Prepare update payload
      const updateData: Partial<LuggageItem> = {
        status: 'Sudah Diambil',
        handleBy: currentUser.name,
        dateDelivered: localDate,
        timeDelivered: localTime,
        solvedTimeDay: solvedDays,
        solvedTimeHourMinutes: solvedHoursMinsStr
      };

      const updatedItem: LuggageItem = {
        ...scannedItem,
        ...updateData
      };

      // 1. Update in Firestore
      await updateDoc(doc(db, 'luggage', scannedItem.id), updateData);

      // 2. Sync to Google Sheets (background fetch)
      await syncToGoogleSheet('update', updatedItem);

      setSuccessMessage(`Sukses! Barang "${scannedItem.namaTamu}" telah diserahkan dan dikeluarkan dari gudang.`);
      setScannedItem(updatedItem);
      onStatusUpdated();
    } catch (err: any) {
      console.error('Error processing delivery:', err);
      setSearchError(`Gagal memproses pengembalian barang: ${err.message}`);
    } finally {
      setIsProcessingDelivery(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-serif font-bold text-[#002B5B] flex items-center gap-2">
          <QrCode className="w-5 h-5 text-amber-500" />
          Pengembalian & Scan QR Code
        </h2>
        <p className="text-xs text-slate-500">
          Scan QR Code dari receipt penitipan barang untuk memproses checkout koper milik tamu
        </p>
      </div>

      {searchError && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 leading-relaxed font-medium">{searchError}</div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-800">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-xs">Penyerahan Berhasil!</div>
            <div className="text-xs mt-0.5">{successMessage}</div>
          </div>
        </div>
      )}

      {/* Main Interactive Scanning Area */}
      {!isScanning && !scannedItem && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={startScanner}
            className="p-8 border-2 border-dashed border-slate-200 hover:border-amber-400 hover:bg-slate-50/50 rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center text-center space-y-3 focus:outline-none group"
          >
            <div className="w-14 h-14 bg-[#002B5B] group-hover:bg-amber-400 text-white rounded-2xl flex items-center justify-center shadow transition-all duration-300">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-700">Scan QR Code Receipt</div>
              <div className="text-xs text-slate-400 mt-1">Gunakan kamera untuk memindai otomatis</div>
            </div>
          </button>

          <form onSubmit={handleManualSearch} className="p-8 border border-slate-200 bg-slate-50/50 rounded-2xl flex flex-col justify-center space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cari Secara Manual</h3>
              <p className="text-[10px] text-slate-400">Masukkan ID penitipan atau nama tamu apabila kamera bermasalah</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="E.g. ASTON-XXXX atau Nama Tamu"
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-medium text-slate-800"
              />
              <button
                type="submit"
                disabled={isLoadingSearch}
                className="px-4 py-2 bg-[#002B5B] hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow cursor-pointer disabled:opacity-50"
              >
                {isLoadingSearch ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Cari
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Multiple Search Results list */}
      {searchResults.length > 0 && !scannedItem && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <div>
              <h3 className="text-xs font-bold text-[#002B5B] uppercase tracking-wider">Hasil Pencarian ({searchResults.length})</h3>
              <p className="text-[10px] text-slate-500">Ditemukan beberapa data yang cocok. Pilih salah satu di bawah:</p>
            </div>
            <button 
              onClick={() => setSearchResults([])}
              className="text-[10px] text-[#002B5B] hover:text-amber-500 font-bold"
            >
              Reset
            </button>
          </div>
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {searchResults.map((item) => (
              <div 
                key={item.id}
                className="p-3 bg-white border border-slate-200/80 rounded-xl hover:border-amber-400 hover:shadow-sm transition-all flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-slate-800">{item.id}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      item.status === 'Gudang' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {item.namaTamu} (Rm {item.roomNumber || '-'})
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {item.date} {item.time} &bull; {item.typeHandling}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setScannedItem(item);
                    setSearchResults([]);
                  }}
                  className="px-3 py-1.5 bg-[#002B5B] hover:bg-amber-400 hover:text-slate-900 text-white rounded-lg text-xs font-bold transition-all"
                >
                  Pilih
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scanning Viewfinder */}
      {isScanning && (
        <div className="space-y-4">
          <div className="relative max-w-md mx-auto aspect-square bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner">
            <div id="qr-scanner-view" className="w-full h-full object-cover" />
            {/* Overlay target frames */}
            <div className="absolute inset-0 border-4 border-transparent pointer-events-none flex items-center justify-center">
              <div className="w-[250px] h-[250px] border-4 border-amber-400/80 rounded-2xl animate-pulse"></div>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={stopScanner}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Batal & Kembali
            </button>
          </div>
        </div>
      )}

      {/* Scanned/Searched Item Display & Actions */}
      {scannedItem && (
        <div className="border border-slate-200/80 bg-slate-50/50 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">LUGGAGE BAGGAGE INFO</div>
              <h3 className="text-base font-mono font-bold text-slate-800">{scannedItem.id}</h3>
            </div>
            <div>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                scannedItem.status === 'Gudang'
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {scannedItem.status === 'Gudang' ? <Lock className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {scannedItem.status === 'Gudang' ? 'DI GUDANG' : 'SUDAH DIAMBIL'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left: Metadata Details */}
            <div className="space-y-4">
              <div className="space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#002B5B]/5 text-[#002B5B] rounded-xl shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Nama Tamu</div>
                    <div className="text-xs font-bold text-slate-800">{scannedItem.namaTamu}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#002B5B]/5 text-[#002B5B] rounded-xl shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Nomor Kamar</div>
                    <div className="text-xs font-bold text-slate-800">Kamar {scannedItem.roomNumber}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#002B5B]/5 text-[#002B5B] rounded-xl shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Tanggal & Waktu Masuk</div>
                    <div className="text-xs font-semibold text-slate-700">{scannedItem.date} | {scannedItem.time}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-xl shrink-0 border border-amber-200/40">
                    <ArrowLeftRight className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Type Handling</div>
                    <div className="text-xs font-semibold text-slate-700">{scannedItem.typeHandling}</div>
                  </div>
                </div>

                {scannedItem.remark && (
                  <div className="p-3 bg-white border border-slate-100 rounded-xl text-xs text-slate-500 italic">
                    <strong className="text-slate-700 font-bold not-italic block mb-0.5 text-[9px] uppercase tracking-wider">Remark/Catatan:</strong>
                    &quot;{scannedItem.remark}&quot;
                  </div>
                )}
              </div>
            </div>

            {/* Right: Picture & Checkout details */}
            <div className="flex flex-col justify-between space-y-4">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Foto Barang</div>
                {scannedItem.photo ? (
                  <img
                    src={scannedItem.photo}
                    alt="Luggage snapshot"
                    referrerPolicy="no-referrer"
                    className="w-full h-[150px] object-cover rounded-xl border border-slate-200"
                  />
                ) : (
                  <div className="w-full h-[150px] bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 text-xs italic">
                    Tidak ada foto terlampir
                  </div>
                )}
              </div>

              {scannedItem.status === 'Sudah Diambil' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2 text-xs">
                  <div className="font-bold text-emerald-800">Detail Pengambilan:</div>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Diterima Kembali Oleh</span>
                      <strong>{scannedItem.handleBy || '-'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Waktu Pengambilan</span>
                      <strong>{scannedItem.dateDelivered} {scannedItem.timeDelivered}</strong>
                    </div>
                    <div className="col-span-2 pt-1.5 border-t border-emerald-200/50">
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Lama Penitipan</span>
                      <strong>{scannedItem.solvedTimeDay} Hari, {scannedItem.solvedTimeHourMinutes} Jam:Menit</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action trigger button */}
          <div className="border-t border-slate-200/60 pt-5 flex items-center justify-between gap-4">
            <button
              onClick={() => {
                setScannedItem(null);
                setSuccessMessage(null);
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cari Lainnya
            </button>

            {scannedItem.status === 'Gudang' && (
              <button
                onClick={handleDeliverLuggage}
                disabled={isProcessingDelivery}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isProcessingDelivery ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Memproses Pengembalian...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Serahkan Barang ke Tamu
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
