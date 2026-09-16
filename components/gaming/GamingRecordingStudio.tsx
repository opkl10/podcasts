'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  Gamepad2, 
  MonitorPlay, 
  Cast, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sliders, 
  LayoutGrid, 
  Monitor, 
  SplitSquareVertical, 
  RotateCw, 
  Play, 
  Square, 
  Pause, 
  Download, 
  Check, 
  Sparkles, 
  Zap, 
  Shield, 
  Smartphone, 
  ArrowRight, 
  Settings, 
  Radio, 
  Layers, 
  Maximize2, 
  ExternalLink, 
  RefreshCw, 
  X,
  FlipHorizontal,
  Flame,
  Award,
  CircleDot,
  Info,
  Headphones,
  Crop,
  ZoomIn,
  ZoomOut,
  Move,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Timer,
  Plus,
  Eye,
  EyeOff,
  PanelRight,
  RotateCcw,
  StopCircle,
  ShieldAlert,
  Pencil,
  Unlock,
} from 'lucide-react';
import { 
  getMediaDevices, 
  StudioAudioProcessor, 
  getVideoConstraints, 
  VideoResolution, 
  getScreenCaptureStream, 
  GamingAudioMixer,
  getCaptureCardConstraints,
  applyCaptureCardResolution
} from '@/lib/mediaManager';
import { StudioWebRTCReceiver } from '@/lib/webrtcClient';
import { Episode, TimestampMarker, AudioInputDevice, VideoInputDevice } from '@/lib/types';
import { saveMediaBlob, saveEpisode, formatTime } from '@/lib/storage';
import PostRecordingReview from '@/components/studio/PostRecordingReview';
import RemoteCamModal from '@/components/studio/RemoteCamModal';
import OverlayCanvas, { OVERLAY_CATALOG } from './OverlayCanvas';
import type { OverlayItem, OverlayType } from './OverlayCanvas';
import SimpleOverlayManager from './SimpleOverlayManager';

// Web Audio synthesizer beep for countdown (3, 2, 1, GO)
function playCountdownBeep(isFinal: boolean = false) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isFinal ? 0.35 : 0.12));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (isFinal ? 0.35 : 0.12));
  } catch (e) {
    // Ignore audio restriction
  }
}

interface GamingRecordingStudioProps {
  episode: Episode;
}

export default function GamingRecordingStudio({ episode }: GamingRecordingStudioProps) {
  const [currentEpisode, setCurrentEpisode] = useState<Episode>(episode);
  const currentEpisodeRef = useRef<Episode>(episode);

  // Quality & Resolution: 4K UHD vs 1080p FHD vs 720p HD (All 60FPS)
  const [videoResolution, setVideoResolution] = useState<VideoResolution>('1080p');

  // Video and Audio Hardware Devices
  const [videoDevices, setVideoDevices] = useState<VideoInputDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');

  // Primary Audio & Video Streams
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [facecamStream, setFacecamStream] = useState<MediaStream | null>(null);
  const [isFacecamInitializing, setIsFacecamInitializing] = useState<boolean>(false);
  const [facecamError, setFacecamError] = useState<string | null>(null);
  const [facecamDetails, setFacecamDetails] = useState<{ width: number; height: number; fps: number; label: string } | null>(null);
  const facecamStreamRef = useRef<MediaStream | null>(null);
  const deckBPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);

  // Load preferred camera on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gaming_studio_preferred_camera');
      if (saved) {
        setSelectedVideoId(saved);
      }
    } catch {}
  }, []);

  // Wireless iPhone RemoteCam (WebRTC)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isUsingRemoteCam, setIsUsingRemoteCam] = useState(false);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [remoteConnectionStatus, setRemoteConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const webrtcReceiverRef = useRef<StudioWebRTCReceiver | null>(null);

  // Sync Deck B miniature preview with facecamStream or remoteStream
  useEffect(() => {
    if (deckBPreviewRef.current) {
      const activeStream = isUsingRemoteCam ? remoteStream : facecamStream;
      if (activeStream) {
        deckBPreviewRef.current.srcObject = activeStream;
        deckBPreviewRef.current.play().catch(() => {});
      } else {
        deckBPreviewRef.current.srcObject = null;
      }
    }
  }, [facecamStream, remoteStream, isUsingRemoteCam]);

  // Gameplay Capture Streams (Screen / Window vs Elgato Capture Card)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [captureCardStream, setCaptureCardStream] = useState<MediaStream | null>(null);
  const [selectedCaptureCardId, setSelectedCaptureCardId] = useState<string>('');
  const [gameplaySourceType, setGameplaySourceType] = useState<'screen' | 'capture_card' | null>(null);

  // Facecam Visual Styling & Layout Engine
  const [facecamLayout, setFacecamLayout] = useState<'solo_game' | 'pip_br' | 'pip_bl' | 'pip_tr' | 'pip_tl' | 'solo_cam' | 'split'>('pip_br');
  const [isLayoutMenuOpen, setIsLayoutMenuOpen] = useState<boolean>(false);
  const layoutMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLayoutMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setIsLayoutMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isLayoutMenuOpen]);

  const [facecamShape, setFacecamShape] = useState<'rounded' | 'circle' | 'rectangle'>('rounded');
  const [facecamAspect, setFacecamAspect] = useState<'auto' | '16:9' | '4:3' | '1:1' | '9:16'>('auto');
  const [facecamSize, setFacecamSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [facecamGlowColor, setFacecamGlowColor] = useState<string>('#06b6d4');
  const [facecamGlowBlur, setFacecamGlowBlur] = useState<number>(15);
  const [facecamBorderWidth, setFacecamBorderWidth] = useState<number>(3);
  const [gamerTag, setGamerTag] = useState<string>(episode.title || 'GamerPro');
  const [showGamerHud, setShowGamerHud] = useState<boolean>(true);

  // Audio Mixer (Mic + Gameplay Sound)
  const [micGain, setMicGain] = useState<number>(1.0);
  const [gameAudioVolume, setGameAudioVolume] = useState<number>(1.0);
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [gameAudioLevel, setGameAudioLevel] = useState<number>(0);
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(true);
  const gamingMixerRef = useRef<GamingAudioMixer | null>(null);

  // Canvas Compositor Elements & 60FPS Stream
  const gamingCompositorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const facecamVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteImageRef = useRef<HTMLImageElement | null>(null);
  const gameplayVideoRef = useRef<HTMLVideoElement | null>(null);
  const gameAudioMonitorRef = useRef<HTMLAudioElement | null>(null);
  const gamingCompositeStreamRef = useRef<MediaStream | null>(null);

  // Recording State Machine
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const recordedSecondsRef = useRef(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Post-Recording Review
  const [finishedRecording, setFinishedRecording] = useState(false);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [markers, setMarkers] = useState<TimestampMarker[]>([]);
  const markersRef = useRef<TimestampMarker[]>([]);

  // Container Ref for Fullscreen
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Hardware Capture & Device Status
  const [captureQualityBadge, setCaptureQualityBadge] = useState<string>('');
  const [captureDetails, setCaptureDetails] = useState<{ width: number; height: number; fps: number } | null>(null);
  const [captureCapabilities, setCaptureCapabilities] = useState<MediaTrackCapabilities | null>(null);
  const [isApplyingResolution, setIsApplyingResolution] = useState<boolean>(false);
  const [captureCardError, setCaptureCardError] = useState<string | null>(null);
  const [isCaptureLoading, setIsCaptureLoading] = useState<boolean>(false);
  const [targetFps, setTargetFps] = useState<30 | 60>(60); // User-selected target FPS for capture card
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);

  // Game Framing, Zoom & Overscan Compensation (Fixes game cut off / aspect ratio mismatch)
  const [gameFitMode, setGameFitMode] = useState<'fit' | 'stretch' | 'fill'>('fit');
  const [gameZoom, setGameZoom] = useState<number>(100);
  const [gameOffsetX, setGameOffsetX] = useState<number>(0);
  const [gameOffsetY, setGameOffsetY] = useState<number>(0);
  const [showFramingControls, setShowFramingControls] = useState<boolean>(false);
  const [showIPhoneGuide, setShowIPhoneGuide] = useState<boolean>(false);
  const [showElgatoTroubleshooter, setShowElgatoTroubleshooter] = useState<boolean>(false);

  // ── Draggable Camera Block ──────────────────────────────────────────────────
  type CamSizeKey = 'hidden' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  const CAM_SIZES: Record<CamSizeKey, { w: number; label: string }> = {
    hidden: { w: 0,   label: 'מוסתר'  },
    xs:     { w: 120, label: 'XS'     },
    sm:     { w: 180, label: 'S'      },
    md:     { w: 260, label: 'M'      },
    lg:     { w: 380, label: 'L'      },
    xl:     { w: 520, label: 'XL'     },
  };
  const [camSize, setCamSize] = useState<CamSizeKey>('md');
  // null = use CSS layout anchor; non-null = free drag position (% of container)
  const [camFreePos, setCamFreePos] = useState<{ x: number; y: number } | null>(null);
  const [camAnchor, setCamAnchor] = useState<string>('br');
  const camIsDragging = useRef(false);
  const camDragOffset = useRef({ x: 0, y: 0 });
  const camPreviewContainerRef = useRef<HTMLDivElement | null>(null);

  const handleCamMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    camIsDragging.current = true;
    const container = camPreviewContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const camEl = (e.currentTarget as HTMLElement);
    const camRect = camEl.getBoundingClientRect();
    camDragOffset.current = {
      x: e.clientX - camRect.left,
      y: e.clientY - camRect.top,
    };
    const onMove = (me: MouseEvent) => {
      if (!camIsDragging.current) return;
      const cr = container.getBoundingClientRect();
      const newX = ((me.clientX - cr.left - camDragOffset.current.x) / cr.width) * 100;
      const newY = ((me.clientY - cr.top - camDragOffset.current.y) / cr.height) * 100;
      setCamFreePos({ x: Math.max(0, Math.min(85, newX)), y: Math.max(0, Math.min(80, newY)) });
    };
    const onUp = () => {
      camIsDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const CAM_ANCHORS = [
    { id: 'tl', label: '↖', title: 'שמאל עליון' },
    { id: 'tc', label: '↑', title: 'אמצע עליון' },
    { id: 'tr', label: '↗', title: 'ימין עליון' },
    { id: 'ml', label: '←', title: 'שמאל אמצע' },
    { id: 'mc', label: '·', title: 'מרכז' },
    { id: 'mr', label: '→', title: 'ימין אמצע' },
    { id: 'bl', label: '↙', title: 'שמאל תחתון' },
    { id: 'bc', label: '↓', title: 'אמצע תחתון' },
    { id: 'br', label: '↘', title: 'ימין תחתון' },
  ];

  function camAnchorStyle(anchor: string): React.CSSProperties {
    const map: Record<string, React.CSSProperties> = {
      tl: { top: '8px',  left: '8px'  },
      tc: { top: '8px',  left: '50%', transform: 'translateX(-50%)' },
      tr: { top: '8px',  right: '8px' },
      ml: { top: '50%',  left: '8px',  transform: 'translateY(-50%)' },
      mc: { top: '50%',  left: '50%',  transform: 'translate(-50%,-50%)' },
      mr: { top: '50%',  right: '8px', transform: 'translateY(-50%)' },
      bl: { bottom: '8px', left: '8px' },
      bc: { bottom: '8px', left: '50%', transform: 'translateX(-50%)' },
      br: { bottom: '8px', right: '8px' },
    };
    return map[anchor] ?? map['br'];
  }

  // ── Pre-Broadcast Starting Soon Timer (ספירה לאחור לתחילת שידור) ───────────
  const [preBroadcastDelay, setPreBroadcastDelay] = useState<number>(0); // 0 = immediate, 3, 5, 10, 30, 60, 180, 300
  const [preBroadcastTotalDuration, setPreBroadcastTotalDuration] = useState<number>(0);
  const [isPreBroadcastCounting, setIsPreBroadcastCounting] = useState<boolean>(false);
  const [preBroadcastSecondsRemaining, setPreBroadcastSecondsRemaining] = useState<number>(0);
  const [enableCountdownBeeps, setEnableCountdownBeeps] = useState<boolean>(true);
  const [customCountdownInput, setCustomCountdownInput] = useState<string>('03:00');
  const [showInStreamStopwatch, setShowInStreamStopwatch] = useState<boolean>(false);
  const preBroadcastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startRecordingRef = useRef<() => void>(() => {});

  const formatCountdownDisplay = useCallback((seconds: number) => {
    if (seconds <= 0) return '0';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  const cancelPreBroadcastCountdown = useCallback(() => {
    if (preBroadcastTimerRef.current) {
      clearInterval(preBroadcastTimerRef.current);
      preBroadcastTimerRef.current = null;
    }
    setIsPreBroadcastCounting(false);
    setPreBroadcastSecondsRemaining(0);
  }, []);

  const startPreBroadcastCountdown = useCallback((durationSeconds?: number) => {
    cancelPreBroadcastCountdown();
    const totalSec = durationSeconds !== undefined ? durationSeconds : preBroadcastDelay;
    if (totalSec <= 0) {
      startRecordingRef.current();
      return;
    }

    setPreBroadcastTotalDuration(totalSec);
    setPreBroadcastSecondsRemaining(totalSec);
    setIsPreBroadcastCounting(true);

    if (enableCountdownBeeps && totalSec <= 3) {
      playCountdownBeep(false);
    }

    preBroadcastTimerRef.current = setInterval(() => {
      setPreBroadcastSecondsRemaining(prev => {
        const next = prev - 1;
        if (next <= 0) {
          if (preBroadcastTimerRef.current) clearInterval(preBroadcastTimerRef.current);
          preBroadcastTimerRef.current = null;
          setIsPreBroadcastCounting(false);
          if (enableCountdownBeeps) playCountdownBeep(true);
          setTimeout(() => {
            startRecordingRef.current();
          }, 80);
          return 0;
        }

        if (enableCountdownBeeps && next <= 3) {
          playCountdownBeep(false);
        }
        return next;
      });
    }, 1000);
  }, [cancelPreBroadcastCountdown, preBroadcastDelay, enableCountdownBeeps]);

  useEffect(() => {
    return () => {
      if (preBroadcastTimerRef.current) clearInterval(preBroadcastTimerRef.current);
    };
  }, []);

  // ── Studio Timer ────────────────────────────────────────────────────────────
  type TimerMode = 'off' | 'stopwatch' | 'countdown';
  const [timerMode, setTimerMode] = useState<TimerMode>('off');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);       // seconds elapsed (stopwatch) or remaining (countdown)
  const [timerTarget, setTimerTarget] = useState(300);       // countdown target in seconds
  const [timerCountdownInput, setTimerCountdownInput] = useState('05:00');
  const studioTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startTimer = useCallback(() => {
    if (timerRunning) return;
    setTimerRunning(true);
    studioTimerRef.current = setInterval(() => {
      setTimerElapsed(prev => {
        if (timerMode === 'countdown') {
          const next = prev + 1;
          if (next >= timerTarget) {
            clearInterval(studioTimerRef.current!);
            setTimerRunning(false);
            return timerTarget;
          }
          return next;
        }
        return prev + 1;
      });
    }, 1000);
  }, [timerRunning, timerMode, timerTarget]);

  const pauseTimer = useCallback(() => {
    if (studioTimerRef.current) clearInterval(studioTimerRef.current);
    setTimerRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    if (studioTimerRef.current) clearInterval(studioTimerRef.current);
    setTimerRunning(false);
    setTimerElapsed(0);
  }, []);

  useEffect(() => {
    return () => { if (studioTimerRef.current) clearInterval(studioTimerRef.current); };
  }, []);

  const timerDisplay = useCallback((seconds: number) => {
    const display = timerMode === 'countdown' ? Math.max(0, timerTarget - seconds) : seconds;
    const h = Math.floor(display / 3600);
    const m = Math.floor((display % 3600) / 60);
    const s = display % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }, [timerMode, timerTarget]);

  // ── Overlay System ──────────────────────────────────────────────────────────
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [isOverlayEditMode, setIsOverlayEditMode] = useState(false);

  const addOverlay = useCallback((type: OverlayType) => {
    const catalog = OVERLAY_CATALOG.find(c => c.type === type);
    if (!catalog) return;
    const newOverlay: OverlayItem = {
      id: `${type}_${Date.now()}`,
      type,
      x: 5 + Math.random() * 30,
      y: 5 + Math.random() * 30,
      visible: true,
      config: { ...catalog.defaultConfig },
    };
    setOverlays(prev => [...prev, newOverlay]);
    setIsOverlayEditMode(true);
  }, []);

  const removeOverlay = useCallback((id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
  }, []);

  const toggleOverlayVisible = useCallback((id: string) => {
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, visible: !o.visible } : o));
  }, []);

  const [editingOverlayId, setEditingOverlayId] = useState<string | null>(null);

  const updateOverlayConfig = useCallback((id: string, key: string, value: any) => {
    setOverlays(prev => prev.map(o => {
      if (o.id !== id) return o;
      return {
        ...o,
        config: {
          ...o.config,
          [key]: value
        }
      };
    }));
  }, []);

  const updateOverlayPosition = useCallback((id: string, x: number, y: number) => {
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, x, y } : o));
  }, []);

  // Console & Game Audio Management (Elgato HDMI Audio / Desktop Audio / Stems)
  const [selectedGameAudioId, setSelectedGameAudioId] = useState<string>('');
  const [gameAudioStream, setGameAudioStream] = useState<MediaStream | null>(null);
  const [monitorGameAudio, setMonitorGameAudio] = useState<boolean>(true);
  // Streamer Microphone Live Monitoring (Sidetone / Pre-recording check)
  const [isMonitoringMic, setIsMonitoringMic] = useState<boolean>(false);
  const [micMonitorVolume, setMicMonitorVolume] = useState<number>(1.0);
  const [splitChannels, setSplitChannels] = useState<boolean>(false);
  const [separateStems, setSeparateStems] = useState<boolean>(true);
  const [recordedMicBlob, setRecordedMicBlob] = useState<Blob | null>(null);
  const [recordedGameAudioBlob, setRecordedGameAudioBlob] = useState<Blob | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const gameRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedMicChunksRef = useRef<Blob[]>([]);
  const recordedGameChunksRef = useRef<Blob[]>([]);

  // Video Container Format Selection (MP4 / WebM / MKV)
  const [videoContainerFormat, setVideoContainerFormat] = useState<'mp4' | 'webm' | 'mkv'>('mp4');

  // Emergency Backup Microphone Channel (Hot-Swap / Redundant Stem)
  const [isBackupMicEnabled, setIsBackupMicEnabled] = useState<boolean>(false);
  const [selectedBackupAudioId, setSelectedBackupAudioId] = useState<string>('');
  const [backupMicStream, setBackupMicStream] = useState<MediaStream | null>(null);
  const [backupMicMode, setBackupMicMode] = useState<'standby' | 'active'>('standby');
  const [backupMicGain, setBackupMicGain] = useState<number>(1.0);
  const [isBackupAudioMuted, setIsBackupAudioMuted] = useState<boolean>(false);
  const [backupMicAudioLevel, setBackupMicAudioLevel] = useState<number>(0);
  const [backupMicNoiseSuppression, setBackupMicNoiseSuppression] = useState<boolean>(false);
  const [isHotSwapped, setIsHotSwapped] = useState<boolean>(false);
  const [recordedBackupMicBlob, setRecordedBackupMicBlob] = useState<Blob | null>(null);
  const backupRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedBackupMicChunksRef = useRef<Blob[]>([]);

  // Device Custom Nicknames (allows renaming USB Audio CODEC to "מיקרופון ראשי" or "מיקרופון דש")
  const [deviceNicknames, setDeviceNicknames] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gaming_studio_device_nicknames');
      if (saved) setDeviceNicknames(JSON.parse(saved));
    } catch {}
  }, []);

  const handleRenameDevice = (deviceId: string, currentLabel: string) => {
    if (!deviceId) return;
    const currentName = deviceNicknames[deviceId] || currentLabel;
    const newName = prompt('הזן כינוי מותאם אישית למיקרופון זה (למשל: "מיקרופון ראשי", "מיקרופון דש"):', currentName);
    if (newName !== null) {
      const trimmed = newName.trim();
      setDeviceNicknames(prev => {
        const updated = { ...prev };
        if (trimmed) {
          updated[deviceId] = trimmed;
        } else {
          delete updated[deviceId];
        }
        try {
          localStorage.setItem('gaming_studio_device_nicknames', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    }
  };

  // Broadcast Studio Vocal DSP & Noise Filtering States
  const [studioVocalEnhance, setStudioVocalEnhance] = useState<boolean>(true);
  const [micNoiseSuppression, setMicNoiseSuppression] = useState<boolean>(false);

  // 1. Device Discovery & Hotplugging Listener (iPhone USB / Continuity / Elgato)
  const refreshDevices = useCallback(async () => {
    try {
      const { audioInputs, videoInputs } = await getMediaDevices();
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // Auto-select microphone: Must be a true voice mic, NEVER a capture card / console audio device!
      const voiceMics = audioInputs.filter(a => !a.isGameAudio);
      const activeMicId = selectedAudioId || (voiceMics.length > 0 ? voiceMics[0].deviceId : (audioInputs.length > 0 ? audioInputs[0].deviceId : ''));
      if (audioInputs.length > 0 && !selectedAudioId && activeMicId) {
        setSelectedAudioId(activeMicId);
      }

      // Auto-detect Elgato / Console audio input device (PlayStation / Xbox via HDMI)
      const elgatoAudioDev = audioInputs.find(a => a.isGameAudio && a.deviceId !== activeMicId);
      if (elgatoAudioDev && (!selectedGameAudioId || !audioInputs.some(a => a.deviceId === selectedGameAudioId))) {
        setSelectedGameAudioId(elgatoAudioDev.deviceId);
        console.log(`[Audio Init] 🎮 זוהה שמע קונסולה אוטומטית: "${elgatoAudioDev.label}"`);
      }

      // Detect physical webcams / built-in FaceTime HD camera vs iPhone Continuity
      const normalCams = videoInputs.filter(v => !v.isCaptureCard);
      const builtInCam = normalCams.find(v => !v.isIPhone && !v.isContinuity);
      const iphoneCam = normalCams.find(v => v.isIPhone || v.isContinuity);

      // If Elgato 4K is present, auto-enable 4K Ultra HD resolution immediately!
      const elgatoCard = videoInputs.find(v => v.isCaptureCard);
      if (elgatoCard && (
        elgatoCard.label.toLowerCase().includes('4k') || 
        elgatoCard.label.toLowerCase().includes('cam link') || 
        elgatoCard.label.toLowerCase().includes('camlink')
      )) {
        setVideoResolution('4k');
      }

      // Check saved preference first
      let savedCamId = '';
      try {
        savedCamId = localStorage.getItem('gaming_studio_preferred_camera') || '';
      } catch {}

      if (!selectedVideoId) {
        if (savedCamId && normalCams.some(c => c.deviceId === savedCamId)) {
          setSelectedVideoId(savedCamId);
        } else if (builtInCam) {
          // ALWAYS prioritize the physical built-in MacBook camera so it works immediately!
          setSelectedVideoId(builtInCam.deviceId);
        } else if (iphoneCam) {
          setSelectedVideoId(iphoneCam.deviceId);
        } else if (normalCams.length > 0) {
          setSelectedVideoId(normalCams[0].deviceId);
        }
      }

      return { audioInputs, videoInputs };
    } catch (err) {
      console.error('Error discovering devices:', err);
      return { audioInputs: [], videoInputs: [] };
    }
  }, [selectedAudioId, selectedVideoId, selectedGameAudioId]);

  useEffect(() => {
    refreshDevices();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  // Dedicated Console / Game Audio Stream Acquisition (Captures HDMI game sound from Elgato)
  useEffect(() => {
    let active = true;
    let streamInstance: MediaStream | null = null;

    async function initGameAudio() {
      // Auto-detect matching capture card audio device if not explicitly picked or if stale
      let targetId = selectedGameAudioId;
      if (!targetId || !audioDevices.some(a => a.deviceId === targetId)) {
        const matching = audioDevices.find(a => a.isGameAudio && a.deviceId !== selectedAudioId);
        if (matching) {
          targetId = matching.deviceId;
          setSelectedGameAudioId(targetId);
        }
      }

      // 1. If explicit or detected game audio device selected (Elgato HDMI / USB Audio / Line-In)
      if (targetId) {
        try {
          // Attempt 1: Exact deviceId with high-fidelity 48kHz stereo
          streamInstance = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: { exact: targetId },
              sampleRate: { ideal: 48000 },
              channelCount: { ideal: 2 },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            },
            video: false
          });
        } catch (e1) {
          try {
            // Attempt 2: Ideal deviceId with standard constraints
            streamInstance = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: { ideal: targetId },
                sampleRate: { ideal: 48000 },
                channelCount: { ideal: 2 },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
              },
              video: false
            });
          } catch (e2) {
            try {
              // Attempt 3: Basic audio with ideal deviceId
              streamInstance = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { ideal: targetId } },
                video: false
              });
            } catch (e3) {
              console.warn('[Game Audio] Could not open dedicated game audio:', e3);
            }
          }
        }

        if (streamInstance) {
          if (!active) {
            streamInstance.getTracks().forEach(t => t.stop());
            return;
          }
          setGameAudioStream(streamInstance);
          gamingMixerRef.current?.resume();
          return;
        }
      }

      // 2. Fallback to capture card stream if it contains audio tracks
      if (captureCardStream && captureCardStream.getAudioTracks().length > 0) {
        setGameAudioStream(captureCardStream);
        gamingMixerRef.current?.resume();
        return;
      }

      // 3. Fallback to screen capture stream if screen capture is active
      if (screenStream && screenStream.getAudioTracks().length > 0) {
        setGameAudioStream(screenStream);
        gamingMixerRef.current?.resume();
        return;
      }

      setGameAudioStream(null);
    }

    initGameAudio();

    return () => {
      active = false;
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedGameAudioId, selectedCaptureCardId, captureCardStream, screenStream, audioDevices, videoDevices, selectedAudioId]);

  // 2. Start WebRTC Receiver & Frame Relay for Remote iPhone Camera
  useEffect(() => {
    const roomId = `castflow-${episode.id}`;
    let framePollInterval: NodeJS.Timeout | null = null;

    const receiver = new StudioWebRTCReceiver(
      roomId,
      (stream) => {
        setRemoteStream(stream);
        setIsUsingRemoteCam(true);
        setRemoteConnectionStatus('connected');
      },
      (status) => {
        setRemoteConnectionStatus(status);
        if (status === 'connected') {
          setIsUsingRemoteCam(true);
        }
      }
    );
    webrtcReceiverRef.current = receiver;
    receiver.start();

    // Fallback Frame Poller (100% reliable image stream relay)
    framePollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pull-frame', roomId })
        });
        const data = await res.json();
        if (data.isFresh && data.frame) {
          setRemoteFrame(data.frame);
          setRemoteConnectionStatus('connected');
          setIsUsingRemoteCam(true);
          if (remoteImageRef.current) {
            remoteImageRef.current.src = data.frame;
          }
        }
      } catch (e) {}
    }, 120);

    return () => {
      if (webrtcReceiverRef.current) {
        webrtcReceiverRef.current.stop();
      }
      if (framePollInterval) {
        clearInterval(framePollInterval);
      }
    };
  }, [episode.id]);

  // 3a. Dedicated Streamer Microphone Stream Acquisition (Channel 1)
  useEffect(() => {
    let active = true;
    let streamInstance: MediaStream | null = null;

    async function initMicAudio() {
      try {
        let stream: MediaStream;
        const micConstraints: MediaTrackConstraints = {
          sampleRate: { ideal: 48000, min: 44100 },
          channelCount: { ideal: 2, min: 1 },
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: micNoiseSuppression ? true : false,
        };

        if (selectedAudioId) {
          micConstraints.deviceId = { ideal: selectedAudioId };
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: micConstraints,
            video: false,
          });
        } catch (specificErr) {
          console.warn('[Mic] Ideal studio constraints failed, trying basic audio:', specificErr);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: selectedAudioId ? { deviceId: { ideal: selectedAudioId } } : true,
            video: false
          });
        }

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (micStream) {
          micStream.getTracks().forEach(t => t.stop());
        }

        streamInstance = stream;
        setMicStream(stream);

        if (gamingMixerRef.current) {
          gamingMixerRef.current.resume();
        }
      } catch (err) {
        console.error('[Mic] Failed to acquire microphone stream:', err);
        setMicStream(null);
      }
    }

    initMicAudio();

    return () => {
      active = false;
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedAudioId, micNoiseSuppression]);

  // 3a-2. Dedicated Emergency Backup Microphone Stream Acquisition (Channel 3)
  useEffect(() => {
    let active = true;
    let streamInstance: MediaStream | null = null;

    async function initBackupMicAudio() {
      if (!isBackupMicEnabled) {
        if (backupMicStream) {
          backupMicStream.getTracks().forEach(t => t.stop());
          setBackupMicStream(null);
        }
        return;
      }

      try {
        let stream: MediaStream;
        const micConstraints: MediaTrackConstraints = {
          sampleRate: { ideal: 48000, min: 44100 },
          channelCount: { ideal: 2, min: 1 },
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: backupMicNoiseSuppression ? true : false,
        };

        // Determine backup mic device ID: use explicit selection, or find first device different from primary mic
        const targetBackupId = selectedBackupAudioId || audioDevices.find(a => a.deviceId !== selectedAudioId)?.deviceId;
        if (targetBackupId) {
          micConstraints.deviceId = { ideal: targetBackupId };
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: micConstraints,
            video: false,
          });
        } catch (specificErr) {
          console.warn('[BackupMic] Ideal constraints failed, trying basic audio:', specificErr);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: targetBackupId ? { deviceId: { ideal: targetBackupId } } : true,
            video: false
          });
        }

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (backupMicStream) {
          backupMicStream.getTracks().forEach(t => t.stop());
        }

        streamInstance = stream;
        setBackupMicStream(stream);

        if (gamingMixerRef.current) {
          gamingMixerRef.current.resume();
        }
      } catch (err) {
        console.error('[BackupMic] Failed to acquire backup microphone stream:', err);
        setBackupMicStream(null);
      }
    }

    initBackupMicAudio();

    return () => {
      active = false;
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
      }
    };
  }, [isBackupMicEnabled, selectedBackupAudioId, backupMicNoiseSuppression, selectedAudioId, audioDevices]);

  // 3b. Initialize or Update Primary Facecam Video Stream (Video Only) with Progressive Fallback
  useEffect(() => {
    let active = true;

    async function initFacecam() {
      if (isUsingRemoteCam && remoteStream) {
        setFacecamError(null);
        return;
      }

      if (!selectedVideoId) {
        if (facecamStreamRef.current) {
          facecamStreamRef.current.getTracks().forEach(t => t.stop());
          facecamStreamRef.current = null;
        }
        setFacecamStream(null);
        setFacecamDetails(null);
        setFacecamError(null);
        return;
      }

      setIsFacecamInitializing(true);
      setFacecamError(null);

      // Cleanly stop any existing facecam tracks before acquiring a new stream
      if (facecamStreamRef.current) {
        facecamStreamRef.current.getTracks().forEach(t => t.stop());
        facecamStreamRef.current = null;
      }

      const targetDev = videoDevices.find(v => v.deviceId === selectedVideoId);
      const isTargetIPhone = Boolean(
        targetDev?.isIPhone || 
        targetDev?.isContinuity || 
        (targetDev?.label && targetDev.label.toLowerCase().includes('iphone'))
      );

      let stream: MediaStream | null = null;
      let errorReason: string | null = null;

      // Stage 1: Try requested resolution & device (1080p / 720p with ideal deviceId)
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: getVideoConstraints(videoResolution === '4k' ? '1080p' : videoResolution, selectedVideoId)
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1: any) {
        console.warn('[Facecam] Stage 1 (Strict/HD) failed, trying Stage 2 (720p @ 30fps):', err1?.message || err1);
        errorReason = err1?.name === 'NotReadableError' 
          ? 'המצלמה תפוסה או מתחברת' 
          : err1?.message || 'שגיאה באיתחול';

        // For iPhone Continuity: give AVFoundation 1000ms to wake up the bridge before next attempt
        if (isTargetIPhone) {
          await new Promise(r => setTimeout(r, 1000));
        }

        // Stage 2: Try 720p fallback with ideal deviceId
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              deviceId: { ideal: selectedVideoId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            }
          });
        } catch (err2: any) {
          console.warn('[Facecam] Stage 2 (720p) failed, trying Stage 3 (Driver Native):', err2?.message || err2);
          
          if (isTargetIPhone) {
            await new Promise(r => setTimeout(r, 1000));
          }

          // Stage 3: Try driver default constraints with deviceId
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: { deviceId: { ideal: selectedVideoId } }
            });
          } catch (err3: any) {
            console.warn('[Facecam] Stage 3 (Device Native) failed:', err3?.message || err3);
            
            // If the user explicitly chose an iPhone, DO NOT hijack and switch to Mac camera!
            if (isTargetIPhone) {
              console.warn('[Facecam] iPhone Continuity camera did not respond yet. Keeping iPhone selected for user retry.');
              errorReason = 'לא התקבל אות וידאו מ-iPhone. ודא שהאייפון לא נעול, מחובר בכבל USB או נמצא בקרבת מקום, ולחץ "שחרר נעילה / אתחל".';
            } else {
              // Stage 4: For generic webcam failures, try alternative physical camera fallback
              try {
                const normalCams = videoDevices.filter(v => !v.isCaptureCard);
                const altCam = normalCams.find(v => v.deviceId !== selectedVideoId && !v.isIPhone);
                if (altCam) {
                  stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { deviceId: { ideal: altCam.deviceId } }
                  });
                  if (stream) {
                    setSelectedVideoId(altCam.deviceId);
                    try { localStorage.setItem('gaming_studio_preferred_camera', altCam.deviceId); } catch {}
                    console.log(`[Facecam] 🔄 Switched automatically to working camera: ${altCam.label}`);
                  }
                } else {
                  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
                }
              } catch (err4: any) {
                console.error('[Facecam] ❌ All fallback acquisition attempts failed:', err4);
                errorReason = err4?.name === 'NotReadableError'
                  ? 'המצלמה תפוסה על ידי תוכנה אחרת (כמו FaceTime או Zoom) או דורשת אישור'
                  : 'לא ניתן לפתוח את המצלמה שנבחרה';
              }
            }
          }
        }
      }

      if (!active) {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
        return;
      }

      setIsFacecamInitializing(false);

      if (stream) {
        facecamStreamRef.current = stream;
        setFacecamStream(stream);
        setFacecamError(null);

        const vt = stream.getVideoTracks()[0];
        if (vt) {
          const s = vt.getSettings();
          const dev = videoDevices.find(v => v.deviceId === selectedVideoId);
          setFacecamDetails({
            width: s.width || 1280,
            height: s.height || 720,
            fps: Math.round(s.frameRate || 30),
            label: dev?.label || vt.label || 'מצלמת פנים'
          });

          vt.onended = () => {
            console.warn('[Facecam] Video track ended unexpectedly');
            setFacecamStream(null);
            setFacecamDetails(null);
          };
        }
      } else {
        setFacecamStream(null);
        setFacecamDetails(null);
        setFacecamError(errorReason || 'המצלמה לא מגיבה');
      }
    }

    initFacecam();

    return () => {
      active = false;
      if (facecamStreamRef.current) {
        facecamStreamRef.current.getTracks().forEach(t => t.stop());
        facecamStreamRef.current = null;
      }
    };
  }, [selectedVideoId, isUsingRemoteCam, videoResolution, videoDevices]);

  // Connect facecamStream to hidden video element
  useEffect(() => {
    const activeStream = isUsingRemoteCam && remoteStream ? remoteStream : facecamStream;
    if (facecamVideoRef.current) {
      if (activeStream) {
        facecamVideoRef.current.srcObject = activeStream;
        facecamVideoRef.current.onloadedmetadata = () => {
          facecamVideoRef.current?.play().catch(() => {});
        };
        facecamVideoRef.current.play().catch(() => {});
      } else {
        facecamVideoRef.current.srcObject = null;
      }
    }
  }, [facecamStream, remoteStream, isUsingRemoteCam]);

  // Dedicated Facecam Lock Release & Hardware Session Re-sync
  const handleReleaseFacecamLock = async () => {
    setIsFacecamInitializing(true);
    setFacecamError(null);

    // 1. Force stop active facecam tracks
    if (facecamStreamRef.current) {
      facecamStreamRef.current.getTracks().forEach(t => t.stop());
      facecamStreamRef.current = null;
    }
    if (facecamStream) {
      facecamStream.getTracks().forEach(t => t.stop());
    }
    setFacecamStream(null);
    setFacecamDetails(null);

    // 2. Kill locks via Electron IPC if running in desktop app
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.releaseCameraLock) {
      try {
        await electronAPI.releaseCameraLock();
      } catch (e) {}
    }

    // 3. Pause 800ms for macOS AVFoundation to deallocate device session cleanly
    await new Promise(r => setTimeout(r, 800));

    // 4. Refresh device enumeration
    const { videoInputs } = await refreshDevices();

    // 5. Re-open target camera
    const targetId = selectedVideoId || (videoInputs.length > 0 ? videoInputs[0].deviceId : '');
    if (targetId) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { ideal: targetId },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, max: 60 }
          }
        });

        facecamStreamRef.current = stream;
        setFacecamStream(stream);
        setFacecamError(null);

        const vt = stream.getVideoTracks()[0];
        if (vt) {
          const s = vt.getSettings();
          const dev = videoInputs.find(v => v.deviceId === targetId);
          setFacecamDetails({
            width: s.width || 1280,
            height: s.height || 720,
            fps: Math.round(s.frameRate || 30),
            label: dev?.label || vt.label || 'מצלמת פנים'
          });
        }
      } catch (err: any) {
        console.warn('Facecam re-open failed with standard constraints, trying generic:', err);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { deviceId: { ideal: targetId } }
          });
          facecamStreamRef.current = fallbackStream;
          setFacecamStream(fallbackStream);
          setFacecamError(null);
        } catch (err2: any) {
          console.error('Facecam re-open failed completely:', err2);
          setFacecamError(
            err2?.name === 'NotReadableError'
              ? 'המצלמה תפוסה על ידי תוכנה אחרת (FaceTime/Zoom) — סגור אותה ונסה שוב'
              : 'לא ניתן לפתוח את המצלמה. בדוק הרשאות מצלמה'
          );
        }
      }
    }
    setIsFacecamInitializing(false);
  };

  // Connect gameplay stream (screen capture or capture card) to hidden video element
  useEffect(() => {
    const activeStream = screenStream || captureCardStream;
    if (gameplayVideoRef.current && activeStream) {
      gameplayVideoRef.current.srcObject = activeStream;
      gameplayVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, captureCardStream]);

  // 4. Screen Capture Controller (60FPS with System Audio)
  const handleStartScreenCapture = async () => {
    // Teardown capture card stream if active
    if (captureCardStream) {
      captureCardStream.getTracks().forEach(t => t.stop());
      setCaptureCardStream(null);
      setSelectedCaptureCardId('');
      setCaptureQualityBadge('');
    }

    try {
      const stream = await getScreenCaptureStream({ frameRate: 60, audio: true, resolution: videoResolution });
      setScreenStream(stream);
      setIsScreenCapturing(true);
      setGameplaySourceType('screen');

      stream.getVideoTracks()[0].onended = () => {
        handleStopScreenCapture();
      };
    } catch (err) {
      console.warn('Screen capture cancelled or failed:', err);
    }
  };

  const handleStopScreenCapture = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    }
    if (gameplayVideoRef.current && gameplaySourceType === 'screen') {
      gameplayVideoRef.current.srcObject = null;
    }
    setIsScreenCapturing(false);
  };

  // 5. Hardware Video Source / Capture Card (Elgato / Cam Link) Controller
  const handleSelectCaptureCard = async (deviceId: string, targetRes?: VideoResolution, _autoRecoveryAttempted = false) => {
    setSelectedCaptureCardId(deviceId);
    setCaptureCardError(null);

    if (!deviceId) {
      if (captureCardStream) {
        captureCardStream.getTracks().forEach(t => t.stop());
        setCaptureCardStream(null);
      }
      if (gameplayVideoRef.current && gameplaySourceType === 'capture_card') {
        gameplayVideoRef.current.srcObject = null;
      }
      setGameplaySourceType(null);
      setCaptureQualityBadge('');
      setCaptureDetails(null);
      setCaptureCapabilities(null);
      console.log('[Video Source] ⏹️ מקור הווידאו נותק.');
      return;
    }

    // Stop active screen capture if switching to capture card
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      setIsScreenCapturing(false);
    }

    setIsCaptureLoading(true);

    const cardDev = videoDevices.find(v => v.deviceId === deviceId);
    const cardLabel = cardDev?.label || `התקן וידאו (${deviceId.slice(0, 8)})`;
    console.log(`%c[Video Source] 📹 התקן שנבחר: "${cardLabel}" (deviceId: ${deviceId})`, 'color: #38bdf8; font-weight: bold;');

    const desiredRes = targetRes || '4k';
    if (desiredRes !== videoResolution) {
      setVideoResolution(desiredRes);
    }

    // Find dedicated audio input for the capture card (strictly Elgato hardware, NEVER USB Audio CODEC!)
    const cardLabelLower = cardLabel.toLowerCase();
    const matchingAudio = audioDevices.find(a => {
      const aLabel = (a.label || '').toLowerCase();
      if (aLabel.includes('codec')) return false; // Strictly NEVER USB Audio CODEC!
      return (
        (cardLabelLower.includes('elgato') && aLabel.includes('elgato')) ||
        (cardLabelLower.includes('cam link') && aLabel.includes('cam link')) ||
        (cardLabelLower.includes('hd60') && aLabel.includes('hd60')) ||
        (cardLabelLower.includes('4k s') && aLabel.includes('4k s')) ||
        (cardLabelLower.includes('4k x') && aLabel.includes('4k x'))
      );
    });

    if (matchingAudio) {
      setSelectedGameAudioId(matchingAudio.deviceId);
      console.log(`[Video Source] 🎮 זוהה ערוץ שמע אלגטו תואם: "${matchingAudio.label}"`);
    }
    gamingMixerRef.current?.resume();

    // Acquire video-only stream from capture card (avoids locking CoreAudio / AVFoundation)
    const requestUserMedia = async (videoConstraints: MediaTrackConstraints): Promise<MediaStream> => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch (e) {
        // Fallback with ideal deviceId
        const relaxedVideo = { ...videoConstraints };
        if (relaxedVideo.deviceId && typeof relaxedVideo.deviceId === 'object' && 'exact' in relaxedVideo.deviceId) {
          relaxedVideo.deviceId = { ideal: (relaxedVideo.deviceId as any).exact };
        }
        return await navigator.mediaDevices.getUserMedia({
          video: relaxedVideo,
          audio: false
        });
      }
    };

    let stream: MediaStream | null = null;
    let actualWidth = 0;
    let actualHeight = 0;
    let actualFps = 0;

    try {
      const fps = targetFps; // user-selected: 30 or 60
      // When VDCAssistant was just reset (_autoRecoveryAttempted=true), use ONLY `ideal` constraints.
      const resolutionTiers: { label: string; constraints: MediaTrackConstraints }[] = _autoRecoveryAttempted
        ? [
            // Recovery tiers — ideal only, no exact, no min filter (let driver decide)
            { label: '4K Recovery (ideal only)', constraints: { deviceId: { ideal: deviceId }, width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: fps, max: 60 } } },
            { label: '1080p Recovery (ideal only)', constraints: { deviceId: { ideal: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: fps } } },
            { label: 'HD Recovery (min 720)', constraints: { deviceId: { ideal: deviceId }, width: { min: 1280 }, height: { min: 720 }, frameRate: { ideal: fps } } },
          ]
        : [
            // Normal tiers — start with exact for best negotiation, fall back to ideal
            { label: `4K Ultra HD (Exact, ${fps}FPS)`, constraints: { deviceId: { exact: deviceId }, width: { exact: 3840 }, height: { exact: 2160 }, frameRate: { ideal: fps, max: 60 } } },
            { label: `4K Ultra HD (Ideal, ${fps}FPS)`, constraints: { deviceId: { exact: deviceId }, width: { ideal: 3840 }, height: { ideal: 2160 }, frameRate: { ideal: fps, max: 60 } } },
            { label: `Quad HD 1440p (Ideal, ${fps}FPS)`, constraints: { deviceId: { exact: deviceId }, width: { ideal: 2560, min: 1920 }, height: { ideal: 1440, min: 1080 }, frameRate: { ideal: fps } } },
            { label: `Full HD 1080p (Exact, ${fps}FPS)`, constraints: { deviceId: { exact: deviceId }, width: { exact: 1920 }, height: { exact: 1080 }, frameRate: { ideal: fps } } },
            { label: `Full HD 1080p (Ideal, ${fps}FPS)`, constraints: { deviceId: { exact: deviceId }, width: { ideal: 1920, min: 1280 }, height: { ideal: 1080, min: 720 }, frameRate: { ideal: fps } } },
          ];

      for (const tier of resolutionTiers) {
        if (desiredRes !== '4k' && tier.label.includes('4K')) continue;

        try {
          console.log(`%c[Video Source] 🚀 ניסיון: ${tier.label} עבור "${cardLabel}"...`, 'color: #a855f7; font-weight: bold;');
          const testStream = await requestUserMedia(tier.constraints);
          const vt = testStream.getVideoTracks()[0];
          if (vt) {
            const s = vt.getSettings();
            const w = s.width || 0;
            const h = s.height || 0;
            const fps = Math.round(s.frameRate || 0);

            console.log(`%c[Video Source] 📊 תוצאת ניסיון ${tier.label}: רזולוציה שהתקבלה בפועל: ${w}×${h} @ ${fps}FPS`, w >= 1920 ? 'color: #10b981; font-weight: bold;' : 'color: #f59e0b; font-weight: bold;');

            if (w >= 1280 || !stream) {
              if (stream) stream.getTracks().forEach(t => t.stop());
              stream = testStream;
              actualWidth = w;
              actualHeight = h;
              actualFps = fps;

              // If we reached target resolution (Full HD or 4K), break!
              if (w >= 1920) break;
            } else {
              testStream.getTracks().forEach(t => t.stop());
            }
          }
        } catch (errTier) {
          // Continue to next tier
        }
      }

      if (!stream) {
        setCaptureCardError(`לא ניתן לפתוח את מקור הווידאו "${cardLabel}". וודא שאין תוכנה אחרת (כמו OBS) שנועלת אותו.`);
        setIsCaptureLoading(false);
        return;
      }

      // Stop previous capture card stream if any
      if (captureCardStream) {
        captureCardStream.getTracks().forEach(t => t.stop());
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const finalSettings = videoTrack.getSettings();
        const w = finalSettings.width || actualWidth;
        const h = finalSettings.height || actualHeight;
        const fps = Math.round(finalSettings.frameRate || actualFps);

        let caps: MediaTrackCapabilities | null = null;
        try {
          caps = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
          setCaptureCapabilities(caps);
        } catch (e) {}

        console.log(`%c[Video Source] 🎯 סיכום חיבור: "${cardLabel}" | ${w}×${h} @ ${fps}FPS`, 'color: #06b6d4; font-weight: bold;');

        setCaptureQualityBadge(`${w}×${h} @ ${fps}FPS`);
        setCaptureDetails({ width: w, height: h, fps });

        if (w >= 3840) {
          setVideoResolution('4k');
        } else if (w >= 1920) {
          setVideoResolution('1080p');
        }

        // ── AUTO-RECOVERY: if we got SD (640×480), automatically reset VDCAssistant ──
        // This handles the "was working yesterday, broke today" scenario where
        // VDCAssistant entered a stale locked state after another app briefly
        // touched the camera (FaceTime, Zoom, QuickTime, etc.)
        if (w <= 640 && !_autoRecoveryAttempted) {
          console.warn('%c[Video Source] ⚠️ זוהתה נעילת SD אוטומטית — מפעיל ריסט VDCAssistant...', 'color: #f59e0b; font-weight: bold;');
          stream.getTracks().forEach(t => t.stop());
          setCaptureQualityBadge('מאפס VDCAssistant...');
          setIsCaptureLoading(false);

          // Kill VDCAssistant via Electron IPC (if available)
          const electronAPI = (window as any).electronAPI;
          if (electronAPI?.releaseCameraLock) {
            try { await electronAPI.releaseCameraLock(); } catch (e) {}
          } else {
            // Web fallback: just wait 1.5s for any stale Chrome camera lock to clear
            await new Promise(r => setTimeout(r, 1500));
          }

          // Re-open with ideal-only constraints (no exact) and mark as recovery attempt
          console.log('%c[Video Source] 🔄 מנסה מחדש לאחר ריסט...', 'color: #10b981; font-weight: bold;');
          await handleSelectCaptureCard(deviceId, desiredRes, true /* _autoRecoveryAttempted */);
          return;
        }
        // ── END AUTO-RECOVERY ──

        videoTrack.onended = () => {
          console.log(`[Video Source] 🔌 נותק שידור הווידאו של "${cardLabel}"`);
          handleSelectCaptureCard('');
          setCaptureDetails(null);
          setCaptureCapabilities(null);
        };
      }

      setCaptureCardStream(stream);
      setGameplaySourceType('capture_card');

      if (gameplayVideoRef.current) {
        gameplayVideoRef.current.srcObject = stream;
        gameplayVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error(`[Video Source] ❌ שגיאה בחיבור להתקן "${cardLabel}":`, err);
      setCaptureCardError(`שגיאה בחיבור לכרטיס לכידה: ${err?.message || 'שגיאת חומרה'}`);
    } finally {
      setIsCaptureLoading(false);
    }
  };

  // 1-Click Forced Resolution Override for Elgato / HDMI capture card
  const handleForceCaptureResolution = async (targetRes: VideoResolution) => {
    if (!selectedCaptureCardId) return;
    setIsApplyingResolution(true);
    setVideoResolution(targetRes);

    try {
      if (captureCardStream) {
        const vt = captureCardStream.getVideoTracks()[0];
        if (vt && vt.readyState === 'live') {
          const result = await applyCaptureCardResolution(vt, targetRes);
          let currentCaps = captureCapabilities;
          try {
            currentCaps = vt.getCapabilities ? vt.getCapabilities() : captureCapabilities;
            setCaptureCapabilities(currentCaps);
          } catch (e) {}

          const cardDev = videoDevices.find(v => v.deviceId === selectedCaptureCardId);
          console.log(`[Video Source] ⚡ כפיית רזולוציה ${targetRes} על "${cardDev?.label || selectedCaptureCardId}": התקבל ${result.width}×${result.height} @ ${result.fps}FPS`);

          setCaptureQualityBadge(`${result.width}×${result.height} @ ${result.fps}FPS`);
          setCaptureDetails({ width: result.width, height: result.height, fps: result.fps });

          if (result.applied && result.width > 640) {
            setIsApplyingResolution(false);
            return;
          }
        }
      }
      // If live applyConstraints didn't upgrade the stream, perform full renegotiation with desired target
      await handleSelectCaptureCard(selectedCaptureCardId, targetRes);
    } catch (err: any) {
      console.error('[Video Source] Error forcing capture resolution:', err);
    } finally {
      setIsApplyingResolution(false);
    }
  };

  // Switch resolution and immediately update active capture card if connected
  const handleResolutionChange = async (res: VideoResolution) => {
    setVideoResolution(res);
    if (selectedCaptureCardId && gameplaySourceType === 'capture_card') {
      await handleForceCaptureResolution(res);
    }
  };

  /**
   * Nuclear AVFoundation Lock Release:
   * 1. Stops all active tracks → releases Chrome's hold on the UVC device
   * 2. If running in Electron, calls IPC to kill FaceTime / Photo Booth (the
   *    apps that hold the AVFoundation session and force 640×480 on others)
   * 3. Waits 1 second for macOS to fully deallocate the capture session
   * 4. Re-opens the camera with only `ideal` constraints (no `exact`) so Chrome
   *    can negotiate with the hardware driver at its native max resolution
   */
  const handleReleaseCameraLock = async () => {
    if (!selectedCaptureCardId) return;
    setIsApplyingResolution(true);
    setCaptureQualityBadge('משחרר נעילה...');

    // Step 1 — stop all active tracks to release Chrome's device hold
    if (captureCardStream) {
      captureCardStream.getTracks().forEach(t => t.stop());
      setCaptureCardStream(null);
    }

    // Step 2 — if in Electron, ask main process to kill FaceTime / Photo Booth
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.releaseCameraLock) {
      try {
        const result = await electronAPI.releaseCameraLock();
        console.log('%c[Video Source] 🔓 שחרור AVFoundation:', 'color: #10b981; font-weight: bold;', result.msg);
      } catch (e) {
        console.warn('[Video Source] Electron IPC not available, continuing anyway');
      }
    }

    // Step 3 — wait 1.2 seconds for macOS to fully deallocate the session
    await new Promise(r => setTimeout(r, 1200));

    // Step 4 — re-open with ONLY `ideal` constraints (no `exact` — avoids silent SD fallback)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { ideal: selectedCaptureCardId },
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 },
          frameRate: { ideal: 60, min: 24 }
        },
        audio: false
      });

      const vt = stream.getVideoTracks()[0];
      if (vt) {
        const s = vt.getSettings();
        const w = s.width || 0;
        const h = s.height || 0;
        const fps = Math.round(s.frameRate || 0);
        console.log(`%c[Video Source] 🎯 לאחר שחרור נעילה: ${w}×${h} @ ${fps}FPS`, w >= 1920 ? 'color: #10b981; font-weight: bold;' : 'color: #f59e0b; font-weight: bold;');
        setCaptureQualityBadge(`${w}×${h} @ ${fps}FPS`);
        setCaptureDetails({ width: w, height: h, fps });
        if (w >= 3840) setVideoResolution('4k');
        else if (w >= 1920) setVideoResolution('1080p');

        vt.onended = () => handleSelectCaptureCard('');
      }

      setCaptureCardStream(stream);
      setGameplaySourceType('capture_card');

      if (gameplayVideoRef.current) {
        gameplayVideoRef.current.srcObject = stream;
        gameplayVideoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.error('[Video Source] ❌ שחרור נעילה נכשל:', err);
      setCaptureQualityBadge('שגיאה — נסה שוב');
      // Fall back to normal re-open
      await handleSelectCaptureCard(selectedCaptureCardId, videoResolution);
    } finally {
      setIsApplyingResolution(false);
    }
  };


  // 5. Dual/Triple Audio Mixer Engine (Mic + Gameplay Sound + Emergency Backup Mic)
  useEffect(() => {
    if (!gamingMixerRef.current) {
      gamingMixerRef.current = new GamingAudioMixer((micLvl, gameLvl, backupLvl) => {
        setMicAudioLevel(micLvl);
        setGameAudioLevel(gameLvl);
        setBackupMicAudioLevel(backupLvl || 0);
      });
    }

    const activeMicStream = micStream || (isUsingRemoteCam && remoteStream ? remoteStream : null);
    const activeGameStream = gameAudioStream || (captureCardStream?.getAudioTracks().length ? captureCardStream : null) || (screenStream?.getAudioTracks().length ? screenStream : null);

    gamingMixerRef.current.setup(activeMicStream, activeGameStream, {
      splitChannels,
      monitorGame: monitorGameAudio,
      monitorMic: isMonitoringMic,
      micMonitorVolume,
      studioVocalDsp: studioVocalEnhance,
      backupMicStream: isBackupMicEnabled ? backupMicStream : null,
      backupMicInMix: isBackupMicEnabled && (backupMicMode === 'active' || isHotSwapped) && !isBackupAudioMuted,
      backupMicVolume: isBackupAudioMuted ? 0 : backupMicGain
    });
    gamingMixerRef.current.setMicVolume(isAudioMuted ? 0 : micGain);
    gamingMixerRef.current.setGameVolume(gameAudioVolume);
    gamingMixerRef.current.setBackupMicVolume(isBackupAudioMuted ? 0 : backupMicGain);

    return () => {
      // Don't stop immediately on every re-render, keep instance alive
    };
  }, [
    micStream,
    remoteStream,
    isUsingRemoteCam,
    gameAudioStream,
    screenStream,
    captureCardStream,
    splitChannels,
    isBackupMicEnabled,
    backupMicStream,
    backupMicMode,
    isHotSwapped,
    isBackupAudioMuted
  ]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setMicVolume(isAudioMuted ? 0 : micGain);
    }
  }, [micGain, isAudioMuted]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setGameVolume(gameAudioVolume);
    }
  }, [gameAudioVolume]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setBackupMicVolume(isBackupAudioMuted ? 0 : backupMicGain);
    }
  }, [backupMicGain, isBackupAudioMuted]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setBackupMicInMix(isBackupMicEnabled && (backupMicMode === 'active' || isHotSwapped) && !isBackupAudioMuted);
    }
  }, [isBackupMicEnabled, backupMicMode, isHotSwapped, isBackupAudioMuted]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setMonitoringGameAudio(monitorGameAudio);
    }
  }, [monitorGameAudio]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setMonitoringMic(isMonitoringMic);
      gamingMixerRef.current.setMicMonitorVolume(micMonitorVolume);
      if (isMonitoringMic) gamingMixerRef.current.resume();
    }
  }, [isMonitoringMic, micMonitorVolume]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setStudioVocalEnhance(studioVocalEnhance);
    }
  }, [studioVocalEnhance]);

  // Instant Hot-Swap to Emergency Backup Mic (if primary mic disconnects/crackles)
  const handleEmergencyHotSwap = () => {
    setIsAudioMuted(true); // mute primary mic
    setIsBackupMicEnabled(true);
    setBackupMicMode('active');
    setIsBackupAudioMuted(false);
    setBackupMicGain(1.0);
    setIsHotSwapped(true);
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setMicVolume(0);
      gamingMixerRef.current.setBackupMicInMix(true);
      gamingMixerRef.current.setBackupMicVolume(1.0);
      gamingMixerRef.current.resume();
    }
  };

  const handleRestorePrimaryMic = () => {
    setIsAudioMuted(false);
    setBackupMicMode('standby');
    setIsHotSwapped(false);
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setMicVolume(micGain);
      gamingMixerRef.current.setBackupMicInMix(false);
      gamingMixerRef.current.resume();
    }
  };

  // Comprehensive Audio Subsystem Reset
  const handleMasterAudioReset = async () => {
    try {
      console.log('[Audio System] 🔄 מבצע איפוס סאונד מוחלט ושחרור נעילות חומרה...');
      
      // 1. Stop all active audio streams
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (gameAudioStream) gameAudioStream.getTracks().forEach(t => t.stop());
      if (backupMicStream) backupMicStream.getTracks().forEach(t => t.stop());
      setMicStream(null);
      setGameAudioStream(null);
      setBackupMicStream(null);

      // 2. Clear stored preferences from localStorage
      try {
        localStorage.removeItem('gaming_studio_preferred_mic');
        localStorage.removeItem('gaming_studio_preferred_game_audio');
        localStorage.removeItem('gaming_studio_preferred_backup_audio');
      } catch {}

      // 3. Reset all audio state
      setSelectedAudioId('');
      setSelectedGameAudioId('');
      setSelectedBackupAudioId('');
      setIsAudioMuted(false);
      setIsBackupAudioMuted(false);
      setMicGain(1.0);
      setGameAudioVolume(1.0);
      setBackupMicGain(1.0);
      setMonitorGameAudio(true);
      setIsBackupMicEnabled(false);
      setBackupMicMode('standby');
      setIsHotSwapped(false);

      // 4. Cooldown for CoreAudio and AVFoundation release
      await new Promise(r => setTimeout(r, 400));

      // 5. Re-run device discovery
      await refreshDevices();
      gamingMixerRef.current?.resume();
      if (gameAudioMonitorRef.current) {
        gameAudioMonitorRef.current.play().catch(() => {});
      }
      console.log('[Audio System] ✅ איפוס סאונדים הושלם בהצלחה!');
    } catch (err) {
      console.error('[Audio System] ❌ שגיאה במהלך איפוס סאונדים:', err);
    }
  };

  // Real-time Console Sound Monitor (Direct HTML5 audio pipeline for zero-latency headphone/speaker output)
  useEffect(() => {
    const audioEl = gameAudioMonitorRef.current;
    if (!audioEl) return;

    const activeStream = gameAudioStream || (captureCardStream?.getAudioTracks().length ? captureCardStream : null);

    if (activeStream && activeStream.getAudioTracks().length > 0 && monitorGameAudio) {
      if (audioEl.srcObject !== activeStream) {
        audioEl.srcObject = activeStream;
      }
      audioEl.volume = Math.min(1, Math.max(0, gameAudioVolume));
      audioEl.muted = !monitorGameAudio;
      audioEl.play().catch(() => {});
    } else {
      audioEl.srcObject = null;
    }
  }, [gameAudioStream, captureCardStream, monitorGameAudio, gameAudioVolume]);

  // Global user interaction unblocker for AudioContext (ensures audio plays without browser blocking)
  useEffect(() => {
    const handleInteraction = () => {
      gamingMixerRef.current?.resume();
      if (gameAudioMonitorRef.current && gameAudioMonitorRef.current.paused) {
        gameAudioMonitorRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
    window.addEventListener('touchstart', handleInteraction, { passive: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // 6. Keyboard Hotkeys (1-4 layouts, M for mute mic, V for mute cam, R for record)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      if (e.key === '1') {
        setFacecamLayout('solo_game');
      } else if (e.key === '2') {
        setFacecamLayout('pip_br');
      } else if (e.key === '3') {
        setFacecamLayout('solo_cam');
      } else if (e.key === '4') {
        setFacecamLayout('split');
      } else if (e.key.toLowerCase() === 'm') {
        toggleMic();
      } else if (e.key.toLowerCase() === 'v') {
        toggleCam();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [facecamStream, isAudioMuted, isVideoMuted]);

  // 7. Master 60FPS Compositor Loop (Canvas Engine)
  useEffect(() => {
    let animId: number;
    const canvas = gamingCompositorCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Dynamically adjust canvas internal resolution
    const targetW = videoResolution === '4k' ? 3840 : videoResolution === '1080p' ? 1920 : 1280;
    const targetH = videoResolution === '4k' ? 2160 : videoResolution === '1080p' ? 1080 : 720;
    canvas.width = targetW;
    canvas.height = targetH;

    const renderGamingStage = () => {
      const W = canvas.width;
      const H = canvas.height;
      const scale = W / 1920; // Resolution scaler for 4K UHD vs 1080p

      // --- LAYER 1: Gameplay Screen / Window / Capture Card ---
      const gameVideo = gameplayVideoRef.current;
      const hasGameFeed = gameVideo && gameVideo.readyState >= 2;

      if (hasGameFeed) {
        // Clear background with solid black for clean pillarbox / letterbox framing
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);

        const vw = gameVideo.videoWidth || W;
        const vh = gameVideo.videoHeight || H;
        const srcRatio = vw / vh;
        const dstRatio = W / H;

        let baseW = W;
        let baseH = H;
        let baseX = 0;
        let baseY = 0;

        if (gameFitMode === 'fit') {
          // Fit mode: Zero crop! Preserves 100% of game field of view without cutting a single pixel
          if (srcRatio > dstRatio) {
            baseW = W;
            baseH = W / srcRatio;
            baseY = (H - baseH) / 2;
          } else {
            baseH = H;
            baseW = H * srcRatio;
            baseX = (W - baseW) / 2;
          }
        } else if (gameFitMode === 'fill') {
          // Fill mode: Covers canvas with uniform scaling
          if (srcRatio > dstRatio) {
            baseH = H;
            baseW = H * srcRatio;
            baseX = (W - baseW) / 2;
          } else {
            baseW = W;
            baseH = W / srcRatio;
            baseY = (H - baseH) / 2;
          }
        } else {
          // Stretch mode: Exact 16:9 full canvas
          baseW = W;
          baseH = H;
          baseX = 0;
          baseY = 0;
        }

        // Apply custom zoom (80% to 120%) and pan offsets (overscan compensation)
        const zoomMult = (gameZoom || 100) / 100;
        const finalW = baseW * zoomMult;
        const finalH = baseH * zoomMult;
        const offsetX = ((gameOffsetX || 0) / 100) * W;
        const offsetY = ((gameOffsetY || 0) / 100) * H;
        const finalX = baseX + (baseW - finalW) / 2 + offsetX;
        const finalY = baseY + (baseH - finalH) / 2 + offsetY;

        ctx.drawImage(gameVideo, finalX, finalY, finalW, finalH);
      } else {
        // Futuristic Cyber Gaming Backdrop
        const grad = ctx.createLinearGradient(0, 0, W, H);
        grad.addColorStop(0, '#090d16');
        grad.addColorStop(0.5, '#0e1526');
        grad.addColorStop(1, '#05070d');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Cyber Grid Lines
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
        ctx.lineWidth = 1.5 * scale;
        const step = 60 * scale;
        for (let x = 0; x < W; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
        for (let y = 0; y < H; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W, y);
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `bold ${Math.round(36 * scale)}px Rubik, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🎮 בחר מקור גיימפליי: לכידת מסך ב-60FPS או כרטיס אלגטו', W / 2, H / 2 - 20 * scale);

        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = `500 ${Math.round(20 * scale)}px Rubik, sans-serif`;
        const resText = videoResolution === '4k' ? '4K Ultra HD (3840×2160)' : videoResolution === '1080p' ? 'Full HD (1920×1080)' : 'HD (1280×720)';
        ctx.fillText(`הקלטת מאסטר ב-${resText} ב-60FPS עם מיקסר אודיו כפול`, W / 2, H / 2 + 30 * scale);
      }

      // --- LAYER 2: Facecam Multi-Cam (Webcam / iPhone / Cam Link / Remote Cam) ---
      const faceVideo = facecamVideoRef.current;
      const isVideoReady = faceVideo && faceVideo.readyState >= 2 && faceVideo.videoWidth > 0;
      const remoteImg = remoteImageRef.current;
      const isRemoteImgReady = isUsingRemoteCam && remoteImg && remoteImg.complete && remoteImg.naturalWidth > 0;
      const shouldDrawFacecam = facecamLayout !== 'solo_game' && camSize !== 'hidden';

      if (shouldDrawFacecam) {
        ctx.save();

        const shouldDrawRemoteImage = isUsingRemoteCam && isRemoteImgReady && (!isVideoReady || !remoteStream);
        const camSource: HTMLVideoElement | HTMLImageElement | null = shouldDrawRemoteImage ? remoteImg : (isVideoReady ? faceVideo : null);

        const camNatW = camSource ? ('videoWidth' in camSource ? (camSource as HTMLVideoElement).videoWidth : (camSource as HTMLImageElement).naturalWidth) : 1920;
        const camNatH = camSource ? ('videoHeight' in camSource ? (camSource as HTMLVideoElement).videoHeight : (camSource as HTMLImageElement).naturalHeight) : 1080;
        const nativeAspect = (camNatW > 0 && camNatH > 0) ? (camNatW / camNatH) : (16 / 9);

        let fw = 0;
        let fh = 0;

        const sizeWidthMap: Record<CamSizeKey, number> = {
          hidden: 0,
          xs: 240,
          sm: 340,
          md: 460,
          lg: 620,
          xl: 800,
        };
        fw = (sizeWidthMap[camSize] || 460) * scale;

        let targetAspect = 16 / 9;
        if (facecamAspect === 'auto') {
          targetAspect = nativeAspect;
        } else if (facecamAspect === '4:3') {
          targetAspect = 4 / 3;
        } else if (facecamAspect === '1:1') {
          targetAspect = 1.0;
        } else if (facecamAspect === '9:16') {
          targetAspect = 9 / 16;
        } else {
          targetAspect = 16 / 9;
        }

        fh = fw / targetAspect;

        if (facecamShape === 'circle') {
          fh = fw; // 1:1 for perfect circle geometry
        } else if (facecamLayout.startsWith('pip')) {
          // Prevent oversized vertical PiP overflowing the canvas
          if (fh > H * 0.65) {
            fh = H * 0.65;
            fw = fh * targetAspect;
          }
        }

        const margin = 40 * scale;
        let fx = W - fw - margin;
        let fy = H - fh - margin;

        if (camFreePos !== null) {
          // Free drag position (percent based on canvas width and height)
          fx = (camFreePos.x / 100) * W;
          fy = (camFreePos.y / 100) * H;
        } else if (camAnchor) {
          // 9-point anchor grid calculation
          if (camAnchor === 'tl') { fx = margin; fy = margin; }
          else if (camAnchor === 'tc') { fx = (W - fw) / 2; fy = margin; }
          else if (camAnchor === 'tr') { fx = W - fw - margin; fy = margin; }
          else if (camAnchor === 'ml') { fx = margin; fy = (H - fh) / 2; }
          else if (camAnchor === 'mc') { fx = (W - fw) / 2; fy = (H - fh) / 2; }
          else if (camAnchor === 'mr') { fx = W - fw - margin; fy = (H - fh) / 2; }
          else if (camAnchor === 'bl') { fx = margin; fy = H - fh - margin; }
          else if (camAnchor === 'bc') { fx = (W - fw) / 2; fy = H - fh - margin; }
          else if (camAnchor === 'br') { fx = W - fw - margin; fy = H - fh - margin; }
        } else if (facecamLayout === 'pip_bl') {
          fx = margin;
          fy = H - fh - margin;
        } else if (facecamLayout === 'pip_tr') {
          fx = W - fw - margin;
          fy = margin;
        } else if (facecamLayout === 'pip_tl') {
          fx = margin;
          fy = margin;
        } else if (facecamLayout === 'split') {
          fx = W / 2 + 20 * scale;
          fy = (H - (H * 0.85)) / 2;
          fw = W / 2 - 40 * scale;
          fh = H * 0.85;
        } else if (facecamLayout === 'solo_cam') {
          fx = 0;
          fy = 0;
          fw = W;
          fh = H;
        }

        // Clip path to facecam shape
        ctx.beginPath();
        if (facecamLayout === 'solo_cam') {
          ctx.rect(0, 0, W, H);
        } else if (facecamShape === 'circle') {
          const cx = fx + fw / 2;
          const cy = fy + fh / 2;
          ctx.arc(cx, cy, fw / 2, 0, Math.PI * 2);
        } else if (facecamShape === 'rounded') {
          if (ctx.roundRect) ctx.roundRect(fx, fy, fw, fh, 24 * scale);
          else ctx.rect(fx, fy, fw, fh);
        } else {
          ctx.rect(fx, fy, fw, fh);
        }

        ctx.save();
        ctx.clip();
        
        // Zero-distortion cover algorithm: Preserves exact proportions of human face
        const hasLiveVideo = (isVideoReady || isRemoteImgReady) && !isVideoMuted && camSource;
        if (hasLiveVideo) {
          const sw = camNatW || fw;
          const sh = camNatH || fh;
          const srcRatio = sw / sh;
          const dstRatio = fw / fh;

          let sWidth = sw;
          let sHeight = sh;
          let sx = 0;
          let sy = 0;

          if (srcRatio > dstRatio) {
            // Source is wider than destination -> crop sides (center horizontally)
            sWidth = sh * dstRatio;
            sx = (sw - sWidth) / 2;
          } else {
            // Source is taller than destination -> crop top/bottom (center vertically)
            sHeight = sw / dstRatio;
            sy = (sh - sHeight) / 2;
          }

          const isMirroredCam = isMirrored && !isUsingRemoteCam;
          if (isMirroredCam) {
            ctx.translate(fx + fw, fy);
            ctx.scale(-1, 1);
            ctx.drawImage(camSource, sx, sy, sWidth, sHeight, 0, 0, fw, fh);
          } else {
            ctx.drawImage(camSource, sx, sy, sWidth, sHeight, fx, fy, fw, fh);
          }
        } else {
          // Sleek dark placeholder card if video is loading / muted / connecting
          ctx.fillStyle = 'rgba(10, 14, 26, 0.88)';
          ctx.fillRect(fx, fy, fw, fh);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${Math.round(15 * scale)}px Rubik, sans-serif`;

          if (isVideoMuted) {
            ctx.fillText('📹 מצלמת פנים כבויה (V)', fx + fw / 2, fy + fh / 2);
          } else if (isFacecamInitializing) {
            ctx.fillText('⏳ מתחבר למצלמה...', fx + fw / 2, fy + fh / 2);
          } else if (facecamError) {
            ctx.fillStyle = 'rgba(244, 63, 94, 0.95)';
            ctx.fillText('⚠️ תקלת מצלמה', fx + fw / 2, fy + fh / 2 - 10 * scale);
            ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
            ctx.font = `500 ${Math.round(11 * scale)}px Rubik, sans-serif`;
            ctx.fillText('בדוק לוח בקרה מטה', fx + fw / 2, fy + fh / 2 + 12 * scale);
          } else {
            ctx.fillText('📹 מצלמת פנים', fx + fw / 2, fy + fh / 2);
          }
        }

        ctx.restore();

        // Neon Glow Border
        if (facecamLayout !== 'solo_cam') {
          ctx.save();
          ctx.strokeStyle = facecamGlowColor || '#06b6d4';
          ctx.lineWidth = (facecamBorderWidth || 3) * scale;
          if (facecamGlowBlur > 0) {
            ctx.shadowColor = facecamGlowColor || '#06b6d4';
            ctx.shadowBlur = facecamGlowBlur * scale;
          }

          ctx.beginPath();
          if (facecamShape === 'circle') {
            const cx = fx + fw / 2;
            const cy = fy + fh / 2;
            ctx.arc(cx, cy, fw / 2, 0, Math.PI * 2);
          } else if (facecamShape === 'rounded') {
            if (ctx.roundRect) ctx.roundRect(fx, fy, fw, fh, 24 * scale);
            else ctx.rect(fx, fy, fw, fh);
          } else {
            ctx.rect(fx, fy, fw, fh);
          }
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      }

      // --- LAYER 3: Streamer Gamer HUD / Overlays ---
      if (showGamerHud) {
        ctx.save();
        const badgeX = 30 * scale;
        const badgeY = 30 * scale;
        const badgeW = 270 * scale;
        const badgeH = 50 * scale;
        ctx.fillStyle = 'rgba(5, 8, 16, 0.85)';
        if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 14 * scale);
        else ctx.rect(badgeX, badgeY, badgeW, badgeH);
        ctx.fill();
        ctx.strokeStyle = facecamGlowColor || '#06b6d4';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();

        // Pulsing Live / Recording Indicator
        ctx.beginPath();
        ctx.fillStyle = isRecording ? '#ef4444' : '#10b981';
        ctx.arc(badgeX + 24 * scale, badgeY + 25 * scale, 7 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(17 * scale)}px Rubik, sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText(gamerTag || 'סטרימר', badgeX + 250 * scale, badgeY + 31 * scale);

        // FPS & Resolution Badge
        const fpsW = 210 * scale;
        const fpsH = 40 * scale;
        ctx.fillStyle = 'rgba(5, 8, 16, 0.85)';
        if (ctx.roundRect) ctx.roundRect(W - fpsW - 30 * scale, 30 * scale, fpsW, fpsH, 12 * scale);
        else ctx.rect(W - fpsW - 30 * scale, 30 * scale, fpsW, fpsH);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1 * scale;
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = `bold ${Math.round(13 * scale)}px monospace`;
        ctx.textAlign = 'center';
        const resBadge = videoResolution === '4k' ? '60 FPS • 4K Ultra HD' : videoResolution === '1080p' ? '60 FPS • 1080p FHD' : '60 FPS • 720p HD';
        ctx.fillText(resBadge, W - 30 * scale - fpsW / 2, 30 * scale + 25 * scale);

        ctx.restore();
      }

      animId = requestAnimationFrame(renderGamingStage);
    };

    animId = requestAnimationFrame(renderGamingStage);

    try {
      gamingCompositeStreamRef.current = canvas.captureStream(60);
    } catch (e) {}

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [
    videoResolution,
    screenStream,
    captureCardStream,
    facecamLayout,
    facecamShape,
    facecamAspect,
    facecamSize,
    facecamGlowColor,
    facecamGlowBlur,
    facecamBorderWidth,
    gamerTag,
    showGamerHud,
    isMirrored,
    isVideoMuted,
    isUsingRemoteCam,
    isRecording,
    gameFitMode,
    gameZoom,
    gameOffsetX,
    gameOffsetY,
    camSize,
    camFreePos,
    camAnchor
  ]);

  // 8. Recording Engine (High Bitrate 60FPS Single Video File + Isolated Stems)
  const startRecording = () => {
    try {
      const canvasStream = gamingCompositeStreamRef.current || gamingCompositorCanvasRef.current?.captureStream(60);
      if (!canvasStream) {
        alert('שגיאה באתחול קנבס הקלטת גיימינג.');
        return;
      }

      const compositeVideoTrack = canvasStream.getVideoTracks()[0];
      const activeMicStream = micStream || (isUsingRemoteCam && remoteStream ? remoteStream : null);
      const activeGameStream = gameAudioStream || (captureCardStream?.getAudioTracks().length ? captureCardStream : null) || (screenStream?.getAudioTracks().length ? screenStream : null);

      const audioPipes = gamingMixerRef.current?.setup(activeMicStream, activeGameStream, {
        splitChannels,
        monitorGame: monitorGameAudio,
        monitorMic: isMonitoringMic,
        micMonitorVolume,
        studioVocalDsp: studioVocalEnhance,
        backupMicStream: isBackupMicEnabled ? backupMicStream : null,
        backupMicInMix: isBackupMicEnabled && (backupMicMode === 'active' || isHotSwapped) && !isBackupAudioMuted,
        backupMicVolume: isBackupAudioMuted ? 0 : backupMicGain
      });

      const mixedAudioTrack = audioPipes?.mixedStream?.getAudioTracks()[0] || activeMicStream?.getAudioTracks()[0];

      const recordStream = new MediaStream([compositeVideoTrack]);
      if (mixedAudioTrack) {
        recordStream.addTrack(mixedAudioTrack);
      }

      const targetVideoBitrate = videoResolution === '4k' 
        ? 45000000 // 45 Mbps for 4K UHD 60FPS
        : videoResolution === '1080p'
        ? 12000000 // 12 Mbps for 1080p FHD 60FPS
        : 6000000;

      // Determine optimum MIME type based on chosen video container format (MP4 / WebM / MKV)
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (videoContainerFormat === 'mp4') {
        const mp4Candidates = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4;codecs=avc1',
          'video/mp4;codecs=h264',
          'video/mp4'
        ];
        const supported = mp4Candidates.find(t => MediaRecorder.isTypeSupported(t));
        mimeType = supported || 'video/webm;codecs=vp9,opus';
      } else if (videoContainerFormat === 'mkv') {
        const mkvCandidates = [
          'video/x-matroska;codecs=avc1,opus',
          'video/x-matroska',
          'video/webm;codecs=vp9,opus',
          'video/webm'
        ];
        const supported = mkvCandidates.find(t => MediaRecorder.isTypeSupported(t));
        mimeType = supported || 'video/webm;codecs=vp9,opus';
      } else {
        const webmCandidates = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
        const supported = webmCandidates.find(t => MediaRecorder.isTypeSupported(t));
        mimeType = supported || 'video/webm';
      }

      // 1. Master Composite Video Recorder
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(recordStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: targetVideoBitrate
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      // 2. Isolated Microphone Track (Clean Voice Stem for Editing)
      const isolatedMicStream = audioPipes?.isolatedMicStream || activeMicStream;
      if (isolatedMicStream && isolatedMicStream.getAudioTracks().length > 0) {
        try {
          recordedMicChunksRef.current = [];
          const micMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
          const micRec = new MediaRecorder(isolatedMicStream, { mimeType: micMime });
          micRec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedMicChunksRef.current.push(e.data);
          };
          micRec.start(1000);
          micRecorderRef.current = micRec;
        } catch (e) {
          console.warn('Could not start isolated mic recorder:', e);
        }
      }

      // 3. Isolated Console / Game Audio Track (Clean Game Sound Stem for Editing)
      const isolatedGameStream = audioPipes?.isolatedGameStream || activeGameStream;
      if (isolatedGameStream && isolatedGameStream.getAudioTracks().length > 0) {
        try {
          recordedGameChunksRef.current = [];
          const gameMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
          const gameRec = new MediaRecorder(isolatedGameStream, { mimeType: gameMime });
          gameRec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedGameChunksRef.current.push(e.data);
          };
          gameRec.start(1000);
          gameRecorderRef.current = gameRec;
        } catch (e) {
          console.warn('Could not start isolated game recorder:', e);
        }
      }

      // 4. Isolated Emergency Backup Microphone Track (Clean Backup Voice Stem for Rescue)
      const isolatedBackupMicStream = audioPipes?.isolatedBackupMicStream;
      if (isBackupMicEnabled && isolatedBackupMicStream && isolatedBackupMicStream.getAudioTracks().length > 0) {
        try {
          recordedBackupMicChunksRef.current = [];
          const backupMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
          const backupRec = new MediaRecorder(isolatedBackupMicStream, { mimeType: backupMime });
          backupRec.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) recordedBackupMicChunksRef.current.push(e.data);
          };
          backupRec.start(1000);
          backupRecorderRef.current = backupRec;
        } catch (e) {
          console.warn('Could not start isolated backup mic recorder:', e);
        }
      }

      recorder.onstop = async () => {
        const fullVideoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(fullVideoBlob);
        setRecordedVideoBlob(fullVideoBlob);
        setRecordedVideoUrl(videoUrl);

        const fullMicBlob = recordedMicChunksRef.current.length > 0 ? new Blob(recordedMicChunksRef.current, { type: 'audio/webm' }) : null;
        const fullGameBlob = recordedGameChunksRef.current.length > 0 ? new Blob(recordedGameChunksRef.current, { type: 'audio/webm' }) : null;
        const fullBackupMicBlob = recordedBackupMicChunksRef.current.length > 0 ? new Blob(recordedBackupMicChunksRef.current, { type: 'audio/webm' }) : null;

        setRecordedMicBlob(fullMicBlob);
        setRecordedAudioBlob(fullMicBlob);
        setRecordedGameAudioBlob(fullGameBlob);
        setRecordedBackupMicBlob(fullBackupMicBlob);

        const finalDuration = recordedSecondsRef.current || recordedSeconds;
        const blobKey = `rec_${episode.id}_${Date.now()}`;

        try {
          await saveMediaBlob(blobKey, fullVideoBlob);
          if (fullMicBlob) await saveMediaBlob(`${blobKey}_mic`, fullMicBlob);
          if (fullGameBlob) await saveMediaBlob(`${blobKey}_game`, fullGameBlob);
          if (fullBackupMicBlob) await saveMediaBlob(`${blobKey}_backup_mic`, fullBackupMicBlob);
        } catch (err) {
          console.error('Failed to save gaming video blob:', err);
        }

        const updatedEpisode: Episode = {
          ...currentEpisodeRef.current,
          mediaType: 'gaming_creator',
          status: 'recorded',
          recording: {
            duration: finalDuration,
            recordedAt: new Date().toISOString(),
            videoBlobKey: blobKey,
            fileSize: fullVideoBlob.size,
            mimeType,
            resolution: videoResolution,
            markers: markersRef.current,
            topicsCovered: []
          }
        };

        saveEpisode(updatedEpisode);
        currentEpisodeRef.current = updatedEpisode;
        setCurrentEpisode(updatedEpisode);
        setFinishedRecording(true);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      setRecordedSeconds(0);
      recordedSecondsRef.current = 0;
      markersRef.current = [];

      timerIntervalRef.current = setInterval(() => {
        setRecordedSeconds(prev => {
          const next = prev + 1;
          recordedSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start gaming recording:', err);
      alert('שגיאה בהפעלת ההקלטה: ' + (err as Error).message);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (confirm('האם לעצור את הקלטת הגיימינג ולעבור לסקירה ושמירה?')) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (micRecorderRef.current && micRecorderRef.current.state !== 'inactive') {
        micRecorderRef.current.stop();
      }
      if (gameRecorderRef.current && gameRecorderRef.current.state !== 'inactive') {
        gameRecorderRef.current.stop();
      }
      if (backupRecorderRef.current && backupRecorderRef.current.state !== 'inactive') {
        backupRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  startRecordingRef.current = startRecording;

  const handleMasterRecordClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (isPreBroadcastCounting) {
      cancelPreBroadcastCountdown();
      startRecording();
      return;
    }

    if (preBroadcastDelay > 0) {
      startPreBroadcastCountdown(preBroadcastDelay);
    } else {
      startRecording();
    }
  };

  const toggleMic = () => {
    gamingMixerRef.current?.resume();
    const stream = micStream || (isUsingRemoteCam && remoteStream ? remoteStream : null);
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleCam = () => {
    const stream = isUsingRemoteCam && remoteStream ? remoteStream : facecamStream;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoMuted(!videoTrack.enabled);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
    } else {
      document.exitFullscreen().catch(err => console.error(err));
    }
  };

  // Render Post-Recording Review when recording completes
  if (finishedRecording) {
    return (
      <PostRecordingReview
        episode={currentEpisode}
        videoBlob={recordedVideoBlob}
        audioBlob={recordedMicBlob || recordedAudioBlob}
        gameAudioBlob={recordedGameAudioBlob}
        backupAudioBlob={recordedBackupMicBlob}
        videoUrl={recordedVideoUrl}
        durationSeconds={recordedSecondsRef.current || recordedSeconds}
        markers={markersRef.current.length > 0 ? markersRef.current : markers}
        defaultFormat={videoContainerFormat}
        onReRecord={() => {
          setFinishedRecording(false);
          setRecordedSeconds(0);
          recordedSecondsRef.current = 0;
          setMarkers([]);
          markersRef.current = [];
        }}
      />
    );
  }

  return (
    <div ref={containerRef} className="space-y-5 animate-in fade-in duration-300 font-sans" dir="rtl">
      {/* Off-screen high-performance video decoders (ensures native buffer allocation without throttling) */}
      <video
        ref={facecamVideoRef}
        playsInline
        autoPlay
        muted
        style={{ position: 'fixed', top: -9999, left: -9999, opacity: 0, pointerEvents: 'none' }}
      />
      <video
        ref={gameplayVideoRef}
        playsInline
        autoPlay
        muted
        width={3840}
        height={2160}
        style={{ position: 'fixed', top: -9999, left: -9999, width: 3840, height: 2160, opacity: 0, pointerEvents: 'none' }}
      />
      {/* Dedicated Console Audio Monitor Element */}
      <audio
        ref={gameAudioMonitorRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />
      {/* Off-screen Image decoder for live remote iPhone camera frames */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={remoteImageRef}
        alt=""
        crossOrigin="anonymous"
        style={{ position: 'fixed', top: -9999, left: -9999, width: 640, height: 360, opacity: 0, pointerEvents: 'none' }}
      />

      {/* TOP HEADER & STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#12162a] via-[#101424] to-[#0c0f1d] border border-purple-500/20 shadow-2xl">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/?view=gaming"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 hover:bg-purple-900/90 text-purple-200 hover:text-white border border-purple-500/40 text-xs font-bold transition-all shadow-sm"
            title="יציאה למרכז סרטוני הגיימינג והיוטיוב"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>סרטוני גיימינג</span>
          </Link>

          <Link
            href={`/episodes/${episode.id}`}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 border border-slate-700/60 transition-colors text-xs font-medium"
            title="חזרה לפרטי הפרק"
          >
            <span>פרטי הפרק</span>
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/80 border border-purple-500/40 text-purple-200 text-xs font-black shadow-lg">
                <Gamepad2 className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>אולפן גיימינג ויוצרים (60FPS Master)</span>
              </div>

              {/* Resolution Switcher */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-purple-500/30 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setVideoResolution('4k')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                    videoResolution === '4k'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow-md scale-105'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🌟 4K UHD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoResolution('1080p')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    videoResolution === '1080p'
                      ? 'bg-indigo-600 text-white shadow-md scale-105'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🎬 FHD 1080p</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoResolution('720p')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    videoResolution === '720p'
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>HD 720p</span>
                </button>
              </div>

              {/* Video Container Format Switcher (MP4 / WebM / MKV) */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-purple-500/30 text-xs font-bold" title="בחר את פורמט שמירת הווידאו (MP4 מומלץ לעריכה ויוטיוב)">
                <button
                  type="button"
                  onClick={() => setVideoContainerFormat('mp4')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    videoContainerFormat === 'mp4'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md font-black scale-105'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="MP4 - תואם לכל תוכנות העריכה (Premiere, Final Cut, DaVinci) ויוטיוב"
                >
                  <span>🎞️ MP4</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoContainerFormat('webm')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    videoContainerFormat === 'webm'
                      ? 'bg-purple-700 text-white shadow-md font-black scale-105'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="WebM - איכות שידור מלאה ויעילה"
                >
                  <span>🌐 WebM</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVideoContainerFormat('mkv')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                    videoContainerFormat === 'mkv'
                      ? 'bg-slate-700 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="MKV - פורמט שידור חסין תקלות"
                >
                  <span>📦 MKV</span>
                </button>
              </div>

              {isScreenCapturing && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-950/70 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>מסך משחק 60FPS</span>
                </span>
              )}
              {captureCardStream && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-cyan-950/70 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>כרטיס אלגטו פעיל</span>
                </span>
              )}
            </div>
            <h1 className="text-base font-bold text-white mt-1">{episode.title}</h1>
          </div>
        </div>

        {/* Recording Controls & Timer */}
        <div className="flex items-center gap-3">
          {/* Recording Duration Timer */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80">
            <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
            <span className="font-mono text-sm font-bold text-white">
              {formatTime(recordedSeconds)}
            </span>
            <span className="text-[10px] text-purple-400 font-mono font-bold bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-800/40">
              60 FPS
            </span>
          </div>

          {/* Master Record Button */}
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-xl shadow-rose-950/60 active:scale-95 transition-all border border-rose-400/30 animate-pulse"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>עצור הקלטה</span>
            </button>
          ) : isPreBroadcastCounting ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleMasterRecordClick}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-950/60 active:scale-95 transition-all border border-amber-300 animate-pulse"
                title="לחץ כדי לדלג על הספירה ולהתחיל מיד"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>מתחיל בעוד: {formatCountdownDisplay(preBroadcastSecondsRemaining)} (דלג)</span>
              </button>
              <button
                onClick={cancelPreBroadcastCountdown}
                className="p-2.5 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/50 transition-colors"
                title="בטל ספירה לאחור"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleMasterRecordClick}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-950/60 active:scale-95 transition-all border border-purple-400/40"
            >
              <CircleDot className="w-4 h-4 text-white" />
              <span>
                {preBroadcastDelay > 0
                  ? `התחל שידור (ספירה של ${formatCountdownDisplay(preBroadcastDelay)})`
                  : 'התחל הקלטת גיימינג'}
              </span>
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 border border-slate-700/60 transition-colors"
            title="מסך מלא"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MAIN STAGE: 60FPS COMPOSITOR CANVAS PREVIEW */}
      <div
        ref={(el) => { (containerRef as any).current = el; (camPreviewContainerRef as any).current = el; }}
        className="relative rounded-3xl overflow-hidden bg-black border-2 border-purple-500/30 shadow-2xl shadow-purple-950/40"
      >
        <canvas
          ref={gamingCompositorCanvasRef}
          className="w-full aspect-video bg-[#090d16] object-contain block cursor-pointer"
          title="קנבס הקלטת גיימינג ב-60FPS"
        />

        {/* ── Overlay Canvas (all active overlays rendered here) ── */}
        <OverlayCanvas
          overlays={overlays}
          containerRef={camPreviewContainerRef}
          onPositionChange={updateOverlayPosition}
          onRemove={removeOverlay}
          onToggleVisible={toggleOverlayVisible}
          isEditing={isOverlayEditMode}
          timerSeconds={timerElapsed}
        />

        {/* ── Pre-Broadcast Starting Soon Countdown HUD Overlay ── */}
        {isPreBroadcastCounting && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-all">
            <div className="relative flex flex-col items-center p-8 rounded-3xl bg-slate-950/95 border border-purple-500/50 shadow-2xl shadow-purple-950/90 max-w-md mx-4 text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 text-xs font-black tracking-wider uppercase mb-3 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>השידור וההקלטה מתחילים בעוד</span>
              </div>

              {/* Giant Countdown Digits */}
              <div className="my-2 flex items-center justify-center">
                <span className="font-mono text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-300 to-rose-400 tracking-tight tabular-nums drop-shadow-[0_0_30px_rgba(168,85,247,0.6)]">
                  {formatCountdownDisplay(preBroadcastSecondsRemaining)}
                </span>
              </div>

              {/* Progress Bar */}
              {preBroadcastTotalDuration > 0 && (
                <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mt-3 mb-4 border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500 transition-all duration-1000 ease-linear rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((preBroadcastTotalDuration - preBroadcastSecondsRemaining) / preBroadcastTotalDuration) * 100))}%`,
                    }}
                  />
                </div>
              )}

              <p className="text-xs text-slate-300 mb-6 font-medium">
                {preBroadcastSecondsRemaining <= 3
                  ? '🎯 היכונו לשידור... 3, 2, 1!'
                  : 'התמקמו מול המצלמה והמיקרופון, השידור יתחיל אוטומטית'}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={handleMasterRecordClick}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-950/60 transition-all active:scale-95 flex items-center justify-center gap-2 border border-emerald-400/30"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>התחל עכשיו (דלג)</span>
                </button>

                <button
                  type="button"
                  onClick={cancelPreBroadcastCountdown}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:border-rose-500/60 text-slate-300 hover:text-rose-300 font-bold text-sm transition-all border border-slate-700 active:scale-95 flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  <span>ביטול ספירה</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Studio Timer HUD (shown on preview when active) ── */}
        {timerMode !== 'off' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/70 backdrop-blur-md border border-purple-500/40 shadow-xl">
            <Timer className={`w-4 h-4 ${timerRunning ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="font-mono text-2xl font-black text-white tracking-widest tabular-nums">
              {timerDisplay(timerElapsed)}
            </span>
            {timerMode === 'countdown' && timerTarget - timerElapsed <= 30 && timerElapsed < timerTarget && (
              <span className="text-[10px] font-bold text-rose-400 animate-pulse">פג זמן!</span>
            )}
          </div>
        )}

        {/* ── Draggable Facecam block (free position mode) ── */}
        {camSize !== 'hidden' && facecamStream && camFreePos !== null && (
          <div
            className="absolute z-20 cursor-move group/cam"
            style={{
              left: `${camFreePos.x}%`,
              top: `${camFreePos.y}%`,
              width: CAM_SIZES[camSize].w,
            }}
            onMouseDown={handleCamMouseDown}
            title="גרור לשינוי מיקום"
          >
            <div className={`relative overflow-hidden shadow-2xl border-2 border-cyan-500/60 group-hover/cam:border-cyan-400 transition-all ${
              facecamShape === 'circle' ? 'rounded-full aspect-square' :
              facecamShape === 'rectangle' ? 'rounded-xl' : 'rounded-2xl'
            }`} style={{ aspectRatio: facecamAspect === '1:1' ? '1/1' : facecamAspect === '9:16' ? '9/16' : '16/9' }}>
              <video
                ref={(el) => { if (el && facecamStream) el.srcObject = facecamStream; }}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
              />
              {/* Drag indicator */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cam:opacity-100 transition-opacity bg-black/30 pointer-events-none">
                <Move className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
          </div>
        )}

        {/* Minimized Floating Top-Left Layout Selector */}
        <div ref={layoutMenuRef} className="absolute top-4 left-4 z-30">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-purple-500/30 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsLayoutMenuOpen(prev => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isLayoutMenuOpen
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/50'
                  : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
              }`}
              title="לחץ לבחירת תצוגת מסך (מצלמה, גיימפליי, מסך מפוצל)"
            >
              {facecamLayout === 'solo_game' && <Monitor className="w-3.5 h-3.5 text-cyan-400" />}
              {facecamLayout.startsWith('pip') && <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />}
              {facecamLayout === 'solo_cam' && <Video className="w-3.5 h-3.5 text-emerald-400" />}
              {facecamLayout === 'split' && <SplitSquareVertical className="w-3.5 h-3.5 text-amber-400" />}
              <span>
                {facecamLayout === 'solo_game' && 'משחק בלבד'}
                {facecamLayout.startsWith('pip') && (
                  facecamLayout === 'pip_br' ? 'מצלמה ומשחק (ימין מטה)' :
                  facecamLayout === 'pip_bl' ? 'מצלמה ומשחק (שמאל מטה)' :
                  facecamLayout === 'pip_tr' ? 'מצלמה ומשחק (ימין מעלה)' :
                  'מצלמה ומשחק (שמאל מעלה)'
                )}
                {facecamLayout === 'solo_cam' && 'מצלמה בלבד'}
                {facecamLayout === 'split' && 'מסך חצי-חצי'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isLayoutMenuOpen ? 'rotate-180 text-white' : ''}`} />
            </button>

            {/* Framing / Crop / Overscan Adjustment Button */}
            <button
              type="button"
              onClick={() => setShowFramingControls(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                showFramingControls || gameFitMode !== 'stretch' || gameZoom !== 100 || gameOffsetX !== 0 || gameOffsetY !== 0
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-lg shadow-amber-950/40'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="התאמת גודל משחק, זום ותיקון חיתוך שוליים (Overscan)"
            >
              <Crop className="w-3.5 h-3.5" />
              {(gameFitMode !== 'stretch' || gameZoom !== 100 || gameOffsetX !== 0) && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>

          {/* Expanded Dropdown Panel with All Layout Options */}
          {isLayoutMenuOpen && (
            <div className="mt-2 w-72 rounded-2xl bg-[#0b0e18]/95 backdrop-blur-xl border border-purple-500/40 shadow-2xl p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-[11px] font-black text-slate-200">מה רואים בשידור ובהקלטה:</span>
                <button
                  type="button"
                  onClick={() => setIsLayoutMenuOpen(false)}
                  className="text-slate-400 hover:text-white p-0.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {/* 1. Solo Game */}
                <button
                  type="button"
                  onClick={() => {
                    setFacecamLayout('solo_game');
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold border transition-all text-right cursor-pointer ${
                    facecamLayout === 'solo_game'
                      ? 'bg-purple-600/30 border-purple-400 text-white shadow-sm ring-1 ring-purple-400'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <span className="block font-bold">משחק בלבד (מסך מלא)</span>
                      <span className="block text-[10px] text-slate-400 font-normal">ללא מצלמה — גיימפליי בלבד</span>
                    </div>
                  </div>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-purple-300 border border-purple-500/30">
                    1
                  </kbd>
                </button>

                {/* 2. PiP (Camera + Game) */}
                <div className={`p-2 rounded-xl border transition-all space-y-2 ${
                  facecamLayout.startsWith('pip')
                    ? 'bg-purple-600/30 border-purple-400 text-white shadow-sm ring-1 ring-purple-400'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!facecamLayout.startsWith('pip')) {
                        setFacecamLayout('pip_br');
                      }
                    }}
                    className="w-full flex items-center justify-between text-xs font-bold text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-purple-400 shrink-0" />
                      <div>
                        <span className="block font-bold text-white">מצלמה ומשחק (חלונית צפה)</span>
                        <span className="block text-[10px] text-slate-400 font-normal">חלונית מצלמה בפינת המשחק</span>
                      </div>
                    </div>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-purple-300 border border-purple-500/30">
                      2
                    </kbd>
                  </button>

                  {/* Corner selector */}
                  <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-1">
                    <span className="text-[9px] text-slate-400 font-bold shrink-0">פינה:</span>
                    <div className="grid grid-cols-4 gap-1 w-full">
                      {[
                        { id: 'pip_br', label: '↘ ימין מטה' },
                        { id: 'pip_bl', label: '↙ שמאל מטה' },
                        { id: 'pip_tr', label: '↗ ימין מעלה' },
                        { id: 'pip_tl', label: '↖ שמאל מעלה' },
                      ].map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setFacecamLayout(c.id as any);
                          }}
                          className={`py-1 px-1 rounded-lg text-[9px] font-bold transition-all text-center cursor-pointer ${
                            facecamLayout === c.id
                              ? 'bg-purple-600 text-white shadow'
                              : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Solo Camera */}
                <button
                  type="button"
                  onClick={() => {
                    setFacecamLayout('solo_cam');
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold border transition-all text-right cursor-pointer ${
                    facecamLayout === 'solo_cam'
                      ? 'bg-purple-600/30 border-purple-400 text-white shadow-sm ring-1 ring-purple-400'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="block font-bold">מצלמה בלבד (מסך מלא)</span>
                      <span className="block text-[10px] text-slate-400 font-normal">לפתיח, דיבור ישיר וסגיר</span>
                    </div>
                  </div>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-purple-300 border border-purple-500/30">
                    3
                  </kbd>
                </button>

                {/* 4. Split Screen */}
                <button
                  type="button"
                  onClick={() => {
                    setFacecamLayout('split');
                    setIsLayoutMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold border transition-all text-right cursor-pointer ${
                    facecamLayout === 'split'
                      ? 'bg-purple-600/30 border-purple-400 text-white shadow-sm ring-1 ring-purple-400'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <SplitSquareVertical className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="block font-bold">מסך חצי-חצי (Split Screen)</span>
                      <span className="block text-[10px] text-slate-400 font-normal">משחק לצד מצלמה בפרופורציה שווה</span>
                    </div>
                  </div>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/50 text-purple-300 border border-purple-500/30">
                    4
                  </kbd>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Floating Top-Right Live Hardware Capture Badge */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {captureDetails ? (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl backdrop-blur-md border text-xs font-bold shadow-2xl transition-all ${
              captureDetails.width >= 3840 
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300' 
                : captureDetails.width >= 1920
                  ? 'bg-indigo-950/90 border-indigo-500/50 text-indigo-300'
                  : 'bg-amber-950/90 border-amber-500/50 text-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                captureDetails.width >= 3840 
                  ? 'bg-emerald-400' 
                  : captureDetails.width >= 1920 
                    ? 'bg-indigo-400' 
                    : 'bg-amber-400'
              } animate-pulse`} />
              <span>
                {captureDetails.width >= 3840 
                  ? `🎮 אלגטו 4K: ${captureDetails.width}×${captureDetails.height} @ ${captureDetails.fps}FPS`
                  : captureDetails.width >= 1920
                    ? `🎮 אלגטו 1080p: ${captureDetails.width}×${captureDetails.height} @ ${captureDetails.fps}FPS`
                    : `⚠️ אלגטו: ${captureDetails.width}×${captureDetails.height} @ ${captureDetails.fps}FPS (נעול על SD)`
                }
              </span>
              {captureDetails.width < 3840 && (
                <div className="flex items-center gap-1 ml-1">
                  <button
                    type="button"
                    disabled={isApplyingResolution}
                    onClick={() => handleForceCaptureResolution('4k')}
                    className="px-2.5 py-0.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black transition-all active:scale-95 flex items-center gap-1 disabled:opacity-60"
                    title="כפה על אלגטו ועל הדפדפן לעבור ל-4K Ultra HD"
                  >
                    {isApplyingResolution ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : null}
                    <span>כפה 4K</span>
                  </button>
                  <button
                    type="button"
                    disabled={isApplyingResolution}
                    onClick={handleReleaseCameraLock}
                    className="px-2.5 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black transition-all active:scale-95 flex items-center gap-1 disabled:opacity-60"
                    title="שחרר נעילת AVFoundation — סוגר FaceTime/Photo Booth ופותח מחדש את המצלמה ב-HD מלא"
                  >
                    {isApplyingResolution ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <span>🔓</span>}
                    <span>שחרר נעילה</span>
                  </button>
                </div>
              )}
            </div>
          ) : isScreenCapturing ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-cyan-950/90 backdrop-blur-md border border-cyan-500/40 text-xs font-bold text-cyan-300 shadow-2xl">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>לכידת מסך / חלון 60FPS</span>
            </div>
          ) : null}
        </div>

        {/* Floating Game Framing & Overscan Control HUD (Collapsible) */}
        {showFramingControls && (
          <div className="absolute top-16 left-4 z-30 w-80 p-3.5 rounded-2xl bg-slate-950/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 text-xs text-right" dir="rtl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                <Crop className="w-4 h-4" />
                <span>כיוונון תצוגת משחק ותיקון חיתוך (Overscan)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFramingControls(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mode selection */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300">אופן התאמת המסך:</label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
                {[
                  { id: 'fit', label: 'התאמה מלאה', desc: 'אפס חיתוך (Fit)' },
                  { id: 'stretch', label: 'מתיחה', desc: '16:9 מלא' },
                  { id: 'fill', label: 'מילוי', desc: 'Cover' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGameFitMode(m.id as any)}
                    className={`py-1 px-1 rounded-lg text-center transition-all ${
                      gameFitMode === m.id
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[11px] leading-tight font-bold">{m.label}</div>
                    <div className="text-[9px] opacity-75">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Zoom buttons (Solves cut off edges immediately) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-bold text-slate-300">זום תמונה (Zoom):</label>
                <span className="font-mono text-amber-300 font-bold">{gameZoom}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGameZoom(prev => Math.max(80, prev - 4))}
                  className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1"
                  title="התרחק 4% - מחזיר שוליים חתוכים מהקונסולה"
                >
                  <ZoomOut className="w-3 h-3 text-amber-400" />
                  <span>התרחק (-4%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGameZoom(100)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-800"
                >
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setGameZoom(prev => Math.min(120, prev + 4))}
                  className="flex-1 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1"
                >
                  <ZoomIn className="w-3 h-3 text-amber-400" />
                  <span>התקרב (+4%)</span>
                </button>
              </div>
              <input
                type="range"
                min="80"
                max="120"
                step="1"
                value={gameZoom}
                onChange={(e) => setGameZoom(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Horizontal / Vertical Pan Offset (Moves game if left edge is cut off) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-bold text-slate-300">הזזה אופקית (מרכוז ימין/שמאל):</label>
                <span className="font-mono text-amber-300 font-bold">{gameOffsetX > 0 ? `+${gameOffsetX}%` : `${gameOffsetX}%`}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setGameOffsetX(prev => Math.max(-15, prev - 2))}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                >
                  ⬅ שמאלה
                </button>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="1"
                  value={gameOffsetX}
                  onChange={(e) => setGameOffsetX(Number(e.target.value))}
                  className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => setGameOffsetX(prev => Math.min(15, prev + 2))}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold"
                >
                  ימינה ➡
                </button>
              </div>
            </div>

            {/* Reset All */}
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">אם טקסט נחתך: בחר &quot;התאמה מלאה&quot; או הקטן זום ל-95%.</span>
              <button
                type="button"
                onClick={() => {
                  setGameFitMode('fit');
                  setGameZoom(100);
                  setGameOffsetX(0);
                  setGameOffsetY(0);
                }}
                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-bold border border-slate-800"
              >
                אפס הכל
              </button>
            </div>
          </div>
        )}

        {/* Floating Bottom PiP Corner Repositioner (Only visible in PiP mode) */}
        {facecamLayout.startsWith('pip') && (
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 p-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/60 text-xs">
            <span className="text-[10px] text-slate-400 px-2 font-bold">מיקום פינה:</span>
            {[
              { id: 'pip_br', label: 'ימין למטה' },
              { id: 'pip_bl', label: 'שמאל למטה' },
              { id: 'pip_tr', label: 'ימין למעלה' },
              { id: 'pip_tl', label: 'שמאל למעלה' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFacecamLayout(p.id as any)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  facecamLayout === p.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Floating Quick Action Controls (Mic, Cam, Mirror) */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-purple-500/30 shadow-2xl">
          <button
            type="button"
            onClick={toggleMic}
            className={`p-2.5 rounded-xl border transition-all ${
              isAudioMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white'
            }`}
            title={isAudioMuted ? 'בטל השתקת מיקרופון (M)' : 'השתק מיקרופון (M)'}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleCam}
            className={`p-2.5 rounded-xl border transition-all ${
              isVideoMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white'
            }`}
            title={isVideoMuted ? 'הפעל מצלמה (V)' : 'הסתר מצלמה (V)'}
          >
            {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setIsMirrored(!isMirrored)}
            className={`p-2.5 rounded-xl border transition-all ${
              isMirrored ? 'bg-purple-600/30 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title="היפוך מראה למצלמת פנים"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* THREE INTERACTIVE STUDIO CONTROL DECKS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* CARD 1: GAMEPLAY & CAPTURE SOURCES (ELGATO 4K & SCREEN) */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#141226]/95 via-[#0e1222]/95 to-[#0b0e18]/95 border border-purple-500/30 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <MonitorPlay className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">מקור גיימפליי ומסך</h3>
                  <p className="text-[11px] text-slate-400">כרטיס Elgato 4K / לכידת חלון ומסך 60FPS</p>
                </div>
              </div>

              {captureCardStream ? (
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{captureQualityBadge || '4K Active'}</span>
                </span>
              ) : isScreenCapturing ? (
                <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>60 FPS Live</span>
                </span>
              ) : null}
            </div>

            {/* Resolution Selector Tabs (4K / 1080p / 720p) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">רזולוציית לכידה ראשית:</label>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                  {videoResolution === '4k' ? '3840×2160 UHD' : videoResolution === '1080p' ? '1920×1080 FHD' : '1280×720 HD'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                {[
                  { id: '4k', label: '4K Ultra HD', badge: 'מומלץ לאלגטו' },
                  { id: '1080p', label: '1080p 60FPS', badge: 'Full HD' },
                  { id: '720p', label: '720p 60FPS', badge: 'HD' },
                ].map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleResolutionChange(res.id as VideoResolution)}
                    className={`py-1.5 px-2 rounded-lg text-center transition-all flex flex-col items-center justify-center ${
                      videoResolution === res.id
                        ? 'bg-purple-600 text-white shadow-md font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-xs font-black">{res.label}</span>
                    <span className="text-[9px] opacity-80">{res.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hardware Capture Card 1-Click Fast Connect */}
            {(() => {
              const detectedCard = videoDevices.find(d => d.isCaptureCard);
              if (!detectedCard) return null;

              const isThisCardConnected = selectedCaptureCardId === detectedCard.deviceId && !!captureCardStream;

              return (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 border border-cyan-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cast className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-black text-cyan-200">
                        {isThisCardConnected ? 'אלגטו מחובר ופעיל' : 'זוהה כרטיס אלגטו / לוכד HDMI'}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-700">
                      {detectedCard.label.slice(0, 22)}
                    </span>
                  </div>

                  {isThisCardConnected ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 text-[11px] text-emerald-300 flex items-center gap-1.5 font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>לכידה פעילה ב-{videoResolution.toUpperCase()}!</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectCaptureCard('')}
                        className="py-1 px-2.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-[11px] font-bold transition-all"
                      >
                        נתק כרטיס
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isCaptureLoading}
                      onClick={() => handleSelectCaptureCard(detectedCard.deviceId, videoResolution)}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isCaptureLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>מנהל משא ומתן 4K...</span>
                        </>
                      ) : (
                        <>
                          <Cast className="w-3.5 h-3.5" />
                          <span>התחבר ל-{detectedCard.label} (איכות {videoResolution.toUpperCase()})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Video Source Dropdown (Elgato / HDMI / All Enumerate Devices) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Cast className="w-3.5 h-3.5 text-cyan-400" />
                  <span>בחירת מקור וידאו / כרטיס Elgato (מתוך התקני המערכת):</span>
                </label>
                <button
                  type="button"
                  onClick={refreshDevices}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold transition-colors"
                  title="סרוק מחדש התקנים באמצעות navigator.mediaDevices.enumerateDevices()"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>רענן רשימה</span>
                </button>
              </div>

              <select
                value={selectedCaptureCardId}
                onChange={(e) => handleSelectCaptureCard(e.target.value)}
                disabled={isCaptureLoading}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
              >
                <option value="">-- בחר התקן וידאו / כרטיס Elgato מתוך הרשימה --</option>
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.isCaptureCard ? '🎮 ' : '📹 '}
                    {d.label || `התקן וידאו (${d.deviceId.slice(0, 10)}...)`}
                    {d.deviceId === selectedCaptureCardId && captureDetails ? ` [פעיל: ${captureDetails.width}×${captureDetails.height}]` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 leading-tight">
                כל ההתקנים נטענים ישירות מ-<code>navigator.mediaDevices.enumerateDevices()</code>. בחירה ברשימה מפעילה מיד דרישת 4K עם Fallback אוטומטי ל-1080p.
              </p>
            </div>

            {/* Direct Hardware Force & Quality Controls */}
            {selectedCaptureCardId && (
              <div className="p-3 rounded-2xl bg-slate-900/90 border border-purple-500/20 space-y-2.5">
                {/* FPS selector row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>קצב פריימים:</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {([30, 60] as const).map((fps) => (
                      <button
                        key={fps}
                        type="button"
                        disabled={isCaptureLoading || isApplyingResolution}
                        onClick={async () => {
                          setTargetFps(fps);
                          // Re-apply immediately if already connected
                          if (selectedCaptureCardId && captureCardStream) {
                            const vt = captureCardStream.getVideoTracks()[0];
                            if (vt) {
                              try {
                                await vt.applyConstraints({ frameRate: { ideal: fps } });
                                const s = vt.getSettings();
                                const actualFps = Math.round(s.frameRate || fps);
                                setCaptureDetails(prev => prev ? { ...prev, fps: actualFps } : prev);
                                setCaptureQualityBadge(`${s.width}×${s.height} @ ${actualFps}FPS`);
                              } catch (e) {
                                // fallback: reconnect with new fps
                                await handleSelectCaptureCard(selectedCaptureCardId, videoResolution);
                              }
                            }
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all border ${
                          targetFps === fps
                            ? fps === 60
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                              : 'bg-indigo-600 text-white border-indigo-400 shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border-slate-700'
                        } disabled:opacity-60`}
                      >
                        {fps} FPS
                      </button>
                    ))}
                    {captureDetails && (
                      <span className="text-[10px] text-slate-500 font-mono mr-1">
                        (בפועל: {captureDetails.fps}fps)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <span>רזולוציה:</span>
                  </div>
                  {captureDetails && (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      captureDetails.width >= 3840
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : captureDetails.width >= 1920
                          ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40'
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    }`}>
                      {captureDetails.width}×{captureDetails.height} @ {captureDetails.fps}FPS
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={isApplyingResolution || isCaptureLoading}
                    onClick={() => handleForceCaptureResolution('4k')}
                    className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 border ${
                      captureDetails?.width && captureDetails.width >= 3840
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                        : 'bg-slate-800 text-amber-300 hover:text-white hover:bg-slate-700 border-amber-500/30'
                    } disabled:opacity-60`}
                  >
                    {isApplyingResolution && videoResolution === '4k' ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <span>⚡ כפה 4K</span>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isApplyingResolution || isCaptureLoading}
                    onClick={() => handleForceCaptureResolution('1080p')}
                    className={`py-2 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 border ${
                      captureDetails?.width && captureDetails.width >= 1920 && captureDetails.width < 3840
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border-slate-700'
                    } disabled:opacity-60`}
                  >
                    {isApplyingResolution && videoResolution === '1080p' ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <span>📺 כפה 1080p</span>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isCaptureLoading || isApplyingResolution}
                    onClick={() => handleSelectCaptureCard(selectedCaptureCardId, videoResolution)}
                    className="py-2 px-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 transition-all flex items-center justify-center gap-1 disabled:opacity-60"
                    title="אתחל מחדש את החיבור לכרטיס הלכידה"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCaptureLoading ? 'animate-spin' : ''}`} />
                    <span>אתחל צינור</span>
                  </button>

                  {/* Nuclear Option — kills FaceTime/Photo Booth, releases AVFoundation UVC lock */}
                  <button
                    type="button"
                    disabled={isCaptureLoading || isApplyingResolution}
                    onClick={handleReleaseCameraLock}
                    className="py-2 px-2 rounded-xl text-xs font-black bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-500/50 hover:border-rose-400 transition-all flex items-center justify-center gap-1 disabled:opacity-60 shadow-md"
                    title="שחרר נעילת AVFoundation — סוגר FaceTime ומאפשר ל-Elgato לעבוד ב-Full HD/4K"
                  >
                    {isApplyingResolution ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <span>🔓</span>
                    )}
                    <span>שחרר נעילה</span>
                  </button>
                </div>


                {/* 640x480 SD Lock Diagnostic Panel */}
                {captureDetails && captureDetails.width <= 640 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-b from-rose-950/80 to-slate-950 border border-rose-500/50 space-y-3 text-xs shadow-xl" dir="rtl">
                    <div className="flex items-center gap-2 text-rose-300 font-black text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>🔒 Elgato נעול על SD — אבחון מהיר</span>
                    </div>

                    {/* Live capabilities readout */}
                    {captureCapabilities && (
                      <div className="p-2.5 rounded-xl bg-black/60 border border-slate-700 space-y-1.5 font-mono text-[10px] text-left" dir="ltr">
                        <div className="text-slate-400 font-bold mb-1 text-right" dir="rtl">📊 מה Chrome מדווח על היכולות של המכשיר:</div>
                        <div className={`flex items-center justify-between ${((captureCapabilities as any).width?.max ?? 0) >= 1920 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          <span>width.max:</span>
                          <span className="font-black">{(captureCapabilities as any).width?.max ?? '?'}px {((captureCapabilities as any).width?.max ?? 0) >= 1920 ? '✅ HD capable' : '❌ LOCKED TO SD'}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>height.max:</span>
                          <span>{(captureCapabilities as any).height?.max ?? '?'}px</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span>frameRate.max:</span>
                          <span>{(captureCapabilities as any).frameRate?.max ?? '?'} FPS</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-400">
                          <span>deviceId:</span>
                          <span className="truncate max-w-[140px]">{(captureCapabilities as any).deviceId ?? '?'}</span>
                        </div>
                      </div>
                    )}

                    {/* Diagnosis and fix */}
                    <div className="space-y-2">
                      {captureCapabilities && ((captureCapabilities as any).width?.max ?? 0) < 1920 ? (
                        // Case 1: Chrome reports device is only capable of 640x480 → VDCAssistant locked
                        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-[11px] text-rose-200 space-y-1.5">
                          <p className="font-bold text-rose-300">🔴 VDCAssistant נועל את ה-Elgato</p>
                          <p className="leading-relaxed">ה-daemon של macOS (VDCAssistant) מדווח לדפדפן שהמכשיר תומך ב-640×480 בלבד. לחץ על <b>🔓 שחרר נעילה</b> — זה יאפס את VDCAssistant ויחדש את הסשן.</p>
                          <p className="text-rose-400/80 text-[10px]">אם 🔓 לא עוזר: נתק וחבר מחדש את כבל ה-USB של ה-Elgato.</p>
                        </div>
                      ) : (
                        // Case 2: Chrome reports HD capable but still returning 640×480 → constraint issue
                        <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200 space-y-1.5">
                          <p className="font-bold text-amber-300">🟡 Chrome יודע על HD אבל לא מספק</p>
                          <p className="leading-relaxed">Chrome מדווח שהמכשיר תומך ב-{(captureCapabilities as any).width?.max}px — הבעיה היא ב-constraints. לחץ על <b>⚡ כפה 4K</b> או <b>📺 כפה 1080p</b>.</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 text-[10px] text-slate-300 space-y-1">
                          <p className="font-bold text-slate-200">🔌 פתרון 1 — USB reset:</p>
                          <p className="leading-relaxed">נתק כבל USB מהמחשב → המתן 3 שניות → חבר → לחץ אתחל צינור</p>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-700 text-[10px] text-slate-300 space-y-1">
                          <p className="font-bold text-slate-200">💻 פתרון 2 — טרמינל:</p>
                          <code className="block text-emerald-400 leading-relaxed text-[9px] break-all">killall VDCAssistant</code>
                          <p className="text-slate-400">ואז לחץ אתחל צינור</p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowElgatoTroubleshooter(prev => !prev)}
                      className="w-full py-1.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition-all flex items-center justify-between"
                    >
                      <span>🛠️ בדיקות חומרה נוספות (HDCP / כבל USB):</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showElgatoTroubleshooter ? 'rotate-180' : ''}`} />
                    </button>

                    {showElgatoTroubleshooter && (
                      <div className="p-3 rounded-xl bg-black/60 border border-amber-500/30 space-y-2.5 text-[11px] text-slate-200 animate-in fade-in">
                        <div className="space-y-1">
                          <p className="font-bold text-amber-300 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-mono text-[10px] font-black">1</span>
                            <span>כיבוי HDCP בפלייסטיישן:</span>
                          </p>
                          <p className="text-slate-300 pr-5 leading-relaxed">
                            ב-PS5: כנס ל-<b>הגדרות (Settings) &gt; מערכת (System) &gt; HDMI &gt; הפעלת HDCP (Enable HDCP)</b> &larr; העבר ל-<b>כבוי (OFF)</b>.
                          </p>
                        </div>

                        <div className="space-y-1 pt-1.5 border-t border-slate-800">
                          <p className="font-bold text-amber-300 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-mono text-[10px] font-black">2</span>
                            <span>הגדרת רזולוציה ידנית וכיבוי 120Hz / VRR:</span>
                          </p>
                          <p className="text-slate-300 pr-5 leading-relaxed">
                            ב-PS5: כנס ל-<b>הגדרות &gt; מסך ווידאו &gt; פלט וידאו &gt; רזולוציה</b> &larr; בחר <b>2160p (4K)</b> או <b>1080p</b>.
                          </p>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isCaptureLoading || isApplyingResolution}
                            onClick={() => handleSelectCaptureCard(selectedCaptureCardId, videoResolution)}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isCaptureLoading ? 'animate-spin' : ''}`} />
                            <span>ביצעתי &larr; רענן חיבור אלגטו עכשיו</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {captureCardError && (
              <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">{captureCardError}</span>
                  <p className="text-[10px] text-rose-300">
                    וודא שתוכנה אחרת (כמו Elgato Camera Hub, 4K Capture Utility או OBS) אינה תופסת את הכרטיס במקביל.
                  </p>
                </div>
              </div>
            )}

            {/* Screen Capture Action Button (PC / Mac Gameplay fallback) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
              <label className="text-xs font-bold text-slate-300">חלופה: לכידת חלון משחק ישירות מהמחשב:</label>
              {isScreenCapturing ? (
                <button
                  type="button"
                  onClick={handleStopScreenCapture}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Square className="w-4 h-4" />
                  <span>⏹️ עצור לכידת מסך</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartScreenCapture}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 active:scale-95"
                >
                  <MonitorPlay className="w-4 h-4 text-purple-400" />
                  <span>🖥️ בחר חלון משחק / מסך מחשב ({videoResolution === '4k' ? '4K 60FPS' : 'FHD 60FPS'})</span>
                </button>
              )}
            </div>
          </div>

          {/* Card 1 Footer */}
          <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-200/90 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              {videoResolution === '4k'
                ? 'מצב 4K Ultra HD פעיל: ביטרייט מוקלט 45Mbps באיכות שיא ללא איבוד פרטים.'
                : 'מצב 1080p 60FPS: ביטרייט 12Mbps, איכות חלקה במיוחד.'}
            </span>
          </div>
        </div>

        {/* CARD 2: FACECAM MULTI-CAM & IPHONE */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#141226]/95 via-[#0e1222]/95 to-[#0b0e18]/95 border border-indigo-500/30 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">מצלמת פנים (Facecam)</h3>
                  <p className="text-[11px] text-slate-400">אייפון כ-Webcam / מצלמת רשת / אלחוטי</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRemoteModalOpen(true)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-1.5 rounded-xl border border-indigo-500/30 transition-all hover:bg-indigo-500/20"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>📱 סרוק QR לאייפון</span>
              </button>
            </div>

            {/* 1-Click Fast Connect for iPhone */}
            {(() => {
              const iphoneDev = videoDevices.find(v => v.isIPhone || v.isContinuity);
              const isIPhoneSelected = iphoneDev && selectedVideoId === iphoneDev.deviceId && !isUsingRemoteCam;

              if (iphoneDev) {
                return (
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-indigo-950/60 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-black text-emerald-200">
                          {isIPhoneSelected ? 'אייפון מחובר כ-Facecam' : 'זוהה אייפון במערכת!'}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-700">
                        {iphoneDev.label.slice(0, 22)}
                      </span>
                    </div>

                    {isIPhoneSelected ? (
                      <div className="text-[11px] text-emerald-300 flex items-center gap-1.5 font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>מצלמת האייפון פעילה באיכות צילום גבוהה (Continuity Camera).</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsUsingRemoteCam(false);
                          setFacecamError(null);
                          setSelectedVideoId(iphoneDev.deviceId);
                          try { localStorage.setItem('gaming_studio_preferred_camera', iphoneDev.deviceId); } catch {}
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>התחבר למצלמת ה-iPhone שלך בלחיצה אחת</span>
                      </button>
                    )}
                  </div>
                );
              }
              
              // iPhone Assistant when not yet detected
              return (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-black text-indigo-200">לא זוהה iPhone כמצלמה מקומית?</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowIPhoneGuide(prev => !prev)}
                      className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1 font-bold underline"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>{showIPhoneGuide ? 'סגור מדריך' : 'איך לחבר?'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRemoteModalOpen(true)}
                      className="py-2 px-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>סרוק קוד QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={refreshDevices}
                      className="py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                      <span>הער מצלמת המשכיות</span>
                    </button>
                  </div>

                  {showIPhoneGuide && (
                    <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 space-y-1.5 animate-in fade-in">
                      <p className="font-bold text-indigo-300">💡 3 דרכים פשוטות לחיבור האייפון:</p>
                      <div className="space-y-1 text-[10px] text-slate-400">
                        <p>1. 🔌 <b className="text-slate-200">כבל USB ישיר למק (מומלץ ביותר):</b> חבר בכבל, פתח את נעילת האייפון ולחץ על <span className="text-emerald-400">&quot;בטח במחשב זה&quot;</span>.</p>
                        <p>2. 📷 <b className="text-slate-200">סריקת QR:</b> פתח את המצלמה באייפון, סרוק את הקוד, אשר גישה והמצלמה משדרת מיד.</p>
                        <p>3. 📡 <b className="text-slate-200">Apple Continuity (אלחוטי):</b> וודא ש-Wi-Fi ו-Bluetooth דלוקים בשני המכשירים ומוגדרים על אותו Apple ID. הנח את האייפון לרוחב (Landscape).</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Camera Selector Dropdown */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">בחר מצלמה:</label>
                <button
                  type="button"
                  onClick={refreshDevices}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  title="רענן זיהוי מצלמות ואייפון"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>רענן זיהוי</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={isUsingRemoteCam ? 'remote-iphone' : selectedVideoId}
                  onChange={(e) => {
                    if (e.target.value === 'remote-iphone') {
                      setIsUsingRemoteCam(true);
                    } else {
                      setIsUsingRemoteCam(false);
                      setSelectedVideoId(e.target.value);
                    }
                  }}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  {(remoteStream || remoteFrame) && (
                    <option value="remote-iphone">📱 iPhone Remote Camera (חיבור WebRTC אלחוטי)</option>
                  )}
                  {videoDevices.some(v => (v.isIPhone || v.isContinuity) && v.deviceId !== selectedCaptureCardId) && (
                    <optgroup label="📱 אייפון כמצלמת רשת (Apple Continuity / Apps)">
                      {videoDevices
                        .filter(v => (v.isIPhone || v.isContinuity) && v.deviceId !== selectedCaptureCardId)
                        .map(v => (
                          <option key={v.deviceId} value={v.deviceId}>
                            📱 {v.label}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  <optgroup label="📹 מצלמות רשת נוספות">
                    {videoDevices
                      .filter(v => !v.isIPhone && !v.isContinuity && v.deviceId !== selectedCaptureCardId)
                      .map(v => (
                        <option key={v.deviceId} value={v.deviceId}>
                          {v.label}
                        </option>
                      ))}
                  </optgroup>
                </select>

                <button
                  type="button"
                  onClick={toggleCam}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isVideoMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                  title={isVideoMuted ? 'הפעל מצלמה' : 'הסתר מצלמת פנים'}
                >
                  {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Facecam Preview Monitor & Diagnostics */}
            <div className="relative rounded-2xl bg-slate-950 border border-indigo-500/30 overflow-hidden shadow-inner p-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${facecamStream && !isVideoMuted ? 'bg-emerald-400' : isFacecamInitializing ? 'bg-amber-400' : 'bg-rose-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${facecamStream && !isVideoMuted ? 'bg-emerald-500' : isFacecamInitializing ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                  </span>
                  <span className="font-bold text-slate-200">
                    מוניטור מצלמת פנים (Facecam Live)
                  </span>
                </div>
                {facecamDetails ? (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
                    {facecamDetails.width}x{facecamDetails.height} @ {facecamDetails.fps}fps
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">
                    {isFacecamInitializing ? 'מאתחל...' : isVideoMuted ? 'מושתק' : 'לא מחובר'}
                  </span>
                )}
              </div>

              {/* Miniature Video Screen */}
              <div className="relative w-full aspect-video bg-black/90 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                <video
                  ref={deckBPreviewRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isMirrored && !isUsingRemoteCam ? '-scale-x-100' : ''} ${(!facecamStream && !remoteStream) || isVideoMuted ? 'hidden' : ''}`}
                />
                {isUsingRemoteCam && remoteFrame && !remoteStream && !isVideoMuted && (
                  <img
                    src={remoteFrame}
                    alt="iPhone Cam"
                    className="w-full h-full object-cover"
                  />
                )}
                
                {((!facecamStream && !remoteStream && !remoteFrame) || isVideoMuted || isFacecamInitializing) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center bg-slate-950/85 backdrop-blur-sm">
                    {isFacecamInitializing ? (
                      <>
                        <RotateCw className="w-5 h-5 text-indigo-400 animate-spin" />
                        <span className="text-xs font-bold text-indigo-300">מתחבר ומאתחל חומרת מצלמה...</span>
                        <span className="text-[10px] text-slate-400">בודק רזולוציה ו-AVFoundation</span>
                      </>
                    ) : isVideoMuted ? (
                      <>
                        <VideoOff className="w-5 h-5 text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">המצלמה מושתקת/מוסתרת</span>
                        <button
                          type="button"
                          onClick={toggleCam}
                          className="mt-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold transition-all shadow"
                        >
                          הפעל מצלמה
                        </button>
                      </>
                    ) : facecamError ? (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <span className="text-xs font-bold text-rose-300">שגיאת מצלמה</span>
                        <span className="text-[10px] text-rose-400/90 leading-tight max-w-[220px]">{facecamError}</span>
                        <button
                          type="button"
                          onClick={handleReleaseFacecamLock}
                          className="mt-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition-all shadow"
                        >
                          🔓 שחרר נעילה ונסה שוב
                        </button>
                      </>
                    ) : (
                      <>
                        <Video className="w-5 h-5 text-slate-500" />
                        <span className="text-xs font-medium text-slate-400">אין וידאו פעיל</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Actions Footer */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleReleaseFacecamLock}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  title="משחרר תפיסת מצלמה של macOS AVFoundation ומאתחל אותה מחדש"
                >
                  <Unlock className="w-3 h-3 text-cyan-400" />
                  <span>🔓 שחרר נעילה / אתחל</span>
                </button>

                {videoDevices.some(v => v.label.toLowerCase().includes('facetime') || v.label.toLowerCase().includes('built-in')) && (
                  <button
                    type="button"
                    onClick={() => {
                      const macCam = videoDevices.find(v => v.label.toLowerCase().includes('facetime') || v.label.toLowerCase().includes('built-in'));
                      if (macCam) {
                        setIsUsingRemoteCam(false);
                        setSelectedVideoId(macCam.deviceId);
                      }
                    }}
                    className="py-1.5 px-2.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 text-[11px] font-bold border border-indigo-700/50 transition-all flex items-center justify-center gap-1"
                    title="מעבר מהיר למצלמת המק הפנימית (FaceTime HD)"
                  >
                    <span>💻 מצלמת מק</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsMirrored(m => !m)}
                  className={`py-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 ${
                    isMirrored ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="מראה / שיקוף מצלמה"
                >
                  <FlipHorizontal className="w-3 h-3" />
                  <span>שיקוף</span>
                </button>
              </div>
            </div>

            {/* Helpful tip about iPhone connection */}
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-bold">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span>איך לחבר את האייפון כמצלמה?</span>
              </div>
              <p className="leading-relaxed">
                1. <strong>כבל USB</strong>: חבר כבל ישירות למק (הכי יציב וללא השהייה).
                <br />
                2. <strong>אלחוטי (Continuity)</strong>: וודא ש-WiFi ו-Bluetooth דלוקים וקרב את האייפון למק.
                <br />
                3. <strong>קוד QR</strong>: לחץ על כפתור &quot;סרוק QR לאייפון&quot; להתחברות מדפדפן האייפון.
              </p>
            </div>

            {/* Facecam Shape & Extended Size Pickers */}
            <div className="space-y-3 pt-1 border-t border-slate-800/80">
              {/* Shape */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400">צורת מסגרת:</label>
                <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'circle', label: 'עיגול' },
                    { id: 'rounded', label: 'מעוגל' },
                    { id: 'rectangle', label: 'מלבן' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFacecamShape(s.id as any)}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                        facecamShape === s.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extended Size (XS to XL + Hidden) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400">גודל חלונית (XS-XL / מוסתר):</label>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold">{CAM_SIZES[camSize].label}</span>
                </div>
                <div className="grid grid-cols-6 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {(['hidden', 'xs', 'sm', 'md', 'lg', 'xl'] as CamSizeKey[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCamSize(s)}
                      className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
                        camSize === s ? 'bg-cyan-600 text-white shadow font-black scale-105' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {CAM_SIZES[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 9-Point Quick Position Anchors & Free Drag Mode Reset */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-400">מיקום קבוע / עוגן מהיר (9 נקודות):</label>
                  {camFreePos !== null && (
                    <button
                      type="button"
                      onClick={() => setCamFreePos(null)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline"
                    >
                      חזור למיקום עוגן
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1 w-36 mx-auto bg-slate-950 p-1 rounded-xl border border-slate-800 text-center">
                  {CAM_ANCHORS.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      title={a.title}
                      onClick={() => {
                        setCamAnchor(a.id);
                        setCamFreePos(null);
                      }}
                      className={`py-1 rounded-lg text-xs font-black transition-all ${
                        camFreePos === null && camAnchor === a.id
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 text-center leading-tight">
                  💡 ניתן גם לגרור את המצלמה באופן חופשי ישירות על גבי נגן ה-Preview!
                </p>
              </div>
            </div>

            {/* Facecam Aspect Ratio & Natural Proportions */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400">פרופורציות מצלמה (יחס תמונה):</label>
                <span className="text-[10px] text-emerald-400 font-medium">✨ ללא מריחה או מעיכה</span>
              </div>
              <div className="grid grid-cols-5 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                {[
                  { id: 'auto', label: 'טבעי ✨', desc: 'אוטומטי' },
                  { id: '16:9', label: '16:9', desc: 'רחב' },
                  { id: '4:3', label: '4:3', desc: 'קלאסי' },
                  { id: '1:1', label: '1:1', desc: 'ריבוע' },
                  { id: '9:16', label: '9:16', desc: 'אנכי' },
                ].map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setFacecamAspect(a.id as any)}
                    className={`py-1 text-center rounded-lg transition-colors ${
                      facecamAspect === a.id ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10px] font-bold leading-tight">{a.label}</div>
                    <div className="text-[8px] opacity-75">{a.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Gamer Glow Swatches */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>תאורת זוהר ניאון (Gamer Glow):</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={facecamGlowBlur}
                    onChange={(e) => setFacecamGlowBlur(parseInt(e.target.value, 10))}
                    className="w-16 accent-indigo-500 cursor-pointer h-1 bg-slate-800 rounded"
                  />
                  <span className="font-mono text-indigo-400 text-[11px]">{facecamGlowBlur}px</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {[
                  { color: '#06b6d4', name: 'ציאן' },
                  { color: '#a855f7', name: 'סגול' },
                  { color: '#ec4899', name: 'ורוד' },
                  { color: '#10b981', name: 'ירוק' },
                  { color: '#f59e0b', name: 'זהב' },
                  { color: '#ef4444', name: 'אדום' },
                  { color: 'transparent', name: 'ללא' }
                ].map(c => (
                  <button
                    key={c.color}
                    type="button"
                    onClick={() => setFacecamGlowColor(c.color)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      facecamGlowColor === c.color ? 'scale-125 border-white shadow-lg' : 'border-slate-700 hover:scale-110'
                    }`}
                    style={{ backgroundColor: c.color === 'transparent' ? '#1e293b' : c.color }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* GamerTag HUD Editor */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
            <input
              type="text"
              value={gamerTag}
              onChange={(e) => setGamerTag(e.target.value)}
              placeholder="כינוי סטרימר / GamerTag..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => setShowGamerHud(!showGamerHud)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                showGamerHud
                  ? 'bg-indigo-600/30 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {showGamerHud ? 'HUD דלוק' : 'HUD כבוי'}
            </button>
          </div>
        </div>

        {/* CARD 3: DUAL AUDIO MIXER & SOUND SEPARATION */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#141226]/95 via-[#0e1222]/95 to-[#0b0e18]/95 border border-teal-500/30 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-teal-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-600/20 text-teal-400 border border-teal-500/30">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">מיקסר סאונד והפרדת ערוצים</h3>
                  <p className="text-[11px] text-slate-400">מיקרופון נפרד + סאונד קונסולה מאלגטו</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMasterAudioReset}
                  className="px-2.5 py-1 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 hover:text-white border border-rose-700/50 text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  title="איפוס מוחלט של כל חיבורי השמע, שחרור נעילות חומרה, ומחיקת הגדרות ישנות"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                  <span>🔄 איפוס סאונד</span>
                </button>
                <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
                  Dual-Track
                </span>
              </div>
            </div>

            {/* CHANNEL 1: GAMER / STREAMER MICROPHONE (BROADCAST STUDIO DSP) */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Mic className="w-4 h-4 text-indigo-400" />
                  <span>ערוץ 1: מיקרופון שדרן (איכות אולפן HD)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-indigo-400">{Math.round(micGain * 100)}%</span>
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={`p-1.5 rounded-lg border text-xs ${
                      isAudioMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                    title={isAudioMuted ? 'בטל השתקה' : 'השתק מיקרופון'}
                  >
                    {isAudioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Mic Device Selector with Quick Refresh & Rename */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedAudioId}
                    onChange={(e) => {
                      setSelectedAudioId(e.target.value);
                      gamingMixerRef.current?.resume();
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-[11px] text-white focus:outline-none focus:border-indigo-500 truncate"
                  >
                    {audioDevices.map(a => {
                      const customName = deviceNicknames[a.deviceId];
                      const display = customName 
                        ? `🎙️ ${customName} (${a.label})` 
                        : `🎙️ ${a.label || 'מיקרופון'}`;
                      return (
                        <option key={a.deviceId} value={a.deviceId}>
                          {display}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const currentDev = audioDevices.find(a => a.deviceId === selectedAudioId);
                      handleRenameDevice(selectedAudioId, currentDev?.label || 'מיקרופון');
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 hover:text-white transition-all shrink-0"
                    title="שנה שם / כינוי מותאם אישית למיקרופון זה (למשל: 'מיקרופון ראשי')"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={refreshDevices}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all shrink-0"
                    title="סרוק וזהה מחדש מיקרופון שחובר זה עתה"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Studio Broadcast Vocal DSP & AI Noise Filter Toggles */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStudioVocalEnhance(!studioVocalEnhance);
                    gamingMixerRef.current?.resume();
                  }}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition-all ${
                    studioVocalEnhance
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="מעבד קול אולפני: סינון רעידות 80Hz, הבלטת נוכחות 3.8kHz וקומפרסור מונע צרימות"
                >
                  <span>🎙️ עיבוד אולפן (DSP): {studioVocalEnhance ? 'פעיל ✨' : 'כבוי'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMicNoiseSuppression(!micNoiseSuppression)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 transition-all ${
                    micNoiseSuppression
                      ? 'bg-teal-600/30 border-teal-500 text-teal-200 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="סינון רעשי רקע של חדר, מאווררים ומזגן"
                >
                  <span>🔇 סינון רעשים: {micNoiseSuppression ? 'פעיל' : 'כבוי'}</span>
                </button>
              </div>

              {/* Mic Slider + Real-Time Multi-color VU */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={micGain}
                  onChange={(e) => {
                    setMicGain(parseFloat(e.target.value));
                    gamingMixerRef.current?.resume();
                  }}
                  className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="w-24 h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-700/80" title="מד עוצמת מיקרופון">
                  <div
                    className={`h-full transition-all duration-75 ${
                      micAudioLevel > 80
                        ? 'bg-rose-500'
                        : micAudioLevel > 50
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, micAudioLevel)}%` }}
                  />
                </div>
              </div>

              {/* Pre-recording Mic Quality & Volume Live Headphone Monitoring (Sidetone) */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsMonitoringMic(prev => !prev);
                    gamingMixerRef.current?.resume();
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    isMonitoringMic
                      ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 shadow-md ring-1 ring-emerald-500/50'
                      : 'bg-slate-950/80 border-slate-700/70 text-slate-300 hover:text-white hover:border-slate-600'
                  }`}
                  title="האזנה עצמית חיה למיקרופון דרך האוזניות לבדיקת איכות, צלילות וקומפרסור לפני הקלטה"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span>{isMonitoringMic ? '🟢 האזנה חיה פעילה (בדיקת סאונד באוזניות)' : '🎧 האזנה חיה לבדיקת מיקרופון באוזניות'}</span>
                </button>

                {isMonitoringMic && (
                  <div className="p-2 rounded-xl bg-slate-950/90 border border-emerald-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-emerald-400 font-medium">🔊 עוצמת האזנה באוזניות:</span>
                      <span className="font-mono text-emerald-300 font-bold">{Math.round(micMonitorVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={micMonitorVolume}
                      onChange={(e) => {
                        setMicMonitorVolume(parseFloat(e.target.value));
                        gamingMixerRef.current?.resume();
                      }}
                      className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <div className="text-[10px] text-emerald-400/80 leading-tight">
                      💡 מומלץ להאזין עם אוזניות למניעת פידבק. אתה שומע את הסאונד בדיוק כפי שיוקלט (כולל DSP, קומפרסור וסינון רעשים).
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CHANNEL 2: GAME / CONSOLE AUDIO (ELGATO HDMI AUDIO - ALWAYS AUDIBLE & RECORDED) */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Gamepad2 className="w-4 h-4 text-purple-400" />
                  <span>ערוץ 2: סאונד קונסולה / אלגטו (HDMI Audio)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-purple-400">{Math.round(gameAudioVolume * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => {
                      setGameAudioVolume(prev => prev > 0 ? 0 : 1.0);
                      gamingMixerRef.current?.resume();
                    }}
                    className={`p-1.5 rounded-lg border text-xs ${
                      gameAudioVolume === 0 ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                    title={gameAudioVolume === 0 ? 'הפעל סאונד משחק' : 'השתק סאונד משחק'}
                  >
                    {gameAudioVolume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Automatic Monitoring Notice: Always live without requiring headphone checkbox */}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-[10px]">
                <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>שמע קונסולה חי: פועל אוטומטית ברמקולים/אוזניות ומוקלט לווידאו</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMonitorGameAudio(!monitorGameAudio);
                    gamingMixerRef.current?.resume();
                  }}
                  className={`text-[9px] font-bold px-2 py-0.5 rounded transition-all ${
                    monitorGameAudio
                      ? 'bg-emerald-800/60 text-emerald-200'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="שליטה על השמעת הסאונד החי ברמקולים או באוזניות המחשב"
                >
                  {monitorGameAudio ? 'השמעה פעילה' : 'השמעה מושתקת'}
                </button>
              </div>

              {/* Game Audio Device Selector (Captures HDMI audio from Elgato) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400 font-bold block">
                    מקור סאונד הקונסולה (Elgato HDMI / שמע מחשב):
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    gameAudioStream && gameAudioStream.getAudioTracks().length > 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {gameAudioStream && gameAudioStream.getAudioTracks().length > 0 ? '🟢 שמע קונסולה מחובר' : '⚠️ שמע קונסולה ממתין'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedGameAudioId}
                    onChange={(e) => {
                      setSelectedGameAudioId(e.target.value);
                      gamingMixerRef.current?.resume();
                    }}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-[11px] text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- אוטומטי (זוהה מלוכד מסך / אלגטו) --</option>
                    {audioDevices.map(a => {
                      const isElgatoAudio = a.isGameAudio ||
                        a.label.toLowerCase().includes('elgato') ||
                        a.label.toLowerCase().includes('cam link') ||
                        a.label.toLowerCase().includes('camlink') ||
                        a.label.toLowerCase().includes('capture') ||
                        a.label.toLowerCase().includes('hdmi') ||
                        a.label.toLowerCase().includes('game');
                      return (
                        <option key={a.deviceId} value={a.deviceId}>
                          {isElgatoAudio ? `🎮 ${a.label} (HDMI אלגטו)` : `🔊 ${a.label}`}
                        </option>
                      );
                    })}
                  </select>

                  {audioDevices.some(a => a.isGameAudio || a.label.toLowerCase().includes('elgato')) && (
                    <button
                      type="button"
                      onClick={() => {
                        const elgatoDev = audioDevices.find(a => a.isGameAudio || a.label.toLowerCase().includes('elgato'));
                        if (elgatoDev) {
                          setSelectedGameAudioId(elgatoDev.deviceId);
                          gamingMixerRef.current?.resume();
                        }
                      }}
                      className="px-2 py-1.5 rounded-lg bg-purple-950/70 hover:bg-purple-900 text-purple-300 hover:text-white text-[10px] font-bold border border-purple-700/50 transition-all shrink-0"
                      title="חיבור מיידי לערוץ שמע Elgato שנמצא"
                    >
                      🎮 חבר Elgato
                    </button>
                  )}
                </div>
              </div>

              {/* Game Audio Slider + Real-Time VU */}
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={gameAudioVolume}
                  onChange={(e) => {
                    setGameAudioVolume(parseFloat(e.target.value));
                    gamingMixerRef.current?.resume();
                  }}
                  className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="w-24 h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-700/80" title="מד עוצמת סאונד משחק">
                  <div
                    className={`h-full transition-all duration-75 ${
                      gameAudioLevel > 80
                        ? 'bg-rose-500'
                        : gameAudioLevel > 50
                        ? 'bg-amber-400'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500'
                    }`}
                    style={{ width: `${Math.min(100, gameAudioLevel)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* CHANNEL 3: EMERGENCY / BACKUP MICROPHONE (HOT-SWAP / RESCUE STEM) */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-3 relative overflow-hidden shadow-lg shadow-amber-950/20">
              {/* Header with Enable Switch & Emergency Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>ערוץ 3: מיקרופון גיבוי לחירום (Backup Mic)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBackupMicEnabled(!isBackupMicEnabled);
                      gamingMixerRef.current?.resume();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                      isBackupMicEnabled
                        ? 'bg-amber-600/30 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isBackupMicEnabled ? 'פעיל ✅' : '+ חבר מיקרופון חירום'}
                  </button>
                </div>
              </div>

              {isBackupMicEnabled ? (
                <>
                  {/* Emergency Status & 1-Click Hot-Swap Button */}
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="relative flex h-2 w-2">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                            isHotSwapped ? 'bg-rose-400' : 'bg-amber-400'
                          }`}></span>
                          <span className={`relative inline-flex rounded-full h-2 w-2 ${
                            isHotSwapped ? 'bg-rose-500' : 'bg-amber-500'
                          }`}></span>
                        </span>
                        <span className="font-bold text-white">
                          {isHotSwapped 
                            ? '🚨 מיקרופון החירום פעיל כעת כראשי!' 
                            : backupMicMode === 'active' 
                            ? '🎙️ פעיל במיקס השידור' 
                            : '🛡️ בכוננות חמה (מוקלט מבודד / שקט במיקס)'}
                        </span>
                      </div>

                      {/* Hot-Swap Action Button */}
                      {!isHotSwapped ? (
                        <button
                          type="button"
                          onClick={handleEmergencyHotSwap}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] shadow-md shadow-rose-900/40 active:scale-95 transition-all flex items-center gap-1"
                          title="השתק מיד את המיקרופון הראשי והעבר למיקרופון חירום זה"
                        >
                          <Zap className="w-3 h-3 text-amber-300" />
                          <span>🚨 החלף לחירום עכשיו!</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRestorePrimaryMic}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] shadow active:scale-95 transition-all flex items-center gap-1"
                          title="החזר את המיקרופון הראשי לפעילות"
                        >
                          <RotateCcw className="w-3 h-3 text-indigo-300" />
                          <span>החזר מיקרופון ראשי</span>
                        </button>
                      )}
                    </div>

                    {/* Mode Switcher: Standby vs Active In-Mix */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBackupMicMode('standby');
                          gamingMixerRef.current?.resume();
                        }}
                        className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                          backupMicMode === 'standby' && !isHotSwapped
                            ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="דוגם שמע ב-VU ושומר ערוץ גיבוי נפרד, אך מושתק מהמיקס למניעת הד כפול"
                      >
                        🛡️ כוננות שקטה (מוקלט בנפרד)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBackupMicMode('active');
                          gamingMixerRef.current?.resume();
                        }}
                        className={`py-1 px-2 rounded-lg text-[10px] font-bold border transition-all ${
                          backupMicMode === 'active' || isHotSwapped
                            ? 'bg-amber-600/30 border-amber-500 text-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="משולב ישירות במיקס השידור והווידאו (מתאים גם לאורח נוסף / פרשן)"
                      >
                        🎙️ פעיל במיקס (מושמע בווידאו)
                      </button>
                    </div>
                  </div>

                  {/* Backup Mic Device Selector */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-slate-400 font-bold block">
                        בחר התקן מיקרופון גיבוי (MacBook Mic / AirPods / אוזניות USB):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const currentDev = audioDevices.find(a => a.deviceId === selectedBackupAudioId);
                            if (selectedBackupAudioId) {
                              handleRenameDevice(selectedBackupAudioId, currentDev?.label || 'מיקרופון גיבוי');
                            } else {
                              alert('בחר תחילה מיקרופון ספציפי כדי לשנות את שמו');
                            }
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
                          title="שנה שם מותאם אישית למיקרופון גיבוי זה"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>שנה שם</span>
                        </button>
                        <button
                          type="button"
                          onClick={refreshDevices}
                          className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold"
                          title="סרוק מחדש התקני שמע"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>רענן</span>
                        </button>
                      </div>
                    </div>
                    <select
                      value={selectedBackupAudioId}
                      onChange={(e) => {
                        setSelectedBackupAudioId(e.target.value);
                        gamingMixerRef.current?.resume();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-[11px] text-white focus:outline-none focus:border-amber-500 truncate"
                    >
                      <option value="">-- אוטומטי (מיקרופון משני זמין) --</option>
                      {audioDevices.map(a => {
                        const isPrimary = a.deviceId === selectedAudioId;
                        const customName = deviceNicknames[a.deviceId];
                        const display = customName 
                          ? `${customName} (${a.label})` 
                          : (a.label || 'מיקרופון');
                        return (
                          <option key={a.deviceId} value={a.deviceId}>
                            {isPrimary ? `⚠️ ${display} (בשימוש כראשי)` : `🎙️ ${display}`}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[9px] text-amber-300/80 leading-relaxed pt-0.5">
                      💡 מיקרופון דש ב-USB-C לא מופיע? שקעי USB-C בחלק מתחנות העגינה מיועדים להטענה בלבד (PD). חבר אותו ישירות לשקע ה-USB-C של המקבוק.
                    </p>
                  </div>

                  {/* Volume Slider + Real-Time Multi-color VU for Backup Mic */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">עוצמת שמע מיקרופון גיבוי:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400">{Math.round(backupMicGain * 100)}%</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsBackupAudioMuted(!isBackupAudioMuted);
                            gamingMixerRef.current?.resume();
                          }}
                          className={`p-1 rounded text-xs ${
                            isBackupAudioMuted ? 'text-rose-400 bg-rose-950/40' : 'text-slate-400 hover:text-white'
                          }`}
                          title={isBackupAudioMuted ? 'בטל השתקת גיבוי' : 'השתק גיבוי'}
                        >
                          {isBackupAudioMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={backupMicGain}
                        onChange={(e) => {
                          setBackupMicGain(parseFloat(e.target.value));
                          gamingMixerRef.current?.resume();
                        }}
                        className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                      />
                      <div className="w-24 h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-700/80" title="מד עוצמת מיקרופון חירום">
                        <div
                          className={`h-full transition-all duration-75 ${
                            backupMicAudioLevel > 80
                              ? 'bg-rose-500'
                              : backupMicAudioLevel > 50
                              ? 'bg-amber-400'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                          }`}
                          style={{ width: `${Math.min(100, backupMicAudioLevel)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-1.5">
                  <p className="text-[11px] text-slate-400">
                    חבר מיקרופון משני (כמו המיקרופון המובנה של המק, AirPods או אוזניות) שישמש כרשת ביטחון במקרה של תקלה.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBackupMicEnabled(true);
                      gamingMixerRef.current?.resume();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>הפעל מיקרופון חירום לגיבוי</span>
                  </button>
                </div>
              )}
            </div>

            {/* SEPARATION & WORKFLOW CONTROLS */}
            <div className="p-3 rounded-2xl bg-teal-950/30 border border-teal-800/40 space-y-2">
              <div className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-teal-400" />
                <span>הגדרות הפרדת ערוצים להקלטה ועריכה:</span>
              </div>

              {/* Mode: Mixed Stereo vs Split L/R Dual Mono */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSplitChannels(false)}
                  className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                    !splitChannels
                      ? 'bg-teal-600 border-teal-500 text-white shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>סטריאו מעורב</span>
                  <p className="text-[9px] font-normal opacity-80 mt-0.5">מיקרופון + משחק יחד</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSplitChannels(true)}
                  className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                    splitChannels
                      ? 'bg-teal-600 border-teal-500 text-white shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>פיצול L/R (מומלץ לעריכה)</span>
                  <p className="text-[9px] font-normal opacity-80 mt-0.5">שמאל: מיק, ימין: משחק</p>
                </button>
              </div>

              {/* Stems recording checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={separateStems}
                  onChange={(e) => setSeparateStems(e.target.checked)}
                  className="rounded border-slate-700 text-teal-500 focus:ring-teal-500/20 bg-slate-900"
                />
                <span className="text-[11px] text-teal-200 font-medium">
                  שמור ערוצי סאונד מבודדים (הורדת מיקרופון נקי + סאונד משחק נקי)
                </span>
              </label>
            </div>
          </div>

          {/* Noise Suppression & Hardware Refresh */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setNoiseSuppression(!noiseSuppression)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                noiseSuppression
                  ? 'bg-teal-600/20 border-teal-500/40 text-teal-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>סינון רעשי רקע: {noiseSuppression ? 'מופעל' : 'כבוי'}</span>
            </button>

            <button
              type="button"
              onClick={refreshDevices}
              className="text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/80 transition-all hover:bg-slate-800"
              title="רענן התקנים"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>רענן התקנים</span>
            </button>
          </div>
        </div>

      </div>

      {/* TWO ADDITIONAL CONTROL DECKS: STUDIO TIMER & OVERLAY SYSTEM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
        {/* DECK A: PRE-BROADCAST STARTING SOON COUNTDOWN */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#141226]/95 via-[#0e1222]/95 to-[#0b0e18]/95 border border-purple-500/30 shadow-xl space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">ספירה לאחור לתחילת שידור</h3>
                <p className="text-[11px] text-slate-400">טיימר Starting Soon לפני שההקלטה/השידור מתחילים</p>
              </div>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              isPreBroadcastCounting
                ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse'
                : preBroadcastDelay > 0
                ? 'bg-purple-950/60 text-purple-300 border-purple-800'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}>
              {isPreBroadcastCounting
                ? `סופר: ${formatCountdownDisplay(preBroadcastSecondsRemaining)}`
                : preBroadcastDelay === 0
                ? 'מידי (ללא המתנה)'
                : `השהיה: ${formatCountdownDisplay(preBroadcastDelay)}`}
            </span>
          </div>

          <div className="space-y-4">
            {/* Quick Delay Presets */}
            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-2">
                בחר זמן ספירה לאחור לפני תחילת השידור:
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
                {[
                  { sec: 0, label: '⚡ מידי' },
                  { sec: 3, label: '3 שנ\'' },
                  { sec: 5, label: '5 שנ\'' },
                  { sec: 10, label: '10 שנ\'' },
                  { sec: 30, label: '30 שנ\'' },
                  { sec: 60, label: '1 דק\'' },
                  { sec: 180, label: '3 דק\'' },
                  { sec: 300, label: '5 דק\'' },
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => {
                      setPreBroadcastDelay(item.sec);
                      if (isPreBroadcastCounting) cancelPreBroadcastCountdown();
                    }}
                    className={`py-2 px-1.5 rounded-xl text-center text-xs font-bold transition-all ${
                      preBroadcastDelay === item.sec
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/60 font-black border border-purple-400/40'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Delay Input */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
              <div>
                <span className="font-bold text-white block">זמן ספירה מותאם אישית</span>
                <span className="text-[11px] text-slate-400">הזן דקות ושניות (למשל 02:00)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customCountdownInput}
                  onChange={(e) => setCustomCountdownInput(e.target.value)}
                  placeholder="03:00"
                  className="w-20 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-center font-mono font-bold text-cyan-300 text-xs focus:border-purple-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parts = customCountdownInput.trim().split(':');
                    let secs = 0;
                    if (parts.length === 2) {
                      secs = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
                    } else {
                      secs = parseInt(customCountdownInput, 10) || 0;
                    }
                    if (secs > 0) {
                      setPreBroadcastDelay(secs);
                      if (isPreBroadcastCounting) cancelPreBroadcastCountdown();
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white font-bold text-xs transition-all border border-purple-500/40"
                >
                  החל
                </button>
              </div>
            </div>

            {/* Audio beeps toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                {enableCountdownBeeps ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                <div>
                  <span className="font-bold text-white block">צלילי ביפ בספירה (3, 2, 1)</span>
                  <span className="text-[11px] text-slate-400">משמיע צפצוף הכנה בשניות האחרונות</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnableCountdownBeeps(!enableCountdownBeeps)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  enableCountdownBeeps
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {enableCountdownBeeps ? 'מופעל' : 'כבוי'}
              </button>
            </div>

            {/* Live Countdown Status / Action Buttons */}
            {isPreBroadcastCounting ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-rose-950/80 border border-rose-500/40 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                    <span className="text-xs font-bold text-white">ספירה פעילה לקראת שידור!</span>
                  </div>
                  <span className="font-mono text-xl font-black text-cyan-300 tabular-nums">
                    {formatCountdownDisplay(preBroadcastSecondsRemaining)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleMasterRecordClick}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>התחל עכשיו (דלג)</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelPreBroadcastCountdown}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-rose-950/50 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 font-bold text-xs transition-all border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>ביטול</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-xs">
                <span className="text-[11px] text-slate-300">
                  {preBroadcastDelay === 0
                    ? '⚡ ההקלטה תתחיל מיד בלחיצה על כפתור ההקלטה'
                    : `⏳ בלחיצה על 'התחל שידור', תחל ספירה של ${formatCountdownDisplay(preBroadcastDelay)}`}
                </span>
                {preBroadcastDelay > 0 && (
                  <button
                    type="button"
                    onClick={() => startPreBroadcastCountdown(preBroadcastDelay)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white font-bold text-xs transition-all border border-purple-500/40 flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>הפעל בדיקה</span>
                  </button>
                )}
              </div>
            )}

            {/* Collapsible Sub-Option: In-Stream Stopwatch */}
            <div className="pt-2 border-t border-purple-500/10">
              <button
                type="button"
                onClick={() => setShowInStreamStopwatch(!showInStreamStopwatch)}
                className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-200 py-1 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-purple-400" />
                  <span>שעון עצר נוסף על גבי המסך תוך כדי שידור (אופציונלי)</span>
                </div>
                {showInStreamStopwatch ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              {showInStreamStopwatch && (
                <div className="mt-2.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {[
                      { id: 'off', label: 'ללא שעון' },
                      { id: 'stopwatch', label: '⏱️ ספירה קדימה' },
                      { id: 'countdown', label: '⏳ ספירה לאחור' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setTimerMode(m.id as any);
                          resetTimer();
                        }}
                        className={`py-1.5 px-2 rounded-lg text-center text-xs font-bold transition-all ${
                          timerMode === m.id
                            ? 'bg-purple-600 text-white shadow font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {timerMode !== 'off' && (
                    <div className="flex items-center gap-2">
                      {!timerRunning ? (
                        <button
                          type="button"
                          onClick={startTimer}
                          className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>הפעל שעון</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={pauseTimer}
                          className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>השהה</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={resetTimer}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>איפוס</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DECK B: SIMPLIFIED OVERLAY & VISUAL ELEMENTS SYSTEM */}
        <SimpleOverlayManager
          overlays={overlays}
          setOverlays={setOverlays}
          isEditMode={isOverlayEditMode}
          setIsEditMode={setIsOverlayEditMode}
          editingOverlayId={editingOverlayId}
          setEditingOverlayId={setEditingOverlayId}
          onAddOverlay={addOverlay}
          onRemoveOverlay={removeOverlay}
          onToggleVisible={toggleOverlayVisible}
          onUpdateConfig={updateOverlayConfig}
          onUpdatePosition={updateOverlayPosition}
        />
      </div>

      {/* iPhone RemoteCam WebRTC Modal */}
      <RemoteCamModal
        roomId={`castflow-${episode.id}`}
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        onSelectRemoteStream={() => setIsUsingRemoteCam(true)}
        connectionStatus={remoteConnectionStatus}
      />
    </div>
  );
}
