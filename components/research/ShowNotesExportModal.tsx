'use client';

import React, { useState } from 'react';
import { Episode } from '@/lib/types';
import { exportEpisodeNotes } from '@/lib/storage';
import { X, Copy, Check, Download, FileText } from 'lucide-react';

interface ShowNotesExportModalProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShowNotesExportModal({
  episode,
  isOpen,
  onClose
}: ShowNotesExportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const notesText = exportEpisodeNotes(episode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(notesText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([notesText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `show-notes-ep${episode.episodeNumber}-${episode.title.replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">ייצוא Show Notes ואג'נדה</h3>
              <p className="text-xs text-slate-400">פורמט Markdown מוכן להעתקה, אתר ו-YouTube Chapters</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box */}
        <div className="relative">
          <textarea
            readOnly
            value={notesText}
            rows={14}
            className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 focus:outline-none leading-relaxed select-all"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>הורדת קובץ Markdown (.md)</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'הועתק ללוח!' : 'העתקת הכל ללוח'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
