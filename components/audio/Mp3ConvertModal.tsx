'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Episode } from '@/lib/types';
import { getMediaBlob, saveMediaBlob, saveEpisode, findMediaBlobForEpisode, formatTime } from '@/lib/storage';
import { convertBlobToMp3, Mp3ConversionOptions } from '@/lib/audioUtils';
import {
  Music,
  X,
  Download,
  Play,
  Pause,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Layers,
  Sliders,
  RotateCw,
  HardDrive
} from 'lucide-react';

interface Mp3ConvertModalProps {
  isOpen: boolean;
  onClose: () => void;
  episode: Episode;
  onUpdateEpisode?: (updated: Episode) => void;
  initialSourceBlob?: Blob | null;
}

export default function Mp3ConvertModal({
  isOpen,
  onClose,
  episode,
  onUpdateEpisode,
  initialSourceBlob = null
}: Mp3ConvertModalProps) {
  // Settings
  const [bitrate, setBitrate] = useState<number>(192);
  const [isMono, setIsMono] = useState<boolean>(false);
  const [normalize, setNormalize] = useState<boolean>(true);

  // Conversion States
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedUrl, setConvertedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Existing MP3 in DB
  const [hasExistingMp3, setHasExistingMp3] = useState<boolean>(false);
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);

  // Playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Check for existing MP3 on open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const checkExisting = async () => {
      if (episode.recording?.mp3BlobKey) {
        setLoadingExisting(true);
        try {
          const blob = await getMediaBlob(episode.recording.mp3BlobKey);
          if (blob && isMounted) {
            setConvertedBlob(blob);
            const url = URL.createObjectURL(blob);
            setConvertedUrl(url);
            setHasExistingMp3(true);
          }
        } catch (e) {
          console.warn('Failed to load existing MP3:', e);
        } finally {
          if (isMounted) setLoadingExisting(false);
        }
      } else {
        setConvertedBlob(null);
        setConvertedUrl(null);
        setHasExistingMp3(false);
      }
    };

    checkExisting();

    return () => {
      isMounted = false;
      if (convertedUrl) {
        URL.revokeObjectURL(convertedUrl);
      }
    };
  }, [isOpen, episode.recording?.mp3BlobKey]);

  if (!isOpen) return null;

  const handleStartConversion = async () => {
    try {
      setIsConverting(true);
      setProgress(5);
      setError(null);
      setIsPlaying(false);

      // 1. Locate Source Blob (Audio or Video)
      let sourceBlob: Blob | null = initialSourceBlob;
      if (!sourceBlob && episode.recording?.audioBlobKey) {
        sourceBlob = await getMediaBlob(episode.recording.audioBlobKey);
      }
      if (!sourceBlob && episode.recording?.videoBlobKey) {
        sourceBlob = await getMediaBlob(episode.recording.videoBlobKey);
      }
      if (!sourceBlob) {
        const found = await findMediaBlobForEpisode(episode.id);
        if (found?.blob) sourceBlob = found.blob;
      }

      if (!sourceBlob) {
        throw new Error('לא נמצא קובץ הקלטה (אודיו או וידאו) בזיכרון המקומי.');
      }

      setProgress(15);

      // 2. Convert to MP3 using LAME encoder
      const options: Mp3ConversionOptions = {
        bitrate,
        isMono,
        normalize,
        onProgress: (pct) => {
          setProgress(Math.max(15, Math.min(98, Math.round(15 + (pct * 0.83)))));
        }
      };

      const mp3Blob = await convertBlobToMp3(sourceBlob, options);
      setProgress(99);

      // 3. Save to IndexedDB
      const mp3Key = `rec_${episode.id}_mp3_${Date.now()}`;
      await saveMediaBlob(mp3Key, mp3Blob);

      // 4. Update Episode Metadata
      const updatedEpisode: Episode = {
        ...episode,
        recording: episode.recording ? {
          ...episode.recording,
          mp3BlobKey: mp3Key
        } : {
          duration: 0,
          recordedAt: new Date().toISOString(),
          mp3BlobKey: mp3Key,
          markers: [],
          topicsCovered: []
        }
      };

      saveEpisode(updatedEpisode);
      if (onUpdateEpisode) onUpdateEpisode(updatedEpisode);

      // 5. Update Local Modal State
      if (convertedUrl) URL.revokeObjectURL(convertedUrl);
      const newUrl = URL.createObjectURL(mp3Blob);
      setConvertedBlob(mp3Blob);
      setConvertedUrl(newUrl);
      setHasExistingMp3(true);
      setProgress(100);

      // Auto download on completion
      triggerDownload(mp3Blob);
    } catch (err: any) {
      console.error('MP3 Conversion error:', err);
      setError(err.message || 'שגיאה במהלך המרת הקובץ ל-MP3');
    } finally {
      setIsConverting(false);
    }
  };

  const triggerDownload = (blobToDownload?: Blob) => {
    const blob = blobToDownload || convertedBlob;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const cleanTitle = (episode.title || 'episode').replace(/[^\w\u0590-\u05FF-]+/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `podcast-S${episode.season}E${episode.episodeNumber}-${cleanTitle}-${bitrate}kbps.mp3`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 font-sans animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-3xl bg-[#0f131c] border border-slate-800 shadow-2xl overflow-hidden flex flex-col text-right">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-black font-black shadow-lg shadow-amber-500/20">
              <Music className="w-5 h-5 fill-black" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>המרת פרק לפורמט MP3</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                  LAME Audio Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                עונה {episode.season} • פרק {episode.episodeNumber}: {episode.title}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Status Alert / Notification */}
          {hasExistingMp3 && !isConverting && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>קיים כבר קובץ MP3 מומר ושמור עבור פרק זה ({convertedBlob ? formatFileSize(convertedBlob.size) : 'שמור'})</span>
              </div>
              <button
                onClick={() => triggerDownload()}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow transition-all shrink-0 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>הורד עכשיו</span>
              </button>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Existing Audio Player Preview */}
          {convertedUrl && (
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  האזנה לקובץ ה-MP3:
                </span>
                {convertedBlob && (
                  <span className="font-mono text-slate-400 text-[11px]">
                    גודל קובץ: {formatFileSize(convertedBlob.size)}
                  </span>
                )}
              </div>
              <audio
                ref={audioRef}
                src={convertedUrl}
                controls
                className="w-full h-10 rounded-xl"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
              />
            </div>
          )}

          {/* Conversion Options */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>הגדרות איכות ופורמט MP3:</span>
            </h4>

            {/* Bitrate Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">קצב סיביות (Bitrate):</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    kbps: 192,
                    title: '192 kbps',
                    desc: 'מומלץ לפודקאסטים',
                    sub: 'איכות שידור מעולה וגודל קובץ נוח'
                  },
                  {
                    kbps: 320,
                    title: '320 kbps',
                    desc: 'איכות סטודיו מקסימלית',
                    sub: 'האיכות הגבוהה ביותר של MP3'
                  },
                  {
                    kbps: 128,
                    title: '128 kbps',
                    desc: 'קומפקטי ומהיר',
                    sub: 'קובץ קל משקל להפצה מהירה'
                  }
                ].map((item) => (
                  <button
                    key={item.kbps}
                    type="button"
                    onClick={() => setBitrate(item.kbps)}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      bitrate === item.kbps
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-white font-mono">{item.title}</span>
                        {bitrate === item.kbps && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                      </div>
                      <p className="text-xs font-bold text-amber-300/90 mt-1">{item.desc}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">{item.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Channels & Normalization Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Stereo / Mono */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">ערוצי שמע:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMono(false)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      !isMono
                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🎧 סטריאו (Stereo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMono(true)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      isMono
                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🎙️ מונו (Mono)
                  </button>
                </div>
              </div>

              {/* Peak Normalization */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">נרמול עוצמה (Loudness):</label>
                <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={normalize}
                    onChange={(e) => setNormalize(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-xs text-slate-300 font-medium select-none">
                    נרמול Peak אוטומטי לשידור נקי
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Progress Bar (when converting) */}
          {isConverting && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 flex items-center gap-2">
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ממיר את ההקלטה לפורמט MP3 איכותי...
                </span>
                <span className="font-mono font-bold text-amber-400">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                ההמרה מתבצעת ישירות על גבי המחשב שלך במהירות מקסימלית וללא צורך בהעלאה לשרת חיצוני.
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
          >
            סגור
          </button>

          <div className="flex items-center gap-2">
            {hasExistingMp3 && !isConverting && (
              <button
                onClick={() => triggerDownload()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all active:scale-95"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>הורד קובץ קיים</span>
              </button>
            )}

            <button
              onClick={handleStartConversion}
              disabled={isConverting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-black font-black text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              {isConverting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>ממיר כעת ({progress}%)...</span>
                </>
              ) : hasExistingMp3 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>המר מחדש בפורמט זה והורד</span>
                </>
              ) : (
                <>
                  <Music className="w-4 h-4 fill-black" />
                  <span>המר ל-MP3 והורד</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
