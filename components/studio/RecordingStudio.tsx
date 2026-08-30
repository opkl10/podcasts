'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Episode, TimestampMarker, AudioInputDevice, VideoInputDevice, TopicItem, LiveOverlayState, SubtitleItem, MovieFactCard } from '@/lib/types';
import { getMediaDevices, StudioAudioProcessor, getVideoConstraints, VideoResolution } from '@/lib/mediaManager';
import { StudioWebRTCReceiver } from '@/lib/webrtcClient';
import { saveMediaBlob, getMediaBlob, deleteMediaBlob, saveEpisode, formatTime, getPermanentLogo, getAudioStageConfig, saveAudioStageConfig, AudioStageConfig } from '@/lib/storage';
import RemoteCamModal from './RemoteCamModal';
import PostRecordingReview from './PostRecordingReview';
import LiveBroadcastDeck from './LiveBroadcastDeck';
import DraggableOverlay from './DraggableOverlay';
import GiantStudioClock from './GiantStudioClock';
import CloudIntegrationsModal from '@/components/dashboard/CloudIntegrationsModal';
import MovieFactPrompterCockpit from './MovieFactPrompterCockpit';
import StudioHardwareDiagnosticsModal from './StudioHardwareDiagnosticsModal';
import GuestInviteModal from './GuestInviteModal';
import AudioStageBackgroundModal, { AUDIO_STAGE_PRESETS, WAVEFORM_GRADIENT_PRESETS } from './AudioStageBackgroundModal';
import { StudioClockBroadcaster } from '@/lib/clockSync';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Headphones,
  Smartphone, 
  Settings, 
  Clock, 
  Square, 
  Play, 
  Pause, 
  Bookmark, 
  Scissors, 
  Sparkles, 
  HelpCircle, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Maximize2, 
  Minimize2, 
  ArrowRight, 
  Layers, 
  Sliders,
  AlertTriangle,
  RotateCw,
  Plus,
  Tv,
  Volume2,
  Wand2,
  Focus,
  Star,
  Quote,
  Image as ImageIcon,
  Users,
  Flame,
  ShieldCheck,
  Zap,
  Film,
  Radio,
  Activity,
  Palette
} from 'lucide-react';

interface RecordingStudioProps {
  episode: Episode;
}

export default function RecordingStudio({ episode }: RecordingStudioProps) {
  // Device & Stream States
  const [audioDevices, setAudioDevices] = useState<AudioInputDevice[]>([]);
  const [videoDevices, setVideoDevices] = useState<VideoInputDevice[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [audioChannelMode, setAudioChannelMode] = useState<'stereo' | 'mono'>('stereo');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteFrame, setRemoteFrame] = useState<string | null>(null);
  const [isUsingRemoteCam, setIsUsingRemoteCam] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);

  // Audio DSP: Gain & Noise Suppression
  const [micGain, setMicGain] = useState<number>(1.0); // 100% default
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(true); // DSP Noise filter ON
  const audioProcessorRef = useRef<StudioAudioProcessor | null>(null);

  // Video Cinematic Effects: Depth of Field (Bokeh)
  const [depthOfField, setDepthOfField] = useState<boolean>(false);
  const [dofIntensity, setDofIntensity] = useState<'subtle' | 'cinematic' | 'heavy'>('cinematic');

  // Live Broadcast Graphic Overlays State with Custom Transforms (Drag & Resize)
  const [overlayState, setOverlayState] = useState<LiveOverlayState>({
    isLayoutEditMode: false,
    poster: {
      show: false,
      url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80',
      title: episode.title,
      caption: 'סרט מופת / ניתוח מיוחד',
      transform: { x: 70, y: 15, scale: 1.0 }
    },
    quote: {
      show: false,
      text: '״אסור לך לפחד לחלום קצת יותר בגדול...״',
      speaker: 'אימס (Inception)',
      transform: { x: 18, y: 68, scale: 1.0 }
    },
    rating: {
      show: false,
      imdb: '8.8',
      rottenTomatoes: '94%',
      personalScore: '9.0/10',
      transform: { x: 74, y: 10, scale: 1.0 }
    },
    customBanner: {
      show: false,
      title: episode.title,
      subtitle: 'ניתוח קולנועי מיוחד',
      transform: { x: 48, y: 74, scale: 1.0 }
    },
    spoilerAlert: {
      show: false,
      text: 'זהירות: ספוילרים קריטיים לעלילה!',
      transform: { x: 28, y: 4, scale: 1.0 }
    },
    logo: {
      show: true,
      url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&q=80',
      opacity: 0.9,
      positionPreset: 'top-right',
      size: 64,
      transform: { x: 88, y: 5, scale: 1.0 }
    },
    factCard: {
      show: false,
      fact: episode.movieFacts && episode.movieFacts.length > 0 ? episode.movieFacts[0] : null,
      transform: { x: 20, y: 72, scale: 1.0 }
    }
  });

  // Audio VU Meter States
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isClipping, setIsClipping] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Video & Audio toggles
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [videoResolution, setVideoResolution] = useState<VideoResolution>('1080p');
  const [isMirrored, setIsMirrored] = useState(true);
  const [showLowerThird, setShowLowerThird] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Recording State & Timers
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [activeTopicIndex, setActiveTopicIndex] = useState(0);
  const [activeTopicSeconds, setActiveTopicSeconds] = useState(0);
  const [markers, setMarkers] = useState<TimestampMarker[]>([]);
  const [customMarkerText, setCustomMarkerText] = useState('');
  const [streamSpecs, setStreamSpecs] = useState<{ width?: number; height?: number; frameRate?: number; sampleRate?: number }>({});
  const [prompterTab, setPrompterTab] = useState<'topics' | 'facts'>('topics');
  const processedStreamRef = useRef<MediaStream | null>(null);

  // Audio-Only & Multi-Screen States
  const isAudioOnly = episode.mediaType === 'audio_only';
  const [secondScreenAvailable, setSecondScreenAvailable] = useState(false);
  const [secondScreenAutoLaunched, setSecondScreenAutoLaunched] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const audioSpectrumCanvasRef = useRef<HTMLCanvasElement>(null);

  // Remote WebRTC iPhone Room
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [remoteConnectionStatus, setRemoteConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const webrtcReceiverRef = useRef<StudioWebRTCReceiver | null>(null);

  // Remote Guest Studio States & Receiver
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [guestConnectionStatus, setGuestConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [guestInfo, setGuestInfo] = useState<{ name: string; role?: string } | undefined>(
    episode.guest ? { name: episode.guest.name, role: episode.guest.role } : undefined
  );
  const [guestLayout, setGuestLayout] = useState<'split' | 'pip' | 'host' | 'guest'>('split');
  const [guestVolume, setGuestVolume] = useState<number>(1.0);
  const [guestStream, setGuestStream] = useState<MediaStream | null>(null);
  const guestReceiverRef = useRef<StudioWebRTCReceiver | null>(null);
  const guestVideoRef = useRef<HTMLVideoElement | null>(null);
  const [guestFrame, setGuestFrame] = useState<string | null>(null);

  const videoElementRef = useRef<HTMLVideoElement>(null);
  const studioContainerRef = useRef<HTMLDivElement>(null);

  // Active topic & Movie Facts
  const topics = episode.topics;
  const currentTopic = topics[activeTopicIndex] || topics[0];
  const movieFacts = episode.movieFacts || [];

  // Audio-Only Videocast Stage Customizer State
  const [audioStageConfig, setAudioStageConfig] = useState<AudioStageConfig>(() => getAudioStageConfig(episode.podcastId));
  const [isAudioStageModalOpen, setIsAudioStageModalOpen] = useState(false);

  // Load Permanent Logo & Audio Stage Configuration on mount
  useEffect(() => {
    const permanentLogo = getPermanentLogo(episode.podcastId);
    if (permanentLogo && permanentLogo.url) {
      setOverlayState(prev => ({
        ...prev,
        logo: {
          show: permanentLogo.showByDefault !== undefined ? permanentLogo.showByDefault : true,
          url: permanentLogo.url,
          opacity: permanentLogo.opacity ?? 0.9,
          positionPreset: permanentLogo.positionPreset ?? 'top-right',
          size: permanentLogo.size ?? 64,
          transform: permanentLogo.transform || { x: 88, y: 5, scale: 1.0 }
        }
      }));
    }

    const savedAudioStage = getAudioStageConfig(episode.podcastId);
    if (savedAudioStage) {
      setAudioStageConfig(savedAudioStage);
    }
  }, [episode.podcastId]);

  // Setup Remote Guest WebRTC Receiver & Frame Fallback
  useEffect(() => {
    const guestRoomId = `guest_${episode.id}`;
    let frameTimer: NodeJS.Timeout;

    const startGuestReceiver = () => {
      if (guestReceiverRef.current) return;

      guestReceiverRef.current = new StudioWebRTCReceiver(
        guestRoomId,
        (stream) => {
          setGuestStream(stream);
          setGuestConnectionStatus('connected');
          if (guestVideoRef.current) {
            guestVideoRef.current.srcObject = stream;
          }
        },
        (status) => {
          setGuestConnectionStatus(status === 'disconnected' ? 'error' : status);
        }
      );
      guestReceiverRef.current.start();
    };

    startGuestReceiver();

    // Frame Polling Fallback & Guest Info Sync
    frameTimer = setInterval(async () => {
      try {
        const res = await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pull-frame', roomId: guestRoomId })
        });
        const json = await res.json();
        if (json.isFresh && json.frame) {
          setGuestFrame(json.frame);
          setGuestConnectionStatus('connected');
        }
      } catch {}
    }, 1500);

    return () => {
      if (guestReceiverRef.current) guestReceiverRef.current.stop();
      if (frameTimer) clearInterval(frameTimer);
    };
  }, [episode.id]);

  // Multi-Monitor Second Screen Detection & Auto-Launch
  useEffect(() => {
    let checkTimer: NodeJS.Timeout;

    const detectAndLaunchSecondScreen = async () => {
      try {
        if (typeof window === 'undefined') return;
        const isExtended = (window.screen as any)?.isExtended || (window.screen as any)?.availLeft !== 0 || window.screen.availWidth > 2000;
        
        if (isExtended) {
          setSecondScreenAvailable(true);

          if (!secondScreenAutoLaunched) {
            let targetLeft = window.screen.availWidth || 1920;
            let targetTop = 0;
            let targetWidth = 1920;
            let targetHeight = 1080;

            if ('getScreenDetails' in window) {
              try {
                // @ts-ignore
                const details = await (window as any).getScreenDetails();
                if (details?.screens?.length > 1) {
                  const secondScreen = details.screens.find((s: any) => !s.isPrimary) || details.screens[1];
                  if (secondScreen) {
                    targetLeft = secondScreen.availLeft;
                    targetTop = secondScreen.availTop;
                    targetWidth = secondScreen.availWidth;
                    targetHeight = secondScreen.availHeight;
                  }
                }
              } catch {}
            }

            const win = window.open(
              `/episodes/${episode.id}/clock?autolaunch=true`,
              `StudioClock_${episode.id}`,
              `left=${targetLeft},top=${targetTop},width=${targetWidth},height=${targetHeight},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
            );

            if (win) {
              setSecondScreenAutoLaunched(true);
            }
          }
        }
      } catch (e) {
        console.log('Screen detection error:', e);
      }
    };

    checkTimer = setTimeout(() => {
      detectAndLaunchSecondScreen();
    }, 800);

    return () => clearTimeout(checkTimer);
  }, [episode.id, secondScreenAutoLaunched]);

  const launchSecondScreenClockManually = async () => {
    let targetLeft = window.screen.availWidth || 1920;
    let targetTop = 0;
    let targetWidth = 1920;
    let targetHeight = 1080;

    if ('getScreenDetails' in window) {
      try {
        // @ts-ignore
        const details = await (window as any).getScreenDetails();
        if (details?.screens?.length > 1) {
          const secondScreen = details.screens.find((s: any) => !s.isPrimary) || details.screens[1];
          if (secondScreen) {
            targetLeft = secondScreen.availLeft;
            targetTop = secondScreen.availTop;
            targetWidth = secondScreen.availWidth;
            targetHeight = secondScreen.availHeight;
          }
        }
      } catch {}
    }

    window.open(
      `/episodes/${episode.id}/clock?autolaunch=true`,
      `StudioClock_${episode.id}`,
      `left=${targetLeft},top=${targetTop},width=${targetWidth},height=${targetHeight},menubar=no,toolbar=no,location=no,status=no,resizable=yes`
    );
    setSecondScreenAutoLaunched(true);
  };

  // 1. Initial Device Discovery
  useEffect(() => {
    let mounted = true;

    async function initDevices() {
      const { audioInputs, videoInputs } = await getMediaDevices();
      if (!mounted) return;

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // Prefer iPhone / Continuity Camera if available
      const iPhoneCam = videoInputs.find(v => v.isIPhone || v.isContinuity);
      if (iPhoneCam) {
        setSelectedVideoId(iPhoneCam.deviceId);
      } else if (videoInputs.length > 0) {
        setSelectedVideoId(videoInputs[0].deviceId);
      }

      if (audioInputs.length > 0) {
        setSelectedAudioId(audioInputs[0].deviceId);
      }
    }

    initDevices();

    // Start WebRTC Receiver & Frame Streamer for Remote iPhone Camera (only if video mode)
    const roomId = `castflow-${episode.id}`;
    let framePollInterval: NodeJS.Timeout | null = null;

    if (!isAudioOnly) {
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
          }
        } catch (e) {}
      }, 150);
    }

    return () => {
      mounted = false;
      if (webrtcReceiverRef.current) {
        webrtcReceiverRef.current.stop();
      }
      if (framePollInterval) {
        clearInterval(framePollInterval);
      }
    };
  }, [episode.id, isAudioOnly]);

  // 2. Start/Switch Media Stream with Independent Video & Audio Pipelines
  useEffect(() => {
    let streamInstance: MediaStream | null = null;
    let isCancelled = false;

    async function startMedia() {
      setIsMediaLoading(true);

      if (isUsingRemoteCam && remoteStream) {
        if (currentStream) {
          currentStream.getTracks().forEach(t => t.stop());
        }
        setCurrentStream(remoteStream);
        if (videoElementRef.current) {
          videoElementRef.current.srcObject = remoteStream;
          videoElementRef.current.muted = true;
          videoElementRef.current.play().catch(e => console.log('play error:', e));
        }
        setupAudioProcessor(remoteStream);
        setIsMediaLoading(false);
        return;
      }

      try {
        if (currentStream) {
          currentStream.getTracks().forEach(t => t.stop());
        }

        // 1. Acquire Video Stream (only if not audio only)
        let videoTrack: MediaStreamTrack | null = null;
        if (!isAudioOnly) {
          try {
            const vConstraints = getVideoConstraints(videoResolution, selectedVideoId);
            const vStream = await navigator.mediaDevices.getUserMedia({
              video: vConstraints,
              audio: false
            });
            videoTrack = vStream.getVideoTracks()[0] || null;
          } catch (vErr) {
            console.warn('Failed to get video with selected ID/resolution, trying default:', vErr);
            try {
              const fallbackVStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
              videoTrack = fallbackVStream.getVideoTracks()[0] || null;
            } catch (vErr2) {
              console.error('No video device could be opened:', vErr2);
            }
          }
        }

        // 2. Acquire Audio Stream (Studio broadcast constraints: 48kHz, stereo/mono selectable)
        let audioTrack: MediaStreamTrack | null = null;
        try {
          const aStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: selectedAudioId ? { ideal: selectedAudioId } : undefined,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              channelCount: { ideal: audioChannelMode === 'stereo' ? 2 : 1 },
              sampleRate: { ideal: 48000 },
              sampleSize: { ideal: 16 }
            },
            video: false
          });
          audioTrack = aStream.getAudioTracks()[0] || null;
        } catch (aErr) {
          console.warn('Failed to get audio with studio constraints, trying default:', aErr);
          try {
            const fallbackAStream = await navigator.mediaDevices.getUserMedia({ 
              audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: { ideal: audioChannelMode === 'stereo' ? 2 : 1 }
              }, 
              video: false 
            });
            audioTrack = fallbackAStream.getAudioTracks()[0] || null;
          } catch (aErr2) {
            console.error('No audio device could be opened:', aErr2);
          }
        }

        if (isCancelled) {
          if (videoTrack) videoTrack.stop();
          if (audioTrack) audioTrack.stop();
          return;
        }

        const tracks: MediaStreamTrack[] = [];
        if (videoTrack) tracks.push(videoTrack);
        if (audioTrack) tracks.push(audioTrack);

        if (tracks.length > 0) {
          const rawStream = new MediaStream(tracks);
          streamInstance = rawStream;
          setCurrentStream(rawStream);

          if (videoTrack) {
            const vSettings = videoTrack.getSettings();
            setStreamSpecs(prev => ({
              ...prev,
              width: vSettings.width || (videoResolution === '4k' ? 3840 : videoResolution === '1080p' ? 1920 : 1280),
              height: vSettings.height || (videoResolution === '4k' ? 2160 : videoResolution === '1080p' ? 1080 : 720),
              frameRate: Math.round(vSettings.frameRate || 60)
            }));
          }
          if (audioTrack) {
            const aSettings = audioTrack.getSettings();
            setStreamSpecs(prev => ({
              ...prev,
              sampleRate: aSettings.sampleRate || 48000
            }));
          }

          if (videoElementRef.current && videoTrack) {
            videoElementRef.current.srcObject = rawStream;
            videoElementRef.current.muted = true;
            videoElementRef.current.onloadedmetadata = () => {
              videoElementRef.current?.play().catch(e => console.log('play error:', e));
            };
            videoElementRef.current.play().catch(e => console.log('play error:', e));
          }

          if (audioTrack) {
            setupAudioProcessor(rawStream);
          }
        }
      } catch (err) {
        console.error('Error starting media stream:', err);
      } finally {
        setIsMediaLoading(false);
      }
    }

    startMedia();

    return () => {
      isCancelled = true;
      if (streamInstance) {
        streamInstance.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedVideoId, selectedAudioId, videoResolution, isUsingRemoteCam, remoteStream, isAudioOnly]);

  // 3. Web Audio API Setup for DSP Gain & VU Metering
  const setupAudioProcessor = (stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    if (audioProcessorRef.current) {
      audioProcessorRef.current.stop();
    }

    const processor = new StudioAudioProcessor(
      (level, clipping) => {
        setAudioLevel(level);
        setIsClipping(clipping);
      },
      (freqData) => {
        drawWaveform(freqData);
      }
    );

    processor.setGain(micGain);
    processor.setNoiseSuppression(noiseSuppression);
    audioProcessorRef.current = processor;
    const processed = processor.process(stream);
    processedStreamRef.current = processed;
  };

  // Update Gain Live
  const handleGainChange = (newGain: number) => {
    setMicGain(newGain);
    if (audioProcessorRef.current) {
      audioProcessorRef.current.setGain(newGain);
    }
  };

  // Update Noise Suppression Live
  const handleToggleNoiseSuppression = () => {
    const nextState = !noiseSuppression;
    setNoiseSuppression(nextState);
    if (audioProcessorRef.current) {
      audioProcessorRef.current.setNoiseSuppression(nextState);
    }
  };

  // Draw Audio Waveform Canvas
  const drawWaveform = (freqData: Uint8Array) => {
    // 1. Draw Mini Canvas (in controls)
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = 3;
        const gap = 2;
        const totalBars = Math.min(32, Math.floor(canvas.width / (barWidth + gap)));

        for (let i = 0; i < totalBars; i++) {
          const value = freqData[i * 2] || 0;
          const percent = value / 255;
          const barHeight = Math.max(2, percent * canvas.height);
          const x = i * (barWidth + gap);
          const y = canvas.height - barHeight;

          if (percent > 0.85) {
            ctx.fillStyle = '#ef4444';
          } else if (percent > 0.6) {
            ctx.fillStyle = '#f59e0b';
          } else {
            ctx.fillStyle = '#6366f1';
          }

          ctx.fillRect(x, y, barWidth, barHeight);
        }
      }
    }

    // 2. Draw Big Radio Spectrum Canvas (if in audio-only mode)
    if (audioSpectrumCanvasRef.current) {
      const bCanvas = audioSpectrumCanvasRef.current;
      const bCtx = bCanvas.getContext('2d');
      if (bCtx) {
        bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);
        const bBarWidth = 5;
        const bGap = 3;
        const bTotalBars = Math.min(48, Math.floor(bCanvas.width / (bBarWidth + bGap)));
        
        for (let i = 0; i < bTotalBars; i++) {
          const value = freqData[i * 2] || 0;
          const percent = value / 255;
          const barHeight = Math.max(4, percent * bCanvas.height * 0.85);
          const x = i * (bBarWidth + bGap);
          const y = (bCanvas.height - barHeight) / 2;

          const gradient = bCtx.createLinearGradient(0, y, 0, y + barHeight);
          gradient.addColorStop(0, percent > 0.8 ? '#ef4444' : '#f59e0b');
          gradient.addColorStop(1, '#8b5cf6');
          bCtx.fillStyle = gradient;

          bCtx.beginPath();
          bCtx.roundRect(x, y, bBarWidth, barHeight, 2);
          bCtx.fill();
        }
      }
    }
  };

  // 4. Timer Handling
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setRecordedSeconds(prev => prev + 1);
        setActiveTopicSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // MediaRecorder & Chunks (Dual Video + Isolated Audio Backup)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedAudioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Post-recording review data
  const [finishedRecording, setFinishedRecording] = useState(false);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  // Second Screen Studio Clock Broadcaster
  const clockBroadcasterRef = useRef<StudioClockBroadcaster | null>(null);

  // Initialize Broadcaster & handle remote 2nd-screen actions
  useEffect(() => {
    const broadcaster = new StudioClockBroadcaster(episode.id, (action) => {
      if (action.type === 'TOGGLE_PAUSE') {
        togglePauseRecording();
      } else if (action.type === 'STOP_RECORDING') {
        stopRecording();
      } else if (action.type === 'NEXT_TOPIC') {
        handleNextTopic();
      } else if (action.type === 'PREV_TOPIC') {
        handlePrevTopic();
      } else if (action.type === 'HIGHLIGHT_MARKER') {
        addMarker('⭐ רגע שיא (מהמסך השני)', 'highlight');
      }
    });

    clockBroadcasterRef.current = broadcaster;
    return () => broadcaster.close();
  }, [episode.id]);

  // Broadcast live state to 2nd screen whenever values update
  useEffect(() => {
    if (clockBroadcasterRef.current) {
      clockBroadcasterRef.current.broadcastState({
        episodeId: episode.id,
        isRecording,
        isPaused,
        recordedSeconds,
        activeTopicSeconds,
        activeTopicIndex,
        targetDurationMinutes: episode.targetDurationMinutes || 45,
        episodeTitle: episode.title,
        season: episode.season,
        episodeNumber: episode.episodeNumber,
        topics: episode.topics.map(t => ({ id: t.id, title: t.title, talkingPoints: t.talkingPoints }))
      });
    }
  }, [episode, isRecording, isPaused, recordedSeconds, activeTopicSeconds, activeTopicIndex]);

  // Pre-Recording Countdown & Giant Clock States
  const [preRecordCountdown, setPreRecordCountdown] = useState<number>(3); // 0 (instant), 3, 5, 10
  const [countdownCurrent, setCountdownCurrent] = useState<number | null>(null);
  const [isGiantClockOpen, setIsGiantClockOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Listen for custom open-cloud-modal events
  useEffect(() => {
    const handleOpenCloud = () => setIsCloudModalOpen(true);
    window.addEventListener('open-cloud-modal', handleOpenCloud);
    return () => window.removeEventListener('open-cloud-modal', handleOpenCloud);
  }, []);

  // Studio Countdown Audio Cue Beep
  const playCountdownBeep = (isFinal = false) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 880 : 440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (isFinal ? 0.35 : 0.12));
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (isFinal ? 0.35 : 0.12));
    } catch (e) {}
  };

  // Crash Recovery State
  const [hasCrashRecovery, setHasCrashRecovery] = useState(false);

  // Check for crash recovery session on mount
  useEffect(() => {
    async function checkRecovery() {
      try {
        const recoveredBlob = await getMediaBlob(`emergency_rec_${episode.id}`);
        if (recoveredBlob && recoveredBlob.size > 10000) {
          setHasCrashRecovery(true);
        }
      } catch (e) {}
    }
    checkRecovery();
  }, [episode.id]);

  const handleRestoreCrashedRecording = async () => {
    try {
      const recoveredBlob = await getMediaBlob(`emergency_rec_${episode.id}`);
      if (recoveredBlob) {
        const url = URL.createObjectURL(recoveredBlob);
        setRecordedVideoBlob(recoveredBlob);
        setRecordedVideoUrl(url);
        setRecordedSeconds(Math.round(recoveredBlob.size / 250000)); // approximate duration
        setFinishedRecording(true);
        setHasCrashRecovery(false);
      }
    } catch (e) {
      alert('שגיאה בשחזור ההקלטה');
    }
  };

  // Pre-recording countdown initiation
  const handleInitiateRecording = () => {
    if (!currentStream) {
      alert('אין זרם וידאו/אודיו זמין להקלטה');
      return;
    }

    if (preRecordCountdown === 0) {
      startRecording();
      return;
    }

    setCountdownCurrent(preRecordCountdown);
    playCountdownBeep(false);

    let current = preRecordCountdown;
    const interval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setCountdownCurrent(current);
        playCountdownBeep(false);
      } else {
        clearInterval(interval);
        setCountdownCurrent(null);
        playCountdownBeep(true);
        startRecording();
      }
    }, 1000);
    countdownIntervalRef.current = interval;
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdownCurrent(null);
  };

  // Real-time Hebrew Spoken Subtitles Capture during Recording
  const speechRecognitionRef = useRef<any>(null);
  const liveSpokenSubtitlesRef = useRef<SubtitleItem[]>([]);
  const lastSpokenTimestampRef = useRef<number>(0);

  // 5. Start Recording (Dual Stream: HD Video + Isolated Master Audio + Real-time Speech-to-Text)
  const startRecording = () => {
    if (!currentStream) {
      alert('אין זרם וידאו/אודיו זמין להקלטה');
      return;
    }

    recordedChunksRef.current = [];
    recordedAudioChunksRef.current = [];
    liveSpokenSubtitlesRef.current = [];
    lastSpokenTimestampRef.current = 0;

    // 1. Live Hebrew Speech Recognition to capture actual spoken words
    if (typeof window !== 'undefined') {
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const recognition = new SpeechRec();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = 'he-IL';

          recognition.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                const transcript = event.results[i][0]?.transcript?.trim();
                if (transcript) {
                  const startTime = Math.max(0, lastSpokenTimestampRef.current);
                  const endTime = Math.max(startTime + 2.0, recordedSeconds || 3.0);
                  liveSpokenSubtitlesRef.current.push({
                    id: `sub_spoken_${Date.now()}_${liveSpokenSubtitlesRef.current.length}`,
                    startTime: Number(startTime.toFixed(2)),
                    endTime: Number(endTime.toFixed(2)),
                    text: transcript
                  });
                  lastSpokenTimestampRef.current = endTime;
                }
              }
            }
          };

          recognition.onerror = () => {};
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {}
      }
    }

    // 2. Video Mime Type
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/mp4';

    // 3. Audio Mime Type
    let audioMimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(audioMimeType)) audioMimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported(audioMimeType)) audioMimeType = 'audio/mp4';

    try {
      // Dynamic Bitrate: 35 Mbps (4K UHD) | 8 Mbps (FHD 1080p) | 3 Mbps (HD 720p)
      const targetVideoBitrate = videoResolution === '4k' 
        ? 35000000 
        : videoResolution === '1080p' 
        ? 8000000 
        : 3000000;

      const recordStream = processedStreamRef.current || currentStream;
      if (!recordStream) return;

      // Main Video Recorder
      const videoRecorder = new MediaRecorder(recordStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: targetVideoBitrate
      });

      videoRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      // Isolated Audio Backup Recorder
      const audioTracks = recordStream.getAudioTracks();
      let audioRecorder: MediaRecorder | null = null;
      if (audioTracks.length > 0) {
        const audioOnlyStream = new MediaStream(audioTracks);
        audioRecorder = new MediaRecorder(audioOnlyStream, {
          mimeType: MediaRecorder.isTypeSupported(audioMimeType) ? audioMimeType : undefined,
          audioBitsPerSecond: 320000 // 320 kbps studio audio
        });

        audioRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            recordedAudioChunksRef.current.push(event.data);
          }
        };
        audioRecorder.start(1000);
        audioRecorderRef.current = audioRecorder;
      }

      videoRecorder.onstop = async () => {
        // Stop speech recognition
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch (e) {}
          speechRecognitionRef.current = null;
        }

        const fullVideoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(fullVideoBlob);

        const fullAudioBlob = recordedAudioChunksRef.current.length > 0 
          ? new Blob(recordedAudioChunksRef.current, { type: audioMimeType })
          : null;

        setRecordedVideoBlob(fullVideoBlob);
        setRecordedAudioBlob(fullAudioBlob);
        setRecordedVideoUrl(videoUrl);

        // Save Main Video & Audio Blobs to IndexedDB
        const blobKey = `rec_${episode.id}_${Date.now()}`;
        await saveMediaBlob(blobKey, fullVideoBlob);

        if (fullAudioBlob) {
          await saveMediaBlob(`${blobKey}_audio`, fullAudioBlob);
        }

        // Clean emergency recovery file
        await deleteMediaBlob(`emergency_rec_${episode.id}`);

        // Update Episode in Database with real captured subtitles
        saveEpisode({
          ...episode,
          status: 'recorded',
          subtitles: liveSpokenSubtitlesRef.current.length > 0 
            ? liveSpokenSubtitlesRef.current 
            : episode.subtitles,
          recording: {
            duration: recordedSeconds,
            recordedAt: new Date().toISOString(),
            videoBlobKey: blobKey,
            audioBlobKey: fullAudioBlob ? `${blobKey}_audio` : undefined,
            fileSize: fullVideoBlob.size,
            mimeType,
            resolution: videoResolution,
            markers,
            topicsCovered: topics.map(t => t.id)
          }
        });

        setFinishedRecording(true);
      };

      videoRecorder.start(1000);
      mediaRecorderRef.current = videoRecorder;
      setIsRecording(true);
      setIsPaused(false);
      setRecordedSeconds(0);
      setActiveTopicSeconds(0);

      // Periodic Crash Protection: Flush chunk to disk every 10 seconds
      backupIntervalRef.current = setInterval(async () => {
        if (recordedChunksRef.current.length > 0) {
          const tempBlob = new Blob(recordedChunksRef.current, { type: mimeType });
          await saveMediaBlob(`emergency_rec_${episode.id}`, tempBlob);
        }
      }, 10000);

      addMarker('תחילת ההקלטה', 'note');
    } catch (err) {
      console.error('Failed to start Dual MediaRecorder:', err);
      alert('שגיאה בהפעלת מקליט המדיה. אנא נסה שוב.');
    }
  };

  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      if (audioRecorderRef.current) audioRecorderRef.current.resume();
      setIsPaused(false);
      addMarker('המשך הקלטה לאחר הפסקה', 'note');
    } else {
      mediaRecorderRef.current.pause();
      if (audioRecorderRef.current) audioRecorderRef.current.pause();
      setIsPaused(true);
      addMarker('הקלטה הושהתה', 'note');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (confirm('האם לעצור את ההקלטה ולעבור לסקירת הפרק?')) {
      if (backupIntervalRef.current) {
        clearInterval(backupIntervalRef.current);
      }
      mediaRecorderRef.current.stop();
      if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
        audioRecorderRef.current.stop();
      }
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const addMarker = (label: string, type: TimestampMarker['type']) => {
    const newMarker: TimestampMarker = {
      id: `mark-${Date.now()}`,
      timestamp: recordedSeconds,
      label,
      type,
      topicId: currentTopic?.id,
      createdAt: new Date().toISOString()
    };
    setMarkers(prev => [...prev, newMarker]);
  };

  const handleAddCustomMarker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMarkerText.trim()) return;
    addMarker(customMarkerText.trim(), 'note');
    setCustomMarkerText('');
  };

  const handleNextTopic = () => {
    if (activeTopicIndex < topics.length - 1) {
      const nextIndex = activeTopicIndex + 1;
      setActiveTopicIndex(nextIndex);
      setActiveTopicSeconds(0);
      addMarker(`מעבר לנושא: ${topics[nextIndex].title}`, 'topic_change');
    }
  };

  const handlePrevTopic = () => {
    if (activeTopicIndex > 0) {
      const prevIndex = activeTopicIndex - 1;
      setActiveTopicIndex(prevIndex);
      setActiveTopicSeconds(0);
      addMarker(`חזרה לנושא: ${topics[prevIndex].title}`, 'topic_change');
    }
  };

  const toggleMic = () => {
    if (!currentStream) return;
    const audioTrack = currentStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  const toggleCam = () => {
    if (!currentStream) return;
    const videoTrack = currentStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoMuted(!videoTrack.enabled);
    }
  };

  const toggleFullscreen = () => {
    if (!studioContainerRef.current) return;
    if (!document.fullscreenElement) {
      studioContainerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.error(err));
      setIsFullscreen(false);
    }
  };

  if (finishedRecording) {
    return (
      <PostRecordingReview
        episode={episode}
        videoBlob={recordedVideoBlob}
        audioBlob={recordedAudioBlob}
        videoUrl={recordedVideoUrl}
        durationSeconds={recordedSeconds}
        markers={markers}
        onReRecord={() => {
          setFinishedRecording(false);
          setRecordedSeconds(0);
          setActiveTopicSeconds(0);
          setMarkers([]);
        }}
      />
    );
  }

  return (
    <div ref={studioContainerRef} className="space-y-6 animate-in fade-in duration-300 font-sans">
      {/* Emergency Crash Recovery Alert Banner */}
      {hasCrashRecovery && (
        <div className="p-4 rounded-2xl bg-amber-950/70 border-2 border-amber-500/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 text-xs shadow-2xl animate-in slide-in-from-top-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            <div>
              <p className="font-bold text-white text-sm">נמצאה הקלטה שלא נשמרה כראוי (גיבוי חירום מוקדם)</p>
              <p className="text-amber-300/80 text-[11px] mt-0.5">המערכת שמרה אוטומטית מקטעים מההקלטה הקודמת שנקטעה.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRestoreCrashedRecording}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg transition-all"
            >
              שחזר הקלטה עכשיו
            </button>
            <button
              onClick={() => setHasCrashRecovery(false)}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-black/30"
            >
              התעלם
            </button>
          </div>
        </div>
      )}

      {/* Top Studio Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#121620] border border-slate-800/90 shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            href={`/episodes/${episode.id}`}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 border border-slate-800 transition-colors"
            title="חזרה לפרטי הפרק"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[11px] font-bold">
                אולפן הקלטות חי
              </span>
              <span className="text-xs text-slate-400 font-medium">עונה {episode.season} • פרק {episode.episodeNumber}</span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-white truncate max-w-md">{episode.title}</h1>
          </div>
        </div>

        {/* Master Recording Timer & Status */}
        <div className="flex items-center gap-3">
          {/* Remote Guest Studio Invite Button */}
          <button
            onClick={() => setIsGuestModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-all shadow-md active:scale-95 ${
              guestConnectionStatus === 'connected'
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300 shadow-lg shadow-emerald-950/40'
                : 'bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border-indigo-500/40'
            }`}
            title="הזמנת אורח מרחוק לשידור חי (Remote Guest)"
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span>👥 הזמן אורח {guestConnectionStatus === 'connected' ? '(מחובר ✓)' : ''}</span>
          </button>

          {/* Hardware Sound & Video Diagnostics Button */}
          <button
            onClick={() => setIsDiagnosticsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-bold transition-all shadow-md active:scale-95"
            title="בדיקת סאונד ווידאו (Pre-Flight Check)"
          >
            <Activity className="w-4 h-4 text-amber-400" />
            <span>🔬 בדיקת סאונד ווידאו</span>
          </button>

          {/* Second Screen Indicator / Launcher */}
          <button
            onClick={launchSecondScreenClockManually}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-all ${
              secondScreenAutoLaunched
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/40'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="שעון אולפן ענק במסך שני"
          >
            <span className={`w-2 h-2 rounded-full ${secondScreenAutoLaunched ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>🖥️ שעון במסך 2 {secondScreenAutoLaunched ? '(פעיל)' : ''}</span>
          </button>

          {/* Giant Clock Mode Button */}
          <button
            onClick={() => setIsGiantClockOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition-all"
            title="מעבר לשעון אולפן ענק במסך מלא"
          >
            <Clock className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">שעון במסך מלא</span>
          </button>

          <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/70 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className={`w-3.5 h-3.5 rounded-full ${isRecording ? (isPaused ? 'bg-amber-400' : 'bg-red-500 animate-rec') : 'bg-slate-600'}`} />
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {isRecording ? (isPaused ? 'מושהה' : 'REC') : 'מוכן'}
              </span>
            </div>

            <div className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white">
              {formatTime(recordedSeconds, true)}
            </div>
          </div>

          {/* Master Record / Pause / Stop Buttons */}
          <div className="flex items-center gap-2">
            {!isRecording ? (
              <div className="flex items-center gap-1.5">
                {/* Pre-record Countdown Selector */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1.5 rounded-xl text-xs">
                  <span className="text-[10px] text-slate-400 font-semibold">ספירה:</span>
                  <select
                    value={preRecordCountdown}
                    onChange={(e) => setPreRecordCountdown(parseInt(e.target.value))}
                    className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value={0}>מיידי (0s)</option>
                    <option value={3}>3 שניות</option>
                    <option value={5}>5 שניות</option>
                    <option value={10}>10 שניות</option>
                  </select>
                </div>

                <button
                  onClick={handleInitiateRecording}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-red-950/60 active:scale-95 transition-all"
                >
                  <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                  <span>התחל הקלטה</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={togglePauseRecording}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    isPaused 
                      ? 'bg-amber-500 text-black border-amber-400' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                  title={isPaused ? 'המשך הקלטה' : 'השהה הקלטה'}
                >
                  {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>

                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-950/60 active:scale-95 transition-all"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>עצור ושמור</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Studio View: Video Stage (Left) & Run-of-Show Agenda (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Monitor & Hardware Controls (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Main Video Box with Overlays */}
          <div className="relative aspect-video rounded-3xl bg-black border border-slate-800 overflow-hidden shadow-2xl group/video flex items-center justify-center">
            {/* Audio Only Videocast Stage with Custom Background (Image / Color / Gradient) */}
            {isAudioOnly ? (
              <div 
                className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative overflow-hidden transition-all duration-500"
                style={
                  audioStageConfig.bgType === 'solid'
                    ? { backgroundColor: audioStageConfig.solidColor || '#090d16' }
                    : audioStageConfig.bgType === 'preset'
                    ? { background: AUDIO_STAGE_PRESETS.find(p => p.id === audioStageConfig.presetId)?.style || 'linear-gradient(180deg, #090d16 0%, #03060d 100%)' }
                    : undefined
                }
              >
                {/* Custom Image Wallpaper Backdrop */}
                {audioStageConfig.bgType === 'image' && audioStageConfig.customBgImage && (
                  <>
                    <img 
                      src={audioStageConfig.customBgImage} 
                      alt="Videocast Stage Backdrop" 
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-all duration-300"
                      style={{ filter: audioStageConfig.bgBlur ? `blur(${audioStageConfig.bgBlur}px)` : undefined }}
                    />
                    <div 
                      className="absolute inset-0 pointer-events-none transition-opacity duration-300" 
                      style={{ backgroundColor: `rgba(0, 0, 0, ${(audioStageConfig.bgDarken ?? 20) / 100})` }}
                    />
                  </>
                )}

                {/* Floating Audio Stage Background Customizer Button */}
                <button
                  onClick={() => setIsAudioStageModalOpen(true)}
                  className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-black/80 hover:bg-black text-amber-300 hover:text-white border border-amber-500/40 text-[11px] font-bold shadow-xl transition-all active:scale-95 backdrop-blur-md"
                  title="עיצוב תמונת רקע, צבע וגלי קול לפרק אודיו"
                >
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span>🎨 עצב רקע וידאו-קאסט</span>
                </button>

                {/* Glowing Aura */}
                <div className={`absolute w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
                  isRecording 
                    ? (isPaused ? 'bg-amber-500/20' : 'bg-red-500/25') 
                    : 'bg-indigo-500/15'
                }`} />

                {/* Big Mic & Recording Indicator */}
                <div className="relative z-10 space-y-4">
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl mx-auto flex items-center justify-center shadow-2xl transition-all duration-300 ${
                    isRecording 
                      ? (isPaused 
                          ? 'bg-amber-500 text-slate-950 shadow-amber-500/40' 
                          : 'bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-rose-500/50 animate-pulse') 
                      : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-indigo-600/30'
                  }`}>
                    <Mic className="w-10 h-10 sm:w-12 sm:h-12" />
                  </div>

                  <div className="space-y-1">
                    <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 backdrop-blur-sm">
                      <Radio className="w-3.5 h-3.5" />
                      <span>אולפן וידאו-קאסט ורדיו (Audio Videocast)</span>
                    </span>
                    <h3 className="text-base sm:text-xl font-black text-white drop-shadow-md">{episode.title}</h3>
                    <p className="text-xs text-slate-300 drop-shadow">
                      איכות שידור 48kHz HD • הקלטת מאסטר 320 kbps Opus/AAC
                    </p>
                  </div>

                  {/* Big Audio Spectrum Canvas */}
                  <div className="w-full max-w-md mx-auto pt-2">
                    <canvas
                      ref={audioSpectrumCanvasRef}
                      width={400}
                      height={60}
                      className="w-full h-14 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 shadow-inner"
                    />
                  </div>
                </div>
              </div>
            ) : !isAudioOnly && guestConnectionStatus === 'connected' && guestLayout === 'split' ? (
              <div className="w-full h-full grid grid-cols-2 gap-2 p-2 bg-slate-950">
                {/* Host Feed */}
                <div className="relative rounded-2xl overflow-hidden bg-black border border-indigo-500/40">
                  <video
                    ref={videoElementRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
                  />
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md text-[10px] font-bold text-indigo-300 border border-white/10 flex items-center gap-1">
                    <span>👤 מארח האולפן</span>
                  </div>
                </div>

                {/* Guest Feed */}
                <div className="relative rounded-2xl overflow-hidden bg-black border border-purple-500/40">
                  {guestFrame ? (
                    <img src={guestFrame} alt="Guest Stream" className="w-full h-full object-cover" />
                  ) : (
                    <video
                      ref={guestVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-xl bg-black/75 backdrop-blur-md text-[10px] font-bold text-purple-300 border border-white/10 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>🎙️ {guestInfo?.name || 'אורח בשידור'}</span>
                  </div>
                </div>
              </div>
            ) : !isAudioOnly && guestConnectionStatus === 'connected' && guestLayout === 'guest' ? (
              /* Solo Guest View */
              <div className="w-full h-full relative">
                {guestFrame ? (
                  <img src={guestFrame} alt="Guest Stream" className="w-full h-full object-cover" />
                ) : (
                  <video
                    ref={guestVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md text-xs font-bold text-purple-300 border border-white/10 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>🎙️ {guestInfo?.name || 'אורח בשידור'}</span>
                </div>
              </div>
            ) : isUsingRemoteCam && remoteFrame ? (
              <img
                src={remoteFrame}
                alt="iPhone Live Camera"
                className={`w-full h-full object-cover transition-all ${
                  depthOfField ? 'contrast-[1.08] saturate-[1.12] brightness-[1.02]' : ''
                }`}
              />
            ) : (
              <div className="w-full h-full relative">
                <video
                  ref={videoElementRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-all ${
                    isMirrored && !isUsingRemoteCam ? 'scale-x-[-1]' : ''
                  } ${
                    depthOfField ? 'contrast-[1.08] saturate-[1.12] brightness-[1.02]' : ''
                  }`}
                />

                {/* Floating Picture-in-Picture Guest Card */}
                {!isAudioOnly && guestConnectionStatus === 'connected' && guestLayout === 'pip' && (
                  <div className="absolute bottom-4 left-4 z-20 w-44 sm:w-56 aspect-video rounded-2xl overflow-hidden border-2 border-purple-500/80 shadow-2xl bg-black animate-in fade-in">
                    {guestFrame ? (
                      <img src={guestFrame} alt="Guest PIP" className="w-full h-full object-cover" />
                    ) : (
                      <video
                        ref={guestVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-bold text-purple-300 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{guestInfo?.name || 'אורח'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Depth of Field Cinematic Vignette Mask */}
            {!isAudioOnly && depthOfField && (
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)] z-10 animate-in fade-in" />
            )}

            {/* Video Loading / Standby Indicator */}
            {!isAudioOnly && isMediaLoading && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-3 z-10 animate-in fade-in">
                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-indigo-300">מעיר ומחבר את המצלמה...</p>
              </div>
            )}

            {/* Live Video Resolution & Hardware Telemetry Badge */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/20 text-[11px] font-bold text-white shadow-2xl">
              {isAudioOnly ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                  <span className="text-amber-300 font-bold">אודיו בלבד (48kHz • 320kbps Master)</span>
                </>
              ) : videoResolution === '4k' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                  <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 bg-clip-text text-transparent font-black tracking-wide">
                    4K UHD ({streamSpecs.width || 3840}×{streamSpecs.height || 2160} @ {streamSpecs.frameRate || 60}fps • 35Mbps)
                  </span>
                </>
              ) : videoResolution === '1080p' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                  <span className="text-indigo-200 font-bold">
                    FHD ({streamSpecs.width || 1920}×{streamSpecs.height || 1080} @ {streamSpecs.frameRate || 60}fps • 8Mbps)
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-slate-300">
                    HD ({streamSpecs.width || 1280}×{streamSpecs.height || 720} @ {streamSpecs.frameRate || 30}fps • 3Mbps)
                  </span>
                </>
              )}
              <span className="text-slate-600">|</span>
              <span className="text-[10px] font-mono text-emerald-400">
                DSP {Math.round(micGain * 100)}% {noiseSuppression ? '• סינון רעשים ✓' : ''}
              </span>
            </div>

            {/* Pre-Recording Cinematic Countdown Overlay */}
            {countdownCurrent !== null && (
              <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in">
                <div className="text-8xl sm:text-9xl font-black text-rose-500 font-mono animate-bounce drop-shadow-[0_0_50px_rgba(244,63,94,0.8)]">
                  {countdownCurrent}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-black text-white tracking-widest uppercase">מתכוננים לשידור והקלטה...</p>
                  <p className="text-xs text-slate-400">נא ליישר מבט למצלמה ולהתכונן לפתיח</p>
                </div>
                <button
                  onClick={cancelCountdown}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
                >
                  בטל ספירה לאחור
                </button>
              </div>
            )}

            {/* --- LIVE BROADCAST OVERLAYS (DRAGGABLE & RESIZABLE) --- */}

            {/* 1. Spoiler Alert Glowing Banner */}
            {overlayState.spoilerAlert.show && (
              <DraggableOverlay
                transform={overlayState.spoilerAlert.transform}
                onUpdateTransform={(t) => setOverlayState(prev => ({
                  ...prev,
                  spoilerAlert: { ...prev.spoilerAlert, transform: t }
                }))}
                onClose={() => setOverlayState(prev => ({
                  ...prev,
                  spoilerAlert: { ...prev.spoilerAlert, show: false }
                }))}
                defaultPosition={{ x: 28, y: 4, scale: 1.0 }}
              >
                <div className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-rose-600/90 backdrop-blur-md text-white font-black text-xs sm:text-sm shadow-2xl border border-rose-400 animate-pulse whitespace-nowrap">
                  <AlertTriangle className="w-4 h-4 fill-white text-rose-600 shrink-0" />
                  <span>{overlayState.spoilerAlert.text || 'זהירות: ספוילרים קריטיים לעלילה!'}</span>
                </div>
              </DraggableOverlay>
            )}

            {/* 2. Movie Poster Picture-in-Picture */}
            {overlayState.poster.show && (
              <DraggableOverlay
                transform={overlayState.poster.transform}
                onUpdateTransform={(t) => setOverlayState(prev => ({
                  ...prev,
                  poster: { ...prev.poster, transform: t }
                }))}
                onClose={() => setOverlayState(prev => ({
                  ...prev,
                  poster: { ...prev.poster, show: false }
                }))}
                defaultPosition={{ x: 4, y: 8, scale: 1.0 }}
              >
                <div className="w-28 sm:w-36 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-black/80 backdrop-blur-md">
                  <img
                    src={overlayState.poster.url}
                    alt="Movie Poster"
                    className="w-full h-36 sm:h-48 object-cover pointer-events-none"
                  />
                  {overlayState.poster.title && (
                    <div className="p-1.5 bg-black/80 text-center">
                      <p className="text-[10px] font-bold text-white truncate">{overlayState.poster.title}</p>
                    </div>
                  )}
                </div>
              </DraggableOverlay>
            )}

            {/* 3. Rating & Scores Badge Card */}
            {overlayState.rating.show && (
              <DraggableOverlay
                transform={overlayState.rating.transform}
                onUpdateTransform={(t) => setOverlayState(prev => ({
                  ...prev,
                  rating: { ...prev.rating, transform: t }
                }))}
                onClose={() => setOverlayState(prev => ({
                  ...prev,
                  rating: { ...prev.rating, show: false }
                }))}
                defaultPosition={{ x: 74, y: 10, scale: 1.0 }}
              >
                <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-black/85 backdrop-blur-md border border-white/15 shadow-2xl min-w-[110px]">
                  {overlayState.rating.imdb && (
                    <div className="flex items-center justify-between gap-2 text-[11px] font-black text-amber-400">
                      <span>⭐ IMDb</span>
                      <span className="text-white font-mono">{overlayState.rating.imdb}</span>
                    </div>
                  )}
                  {overlayState.rating.rottenTomatoes && (
                    <div className="flex items-center justify-between gap-2 text-[11px] font-black text-rose-400">
                      <span>🍅 Rotten</span>
                      <span className="text-white font-mono">{overlayState.rating.rottenTomatoes}</span>
                    </div>
                  )}
                  {overlayState.rating.personalScore && (
                    <div className="flex items-center justify-between gap-2 text-[11px] font-black text-emerald-400 pt-1 border-t border-white/10">
                      <span>🏆 הציון</span>
                      <span className="text-white font-mono">{overlayState.rating.personalScore}</span>
                    </div>
                  )}
                </div>
              </DraggableOverlay>
            )}

            {/* 4. Iconic Quote Lower-Third Banner */}
            {overlayState.quote.show && (
              <DraggableOverlay
                transform={overlayState.quote.transform}
                onUpdateTransform={(t) => setOverlayState(prev => ({
                  ...prev,
                  quote: { ...prev.quote, transform: t }
                }))}
                onClose={() => setOverlayState(prev => ({
                  ...prev,
                  quote: { ...prev.quote, show: false }
                }))}
                defaultPosition={{ x: 18, y: 68, scale: 1.0 }}
              >
                <div className="max-w-lg p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/95 via-purple-950/90 to-slate-950/95 backdrop-blur-md border border-indigo-500/40 shadow-2xl text-center">
                  <Quote className="w-4 h-4 text-purple-400 mx-auto mb-1 opacity-70" />
                  <p className="text-xs sm:text-sm font-black text-white italic leading-relaxed">
                    {overlayState.quote.text}
                  </p>
                  {overlayState.quote.speaker && (
                    <p className="text-[10px] font-bold text-indigo-300 mt-1">— {overlayState.quote.speaker}</p>
                  )}
                </div>
              </DraggableOverlay>
            )}

            {/* 5. Custom Lower-Third Banner */}
            {showLowerThird && (
              <DraggableOverlay
                transform={overlayState.customBanner.transform}
                onUpdateTransform={(t) => setOverlayState(prev => ({
                  ...prev,
                  customBanner: { ...prev.customBanner, transform: t }
                }))}
                onClose={() => setShowLowerThird(false)}
                defaultPosition={{ x: 48, y: 74, scale: 1.0 }}
              >
                <div className="max-w-md bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-indigo-950/85 backdrop-blur-md border-r-4 border-indigo-500 rounded-2xl p-3 shadow-2xl border border-slate-800/80">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                      CastFlow Cinema Studio
                    </span>
                    <span className="text-[10px] text-slate-400">• פרק {episode.episodeNumber}</span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-black text-white truncate">
                    {overlayState.customBanner.show ? overlayState.customBanner.title : episode.title}
                  </h4>
                  {episode.guest && !overlayState.customBanner.show && (
                    <p className="text-[11px] text-indigo-300 font-semibold truncate mt-0.5">
                      אורח/ת: {episode.guest.name} {episode.guest.role ? `(${episode.guest.role})` : ''}
                    </p>
                  )}
                  {overlayState.customBanner.show && overlayState.customBanner.subtitle && (
                    <p className="text-[11px] text-purple-300 font-semibold truncate mt-0.5">
                      {overlayState.customBanner.subtitle}
                    </p>
                  )}
                </div>
              </DraggableOverlay>
            )}

            {/* 6. Studio Brand Logo & Watermark Overlay */}
            {overlayState.logo?.show && overlayState.logo.url && (
              <DraggableOverlay
                transform={overlayState.logo.transform}
                onUpdateTransform={(t) => setOverlayState(prev => ({
                  ...prev,
                  logo: { ...prev.logo, transform: t }
                }))}
                onClose={() => setOverlayState(prev => ({
                  ...prev,
                  logo: { ...prev.logo, show: false }
                }))}
                defaultPosition={{ x: 88, y: 5, scale: 1.0 }}
              >
                <div 
                  style={{ opacity: overlayState.logo.opacity ?? 0.9 }}
                  className="select-none pointer-events-auto filter drop-shadow-md"
                >
                  <img
                    src={overlayState.logo.url}
                    alt="Studio Brand Logo"
                    style={{
                      width: `${overlayState.logo.size || 64}px`,
                      height: `${overlayState.logo.size || 64}px`,
                      objectFit: 'contain'
                    }}
                    className="max-w-none block drop-shadow-lg"
                  />
                </div>
              </DraggableOverlay>
            )}

            {/* 7. Movie Fact Card On-Screen Graphic Lower-Third Overlay */}
            {overlayState.factCard?.show && overlayState.factCard.fact && (
              <DraggableOverlay
                transform={overlayState.factCard.transform}
                onUpdateTransform={(t) => setOverlayState(prev => ({
                  ...prev,
                  factCard: { ...prev.factCard!, transform: t }
                }))}
                onClose={() => setOverlayState(prev => ({
                  ...prev,
                  factCard: { ...prev.factCard!, show: false }
                }))}
                defaultPosition={{ x: 20, y: 72, scale: 1.0 }}
              >
                <div className="max-w-lg bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-amber-950/80 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl border border-amber-500/40 ring-1 ring-amber-500/30 text-right animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                        {overlayState.factCard.fact.category === 'behind_the_scenes' ? '🎬 מאחורי הקלעים' :
                         overlayState.factCard.fact.category === 'critical_reception' ? '🏆 ציונים וביקורות' :
                         overlayState.factCard.fact.category === 'easter_egg' ? '🥚 איסטר אג' :
                         overlayState.factCard.fact.category === 'director_vision' ? '🎥 חזון הבמאי' : '💡 עובדת קולנוע'}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {overlayState.factCard.fact.source}
                      </span>
                    </div>

                    {overlayState.factCard.fact.ratingScore && (
                      <span className="text-[10px] font-mono font-black text-amber-400">
                        ⭐ {overlayState.factCard.fact.ratingScore}
                      </span>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                    {overlayState.factCard.fact.fact}
                  </p>
                </div>
              </DraggableOverlay>
            )}

            {/* Top Right Quick Controls */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 opacity-0 group-hover/video:opacity-100 transition-opacity">
              <button
                onClick={() => setIsMirrored(!isMirrored)}
                className="p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white transition-colors"
                title="היפוך מראה למצלמה"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setDepthOfField(!depthOfField)}
                className={`p-2 rounded-xl border transition-colors ${depthOfField ? 'bg-purple-600 border-purple-400 text-white' : 'bg-black/60 border-white/10 text-slate-400'}`}
                title="הפעל/כבה עומק שדה קולנועי (Bokeh)"
              >
                <Focus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setShowLowerThird(!showLowerThird)}
                className={`p-2 rounded-xl border transition-colors ${showLowerThird ? 'bg-indigo-600/80 border-indigo-400 text-white' : 'bg-black/60 border-white/10 text-slate-400'}`}
                title="הצג/הסתר באנר תחתון"
              >
                <Tv className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-slate-300 hover:text-white transition-colors"
                title="מסך מלא"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Audio & Video DSP Studio Controls - Clean Balanced Broadcast Layout */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[#121620]/95 border border-slate-800/90 shadow-2xl space-y-4">
            {/* Top Row: Two Symmetrical Cards (Video & Camera on Right, Mic & Sound on Left) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* CARD 1: Video & Camera Controls */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3 flex flex-col justify-between">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">מצלמת שידור ווידאו</h4>
                      <p className="text-[10px] font-mono text-slate-400">
                        {videoResolution === '4k' ? '3840×2160 (35 Mbps 4K)' : videoResolution === '1080p' ? '1920×1080 (8 Mbps FHD)' : '1280×720 (3 Mbps HD)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={async () => {
                        const { audioInputs, videoInputs } = await getMediaDevices();
                        setAudioDevices(audioInputs);
                        setVideoDevices(videoInputs);
                      }}
                      className="text-[10px] font-medium text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 transition-colors"
                      title="רענן רשימת התקנים"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>רענן</span>
                    </button>

                    <button
                      onClick={() => setIsRemoteModalOpen(true)}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/30 transition-all hover:bg-indigo-500/20"
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>חיבור iPhone</span>
                    </button>
                  </div>
                </div>

                {/* Camera Dropdown & Toggle */}
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
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {remoteStream && (
                      <option value="remote-iphone">📱 iPhone Remote Camera (מחובר בשידור חי)</option>
                    )}
                    {videoDevices.map(v => (
                      <option key={v.deviceId} value={v.deviceId}>
                        {v.isIPhone || v.isContinuity ? `📱 ${v.label} (iPhone HD)` : v.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={toggleCam}
                    className={`p-2.5 rounded-xl border transition-all ${isVideoMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'}`}
                    title={isVideoMuted ? 'הפעל מצלמה' : 'כבה מצלמה'}
                  >
                    {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sub-row: Resolution Switcher + Cinematic Bokeh Toggle */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setVideoResolution('4k')}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                      videoResolution === '4k'
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black shadow'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    4K UHD 🌟
                  </button>

                  <button
                    type="button"
                    onClick={() => setVideoResolution('1080p')}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                      videoResolution === '1080p'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    FHD 1080p 🎬
                  </button>

                  <button
                    type="button"
                    onClick={() => setVideoResolution('720p')}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all text-center ${
                      videoResolution === '720p'
                        ? 'bg-slate-700 text-white shadow'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    HD 720p
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepthOfField(!depthOfField)}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border ${
                      depthOfField
                        ? 'bg-purple-600 border-purple-500 text-white shadow'
                        : 'bg-slate-900 border-slate-800 text-purple-300/80 hover:text-purple-200'
                    }`}
                    title="טשטוש רקע קולנועי (Depth of Field Bokeh)"
                  >
                    <Focus className="w-3 h-3" />
                    <span>בוקה</span>
                  </button>
                </div>
              </div>

              {/* CARD 2: Microphone & Audio DSP Controls */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/90 space-y-3 flex flex-col justify-between">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">מיקרופון ראשי וסאונד</h4>
                      <p className="text-[10px] font-mono text-slate-400">
                        {audioChannelMode === 'stereo' ? 'Stereo (2-Channel 48kHz)' : 'Mono (1-Channel 48kHz)'}
                      </p>
                    </div>
                  </div>

                  {/* Audio Channel Mode Segment (Stereo vs Mono) */}
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setAudioChannelMode('stereo')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                        audioChannelMode === 'stereo'
                          ? 'bg-cyan-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Headphones className="w-2.5 h-2.5" />
                      <span>סטריאו</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioChannelMode('mono')}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                        audioChannelMode === 'mono'
                          ? 'bg-teal-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mic className="w-2.5 h-2.5" />
                      <span>מונו</span>
                    </button>
                  </div>
                </div>

                {/* Mic Dropdown & Mute */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedAudioId}
                    onChange={(e) => setSelectedAudioId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {audioDevices.map(a => (
                      <option key={a.deviceId} value={a.deviceId}>
                        {a.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={toggleMic}
                    className={`p-2.5 rounded-xl border transition-all ${isAudioMuted ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'}`}
                    title={isAudioMuted ? 'בטל השתקה' : 'השתק מיקרופון'}
                  >
                    {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                </div>

                {/* Sub-row: Gain Slider + DSP Noise Filter Toggle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {/* Gain Slider */}
                  <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300 shrink-0">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Gain:</span>
                      <span className="font-mono text-indigo-400">{Math.round(micGain * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={micGain}
                      onChange={(e) => handleGainChange(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Noise Filter Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleNoiseSuppression}
                    className={`p-2 rounded-xl border text-[11px] font-bold flex items-center justify-between transition-all ${
                      noiseSuppression
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ניקוי רעשים DSP</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                      noiseSuppression ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {noiseSuppression ? 'פעיל ✓' : 'כבוי'}
                    </span>
                  </button>
                </div>
              </div>

            </div>

            {/* Bottom Strip: Real-Time Broadcast Audio Level VU Meter */}
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300 shrink-0">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>עוצמת שידור חיה (VU Meter):</span>
                  <span className="font-mono text-cyan-400 font-bold text-xs">{audioLevel}%</span>
                </div>

                {/* Gradient VU Meter Bar */}
                <div className="flex-1 h-3 rounded-full bg-slate-900 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-75 ${
                      isClipping
                        ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                        : audioLevel > 70
                        ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500'
                        : 'bg-gradient-to-r from-indigo-500 to-cyan-400'
                    }`}
                    style={{ width: `${Math.min(100, audioLevel)}%` }}
                  />
                </div>

                {/* Clipping alert badge */}
                {isClipping && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30 shrink-0 animate-pulse">
                    ⚠️ Clipping / חזק מדי
                  </span>
                )}
              </div>

              {/* Live Mini Oscilloscope Waveform Canvas */}
              <div className="shrink-0 bg-slate-900 rounded-xl p-1 border border-slate-800">
                <canvas ref={canvasRef} width={120} height={22} className="rounded" />
              </div>
            </div>
          </div>

          {/* Live Broadcast Graphic Deck Overlay Controls */}
          <LiveBroadcastDeck
            episode={episode}
            overlayState={overlayState}
            onUpdateOverlay={(updates) => setOverlayState(prev => ({ ...prev, ...updates }))}
          />

          {/* Quick Marker Hotkey Bar */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-slate-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                סימון נקודות ציון בזמן אמת (Markers)
              </span>
              <span className="text-[10px] text-slate-400">נשמר לציר הזמן ביוטיוב/ספוטיפיי</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                onClick={() => addMarker('רגע שיא / קטע עוצמתי', 'highlight')}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>⭐ רגע שיא</span>
              </button>

              <button
                onClick={() => addMarker('חיתוך לסושיאל (טיקטוק/רילס)', 'clip_cut')}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-semibold transition-all active:scale-95"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>✂️ קליפ לסושיאל</span>
              </button>

              <button
                onClick={() => addMarker(`מעבר נושא: ${currentTopic?.title || ''}`, 'topic_change')}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-all active:scale-95"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>📌 מעבר נושא</span>
              </button>

              <button
                onClick={() => addMarker('שאלת מפתח מעניינת', 'question')}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold transition-all active:scale-95"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>❓ שאלת מפתח</span>
              </button>
            </div>

            {/* Custom Marker Input Form */}
            <form onSubmit={handleAddCustomMarker} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="הוסף סימון / הערת זמן מותאמת אישית..."
                value={customMarkerText}
                onChange={(e) => setCustomMarkerText(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700"
              >
                הוסף
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Run of Show / Agenda & Live Teleprompter (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Prompter Tabs Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs">
            <button
              onClick={() => setPrompterTab('topics')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                prompterTab === 'topics'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>סדר הפרק ({topics.length})</span>
            </button>

            <button
              onClick={() => setPrompterTab('facts')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                prompterTab === 'facts'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>עובדות קולנוע ({movieFacts.length})</span>
            </button>
          </div>

          {prompterTab === 'facts' ? (
            <div className="rounded-2xl bg-[#121620] border border-slate-800 p-4 space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Film className="w-4 h-4 text-amber-400" />
                  <span>כרטיסיות עובדות קולנוע וטריוויה</span>
                </span>
                <span className="text-[10px] text-slate-400">IMDb • ויקיפדיה • Rotten</span>
              </div>

              <MovieFactPrompterCockpit
                movieFacts={movieFacts}
                activeOverlayFact={overlayState.factCard?.fact || null}
                isOverlayShowing={!!overlayState.factCard?.show}
                onToggleBroadcastOverlay={(fact: MovieFactCard | null, show: boolean) => {
                  setOverlayState(prev => ({
                    ...prev,
                    factCard: {
                      show,
                      fact: fact || prev.factCard?.fact || null,
                      transform: prev.factCard?.transform || { x: 20, y: 72, scale: 1.0 }
                    }
                  }));
                }}
              />
            </div>
          ) : (
            <>
              {/* Active Topic Card */}
              <div className="rounded-2xl bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 text-[11px] font-bold">
                    נושא פעיל ({activeTopicIndex + 1}/{topics.length})
                  </span>

                  {/* Topic Stopwatch */}
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTime(activeTopicSeconds)}</span>
                    <span className="text-slate-500">/ {currentTopic?.estimatedMinutes || 10}:00 דק'</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-white leading-snug">
                    {currentTopic?.title}
                  </h3>
                  {currentTopic?.notes && (
                    <p className="text-xs text-slate-300 mt-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 leading-relaxed">
                      {currentTopic.notes}
                    </p>
                  )}
                </div>

                {/* Current Talking Points */}
                {currentTopic?.talkingPoints && currentTopic.talkingPoints.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-indigo-300">נקודות מרכזיות:</span>
                    <ul className="space-y-1">
                      {currentTopic.talkingPoints.map((point, idx) => (
                        <li key={idx} className="text-xs text-slate-200 flex items-start gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Current Guest Questions */}
                {currentTopic?.questions && currentTopic.questions.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-purple-300">שאלות מפתח לאורח:</span>
                    <ul className="space-y-1">
                      {currentTopic.questions.map((q, idx) => (
                        <li key={idx} className="text-xs text-purple-200 flex items-start gap-2 bg-purple-950/30 p-2 rounded-lg border border-purple-900/40">
                          <span className="text-purple-400 font-bold shrink-0">❓</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next / Previous Topic Switcher Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-indigo-500/20">
                  <button
                    onClick={handlePrevTopic}
                    disabled={activeTopicIndex === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold text-slate-200 border border-slate-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>נושא קודם</span>
                  </button>

                  <button
                    onClick={handleNextTopic}
                    disabled={activeTopicIndex === topics.length - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-bold text-white shadow-lg shadow-indigo-900/40"
                  >
                    <span>נושא הבא</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Full Run-of-Show Agenda Checklist */}
              <div className="rounded-2xl bg-[#121620] border border-slate-800 p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-300">סדר הפרק המלא ({topics.length} נושאים)</h4>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {topics.map((topic, idx) => (
                    <div
                      key={topic.id}
                      onClick={() => {
                        setActiveTopicIndex(idx);
                        setActiveTopicSeconds(0);
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        idx === activeTopicIndex
                          ? 'bg-indigo-600/20 border-indigo-500/60 text-white font-bold'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            idx === activeTopicIndex ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="text-xs truncate">{topic.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                          {topic.estimatedMinutes} דק'
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Remote Camera QR Code Modal */}
      <RemoteCamModal
        roomId={`castflow-${episode.id}`}
        isOpen={isRemoteModalOpen}
        onClose={() => setIsRemoteModalOpen(false)}
        onSelectRemoteStream={() => setIsUsingRemoteCam(true)}
        connectionStatus={remoteConnectionStatus}
      />

      {/* Giant Full-Screen Studio Clock */}
      <GiantStudioClock
        isOpen={isGiantClockOpen}
        onClose={() => setIsGiantClockOpen(false)}
        isRecording={isRecording}
        isPaused={isPaused}
        recordedSeconds={recordedSeconds}
        activeTopicSeconds={activeTopicSeconds}
        currentTopic={currentTopic}
        currentTopicIndex={activeTopicIndex}
        totalTopicsCount={topics.length}
        episode={episode}
        stream={currentStream}
        onTogglePause={togglePauseRecording}
        onStopRecording={stopRecording}
        onAddMarker={addMarker}
        onNextTopic={handleNextTopic}
        onPrevTopic={handlePrevTopic}
      />

      {/* Cloud & CDN Integrations Modal (BunnyCDN & uPress) */}
      <CloudIntegrationsModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />

      {/* Pre-Flight Sound & Video Hardware Diagnostics Modal */}
      <StudioHardwareDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        stream={currentStream}
        videoElement={videoElementRef.current}
        isAudioOnly={isAudioOnly}
        videoResolution={videoResolution}
        micGain={micGain}
        noiseSuppression={noiseSuppression}
        onGainChange={handleGainChange}
        onToggleNoiseSuppression={handleToggleNoiseSuppression}
      />

      {/* Remote Guest Studio Invite & Layout Modal */}
      <GuestInviteModal
        episode={episode}
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        guestStatus={guestConnectionStatus}
        guestInfo={guestInfo}
        layoutMode={guestLayout}
        onChangeLayout={(layout) => setGuestLayout(layout)}
        guestVolume={guestVolume}
        onChangeGuestVolume={(vol) => setGuestVolume(vol)}
      />

      {/* Audio-Only Videocast Stage Background Customizer Modal */}
      <AudioStageBackgroundModal
        isOpen={isAudioStageModalOpen}
        onClose={() => setIsAudioStageModalOpen(false)}
        config={audioStageConfig}
        onChangeConfig={(newCfg) => setAudioStageConfig(newCfg)}
        podcastId={episode.podcastId}
      />
    </div>
  );
}
