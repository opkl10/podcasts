'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Episode } from '@/lib/types';
import { 
  formatTime, 
  getMediaBlob, 
  deleteMediaBlob, 
  deleteEpisode, 
  findMediaBlobForEpisode,
  exportEpisodeNotes
} from '@/lib/storage';
import { 
  Gamepad2, 
  Video, 
  Download, 
  Subtitles, 
  Clock, 
  Trash2, 
  PlusCircle, 
  ExternalLink,
  Mic,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface GamingEpisodesHubProps {
  episodes: Episode[];
  onDeleteEpisode: (id: string) => void;
  onUpdateEpisodes: (episodes: Episode[]) => void;
}

export default function GamingEpisodesHub({
  episodes,
  onDeleteEpisode,
  onUpdateEpisodes
}: GamingEpisodesHubProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'recorded' | 'ready'>('all');

  // Filter only gaming episodes
  const gamingEpisodes = episodes.filter(ep => 
    ep.mediaType === 'gaming_creator' || 
    ep.id.startsWith('gaming-') || 
    ep.podcastId === 'pod-gaming'
  );

  const displayedEpisodes = gamingEpisodes.filter(ep => {
    if (filterMode === 'recorded') return ep.status === 'recorded' || ep.recording?.duration;
    if (filterMode === 'ready') return ep.status !== 'recorded' && !ep.recording?.duration;
    return true;
  });

  const recordedCount = gamingEpisodes.filter(e => e.status === 'recorded' || e.recording?.duration).length;
  const totalDurationSeconds = gamingEpisodes.reduce((acc, ep) => acc + (ep.recording?.duration || 0), 0);

  // Download video (WebM / MP4)
  const handleDownloadVideo = async (ep: Episode) => {
    try {
      setDownloadingId(`${ep.id}_video`);
      let blob: Blob | null = null;
      if (ep.recording?.videoBlobKey) {
        blob = await getMediaBlob(ep.recording.videoBlobKey);
      }
      if (!blob) {
        const found = await findMediaBlobForEpisode(ep.id);
        if (found && found.blob) blob = found.blob;
      }
      if (!blob) {
        alert('קובץ הווידאו אינו זמין בדיסק המקומי.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtube-gaming-${ep.title.replace(/\s+/g, '-')}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('שגיאה בהורדת הווידאו');
    } finally {
      setDownloadingId(null);
    }
  };

  // Download Mic audio only
  const handleDownloadMicAudio = async (ep: Episode) => {
    try {
      setDownloadingId(`${ep.id}_mic`);
      let blob: Blob | null = null;
      if (ep.recording?.videoBlobKey) {
        blob = await getMediaBlob(`${ep.recording.videoBlobKey}_mic`);
      }
      if (!blob && ep.recording?.audioBlobKey) {
        blob = await getMediaBlob(ep.recording.audioBlobKey);
      }
      if (!blob) {
        alert('ערוץ המיקרופון אינו זמין בנפרד (ניתן להוריד את הווידאו המלא).');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mic-audio-${ep.title.replace(/\s+/g, '-')}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('שגיאה בהורדת קול המיקרופון');
    } finally {
      setDownloadingId(null);
    }
  };

  // Download Show Notes / YouTube Chapters
  const handleDownloadYouTubeNotes = (ep: Episode) => {
    const text = exportEpisodeNotes(ep);
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-description-${ep.title.replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (ep: Episode) => {
    if (!confirm(`האם למחוק את סרטון הגיימינג "${ep.title}" ואת קובצי ההקלטה שלו?`)) return;
    try {
      if (ep.recording?.videoBlobKey) await deleteMediaBlob(ep.recording.videoBlobKey);
      if (ep.recording?.audioBlobKey) await deleteMediaBlob(ep.recording.audioBlobKey);
      await deleteEpisode(ep.id);
      onDeleteEpisode(ep.id);
    } catch (err: any) {
      alert('שגיאה במחיקת הפרק: ' + err?.message);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Gaming Hub Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/90 via-[#161328] to-[#0c0d18] border border-purple-500/30 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-fuchsia-600/15 rounded-full blur-3xl pointer-events-none -translate-x-1/3 translate-y-1/3"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>מרכז סרטוני גיימינג ויוטיוב (YouTube Gaming 60FPS)</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              הקלטות גיימינג ויוטיוב במקום נפרד
            </h1>
            <p className="text-sm text-purple-200/80 leading-relaxed max-w-xl">
              כל הסרטונים שהוקלטו באולפן ב-60FPS עם כרטיס Elgato 4K, מצלמת פנים רב-ערוצית ומיקסר סאונד. 
              מופרדים לחלוטין מפרקי הפודקאסטים, מוכנים לעריכה, ייצוא ליוטיוב וכניסה מחודשת לאולפן בכל עת.
            </p>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 border border-purple-500/30 text-purple-200">
                <Video className="w-4 h-4 text-purple-400" />
                <span><strong>{gamingEpisodes.length}</strong> סרטוני גיימינג סה&quot;כ</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-900/40 border border-emerald-500/30 text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span><strong>{recordedCount}</strong> הוקלטו ומוכנים ליוטיוב</span>
              </div>
              {totalDurationSeconds > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-900/40 border border-amber-500/30 text-amber-200">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>זמן הקלטה כולל: <strong>{formatTime(totalDurationSeconds, true)}</strong></span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            {/* Enter Studio CTA */}
            <Link
              href="/gaming"
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-900/40 hover:scale-[1.02] active:scale-95 transition-all text-center border border-purple-400/40"
            >
              <Gamepad2 className="w-5 h-5 text-purple-200 animate-pulse" />
              <span>🎮 כניסה ישירה לאולפן גיימינג</span>
            </Link>

            <Link
              href={`/gaming?episodeId=gaming-${Date.now()}`}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-purple-500/30 font-bold text-xs shadow-md transition-all active:scale-95 text-center"
              title="פתיחת סשן גיימינג חדש ונקי"
            >
              <PlusCircle className="w-4 h-4 text-purple-400" />
              <span>➕ סרטון גיימינג חדש</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            כל סרטוני הגיימינג ({gamingEpisodes.length})
          </button>
          <button
            onClick={() => setFilterMode('recorded')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'recorded'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            🔴 הוקלטו ליוטיוב ({recordedCount})
          </button>
          <button
            onClick={() => setFilterMode('ready')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'ready'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            ⏳ מוכנים להקלטה ({gamingEpisodes.length - recordedCount})
          </button>
        </div>

        <span className="text-xs text-slate-400 font-medium">
          מציג <strong>{displayedEpisodes.length}</strong> סרטונים
        </span>
      </div>

      {/* Gaming Episodes Grid */}
      {displayedEpisodes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedEpisodes.map(ep => {
            const hasRecording = Boolean(ep.recording?.duration || ep.status === 'recorded');
            const durationSec = ep.recording?.duration || 0;
            const res = ep.recording?.resolution || '1080p';

            return (
              <div 
                key={ep.id}
                className="group flex flex-col justify-between rounded-3xl bg-[#121422] border border-purple-500/20 hover:border-purple-500/50 p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-950/30 relative overflow-hidden"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-black flex items-center gap-1">
                        <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />
                        <span>יוטיוב גיימינג</span>
                      </span>

                      {hasRecording ? (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{formatTime(durationSec, true)}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                          מוכן לאולפן
                        </span>
                      )}

                      {res === '4k' && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black">
                          4K UHD
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(ep)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="מחיקת סרטון גיימינג"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-black text-white leading-snug line-clamp-2 mb-2">
                    {ep.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                    {ep.description || 'הקלטת גיימפליי ב-60FPS עם כרטיס לכידה Elgato.'}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-slate-400 mb-5 border-t border-slate-800/80 pt-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{new Date(ep.createdAt).toLocaleDateString('he-IL')}</span>
                    </span>
                    {ep.subtitles && ep.subtitles.length > 0 && (
                      <span className="flex items-center gap-1 text-emerald-300">
                        <Subtitles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{ep.subtitles.length} כתוביות</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  {/* Primary Studio Re-entry CTA */}
                  <Link
                    href={`/gaming?episodeId=${ep.id}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-950/40 hover:scale-[1.01] active:scale-95 transition-all text-center"
                    title="כניסה מחודשת לאולפן להקלטה או המשך עבודה"
                  >
                    <Gamepad2 className="w-4 h-4 text-purple-200" />
                    <span>🎮 כניסה לאולפן גיימינג</span>
                  </Link>

                  {/* Secondary Quick Action Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {hasRecording ? (
                      <>
                        <button
                          type="button"
                          disabled={downloadingId === `${ep.id}_video`}
                          onClick={() => handleDownloadVideo(ep)}
                          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-bold transition-all disabled:opacity-60 truncate"
                          title="הורדת קובץ הווידאו המלא (MP4/WebM) להעלאה ליוטיוב"
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">הורדת וידאו ליוטיוב</span>
                        </button>

                        <button
                          type="button"
                          disabled={downloadingId === `${ep.id}_mic`}
                          onClick={() => handleDownloadMicAudio(ep)}
                          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-[11px] font-bold transition-all disabled:opacity-60 truncate"
                          title="הורדת קול המיקרופון של השחקן בנפרד"
                        >
                          <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">אודיו מיקרופון</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href={`/episodes/${ep.id}`}
                          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-semibold transition-all text-center truncate"
                        >
                          <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate">פרטים ועריכה</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDownloadYouTubeNotes(ep)}
                          className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-semibold transition-all text-center truncate"
                          title="הורדת תיאור מוכן ליוטיוב עם חותמות זמן"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">תיאור ליוטיוב</span>
                        </button>
                      </>
                    )}
                  </div>

                  {hasRecording && (
                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/episodes/${ep.id}/subtitles`}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 text-purple-300 hover:text-white text-[11px] font-bold transition-all text-center truncate"
                      >
                        <Subtitles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">כתוביות AI</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleDownloadYouTubeNotes(ep)}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/40 text-amber-300 hover:text-white text-[11px] font-bold transition-all text-center truncate"
                        title="ייצוא Show Notes ופרקים לתיאור הסרטון ביוטיוב"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">פרקים ליוטיוב</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-purple-950/20 border border-purple-500/20 space-y-4">
          <div className="p-4 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Gamepad2 className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-white">אין עדיין סרטוני גיימינג מוקלטים</h3>
          <p className="text-xs text-slate-400 max-w-md leading-relaxed">
            כל סרטון או סשן שתקליט באולפן הגיימינג 60FPS יישמר ויופיע כאן במקום נפרד, מוכן להורדה, כתוביות וכניסה מחודשת לאולפן.
          </p>
          <Link
            href="/gaming"
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-900/40 transition-all"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>התחל הקלטת גיימינג ראשונה</span>
          </Link>
        </div>
      )}
    </div>
  );
}
