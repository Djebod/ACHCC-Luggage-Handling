import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { db, collection, doc, setDoc } from '../firebase';
import { LuggageItem } from '../types';
import { syncToGoogleSheet } from '../utils/sheetSync';
import { 
  Camera, 
  Upload, 
  Printer, 
  Save, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';

interface LuggageInputProps {
  currentUser: { uid: string; email: string; name: string; role: 'admin' | 'staff' };
  onSuccess: (newItem: LuggageItem) => void;
  onPrintRequest: (item: LuggageItem) => void;
}

export default function LuggageInput({ currentUser, onSuccess, onPrintRequest }: LuggageInputProps) {
  const [namaTamu, setNamaTamu] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [typeHandling, setTypeHandling] = useState<'Koper' | 'Kardus' | 'Tas Ransel' | 'Lain Lain'>('Koper');
  const [remark, setRemark] = useState('');
  
  // Photo states
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Submit states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savedItem, setSavedItem] = useState<LuggageItem | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const generateLuggageId = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    // 4 random uppercase alphanumeric characters
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ASTON-${dateStr}-${rand}`;
  };

  // Start video stream
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Default to back camera on phones
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Gagal mengakses kamera. Pastikan Anda memberikan izin kamera.');
      setIsCameraActive(false);
    }
  };

  // Stop video stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture image frame from video
  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      // Downscale slightly to save Firestore database document size
      const maxDim = 480;
      let width = video.videoWidth;
      let height = video.videoHeight;
      
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // Compress at 70% quality
        setPhotoBase64(dataUrl);
        stopCamera();
      }
    }
  };

  // Handle standard file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran foto terlalu besar. Maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoBase64(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetForm = () => {
    setNamaTamu('');
    setRoomNumber('');
    setTypeHandling('Standard');
    setRemark('');
    setPhotoBase64('');
    setSavedItem(null);
    setSuccess(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaTamu || !roomNumber) {
      setError('Nama Tamu dan Nomor Kamar wajib diisi.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    const luggageId = generateLuggageId();
    const now = new Date();
    
    const localDate = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const localTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

    try {
      // 1. Generate QR Code image data url
      const qrDataUrl = await QRCode.toDataURL(luggageId, { scale: 5, margin: 1 });

      const newLuggage: LuggageItem = {
        id: luggageId,
        date: localDate,
        time: localTime,
        qrCode: qrDataUrl, // Store generated QR base64 code or raw ID
        receiveBy: currentUser.name,
        typeHandling,
        namaTamu: namaTamu.trim(),
        photo: photoBase64,
        remark: remark.trim(),
        handleBy: '',
        roomNumber: roomNumber.trim(),
        dateDelivered: '',
        timeDelivered: '',
        solvedTimeDay: null,
        solvedTimeHourMinutes: null,
        status: 'Gudang',
        createdAt: now.toISOString()
      };

      // 2. Save in Firestore
      await setDoc(doc(db, 'luggage', luggageId), newLuggage);

      // 3. Sync with Google Sheets (background fetch)
      await syncToGoogleSheet('insert', newLuggage);

      setSavedItem(newLuggage);
      setSuccess(`Registrasi barang berhasil! ID: ${luggageId}`);
      onSuccess(newLuggage);
    } catch (err: any) {
      console.error('Error depositing luggage:', err);
      setError(`Gagal menyimpan data penitipan: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#002B5B]">
            Input Penitipan Barang Baru
          </h2>
          <p className="text-xs text-slate-500">
            Daftarkan koper / tas tamu ASTON Cirebon ke sistem pergudangan
          </p>
        </div>
        {savedItem && (
          <button
            onClick={handleResetForm}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#002B5B] font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Input Baru Lagi
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {success && savedItem && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4">
          <div className="flex items-start gap-3 text-emerald-800">
            <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-sm">Registrasi Berhasil!</div>
              <div className="text-xs mt-0.5 leading-relaxed">
                Penitipan barang atas nama <strong className="font-semibold text-emerald-950">{savedItem.namaTamu}</strong> (Kamar {savedItem.roomNumber}) telah tersimpan dan disinkronkan.
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => onPrintRequest(savedItem)}
              className="flex-1 py-2.5 bg-[#002B5B] hover:bg-[#114488] text-white font-semibold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2 shadow"
            >
              <Printer className="w-4 h-4" />
              Cetak Receipt Bukti
            </button>
            <button
              onClick={handleResetForm}
              className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-center"
            >
              Kembali ke Form
            </button>
          </div>
        </div>
      )}

      {!savedItem && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Guest Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Nama Tamu (Guest Name) *
                </label>
                <input
                  type="text"
                  value={namaTamu}
                  onChange={(e) => setNamaTamu(e.target.value)}
                  placeholder="E.g. Dr. H. Ahmad Fauzi"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors font-medium text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Nomor Kamar *
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="E.g. 508"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors font-mono font-semibold text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                    Handling Type
                  </label>
                  <select
                    value={typeHandling}
                    onChange={(e: any) => setTypeHandling(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors font-medium text-slate-800"
                  >
                    <option value="Koper">Koper</option>
                    <option value="Kardus">Kardus</option>
                    <option value="Tas Ransel">Tas Ransel</option>
                    <option value="Lain Lain">Lain Lain</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Catatan Tambahan / Remark
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="E.g. Koper merah merk Samsonite, diikat tali kuning."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors font-medium text-slate-800"
                />
              </div>

              {/* Automatic read-only display fields */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 grid grid-cols-2 gap-3 text-[11px] text-slate-500 font-medium">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Receive By (Staff)</div>
                  <div className="text-slate-800 font-semibold mt-0.5">{currentUser.name}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Lokasi Simpan</div>
                  <div className="text-amber-600 font-bold mt-0.5">GUDANG LUGGAGE</div>
                </div>
              </div>
            </div>

            {/* Right Column: Photo Capture & Cam */}
            <div className="flex flex-col space-y-4">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-0.5">
                Foto Barang (Luggage Photo)
              </label>

              {/* Camera view or Captured image */}
              <div className="flex-1 min-h-[220px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex flex-col items-center justify-center relative group">
                
                {isCameraActive ? (
                  <div className="w-full h-full flex flex-col relative bg-black">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover flex-1"
                      playsInline
                      muted
                    />
                    <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3 px-4">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-black/30 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        Ambil Snapshot
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-black/30 cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : photoBase64 ? (
                  <div className="w-full h-full flex flex-col relative bg-slate-50">
                    <img
                      src={photoBase64}
                      alt="Luggage preview"
                      referrerPolicy="no-referrer"
                      className="w-full h-[220px] object-cover rounded-xl"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPhotoBase64('')}
                        className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow"
                        title="Hapus foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-12 h-12 bg-slate-200/60 rounded-full flex items-center justify-center mx-auto text-slate-400">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Ambil Foto Barang</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Ambil dari kamera perangkat atau unggah file gambar</div>
                    </div>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-red-50/95 flex flex-col items-center justify-center p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
                    <div className="text-xs text-red-700 font-bold">Kamera Terblokir</div>
                    <div className="text-[10px] text-red-500 mt-1 max-w-[200px] leading-relaxed">{cameraError}</div>
                    <button
                      type="button"
                      onClick={() => setCameraError(null)}
                      className="mt-3 px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg"
                    >
                      Tutup
                    </button>
                  </div>
                )}
              </div>

              {/* Photo Input Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isCameraActive}
                  className="py-2.5 px-4 bg-[#002B5B] hover:bg-blue-800 text-white font-semibold text-xs rounded-xl transition-all shadow cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  Gunakan Kamera
                </button>
                <label className="py-2.5 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs rounded-xl transition-all shadow cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] text-center">
                  <Upload className="w-4 h-4" />
                  Unggah File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 flex items-center justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-extrabold text-xs rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan & Mensinkronisasi...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Penitipan Barang
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
