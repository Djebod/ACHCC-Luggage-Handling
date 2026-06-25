import React, { useState, useEffect } from 'react';
import { 
  auth, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  db,
  doc,
  getDoc,
  setDoc
} from '../firebase';
import { seedInitialUsers } from '../utils/seed';
import { KeyRound, Mail, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: { uid: string; email: string; name: string; role: 'admin' | 'staff' }) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isResetMode, setIsResetMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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
        setError(res.message || 'Provider Email/Password belum diaktifkan di Firebase Console Anda.');
      } else {
        setError(`Inisialisasi sistem gagal: ${res.error}`);
      }
      setIsSeeding(false);
    };
    runSeeding();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      // 1. Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;

      // 2. Fetch user profile from Firestore 'users' collection to check roles and verify active status
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        onLoginSuccess({
          uid,
          email: userData.email,
          name: userData.name,
          role: userData.role as 'admin' | 'staff'
        });
      } else {
        // Automatically check if this is one of our default seed accounts
        const defaultUsers = [
          { email: 'itm@astoncirebon.com', name: 'IT Manager ASTON', role: 'admin' as const },
          { email: 'admin@aston.com', name: 'Admin Luggage', role: 'admin' as const },
          { email: 'staff@aston.com', name: 'Staff Luggage', role: 'staff' as const }
        ];
        const matchingDefault = defaultUsers.find(u => u.email === email.trim().toLowerCase());
        if (matchingDefault) {
          try {
            await setDoc(userDocRef, {
              uid,
              email: matchingDefault.email,
              name: matchingDefault.name,
              role: matchingDefault.role,
              createdAt: new Date().toISOString()
            });
            onLoginSuccess({
              uid,
              email: matchingDefault.email,
              name: matchingDefault.name,
              role: matchingDefault.role
            });
            return;
          } catch (createErr: any) {
            console.error('Failed to auto-create default user profile:', createErr);
          }
        }
        
        // If Firestore document doesn't exist, they are either deleted or not provisioned
        await auth.signOut();
        setError('Akun Anda tidak terdaftar di sistem otorisasi (Firestore). Hubungi Admin.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email atau password salah.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Provider Email/Password belum diaktifkan di Firebase Console Anda. Silakan buka Firebase Console -> Authentication -> Sign-in method, lalu aktifkan provider Email/Password.');
      } else {
        setError(`Gagal login: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Masukkan email Anda terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfoMessage('Email reset password telah dikirim. Silakan periksa kotak masuk Anda.');
      setIsResetMode(false);
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Email tidak terdaftar di sistem Auth.');
      } else {
        setError(`Gagal mengirim email reset: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (uEmail: string) => {
    setEmail(uEmail);
    setPassword('aston123');
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001736] via-[#002B5B] to-[#003B7B] p-4 font-sans relative overflow-hidden">
      {/* Decorative backdrop elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
 
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 relative z-10">
        {/* Banner with Hotel Branding */}
        <div className="bg-[#002B5B] p-8 text-center border-b-4 border-amber-400 relative">
          <div className="text-amber-400 font-serif tracking-widest text-xs uppercase font-extrabold mb-1">
            ASTON CIREBON
          </div>
          <h1 className="text-white text-xl font-serif font-bold tracking-tight">
            Hotel & Convention Center
          </h1>
          <p className="text-slate-300 text-xs mt-2 font-light">
            Sistem Manajemen Penitipan Barang Tamu (Luggage Management)
          </p>
        </div>
 
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="text-xs text-red-700 leading-relaxed font-medium">
                {error}
              </div>
            </div>
          )}
 
          {infoMessage && (
            <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-xs text-amber-800 leading-relaxed font-medium">
              {infoMessage}
            </div>
          )}
 
          {!isResetMode ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Email Kantor / Staff
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@astoncirebon.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>
 
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-xs text-amber-600 hover:text-amber-700 font-extrabold transition-colors cursor-pointer"
                  >
                    Lupa Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#002B5B] hover:bg-[#114488] text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-900/10 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menghubungkan...
                  </>
                ) : (
                  'Masuk ke Dashboard'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <h2 className="text-base font-bold text-slate-800">Lupa Password?</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Masukkan alamat email yang terdaftar. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Alamat Email
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@astoncirebon.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setError(null);
                    setInfoMessage(null);
                  }}
                  className="w-1/2 py-2.5 border border-slate-200 text-slate-600 font-medium text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  disabled={isLoading}
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-800 font-extrabold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Kirim Tautan
                </button>
              </div>
            </form>
          )}

          {/* Quick-fill section to ease previewing */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
              <span>Akun Demo ASTON</span>
              {isSeeding && (
                <span className="flex items-center gap-1 text-amber-500">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Initializing...
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('ITM@astoncirebon.com')}
                className="p-2 text-left bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors cursor-pointer"
              >
                <div className="text-[10px] font-bold text-slate-700">Admin (ITM)</div>
                <div className="text-[9px] text-slate-400 truncate">ITM@astoncirebon.com</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('staff@aston.com')}
                className="p-2 text-left bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors cursor-pointer"
              >
                <div className="text-[10px] font-bold text-slate-700">Staff</div>
                <div className="text-[9px] text-slate-400 truncate">staff@aston.com</div>
              </button>
            </div>
            <div className="text-[10px] text-slate-400 text-center mt-3 italic">
              Password default semua akun: <strong className="text-slate-600 font-mono text-[11px]">aston123</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
