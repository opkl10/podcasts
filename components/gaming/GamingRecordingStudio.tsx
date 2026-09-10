'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  CircleDot
} from 'lucide-react';
import { 
  getMediaDevices, 
  StudioAudioProcessor, 
  getVideoConstraints, 
  VideoResolution, 
  getScreenCaptureStream, 
  GamingAudioMixer 
} from '@/lib/mediaManager';
import { StudioWebRTCReceiver } from '@/lib/webrtcClient';
import { Episode, TimestampMarker, AudioInputDevice, VideoInputDevice } from '@/lib/types';
import { saveMediaBlob, saveEpisode, formatTime } from '@/lib/storage';
import PostRecordingReview from '@/components/studio/PostRecordingReview';
import RemoteCamModal from '@/components/studio/RemoteCamModal';

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

  // Primary Facecam Stream
  const [facecamStream, setFacecamStream] = useState<MediaStream | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);

  // Wireless iPhone RemoteCam (WebRTC)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isUsingRemoteCam, setIsUsingRemoteCam] = useState(false);
  const [isRemoteModalOpen, setIsRemoteModalOpen] = useState(false);
  const [remoteConnectionStatus, setRemoteConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const webrtcReceiverRef = useRef<StudioWebRTCReceiver | null>(null);

  // Gameplay Capture Streams (Screen / Window vs Elgato Capture Card)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenCapturing, setIsScreenCapturing] = useState(false);
  const [captureCardStream, setCaptureCardStream] = useState<MediaStream | null>(null);
  const [selectedCaptureCardId, setSelectedCaptureCardId] = useState<string>('');
  const [gameplaySourceType, setGameplaySourceType] = useState<'screen' | 'capture_card' | null>(null);

  // Facecam Visual Styling & Layout Engine
  const [facecamLayout, setFacecamLayout] = useState<'solo_game' | 'pip_br' | 'pip_bl' | 'pip_tr' | 'pip_tl' | 'solo_cam' | 'split'>('pip_br');
  const [facecamShape, setFacecamShape] = useState<'rounded' | 'circle' | 'rectangle'>('rounded');
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
  const gameplayVideoRef = useRef<HTMLVideoElement | null>(null);
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

  // 1. Initial Device Detection
  useEffect(() => {
    async function loadDevices() {
      const { audioInputs, videoInputs } = await getMediaDevices();
      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);

      // Auto-select first microphone
      if (audioInputs.length > 0 && !selectedAudioId) {
        setSelectedAudioId(audioInputs[0].deviceId);
      }

      // Auto-detect Elgato or hardware capture cards
      const elgatoCard = videoInputs.find(v => v.isCaptureCard);
      if (elgatoCard && !selectedCaptureCardId) {
        setSelectedCaptureCardId(elgatoCard.deviceId);
      }

      // Auto-select regular webcam for facecam (exclude capture card)
      const normalCams = videoInputs.filter(v => !v.isCaptureCard);
      if (normalCams.length > 0 && !selectedVideoId) {
        const preferredCam = normalCams.find(v => v.isIPhone || v.isContinuity) || normalCams[0];
        setSelectedVideoId(preferredCam.deviceId);
      }
    }
    loadDevices();
  }, []);

  // 2. Initialize or Update Primary Facecam Stream
  useEffect(() => {
    let active = true;

    async function initFacecam() {
      if (isUsingRemoteCam && remoteStream) return;

      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedAudioId ? { deviceId: { exact: selectedAudioId }, echoCancellation: true, noiseSuppression } : true,
          video: selectedVideoId 
            ? getVideoConstraints(videoResolution === '4k' ? '1080p' : videoResolution, selectedVideoId)
            : getVideoConstraints('1080p')
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        if (facecamStream) {
          facecamStream.getTracks().forEach(t => t.stop());
        }

        setFacecamStream(stream);
      } catch (err) {
        console.warn('Facecam initialization failed:', err);
      }
    }

    initFacecam();

    return () => {
      active = false;
    };
  }, [selectedVideoId, selectedAudioId, isUsingRemoteCam, noiseSuppression]);

  // Connect facecamStream to hidden video element
  useEffect(() => {
    const activeStream = isUsingRemoteCam && remoteStream ? remoteStream : facecamStream;
    if (facecamVideoRef.current && activeStream) {
      facecamVideoRef.current.srcObject = activeStream;
      facecamVideoRef.current.play().catch(() => {});
    }
  }, [facecamStream, remoteStream, isUsingRemoteCam]);

  // Connect gameplay stream (screen capture or capture card) to hidden video element
  useEffect(() => {
    const activeStream = screenStream || captureCardStream;
    if (gameplayVideoRef.current && activeStream) {
      gameplayVideoRef.current.srcObject = activeStream;
      gameplayVideoRef.current.play().catch(() => {});
    }
  }, [screenStream, captureCardStream]);

  // 3. Screen Capture Controller (60FPS with System Audio)
  const handleStartScreenCapture = async () => {
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

  // 4. Hardware Capture Card (Elgato / Cam Link) Controller
  const handleSelectCaptureCard = async (deviceId: string) => {
    setSelectedCaptureCardId(deviceId);
    if (!deviceId) {
      if (captureCardStream) {
        captureCardStream.getTracks().forEach(t => t.stop());
        setCaptureCardStream(null);
      }
      if (gameplayVideoRef.current && gameplaySourceType === 'capture_card') {
        gameplayVideoRef.current.srcObject = null;
      }
      return;
    }

    try {
      const is4K = videoResolution === '4k';
      const targetW = is4K ? 3840 : 1920;
      const targetH = is4K ? 2160 : 1080;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId }, 
          width: { ideal: targetW }, 
          height: { ideal: targetH }, 
          frameRate: { ideal: 60, max: 60 } 
        },
        audio: true
      });
      setCaptureCardStream(stream);
      setGameplaySourceType('capture_card');
    } catch (err) {
      console.error('Failed to open capture card stream:', err);
    }
  };

  // 5. Dual Audio Mixer Engine (Mic + Gameplay Sound)
  useEffect(() => {
    if (!gamingMixerRef.current) {
      gamingMixerRef.current = new GamingAudioMixer((micLvl, gameLvl) => {
        setMicAudioLevel(micLvl);
        setGameAudioLevel(gameLvl);
      });
    }

    const activeMicStream = isUsingRemoteCam && remoteStream ? remoteStream : facecamStream;
    const activeGameStream = screenStream || captureCardStream;

    gamingMixerRef.current.setup(activeMicStream, activeGameStream);
    gamingMixerRef.current.setMicVolume(micGain);
    gamingMixerRef.current.setGameVolume(gameAudioVolume);

    return () => {
      // Don't stop immediately on every re-render, keep instance alive
    };
  }, [facecamStream, remoteStream, isUsingRemoteCam, screenStream, captureCardStream]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setMicVolume(micGain);
    }
  }, [micGain]);

  useEffect(() => {
    if (gamingMixerRef.current) {
      gamingMixerRef.current.setGameVolume(gameAudioVolume);
    }
  }, [gameAudioVolume]);

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
        ctx.drawImage(gameVideo, 0, 0, W, H);
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

      // --- LAYER 2: Facecam Multi-Cam (Webcam / iPhone / Cam Link) ---
      const faceVideo = facecamVideoRef.current;
      const hasFacecam = faceVideo && faceVideo.readyState >= 2 && facecamLayout !== 'solo_game' && !isVideoMuted;

      if (hasFacecam) {
        ctx.save();

        let fw = 460 * scale;
        let fh = 260 * scale;
        if (facecamSize === 'small') { fw = 360 * scale; fh = 202 * scale; }
        else if (facecamSize === 'large') { fw = 560 * scale; fh = 315 * scale; }

        if (facecamShape === 'circle') {
          fh = fw; // 1:1 aspect for circle
        }

        const margin = 40 * scale;
        let fx = W - fw - margin;
        let fy = H - fh - margin;

        if (facecamLayout === 'pip_bl') {
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
        if (isMirrored && !isUsingRemoteCam) {
          ctx.translate(fx + fw, fy);
          ctx.scale(-1, 1);
          ctx.drawImage(faceVideo, 0, 0, fw, fh);
        } else {
          ctx.drawImage(faceVideo, fx, fy, fw, fh);
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
    facecamSize,
    facecamGlowColor,
    facecamGlowBlur,
    facecamBorderWidth,
    gamerTag,
    showGamerHud,
    isMirrored,
    isVideoMuted,
    isUsingRemoteCam,
    isRecording
  ]);

  // 8. Recording Engine (High Bitrate 60FPS Single Video File)
  const startRecording = () => {
    try {
      const canvasStream = gamingCompositeStreamRef.current || gamingCompositorCanvasRef.current?.captureStream(60);
      if (!canvasStream) {
        alert('שגיאה באתחול קנבס הקלטת גיימינג.');
        return;
      }

      const compositeVideoTrack = canvasStream.getVideoTracks()[0];
      const activeMicStream = isUsingRemoteCam && remoteStream ? remoteStream : facecamStream;
      const activeGameStream = screenStream || captureCardStream;

      const mixedAudioStream = gamingMixerRef.current?.setup(activeMicStream, activeGameStream);
      const mixedAudioTrack = mixedAudioStream?.getAudioTracks()[0] || activeMicStream?.getAudioTracks()[0];

      const recordStream = new MediaStream([compositeVideoTrack]);
      if (mixedAudioTrack) {
        recordStream.addTrack(mixedAudioTrack);
      }

      const targetVideoBitrate = videoResolution === '4k' 
        ? 45000000 // 45 Mbps for 4K UHD 60FPS
        : videoResolution === '1080p'
        ? 12000000 // 12 Mbps for 1080p FHD 60FPS
        : 6000000;

      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

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

      recorder.onstop = async () => {
        const fullVideoBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(fullVideoBlob);
        setRecordedVideoBlob(fullVideoBlob);
        setRecordedVideoUrl(videoUrl);

        const finalDuration = recordedSecondsRef.current || recordedSeconds;
        const blobKey = `rec_${episode.id}_${Date.now()}`;

        try {
          await saveMediaBlob(blobKey, fullVideoBlob);
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
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const toggleMic = () => {
    const stream = isUsingRemoteCam && remoteStream ? remoteStream : facecamStream;
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
        audioBlob={recordedAudioBlob}
        videoUrl={recordedVideoUrl}
        durationSeconds={recordedSecondsRef.current || recordedSeconds}
        markers={markersRef.current.length > 0 ? markersRef.current : markers}
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
      {/* Hidden Videos used for Canvas Composite Rendering */}
      <video ref={facecamVideoRef} playsInline autoPlay muted className="hidden" />
      <video ref={gameplayVideoRef} playsInline autoPlay muted className="hidden" />

      {/* TOP HEADER & STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#12162a] via-[#101424] to-[#0c0f1d] border border-purple-500/20 shadow-2xl">
        <div className="flex items-center gap-3">
          <Link
            href={`/episodes/${episode.id}`}
            className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 border border-slate-700/60 transition-colors"
            title="חזרה לפרטי הפרק"
          >
            <ArrowRight className="w-4 h-4" />
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
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-950/60 active:scale-95 transition-all border border-purple-400/40"
            >
              <CircleDot className="w-4 h-4 text-white" />
              <span>התחל הקלטת גיימינג</span>
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
      <div className="relative rounded-3xl overflow-hidden bg-black border-2 border-purple-500/30 shadow-2xl shadow-purple-950/40">
        <canvas
          ref={gamingCompositorCanvasRef}
          className="w-full aspect-video bg-[#090d16] object-contain block cursor-pointer"
          title="קנבס הקלטת גיימינג ב-60FPS"
        />

        {/* Floating Top-Left Layout Selector & Hotkeys Bar */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-purple-500/30 shadow-2xl">
          {[
            { id: 'solo_game', label: 'משחק בלבד', hotkey: '1', icon: Monitor },
            { id: 'pip_br', label: 'חלונית פינה', hotkey: '2', icon: LayoutGrid },
            { id: 'solo_cam', label: 'מצלמה בלבד', hotkey: '3', icon: Video },
            { id: 'split', label: 'מסך חצי-חצי', hotkey: '4', icon: SplitSquareVertical },
          ].map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setFacecamLayout(l.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                facecamLayout === l.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <l.icon className="w-3.5 h-3.5" />
              <span>{l.label}</span>
              <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/40 text-purple-300 border border-purple-500/30">
                {l.hotkey}
              </kbd>
            </button>
          ))}
        </div>

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
        
        {/* CARD 1: GAMEPLAY & CAPTURE SOURCES */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#141226]/95 via-[#0e1222]/95 to-[#0b0e18]/95 border border-purple-500/30 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-purple-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <MonitorPlay className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">מקור גיימפליי ומסך</h3>
                  <p className="text-[11px] text-slate-400">לכידת חלון / מסך 60FPS או כרטיס אלגטו</p>
                </div>
              </div>
              {isScreenCapturing && (
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                  60 FPS Live
                </span>
              )}
            </div>

            {/* Screen Capture Action Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">לכידת משחק / מסך מחשב:</label>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                  {videoResolution === '4k' ? '4K UHD (3840×2160)' : videoResolution === '1080p' ? 'Full HD (1920×1080)' : 'HD (1280×720)'}
                </span>
              </div>

              {isScreenCapturing ? (
                <button
                  type="button"
                  onClick={handleStopScreenCapture}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Square className="w-4 h-4" />
                  <span>⏹️ עצור לכידת מסך</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartScreenCapture}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black transition-all shadow-lg shadow-purple-950/50 active:scale-95 border border-purple-400/30"
                >
                  <MonitorPlay className="w-4 h-4 text-purple-200" />
                  <span>🖥️ בחר מסך / חלון משחק ({videoResolution === '4k' ? '4K 60FPS' : 'FHD 60FPS'})</span>
                </button>
              )}
            </div>

            {/* Hardware Capture Card (Elgato / Cam Link) */}
            <div className="space-y-2 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Cast className="w-4 h-4 text-cyan-400" />
                  <span>לוכד מסך חיצוני / Elgato:</span>
                </label>
                {videoDevices.some(d => d.isCaptureCard) && (
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                    זוהה אלגטו ✓
                  </span>
                )}
              </div>

              <select
                value={selectedCaptureCardId}
                onChange={(e) => handleSelectCaptureCard(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value="">-- ללא כרטיס לכידה (השתמש בלכידת מסך) --</option>
                {videoDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.isCaptureCard ? `🎮 ${d.label} (לוכד אלגטו/HDMI)` : d.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                תומך באופן מקורי ב-Elgato 4K X, 4K Pro, HD60 X/S+, Cam Link 4K, AVerMedia וכרטיסי HDMI USB.
              </p>
            </div>
          </div>

          {/* Card 1 Footer */}
          <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-200/90 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400 shrink-0" />
            <span>איכות שידור מאסטר: 60FPS עם ביטרייט של {videoResolution === '4k' ? '45Mbps (4K Ultra HD)' : '12Mbps (1080p FHD)'}.</span>
          </div>
        </div>

        {/* CARD 2: FACECAM MULTI-CAM & STYLING */}
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
                  <p className="text-[11px] text-slate-400">Webcam / iPhone Continuity / Multi-Cam</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRemoteModalOpen(true)}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-500/10 px-2.5 py-1.5 rounded-xl border border-indigo-500/30 transition-all hover:bg-indigo-500/20"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>📱 אייפון WebRTC</span>
              </button>
            </div>

            {/* Camera Selector Dropdown */}
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
                {remoteStream && (
                  <option value="remote-iphone">📱 iPhone Remote Camera (חיבור WebRTC אלחוטי)</option>
                )}
                {videoDevices
                  .filter(v => v.deviceId !== selectedCaptureCardId)
                  .map(v => (
                    <option key={v.deviceId} value={v.deviceId}>
                      {v.isIPhone || v.isContinuity ? `📱 ${v.label} (iPhone Continuity)` : v.label}
                    </option>
                  ))}
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

            {/* Facecam Shape & Size Pickers */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
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

              {/* Size */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400">גודל חלונית:</label>
                <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'small', label: 'קטן' },
                    { id: 'medium', label: 'בינוני' },
                    { id: 'large', label: 'גדול' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFacecamSize(s.id as any)}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                        facecamSize === s.id ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
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

        {/* CARD 3: DUAL AUDIO MIXER */}
        <div className="p-5 rounded-3xl bg-gradient-to-b from-[#141226]/95 via-[#0e1222]/95 to-[#0b0e18]/95 border border-teal-500/30 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-teal-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-teal-600/20 text-teal-400 border border-teal-500/30">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">מיקסר אודיו כפול (Dual Mixer)</h3>
                  <p className="text-[11px] text-slate-400">ערוץ מיקרופון גיימר + סאונד משחק</p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800">
                WebAudio Master
              </span>
            </div>

            {/* Microphone Selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 block">בחר מיקרופון:</label>
              <select
                value={selectedAudioId}
                onChange={(e) => setSelectedAudioId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white focus:outline-none focus:border-teal-500 transition-colors"
              >
                {audioDevices.map(a => (
                  <option key={a.deviceId} value={a.deviceId}>
                    🎙️ {a.label || 'מיקרופון ברירת מחדל'}
                  </option>
                ))}
              </select>
            </div>

            {/* Channel 1: Gamer Microphone */}
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Mic className="w-4 h-4 text-indigo-400" />
                  <span>מיקרופון סטרימר:</span>
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

              {/* Mic Slider + Real-Time VU */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={micGain}
                  onChange={(e) => setMicGain(parseFloat(e.target.value))}
                  className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="w-20 h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-75"
                    style={{ width: `${Math.min(100, micAudioLevel)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Channel 2: Game & System Audio */}
            <div className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Gamepad2 className="w-4 h-4 text-purple-400" />
                  <span>סאונד משחק ומחשב:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-purple-400">{Math.round(gameAudioVolume * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setGameAudioVolume(prev => prev > 0 ? 0 : 1.0)}
                    className={`p-1.5 rounded-lg border text-xs ${
                      gameAudioVolume === 0 ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                    title={gameAudioVolume === 0 ? 'הפעל סאונד משחק' : 'השתק סאונד משחק'}
                  >
                    {gameAudioVolume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Game Audio Slider + Real-Time VU */}
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={gameAudioVolume}
                  onChange={(e) => setGameAudioVolume(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
                <div className="w-20 h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, gameAudioLevel)}%` }}
                  />
                </div>
              </div>
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
              onClick={async () => {
                const { audioInputs, videoInputs } = await getMediaDevices();
                setAudioDevices(audioInputs);
                setVideoDevices(videoInputs);
              }}
              className="text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/80 transition-all hover:bg-slate-800"
              title="רענן התקנים"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>רענן התקנים</span>
            </button>
          </div>
        </div>

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
