import React, { useState, useEffect } from 'react';
import AstonLogo from './AstonLogo';
import { 
  auth, 
  db,
  doc,
  getDoc,
  setDoc,
  GoogleAuthProvider,
  signInWithPopup
} from '../firebase';
import { seedInitialUsers } from '../utils/seed';
import { ShieldAlert, Loader2, Globe, Sparkles, Send } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: { uid: string; email: string; name: string; role: 'admin' | 'staff'; approved?: boolean }) => void;
  onEnterPublicForm: () => void;
}

export default function Login({ onLoginSuccess, onEnterPublicForm }: LoginProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const uid = user.uid;
      const email = user.email || '';
      const name = user.displayName || 'Staff Google';
      const isITM = email.toLowerCase() === 'itm@astoncirebon.com';

      // Check if user exists in Firestore
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        let role = (userData.role as 'admin' | 'staff') || 'staff';
        let approved = userData.approved;

        if (isITM) {
          role = 'admin';
          approved = true;
          if (userData.role !== 'admin' || userData.approved !== true) {
            await setDoc(userDocRef, { ...userData, role: 'admin', approved: true }, { merge: true });
          }
        }

        onLoginSuccess({
          uid,
          email: userData.email || email,
          name: userData.name || name,
          role: role,
          approved: approved
        });
      } else {
        // Automatically register
        const role = isITM ? 'admin' : 'staff';
        const approved = isITM ? true : false; // Staff needs approval

        const newUserProfile = {
          uid,
          email,
          name,
          role,
          approved,
          createdAt: new Date().toISOString()
        };
        
        await setDoc(userDocRef, newUserProfile);

        onLoginSuccess({
          uid,
          email,
          name,
          role,
          approved
        });
      }
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Proses login dibatalkan karena jendela pop-up ditutup.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Metode Login Google belum diaktifkan di Firebase Console Anda. Silakan aktifkan provider Google di Firebase Authentication.');
      } else {
        setError(`Gagal login dengan Google: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-seed the database with default users on mount
  useEffect(() => {
    const runSeeding = async () => {
      setIsSeeding(true);
      const res = await seedInitialUsers();
      if (res.success) {
        if (res.message !== 'Already seeded') {
          setInfoMessage('Sistem berhasil di-inisialisasi dengan akun default ASTON.');
        }
      } else if (res.error === 'auth/operation-not-allowed') {
        setError(res.message || 'Provider Email/Password belum diaktifkan di Firebase Console.');
      } else {
        setError(`Inisialisasi sistem gagal: ${res.error}`);
      }
      setIsSeeding(false);
    };
    runSeeding();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001736] via-[#002B5B] to-[#003B7B] p-4 font-sans relative overflow-hidden">
      {/* Decorative backdrop elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
 
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 relative z-10">
        {/* Banner with Hotel Branding */}
        <div className="bg-white px-8 pt-9 pb-6 text-center border-b border-slate-100 relative flex flex-col items-center">
          <AstonLogo className="w-full max-w-[220px]" variant="color" />
          <div className="mt-3.5 px-3 py-1 bg-amber-50 rounded-full border border-amber-200/50 text-[#002B5B] font-bold text-[9px] tracking-wider uppercase">
            Luggage & Deposit Management
          </div>
        </div>
 
        <div className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 leading-relaxed font-medium">
                {error}
              </div>
            </div>
          )}
 
          {infoMessage && (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-xs text-amber-800 leading-relaxed font-medium">
              {infoMessage}
            </div>
          )}

          {/* Section 1: Staff Google Login */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Portal Internal Staff</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Otorisasi khusus admin & staff concierge</p>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3.5 border border-slate-200 hover:border-amber-400 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2.5 bg-white shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  Menghubungkan Google...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.3 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.1 3.66-5.18 3.66-8.56z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.15C3.18 21.88 7.31 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.32 14.24A7.16 7.16 0 0 1 4.91 12c0-.79.13-1.57.37-2.31V6.54H1.21A11.94 11.94 0 0 0 0 12c0 2.01.5 3.91 1.38 5.61l3.94-3.37z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.18 2.12 1.21 5.61l4.11 3.2C6.26 5.86 8.89 4.75 12 4.75z"/>
                  </svg>
                  Masuk dengan Google
                </>
              )}
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-3 text-slate-300 text-[9px] font-bold uppercase tracking-wider">Atau Layanan Publik</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          {/* Section 2: Public Deposit Form Button */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Penitipan Barang Mandiri</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Proses cepat khusus Makanan, Minuman, & Barang publik</p>
            </div>

            <button
              type="button"
              onClick={onEnterPublicForm}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 animate-pulse text-amber-100" />
              Mulai Penitipan Barang Publik
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

