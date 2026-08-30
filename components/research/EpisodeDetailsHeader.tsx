'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Episode, EpisodeStatus, PodcastShow } from '@/lib/types';
import { getPodcasts, getPodcastById, saveMediaBlob, getMediaBlob, deleteMediaBlob, formatTime } from '@/lib/storage';
import { 
  ArrowRight, 
  Mic, 
  Share2, 
  Clock, 
  User, 
  Tag, 
  Sparkles, 
  Edit3, 
  Check, 
  X,
  FileText,
  Radio,
  Video,
  Activity,
  UploadCloud,
  Headphones,
  Trash2,
  Play,
  Subtitles,
  Languages
} from 'lucide-react';

interface EpisodeDetailsHeaderProps {
  episode: Episode;
  onUpdateEpisode: (updated: Episode) => void;
  onOpenExport: () => void;
  onOpenAudiogram?: () => void;
}

const statusOptions: { value: EpisodeStatus; label: string }[] = [
  { value: 'draft', label: 'טיוטה' },
  { value: 'research', label: 'במחקר' },
  { value: 'ready', label: 'מוכן לאולפן' },
  { value: 'recording', label: 'בהקלטה' },
  { value: 'recorded', label: 'הוקלט' },
  { value: 'published', label: 'פורסם' },
];

export default function EpisodeDetailsHeader({
  episode,
  onUpdateEpisode,
  onOpenExport,
  onOpenAudiogram
}: EpisodeDetailsHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(episode.title);
  const [podcastId, setPodcastId] = useState(episode.podcastId || 'pod-tech');
  const [mediaType, setMediaType] = useState<'video' | 'audio_only'>(episode.mediaType || 'video');
  const [description, setDescription] = useState(episode.description);
  const [season, setSeason] = useState(episode.season);
  const [episodeNumber, setEpisodeNumber] = useState(episode.episodeNumber);
  const [targetDuration, setTargetDuration] = useState(episode.targetDurationMinutes);
  const [guestName, setGuestName] = useState(episode.guest?.name || '');
  const [guestRole, setGuestRole] = useState(episode.guest?.role || '');
  const [hostName, setHostName] = useState(episode.hostName || episode.host?.name || '');
  const [podcasts, setPodcasts] = useState<PodcastShow[]>([]);
  const [audioPlaybackUrl, setAudioPlaybackUrl] = useState<string | null>(null);

  useEffect(() => {
    setPodcasts(getPodcasts());
  }, []);

  useEffect(() => {
    let isMounted = true;
    let url: string | null = null;
    const loadAudioBlob = async () => {
      if (episode.recording?.audioBlobKey) {
        const blob = await getMediaBlob(episode.recording.audioBlobKey);
        if (blob && isMounted) {
          url = URL.createObjectURL(blob);
          setAudioPlaybackUrl(url);
          return;
        }
      }
      if (episode.recording?.videoBlobKey) {
        const blob = await getMediaBlob(episode.recording.videoBlobKey);
        if (blob && isMounted) {
          url = URL.createObjectURL(blob);
          setAudioPlaybackUrl(url);
          return;
        }
      }
      if (isMounted) setAudioPlaybackUrl(null);
    };
    loadAudioBlob();
    return () => {
      isMounted = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [episode.recording]);

  const currentPodcast = getPodcastById(episode.podcastId);

  const handleSave = () => {
    onUpdateEpisode({
      ...episode,
      podcastId,
      title,
      description,
      mediaType,
      season: Number(season),
      episodeNumber: Number(episodeNumber),
      targetDurationMinutes: Number(targetDuration),
      hostName: hostName.trim() || undefined,
      host: hostName.trim() ? { name: hostName.trim() } : undefined,
      guest: guestName.trim()
        ? {
            name: guestName,
            role: guestRole,
            bio: episode.guest?.bio || '',
            links: episode.guest?.links || []
          }
        : undefined
    });
    setIsEditing(false);
  };

  const handleStatusChange = (newStatus: EpisodeStatus) => {
    onUpdateEpisode({
      ...episode,
      status: newStatus
    });
  };

  const handleUploadAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const blobKey = `rec_uploaded_${episode.id}_${Date.now()}`;
      await saveMediaBlob(blobKey, file);

      // Determine duration
      let durationSeconds = 60;
      try {
        const url = URL.createObjectURL(file);
        const tempAudio = new Audio(url);
        await new Promise((resolve) => {
          tempAudio.onloadedmetadata = () => {
            durationSeconds = Math.round(tempAudio.duration) || 60;
            resolve(true);
          };
          tempAudio.onerror = () => resolve(true);
          setTimeout(() => resolve(true), 2500);
        });
      } catch {}

      const updated: Episode = {
        ...episode,
        status: 'recorded',
        recording: {
          recordedAt: new Date().toISOString(),
          duration: durationSeconds,
          audioBlobKey: blobKey,
          markers: [],
          topicsCovered: []
        }
      };

      onUpdateEpisode(updated);
      alert(`קובץ השמע "${file.name}" נשמר בהצלחה בפרק! הוא מוכן כעת להאזנה, עריכת סאונד ב-Audiogram Studio, ותמלול כתוביות AI.`);
    } catch (err: any) {
      alert('שגיאה בשמירת קובץ השמע: ' + err.message);
    }
  };

  const handleRemoveRecording = async () => {
    if (!confirm('האם להסיר את קובץ ההקלטה מפרק זה? (נושאי המחקר והטקסט יישארו)')) return;
    try {
      if (episode.recording?.audioBlobKey) {
        await deleteMediaBlob(episode.recording.audioBlobKey);
      }
      if (episode.recording?.videoBlobKey) {
        await deleteMediaBlob(episode.recording.videoBlobKey);
      }
      const updated: Episode = {
        ...episode,
        status: episode.status === 'recorded' ? 'ready' : episode.status,
        recording: undefined
      };
      onUpdateEpisode(updated);
      setAudioPlaybackUrl(null);
    } catch (err: any) {
      alert('שגיאה בהסרת ההקלטה: ' + err.message);
    }
  };

  return (
    <div className="rounded-3xl bg-[#121620] border border-slate-800/90 p-6 sm:p-8 shadow-xl relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Bar: Back link, Status Selector & CTA Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 relative z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>חזרה לכל הפרקים</span>
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Dropdown */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-slate-500 font-medium">סטטוס:</span>
            <select
              value={episode.status}
              onChange={(e) => handleStatusChange(e.target.value as EpisodeStatus)}
              className="bg-transparent text-indigo-400 font-bold focus:outline-none cursor-pointer"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Upload Existing Audio Recording */}
          <label
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-xs font-bold text-emerald-300 hover:text-white border border-emerald-500/40 transition-all shadow-md cursor-pointer active:scale-95"
            title="העלאת קובץ שמע מוקלט (MP3/WAV/M4A) לפרק זה"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>העלאת הקלטה</span>
            <input
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.ogg"
              className="hidden"
              onChange={handleUploadAudioFile}
            />
          </label>

          {/* Audiogram & Sound Studio */}
          {onOpenAudiogram && (
            <button
              onClick={onOpenAudiogram}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-xs font-bold text-cyan-300 hover:text-white border border-cyan-500/40 transition-all shadow-md active:scale-95"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>עורך סאונד וגלי קול</span>
            </button>
          )}

          {/* Export Show Notes */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/60 transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>ייצוא Show Notes</span>
          </button>

          {/* Enter Studio CTA */}
          <Link
            href={`/episodes/${episode.id}/studio`}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white text-xs font-bold shadow-lg shadow-red-900/40 active:scale-95 transition-all"
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span>כניסה לאולפן הקלטה</span>
          </Link>
        </div>
      </div>

      {/* Main Episode Content: View / Edit */}
      {isEditing ? (
        <div className="space-y-4 relative z-10 bg-slate-900/70 p-5 rounded-2xl border border-slate-800 animate-in fade-in">
          {/* Podcast selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">שיוך לתוכנית פודקאסט</label>
            <select
              value={podcastId}
              onChange={(e) => setPodcastId(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              {podcasts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">כותרת הפרק</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">עונה</label>
                <input
                  type="number"
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">פרק</label>
                <input
                  type="number"
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">דקות יעד</label>
                <input
                  type="number"
                  value={targetDuration}
                  onChange={(e) => setTargetDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white text-center"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">תיאור הפרק</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-cyan-400 mb-1">שם המגיש / מנחה (אופציונלי)</label>
              <input
                type="text"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                placeholder="למשל: עומר אוקון"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">שם האורח/ת (אופציונלי)</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="למשל: פרופ' ישראל ישראלי"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">תפקיד / תיאור האורח/ת</label>
              <input
                type="text"
                value={guestRole}
                onChange={(e) => setGuestRole(e.target.value)}
                placeholder="למשל: מנכ״ל חברת הייטק ומרצה"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Format selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">פורמט הפרק:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMediaType('video')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  mediaType === 'video'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>וידאו + אודיו (Video Podcast)</span>
              </button>

              <button
                type="button"
                onClick={() => setMediaType('audio_only')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  mediaType === 'audio_only'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>אודיו בלבד (Audio / Radio)</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
              ביטול
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/30"
            >
              <Check className="w-3.5 h-3.5" />
              שמירת שינויים
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {currentPodcast && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 text-indigo-300 text-xs font-bold border border-slate-800">
                    <Radio className="w-3 h-3 text-indigo-400" />
                    {currentPodcast.title}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold">
                  עונה {episode.season} • פרק {episode.episodeNumber}
                </span>

                {/* Media Format Badge */}
                {episode.mediaType === 'audio_only' ? (
                  <span className="px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1">
                    <Mic className="w-3 h-3 text-amber-400" />
                    <span>אודיו בלבד</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold flex items-center gap-1">
                    <Video className="w-3 h-3 text-indigo-400" />
                    <span>וידאו + אודיו</span>
                  </span>
                )}

                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  יעד: {episode.targetDurationMinutes} דקות
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {episode.title}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                {episode.description || 'אין תיאור לפרק זה.'}
              </p>
            </div>

            <button
              onClick={() => {
                setPodcastId(episode.podcastId || 'pod-tech');
                setTitle(episode.title);
                setDescription(episode.description);
                setSeason(episode.season);
                setEpisodeNumber(episode.episodeNumber);
                setTargetDuration(episode.targetDurationMinutes);
                setGuestName(episode.guest?.name || '');
                setGuestRole(episode.guest?.role || '');
                setIsEditing(true);
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl border border-slate-800 transition-colors"
              title="ערוך פרטי פרק"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>

          {/* Host & Guest Badges */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {episode.hostName && (
              <div className="inline-flex items-center gap-3 p-2.5 pr-3.5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 shadow-md">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-black shadow">
                  🎙️
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{episode.hostName}</p>
                  <p className="text-[11px] text-cyan-400 font-medium">מגיש/ת התוכנית</p>
                </div>
              </div>
            )}

            {episode.guest && (
              <div className="inline-flex items-center gap-3 p-2.5 pr-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-md">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow">
                  {episode.guest.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-white">{episode.guest.name}</p>
                  <p className="text-[11px] text-slate-400">{episode.guest.role || 'אורח/ת מיוחד/ת'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Dedicated Audio Recording Player Bar */}
          {episode.recording && (
            <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>הקלטת הפרק שמורה ומוכנה להאזנה</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                        {formatTime(episode.recording.duration || 0, true)}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      ניתן להאזין ישירות, לערוך ב-Audiogram Studio, או לתמלל כתוביות AI
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/episodes/${episode.id}/subtitles`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-purple-600/30 transition-all active:scale-95"
                  >
                    <Subtitles className="w-3.5 h-3.5" />
                    <span>אולפן כתוביות ותרגום AI</span>
                  </Link>

                  {onOpenAudiogram && (
                    <button
                      onClick={onOpenAudiogram}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 hover:text-white text-xs font-bold transition-all active:scale-95"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>סטודיו עריכה וגלי קול</span>
                    </button>
                  )}

                  <button
                    onClick={handleRemoveRecording}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                    title="הסר קובץ הקלטה מפרק זה"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {audioPlaybackUrl ? (
                <div className="pt-1">
                  <audio
                    controls
                    src={audioPlaybackUrl}
                    className="w-full h-10 rounded-xl bg-slate-900 border border-slate-800"
                  />
                </div>
              ) : (
                <div className="p-2 text-xs text-amber-300 bg-amber-950/20 border border-amber-500/20 rounded-xl">
                  קובץ השמע לא נמצא בזיכרון המקומי. באפשרותך להעלות שוב באמצעות כפתור "העלאת הקלטה".
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
