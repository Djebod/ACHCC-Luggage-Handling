import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'qrcode';
import { db, doc, setDoc } from '../firebase';
import { PublicDepositItem } from '../types';
import { syncPublicDepositToGoogleSheet } from '../utils/sheetSync';
import { 
  Camera, 
  Upload, 
  Printer, 
  Save, 
  ArrowLeft, 
  Sparkles, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Calendar,
  Clock,
  User,
  Phone,
  Package,
  FileText,
  ShoppingBag
} from 'lucide-react';
import AstonLogo from './AstonLogo';

interface PublicDepositFormProps {
  onBackToLogin: () => void;
}

export default function PublicDepositForm({ onBackToLogin }: PublicDepositFormProps) {
  // Fields required:
  // - Tanggal
  // - Jam
  // - Jenis barang : Makanan, Minuman atau Barang
  // - Photo
  // - Nama pengirim
  // - Nomor Hp pengirim
  // - Nama Penerima
  // - Keterangan

  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [jenisBarang, setJenisBarang] = useState<'Makanan' | 'Minuman' | 'Barang'>('Barang');
  const [namaPengirim, setNamaPengirim] = useState('');
  const [noHpPengirim, setNoHpPengirim] = useState('');
  const [namaPenerima, setNamaPenerima] = useState('');
  const [keterangan, setKeterangan] = useState('');
  
  // Photo states
  const [photoBase64, setPhotoBase64] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Submit states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successItem, setSuccessItem] = useState<PublicDepositItem | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-fill date & time on mount
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const localDate = `${year}-${month}-${day}`;
    const localTime = `${hours}:${minutes}`;

    setDate(localDate);
    setTime(localTime);

    return () => {
      stopCamera();
    };
  }, []);

  const generatePublicId = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PUB-${dateStr}-${rand}`;
  };

  // Start video stream
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Gagal mengakses kamera. Pastikan memberikan izin akses.');
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // Compress at 75% quality
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
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const localDate = `${year}-${month}-${day}`;
    const localTime = `${hours}:${minutes}`;

    setDate(localDate);
    setTime(localTime);
    setJenisBarang('Barang');
    setNamaPengirim('');
    setNoHpPengirim('');
    setNamaPenerima('');
    setKeterangan('');
    setPhotoBase64('');
    setSuccessItem(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaPengirim || !namaPenerima || !noHpPengirim) {
      setError('Kolom Nama Pengirim, No HP, dan Nama Penerima wajib diisi.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const publicId = generatePublicId();
    try {
      // Generate QR Code base64 data url containing the public ID
      const qrDataUrl = await QRCode.toDataURL(publicId, { scale: 5, margin: 1 });

      const newPublicDeposit: PublicDepositItem = {
        id: publicId,
        date,
        time,
        jenisBarang,
        photo: photoBase64,
        namaPengirim: namaPengirim.trim(),
        noHpPengirim: noHpPengirim.trim(),
        namaPenerima: namaPenerima.trim(),
        keterangan: keterangan.trim(),
        status: 'Menunggu',
        createdAt: new Date().toISOString(),
        qrCode: qrDataUrl
      };

      // Save to public_deposits collection in Firestore
      await setDoc(doc(db, 'public_deposits', publicId), newPublicDeposit);

      // Sync to Google Sheet
      await syncPublicDepositToGoogleSheet('insert', newPublicDeposit);

      setSuccessItem(newPublicDeposit);
    } catch (err: any) {
      console.error('Error saving public deposit:', err);
      setError(`Gagal menyimpan penitipan barang: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    // Standard iframe safe print function
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Print trigger failed:', err);
      }
    }, 250);
  };

  return (
    <div className="min-h-screen bg-[#F1F3F6] font-sans flex flex-col justify-between text-slate-800 antialiased">
      {/* Printable Receipt layout only visible during print */}
      {successItem && (
        <div className="hidden print:block print:p-0 print:m-0 bg-white text-black font-mono text-[10px] w-[75mm] leading-relaxed mx-auto">
          <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
            <h2 className="text-xs font-bold font-sans uppercase">ASTON Cirebon</h2>
            <p className="text-[8px] text-gray-700">Hotel & Convention Center</p>
            <p className="text-[8px] font-semibold text-gray-700">PENITIPAN BARANG PUBLIK</p>
          </div>
          
          <div className="py-2 space-y-1.5 border-b border-dashed border-black">
            <div className="flex justify-between">
              <span>ID PENITIPAN:</span>
              <span className="font-bold">{successItem.id}</span>
            </div>
            <div className="flex justify-between">
              <span>TANGGAL:</span>
              <span>{successItem.date} {successItem.time}</span>
            </div>
            <div className="flex justify-between">
              <span>JENIS BARANG:</span>
              <span className="font-bold uppercase">{successItem.jenisBarang}</span>
            </div>
            <div className="flex justify-between">
              <span>PENGIRIM:</span>
              <span className="font-bold">{successItem.namaPengirim}</span>
            </div>
            <div className="flex justify-between">
              <span>HP PENGIRIM:</span>
              <span>{successItem.noHpPengirim}</span>
            </div>
            <div className="flex justify-between">
              <span>PENERIMA:</span>
              <span className="font-bold">{successItem.namaPenerima}</span>
            </div>
            {successItem.keterangan && (
              <div className="pt-0.5">
                <div className="text-[8px]">KETERANGAN:</div>
                <div className="italic text-gray-700">{successItem.keterangan}</div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center py-3 space-y-2 border-b border-dashed border-black">
            <img src={successItem.qrCode} alt="QR Code" className="w-28 h-28" />
            <span className="text-[8px] font-bold tracking-wider">{successItem.id}</span>
          </div>

          <div className="pt-2 text-center text-[7px] leading-tight space-y-1">
            <p className="font-bold">HARAP SIMPAN STRUK INI</p>
            <p>Tunjukkan kepada petugas Concierge saat akan mengambil barang atau makanan Anda.</p>
            <p className="pt-1.5 text-gray-500 font-normal">Sistem Penitipan Mandiri Aston</p>
          </div>
        </div>
      )}

      {/* Main Screen Layout (Non-printable) */}
      <div className="print:hidden flex-grow">
        {/* Navigation Bar */}
        <div className="bg-[#002B5B] text-white shadow-lg relative z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={onBackToLogin}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer text-amber-400"
                title="Kembali ke Portal Login"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-sm font-black tracking-wider uppercase flex items-center gap-1.5 text-white">
                  <ShoppingBag className="w-4 h-4 text-amber-400" />
                  Penitipan Mandiri
                </h1>
                <p className="text-[10px] text-slate-300">Formulir Penitipan Barang & Makanan Publik</p>
              </div>
            </div>
            <AstonLogo className="w-24 shrink-0" variant="white" />
          </div>
        </div>

        {/* Content Container */}
        <div className="max-w-2xl mx-auto px-4 py-8">
          {successItem ? (
            /* Success & Printable Receipt Screen */
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-8 space-y-6 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="p-4 bg-emerald-50 rounded-full text-emerald-500 mb-2">
                  <CheckCircle className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-serif font-black text-slate-800">
                  Registrasi Penitipan Berhasil!
                </h2>
                <p className="text-xs text-slate-500 max-w-sm">
                  Barang telah berhasil terdaftar ke dalam sistem pergudangan ASTON. Harap simpan QR code atau struk di bawah ini.
                </p>
              </div>

              {/* Thermal Receipt Preview Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left max-w-sm mx-auto space-y-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-400"></div>
                
                <div className="text-center pb-3 border-b border-dashed border-slate-200">
                  <p className="text-[10px] font-bold text-[#002B5B] tracking-wider uppercase">ASTON CIREBON</p>
                  <p className="text-[9px] text-slate-400 font-semibold">FORM PENITIPAN MANDIRI</p>
                </div>

                <div className="text-xs space-y-2.5 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-400">ID Penitipan:</span>
                    <span className="font-bold text-[#002B5B]">{successItem.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Waktu Masuk:</span>
                    <span className="font-medium">{successItem.date} {successItem.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Jenis Barang:</span>
                    <span className="font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] uppercase">
                      {successItem.jenisBarang}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pengirim:</span>
                    <span className="font-semibold">{successItem.namaPengirim}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">No HP:</span>
                    <span className="font-mono">{successItem.noHpPengirim}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nama Penerima:</span>
                    <span className="font-semibold text-slate-800">{successItem.namaPenerima}</span>
                  </div>
                  {successItem.keterangan && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] text-slate-400 font-medium uppercase">Keterangan:</p>
                      <p className="italic text-slate-600 bg-white p-2 rounded-lg border border-slate-100 mt-1">
                        {successItem.keterangan}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center pt-4 border-t border-dashed border-slate-200">
                  <img src={successItem.qrCode} alt="QR Code" className="w-36 h-36 border border-slate-100 rounded-lg p-1 bg-white shadow-inner" />
                  <span className="text-[10px] font-mono font-extrabold text-slate-400 mt-2 tracking-widest">
                    {successItem.id}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="px-6 py-3 bg-[#002B5B] hover:bg-[#114488] text-white font-bold text-xs rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Struk Penitipan
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  Buat Penitipan Baru
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={onBackToLogin}
                  className="text-xs text-[#002B5B] hover:text-amber-500 font-bold underline transition-colors cursor-pointer"
                >
                  Kembali ke Halaman Utama
                </button>
              </div>
            </div>
          ) : (
            /* Main Form Input */
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200/80 shadow-xl p-6 sm:p-8 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h2 className="text-xl font-serif font-black text-[#002B5B] flex items-center gap-2">
                  Formulir Penitipan Barang Publik
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Gunakan formulir mandiri ini untuk mendaftarkan penitipan makanan, minuman, ataupun barang kiriman yang akan diserahkan kepada concierge hotel.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 leading-relaxed font-medium">{error}</div>
                </div>
              )}

              {/* Hidden read-only metadata section in display, but auto-bound */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-500" />
                    Tanggal Masuk
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" />
                    Jam Penitipan
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              {/* Jenis Barang Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                  Jenis Barang
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['Makanan', 'Minuman', 'Barang'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setJenisBarang(type)}
                      className={`py-3.5 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-2 cursor-pointer ${
                        jenisBarang === type
                          ? 'border-[#002B5B] bg-[#002B5B]/5 text-[#002B5B] ring-2 ring-[#002B5B]/10'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Package className={`w-5 h-5 ${jenisBarang === type ? 'text-[#002B5B]' : 'text-slate-400'}`} />
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Photo Input Block */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Foto Barang (Wajib / Opsional)
                </label>

                {isCameraActive ? (
                  <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video max-w-sm mx-auto">
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                      >
                        Ambil Gambar
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : photoBase64 ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 max-w-xs mx-auto group">
                    <img 
                      src={photoBase64} 
                      alt="Captured deposit" 
                      className="w-full object-cover aspect-square"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoBase64('')}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-red-700 cursor-pointer"
                    >
                      Hapus Foto
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto justify-center">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex-1 py-4 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-amber-400 hover:bg-amber-50/20 text-slate-600 transition-all cursor-pointer bg-slate-50"
                    >
                      <Camera className="w-5 h-5 text-amber-500" />
                      <span className="text-xs font-bold text-slate-700">Ambil Foto Kamera</span>
                      <span className="text-[9px] text-slate-400">Gunakan kamera bawaan</span>
                    </button>

                    <label className="flex-1 py-4 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-amber-400 hover:bg-amber-50/20 text-slate-600 transition-all cursor-pointer bg-slate-50">
                      <Upload className="w-5 h-5 text-amber-500" />
                      <span className="text-xs font-bold text-slate-700">Upload dari File</span>
                      <span className="text-[9px] text-slate-400">JPEG atau PNG, maks 2MB</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileUpload} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                )}
                {cameraError && (
                  <p className="text-[11px] text-red-500 text-center font-medium mt-1">{cameraError}</p>
                )}
              </div>

              {/* Input Form Fields */}
              <div className="space-y-4 pt-2">
                {/* Sender Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nama Pengirim <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={namaPengirim}
                      onChange={(e) => setNamaPengirim(e.target.value)}
                      placeholder="Masukkan nama pengirim / kurir (cth: Pak Jefri Gojek)"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Sender Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nomor HP Pengirim <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </span>
                    <input
                      type="tel"
                      value={noHpPengirim}
                      onChange={(e) => setNoHpPengirim(e.target.value)}
                      placeholder="Masukkan nomor telepon / WhatsApp"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Recipient Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Nama Penerima <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={namaPenerima}
                      onChange={(e) => setNamaPenerima(e.target.value)}
                      placeholder="Nama Tamu / Penerima di Hotel (cth: Ibu Kartika - Kamar 402)"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Notes / Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Keterangan Tambahan
                  </label>
                  <div className="relative">
                    <span className="absolute top-3 left-3.5 text-slate-400">
                      <FileText className="w-4 h-4" />
                    </span>
                    <textarea
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                      placeholder="Catatan isi barang / pesan khusus (cth: Makanan beku, harap dimasukkan ke kulkas concierge)"
                      rows={3}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={onBackToLogin}
                  className="w-full sm:w-1/3 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Batal / Kembali
                </button>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-2/3 py-3 bg-[#002B5B] hover:bg-[#114488] text-white font-extrabold text-sm rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mendaftarkan Penitipan...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Daftarkan Penitipan Publik
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Modern Footer */}
      <div className="print:hidden bg-[#001736] text-white py-4 px-4 text-center border-t border-slate-800">
        <p className="text-[10px] text-slate-400 font-medium">
          © 2026 ASTON Cirebon Hotel & Convention Center — Public Deposit Service
        </p>
      </div>
    </div>
  );
}
