import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from '../firebase';
import { PublicDepositItem } from '../types';
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  Printer, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  Image as ImageIcon,
  Package,
  ShoppingBag,
  ExternalLink,
  Phone,
  Calendar,
  AlertCircle,
  Camera
} from 'lucide-react';

interface PublicDepositsListProps {
  currentUser: { uid: string; email: string; name: string; role: 'admin' | 'staff' };
}

export default function PublicDepositsList({ currentUser }: PublicDepositsListProps) {
  const [items, setItems] = useState<PublicDepositItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PublicDepositItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Menunggu' | 'Sudah Diambil'>('All');
  const [jenisFilter, setJenisFilter] = useState<'All' | 'Makanan' | 'Minuman' | 'Barang'>('All');
  
  // Lightbox and action confirms
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [checkoutConfirmItem, setCheckoutConfirmItem] = useState<PublicDepositItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PublicDepositItem | null>(null);
  const [printTarget, setPrintTarget] = useState<PublicDepositItem | null>(null);

  // Handover/Checkout additional inputs
  const [namaPenerimaAmbil, setNamaPenerimaAmbil] = useState('');
  const [catatanAmbil, setCatatanAmbil] = useState('');
  const [photoAmbil, setPhotoAmbil] = useState<string>('');

  // Real-time listener for Firestore public_deposits collection
  useEffect(() => {
    const q = query(collection(db, 'public_deposits'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs: PublicDepositItem[] = [];
      snapshot.forEach((docSnap) => {
        docs.push(docSnap.data() as PublicDepositItem);
      });
      setItems(docs);
      setIsLoading(false);
    }, (err) => {
      console.error('Error on snapshot listener for public deposits:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter items
  useEffect(() => {
    let result = [...items];

    if (searchQuery.trim() !== '') {
      const qLower = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.id.toLowerCase().includes(qLower) ||
        item.namaPengirim.toLowerCase().includes(qLower) ||
        item.namaPenerima.toLowerCase().includes(qLower) ||
        item.noHpPengirim.toLowerCase().includes(qLower) ||
        (item.keterangan && item.keterangan.toLowerCase().includes(qLower))
      );
    }

    if (statusFilter !== 'All') {
      result = result.filter(item => item.status === statusFilter);
    }

    if (jenisFilter !== 'All') {
      result = result.filter(item => item.jenisBarang === jenisFilter);
    }

    setFilteredItems(result);
  }, [items, searchQuery, statusFilter, jenisFilter]);

  const handlePhotoAmbilUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('Ukuran foto terlalu besar. Maksimal 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotoAmbil(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCheckout = async (item: PublicDepositItem) => {
    if (!namaPenerimaAmbil.trim()) {
      alert('Nama penerima wajib diisi.');
      return;
    }

    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');

      const localDate = `${year}-${month}-${day}`;
      const localTime = `${hours}:${minutes}`;

      const itemRef = doc(db, 'public_deposits', item.id);
      await updateDoc(itemRef, {
        status: 'Sudah Diambil',
        handledBy: currentUser.name,
        dateDelivered: localDate,
        timeDelivered: localTime,
        namaPenerimaAmbil: namaPenerimaAmbil.trim(),
        catatanAmbil: catatanAmbil.trim() || '',
        photoAmbil: photoAmbil || ''
      });

      setCheckoutConfirmItem(null);
    } catch (err) {
      console.error('Error checking out public deposit:', err);
      alert('Gagal memperbarui status penitipan.');
    }
  };

  const handleDelete = async (item: PublicDepositItem) => {
    try {
      await deleteDoc(doc(db, 'public_deposits', item.id));
      setDeleteConfirmItem(null);
    } catch (err) {
      console.error('Error deleting public deposit:', err);
      alert('Gagal menghapus data.');
    }
  };

  const handlePrint = (item: PublicDepositItem) => {
    setPrintTarget(item);
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Print trigger failed:', err);
      }
    }, 300);
  };

  // Stats
  const waitingCount = items.filter(i => i.status === 'Menunggu').length;
  const foodCount = items.filter(i => i.status === 'Menunggu' && i.jenisBarang === 'Makanan').length;
  const beverageCount = items.filter(i => i.status === 'Menunggu' && i.jenisBarang === 'Minuman').length;

  return (
    <div className="space-y-6 w-full">
      {/* Hidden print layout */}
      {printTarget && (
        <div className="hidden print:block print:p-0 print:m-0 bg-white text-black font-mono text-[10px] w-[75mm] leading-relaxed mx-auto">
          <div className="text-center space-y-1 pb-2 border-b border-dashed border-black">
            <h2 className="text-xs font-bold font-sans uppercase">ASTON Cirebon</h2>
            <p className="text-[8px] text-gray-700">Hotel & Convention Center</p>
            <p className="text-[8px] font-semibold text-gray-700">SALINAN STRUK PENITIPAN PUBLIK</p>
          </div>
          
          <div className="py-2 space-y-1.5 border-b border-dashed border-black">
            <div className="flex justify-between">
              <span>ID PENITIPAN:</span>
              <span className="font-bold">{printTarget.id}</span>
            </div>
            <div className="flex justify-between">
              <span>TANGGAL:</span>
              <span>{printTarget.date} {printTarget.time}</span>
            </div>
            <div className="flex justify-between">
              <span>JENIS BARANG:</span>
              <span className="font-bold uppercase">{printTarget.jenisBarang}</span>
            </div>
            <div className="flex justify-between">
              <span>PENGIRIM:</span>
              <span className="font-bold">{printTarget.namaPengirim}</span>
            </div>
            <div className="flex justify-between">
              <span>HP PENGIRIM:</span>
              <span>{printTarget.noHpPengirim}</span>
            </div>
            <div className="flex justify-between">
              <span>PENERIMA:</span>
              <span className="font-bold">{printTarget.namaPenerima}</span>
            </div>
            {printTarget.keterangan && (
              <div className="pt-0.5">
                <div className="text-[8px]">KETERANGAN:</div>
                <div className="italic text-gray-700">{printTarget.keterangan}</div>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center py-3 space-y-2 border-b border-dashed border-black">
            <img src={printTarget.qrCode} alt="QR Code" className="w-28 h-28" />
            <span className="text-[8px] font-bold tracking-wider">{printTarget.id}</span>
          </div>

          <div className="pt-2 text-center text-[7px] leading-tight space-y-1">
            <p className="font-bold">HARAP SIMPAN STRUK INI</p>
            <p>Tunjukkan kepada petugas Concierge saat akan mengambil barang atau makanan Anda.</p>
            <p className="pt-1.5 text-gray-500 font-normal">Sistem Penitipan Mandiri Aston</p>
          </div>
        </div>
      )}

      {/* Main dashboard list layout */}
      <div className="print:hidden space-y-6">
        {/* Statistics cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Menunggu</div>
              <div className="text-2xl font-black text-slate-800">{waitingCount} barang</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Makanan Menunggu</div>
              <div className="text-2xl font-black text-slate-800">{foodCount} paket</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Minuman Menunggu</div>
              <div className="text-2xl font-black text-slate-800">{beverageCount} paket</div>
            </div>
          </div>
        </div>

        {/* Filters bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari ID, pengirim, hp, penerima..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#002B5B] focus:bg-white transition-all"
              />
            </div>

            {/* Selector Filters */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="All">Semua Status</option>
                <option value="Menunggu">Menunggu Diambil</option>
                <option value="Sudah Diambil">Sudah Diambil</option>
              </select>

              <select
                value={jenisFilter}
                onChange={(e) => setJenisFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="All">Semua Jenis Barang</option>
                <option value="Makanan">Makanan</option>
                <option value="Minuman">Minuman</option>
                <option value="Barang">Barang</option>
              </select>
            </div>
          </div>
        </div>

        {/* Real-time Deposits List */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs text-slate-400 font-bold">Memuat daftar penitipan publik...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-bold">Tidak ada data penitipan publik yang sesuai.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => (
              <div 
                key={item.id} 
                className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 relative transition-all hover:shadow-md ${
                  item.status === 'Sudah Diambil' ? 'bg-slate-50/50 opacity-90' : ''
                }`}
              >
                {/* Header info */}
                <div className="flex justify-between items-start gap-2 mb-3">
                  <div>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-tight ${
                      item.jenisBarang === 'Makanan' 
                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                        : item.jenisBarang === 'Minuman' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                          : 'bg-[#002B5B]/5 text-[#002B5B] border border-slate-200'
                    }`}>
                      {item.jenisBarang}
                    </span>
                    <h3 className="text-xs font-black text-slate-800 font-mono mt-1.5 select-all">{item.id}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      {item.date} {item.time}
                    </p>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                    item.status === 'Sudah Diambil'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-emerald-500 text-white animate-pulse'
                  }`}>
                    {item.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                  {/* Photo container if exists */}
                  <div className="col-span-1">
                    {item.photo ? (
                      <div 
                        onClick={() => setActivePhoto(item.photo)}
                        className="relative rounded-xl overflow-hidden aspect-square bg-slate-100 border border-slate-200 cursor-pointer group hover:opacity-90"
                      >
                        <img src={item.photo} alt="Item" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                          <ExternalLink className="w-4 h-4" />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl aspect-square bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-[10px] font-bold p-2 text-center">
                        <ImageIcon className="w-5 h-5 mb-1 text-slate-300" />
                        Tanpa Foto
                      </div>
                    )}
                  </div>

                  {/* Text details container */}
                  <div className="col-span-2 space-y-1.5 text-[11px] text-slate-600">
                    <p>
                      <strong className="text-slate-400 uppercase text-[9px] font-bold block">Pengirim / Kurir</strong>
                      <span className="font-bold text-slate-800">{item.namaPengirim}</span>
                    </p>
                    <p className="flex items-center gap-1 text-slate-500 font-medium">
                      <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                      {item.noHpPengirim}
                    </p>
                    <p className="pt-0.5">
                      <strong className="text-slate-400 uppercase text-[9px] font-bold block">Penerima (Tamu)</strong>
                      <span className="font-bold text-[#002B5B]">{item.namaPenerima}</span>
                    </p>
                  </div>
                </div>

                {item.keterangan && (
                  <div className="mt-3 p-2 bg-slate-50 border border-slate-100 rounded-lg text-[10px] text-slate-600 italic">
                    <strong>Catatan:</strong> {item.keterangan}
                  </div>
                )}

                {/* Return metadata log */}
                {item.status === 'Sudah Diambil' && item.handledBy && (
                  <div className="mt-3 p-3 bg-emerald-50/50 border border-emerald-100/80 rounded-xl text-[10px] text-emerald-800 space-y-2">
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs">✓ Sudah Diserahkan</p>
                      <p>Diserahkan oleh: <span className="font-semibold">{item.handledBy}</span></p>
                      <p>Waktu Penyerahan: <span className="font-semibold">{item.dateDelivered} {item.timeDelivered}</span></p>
                      {item.namaPenerimaAmbil && (
                        <p>Diterima oleh: <span className="font-bold">{item.namaPenerimaAmbil}</span></p>
                      )}
                      {item.catatanAmbil && (
                        <p className="italic text-slate-600 pt-0.5"><span className="font-semibold not-italic text-emerald-800">Catatan:</span> {item.catatanAmbil}</p>
                      )}
                    </div>
                    {item.photoAmbil && (
                      <div className="mt-2 pt-2 border-t border-emerald-100/80">
                        <span className="font-bold block mb-1 text-[9px] uppercase tracking-wider text-emerald-700">Foto Bukti Penyerahan:</span>
                        <div 
                          onClick={() => setActivePhoto(item.photoAmbil)}
                          className="relative rounded-lg overflow-hidden h-14 w-14 bg-slate-100 border border-emerald-200 cursor-pointer hover:opacity-90 inline-block"
                        >
                          <img src={item.photoAmbil} alt="Bukti Penyerahan" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions Row */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between gap-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePrint(item)}
                      className="p-2 border border-slate-200 hover:border-[#002B5B] text-slate-600 hover:text-[#002B5B] rounded-lg transition-colors cursor-pointer"
                      title="Cetak Salinan Struk"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {currentUser.role === 'admin' && (
                      <button
                        onClick={() => setDeleteConfirmItem(item)}
                        className="p-2 border border-slate-200 hover:border-red-500 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Data"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {item.status === 'Menunggu' && (
                    <button
                      onClick={() => {
                        setCheckoutConfirmItem(item);
                        setNamaPenerimaAmbil(item.namaPenerima || '');
                        setCatatanAmbil('');
                        setPhotoAmbil('');
                      }}
                      className="px-3.5 py-1.5 bg-[#002B5B] hover:bg-[#114488] text-white text-[10px] font-extrabold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Diserahkan ke Penerima
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PHOTO LIGHTBOX MODAL */}
      {activePhoto && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div className="max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl relative">
            <img src={activePhoto} alt="Barang" className="max-h-[80vh] w-auto object-contain rounded-xl" />
            <button 
              className="absolute top-4 right-4 px-3 py-1 bg-black/60 text-white font-bold rounded-lg text-xs hover:bg-black transition-colors"
              onClick={() => setActivePhoto(null)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* CHECKOUT CONFIRM MODAL */}
      {checkoutConfirmItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100 my-8">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 mx-auto flex items-center justify-center mb-1">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-black text-lg text-slate-800">Proses Penyerahan Publik</h3>
              <p className="text-xs text-slate-500">
                Silakan lengkapi data penyerahan barang berikut
              </p>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 grid grid-cols-2 gap-2">
              <p><strong>ID:</strong> {checkoutConfirmItem.id}</p>
              <p><strong>Jenis:</strong> {checkoutConfirmItem.jenisBarang}</p>
              <p className="col-span-2"><strong>Pengirim:</strong> {checkoutConfirmItem.namaPengirim}</p>
              <p className="col-span-2"><strong>Penerima Terdaftar:</strong> {checkoutConfirmItem.namaPenerima}</p>
            </div>

            <div className="space-y-3">
              {/* Nama Penerima */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">
                  Nama Penerima <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama orang yang mengambil barang..."
                  value={namaPenerimaAmbil}
                  onChange={(e) => setNamaPenerimaAmbil(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#002B5B] focus:bg-white transition-all"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">
                  Notes / Catatan <span className="text-slate-400 font-normal">(jika diperlukan)</span>
                </label>
                <textarea
                  placeholder="Catatan tambahan penyerahan..."
                  value={catatanAmbil}
                  onChange={(e) => setCatatanAmbil(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#002B5B] focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Photo Upload / Capture */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-600 block uppercase tracking-wider">
                  Photo Bukti Penyerahan <span className="text-slate-400 font-normal">(opsional)</span>
                </label>
                
                <div className="flex items-center gap-3">
                  {photoAmbil ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
                      <img src={photoAmbil} alt="Ambil Bukti" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotoAmbil('')}
                        className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[9px] font-extrabold opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-400">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-1">
                    <label className="inline-flex items-center justify-center px-3 py-2 border border-slate-200 hover:border-[#002B5B] text-slate-700 hover:text-[#002B5B] bg-white hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer gap-1.5 shadow-sm">
                      <Camera className="w-3.5 h-3.5" />
                      {photoAmbil ? 'Ubah Foto' : 'Ambil Foto / Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoAmbilUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[9px] text-slate-400 mt-1 font-semibold">Mendukung kamera langsung di mobile / upload file.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCheckoutConfirmItem(null)}
                className="w-1/2 py-2.5 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleCheckout(checkoutConfirmItem)}
                className="w-1/2 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-md shadow-emerald-500/15"
              >
                Ya, Sudah Diambil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM MODAL */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-serif font-black text-lg text-slate-800">Hapus Data</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tindakan ini tidak dapat dibatalkan. Apakah Anda yakin ingin menghapus data penitipan publik ini?
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="w-1/2 py-2.5 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmItem)}
                className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-md shadow-red-600/15"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
