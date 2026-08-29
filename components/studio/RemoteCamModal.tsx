'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { 
  X, 
  Smartphone, 
  CheckCircle, 
  Wifi, 
  ShieldCheck, 
  Sparkles, 
  Copy, 
  Check,
  Edit2,
  RefreshCw,
  Info,
  Lock,
  Settings,
  Radio,
  ExternalLink
} from 'lucide-react';

interface RemoteCamModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectRemoteStream: () => void;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected';
}

export default function RemoteCamModal({
  roomId,
  isOpen,
  onClose,
  onSelectRemoteStream,
  connectionStatus
}: RemoteCamModalProps) {
  const [networkIp, setNetworkIp] = useState<string>('192.168.1.213:3001');
  const [customHost, setCustomHost] = useState<string>('192.168.1.213:3001');
  const [copied, setCopied] = useState(false);
  const [isLoadingIp, setIsLoadingIp] = useState(true);
  const [activeTab, setActiveTab] = useState<'qr' | 'continuity'>('qr');

  // Fetch local network IP
  useEffect(() => {
    async function fetchIp() {
      try {
        setIsLoadingIp(true);
        const res = await fetch('/api/network-ip');
        const data = await res.json();
        const port = window.location.port ? `:${window.location.port}` : ':3001';
        const detectedHost = `${data.ip || '192.168.1.213'}${port}`;
        setNetworkIp(detectedHost);
        setCustomHost(detectedHost);
      } catch (err) {
        console.error('Error fetching IP:', err);
        const fallback = window.location.host || '192.168.1.213:3001';
        setNetworkIp(fallback);
        setCustomHost(fallback);
      } finally {
        setIsLoadingIp(false);
      }
    }

    if (isOpen) {
      fetchIp();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Always enforce valid HTTPS URL
  const rawHost = customHost.trim() || networkIp || '192.168.1.213:3001';
  const cleanHost = rawHost.replace(/^https?:\/\//, '').replace(/^\/\//, '');
  const remoteUrl = `https://${cleanHost}/remote-cam?room=${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(remoteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden max-h-[92vh] overflow-y-auto font-sans">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">חיבור iPhone כמצלמת אולפן אלחוטית</h3>
              <p className="text-xs text-slate-400">איכות 4K/1080p בשידור חי</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-900/90 rounded-2xl border border-slate-800 relative z-10">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'qr'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>דרך 1: סריקת QR (דפדפן Safari ברשת)</span>
          </button>

          <button
            onClick={() => setActiveTab('continuity')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'continuity'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>דרך 2: אלחוטי של אפל (Continuity Camera)</span>
          </button>
        </div>

        {/* Tab 1: Web QR Code Streaming Guide */}
        {activeTab === 'qr' && (
          <div className="space-y-4 relative z-10 animate-in fade-in">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  סריקת קוד QR מאובטח (HTTPS) ב-Safari
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-semibold">
                  שידור Web ישיר
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                {/* QR Box */}
                <div className="p-3.5 bg-white rounded-2xl shadow-xl shrink-0 flex items-center justify-center">
                  <QRCodeSVG value={remoteUrl} size={145} level="M" />
                </div>

                {/* Instructions */}
                <div className="space-y-2 text-xs text-slate-300 flex-1 min-w-0">
                  <p>1. סרקו את הקוד עם מצלמת האייפון ופתחו ב-Safari.</p>
                  <p>2. במסך שמופיע באייפון, לחצו על <span className="text-amber-400 font-bold">"הצג פרטים" ← "עבור לאתר זה"</span>.</p>
                  <p>3. לחצו על הכפתור הכחול <span className="text-indigo-300 font-bold">"הפעל מצלמה ושידור עכשיו"</span> ואשרו גישה למצלמה.</p>

                  {/* Status */}
                  <div className="pt-1">
                    {connectionStatus === 'connected' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                        <CheckCircle className="w-3.5 h-3.5" />
                        iPhone מחובר ומשדר עכשיו!
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        ממתין לסריקה מהטלפון...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* URL Copy */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>כתובת ה-HTTPS המלאה:</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={remoteUrl}
                    readOnly
                    className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-emerald-400 font-mono select-all focus:outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'הועתק!' : 'העתק'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Continuity Camera Guide */}
        {activeTab === 'continuity' && (
          <div className="space-y-4 relative z-10 animate-in fade-in">
            <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  הסבר הגדרה אלחוטית (מצלמת המשכיות ב-Mac):
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                  0 כבלים • איכות 4K טבעית
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-200">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center shrink-0 font-bold text-[11px]">1</span>
                  <p className="leading-relaxed">
                    <span className="font-bold text-white">באייפון:</span> כנסו ל-
                    <span className="text-indigo-300 font-semibold mx-1">הגדרות (Settings) ← כללי (General) ← AirPlay ו-Continuity</span>
                    וודאו שהאפשרות <span className="text-emerald-400 font-bold">"מצלמת המשכיות" (Continuity Camera)</span> מופעלת (ירוק).
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center shrink-0 font-bold text-[11px]">2</span>
                  <p className="leading-relaxed">
                    <span className="font-bold text-white">חיבוריות:</span> וודאו שגם ב-Mac וגם ב-iPhone דלוקים <span className="text-white font-semibold">Wi-Fi ו-Bluetooth</span>, וששני המכשירים מחוברים ל<span className="text-white font-semibold">אותו חשבון Apple ID</span>.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center shrink-0 font-bold text-[11px]">3</span>
                  <p className="leading-relaxed">
                    <span className="font-bold text-white">הפעלה:</span> הניחו את האייפון לרוחב ליד המחשב כשהמסך נעול. באולפן לחצו על <span className="text-amber-400 font-bold">"רענן" 🔄</span> ובחרו ב-`📱 iPhone Camera` ברשימה!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 relative z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            סגור
          </button>
          {connectionStatus === 'connected' && (
            <button
              onClick={() => {
                onSelectRemoteStream();
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span>השתמש במצלמת ה-iPhone עכשיו</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
