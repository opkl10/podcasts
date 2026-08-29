'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Episode, SubtitleItem, MovieFactCard, ElementTransform } from '@/lib/types';
import { getMediaBlob, saveMediaBlob, formatTime, getPermanentLogo, savePermanentLogo, saveEpisode } from '@/lib/storage';
import { trimAudioBlob } from '@/lib/audioUtils';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Scissors, 
  Download, 
  Sliders, 
  Volume2, 
  VolumeX, 
  Image as ImageIcon, 
  Sparkles, 
  Tv, 
  Eye, 
  EyeOff, 
  Radio, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  Upload, 
  Film, 
  Quote, 
  Star, 
  AlertTriangle, 
  Layers, 
  Palette, 
  Music, 
  Video, 
  Activity, 
  Clock, 
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Share2,
  Subtitles,
  FolderOpen,
  Move,
  Lock,
  Unlock
} from 'lucide-react';
import ImageStockPickerModal from '../studio/ImageStockPickerModal';
import DraggableOverlay from '../studio/DraggableOverlay';

interface AudioEditorAudiogramStudioProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
  onUpdateEpisode?: (updated: Episode) => void;
}

export type WaveformStyle = 'bars' | 'sine' | 'radial' | 'mirror' | 'pulse' | 'liquid';
export type WaveformColorMode = 'single' | 'gradient';

const BACKGROUND_PRESETS = [
  { id: 'obsidian', name: 'Obsidian Void', style: 'linear-gradient(180deg, #0b0f19 0%, #05070c 100%)' },
  { id: 'cyberpunk', name: 'Neon Cyberpunk', style: 'linear-gradient(135deg, #1e1035 0%, #0c0824 50%, #050814 100%)' },
  { id: 'cinema', name: 'Cinema Velvet', style: 'linear-gradient(180deg, #1a0f0f 0%, #0d0606 50%, #000000 100%)' },
  { id: 'galaxy', name: 'Cosmic Galaxy', style: 'linear-gradient(135deg, #110d2b 0%, #060b1e 50%, #02030a 100%)' },
  { id: 'gold', name: 'Golden Luxury', style: 'linear-gradient(135deg, #1c1508 0%, #0f0c05 50%, #050402 100%)' },
  { id: 'emerald', name: 'Emerald Studio', style: 'linear-gradient(180deg, #061a14 0%, #030d0a 50%, #010403 100%)' },
  { id: 'midnight', name: 'Midnight Studio', style: 'linear-gradient(180deg, #091e3a 0%, #050e1d 50%, #02060c 100%)' },
  { id: 'royal', name: 'Royal Indigo', style: 'linear-gradient(135deg, #1f0b38 0%, #0e051d 50%, #030108 100%)' }
];

const GRADIENT_PRESETS = [
  { id: 'cyberpunk', name: 'Cyberpunk (ורוד לציאן)', start: '#ec4899', end: '#06b6d4' },
  { id: 'sunset', name: 'Sunset Flame (ענבר לאדום)', start: '#f59e0b', end: '#ef4444' },
  { id: 'galaxy', name: 'Cosmic Galaxy (אינדיגו לסגול)', start: '#6366f1', end: '#d946ef' },
  { id: 'emerald', name: 'Emerald Stream (ירוק לטורקיז)', start: '#10b981', end: '#3b82f6' },
  { id: 'gold', name: 'Golden Glow (זהב לענבר)', start: '#fbbf24', end: '#b45309' },
  { id: 'pure_white', name: 'Neon White (לבן לציאן)', start: '#ffffff', end: '#38bdf8' }
];

export default function AudioEditorAudiogramStudio({
  episode,
  isOpen,
  onClose,
  onUpdateEpisode
}: AudioEditorAudiogramStudioProps) {
  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Audio Trimming & Cutting State
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [isTrimming, setIsTrimming] = useState<boolean>(false);
  const [isExportingVideo, setIsExportingVideo] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number>(0);

  // Background & Graphics State
  const [bgType, setBgType] = useState<'preset' | 'image' | 'solid'>('preset');
  const [selectedBgPreset, setSelectedBgPreset] = useState<string>(BACKGROUND_PRESETS[0].id);
  const [customBgImage, setCustomBgImage] = useState<string>('');
  const [bgBlur, setBgBlur] = useState<number>(0);
  const [bgDim, setBgDim] = useState<number>(30);
  const [solidColor, setSolidColor] = useState<string>('#0b0f19');
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgImageObjectRef = useRef<HTMLImageElement | null>(null);

  // Permanent Logo State (loaded from storage)
  const [logoConfig, setLogoConfig] = useState<{
    show: boolean;
    url: string;
    opacity: number;
    size: number;
    positionPreset: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  }>({
    show: true,
    url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&q=80',
    opacity: 0.9,
    size: 64,
    positionPreset: 'top-right'
  });

  // Overlays State (Facts, Quote, Ratings, Title Banner, Spoiler, Poster PIP, Subtitles)
  const [showFactOverlay, setShowFactOverlay] = useState<boolean>(true);
  const [selectedFactIndex, setSelectedFactIndex] = useState<number>(0);
  const [showQuoteOverlay, setShowQuoteOverlay] = useState<boolean>(false);
  const [quoteText, setQuoteText] = useState<string>('״הקולנוע הוא שפה אוניברסלית של חלומות...״');
  const [quoteSpeaker, setQuoteSpeaker] = useState<string>('המנחה');
  const [showRatingOverlay, setShowRatingOverlay] = useState<boolean>(false);
  const [showBannerOverlay, setShowBannerOverlay] = useState<boolean>(true);
  const [showSpoilerOverlay, setShowSpoilerOverlay] = useState<boolean>(false);
  const [showPosterPip, setShowPosterPip] = useState<boolean>(false);
  const [posterUrl, setPosterUrl] = useState<string>('https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80');
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);

  // Drag & Transform States for Overlays (גרירה ושינוי גודל)
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [logoTransform, setLogoTransform] = useState<ElementTransform>({ x: 80, y: 5, scale: 1.0 });
  const [factTransform, setFactTransform] = useState<ElementTransform>({ x: 5, y: 8, scale: 1.0 });
  const [quoteTransform, setQuoteTransform] = useState<ElementTransform>({ x: 25, y: 65, scale: 1.0 });
  const [bannerTransform, setBannerTransform] = useState<ElementTransform>({ x: 65, y: 78, scale: 1.0 });
  const [posterTransform, setPosterTransform] = useState<ElementTransform>({ x: 5, y: 45, scale: 1.0 });
  const [subtitleTransform, setSubtitleTransform] = useState<ElementTransform>({ x: 15, y: 78, scale: 1.0 });

  // Waveform Customization State
  const [waveformStyle, setWaveformStyle] = useState<WaveformStyle>('bars');
  const [waveformColorMode, setWaveformColorMode] = useState<WaveformColorMode>('gradient');
  const [singleColor, setSingleColor] = useState<string>('#06b6d4');
  const [selectedGradient, setSelectedGradient] = useState<string>(GRADIENT_PRESETS[0].id);
  const [customGradStart, setCustomGradStart] = useState<string>('#ec4899');
  const [customGradEnd, setCustomGradEnd] = useState<string>('#06b6d4');
  const [waveformPosition, setWaveformPosition] = useState<'center' | 'bottom' | 'top'>('center');
  const [waveformHeight, setWaveformHeight] = useState<number>(100);
  const [waveformSensitivity, setWaveformSensitivity] = useState<number>(1.2);

  // Tabs
  const [activeTab, setActiveTab] = useState<'trimmer' | 'waveform' | 'background' | 'overlays' | 'export'>('waveform');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);

  // DOM & Audio Nodes Refs
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  const movieFacts = episode.movieFacts || [];
  const currentFact = movieFacts[selectedFactIndex] || movieFacts[0] || null;
  const activeSubtitle = (episode.subtitles || []).find(s => currentTime >= s.startTime && currentTime <= s.endTime);

  // 1. Initialize Audio Source & Permanent Logo on Open
  useEffect(() => {
    if (!isOpen) return;

    // Load Permanent Logo
    const savedLogo = getPermanentLogo(episode.podcastId);
    if (savedLogo) {
      setLogoConfig({
        show: savedLogo.showByDefault ?? true,
        url: savedLogo.url,
        opacity: savedLogo.opacity ?? 0.9,
        size: savedLogo.size ?? 64,
        positionPreset: savedLogo.positionPreset ?? 'top-right'
      });
    }

    // Load Media Blob
    const loadMedia = async () => {
      let blob: Blob | null = null;
      if (episode.recording?.audioBlobKey) {
        blob = await getMediaBlob(episode.recording.audioBlobKey);
      } else if (episode.recording?.videoBlobKey) {
        blob = await getMediaBlob(episode.recording.videoBlobKey);
      } else {
        blob = await getMediaBlob(`emergency_rec_${episode.id}`);
      }

      if (blob) {
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      }
    };

    loadMedia();
  }, [isOpen, episode]);

  // 2. Setup Web Audio API Analyser for speech-responsive waveforms
  const setupWebAudio = () => {
    if (audioContextRef.current || !audioElementRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      analyserRef.current = analyser;

      const source = ctx.createMediaElementSource(audioElementRef.current);
      sourceNodeRef.current = source;

      source.connect(analyser);
    } catch (e) {
      console.warn('Web Audio setup notice:', e);
    }
  };

  // 3. Preload Background & Logo Images
  useEffect(() => {
    if (customBgImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = customBgImage;
      img.onload = () => {
        bgImageObjectRef.current = img;
      };
    } else {
      bgImageObjectRef.current = null;
    }
  }, [customBgImage]);

  const logoImageObjectRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (logoConfig.url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = logoConfig.url;
      img.onload = () => {
        logoImageObjectRef.current = img;
      };
    } else {
      logoImageObjectRef.current = null;
    }
  }, [logoConfig.url]);

  // 4. Main Stage Canvas Render Loop (Draws Background + Logo + Overlays + Dynamic Waveforms + Subtitles)
  useEffect(() => {
    if (!isOpen) return;

    let animId: number;

    const renderStage = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(renderStage);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(renderStage);
        return;
      }

      const W = canvas.width;
      const H = canvas.height;

      // A. DRAW BACKGROUND
      ctx.clearRect(0, 0, W, H);

      if (bgType === 'image' && bgImageObjectRef.current) {
        try {
          ctx.drawImage(bgImageObjectRef.current, 0, 0, W, H);
          if (bgDim > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${bgDim / 100})`;
            ctx.fillRect(0, 0, W, H);
          }
        } catch (e) {
          ctx.fillStyle = '#080b12';
          ctx.fillRect(0, 0, W, H);
        }
      } else if (bgType === 'solid') {
        ctx.fillStyle = solidColor || '#0b0f19';
        ctx.fillRect(0, 0, W, H);
      } else if (bgType === 'preset') {
        const preset = BACKGROUND_PRESETS.find(p => p.id === selectedBgPreset) || BACKGROUND_PRESETS[0];
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        if (preset.id === 'cyberpunk') {
          grad.addColorStop(0, '#1e1035');
          grad.addColorStop(0.5, '#0c0824');
          grad.addColorStop(1, '#050814');
        } else if (preset.id === 'cinema') {
          grad.addColorStop(0, '#1a0f0f');
          grad.addColorStop(0.5, '#0d0606');
          grad.addColorStop(1, '#000000');
        } else if (preset.id === 'galaxy') {
          grad.addColorStop(0, '#110d2b');
          grad.addColorStop(0.5, '#060b1e');
          grad.addColorStop(1, '#02030a');
        } else if (preset.id === 'gold') {
          grad.addColorStop(0, '#1c1508');
          grad.addColorStop(0.5, '#0f0c05');
          grad.addColorStop(1, '#050402');
        } else if (preset.id === 'emerald') {
          grad.addColorStop(0, '#061a14');
          grad.addColorStop(0.5, '#030d0a');
          grad.addColorStop(1, '#010403');
        } else if (preset.id === 'midnight') {
          grad.addColorStop(0, '#091e3a');
          grad.addColorStop(0.5, '#050e1d');
          grad.addColorStop(1, '#02060c');
        } else if (preset.id === 'royal') {
          grad.addColorStop(0, '#1f0b38');
          grad.addColorStop(0.5, '#0e051d');
          grad.addColorStop(1, '#030108');
        } else {
          grad.addColorStop(0, '#0f172a');
          grad.addColorStop(1, '#020617');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = '#080b12';
        ctx.fillRect(0, 0, W, H);
      }

      // Subtle Background Grid & Star Accents
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridGap = 40;
      for (let x = 0; x < W; x += gridGap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridGap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // B. EXTRACT AUDIO FREQUENCIES / TIME DOMAIN
      let freqArray = new Uint8Array(64);
      let timeArray = new Uint8Array(256);

      if (analyserRef.current && isPlaying) {
        freqArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqArray);
        timeArray = new Uint8Array(analyserRef.current.fftSize);
        analyserRef.current.getByteTimeDomainData(timeArray);
      } else {
        // Idle ambient gentle breathing
        const t = performance.now() * 0.003;
        for (let i = 0; i < 64; i++) {
          freqArray[i] = Math.sin(t + i * 0.2) * 15 + 20;
        }
      }

      // C. DETERMINE WAVEFORM COLOR / GRADIENT STROKE
      let waveFill: string | CanvasGradient = singleColor;
      if (waveformColorMode === 'gradient') {
        const gradObj = GRADIENT_PRESETS.find(g => g.id === selectedGradient);
        const startColor = gradObj ? gradObj.start : customGradStart;
        const endColor = gradObj ? gradObj.end : customGradEnd;
        const linear = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
        linear.addColorStop(0, startColor);
        linear.addColorStop(1, endColor);
        waveFill = linear;
      }

      // D. DRAW SELECTED WAVEFORM STYLE
      const waveCenterY = waveformPosition === 'center' ? H * 0.52 : waveformPosition === 'bottom' ? H * 0.72 : H * 0.32;

      // 1. BARS (Vertical Spectrum Bars)
      if (waveformStyle === 'bars') {
        const barCount = 48;
        const barWidth = (W * 0.6) / barCount;
        const startX = W * 0.2;

        ctx.fillStyle = waveFill;
        for (let i = 0; i < barCount; i++) {
          const rawVal = freqArray[i * 2] || 10;
          const height = Math.max(4, (rawVal / 255) * waveformHeight * waveformSensitivity);
          const x = startX + i * barWidth;
          const y = waveCenterY - height / 2;

          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - 3, height, 3);
          ctx.fill();
        }
      }

      // 2. SINE WAVE
      else if (waveformStyle === 'sine') {
        ctx.strokeStyle = waveFill;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();

        const points = 64;
        const step = (W * 0.7) / points;
        const startX = W * 0.15;

        for (let i = 0; i < points; i++) {
          const rawVal = ((timeArray[i * 2] || 128) - 128) / 128;
          const y = waveCenterY + rawVal * (waveformHeight * 0.7) * waveformSensitivity;
          const x = startX + i * step;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 3. RADIAL CIRCLE VISUALIZER
      else if (waveformStyle === 'radial') {
        const cx = W / 2;
        const cy = waveCenterY;
        const baseRadius = 65;
        const bars = 36;

        ctx.strokeStyle = waveFill;
        ctx.lineWidth = 3;

        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2;
          const rawVal = freqArray[i] || 15;
          const barLen = Math.max(6, (rawVal / 255) * (waveformHeight * 0.6) * waveformSensitivity);

          const x1 = cx + Math.cos(angle) * baseRadius;
          const y1 = cy + Math.sin(angle) * baseRadius;
          const x2 = cx + Math.cos(angle) * (baseRadius + barLen);
          const y2 = cy + Math.sin(angle) * (baseRadius + barLen);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }

        // Center glowing radio icon
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius - 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. MIRROR DUAL-SIDE BARS
      else if (waveformStyle === 'mirror') {
        const count = 32;
        const halfWidth = (W * 0.3) / count;
        const centerX = W / 2;

        ctx.fillStyle = waveFill;
        for (let i = 0; i < count; i++) {
          const rawVal = freqArray[i * 2] || 10;
          const h = Math.max(4, (rawVal / 255) * waveformHeight * waveformSensitivity);

          // Right side
          const rx = centerX + i * halfWidth;
          ctx.beginPath();
          ctx.roundRect(rx, waveCenterY - h / 2, halfWidth - 2, h, 2);
          ctx.fill();

          // Left side
          const lx = centerX - (i + 1) * halfWidth;
          ctx.beginPath();
          ctx.roundRect(lx, waveCenterY - h / 2, halfWidth - 2, h, 2);
          ctx.fill();
        }
      }

      // 5. PULSE WAVE (Heartbeat)
      else if (waveformStyle === 'pulse') {
        ctx.strokeStyle = waveFill;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = typeof waveFill === 'string' ? waveFill : '#06b6d4';
        ctx.shadowBlur = 10;
        ctx.beginPath();

        const len = 60;
        const step = (W * 0.7) / len;
        const startX = W * 0.15;

        for (let i = 0; i < len; i++) {
          const rawVal = ((timeArray[i * 4] || 128) - 128) / 128;
          const y = waveCenterY + rawVal * (waveformHeight * 0.6) * waveformSensitivity;
          const x = startX + i * step;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 6. LIQUID SOUND WAVES
      else if (waveformStyle === 'liquid') {
        ctx.fillStyle = waveFill;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();

        const points = 40;
        const step = W / points;
        ctx.moveTo(0, H);

        for (let i = 0; i <= points; i++) {
          const rawVal = (freqArray[i] || 10) / 255;
          const y = waveCenterY + Math.sin(i * 0.5 + performance.now() * 0.003) * (waveformHeight * 0.3) - rawVal * 40;
          ctx.lineTo(i * step, y);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // E. DRAW ALL OVERLAYS DIRECTLY ON CANVAS (ENSURES 100% PREVIEW & VIDEO EXPORT FIDELITY)
      // 1. Logo
      if (logoConfig.show && logoImageObjectRef.current) {
        try {
          ctx.save();
          ctx.globalAlpha = logoConfig.opacity || 0.9;
          const lx = (logoTransform.x / 100) * W;
          const ly = (logoTransform.y / 100) * H;
          const lSize = (logoConfig.size || 64) * (logoTransform.scale || 1.0);
          ctx.drawImage(logoImageObjectRef.current, lx, ly, lSize, lSize);
          ctx.restore();
        } catch (e) {}
      }

      // 2. Fact Card Overlay
      if (showFactOverlay && currentFact) {
        try {
          ctx.save();
          const fx = (factTransform.x / 100) * W;
          const fy = (factTransform.y / 100) * H;
          const fScale = factTransform.scale || 1.0;
          ctx.translate(fx, fy);
          ctx.scale(fScale, fScale);

          ctx.fillStyle = 'rgba(10, 15, 25, 0.92)';
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(0, 0, 240, 80, 12);
          else ctx.rect(0, 0, 240, 80);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 10px sans-serif';
          ctx.direction = 'rtl';
          ctx.fillText(currentFact.source || 'עובדה על הסרט', 225, 20);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          const words = currentFact.fact.split(' ');
          let curL = '';
          let curY = 38;
          for (let w of words) {
            const test = curL + w + ' ';
            if (ctx.measureText(test).width > 210) {
              ctx.fillText(curL, 225, curY);
              curL = w + ' ';
              curY += 16;
              if (curY > 70) break;
            } else {
              curL = test;
            }
          }
          ctx.fillText(curL, 225, curY);
          ctx.restore();
        } catch (e) {}
      }

      // 3. Lower-Third / Title Banner
      if (showBannerOverlay) {
        try {
          ctx.save();
          const bx = (bannerTransform.x / 100) * W;
          const by = (bannerTransform.y / 100) * H;
          const bScale = bannerTransform.scale || 1.0;
          ctx.translate(bx, by);
          ctx.scale(bScale, bScale);

          ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(0, 0, 220, 48, 10);
          else ctx.rect(0, 0, 220, 48);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#818cf8';
          ctx.font = 'bold 10px sans-serif';
          ctx.direction = 'rtl';
          ctx.fillText(`CastFlow Studio • פרק ${episode.episodeNumber}`, 208, 18);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(episode.title.slice(0, 26), 208, 36);
          ctx.restore();
        } catch (e) {}
      }

      // 4. Subtitles
      if (showSubtitles && activeSubtitle) {
        try {
          ctx.save();
          const sx = (subtitleTransform.x / 100) * W;
          const sy = (subtitleTransform.y / 100) * H;
          const sScale = subtitleTransform.scale || 1.0;
          ctx.translate(sx, sy);
          ctx.scale(sScale, sScale);

          ctx.font = 'bold 20px sans-serif';
          ctx.direction = 'rtl';
          ctx.textAlign = 'center';
          const subText = activeSubtitle.text;
          const metrics = ctx.measureText(subText);
          const subW = metrics.width + 28;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(-subW / 2, -24, subW, 34, 10);
          else ctx.rect(-subW / 2, -24, subW, 34);
          ctx.fill();

          ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
          ctx.shadowBlur = 4;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(subText, 0, 0);
          ctx.restore();
        } catch (e) {}
      }

      animId = requestAnimationFrame(renderStage);
    };

    animId = requestAnimationFrame(renderStage);
    return () => cancelAnimationFrame(animId);
  }, [
    isOpen, 
    isPlaying, 
    bgType, 
    selectedBgPreset, 
    customBgImage,
    bgDim,
    solidColor,
    waveformStyle, 
    waveformColorMode, 
    singleColor, 
    selectedGradient, 
    customGradStart, 
    customGradEnd, 
    waveformPosition, 
    waveformHeight, 
    waveformSensitivity,
    logoConfig,
    logoTransform,
    showFactOverlay,
    currentFact,
    factTransform,
    showBannerOverlay,
    bannerTransform,
    showSubtitles,
    activeSubtitle,
    subtitleTransform
  ]);

  // Audio Playback Handlers
  const handleTogglePlay = () => {
    if (!audioElementRef.current) return;
    setupWebAudio();

    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }

    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play().catch(e => console.error(e));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioElementRef.current) return;
    setCurrentTime(audioElementRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioElementRef.current) return;
    const dur = audioElementRef.current.duration || 0;
    setDuration(dur);
    setTrimEnd(dur);
  };

  const handleSeek = (newTime: number) => {
    if (!audioElementRef.current) return;
    audioElementRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Slice / Cut Selected Audio Range
  const handlePerformTrim = async () => {
    if (!audioBlob || trimEnd <= trimStart) {
      alert('נא לבחור טווח חיתוך תקין');
      return;
    }
    setIsTrimming(true);
    try {
      const trimmedBlob = await trimAudioBlob(audioBlob, trimStart, trimEnd);
      const newUrl = URL.createObjectURL(trimmedBlob);
      setAudioBlob(trimmedBlob);
      setAudioUrl(newUrl);

      // Save trimmed blob to storage
      const newKey = `rec_trimmed_${Date.now()}`;
      await saveMediaBlob(newKey, trimmedBlob);

      const updatedEpisode: Episode = {
        ...episode,
        recording: {
          ...episode.recording!,
          audioBlobKey: newKey,
          duration: Math.round(trimEnd - trimStart)
        }
      };
      saveEpisode(updatedEpisode);
      if (onUpdateEpisode) onUpdateEpisode(updatedEpisode);

      alert(`המקטע נחתך בהצלחה! (${Math.round(trimEnd - trimStart)} שניות)`);
    } catch (e: any) {
      alert('שגיאה בחיתוך האודיו: ' + e.message);
    } finally {
      setIsTrimming(false);
    }
  };

  // Export Audiogram as MP4 / WebM Video (Bulletproof Web Audio + Canvas Stream)
  const handleExportAudiogramVideo = async () => {
    if (!canvasRef.current || !audioUrl) {
      alert('אין קובץ שמע זמין לייצוא הווידאו');
      return;
    }

    setIsExportingVideo(true);
    setExportProgress(5);

    try {
      const canvas = canvasRef.current;
      const canvasStream = canvas.captureStream(30);

      // Create isolated AudioContext for lossless recording
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const exportAudioCtx = new AudioCtx();
      if (exportAudioCtx.state === 'suspended') {
        await exportAudioCtx.resume();
      }

      // Fetch and decode the audio buffer directly
      setExportProgress(15);
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const decodedBuffer = await exportAudioCtx.decodeAudioData(arrayBuffer);

      setExportProgress(25);
      const durationSec = trimEnd > trimStart ? trimEnd - trimStart : (decodedBuffer.duration || 1);

      // Create BufferSourceNode and connect to MediaStreamDestination
      const bufferSource = exportAudioCtx.createBufferSource();
      bufferSource.buffer = decodedBuffer;

      // Connect to analyser so waveform animates during recording
      const exportAnalyser = exportAudioCtx.createAnalyser();
      exportAnalyser.fftSize = 512;
      exportAnalyser.smoothingTimeConstant = 0.8;
      analyserRef.current = exportAnalyser;

      const mediaDest = exportAudioCtx.createMediaStreamDestination();
      bufferSource.connect(exportAnalyser);
      bufferSource.connect(mediaDest);

      const combinedTracks = [
        ...canvasStream.getVideoTracks(),
        ...mediaDest.stream.getAudioTracks()
      ];
      const exportStream = new MediaStream(combinedTracks);

      let chosenMime = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(chosenMime)) chosenMime = 'video/webm';
      if (!MediaRecorder.isTypeSupported(chosenMime)) chosenMime = 'video/mp4';

      const recorder = new MediaRecorder(exportStream, {
        mimeType: chosenMime,
        videoBitsPerSecond: 5000000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: chosenMime });
        const ext = chosenMime.includes('mp4') ? 'mp4' : 'webm';
        const downloadUrl = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `audiogram-S${episode.season}E${episode.episodeNumber}-${episode.title.replace(/[^\w\d\u0590-\u05FF]/g, '_')}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        setIsExportingVideo(false);
        setIsPlaying(false);
        setExportProgress(100);
        exportAudioCtx.close().catch(() => {});
        alert('ייצוא הווידאו הושלם בהצלחה והקובץ ירד למחשב שלכם!');
      };

      // Start recording
      recorder.start(100);
      setIsPlaying(true);
      const startTimeSec = trimStart || 0;
      bufferSource.start(0, startTimeSec, durationSec);

      // Track progress
      const exportStartTime = performance.now();
      const progressTimer = setInterval(() => {
        const elapsed = (performance.now() - exportStartTime) / 1000;
        const pct = Math.min(95, Math.round(25 + (elapsed / durationSec) * 70));
        setExportProgress(pct);

        if (elapsed >= durationSec) {
          clearInterval(progressTimer);
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
        }
      }, 300);

      bufferSource.onended = () => {
        clearInterval(progressTimer);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

    } catch (e: any) {
      console.error('Export error:', e);
      alert('שגיאה בייצוא הווידאו: ' + (e.message || e));
      setIsExportingVideo(false);
      setIsPlaying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-3 sm:p-6 font-sans select-none animate-in fade-in">
      <div className="w-full max-w-6xl rounded-3xl bg-[#0f121a] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>סטודיו עריכת סאונד ויוצר וידאו-קאסט (Audiogram & Sound Studio)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                  עונה {episode.season} • פרק {episode.episodeNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                עריכה וחיתוך קטעי שמע, הוספת רקעים גרפיים, גלי קול מונפשים שתואמים לדיבור, לוגו קבוע וחלוניות עובדות
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Free Drag Mode Toggle */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                isEditMode
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md shadow-amber-950/40'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="הפעל / נעל גרירה חופשית ושינוי גודל של כל האלמנטים עם העכבר"
            >
              <Move className="w-3.5 h-3.5 text-amber-400" />
              <span>{isEditMode ? 'מצב גרירה פתוח' : 'שכבות נעולות'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Studio Body Grid (Left: Stage Preview, Right: Controls & Tools) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 overflow-y-auto flex-1">
          {/* LEFT: Live Stage Canvas Viewport (7 Cols) */}
          <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
            {/* Visual Canvas Stage Viewport */}
            <div className="relative aspect-video w-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-black flex items-center justify-center group">
              <canvas
                ref={canvasRef}
                width={854}
                height={480}
                className="w-full h-full object-contain"
              />

              {/* OVERLAY 1: Permanent Logo (הלוגו שקבעתי) - DRAGGABLE */}
              {logoConfig.show && logoConfig.url && (
                <DraggableOverlay
                  transform={logoTransform}
                  onUpdateTransform={setLogoTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 80, y: 5, scale: 1.0 }}
                >
                  <div style={{ opacity: logoConfig.opacity }}>
                    <img
                      src={logoConfig.url}
                      alt="Podcast Logo"
                      style={{ width: `${logoConfig.size}px`, height: `${logoConfig.size}px` }}
                      className="object-contain drop-shadow-xl select-none pointer-events-none"
                    />
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 2: Movie Fact Card Overlay (חלוניות עובדות על הסרט) - DRAGGABLE */}
              {showFactOverlay && currentFact && (
                <DraggableOverlay
                  transform={factTransform}
                  onUpdateTransform={setFactTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 5, y: 8, scale: 1.0 }}
                >
                  <div className="max-w-xs p-3 rounded-2xl bg-gradient-to-br from-slate-950/95 via-indigo-950/90 to-slate-950/95 border border-amber-500/40 shadow-2xl text-right animate-in fade-in select-none">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500 text-slate-950">
                        {currentFact.source}
                      </span>
                      {currentFact.ratingScore && (
                        <span className="text-[10px] font-bold text-amber-400">
                          ⭐ {currentFact.ratingScore}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-white leading-snug line-clamp-3">
                      {currentFact.fact}
                    </p>
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 3: Quote Overlay (חלונית ציטוט) - DRAGGABLE */}
              {showQuoteOverlay && (
                <DraggableOverlay
                  transform={quoteTransform}
                  onUpdateTransform={setQuoteTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 25, y: 65, scale: 1.0 }}
                >
                  <div className="max-w-md p-3 rounded-2xl bg-slate-950/95 border border-purple-500/40 text-center shadow-2xl select-none">
                    <p className="text-xs font-bold text-white italic">
                      {quoteText}
                    </p>
                    {quoteSpeaker && (
                      <span className="text-[10px] text-purple-300 font-semibold mt-0.5 block">— {quoteSpeaker}</span>
                    )}
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 4: Show Banner / Lower-Third (כרטיסיית כותרת) - DRAGGABLE */}
              {showBannerOverlay && (
                <DraggableOverlay
                  transform={bannerTransform}
                  onUpdateTransform={setBannerTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 65, y: 78, scale: 1.0 }}
                >
                  <div className="max-w-xs p-2.5 rounded-xl bg-slate-950/90 border-r-4 border-indigo-500 border border-slate-800 text-right shadow-xl select-none">
                    <span className="text-[9px] font-bold text-indigo-400 block uppercase">
                      CastFlow Studio • פרק {episode.episodeNumber}
                    </span>
                    <h4 className="text-xs font-black text-white truncate">{episode.title}</h4>
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 5: Poster PIP - DRAGGABLE */}
              {showPosterPip && posterUrl && (
                <DraggableOverlay
                  transform={posterTransform}
                  onUpdateTransform={setPosterTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 5, y: 45, scale: 1.0 }}
                >
                  <div className="w-28 rounded-xl overflow-hidden border-2 border-indigo-500/60 shadow-2xl select-none">
                    <img src={posterUrl} alt="Movie Poster" className="w-full object-cover" />
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 6: Live Subtitle Overlay - DRAGGABLE */}
              {showSubtitles && activeSubtitle && (
                <DraggableOverlay
                  transform={subtitleTransform}
                  onUpdateTransform={setSubtitleTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 15, y: 78, scale: 1.0 }}
                >
                  <div
                    style={{
                      fontFamily: (activeSubtitle.customStyle || episode.subtitleStyle)?.fontFamily || 'sans-serif',
                      fontSize: `${(activeSubtitle.customStyle || episode.subtitleStyle)?.fontSize || 22}px`,
                      color: (activeSubtitle.customStyle || episode.subtitleStyle)?.textColor || '#ffffff',
                      backgroundColor: (activeSubtitle.customStyle || episode.subtitleStyle)?.boxStyle === 'rounded-badge' 
                        ? (activeSubtitle.customStyle || episode.subtitleStyle)?.backgroundColor || 'rgba(0,0,0,0.75)'
                        : 'transparent',
                      padding: (activeSubtitle.customStyle || episode.subtitleStyle)?.boxStyle === 'rounded-badge' ? '6px 14px' : '0px',
                      borderRadius: (activeSubtitle.customStyle || episode.subtitleStyle)?.boxStyle === 'rounded-badge' ? '12px' : '0px',
                      fontWeight: (activeSubtitle.customStyle || episode.subtitleStyle)?.isBold !== false ? 'bold' : 'normal',
                      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                      lineHeight: '1.3',
                      letterSpacing: `${(activeSubtitle.customStyle || episode.subtitleStyle)?.letterSpacing || 0}px`,
                      whiteSpace: 'pre-line'
                    }}
                    className="select-none text-center"
                  >
                    {activeSubtitle.text}
                  </div>
                </DraggableOverlay>
              )}

              {/* Hidden Native Audio Element */}
              {audioUrl && (
                <audio
                  ref={audioElementRef}
                  src={audioUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}
            </div>

            {/* Audio Playback Controls & Scrubber */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                  </button>

                  <button
                    onClick={() => handleSeek(Math.max(0, currentTime - 5))}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-colors"
                    title="5 שניות אחורה"
                  >
                    -5s
                  </button>

                  <button
                    onClick={() => handleSeek(Math.min(duration, currentTime + 5))}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 text-xs font-bold transition-colors"
                    title="5 שניות קדימה"
                  >
                    +5s
                  </button>
                </div>

                {/* Time Display */}
                <div className="font-mono text-xs font-bold text-cyan-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                  {formatTime(currentTime, true)} / {formatTime(duration, true)}
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-slate-400 hover:text-white"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-indigo-400" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : audioVolume}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setAudioVolume(v);
                      if (audioElementRef.current) audioElementRef.current.volume = v;
                    }}
                    className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              </div>

              {/* Scrubber Range Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Studio Customization Tools (5 Cols) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
            {/* Customization Tabs (5 Tabs) */}
            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('background')}
                className={`py-2 px-1 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'background' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>רקע ותמונה</span>
              </button>

              <button
                onClick={() => setActiveTab('waveform')}
                className={`py-2 px-1 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'waveform' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>גלי קול</span>
              </button>

              <button
                onClick={() => setActiveTab('overlays')}
                className={`py-2 px-1 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'overlays' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>גרפיקות</span>
              </button>

              <button
                onClick={() => setActiveTab('trimmer')}
                className={`py-2 px-1 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'trimmer' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>חיתוך</span>
              </button>

              <button
                onClick={() => setActiveTab('export')}
                className={`py-2 px-1 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'export' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>ייצוא</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex-1 space-y-4 overflow-y-auto max-h-[50vh]">
              {/* 0. BACKGROUND & WALLPAPER TAB */}
              {activeTab === 'background' && (
                <div className="space-y-4">
                  {/* Hidden Background Image File Input */}
                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setCustomBgImage(reader.result as string);
                          setBgType('image');
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />

                  {/* Mode Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">סוג רקע הווידאו:</label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                      <button
                        type="button"
                        onClick={() => setBgType('preset')}
                        className={`py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                          bgType === 'preset' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>קולנועי</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBgType('image')}
                        className={`py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                          bgType === 'image' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>תמונה / פוסטר</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBgType('solid')}
                        className={`py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                          bgType === 'solid' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Palette className="w-3 h-3" />
                        <span>צבע אחיד</span>
                      </button>
                    </div>
                  </div>

                  {/* 1. CINEMA PRESETS GRID */}
                  {bgType === 'preset' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-300 block">בחר רקע קולנועי מובנה:</label>
                      <div className="grid grid-cols-2 gap-2">
                        {BACKGROUND_PRESETS.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedBgPreset(p.id)}
                            className={`p-3 rounded-xl border text-xs font-bold transition-all text-right flex items-center justify-between group ${
                              selectedBgPreset === p.id
                                ? 'border-pink-500 ring-2 ring-pink-500/40 text-white shadow-lg'
                                : 'border-slate-800 hover:border-slate-700 text-slate-300'
                            }`}
                            style={{ background: p.style }}
                          >
                            <span className="truncate">{p.name}</span>
                            {selectedBgPreset === p.id && (
                              <Check className="w-4 h-4 text-pink-400 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. CUSTOM IMAGE / POSTER UPLOAD */}
                  {bgType === 'image' && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-300 block">תמונת רקע אישית / פוסטר הפרק:</label>

                      {/* Image Preview & Actions */}
                      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
                        {customBgImage ? (
                          <img
                            src={customBgImage}
                            alt="Background Preview"
                            className="w-16 h-12 rounded-xl object-cover border border-slate-700 shadow"
                          />
                        ) : (
                          <div className="w-16 h-12 rounded-xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center text-slate-600">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => bgFileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>העלה מהמחשב</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setIsStockModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                            <span>מאגר תמונות</span>
                          </button>
                        </div>
                      </div>

                      {/* Sliders: Blur & Dim */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-400">
                            <span>טשטוש רקע (Blur):</span>
                            <span className="font-mono text-pink-400">{bgBlur}px</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="25"
                            value={bgBlur}
                            onChange={(e) => setBgBlur(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-400">
                            <span>הכהיית רקע (Dim):</span>
                            <span className="font-mono text-pink-400">{bgDim}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="90"
                            value={bgDim}
                            onChange={(e) => setBgDim(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3. SOLID COLOR PICKER */}
                  {bgType === 'solid' && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-300 block">בחר צבע רקע אחיד:</label>

                      {/* Swatches */}
                      <div className="flex items-center gap-2">
                        {[
                          '#000000',
                          '#0b0f19',
                          '#0f172a',
                          '#1e1b4b',
                          '#042f2e',
                          '#450a0a',
                          '#1c1917',
                          '#18181b'
                        ].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setSolidColor(c)}
                            className={`w-8 h-8 rounded-xl border-2 transition-transform ${
                              solidColor === c ? 'scale-110 border-pink-500 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>

                      {/* Native Color Picker */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="color"
                          value={solidColor}
                          onChange={(e) => setSolidColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-xs font-mono text-slate-300 font-bold">{solidColor}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 1. WAVEFORM CUSTOMIZATION TAB */}
              {activeTab === 'waveform' && (
                <div className="space-y-4">
                  {/* Waveform Style Selector (6 Styles) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">סגנון גלי הקול:</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'bars', label: '📊 עמודות EQ', desc: 'קפיצות לפי בס וטרבל' },
                        { id: 'sine', label: '〰️ גל סינוס', desc: 'רציף וזורם' },
                        { id: 'radial', label: '🔴 מעגל פעימות', desc: 'פולס מרכזי' },
                        { id: 'mirror', label: '🔉 עמודות מראה', desc: 'דו-כיווני' },
                        { id: 'pulse', label: '⚡ קו דופק', desc: 'אלקטרוני זוהר' },
                        { id: 'liquid', label: '🌊 גלי ים', desc: 'נוזלי דינמי' }
                      ].map(style => (
                        <button
                          key={style.id}
                          onClick={() => setWaveformStyle(style.id as WaveformStyle)}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                            waveformStyle === style.id
                              ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="block">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Mode: Single vs Gradient */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300">סוג צבע הגל:</label>
                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px]">
                        <button
                          onClick={() => setWaveformColorMode('single')}
                          className={`px-3 py-1 rounded-lg font-bold ${
                            waveformColorMode === 'single' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                          }`}
                        >
                          צבע בודד
                        </button>
                        <button
                          onClick={() => setWaveformColorMode('gradient')}
                          className={`px-3 py-1 rounded-lg font-bold ${
                            waveformColorMode === 'gradient' ? 'bg-gradient-to-r from-pink-500 to-cyan-500 text-white' : 'text-slate-400'
                          }`}
                        >
                          🌈 גרדיאנט
                        </button>
                      </div>
                    </div>

                    {/* Single Color Palette */}
                    {waveformColorMode === 'single' ? (
                      <div className="flex items-center gap-2 pt-1">
                        {['#06b6d4', '#a855f7', '#f59e0b', '#10b981', '#f43f5e', '#ffffff'].map(c => (
                          <button
                            key={c}
                            onClick={() => setSingleColor(c)}
                            className={`w-8 h-8 rounded-xl border-2 transition-transform ${
                              singleColor === c ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    ) : (
                      /* Gradient Presets Grid */
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {GRADIENT_PRESETS.map(g => (
                          <button
                            key={g.id}
                            onClick={() => setSelectedGradient(g.id)}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all text-white flex items-center justify-between ${
                              selectedGradient === g.id ? 'border-white shadow-lg ring-1 ring-white/50' : 'border-slate-800'
                            }`}
                            style={{ background: `linear-gradient(90deg, ${g.start}, ${g.end})` }}
                          >
                            <span>{g.name}</span>
                            {selectedGradient === g.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Waveform Position & Height */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 block">מיקום הגל בפריים:</label>
                      <select
                        value={waveformPosition}
                        onChange={(e) => setWaveformPosition(e.target.value as any)}
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                      >
                        <option value="center">מרכז הפריים</option>
                        <option value="bottom">תחתית הפריים</option>
                        <option value="top">חלק עליון</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400 font-bold">
                        <span>גובה ורגישות:</span>
                        <span className="font-mono text-cyan-400">{waveformHeight}px</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="180"
                        value={waveformHeight}
                        onChange={(e) => setWaveformHeight(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. OVERLAYS & GRAPHICS TAB */}
              {activeTab === 'overlays' && (
                <div className="space-y-4">
                  {/* Permanent Logo Controls (הלוגו שקבעתי) */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                        <span>לוגו וסימן מים קבוע:</span>
                      </span>
                      <button
                        onClick={() => setLogoConfig(prev => ({ ...prev, show: !prev.show }))}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          logoConfig.show ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {logoConfig.show ? 'פעיל ✓' : 'מוסתר'}
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <img
                        src={logoConfig.url}
                        alt="Logo"
                        className="w-12 h-12 rounded-xl object-contain bg-black/60 border border-slate-800 p-1"
                      />
                      <div className="flex-1 space-y-1">
                        <button
                          onClick={() => logoFileInputRef.current?.click()}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-pink-300 flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>החלף לוגו</span>
                        </button>
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const r = new FileReader();
                              r.onload = () => setLogoConfig(prev => ({ ...prev, url: r.result as string }));
                              r.readAsDataURL(file);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Movie Facts Overlay (חלוניות עובדות על הסרט) */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                        <span>חלונית עובדה על הסרט ({movieFacts.length}):</span>
                      </span>
                      <button
                        onClick={() => setShowFactOverlay(!showFactOverlay)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          showFactOverlay ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {showFactOverlay ? 'מוצגת בפריים ✓' : 'מוסתרת'}
                      </button>
                    </div>

                    {movieFacts.length > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setSelectedFactIndex(prev => (prev - 1 + movieFacts.length) % movieFacts.length)}
                          className="p-1 rounded-lg bg-slate-800 text-slate-300"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-slate-300 truncate max-w-[200px]">
                          {currentFact?.fact}
                        </span>
                        <button
                          onClick={() => setSelectedFactIndex(prev => (prev + 1) % movieFacts.length)}
                          className="p-1 rounded-lg bg-slate-800 text-slate-300"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quote & Banner Overlays */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowQuoteOverlay(!showQuoteOverlay)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        showQuoteOverlay ? 'bg-purple-950/60 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>💬 חלונית ציטוט</span>
                      <span>{showQuoteOverlay ? '✓' : ''}</span>
                    </button>

                    <button
                      onClick={() => setShowBannerOverlay(!showBannerOverlay)}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                        showBannerOverlay ? 'bg-indigo-950/60 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>📺 פס כותרת ושם הפרק</span>
                      <span>{showBannerOverlay ? '✓' : ''}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. AUDIO TRIMMER & CUTTING TAB */}
              {activeTab === 'trimmer' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Scissors className="w-4 h-4" />
                      <span>חיתוך טווח סאונד מותאם אישית:</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 block">נקודת התחלה (In-Point):</label>
                        <input
                          type="number"
                          min="0"
                          max={duration}
                          step="0.5"
                          value={trimStart}
                          onChange={(e) => setTrimStart(parseFloat(e.target.value) || 0)}
                          className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">{formatTime(trimStart, true)}</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 block">נקודת סיום (Out-Point):</label>
                        <input
                          type="number"
                          min="0"
                          max={duration}
                          step="0.5"
                          value={trimEnd}
                          onChange={(e) => setTrimEnd(parseFloat(e.target.value) || duration)}
                          className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">{formatTime(trimEnd, true)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handlePerformTrim}
                      disabled={isTrimming}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isTrimming ? 'חותך שמע...' : '✂️ חתוך ושמור מקטע זה'}
                    </button>
                  </div>
                </div>
              )}

              {/* 4. EXPORT AUDIOGRAM VIDEO TAB */}
              {activeTab === 'export' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border border-purple-500/40 space-y-3">
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <Film className="w-4 h-4 text-purple-400" />
                      <span>ייצוא וידאו אודיוגרמה (Video Podcast Export)</span>
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      יוצר קובץ וידאו HD מושלם עם גלי הקול המונפשים, הרקע, הלוגו, הכתוביות והחלוניות להעלאה ליוטיוב, ספוטיפיי וידאו, אינסטגרם רילס וטיקטוק!
                    </p>

                    {isExportingVideo && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs text-purple-300 font-bold">
                          <span>מייצא וידאו...</span>
                          <span className="font-mono">{exportProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-300"
                            style={{ width: `${exportProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleExportAudiogramVideo}
                      disabled={isExportingVideo}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isExportingVideo ? 'מרנדר וידאו אודיוגרמה...' : 'ייצא והורד וידאו אודיוגרמה (HD MP4/WebM)'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Image Picker Modal */}
      {isStockModalOpen && (
        <ImageStockPickerModal
          isOpen={isStockModalOpen}
          onClose={() => setIsStockModalOpen(false)}
          onSelectImage={(url) => {
            setCustomBgImage(url);
            setBgType('image');
            setIsStockModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
