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
  ExternalLink,
  Cable,
  Globe
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
  const [networkIp, setNetworkIp] = useState<string>('podcasts-73hz.vercel.app');
  const [customHost, setCustomHost] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isLoadingIp, setIsLoadingIp] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'usb' | 'continuity'>('qr');
  const [useCloudRelay, setUseCloudRelay] = useState<boolean>(true);

  // Auto-detect Host: Prefer real public production origin, fallback to Wi-Fi IP on local
  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;

    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

    if (!isLocal) {
      // In production (Vercel / live domain): ALWAYS use the current public host!
      setNetworkIp(window.location.host);
      setUseCloudRelay(true);
      return;
    }

    // Local dev: fetch Wi-Fi IP for local testing
    async function fetchLocalIp() {
      try {
        setIsLoadingIp(true);
        const res = await fetch('/api/network-ip');
        const data = await res.json();
        const port = window.location.port ? `:${window.location.port}` : '';
        const detectedHost = `${data.ip || '192.168.1.213'}${port}`;
        setNetworkIp(detectedHost);
      } catch (err) {
        const port = window.location.port ? `:${window.location.port}` : ':3001';
        setNetworkIp(`192.168.1.213${port}`);
      } finally {
        setIsLoadingIp(false);
      }
    }

    fetchLocalIp();
  }, [isOpen]);

  if (!isOpen) return null;

  // URL calculation: If cloud relay is selected or in production, point to live Vercel domain with valid SSL
  const isProduction = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';

  let effectiveHost = 'podcasts-73hz.vercel.app';
  if (customHost.trim()) {
    effectiveHost = customHost.trim();
  } else if (isProduction) {
    effectiveHost = typeof window !== 'undefined' ? window.location.host : 'podcasts-73hz.vercel.app';
  } else if (!useCloudRelay && networkIp) {
    effectiveHost = networkIp;
  } else {
    effectiveHost = 'podcasts-73hz.vercel.app';
  }

  const cleanHost = effectiveHost.replace(/^https?:\/\//, '').replace(/^\/\//, '');
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
              <h3 className="text-lg font-bold text-white">חיבור מצלמת iPhone לאולפן</h3>
              <p className="text-xs text-slate-400">איכות 4K / 1080p בשידור ישיר</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Tab Selector */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 relative z-10">
          <button
            onClick={() => setActiveTab('qr')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>1. סריקת QR (ענן)</span>
          </button>

          <button
            onClick={() => setActiveTab('usb')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'usb'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cable className="w-3.5 h-3.5" />
            <span>2. חיבור כבל USB (הכי מומלץ)</span>
          </button>

          <button
            onClick={() => setActiveTab('continuity')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'continuity'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3. Continuity אלחוטי</span>
          </button>
        </div>

        {/* TAB 1: QR Code Scanner */}
        {activeTab === 'qr' && (
          <div className="space-y-4 relative z-10 animate-in fade-in">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>סרקו עם מצלמת האייפון (נפתח ישירות ב-Safari):</span>
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                  HTTPS מאובטח
                </span>
              </div>

              {/* Localhost vs Cloud Toggle (Shown only in dev) */}
              {!isProduction && (
                <div className="flex items-center gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400 text-[11px] font-bold px-1">שרת שידור:</span>
                  <button
                    type="button"
                    onClick={() => setUseCloudRelay(true)}
                    className={`flex-1 py-1 px-2 rounded-lg text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1 ${
                      useCloudRelay
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>ענן חי (Vercel) - פועל תמיד</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseCloudRelay(false)}
                    className={`flex-1 py-1 px-2 rounded-lg text-center font-bold text-[11px] transition-all flex items-center justify-center gap-1 ${
                      !useCloudRelay
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Wifi className="w-3 h-3" />
                    <span>Wi-Fi מקומי ({networkIp})</span>
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                {/* QR Box */}
                <div className="p-3.5 bg-white rounded-2xl shadow-xl shrink-0 flex items-center justify-center">
                  <QRCodeSVG value={remoteUrl} size={150} level="M" />
                </div>

                {/* Instructions */}
                <div className="space-y-2 text-xs text-slate-300 flex-1 min-w-0">
                  <p>1. פתחו את <strong>אפליקציית המצלמה</strong> באייפון וכונו אותה לקוד ה-QR.</p>
                  <p>2. לחצו על הקישור הצהוב שנפתח ב-<strong>Safari</strong>.</p>
                  <p>3. לחצו על הכפתור הסגול <strong>&quot;הפעל מצלמה ושידור עכשיו&quot;</strong> ואשרו הרשאת מצלמה.</p>

                  {/* Status Indicator */}
                  <div className="pt-2">
                    {connectionStatus === 'connected' ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold animate-in fade-in">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>🟢 ה-iPhone מחובר ומשדר עכשיו לאולפן!</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-medium">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        <span>ממתין לסריקת הקוד מהטלפון...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* URL Display & Testing Link */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>כתובת ה-HTTPS של המצלמה:</span>
                  <a
                    href={remoteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>בדוק קישור עכשיו בטאב חדש</span>
                  </a>
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

        {/* TAB 2: Direct USB Cable (Fastest, zero lag, 4K native) */}
        {activeTab === 'usb' && (
          <div className="space-y-4 relative z-10 animate-in fade-in">
            <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Cable className="w-4 h-4 text-emerald-400" />
                  <span>חיבור כבל ישיר (USB-C / Lightning) - הבחירה המקצועית:</span>
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded">
                  אפס השהייה • איכות 4K טבעית
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-200">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/40 text-emerald-300 flex items-center justify-center shrink-0 font-bold text-[11px]">1</span>
                  <p className="leading-relaxed">
                    חברו כבל <strong>USB-C או Lightning</strong> ישירות מהאייפון למחשב ה-Mac. אם מופיעה הודעה באייפון, לחצו על <span className="text-emerald-400 font-bold">&quot;סמוך על מחשב זה&quot; (Trust)</span>.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/40 text-emerald-300 flex items-center justify-center shrink-0 font-bold text-[11px]">2</span>
                  <p className="leading-relaxed">
                    מערכת macOS תזהה את האייפון ישירות כמצלמת רשת חומרה (Continuity Camera) ללא צורך בהתקנת שום תוכנה!
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-emerald-600/40 text-emerald-300 flex items-center justify-center shrink-0 font-bold text-[11px]">3</span>
                  <p className="leading-relaxed">
                    באולפן יופיע כפתור ירוק: <span className="text-emerald-300 font-bold">&quot;📱 התחבר למצלמת ה-iPhone שלך בלחיצה אחת&quot;</span>. לחיצה עליו והמצלמה פעילה בחדות שיא!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Apple Continuity Camera Wireless */}
        {activeTab === 'continuity' && (
          <div className="space-y-4 relative z-10 animate-in fade-in">
            <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>הגדרת מצלמת המשכיות אלחוטית של אפל (Continuity):</span>
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded">
                  אלחוטי של Apple • ללא אפליקציות
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-200">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center shrink-0 font-bold text-[11px]">1</span>
                  <p className="leading-relaxed">
                    <strong>באייפון:</strong> כנסו ל-
                    <span className="text-indigo-300 font-semibold mx-1">הגדרות (Settings) ← כללי (General) ← AirPlay ו-Continuity</span>
                    וודאו שהאפשרות <span className="text-emerald-400 font-bold">&quot;מצלמת המשכיות&quot; (Continuity Camera)</span> מופעלת (ירוק).
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center shrink-0 font-bold text-[11px]">2</span>
                  <p className="leading-relaxed">
                    <strong>חיבוריות:</strong> וודאו שגם ב-Mac וגם ב-iPhone דלוקים <span className="text-white font-semibold">Wi-Fi ו-Bluetooth</span>, וששני המכשירים מחוברים ל<span className="text-white font-semibold">אותו חשבון Apple ID</span>.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/40 text-indigo-300 flex items-center justify-center shrink-0 font-bold text-[11px]">3</span>
                  <p className="leading-relaxed">
                    <strong>הפעלה:</strong> הניחו את האייפון לרוחב ליד המחשב כשהמסך נעול. באולפן המצלמה תופיע אוטומטית ברשימת המצלמות!
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
