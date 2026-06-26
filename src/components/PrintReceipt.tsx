import { LuggageItem } from '../types';
import { ShieldCheck, Info } from 'lucide-react';

interface PrintReceiptProps {
  item: LuggageItem | null;
  isPreview?: boolean;
}

export default function PrintReceipt({ item, isPreview = false }: PrintReceiptProps) {
  if (!item) return null;

  return (
    <div 
      id={isPreview ? undefined : "print-receipt-section"} 
      className={`${
        isPreview 
          ? "block text-slate-800 bg-white p-6 font-mono max-w-full sm:max-w-[80mm] mx-auto text-center border border-slate-200 rounded-2xl shadow-inner" 
          : "hidden print:block bg-white text-black p-6 font-mono max-w-[80mm] mx-auto text-center border-2 border-slate-200"
      }`}
    >
      {/* Hotel Brand Header */}
      <div className="border-b-2 border-dashed border-black pb-4 mb-4">
        <h1 className="text-sm font-bold tracking-widest uppercase">ASTON CIREBON</h1>
        <h2 className="text-[10px] font-bold tracking-tight uppercase">Hotel & Convention Center</h2>
        <p className="text-[8px] text-black font-semibold mt-1">
          Jl. Brigjend Dharsono No. 12C, Cirebon<br />
          Telp: +62 231 8298000
        </p>
      </div>

      {/* Luggage ID Tag */}
      <div className="mb-4">
        <div className="text-[9px] uppercase tracking-wider text-black font-bold">LUGGAGE BAGGAGE TICKET</div>
        <div className="text-base font-bold tracking-wider my-1 border-2 border-black py-1.5 bg-black/5 rounded font-mono text-black">
          {item.id}
        </div>
        <div className="text-[9px] text-black font-bold">Status: {item.status.toUpperCase()}</div>
      </div>

      {/* QR Code */}
      <div className="flex justify-center my-4">
        {item.qrCode ? (
          <img 
            src={item.qrCode} 
            alt="Baggage QR Code" 
            className="w-40 h-40 object-contain p-1 border border-black"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-32 h-32 border border-dashed border-black flex items-center justify-center text-xs">
            [QR Code]
          </div>
        )}
      </div>

      {/* Receipt Details Table */}
      <div className="text-left text-[10px] space-y-1.5 border-t-2 border-b-2 border-dashed border-black py-4 my-4">
        <div className="flex justify-between">
          <span className="text-black font-bold">GUEST NAME:</span>
          <span className="font-bold uppercase text-right max-w-[150px] truncate">{item.namaTamu}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-black font-bold">ROOM NUMBER:</span>
          <span className="font-bold">{item.roomNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-black font-bold">HANDLING:</span>
          <span className="font-bold uppercase">{item.typeHandling}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-black font-bold">DEPOSIT DATE:</span>
          <span className="font-bold">{item.date} {item.time}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-black font-bold">RECEIVED BY:</span>
          <span className="font-bold uppercase truncate max-w-[120px]">{item.receiveBy}</span>
        </div>
        {item.remark && (
          <div className="border-t border-black/20 pt-1.5 mt-1.5">
            <span className="text-black block text-[9px] font-bold uppercase">REMARK:</span>
            <span className="italic block mt-0.5 text-[9px] text-black font-bold font-mono">&quot;{item.remark}&quot;</span>
          </div>
        )}
      </div>

      {/* Terms and Policies */}
      <div className="space-y-2 mt-4 text-[8px] text-black font-bold leading-normal text-left font-mono">
        <div className="flex items-start gap-1">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-black inline mt-0.5" strokeWidth={2.5} />
          <span>Simpan receipt ini dengan baik. Bukti ini wajib diserahkan kembali ke staff concierge saat pengambilan barang bawaan Anda.</span>
        </div>
        <div className="flex items-start gap-1">
          <Info className="w-3.5 h-3.5 shrink-0 text-black inline mt-0.5" strokeWidth={2.5} />
          <span>ASTON Cirebon tidak bertanggung jawab atas kerusakan atau kehilangan barang di luar syarat & ketentuan hotel.</span>
        </div>
      </div>

      {/* Footer thank you */}
      <div className="mt-6 pt-3 border-t-2 border-dashed border-black text-[9px] font-bold uppercase tracking-wider">
        Thank you for choosing ASTON Cirebon
      </div>
    </div>
  );
}
