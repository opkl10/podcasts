'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Episode, TimestampMarker } from '@/lib/types';
import { formatTime, exportEpisodeNotes } from '@/lib/storage';
import { getBunnyConfig, uploadBlobToBunny, generateBlogEmbedCode } from '@/lib/bunny/bunnyClient';
import { 
  CheckCircle2, 
  Download, 
  Play, 
  Pause, 
  FileText, 
  Mic, 
  Video, 
  RotateCcw, 
  ArrowRight, 
  Share2, 
  Sparkles,
  Tag,
  Clock,
  Music,
  Cloud,
  Palette,
  Activity
} from 'lucide-react';
import AudioEditorAudiogramStudio from '@/components/audio/AudioEditorAudiogramStudio';

interface PostRecordingReviewProps {
  episode: Episode;
  videoBlob: Blob | null;
  audioBlob: Blob | null;
  videoUrl: string | null;
  durationSeconds: number;
  markers: TimestampMarker[];
  onReRecord: () => void;
}

export default function PostRecordingReview({
  episode,
  videoBlob,
  audioBlob,
  videoUrl,
  durationSeconds,
  markers,
  onReRecord
}: PostRecordingReviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAudiogramOpen, setIsAudiogramOpen] = useState(false);

  // BunnyCDN Upload States
  const [isUploadingBunny, setIsUploadingBunny] = useState(false);
  const [bunnyCdnUrl, setBunnyCdnUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const handleUploadToBunny = async () => {
    if (!videoBlob) return;
    const config = getBunnyConfig();
    if (!config.storageZoneName || !config.accessKey) {
      alert('נא להגדיר תחילה את פרטי ה-Bunny Storage Zone במסך הדשבורד הראשי.');
      return;
    }

    try {
      setIsUploadingBunny(true);
      const fileName = `episode_${episode.episodeNumber}_${Date.now()}.webm`;
      const res = await uploadBlobToBunny(config, videoBlob, fileName, config.folderName || 'podcasts');

      if (res.success && res.cdnUrl) {
        setBunnyCdnUrl(res.cdnUrl);
      } else {
        alert(res.error || 'שגיאה בהעלאה ל-BunnyCDN');
      }
    } catch (e: any) {
      alert(e.message || 'שגיאה בהעלאה ל-BunnyCDN');
    } finally {
      setIsUploadingBunny(false);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const jumpToTime = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    videoRef.current.play();
    setIsPlaying(true);
  };

  const handleDownloadVideo = () => {
    if (!videoBlob && !videoUrl) return;
    const url = videoUrl || (videoBlob ? URL.createObjectURL(videoBlob) : '');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-ep${episode.episodeNumber}-${episode.title.replace(/\s+/g, '-')}.webm`;
    a.click();
  };

  const handleDownloadAudio = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-audio-ep${episode.episodeNumber}-${episode.title.replace(/\s+/g, '-')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadShowNotes = () => {
    const text = exportEpisodeNotes({
      ...episode,
      recording: {
        duration: durationSeconds,
        recordedAt: new Date().toISOString(),
        markers: markers,
        topicsCovered: episode.topics.map(t => t.id)
      }
    });
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `show-notes-ep${episode.episodeNumber}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const markerColors: Record<string, string> = {
    highlight: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    topic_change: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    clip_cut: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    note: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    question: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Top Banner: Success State */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-950/80 via-[#131d1a] to-[#0e1614] border border-emerald-800/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold mb-1">
                <Sparkles className="w-3 h-3" />
                הקלטת הפרק הסתיימה בהצלחה!
              </div>
              <h1 className="text-2xl font-black text-white">{episode.title}</h1>
              <p className="text-xs text-slate-300 mt-0.5">
                משך כולל: <span className="font-bold text-white">{formatTime(durationSeconds, true)}</span> • {markers.length} נקודות ציון סומנו
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onReRecord}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>הקלטה מחדש</span>
            </button>

            <Link
              href={`/episodes/${episode.id}`}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              <span>מעבר לעריכת הפרק</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Grid: Video Player + Markers & Chapters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Player & Downloads (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Video Preview Box */}
          <div className="rounded-3xl bg-[#121620] border border-slate-800 overflow-hidden shadow-xl">
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 text-slate-500 space-y-2">
                  <Video className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-xs">הקלטת אודיו בלבד</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                אורך ההקלטה: {formatTime(durationSeconds, true)}
              </span>
              <span className="text-emerald-400 font-medium">גיבוי כפול (וידאו HD + ערוץ Master Audio מבודד)</span>
            </div>
          </div>

          {/* Download & Export Suite */}
          <div className="p-6 rounded-3xl bg-[#121620] border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-400" />
              הורדות וייצוא קבצים (גיבוי רב-פורמטי)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* 1. HD Video Download */}
              <button
                onClick={handleDownloadVideo}
                disabled={!videoBlob && !videoUrl}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:text-white disabled:opacity-40 transition-all text-right group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">וידאו מלא (HD)</p>
                    <p className="text-[10px] text-slate-400">קובץ וידאו + אודיו</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-indigo-400 group-hover:translate-y-0.5 transition-transform shrink-0" />
              </button>

              {/* 2. Isolated Master Audio Download */}
              <button
                onClick={handleDownloadAudio}
                disabled={!audioBlob}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:text-white disabled:opacity-40 transition-all text-right group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">סאונד מבודד (Master)</p>
                    <p className="text-[10px] text-slate-400">ערוץ אודיו נקי לעריכה</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-emerald-400 group-hover:translate-y-0.5 transition-transform shrink-0" />
              </button>

              {/* 3. Show Notes Markdown */}
              <button
                onClick={handleDownloadShowNotes}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-600/10 hover:bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:text-white transition-all text-right group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-600 text-white shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Show Notes</p>
                    <p className="text-[10px] text-slate-400">חותמות פרקים (.md)</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-purple-400 group-hover:translate-y-0.5 transition-transform shrink-0" />
              </button>

              {/* 4. Background & Audiogram Studio */}
              <button
                onClick={() => setIsAudiogramOpen(true)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 hover:from-amber-500/25 hover:to-rose-500/25 border border-amber-500/50 text-amber-300 hover:text-white transition-all text-right group shadow-lg shadow-amber-950/40"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 font-black shrink-0">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">עיצוב רקע ואודיוגרמה</p>
                    <p className="text-[10px] text-slate-300">החלף רקע, הוסף גלי קול</p>
                  </div>
                </div>
                <Activity className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              </button>
            </div>

            {/* BunnyCDN Direct Cloud Upload Panel */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                  <span className="text-base">🐰</span>
                  העלאה ל-BunnyCDN והפקת קוד לבלוג:
                </span>

                <button
                  onClick={handleUploadToBunny}
                  disabled={isUploadingBunny || !videoBlob}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-orange-500/20 transition-all"
                >
                  <span>{isUploadingBunny ? 'מעלה ל-BunnyCDN...' : 'העלה ל-BunnyCDN עכשיו'}</span>
                </button>
              </div>

              {/* Upload Success Results */}
              {bunnyCdnUrl && (
                <div className="p-3.5 rounded-2xl bg-orange-950/30 border border-orange-500/40 space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      הקובץ עלה בהצלחה ל-BunnyCDN!
                    </span>
                    <a
                      href={bunnyCdnUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>צפה ב-CDN</span>
                    </a>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="text"
                      value={bunnyCdnUrl}
                      readOnly
                      className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono select-all focus:outline-none"
                    />

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(bunnyCdnUrl);
                        setCopiedUrl(true);
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white shrink-0"
                    >
                      {copiedUrl ? 'הועתק!' : 'העתק קישור CDN'}
                    </button>

                    <button
                      onClick={() => {
                        const embedCode = generateBlogEmbedCode(bunnyCdnUrl, episode.title, 'video');
                        navigator.clipboard.writeText(embedCode);
                        setCopiedEmbed(true);
                        setTimeout(() => setCopiedEmbed(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow shrink-0"
                    >
                      {copiedEmbed ? 'קוד הועתק!' : 'העתק קוד לבלוג (WordPress)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Timestamp Markers & Chapters (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl bg-[#121620] border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                נקודות ציון וסמני זמן ({markers.length})
              </h3>
              <span className="text-[11px] text-slate-400">לחצו לקפיצה בנגן</span>
            </div>

            {markers.length > 0 ? (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {markers.map((marker) => {
                  const style = markerColors[marker.type] || markerColors.note;
                  return (
                    <div
                      key={marker.id}
                      onClick={() => jumpToTime(marker.timestamp)}
                      className="group flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-indigo-300 font-mono text-xs font-bold border border-slate-700">
                          {formatTime(marker.timestamp)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                            {marker.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${style}`}>
                          {marker.type === 'highlight' && 'רגע שיא'}
                          {marker.type === 'clip_cut' && 'קליפ'}
                          {marker.type === 'topic_change' && 'נושא'}
                          {marker.type === 'question' && 'שאלה'}
                          {marker.type === 'note' && 'הערה'}
                        </span>
                        <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-xs text-slate-400">
                לא סומנו מרקרים במהלך הקלטה זו.
              </div>
            )}
          </div>

          {/* Topics Covered Summary */}
          <div className="rounded-3xl bg-[#121620] border border-slate-800 p-6 space-y-3">
            <h3 className="text-sm font-bold text-white">נושאים שנדונו בפרק:</h3>
            <ul className="space-y-2">
              {episode.topics.map((t, idx) => (
                <li key={t.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900/60 text-slate-300">
                  <span className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{idx + 1}. {t.title}</span>
                  </span>
                  <span className="text-slate-500">{t.estimatedMinutes} דק' מתוכנן</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Post-Recording Background & Audiogram Studio */}
      {isAudiogramOpen && (
        <AudioEditorAudiogramStudio
          episode={episode}
          isOpen={isAudiogramOpen}
          onClose={() => setIsAudiogramOpen(false)}
        />
      )}
    </div>
  );
}
