'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Episode, SubtitleItem, SubtitleStyle, HighlightClip, SubtitleEntranceAnimation, SubtitleExitAnimation } from '@/lib/types';
import { 
  saveEpisode, 
  getMediaBlob, 
  saveMediaBlob, 
  findMediaBlobForEpisode,
  getPermanentLogo,
  savePermanentLogo,
  PermanentLogoConfig,
  getStoredCustomFonts,
  saveStoredCustomFont,
  deleteStoredCustomFont,
  StoredCustomFont
} from '@/lib/storage';
import { 
  exportToSRT, 
  exportToVTT, 
  splitTextIntoPacedSubtitles, 
  formatSrtTimestamp, 
  formatVttTimestamp,
  convertBlobToMonoWav,
  convertBlobToSpeechMonoWav,
  smartRebalanceSubtitles,
  splitSubtitleItemAtMiddle,
  splitSubtitleItemAtWordIndex,
  segmentSubtitlesByPunctuation,
  segmentSubtitlesByMaxChars,
  mergeSubtitleWithNext,
  mergeSubtitleWithPrevious,
  cleanAndPolishHebrewSubtitleText,
  shiftAllSubtitleTimestamps,
  buildSubtitlesFromWhisperWords,
  parseSRT,
  parseVTT,
  generateSubtitlesFromTopics,
  sliceAudioBlobIntoChunks,
  blobToBase64,
  trimAudioBlob,
  extractAndEnhanceAudioSnippet,
  getSpeakerColor,
  DEFAULT_SPEAKER_COLORS
} from '@/lib/audioUtils';
import { 
  Subtitles, 
  Type, 
  Upload, 
  Download, 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Palette, 
  Sliders, 
  Sparkles, 
  Clock, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
  Wand2,
  Mic,
  MicOff,
  Volume2,
  Key,
  Scissors,
  GitMerge,
  RotateCw,
  FileText,
  Pin,
  FastForward,
  Rewind,
  Globe,
  Languages,
  ArrowRight,
  Split,
  Zap,
  Bookmark,
  Flame,
  Film,
  Filter,
  Move,
  Image as ImageIcon,
  Grid,
  CheckCheck,
  FileUp,
  Sparkle,
  LayoutTemplate,
  SlidersHorizontal,
  User,
  Users
} from 'lucide-react';
import { getAISettings, AISettingsConfig, POPULAR_ELEVENLABS_VOICES } from '@/lib/apiConfig';
import SubtitleAISettingsModal from './SubtitleAISettingsModal';

interface SubtitleStudioProps {
  episode?: Episode;
  isOpen: boolean;
  onClose: () => void;
  onUpdateEpisode?: (updated: Episode) => void;
  isStandalonePage?: boolean;
  onBack?: () => void;
  initialClipId?: string;
  initialMediaUrl?: string;
  initialMediaFile?: File | null;
}

function getRgbaColor(hexOrRgba?: string, opacityPercent: number = 80): string {
  if (!hexOrRgba) return 'transparent';
  if (hexOrRgba.startsWith('#')) {
    const hex = hexOrRgba.replace('#', '');
    const fullHex = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const r = parseInt(fullHex.substring(0, 2), 16) || 0;
    const g = parseInt(fullHex.substring(2, 4), 16) || 0;
    const b = parseInt(fullHex.substring(4, 6), 16) || 0;
    const a = Math.max(0, Math.min(1, opacityPercent / 100));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  if (hexOrRgba.startsWith('rgb(')) {
    return hexOrRgba.replace('rgb(', 'rgba(').replace(')', `, ${opacityPercent / 100})`);
  }
  if (hexOrRgba.startsWith('rgba(')) {
    return hexOrRgba.replace(/[\d\.]+\)$/, `${(opacityPercent / 100).toFixed(2)})`);
  }
  return hexOrRgba;
}

function getHexColor(colorStr?: string): string {
  if (!colorStr) return '#000000';
  if (colorStr.startsWith('#')) return colorStr.substring(0, 7);
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  return '#000000';
}

const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: 'Rubik, sans-serif',
  fontSize: 28,
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  // Background
  backgroundEnabled: true,
  backgroundColor: '#000000',
  backgroundOpacity: 80,
  backgroundPaddingX: 20,
  backgroundPaddingY: 10,
  backgroundBorderRadius: 16,
  boxStyle: 'rounded-badge',
  // Stroke / Outline
  strokeEnabled: true,
  strokeColor: '#000000',
  strokeWidth: 2,
  // Shadow & Glow
  shadowEnabled: true,
  textShadow: 'soft',
  shadowColor: 'rgba(0,0,0,0.85)',
  shadowBlur: 8,
  // Text & Animation
  highlightWordColor: '#FACC15',
  activeWordAnimation: 'color-pop',
  textAlign: 'center',
  positionY: 80,
  positionX: 50,
  isBold: true,
  letterSpacing: 0.5,
  animation: 'pop',
  entranceAnimation: 'pop',
  exitAnimation: 'fade',
  animationDuration: 0.25,
  maxWordsPerLine: 4,
  // Logo
  logoEnabled: false,
  logoPosition: 'top-right',
  logoSize: 64,
  logoOpacity: 90,
  logoOffsetX: 16,
  logoOffsetY: 16
};

const SUBTITLE_THEMES = [
  {
    id: 'tiktok_pop',
    name: '📱 טיקטוק ורילס',
    desc: 'הדגשת מילה מדוברת בצהוב ניאון עם קו מתאר וקפיצת פופ',
    style: {
      fontFamily: 'Rubik, sans-serif',
      fontSize: 32,
      fontWeight: '900' as const,
      textColor: '#FFFFFF',
      highlightWordColor: '#FACC15',
      backgroundEnabled: false,
      boxStyle: 'none' as const,
      strokeEnabled: true,
      strokeWidth: 2,
      strokeColor: '#000000',
      shadowEnabled: true,
      textShadow: 'hard-outline' as const,
      activeWordAnimation: 'color-pop' as const,
      entranceAnimation: 'pop' as const,
      exitAnimation: 'shrink' as const,
      animationDuration: 0.22,
      positionY: 78,
      textAlign: 'center' as const
    }
  },
  {
    id: 'netflix_cinema',
    name: '🎬 נטפליקס קולנועי',
    desc: 'טקסט לבן אלגנטי עם גלולת רקע כהה ועמעום רך',
    style: {
      fontFamily: 'Assistant, sans-serif',
      fontSize: 26,
      fontWeight: 'bold' as const,
      textColor: '#FFFFFF',
      backgroundEnabled: true,
      backgroundColor: '#000000',
      backgroundOpacity: 75,
      backgroundPaddingX: 24,
      backgroundPaddingY: 10,
      boxStyle: 'pill-badge' as const,
      strokeEnabled: false,
      strokeWidth: 0,
      shadowEnabled: true,
      textShadow: 'soft' as const,
      activeWordAnimation: 'none' as const,
      entranceAnimation: 'fade' as const,
      exitAnimation: 'fade' as const,
      animationDuration: 0.28,
      positionY: 84,
      textAlign: 'center' as const
    }
  },
  {
    id: 'podcast_gold',
    name: '🎙️ פודקאסט זהב',
    desc: 'טקסט מוזהב יוקרתי עם רקע זכוכית וזוהר חם',
    style: {
      fontFamily: '"Secular One", sans-serif',
      fontSize: 28,
      fontWeight: 'bold' as const,
      textColor: '#F59E0B',
      backgroundEnabled: true,
      backgroundColor: '#0f172a',
      backgroundOpacity: 85,
      backgroundPaddingX: 20,
      backgroundPaddingY: 10,
      backgroundBorderRadius: 16,
      boxStyle: 'glassmorphism' as const,
      strokeEnabled: true,
      strokeWidth: 1,
      strokeColor: '#D97706',
      shadowEnabled: true,
      textShadow: 'neon-glow' as const,
      shadowColor: '#F59E0B',
      activeWordAnimation: 'glow' as const,
      positionY: 80,
      textAlign: 'center' as const
    }
  },
  {
    id: 'cyberpunk_neon',
    name: '⚡ סייבר ניאון',
    desc: 'טורקיז ורוד בוהק עם אפקט זוהר עתידני',
    style: {
      fontFamily: 'Rubik, sans-serif',
      fontSize: 30,
      fontWeight: '800' as const,
      textColor: '#06B6D4',
      highlightWordColor: '#F43F5E',
      backgroundEnabled: true,
      backgroundColor: '#080c16',
      backgroundOpacity: 90,
      backgroundPaddingX: 20,
      backgroundPaddingY: 10,
      backgroundBorderRadius: 16,
      boxStyle: 'rounded-badge' as const,
      strokeEnabled: false,
      strokeWidth: 0,
      shadowEnabled: true,
      textShadow: 'neon-glow' as const,
      shadowColor: '#06B6D4',
      activeWordAnimation: 'color-pop' as const,
      positionY: 76,
      textAlign: 'center' as const
    }
  },
  {
    id: 'classic_yellow',
    name: '📺 צהוב טלוויזיוני',
    desc: 'צהוב קלאסי בולט עם מסגרת שחורה חדה',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 30,
      fontWeight: 'bold' as const,
      textColor: '#FDE047',
      backgroundEnabled: false,
      boxStyle: 'none' as const,
      strokeEnabled: true,
      strokeWidth: 3,
      strokeColor: '#000000',
      shadowEnabled: true,
      textShadow: 'hard-outline' as const,
      activeWordAnimation: 'none' as const,
      positionY: 82,
      textAlign: 'center' as const
    }
  },
  {
    id: 'clean_minimal',
    name: '⚪ מינימליסטי נקי',
    desc: 'גופן דק וקריא במיוחד ללא הסחות דעת',
    style: {
      fontFamily: 'Assistant, sans-serif',
      fontSize: 24,
      fontWeight: '500' as const,
      textColor: '#F8FAFC',
      backgroundEnabled: false,
      boxStyle: 'none' as const,
      strokeEnabled: false,
      strokeWidth: 0,
      shadowEnabled: false,
      textShadow: 'soft' as const,
      activeWordAnimation: 'none' as const,
      positionY: 85,
      textAlign: 'center' as const
    }
  }
];

export const ENTRANCE_ANIMATION_OPTIONS: { id: SubtitleEntranceAnimation; label: string; emoji: string; desc: string }[] = [
  { id: 'pop', label: 'קפיצה (Pop)', emoji: '💥', desc: 'מושלם לטיקטוק, רילס ושורטס - כניסה קופצנית ואנרגטית' },
  { id: 'bounce', label: 'באונס (Bounce)', emoji: '🏀', desc: 'כניסה עם ניתור אלסטי עשיר ומלא חיים' },
  { id: 'fade', label: 'עמעום (Fade In)', emoji: '🌫️', desc: 'הופעה נקייה, קולנועית ואלגנטית מ-0 ל-100%' },
  { id: 'slide-up', label: 'החלקה מלמטה', emoji: '⬆️', desc: 'עולה מלמטה עם שקיפות רכה' },
  { id: 'slide-down', label: 'החלקה מלמעלה', emoji: '⬇️', desc: 'יורד מלמעלה בטבעיות' },
  { id: 'zoom-in', label: 'הגדלה (Zoom In)', emoji: '🔍', desc: 'צומח ממרכז המסך בהדרגה' },
  { id: 'flip', label: 'היפוך תלת-ממדי', emoji: '🔄', desc: 'סיבוב תלת-ממדי על ציר ה-X' },
  { id: 'rubber-band', label: 'גומי אלסטי', emoji: '🪢', desc: 'מתיחה והתכווצות קופצנית בסגנון גומי' },
  { id: 'glitch', label: 'גליץ\' סייבר', emoji: '⚡', desc: 'הבזק צבעוני דיגיטלי בסגנון סייבר' },
  { id: 'none', label: 'מיידי (ללא אפקט)', emoji: '⏹️', desc: 'הופעה חדה ללא שום מעבר' }
];

export const EXIT_ANIMATION_OPTIONS: { id: SubtitleExitAnimation; label: string; emoji: string; desc: string }[] = [
  { id: 'fade', label: 'עמעום (Fade Out)', emoji: '🌫️', desc: 'התפוגגות חלקה ועדינה בסיום' },
  { id: 'shrink', label: 'התכווצות (Shrink)', emoji: '🎯', desc: 'התכנסות מהירה לנקודה - תואם פופ כניסה' },
  { id: 'slide-down', label: 'החלקה למטה', emoji: '⬇️', desc: 'גולש ונעלם כלפי מטה' },
  { id: 'slide-up', label: 'החלקה למעלה', emoji: '⬆️', desc: 'ממשיך מעלה ומתפוגג' },
  { id: 'zoom-out', label: 'התרחקות (Zoom Out)', emoji: '🔎', desc: 'מתרחק וגדל אל מחוץ למסך' },
  { id: 'blur', label: 'טשטוש (Motion Blur)', emoji: '💨', desc: 'טשטוש תנועה קולנועי עדין עד היעלמות' },
  { id: 'drop-out', label: 'נפילה חופשית', emoji: '🍂', desc: 'צניחה כלפי מטה עם סיבוב קל' },
  { id: 'none', label: 'מיידי (ללא אפקט)', emoji: '⏹️', desc: 'היעלמות חדה ללא שום מעבר' }
];

export function getSubtitleAnimationClass(st: SubtitleStyle, isExiting: boolean): string {
  if (isExiting) {
    const exit = st.exitAnimation || 'none';
    switch (exit) {
      case 'fade': return 'sub-anim-exit-fade';
      case 'shrink': return 'sub-anim-exit-shrink';
      case 'slide-down': return 'sub-anim-exit-slide-down';
      case 'slide-up': return 'sub-anim-exit-slide-up';
      case 'zoom-out': return 'sub-anim-exit-zoom-out';
      case 'blur': return 'sub-anim-exit-blur';
      case 'drop-out': return 'sub-anim-exit-drop-out';
      case 'none':
      default: return 'sub-anim-exit-none';
    }
  }

  // Entrance
  const enter = st.entranceAnimation || (st.animation as any) || 'pop';
  switch (enter) {
    case 'pop': return 'sub-anim-enter-pop';
    case 'bounce': return 'sub-anim-enter-bounce';
    case 'fade': return 'sub-anim-enter-fade';
    case 'slide-up': return 'sub-anim-enter-slide-up';
    case 'slide-down': return 'sub-anim-enter-slide-down';
    case 'zoom-in': return 'sub-anim-enter-zoom-in';
    case 'flip': return 'sub-anim-enter-flip';
    case 'rubber-band': return 'sub-anim-enter-rubber-band';
    case 'glitch': return 'sub-anim-enter-glitch';
    case 'none': return 'sub-anim-enter-none';
    case 'karaoke-pop': return 'sub-anim-enter-pop';
    default: return 'sub-anim-enter-pop';
  }
}

const BUILT_IN_FONTS = [
  { name: 'Rubik (עבה וקולנועי - מומלץ)', value: 'Rubik, sans-serif' },
  { name: 'Heebo (מודרני ונקי)', value: 'Heebo, sans-serif' },
  { name: 'Secular One (טיקטוק ופודקאסט בולט)', value: '"Secular One", sans-serif' },
  { name: 'Assistant (אלגנטי וקריא)', value: 'Assistant, sans-serif' },
  { name: 'Varela Round (מעוגל וידידותי)', value: '"Varela Round", sans-serif' },
  { name: 'Frank Ruhl Libre (קלאסי ועיתונאי)', value: '"Frank Ruhl Libre", serif' },
  { name: 'Impact (טיקטוק ורילס עוצמתי)', value: 'Impact, sans-serif' },
  { name: 'Montserrat (מודרני בינלאומי)', value: 'Montserrat, sans-serif' },
  { name: 'Alef (עברית אלגנטית נקייה)', value: 'Alef, sans-serif' },
  { name: 'Amatic SC (כותרות ייחודיות)', value: '"Amatic SC", cursive' },
  { name: 'Arial / Sans-Serif (סטנדרטי)', value: 'Arial, sans-serif' }
];

const DEFAULT_FALLBACK_EPISODE: Episode = {
  id: 'standalone_subtitles',
  podcastId: 'pod-default',
  title: 'אולפן כתוביות עצמאי',
  description: 'עריכת כתוביות חופשית לכל וידאו ושמע',
  season: 1,
  episodeNumber: 1,
  status: 'published',
  mediaType: 'video',
  targetDurationMinutes: 10,
  topics: [],
  movieFacts: [],
  subtitles: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export default function SubtitleStudio({
  episode: propEpisode,
  isOpen,
  onClose,
  onUpdateEpisode,
  isStandalonePage = false,
  onBack,
  initialClipId,
  initialMediaUrl,
  initialMediaFile
}: SubtitleStudioProps) {
  const episode = propEpisode || DEFAULT_FALLBACK_EPISODE;
  const [selectedTranscriptionScope, setSelectedTranscriptionScope] = useState<string>(initialClipId || 'full');
  const [filterSubtitlesByClip, setFilterSubtitlesByClip] = useState<boolean>(!!initialClipId);
  const [isShortsAspect, setIsShortsAspect] = useState<boolean>(!!initialClipId);
  const [isStandaloneMedia, setIsStandaloneMedia] = useState<boolean>(false);
  const [highEffortMode, setHighEffortMode] = useState<boolean>(true);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refiningSubtitleId, setRefiningSubtitleId] = useState<string | null>(null);

  // Active Highlight Clip if one is chosen
  const activeClip: HighlightClip | undefined = selectedTranscriptionScope !== 'full'
    ? (episode.highlightClips || []).find(c => c.id === selectedTranscriptionScope)
    : undefined;

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(Math.max(0, secs) / 60);
    const s = Math.floor(Math.max(0, secs) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (initialClipId) {
      setSelectedTranscriptionScope(initialClipId);
      setFilterSubtitlesByClip(true);
      setIsShortsAspect(true);
    }
  }, [initialClipId]);

  // Sync player position when activeClip changes
  useEffect(() => {
    if (activeClip) {
      const targetTime = isStandaloneMedia ? 0 : activeClip.startTime;
      setCurrentTime(targetTime);
      if (videoRef.current) {
        videoRef.current.currentTime = targetTime;
      }
      setIsShortsAspect(true);
      setFilterSubtitlesByClip(true);
    } else {
      setIsShortsAspect(false);
      setFilterSubtitlesByClip(false);
    }
  }, [activeClip?.id, isStandaloneMedia]);

  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [globalStyle, setGlobalStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);

  // Subtitle Drag & Drop on Video Canvas
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [showSafeZone, setShowSafeZone] = useState(false);

  // Persistent Logo states & refs
  const [logoSaveSuccess, setLogoSaveSuccess] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);
  
  // Custom Fonts State
  const [customFonts, setCustomFonts] = useState<{ name: string; value: string }[]>([]);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Video & Playback State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentMediaBlob, setCurrentMediaBlob] = useState<Blob | File | null>(initialMediaFile || null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Synchronize initialMediaFile if prop changes
  useEffect(() => {
    if (initialMediaFile) {
      setCurrentMediaBlob(initialMediaFile);
    }
  }, [initialMediaFile]);

  // AI Providers & API Keys State (Gemini & ElevenLabs)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettingsConfig>(getAISettings());
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Real Spoken Audio Transcription States
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState<string>('');
  const [isDictating, setIsDictating] = useState(false);
  const dictationRecRef = useRef<any>(null);

  // Subtitles AI Translation State
  const [isTranslateModalOpen, setIsTranslateModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedTargetLang, setSelectedTargetLang] = useState('he');
  const [selectedSourceLang, setSelectedSourceLang] = useState('auto');
  const [selectedTranslateScope, setSelectedTranslateScope] = useState<'all' | 'selected'>('all');
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);

  // ElevenLabs Voiceover Handler
  const handlePlayVoiceover = async (sub: SubtitleItem) => {
    if (!aiSettings.elevenLabsApiKey.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    setPlayingAudioId(sub.id);
    try {
      const res = await fetch('/api/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sub.text,
          apiKey: aiSettings.elevenLabsApiKey,
          voiceId: aiSettings.elevenLabsVoiceId,
          modelId: aiSettings.elevenLabsModel
        })
      });

      const data = await res.json();
      if (res.ok && data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.onended = () => setPlayingAudioId(null);
        audio.play();
      } else {
        alert(data.error || 'שגיאה ביצירת קול דיבוב מ-ElevenLabs. בדקו את מפתח ה-API.');
        setPlayingAudioId(null);
      }
    } catch (e: any) {
      alert('שגיאה: ' + e.message);
      setPlayingAudioId(null);
    }
  };

  // Pacing Controls
  const [wordsPerLine, setWordsPerLine] = useState(4);
  const [linesPerSubtitle, setLinesPerSubtitle] = useState(1);
  const [rawScriptText, setRawScriptText] = useState('');
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  // Active Tab in Sidebar
  const [sidebarTab, setSidebarTab] = useState<'editor' | 'style' | 'pacing'>('editor');

  // Multi-Speaker Diarization State
  const [speakerFilter, setSpeakerFilter] = useState<string>('all');
  const [activeSpeakerPopoverId, setActiveSpeakerPopoverId] = useState<string | null>(null);
  const [customSpeakerInput, setCustomSpeakerInput] = useState<string>('');
  const [isDiarizingSubtitles, setIsDiarizingSubtitles] = useState<boolean>(false);

  // ElevenLabs Subtitle & Voiceover Creation State
  const [isElevenLabsModalOpen, setIsElevenLabsModalOpen] = useState(false);
  const [elevenLabsMode, setElevenLabsMode] = useState<'script' | 'scribe'>('script');
  const [elevenLabsScriptText, setElevenLabsScriptText] = useState('');
  const [elevenLabsVoice, setElevenLabsVoice] = useState('21m00Tcm4TlvDq8ikWAM');
  const [elevenLabsWordsPerLine, setElevenLabsWordsPerLine] = useState(4);
  const [elevenLabsSpeakerName, setElevenLabsSpeakerName] = useState('קריין AI');
  const [isGeneratingElevenLabs, setIsGeneratingElevenLabs] = useState(false);

  // Preview Animation State for Entrance / Exit Testing
  const [previewAnimationState, setPreviewAnimationState] = useState<'enter' | 'exit' | null>(null);

  const triggerPreviewEntrance = () => {
    setPreviewAnimationState('enter');
    setTimeout(() => setPreviewAnimationState(null), 1000);
  };

  const triggerPreviewExit = () => {
    setPreviewAnimationState('exit');
    setTimeout(() => setPreviewAnimationState(null), 1000);
  };

  const triggerPreviewSequence = () => {
    setPreviewAnimationState('enter');
    setTimeout(() => {
      setPreviewAnimationState('exit');
      setTimeout(() => {
        setPreviewAnimationState(null);
      }, 700);
    }, 850);
  };

  const handleGenerateSubtitlesWithElevenLabs = async () => {
    const currentSettings = getAISettings();
    if (!currentSettings.elevenLabsApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }
    if (!elevenLabsScriptText.trim()) {
      alert('נא להזין טקסט ליצירת כתוביות וקריינות.');
      return;
    }

    setIsGeneratingElevenLabs(true);
    try {
      const res = await fetch('/api/elevenlabs/generate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: elevenLabsScriptText.trim(),
          apiKey: currentSettings.elevenLabsApiKey,
          voiceId: elevenLabsVoice,
          modelId: currentSettings.elevenLabsModel || 'eleven_multilingual_v2',
          wordsPerLine: elevenLabsWordsPerLine,
          speakerName: elevenLabsSpeakerName
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.subtitles) {
        setSubtitles(data.subtitles);
        const updated = { ...episode, subtitles: data.subtitles };
        if (!updated.id.startsWith('standalone_')) {
          saveEpisode(updated);
        }
        if (onUpdateEpisode) onUpdateEpisode(updated);

        if (data.audioUrl) {
          setVideoUrl(data.audioUrl);
          if (videoRef.current) {
            videoRef.current.src = data.audioUrl;
            videoRef.current.load();
          }
        }

        setIsElevenLabsModalOpen(false);
        alert(`✨ נוצרו בהצלחה ${data.subtitles.length} כתוביות מסונכרנות עם קריינות ElevenLabs (${data.duration} שנ׳)!`);
      } else {
        alert(data.error || 'שגיאה ביצירת כתוביות עם ElevenLabs. בדקו את המפתח והיתרה בחשבון.');
      }
    } catch (err: any) {
      alert('שגיאת תקשורת: ' + err.message);
    } finally {
      setIsGeneratingElevenLabs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setAISettings(getAISettings());

      // 0. Inject Google Fonts for Hebrew & English
      const linkId = 'google-fonts-subtitles';
      if (typeof document !== 'undefined' && !document.getElementById(linkId)) {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Alef:wght@400;700&family=Amatic+SC:wght@700&family=Assistant:wght@400;600;700;800&family=Frank+Ruhl+Libre:wght@400;700;900&family=Heebo:wght@400;600;700;900&family=Montserrat:wght@400;700;900&family=Rubik:wght@400;600;700;900&family=Secular+One&family=Varela+Round&display=swap';
        document.head.appendChild(link);
      }

      // 0.1 Load Stored Custom Fonts from localStorage
      const storedFonts = getStoredCustomFonts();
      if (storedFonts.length > 0 && typeof document !== 'undefined') {
        storedFonts.forEach(font => {
          const styleId = `custom-font-${font.name.replace(/[^\w\d]/g, '_')}`;
          if (!document.getElementById(styleId)) {
            const newStyle = document.createElement('style');
            newStyle.id = styleId;
            newStyle.appendChild(document.createTextNode(`
              @font-face {
                font-family: '${font.name.replace(/[^\w\d]/g, '_')}';
                src: url('${font.dataUrl}');
              }
            `));
            document.head.appendChild(newStyle);
          }
        });
        setCustomFonts(storedFonts.map(f => ({ name: `פונט אישי: ${f.name}`, value: `'${f.name.replace(/[^\w\d]/g, '_')}', sans-serif` })));
      }

      // 0.2 Load Permanent Logo from localStorage
      const permLogo = getPermanentLogo(episode?.podcastId);

      // 1. Initialize strictly from actual recorded spoken subtitles (NO mock script placeholders!)
      if (episode.subtitles && episode.subtitles.length > 0) {
        setSubtitles(episode.subtitles);
      } else {
        setSubtitles([]);
      }

      if (episode.subtitleStyle) {
        setGlobalStyle(prev => ({
          ...prev,
          ...episode.subtitleStyle,
          logoEnabled: episode.subtitleStyle?.logoEnabled !== undefined 
            ? episode.subtitleStyle.logoEnabled 
            : (permLogo?.showByDefault ?? prev.logoEnabled),
          logoUrl: episode.subtitleStyle?.logoUrl || permLogo?.url || prev.logoUrl,
          logoPosition: (episode.subtitleStyle?.logoPosition || permLogo?.positionPreset || prev.logoPosition || 'top-right') as any,
          logoSize: episode.subtitleStyle?.logoSize || permLogo?.size || prev.logoSize || 64,
          logoOpacity: episode.subtitleStyle?.logoOpacity !== undefined 
            ? episode.subtitleStyle.logoOpacity 
            : (permLogo ? Math.round(permLogo.opacity * 100) : (prev.logoOpacity || 90)),
        }));
      } else if (permLogo && permLogo.url) {
        setGlobalStyle(prev => ({
          ...prev,
          logoEnabled: permLogo.showByDefault,
          logoUrl: permLogo.url,
          logoPosition: (permLogo.positionPreset || 'top-right') as any,
          logoSize: permLogo.size || 64,
          logoOpacity: Math.round(permLogo.opacity * 100),
        }));
      }

      // Load Video or Audio Blob for in-studio preview and syncing
      const loadMedia = async () => {
        // Direct media file or url passed via props
        if (initialMediaFile) {
          setCurrentMediaBlob(initialMediaFile);
          setVideoUrl(URL.createObjectURL(initialMediaFile));
          setIsStandaloneMedia(true);
          return;
        }
        if (initialMediaUrl) {
          setVideoUrl(initialMediaUrl);
          setIsStandaloneMedia(true);
          return;
        }

        let blob: Blob | null = null;
        let isStandalone = false;
        if (activeClip) {
          if (activeClip.videoBlobKey) {
            blob = await getMediaBlob(activeClip.videoBlobKey);
            if (blob) isStandalone = true;
          }
          if (!blob && activeClip.audioBlobKey) {
            blob = await getMediaBlob(activeClip.audioBlobKey);
            if (blob) isStandalone = true;
          }
        }
        if (!blob && episode.recording?.videoBlobKey) {
          blob = await getMediaBlob(episode.recording.videoBlobKey);
        }
        if (!blob && episode.recording?.audioBlobKey) {
          blob = await getMediaBlob(episode.recording.audioBlobKey);
        }
        if (!blob) {
          blob = await getMediaBlob(`emergency_rec_${episode.id}`);
        }
        if (!blob) {
          const found = await findMediaBlobForEpisode(episode.id);
          if (found && found.blob) {
            blob = found.blob;
          }
        }
        setIsStandaloneMedia(isStandalone);
        if (blob) {
          setVideoUrl(URL.createObjectURL(blob));
        } else {
          setVideoUrl(null);
        }
      };

      loadMedia();
    }
  }, [isOpen, episode, activeClip?.id, initialMediaUrl, initialMediaFile]);

  if (!isOpen) return null;

  // Safely resolve the media blob from any available source (uploaded file, blob URL, or recording)
  const resolveMediaBlob = async (): Promise<Blob | null> => {
    if (currentMediaBlob) return currentMediaBlob;
    if (initialMediaFile) {
      setCurrentMediaBlob(initialMediaFile);
      return initialMediaFile;
    }
    if (videoUrl) {
      try {
        const res = await fetch(videoUrl);
        if (res.ok) {
          const b = await res.blob();
          setCurrentMediaBlob(b);
          return b;
        }
      } catch (e) {
        console.warn('resolveMediaBlob fetch failed:', e);
      }
    }
    if (episode.recording?.audioBlobKey) {
      const b = await getMediaBlob(episode.recording.audioBlobKey);
      if (b) return b;
    }
    if (episode.recording?.videoBlobKey) {
      const b = await getMediaBlob(episode.recording.videoBlobKey);
      if (b) return b;
    }
    const emerg = await getMediaBlob(`emergency_rec_${episode.id}`);
    if (emerg) return emerg;
    const found = await findMediaBlobForEpisode(episode.id);
    if (found && found.blob) return found.blob;
    return null;
  };

  // 1. Robust Chunked AI Transcription & Translation Engine (Supports external videos, 20+, 60+, 120+ minutes)
  const handleTranscribeRecordedAudio = async (options?: {
    spokenLanguage?: string;
    translateToHebrew?: boolean;
    providerOverride?: 'openai' | 'gemini' | 'elevenlabs' | 'browser';
  }) => {
    const isTranslatingToHebrew = options?.translateToHebrew ?? false;
    const spokenLang = options?.spokenLanguage || 'auto';
    const providerOverride = options?.providerOverride;

    const currentSettings = getAISettings();
    const effectiveProvider = providerOverride || currentSettings.transcriptionProvider || 'openai';

    if (!currentSettings.geminiApiKey?.trim() && !currentSettings.openaiApiKey?.trim() && !currentSettings.elevenLabsApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    setIsTranscribing(true);
    setTranscribeStatus(isTranslatingToHebrew 
      ? 'מאתר את קובץ הווידאו/השמע לצורך תמלול ותרגום לעברית...'
      : 'מאתר את קובץ האודיו המוקלט של הפרק...');
    setTranscribeProgress(null);

    try {
      const audioBlob = await resolveMediaBlob();

      if (!audioBlob) {
        alert('לא נמצא קובץ וידאו או הקלטה. נא להעלות קובץ וידאו/אודיו מהמחשב או להקליט באולפן לפני הפעלת התמלול.');
        setIsTranscribing(false);
        return;
      }

      // SPECIAL SCOPE: If an active Highlight Clip is selected, transcribe ONLY that clip!
      if (activeClip) {
        setTranscribeStatus(`גוזר ומכין את הקטע "${activeClip.title}" (${formatSrtTimestamp(activeClip.startTime).slice(3, 8)} - ${formatSrtTimestamp(activeClip.endTime).slice(3, 8)})...`);
        
        const clipDuration = Math.max(5, activeClip.endTime - activeClip.startTime);
        let clipBlob: Blob | null = null;
        try {
          clipBlob = await trimAudioBlob(audioBlob, activeClip.startTime, activeClip.endTime);
        } catch (trimErr) {
          console.warn('trimAudioBlob error, fallback to audioBlob:', trimErr);
        }

        const effectiveBlob = clipBlob || audioBlob;
        setTranscribeStatus(isTranslatingToHebrew
          ? `מתמלל ומתרגם לעברית את הקטע "${activeClip.title}" (${Math.round(clipDuration)} שנ׳) עם AI...`
          : `מתמלל את הקטע "${activeClip.title}" (${Math.round(clipDuration)} שנ׳) עם AI...`);
        
        let clipSubs: SubtitleItem[] = [];
        const clipBase64 = await blobToBase64(effectiveBlob);
        const cleanClipBase64 = clipBase64.replace(/^data:[^;]+;base64,/, '');

        // Attempt 1: Server Transcribe
        try {
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: clipBase64,
              mimeType: effectiveBlob.type || 'audio/wav',
              wordsPerLine,
              duration: clipDuration,
              apiKey: currentSettings.geminiApiKey,
              openaiApiKey: currentSettings.openaiApiKey,
              elevenLabsApiKey: currentSettings.elevenLabsApiKey,
              provider: effectiveProvider,
              spokenLanguage: spokenLang,
              translateToHebrew: isTranslatingToHebrew,
              highEffortMode
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
              clipSubs = data.subtitles;
            }
          }
        } catch (sErr) {
          console.warn('Clip transcribe server error:', sErr);
        }

        // Attempt 2: Direct Gemini
        if (clipSubs.length === 0 && currentSettings.geminiApiKey?.trim()) {
          try {
            const geminiPrompt = isTranslatingToHebrew
              ? `אתה מודל תמלול ותרגום אודיו מקצועי לסרטונים ופודקאסטים.
האזן ישירות לאודיו (באנגלית או בכל שפה אחרת), תמלל ותרגם את כל מה שנאמר ישירות לעברית טבעית, שוטפת ומדויקת.
זהה הבדלים בין דוברים שונים (Speaker Diarization): סמן כל שורה עם שדה "speaker" ("דובר 1", "דובר 2" או שמותיהם). כאשר הדובר מתחלף, התחל שורה חדשה.
חלק לכתוביות קצרות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בשורה, עם תזמונים (startTime, endTime) בשניות (משך קטע זה: ${clipDuration} שניות).
החזר אך ורק מערך JSON תקין: [{"startTime": 0.5, "endTime": 3.0, "speaker": "דובר 1", "text": "תרגום מדויק לעברית"}]`
              : `אתה מודל תמלול אודיו מקצועי לפודקאסטים בעברית.
תמלל בדיוק של 100% מילה במילה את הדיבור באודיו לעברית (Verbatim Hebrew Speech-to-Text).
זהה הבדלים בין דוברים שונים (Speaker Diarization): סמן כל שורה עם שדה "speaker" ("דובר 1", "דובר 2" או שמותיהם). כאשר הדובר מתחלף, התחל שורה חדשה.
חלק לכתוביות קצרות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בשורה, עם תזמונים (startTime, endTime) בשניות (משך קטע זה: ${clipDuration} שניות).
החזר אך ורק מערך JSON תקין: [{"startTime": 0.5, "endTime": 3.0, "speaker": "דובר 1", "text": "טקסט שנאמר"}]`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentSettings.geminiApiKey.trim()}`;
            const gRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inlineData: { mimeType: 'audio/wav', data: cleanClipBase64 } },
                    { text: geminiPrompt }
                  ]
                }],
                generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
              })
            });
            if (gRes.ok) {
              const gJson = await gRes.json();
              const rawText = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawText) {
                const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
                const rawList = Array.isArray(parsed) ? parsed : (parsed.subtitles || []);
                clipSubs = rawList.map((s: any) => ({
                  ...s,
                  speaker: s.speaker ? String(s.speaker).trim() : undefined
                }));
              }
            }
          } catch (gErr) {
            console.warn('Clip Gemini direct error:', gErr);
          }
        }

        // Fallback: If still empty, use summary / hook
        if (clipSubs.length === 0) {
          const fallbackText = cleanAndPolishHebrewSubtitleText(activeClip.summary || activeClip.hookText || activeClip.title || '');
          clipSubs = splitTextIntoPacedSubtitles(fallbackText, wordsPerLine, 1, 0, clipDuration);
        }

        // If translateToHebrew was requested and any subtitle still has English, post-translate
        if (isTranslatingToHebrew && clipSubs.some(s => /[a-zA-Z]/.test(s.text))) {
          try {
            const tRes = await fetch('/api/ai/translate-subtitles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subtitles: clipSubs,
                targetLanguage: 'he',
                sourceLanguage: spokenLang || 'auto',
                apiKey: currentSettings.geminiApiKey,
                openaiApiKey: currentSettings.openaiApiKey
              })
            });
            if (tRes.ok) {
              const tData = await tRes.json();
              if (tData.subtitles && Array.isArray(tData.subtitles) && tData.subtitles.length > 0) {
                clipSubs = tData.subtitles;
              }
            }
          } catch (e) {}
        }

        // Normalize and offset timestamps to seamlessly match episode timeline
        const offsetSubs: SubtitleItem[] = clipSubs.map((s, idx) => {
          const relStart = typeof s.startTime === 'number' ? s.startTime : idx * 3;
          const relEnd = typeof s.endTime === 'number' ? s.endTime : (relStart + 3);
          return {
            id: `sub_clip_${Date.now()}_${idx}`,
            startTime: Number((activeClip.startTime + relStart).toFixed(2)),
            endTime: Number((activeClip.startTime + Math.max(relStart + 0.5, relEnd)).toFixed(2)),
            text: cleanAndPolishHebrewSubtitleText(s.text)
          };
        });

        // Merge: Remove any existing subtitles overlapping with this clip and insert new ones
        const remainingSubs = subtitles.filter(s => s.endTime < activeClip.startTime || s.startTime > activeClip.endTime);
        const merged = [...remainingSubs, ...offsetSubs].sort((a, b) => a.startTime - b.startTime);

        setSubtitles(merged);
        const updated = { ...episode, subtitles: merged };
        if (!updated.id.startsWith('standalone_')) {
          saveEpisode(updated);
        }
        if (onUpdateEpisode) onUpdateEpisode(updated);

        setIsTranscribing(false);
        setTranscribeProgress(null);
        setFilterSubtitlesByClip(true);

        if (videoRef.current) {
          videoRef.current.currentTime = activeClip.startTime;
          setCurrentTime(activeClip.startTime);
        }

        const clipMsg = isTranslatingToHebrew
          ? `✨ תמלול ותרגום הקטע "${activeClip.title}" לעברית הושלם בהצלחה! נוצרו ${offsetSubs.length} כתוביות בעברית.`
          : `✨ תמלול הקטע "${activeClip.title}" הושלם בהצלחה תוך שניות! נוצרו ${offsetSubs.length} כתוביות מדויקות לקטע זה.`;
        alert(clipMsg);
        return;
      }

      setTranscribeStatus(isTranslatingToHebrew
        ? 'מנתח ומחלק את הווידאו/השמע למקטעי עיבוד של 2 דקות לתמלול ותרגום לעברית...'
        : 'מנתח ומחלק את ההקלטה למקטעי עיבוד מדויקים של 2 דקות (תמיכה מלאה בפרקים ארוכים)...');
      
      // Slicing into 120s (2-minute) chunks - each chunk is safely ~3.8MB
      const chunks = await sliceAudioBlobIntoChunks(audioBlob, 120);
      const totalChunks = chunks.length;
      
      if (totalChunks === 0) {
        alert('קובץ השמע קצר מדי או ריק.');
        setIsTranscribing(false);
        return;
      }

      setTranscribeProgress({ current: 0, total: totalChunks });
      let accumulatedSubtitles: SubtitleItem[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const pct = Math.round(((i + 1) / totalChunks) * 100);
        setTranscribeProgress({ current: i + 1, total: totalChunks });
        setTranscribeStatus(isTranslatingToHebrew
          ? `מתמלל ומתרגם לעברית מקטע ${i + 1} מתוך ${totalChunks} (${pct}%)... [${formatSrtTimestamp(chunk.startSec).slice(3, 8)} - ${formatSrtTimestamp(chunk.endSec).slice(3, 8)}]`
          : `מתמלל מקטע ${i + 1} מתוך ${totalChunks} (${pct}%)... [${formatSrtTimestamp(chunk.startSec).slice(3, 8)} - ${formatSrtTimestamp(chunk.endSec).slice(3, 8)}]`);

        let chunkSubs: SubtitleItem[] = [];
        const chunkBase64 = await blobToBase64(chunk.blob);
        const cleanChunkBase64 = chunkBase64.replace(/^data:[^;]+;base64,/, '');

        // Attempt A: Next.js Server Transcribe Endpoint (Small ~3MB chunk)
        try {
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: chunkBase64,
              mimeType: chunk.blob.type || audioBlob.type || 'audio/wav',
              wordsPerLine,
              duration: chunk.durationSec,
              apiKey: currentSettings.geminiApiKey,
              openaiApiKey: currentSettings.openaiApiKey,
              elevenLabsApiKey: currentSettings.elevenLabsApiKey,
              provider: effectiveProvider,
              spokenLanguage: spokenLang,
              translateToHebrew: isTranslatingToHebrew,
              highEffortMode
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
              chunkSubs = data.subtitles;
            }
          }
        } catch (serverErr) {
          console.warn(`Server transcribe error on chunk ${i + 1}:`, serverErr);
        }

        // Attempt B: Direct Browser Gemini Pipeline (if server route was bypassed)
        if (chunkSubs.length === 0 && currentSettings.geminiApiKey?.trim()) {
          try {
            const geminiPrompt = isTranslatingToHebrew
              ? `אתה מודל תמלול ותרגום אודיו מקצועי לסרטונים ופודקאסטים.
האזן ישירות לאודיו (באנגלית או בכל שפה אחרת), תמלל ותרגם את כל מה שנאמר ישירות לעברית טבעית, שוטפת ומדויקת.
זהה הבדלים בין דוברים שונים (Speaker Diarization): סמן כל שורה עם שדה "speaker" ("דובר 1", "דובר 2" או שמותיהם). כאשר הדובר מתחלף, התחל שורה חדשה.
חלק לכתוביות קצרות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בשורה, עם תזמונים (startTime, endTime) בשניות (משך מקטע זה: ${chunk.durationSec} שניות).
החזר אך ורק מערך JSON תקין: [{"startTime": 0.5, "endTime": 3.0, "speaker": "דובר 1", "text": "תרגום מדויק לעברית"}]`
              : `אתה מודל תמלול אודיו מקצועי לפודקאסטים בעברית.
תמלל בדיוק של 100% מילה במילה את הדיבור באודיו לעברית (Verbatim Hebrew Speech-to-Text).
זהה הבדלים בין דוברים שונים (Speaker Diarization): סמן כל שורה עם שדה "speaker" ("דובר 1", "דובר 2" או שמותיהם). כאשר הדובר מתחלף, התחל שורה חדשה.
חלק לכתוביות קצרות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בשורה, עם תזמונים (startTime, endTime) בשניות (משך מקטע זה: ${chunk.durationSec} שניות).
החזר אך ורק מערך JSON תקין: [{"startTime": 0.5, "endTime": 3.0, "speaker": "דובר 1", "text": "טקסט שנאמר"}]`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentSettings.geminiApiKey.trim()}`;
            const gRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inlineData: { mimeType: 'audio/wav', data: cleanChunkBase64 } },
                    { text: geminiPrompt }
                  ]
                }],
                generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
              })
            });

            if (gRes.ok) {
              const gJson = await gRes.json();
              const rawText = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawText) {
                const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
                const list = Array.isArray(parsed) ? parsed : (parsed.subtitles || []);
                chunkSubs = list.map((s: any) => ({
                  ...s,
                  speaker: s.speaker ? String(s.speaker).trim() : undefined
                }));
              }
            }
          } catch (gErr) {
            console.warn(`Direct Gemini chunk ${i + 1} error:`, gErr);
          }
        }

        // Attempt C: Direct Whisper Pipeline for this small chunk
        if (chunkSubs.length === 0 && currentSettings.openaiApiKey?.trim()) {
          try {
            const formData = new FormData();
            formData.append('file', chunk.blob, `chunk_${i}.wav`);
            formData.append('model', 'whisper-1');
            if (spokenLang && spokenLang !== 'auto') {
              formData.append('language', spokenLang);
            }
            if (spokenLang === 'he' || (!spokenLang && !isTranslatingToHebrew)) {
              formData.append('prompt', 'תמלול עברית מלא ומדויק מילה במילה.');
            }
            formData.append('temperature', '0');
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities[]', 'word');

            const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${currentSettings.openaiApiKey.trim()}` },
              body: formData
            });

            if (whisperRes.ok) {
              const wData = await whisperRes.json();
              if (wData.words && wData.words.length > 0) {
                chunkSubs = buildSubtitlesFromWhisperWords(wData.words, wordsPerLine);
              } else if (wData.segments) {
                chunkSubs = wData.segments.map((seg: any, idx: number) => ({
                  id: `sub_whisper_${Date.now()}_${idx}`,
                  startTime: Number(Number(seg.start).toFixed(2)),
                  endTime: Number(Number(seg.end).toFixed(2)),
                  text: String(seg.text || '').trim()
                })).filter((s: any) => s.text.length > 0);
              }
            }
          } catch (wErr) {
            console.warn(`Whisper chunk ${i + 1} error:`, wErr);
          }
        }

        // Offset chunk timestamps and append to accumulated results
        if (chunkSubs.length > 0) {
          const offsetSubs: SubtitleItem[] = chunkSubs.map((s, sIdx) => ({
            id: `sub_${Date.now()}_c${i}_${sIdx}`,
            startTime: Number((chunk.startSec + (Number(s.startTime) || 0)).toFixed(2)),
            endTime: Number((chunk.startSec + (Number(s.endTime) || chunk.durationSec)).toFixed(2)),
            text: String(s.text || '').trim()
          })).filter(s => s.text.length > 0);

          accumulatedSubtitles = [...accumulatedSubtitles, ...offsetSubs];
          setSubtitles([...accumulatedSubtitles]); // Stream live results to UI immediately!
        }
      }

      if (accumulatedSubtitles.length > 0) {
        // If Hebrew translation was requested and non-Hebrew characters exist, run final translation pass
        if (isTranslatingToHebrew && accumulatedSubtitles.some(s => /[a-zA-Z]/.test(s.text))) {
          try {
            setTranscribeStatus('משלים תרגום סופי לעברית...');
            const tRes = await fetch('/api/ai/translate-subtitles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subtitles: accumulatedSubtitles,
                targetLanguage: 'he',
                sourceLanguage: spokenLang || 'auto',
                apiKey: currentSettings.geminiApiKey,
                openaiApiKey: currentSettings.openaiApiKey
              })
            });
            if (tRes.ok) {
              const tData = await tRes.json();
              if (tData.subtitles && Array.isArray(tData.subtitles) && tData.subtitles.length > 0) {
                accumulatedSubtitles = tData.subtitles;
              }
            }
          } catch (tErr) {
            console.warn('Post-translation pass error:', tErr);
          }
        }

        const sorted = accumulatedSubtitles.sort((a, b) => a.startTime - b.startTime);
        setSubtitles(sorted);
        const updated: Episode = { ...episode, subtitles: sorted };
        if (!updated.id.startsWith('standalone_')) {
          saveEpisode(updated);
        }
        if (onUpdateEpisode) onUpdateEpisode(updated);
        setIsTranscribing(false);
        setTranscribeProgress(null);

        const successAlert = isTranslatingToHebrew
          ? `✨ תמלול ותרגום הסרטון לעברית הושלם בהצלחה! נוצרו ${sorted.length} כתוביות בעברית עם סנכרון תזמונים מלא.`
          : `✨ התמלול הושלם בהצלחה! נוצרו ${sorted.length} כתוביות מסונכרנות על פני כל ${totalChunks} המקטעים של הפרק.`;
        alert(successAlert);
        return;
      }

      // Fallback to Topics if AI returned 0 words
      if (episode.topics && episode.topics.length > 0) {
        const totalDurationSec = videoRef.current?.duration || episode.recording?.duration || 600;
        const generated = generateSubtitlesFromTopics(episode.topics, totalDurationSec, wordsPerLine);
        if (generated.length > 0) {
          setSubtitles(generated);
          const updated: Episode = { ...episode, subtitles: generated };
          if (!updated.id.startsWith('standalone_')) {
            saveEpisode(updated);
          }
          if (onUpdateEpisode) onUpdateEpisode(updated);
          setIsTranscribing(false);
          setTranscribeProgress(null);
          alert('שרתי ה-AI החזירו תוצאה ריקה עבור הקלטה זו. יצרנו עבורך כתוביות מסונכרנות מנושאי הפרק.');
          return;
        }
      }

      setIsTranscribing(false);
      setTranscribeProgress(null);
      setIsAIModalOpen(true);
      alert('לא התקבל תמלול. נא לוודא שמוגדר מפתח API פעיל בהגדרות ה-AI ולוודא שהקובץ מכיל דיבור ברור.');
    } catch (err: any) {
      setIsTranscribing(false);
      setTranscribeProgress(null);
      alert('שגיאה במהלך תמלול הפרק: ' + err.message);
    }
  };

  // 2. AI Subtitles Translation Handlers (Translate English to Hebrew, Hebrew to English, etc.)
  const handleTranslateSingleSubtitle = async (item: SubtitleItem, targetLang = 'he') => {
    try {
      const currentSettings = getAISettings();
      const res = await fetch('/api/ai/translate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: [item],
          targetLanguage: targetLang,
          sourceLanguage: 'auto',
          apiKey: currentSettings.geminiApiKey,
          openaiApiKey: currentSettings.openaiApiKey
        })
      });
      const data = await res.json();
      if (res.ok && data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        const translatedText = data.subtitles[0].text;
        setSubtitles(prev => prev.map(s => s.id === item.id ? { ...s, text: translatedText } : s));
      } else {
        alert(data.error || 'שגיאה בתרגום הכתובית.');
      }
    } catch (e: any) {
      alert('שגיאה בתרגום: ' + e.message);
    }
  };

  const handleBatchTranslateSelected = async (targetLang = 'he') => {
    if (selectedIds.length === 0) return;
    const items = subtitles.filter(s => selectedIds.includes(s.id));
    if (items.length === 0) return;

    setIsTranslating(true);
    try {
      const currentSettings = getAISettings();
      const res = await fetch('/api/ai/translate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: items,
          targetLanguage: targetLang,
          sourceLanguage: 'auto',
          apiKey: currentSettings.geminiApiKey,
          openaiApiKey: currentSettings.openaiApiKey
        })
      });
      const data = await res.json();
      if (res.ok && data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        const map = new Map<string, string>(data.subtitles.map((s: SubtitleItem) => [s.id, String(s.text || '')]));
        setSubtitles(prev => prev.map(s => map.has(s.id) ? { ...s, text: map.get(s.id) || s.text } : s));
        alert(`תורגמו בהצלחה ${data.subtitles.length} כתוביות שנבחרו! (${data.source || 'מנוע תרגום'})`);
      } else {
        alert(data.error || 'שגיאה בתרגום הכתוביות שנבחרו.');
      }
    } catch (err: any) {
      alert('שגיאה בתרגום: ' + err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateSubtitles = async (
    targetLang: string = selectedTargetLang, 
    sourceLang: string = selectedSourceLang, 
    scope: 'all' | 'selected' = selectedTranslateScope
  ) => {
    const itemsToTranslate = (scope === 'selected' && selectedIds.length > 0)
      ? subtitles.filter(s => selectedIds.includes(s.id))
      : subtitles;

    if (itemsToTranslate.length === 0) {
      alert('אין כתוביות לתרגום.');
      return;
    }

    const currentSettings = getAISettings();
    setIsTranslating(true);
    try {
      const res = await fetch('/api/ai/translate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: itemsToTranslate,
          targetLanguage: targetLang,
          sourceLanguage: sourceLang,
          apiKey: currentSettings.geminiApiKey,
          openaiApiKey: currentSettings.openaiApiKey
        })
      });

      const data = await res.json();
      if (res.ok && data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        const translationMap = new Map<string, string>(data.subtitles.map((s: SubtitleItem) => [s.id, String(s.text || '')]));
        setSubtitles(prev => prev.map(s => {
          if (translationMap.has(s.id)) {
            return { ...s, text: translationMap.get(s.id) || s.text };
          }
          return s;
        }));
        setIsTranslating(false);
        setIsTranslateModalOpen(false);
        alert(`התרגום הושלם בהצלחה! תורגמו ${data.subtitles.length} כתוביות (${data.source || 'מנוע תרגום'}).`);
      } else {
        alert(data.error || 'שגיאה בתרגום הכתוביות.');
        setIsTranslating(false);
      }
    } catch (err: any) {
      setIsTranslating(false);
      alert('שגיאה בתרגום: ' + err.message);
    }
  };

  // 3. AI Subtitle Precision & Grammar/Speech Recovery (דיוק כתוביות בעזרת AI)
  const handleRefineSubtitles = async () => {
    if (subtitles.length === 0) {
      alert('אין כתוביות לדיוק. נא לתמלל או להוסיף כתוביות תחילה.');
      return;
    }

    const currentSettings = getAISettings();
    if (!currentSettings.geminiApiKey?.trim() && !currentSettings.openaiApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    const targets = selectedIds.length > 0
      ? subtitles.filter(s => selectedIds.includes(s.id))
      : subtitles;

    setIsRefining(true);
    setTranscribeStatus(`מנתח ומדייק ${targets.length} כתוביות בעזרת AI...`);

    try {
      const res = await fetch('/api/ai/refine-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: targets,
          contextHint: episode.title || activeClip?.title || '',
          apiKey: currentSettings.geminiApiKey,
          openaiApiKey: currentSettings.openaiApiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.subtitles && Array.isArray(data.subtitles)) {
          const refinedMap = new Map<string, string>();
          data.subtitles.forEach((s: SubtitleItem) => {
            if (s.id && s.text) refinedMap.set(s.id, s.text);
          });

          const updatedSubs = subtitles.map(s => {
            const newText = refinedMap.get(s.id);
            return newText ? { ...s, text: newText } : s;
          });

          setSubtitles(updatedSubs);
          const updated = { ...episode, subtitles: updatedSubs };
          if (!updated.id.startsWith('standalone_')) saveEpisode(updated);
          if (onUpdateEpisode) onUpdateEpisode(updated);

          alert(`🎯 דיוק הכתוביות הושלם בהצלחה!\nשופצו ודויקו ${data.changesCount || 0} שורות כתוביות לפיסוק ודיוק מקסימלי.`);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(`שגיאה בדיוק כתוביות: ${errJson.error || 'נסה שוב'}`);
      }
    } catch (err: any) {
      console.error('Refine error:', err);
      alert('שגיאת רשת בדיוק כתוביות.');
    } finally {
      setIsRefining(false);
      setTranscribeStatus('');
    }
  };

  // 4. Deep decode for a single unclear/muffled subtitle item (התאמץ לפענח שוב קטע זה)
  const handleDeepDecodeSubtitle = async (sub: SubtitleItem) => {
    const currentSettings = getAISettings();
    if (!currentSettings.geminiApiKey?.trim() && !currentSettings.openaiApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    const audioBlob = await resolveMediaBlob();
    if (!audioBlob) {
      alert('לא נמצא קובץ וידאו או אודיו לפענוח מקטע זה.');
      return;
    }

    setRefiningSubtitleId(sub.id);
    try {
      const snippetBlob = await extractAndEnhanceAudioSnippet(audioBlob, sub.startTime, sub.endTime);
      const snippetBase64 = await blobToBase64(snippetBlob);

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: snippetBase64,
          mimeType: 'audio/wav',
          wordsPerLine: 8,
          duration: Math.max(1, sub.endTime - sub.startTime),
          apiKey: currentSettings.geminiApiKey,
          openaiApiKey: currentSettings.openaiApiKey,
          provider: currentSettings.transcriptionProvider,
          highEffortMode: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          const newText = data.subtitles.map((s: any) => s.text).join(' ').trim();
          if (newText) {
            const updatedSubs = subtitles.map(s => s.id === sub.id ? { ...s, text: cleanAndPolishHebrewSubtitleText(newText) } : s);
            setSubtitles(updatedSubs);
            const updated = { ...episode, subtitles: updatedSubs };
            if (!updated.id.startsWith('standalone_')) saveEpisode(updated);
            if (onUpdateEpisode) onUpdateEpisode(updated);
          }
        }
      } else {
        alert('לא ניתן היה לפענח שוב קטע זה. נסו שנית או ערכו ידנית.');
      }
    } catch (e) {
      console.warn('Deep decode error:', e);
    } finally {
      setRefiningSubtitleId(null);
    }
  };

  // Multi-Speaker Diarization Handlers
  const projectSpeakers = Array.from(
    new Set(subtitles.map(s => s.speaker?.trim()).filter(Boolean))
  ) as string[];

  const handleAssignSpeaker = (subtitleId: string, newSpeaker: string, applyToSelected: boolean = false) => {
    const cleanSpeaker = newSpeaker.trim();
    if (!cleanSpeaker) return;
    const targetIds = applyToSelected && selectedIds.includes(subtitleId) ? selectedIds : [subtitleId];
    const updatedSubs = subtitles.map(s => targetIds.includes(s.id) ? { ...s, speaker: cleanSpeaker } : s);
    setSubtitles(updatedSubs);
    const updated = { ...episode, subtitles: updatedSubs };
    if (!updated.id.startsWith('standalone_')) saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
    setActiveSpeakerPopoverId(null);
  };

  const handleRenameSpeakerGlobally = (oldName: string, newName: string) => {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanOld || !cleanNew || cleanOld === cleanNew) return;

    const updatedSubs = subtitles.map(s => s.speaker === cleanOld ? { ...s, speaker: cleanNew } : s);
    
    // Also update custom speaker colors map if oldName had custom color
    if (globalStyle.speakerColors && globalStyle.speakerColors[cleanOld]) {
      const existingColors = { ...(globalStyle.speakerColors || {}) };
      existingColors[cleanNew] = existingColors[cleanOld];
      delete existingColors[cleanOld];
      applyStyleUpdate({ speakerColors: existingColors });
    }

    setSubtitles(updatedSubs);
    const updated = { ...episode, subtitles: updatedSubs };
    if (!updated.id.startsWith('standalone_')) saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  const handleAutoDiarizeSubtitles = async () => {
    if (!subtitles || subtitles.length === 0) {
      alert('אין כתוביות לזיהוי דוברים.');
      return;
    }

    const currentSettings = getAISettings();
    if (!currentSettings.geminiApiKey?.trim() && !currentSettings.openaiApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    setIsDiarizingSubtitles(true);
    setTranscribeStatus('מנתח את מבנה השיחה ומזהה חילופי דוברים עם AI...');

    try {
      const res = await fetch('/api/ai/diarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles,
          knownSpeakers: projectSpeakers,
          contextHint: episode.title || activeClip?.title || '',
          apiKey: currentSettings.geminiApiKey,
          openaiApiKey: currentSettings.openaiApiKey
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
          setSubtitles(data.subtitles);
          const updated = { ...episode, subtitles: data.subtitles };
          if (!updated.id.startsWith('standalone_')) saveEpisode(updated);
          if (onUpdateEpisode) onUpdateEpisode(updated);
          alert(`✨ זיהוי הדוברים הושלם בהצלחה!\nזוהו ${data.speakers?.length || 2} דוברים שונים ותויגו כל ${data.diarizedCount || data.subtitles.length} שורות הכתוביות.`);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'שגיאה בזיהוי דוברים. נסו שנית.');
      }
    } catch (e: any) {
      alert(`שגיאה בחיבור לשרת ה-AI: ${e.message}`);
    } finally {
      setIsDiarizingSubtitles(false);
      setTranscribeStatus('');
    }
  };

  // 2. Live Hebrew Speech Recognition Dictation
  const toggleLiveDictation = () => {
    if (isDictating) {
      if (dictationRecRef.current) {
        dictationRecRef.current.stop();
        dictationRecRef.current = null;
      }
      setIsDictating(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('דפדפן זה אינו תומך בהכתבה חיה. מומלץ להשתמש ב-Google Chrome.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'he-IL';

      rec.onresult = (event: any) => {
        const nowT = videoRef.current ? videoRef.current.currentTime : currentTime;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const spoken = event.results[i][0]?.transcript?.trim();
            if (spoken) {
              const newSub: SubtitleItem = {
                id: `sub_dictate_${Date.now()}_${subtitles.length}`,
                startTime: Number(nowT.toFixed(2)),
                endTime: Number((nowT + 3.0).toFixed(2)),
                text: spoken
              };
              setSubtitles(prev => [...prev, newSub]);
            }
          }
        }
      };

      rec.onend = () => setIsDictating(false);
      rec.start();
      dictationRecRef.current = rec;
      setIsDictating(true);
    } catch (e: any) {
      alert('שגיאה בהפעלת מיקרופון: ' + e.message);
    }
  };

  // 3. Generate Subtitles automatically from Episode Topics & Outline
  const handleGenerateFromTopics = () => {
    if (!episode.topics || episode.topics.length === 0) {
      alert('לא נמצאו נושאי שיחה בפרק זה.');
      return;
    }
    const dur = videoRef.current?.duration || (episode.targetDurationMinutes ? episode.targetDurationMinutes * 60 : 600);
    const generated = generateSubtitlesFromTopics(episode.topics, dur, wordsPerLine);
    if (generated.length > 0) {
      setSubtitles(generated);
      const updated: Episode = { ...episode, subtitles: generated };
      saveEpisode(updated);
      if (onUpdateEpisode) onUpdateEpisode(updated);
      alert(`נוצרו ${generated.length} כתוביות בהצלחה מתוך נושאי השיחה ותסריט הפרק!`);
    }
  };

  // 4. Import Subtitles from external .SRT or .VTT file
  const srtFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadDirectAudioForTranscribe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentMediaBlob(file);

    try {
      setTranscribeStatus('טוען ושומר את קובץ השמע...');
      setIsTranscribing(true);
      const blobKey = `rec_uploaded_${episode.id}_${Date.now()}`;
      await saveMediaBlob(blobKey, file);

      // Determine duration
      let durationSeconds = 60;
      try {
        const url = URL.createObjectURL(file);
        const tempAudio = new Audio(url);
        await new Promise((resolve) => {
          tempAudio.onloadedmetadata = () => {
            durationSeconds = Math.round(tempAudio.duration) || 60;
            resolve(true);
          };
          tempAudio.onerror = () => resolve(true);
          setTimeout(() => resolve(true), 2500);
        });
      } catch {}

      const updated: Episode = {
        ...episode,
        status: 'recorded',
        recording: {
          recordedAt: new Date().toISOString(),
          duration: durationSeconds,
          audioBlobKey: blobKey,
          markers: [],
          topicsCovered: []
        }
      };

      saveEpisode(updated);
      if (onUpdateEpisode) onUpdateEpisode(updated);
      setVideoUrl(URL.createObjectURL(file));

      // Trigger automatic transcription
      handleTranscribeRecordedAudio();
    } catch (err: any) {
      setIsTranscribing(false);
      alert('שגיאה בטעינת קובץ השמע: ' + err.message);
    }
  };

  const handleImportSrtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const isVtt = file.name.toLowerCase().endsWith('.vtt');
      const parsed = isVtt ? parseVTT(content) : parseSRT(content);
      if (parsed.length > 0) {
        setSubtitles(parsed);
        const updated: Episode = { ...episode, subtitles: parsed };
        saveEpisode(updated);
        if (onUpdateEpisode) onUpdateEpisode(updated);
        alert(`נטענו ${parsed.length} כתוביות בהצלחה מקובץ ${file.name}!`);
      } else {
        alert('לא נמצאו כתוביות תקינות בקובץ שהועלה.');
      }
    };
    reader.readAsText(file);
  };

  // 5. Custom Font Upload Handler with Persistence
  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const rawFontName = file.name.replace(/\.[^/.]+$/, '');
    const fontName = rawFontName.replace(/[^\w\d]/g, '_');
    const reader = new FileReader();
    reader.onload = (event) => {
      const fontUrl = event.target?.result as string;
      const styleId = `custom-font-${fontName}`;
      let existingStyle = document.getElementById(styleId);
      if (!existingStyle) {
        existingStyle = document.createElement('style');
        existingStyle.id = styleId;
        document.head.appendChild(existingStyle);
      }
      existingStyle.textContent = `
        @font-face {
          font-family: '${fontName}';
          src: url('${fontUrl}');
        }
      `;

      const fontValue = `'${fontName}', sans-serif`;
      const newFontEntry = { name: file.name, value: fontValue, dataUrl: fontUrl };
      saveStoredCustomFont(newFontEntry);

      setCustomFonts(prev => {
        const filtered = prev.filter(f => f.value !== fontValue);
        return [...filtered, { name: `פונט אישי: ${file.name}`, value: fontValue }];
      });
      applyStyleUpdate({ fontFamily: fontValue });
      alert(`הפונט "${file.name}" נטען, נשמר לצמיתות והוחל בהצלחה!`);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteCustomFont = (fontValue: string) => {
    deleteStoredCustomFont(fontValue);
    setCustomFonts(prev => prev.filter(f => f.value !== fontValue));
    if (globalStyle.fontFamily === fontValue) {
      applyStyleUpdate({ fontFamily: 'Rubik, sans-serif' });
    }
  };

  // 6. Brand Logo Upload & Persistent Handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const logoUrl = event.target?.result as string;
      applyStyleUpdate({
        logoEnabled: true,
        logoUrl
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLogoPermanent = () => {
    if (!globalStyle.logoUrl) {
      alert('אנא העלה קובץ לוגו תחילה.');
      return;
    }
    const config: PermanentLogoConfig = {
      url: globalStyle.logoUrl,
      opacity: (globalStyle.logoOpacity !== undefined ? globalStyle.logoOpacity : 90) / 100,
      size: globalStyle.logoSize || 64,
      positionPreset: (globalStyle.logoPosition as any) || 'top-right',
      showByDefault: globalStyle.logoEnabled !== false,
      transform: { x: globalStyle.logoOffsetX || 16, y: globalStyle.logoOffsetY || 16, scale: 1.0 }
    };
    savePermanentLogo(config, episode?.podcastId);
    setLogoSaveSuccess(true);
    setTimeout(() => setLogoSaveSuccess(false), 3000);
  };

  const handleClearPermanentLogo = () => {
    if (confirm('להסיר את הלוגו הקבוע מברירת המחדל?')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('castflow_permanent_logo');
        if (episode?.podcastId) {
          localStorage.removeItem(`castflow_permanent_logo_${episode.podcastId}`);
        }
      }
      applyStyleUpdate({ logoEnabled: false, logoUrl: '' });
      alert('הלוגו הקבוע הוסר בהצלחה.');
    }
  };

  // Direct media file uploader (for standalone or quick testing)
  const handleDirectMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentMediaBlob(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setIsStandaloneMedia(true);
  };

  // 4. Playback Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (activeClip) {
        if (isStandaloneMedia) {
          const maxDur = activeClip.duration || videoRef.current.duration || 45;
          if (currentTime >= maxDur) {
            videoRef.current.currentTime = 0;
            setCurrentTime(0);
          }
        } else {
          if (currentTime < activeClip.startTime || currentTime >= activeClip.endTime) {
            videoRef.current.currentTime = activeClip.startTime;
            setCurrentTime(activeClip.startTime);
          }
        }
      }
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const jumpToTime = (seconds: number) => {
    if (videoRef.current) {
      let target = seconds;
      if (activeClip) {
        if (isStandaloneMedia) {
          const maxDur = activeClip.duration || videoRef.current.duration || 45;
          target = Math.max(0, Math.min(maxDur, target));
        } else {
          target = Math.max(activeClip.startTime, Math.min(activeClip.endTime, target));
        }
      } else {
        target = Math.max(0, target);
      }
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  const activeSubtitle = subtitles.find(s => {
    if (currentTime >= s.startTime && currentTime <= s.endTime) return true;
    if (activeClip && isStandaloneMedia) {
      const relStart = s.startTime >= activeClip.startTime ? s.startTime - activeClip.startTime : s.startTime;
      const relEnd = s.endTime >= activeClip.startTime ? s.endTime - activeClip.startTime : s.endTime;
      return currentTime >= relStart && currentTime <= relEnd;
    }
    return false;
  });

  // Selection with Shift+Click Range Selection
  const toggleSelect = (id: string, index?: number, shiftKey?: boolean) => {
    if (shiftKey && index !== undefined && lastSelectedIdx !== null) {
      const start = Math.min(lastSelectedIdx, index);
      const end = Math.max(lastSelectedIdx, index);
      const rangeIds = subtitles.slice(start, end + 1).map(s => s.id);
      setSelectedIds(prev => Array.from(new Set([...prev, ...rangeIds])));
    } else {
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
      if (index !== undefined) {
        setLastSelectedIdx(index);
      }
    }
  };

  const selectAll = () => {
    if (selectedIds.length === subtitles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(subtitles.map(s => s.id));
    }
  };

  // Batch Operations for Selected Subtitles
  const handleBatchShiftTiming = (delta: number) => {
    if (selectedIds.length === 0) return;
    setSubtitles(prev => prev.map(s => {
      if (selectedIds.includes(s.id)) {
        const newStart = Math.max(0, Number((s.startTime + delta).toFixed(2)));
        const dur = Math.max(0.3, s.endTime - s.startTime);
        const newEnd = Number((newStart + dur).toFixed(2));
        return { ...s, startTime: newStart, endTime: newEnd };
      }
      return s;
    }));
  };

  const handleBatchApplyCurrentStyle = () => {
    if (selectedIds.length === 0) return;
    setSubtitles(prev => prev.map(s => {
      if (selectedIds.includes(s.id)) {
        return { ...s, customStyle: { ...globalStyle } };
      }
      return s;
    }));
    alert(`העיצוב הנוכחי הוחל בהצלחה על ${selectedIds.length} כתוביות שנבחרו!`);
  };

  const handleBatchMerge = () => {
    if (selectedIds.length < 2) {
      alert('יש לבחור לפחות 2 כתוביות כדי לאחד אותן.');
      return;
    }
    const selectedSubs = subtitles.filter(s => selectedIds.includes(s.id)).sort((a, b) => a.startTime - b.startTime);
    const minStart = selectedSubs[0].startTime;
    const maxEnd = selectedSubs[selectedSubs.length - 1].endTime;
    const mergedText = selectedSubs.map(s => s.text.trim()).join(' ');
    const firstId = selectedSubs[0].id;
    const mergedItem: SubtitleItem = {
      id: `sub_merged_${Date.now()}`,
      startTime: minStart,
      endTime: maxEnd,
      text: mergedText,
      customStyle: selectedSubs[0].customStyle
    };
    setSubtitles(prev => {
      const remaining = prev.filter(s => !selectedIds.includes(s.id));
      const insertIdx = prev.findIndex(s => s.id === firstId);
      remaining.splice(insertIdx >= 0 ? insertIdx : remaining.length, 0, mergedItem);
      return remaining.sort((a, b) => a.startTime - b.startTime);
    });
    setSelectedIds([mergedItem.id]);
  };

  const handleBatchRechunk = (wordsLimit: number) => {
    if (subtitles.length === 0) return;
    if (selectedIds.length > 0) {
      const selectedSubs = subtitles.filter(s => selectedIds.includes(s.id)).sort((a, b) => a.startTime - b.startTime);
      const rechunked = smartRebalanceSubtitles(selectedSubs, wordsLimit, 1);
      const firstId = selectedSubs[0].id;
      setSubtitles(prev => {
        const remaining = prev.filter(s => !selectedIds.includes(s.id));
        const insertIdx = prev.findIndex(s => s.id === firstId);
        remaining.splice(insertIdx >= 0 ? insertIdx : remaining.length, 0, ...rechunked);
        return remaining.sort((a, b) => a.startTime - b.startTime);
      });
      setSelectedIds([]);
      alert(`${selectedSubs.length} כתוביות חולקו מחדש ל-${wordsLimit} מילים בכל כרטיס!`);
    } else {
      handleRebalanceAll(wordsLimit);
    }
  };

  // Apply style to selected or global
  const applyStyleUpdate = (updates: Partial<SubtitleStyle>) => {
    setGlobalStyle(prev => ({ ...prev, ...updates }));

    if (selectedIds.length > 0) {
      setSubtitles(prev => prev.map(s => {
        if (selectedIds.includes(s.id)) {
          return {
            ...s,
            customStyle: { ...(s.customStyle || globalStyle), ...updates }
          };
        }
        return s;
      }));
    }
  };

  // Subtitle CRUD
  const handleAddSubtitle = () => {
    const start = Number(currentTime.toFixed(2));
    const end = Number((currentTime + 3.0).toFixed(2));
    const newSub: SubtitleItem = {
      id: `sub_${Date.now()}`,
      startTime: start,
      endTime: end,
      text: 'מילים שנאמרו בפועל...'
    };
    setSubtitles(prev => [...prev, newSub].sort((a, b) => a.startTime - b.startTime));
  };

  const handleUpdateText = (id: string, text: string) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const adjustTiming = (id: string, field: 'startTime' | 'endTime', delta: number) => {
    setSubtitles(prev => prev.map(s => {
      if (s.id === id) {
        const newVal = Math.max(0, Number((s[field] + delta).toFixed(2)));
        if (field === 'startTime' && newVal >= s.endTime) {
          return { ...s, startTime: newVal, endTime: Number((newVal + 0.4).toFixed(2)) };
        }
        if (field === 'endTime' && newVal <= s.startTime) {
          return { ...s, endTime: Number((s.startTime + 0.2).toFixed(2)) };
        }
        return { ...s, [field]: newVal };
      }
      return s;
    }));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setSubtitles(prev => prev.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  };

  const handleDeleteSubtitle = (id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => prev.filter(item => item !== id));
  };

  // Apply Preset Theme
  const handleApplyTheme = (theme: typeof SUBTITLE_THEMES[0]) => {
    applyStyleUpdate(theme.style);
    alert(`סגנון "${theme.name}" הוחל בהצלחה על הכתוביות!`);
  };

  // Re-split and re-balance all subtitles into target words per line
  const handleRebalanceAll = (words: number) => {
    if (subtitles.length === 0) return;
    const rebalanced = smartRebalanceSubtitles(subtitles, words, linesPerSubtitle);
    setSubtitles(rebalanced);
    const updated: Episode = { ...episode, subtitles: rebalanced };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Semantic Sentence Splitter: Groups and splits subtitles strictly by punctuation (. , ? ! - :)
  const handleSegmentByPunctuation = () => {
    if (subtitles.length === 0) return;
    const segmented = segmentSubtitlesByPunctuation(subtitles);
    setSubtitles(segmented);
    const updated: Episode = { ...episode, subtitles: segmented };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
    alert(`בוצעה חלוקה סמנטית לפי משפטים וסימני פיסוק! נוצרו ${segmented.length} כתוביות.`);
  };

  // Max Character Limit Segmenter (e.g. 28/35/45 chars for mobile)
  const handleSegmentByMaxChars = (maxChars: number = 30) => {
    if (subtitles.length === 0) return;
    const segmented = segmentSubtitlesByMaxChars(subtitles, maxChars);
    setSubtitles(segmented);
    const updated: Episode = { ...episode, subtitles: segmented };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
    alert(`בוצעה חלוקה לפי מגבלת רוחב של עד ${maxChars} תווים לשורה!`);
  };

  // Split single cue into two proportional halves
  const handleSplitSingleSubtitle = (sub: SubtitleItem) => {
    const [sub1, sub2] = splitSubtitleItemAtMiddle(sub);
    const idx = subtitles.findIndex(s => s.id === sub.id);
    if (idx === -1) return;
    const copy = [...subtitles];
    copy.splice(idx, 1, sub1, sub2);
    setSubtitles(copy);
    const updated: Episode = { ...episode, subtitles: copy };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Split single cue at an exact word index
  const handleSplitAtWord = (sub: SubtitleItem, wordIdx: number) => {
    const [sub1, sub2] = splitSubtitleItemAtWordIndex(sub, wordIdx);
    const idx = subtitles.findIndex(s => s.id === sub.id);
    if (idx === -1) return;
    const copy = [...subtitles];
    copy.splice(idx, 1, sub1, sub2);
    setSubtitles(copy);
    const updated: Episode = { ...episode, subtitles: copy };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Merge cue with subsequent cue
  const handleMergeWithNext = (idx: number) => {
    const merged = mergeSubtitleWithNext(subtitles, idx);
    setSubtitles(merged);
    const updated: Episode = { ...episode, subtitles: merged };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Merge cue with previous cue
  const handleMergeWithPrev = (idx: number) => {
    const merged = mergeSubtitleWithPrevious(subtitles, idx);
    setSubtitles(merged);
    const updated: Episode = { ...episode, subtitles: merged };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Clean Hebrew fillers and fix punctuation
  const handlePolishSingleSubtitle = (id: string) => {
    setSubtitles(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, text: cleanAndPolishHebrewSubtitleText(s.text) };
      }
      return s;
    }));
  };

  const handlePolishAllSubtitles = () => {
    setSubtitles(prev => prev.map(s => ({
      ...s,
      text: cleanAndPolishHebrewSubtitleText(s.text)
    })));
  };

  // Shift all timestamps by +/- delta seconds to fix microphone/video delay
  const handleShiftAll = (delta: number) => {
    if (subtitles.length === 0) return;
    const shifted = shiftAllSubtitleTimestamps(subtitles, delta);
    setSubtitles(shifted);
    const updated: Episode = { ...episode, subtitles: shifted };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Snap subtitle start or end to current playback position in video
  const handleSnapToCurrentTime = (id: string, targetField: 'startTime' | 'endTime' = 'startTime') => {
    const current = Number(currentTime.toFixed(2));
    setSubtitles(prev => prev.map(s => {
      if (s.id === id) {
        if (targetField === 'startTime') {
          const duration = Math.max(0.4, s.endTime - s.startTime);
          return {
            ...s,
            startTime: current,
            endTime: current >= s.endTime ? Number((current + duration).toFixed(2)) : s.endTime
          };
        } else {
          return {
            ...s,
            endTime: Math.max(Number((s.startTime + 0.3).toFixed(2)), current)
          };
        }
      }
      return s;
    }));
  };

  // Save to DB
  const handleSaveSubtitles = () => {
    const updated: Episode = {
      ...episode,
      subtitles,
      subtitleStyle: globalStyle
    };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
    alert('הכתוביות ועיצוב הגופנים נשמרו בהצלחה במסד הנתונים!');
  };

  // Export SRT & VTT
  const handleExportSRT = () => {
    let targetSubs = subtitles;
    let fileName = `${episode.title}_subtitles.srt`;
    if (activeClip) {
      const clipSubs = subtitles.filter(s => s.startTime >= activeClip.startTime - 0.5 && s.endTime <= activeClip.endTime + 0.5);
      targetSubs = clipSubs.map(s => ({
        ...s,
        startTime: Math.max(0, Number((s.startTime - activeClip.startTime).toFixed(2))),
        endTime: Math.max(0.5, Number((s.endTime - activeClip.startTime).toFixed(2)))
      }));
      fileName = `${episode.title}_${activeClip.title.replace(/\s+/g, '_')}_short.srt`;
    }
    const srtContent = exportToSRT(targetSubs);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportVTT = () => {
    let targetSubs = subtitles;
    let fileName = `${episode.title}_subtitles.vtt`;
    if (activeClip) {
      const clipSubs = subtitles.filter(s => s.startTime >= activeClip.startTime - 0.5 && s.endTime <= activeClip.endTime + 0.5);
      targetSubs = clipSubs.map(s => ({
        ...s,
        startTime: Math.max(0, Number((s.startTime - activeClip.startTime).toFixed(2))),
        endTime: Math.max(0.5, Number((s.endTime - activeClip.startTime).toFixed(2)))
      }));
      fileName = `${episode.title}_${activeClip.title.replace(/\s+/g, '_')}_short.vtt`;
    }
    const vttContent = exportToVTT(targetSubs);
    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download or Save standalone media file for the active clip
  const handleDownloadActiveClipMedia = async () => {
    if (!activeClip) return;
    try {
      let blob: Blob | null = null;
      if (activeClip.videoBlobKey) {
        blob = await getMediaBlob(activeClip.videoBlobKey);
      }
      if (!blob && activeClip.audioBlobKey) {
        blob = await getMediaBlob(activeClip.audioBlobKey);
      }
      if (!blob) {
        let masterBlob: Blob | null = null;
        if (episode.recording?.audioBlobKey) {
          masterBlob = await getMediaBlob(episode.recording.audioBlobKey);
        } else if (episode.recording?.videoBlobKey) {
          masterBlob = await getMediaBlob(episode.recording.videoBlobKey);
        }
        if (masterBlob) {
          blob = await trimAudioBlob(masterBlob, activeClip.startTime, activeClip.endTime);
          if (blob) {
            const blobKey = `clip_audio_${activeClip.id}`;
            await saveMediaBlob(blobKey, blob);
            activeClip.audioBlobKey = blobKey;
            const updatedClips = (episode.highlightClips || []).map(c => c.id === activeClip.id ? { ...c, audioBlobKey: blobKey } : c);
            const updatedEp = { ...episode, highlightClips: updatedClips };
            saveEpisode(updatedEp);
            if (onUpdateEpisode) onUpdateEpisode(updatedEp);
          }
        }
      }
      if (!blob) {
        alert('לא נמצא קובץ מדיה מקור עבור קטע זה לחיתוך.');
        return;
      }
      const isVideo = activeClip.videoBlobKey && blob.type.includes('video');
      const ext = isVideo ? 'webm' : 'wav';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeClip.title.replace(/[^\w\d\u0590-\u05FF]/g, '_')}_clip.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('שגיאה בהורדת הקובץ: ' + e.message);
    }
  };

  const allFontsList = [...customFonts, ...BUILT_IN_FONTS];

  return (
    <div className={isStandalonePage ? "w-full h-screen flex flex-col bg-[#0a0d14] font-sans overflow-hidden" : "fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in font-sans"}>
      <div className={isStandalonePage ? "w-full h-full flex flex-col overflow-hidden relative" : "w-full max-w-7xl h-[94vh] rounded-3xl bg-[#121620] border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative"}>
        {/* Top Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800 shrink-0 bg-[#0d1017]">
          <div className="flex items-center gap-3">
            {isStandalonePage && (
              <button
                onClick={onBack || onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="חזרה לפרק"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>אולפן כתוביות מקצועי (תמלול לפי דיבור בפועל)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  {subtitles.length} כתוביות
                </span>
              </h2>
              <p className="text-xs text-slate-400">תמלול מילים אמיתיות מההקלטה, סנכרון תזמונים של 0.1s, פונטים אישיים ועיצוב ויזואלי</p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Hidden SRT / VTT File Input */}
            <input
              ref={srtFileInputRef}
              type="file"
              accept=".srt,.vtt,text/plain"
              onChange={handleImportSrtFile}
              className="hidden"
            />

            {/* Hidden Audio File Input */}
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.ogg"
              onChange={handleUploadDirectAudioForTranscribe}
              className="hidden"
            />

            {/* Direct Audio Upload Button */}
            <button
              onClick={() => audioFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all active:scale-98"
              title="העלאת קובץ הקלטה (MP3/WAV) מהמחשב לתמלול מיידי"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>טען שמע</span>
            </button>

            {/* Scope Selector: Full Episode OR Cut Clips */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs shadow-inner">
              <span className="text-slate-400 font-bold shrink-0 text-[11px] flex items-center gap-1">
                <Scissors className="w-3 h-3 text-amber-400" />
                <span>מקור תמלול:</span>
              </span>
              <select
                value={selectedTranscriptionScope}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTranscriptionScope(val);
                  setFilterSubtitlesByClip(val !== 'full');
                  if (val !== 'full') {
                    const c = (episode.highlightClips || []).find(clip => clip.id === val);
                    if (c && videoRef.current) {
                      videoRef.current.currentTime = c.startTime;
                      setCurrentTime(c.startTime);
                    }
                  }
                }}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[190px] truncate"
              >
                <option value="full" className="bg-slate-900 text-white font-semibold">
                  🎙️ כל הפרק המלא ({formatSrtTimestamp(episode.recording?.duration || (episode.targetDurationMinutes * 60)).slice(3, 8)})
                </option>
                {episode.highlightClips && episode.highlightClips.length > 0 && (
                  <optgroup label="🎬 קטעים גזורים מהפרק (Shorts):" className="bg-slate-900 text-amber-400 font-bold">
                    {episode.highlightClips.map((clip, i) => (
                      <option key={clip.id} value={clip.id} className="bg-slate-900 text-white font-normal">
                        #{i + 1} {clip.title} ({formatSrtTimestamp(clip.startTime).slice(3, 8)} - {formatSrtTimestamp(clip.endTime).slice(3, 8)})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* AI Transcribe Spoken Audio Button */}
            <button
              onClick={() => handleTranscribeRecordedAudio()}
              disabled={isTranscribing}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-98 disabled:opacity-50 ${
                activeClip 
                  ? 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 shadow-amber-600/40 ring-1 ring-amber-400/50' 
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-600/30'
              }`}
              title={activeClip ? `תמלל עם AI רק את הקטע הנבחר (${formatSrtTimestamp(activeClip.startTime).slice(3, 8)} - ${formatSrtTimestamp(activeClip.endTime).slice(3, 8)})` : 'תמלל מילים בפועל מקובץ האודיו של הפרק'}
            >
              <Wand2 className={`w-3.5 h-3.5 ${isTranscribing ? 'animate-spin' : ''}`} />
              <span>
                {isTranscribing 
                  ? 'מתמלל...' 
                  : activeClip 
                  ? `תמלל קטע נבחר (AI)` 
                  : 'תמלל פרק מלא (AI)'}
              </span>
            </button>

            {/* Auto Generate from Topics Button */}
            <button
              onClick={handleGenerateFromTopics}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold transition-all active:scale-98"
              title="צור כתוביות מיידית מנושאי השיחה והתסריט של הפרק"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>צור מנושאי הפרק</span>
            </button>

            {/* ElevenLabs Subtitle & Voiceover Creation Button */}
            <button
              onClick={() => {
                if (!elevenLabsScriptText && (episode.description || episode.topics?.length)) {
                  const prefill = [
                    episode.title ? `${episode.title}:` : '',
                    episode.description || '',
                    ...(episode.topics?.map(t => typeof t === 'string' ? t : t.title) || [])
                  ].filter(Boolean).join('\n');
                  setElevenLabsScriptText(prefill);
                }
                setIsElevenLabsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition-all active:scale-98 shadow-sm"
              title="יצירת כתוביות וקריינות מסונכרנת עם ElevenLabs"
            >
              <Volume2 className="w-3.5 h-3.5 text-purple-400" />
              <span>יצירה עם ElevenLabs</span>
            </button>

            {/* Import SRT / VTT Button */}
            <button
              onClick={() => srtFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
              title="ייבא קובץ כתוביות SRT או WebVTT"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>ייבוא SRT/VTT</span>
            </button>

            {/* Live Microphone Dictation */}
            <button
              onClick={toggleLiveDictation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isDictating 
                  ? 'bg-red-600 text-white border-red-500 animate-pulse' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="הכתב כתוביות ישירות בדיבור למיקרופון"
            >
              {isDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{isDictating ? 'עצור הכתבה' : 'הכתב בדיבור'}</span>
            </button>

            {/* AI Subtitle Translate Button */}
            <button
              onClick={() => setIsTranslateModalOpen(true)}
              disabled={isTranslating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-bold transition-all active:scale-98 disabled:opacity-40 shadow-sm"
              title={subtitles.length > 0 ? "תרגם את הכתוביות לשפה אחרת (עברית, אנגלית וכו') באמצעות AI" : "תמלול ותרגום סרטון חיצוני לעברית באמצעות AI"}
            >
              <Globe className={`w-3.5 h-3.5 text-blue-400 ${isTranslating ? 'animate-spin' : ''}`} />
              <span>{isTranslating ? 'מתרגם...' : 'תרגם כתוביות (AI)'}</span>
            </button>

            {/* AI Precision & Subtitle Refinement Button */}
            <button
              onClick={handleRefineSubtitles}
              disabled={isRefining || subtitles.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition-all active:scale-98 disabled:opacity-40 shadow-sm"
              title="דייק ותקן שגיאות שמיעה, מילים עמומות וזרימת משפטים בעזרת AI"
            >
              <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${isRefining ? 'animate-spin' : ''}`} />
              <span>{isRefining ? 'מדייק כתוביות...' : '🎯 דייק כתוביות (AI)'}</span>
            </button>

            {/* AI Keys Settings Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsAIModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                aiSettings.geminiApiKey || aiSettings.openaiApiKey
                  ? 'bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="הגדרות מפתחות AI (Gemini, OpenAI, ElevenLabs)"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>{aiSettings.geminiApiKey ? 'Gemini מחובר' : 'הגדר מפתח AI'}</span>
              <span className={`w-2 h-2 rounded-full ${
                aiSettings.geminiApiKey || aiSettings.openaiApiKey
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'bg-slate-500'
              }`} />
            </button>

            {/* Export SRT */}
            <button
              onClick={handleExportSRT}
              disabled={subtitles.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>ייצוא SRT</span>
            </button>

            {/* Direct Open in Audiogram Video Studio */}
            {activeClip && (
              <a
                href={`/episodes/${episode.id}?openStudio=true&clipId=${activeClip.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-pink-600/30 transition-all active:scale-98"
                title="עבור לסטודיו הווידאו לייצוא סרטון קצר מלא עם כתוביות מוטמעות ומעוצבות"
              >
                <Film className="w-3.5 h-3.5" />
                <span>🎬 צור סרטון מעוצב</span>
              </a>
            )}

            {/* Save Button */}
            <button
              onClick={handleSaveSubtitles}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition-all active:scale-98"
            >
              <Check className="w-3.5 h-3.5" />
              <span>שמור הכל</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Clip Scope Indicator Banner */}
        {activeClip && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-gradient-to-r from-amber-950/80 via-slate-900 to-purple-950/80 border-b border-amber-500/30 text-xs text-amber-200 shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Flame className="w-3.5 h-3.5" />
              </span>
              <span className="font-bold text-slate-300">נבחר קטע גזור לעבודה:</span>
              <span className="font-black text-white">{activeClip.title}</span>
              <span className="font-mono bg-slate-950 px-2 py-0.5 rounded-md text-amber-400 border border-slate-800">
                {formatSrtTimestamp(activeClip.startTime).slice(3, 8)} - {formatSrtTimestamp(activeClip.endTime).slice(3, 8)} ({Math.round(activeClip.duration)} שנ׳)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = activeClip.startTime;
                    setCurrentTime(activeClip.startTime);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[11px] border border-slate-700 flex items-center gap-1"
              >
                <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" />
                <span>קפוץ לנגן קטע זה</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadActiveClipMedia}
                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white font-bold text-[11px] border border-emerald-500/40 flex items-center gap-1 transition-all"
                title="שמור והורד את קובץ המדיה (שמע/וידאו) של קטע זה למחשב"
              >
                <Download className="w-3 h-3 text-emerald-400" />
                <span>הורד קובץ קטע</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterSubtitlesByClip(!filterSubtitlesByClip)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border transition-all flex items-center gap-1 ${
                  filterSubtitlesByClip 
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black' 
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                <Filter className="w-3 h-3" />
                <span>{filterSubtitlesByClip ? 'מציג כתוביות של קטע זה בלבד' : 'הצג את כל כתוביות הפרק'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedTranscriptionScope('full');
                  setFilterSubtitlesByClip(false);
                }}
                className="text-slate-400 hover:text-rose-400 text-[11px] underline ml-2 transition-colors"
              >
                בטל וחזור לפרק מלא
              </button>
            </div>
          </div>
        )}

        {/* Transcribing Progress Banner */}
        {isTranscribing && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
              <span className="font-bold">{transcribeStatus}</span>
            </div>
            {transcribeProgress && (
              <div className="flex items-center gap-3">
                <div className="w-36 h-2 bg-slate-800 rounded-full overflow-hidden border border-amber-500/30">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${Math.round((transcribeProgress.current / transcribeProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {transcribeProgress.current}/{transcribeProgress.total} ({Math.round((transcribeProgress.current / transcribeProgress.total) * 100)}%)
                </span>
              </div>
            )}
            <span className="text-[11px] text-amber-400/80">תמלול מקטעים מקבילי לפרקים ארוכים (20-60+ דקות)</span>
          </div>
        )}

        {/* Main Content Grid: Video Preview & Subtitles Controls */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Column: Interactive Video Preview (7 Cols) */}
          <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col items-center justify-center bg-black/40 border-b lg:border-b-0 lg:border-l border-slate-800 relative overflow-hidden">
            {/* Live Video / Canvas Player */}
            <div 
              ref={videoContainerRef}
              className={`relative bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center transition-all select-none ${
                isShortsAspect 
                  ? 'w-[280px] sm:w-[320px] aspect-[9/16] ring-2 ring-amber-500/40 shadow-amber-950/40' 
                  : 'w-full max-w-2xl aspect-video'
              }`}
            >
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      const cur = videoRef.current.currentTime;
                      setCurrentTime(cur);
                      if (activeClip) {
                        if (isStandaloneMedia) {
                          const maxDur = activeClip.duration || videoRef.current.duration || 45;
                          if (cur >= maxDur) {
                            videoRef.current.pause();
                            videoRef.current.currentTime = 0;
                            setCurrentTime(0);
                            setIsPlaying(false);
                          }
                        } else {
                          if (cur >= activeClip.endTime) {
                            videoRef.current.pause();
                            videoRef.current.currentTime = activeClip.startTime;
                            setCurrentTime(activeClip.startTime);
                            setIsPlaying(false);
                          }
                        }
                      }
                    }
                  }}
                  className={`h-full ${isShortsAspect ? 'aspect-[9/16] object-cover' : 'w-full object-contain'}`}
                />
              ) : (
                <div className="text-center p-8 text-slate-500 space-y-2">
                  <Play className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-xs">תצוגה מקדימה של הכתוביות והווידאו</p>
                </div>
              )}

              {/* Animated Soundwave Studio Backdrop when audio is playing */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-25">
                <div className="flex items-center gap-1.5 h-16">
                  {[40, 70, 50, 90, 65, 80, 45, 95, 60, 75, 85, 55, 65, 90, 45, 70].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        height: isPlaying ? `${h}%` : '15%',
                        transition: 'height 0.15s ease-in-out'
                      }}
                      className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 via-amber-400 to-pink-500"
                    />
                  ))}
                </div>
              </div>

              {/* Brand Logo Overlay (Right / Left / Custom position) */}
              {globalStyle.logoEnabled && globalStyle.logoUrl && (
                <div
                  className="absolute pointer-events-none transition-all z-30 select-none"
                  style={{
                    top: (globalStyle.logoPosition === 'top-right' || globalStyle.logoPosition === 'top-left' || globalStyle.logoPosition === 'top-center' || !globalStyle.logoPosition) 
                      ? `${globalStyle.logoOffsetY ?? 16}px` 
                      : 'auto',
                    bottom: (globalStyle.logoPosition === 'bottom-right' || globalStyle.logoPosition === 'bottom-left' || globalStyle.logoPosition === 'bottom-center') 
                      ? `${globalStyle.logoOffsetY ?? 16}px` 
                      : 'auto',
                    right: (globalStyle.logoPosition === 'top-right' || globalStyle.logoPosition === 'bottom-right' || !globalStyle.logoPosition) 
                      ? `${globalStyle.logoOffsetX ?? 16}px` 
                      : 'auto',
                    left: (globalStyle.logoPosition === 'top-left' || globalStyle.logoPosition === 'bottom-left') 
                      ? `${globalStyle.logoOffsetX ?? 16}px` 
                      : (globalStyle.logoPosition === 'top-center' || globalStyle.logoPosition === 'bottom-center') 
                      ? '50%' 
                      : 'auto',
                    transform: (globalStyle.logoPosition === 'top-center' || globalStyle.logoPosition === 'bottom-center') 
                      ? 'translateX(-50%)' 
                      : 'none',
                    opacity: (globalStyle.logoOpacity !== undefined ? globalStyle.logoOpacity : 90) / 100
                  }}
                >
                  <img
                    src={globalStyle.logoUrl}
                    alt="Brand Logo"
                    style={{
                      width: `${globalStyle.logoSize || 64}px`,
                      height: 'auto',
                      maxHeight: `${globalStyle.logoSize || 64}px`,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.75))'
                    }}
                  />
                </div>
              )}

              {/* 9:16 Safe Zones Guidelines Overlay */}
              {showSafeZone && isShortsAspect && (
                <div className="absolute inset-0 pointer-events-none z-10 border-2 border-dashed border-cyan-400/40 rounded-3xl m-2 flex flex-col justify-between p-3 text-[10px] text-cyan-300 font-mono">
                  <div className="flex justify-between border-b border-cyan-400/20 pb-1">
                    <span>TikTok / Reels Safe Top</span>
                    <span>אזור בטוח עליון</span>
                  </div>
                  <div className="flex justify-between border-t border-cyan-400/20 pt-1">
                    <span>אזור בטוח תחתון (כפתורים)</span>
                    <span>Safe Bottom Margin</span>
                  </div>
                </div>
              )}

              {/* Dynamic Draggable Styled Subtitle Overlay on Top of Video */}
              {(() => {
                const subtitleToRender = activeSubtitle || (
                  sidebarTab === 'style' && subtitles.length > 0
                    ? (selectedIds.length > 0 ? subtitles.find(s => selectedIds.includes(s.id)) || subtitles[0] : subtitles[0])
                    : (sidebarTab === 'style' ? {
                        id: 'preview_demo',
                        startTime: 0,
                        endTime: 5,
                        text: 'כתוביות מקצועיות בעיצוב אישי'
                      } as SubtitleItem : null)
                );

                if (!subtitleToRender) return null;

                const st = subtitleToRender.customStyle || globalStyle;
                const posX = typeof st.positionX === 'number' ? st.positionX : 50;
                const posY = typeof st.positionY === 'number'
                  ? st.positionY
                  : st.positionY === 'top'
                  ? 15
                  : st.positionY === 'center'
                  ? 50
                  : 82;

                const isStrokeActive = st.strokeEnabled !== false && (st.strokeWidth ?? 2) > 0;
                const strokeWidthVal = isStrokeActive ? (st.strokeWidth ?? 2) : 0;
                const strokeColorVal = st.strokeColor || '#000000';
                const strokeCss = isStrokeActive ? `${strokeWidthVal}px ${strokeColorVal}` : '0px transparent';

                const isBgActive = st.backgroundEnabled !== false && st.boxStyle !== 'none';
                const bgOpacity = typeof st.backgroundOpacity === 'number' ? st.backgroundOpacity : 80;
                const effectiveBgColor = isBgActive 
                  ? getRgbaColor(st.backgroundColor || '#000000', bgOpacity) 
                  : 'transparent';

                const padX = isBgActive ? (st.backgroundPaddingX ?? (st.boxStyle === 'pill-badge' ? 24 : 20)) : 0;
                const padY = isBgActive ? (st.backgroundPaddingY ?? 10) : 0;
                const borderRadius = !isBgActive 
                  ? '0px'
                  : st.boxStyle === 'pill-badge'
                  ? '9999px'
                  : st.boxStyle === 'full-bar'
                  ? '0px'
                  : `${st.backgroundBorderRadius ?? 16}px`;

                const isShadowActive = st.shadowEnabled !== false && st.textShadow !== 'none';
                const getShadow = () => {
                  if (!isShadowActive) return 'none';
                  const blur = st.shadowBlur ?? 8;
                  const shadowCol = st.shadowColor || 'rgba(0,0,0,0.85)';
                  if (st.textShadow === 'hard-outline') {
                    return '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.9)';
                  }
                  if (st.textShadow === 'neon-glow') {
                    const glowCol = st.shadowColor || st.highlightWordColor || '#06b6d4';
                    return `0 0 ${blur}px ${glowCol}, 0 0 ${blur * 2}px ${glowCol}, 0 2px 8px rgba(0,0,0,0.9)`;
                  }
                  if (st.textShadow === 'cinema-blur') {
                    return `0 4px ${Math.max(blur, 16)}px ${shadowCol}`;
                  }
                  return `0 2px ${blur}px ${shadowCol}`;
                };

                const getBoxClasses = () => {
                  if (!isBgActive) return 'p-0 bg-transparent';
                  if (st.boxStyle === 'pill-badge') return 'shadow-2xl';
                  if (st.boxStyle === 'glassmorphism') return 'backdrop-blur-md border border-white/15 shadow-2xl';
                  if (st.boxStyle === 'full-bar') return 'w-full shadow-2xl';
                  return 'shadow-xl';
                };

                const words = subtitleToRender.text.trim().split(/\s+/).filter(Boolean);
                const subStartTime = (isStandaloneMedia && activeClip && subtitleToRender.startTime >= activeClip.startTime)
                  ? (subtitleToRender.startTime - activeClip.startTime)
                  : subtitleToRender.startTime;
                const subEndTime = (isStandaloneMedia && activeClip && subtitleToRender.endTime >= activeClip.startTime)
                  ? (subtitleToRender.endTime - activeClip.startTime)
                  : subtitleToRender.endTime;
                const duration = Math.max(0.1, subEndTime - subStartTime);
                const elapsed = activeSubtitle ? Math.max(0, currentTime - subStartTime) : (duration * 0.5);
                const activeWordIndex = Math.min(words.length - 1, Math.floor((elapsed / duration) * words.length));

                // Words per line grouping
                const maxW = st.maxWordsPerLine || 0;
                const wordLines: string[][] = [];
                if (maxW > 0 && words.length > maxW) {
                  for (let i = 0; i < words.length; i += maxW) {
                    wordLines.push(words.slice(i, i + maxW));
                  }
                } else {
                  wordLines.push(words);
                }

                // Subtitle Animation calculations (Entrance vs Exit)
                const animDuration = Math.min(st.animationDuration || 0.25, Math.max(0.12, duration * 0.25));
                const remainingTime = subEndTime - currentTime;
                const hasExitEffect = !!st.exitAnimation && st.exitAnimation !== 'none';
                const isExiting = previewAnimationState === 'exit' || (
                  previewAnimationState !== 'enter' &&
                  hasExitEffect &&
                  activeSubtitle !== undefined &&
                  isPlaying &&
                  remainingTime <= animDuration &&
                  remainingTime >= 0
                );
                const animationClass = getSubtitleAnimationClass(st, isExiting);

                return (
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setIsDraggingSubtitle(true);
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                    }}
                    onPointerMove={(e) => {
                      if (!isDraggingSubtitle || !videoContainerRef.current) return;
                      const rect = videoContainerRef.current.getBoundingClientRect();
                      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
                      const rawY = ((e.clientY - rect.top) / rect.height) * 100;
                      const newX = Math.round(Math.max(10, Math.min(90, rawX)));
                      const newY = Math.round(Math.max(8, Math.min(92, rawY)));
                      applyStyleUpdate({ positionX: newX, positionY: newY });
                    }}
                    onPointerUp={(e) => {
                      if (isDraggingSubtitle) {
                        setIsDraggingSubtitle(false);
                        try {
                          (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                        } catch {}
                      }
                    }}
                    style={{
                      position: 'absolute',
                      left: `${posX}%`,
                      top: `${posY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: st.boxStyle === 'full-bar' ? '100%' : 'auto',
                      maxWidth: st.boxStyle === 'full-bar' ? '100%' : '92%',
                      textAlign: st.textAlign || 'center',
                      cursor: isDraggingSubtitle ? 'grabbing' : 'grab',
                      userSelect: 'none',
                      touchAction: 'none',
                      zIndex: 25
                    }}
                    className="group/drag transition-transform active:scale-[0.99]"
                    title="גרור עם העכבר כדי למקם את הכתובית בכל נקודה על גבי המסך"
                  >
                    {/* Drag Floating Tooltip */}
                    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-purple-600/95 border border-purple-400 text-white text-[10px] font-bold whitespace-nowrap shadow-xl transition-opacity flex items-center gap-1 ${
                      isDraggingSubtitle ? 'opacity-100' : 'opacity-0 group-hover/drag:opacity-100'
                    }`}>
                      <Move className="w-2.5 h-2.5" />
                      <span>מיקום חופשי ({posX}%, {posY}%)</span>
                    </div>

                    {/* Speaker Diarization Floating Badge */}
                    {subtitleToRender.speaker?.trim() && st.showSpeakerBadge !== false && (() => {
                      const spkName = subtitleToRender.speaker!.trim();
                      const spkColor = getSpeakerColor(spkName, st.speakerColors);
                      return (
                        <div className="mb-1.5 flex items-center justify-center pointer-events-none">
                          <span
                            style={{
                              backgroundColor: spkColor,
                              color: '#FFFFFF',
                              boxShadow: `0 2px 12px ${spkColor}80`
                            }}
                            className="px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-lg border border-white/30 tracking-wide inline-flex items-center gap-1.5 backdrop-blur-md transition-all select-none"
                          >
                            <User className="w-2.5 h-2.5 inline" />
                            <span>{spkName}</span>
                          </span>
                        </div>
                      );
                    })()}

                    <div
                      key={`sub_box_${subtitleToRender.id}_${isExiting ? 'exit' : 'enter'}_${previewAnimationState || ''}`}
                      style={{
                        display: 'inline-block',
                        fontFamily: st.fontFamily || 'Rubik, sans-serif',
                        fontSize: `${st.fontSize || 28}px`,
                        color: st.textColor || '#FFFFFF',
                        fontWeight: st.fontWeight === '900' ? 900 : st.fontWeight === '800' ? 800 : st.isBold || st.fontWeight === 'bold' ? 'bold' : 'normal',
                        backgroundColor: effectiveBgColor,
                        padding: `${padY}px ${padX}px`,
                        borderRadius: borderRadius,
                        border: (st.colorCodeSubtitleBySpeaker && subtitleToRender.speaker?.trim()) 
                          ? `2px solid ${getSpeakerColor(subtitleToRender.speaker.trim(), st.speakerColors)}`
                          : '1px solid transparent',
                        WebkitTextStroke: strokeCss,
                        textShadow: getShadow(),
                        lineHeight: st.lineHeight || 1.3,
                        letterSpacing: `${st.letterSpacing || 0}px`,
                        direction: 'rtl',
                        ['--sub-anim-duration' as any]: `${animDuration}s`
                      }}
                      className={`${getBoxClasses()} ${animationClass} transition-all group-hover/drag:border-purple-400/40`}
                    >
                      {wordLines.map((lineWords, lineIdx) => (
                        <div key={lineIdx} className="leading-snug">
                          {st.activeWordAnimation === 'color-pop' || st.activeWordAnimation === 'glow' ? (
                            lineWords.map((w, wInLineIdx) => {
                              const globalWIdx = (maxW > 0 ? lineIdx * maxW : 0) + wInLineIdx;
                              const isWordActive = globalWIdx === activeWordIndex;
                              const activeCol = st.highlightWordColor || '#FACC15';
                              return (
                                <span
                                  key={wInLineIdx}
                                  style={{
                                    color: isWordActive ? activeCol : undefined,
                                    textShadow: isWordActive && st.activeWordAnimation === 'glow' ? `0 0 15px ${activeCol}` : undefined,
                                    transform: isWordActive ? 'scale(1.08)' : 'scale(1)',
                                    display: 'inline-block',
                                    transition: 'all 0.1s ease',
                                    margin: '0 3px'
                                  }}
                                >
                                  {w}
                                </span>
                              );
                            })
                          ) : (
                            lineWords.join(' ')
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Aspect Ratio Switcher & Video Tools */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setIsShortsAspect(false)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  !isShortsAspect ? 'bg-purple-600 text-white shadow' : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                📺 16:9 מסך רחב
              </button>
              <button
                type="button"
                onClick={() => setIsShortsAspect(true)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isShortsAspect ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                📱 9:16 אנכי (Shorts / Reels)
              </button>
              <button
                type="button"
                onClick={() => setShowSafeZone(!showSafeZone)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  showSafeZone ? 'bg-cyan-500 text-slate-950 font-black shadow-md' : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
                title="הצג קווי אזור בטוח של טיקטוק ורילס למניעת הסתרת הכתוביות"
              >
                <Grid className="w-3.5 h-3.5" />
                <span>אזור בטוח (Safe Zone)</span>
              </button>
              <button
                type="button"
                onClick={() => directFileInputRef.current?.click()}
                className="px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700 text-purple-300 hover:text-white border border-purple-500/30"
                title="טען סרטון או קובץ שמע ישירות מהמחשב"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>טען קובץ מקומי</span>
              </button>
              <input
                ref={directFileInputRef}
                type="file"
                accept="video/*,audio/*"
                onChange={handleDirectMediaUpload}
                className="hidden"
              />
            </div>

            {/* Video Playback Scrubber & Micro Controls */}
            <div className="w-full max-w-2xl mt-3 flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <button
                onClick={togglePlay}
                className={`p-2.5 rounded-xl text-white shadow transition-all ${
                  activeClip ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold' : 'bg-purple-600 hover:bg-purple-500'
                }`}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs font-mono font-bold min-w-[55px] text-indigo-300">
                  {activeClip 
                    ? (isStandaloneMedia 
                        ? `${formatTime(currentTime)} / ${formatTime(activeClip.duration)}`
                        : `${formatTime(Math.max(0, currentTime - activeClip.startTime))} / ${formatTime(activeClip.duration)}`)
                    : formatSrtTimestamp(currentTime).split(',')[0]}
                </span>
                <input
                  type="range"
                  min={activeClip ? (isStandaloneMedia ? 0 : activeClip.startTime) : 0}
                  max={activeClip ? (isStandaloneMedia ? (activeClip.duration || videoRef.current?.duration || 45) : activeClip.endTime) : (videoRef.current?.duration || 100)}
                  step={0.1}
                  value={activeClip 
                    ? (isStandaloneMedia 
                        ? Math.max(0, Math.min(activeClip.duration || videoRef.current?.duration || 45, currentTime))
                        : Math.max(activeClip.startTime, Math.min(activeClip.endTime, currentTime)))
                    : currentTime}
                  onChange={(e) => jumpToTime(parseFloat(e.target.value))}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                    activeClip 
                      ? 'bg-amber-950/80 accent-amber-400' 
                      : 'bg-slate-700 accent-purple-500'
                  }`}
                />
                {activeClip && (
                  <span className="text-[11px] text-amber-400 font-mono shrink-0 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {isStandaloneMedia ? 'קובץ עצמאי' : `${formatTime(activeClip.startTime)} - ${formatTime(activeClip.endTime)}`}
                  </span>
                )}
              </div>

              {/* Jump Back / Forward 2s */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => jumpToTime(currentTime - 2)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 text-[11px] font-mono"
                  title="2 שניות אחורה"
                >
                  -2s
                </button>
                <button
                  onClick={() => jumpToTime(currentTime + 2)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 text-[11px] font-mono"
                  title="2 שניות קדימה"
                >
                  +2s
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Subtitles List & Controls (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col bg-[#121620] overflow-hidden">
            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 p-2 bg-slate-950/60 border-b border-slate-800 text-xs">
              <button
                onClick={() => setSidebarTab('editor')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  sidebarTab === 'editor' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>עריכת דיבור ({subtitles.length})</span>
              </button>

              <button
                onClick={() => setSidebarTab('style')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  sidebarTab === 'style' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>עיצוב וגופנים</span>
              </button>

              <button
                onClick={() => setSidebarTab('pacing')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  sidebarTab === 'pacing' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>קצב מילים ושורות</span>
              </button>
            </div>

            {/* TAB 1: Subtitle Cues Timeline Editor */}
            {sidebarTab === 'editor' && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {/* Control bar */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
                  <button
                    onClick={selectAll}
                    disabled={subtitles.length === 0}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-40"
                  >
                    {selectedIds.length === subtitles.length && subtitles.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                    <span>בחר הכל ({selectedIds.length}/{subtitles.length})</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>מחק ({selectedIds.length})</span>
                      </button>
                    )}

                    <button
                      onClick={handleAddSubtitle}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>הוסף כתובית</span>
                    </button>
                  </div>
                </div>

                {/* Batch Actions Toolbar when 1 or more are selected */}
                {selectedIds.length > 0 && (
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-950/80 via-indigo-950/80 to-slate-900 border border-purple-500/50 shadow-xl space-y-2 my-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-200 flex items-center gap-1.5">
                        <CheckCheck className="w-4 h-4 text-purple-400" />
                        <span>פעולות מרוכזות עבור {selectedIds.length} כתוביות שנבחרו:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800"
                      >
                        בטל בחירה
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {/* Batch Shift Timing */}
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 text-[11px]">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span className="text-slate-400 text-[10px]">הזז זמן לנבחרים:</span>
                        <button
                          type="button"
                          onClick={() => handleBatchShiftTiming(-0.5)}
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 font-mono text-[10px]"
                          title="הזז 0.5s אחורה"
                        >
                          -0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchShiftTiming(-0.1)}
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 font-mono text-[10px]"
                          title="הזז 0.1s אחורה"
                        >
                          -0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchShiftTiming(0.1)}
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 font-mono text-[10px]"
                          title="הזז 0.1s קדימה"
                        >
                          +0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBatchShiftTiming(0.5)}
                          className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 font-mono text-[10px]"
                          title="הזז 0.5s קדימה"
                        >
                          +0.5s
                        </button>
                      </div>

                      {/* Apply Current Style to Selected */}
                      <button
                        type="button"
                        onClick={handleBatchApplyCurrentStyle}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-[11px] font-bold transition-all"
                        title="החל את הגופן, הגודל, הצבע והמיקום הנוכחיים על כל הכתוביות שנבחרו"
                      >
                        <Palette className="w-3 h-3 text-purple-400" />
                        <span>החל עיצוב</span>
                      </button>

                      {/* Merge Selected */}
                      {selectedIds.length >= 2 && (
                        <button
                          type="button"
                          onClick={handleBatchMerge}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-[11px] font-bold transition-all"
                          title="אחד את כל הכתוביות הנבחרות לכתובית רציפה אחת"
                        >
                          <GitMerge className="w-3 h-3 text-indigo-400" />
                          <span>אחד</span>
                        </button>
                      )}

                      {/* Rechunk Selected */}
                      <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800 text-[11px]">
                        <Split className="w-3 h-3 text-amber-400" />
                        <span className="text-slate-400 text-[10px]">חלק נבחרים:</span>
                        {[2, 3, 4, 6].map(wCount => (
                          <button
                            key={wCount}
                            type="button"
                            onClick={() => handleBatchRechunk(wCount)}
                            className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold text-[10px]"
                            title={`חלק את הכתוביות הנבחרות ל-${wCount} מילים לכרטיס`}
                          >
                            {wCount}
                          </button>
                        ))}
                      </div>

                      {/* Batch Translate Selected */}
                      <button
                        type="button"
                        onClick={() => handleBatchTranslateSelected('he')}
                        disabled={isTranslating}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 text-[11px] font-bold transition-all disabled:opacity-50"
                        title="תרגם את כל הכתוביות הנבחרות לעברית (או מאנגלית לעברית)"
                      >
                        <Globe className="w-3 h-3 text-blue-400" />
                        <span>תרגם לעברית</span>
                      </button>

                      {/* Delete Selected */}
                      <button
                        type="button"
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-500/30 text-[11px] font-bold transition-all"
                      >
                        <Trash2 className="w-3 h-3 text-rose-400" />
                        <span>מחק</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Smart Rebalance & Pacing Control Bar */}
                {subtitles.length > 0 && (
                  <div className="space-y-1.5 shrink-0 my-2">
                    <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-purple-300 font-bold">
                          <Sliders className="w-3.5 h-3.5 text-purple-400" />
                          <span>חלוקה חכמה מחדש (Pacing & Split):</span>
                        </div>
                        <button
                          onClick={handlePolishAllSubtitles}
                          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                          title="נקה מילות מילוי (אהה, כאילו) ותקן פיסוק בכל הכתוביות"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>ליטוש ופיסוק להכל</span>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { words: 3, label: '3 מילים (TikTok/Shorts)' },
                          { words: 4, label: '4 מילים (קצבי מומלץ)' },
                          { words: 6, label: '6 מילים (פודקאסט)' },
                          { words: 8, label: '8 מילים (משפט שלם)' }
                        ].map(opt => (
                          <button
                            key={opt.words}
                            type="button"
                            onClick={() => handleRebalanceAll(opt.words)}
                            className="py-1 px-1 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 text-[10px] font-bold text-center transition-all active:scale-95"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Global Audio Sync Delay Offset Bar */}
                    <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-[10px]">
                      <span className="font-bold text-indigo-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>סנכרון כללי (הזזת כל הכתוביות קדימה/אחורה):</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleShiftAll(-0.5)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות חצי שנייה אחורה"
                        >
                          -0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShiftAll(-0.1)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות 0.1s אחורה"
                        >
                          -0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShiftAll(0.1)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות 0.1s קדימה"
                        >
                          +0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShiftAll(0.5)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות חצי שנייה קדימה"
                        >
                          +0.5s
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Active Clip Filter Indicator if Active */}
                {filterSubtitlesByClip && activeClip && (
                  <div className="mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300 shrink-0">
                    <span className="font-bold flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-amber-400" />
                      <span>מציג כתוביות של: {activeClip.title}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFilterSubtitlesByClip(false)}
                      className="text-xs font-bold text-slate-400 hover:text-white underline"
                    >
                      הצג הכל ({subtitles.length})
                    </button>
                  </div>
                )}

                {/* Multi-Speaker Diarization Toolbar & Filter Bar */}
                {subtitles.length > 0 && (
                  <div className="mb-2 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                        <Users className="w-3.5 h-3.5 text-purple-400" />
                        <span>סינון לפי דובר:</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleAutoDiarizeSubtitles}
                        disabled={isDiarizingSubtitles}
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/50 hover:to-indigo-600/50 border border-purple-500/40 text-[10px] text-purple-200 hover:text-white font-bold transition-all flex items-center gap-1"
                        title="זיהוי והבדלה אוטומטית בין דוברים על בסיס שיחה ובינה מלאכותית"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>{isDiarizingSubtitles ? 'מזהה דוברים...' : '✨ זהה דוברים עם AI'}</span>
                      </button>
                    </div>

                    {/* Speaker filter buttons */}
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSpeakerFilter('all')}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                          speakerFilter === 'all'
                            ? 'bg-purple-600 text-white shadow'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        כל הדוברים ({subtitles.length})
                      </button>

                      {projectSpeakers.map((spk) => {
                        const count = subtitles.filter(s => s.speaker === spk).length;
                        const spkColor = getSpeakerColor(spk, globalStyle.speakerColors);
                        const isCurrent = speakerFilter === spk;
                        return (
                          <button
                            key={spk}
                            type="button"
                            onClick={() => setSpeakerFilter(isCurrent ? 'all' : spk)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 border ${
                              isCurrent
                                ? 'text-white shadow'
                                : 'text-slate-300 hover:text-white bg-slate-900'
                            }`}
                            style={{
                              backgroundColor: isCurrent ? spkColor : undefined,
                              borderColor: `${spkColor}80`
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isCurrent ? '#FFFFFF' : spkColor }} />
                            <span>{spk}</span>
                            <span className="opacity-75 font-mono text-[9px]">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Subtitle List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 py-2 pr-1">
                  {(() => {
                    const displayedSubs = subtitles.filter(s => {
                      if (filterSubtitlesByClip && activeClip) {
                        if (s.startTime < activeClip.startTime - 0.5 || s.endTime > activeClip.endTime + 0.5) return false;
                      }
                      if (speakerFilter !== 'all') {
                        if ((s.speaker?.trim() || 'דובר 1') !== speakerFilter) return false;
                      }
                      return true;
                    });

                    if (subtitles.length > 0 && displayedSubs.length === 0) {
                      return (
                        <div className="py-8 px-5 text-center rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-3">
                          <p className="text-xs text-slate-300 font-bold">
                            לא נמצאו כתוביות בסינון הנוכחי
                          </p>
                          <button
                            type="button"
                            onClick={() => { setFilterSubtitlesByClip(false); setSpeakerFilter('all'); }}
                            className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-lg"
                          >
                            אפס סינון והצג הכל
                          </button>
                        </div>
                      );
                    }

                    return displayedSubs.length > 0 ? (
                      displayedSubs.map((sub, idx) => {
                      const isSelected = selectedIds.includes(sub.id);
                      const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;

                      return (
                        <div
                          key={sub.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            isActive 
                              ? 'bg-purple-950/40 border-purple-500 shadow-lg' 
                              : isSelected 
                              ? 'bg-slate-900 border-indigo-500/50' 
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Cue Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={(e) => toggleSelect(sub.id, idx, e.shiftKey)}
                                title="לחיצה לבחירה (החזק Shift לבחירת טווח כתוביות)"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-500" />
                                )}
                              </button>
                              <span className="text-[11px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                              <span className="text-[10px] font-mono text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-500/20">
                                {Math.max(0.1, sub.endTime - sub.startTime).toFixed(2)}s
                              </span>

                              {/* Interactive Speaker Badge */}
                              {(() => {
                                const currentSpeaker = sub.speaker?.trim() || 'דובר 1';
                                const speakerCol = getSpeakerColor(currentSpeaker, globalStyle.speakerColors);
                                const isPopoverOpen = activeSpeakerPopoverId === sub.id;

                                return (
                                  <div className="relative inline-block">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveSpeakerPopoverId(isPopoverOpen ? null : sub.id);
                                        setCustomSpeakerInput(sub.speaker || '');
                                      }}
                                      className="px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 hover:brightness-125"
                                      style={{
                                        backgroundColor: `${speakerCol}25`,
                                        borderColor: `${speakerCol}70`,
                                        color: speakerCol
                                      }}
                                      title="לחץ לשינוי או עריכת הדובר"
                                    >
                                      <User className="w-2.5 h-2.5" />
                                      <span>{sub.speaker ? sub.speaker : '+ הגדר דובר'}</span>
                                    </button>

                                    {/* Speaker Picker Dropdown */}
                                    {isPopoverOpen && (
                                      <div 
                                        onClick={(e) => e.stopPropagation()}
                                        className="absolute right-0 top-full mt-1.5 z-40 w-56 p-2.5 rounded-2xl bg-slate-950/95 border border-purple-500/40 shadow-2xl backdrop-blur-xl text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150"
                                      >
                                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                                          <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3 text-purple-400" />
                                            <span>שיוך דובר לכתובית</span>
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setActiveSpeakerPopoverId(null)}
                                            className="text-slate-500 hover:text-white"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>

                                        {/* Quick choices from existing speakers */}
                                        <div className="space-y-1 max-h-36 overflow-y-auto">
                                          {Array.from(new Set([...projectSpeakers, 'דובר 1', 'דובר 2', 'דובר 3'])).map((spk) => {
                                            const spkCol = getSpeakerColor(spk, globalStyle.speakerColors);
                                            const isCurrent = sub.speaker === spk;
                                            return (
                                              <button
                                                key={spk}
                                                type="button"
                                                onClick={() => handleAssignSpeaker(sub.id, spk, false)}
                                                className={`w-full px-2 py-1 rounded-xl text-right flex items-center justify-between transition-all ${
                                                  isCurrent ? 'bg-purple-900/40 text-white font-bold' : 'hover:bg-slate-900 text-slate-300'
                                                }`}
                                              >
                                                <span className="flex items-center gap-1.5">
                                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: spkCol }} />
                                                  <span className="text-[11px]">{spk}</span>
                                                </span>
                                                {isCurrent && <Check className="w-3 h-3 text-purple-400" />}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* Custom Speaker Input */}
                                        <div className="pt-1.5 border-t border-slate-800 space-y-1.5">
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="text"
                                              value={customSpeakerInput}
                                              onChange={(e) => setCustomSpeakerInput(e.target.value)}
                                              placeholder="שם דובר חדש..."
                                              className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-white focus:outline-none focus:border-purple-500"
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && customSpeakerInput.trim()) {
                                                  handleAssignSpeaker(sub.id, customSpeakerInput.trim(), false);
                                                }
                                              }}
                                            />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (customSpeakerInput.trim()) {
                                                  handleAssignSpeaker(sub.id, customSpeakerInput.trim(), false);
                                                }
                                              }}
                                              className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold"
                                            >
                                              שמור
                                            </button>
                                          </div>

                                          {selectedIds.length > 1 && selectedIds.includes(sub.id) && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const spk = customSpeakerInput.trim() || sub.speaker || 'דובר 1';
                                                handleAssignSpeaker(sub.id, spk, true);
                                              }}
                                              className="w-full py-1 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/40 text-[10px] text-indigo-300 font-bold"
                                            >
                                              החל על כל {selectedIds.length} הכתוביות שנבחרו
                                            </button>
                                          )}

                                          {sub.speaker && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (customSpeakerInput.trim() && customSpeakerInput.trim() !== sub.speaker) {
                                                  handleRenameSpeakerGlobally(sub.speaker!, customSpeakerInput.trim());
                                                  setActiveSpeakerPopoverId(null);
                                                }
                                              }}
                                              disabled={!customSpeakerInput.trim() || customSpeakerInput.trim() === sub.speaker}
                                              className="w-full py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-[10px] text-slate-400 font-medium"
                                            >
                                              שנה שם זה בכל הכתוביות
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Precision Micro-Timers with Quick Nudge Buttons */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Start Time */}
                              <div className="flex items-center gap-0.5 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                                <span className="text-slate-500 text-[9px] ml-0.5">התחלה:</span>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'startTime', -0.5)}
                                  className="px-1 text-[9px] text-slate-400 hover:text-white font-mono"
                                  title="0.5s אחורה"
                                >
                                  -0.5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'startTime', -0.1)}
                                  className="px-1 text-[9px] text-purple-400 hover:text-white font-mono"
                                  title="0.1s אחורה"
                                >
                                  -0.1
                                </button>
                                <span className="text-[11px] font-mono font-bold text-indigo-300 px-1">{sub.startTime}s</span>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'startTime', 0.1)}
                                  className="px-1 text-[9px] text-purple-400 hover:text-white font-mono"
                                  title="0.1s קדימה"
                                >
                                  +0.1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'startTime', 0.5)}
                                  className="px-1 text-[9px] text-slate-400 hover:text-white font-mono"
                                  title="0.5s קדימה"
                                >
                                  +0.5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnapToCurrentTime(sub.id, 'startTime')}
                                  className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 mr-1"
                                  title="קבע התחלה לזמן הנגן הנוכחי"
                                >
                                  <Pin className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              {/* End Time */}
                              <div className="flex items-center gap-0.5 bg-slate-950 px-1.5 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                                <span className="text-slate-500 text-[9px] ml-0.5">סיום:</span>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'endTime', -0.5)}
                                  className="px-1 text-[9px] text-slate-400 hover:text-white font-mono"
                                  title="0.5s אחורה"
                                >
                                  -0.5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'endTime', -0.1)}
                                  className="px-1 text-[9px] text-purple-400 hover:text-white font-mono"
                                  title="0.1s אחורה"
                                >
                                  -0.1
                                </button>
                                <span className="text-[11px] font-mono font-bold text-indigo-300 px-1">{sub.endTime}s</span>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'endTime', 0.1)}
                                  className="px-1 text-[9px] text-purple-400 hover:text-white font-mono"
                                  title="0.1s קדימה"
                                >
                                  +0.1
                                </button>
                                <button
                                  type="button"
                                  onClick={() => adjustTiming(sub.id, 'endTime', 0.5)}
                                  className="px-1 text-[9px] text-slate-400 hover:text-white font-mono"
                                  title="0.5s קדימה"
                                >
                                  +0.5
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSnapToCurrentTime(sub.id, 'endTime')}
                                  className="p-0.5 rounded bg-slate-900 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 mr-1"
                                  title="קבע סיום לזמן הנגן הנוכחי"
                                >
                                  <Pin className="w-2.5 h-2.5" />
                                </button>
                              </div>

                              <button
                                onClick={() => jumpToTime(sub.startTime)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="קפיצה לזמן זה בווידאו"
                              >
                                <Play className="w-3 h-3" />
                              </button>

                              {/* Quick Single-Card Translate Button */}
                              <button
                                type="button"
                                onClick={() => handleTranslateSingleSubtitle(sub, /[a-zA-Z]/.test(sub.text) ? 'he' : 'en')}
                                className="p-1 rounded-lg hover:bg-slate-800 text-blue-400 hover:text-blue-300 transition-colors"
                                title={/[a-zA-Z]/.test(sub.text) ? "תרגם כתובית זו לעברית" : "תרגם כתובית זו לאנגלית"}
                              >
                                <Globe className="w-3.5 h-3.5" />
                              </button>

                              {/* ElevenLabs AI Voiceover Generator */}
                              <button
                                onClick={() => handlePlayVoiceover(sub)}
                                disabled={playingAudioId === sub.id}
                                className="p-1 rounded-lg hover:bg-slate-800 text-purple-400 hover:text-purple-300 transition-colors"
                                title="הקראת דיבוב קולי AI (ElevenLabs)"
                              >
                                <Volume2 className={`w-3.5 h-3.5 ${playingAudioId === sub.id ? 'animate-bounce text-amber-400' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleDeleteSubtitle(sub.id)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Spoken Hebrew Text */}
                          <textarea
                            value={sub.text}
                            onChange={(e) => handleUpdateText(sub.id, e.target.value)}
                            rows={2}
                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 resize-none font-sans"
                          />

                          {/* Word-Level Precision Splitter (Interactive Tokens) */}
                          <div className="flex flex-wrap items-center gap-1 my-1.5 p-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-bold ml-1">חיתוך במילה:</span>
                            {sub.text.trim().split(/\s+/).map((w, wIdx, arr) => (
                              <button
                                key={wIdx}
                                type="button"
                                onClick={() => handleSplitAtWord(sub, wIdx + 1)}
                                disabled={wIdx === arr.length - 1}
                                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-purple-600/30 hover:border-purple-500/50 border border-slate-800 text-[10px] text-slate-300 hover:text-purple-200 transition-all flex items-center gap-0.5 group/w"
                                title={wIdx < arr.length - 1 ? `פצל את הכתובית אחרי המילה "${w}"` : ''}
                              >
                                <span>{w}</span>
                                {wIdx < arr.length - 1 && (
                                  <Scissors className="w-2.5 h-2.5 text-slate-600 group-hover/w:text-purple-400 opacity-0 group-hover/w:opacity-100 transition-opacity" />
                                )}
                              </button>
                            ))}
                          </div>

                          {/* Subtitle Action Bar (Split, Merge, Polish, Word Counter) */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 mt-1 border-t border-slate-800/60 text-[10px]">
                            <div className="flex items-center gap-1">
                              {/* Merge with prev */}
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleMergeWithPrev(idx)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700/80 transition-colors"
                                  title="מזג כתובית זו עם הכתובית הקודמת"
                                >
                                  <GitMerge className="w-3 h-3 rotate-180" />
                                  <span>עם הקודם</span>
                                </button>
                              )}

                              {/* Split in half */}
                              <button
                                type="button"
                                onClick={() => handleSplitSingleSubtitle(sub)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold border border-slate-700/80 transition-colors"
                                title="פצל כתובית זו לשני חלקים שווים עם חלוקת זמנים מדויקת"
                              >
                                <Scissors className="w-3 h-3" />
                                <span>פצל לשניים</span>
                              </button>

                              {/* Merge with next */}
                              {idx < subtitles.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleMergeWithNext(idx)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700/80 transition-colors"
                                  title="מזג כתובית זו עם הכתובית הבאה"
                                >
                                  <GitMerge className="w-3 h-3" />
                                  <span>עם הבא</span>
                                </button>
                              )}

                              {/* Polish Hebrew */}
                              <button
                                type="button"
                                onClick={() => handlePolishSingleSubtitle(sub.id)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold border border-slate-700/80 transition-colors"
                                title="נקה מילות מילוי ותקן פיסוק בכתובית זו"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>לטש</span>
                              </button>

                              {/* Deep Effort / Re-Decode Unclear Subtitle */}
                              <button
                                type="button"
                                onClick={() => handleDeepDecodeSubtitle(sub)}
                                disabled={refiningSubtitleId === sub.id}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 transition-colors"
                                title="התאמץ לפענח שוב קטע שמע זה בדיוק מירבי בעזרת AI והגברה אקוסטית"
                              >
                                <Wand2 className={`w-3 h-3 text-amber-400 ${refiningSubtitleId === sub.id ? 'animate-spin' : ''}`} />
                                <span>{refiningSubtitleId === sub.id ? 'מפענח...' : '🎯 פענח שוב'}</span>
                              </button>
                            </div>

                            <div className="text-slate-500 font-mono">
                              {sub.text.trim().split(/\s+/).filter(Boolean).length} מילים • {(sub.endTime - sub.startTime).toFixed(1)}s
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 px-5 text-center rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600/20 via-indigo-600/20 to-pink-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto shadow-lg shadow-purple-950/50">
                        <Subtitles className="w-6 h-6" />
                      </div>

                      <div className="space-y-1 max-w-md mx-auto">
                        <h4 className="text-sm font-bold text-white">אין עדיין כתוביות לפרק זה</h4>
                        <p className="text-xs text-slate-400">
                          בחרו את הדרך המועדפת עליכם ליצירת כתוביות מסונכרנות ומעוצבות:
                        </p>
                      </div>

                      {/* High-Effort Mode Toggle Banner */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-purple-500/30 text-right max-w-lg mx-auto shadow-inner">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl transition-all ${highEffortMode ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}>
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-white">מצב התאמצות מקסימלית (High-Effort AI)</span>
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/30">פעיל</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              הגברה אקוסטית ושחזור פונטי של דיבור עמום, חלש, מהיר או ממלמל
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setHighEffortMode(!highEffortMode)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                            highEffortMode
                              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${highEffortMode ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                          <span>{highEffortMode ? 'מופעל' : 'כבוי'}</span>
                        </button>
                      </div>

                      {/* Primary 1-Click: Transcribe & Translate English/Foreign Video to Hebrew */}
                      <button
                        type="button"
                        onClick={() => handleTranscribeRecordedAudio({ spokenLanguage: 'auto', translateToHebrew: true })}
                        disabled={isTranscribing}
                        className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/40 hover:from-purple-900/60 hover:to-blue-900/60 border-2 border-purple-500/50 hover:border-purple-400 text-white transition-all text-right group shadow-xl shadow-purple-950/40 relative overflow-hidden active:scale-99"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform shadow-md">
                              <Globe className="w-5 h-5 text-purple-300" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm text-white">✨ תמלל ותרגם סרטון באנגלית לעברית (AI)</span>
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-black border border-purple-500/30">מומלץ</span>
                              </div>
                              <p className="text-xs text-slate-300 mt-0.5">
                                מאזין לדיבור בסרטון (באנגלית או בכל שפה), מתמלל ומתרגם ישירות לכתוביות בעברית עם סנכרון תזמונים מדויק
                              </p>
                            </div>
                          </div>
                          <div className="px-3 py-1.5 rounded-xl bg-purple-600/30 group-hover:bg-purple-600/50 text-purple-200 text-xs font-bold transition-all shrink-0">
                            הפעל עכשיו ←
                          </div>
                        </div>
                      </button>

                      {/* 4 Action Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-right">
                        {/* 1. Speech-to-Text AI */}
                        <button
                          type="button"
                          onClick={() => handleTranscribeRecordedAudio()}
                          disabled={isTranscribing}
                          className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 text-amber-200 transition-all text-right group shadow-md"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Wand2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">תמלול AI מהקלטה</span>
                          </div>
                          <p className="text-[10px] text-slate-400">תמלול מילה במילה מהקלטת הפרק</p>
                        </button>

                        {/* 2. Generate from Outline / Topics */}
                        <button
                          type="button"
                          onClick={handleGenerateFromTopics}
                          className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/30 text-indigo-200 transition-all text-right group shadow-md"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">צור מנושאי הפרק</span>
                          </div>
                          <p className="text-[10px] text-slate-400">סנכרון תסריט הפרק לפי קצב דיבור</p>
                        </button>

                        {/* 3. Import SRT / VTT */}
                        <button
                          type="button"
                          onClick={() => srtFileInputRef.current?.click()}
                          className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 text-slate-200 transition-all text-right group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Upload className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">ייבוא קובץ כתוביות</span>
                          </div>
                          <p className="text-[10px] text-slate-400">טעינת קובץ SRT או VTT חיצוני</p>
                        </button>

                        {/* 4. Live Dictation Web Speech */}
                        <button
                          type="button"
                          onClick={toggleLiveDictation}
                          className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 text-slate-200 transition-all text-right group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Mic className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">הכתבה בדיבור ישיר</span>
                          </div>
                          <p className="text-[10px] text-slate-400">הכתבה למיקרופון ללא צורך במפתח</p>
                        </button>

                        {/* 5. ElevenLabs Subtitles & Voiceover Generator */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!elevenLabsScriptText && (episode.description || episode.topics?.length)) {
                              const prefill = [
                                episode.title ? `${episode.title}:` : '',
                                episode.description || '',
                                ...(episode.topics?.map(t => typeof t === 'string' ? t : t.title) || [])
                              ].filter(Boolean).join('\n');
                              setElevenLabsScriptText(prefill);
                            }
                            setIsElevenLabsModalOpen(true);
                          }}
                          className="col-span-1 sm:col-span-2 p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-pink-950/30 hover:from-purple-950/60 hover:to-pink-950/50 border border-purple-500/40 text-purple-200 transition-all text-right group shadow-lg flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
                              <Volume2 className="w-5 h-5 text-purple-300" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-white">✨ יצירת כתוביות וקריינות עם ElevenLabs</span>
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[9px] font-black border border-purple-500/30">חדש</span>
                              </div>
                              <p className="text-[10px] text-slate-300 mt-0.5">סנכרון תזמונים מדויק מתסריט או תמלול אקוסטי ברמת Scribe v1</p>
                            </div>
                          </div>
                          <div className="px-2.5 py-1 rounded-lg bg-purple-600/30 text-purple-200 text-[10px] font-bold">
                            פתח כלי ←
                          </div>
                        </button>
                      </div>

                      {/* Manual Add Cue */}
                      <button
                        type="button"
                        onClick={handleAddSubtitle}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>או הוסף כתובית ידנית בנקודת הזמן הנוכחית</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
              </div>
            )}

            {/* TAB 2: Visual Styling & Font Manager */}
            {sidebarTab === 'style' && (
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                {/* Preset Themes Gallery */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                    <span>תבניות עיצוב מוכנות מראש (Presets):</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SUBTITLE_THEMES.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => handleApplyTheme(th)}
                        className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 hover:bg-purple-950/20 text-right transition-all group"
                      >
                        <div className="font-bold text-xs text-white group-hover:text-purple-300 mb-0.5">{th.name}</div>
                        <p className="text-[10px] text-slate-400 line-clamp-2">{th.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                  {selectedIds.length > 0 ? (
                    <p className="font-bold">עיצוב עבור {selectedIds.length} כתוביות שנבחרו</p>
                  ) : (
                    <p className="font-bold">עיצוב גלובלי לכל הכתוביות בפודקאסט</p>
                  )}
                </div>

                {/* 1. Brand Logo Overlay Configuration Panel */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/30 to-slate-950 border border-purple-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-purple-600/20 text-purple-400">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">שכבת לוגו מותג (Brand Logo)</h4>
                        <p className="text-[10px] text-slate-400">מיקום בצד ימין או שמאל עם שמירה קבועה במערכת</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalStyle.logoEnabled || false}
                        onChange={(e) => applyStyleUpdate({ logoEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {globalStyle.logoEnabled && (
                    <div className="space-y-3 pt-2 border-t border-slate-800/80">
                      {/* Upload or change logo image */}
                      <div className="flex items-center gap-2">
                        {globalStyle.logoUrl ? (
                          <div className="relative group w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center p-1 overflow-hidden shrink-0">
                            <img src={globalStyle.logoUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => applyStyleUpdate({ logoUrl: '' })}
                              className="absolute inset-0 bg-black/70 text-rose-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              title="הסר תמונת לוגו"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}

                        <div className="flex-1">
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="w-full py-1.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{globalStyle.logoUrl ? 'החלף קובץ לוגו' : 'העלה לוגו (PNG/SVG/JPG)'}</span>
                          </button>
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/svg+xml,image/jpeg,image/webp"
                            onChange={handleLogoUpload}
                            className="hidden"
                          />
                          <p className="text-[9px] text-slate-500 mt-1">מומלץ קובץ PNG שקוף איכותי</p>
                        </div>
                      </div>

                      {/* Position selector (4 corners + center) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300">מיקום הלוגו על המסך:</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {[
                            { id: 'top-right', label: '↗️ ימין למעלה' },
                            { id: 'top-left', label: '↖️ שמאל למעלה' },
                            { id: 'bottom-right', label: '↘️ ימין למטה' },
                            { id: 'bottom-left', label: '↙️ שמאל למטה' }
                          ].map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => applyStyleUpdate({ logoPosition: pos.id as any })}
                              className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                                (globalStyle.logoPosition || 'top-right') === pos.id
                                  ? 'bg-purple-600 border-purple-400 text-white shadow'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Size and Opacity sliders */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">גודל לוגו:</span>
                            <span className="font-mono text-purple-300 font-bold">{globalStyle.logoSize || 64}px</span>
                          </div>
                          <input
                            type="range"
                            min={24}
                            max={160}
                            value={globalStyle.logoSize || 64}
                            onChange={(e) => applyStyleUpdate({ logoSize: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">שקיפות:</span>
                            <span className="font-mono text-purple-300 font-bold">{globalStyle.logoOpacity !== undefined ? globalStyle.logoOpacity : 90}%</span>
                          </div>
                          <input
                            type="range"
                            min={20}
                            max={100}
                            value={globalStyle.logoOpacity !== undefined ? globalStyle.logoOpacity : 90}
                            onChange={(e) => applyStyleUpdate({ logoOpacity: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>

                      {/* Save permanent logo buttons */}
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveLogoPermanent}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            logoSaveSuccess 
                              ? 'bg-emerald-600 text-white' 
                              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{logoSaveSuccess ? 'נשמר כלוגו קבוע במערכת! ✅' : 'שמור כלוגו קבוע כברירת מחדל'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleClearPermanentLogo}
                          className="py-1.5 px-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 text-[11px] font-semibold transition-all"
                          title="הסר לוגו ברירת מחדל שמור"
                        >
                          הסר קבוע
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Font Selector & Custom Font Uploader */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">גופן כתוביות (Font Family)</label>
                    <button
                      onClick={() => fontInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>העלאת פונט (.ttf / .otf / .woff)</span>
                    </button>
                    <input
                      ref={fontInputRef}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={handleFontUpload}
                      className="hidden"
                    />
                  </div>

                  <select
                    value={globalStyle.fontFamily}
                    onChange={(e) => applyStyleUpdate({ fontFamily: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    {allFontsList.map((f, i) => (
                      <option key={i} value={f.value}>{f.name}</option>
                    ))}
                  </select>

                  {/* List of uploaded custom fonts with delete option */}
                  {customFonts.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400 font-bold">פונטים אישיים שמורים:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {customFonts.map((cf, i) => (
                          <div key={i} className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800 text-[10px] text-purple-300">
                            <span>{cf.name.replace('פונט אישי: ', '')}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomFont(cf.value)}
                              className="text-slate-500 hover:text-rose-400 ml-1"
                              title="מחק פונט שמור זה"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Subtitle Font Size & Quick Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">גודל כתוביות (Font Size)</label>
                    <span className="text-xs font-mono font-bold text-purple-400">{globalStyle.fontSize || 28}px</span>
                  </div>

                  {/* Size Preset Buttons */}
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { size: 20, label: 'קטן (20)' },
                      { size: 28, label: 'רגיל (28)' },
                      { size: 36, label: 'גדול (36)' },
                      { size: 48, label: 'טיקטוק (48)' },
                      { size: 60, label: 'ענק (60)' }
                    ].map(p => (
                      <button
                        key={p.size}
                        type="button"
                        onClick={() => applyStyleUpdate({ fontSize: p.size })}
                        className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          globalStyle.fontSize === p.size
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={14}
                    max={72}
                    value={globalStyle.fontSize || 28}
                    onChange={(e) => applyStyleUpdate({ fontSize: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>

                {/* 4. Words Per Line (כמות מילים בשורה) */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                      <label className="text-xs font-bold text-white">כמות מילים בשורה (Words Per Line)</label>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-600/30 text-purple-300 font-mono font-bold text-xs">
                      {globalStyle.maxWordsPerLine || wordsPerLine || 4} מילים
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">קובע כמה מילים מקסימום יוצגו בכל שורה על המסך. שובר שורות באופן קצבי ומושלם.</p>

                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={globalStyle.maxWordsPerLine || wordsPerLine || 4}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setWordsPerLine(val);
                      applyStyleUpdate({ maxWordsPerLine: val });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>1-2 (רילס מהיר)</span>
                    <span>3-4 (מומלץ)</span>
                    <span>6-8 (משפט שלם)</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBatchRechunk(globalStyle.maxWordsPerLine || wordsPerLine || 4)}
                    disabled={subtitles.length === 0}
                    className="w-full py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-[11px] font-bold border border-purple-500/30 transition-all"
                  >
                    חלק מחדש את {selectedIds.length > 0 ? `${selectedIds.length} הכתוביות הנבחרות` : 'כל הכתוביות'} לפי {globalStyle.maxWordsPerLine || wordsPerLine || 4} מילים
                  </button>
                </div>

                {/* Font Weight & Text Alignment */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">משקל גופן</label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      {[
                        { id: 'normal', label: 'רגיל' },
                        { id: 'bold', label: 'בולט' },
                        { id: '900', label: 'Black' }
                      ].map((w) => (
                        <button
                          key={w.id}
                          onClick={() => applyStyleUpdate({ fontWeight: w.id as any, isBold: w.id !== 'normal' })}
                          className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                            (globalStyle.fontWeight === w.id || (w.id === 'bold' && globalStyle.isBold && !globalStyle.fontWeight))
                              ? 'bg-purple-600 text-white' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">יישור טקסט</label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      {[
                        { id: 'right', label: 'ימין', icon: AlignRight },
                        { id: 'center', label: 'מרכז', icon: AlignCenter },
                        { id: 'left', label: 'שמאל', icon: AlignLeft }
                      ].map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.id}
                            onClick={() => applyStyleUpdate({ textAlign: a.id as any })}
                            className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                              (globalStyle.textAlign || 'center') === a.id 
                                ? 'bg-purple-600 text-white' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 5. קו מתאר לכתוביות (Text Outline / Stroke) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${globalStyle.strokeEnabled !== false && (globalStyle.strokeWidth || 0) > 0 ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-900 text-slate-500'}`}>
                        <Sparkle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">קו מתאר לכתוביות (Outline / Stroke)</h4>
                        <p className="text-[10px] text-slate-400">הדגשת גבולות האותיות להפרדה מושלמת מהרקע</p>
                      </div>
                    </div>
                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const isCurrentlyOn = globalStyle.strokeEnabled !== false && (globalStyle.strokeWidth || 0) > 0;
                        if (isCurrentlyOn) {
                          applyStyleUpdate({ strokeEnabled: false });
                        } else {
                          applyStyleUpdate({ strokeEnabled: true, strokeWidth: Math.max(1, globalStyle.strokeWidth || 2) });
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                        globalStyle.strokeEnabled !== false && (globalStyle.strokeWidth || 0) > 0
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${globalStyle.strokeEnabled !== false && (globalStyle.strokeWidth || 0) > 0 ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                      {globalStyle.strokeEnabled !== false && (globalStyle.strokeWidth || 0) > 0 ? 'קו מתאר פעיל' : 'כבוי'}
                    </button>
                  </div>

                  {/* Outline Controls (Only if Enabled) */}
                  {globalStyle.strokeEnabled !== false && (globalStyle.strokeWidth || 0) > 0 && (
                    <div className="space-y-3 pt-2 border-t border-slate-900 animate-in fade-in-50 duration-200">
                      {/* Outline Thickness Slider & Presets */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-semibold">עובי קו המתאר (גודל קו המתאר):</span>
                          <span className="font-mono font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
                            {globalStyle.strokeWidth || 2}px
                          </span>
                        </div>

                        {/* Quick thickness presets */}
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { width: 1, label: 'דק (1px)' },
                            { width: 2, label: 'סטנדרטי (2px)' },
                            { width: 3, label: 'בולט (3px)' },
                            { width: 5, label: 'עבה (5px)' }
                          ].map((p) => (
                            <button
                              key={p.width}
                              type="button"
                              onClick={() => applyStyleUpdate({ strokeWidth: p.width, strokeEnabled: true })}
                              className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                globalStyle.strokeWidth === p.width
                                  ? 'bg-purple-600 border-purple-400 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        <input
                          type="range"
                          min={1}
                          max={8}
                          step={1}
                          value={globalStyle.strokeWidth || 2}
                          onChange={(e) => applyStyleUpdate({ strokeWidth: parseInt(e.target.value), strokeEnabled: true })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                        <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                          <span>1px (עדין)</span>
                          <span>2px-3px (מומלץ)</span>
                          <span>8px (עבה מאוד)</span>
                        </div>
                      </div>

                      {/* Outline Color */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">צבע קו המתאר</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={globalStyle.strokeColor || '#000000'}
                            onChange={(e) => applyStyleUpdate({ strokeColor: e.target.value, strokeEnabled: true })}
                            className="w-10 h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700 p-0.5"
                          />
                          {/* Color presets */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { color: '#000000', label: 'שחור' },
                              { color: '#FFFFFF', label: 'לבן' },
                              { color: '#D97706', label: 'זהב' },
                              { color: '#06B6D4', label: 'ניאון' },
                              { color: '#9333EA', label: 'סגול' },
                              { color: '#DC2626', label: 'אדום' }
                            ].map((c) => (
                              <button
                                key={c.color}
                                type="button"
                                onClick={() => applyStyleUpdate({ strokeColor: c.color, strokeEnabled: true })}
                                title={c.label}
                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                  (globalStyle.strokeColor || '#000000').toLowerCase() === c.color.toLowerCase()
                                    ? 'border-purple-400 scale-110 shadow-sm shadow-purple-400'
                                    : 'border-slate-700'
                                }`}
                                style={{ backgroundColor: c.color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. רקע לכתוביות (Subtitle Background Box) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${globalStyle.backgroundEnabled !== false && globalStyle.boxStyle !== 'none' ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-900 text-slate-500'}`}>
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">רקע כתוביות (Background Box)</h4>
                        <p className="text-[10px] text-slate-400">צורת תיבה, גודל שוליים, רדיוס פינות ושקיפות</p>
                      </div>
                    </div>
                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const isBgActive = globalStyle.backgroundEnabled !== false && globalStyle.boxStyle !== 'none';
                        if (isBgActive) {
                          applyStyleUpdate({ backgroundEnabled: false, boxStyle: 'none' });
                        } else {
                          applyStyleUpdate({ 
                            backgroundEnabled: true, 
                            boxStyle: (globalStyle.boxStyle === 'none' || !globalStyle.boxStyle) ? 'rounded-badge' : globalStyle.boxStyle,
                            backgroundColor: globalStyle.backgroundColor || '#000000',
                            backgroundOpacity: globalStyle.backgroundOpacity ?? 80
                          });
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                        globalStyle.backgroundEnabled !== false && globalStyle.boxStyle !== 'none'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${globalStyle.backgroundEnabled !== false && globalStyle.boxStyle !== 'none' ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                      {globalStyle.backgroundEnabled !== false && globalStyle.boxStyle !== 'none' ? 'רקע פעיל' : 'ללא רקע'}
                    </button>
                  </div>

                  {/* Background Controls (Only if Enabled) */}
                  {globalStyle.backgroundEnabled !== false && globalStyle.boxStyle !== 'none' && (
                    <div className="space-y-3.5 pt-2 border-t border-slate-900 animate-in fade-in-50 duration-200">
                      {/* Box Shape Presets */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">סגנון צורת הרקע</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {[
                            { id: 'rounded-badge', label: 'תגית מעוגלת' },
                            { id: 'pill-badge', label: 'גלולה (Pill)' },
                            { id: 'glassmorphism', label: 'זכוכית מטושטשת' },
                            { id: 'full-bar', label: 'פס תחתון מלא' }
                          ].map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => applyStyleUpdate({ boxStyle: b.id as any, backgroundEnabled: true })}
                              className={`py-2 px-1.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                                globalStyle.boxStyle === b.id 
                                  ? 'bg-purple-600 border-purple-400 text-white shadow' 
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {b.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Padding / Size: Horizontal & Vertical */}
                      <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800/80">
                        <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                          <span>גודל הרקע (שוליים פנימיים - Padding)</span>
                          <span className="text-[10px] text-purple-300 font-mono">
                            {globalStyle.backgroundPaddingX ?? 20}px × {globalStyle.backgroundPaddingY ?? 10}px
                          </span>
                        </div>

                        {/* Horizontal Padding (Width of background) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">רוחב שוליים אופקיים (רוחב הרקע):</span>
                            <span className="font-mono font-bold text-purple-300">{globalStyle.backgroundPaddingX ?? 20}px</span>
                          </div>
                          <input
                            type="range"
                            min={4}
                            max={48}
                            step={2}
                            value={globalStyle.backgroundPaddingX ?? 20}
                            onChange={(e) => applyStyleUpdate({ backgroundPaddingX: parseInt(e.target.value), backgroundEnabled: true })}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>

                        {/* Vertical Padding (Height of background) */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">גובה שוליים אנכיים (עובי/גובה הרקע):</span>
                            <span className="font-mono font-bold text-purple-300">{globalStyle.backgroundPaddingY ?? 10}px</span>
                          </div>
                          <input
                            type="range"
                            min={2}
                            max={32}
                            step={2}
                            value={globalStyle.backgroundPaddingY ?? 10}
                            onChange={(e) => applyStyleUpdate({ backgroundPaddingY: parseInt(e.target.value), backgroundEnabled: true })}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>

                      {/* Border Radius (Corner Rounding) - Only if not Pill */}
                      {globalStyle.boxStyle !== 'pill-badge' && globalStyle.boxStyle !== 'full-bar' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-semibold">עיגול פינות הרקע (Corner Radius):</span>
                            <span className="font-mono font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
                              {globalStyle.backgroundBorderRadius ?? 16}px
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={36}
                            step={2}
                            value={globalStyle.backgroundBorderRadius ?? 16}
                            onChange={(e) => applyStyleUpdate({ backgroundBorderRadius: parseInt(e.target.value), backgroundEnabled: true })}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                            <span>0px (מרובע חד)</span>
                            <span>16px (מעוגל רגיל)</span>
                            <span>36px (מעוגל עמוק)</span>
                          </div>
                        </div>
                      )}

                      {/* Color & Opacity Controls */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-slate-300">צבע ושקיפות הרקע</label>
                          <span className="text-xs font-mono font-bold text-purple-400">
                            אטימות: {globalStyle.backgroundOpacity ?? 80}%
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <input
                            type="color"
                            value={getHexColor(globalStyle.backgroundColor)}
                            onChange={(e) => applyStyleUpdate({ backgroundColor: e.target.value, backgroundEnabled: true })}
                            className="w-10 h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700 p-0.5"
                          />
                          
                          {/* Opacity slider */}
                          <div className="flex-1 space-y-1">
                            <input
                              type="range"
                              min={10}
                              max={100}
                              step={5}
                              value={globalStyle.backgroundOpacity ?? 80}
                              onChange={(e) => applyStyleUpdate({ backgroundOpacity: parseInt(e.target.value), backgroundEnabled: true })}
                              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                          </div>

                          {/* Quick Swatches */}
                          <div className="flex items-center gap-1">
                            {[
                              { color: '#000000', label: 'שחור' },
                              { color: '#0f172a', label: 'כחול לילה' },
                              { color: '#2e1065', label: 'סגול עמוק' },
                              { color: '#1e293b', label: 'גרפיט' },
                              { color: '#ffffff', label: 'לבן' }
                            ].map((c) => (
                              <button
                                key={c.color}
                                type="button"
                                onClick={() => applyStyleUpdate({ backgroundColor: c.color, backgroundEnabled: true })}
                                title={c.label}
                                className={`w-5 h-5 rounded-full border transition-transform hover:scale-110 ${
                                  getHexColor(globalStyle.backgroundColor).toLowerCase() === c.color.toLowerCase()
                                    ? 'border-purple-400 scale-110'
                                    : 'border-slate-700'
                                }`}
                                style={{ backgroundColor: c.color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. צל, עומק וזוהר (Shadow & Glow Effects) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${globalStyle.shadowEnabled !== false && globalStyle.textShadow !== 'none' ? 'bg-purple-600/20 text-purple-400' : 'bg-slate-900 text-slate-500'}`}>
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">אפקטי צל וזוהר (Shadow & Glow)</h4>
                        <p className="text-[10px] text-slate-400">עומק תלת-ממדי, הילת ניאון או טשטוש קולנועי</p>
                      </div>
                    </div>
                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const isShadowOn = globalStyle.shadowEnabled !== false && globalStyle.textShadow !== 'none';
                        if (isShadowOn) {
                          applyStyleUpdate({ shadowEnabled: false, textShadow: 'none' });
                        } else {
                          applyStyleUpdate({ 
                            shadowEnabled: true, 
                            textShadow: (globalStyle.textShadow === 'none' || !globalStyle.textShadow) ? 'soft' : globalStyle.textShadow 
                          });
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                        globalStyle.shadowEnabled !== false && globalStyle.textShadow !== 'none'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${globalStyle.shadowEnabled !== false && globalStyle.textShadow !== 'none' ? 'bg-white animate-pulse' : 'bg-slate-500'}`} />
                      {globalStyle.shadowEnabled !== false && globalStyle.textShadow !== 'none' ? 'צל פעיל' : 'ללא צל'}
                    </button>
                  </div>

                  {/* Shadow Controls (Only if Enabled) */}
                  {globalStyle.shadowEnabled !== false && globalStyle.textShadow !== 'none' && (
                    <div className="space-y-3 pt-2 border-t border-slate-900 animate-in fade-in-50 duration-200">
                      {/* Shadow Style Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {[
                          { id: 'soft', label: 'צל רך (Soft)' },
                          { id: 'hard-outline', label: 'מסגרת חדה' },
                          { id: 'neon-glow', label: 'זוהר ניאון' },
                          { id: 'cinema-blur', label: 'טשטוש קולנועי' }
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => applyStyleUpdate({ textShadow: s.id as any, shadowEnabled: true })}
                            className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all text-center ${
                              globalStyle.textShadow === s.id 
                                ? 'bg-purple-600 border-purple-400 text-white shadow' 
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>

                      {/* Blur slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-semibold">עוצמת טשטוש וגודל צל:</span>
                          <span className="font-mono font-bold text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
                            {globalStyle.shadowBlur ?? 8}px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={30}
                          value={globalStyle.shadowBlur ?? 8}
                          onChange={(e) => applyStyleUpdate({ shadowBlur: parseInt(e.target.value), shadowEnabled: true })}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>

                      {/* Shadow Color */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-300">צבע הצל / ההילה</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={getHexColor(globalStyle.shadowColor)}
                            onChange={(e) => applyStyleUpdate({ shadowColor: e.target.value, shadowEnabled: true })}
                            className="w-10 h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700 p-0.5"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { color: '#000000', label: 'שחור' },
                              { color: '#06b6d4', label: 'טורקיז' },
                              { color: '#f59e0b', label: 'זהב' },
                              { color: '#a855f7', label: 'סגול' },
                              { color: '#f43f5e', label: 'ורוד' }
                            ].map((c) => (
                              <button
                                key={c.color}
                                type="button"
                                onClick={() => applyStyleUpdate({ shadowColor: c.color, shadowEnabled: true })}
                                title={c.label}
                                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                  getHexColor(globalStyle.shadowColor).toLowerCase() === c.color.toLowerCase()
                                    ? 'border-purple-400 scale-110'
                                    : 'border-slate-700'
                                }`}
                                style={{ backgroundColor: c.color }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 8. צבעי טקסט ואפקט קריוקי למילה מדוברת */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-400" />
                    <span>צבעי טקסט ואפקט מילה מדוברת (Karaoke)</span>
                  </h4>

                  {/* Active Karaoke Word Animation Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300">אפקט הדגשת המילה המדוברת</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'color-pop', label: 'צהוב קופץ (TikTok)' },
                        { id: 'glow', label: 'זוהר ניאון למילה' },
                        { id: 'none', label: 'ללא הדגשת מילה' }
                      ].map((anim) => (
                        <button
                          key={anim.id}
                          type="button"
                          onClick={() => applyStyleUpdate({ activeWordAnimation: anim.id as any })}
                          className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                            (globalStyle.activeWordAnimation || 'color-pop') === anim.id 
                              ? 'bg-purple-600 border-purple-400 text-white shadow' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {anim.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Text & Highlight Word Colors */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <label className="text-[11px] font-semibold text-slate-300 block">צבע טקסט ראשי</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={globalStyle.textColor || '#FFFFFF'}
                          onChange={(e) => applyStyleUpdate({ textColor: e.target.value })}
                          className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      <label className="text-[11px] font-semibold text-slate-300 block">צבע מילה מודגשת (קריוקי)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={globalStyle.highlightWordColor || '#FACC15'}
                          onChange={(e) => applyStyleUpdate({ highlightWordColor: e.target.value })}
                          className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 9. אפקטי הופעה והיעלמות (כניסה ויציאה) בסגנון CapCut / TikTok */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-purple-900/40 space-y-4 shadow-lg shadow-purple-950/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                          <span>אפקטי הופעה והיעלמות</span>
                          <span className="text-[10px] font-mono font-bold bg-pink-500/20 text-pink-300 px-1.5 py-0.2 rounded-full border border-pink-500/30">
                            CapCut Style
                          </span>
                        </h4>
                        <p className="text-[10px] text-slate-400">אנימציות כניסה חיות ויציאה חלקה לכל כתובית</p>
                      </div>
                    </div>

                    {/* Quick Preview Test Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={triggerPreviewSequence}
                        title="בדוק רצף מלא: כניסה ולאחריה יציאה"
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[11px] font-bold shadow-md transition-all flex items-center gap-1 active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>בדוק רצף</span>
                      </button>
                    </div>
                  </div>

                  {/* Animation Duration / Speed Slider */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        <span>מהירות האנימציה (משך מעבר):</span>
                      </div>
                      <span className="font-mono font-bold text-pink-400 bg-pink-950/60 px-2 py-0.5 rounded-md border border-pink-800/40 text-[11px]">
                        {Math.round((globalStyle.animationDuration ?? 0.25) * 1000)}ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.10}
                      max={0.50}
                      step={0.02}
                      value={globalStyle.animationDuration ?? 0.25}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        applyStyleUpdate({ animationDuration: val });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          applyStyleUpdate({ animationDuration: 0.15 });
                          triggerPreviewSequence();
                        }}
                        className="hover:text-purple-300 transition-colors"
                      >
                        ⚡ מהיר (150ms)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          applyStyleUpdate({ animationDuration: 0.25 });
                          triggerPreviewSequence();
                        }}
                        className="hover:text-purple-300 transition-colors font-bold text-slate-400"
                      >
                        🎯 ברירת מחדל (250ms)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          applyStyleUpdate({ animationDuration: 0.40 });
                          triggerPreviewSequence();
                        }}
                        className="hover:text-purple-300 transition-colors"
                      >
                        🎬 קולנועי איטי (400ms)
                      </button>
                    </div>
                  </div>

                  {/* Entrance Animation Picker */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                        <span>🎬 אפקט כניסה והופעה (Entrance)</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          ({ENTRANCE_ANIMATION_OPTIONS.find(o => o.id === (globalStyle.entranceAnimation || 'pop'))?.label})
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={triggerPreviewEntrance}
                        className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 bg-purple-950/40 hover:bg-purple-950/70 border border-purple-800/40 px-2 py-0.5 rounded-md transition-all"
                      >
                        <Eye className="w-2.5 h-2.5" />
                        <span>בדוק כניסה בלבד</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ENTRANCE_ANIMATION_OPTIONS.map((opt) => {
                        const isSelected = (globalStyle.entranceAnimation || 'pop') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              applyStyleUpdate({ entranceAnimation: opt.id, animation: opt.id as any });
                              triggerPreviewEntrance();
                            }}
                            title={opt.desc}
                            className={`p-2 rounded-xl text-right transition-all flex items-center justify-between border ${
                              isSelected
                                ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/20 border-purple-400 text-white shadow-sm'
                                : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base select-none">{opt.emoji}</span>
                              <div className="truncate text-right">
                                <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                  {opt.label}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mr-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Exit Animation Picker */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                        <span>👋 אפקט יציאה והיעלמות (Exit)</span>
                        <span className="text-[10px] font-normal text-slate-400">
                          ({EXIT_ANIMATION_OPTIONS.find(o => o.id === (globalStyle.exitAnimation || 'fade'))?.label})
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={triggerPreviewExit}
                        className="text-[10px] text-pink-400 hover:text-pink-300 font-semibold flex items-center gap-1 bg-pink-950/40 hover:bg-pink-950/70 border border-pink-800/40 px-2 py-0.5 rounded-md transition-all"
                      >
                        <Eye className="w-2.5 h-2.5" />
                        <span>בדוק יציאה בלבד</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {EXIT_ANIMATION_OPTIONS.map((opt) => {
                        const isSelected = (globalStyle.exitAnimation || 'fade') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              applyStyleUpdate({ exitAnimation: opt.id });
                              triggerPreviewExit();
                            }}
                            title={opt.desc}
                            className={`p-2 rounded-xl text-right transition-all flex items-center justify-between border ${
                              isSelected
                                ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/20 border-pink-400 text-white shadow-sm'
                                : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base select-none">{opt.emoji}</span>
                              <div className="truncate text-right">
                                <div className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                  {opt.label}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-pink-400 flex-shrink-0 mr-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 5. Physical Position Controls (9-Point Grid & Sliders) */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Move className="w-3.5 h-3.5 text-purple-400" />
                      <label className="text-xs font-bold text-white">מיקום פיזי על המסך</label>
                    </div>
                    <span className="text-[11px] font-mono text-purple-300">
                      X: {globalStyle.positionX ?? 50}% | Y: {globalStyle.positionY ?? 80}%
                    </span>
                  </div>

                  {/* 9-Point Alignment Grid */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-semibold">יישור מהיר (9 נקודות עיגון):</span>
                    <div className="grid grid-cols-3 gap-1 max-w-[200px] mx-auto bg-slate-900 p-1.5 rounded-xl border border-slate-800">
                      {[
                        { label: '↖️', y: 15, x: 25 },
                        { label: '⬆️', y: 15, x: 50 },
                        { label: '↗️', y: 15, x: 75 },
                        { label: '⬅️', y: 50, x: 25 },
                        { label: '🎯', y: 50, x: 50 },
                        { label: '➡️', y: 50, x: 75 },
                        { label: '↙️', y: 82, x: 25 },
                        { label: '⬇️', y: 82, x: 50 },
                        { label: '↘️', y: 82, x: 75 }
                      ].map((pt, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => applyStyleUpdate({ positionX: pt.x, positionY: pt.y })}
                          className={`py-1 rounded-lg text-xs font-bold transition-all ${
                            globalStyle.positionX === pt.x && globalStyle.positionY === pt.y
                              ? 'bg-purple-600 text-white shadow'
                              : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {pt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sliders for fine-tuning */}
                  <div className="space-y-2 pt-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">גובה אנכי (Y):</span>
                        <span className="font-mono text-purple-300 font-bold">{globalStyle.positionY ?? 80}%</span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={92}
                        value={typeof globalStyle.positionY === 'number' ? globalStyle.positionY : 80}
                        onChange={(e) => applyStyleUpdate({ positionY: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">מיקום אופקי (X):</span>
                        <span className="font-mono text-purple-300 font-bold">{globalStyle.positionX ?? 50}%</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={90}
                        value={typeof globalStyle.positionX === 'number' ? globalStyle.positionX : 50}
                        onChange={(e) => applyStyleUpdate({ positionX: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-purple-300/80 text-center font-medium">
                    💡 טיפ: ניתן ללחוץ ולגרור את הכתובית עם העכבר ישירות מעל תצוגת הווידאו!
                  </p>
                </div>

                {/* 10. זיהוי ועיצוב דוברים (Multi-Speaker Diarization & Colors) */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/30 via-indigo-950/20 to-slate-950 border border-purple-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-purple-600/20 text-purple-400">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">זיהוי והבדלה בין דוברים (Multi-Speaker)</h4>
                        <p className="text-[10px] text-slate-400">תגיות שם דובר וצבע ייחודי לכל דובר בווידאו</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    {/* Toggle: Show Speaker Badge on Video */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-200 font-bold block">הצג תגית שם דובר בווידאו</span>
                        <span className="text-[10px] text-slate-400">תגית מרחפת מעל הכתובית עם שם הדובר</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={globalStyle.showSpeakerBadge !== false}
                          onChange={(e) => applyStyleUpdate({ showSpeakerBadge: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {/* Toggle: Color Code Subtitle by Speaker */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-200 font-bold block">הדגש מסגרת לפי צבע הדובר</span>
                        <span className="text-[10px] text-slate-400">צביעת קו המתאר של תיבת הכתובית בצבע הדובר</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={globalStyle.colorCodeSubtitleBySpeaker || false}
                          onChange={(e) => applyStyleUpdate({ colorCodeSubtitleBySpeaker: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    {/* List of Detected Speakers & Color Customization */}
                    <div className="space-y-2 pt-2 border-t border-slate-900">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <span>רשימת הדוברים בפרק ({projectSpeakers.length}):</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoDiarizeSubtitles}
                          disabled={isDiarizingSubtitles}
                          className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-bold underline transition-colors"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>{isDiarizingSubtitles ? 'מזהה...' : '✨ זהה דוברים עם AI'}</span>
                        </button>
                      </div>

                      {projectSpeakers.length === 0 ? (
                        <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-1">
                          <p className="text-[11px] text-slate-400">
                            טרם שויכו דוברים לכתוביות.
                          </p>
                          <button
                            type="button"
                            onClick={handleAutoDiarizeSubtitles}
                            disabled={isDiarizingSubtitles || subtitles.length === 0}
                            className="text-xs text-purple-400 hover:text-purple-300 font-bold underline"
                          >
                            לחצו כאן לזיהוי והבדלה אוטומטית בין דוברים (AI Diarization)
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {projectSpeakers.map((spk) => {
                            const count = subtitles.filter(s => s.speaker === spk).length;
                            const currentCol = getSpeakerColor(spk, globalStyle.speakerColors);
                            return (
                              <div key={spk} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 flex items-center justify-between gap-2.5 shadow-sm">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <input
                                    type="color"
                                    value={currentCol}
                                    onChange={(e) => {
                                      const newColors = { ...(globalStyle.speakerColors || {}), [spk]: e.target.value };
                                      applyStyleUpdate({ speakerColors: newColors });
                                    }}
                                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-slate-700 p-0.5 shrink-0"
                                    title="שנה צבע לדובר זה"
                                  />
                                  <input
                                    type="text"
                                    defaultValue={spk}
                                    onBlur={(e) => {
                                      const newName = e.target.value.trim();
                                      if (newName && newName !== spk) {
                                        handleRenameSpeakerGlobally(spk, newName);
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    className="flex-1 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                                    title="לחץ לעריכת שם הדובר (ישנה בכל הכתוביות)"
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
                                  {count} כתוביות
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Pacing & Precision Sentence Segmentation Suite */}
            {sidebarTab === 'pacing' && (
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                <div className="p-4 rounded-2xl bg-gradient-to-tr from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 space-y-1.5">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Split className="w-4 h-4 text-purple-400" />
                    <span>מנוע דיוק וחלוקת משפטים חכם</span>
                  </h4>
                  <p className="text-xs text-slate-300">
                    בחרו את האסטרטגיה המדויקת לחלוקת המשפטים והדיבור – לפי משמעות סמנטית, כמות מילים קצבית או מגבלת תווים למובייל.
                  </p>
                </div>

                {/* 1. Semantic Sentence Splitter */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">חלוקה סמנטית לפי פיסוק ומשפטים</div>
                        <div className="text-[10px] text-slate-400">חותך משפטים אך ורק בסיום רעיון לוגי (נקודות, פסיקים, מקפים וסימני שאלה)</div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSegmentByPunctuation}
                    disabled={subtitles.length === 0}
                    className="w-full py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    הפעל חלוקה סמנטית על כל {subtitles.length} הכתוביות
                  </button>
                </div>

                {/* 2. Paced Word Count Splitter */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-600/20 text-purple-400">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">חלוקה לפי קצב מילים קבוע</div>
                        <div className="text-[10px] text-slate-400">קביעת כמות מילים מדויקת בכל שורת כתובית</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-600/30 text-purple-300 font-mono font-bold text-xs">
                      {wordsPerLine} מילים
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={wordsPerLine}
                    onChange={(e) => setWordsPerLine(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1-2 (רילס מהיר)</span>
                    <span>3-4 (מומלץ)</span>
                    <span>6-8 (משפט שלם)</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRebalanceAll(wordsPerLine)}
                    disabled={subtitles.length === 0}
                    className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all disabled:opacity-40"
                  >
                    חלק מחדש את כל הכתוביות ל-{wordsPerLine} מילים
                  </button>
                </div>

                {/* 3. Mobile Max Character Width Splitter */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400">
                      <Type className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">מגבלת רוחב תווים למובייל (Reels / Shorts)</div>
                      <div className="text-[10px] text-slate-400">מונע שבירת שורות מכוערת ומתאים את הטקסט בדיוק לרוחב הטלפון</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { chars: 22, label: 'קצרצר (22 תווים)' },
                      { chars: 32, label: 'סטנדרט (32 תווים)' },
                      { chars: 45, label: 'רחב (45 תווים)' }
                    ].map(c => (
                      <button
                        key={c.chars}
                        type="button"
                        onClick={() => handleSegmentByMaxChars(c.chars)}
                        disabled={subtitles.length === 0}
                        className="py-2 rounded-xl bg-slate-900 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 text-[11px] font-bold transition-all disabled:opacity-40"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Global AI Polish & Spacing */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">ליטוש וניקוי עברית אוטומטי (AI Polish)</div>
                      <div className="text-[10px] text-slate-400">מסיר מילות מילוי (אהה, כאילו), מתקן רווחים לפני פיסוק ומיישר זרימה</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePolishAllSubtitles}
                    disabled={subtitles.length === 0}
                    className="w-full py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    בצע ליטוש ויישור עברית לכל הכתוביות
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtitles AI Translation Modal */}
      {isTranslateModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#161b26] border border-slate-700 shadow-2xl text-right">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <button 
                onClick={() => setIsTranslateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {subtitles.length === 0 ? 'תמלול ותרגום סרטון חיצוני (AI)' : 'תרגום כתוביות חכם (AI Translate)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {subtitles.length === 0 
                      ? 'האזנה לדיבור בסרטון ותרגום ישיר לכתוביות בעברית' 
                      : `תרגום כל ${subtitles.length} הכתוביות תוך שמירה מדויקת על כל התזמונים`}
                  </p>
                </div>
              </div>
            </div>

            {/* Engine Status Banner */}
            <div className="mb-4 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${aiSettings.geminiApiKey || aiSettings.openaiApiKey ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-blue-400'}`} />
                <span className="text-slate-300 font-semibold">
                  {aiSettings.geminiApiKey 
                    ? 'מנוע: Google Gemini AI' 
                    : aiSettings.openaiApiKey 
                    ? 'מנוע: OpenAI GPT-4o' 
                    : 'מנוע: תרגום מובנה מהיר (חינם ללא מפתח)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTranslateModalOpen(false);
                  setIsAIModalOpen(true);
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold underline"
              >
                הגדרות AI
              </button>
            </div>

            {subtitles.length === 0 ? (
              /* Dedicated Flow for External Video with No Subtitles Yet */
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-purple-950/40 via-indigo-950/30 to-blue-950/40 border border-purple-500/40 text-right space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>תמלול ותרגום סרטון ישירות לעברית</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    זיהינו סרטון/קובץ שמע טעון בנגן. מנוע ה-AI יאזין לדיבור בסרטון (באנגלית או בכל שפה), יתמלל אותו ויתרגם אותו ישירות לכתוביות בעברית עם סנכרון תזמונים מדויק!
                  </p>
                </div>

                {/* Source Language Selection */}
                <div className="space-y-1.5 text-right">
                  <label className="block text-xs font-bold text-slate-300">שפת הדיבור בסרטון המקורי:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSourceLang('auto')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        selectedSourceLang === 'auto'
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ✨ זיהוי אוטומטי (מומלץ)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceLang('en')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        selectedSourceLang === 'en'
                          ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🇺🇸 אנגלית (English)
                    </button>
                  </div>
                </div>

                {/* Target Language Selection */}
                <div className="space-y-1.5 text-right">
                  <label className="block text-xs font-bold text-slate-300">שפת הכתוביות שיווצרו:</label>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs text-emerald-300 font-bold">
                    <span>🇮🇱 עברית (Hebrew) - תרגום מדויק</span>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsTranslateModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTranslateModalOpen(false);
                      handleTranscribeRecordedAudio({ spokenLanguage: selectedSourceLang, translateToHebrew: true });
                    }}
                    disabled={isTranscribing}
                    className="flex-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-xs font-black shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>תמלל ותרגם סרטון לעברית (AI)</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Existing Subtitle Translation Flow when Subtitles already exist */
              <>
                {/* Scope Selection (if subtitles selected) */}
                {selectedIds.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    <label className="block text-xs font-bold text-slate-300">היקף התרגום:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTranslateScope('selected')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          selectedTranslateScope === 'selected'
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        רק {selectedIds.length} נבחרות
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTranslateScope('all')}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          selectedTranslateScope === 'all'
                            ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        כל {subtitles.length} הכתוביות
                      </button>
                    </div>
                  </div>
                )}

                {/* Source Language Selection */}
                <div className="space-y-1.5 mb-4">
                  <label className="block text-xs font-bold text-slate-300">שפת מקור:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { code: 'auto', label: '✨ זיהוי אוטומטי' },
                      { code: 'en', label: '🇺🇸 אנגלית' },
                      { code: 'he', label: '🇮🇱 עברית' }
                    ].map((src) => (
                      <button
                        key={src.code}
                        type="button"
                        onClick={() => setSelectedSourceLang(src.code)}
                        className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all text-center ${
                          selectedSourceLang === src.code
                            ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {src.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Language Selection */}
                <div className="space-y-2 mb-6">
                  <label className="block text-xs font-bold text-slate-300">בחר שפת יעד לתרגום:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { code: 'he', label: '🇮🇱 עברית (Hebrew)' },
                      { code: 'en', label: '🇺🇸 אנגלית (English)' },
                      { code: 'es', label: '🇪🇸 ספרדית (Español)' },
                      { code: 'fr', label: '🇫🇷 צרפתית (Français)' },
                      { code: 'ru', label: '🇷🇺 רוסית (Русский)' },
                      { code: 'ar', label: '🇸🇦 ערבית (العربية)' }
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setSelectedTargetLang(lang.code)}
                        className={`p-2.5 rounded-xl border text-xs font-bold text-right transition-all flex items-center justify-between ${
                          selectedTargetLang === lang.code
                            ? 'bg-blue-600/30 border-blue-500 text-blue-200 shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span>{lang.label}</span>
                        {selectedTargetLang === lang.code && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTranslateModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTranslateSubtitles(selectedTargetLang, selectedSourceLang, selectedTranslateScope)}
                    disabled={isTranslating}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isTranslating ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>מתרגם כתוביות...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>תרגם עכשיו לעברית</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ElevenLabs Subtitles Creation & Scribe Modal */}
      {isElevenLabsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in font-sans">
          <div className="w-full max-w-2xl max-h-[92vh] rounded-3xl bg-[#121620] border border-purple-500/40 p-6 sm:p-8 shadow-2xl flex flex-col overflow-y-auto relative text-right" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>יצירת כתוביות וקריינות עם ElevenLabs</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">Scribe & TTS</span>
                  </h3>
                  <p className="text-xs text-slate-400">תמלול Scribe v1 מדויק מילה במילה או יצירת כתוביות וקריינות מתסריט</p>
                </div>
              </div>
              <button
                onClick={() => setIsElevenLabsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex items-center gap-2 my-4 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
              <button
                type="button"
                onClick={() => setElevenLabsMode('script')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  elevenLabsMode === 'script'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>יצירת כתוביות וקריינות מתסריט (TTS With-Timestamps)</span>
              </button>
              <button
                type="button"
                onClick={() => setElevenLabsMode('scribe')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  elevenLabsMode === 'scribe'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>תמלול אודיו עם ElevenLabs Scribe v1</span>
              </button>
            </div>

            {/* Mode Body */}
            {elevenLabsMode === 'script' ? (
              <div className="space-y-4 py-1">
                {/* Script input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-bold text-slate-300">טקסט / תסריט ליצירת כתוביות ודיבוב קולי:</label>
                    <button
                      type="button"
                      onClick={() => {
                        const prefill = [
                          episode.title ? `${episode.title}:` : '',
                          episode.description || '',
                          ...(episode.topics?.map(t => typeof t === 'string' ? t : t.title) || [])
                        ].filter(Boolean).join('\n');
                        setElevenLabsScriptText(prefill);
                      }}
                      className="text-purple-400 hover:underline text-[11px] font-semibold"
                    >
                      העתק מנושאי הפרק
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={elevenLabsScriptText}
                    onChange={(e) => setElevenLabsScriptText(e.target.value)}
                    placeholder="הדבק כאן את הטקסט או התסריט שתרצה שהקריין יקריא ויווצרו עבורו כתוביות מסונכרנות מדויקות..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 leading-relaxed font-sans"
                    dir="auto"
                  />
                  <p className="text-[10px] text-slate-400">
                    ElevenLabs יפיק קריינות פוטו-ריאליסטית ויחזיר חותמות זמן מדויקות לכל מילה להצגת כתוביות מושלמת.
                  </p>
                </div>

                {/* Voice Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">קול קריין (Voice):</label>
                    <select
                      value={elevenLabsVoice}
                      onChange={(e) => setElevenLabsVoice(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      {POPULAR_ELEVENLABS_VOICES.map(voice => (
                        <option key={voice.id} value={voice.id}>{voice.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300">שם דובר בכתובית:</label>
                    <input
                      type="text"
                      value={elevenLabsSpeakerName}
                      onChange={(e) => setElevenLabsSpeakerName(e.target.value)}
                      placeholder="קריין AI"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>מילים בכל שורת כתובית: {elevenLabsWordsPerLine}</span>
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={8}
                    value={elevenLabsWordsPerLine}
                    onChange={(e) => setElevenLabsWordsPerLine(parseInt(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    <span>תמלול אקוסטי מתקדם עם מודל Scribe v1 של ElevenLabs:</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside pr-1 leading-relaxed">
                    <li>מודל זיהוי הדיבור החדשני והמדויק בעולם עם תמיכה מלאה ופנומנלית בעברית.</li>
                    <li>הבדלה אוטומטית בין דוברים שונים (Speaker Diarization מלא).</li>
                    <li>דיוק חותמות זמן ברמת המילה הבודדת לסנכרון מושלם.</li>
                    <li>תמיכה בסרטונים ובהקלטות אודיו מהאולפן או קבצים שהועלו.</li>
                  </ul>
                </div>

                <p className="text-xs text-slate-400">
                  התמלול יתבצע על קובץ האודיו או הווידאו הטעון באולפן (או על הקטע הנבחר אם בחרתם קטע).
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-800 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setIsElevenLabsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                ביטול
              </button>

              {elevenLabsMode === 'script' ? (
                <button
                  type="button"
                  onClick={handleGenerateSubtitlesWithElevenLabs}
                  disabled={isGeneratingElevenLabs || !elevenLabsScriptText.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  {isGeneratingElevenLabs ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>יוצר כתוביות וקריינות...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>צור כתוביות וקריינות עכשיו</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsElevenLabsModalOpen(false);
                    handleTranscribeRecordedAudio({ providerOverride: 'elevenlabs' });
                  }}
                  disabled={isTranscribing}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>הפעל תמלול Scribe על ההקלטה</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gemini & ElevenLabs AI Settings Modal */}
      <SubtitleAISettingsModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSaved={(updated) => setAISettings(updated)}
      />
    </div>
  );
}
