import React, { useState, useEffect } from 'react';
import { db, doc, getDoc, setDoc } from '../firebase';
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '../utils/sheetSync';
import { Settings, Save, Copy, Check, Info, Loader2, Link2, ExternalLink } from 'lucide-react';

interface SyncSettingsModalProps {
  onClose?: () => void;
}

export default function SyncSettingsModal({ onClose }: SyncSettingsModalProps) {
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, 'settings', 'sync');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setGoogleSheetUrl(docSnap.data().googleSheetUrl || '');
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await setDoc(doc(db, 'settings', 'sync'), {
        googleSheetUrl: googleSheetUrl.trim()
      }, { merge: true });

      setMessage({ type: 'success', text: 'URL Sinkronisasi Google Sheets berhasil disimpan!' });
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setMessage({ type: 'error', text: `Gagal menyimpan: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#002B5B] flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            Sinkronisasi Google Sheet & AppScript
          </h2>
          <p className="text-xs text-slate-500">
            Hubungkan database aplikasi ke Google Sheet Anda secara real-time
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 border-l-4 rounded-r-lg text-xs font-semibold ${
          message.type === 'success' 
            ? 'bg-emerald-50 border-emerald-500 text-emerald-800' 
            : 'bg-red-50 border-red-500 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Connection Setup */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-[#002B5B]" />
            Koneksi Web App URL
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tempelkan URL Web App hasil deploy Google Apps Script Anda ke kotak input di bawah untuk mengaktifkan fitur pencatatan ganda ke Google Sheets.
          </p>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                Google Apps Script Web App URL
              </label>
              <input
                type="url"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-400 font-mono"
                disabled={isLoading}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="flex-1 py-2 px-4 bg-[#002B5B] hover:bg-blue-800 text-white font-semibold text-xs rounded-xl transition-all shadow cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Simpan Konfigurasi
                  </>
                )}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-200 text-slate-600 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Tutup
                </button>
              )}
            </div>
          </form>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-[11px] text-amber-900 leading-relaxed">
            <div className="font-bold flex items-center gap-1 text-amber-950">
              <Info className="w-4 h-4 shrink-0 text-amber-600" />
              Cara Penggunaan & Setup Sheet:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-amber-800">
              <li>Buat Google Sheet baru bertema penitipan barang.</li>
              <li>Pastikan baris pertama berisi kolom header persis seperti kode di sebelah kanan.</li>
              <li>Buka menu <strong>Extensions &gt; Apps Script</strong>.</li>
              <li>Salin kode di sebelah kanan dan tempel di editor Apps Script.</li>
              <li>Deploy sebagai <strong>Web App</strong> dengan akses <strong>"Anyone"</strong>.</li>
              <li>Salin URL deployment dan simpan di form atas.</li>
            </ol>
          </div>
        </div>

        {/* Script copy view */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 text-white flex flex-col h-[380px]">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Google Apps Script Code (index.js)
            </span>
            <button
              onClick={copyScriptToClipboard}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Salin Berhasil
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Salin Kode
                </>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] font-mono leading-relaxed text-slate-300">
            <pre>{GOOGLE_APPS_SCRIPT_TEMPLATE}</pre>
          </div>
        </div>

      </div>
    </div>
  );
}
