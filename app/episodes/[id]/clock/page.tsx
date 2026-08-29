'use client';

import React, { useState, useEffect, use, useRef } from 'react';
import { StudioClockBroadcaster, ClockSyncState } from '@/lib/clockSync';
import { getEpisodeById, formatTime } from '@/lib/storage';
import { 
  Clock, 
  Maximize2, 
  Minimize2, 
  Play, 
  Pause, 
  Square, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Radio, 
  Tv, 
  Wifi, 
  WifiOff, 
  Layers
} from 'lucide-react';

interface ClockPageProps {
  params: Promise<{ id: string }>;
}

export default function StandaloneClockPage({ params }: ClockPageProps) {
  const resolvedParams = use(params);
  const episodeId = resolvedParams.id;

  const [state, setState] = useState<ClockSyncState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const broadcasterRef = useRef<StudioClockBroadcaster | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    // 1. Initial State from localStorage / DB
    const initialEp = getEpisodeById(episodeId);
    if (initialEp) {
      setState({
        episodeId: initialEp.id,
        isRecording: false,
        isPaused: false,
        recordedSeconds: 0,
        activeTopicSeconds: 0,
        activeTopicIndex: 0,
        targetDurationMinutes: initialEp.targetDurationMinutes || 45,
        episodeTitle: initialEp.title,
        season: initialEp.season,
        episodeNumber: initialEp.episodeNumber,
        topics: initialEp.topics.map(t => ({
          id: t.id,
          title: t.title,
          talkingPoints: t.talkingPoints
        }))
      });
    }

    // Check localStorage cached state
    try {
      const cached = localStorage.getItem(`castflow_clock_state_${episodeId}`);
      if (cached) {
        setState(JSON.parse(cached));
        setIsConnected(true);
      }
    } catch (e) {}

    // 2. Setup BroadcastChannel listener
    const broadcaster = new StudioClockBroadcaster(episodeId);
    broadcasterRef.current = broadcaster;

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`castflow_clock_${episodeId}`);
      channel.onmessage = (event) => {
        if (event.data && event.data._isState) {
          setState(event.data.state);
          setIsConnected(true);
        }
      };

      return () => {
        channel.close();
        broadcaster.close();
      };
    }
  }, [episodeId]);

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

  const handleAction = (type: any) => {
    if (broadcasterRef.current) {
      broadcasterRef.current.sendAction({ type });
    }
  };

  if (!isMounted || !state) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white" suppressHydrationWarning>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-300">מתחבר לשעון האולפן...</span>
        </div>
      </div>
    );
  }

  const targetSeconds = state.targetDurationMinutes * 60;
  const progressPercent = Math.min(100, Math.round((state.recordedSeconds / Math.max(1, targetSeconds)) * 100));
  const currentTopic = state.topics[state.activeTopicIndex] || state.topics[0];

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#05070c] text-white flex flex-col justify-between p-6 sm:p-12 font-sans select-none"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2.5 px-6 py-2.5 rounded-2xl border ${
            state.isRecording 
              ? (state.isPaused ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-red-600/30 border-red-500 text-red-400 animate-pulse') 
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <span className={`w-4 h-4 rounded-full ${
              state.isRecording ? (state.isPaused ? 'bg-amber-400' : 'bg-red-500') : 'bg-slate-600'
            }`} />
            <span className="text-sm sm:text-base font-black uppercase tracking-widest font-mono">
              {state.isRecording ? (state.isPaused ? 'שידור מושהה (PAUSED)' : 'שידור חי מקליט (ON AIR)') : 'אולפן בהמתנה'}
            </span>
          </div>

          <div>
            <h1 className="text-base sm:text-xl font-black text-white truncate max-w-lg">{state.episodeTitle}</h1>
            <p className="text-xs text-slate-400">עונה {state.season} • פרק {state.episodeNumber}</p>
          </div>
        </div>

        {/* Status & Fullscreen */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-emerald-400">
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">מסך שני מסונכרן</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="מסך מלא"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Center Stage: Huge LED Digital Studio Clock */}
      <div className="flex-1 flex flex-col items-center justify-center my-6 space-y-8 text-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-400 font-bold uppercase tracking-wider">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>זמן הקלטה כולל (Broadcast Time)</span>
          </div>

          <div className="text-8xl sm:text-[140px] md:text-[180px] font-black font-mono tracking-tighter text-white drop-shadow-[0_0_50px_rgba(255,255,255,0.2)] leading-none select-none">
            {formatTime(state.recordedSeconds, true)}
          </div>

          {/* Progress Bar & Pacing */}
          <div className="w-full max-w-2xl mx-auto space-y-2 pt-2">
            <div className="flex justify-between text-xs sm:text-sm text-slate-400 font-mono">
              <span>יעד פרק: {state.targetDurationMinutes} דק'</span>
              <span className="font-bold text-indigo-400">{progressPercent}%</span>
              <span>נותרו: {formatTime(Math.max(0, targetSeconds - state.recordedSeconds))}</span>
            </div>
            <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Current Active Topic Card */}
        {currentTopic && (
          <div className="w-full max-w-3xl p-6 rounded-3xl bg-slate-900/95 border border-slate-800 shadow-2xl flex items-center justify-between gap-4">
            <button
              onClick={() => handleAction('PREV_TOPIC')}
              disabled={state.activeTopicIndex === 0}
              className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            <div className="flex-1 text-center min-w-0 space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-indigo-400">
                <span>נושא {state.activeTopicIndex + 1} מתוך {state.topics.length}</span>
                <span>•</span>
                <span className="text-amber-400 font-mono">זמן נושא: {formatTime(state.activeTopicSeconds)}</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white truncate">{currentTopic.title}</h2>
              {currentTopic.talkingPoints.length > 0 && (
                <p className="text-xs sm:text-sm text-slate-300 line-clamp-1 font-medium">
                  {currentTopic.talkingPoints[0]}
                </p>
              )}
            </div>

            <button
              onClick={() => handleAction('NEXT_TOPIC')}
              disabled={state.activeTopicIndex >= state.topics.length - 1}
              className="p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Bar: Touch-Friendly Interactive Controls */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-5 border-t border-slate-800/80">
        {state.isRecording && (
          <button
            onClick={() => handleAction('TOGGLE_PAUSE')}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-black shadow-xl transition-all active:scale-95 ${
              state.isPaused 
                ? 'bg-amber-500 text-black hover:bg-amber-400' 
                : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {state.isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5" />}
            <span>{state.isPaused ? 'המשך הקלטה' : 'השהה טיימר'}</span>
          </button>
        )}

        {state.isRecording && (
          <button
            onClick={() => handleAction('HIGHLIGHT_MARKER')}
            className="flex items-center gap-2.5 px-7 py-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-base font-bold shadow-lg transition-all active:scale-95"
          >
            <Sparkles className="w-5 h-5" />
            <span>סמן רגע שיא (Highlight)</span>
          </button>
        )}

        {state.isRecording && (
          <button
            onClick={() => handleAction('STOP_RECORDING')}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-base font-black shadow-xl shadow-rose-950/60 transition-all active:scale-95"
          >
            <Square className="w-5 h-5 fill-white" />
            <span>עצור ושמור הקלטה</span>
          </button>
        )}
      </div>
    </div>
  );
}
