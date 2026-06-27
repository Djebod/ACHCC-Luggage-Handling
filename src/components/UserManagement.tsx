import React, { useState, useEffect } from 'react';
import { 
  db, 
  secondaryAuth, 
  createUserWithEmailAndPassword, 
  signOut,
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  onSnapshot
} from '../firebase';
import { AppUser } from '../types';
import { UserPlus, Trash2, Shield, User, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    // Real-time listener on the users collection
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        fetchedUsers.push(docSnap.data() as AppUser);
      });
      
      // Sort in-memory to prevent index requirements & handle any missing createdAt fields gracefully
      fetchedUsers.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      
      setUsers(fetchedUsers);
      setIsLoading(false);
    }, (err) => {
      console.error('Error listening to users collection:', err);
      setError(`Gagal memuat daftar pengguna: ${err.message}`);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Harap lengkapi semua kolom input.');
      return;
    }
    if (password.length < 6) {
      setError('Password harus berukuran minimal 6 karakter.');
      return;
    }

    setIsAdding(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Create in Firebase Auth using the secondary app
      // This is crucial: it prevents signing out the current Admin session on the primary app
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
      const uid = credential.user.uid;

      // 2. Save user metadata to Firestore
      const newUser: AppUser = {
        uid,
        email: email.trim(),
        name: name.trim(),
        role,
        approved: true, // Manually created users are approved by default
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), newUser);

      // 3. Immediately sign out from the secondary app to clean up its session state
      await signOut(secondaryAuth);

      setSuccess(`User "${name}" berhasil ditambahkan.`);
      setName('');
      setEmail('');
      setPassword('');
      setRole('staff');
    } catch (err: any) {
      console.error('Error adding user:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Alamat email sudah terdaftar di sistem.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Format email tidak valid.');
      } else {
        setError(`Gagal menambahkan user: ${err.message}`);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleApproval = async (user: AppUser) => {
    try {
      setError(null);
      setSuccess(null);
      const userDocRef = doc(db, 'users', user.uid);
      const newApprovalStatus = !user.approved;
      
      await setDoc(userDocRef, { approved: newApprovalStatus }, { merge: true });
      
      setSuccess(`Status persetujuan user "${user.name}" berhasil diubah menjadi ${newApprovalStatus ? 'DISETUJUI' : 'MENUNGGU PERSETUJUAN'}.`);
    } catch (err: any) {
      console.error('Error toggling user approval:', err);
      setError(`Gagal mengubah status persetujuan: ${err.message}`);
    }
  };

  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AppUser | null>(null);

  const handleDeleteUser = (uid: string, userName: string) => {
    const user = users.find(u => u.uid === uid);
    if (user) {
      setDeleteConfirmUser(user);
    }
  };

  const executeDeleteUser = async (user: AppUser) => {
    try {
      setError(null);
      setSuccess(null);
      
      // Delete document from Firestore users collection
      // Once removed here, the custom auth checks in login will refuse entrance
      await deleteDoc(doc(db, 'users', user.uid));
      setSuccess(`User "${user.name}" berhasil dihapus dari daftar otorisasi.`);
      setDeleteConfirmUser(null);
    } catch (err: any) {
      console.error('Error deleting user document:', err);
      setError(`Gagal menghapus user: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-[#002B5B]">
            Manajemen Pengguna (User Management)
          </h1>
          <p className="text-xs text-slate-500">
            Kelola otorisasi admin dan staff untuk aplikasi penitipan barang ASTON Cirebon
          </p>
        </div>
        <button
          onClick={() => {
            setSuccess('Daftar pengguna telah sinkron dengan server.');
            setTimeout(() => setSuccess(null), 3000);
          }}
          className="p-2 text-slate-500 hover:text-[#002B5B] hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Daftar Sinkron (Otomatis)
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-xs text-red-700 leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div className="text-xs text-green-700 leading-relaxed font-medium">{success}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form Add User */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserPlus className="w-4.5 h-4.5 text-amber-500" />
            Tambah User Baru
          </h2>

          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Reza Rahadian"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reza@astoncirebon.com"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Password (min. 6 karakter)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password rahasia"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Role / Hak Akses
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('staff')}
                  className={`py-2 px-3 rounded-xl border text-center transition-all text-xs font-semibold cursor-pointer ${
                    role === 'staff'
                      ? 'border-[#002B5B] bg-blue-50 text-[#002B5B]'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  Staff (Input/Scan)
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`py-2 px-3 rounded-xl border text-center transition-all text-xs font-semibold cursor-pointer ${
                    role === 'admin'
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 inline mr-1" />
                  Admin
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isAdding}
              className="w-full py-2.5 bg-[#002B5B] hover:bg-blue-800 text-white font-semibold text-xs rounded-xl transition-all shadow active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-4"
            >
              {isAdding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mendaftarkan...
                </>
              ) : (
                'Daftarkan Pengguna'
              )}
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4.5 h-4.5 text-[#002B5B]" />
            Daftar Pengguna Terdaftar ({users.length})
          </h2>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <div className="text-xs">Memuat daftar user...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs italic">
              Belum ada pengguna terdaftar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <th className="py-3 px-4 font-bold uppercase">Nama / Email</th>
                    <th className="py-3 px-4 font-bold uppercase">Role</th>
                    <th className="py-3 px-4 font-bold uppercase">Persetujuan</th>
                    <th className="py-3 px-4 font-bold uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                       <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          {user.name}
                          {user.email.toLowerCase() === 'itm@astoncirebon.com' && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[9px] rounded font-bold uppercase">ITM</span>
                          )}
                        </div>
                        <div className="text-slate-400 text-[11px] font-mono">{user.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'admin'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/50'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {user.role === 'admin' ? <Shield className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {user.role === 'admin' || user.email.toLowerCase() === 'itm@astoncirebon.com' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 border border-green-200/50 rounded-full text-[9px] font-bold uppercase tracking-wider">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Selalu Aktif
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            user.approved
                              ? 'bg-green-100 text-green-800 border border-green-200/50'
                              : 'bg-yellow-50 text-yellow-700 border border-yellow-200/50'
                          }`}>
                            {user.approved ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                            {user.approved ? 'Disetujui' : 'Tertunda'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {user.role !== 'admin' && user.email.toLowerCase() !== 'itm@astoncirebon.com' && (
                            <button
                              onClick={() => handleToggleApproval(user)}
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all active:scale-[0.97] cursor-pointer ${
                                user.approved
                                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                                  : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                              }`}
                            >
                              {user.approved ? 'Tolak Akses' : 'Setujui Akses'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(user.uid, user.name)}
                            disabled={user.email.toLowerCase() === 'itm@astoncirebon.com'}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center disabled:opacity-30 disabled:pointer-events-none"
                            title="Hapus user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Custom Delete User Confirmation Modal */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 bg-black/65 flex items-center justify-center z-50 p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-100 transform scale-100 transition-all">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500 animate-pulse" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">Hapus Otorisasi Pengguna</h3>
            </div>
            <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-5 space-y-1 text-xs text-slate-700">
              <div><strong>Nama:</strong> {deleteConfirmUser.name}</div>
              <div><strong>Email:</strong> {deleteConfirmUser.email}</div>
              <div><strong>Role:</strong> <span className="uppercase">{deleteConfirmUser.role}</span></div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus pengguna ini dari daftar otorisasi? Pengguna ini tidak akan dapat login lagi ke sistem ASTON Cirebon.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => executeDeleteUser(deleteConfirmUser)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-sm shadow-red-600/10"
              >
                Ya, Hapus Pengguna
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
