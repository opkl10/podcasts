'use client';

import React, { useState, useRef } from 'react';
import { Database, Download, Upload, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, HardDrive } from 'lucide-react';
import { syncWithServerDatabase } from '@/lib/storage';

interface DatabaseBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
}

export default function DatabaseBackupModal({
  isOpen,
  onClose,
  onRefreshData
}: DatabaseBackupModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Export Full Database Backup JSON
  const handleDownloadBackup = async () => {
    try {
      setIsExporting(true);
      setStatusMsg(null);
      const res = await fetch('/api/db/backup');
      if (!res.ok) throw new Error('שגיאה ביצירת קובץ הגיבוי');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `castflow_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setStatusMsg({ type: 'success', text: 'קובץ הגיבוי הורד בהצלחה למחשב שלך!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'שגיאה בהורדת הגיבוי' });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Restore Database from JSON
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setStatusMsg(null);
      const text = await file.text();
      const parsedData = JSON.parse(text);

      const res = await fetch('/api/db/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData)
      });

      if (!res.ok) throw new Error('קובץ הגיבוי אינו תקין');

      const result = await res.json();
      await syncWithServerDatabase();
      onRefreshData();

      setStatusMsg({
        type: 'success',
        text: `מסד הנתונים שוחזר בהצלחה! (${result.episodesCount} פרקים ו-${result.podcastsCount} פודקאסטים).`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'שגיאה בשחזור מסד הנתונים: ודא שהקובץ תקין.' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in font-sans">
      <div className="w-full max-w-lg rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-7 shadow-2xl space-y-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">מסד נתונים וזיכרון מערכת</h3>
              <p className="text-xs text-slate-400">כל הפרקים, המחקרים וההגדרות נשמרים לצמיתות</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Database Status Card */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-start gap-3 text-xs text-slate-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-white">מסד הנתונים פעיל ושומר אוטומטית (Auto-Save)</p>
            <p className="text-slate-400 leading-relaxed">
              כל שינוי בפרק, מחקר נושאים, נקודות דיבייט וחותמות זמן נשמרים אוטומטית לקובץ מסד נתונים מאובטח בדיסק (`data/podcast_studio.db.json`).
            </p>
          </div>
        </div>

        {/* Status Alert */}
        {statusMsg && (
          <div className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs ${
            statusMsg.type === 'success' 
              ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300' 
              : 'bg-rose-950/60 border border-rose-500/50 text-rose-300'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Actions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Download Backup */}
          <button
            onClick={handleDownloadBackup}
            disabled={isExporting}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 text-white transition-all active:scale-98 text-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold">הורדת גיבוי מלא (JSON)</p>
              <p className="text-[10px] text-slate-400 mt-0.5">ייצוא כל הנתונים לקובץ במחשב</p>
            </div>
          </button>

          {/* Restore Backup */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 text-white transition-all active:scale-98 text-center group cursor-pointer"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold">שחזור גיבוי מקובץ</p>
              <p className="text-[10px] text-slate-400 mt-0.5">ייבוא ושחזור כל הפודקאסטים</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
