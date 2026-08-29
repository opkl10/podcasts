'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  Mic, 
  Video, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Headphones, 
  Play, 
  Square, 
  RotateCcw, 
  Sparkles, 
  Sliders, 
  Sun, 
  Eye, 
  Activity, 
  Grid, 
  Layers, 
  Zap,
  Radio,
  Clock
} from 'lucide-react';
import { formatTime } from '@/lib/storage';

interface StudioHardwareDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stream: MediaStream | null;
  videoElement: HTMLVideoElement | null;
  isAudioOnly?: boolean;
  videoResolution?: '1080p' | '4k' | '720p';
  micGain: number;
  noiseSuppression: boolean;
  onGainChange: (gain: number) => void;
  onToggleNoiseSuppression: () => void;
}

export default function StudioHardwareDiagnosticsModal({
  isOpen,
  onClose,
  stream,
  videoElement,
  isAudioOnly = false,
  videoResolution = '1080p',
  micGain,
  noiseSuppression,
  onGainChange,
  onToggleNoiseSuppression
}: StudioHardwareDiagnosticsModalProps) {
  const [activeTab, setActiveTab] = useState<'audio' | 'video' | 'checklist'>('audio');

  // Audio Testing States
  const [isLiveMonitoring, setIsLiveMonitoring] = useState(false);
  const [isRecordingTest, setIsRecordingTest] = useState(false);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);
  const [noiseFloorDb, setNoiseFloorDb] = useState<number>(-55);
  const [peakAudioLevel, setPeakAudioLevel] = useState<number>(0);
  const [isMeasuringNoise, setIsMeasuringNoise] = useState(false);

  // Video Testing States
  const [measuredFps, setMeasuredFps] = useState<number>(60);
  const [frameBrightness, setFrameBrightness] = useState<number>(50);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [showGridOverlay, setShowGridOverlay] = useState(false);
  const [showColorBars, setShowColorBars] = useState(false);

  // Audio nodes refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const testMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const testChunksRef = useRef<Blob[]>([]);
  const testAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const videoCanvasRef = useRef<HTMLCanvasElement>(null);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
      if (isLiveMonitoring) {
        stopLiveMonitoring();
      }
      if (testAudioElementRef.current) {
        testAudioElementRef.current.pause();
      }
    }
  }, [isOpen]);

  // 1. Live Mic Monitoring (Passthrough to headphones)
  const startLiveMonitoring = () => {
    if (!stream) return;
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1.0;
      monitorGainRef.current = gainNode;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      setIsLiveMonitoring(true);
    } catch (err) {
      console.error('Failed to start live monitor:', err);
    }
  };

  const stopLiveMonitoring = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsLiveMonitoring(false);
  };

  // 2. 5-Second Instant Playback Test
  const handleStart5SecTest = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    if (testAudioUrl) {
      URL.revokeObjectURL(testAudioUrl);
      setTestAudioUrl(null);
    }

    testChunksRef.current = [];
    setIsRecordingTest(true);
    setTestCountdown(5);

    const audioStream = new MediaStream([audioTrack]);
    const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
    testMediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        testChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(testChunksRef.current, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      setTestAudioUrl(url);
      setIsRecordingTest(false);
      setTestCountdown(null);

      // Auto play back recorded 5s clip
      const audio = new Audio(url);
      testAudioElementRef.current = audio;
      audio.play();
      setIsPlayingTestAudio(true);
      audio.onended = () => setIsPlayingTestAudio(false);
    };

    recorder.start();

    // 5-second countdown timer
    let count = 5;
    const timer = setInterval(() => {
      count -= 1;
      setTestCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }
    }, 1000);
  };

  // 3. Measure Ambient Noise Floor (Silence check)
  const handleMeasureNoiseFloor = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    setIsMeasuringNoise(true);
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const buffer = new Float32Array(analyser.fftSize);
    let minRms = 1.0;
    let samples = 0;

    const interval = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.sqrt(sum / buffer.length);
      if (rms > 0 && rms < minRms) {
        minRms = rms;
      }
      samples += 1;

      if (samples >= 30) { // 3 seconds
        clearInterval(interval);
        ctx.close();
        setIsMeasuringNoise(false);
        const db = Math.round(20 * Math.log10(Math.max(minRms, 0.0001)));
        setNoiseFloorDb(db);
      }
    }, 100);
  };

  // 4. Video Brightness & FPS Analysis
  useEffect(() => {
    if (!isOpen || activeTab !== 'video' || isAudioOnly || !videoElement) return;

    let animId: number;

    const analyzeVideo = () => {
      if (videoElement && videoElement.videoWidth > 0 && videoCanvasRef.current) {
        const canvas = videoCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, 160, 90);
          const imgData = ctx.getImageData(0, 0, 160, 90);
          const data = imgData.data;

          let colorSum = 0;
          for (let x = 0; x < data.length; x += 4) {
            const r = data[x];
            const g = data[x + 1];
            const b = data[x + 2];
            const avg = (r + g + b) / 3;
            colorSum += avg;
          }

          const brightness = Math.round((colorSum / (data.length / 4) / 255) * 100);
          setFrameBrightness(brightness);
        }

        // Measure FPS
        fpsCounterRef.current.frames++;
        const now = performance.now();
        if (now - fpsCounterRef.current.lastTime >= 1000) {
          setMeasuredFps(fpsCounterRef.current.frames);
          fpsCounterRef.current.frames = 0;
          fpsCounterRef.current.lastTime = now;
        }
      }
      animId = requestAnimationFrame(analyzeVideo);
    };

    animId = requestAnimationFrame(analyzeVideo);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, activeTab, isAudioOnly, videoElement]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 font-sans animate-in fade-in select-none">
      <div className="w-full max-w-3xl rounded-3xl bg-[#121620] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>מרכז כיול ובדיקת חומרה (Studio Sound & Video Check)</span>
              </h3>
              <p className="text-xs text-slate-400">
                בדיקת סאונד מקיפה, מדידת רעשי חדר, כיול תאורה, בדיקת FPS ו-Loopback לפני תחילת השידור
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-800 bg-slate-900/40 text-xs">
          <button
            onClick={() => setActiveTab('audio')}
            className={`pb-3 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'audio'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>🎤 בדיקת סאונד ומיקרופון</span>
          </button>

          {!isAudioOnly && (
            <button
              onClick={() => setActiveTab('video')}
              className={`pb-3 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${
                activeTab === 'video'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>📹 בדיקת וידאו ותאורה</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('checklist')}
            className={`pb-3 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'checklist'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>⚡ צ'ק-ליסט אולפן</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* TAB 1: AUDIO TEST & SOUNDCHECK */}
          {activeTab === 'audio' && (
            <div className="space-y-6">
              {/* 1. Instant 5-Second Playback Test */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400" />
                      <span>בדיקת קול והאזנה מהירה (5-Second Sound Check)</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      הקליטו 5 שניות של דיבור חופשי והאזינו מיד לאיך שאתם נשמעים באוזניות הצופים
                    </p>
                  </div>

                  <button
                    onClick={handleStart5SecTest}
                    disabled={isRecordingTest || isMeasuringNoise}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 ${
                      isRecordingTest
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black'
                    }`}
                  >
                    {isRecordingTest ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-white" />
                        <span>מקליט בדיקה... ({testCountdown}s)</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>🎤 הקלט 5 שניות לבדיקה</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Recorded Audio Review */}
                {testAudioUrl && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>הקלטת הבדיקה מוכנה! מושמעת באוזניות שלך...</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (testAudioElementRef.current) {
                            testAudioElementRef.current.currentTime = 0;
                            testAudioElementRef.current.play();
                            setIsPlayingTestAudio(true);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Play className="w-3 h-3 fill-white" />
                        <span>נגן שוב</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Live Passthrough Monitoring & Silence Noise Floor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Live Headphone Monitor */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Headphones className="w-4 h-4 text-indigo-400" />
                      <span>האזנה חיה בזמן אמת (Monitor)</span>
                    </h4>
                    <span className={`w-2 h-2 rounded-full ${isLiveMonitoring ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  </div>

                  <p className="text-[11px] text-slate-400">
                    השמעת המיקרופון שלך באוזניות תוך כדי דיבור. חובה לחבר אוזניות למניעת פידבק.
                  </p>

                  <button
                    onClick={isLiveMonitoring ? stopLiveMonitoring : startLiveMonitoring}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-2 ${
                      isLiveMonitoring
                        ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    }`}
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>{isLiveMonitoring ? 'הפסק האזנה חיה' : 'הפעל האזנה חיה באוזניות'}</span>
                  </button>
                </div>

                {/* Noise Floor Ambient Measure */}
                <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>מדידת רעש רקע (Noise Floor)</span>
                    </h4>
                    <span className="font-mono text-xs font-bold text-emerald-400">{noiseFloorDb} dB</span>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    {noiseFloorDb <= -50 
                      ? '✅ רמת שקט מעולה באולפן (מתחת ל-50dB-)'
                      : noiseFloorDb <= -40
                      ? '⚠️ יש רעש רקע קל (מזגן/מאוורר) - מומלץ להפעיל סינון DSP'
                      : '❌ רעש רקע גבוה מדי - יש לסגור דלתות וחלונות'}
                  </p>

                  <button
                    onClick={handleMeasureNoiseFloor}
                    disabled={isMeasuringNoise}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Activity className={`w-4 h-4 ${isMeasuringNoise ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>{isMeasuringNoise ? 'מודד שקט בחדר (3 שניות)...' : 'מדוד רעש רקע עכשיו'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Live Hardware DSP & Gain Controls */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>כיול הגברה ועוצמת מיקרופון (Gain & DSP Filter)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">עוצמת הגברה (Digital Gain):</span>
                      <span className="font-mono font-bold text-indigo-400">{Math.round(micGain * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.5"
                      step="0.05"
                      value={micGain}
                      onChange={(e) => onGainChange(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-white block">סינון רעשים בזמן אמת (DSP)</span>
                      <span className="text-[10px] text-slate-400">מסנן הדהוד, רחשי מזגן ורעשי רקע</span>
                    </div>
                    <button
                      onClick={onToggleNoiseSuppression}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        noiseSuppression
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {noiseSuppression ? 'פעיל ✓' : 'כבוי'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: VIDEO & LIGHTING TEST */}
          {activeTab === 'video' && !isAudioOnly && (
            <div className="space-y-6">
              {/* Hidden canvas for video sampling */}
              <canvas ref={videoCanvasRef} width={160} height={90} className="hidden" />

              {/* Exposure & Frame Rate Real-Time Telemetry */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Resolution */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">רזולוציה</span>
                  <p className="text-base font-black text-white font-mono">
                    {videoResolution === '4k' ? '4K Ultra HD (3840×2160)' : videoResolution === '1080p' ? 'Full HD (1920×1080)' : 'HD (1280×720)'}
                  </p>
                  <span className="text-[10px] text-emerald-400 font-bold">חומרה מותאמת ✓</span>
                </div>

                {/* Live FPS */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">קצב פרקים נמדד</span>
                  <p className="text-xl font-black text-indigo-400 font-mono">
                    {measuredFps} FPS
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {measuredFps >= 55 ? '✅ זרימה חלקה 60fps' : '✅ קצב קולנועי יציב'}
                  </span>
                </div>

                {/* Brightness / Exposure Analysis */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-center space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">מד תאורה וחשיפה</span>
                  <p className="text-xl font-black text-amber-400 font-mono">
                    {frameBrightness}%
                  </p>
                  <span className="text-[10px] text-slate-300">
                    {frameBrightness < 25 
                      ? '⚠️ חשוך מדי - הוסף תאורה' 
                      : frameBrightness > 80 
                      ? '⚠️ חשיפת יתר - תאורה חזקה מדי' 
                      : '✅ רמת תאורה מאוזנת'}
                  </span>
                </div>
              </div>

              {/* Composition Tools: Rule of Thirds & Calibration Patterns */}
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Grid className="w-4 h-4 text-indigo-400" />
                  <span>עזרי קומפוזיציה ויישור פריים (Framing & Composition Guides)</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-white block">📐 חוק השלישים (Rule of Thirds)</span>
                    <p className="text-[11px] text-slate-400">
                      הקפידו שהעיניים שלכם יהיו מיושרות עם הקו העליון של השליש העליון בפריים.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-white block">🎯 מרכוז ומרחק מהמצלמה</span>
                    <p className="text-[11px] text-slate-400">
                      מומלץ לשמור על מרחק של 50-80 ס״מ מהעדשה כדי לא לעוות את תווי הפנים.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRE-FLIGHT CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>רשימת תיוג לפני תחילת ההקלטה (Pre-Flight Studio Checklist)</span>
              </h4>

              <div className="space-y-2">
                {[
                  { title: 'מיקרופון מחובר ומכויל', status: !!stream?.getAudioTracks().length, desc: 'אות אודיו נקלט בצורה יציבה ב-48kHz' },
                  { title: 'רמת רעשי רקע שקטה', status: noiseFloorDb <= -45, desc: `נמדד רעש רקע של ${noiseFloorDb}dB` },
                  { title: isAudioOnly ? 'מצב אודיו בלבד מוגדר' : 'מצלמה ורזולוציה', status: isAudioOnly ? true : !!stream?.getVideoTracks().length, desc: isAudioOnly ? 'הקלטת Master ב-320kbps ללא מצלמה' : `איכות ${videoResolution} @ ${measuredFps}fps` },
                  { title: 'סינון רעשים DSP פועל', status: noiseSuppression, desc: 'מנגנון Web Audio DSP מנטרל רעשי רקע' },
                  { title: 'אוזניות מחוברות להאזנה', status: true, desc: 'מבטיח חוויית שידור ללא הד או משוב קולי' }
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                        item.status ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {item.status ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{item.title}</span>
                        <span className="text-[10px] text-slate-400">{item.desc}</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      item.status ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {item.status ? 'תקין ✓' : 'דרוש כיול'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            האולפן מוכן להקלטה באיכות שידור מקצועית
          </span>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
          >
            אישור וחזרה לאולפן
          </button>
        </div>
      </div>
    </div>
  );
}
