'use client';

import React, { useState, useEffect } from 'react';
import { Episode } from '@/lib/types';
import { 
  Users, 
  Copy, 
  Check, 
  Share2, 
  QrCode, 
  Radio, 
  ExternalLink, 
  X, 
  Sparkles, 
  Video, 
  Mic, 
  ShieldCheck, 
  Smartphone, 
  Send,
  Sliders,
  Volume2,
  RefreshCw,
  Eye,
  Globe,
  Wifi,
  Terminal,
  HelpCircle,
  Link as LinkIcon
} from 'lucide-react';

interface GuestInviteModalProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
  guestStatus: 'idle' | 'connecting' | 'connected' | 'error';
  guestInfo?: { name: string; role?: string };
  layoutMode: 'split' | 'pip' | 'host' | 'guest';
  onChangeLayout: (layout: 'split' | 'pip' | 'host' | 'guest') => void;
  guestVolume: number;
  onChangeGuestVolume: (vol: number) => void;
}

export default function GuestInviteModal({
  episode,
  isOpen,
  onClose,
  guestStatus,
  guestInfo,
  layoutMode,
  onChangeLayout,
  guestVolume,
  onChangeGuestVolume
}: GuestInviteModalProps) {
  const [copied, setCopied] = useState(false);
  const [networkIp, setNetworkIp] = useState<string>('localhost');
  const [port, setPort] = useState<string>('3001');

  // Mode: 'local' (same Wi-Fi) vs 'public' (Internet / Cloud URL)
  const [connectionMode, setConnectionMode] = useState<'public' | 'local'>('public');
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [copiedTunnelCmd, setCopiedTunnelCmd] = useState<string | null>(null);
  const [showTunnelGuide, setShowTunnelGuide] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNetworkIp(window.location.hostname);
      setPort(window.location.port || '3001');
      const savedPublicUrl = localStorage.getItem('castflow_public_url');
      if (savedPublicUrl) {
        setPublicUrl(savedPublicUrl);
      }
    }

    // Fetch local Wi-Fi IP from API
    fetch('/api/network-ip')
      .then(res => res.json())
      .then(data => {
        if (data.ip) setNetworkIp(data.ip);
        if (data.port) setPort(data.port);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const localHost = typeof window !== 'undefined' ? window.location.host : `${networkIp}:${port}`;
  const roomId = `guest_${episode.id}`;

  // Determine active base host
  let effectiveBaseUrl = `${protocol}//${localHost}`;
  if (connectionMode === 'public' && publicUrl.trim()) {
    let cleanUrl = publicUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    effectiveBaseUrl = cleanUrl.replace(/\/+$/, '');
  }

  const guestLink = `${effectiveBaseUrl}/guest?room=${roomId}&title=${encodeURIComponent(episode.title)}`;

  const whatsappMessage = encodeURIComponent(
    `היי! מזמין אותך להצטרף אליי לשידור חי של פרק הפודקאסט "${episode.title}".\n\nלחץ על הלינק הבא להצטרפות ישירה מהדפדפן (אין צורך בהתקנת אפליקציה):\n${guestLink}`
  );

  const handleCopyLink = () => {
    navigator.clipboard.writeText(guestLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSavePublicUrl = (val: string) => {
    setPublicUrl(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('castflow_public_url', val.trim());
    }
  };

  const handleCopyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedTunnelCmd(id);
    setTimeout(() => setCopiedTunnelCmd(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-[#0f121a] border border-slate-800 shadow-2xl overflow-hidden flex flex-col space-y-5 p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-600/30">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>הזמנת אורח מרחוק (Remote Guest Studio)</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                  guestStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {guestStatus === 'connected' ? '🟢 אורח מחובר' : '⏳ ממתין להצטרפות'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                שתפו את הלינק עם האורח – הוא יוכל להצטרף בשידור חי מכל מחשב או סמארטפון ללא התקנה
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network Mode Switcher: Public Internet vs Local Wi-Fi */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>היכן נמצא האורח?</span>
            <button
              onClick={() => setShowTunnelGuide(!showTunnelGuide)}
              className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 font-normal"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>איך מארחים אנשים מחוץ לבית?</span>
            </button>
          </label>

          <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setConnectionMode('public')}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                connectionMode === 'public'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>🌍 אורח חיצוני (אינטרנט / 4G / 5G)</span>
            </button>

            <button
              onClick={() => setConnectionMode('local')}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                connectionMode === 'local'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-4 h-4" />
              <span>🏠 אותה רשת Wi-Fi באולפן</span>
            </button>
          </div>
        </div>

        {/* Public URL Input for External Guests */}
        {connectionMode === 'public' && (
          <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5" />
                <span>כתובת אינטרנט ציבורית (Vercel / Cloudflare / Ngrok):</span>
              </label>
              {publicUrl && (
                <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  מוגדר
                </span>
              )}
            </div>

            <input
              type="text"
              placeholder="למשל: https://podcast-studio.vercel.app או https://xyz.trycloudflare.com"
              value={publicUrl}
              onChange={(e) => handleSavePublicUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-indigo-500/40 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
            
            {!publicUrl && (
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                💡 <strong>טיפ:</strong> להזמנת אורח מחוץ לבית – העלו את האתר ל-Vercel (חינם) או פתחו מנהרה חינמית בלחיצה אחת מהמדריך למטה.
              </p>
            )}
          </div>
        )}

        {/* Quick Tunnel & Vercel Guide Accordion */}
        {showTunnelGuide && (
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs text-slate-300 animate-in fade-in">
            <h4 className="font-black text-white flex items-center gap-1.5 text-sm">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <span>שתי דרכים קלות לפתיחת גישה ציבורית לאורחים:</span>
            </h4>

            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 block">1. מנהרה חינמית מיידית בטרמינל (Localtunnel - ללא הרשמה):</span>
                <p className="text-[11px] text-slate-400">הריצו בטרמינל כדי לקבל כתובת אינטרנט ציבורית מאובטחת ב-HTTPS:</p>
                <div className="flex items-center gap-2 pt-1">
                  <code className="flex-1 p-1.5 rounded-lg bg-slate-900 text-indigo-300 font-mono text-[11px] select-all">
                    npx localtunnel --port 3001
                  </code>
                  <button
                    onClick={() => handleCopyCommand('npx localtunnel --port 3001', 'lt')}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold"
                  >
                    {copiedTunnelCmd === 'lt' ? 'הועתק!' : 'העתק'}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="font-bold text-emerald-300 block">2. העלאה קבועה ל-Vercel (חינם לחלוטין - מומלץ):</span>
                <p className="text-[11px] text-slate-400">
                  הפרויקט בנוי ב-Next.js ומותאם ב-100% ל-Vercel. העלו ל-GitHub ולחצו Deploy ב-Vercel כדי לקבל דומיין קבוע לכל השידורים שלכם.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status Card */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
          guestStatus === 'connected'
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-950/50'
            : 'bg-slate-900/90 border-slate-800 text-slate-300'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              guestStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
            }`} />
            <div>
              <span className="text-xs font-bold block text-white">
                {guestStatus === 'connected'
                  ? `אורח בשידור: ${guestInfo?.name || 'אורח מחובר'}`
                  : 'ממתין שהאורח ייכנס לחדר ההמתנה...'}
              </span>
              {guestInfo?.role && (
                <span className="text-[11px] text-indigo-300">{guestInfo.role}</span>
              )}
            </div>
          </div>

          {guestStatus === 'connected' && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-mono">
              LIVE HD
            </span>
          )}
        </div>

        {/* Invite Link & Sharing Options */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300 block">לינק ישיר להצטרפות האורח:</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={guestLink}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 select-all focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'הועתק!' : 'העתק לינק'}</span>
            </button>
          </div>

          {/* WhatsApp & Email Quick Share */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <a
              href={`https://wa.me/?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>שלח הזמנה ב-WhatsApp</span>
            </a>

            <a
              href={`mailto:?subject=${encodeURIComponent(`הזמנה להתארח בפודקאסט: ${episode.title}`)}&body=${encodeURIComponent(`היי,\n\nמזמין אותך להתארח בפרק הפודקאסט "${episode.title}".\nלהצטרפות מהירה מהדפדפן:\n${guestLink}`)}`}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>שלח במייל</span>
            </a>
          </div>
        </div>

        {/* Video Layout Switching (Split Screen / PIP / Solo) */}
        <div className="space-y-2 pt-3 border-t border-slate-800/80">
          <label className="text-xs font-bold text-slate-300 block">מבנה תצוגת הווידאו באולפן (Screen Layout):</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'split', label: '🔲 מסך מפוצל 50/50' },
              { id: 'pip', label: '🖼️ תמונה בתוך תמונה' },
              { id: 'host', label: '👤 מארח בלבד' },
              { id: 'guest', label: '🎙️ אורח בלבד' }
            ].map(l => (
              <button
                key={l.id}
                onClick={() => onChangeLayout(l.id as any)}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  layoutMode === l.id
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span className="block text-[11px]">{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Guest Volume Gain Slider */}
        <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-indigo-400" />
              <span>ווליום שמע אורח (Guest Gain):</span>
            </span>
            <span className="font-mono text-indigo-300 font-bold">{Math.round(guestVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={guestVolume}
            onChange={(e) => onChangeGuestVolume(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Done CTA */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
        >
          סגור וחזור לאולפן
        </button>
      </div>
    </div>
  );
}
