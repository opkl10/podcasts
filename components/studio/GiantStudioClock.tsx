'use client';

import React, { useState, useEffect } from 'react';
import { Episode, TopicItem } from '@/lib/types';
import { formatTime } from '@/lib/storage';
import { 
  Clock, 
  Maximize2, 
  Minimize2, 
  Play, 
  Pause, 
  Square, 
  Tag, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Radio, 
  Mic, 
  Sparkles,
  Volume2
} from 'lucide-react';

interface GiantStudioClockProps {
  isOpen: boolean;
  onClose: () => void;
  isRecording: boolean;
  isPaused: boolean;
  recordedSeconds: number;
  activeTopicSeconds: number;
  currentTopic?: TopicItem;
  currentTopicIndex: number;
  totalTopicsCount: number;
  episode: Episode;
  stream: MediaStream | null;
  onTogglePause: () => void;
  onStopRecording: () => void;
  onAddMarker: (label: string, type: any) => void;
  onNextTopic: () => void;
  onPrevTopic: () => void;
}

export default function GiantStudioClock({
  isOpen,
  onClose,
  isRecording,
  isPaused,
  recordedSeconds,
  activeTopicSeconds,
  currentTopic,
  currentTopicIndex,
  totalTopicsCount,
  episode,
  stream,
  onTogglePause,
  onStopRecording,
  onAddMarker,
  onNextTopic,
  onPrevTopic
}: GiantStudioClockProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Attach live video stream to PiP preview
  useEffect(() => {
    if (isOpen && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error(e));
    }
  }, [isOpen, stream]);

  if (!isOpen) return null;

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(e => console.error(e));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(e => console.error(e));
      setIsFullscreen(false);
    }
  };

  const targetSeconds = episode.targetDurationMinutes * 60;
  const progressPercent = Math.min(100, Math.round((recordedSeconds / Math.max(1, targetSeconds)) * 100));

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#07090e] text-white flex flex-col justify-between p-6 sm:p-10 font-sans select-none animate-in fade-in duration-200"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        {/* Studio ON AIR Status */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2.5 px-5 py-2 rounded-2xl border ${
            isRecording 
              ? (isPaused ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-red-600/30 border-red-500 text-red-400 animate-pulse') 
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <span className={`w-4 h-4 rounded-full ${
              isRecording ? (isPaused ? 'bg-amber-400' : 'bg-red-500') : 'bg-slate-600'
            }`} />
            <span className="text-sm font-black uppercase tracking-widest font-mono">
              {isRecording ? (isPaused ? 'שידור מושהה (PAUSED)' : 'שידור חי מקליט (ON AIR)') : 'אולפן בהמתנה'}
            </span>
          </div>

          <div>
            <h2 className="text-base font-bold text-white truncate max-w-md">{episode.title}</h2>
            <p className="text-xs text-slate-400">עונה {episode.season} • פרק {episode.episodeNumber}</p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Pop-out to 2nd Monitor */}
          <button
            onClick={() => {
              window.open(`/episodes/${episode.id}/clock`, 'CastFlowClock', 'popup=yes,width=1280,height=800');
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold transition-all shadow active:scale-98"
            title="פתח שעון בחלון נפרד למסך משני"
          >
            <Radio className="w-4 h-4 text-indigo-400" />
            <span>העבר לחלון נפרד (מסך שני / iPad)</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="מסך מלא"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <button
            onClick={onClose}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="חזרה לאולפן"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Center Area: Giant Studio LED Digital Clock */}
      <div className="flex-1 flex flex-col items-center justify-center my-6 space-y-8 text-center relative">
        {/* Floating Camera PiP in Corner */}
        {stream && (
          <div className="absolute top-0 right-0 w-44 sm:w-56 aspect-video rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform -scale-x-100"
            />
            <div className="absolute bottom-1 right-2 px-2 py-0.5 rounded bg-black/75 text-[10px] font-bold text-slate-300">
              מצלמת שידור
            </div>
          </div>
        )}

        {/* GIANT LED TIME DISPLAY */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-400 font-semibold">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>זמן הקלטה כולל (Total Broadcast Time)</span>
          </div>

          <div className="text-7xl sm:text-9xl md:text-[140px] font-black font-mono tracking-tighter text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.15)] leading-none select-none">
            {formatTime(recordedSeconds, true)}
          </div>

          {/* Target Progress Bar */}
          <div className="w-full max-w-xl mx-auto space-y-1.5 pt-2">
            <div className="flex justify-between text-xs text-slate-400 font-mono">
              <span>יעד פרק: {episode.targetDurationMinutes} דק'</span>
              <span className="font-bold text-indigo-400">{progressPercent}%</span>
              <span>נותרו: {formatTime(Math.max(0, targetSeconds - recordedSeconds))}</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Current Active Topic Box */}
        {currentTopic && (
          <div className="w-full max-w-2xl p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl flex items-center justify-between gap-4">
            <button
              onClick={onPrevTopic}
              disabled={currentTopicIndex === 0}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex-1 text-center min-w-0 space-y-1">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-400">
                <span>נושא {currentTopicIndex + 1} מתוך {totalTopicsCount}</span>
                <span>•</span>
                <span className="text-amber-400 font-mono">זמן נושא: {formatTime(activeTopicSeconds)}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white truncate">{currentTopic.title}</h3>
              {currentTopic.talkingPoints.length > 0 && (
                <p className="text-xs text-slate-400 line-clamp-1">
                  נקודה: {currentTopic.talkingPoints[0]}
                </p>
              )}
            </div>

            <button
              onClick={onNextTopic}
              disabled={currentTopicIndex >= totalTopicsCount - 1}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar: Touch-Friendly Large Controls */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-slate-800/80">
        {/* Pause / Resume */}
        {isRecording && (
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-black shadow-xl transition-all active:scale-95 ${
              isPaused 
                ? 'bg-amber-500 text-black hover:bg-amber-400' 
                : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
            <span>{isPaused ? 'המשך הקלטה' : 'השהה טיימר'}</span>
          </button>
        )}

        {/* Quick Marker: Highlight */}
        {isRecording && (
          <button
            onClick={() => onAddMarker('⭐ רגע שיא בשידור', 'highlight')}
            className="flex items-center gap-2.5 px-6 py-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-bold shadow-lg transition-all active:scale-95"
          >
            <Sparkles className="w-5 h-5" />
            <span>סמן רגע שיא (Highlight)</span>
          </button>
        )}

        {/* Stop Recording */}
        {isRecording && (
          <button
            onClick={onStopRecording}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-base font-black shadow-xl shadow-rose-950/60 transition-all active:scale-95"
          >
            <Square className="w-5 h-5 fill-white" />
            <span>עצור ושמור הקלטה</span>
          </button>
        )}

        {/* Back to Studio Mode */}
        <button
          onClick={onClose}
          className="px-6 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-sm font-semibold transition-colors"
        >
          חזרה למסך האולפן
        </button>
      </div>
    </div>
  );
}
