import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, signOut } from './firebase';
import { LuggageItem } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import LuggageInput from './components/LuggageInput';
import LuggageScanner from './components/LuggageScanner';
import UserManagement from './components/UserManagement';
import SyncSettingsModal from './components/SyncSettingsModal';
import PrintReceipt from './components/PrintReceipt';
import { 
  Archive, 
  PlusCircle, 
  QrCode, 
  Users, 
  Settings, 
  LogOut, 
  Loader2, 
  Shield, 
  Printer, 
  CheckCircle, 
  AlertTriangle,
  Info,
  ExternalLink
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string; name: string; role: 'admin' | 'staff' } | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'input' | 'scan' | 'users' | 'settings'>('dashboard');
  
  // State for printable ticket data
  const [printTarget, setPrintTarget] = useState<LuggageItem | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Monitor Firebase auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser) {
        try {
          // Fetch user metadata/role from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            setCurrentUser({
              uid: firebaseUser.uid,
              email: userData.email,
              name: userData.name,
              role: userData.role as 'admin' | 'staff'
            });
          } else {
            // Profile document missing or deleted, sign them out
            await signOut(auth);
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('Error fetching user metadata:', err);
          await signOut(auth);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setPrintTarget(null);
      setActiveTab('dashboard');
      setShowLogoutConfirm(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Trigger print receipt flow
  const handlePrintRequest = (item: LuggageItem) => {
    setPrintTarget(item);
    setShowPrintModal(true);
    // Try to trigger printer prompt automatically, but wrap in try-catch in case of iframe restrictions
    setTimeout(() => {
      try {
        window.print();
      } catch (err) {
        console.error('Initial iframe print blocked or failed:', err);
      }
    }, 300);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#002B5B] text-white font-sans gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        <div className="text-xs uppercase tracking-widest font-semibold text-slate-300">
          Memuat Sistem ASTON...
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!currentUser) {
    return (
      <Login 
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setActiveTab('dashboard');
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F3F6] font-sans flex flex-col justify-between text-slate-800 antialiased">
      
      {/* 1. Header (Navbar) - Hidden on Receipt Printing */}
      <header className="no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            
            {/* Logo Brand */}
            <div className="flex items-center gap-4">
              <div className="h-11 w-11 bg-[#002B5B] rounded-xl flex items-center justify-center font-serif font-bold text-white text-lg shadow-md border border-blue-900/10">
                A
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-serif uppercase tracking-widest font-bold text-[#002B5B]">
                    ASTON CIREBON
                  </span>
                  <span className="bg-emerald-100 text-emerald-700 text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-tight flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Firebase Live
                  </span>
                </div>
                <div className="text-sm font-bold tracking-tight text-slate-500 leading-tight">
                  Luggage & Deposit Management System
                </div>
              </div>
            </div>

            {/* Profile Welcome and Logout */}
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
              <div className="text-left">
                <div className="text-xs font-bold text-slate-800">{currentUser.name}</div>
                <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1 font-semibold uppercase mt-0.5">
                  {currentUser.role === 'admin' ? (
                    <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-0.5">
                      <Shield className="w-2.5 h-2.5" />
                      Administrator
                    </span>
                  ) : (
                    <span className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                      CONCIERGE STAFF
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={handleLogoutClick}
                className="p-2 bg-slate-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-500 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-sm"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* 2. Primary Layout Grid - Hidden on Receipt Printing */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 no-print">
        
        {/* Navigation Sidebar & Controls */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* Left Side: Tabs buttons */}
          <nav className="w-full lg:w-64 bg-[#002B5B] text-white rounded-2xl p-5 shadow-lg border border-blue-950/40 space-y-2 flex flex-col shrink-0">
            
            <div className="pb-3 border-b border-blue-900/50 mb-2">
              <p className="text-[9px] uppercase tracking-widest text-amber-400 font-extrabold">MENU NAVIGATION</p>
            </div>

            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'dashboard'
                  ? 'bg-amber-400 text-[#002B5B] shadow-md shadow-amber-400/20 font-extrabold'
                  : 'text-white/80 hover:bg-blue-800/40 hover:text-white'
              }`}
            >
              <Archive className="w-4 h-4" />
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('input')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'input'
                  ? 'bg-amber-400 text-[#002B5B] shadow-md shadow-amber-400/20 font-extrabold'
                  : 'text-white/80 hover:bg-blue-800/40 hover:text-white'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Input Penitipan
            </button>

            <button
              onClick={() => setActiveTab('scan')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'scan'
                  ? 'bg-amber-400 text-[#002B5B] shadow-md shadow-amber-400/20 font-extrabold'
                  : 'text-white/80 hover:bg-blue-800/40 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Scan Checkout
            </button>

            {/* Admin-only Navigation tabs */}
            {currentUser.role === 'admin' && (
              <>
                <div className="h-px bg-blue-900/50 my-2" />
                <div className="text-[9px] uppercase tracking-widest text-white/40 font-bold px-4 mb-1">System Controls</div>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'users'
                      ? 'bg-amber-400 text-[#002B5B] shadow-md shadow-amber-400/20 font-extrabold'
                      : 'text-white/80 hover:bg-blue-800/40 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  Kelola Pengguna
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === 'settings'
                      ? 'bg-amber-400 text-[#002B5B] shadow-md shadow-amber-400/20 font-extrabold'
                      : 'text-white/80 hover:bg-blue-800/40 hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Google Sheet Sync
                </button>
              </>
            )}

          </nav>

          {/* Right Side: Tab panel viewports */}
          <div className="flex-1 w-full min-w-0">
            {activeTab === 'dashboard' && (
              <Dashboard 
                currentUser={currentUser} 
                onPrintRequest={handlePrintRequest} 
              />
            )}

            {activeTab === 'input' && (
              <LuggageInput 
                currentUser={currentUser} 
                onSuccess={() => {}} 
                onPrintRequest={handlePrintRequest} 
              />
            )}

            {activeTab === 'scan' && (
              <LuggageScanner 
                currentUser={currentUser} 
                onStatusUpdated={() => {}} 
              />
            )}

            {activeTab === 'users' && currentUser.role === 'admin' && (
              <UserManagement />
            )}

            {activeTab === 'settings' && currentUser.role === 'admin' && (
              <SyncSettingsModal />
            )}
          </div>

        </div>
      </main>

      {/* 3. Footer Area - Hidden on Receipt Printing */}
      <footer className="bg-[#002B5B] text-slate-400 text-[10px] py-4 text-center border-t border-blue-950 no-print">
        <div className="max-w-7xl mx-auto px-4 font-mono">
          &copy; {new Date().getFullYear()} ASTON Cirebon Hotel & Convention Center. Powered by Firebase Firestore.
        </div>
      </footer>

      {/* 4. Printing receipt target container - ONLY visible during print actions */}
      <PrintReceipt item={printTarget} />

      {/* 5. Custom Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <LogOut className="w-5 h-5 shrink-0 animate-pulse" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Konfirmasi Keluar</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Apakah Anda yakin ingin keluar dari aplikasi Luggage & Deposit ASTON Cirebon?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleLogoutConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-red-600/10"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Custom Print Preview Modal */}
      {showPrintModal && printTarget && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50 p-4 animate-fade-in no-print overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 transform scale-100 transition-all flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-2.5 text-[#002B5B]">
                <Printer className="w-5 h-5 shrink-0 text-amber-500" />
                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Preview Receipt Bukti</h3>
              </div>
              <button 
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintTarget(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Scrollable container for thermal receipt visual preview */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200/65">
              <PrintReceipt item={printTarget} isPreview={true} />
            </div>

            {/* Iframe advice warning banner */}
            <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-3 mb-4 flex gap-2 text-amber-800 shrink-0">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[10px] leading-relaxed">
                <strong className="font-semibold text-amber-950 block mb-0.5">Petunjuk Cetak Printer</strong>
                Jika printer fisik Anda tidak merespon saat menekan tombol cetak, silakan klik tombol <strong>"Open in New Tab"</strong> di bagian pojok kanan atas aplikasi Anda untuk melakukan cetak fisik secara langsung tanpa hambatan iframe sandbox.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 justify-end shrink-0">
              <button
                onClick={() => {
                  setShowPrintModal(false);
                  setPrintTarget(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  try {
                    window.print();
                  } catch (err) {
                    console.error('Manual print call failed:', err);
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-emerald-600/10 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
