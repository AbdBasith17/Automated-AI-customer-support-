import { useState } from "react";
import { authApi } from "../api/auth"; 
import { toast } from "sonner";

export default function MFASetupModal({ qrCode, onSuccess, onClose }) {
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      return toast.error("Invalid Code", { description: "Please enter all 6 digits." });
    }

    setIsVerifying(true);
    const { data, error } = await authApi.activateMfa(otp);

    if (error) {
      toast.error("Verification Failed", { 
        description: error.message || "The code is incorrect or has expired." 
      });
      setIsVerifying(false);
    } else {
      toast.success("Security Active", { description: "MFA is now enabled on your account." });
      onSuccess(); 
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
      {/* Modal Container */}
      <div className="relative w-full max-w-[440px] bg-white rounded-[3rem] p-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Aesthetic Glows */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full" />
        
        <div className="relative z-10 text-center">
          <header className="mb-8">
            <span className="font-mono text-[10px] font-black tracking-[0.3em] text-indigo-600 uppercase bg-indigo-50 px-4 py-1.5 rounded-full">
              Identity Sync
            </span>
            <h2 className="mt-6 text-2xl font-black italic tracking-tighter text-slate-950 uppercase">
              MFA Configuration
            </h2>
          </header>

          {/* STEP 1: Scan */}
          <div className="flex flex-col items-center">
            <div className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-inner">
              <img src={qrCode} alt="MFA QR Code" className="w-40 h-40 mix-blend-multiply" />
            </div>
            <p className="mt-6 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] max-w-[240px]">
              Step 1: Scan with Google Authenticator or Authy
            </p>
          </div>

          {/* STEP 2: Input */}
          <div className="mt-10 pt-8 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-950 uppercase tracking-[0.2em] mb-4">
              Step 2: Enter 6-Digit Verification Code
            </p>
            <input 
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              maxLength="6"
              placeholder="000 000"
              className="w-full text-center font-mono text-3xl tracking-[0.5em] py-5 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-950 outline-none shadow-sm"
            />
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col gap-3">
            <button 
              onClick={handleVerify}
              disabled={isVerifying}
              className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-indigo-600 transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/10"
            >
              {isVerifying ? "Verifying..." : "Confirm & Enable"}
            </button>
            <button 
              onClick={onClose}
              className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 py-2"
            >
              Setup Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}