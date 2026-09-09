'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Episode, PodcastShow } from '@/lib/types';
import { formatTime, exportEpisodeNotes, getMediaBlob, deleteMediaBlob, deleteEpisode, findMediaBlobForEpisode, reassignEpisodeRecording, getEpisodes } from '@/lib/storage';
import { convertBlobToStereoWav, convertBlobToMonoWav, exportToSRT, exportToVTT } from '@/lib/audioUtils';
import { 
  FolderArchive, 
  Video, 
  Music, 
  Mic, 
  FileText, 
  Subtitles, 
  Download, 
  Play, 
  Clock, 
  Calendar, 
  Tag, 
  Sparkles, 
  ExternalLink, 
  ChevronDown, 
  Layers, 
  ArrowRight, 
  Headphones, 
  Activity,
  Trash2,
  RotateCcw,
  X
} from 'lucide-react';

interface RecordedEpisodesVaultProps {
  episodes: Episode[];
  podcasts: PodcastShow[];
  onOpenSubtitles: (episode: Episode) => void;
  onOpenAudiogram?: (episode: Episode) => void;
  onDeleteEpisode?: (id: string) => void;
  onUpdateEpisodes?: (episodes: Episode[]) => void;
}

export default function RecordedEpisodesVault({
  episodes,
  podcasts,
  onOpenSubtitles,
  onOpenAudiogram,
  onDeleteEpisode,
  onUpdateEpisodes
}: RecordedEpisodesVaultProps) {
  const [selectedPodcastId, setSelectedPodcastId] = useState<string>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Filter episodes that have been recorded or have recording metadata
  const recordedEpisodes = episodes
    .filter(ep => ep.status === 'recorded' || ep.status === 'published' || ep.recording)
    .filter(ep => selectedPodcastId === 'all' || ep.podcastId === selectedPodcastId)
    .sort((a, b) => {
      // Sort by Season desc then Episode desc
      if (b.season !== a.season) return b.season - a.season;
      return b.episodeNumber - a.episodeNumber;
    });

  // 1. Download Video (HD)
  const handleDownloadVideo = async (episode: Episode) => {
    try {
      setDownloadingId(`${episode.id}_video`);
      let blob: Blob | null = null;
      if (episode.recording?.videoBlobKey) {
        blob = await getMediaBlob(episode.recording.videoBlobKey);
      }
      if (!blob) {
        const found = await findMediaBlobForEpisode(episode.id);
        if (found && found.blob) blob = found.blob;
      }
      if (!blob) {
        alert('קובץ הווידאו אינו זמין בדיסק המקומי.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-S${episode.season}E${episode.episodeNumber}-${episode.title.replace(/\s+/g, '-')}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('שגיאה בהורדת הווידאו');
    } finally {
      setDownloadingId(null);
    }
  };

  // 2. Download Stereo Audio (WAV)
  const handleDownloadStereo = async (episode: Episode) => {
    try {
      setDownloadingId(`${episode.id}_stereo`);
      let blob: Blob | null = null;
      if (episode.recording?.audioBlobKey) {
        blob = await getMediaBlob(episode.recording.audioBlobKey);
      } else if (episode.recording?.videoBlobKey) {
        blob = await getMediaBlob(episode.recording.videoBlobKey);
      }
      if (!blob) {
        const found = await findMediaBlobForEpisode(episode.id);
        if (found && found.blob) blob = found.blob;
      }
      if (!blob) {
        alert('קובץ האודיו אינו זמין בדיסק המקומי.');
        return;
      }
      const stereoWav = await convertBlobToStereoWav(blob);
      const url = URL.createObjectURL(stereoWav);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-stereo-S${episode.season}E${episode.episodeNumber}-${episode.title.replace(/\s+/g, '-')}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('שגיאה בהמרת קובץ האודיו לסטריאו');
    } finally {
      setDownloadingId(null);
    }
  };

  // 3. Download Mono Audio (WAV Downmix)
  const handleDownloadMono = async (episode: Episode) => {
    try {
      setDownloadingId(`${episode.id}_mono`);
      let blob: Blob | null = null;
      if (episode.recording?.audioBlobKey) {
        blob = await getMediaBlob(episode.recording.audioBlobKey);
      } else if (episode.recording?.videoBlobKey) {
        blob = await getMediaBlob(episode.recording.videoBlobKey);
      }
      if (!blob) {
        const found = await findMediaBlobForEpisode(episode.id);
        if (found && found.blob) blob = found.blob;
      }
      if (!blob) {
        alert('קובץ האודיו אינו זמין בדיסק המקומי.');
        return;
      }
      const monoWav = await convertBlobToMonoWav(blob);
      const url = URL.createObjectURL(monoWav);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-mono-S${episode.season}E${episode.episodeNumber}-${episode.title.replace(/\s+/g, '-')}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('שגיאה בהמרת קובץ האודיו למונו');
    } finally {
      setDownloadingId(null);
    }
  };

  // 4. Download Chapters & Markers (.md / .txt)
  const handleDownloadChapters = (episode: Episode) => {
    const text = exportEpisodeNotes(episode);
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chapters-S${episode.season}E${episode.episodeNumber}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 5. Download Subtitles (.srt)
  const handleDownloadSRT = (episode: Episode) => {
    if (!episode.subtitles || episode.subtitles.length === 0) {
      onOpenSubtitles(episode);
      return;
    }
    const srtText = exportToSRT(episode.subtitles);
    const blob = new Blob([srtText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles-S${episode.season}E${episode.episodeNumber}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in font-sans">
      {/* Header Banner */}
      <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">ארכיון פרקים שהוקלטו (Recording Vault)</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              הורדת כל ההקלטות בפורמט וידאו, אודיו סטריאו, אודיו מונו, חותמות זמן וכתוביות
            </p>
          </div>
        </div>

        {/* Filter by Podcast */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPodcastId}
            onChange={(e) => setSelectedPodcastId(e.target.value)}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">כל התוכניות והפודקאסטים</option>
            {podcasts.map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Episodes Vault List */}
      {recordedEpisodes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {recordedEpisodes.map((ep) => {
            const podcast = podcasts.find(p => p.id === ep.podcastId);
            return (
              <VaultEpisodeItemRow
                key={ep.id}
                ep={ep}
                podcast={podcast}
                allEpisodes={episodes}
                onOpenSubtitles={onOpenSubtitles}
                onOpenAudiogram={onOpenAudiogram}
                onDeleteEpisode={onDeleteEpisode}
                onUpdateEpisodes={onUpdateEpisodes}
                handleDownloadVideo={handleDownloadVideo}
                handleDownloadStereo={handleDownloadStereo}
                handleDownloadMono={handleDownloadMono}
                handleDownloadChapters={handleDownloadChapters}
                handleDownloadSRT={handleDownloadSRT}
                downloadingId={downloadingId}
              />
            );
          })}
        </div>
      ) : (
        <div className="p-12 rounded-3xl bg-[#121620] border border-slate-800 text-center space-y-3">
          <FolderArchive className="w-12 h-12 mx-auto text-slate-600" />
          <h3 className="text-base font-bold text-white">עדיין לא הוקלטו פרקים במערכת</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            לאחר שתקליטו או תעלו פרק למערכת, הוא יופיע כאן אוטומטית לפי סדר עונות ופרקים עם נגן שמע ואפשרויות הורדה בכל הפורמטים.
          </p>
        </div>
      )}
    </div>
  );
}

function VaultEpisodeItemRow({
  ep,
  podcast,
  allEpisodes,
  onOpenSubtitles,
  onOpenAudiogram,
  onDeleteEpisode,
  onUpdateEpisodes,
  handleDownloadVideo,
  handleDownloadStereo,
  handleDownloadMono,
  handleDownloadChapters,
  handleDownloadSRT,
  downloadingId
}: {
  ep: Episode;
  podcast: any;
  allEpisodes: Episode[];
  onOpenSubtitles: (ep: Episode) => void;
  onOpenAudiogram?: (ep: Episode) => void;
  onDeleteEpisode?: (id: string) => void;
  onUpdateEpisodes?: (episodes: Episode[]) => void;
  handleDownloadVideo: (ep: Episode) => void;
  handleDownloadStereo: (ep: Episode) => void;
  handleDownloadMono: (ep: Episode) => void;
  handleDownloadChapters: (ep: Episode) => void;
  handleDownloadSRT: (ep: Episode) => void;
  downloadingId: string | null;
}) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const fetchBlob = async () => {
      let blob: Blob | null = null;
      if (ep.recording?.audioBlobKey) {
        blob = await getMediaBlob(ep.recording.audioBlobKey);
      } else if (ep.recording?.videoBlobKey) {
        blob = await getMediaBlob(ep.recording.videoBlobKey);
      }
      if (blob && active) {
        createdUrl = URL.createObjectURL(blob);
        setAudioUrl(createdUrl);
      }
    };
    fetchBlob();
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [ep.recording]);

  const handleDelete = async () => {
    if (!confirm(`האם למחוק את פרק "${ep.title}" ואת כל קובצי ההקלטה שלו מהארכיון לצמיתות?`)) return;
    try {
      if (ep.recording?.audioBlobKey) await deleteMediaBlob(ep.recording.audioBlobKey);
      if (ep.recording?.videoBlobKey) await deleteMediaBlob(ep.recording.videoBlobKey);
      deleteEpisode(ep.id);
      if (onDeleteEpisode) onDeleteEpisode(ep.id);
      alert(`הפרק "${ep.title}" נמחק בהצלחה מהארכיון.`);
    } catch (e: any) {
      alert('שגיאה במחיקת הפרק: ' + e.message);
    }
  };

  const duration = ep.recording?.duration || ep.targetDurationMinutes * 60;
  const markersCount = ep.recording?.markers?.length || 0;
  const subsCount = ep.subtitles?.length || 0;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[#121620] border border-slate-800/90 hover:border-slate-700 transition-all shadow-xl space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Episode Info */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col items-center justify-center text-indigo-400 font-mono shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400">פרק</span>
            <span className="text-base font-black text-white">{ep.episodeNumber}</span>
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {podcast && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-indigo-300 text-[10px] font-bold">
                  {podcast.title}
                </span>
              )}
              <span className="text-xs text-slate-400">עונה {ep.season}</span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {formatTime(duration, true)}
              </span>
              {markersCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[10px] font-semibold border border-amber-500/20">
                  {markersCount} חותמות זמן
                </span>
              )}
              {subsCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold border border-emerald-500/20">
                  {subsCount} כתוביות
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-white truncate">{ep.title}</h3>
            <p className="text-xs text-slate-400 line-clamp-1">{ep.description}</p>
          </div>
        </div>

        {/* Actions & Navigation */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onOpenAudiogram && (
            <button
              onClick={() => onOpenAudiogram(ep)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>עורך סאונד (Audiogram)</span>
            </button>
          )}

          <button
            onClick={() => onOpenSubtitles(ep)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-bold transition-colors"
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>עורך כתוביות ({subsCount})</span>
          </button>

          {allEpisodes && allEpisodes.length > 1 && (
            <button
              onClick={() => {
                const other = allEpisodes.find(e => e.id !== ep.id);
                setReassignTargetId(other?.id || '');
                setIsReassignModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-white text-xs font-semibold transition-all shadow-sm active:scale-95"
              title="שיוך קובץ ההקלטה לפרק אחר אם הוקצה בטעות לפרק הלא נכון"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>שיוך לפרק אחר</span>
            </button>
          )}

          <Link
            href={`/episodes/${ep.id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
          >
            <span>פרטי הפרק</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {/* Delete Episode / Recording Button */}
          <button
            onClick={handleDelete}
            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-slate-800 transition-all"
            title="מחק פרק והקלטה מהארכיון"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reassign Recording Modal */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#121620] border border-slate-700 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <RotateCcw className="w-4 h-4" />
                <span>העברת הקלטה לפרק הנכון</span>
              </div>
              <button onClick={() => setIsReassignModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-300">
                קובץ ההקלטה משויך כרגע ל: <strong className="text-white font-bold">&quot;{ep.title}&quot;</strong>
              </p>
              <p className="text-slate-400">
                בחר לאיזה פרק תרצה להעביר את קובץ ההקלטה (השמע, הווידאו וההגדרות יעברו מיידית):
              </p>

              <select
                value={reassignTargetId}
                onChange={(e) => setReassignTargetId(e.target.value)}
                className="w-full mt-2 p-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-amber-500"
              >
                {allEpisodes.filter(e => e.id !== ep.id).map(e => (
                  <option key={e.id} value={e.id}>
                    עונה {e.season} • פרק {e.episodeNumber}: {e.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsReassignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
              >
                ביטול
              </button>
              <button
                onClick={() => {
                  if (!reassignTargetId) return;
                  const success = reassignEpisodeRecording(ep.id, reassignTargetId);
                  if (success) {
                    const updated = getEpisodes();
                    if (onUpdateEpisodes) onUpdateEpisodes(updated);
                    const targetEp = updated.find(e => e.id === reassignTargetId);
                    alert(`ההקלטה הועברה בהצלחה לפרק "${targetEp?.title || reassignTargetId}"!`);
                    setIsReassignModalOpen(false);
                  } else {
                    alert('שגיאה בהעברת ההקלטה.');
                  }
                }}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition-all"
              >
                אישור והעברת ההקלטה
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Audio Player Bar */}
      {audioUrl ? (
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <Headphones className="w-4 h-4" />
          </div>
          <audio
            controls
            src={audioUrl}
            className="w-full h-9 rounded-lg bg-slate-900"
          />
        </div>
      ) : null}

      {/* 5-Format Download Suite */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-3 border-t border-slate-800/80">
        {/* 1. Video (HD) */}
        <button
          onClick={() => handleDownloadVideo(ep)}
          disabled={downloadingId === `${ep.id}_video`}
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition-all active:scale-98 text-center"
          title="הורדת קובץ וידאו מלא (1080p WebM/MP4)"
        >
          <Video className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">וידאו (HD)</span>
        </button>

        {/* 2. Audio Stereo */}
        <button
          onClick={() => handleDownloadStereo(ep)}
          disabled={downloadingId === `${ep.id}_stereo`}
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-semibold transition-all active:scale-98 text-center"
          title="הורדת קובץ אודיו בסטריאו (Stereo WAV 48kHz)"
        >
          <Headphones className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">אודיו סטריאו</span>
        </button>

        {/* 3. Audio Mono */}
        <button
          onClick={() => handleDownloadMono(ep)}
          disabled={downloadingId === `${ep.id}_mono`}
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-teal-600/10 hover:bg-teal-600/20 border border-teal-500/30 text-teal-300 hover:text-white text-xs font-semibold transition-all active:scale-98 text-center"
          title="הורדת קובץ אודיו במונו לפודקאסטים (Mono WAV)"
        >
          <Mic className="w-3.5 h-3.5 text-teal-400 shrink-0" />
          <span className="truncate">אודיו מונו</span>
        </button>

        {/* 4. Chapters & Timestamp Markers */}
        <button
          onClick={() => handleDownloadChapters(ep)}
          className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:text-white text-xs font-semibold transition-all active:scale-98 text-center"
          title="הורדת חותמות זמן ליוטיוב וספוטיפיי (.md)"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">חותמות זמן</span>
        </button>

        {/* 5. Subtitles (.srt) */}
        <button
          onClick={() => handleDownloadSRT(ep)}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:text-white text-xs font-semibold transition-all active:scale-98 text-center"
          title="הורדת קובץ כתוביות סטנדרטי (.srt)"
        >
          <Subtitles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span className="truncate">כתוביות (SRT)</span>
        </button>
      </div>
    </div>
  );
}
