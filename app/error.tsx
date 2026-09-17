'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CastFlow App Error]:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl bg-[#121620] border border-slate-800 p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-red-600/10 blur-3xl pointer-events-none rounded-full" />

        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center shadow-lg shadow-red-500/10">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">אירעה שגיאה בטעינת העמוד</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            המערכת נתקלה בתקלה לא צפויה בעת טעינת הרכיב. לחצו על הכפתור מטה כדי לטעון מחדש בצורה נקייה.
          </p>
          {error?.message && (
            <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-red-300/80 text-left overflow-x-auto max-h-24">
              {error.message}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-xs font-bold text-white shadow-lg shadow-red-600/20 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>טען מחדש</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>חזרה לראשי</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
