'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Volume2, 
  VolumeX,
  Mic, 
  MicOff,
  Headphones, 
  Play, 
  Square, 
  RotateCcw, 
  Wand2, 
  Sliders, 
  Sparkles,
  CheckCircle2,
  X,
  Radio,
  Activity,
  Users
} from 'lucide-react';
import { AudioInputDevice, AudioOutputDevice } from '@/lib/types';
import { setElementSinkId } from '@/lib/mediaManager';

interface StudioAudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Mic Input
  audioDevices: AudioInputDevice[];
  selectedAudioId: string;
  onSelectAudioId: (id: string) => void;
  isAudioMuted: boolean;
  onToggleMute: () => void;
  micGain: number;
  onGainChange: (gain: number) => void;
  noiseSuppression: boolean;
  onToggleNoiseSuppression: () => void;
  isAutoGainControl: boolean;
  onToggleAutoGainControl: () => void;
  audioChannelMode: 'stereo' | 'mono';
  onChangeChannelMode: (mode: 'stereo' | 'mono') => void;
  // Audio Output (Headphones / Speakers)
  audioOutputs: AudioOutputDevice[];
  selectedAudioOutputId: string;
  onSelectAudioOutputId: (id: string) => void;
  // Remote Guest / Co-Host Audio
  guestVolume: number;
  onChangeGuestVolume: (vol: number) => void;
  guestStatus: 'idle' | 'connecting' | 'connected' | 'error';
  guestName?: string;
  isCoHost?: boolean;
  // Live Headphone Monitoring
  isMonitoringMic: boolean;
  onToggleMonitoring: () => void;
  // Audio Test Refs
  stream: MediaStream | null;
  guestAudioElement?: HTMLAudioElement | null;
}

export default function StudioAudioSettingsModal({
  isOpen,
  onClose,
  audioDevices,
  selectedAudioId,
  onSelectAudioId,
  isAudioMuted,
  onToggleMute,
  micGain,
  onGainChange,
  noiseSuppression,
  onToggleNoiseSuppression,
  isAutoGainControl,
  onToggleAutoGainControl,
  audioChannelMode,
  onChangeChannelMode,
  audioOutputs,
  selectedAudioOutputId,
  onSelectAudioOutputId,
  guestVolume,
  onChangeGuestVolume,
  guestStatus,
  guestName,
  isCoHost,
  isMonitoringMic,
  onToggleMonitoring,
  stream,
  guestAudioElement
}: StudioAudioSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'output' | 'input' | 'soundcheck'>('output');

  // Test sound player state
  const [isPlayingTestTone, setIsPlayingTestTone] = useState(false);
  const testToneAudioRef = useRef<HTMLAudioElement | null>(null);

  // Live Soundcheck Take States
  const [isRecordingCheck, setIsRecordingCheck] = useState(false);
  const [checkCountdown, setCheckCountdown] = useState<number | null>(null);
  const [checkAudioUrl, setCheckAudioUrl] = useState<string | null>(null);
  const checkMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const checkChunksRef = useRef<Blob[]>([]);
  const checkAudioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // VU Meter state
  const [liveMeterLevel, setLiveMeterLevel] = useState<number>(0);
  const meterContextRef = useRef<AudioContext | null>(null);
  const meterAnalyserRef = useRef<AnalyserNode | null>(null);
  const meterAnimFrameRef = useRef<number | null>(null);

  // Apply SinkId to guest audio & test player
  useEffect(() => {
    if (selectedAudioOutputId) {
      if (guestAudioElement) {
        setElementSinkId(guestAudioElement, selectedAudioOutputId);
      }
      if (testToneAudioRef.current) {
        setElementSinkId(testToneAudioRef.current, selectedAudioOutputId);
      }
      if (checkAudioPlayerRef.current) {
        setElementSinkId(checkAudioPlayerRef.current, selectedAudioOutputId);
      }
    }
  }, [selectedAudioOutputId, guestAudioElement]);

  // Live VU Meter hook when modal is open
  useEffect(() => {
    if (!isOpen || !stream) return;

    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      meterContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      meterAnalyserRef.current = analyser;
      source.connect(analyser);

      const updateMeter = () => {
        if (!meterAnalyserRef.current) return;
        const data = new Uint8Array(meterAnalyserRef.current.frequencyBinCount);
        meterAnalyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        setLiveMeterLevel(Math.min(100, Math.round((avg / 128) * 100)));
        meterAnimFrameRef.current = requestAnimationFrame(updateMeter);
      };

      meterAnimFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (e) {}

    return () => {
      if (meterAnimFrameRef.current) cancelAnimationFrame(meterAnimFrameRef.current);
      if (meterContextRef.current) meterContextRef.current.close().catch(() => {});
    };
  }, [isOpen, stream]);

  if (!isOpen) return null;

  // Play synthetic Studio Test Chime via Web Audio (guaranteed to work offline and with zero external assets)
  const playTestTone = async () => {
    try {
      setIsPlayingTestTone(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();

      // If setSinkId is supported on AudioContext
      if (selectedAudioOutputId && typeof (ctx as any).setSinkId === 'function') {
        try { await (ctx as any).setSinkId(selectedAudioOutputId); } catch {}
      }

      // Studio pleasant two-tone chime (F4 349Hz -> A4 440Hz -> C5 523Hz)
      const now = ctx.currentTime;
      const notes = [349.23, 440.0, 523.25];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.001, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.3, now + idx * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.5);
      });

      setTimeout(() => {
        setIsPlayingTestTone(false);
        try { ctx.close(); } catch {}
      }, 1000);
    } catch (e) {
      setIsPlayingTestTone(false);
    }
  };

  // Soundcheck Take (5s Quick Voice Test)
  const handleStartSoundcheck = () => {
    if (!stream) return;
    setCheckAudioUrl(null);
    setCheckCountdown(5);
    checkChunksRef.current = [];

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      const rec = new MediaRecorder(new MediaStream([audioTracks[0]]));
      checkMediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) checkChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(checkChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setCheckAudioUrl(url);
        setIsRecordingCheck(false);
      };
      rec.start();
      setIsRecordingCheck(true);

      let timeLeft = 5;
      const timer = setInterval(() => {
        timeLeft--;
        setCheckCountdown(timeLeft);
        if (timeLeft <= 0) {
          clearInterval(timer);
          setCheckCountdown(null);
          if (rec.state !== 'inactive') rec.stop();
        }
      }, 1000);
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-2xl bg-[#0f121a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white shadow-lg shadow-indigo-600/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>מרכז הגדרות שמע וסאונד</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  Studio DSP 48kHz
                </span>
              </h3>
              <p className="text-xs text-slate-400">הגדרת רמקולים, אוזניות, מיקרופונים ועוצמת מנחה שותף/ה</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800/80 bg-slate-950/50 p-2 gap-1.5">
          <button
            onClick={() => setActiveTab('output')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'output'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span>פלט שמע ואוזניות</span>
          </button>
          <button
            onClick={() => setActiveTab('input')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'input'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>מיקרופון ראשי ו-DSP</span>
          </button>
          <button
            onClick={() => setActiveTab('soundcheck')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'soundcheck'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>בדיקת סאונד טייק</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-right">
          {activeTab === 'output' && (
            <div className="space-y-5">
              {/* Output Device Selection (Headphones / Speakers) */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">התקן פלט שמע (אוזניות / רמקולים):</span>
                  </div>
                  <button
                    onClick={playTestTone}
                    disabled={isPlayingTestTone}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                      isPlayingTestTone 
                        ? 'bg-cyan-600 text-white border-cyan-400 animate-pulse' 
                        : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-slate-700'
                    }`}
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isPlayingTestTone ? 'משמיע צליל...' : 'בדיקת סאונד'}</span>
                  </button>
                </div>

                {audioOutputs.length > 0 ? (
                  <select
                    value={selectedAudioOutputId}
                    onChange={(e) => onSelectAudioOutputId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">ברירת מחדל של מערכת ההפעלה (Default Output)</option>
                    {audioOutputs.map(out => (
                      <option key={out.deviceId} value={out.deviceId}>
                        {out.label} {out.isDefault ? '(ברירת מחדל)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
                    <span>הסאונד מנותב להתקן ברירת המחדל של המחשב (אוזניות/רמקולים מחוברים).</span>
                  </div>
                )}
              </div>

              {/* Co-Host & Remote Guest Volume Control */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      {isCoHost ? 'עוצמת שמע מנחה שותף/ה:' : 'עוצמת שמע אורח/ת:'}
                    </span>
                    {guestName && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/30">
                        {guestName}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-emerald-400 font-bold text-xs">
                    {Math.round(guestVolume * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onChangeGuestVolume(guestVolume > 0 ? 0 : 1.0)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                      guestVolume === 0
                        ? 'bg-rose-600/30 border-rose-500 text-rose-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title={guestVolume === 0 ? 'בטל השתקת שותף' : 'השתק שותף'}
                  >
                    {guestVolume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={guestVolume}
                    onChange={(e) => onChangeGuestVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      guestStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                    }`} />
                    <span>סטטוס חיבור שמע: {guestStatus === 'connected' ? 'מחובר ומשדר בזמן אמת ✓' : 'ממתין להתחברות'}</span>
                  </span>
                  <div className="flex gap-1">
                    {[0.5, 1.0, 1.5, 2.0].map((v) => (
                      <button
                        key={v}
                        onClick={() => onChangeGuestVolume(v)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${
                          Math.abs(guestVolume - v) < 0.05
                            ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {Math.round(v * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Headphone Live Monitoring (Passthrough) */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Headphones className="w-4 h-4 text-cyan-400" />
                    <span>מוניטור אוזניות אישי (Live Passthrough)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    מאפשר לך לשמוע את קולך באוזניות בזמן דיבור כדי לוודא שאתה נשמע צלול
                  </p>
                </div>
                <button
                  onClick={onToggleMonitoring}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-md active:scale-95 ${
                    isMonitoringMic
                      ? 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-600/30'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  {isMonitoringMic ? 'מוניטור פעיל ✓' : 'הפעל מוניטור'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'input' && (
            <div className="space-y-5">
              {/* Mic Input Device Dropdown */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">מיקרופון קלט ראשי:</span>
                  </div>
                  <button
                    onClick={onToggleMute}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                      isAudioMuted
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white'
                    }`}
                  >
                    {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isAudioMuted ? 'השתקה פעילה' : 'השתק'}</span>
                  </button>
                </div>

                <select
                  value={selectedAudioId}
                  onChange={(e) => onSelectAudioId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  {audioDevices.map(a => (
                    <option key={a.deviceId} value={a.deviceId}>
                      {a.label}
                    </option>
                  ))}
                </select>

                {/* Live VU Meter */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>מד עוצמת קול חי (VU Meter)</span>
                    <span className={liveMeterLevel > 80 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                      {liveMeterLevel}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                    <div 
                      className={`h-full transition-all duration-75 rounded-full ${
                        liveMeterLevel > 85 ? 'bg-rose-500' : liveMeterLevel > 65 ? 'bg-amber-400' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${liveMeterLevel}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Mic Gain Controls */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                    <span>הגבר מיקרופון (Gain / Preamp Boost):</span>
                  </span>
                  <span className="font-mono text-indigo-400 font-bold text-xs">
                    {Math.round(micGain * 100)}%
                  </span>
                </div>

                {/* Preset Pills */}
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '100% רגיל', gain: 1.0 },
                    { label: '🚀 200% דש', gain: 2.0 },
                    { label: '⚡ 350% חלש', gain: 3.5 },
                    { label: '🔥 500% מקס', gain: 5.0 },
                  ].map((p) => {
                    const isActive = Math.abs(micGain - p.gain) < 0.1;
                    return (
                      <button
                        key={p.gain}
                        type="button"
                        onClick={() => onGainChange(p.gain)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-center ${
                          isActive
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 ring-1 ring-indigo-500/40'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="range"
                  min="0"
                  max="5.0"
                  step="0.05"
                  value={micGain}
                  onChange={(e) => onGainChange(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                />
              </div>

              {/* DSP Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Noise Filter */}
                <button
                  type="button"
                  onClick={onToggleNoiseSuppression}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-start justify-between gap-2 transition-all ${
                    noiseSuppression
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Wand2 className="w-4 h-4 text-emerald-400" />
                    <span>DSP סינון רעשים</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-400">
                    {noiseSuppression ? 'מופעל (פילטר 55Hz)' : 'כבוי (לכידה טבעית)'}
                  </span>
                </button>

                {/* Auto Gain Control */}
                <button
                  type="button"
                  onClick={onToggleAutoGainControl}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-start justify-between gap-2 transition-all ${
                    isAutoGainControl
                      ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span>איזון ווליום (AGC)</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-400">
                    {isAutoGainControl ? 'מאוזן אוטומטית' : 'ידני לפי סליידר'}
                  </span>
                </button>

                {/* Channel Mode */}
                <button
                  type="button"
                  onClick={() => onChangeChannelMode(audioChannelMode === 'stereo' ? 'mono' : 'stereo')}
                  className="p-3 rounded-2xl border border-slate-800 bg-slate-900/60 text-xs font-bold flex flex-col items-start justify-between gap-2 text-slate-300 hover:text-white transition-all"
                >
                  <div className="flex items-center gap-1.5">
                    <Headphones className="w-4 h-4 text-purple-400" />
                    <span>ערוץ הקלטה</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300">
                    {audioChannelMode === 'stereo' ? 'Stereo (2-ערוצים)' : 'Mono (ערוץ יחיד)'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'soundcheck' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 text-center space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">בדיקת טייק סאונד מהירה (Soundcheck Take)</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    הקלט 5 שניות של דיבור כדי לבדוק איך קולך נשמע באוזניות של המאזינים לפני תחילת הפרק.
                  </p>
                </div>

                {/* Record Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleStartSoundcheck}
                    disabled={isRecordingCheck}
                    className={`px-6 py-3 rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 active:scale-95 transition-all ${
                      isRecordingCheck
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white'
                    }`}
                  >
                    {isRecordingCheck ? (
                      <>
                        <Square className="w-4 h-4 fill-current" />
                        <span>מקליט בדיקה... ({checkCountdown} שנ')</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        <span>הקלט בדיקת סאונד (5 שניות)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Instant Playback */}
                {checkAudioUrl && (
                  <div className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/40 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs text-indigo-300 font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>טייק בדיקה הוקלט בהצלחה!</span>
                      </span>
                      <span>האזנה מיידית</span>
                    </div>

                    <audio
                      ref={checkAudioPlayerRef}
                      src={checkAudioUrl}
                      controls
                      autoPlay
                      className="w-full h-10 rounded-xl"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            כל שינויי הסאונד מוחלים באופן מיידי וממוקססים לתוך ההקלטה.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg active:scale-95"
          >
            אישור וסגירה
          </button>
        </div>
      </div>
    </div>
  );
}
