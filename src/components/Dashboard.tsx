import { useState, useEffect } from 'react';
import { db, collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc } from '../firebase';
import { LuggageItem } from '../types';
import { syncToGoogleSheet } from '../utils/sheetSync';
import { 
  Search, 
  Filter, 
  Clock, 
  MapPin, 
  User, 
  Printer, 
  Trash2, 
  CheckCircle, 
  Lock, 
  AlertCircle, 
  Image as ImageIcon,
  Loader2,
  TrendingUp,
  Archive,
  Hourglass,
  ExternalLink,
  Calendar,
  Download
} from 'lucide-react';

interface DashboardProps {
  currentUser: { uid: string; email: string; name: string; role: 'admin' | 'staff' };
  onPrintRequest: (item: LuggageItem) => void;
}

export default function Dashboard({ currentUser, onPrintRequest }: DashboardProps) {
  const [luggageItems, setLuggageItems] = useState<LuggageItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<LuggageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Gudang' | 'Sudah Diambil'>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modal Lightbox state for viewing large image
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  // Stats counters
  const [stats, setStats] = useState({
    total: 0,
    inWarehouse: 0,
    pickedUp: 0,
    avgDeliverMinutes: 0
  });

  const exportToExcel = () => {
    const headers = [
      "ID",
      "Tanggal Masuk",
      "Jam Masuk",
      "Diterima Oleh",
      "Jenis Handling",
      "Nama Tamu",
      "No Kamar",
      "Catatan/Remark",
      "Status",
      "Diserahkan Oleh",
      "Tanggal Diambil",
      "Jam Diambil",
      "Lama Penyimpanan (Hari)",
      "Lama Penyimpanan (Jam:Menit)"
    ];
    
    const rows = filteredItems.map(item => [
      item.id,
      item.date,
      item.time,
      `"${(item.receiveBy || '').replace(/"/g, '""')}"`,
      item.typeHandling,
      `"${(item.namaTamu || '').replace(/"/g, '""')}"`,
      `"${(item.roomNumber || '').replace(/"/g, '""')}"`,
      `"${(item.remark || '').replace(/"/g, '""')}"`,
      item.status,
      `"${(item.handleBy || '').replace(/"/g, '""')}"`,
      item.dateDelivered || '',
      item.timeDelivered || '',
      item.solvedTimeDay !== null ? item.solvedTimeDay : '',
      item.solvedTimeHourMinutes || ''
    ]);
    
    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_Penitipan_Staf_${startDate || 'Awal'}_s.d_${endDate || 'Akhir'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Real-time listener for Firestore luggage collection
  useEffect(() => {
    const q = query(collection(db, 'luggage'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: LuggageItem[] = [];
      let totalCount = 0;
      let warehouseCount = 0;
      let pickedUpCount = 0;
      let totalSolvedMs = 0;
      let solvedCount = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as LuggageItem;
        items.push(data);

        // Aggregate statistics
        totalCount++;
        if (data.status === 'Gudang') {
          warehouseCount++;
        } else {
          pickedUpCount++;
          
          // Calculate time difference for solved items
          const depositDate = new Date(`${data.date}T${data.time}`);
          const deliverDate = new Date(`${data.dateDelivered}T${data.timeDelivered}`);
          if (!isNaN(depositDate.getTime()) && !isNaN(deliverDate.getTime())) {
            const diffMs = deliverDate.getTime() - depositDate.getTime();
            if (diffMs > 0) {
              totalSolvedMs += diffMs;
              solvedCount++;
            }
          }
        }
      });

      setLuggageItems(items);
      
      // Calculate average delivery time in minutes
      const avgMinutes = solvedCount > 0 
        ? Math.round(totalSolvedMs / (1000 * 60 * solvedCount)) 
        : 0;

      setStats({
        total: totalCount,
        inWarehouse: warehouseCount,
        pickedUp: pickedUpCount,
        avgDeliverMinutes: avgMinutes
      });
      setIsLoading(false);
    }, (err) => {
      console.error('Error on snapshot listener:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle client-side search, sorting and filters
  useEffect(() => {
    let result = [...luggageItems];

    // 1. Apply Search Query (ID, Guest Name, or Room Number)
    if (searchQuery.trim() !== '') {
      const queryLower = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.id.toLowerCase().includes(queryLower) ||
        item.namaTamu.toLowerCase().includes(queryLower) ||
        item.roomNumber.toLowerCase().includes(queryLower)
      );
    }

    // Apply Date Range Filter
    if (startDate) {
      result = result.filter(item => item.date >= startDate);
    }
    if (endDate) {
      result = result.filter(item => item.date <= endDate);
    }

    // 2. Apply Status Filter
    if (statusFilter !== 'All') {
      result = result.filter(item => item.status === statusFilter);
    }

    // 3. Apply Type Handling Filter
    if (typeFilter !== 'All') {
      result = result.filter(item => item.typeHandling === typeFilter);
    }

    // 4. Apply Sorting
    if (sortOrder === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }

    setFilteredItems(result);
  }, [luggageItems, searchQuery, statusFilter, typeFilter, sortOrder, startDate, endDate]);

  const [deliverConfirmItem, setDeliverConfirmItem] = useState<LuggageItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<LuggageItem | null>(null);

  const handleDeliverLuggage = (item: LuggageItem) => {
    setDeliverConfirmItem(item);
  };

  const executeDeliverLuggage = async (item: LuggageItem) => {
    const now = new Date();
    const localDate = now.toLocaleDateString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
    const localTime = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });

    try {
      // Calculate solved time
      const depositDateTimeStr = `${item.date}T${item.time}`;
      const depositDate = new Date(depositDateTimeStr);
      let solvedDays = 0;
      let solvedHoursMinsStr = '00:00';

      if (!isNaN(depositDate.getTime())) {
        const diffMs = now.getTime() - depositDate.getTime();
        solvedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const remainingMs = diffMs % (1000 * 60 * 60 * 24);
        const diffHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const diffMins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        
        solvedHoursMinsStr = `${String(diffHours).padStart(2, '0')}:${String(diffMins).padStart(2, '0')}`;
      }

      const updateData: Partial<LuggageItem> = {
        status: 'Sudah Diambil',
        handleBy: currentUser.name,
        dateDelivered: localDate,
        timeDelivered: localTime,
        solvedTimeDay: solvedDays,
        solvedTimeHourMinutes: solvedHoursMinsStr
      };

      const updatedItem: LuggageItem = {
        ...item,
        ...updateData
      };

      // 1. Update Firestore
      await updateDoc(doc(db, 'luggage', item.id), updateData);

      // 2. Sync Google Sheet
      await syncToGoogleSheet('update', updatedItem);
      setDeliverConfirmItem(null);
    } catch (err) {
      console.error('Error delivering luggage:', err);
      alert('Gagal memproses penyerahan barang.');
    }
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (currentUser.role !== 'admin') {
      alert('Hanya Administrator yang memiliki akses menghapus data.');
      return;
    }
    const item = luggageItems.find(i => i.id === id);
    if (item) {
      setDeleteConfirmItem(item);
    }
  };

  const executeDeleteItem = async (item: LuggageItem) => {
    try {
      await deleteDoc(doc(db, 'luggage', item.id));
      setDeleteConfirmItem(null);
    } catch (err) {
      console.error('Error deleting luggage:', err);
      alert('Gagal menghapus data.');
    }
  };

  const formatAvgTime = (minutes: number) => {
    if (minutes === 0) return '0 m';
    if (minutes < 60) return `${minutes} m`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours} j ${remainingMins} m`;
  };

  return (
    <div className="space-y-6">
      {/* Bento Grid Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        
        {/* In Storage Stat Card */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Gudang' ? 'All' : 'Gudang')}
          className={`lg:col-span-3 rounded-xl p-5 flex flex-col justify-center cursor-pointer transition-all duration-200 shadow-sm border ${
            statusFilter === 'Gudang'
              ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20 shadow-md scale-[1.02]'
              : 'bg-white border-slate-200/80 hover:border-amber-400 hover:bg-slate-50/50'
          }`}
          title="Klik untuk memfilter: Di Luggage Store"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Luggage Store / Di Gudang</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#002B5B]">{stats.inWarehouse}</span>
            <span className="text-xs text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">Active Safe</span>
          </div>
        </div>

        {/* Picked Up Stat Card */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'Sudah Diambil' ? 'All' : 'Sudah Diambil')}
          className={`lg:col-span-3 rounded-xl p-5 flex flex-col justify-center cursor-pointer transition-all duration-200 shadow-sm border ${
            statusFilter === 'Sudah Diambil'
              ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20 shadow-md scale-[1.02]'
              : 'bg-white border-slate-200/80 hover:border-emerald-400 hover:bg-slate-50/50'
          }`}
          title="Klik untuk memfilter: Sudah Diambil"
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sudah Diambil</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600">{stats.pickedUp}</span>
            <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">Delivered</span>
          </div>
        </div>

        {/* Avg Storage Stat Card */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 flex flex-col justify-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rata-Rata Penyimpanan</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-[#002B5B]">{formatAvgTime(stats.avgDeliverMinutes)}</span>
          </div>
        </div>

        {/* Quick Intake Banner Card */}
        <div className="lg:col-span-3 bg-amber-50 rounded-xl border border-amber-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-200 rounded-lg flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-900">Alur Penitipan</p>
            <p className="text-[10px] text-amber-800/80 leading-snug">Foto barang & info → Cetak QR → Scan saat tamu ambil.</p>
          </div>
        </div>

      </div>

      {/* Searching & Filters Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        
        {/* Row 1: Search & Export Button */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama tamu, nomor kamar, atau ID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={exportToExcel}
            className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export ke Excel (.csv)
          </button>
        </div>

        {/* Row 2: Date Filters & Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          
          {/* Date range start */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0 min-w-[30px]">Dari</span>
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
              />
            </div>
          </div>

          {/* Date range end */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0 min-w-[30px]">S/D</span>
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-medium cursor-pointer"
              />
            </div>
          </div>

          {/* Reset Date filter */}
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-[10px] text-[#002B5B] hover:underline font-semibold cursor-pointer py-1.5 px-2"
            >
              Reset Tanggal
            </button>
          )}

          <div className="flex flex-wrap gap-2 md:ml-auto w-full md:w-auto justify-end">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-medium"
              >
                <option value="All">Semua Status</option>
                <option value="Gudang">Di Gudang</option>
                <option value="Sudah Diambil">Sudah Diambil</option>
              </select>
            </div>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-medium"
            >
              <option value="All">Semua Handling</option>
              <option value="Koper">Koper</option>
              <option value="Kardus">Kardus</option>
              <option value="Tas Ransel">Tas Ransel</option>
              <option value="Lain Lain">Lain Lain</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e: any) => setSortOrder(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-medium"
            >
              <option value="newest">Paling Baru</option>
              <option value="oldest">Paling Lama</option>
            </select>
          </div>

        </div>

      </div>

      {/* Main List Table Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-400 bg-white border border-slate-200 rounded-2xl">
          <Loader2 className="w-8 h-8 animate-spin" />
          <div className="text-xs">Memuat data penitipan barang...</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-xs bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
          <AlertCircle className="w-8 h-8 text-slate-300" />
          <span>Tidak ada data penitipan barang yang cocok dengan kriteria pencarian Anda.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition-all duration-200 group relative"
            >
              
              {/* Card top banner/branding */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                    item.typeHandling === 'Kardus'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : item.typeHandling === 'Tas Ransel'
                      ? 'bg-purple-50 text-purple-700 border-purple-100'
                      : item.typeHandling === 'Lain Lain'
                      ? 'bg-slate-50 text-slate-700 border-slate-200'
                      : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {item.typeHandling}
                  </span>
                  <div className="text-[10px] font-mono font-bold text-[#002B5B] mt-1.5">{item.id}</div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                  item.status === 'Gudang'
                    ? 'bg-amber-50 text-amber-700 border-amber-200/60'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                }`}>
                  {item.status === 'Gudang' ? <Lock className="w-2 h-2" /> : <CheckCircle className="w-2 h-2" />}
                  {item.status === 'Gudang' ? 'DI GUDANG' : 'PICKED UP'}
                </span>
              </div>

              {/* Card Main Body */}
              <div className="p-5 flex gap-4 flex-1">
                {/* Photo layout */}
                <div className="w-20 h-20 bg-slate-50 border border-slate-200/80 rounded-xl overflow-hidden shrink-0 relative flex items-center justify-center group/img shadow-inner">
                  {item.photo ? (
                    <>
                      <img 
                        src={item.photo} 
                        alt="Preview" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover" 
                      />
                      <button
                        onClick={() => setActivePhoto(item.photo)}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer"
                        title="Perbesar Foto"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="w-5 h-5 text-slate-300" />
                  )}
                </div>

                {/* Details layout */}
                <div className="space-y-2 flex-1 min-w-0">
                  <h4 className="font-extrabold text-slate-800 text-xs truncate uppercase tracking-tight" title={item.namaTamu}>
                    {item.namaTamu}
                  </h4>
                  
                  <div className="inline-flex items-center gap-1 text-[10px] text-[#002B5B] font-bold bg-blue-50/50 border border-blue-100 px-2 py-0.5 rounded-md font-mono">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Kamar {item.roomNumber}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Masuk: {item.date} {item.time}</span>
                  </div>

                  {item.status === 'Sudah Diambil' && (
                    <div className="text-[10px] text-emerald-600 font-semibold leading-relaxed pt-1.5 border-t border-slate-100 mt-1.5">
                      <div>Keluar: {item.dateDelivered} {item.timeDelivered}</div>
                      <div>Oleh: {item.handleBy || '-'}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onPrintRequest(item)}
                    className="p-2 bg-white border border-slate-200 hover:border-[#002B5B] text-[#002B5B] hover:bg-slate-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                    title="Cetak Receipt"
                  >
                    <Printer className="w-4 h-4" />
                  </button>

                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteItem(item.id, item.namaTamu)}
                      className="p-2 bg-white border border-slate-200 hover:border-red-500 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center justify-center shadow-sm"
                      title="Hapus Data"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {item.status === 'Gudang' && (
                  <button
                    onClick={() => handleDeliverLuggage(item)}
                    className="px-3 py-1.5 bg-[#002B5B] hover:bg-blue-800 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1 shadow-sm shadow-blue-900/10"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Deliver / Ambil
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {activePhoto && (
        <div 
          className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-800">
            <img 
              src={activePhoto} 
              alt="Baggage snapshot full size" 
              referrerPolicy="no-referrer"
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 py-1.5 px-3 bg-black/60 hover:bg-black text-white text-xs rounded-lg font-bold transition-all shadow cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Custom Deliver Confirmation Modal */}
      {deliverConfirmItem && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-[#002B5B] mb-4">
              <CheckCircle className="w-5 h-5 shrink-0 text-[#002B5B] animate-pulse" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Konfirmasi Penyerahan Barang</h3>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-5 space-y-1.5 text-xs text-slate-700">
              <div><strong>ID Penitipan:</strong> <span className="font-mono">{deliverConfirmItem.id}</span></div>
              <div><strong>Nama Tamu:</strong> {deliverConfirmItem.namaTamu}</div>
              <div><strong>Nomor Kamar:</strong> Kamar {deliverConfirmItem.roomNumber}</div>
              <div><strong>Handling Type:</strong> {deliverConfirmItem.typeHandling}</div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Apakah Anda yakin ingin menyerahkan barang titipan ini kepada tamu? Status barang akan diubah menjadi <strong>SUDAH DIAMBIL</strong>.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeliverConfirmItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => executeDeliverLuggage(deliverConfirmItem)}
                className="px-4 py-2 bg-[#002B5B] hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-blue-900/10"
              >
                Ya, Serahkan Barang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-100 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 animate-bounce" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Hapus Permanen Data</h3>
            </div>
            <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-5 space-y-1.5 text-xs text-slate-700">
              <div><strong>ID Penitipan:</strong> <span className="font-mono">{deleteConfirmItem.id}</span></div>
              <div><strong>Nama Tamu:</strong> {deleteConfirmItem.namaTamu}</div>
              <div><strong>Nomor Kamar:</strong> Kamar {deleteConfirmItem.roomNumber}</div>
            </div>
            <p className="text-xs text-red-600 font-medium leading-relaxed mb-6">
              PERINGATAN: Apakah Anda yakin ingin menghapus secara permanen data penitipan barang ini? Tindakan ini tidak dapat dibatalkan atau dikembalikan.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => executeDeleteItem(deleteConfirmItem)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-red-600/10"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
