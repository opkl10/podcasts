'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Episode, SubtitleItem, MovieFactCard, ElementTransform, CustomOverlayStyle, AudiogramStudioConfig, AudiogramStudioTemplate } from '@/lib/types';
import { getMediaBlob, saveMediaBlob, formatTime, getPermanentLogo, savePermanentLogo, saveEpisode } from '@/lib/storage';
import { trimAudioBlob } from '@/lib/audioUtils';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Scissors, 
  Download, 
  Save,
  Bookmark,
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
  Unlock,
  Type,
  Mic,
  User
} from 'lucide-react';
import ImageStockPickerModal from '../studio/ImageStockPickerModal';
import DraggableOverlay from '../studio/DraggableOverlay';

interface AudioEditorAudiogramStudioProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
  onUpdateEpisode?: (updated: Episode) => void;
}

export type WaveformStyle = 
  | 'bars' 
  | 'sine' 
  | 'radial' 
  | 'mirror' 
  | 'pulse' 
  | 'liquid' 
  | 'circle_bars' 
  | 'dots_matrix' 
  | 'neon_glow_wave' 
  | 'spectrum_3d';

export type WaveformColorMode = 'single' | 'gradient';
export type StudioAspectRatio = '16:9' | '9:16' | '1:1';

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

const AUDIOGRAM_PRESETS = [
  {
    id: 'gold_luxe',
    name: '🎙️ סטודיו זהב (Luxe Gold)',
    desc: 'מעגל גלי קול זהב יוקרתי, תג מגיש אלגנטי ורקע כהה',
    config: {
      bgType: 'preset' as const,
      selectedBgPreset: 'gold',
      waveformStyle: 'circle_bars' as WaveformStyle,
      waveformColorMode: 'gradient' as WaveformColorMode,
      selectedGradient: 'gold',
      waveformHeight: 110,
      waveformPosition: 'center' as const,
      hostTagStyle: 'gold_pill' as const,
      factCardStyle: 'amber_gold' as const
    }
  },
  {
    id: 'cyberpunk_wave',
    name: '⚡ סייברפאנק (Cyberpunk)',
    desc: 'גלי ניאון טורקיז ורוד עם אפקט זוהר כפול ומראה עתידני',
    config: {
      bgType: 'preset' as const,
      selectedBgPreset: 'cyberpunk',
      waveformStyle: 'neon_glow_wave' as WaveformStyle,
      waveformColorMode: 'gradient' as WaveformColorMode,
      selectedGradient: 'cyberpunk',
      waveformHeight: 120,
      waveformPosition: 'center' as const,
      hostTagStyle: 'neon_border' as const,
      factCardStyle: 'cyan_glow' as const
    }
  },
  {
    id: 'cinema_velvet',
    name: '🎬 קולנוע קלאסי (Cinema Velvet)',
    desc: 'רקע שחור עמוק, גלי סינוס קלאסיים וכרטיסיית עובדות קולנוע',
    config: {
      bgType: 'preset' as const,
      selectedBgPreset: 'cinema',
      waveformStyle: 'sine' as WaveformStyle,
      waveformColorMode: 'single' as WaveformColorMode,
      singleColor: '#f59e0b',
      waveformHeight: 90,
      waveformPosition: 'bottom' as const,
      hostTagStyle: 'dark_glass' as const,
      factCardStyle: 'amber_gold' as const
    }
  },
  {
    id: 'viral_reels',
    name: '📱 רילס וטיקטוק (Viral 9:16)',
    desc: 'פורמט אנכי 9:16 עם עמודי תדרים 3D וכתוביות מודגשות',
    config: {
      aspectRatio: '9:16' as StudioAspectRatio,
      bgType: 'preset' as const,
      selectedBgPreset: 'royal',
      waveformStyle: 'spectrum_3d' as WaveformStyle,
      waveformColorMode: 'gradient' as WaveformColorMode,
      selectedGradient: 'galaxy',
      waveformHeight: 130,
      waveformPosition: 'center' as const,
      hostTagStyle: 'gold_pill' as const,
      factCardStyle: 'cyan_glow' as const
    }
  },
  {
    id: 'retro_synth',
    name: '📺 רטרו סינת\'ווייב (Retro 80s)',
    desc: 'שקיעה ורודה-כתומה עם גלי מראה כפולים',
    config: {
      bgType: 'preset' as const,
      selectedBgPreset: 'cyberpunk',
      waveformStyle: 'mirror' as WaveformStyle,
      waveformColorMode: 'gradient' as WaveformColorMode,
      selectedGradient: 'sunset',
      waveformHeight: 100,
      waveformPosition: 'center' as const,
      hostTagStyle: 'neon_border' as const,
      factCardStyle: 'cinema_red' as const
    }
  },
  {
    id: 'clean_minimal',
    name: '🤍 מינימליזם נקי (Minimalist)',
    desc: 'מטריצת נקודות LED עדינה, רקע שחור אחיד ומראה נקי',
    config: {
      bgType: 'solid' as const,
      solidColor: '#090d16',
      waveformStyle: 'dots_matrix' as WaveformStyle,
      waveformColorMode: 'single' as WaveformColorMode,
      singleColor: '#ffffff',
      waveformHeight: 80,
      waveformPosition: 'center' as const,
      hostTagStyle: 'minimal_text' as const,
      factCardStyle: 'minimal_slate' as const
    }
  }
];

export default function AudioEditorAudiogramStudio({
  episode,
  isOpen,
  onClose,
  onUpdateEpisode
}: AudioEditorAudiogramStudioProps) {
  // Aspect Ratio & Layout
  const [aspectRatio, setAspectRatio] = useState<StudioAspectRatio>('16:9');

  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioVolume, setAudioVolume] = useState<number>(1.0);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [voiceWarmth, setVoiceWarmth] = useState<boolean>(false);

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
  const [ambientVignette, setAmbientVignette] = useState<boolean>(true);
  const bgFileInputRef = useRef<HTMLInputElement | null>(null);
  const bgImageObjectRef = useRef<HTMLImageElement | null>(null);
  const audioUploadInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadAudioFileForEditor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const blobKey = `rec_uploaded_${episode.id}_${Date.now()}`;
      await saveMediaBlob(blobKey, file);

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

      setAudioBlob(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setDuration(durationSeconds);
      setTrimEnd(durationSeconds);
      alert(`קובץ השמע "${file.name}" נטען בהצלחה לסטודיו העריכה!`);
    } catch (err: any) {
      alert('שגיאה בטעינת קובץ השמע: ' + err.message);
    }
  };

  // Permanent Logo State (loaded from storage)
  const [logoConfig, setLogoConfig] = useState<{
    show: boolean;
    showByDefault: boolean;
    url: string;
    opacity: number;
    size: number;
    positionPreset: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  }>({
    show: true,
    showByDefault: true,
    url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&q=80',
    opacity: 0.9,
    size: 100,
    positionPreset: 'top-right'
  });

  // Overlays State (Facts, Quote, Ratings, Title Banner, Host Tag, Spoiler, Poster PIP, Subtitles)
  const [hostName, setHostName] = useState<string>(episode.hostName || episode.host?.name || '');
  const [hostRole, setHostRole] = useState<string>(episode.host?.role || 'מנחה ראשי');
  const [hostTagStyle, setHostTagStyle] = useState<'gold_pill' | 'neon_border' | 'dark_glass' | 'minimal_text'>('gold_pill');
  const [showHostTag, setShowHostTag] = useState<boolean>(!!(episode.hostName || episode.host?.name));
  const [showFactOverlay, setShowFactOverlay] = useState<boolean>(true);
  const [factCardStyle, setFactCardStyle] = useState<'amber_gold' | 'cyan_glow' | 'dark_glass' | 'cinema_red' | 'minimal_slate'>('amber_gold');
  const [selectedFactIndex, setSelectedFactIndex] = useState<number>(0);
  const [showQuoteOverlay, setShowQuoteOverlay] = useState<boolean>(false);
  const [quoteCardStyle, setQuoteCardStyle] = useState<'quote_ribbon' | 'velvet_glow' | 'modern_border'>('velvet_glow');
  const [quoteText, setQuoteText] = useState<string>('״הקולנוע הוא שפה אוניברסלית של חלומות...״');
  const [quoteSpeaker, setQuoteSpeaker] = useState<string>('המנחה');
  const [showRatingOverlay, setShowRatingOverlay] = useState<boolean>(false);
  const [imdbScore, setImdbScore] = useState<string>('8.8');
  const [rottenScore, setRottenScore] = useState<string>('94%');
  const [personalScore, setPersonalScore] = useState<string>('9.2');
  const [showBannerOverlay, setShowBannerOverlay] = useState<boolean>(true);
  const [bannerSubtitle, setBannerSubtitle] = useState<string>(`CastFlow Studio • פרק ${episode.episodeNumber}`);
  const [episodeTitleText, setEpisodeTitleText] = useState<string>(episode.title);
  const [titleBannerStyle, setTitleBannerStyle] = useState<'indigo_glass' | 'gold_accent' | 'cinema_ribbon'>('indigo_glass');
  const [showSpoilerOverlay, setShowSpoilerOverlay] = useState<boolean>(false);
  const [spoilerText, setSpoilerText] = useState<string>('⚠️ זהירות: הניתוח מכיל ספוילרים קריטיים לעלילה!');
  const [showPosterPip, setShowPosterPip] = useState<boolean>(false);
  const [posterShape, setPosterShape] = useState<'rectangle' | 'rounded_square' | 'circle'>('rounded_square');
  const [posterUrl, setPosterUrl] = useState<string>('https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80');
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);

  // Active Element Selection for Free Styling Inspector
  const [selectedElementToStyle, setSelectedElementToStyle] = useState<'host' | 'fact' | 'quote' | 'banner' | 'poster' | 'rating' | 'spoiler' | 'subtitles' | 'logo' | 'waveform'>('host');

  // Full Custom Styles for Each Element (חופש עיצוב מלא לכל אלמנט)
  const [hostCustomStyle, setHostCustomStyle] = useState<CustomOverlayStyle>({
    fontFamily: 'Rubik',
    fontSize: 13,
    fontWeight: 'bold',
    textColor: '#ffffff',
    secondaryFontSize: 10,
    secondaryTextColor: '#06b6d4',
    backgroundColor: '#030712',
    backgroundOpacity: 95,
    borderColor: '#06b6d4',
    borderWidth: 1.5,
    borderRadius: 9999,
    glowColor: '#06b6d4',
    glowBlur: 0,
    padding: 10,
    textAlign: 'right'
  });

  const [factCustomStyle, setFactCustomStyle] = useState<CustomOverlayStyle>({
    fontFamily: 'Rubik',
    fontSize: 12,
    fontWeight: 'bold',
    textColor: '#ffffff',
    secondaryFontSize: 10,
    secondaryTextColor: '#f59e0b',
    backgroundColor: '#030712',
    backgroundOpacity: 95,
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 16,
    glowColor: '#f59e0b',
    glowBlur: 0,
    padding: 12,
    textAlign: 'right'
  });

  const [quoteCustomStyle, setQuoteCustomStyle] = useState<CustomOverlayStyle>({
    fontFamily: 'Assistant',
    fontSize: 14,
    fontWeight: 'bold',
    textColor: '#ffffff',
    secondaryFontSize: 11,
    secondaryTextColor: '#c084fc',
    backgroundColor: '#030712',
    backgroundOpacity: 95,
    borderColor: '#a855f7',
    borderWidth: 1.5,
    borderRadius: 16,
    glowColor: '#a855f7',
    glowBlur: 8,
    padding: 14,
    textAlign: 'center'
  });

  const [bannerCustomStyle, setBannerCustomStyle] = useState<CustomOverlayStyle>({
    fontFamily: 'Rubik',
    fontSize: 13,
    fontWeight: '900',
    textColor: '#ffffff',
    secondaryFontSize: 10,
    secondaryTextColor: '#818cf8',
    backgroundColor: '#030712',
    backgroundOpacity: 90,
    borderColor: '#6366f1',
    borderWidth: 2,
    borderRadius: 12,
    glowColor: '#6366f1',
    glowBlur: 0,
    padding: 10,
    textAlign: 'right'
  });

  const [ratingCustomStyle, setRatingCustomStyle] = useState<CustomOverlayStyle>({
    fontFamily: 'Rubik',
    fontSize: 13,
    fontWeight: 'bold',
    textColor: '#ffffff',
    secondaryFontSize: 10,
    secondaryTextColor: '#f59e0b',
    backgroundColor: '#030712',
    backgroundOpacity: 95,
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 16,
    glowColor: '#f59e0b',
    glowBlur: 0,
    padding: 10,
    textAlign: 'center'
  });

  const [spoilerCustomStyle, setSpoilerCustomStyle] = useState<CustomOverlayStyle>({
    fontFamily: 'Rubik',
    fontSize: 12,
    fontWeight: 'bold',
    textColor: '#ffffff',
    secondaryFontSize: 10,
    secondaryTextColor: '#f87171',
    backgroundColor: '#450a0a',
    backgroundOpacity: 95,
    borderColor: '#ef4444',
    borderWidth: 1.5,
    borderRadius: 12,
    glowColor: '#ef4444',
    glowBlur: 10,
    padding: 10,
    textAlign: 'center'
  });

  const [posterCustomStyle, setPosterCustomStyle] = useState<CustomOverlayStyle>({
    borderColor: '#6366f1',
    borderWidth: 2,
    borderRadius: 16,
    glowColor: '#6366f1',
    glowBlur: 12,
    backgroundOpacity: 100
  });

  const [subtitleCustomStyle, setSubtitleCustomStyle] = useState<CustomOverlayStyle>({
    fontFamily: 'Rubik',
    fontSize: 22,
    fontWeight: '900',
    textColor: '#ffffff',
    backgroundColor: '#000000',
    backgroundOpacity: 80,
    borderColor: '#facc15',
    borderWidth: 0,
    borderRadius: 12,
    glowColor: '#000000',
    glowBlur: 4,
    padding: 10,
    textAlign: 'center'
  });

  // Helper to check if currently selected element is visible
  const isCurrentElementVisible = (): boolean => {
    switch (selectedElementToStyle) {
      case 'host': return showHostTag;
      case 'fact': return showFactOverlay;
      case 'quote': return showQuoteOverlay;
      case 'banner': return showBannerOverlay;
      case 'poster': return showPosterPip;
      case 'rating': return showRatingOverlay;
      case 'spoiler': return showSpoilerOverlay;
      case 'subtitles': return showSubtitles;
      case 'logo': return logoConfig.show;
      default: return true;
    }
  };

  // Helper to toggle visibility of currently selected element
  const toggleCurrentElementVisibility = (override?: boolean) => {
    switch (selectedElementToStyle) {
      case 'host': setShowHostTag(prev => override !== undefined ? override : !prev); break;
      case 'fact': setShowFactOverlay(prev => override !== undefined ? override : !prev); break;
      case 'quote': setShowQuoteOverlay(prev => override !== undefined ? override : !prev); break;
      case 'banner': setShowBannerOverlay(prev => override !== undefined ? override : !prev); break;
      case 'poster': setShowPosterPip(prev => override !== undefined ? override : !prev); break;
      case 'rating': setShowRatingOverlay(prev => override !== undefined ? override : !prev); break;
      case 'spoiler': setShowSpoilerOverlay(prev => override !== undefined ? override : !prev); break;
      case 'subtitles': setShowSubtitles(prev => override !== undefined ? override : !prev); break;
      case 'logo': setLogoConfig(prev => ({ ...prev, show: override !== undefined ? override : !prev.show })); break;
    }
  };

  // Helper to get active style
  const getCurrentElementStyle = (): CustomOverlayStyle => {
    switch (selectedElementToStyle) {
      case 'host': return hostCustomStyle;
      case 'fact': return factCustomStyle;
      case 'quote': return quoteCustomStyle;
      case 'banner': return bannerCustomStyle;
      case 'poster': return posterCustomStyle;
      case 'rating': return ratingCustomStyle;
      case 'spoiler': return spoilerCustomStyle;
      case 'subtitles': return subtitleCustomStyle;
      default: return hostCustomStyle;
    }
  };

  // Helper to update active style
  const updateCurrentElementStyle = (patch: Partial<CustomOverlayStyle>) => {
    switch (selectedElementToStyle) {
      case 'host': setHostCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
      case 'fact': setFactCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
      case 'quote': setQuoteCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
      case 'banner': setBannerCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
      case 'poster': setPosterCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
      case 'rating': setRatingCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
      case 'spoiler': setSpoilerCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
      case 'subtitles': setSubtitleCustomStyle((prev: CustomOverlayStyle) => ({ ...prev, ...patch })); break;
    }
  };

  // Color to RGBA string helper
  const hexToRgba = (hex: string = '#000000', opacityPct: number = 100) => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.substring(0, 2) || '0', 16);
    const g = parseInt(cleanHex.substring(2, 4) || '0', 16);
    const b = parseInt(cleanHex.substring(4, 6) || '0', 16);
    const a = Math.max(0, Math.min(1, (opacityPct ?? 100) / 100));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  // Apply Full Studio Design Preset
  const handleApplyStudioPreset = (preset: typeof AUDIOGRAM_PRESETS[0]) => {
    if (preset.config.aspectRatio) setAspectRatio(preset.config.aspectRatio);
    if (preset.config.bgType) setBgType(preset.config.bgType);
    if (preset.config.selectedBgPreset) setSelectedBgPreset(preset.config.selectedBgPreset);
    if (preset.config.solidColor) setSolidColor(preset.config.solidColor);
    if (preset.config.waveformStyle) setWaveformStyle(preset.config.waveformStyle);
    if (preset.config.waveformColorMode) setWaveformColorMode(preset.config.waveformColorMode);
    if (preset.config.selectedGradient) setSelectedGradient(preset.config.selectedGradient);
    if (preset.config.singleColor) setSingleColor(preset.config.singleColor);
    if (preset.config.waveformHeight) setWaveformHeight(preset.config.waveformHeight);
    if (preset.config.waveformPosition) setWaveformPosition(preset.config.waveformPosition);
    if (preset.config.hostTagStyle) setHostTagStyle(preset.config.hostTagStyle);
    if (preset.config.factCardStyle) setFactCardStyle(preset.config.factCardStyle);
    alert(`סגנון "${preset.name}" הוחל בהצלחה על כל מרכיבי הסטודיו!`);
  };

  // Drag & Transform States for Overlays (גרירה ושינוי גודל)
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [logoTransform, setLogoTransform] = useState<ElementTransform>({ x: 80, y: 5, scale: 1.0 });
  const [hostTransform, setHostTransform] = useState<ElementTransform>({ x: 70, y: 15, scale: 1.0 });
  const [factTransform, setFactTransform] = useState<ElementTransform>({ x: 5, y: 8, scale: 1.0 });
  const [quoteTransform, setQuoteTransform] = useState<ElementTransform>({ x: 25, y: 65, scale: 1.0 });
  const [bannerTransform, setBannerTransform] = useState<ElementTransform>({ x: 65, y: 78, scale: 1.0 });
  const [ratingTransform, setRatingTransform] = useState<ElementTransform>({ x: 20, y: 75, scale: 1.0 });
  const [spoilerTransform, setSpoilerTransform] = useState<ElementTransform>({ x: 25, y: 15, scale: 1.0 });
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

  // Export Format & Resolution State
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('mp4');
  const [exportResolution, setExportResolution] = useState<'1080p' | '720p' | '4k'>('1080p');

  // Tabs
  const [activeTab, setActiveTab] = useState<'styler' | 'waveform' | 'background' | 'overlays' | 'trimmer' | 'export'>('styler');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockPickerTarget, setStockPickerTarget] = useState<'background' | 'poster' | 'logo'>('poster');

  // DOM & Audio Nodes Refs
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const posterFileInputRef = useRef<HTMLInputElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 720, height: 405 });

  // Track live stage viewport dimensions for exact 1:1 pixel-perfect canvas export ratio
  useEffect(() => {
    if (!stageContainerRef.current) return;
    const updateSize = () => {
      if (stageContainerRef.current) {
        const rect = stageContainerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setStageSize({ width: rect.width, height: rect.height });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(stageContainerRef.current);
    return () => ro.disconnect();
  }, [isOpen, aspectRatio]);

  const handlePosterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setPosterUrl(dataUrl);
        setShowPosterPip(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const movieFacts = episode.movieFacts || [];
  const currentFact = movieFacts[selectedFactIndex] || movieFacts[0] || null;
  const activeSubtitle = (episode.subtitles || []).find(s => currentTime >= s.startTime && currentTime <= s.endTime);

  // Saved Studio Configurations & Custom Presets / Templates
  const [customTemplates, setCustomTemplates] = useState<AudiogramStudioTemplate[]>([]);
  const [isNewTemplateModalOpen, setIsNewTemplateModalOpen] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [isSaveSuccess, setIsSaveSuccess] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Load custom templates from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('audiogram_studio_custom_templates_v1');
      if (raw) {
        setCustomTemplates(JSON.parse(raw));
      }
    } catch (e) {}
  }, []);

  // Load Saved Episode Studio Configuration on Open
  useEffect(() => {
    if (!isOpen) return;
    try {
      const savedConfigStr = localStorage.getItem(`audiogram_studio_ep_${episode.id}`);
      const config: AudiogramStudioConfig | null = (episode as any).audiogramStudioConfig || (savedConfigStr ? JSON.parse(savedConfigStr) : null);
      
      if (config) {
        if (config.aspectRatio) setAspectRatio(config.aspectRatio);
        if (config.bgType) setBgType(config.bgType);
        if (config.selectedBgPreset) setSelectedBgPreset(config.selectedBgPreset);
        if (config.customBgImage !== undefined) setCustomBgImage(config.customBgImage);
        if (config.bgDim !== undefined) setBgDim(config.bgDim);
        if (config.solidColor) setSolidColor(config.solidColor);
        if (config.ambientVignette !== undefined) setAmbientVignette(config.ambientVignette);

        if (config.waveformStyle) setWaveformStyle(config.waveformStyle as any);
        if (config.waveformColorMode) setWaveformColorMode(config.waveformColorMode);
        if (config.singleColor) setSingleColor(config.singleColor);
        if (config.selectedGradient) setSelectedGradient(config.selectedGradient);
        if (config.customGradStart) setCustomGradStart(config.customGradStart);
        if (config.customGradEnd) setCustomGradEnd(config.customGradEnd);
        if (config.waveformPosition) setWaveformPosition(config.waveformPosition as any);
        if (config.waveformHeight !== undefined) setWaveformHeight(config.waveformHeight);
        if (config.waveformSensitivity !== undefined) setWaveformSensitivity(config.waveformSensitivity);

        if (config.trimStart !== undefined) setTrimStart(config.trimStart);
        if (config.trimEnd !== undefined && config.trimEnd > 0) setTrimEnd(config.trimEnd);

        if (config.showLogo !== undefined) setLogoConfig(prev => ({ ...prev, show: config.showLogo ?? prev.show, url: config.logoUrl || prev.url, size: config.logoSize || prev.size, opacity: config.logoOpacity ?? prev.opacity }));
        if (config.logoTransform) setLogoTransform(config.logoTransform);

        if (config.showHostTag !== undefined) setShowHostTag(config.showHostTag);
        if (config.hostName) setHostName(config.hostName);
        if (config.hostRole) setHostRole(config.hostRole);
        if (config.hostTransform) setHostTransform(config.hostTransform);
        if (config.hostCustomStyle) setHostCustomStyle(config.hostCustomStyle);

        if (config.showFactOverlay !== undefined) setShowFactOverlay(config.showFactOverlay);
        if (config.factTransform) setFactTransform(config.factTransform);
        if (config.factCustomStyle) setFactCustomStyle(config.factCustomStyle);

        if (config.showQuoteOverlay !== undefined) setShowQuoteOverlay(config.showQuoteOverlay);
        if (config.quoteText) setQuoteText(config.quoteText);
        if (config.quoteSpeaker) setQuoteSpeaker(config.quoteSpeaker);
        if (config.quoteTransform) setQuoteTransform(config.quoteTransform);
        if (config.quoteCustomStyle) setQuoteCustomStyle(config.quoteCustomStyle);

        if (config.showBannerOverlay !== undefined) setShowBannerOverlay(config.showBannerOverlay);
        if (config.bannerSubtitle) setBannerSubtitle(config.bannerSubtitle);
        if (config.episodeTitleText) setEpisodeTitleText(config.episodeTitleText);
        if (config.bannerTransform) setBannerTransform(config.bannerTransform);
        if (config.bannerCustomStyle) setBannerCustomStyle(config.bannerCustomStyle);

        if (config.showRatingOverlay !== undefined) setShowRatingOverlay(config.showRatingOverlay);
        if (config.imdbScore) setImdbScore(config.imdbScore);
        if (config.rottenScore) setRottenScore(config.rottenScore);
        if (config.personalScore) setPersonalScore(config.personalScore);
        if (config.ratingTransform) setRatingTransform(config.ratingTransform);
        if (config.ratingCustomStyle) setRatingCustomStyle(config.ratingCustomStyle);

        if (config.showSpoilerOverlay !== undefined) setShowSpoilerOverlay(config.showSpoilerOverlay);
        if (config.spoilerText) setSpoilerText(config.spoilerText);
        if (config.spoilerTransform) setSpoilerTransform(config.spoilerTransform);
        if (config.spoilerCustomStyle) setSpoilerCustomStyle(config.spoilerCustomStyle);

        if (config.showPosterPip !== undefined) setShowPosterPip(config.showPosterPip);
        if (config.posterUrl) setPosterUrl(config.posterUrl);
        if (config.posterShape) setPosterShape(config.posterShape);
        if (config.posterTransform) setPosterTransform(config.posterTransform);
        if (config.posterCustomStyle) setPosterCustomStyle(config.posterCustomStyle);

        if (config.showSubtitles !== undefined) setShowSubtitles(config.showSubtitles);
        if (config.subtitleTransform) setSubtitleTransform(config.subtitleTransform);
        if (config.subtitleCustomStyle) setSubtitleCustomStyle(config.subtitleCustomStyle);
      }
    } catch (e) {
      console.error('Error loading saved audiogram studio config:', e);
    }
  }, [isOpen, episode.id]);

  const buildCurrentStudioConfig = (): AudiogramStudioConfig => ({
    aspectRatio,
    bgType,
    selectedBgPreset,
    customBgImage,
    bgDim,
    solidColor,
    ambientVignette,

    waveformStyle,
    waveformColorMode,
    singleColor,
    selectedGradient,
    customGradStart,
    customGradEnd,
    waveformPosition,
    waveformCustomY: 50,
    waveformHeight,
    waveformSensitivity,

    trimStart,
    trimEnd,

    showLogo: logoConfig.show,
    logoUrl: logoConfig.url,
    logoSize: logoConfig.size,
    logoOpacity: logoConfig.opacity,
    logoTransform,

    showHostTag,
    hostName,
    hostRole,
    hostTransform,
    hostCustomStyle,

    showFactOverlay,
    factTransform,
    factCustomStyle,

    showQuoteOverlay,
    quoteText,
    quoteSpeaker,
    quoteTransform,
    quoteCustomStyle,

    showBannerOverlay,
    bannerSubtitle,
    episodeTitleText,
    bannerTransform,
    bannerCustomStyle,

    showRatingOverlay,
    imdbScore,
    rottenScore,
    personalScore,
    ratingTransform,
    ratingCustomStyle,

    showSpoilerOverlay,
    spoilerText,
    spoilerTransform,
    spoilerCustomStyle,

    showPosterPip,
    posterUrl,
    posterShape,
    posterTransform,
    posterCustomStyle,

    showSubtitles,
    subtitleTransform,
    subtitleCustomStyle,

    savedAt: new Date().toISOString()
  });

  const handleSaveStudioConfig = () => {
    try {
      const config = buildCurrentStudioConfig();
      localStorage.setItem(`audiogram_studio_ep_${episode.id}`, JSON.stringify(config));
      
      const updated: Episode = {
        ...episode,
        audiogramStudioConfig: config
      };
      saveEpisode(updated);
      if (onUpdateEpisode) onUpdateEpisode(updated);

      setIsSaveSuccess(true);
      setSaveMessage('כל הגדרות העיצוב, המיקומים והצבעים נשמרו בהצלחה בפרק!');
      setTimeout(() => setIsSaveSuccess(false), 3500);
    } catch (e: any) {
      alert('שגיאה בשמירת הגדרות הסטודיו: ' + e.message);
    }
  };

  const handleSaveAsTemplate = (tplName: string) => {
    if (!tplName.trim()) return;
    try {
      const config = buildCurrentStudioConfig();
      const newTemplate: AudiogramStudioTemplate = {
        id: `tpl_${Date.now()}`,
        name: tplName.trim(),
        createdAt: new Date().toISOString(),
        config
      };
      const updatedList = [newTemplate, ...customTemplates];
      setCustomTemplates(updatedList);
      localStorage.setItem('audiogram_studio_custom_templates_v1', JSON.stringify(updatedList));
      setIsNewTemplateModalOpen(false);
      setNewTemplateName('');
      setIsSaveSuccess(true);
      setSaveMessage(`התבנית "${tplName}" נשמרה בהצלחה במאגר התבניות שלך!`);
      setTimeout(() => setIsSaveSuccess(false), 3500);
    } catch (e: any) {
      alert('שגיאה בשמירת התבנית: ' + e.message);
    }
  };

  const handleApplyTemplate = (tpl: AudiogramStudioTemplate) => {
    try {
      const config = tpl.config;
      if (config.aspectRatio) setAspectRatio(config.aspectRatio);
      if (config.bgType) setBgType(config.bgType);
      if (config.selectedBgPreset) setSelectedBgPreset(config.selectedBgPreset);
      if (config.customBgImage !== undefined) setCustomBgImage(config.customBgImage);
      if (config.bgDim !== undefined) setBgDim(config.bgDim);
      if (config.solidColor) setSolidColor(config.solidColor);
      if (config.ambientVignette !== undefined) setAmbientVignette(config.ambientVignette);

      if (config.waveformStyle) setWaveformStyle(config.waveformStyle as any);
      if (config.waveformColorMode) setWaveformColorMode(config.waveformColorMode);
      if (config.singleColor) setSingleColor(config.singleColor);
      if (config.selectedGradient) setSelectedGradient(config.selectedGradient);
      if (config.customGradStart) setCustomGradStart(config.customGradStart);
      if (config.customGradEnd) setCustomGradEnd(config.customGradEnd);
      if (config.waveformPosition) setWaveformPosition(config.waveformPosition as any);
      if (config.waveformHeight !== undefined) setWaveformHeight(config.waveformHeight);
      if (config.waveformSensitivity !== undefined) setWaveformSensitivity(config.waveformSensitivity);

      if (config.showLogo !== undefined) setLogoConfig(prev => ({ ...prev, show: config.showLogo ?? prev.show, url: config.logoUrl || prev.url, size: config.logoSize || prev.size, opacity: config.logoOpacity ?? prev.opacity }));
      if (config.logoTransform) setLogoTransform(config.logoTransform);

      if (config.showHostTag !== undefined) setShowHostTag(config.showHostTag);
      if (config.hostTransform) setHostTransform(config.hostTransform);
      if (config.hostCustomStyle) setHostCustomStyle(config.hostCustomStyle);

      if (config.showFactOverlay !== undefined) setShowFactOverlay(config.showFactOverlay);
      if (config.factTransform) setFactTransform(config.factTransform);
      if (config.factCustomStyle) setFactCustomStyle(config.factCustomStyle);

      if (config.showQuoteOverlay !== undefined) setShowQuoteOverlay(config.showQuoteOverlay);
      if (config.quoteTransform) setQuoteTransform(config.quoteTransform);
      if (config.quoteCustomStyle) setQuoteCustomStyle(config.quoteCustomStyle);

      if (config.showBannerOverlay !== undefined) setShowBannerOverlay(config.showBannerOverlay);
      if (config.bannerTransform) setBannerTransform(config.bannerTransform);
      if (config.bannerCustomStyle) setBannerCustomStyle(config.bannerCustomStyle);

      if (config.showRatingOverlay !== undefined) setShowRatingOverlay(config.showRatingOverlay);
      if (config.ratingTransform) setRatingTransform(config.ratingTransform);
      if (config.ratingCustomStyle) setRatingCustomStyle(config.ratingCustomStyle);

      if (config.showSpoilerOverlay !== undefined) setShowSpoilerOverlay(config.showSpoilerOverlay);
      if (config.spoilerTransform) setSpoilerTransform(config.spoilerTransform);
      if (config.spoilerCustomStyle) setSpoilerCustomStyle(config.spoilerCustomStyle);

      if (config.showPosterPip !== undefined) setShowPosterPip(config.showPosterPip);
      if (config.posterShape) setPosterShape(config.posterShape);
      if (config.posterTransform) setPosterTransform(config.posterTransform);
      if (config.posterCustomStyle) setPosterCustomStyle(config.posterCustomStyle);

      if (config.showSubtitles !== undefined) setShowSubtitles(config.showSubtitles);
      if (config.subtitleTransform) setSubtitleTransform(config.subtitleTransform);
      if (config.subtitleCustomStyle) setSubtitleCustomStyle(config.subtitleCustomStyle);

      setIsSaveSuccess(true);
      setSaveMessage(`התבנית "${tpl.name}" הוחלה בהצלחה על כל מרכיבי הסטודיו!`);
      setTimeout(() => setIsSaveSuccess(false), 3500);
    } catch (e: any) {
      alert('שגיאה בהחלת התבנית: ' + e.message);
    }
  };

  const handleDeleteTemplate = (tplId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('האם למחוק תבנית זו?')) return;
    const updatedList = customTemplates.filter(t => t.id !== tplId);
    setCustomTemplates(updatedList);
    localStorage.setItem('audiogram_studio_custom_templates_v1', JSON.stringify(updatedList));
  };

  // 1. Initialize Audio Source & Permanent Logo on Open
  useEffect(() => {
    if (!isOpen) return;

    // Load Permanent Logo
    const savedLogo = getPermanentLogo(episode.podcastId);
    if (savedLogo) {
      setLogoConfig({
        show: savedLogo.showByDefault ?? true,
        showByDefault: savedLogo.showByDefault ?? true,
        url: savedLogo.url,
        opacity: savedLogo.opacity ?? 0.9,
        size: savedLogo.size ?? 100,
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

      // Connect source to analyser for dynamic visualizer, and connect analyser to audio destination (speakers) for full sound playback!
      source.connect(analyser);
      analyser.connect(ctx.destination);
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

  const posterImageObjectRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    if (posterUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = posterUrl;
      img.onload = () => {
        posterImageObjectRef.current = img;
      };
    } else {
      posterImageObjectRef.current = null;
    }
  }, [posterUrl]);

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

      // Enable High-Quality Smoothing for crisp Retina images and logos
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

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

      // 7. CIRCLE BARS (Radial Radiating Podcast Ring)
      else if (waveformStyle === 'circle_bars') {
        const cx = W / 2;
        const cy = waveCenterY;
        const baseRadius = aspectRatio === '9:16' ? 95 : 80;
        const barCount = 48;

        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2;
          const rawVal = freqArray[i % freqArray.length] || 15;
          const barLen = Math.max(8, (rawVal / 255) * (waveformHeight * 0.7) * waveformSensitivity);

          const x1 = cx + Math.cos(angle) * baseRadius;
          const y1 = cy + Math.sin(angle) * baseRadius;
          const x2 = cx + Math.cos(angle) * (baseRadius + barLen);
          const y2 = cy + Math.sin(angle) * (baseRadius + barLen);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = waveFill;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        // Inner glowing core ring
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius - 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 15, 28, 0.85)';
        ctx.fill();
        ctx.strokeStyle = waveFill;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 8. DOTS MATRIX (Futuristic LED Matrix Array)
      else if (waveformStyle === 'dots_matrix') {
        const cols = 36;
        const rows = 8;
        const dotRadius = 3;
        const startX = W * 0.2;
        const colWidth = (W * 0.6) / cols;

        for (let c = 0; c < cols; c++) {
          const rawVal = freqArray[c % freqArray.length] || 10;
          const activeRows = Math.floor((rawVal / 255) * rows * waveformSensitivity);

          for (let r = 0; r < rows; r++) {
            const x = startX + c * colWidth;
            const y = waveCenterY + (rows / 2 - r) * 11;

            ctx.beginPath();
            ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            ctx.fillStyle = r <= activeRows ? waveFill : 'rgba(255, 255, 255, 0.08)';
            ctx.fill();
          }
        }
      }

      // 9. NEON GLOW WAVE (Double Neon Sine Wave with Bloom)
      else if (waveformStyle === 'neon_glow_wave') {
        ctx.strokeStyle = waveFill;
        ctx.lineWidth = 4;
        ctx.shadowColor = typeof waveFill === 'string' ? waveFill : '#06b6d4';
        ctx.shadowBlur = 18;
        ctx.beginPath();

        const points = 60;
        const step = (W * 0.7) / points;
        const startX = W * 0.15;

        for (let i = 0; i < points; i++) {
          const rawVal = ((timeArray[i * 2] || 128) - 128) / 128;
          const y = waveCenterY + rawVal * (waveformHeight * 0.75) * waveformSensitivity;
          const x = startX + i * step;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Secondary Harmonic Wave
        ctx.beginPath();
        for (let i = 0; i < points; i++) {
          const rawVal = ((timeArray[(i * 3) % timeArray.length] || 128) - 128) / 128;
          const y = waveCenterY - rawVal * (waveformHeight * 0.45) * waveformSensitivity;
          const x = startX + i * step;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 10. SPECTRUM 3D (Reflective 3D Glass Equalizer Bars)
      else if (waveformStyle === 'spectrum_3d') {
        const barCount = 36;
        const barWidth = (W * 0.6) / barCount;
        const startX = W * 0.2;

        for (let i = 0; i < barCount; i++) {
          const rawVal = freqArray[i * 2] || 10;
          const height = Math.max(6, (rawVal / 255) * waveformHeight * waveformSensitivity);
          const x = startX + i * barWidth;

          // Main Top Bar
          ctx.fillStyle = waveFill;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, waveCenterY - height, barWidth - 3, height, [4, 4, 0, 0]);
          else ctx.rect(x, waveCenterY - height, barWidth - 3, height);
          ctx.fill();

          // Mirror Reflection Lower Bar
          ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, waveCenterY + 2, barWidth - 3, height * 0.35, [0, 0, 4, 4]);
          else ctx.rect(x, waveCenterY + 2, barWidth - 3, height * 0.35);
          ctx.fill();
        }
      }

      // Ambient Vignette Effect
      if (ambientVignette) {
        const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.75);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
      }

      // E. DRAW OVERLAYS ON CANVAS ONLY DURING VIDEO EXPORT (Prevents duplicate double-layer ghosting in editor view)
      if (isExportingVideo) {
        // High-DPI / Full HD Resolution scale factor calibrated 1:1 with the live stage editor viewport
        const resScale = stageSize.width > 0 ? (W / stageSize.width) : Math.max(1.0, W / 720);

        // 1. Logo Overlay (Preserves Natural Aspect Ratio - NO Distorting Squish)
        if (logoConfig.show && logoImageObjectRef.current) {
          try {
            ctx.save();
            const lx = (logoTransform.x / 100) * W;
            const ly = (logoTransform.y / 100) * H;
            const lScale = (logoTransform.scale || 1.0) * resScale;
            ctx.translate(lx, ly);
            ctx.scale(lScale, lScale);
            ctx.globalAlpha = logoConfig.opacity || 0.9;

            const baseSize = logoConfig.size || 80;
            const img = logoImageObjectRef.current;
            const aspect = (img.naturalWidth && img.naturalHeight)
              ? img.naturalWidth / img.naturalHeight
              : 1;

            let lw = baseSize;
            let lh = baseSize;
            if (aspect >= 1) {
              lh = baseSize / aspect;
            } else {
              lw = baseSize * aspect;
            }
            ctx.drawImage(img, 0, 0, lw, lh);
            ctx.restore();
          } catch (e) {}
        }

        // 2. Host Tag Badge (Dynamic sizing, icon circle, auto-fitting text)
        if (showHostTag && hostName) {
          try {
            ctx.save();
            const hx = (hostTransform.x / 100) * W;
            const hy = (hostTransform.y / 100) * H;
            const hScale = (hostTransform.scale || 1.0) * resScale;
            ctx.translate(hx, hy);
            ctx.scale(hScale, hScale);

            const nameFontSize = hostCustomStyle.fontSize || 13;
            const roleFontSize = hostCustomStyle.secondaryFontSize || 10;
            const fontFamily = hostCustomStyle.fontFamily || 'Rubik, sans-serif';

            ctx.font = `${hostCustomStyle.fontWeight || 'bold'} ${nameFontSize}px ${fontFamily}`;
            const nameW = ctx.measureText(hostName).width;
            ctx.font = `500 ${roleFontSize}px ${fontFamily}`;
            const roleW = hostRole ? ctx.measureText(hostRole).width : 0;

            const padX = 14;
            const padY = hostCustomStyle.padding || 8;
            const iconSize = 22;
            const textW = Math.max(nameW, roleW);
            const totalW = textW + iconSize + padX * 2 + 10;
            const totalH = Math.max(iconSize + padY * 2, nameFontSize + (hostRole ? roleFontSize + 4 : 0) + padY * 2 + 4);

            const bgRgba = hexToRgba(hostCustomStyle.backgroundColor || '#030712', hostCustomStyle.backgroundOpacity ?? 95);
            ctx.fillStyle = bgRgba;
            ctx.strokeStyle = hostCustomStyle.borderColor || '#06b6d4';
            ctx.lineWidth = hostCustomStyle.borderWidth ?? 1.5;

            if ((hostCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = hostCustomStyle.glowColor || '#06b6d4';
              ctx.shadowBlur = hostCustomStyle.glowBlur || 0;
            }

            const hRadius = hostCustomStyle.borderRadius ?? 9999;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, totalW, totalH, Math.min(totalH / 2, hRadius));
            else ctx.rect(0, 0, totalW, totalH);
            ctx.fill();
            if ((hostCustomStyle.borderWidth ?? 0) > 0) ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw Mic Icon Circle
            ctx.fillStyle = `${hostCustomStyle.borderColor || '#06b6d4'}33`;
            ctx.beginPath();
            ctx.arc(totalW - padX - iconSize / 2, totalH / 2, iconSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = hostCustomStyle.borderColor || '#06b6d4';
            ctx.font = `bold 10px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎙️', totalW - padX - iconSize / 2, totalH / 2);

            // Draw Host Name & Role Text
            const textRightX = totalW - padX - iconSize - 8;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = hostCustomStyle.textColor || '#ffffff';
            ctx.font = `${hostCustomStyle.fontWeight || 'bold'} ${nameFontSize}px ${fontFamily}`;

            if (hostRole) {
              ctx.fillText(hostName, textRightX, padY + nameFontSize);
              ctx.fillStyle = hostCustomStyle.secondaryTextColor || hostCustomStyle.borderColor || '#06b6d4';
              ctx.font = `500 ${roleFontSize}px ${fontFamily}`;
              ctx.fillText(hostRole, textRightX, padY + nameFontSize + roleFontSize + 4);
            } else {
              ctx.fillText(hostName, textRightX, totalH / 2 + nameFontSize / 3);
            }
            ctx.restore();
          } catch (e) {}
        }

        // 3. Fact Card Overlay (Multi-line word wrap & auto card sizing)
        if (showFactOverlay && currentFact) {
          try {
            ctx.save();
            const fx = (factTransform.x / 100) * W;
            const fy = (factTransform.y / 100) * H;
            const fScale = (factTransform.scale || 1.0) * resScale;
            ctx.translate(fx, fy);
            ctx.scale(fScale, fScale);

            const fFontSize = factCustomStyle.fontSize || 12;
            const fSubFontSize = factCustomStyle.secondaryFontSize || 9;
            const fPad = factCustomStyle.padding || 12;
            const fCardW = 280;
            const fontFamily = factCustomStyle.fontFamily || 'Rubik, sans-serif';

            // Word wrap
            ctx.font = `${factCustomStyle.fontWeight || 'bold'} ${fFontSize}px ${fontFamily}`;
            const words = currentFact.fact.split(' ');
            const lines: string[] = [];
            let cur = '';
            for (const w of words) {
              const test = cur ? `${cur} ${w}` : w;
              if (ctx.measureText(test).width > fCardW - fPad * 2) {
                if (cur) lines.push(cur);
                cur = w;
                if (lines.length >= 3) break;
              } else {
                cur = test;
              }
            }
            if (cur && lines.length < 3) lines.push(cur);

            const fBadgeH = fSubFontSize + 6;
            const fCardH = fPad * 2 + fBadgeH + 8 + lines.length * (fFontSize + 4);

            const fBg = hexToRgba(factCustomStyle.backgroundColor || '#030712', factCustomStyle.backgroundOpacity ?? 95);
            ctx.fillStyle = fBg;
            ctx.strokeStyle = factCustomStyle.borderColor || '#f59e0b';
            ctx.lineWidth = factCustomStyle.borderWidth ?? 1.5;

            if ((factCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = factCustomStyle.glowColor || '#f59e0b';
              ctx.shadowBlur = factCustomStyle.glowBlur || 0;
            }

            const fRadius = factCustomStyle.borderRadius ?? 16;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, fCardW, fCardH, Math.min(fCardH / 2, fRadius));
            else ctx.rect(0, 0, fCardW, fCardH);
            ctx.fill();
            if ((factCustomStyle.borderWidth ?? 0) > 0) ctx.stroke();
            ctx.shadowBlur = 0;

            // Source Badge
            ctx.fillStyle = factCustomStyle.borderColor || '#f59e0b';
            ctx.font = `bold ${fSubFontSize}px ${fontFamily}`;
            const badgeW = ctx.measureText(currentFact.source).width + 12;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(fCardW - fPad - badgeW, fPad, badgeW, fBadgeH, 4);
            else ctx.rect(fCardW - fPad - badgeW, fPad, badgeW, fBadgeH);
            ctx.fill();

            ctx.fillStyle = '#030712';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentFact.source, fCardW - fPad - badgeW / 2, fPad + fBadgeH / 2);

            // Rating if present
            if (currentFact.ratingScore) {
              ctx.fillStyle = factCustomStyle.secondaryTextColor || factCustomStyle.borderColor || '#f59e0b';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.font = `bold ${fSubFontSize + 1}px ${fontFamily}`;
              ctx.fillText(`⭐ ${currentFact.ratingScore}`, fPad, fPad + fBadgeH / 2);
            }

            // Body text lines
            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = factCustomStyle.textColor || '#ffffff';
            ctx.font = `${factCustomStyle.fontWeight || 'bold'} ${fFontSize}px ${fontFamily}`;
            let lineY = fPad + fBadgeH + 8 + fFontSize;
            for (const l of lines) {
              ctx.fillText(l, fCardW - fPad, lineY);
              lineY += fFontSize + 4;
            }
            ctx.restore();
          } catch (e) {}
        }

        // 4. Quote Card Overlay
        if (showQuoteOverlay && quoteText) {
          try {
            ctx.save();
            const qx = (quoteTransform.x / 100) * W;
            const qy = (quoteTransform.y / 100) * H;
            const qScale = (quoteTransform.scale || 1.0) * resScale;
            ctx.translate(qx, qy);
            ctx.scale(qScale, qScale);

            const qFontSize = quoteCustomStyle.fontSize || 14;
            const qSubFontSize = quoteCustomStyle.secondaryFontSize || 10;
            const qPad = quoteCustomStyle.padding || 14;
            const fontFamily = quoteCustomStyle.fontFamily || 'Assistant, sans-serif';

            ctx.font = `italic ${quoteCustomStyle.fontWeight || 'bold'} ${qFontSize}px ${fontFamily}`;
            const qTextW = ctx.measureText(quoteText).width;
            const qSpeakerW = quoteSpeaker ? ctx.measureText(`— ${quoteSpeaker}`).width : 0;
            const qCardW = Math.min(380, Math.max(220, Math.max(qTextW, qSpeakerW) + qPad * 2));

            // Word wrap
            const qWords = quoteText.split(' ');
            const qLines: string[] = [];
            let qCur = '';
            for (const w of qWords) {
              const test = qCur ? `${qCur} ${w}` : w;
              if (ctx.measureText(test).width > qCardW - qPad * 2) {
                if (qCur) qLines.push(qCur);
                qCur = w;
              } else {
                qCur = test;
              }
            }
            if (qCur) qLines.push(qCur);

            const qCardH = qPad * 2 + qLines.length * (qFontSize + 4) + (quoteSpeaker ? qSubFontSize + 6 : 0);

            const qBg = hexToRgba(quoteCustomStyle.backgroundColor || '#030712', quoteCustomStyle.backgroundOpacity ?? 95);
            ctx.fillStyle = qBg;
            ctx.strokeStyle = quoteCustomStyle.borderColor || '#a855f7';
            ctx.lineWidth = quoteCustomStyle.borderWidth ?? 1.5;

            if ((quoteCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = quoteCustomStyle.glowColor || '#a855f7';
              ctx.shadowBlur = quoteCustomStyle.glowBlur || 0;
            }

            const qRadius = quoteCustomStyle.borderRadius ?? 16;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, qCardW, qCardH, Math.min(qCardH / 2, qRadius));
            else ctx.rect(0, 0, qCardW, qCardH);
            ctx.fill();
            if ((quoteCustomStyle.borderWidth ?? 0) > 0) ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = quoteCustomStyle.textColor || '#ffffff';
            ctx.font = `italic ${quoteCustomStyle.fontWeight || 'bold'} ${qFontSize}px ${fontFamily}`;
            let qY = qPad + qFontSize;
            for (const l of qLines) {
              ctx.fillText(l, qCardW / 2, qY);
              qY += qFontSize + 4;
            }
            if (quoteSpeaker) {
              ctx.fillStyle = quoteCustomStyle.secondaryTextColor || quoteCustomStyle.borderColor || '#c084fc';
              ctx.font = `600 ${qSubFontSize}px ${fontFamily}`;
              ctx.fillText(`— ${quoteSpeaker}`, qCardW / 2, qY + 2);
            }
            ctx.restore();
          } catch (e) {}
        }

        // 5. Lower-Third / Title Banner
        if (showBannerOverlay) {
          try {
            ctx.save();
            const bx = (bannerTransform.x / 100) * W;
            const by = (bannerTransform.y / 100) * H;
            const bScale = (bannerTransform.scale || 1.0) * resScale;
            ctx.translate(bx, by);
            ctx.scale(bScale, bScale);

            const titleFontSize = bannerCustomStyle.fontSize || 13;
            const subFontSize = bannerCustomStyle.secondaryFontSize || 9;
            const fontFamily = bannerCustomStyle.fontFamily || 'Rubik, sans-serif';

            ctx.font = `${bannerCustomStyle.fontWeight || '900'} ${titleFontSize}px ${fontFamily}`;
            const titleW = ctx.measureText(episodeTitleText).width;
            ctx.font = `bold ${subFontSize}px ${fontFamily}`;
            const subW = ctx.measureText(bannerSubtitle).width;

            const bPadX = 14;
            const bPadY = bannerCustomStyle.padding || 10;
            const bTotalW = Math.max(160, Math.max(titleW, subW) + bPadX * 2);
            const bTotalH = titleFontSize + subFontSize + bPadY * 2 + 6;

            const bBg = hexToRgba(bannerCustomStyle.backgroundColor || '#030712', bannerCustomStyle.backgroundOpacity ?? 90);
            ctx.fillStyle = bBg;
            ctx.strokeStyle = bannerCustomStyle.borderColor || '#6366f1';
            ctx.lineWidth = bannerCustomStyle.borderWidth ?? 2;

            if ((bannerCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = bannerCustomStyle.glowColor || '#6366f1';
              ctx.shadowBlur = bannerCustomStyle.glowBlur || 0;
            }

            const bRadius = bannerCustomStyle.borderRadius ?? 12;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, bTotalW, bTotalH, Math.min(bTotalH / 2, bRadius));
            else ctx.rect(0, 0, bTotalW, bTotalH);
            ctx.fill();
            if ((bannerCustomStyle.borderWidth ?? 0) > 0) ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.textAlign = 'right';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = bannerCustomStyle.secondaryTextColor || bannerCustomStyle.borderColor || '#818cf8';
            ctx.font = `bold ${subFontSize}px ${fontFamily}`;
            ctx.fillText(bannerSubtitle, bTotalW - bPadX, bPadY + subFontSize);

            ctx.fillStyle = bannerCustomStyle.textColor || '#ffffff';
            ctx.font = `${bannerCustomStyle.fontWeight || '900'} ${titleFontSize}px ${fontFamily}`;
            ctx.fillText(episodeTitleText, bTotalW - bPadX, bPadY + subFontSize + titleFontSize + 4);
            ctx.restore();
          } catch (e) {}
        }

        // 6. Rating Card
        if (showRatingOverlay) {
          try {
            ctx.save();
            const rx = (ratingTransform.x / 100) * W;
            const ry = (ratingTransform.y / 100) * H;
            const rScale = (ratingTransform.scale || 1.0) * resScale;
            ctx.translate(rx, ry);
            ctx.scale(rScale, rScale);

            const rFontSize = ratingCustomStyle.fontSize || 13;
            const rSubFontSize = ratingCustomStyle.secondaryFontSize || 10;
            const rPadX = 14;
            const rPadY = ratingCustomStyle.padding || 10;
            const fontFamily = ratingCustomStyle.fontFamily || 'Rubik, sans-serif';

            const scoreStr = `IMDb: ${imdbScore}  •  RT: ${rottenScore}  •  ציון: ${personalScore}`;
            ctx.font = `bold ${rFontSize}px font-mono, sans-serif`;
            const scoreW = ctx.measureText(scoreStr).width;
            ctx.font = `bold ${rSubFontSize}px ${fontFamily}`;
            const titleW = ctx.measureText('🏆 ציוני ודירוגי ביקורת').width;

            const rCardW = Math.max(scoreW, titleW) + rPadX * 2;
            const rCardH = rFontSize + rSubFontSize + rPadY * 2 + 8;

            const rBg = hexToRgba(ratingCustomStyle.backgroundColor || '#030712', ratingCustomStyle.backgroundOpacity ?? 95);
            ctx.fillStyle = rBg;
            ctx.strokeStyle = ratingCustomStyle.borderColor || '#f59e0b';
            ctx.lineWidth = ratingCustomStyle.borderWidth ?? 1.5;

            if ((ratingCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = ratingCustomStyle.glowColor || '#f59e0b';
              ctx.shadowBlur = ratingCustomStyle.glowBlur || 0;
            }

            const rRadius = ratingCustomStyle.borderRadius ?? 16;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, rCardW, rCardH, Math.min(rCardH / 2, rRadius));
            else ctx.rect(0, 0, rCardW, rCardH);
            ctx.fill();
            if ((ratingCustomStyle.borderWidth ?? 0) > 0) ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = ratingCustomStyle.secondaryTextColor || ratingCustomStyle.borderColor || '#f59e0b';
            ctx.font = `bold ${rSubFontSize}px ${fontFamily}`;
            ctx.fillText('🏆 ציוני ודירוגי ביקורת', rCardW / 2, rPadY + rSubFontSize);

            ctx.fillStyle = ratingCustomStyle.textColor || '#ffffff';
            ctx.font = `bold ${rFontSize}px font-mono, sans-serif`;
            ctx.fillText(scoreStr, rCardW / 2, rPadY + rSubFontSize + rFontSize + 5);
            ctx.restore();
          } catch (e) {}
        }

        // 7. Spoiler Alert
        if (showSpoilerOverlay) {
          try {
            ctx.save();
            const spx = (spoilerTransform.x / 100) * W;
            const spy = (spoilerTransform.y / 100) * H;
            const spScale = (spoilerTransform.scale || 1.0) * resScale;
            ctx.translate(spx, spy);
            ctx.scale(spScale, spScale);

            const spFontSize = spoilerCustomStyle.fontSize || 12;
            const spPadX = 14;
            const spPadY = spoilerCustomStyle.padding || 10;
            const fontFamily = spoilerCustomStyle.fontFamily || 'Rubik, sans-serif';

            const spFullText = `⚠️ ${spoilerText}`;
            ctx.font = `${spoilerCustomStyle.fontWeight || 'bold'} ${spFontSize}px ${fontFamily}`;
            const spTextW = ctx.measureText(spFullText).width;
            const spCardW = spTextW + spPadX * 2;
            const spCardH = spFontSize + spPadY * 2 + 4;

            const spBg = hexToRgba(spoilerCustomStyle.backgroundColor || '#450a0a', spoilerCustomStyle.backgroundOpacity ?? 95);
            ctx.fillStyle = spBg;
            ctx.strokeStyle = spoilerCustomStyle.borderColor || '#ef4444';
            ctx.lineWidth = spoilerCustomStyle.borderWidth ?? 1.5;

            if ((spoilerCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = spoilerCustomStyle.glowColor || '#ef4444';
              ctx.shadowBlur = spoilerCustomStyle.glowBlur || 0;
            }

            const spRadius = spoilerCustomStyle.borderRadius ?? 12;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, spCardW, spCardH, Math.min(spCardH / 2, spRadius));
            else ctx.rect(0, 0, spCardW, spCardH);
            ctx.fill();
            if ((spoilerCustomStyle.borderWidth ?? 0) > 0) ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = spoilerCustomStyle.textColor || '#ffffff';
            ctx.fillText(spFullText, spCardW / 2, spPadY + spFontSize);
            ctx.restore();
          } catch (e) {}
        }

        // 8. Poster PIP Overlay (Center Object-Cover Crop - NO Stretch/Squish)
        if (showPosterPip && posterUrl && posterImageObjectRef.current) {
          try {
            ctx.save();
            const px = (posterTransform.x / 100) * W;
            const py = (posterTransform.y / 100) * H;
            const pScale = (posterTransform.scale || 1.0) * resScale;
            ctx.translate(px, py);
            ctx.scale(pScale, pScale);

            const pw = 112;
            const ph = posterShape === 'rectangle' ? 168 : pw;

            if ((posterCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = posterCustomStyle.glowColor || '#6366f1';
              ctx.shadowBlur = posterCustomStyle.glowBlur || 0;
            }

            const pRadius = posterShape === 'circle' ? pw / 2 : (posterCustomStyle.borderRadius ?? 16);
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, pw, ph, Math.min(pw / 2, pRadius));
            else ctx.rect(0, 0, pw, ph);
            ctx.save();
            ctx.clip();

            // Object-cover center crop calculation
            const img = posterImageObjectRef.current;
            const nw = img.naturalWidth || pw;
            const nh = img.naturalHeight || ph;
            const coverScale = Math.max(pw / nw, ph / nh);
            const sw = pw / coverScale;
            const sh = ph / coverScale;
            const sx = (nw - sw) / 2;
            const sy = (nh - sh) / 2;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
            ctx.restore();

            if ((posterCustomStyle.borderWidth ?? 2) > 0) {
              ctx.strokeStyle = posterCustomStyle.borderColor || '#6366f1';
              ctx.lineWidth = posterCustomStyle.borderWidth ?? 2;
              ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(0, 0, pw, ph, Math.min(pw / 2, pRadius));
              else ctx.rect(0, 0, pw, ph);
              ctx.stroke();
            }
            ctx.restore();
          } catch (e) {}
        }

        // 9. Subtitles Overlay
        if (showSubtitles && activeSubtitle) {
          try {
            ctx.save();
            const sx = (subtitleTransform.x / 100) * W;
            const sy = (subtitleTransform.y / 100) * H;
            const sScale = (subtitleTransform.scale || 1.0) * resScale;
            ctx.translate(sx, sy);
            ctx.scale(sScale, sScale);

            const subFontSize = subtitleCustomStyle.fontSize || 22;
            const fontFamily = subtitleCustomStyle.fontFamily || 'Rubik, sans-serif';
            ctx.font = `${subtitleCustomStyle.fontWeight || '900'} ${subFontSize}px ${fontFamily}`;
            ctx.direction = 'rtl';

            const subText = activeSubtitle.text;
            const metrics = ctx.measureText(subText);
            const padX = 18;
            const padY = subtitleCustomStyle.padding || 8;
            const subW = metrics.width + padX * 2;
            const subH = subFontSize + padY * 2 + 4;

            const sBg = hexToRgba(subtitleCustomStyle.backgroundColor || '#000000', subtitleCustomStyle.backgroundOpacity ?? 80);
            ctx.fillStyle = sBg;
            ctx.strokeStyle = subtitleCustomStyle.borderColor || 'transparent';
            ctx.lineWidth = subtitleCustomStyle.borderWidth ?? 0;

            if ((subtitleCustomStyle.glowBlur ?? 0) > 0) {
              ctx.shadowColor = subtitleCustomStyle.glowColor || '#facc15';
              ctx.shadowBlur = subtitleCustomStyle.glowBlur || 0;
            }

            const sRadius = subtitleCustomStyle.borderRadius ?? 12;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(0, 0, subW, subH, Math.min(subH / 2, sRadius));
            else ctx.rect(0, 0, subW, subH);
            ctx.fill();
            if (subtitleCustomStyle.borderWidth && subtitleCustomStyle.borderWidth > 0) ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.fillStyle = subtitleCustomStyle.textColor || '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(subText, subW / 2, padY + subFontSize);
            ctx.restore();
          } catch (e) {}
        }
      }

      animId = requestAnimationFrame(renderStage);
    };

    animId = requestAnimationFrame(renderStage);
    return () => cancelAnimationFrame(animId);
  }, [
    isOpen, 
    isPlaying, 
    isExportingVideo,
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
      audioElementRef.current.volume = isMuted ? 0 : (audioVolume || 1.0);
      audioElementRef.current.muted = isMuted;
      audioElementRef.current.play().then(() => {
        setIsPlaying(true);
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }).catch(e => {
        console.error('Audio playback failed:', e);
        setIsPlaying(false);
      });
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

      // Determine best matching mime type based on user selection
      let chosenMime = '';
      if (exportFormat === 'mp4') {
        const mp4Types = [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4;codecs=h264,aac',
          'video/mp4;codecs=h264',
          'video/mp4'
        ];
        for (const t of mp4Types) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
            chosenMime = t;
            break;
          }
        }
        if (!chosenMime) {
          if (MediaRecorder.isTypeSupported('video/webm;codecs=h264,opus')) chosenMime = 'video/webm;codecs=h264,opus';
          else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) chosenMime = 'video/webm;codecs=vp9,opus';
          else chosenMime = 'video/webm';
        }
      } else {
        const webmTypes = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm'
        ];
        for (const t of webmTypes) {
          if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) {
            chosenMime = t;
            break;
          }
        }
        if (!chosenMime) chosenMime = 'video/webm';
      }

      const recorder = new MediaRecorder(exportStream, {
        mimeType: chosenMime,
        videoBitsPerSecond: 8000000 // 8 Mbps broadcast quality
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const isMp4 = exportFormat === 'mp4' || chosenMime.includes('mp4');
        const ext = isMp4 ? 'mp4' : 'webm';
        const finalBlob = new Blob(chunks, { type: isMp4 ? 'video/mp4' : chosenMime });
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
        alert(`ייצוא הווידאו (${ext.toUpperCase()}) הושלם בהצלחה והקובץ ירד למחשב שלכם!`);
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
            {/* Hidden Audio File Input */}
            <input
              ref={audioUploadInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.ogg"
              onChange={handleUploadAudioFileForEditor}
              className="hidden"
            />

            {/* Upload Audio File Button */}
            <button
              onClick={() => audioUploadInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all shadow-md active:scale-95"
              title="העלאת קובץ שמע ישירות מהמחשב לעריכה וייצוא"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>טען שמע מהמחשב</span>
            </button>

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

            {/* Save Studio Settings to Episode */}
            <button
              onClick={handleSaveStudioConfig}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 border ${
                isSaveSuccess
                  ? 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-900/40 animate-in zoom-in-95'
                  : 'bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 hover:text-white border-indigo-500/40'
              }`}
              title="שמור את כל הגדרות העיצוב, המיקומים, הטקסטים והצבעים ישירות לפרק"
            >
              {isSaveSuccess ? <Check className="w-3.5 h-3.5 text-white" /> : <Save className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{isSaveSuccess ? 'העיצוב נשמר ✓' : 'שמור עיצוב לפרק'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Floating Success Save Toast */}
        {isSaveSuccess && saveMessage && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/50 text-emerald-300 px-4 py-2 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{saveMessage}</span>
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono">הסנכרון נשמר במאגר הנתונים</span>
          </div>
        )}

        {/* Main Studio Body Grid (Left: Stage Preview, Right: Controls & Tools) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 overflow-y-auto flex-1">
          {/* LEFT: Live Stage Canvas Viewport (7 Cols) */}
          <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
            {/* Aspect Ratio Switcher Bar */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-cyan-400" />
                <span>יחס מסך לתצוגה וסושיאל:</span>
              </span>
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAspectRatio('16:9')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    aspectRatio === '16:9' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📺 16:9 רוחב
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('9:16')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    aspectRatio === '9:16' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📱 9:16 רילס / טיקטוק
                </button>
                <button
                  type="button"
                  onClick={() => setAspectRatio('1:1')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    aspectRatio === '1:1' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⏹️ 1:1 ריבוע
                </button>
              </div>
            </div>

            {/* Visual Canvas Stage Viewport */}
            <div
              ref={stageContainerRef}
              className={`relative w-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-black flex items-center justify-center group ${
                aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[460px] mx-auto' : 'aspect-square max-h-[440px] mx-auto'
              }`}
            >
              <canvas
                ref={canvasRef}
                width={aspectRatio === '16:9' ? 1920 : aspectRatio === '9:16' ? 1080 : 1080}
                height={aspectRatio === '16:9' ? 1080 : aspectRatio === '9:16' ? 1920 : 1080}
                className="w-full h-full object-contain"
              />

              {/* INTERACTIVE DOM OVERLAYS (Shown only during editing/preview to avoid duplicate canvas layers during video export) */}
              {!isExportingVideo && (
                <>
                  {/* OVERLAY 1: Permanent Logo (הלוגו שקבעתי) - DRAGGABLE */}
                  {logoConfig.show && logoConfig.url && (
                    <DraggableOverlay
                      transform={logoTransform}
                      onUpdateTransform={setLogoTransform}
                      isEditMode={isEditMode}
                      defaultPosition={{ x: 80, y: 5, scale: 1.0 }}
                    >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('logo');
                      setActiveTab('overlays');
                    }}
                    style={{ opacity: logoConfig.opacity }}
                    className={`cursor-pointer transition-all ${
                      selectedElementToStyle === 'logo' ? 'ring-2 ring-pink-500 ring-offset-2 ring-offset-black rounded-xl' : ''
                    }`}
                  >
                    <img
                      src={logoConfig.url}
                      alt="Podcast Logo"
                      style={{ width: `${logoConfig.size}px`, height: `${logoConfig.size}px` }}
                      className="object-contain drop-shadow-2xl select-none pointer-events-none"
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
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('fact');
                      setActiveTab('styler');
                    }}
                    style={{
                      fontFamily: factCustomStyle.fontFamily || 'Rubik',
                      fontSize: `${factCustomStyle.fontSize || 12}px`,
                      fontWeight: factCustomStyle.fontWeight || 'bold',
                      color: factCustomStyle.textColor || '#ffffff',
                      backgroundColor: factCustomStyle.backgroundColor 
                        ? `${factCustomStyle.backgroundColor}${Math.round(((factCustomStyle.backgroundOpacity ?? 95) / 100) * 255).toString(16).padStart(2, '0')}` 
                        : 'rgba(3, 7, 18, 0.95)',
                      borderColor: factCustomStyle.borderColor || '#f59e0b',
                      borderWidth: `${factCustomStyle.borderWidth ?? 1.5}px`,
                      borderRadius: `${factCustomStyle.borderRadius ?? 16}px`,
                      boxShadow: (factCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${factCustomStyle.glowBlur}px ${factCustomStyle.glowColor || '#f59e0b'}` 
                        : '0 10px 25px -5px rgba(0,0,0,0.5)',
                      padding: `${factCustomStyle.padding || 12}px`,
                      textAlign: factCustomStyle.textAlign || 'right'
                    }}
                    className={`max-w-xs shadow-2xl select-none cursor-pointer transition-all animate-in fade-in ${
                      selectedElementToStyle === 'fact' ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <span 
                        style={{ 
                          backgroundColor: factCustomStyle.borderColor || '#f59e0b', 
                          color: '#030712',
                          fontSize: `${factCustomStyle.secondaryFontSize || 9}px` 
                        }}
                        className="px-2 py-0.5 rounded font-mono font-bold"
                      >
                        {currentFact.source}
                      </span>
                      {currentFact.ratingScore && (
                        <span 
                          className="font-bold" 
                          style={{ 
                            color: factCustomStyle.secondaryTextColor || factCustomStyle.borderColor || '#f59e0b',
                            fontSize: `${factCustomStyle.secondaryFontSize || 10}px` 
                          }}
                        >
                          ⭐ {currentFact.ratingScore}
                        </span>
                      )}
                    </div>
                    <p className="leading-snug line-clamp-3">
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
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('quote');
                      setActiveTab('styler');
                    }}
                    style={{
                      fontFamily: quoteCustomStyle.fontFamily || 'Assistant',
                      fontSize: `${quoteCustomStyle.fontSize || 14}px`,
                      fontWeight: quoteCustomStyle.fontWeight || 'bold',
                      color: quoteCustomStyle.textColor || '#ffffff',
                      backgroundColor: quoteCustomStyle.backgroundColor 
                        ? `${quoteCustomStyle.backgroundColor}${Math.round(((quoteCustomStyle.backgroundOpacity ?? 95) / 100) * 255).toString(16).padStart(2, '0')}` 
                        : 'rgba(3, 7, 18, 0.95)',
                      borderColor: quoteCustomStyle.borderColor || '#a855f7',
                      borderWidth: `${quoteCustomStyle.borderWidth ?? 1.5}px`,
                      borderRadius: `${quoteCustomStyle.borderRadius ?? 16}px`,
                      boxShadow: (quoteCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${quoteCustomStyle.glowBlur}px ${quoteCustomStyle.glowColor || '#a855f7'}` 
                        : '0 10px 25px -5px rgba(0,0,0,0.5)',
                      padding: `${quoteCustomStyle.padding || 14}px`,
                      textAlign: quoteCustomStyle.textAlign || 'center'
                    }}
                    className={`max-w-md shadow-2xl select-none cursor-pointer transition-all ${
                      selectedElementToStyle === 'quote' ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    <p className="italic">
                      {quoteText}
                    </p>
                    {quoteSpeaker && (
                      <span 
                        style={{ 
                          color: quoteCustomStyle.secondaryTextColor || quoteCustomStyle.borderColor || '#c084fc',
                          fontSize: `${quoteCustomStyle.secondaryFontSize || 10}px`
                        }} 
                        className="opacity-90 mt-1 block font-semibold"
                      >
                        — {quoteSpeaker}
                      </span>
                    )}
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 4: Host Name Badge Tag (תג מגיש/ת התוכנית) - DRAGGABLE */}
              {showHostTag && hostName && (
                <DraggableOverlay
                  transform={hostTransform}
                  onUpdateTransform={setHostTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 70, y: 15, scale: 1.0 }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('host');
                      setActiveTab('styler');
                    }}
                    style={{
                      fontFamily: hostCustomStyle.fontFamily || 'Rubik',
                      fontSize: `${hostCustomStyle.fontSize || 13}px`,
                      fontWeight: hostCustomStyle.fontWeight || 'bold',
                      color: hostCustomStyle.textColor || '#ffffff',
                      backgroundColor: hostCustomStyle.backgroundColor 
                        ? `${hostCustomStyle.backgroundColor}${Math.round(((hostCustomStyle.backgroundOpacity ?? 95) / 100) * 255).toString(16).padStart(2, '0')}` 
                        : 'rgba(3, 7, 18, 0.95)',
                      borderColor: hostCustomStyle.borderColor || '#06b6d4',
                      borderWidth: `${hostCustomStyle.borderWidth ?? 1.5}px`,
                      borderRadius: `${hostCustomStyle.borderRadius ?? 9999}px`,
                      boxShadow: (hostCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${hostCustomStyle.glowBlur}px ${hostCustomStyle.glowColor || '#06b6d4'}` 
                        : '0 10px 25px -5px rgba(0,0,0,0.5)',
                      padding: `${hostCustomStyle.padding || 8}px 16px`,
                      textAlign: hostCustomStyle.textAlign || 'right'
                    }}
                    className={`inline-flex items-center gap-2.5 shadow-2xl select-none cursor-pointer transition-all ${
                      selectedElementToStyle === 'host' ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    <span 
                      style={{ backgroundColor: `${hostCustomStyle.borderColor || '#06b6d4'}33`, color: hostCustomStyle.borderColor || '#06b6d4' }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                    >
                      🎙️
                    </span>
                    <div className="leading-tight">
                      <span className="block font-bold">{hostName}</span>
                      {hostRole && (
                        <span 
                          style={{ 
                            color: hostCustomStyle.secondaryTextColor || hostCustomStyle.borderColor || '#06b6d4',
                            fontSize: `${hostCustomStyle.secondaryFontSize || 10}px`
                          }} 
                          className="block font-medium opacity-90"
                        >
                          {hostRole}
                        </span>
                      )}
                    </div>
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 5: Show Banner / Lower-Third (כרטיסיית כותרת) - DRAGGABLE */}
              {showBannerOverlay && (
                <DraggableOverlay
                  transform={bannerTransform}
                  onUpdateTransform={setBannerTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 65, y: 78, scale: 1.0 }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('banner');
                      setActiveTab('styler');
                    }}
                    style={{
                      fontFamily: bannerCustomStyle.fontFamily || 'Rubik',
                      fontSize: `${bannerCustomStyle.fontSize || 13}px`,
                      fontWeight: bannerCustomStyle.fontWeight || '900',
                      color: bannerCustomStyle.textColor || '#ffffff',
                      backgroundColor: bannerCustomStyle.backgroundColor 
                        ? `${bannerCustomStyle.backgroundColor}${Math.round(((bannerCustomStyle.backgroundOpacity ?? 90) / 100) * 255).toString(16).padStart(2, '0')}` 
                        : 'rgba(3, 7, 18, 0.90)',
                      borderColor: bannerCustomStyle.borderColor || '#6366f1',
                      borderWidth: `${bannerCustomStyle.borderWidth ?? 2}px`,
                      borderRadius: `${bannerCustomStyle.borderRadius ?? 12}px`,
                      boxShadow: (bannerCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${bannerCustomStyle.glowBlur}px ${bannerCustomStyle.glowColor || '#6366f1'}` 
                        : '0 10px 25px -5px rgba(0,0,0,0.5)',
                      padding: `${bannerCustomStyle.padding || 10}px 14px`,
                      textAlign: bannerCustomStyle.textAlign || 'right'
                    }}
                    className={`max-w-xs shadow-xl select-none cursor-pointer transition-all ${
                      selectedElementToStyle === 'banner' ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    <span 
                      style={{ 
                        color: bannerCustomStyle.secondaryTextColor || bannerCustomStyle.borderColor || '#818cf8',
                        fontSize: `${bannerCustomStyle.secondaryFontSize || 9}px`
                      }}
                      className="font-bold block uppercase"
                    >
                      {bannerSubtitle}
                    </span>
                    <h4 className="truncate">{episodeTitleText}</h4>
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 6: Rating Card Overlay - DRAGGABLE */}
              {showRatingOverlay && (
                <DraggableOverlay
                  transform={ratingTransform}
                  onUpdateTransform={setRatingTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 20, y: 75, scale: 1.0 }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('rating');
                      setActiveTab('styler');
                    }}
                    style={{
                      fontFamily: ratingCustomStyle.fontFamily || 'Rubik',
                      fontSize: `${ratingCustomStyle.fontSize || 13}px`,
                      fontWeight: ratingCustomStyle.fontWeight || 'bold',
                      color: ratingCustomStyle.textColor || '#ffffff',
                      backgroundColor: ratingCustomStyle.backgroundColor 
                        ? `${ratingCustomStyle.backgroundColor}${Math.round(((ratingCustomStyle.backgroundOpacity ?? 95) / 100) * 255).toString(16).padStart(2, '0')}` 
                        : 'rgba(3, 7, 18, 0.95)',
                      borderColor: ratingCustomStyle.borderColor || '#f59e0b',
                      borderWidth: `${ratingCustomStyle.borderWidth ?? 1.5}px`,
                      borderRadius: `${ratingCustomStyle.borderRadius ?? 16}px`,
                      boxShadow: (ratingCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${ratingCustomStyle.glowBlur}px ${ratingCustomStyle.glowColor || '#f59e0b'}` 
                        : '0 10px 25px -5px rgba(0,0,0,0.5)',
                      padding: `${ratingCustomStyle.padding || 10}px 14px`,
                      textAlign: ratingCustomStyle.textAlign || 'center'
                    }}
                    className={`shadow-2xl select-none cursor-pointer transition-all ${
                      selectedElementToStyle === 'rating' ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    <span 
                      style={{ 
                        color: ratingCustomStyle.secondaryTextColor || ratingCustomStyle.borderColor || '#f59e0b', 
                        fontSize: `${ratingCustomStyle.secondaryFontSize || 10}px` 
                      }}
                      className="font-bold block mb-1"
                    >
                      🏆 ציוני ודירוגי ביקורת
                    </span>
                    <div className="flex items-center justify-center gap-2.5 font-mono font-bold text-xs">
                      {imdbScore && <span className="flex items-center gap-1"><span className="text-yellow-400">⭐ IMDb:</span> {imdbScore}</span>}
                      {rottenScore && <span className="flex items-center gap-1"><span className="text-rose-400">🍅 RT:</span> {rottenScore}</span>}
                      {personalScore && <span className="flex items-center gap-1"><span className="text-amber-300">🎙️ ציון:</span> {personalScore}</span>}
                    </div>
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 7: Spoiler Alert Overlay - DRAGGABLE */}
              {showSpoilerOverlay && (
                <DraggableOverlay
                  transform={spoilerTransform}
                  onUpdateTransform={setSpoilerTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 25, y: 15, scale: 1.0 }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('spoiler');
                      setActiveTab('styler');
                    }}
                    style={{
                      fontFamily: spoilerCustomStyle.fontFamily || 'Rubik',
                      fontSize: `${spoilerCustomStyle.fontSize || 12}px`,
                      fontWeight: spoilerCustomStyle.fontWeight || 'bold',
                      color: spoilerCustomStyle.textColor || '#ffffff',
                      backgroundColor: spoilerCustomStyle.backgroundColor 
                        ? `${spoilerCustomStyle.backgroundColor}${Math.round(((spoilerCustomStyle.backgroundOpacity ?? 95) / 100) * 255).toString(16).padStart(2, '0')}` 
                        : 'rgba(69, 10, 10, 0.95)',
                      borderColor: spoilerCustomStyle.borderColor || '#ef4444',
                      borderWidth: `${spoilerCustomStyle.borderWidth ?? 1.5}px`,
                      borderRadius: `${spoilerCustomStyle.borderRadius ?? 12}px`,
                      boxShadow: (spoilerCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${spoilerCustomStyle.glowBlur}px ${spoilerCustomStyle.glowColor || '#ef4444'}` 
                        : '0 10px 25px -5px rgba(0,0,0,0.5)',
                      padding: `${spoilerCustomStyle.padding || 10}px 14px`,
                      textAlign: spoilerCustomStyle.textAlign || 'center'
                    }}
                    className={`shadow-2xl select-none cursor-pointer transition-all animate-pulse ${
                      selectedElementToStyle === 'spoiler' ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5 font-bold">
                      <span>⚠️</span>
                      <span>{spoilerText}</span>
                    </span>
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 8: Poster PIP - DRAGGABLE */}
              {showPosterPip && posterUrl && (
                <DraggableOverlay
                  transform={posterTransform}
                  onUpdateTransform={setPosterTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 5, y: 45, scale: 1.0 }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('poster');
                      setActiveTab('styler');
                    }}
                    style={{
                      borderColor: posterCustomStyle.borderColor || '#6366f1',
                      borderWidth: `${posterCustomStyle.borderWidth ?? 2}px`,
                      borderRadius: `${posterCustomStyle.borderRadius ?? 16}px`,
                      boxShadow: (posterCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${posterCustomStyle.glowBlur}px ${posterCustomStyle.glowColor || '#6366f1'}` 
                        : '0 10px 25px -5px rgba(0,0,0,0.5)'
                    }}
                    className={`w-28 overflow-hidden shadow-2xl select-none cursor-pointer transition-all ${
                      posterShape === 'circle' ? 'rounded-full aspect-square' : posterShape === 'rectangle' ? 'rounded-xl aspect-[2/3]' : 'rounded-2xl aspect-square'
                    } ${selectedElementToStyle === 'poster' ? 'ring-2 ring-pink-400 ring-offset-2 ring-offset-black' : ''}`}
                  >
                    <img src={posterUrl} alt="Movie Poster" className="w-full h-full object-cover" />
                  </div>
                </DraggableOverlay>
              )}

              {/* OVERLAY 9: Live Subtitle Overlay - DRAGGABLE */}
              {showSubtitles && activeSubtitle && (
                <DraggableOverlay
                  transform={subtitleTransform}
                  onUpdateTransform={setSubtitleTransform}
                  isEditMode={isEditMode}
                  defaultPosition={{ x: 15, y: 78, scale: 1.0 }}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedElementToStyle('subtitles');
                      setActiveTab('styler');
                    }}
                    style={{
                      fontFamily: subtitleCustomStyle.fontFamily || 'Rubik',
                      fontSize: `${subtitleCustomStyle.fontSize || 22}px`,
                      fontWeight: subtitleCustomStyle.fontWeight || '900',
                      color: subtitleCustomStyle.textColor || '#ffffff',
                      backgroundColor: subtitleCustomStyle.backgroundColor 
                        ? `${subtitleCustomStyle.backgroundColor}${Math.round(((subtitleCustomStyle.backgroundOpacity ?? 80) / 100) * 255).toString(16).padStart(2, '0')}` 
                        : 'rgba(0, 0, 0, 0.8)',
                      borderColor: subtitleCustomStyle.borderColor || 'transparent',
                      borderWidth: `${subtitleCustomStyle.borderWidth ?? 0}px`,
                      borderRadius: `${subtitleCustomStyle.borderRadius ?? 12}px`,
                      boxShadow: (subtitleCustomStyle.glowBlur ?? 0) > 0 
                        ? `0 0 ${subtitleCustomStyle.glowBlur}px ${subtitleCustomStyle.glowColor || '#facc15'}` 
                        : 'none',
                      padding: `${subtitleCustomStyle.padding || 8}px 18px`,
                      textAlign: subtitleCustomStyle.textAlign || 'center',
                      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                      lineHeight: '1.3',
                      whiteSpace: 'pre-line'
                    }}
                    className={`select-none cursor-pointer transition-all ${
                      selectedElementToStyle === 'subtitles' ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-black' : ''
                    }`}
                  >
                    {activeSubtitle.text}
                  </div>
                </DraggableOverlay>
              )}
            </>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
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

                  {/* Playback Speed Switcher */}
                  <div className="flex items-center bg-slate-900 rounded-xl border border-slate-800 p-0.5 text-[10px]">
                    {[0.75, 1.0, 1.25, 1.5].map(rate => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setAudioPlaybackRate(rate);
                          if (audioElementRef.current) audioElementRef.current.playbackRate = rate;
                        }}
                        className={`px-1.5 py-1 rounded-lg font-mono font-bold transition-all ${
                          audioPlaybackRate === rate ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  {/* Voice Warmth Boost Switch */}
                  <button
                    type="button"
                    onClick={() => setVoiceWarmth(!voiceWarmth)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1 ${
                      voiceWarmth ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                    title="פילטר שיפור חום קול ורדיופוניקה"
                  >
                    <span>🎙️ חום קול</span>
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
            {/* Customization Tabs (6 Tabs) */}
            <div className="grid grid-cols-6 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 text-xs">
              <button
                onClick={() => setActiveTab('styler')}
                className={`py-2 px-1 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'styler' ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>מעצב</span>
              </button>

              <button
                onClick={() => setActiveTab('background')}
                className={`py-2 px-1 rounded-xl font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'background' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>רקע</span>
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
                <span>שכבות</span>
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
              {/* TAB: FREE ELEMENT STYLER (מעצב אלמנטים חופשי מלא) */}
              {activeTab === 'styler' && (
                <div className="space-y-4">
                  {/* Element Switcher Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>בחר אלמנט לעיצוב והתאמה אישית:</span>
                      </label>
                      <span className="text-[10px] text-cyan-400 font-mono font-bold">לחץ גם על האלמנט בפריים</span>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-[10px]">
                      {[
                        { id: 'host', label: '🎙️ תג מגיש' },
                        { id: 'fact', label: '⭐ עובדות' },
                        { id: 'quote', label: '💬 ציטוט' },
                        { id: 'banner', label: '📺 כותרת' },
                        { id: 'rating', label: '🏆 ציונים' },
                        { id: 'spoiler', label: '⚠️ ספוילר' },
                        { id: 'poster', label: '🖼️ פוסטר' },
                        { id: 'subtitles', label: '📝 כתוביות' }
                      ].map(el => (
                        <button
                          key={el.id}
                          type="button"
                          onClick={() => setSelectedElementToStyle(el.id as any)}
                          className={`py-1.5 px-1 rounded-lg font-bold transition-all text-center ${
                            selectedElementToStyle === el.id
                              ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {el.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PROMINENT VISIBILITY TOGGLE BANNER FOR ACTIVE ELEMENT */}
                  <div className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                    isCurrentElementVisible()
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{isCurrentElementVisible() ? '🟢' : '🔴'}</span>
                      <div>
                        <span className="text-xs font-bold block">
                          {isCurrentElementVisible() ? 'האלמנט פעיל ומוצג בפריים' : 'האלמנט כבוי ומוסתר כרגע'}
                        </span>
                        <span className="text-[10px] opacity-80">
                          {isCurrentElementVisible() ? 'גרור בפריים או ערוך טקסטים וגדלים מטה' : 'לחץ להפעלה כדי להציגו על המסך'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleCurrentElementVisibility()}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shadow ${
                        isCurrentElementVisible()
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isCurrentElementVisible() ? 'הסתר מהמסך' : 'הצג בפריים ✓'}
                    </button>
                  </div>

                  {/* 1. Quick Style Presets per element */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-slate-300 block">ערכות עיצוב מוכנות לאלמנט זה:</span>
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => updateCurrentElementStyle({
                          textColor: '#ffffff',
                          secondaryTextColor: '#f59e0b',
                          backgroundColor: '#030712',
                          backgroundOpacity: 95,
                          borderColor: '#f59e0b',
                          borderWidth: 1.5,
                          borderRadius: 16,
                          glowColor: '#f59e0b',
                          glowBlur: 10,
                          fontWeight: 'bold'
                        })}
                        className="p-1.5 rounded-lg bg-slate-950 border border-amber-500/50 hover:border-amber-400 text-amber-300 font-bold transition-all text-center"
                      >
                        👑 זהב יוקרתי
                      </button>

                      <button
                        type="button"
                        onClick={() => updateCurrentElementStyle({
                          textColor: '#ffffff',
                          secondaryTextColor: '#06b6d4',
                          backgroundColor: '#020617',
                          backgroundOpacity: 95,
                          borderColor: '#06b6d4',
                          borderWidth: 2,
                          borderRadius: 14,
                          glowColor: '#06b6d4',
                          glowBlur: 14,
                          fontWeight: 'bold'
                        })}
                        className="p-1.5 rounded-lg bg-slate-950 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-bold transition-all text-center"
                      >
                        ⚡ ניאון טורקיז
                      </button>

                      <button
                        type="button"
                        onClick={() => updateCurrentElementStyle({
                          textColor: '#ffffff',
                          secondaryTextColor: '#94a3b8',
                          backgroundColor: '#0f172a',
                          backgroundOpacity: 75,
                          borderColor: '#ffffff30',
                          borderWidth: 1,
                          borderRadius: 18,
                          glowColor: '#ffffff',
                          glowBlur: 0,
                          fontWeight: 'bold'
                        })}
                        className="p-1.5 rounded-lg bg-slate-950 border border-white/20 hover:border-white/40 text-slate-200 font-bold transition-all text-center"
                      >
                        🧊 זכוכית כהה
                      </button>

                      <button
                        type="button"
                        onClick={() => updateCurrentElementStyle({
                          textColor: '#ffffff',
                          secondaryTextColor: '#f43f5e',
                          backgroundColor: '#030712',
                          backgroundOpacity: 95,
                          borderColor: '#e11d48',
                          borderWidth: 2,
                          borderRadius: 12,
                          glowColor: '#e11d48',
                          glowBlur: 10,
                          fontWeight: 'bold'
                        })}
                        className="p-1.5 rounded-lg bg-slate-950 border border-rose-500/50 hover:border-rose-400 text-rose-300 font-bold transition-all text-center"
                      >
                        🎬 קולנוע אדום
                      </button>

                      <button
                        type="button"
                        onClick={() => updateCurrentElementStyle({
                          textColor: '#ffffff',
                          secondaryTextColor: '#c084fc',
                          backgroundColor: '#030712',
                          backgroundOpacity: 95,
                          borderColor: '#a855f7',
                          borderWidth: 1.5,
                          borderRadius: 16,
                          glowColor: '#a855f7',
                          glowBlur: 10,
                          fontWeight: 'bold'
                        })}
                        className="p-1.5 rounded-lg bg-slate-950 border border-purple-500/50 hover:border-purple-400 text-purple-300 font-bold transition-all text-center"
                      >
                        💜 קטיפה זוהרת
                      </button>

                      <button
                        type="button"
                        onClick={() => updateCurrentElementStyle({
                          textColor: '#ffffff',
                          secondaryTextColor: '#94a3b8',
                          backgroundColor: '#090d16',
                          backgroundOpacity: 90,
                          borderColor: '#475569',
                          borderWidth: 1,
                          borderRadius: 8,
                          glowColor: '#000000',
                          glowBlur: 0,
                          fontWeight: 'bold'
                        })}
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold transition-all text-center"
                      >
                        ⚪ נקי ומינימלי
                      </button>
                    </div>
                  </div>

                  {/* 2. SPECIFIC ELEMENT TEXTS & DEDICATED SIZES (טקסטים וגדלים ייעודיים) */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <span>✏️ עריכת טקסטים וגדלים נפרדים (כותרת/משני/מספר פרק):</span>
                    </span>

                    {/* HOST TAG CONTROLS */}
                    {selectedElementToStyle === 'host' && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">שם המגיש:</label>
                            <input
                              type="text"
                              value={hostName}
                              onChange={(e) => setHostName(e.target.value)}
                              placeholder="שם המגיש"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל שם המגיש:</span>
                              <span className="font-mono text-cyan-400">{getCurrentElementStyle().fontSize || 13}px</span>
                            </div>
                            <input
                              type="range"
                              min="8"
                              max="64"
                              value={getCurrentElementStyle().fontSize || 13}
                              onChange={(e) => updateCurrentElementStyle({ fontSize: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">תפקיד / כותרת המגיש:</label>
                            <input
                              type="text"
                              value={hostRole}
                              onChange={(e) => setHostRole(e.target.value)}
                              placeholder="מנחה ראשי / מבקר קולנוע"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל תפקיד המגיש:</span>
                              <span className="font-mono text-cyan-400">{getCurrentElementStyle().secondaryFontSize || 10}px</span>
                            </div>
                            <input
                              type="range"
                              min="8"
                              max="44"
                              value={getCurrentElementStyle().secondaryFontSize || 10}
                              onChange={(e) => updateCurrentElementStyle({ secondaryFontSize: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* BANNER CONTROLS */}
                    {selectedElementToStyle === 'banner' && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">שם הפרק:</label>
                            <input
                              type="text"
                              value={episodeTitleText}
                              onChange={(e) => setEpisodeTitleText(e.target.value)}
                              placeholder="שם הפרק"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל שם הפרק:</span>
                              <span className="font-mono text-indigo-400">{getCurrentElementStyle().fontSize || 13}px</span>
                            </div>
                            <input
                              type="range"
                              min="8"
                              max="64"
                              value={getCurrentElementStyle().fontSize || 13}
                              onChange={(e) => updateCurrentElementStyle({ fontSize: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">כותרת עליונה / מספר פרק:</label>
                            <input
                              type="text"
                              value={bannerSubtitle}
                              onChange={(e) => setBannerSubtitle(e.target.value)}
                              placeholder={`CastFlow Studio • פרק ${episode.episodeNumber}`}
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל מספר הפרק:</span>
                              <span className="font-mono text-indigo-400">{getCurrentElementStyle().secondaryFontSize || 10}px</span>
                            </div>
                            <input
                              type="range"
                              min="8"
                              max="44"
                              value={getCurrentElementStyle().secondaryFontSize || 10}
                              onChange={(e) => updateCurrentElementStyle({ secondaryFontSize: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* QUOTE CONTROLS */}
                    {selectedElementToStyle === 'quote' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">טקסט הציטוט:</label>
                          <textarea
                            value={quoteText}
                            onChange={(e) => setQuoteText(e.target.value)}
                            rows={2}
                            placeholder="הקלד ציטוט מהסרט או מהפרק..."
                            className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">שם הדובר / הסרט:</label>
                            <input
                              type="text"
                              value={quoteSpeaker}
                              onChange={(e) => setQuoteSpeaker(e.target.value)}
                              placeholder="שם הדובר"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל שם הדובר:</span>
                              <span className="font-mono text-purple-400">{getCurrentElementStyle().secondaryFontSize || 11}px</span>
                            </div>
                            <input
                              type="range"
                              min="8"
                              max="44"
                              value={getCurrentElementStyle().secondaryFontSize || 11}
                              onChange={(e) => updateCurrentElementStyle({ secondaryFontSize: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RATING CARD CONTROLS */}
                    {selectedElementToStyle === 'rating' && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">IMDb:</label>
                            <input
                              type="text"
                              value={imdbScore}
                              onChange={(e) => setImdbScore(e.target.value)}
                              className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">Rotten Tomatoes:</label>
                            <input
                              type="text"
                              value={rottenScore}
                              onChange={(e) => setRottenScore(e.target.value)}
                              className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white text-center font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-400 font-bold block">ציון אישי:</label>
                            <input
                              type="text"
                              value={personalScore}
                              onChange={(e) => setPersonalScore(e.target.value)}
                              className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white text-center font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל הציונים:</span>
                              <span className="font-mono text-amber-400">{getCurrentElementStyle().fontSize || 13}px</span>
                            </div>
                            <input
                              type="range"
                              min="9"
                              max="48"
                              value={getCurrentElementStyle().fontSize || 13}
                              onChange={(e) => updateCurrentElementStyle({ fontSize: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל כותרת דירוג:</span>
                              <span className="font-mono text-amber-400">{getCurrentElementStyle().secondaryFontSize || 10}px</span>
                            </div>
                            <input
                              type="range"
                              min="8"
                              max="36"
                              value={getCurrentElementStyle().secondaryFontSize || 10}
                              onChange={(e) => updateCurrentElementStyle({ secondaryFontSize: parseInt(e.target.value) })}
                              className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SPOILER ALERT CONTROLS */}
                    {selectedElementToStyle === 'spoiler' && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">נוסח אזהרת הספוילר:</label>
                          <input
                            type="text"
                            value={spoilerText}
                            onChange={(e) => setSpoilerText(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                            <span>גודל טקסט אזהרה:</span>
                            <span className="font-mono text-rose-400">{getCurrentElementStyle().fontSize || 12}px</span>
                          </div>
                          <input
                            type="range"
                            min="9"
                            max="48"
                            value={getCurrentElementStyle().fontSize || 12}
                            onChange={(e) => updateCurrentElementStyle({ fontSize: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-rose-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* POSTER & COVER PIP CONTROLS */}
                    {selectedElementToStyle === 'poster' && (
                      <div className="space-y-3">
                        {/* Hidden Poster File Input */}
                        <input
                          ref={posterFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePosterFileUpload}
                        />

                        {/* Poster Preview & Upload Actions */}
                        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                          <img
                            src={posterUrl || episode.coverImage || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80'}
                            alt="Poster Preview"
                            className="w-12 h-16 rounded-lg object-cover border border-slate-700 shadow shrink-0"
                          />
                          <div className="flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => posterFileInputRef.current?.click()}
                                className="px-2.5 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold flex items-center gap-1 shadow transition-all"
                              >
                                <Upload className="w-3 h-3" />
                                <span>העלאה מהמחשב</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setStockPickerTarget('poster');
                                  setIsStockModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold flex items-center gap-1 border border-slate-700 transition-all"
                              >
                                <FolderOpen className="w-3 h-3" />
                                <span>מאגר Bunny CDN</span>
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400 block">בחר תמונת פוסטר לאולפן</span>
                          </div>
                        </div>

                        {/* Direct URL input */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">כתובת URL ישירה לפוסטר:</label>
                          <input
                            type="text"
                            value={posterUrl}
                            onChange={(e) => {
                              setPosterUrl(e.target.value);
                              setShowPosterPip(true);
                            }}
                            placeholder="https://..."
                            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500"
                          />
                        </div>

                        {/* Shape Selector */}
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">צורת תצוגת הפוסטר בפריים:</label>
                          <div className="grid grid-cols-3 gap-1.5 text-xs">
                            {[
                              { id: 'rounded_square', label: 'ריבוע מעוגל' },
                              { id: 'rectangle', label: 'יחס 2:3 קולנועי' },
                              { id: 'circle', label: 'עיגול מלא' }
                            ].map(shape => (
                              <button
                                key={shape.id}
                                type="button"
                                onClick={() => setPosterShape(shape.id as any)}
                                className={`p-1.5 rounded-xl border font-bold text-center transition-all ${
                                  posterShape === shape.id
                                    ? 'bg-pink-600 border-pink-400 text-white'
                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                }`}
                              >
                                {shape.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Typography Controls (טיפוגרפיה) */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <span>🔤 סגנון גופן, עובי וצבעים:</span>
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block">סוג גופן (Font):</label>
                        <select
                          value={getCurrentElementStyle().fontFamily || 'Rubik'}
                          onChange={(e) => updateCurrentElementStyle({ fontFamily: e.target.value })}
                          className="w-full p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                        >
                          <option value="Rubik">Rubik (רוביק מודרני)</option>
                          <option value="Assistant">Assistant (אסיסטנט אלגנטי)</option>
                          <option value="Secular One">Secular One (קולנועי עבה)</option>
                          <option value="Heebo">Heebo (היבו יוקרתי)</option>
                          <option value="Impact">Impact (אימפקט ויראלי)</option>
                          <option value="Montserrat">Montserrat (מונטסראט)</option>
                          <option value="Inter">Inter (אינטר)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">עובי אות:</span>
                        <div className="grid grid-cols-3 gap-1 text-[10px]">
                          {[
                            { id: 'normal', label: 'רגיל' },
                            { id: 'bold', label: 'מודגש' },
                            { id: '900', label: 'שחור' }
                          ].map(w => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => updateCurrentElementStyle({ fontWeight: w.id as any })}
                              className={`p-1 rounded-lg border font-bold ${
                                (getCurrentElementStyle().fontWeight || 'bold') === w.id
                                  ? 'bg-cyan-600 border-cyan-400 text-white'
                                  : 'bg-slate-950 border-slate-800 text-slate-400'
                              }`}
                            >
                              {w.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Text Colors: Primary & Secondary */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">צבע טקסט ראשי:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={getCurrentElementStyle().textColor || '#ffffff'}
                            onChange={(e) => updateCurrentElementStyle({ textColor: e.target.value })}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                          />
                          <div className="flex items-center gap-1 flex-wrap">
                            {['#ffffff', '#facc15', '#f59e0b', '#06b6d4', '#f43f5e', '#a855f7'].map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => updateCurrentElementStyle({ textColor: c })}
                                className="w-4 h-4 rounded-md border border-white/20"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">צבע טקסט משני / תג:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={getCurrentElementStyle().secondaryTextColor || '#06b6d4'}
                            onChange={(e) => updateCurrentElementStyle({ secondaryTextColor: e.target.value })}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                          />
                          <div className="flex items-center gap-1 flex-wrap">
                            {['#06b6d4', '#f59e0b', '#818cf8', '#c084fc', '#f43f5e', '#10b981'].map(c => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => updateCurrentElementStyle({ secondaryTextColor: c })}
                                className="w-4 h-4 rounded-md border border-white/20"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Background & Border Controls (רקע ומסגרת) */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <span>🎨 רקע, מסגרת ופינות:</span>
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Background Color & Opacity */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>צבע ושקיפות רקע:</span>
                          <span className="font-mono text-purple-400">{getCurrentElementStyle().backgroundOpacity ?? 95}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={getCurrentElementStyle().backgroundColor || '#030712'}
                            onChange={(e) => updateCurrentElementStyle({ backgroundColor: e.target.value })}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                          />
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={getCurrentElementStyle().backgroundOpacity ?? 95}
                            onChange={(e) => updateCurrentElementStyle({ backgroundOpacity: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>

                      {/* Border Width & Color */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>עובי מסגרת:</span>
                          <span className="font-mono text-purple-400">{getCurrentElementStyle().borderWidth ?? 1.5}px</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={getCurrentElementStyle().borderColor || '#06b6d4'}
                            onChange={(e) => updateCurrentElementStyle({ borderColor: e.target.value })}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                          />
                          <input
                            type="range"
                            min="0"
                            max="6"
                            step="0.5"
                            value={getCurrentElementStyle().borderWidth ?? 1.5}
                            onChange={(e) => updateCurrentElementStyle({ borderWidth: parseFloat(e.target.value) })}
                            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Corner Radius & Glow Intensity */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>עיגול פינות (Radius):</span>
                          <span className="font-mono text-purple-400">
                            {(getCurrentElementStyle().borderRadius ?? 16) > 50 ? 'גלולה (Pill)' : `${getCurrentElementStyle().borderRadius ?? 16}px`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="range"
                            min="0"
                            max="36"
                            value={Math.min(36, getCurrentElementStyle().borderRadius ?? 16)}
                            onChange={(e) => updateCurrentElementStyle({ borderRadius: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateCurrentElementStyle({ borderRadius: 9999 })}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 shrink-0 hover:bg-slate-700"
                          >
                            גלולה
                          </button>
                        </div>
                      </div>

                      {/* Glow & Shadow */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>זוהר ניאון / צל:</span>
                          <span className="font-mono text-purple-400">{getCurrentElementStyle().glowBlur || 0}px</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={getCurrentElementStyle().glowColor || '#06b6d4'}
                            onChange={(e) => updateCurrentElementStyle({ glowColor: e.target.value })}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
                          />
                          <input
                            type="range"
                            min="0"
                            max="25"
                            value={getCurrentElementStyle().glowBlur || 0}
                            onChange={(e) => updateCurrentElementStyle({ glowBlur: parseInt(e.target.value) })}
                            className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. Position, Scale & Transform Direct Numeric Controls */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <span>📐 מיקום וקנה מידה בפריים:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedElementToStyle === 'host') setHostTransform({ x: 70, y: 15, scale: 1.0 });
                          else if (selectedElementToStyle === 'fact') setFactTransform({ x: 5, y: 8, scale: 1.0 });
                          else if (selectedElementToStyle === 'quote') setQuoteTransform({ x: 25, y: 65, scale: 1.0 });
                          else if (selectedElementToStyle === 'banner') setBannerTransform({ x: 65, y: 78, scale: 1.0 });
                          else if (selectedElementToStyle === 'rating') setRatingTransform({ x: 20, y: 75, scale: 1.0 });
                          else if (selectedElementToStyle === 'spoiler') setSpoilerTransform({ x: 25, y: 15, scale: 1.0 });
                          else if (selectedElementToStyle === 'poster') setPosterTransform({ x: 5, y: 45, scale: 1.0 });
                          else if (selectedElementToStyle === 'subtitles') setSubtitleTransform({ x: 15, y: 78, scale: 1.0 });
                        }}
                        className="text-[10px] text-amber-400 font-bold hover:underline"
                      >
                        איפוס מיקום ↺
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="space-y-1">
                        <span className="text-slate-400 block font-bold">ציר X (אופקי):</span>
                        <input
                          type="range"
                          min="0"
                          max="85"
                          value={
                            selectedElementToStyle === 'host' ? hostTransform.x :
                            selectedElementToStyle === 'fact' ? factTransform.x :
                            selectedElementToStyle === 'quote' ? quoteTransform.x :
                            selectedElementToStyle === 'banner' ? bannerTransform.x :
                            selectedElementToStyle === 'rating' ? ratingTransform.x :
                            selectedElementToStyle === 'spoiler' ? spoilerTransform.x :
                            selectedElementToStyle === 'poster' ? posterTransform.x :
                            subtitleTransform.x
                          }
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (selectedElementToStyle === 'host') setHostTransform(prev => ({ ...prev, x: val }));
                            else if (selectedElementToStyle === 'fact') setFactTransform(prev => ({ ...prev, x: val }));
                            else if (selectedElementToStyle === 'quote') setQuoteTransform(prev => ({ ...prev, x: val }));
                            else if (selectedElementToStyle === 'banner') setBannerTransform(prev => ({ ...prev, x: val }));
                            else if (selectedElementToStyle === 'rating') setRatingTransform(prev => ({ ...prev, x: val }));
                            else if (selectedElementToStyle === 'spoiler') setSpoilerTransform(prev => ({ ...prev, x: val }));
                            else if (selectedElementToStyle === 'poster') setPosterTransform(prev => ({ ...prev, x: val }));
                            else if (selectedElementToStyle === 'subtitles') setSubtitleTransform(prev => ({ ...prev, x: val }));
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-slate-400 block font-bold">ציר Y (אנכי):</span>
                        <input
                          type="range"
                          min="0"
                          max="85"
                          value={
                            selectedElementToStyle === 'host' ? hostTransform.y :
                            selectedElementToStyle === 'fact' ? factTransform.y :
                            selectedElementToStyle === 'quote' ? quoteTransform.y :
                            selectedElementToStyle === 'banner' ? bannerTransform.y :
                            selectedElementToStyle === 'rating' ? ratingTransform.y :
                            selectedElementToStyle === 'spoiler' ? spoilerTransform.y :
                            selectedElementToStyle === 'poster' ? posterTransform.y :
                            subtitleTransform.y
                          }
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (selectedElementToStyle === 'host') setHostTransform(prev => ({ ...prev, y: val }));
                            else if (selectedElementToStyle === 'fact') setFactTransform(prev => ({ ...prev, y: val }));
                            else if (selectedElementToStyle === 'quote') setQuoteTransform(prev => ({ ...prev, y: val }));
                            else if (selectedElementToStyle === 'banner') setBannerTransform(prev => ({ ...prev, y: val }));
                            else if (selectedElementToStyle === 'rating') setRatingTransform(prev => ({ ...prev, y: val }));
                            else if (selectedElementToStyle === 'spoiler') setSpoilerTransform(prev => ({ ...prev, y: val }));
                            else if (selectedElementToStyle === 'poster') setPosterTransform(prev => ({ ...prev, y: val }));
                            else if (selectedElementToStyle === 'subtitles') setSubtitleTransform(prev => ({ ...prev, y: val }));
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-400 font-bold">
                          <span>קנה מידה:</span>
                          <span className="font-mono text-amber-400 font-black">
                            {Math.round((
                              selectedElementToStyle === 'host' ? hostTransform.scale :
                              selectedElementToStyle === 'fact' ? factTransform.scale :
                              selectedElementToStyle === 'quote' ? quoteTransform.scale :
                              selectedElementToStyle === 'banner' ? bannerTransform.scale :
                              selectedElementToStyle === 'rating' ? ratingTransform.scale :
                              selectedElementToStyle === 'spoiler' ? spoilerTransform.scale :
                              selectedElementToStyle === 'poster' ? posterTransform.scale :
                              subtitleTransform.scale
                            ) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.4"
                          max="3.5"
                          step="0.05"
                          value={
                            selectedElementToStyle === 'host' ? hostTransform.scale :
                            selectedElementToStyle === 'fact' ? factTransform.scale :
                            selectedElementToStyle === 'quote' ? quoteTransform.scale :
                            selectedElementToStyle === 'banner' ? bannerTransform.scale :
                            selectedElementToStyle === 'rating' ? ratingTransform.scale :
                            selectedElementToStyle === 'spoiler' ? spoilerTransform.scale :
                            selectedElementToStyle === 'poster' ? posterTransform.scale :
                            subtitleTransform.scale
                          }
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (selectedElementToStyle === 'host') setHostTransform(prev => ({ ...prev, scale: val }));
                            else if (selectedElementToStyle === 'fact') setFactTransform(prev => ({ ...prev, scale: val }));
                            else if (selectedElementToStyle === 'quote') setQuoteTransform(prev => ({ ...prev, scale: val }));
                            else if (selectedElementToStyle === 'banner') setBannerTransform(prev => ({ ...prev, scale: val }));
                            else if (selectedElementToStyle === 'rating') setRatingTransform(prev => ({ ...prev, scale: val }));
                            else if (selectedElementToStyle === 'spoiler') setSpoilerTransform(prev => ({ ...prev, scale: val }));
                            else if (selectedElementToStyle === 'poster') setPosterTransform(prev => ({ ...prev, scale: val }));
                            else if (selectedElementToStyle === 'subtitles') setSubtitleTransform(prev => ({ ...prev, scale: val }));
                          }}
                          className="w-full h-1.5 bg-slate-800 rounded appearance-none cursor-pointer accent-amber-500"
                        />
                      </div>
                    </div>

                    {/* Quick Scale Presets */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 block">קנה מידה מהיר בלחיצה:</span>
                      <div className="grid grid-cols-6 gap-1 text-[10px]">
                        {[
                          { scale: 0.8, label: '0.8x' },
                          { scale: 1.0, label: '1.0x' },
                          { scale: 1.3, label: '1.3x' },
                          { scale: 1.6, label: '1.6x' },
                          { scale: 2.0, label: '2.0x' },
                          { scale: 2.5, label: '2.5x' },
                        ].map(s => {
                          const curScale = selectedElementToStyle === 'host' ? hostTransform.scale :
                            selectedElementToStyle === 'fact' ? factTransform.scale :
                            selectedElementToStyle === 'quote' ? quoteTransform.scale :
                            selectedElementToStyle === 'banner' ? bannerTransform.scale :
                            selectedElementToStyle === 'rating' ? ratingTransform.scale :
                            selectedElementToStyle === 'spoiler' ? spoilerTransform.scale :
                            selectedElementToStyle === 'poster' ? posterTransform.scale :
                            subtitleTransform.scale;
                          const isActive = Math.abs(curScale - s.scale) < 0.05;
                          return (
                            <button
                              key={s.scale}
                              type="button"
                              onClick={() => {
                                if (selectedElementToStyle === 'host') setHostTransform(prev => ({ ...prev, scale: s.scale }));
                                else if (selectedElementToStyle === 'fact') setFactTransform(prev => ({ ...prev, scale: s.scale }));
                                else if (selectedElementToStyle === 'quote') setQuoteTransform(prev => ({ ...prev, scale: s.scale }));
                                else if (selectedElementToStyle === 'banner') setBannerTransform(prev => ({ ...prev, scale: s.scale }));
                                else if (selectedElementToStyle === 'rating') setRatingTransform(prev => ({ ...prev, scale: s.scale }));
                                else if (selectedElementToStyle === 'spoiler') setSpoilerTransform(prev => ({ ...prev, scale: s.scale }));
                                else if (selectedElementToStyle === 'poster') setPosterTransform(prev => ({ ...prev, scale: s.scale }));
                                else if (selectedElementToStyle === 'subtitles') setSubtitleTransform(prev => ({ ...prev, scale: s.scale }));
                              }}
                              className={`py-1 rounded font-bold border transition-all text-center ${
                                isActive
                                  ? 'bg-amber-500 text-black border-amber-400 shadow font-black'
                                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-amber-500/50'
                              }`}
                            >
                              {s.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 0. BACKGROUND & WALLPAPER TAB */}
              {activeTab === 'background' && (
                <div className="space-y-4">
                  {/* Studio Presets Gallery */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-950/40 via-purple-950/40 to-indigo-950/40 border border-pink-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-pink-400" />
                        <span>תבניות סטודיו מוכנות (Presets בלחיצה אחת):</span>
                      </span>
                      <span className="text-[10px] text-pink-300 font-bold">6 עיצובים ויראליים</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {AUDIOGRAM_PRESETS.map(preset => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyStudioPreset(preset)}
                          className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/60 text-right transition-all group flex flex-col justify-between shadow-sm"
                        >
                          <span className="text-xs font-bold text-white group-hover:text-pink-300 block">{preset.name}</span>
                          <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{preset.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Saved Templates Section */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-indigo-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white flex items-center gap-1.5">
                        <Bookmark className="w-4 h-4 text-indigo-400" />
                        <span>התבניות האישיות שלי (My Presets):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsNewTemplateModalOpen(true)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                        <span>שמור עיצוב נוכחי כתבנית</span>
                      </button>
                    </div>

                    {customTemplates.length === 0 ? (
                      <div className="text-center py-3 px-2 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-slate-500 text-[11px]">
                        טרם שמרת תבניות אישיות. לחץ על "שמור עיצוב נוכחי כתבנית" כדי לשמור את הסגנון לשימוש חוזר בכל הפרקים!
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {customTemplates.map(tpl => (
                          <div
                            key={tpl.id}
                            onClick={() => handleApplyTemplate(tpl)}
                            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/60 text-right transition-all group cursor-pointer flex flex-col justify-between shadow-sm relative"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-xs font-bold text-white group-hover:text-indigo-300 block truncate">
                                {tpl.name}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                                className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors shrink-0"
                                title="מחק תבנית"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-400 mt-2">
                              <span className="font-mono">{tpl.config.aspectRatio || '16:9'} • {tpl.config.waveformStyle || 'bars'}</span>
                              <span className="text-indigo-400 font-bold group-hover:underline">החל תבנית ↵</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

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
                            onClick={() => {
                              setStockPickerTarget('background');
                              setIsStockModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
                          >
                            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                            <span>מאגר תמונות & CDN</span>
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

                  {/* Ambient Vignette Switch */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                      <span>🌑 אפקט תאורה היקפית (Vignette):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAmbientVignette(!ambientVignette)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        ambientVignette ? 'bg-pink-600 text-white shadow' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ambientVignette ? 'פעיל ✓' : 'כבוי'}
                    </button>
                  </div>
                </div>
              )}

              {/* 1. WAVEFORM CUSTOMIZATION TAB */}
              {activeTab === 'waveform' && (
                <div className="space-y-4">
                  {/* Waveform Style Selector (10 Styles) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">סגנון גלי הקול (10 סגנונות):</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'circle_bars', label: '🔴 מעגל קורן', desc: 'מעגל גלי קול רדיאלי' },
                        { id: 'neon_glow_wave', label: '⚡ ניאון כפול', desc: 'זוהר עם פעימות' },
                        { id: 'spectrum_3d', label: '✨ עמודי תלת-מימד', desc: 'השתקפות זכוכית' },
                        { id: 'dots_matrix', label: '💡 מטריצת LED', desc: 'נקודות עתידניות' },
                        { id: 'bars', label: '📊 עמודות EQ', desc: 'קפיצות לפי בס וטרבל' },
                        { id: 'sine', label: '〰️ גל סינוס', desc: 'רציף וקלאסי' },
                        { id: 'radial', label: '🎯 פעימות מרכז', desc: 'פולס מרכזי' },
                        { id: 'mirror', label: '🔉 עמודות מראה', desc: 'דו-כיווני' },
                        { id: 'pulse', label: '💓 קו דופק', desc: 'אלקטרוני זוהר' },
                        { id: 'liquid', label: '🌊 גלי ים', desc: 'נוזלי דינמי' }
                      ].map(style => (
                        <button
                          key={style.id}
                          onClick={() => setWaveformStyle(style.id as WaveformStyle)}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-right flex flex-col justify-between ${
                            waveformStyle === style.id
                              ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="block text-xs">{style.label}</span>
                          <span className="text-[9px] opacity-75 font-normal">{style.desc}</span>
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

              {/* 2. OVERLAYS & GRAPHICS TAB (FULL CUSTOMIZATION SUITE) */}
              {activeTab === 'overlays' && (
                <div className="space-y-4">
                  {/* Host Name & Tag Customizer */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <Mic className="w-3.5 h-3.5 text-cyan-400" />
                        <span>תג מגיש התוכנית (Host Tag):</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowHostTag(!showHostTag)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          showHostTag ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {showHostTag ? 'פעיל בפריים ✓' : 'כבוי'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={hostName}
                        onChange={(e) => {
                          const newH = e.target.value;
                          setHostName(newH);
                          if (newH) setShowHostTag(true);
                          const updated: Episode = {
                            ...episode,
                            hostName: newH.trim() || undefined,
                            host: newH.trim() ? { name: newH.trim(), role: hostRole } : undefined
                          };
                          saveEpisode(updated);
                          if (onUpdateEpisode) onUpdateEpisode(updated);
                        }}
                        placeholder="שם המגיש (למשל: עומר אוקון)"
                        className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />

                      <input
                        type="text"
                        value={hostRole}
                        onChange={(e) => {
                          const newR = e.target.value;
                          setHostRole(newR);
                          const updated: Episode = {
                            ...episode,
                            host: hostName ? { name: hostName, role: newR } : undefined
                          };
                          saveEpisode(updated);
                          if (onUpdateEpisode) onUpdateEpisode(updated);
                        }}
                        placeholder="תפקיד (למשל: מנחה ראשי / עורך)"
                        className="w-full p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Host Tag Style Selector */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400 font-bold block">סגנון עיצוב התג:</span>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        {[
                          { id: 'gold_pill', label: '👑 גלולת זהב' },
                          { id: 'neon_border', label: '⚡ ניאון טורקיז' },
                          { id: 'dark_glass', label: '🧊 זכוכית כהה' },
                          { id: 'minimal_text', label: '⚪ נקי' }
                        ].map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setHostTagStyle(st.id as any)}
                            className={`p-1.5 rounded-lg border text-center font-bold transition-all ${
                              hostTagStyle === st.id ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Movie Facts Overlay Customizer */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
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
                      <div className="flex items-center justify-between gap-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
                        <button
                          onClick={() => setSelectedFactIndex(prev => (prev - 1 + movieFacts.length) % movieFacts.length)}
                          className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-medium text-slate-300 truncate max-w-[220px]">
                          {currentFact?.fact}
                        </span>
                        <button
                          onClick={() => setSelectedFactIndex(prev => (prev + 1) % movieFacts.length)}
                          className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Fact Card Style Selector */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400 font-bold block">סגנון כרטיסיית עובדות:</span>
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        {[
                          { id: 'amber_gold', label: '⭐ זהב ענבר' },
                          { id: 'cyan_glow', label: '⚡ ניאון זוהר' },
                          { id: 'dark_glass', label: '🧊 זכוכית' },
                          { id: 'cinema_red', label: '🎬 אדום קולנוע' }
                        ].map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setFactCardStyle(st.id as any)}
                            className={`p-1.5 rounded-lg border text-center font-bold transition-all ${
                              factCardStyle === st.id ? 'bg-amber-600 border-amber-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Quote Overlay Customizer */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                        <Quote className="w-3.5 h-3.5 text-purple-400" />
                        <span>חלונית ציטוט (Quote Overlay):</span>
                      </span>
                      <button
                        onClick={() => setShowQuoteOverlay(!showQuoteOverlay)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          showQuoteOverlay ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {showQuoteOverlay ? 'פעיל ✓' : 'כבוי'}
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={quoteText}
                        onChange={(e) => setQuoteText(e.target.value)}
                        placeholder="טקסט הציטוט..."
                        className="col-span-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500"
                      />
                      <input
                        type="text"
                        value={quoteSpeaker}
                        onChange={(e) => setQuoteSpeaker(e.target.value)}
                        placeholder="שם הדובר..."
                        className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500"
                      />
                    </div>

                    {/* Quote Style Selector */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400 font-bold block">סגנון חלונית הציטוט:</span>
                      <div className="grid grid-cols-3 gap-1 text-[10px]">
                        {[
                          { id: 'velvet_glow', label: '💜 קטיפה זוהרת' },
                          { id: 'quote_ribbon', label: '🎗️ סרט שמאלי' },
                          { id: 'modern_border', label: '🪟 מסגרת שקופה' }
                        ].map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setQuoteCardStyle(st.id as any)}
                            className={`p-1.5 rounded-lg border text-center font-bold transition-all ${
                              quoteCardStyle === st.id ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Title Banner & Poster PIP Styles */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Title Banner */}
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-300">פס כותרת:</span>
                        <button
                          type="button"
                          onClick={() => setShowBannerOverlay(!showBannerOverlay)}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            showBannerOverlay ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {showBannerOverlay ? '✓' : '✗'}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[9px]">
                        {[
                          { id: 'indigo_glass', label: 'אינדיגו' },
                          { id: 'gold_accent', label: 'זהב' },
                          { id: 'cinema_ribbon', label: 'קולנוע' }
                        ].map(st => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setTitleBannerStyle(st.id as any)}
                            className={`p-1 rounded border font-bold ${
                              titleBannerStyle === st.id ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Poster PIP */}
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-pink-300">פוסטר סרט PIP:</span>
                        <button
                          type="button"
                          onClick={() => setShowPosterPip(!showPosterPip)}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            showPosterPip ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {showPosterPip ? 'פעיל ✓' : 'מוסתר'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => posterFileInputRef.current?.click()}
                          className="flex-1 py-1 px-1.5 rounded-lg bg-pink-600/80 hover:bg-pink-600 text-white text-[10px] font-bold flex items-center justify-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>העלה מהמחשב</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setStockPickerTarget('poster');
                            setIsStockModalOpen(true);
                          }}
                          className="flex-1 py-1 px-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1 border border-slate-700"
                        >
                          <FolderOpen className="w-3 h-3" />
                          <span>Bunny CDN</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-[9px]">
                        {[
                          { id: 'rounded_square', label: 'ריבוע' },
                          { id: 'circle', label: 'עיגול' },
                          { id: 'rectangle', label: 'מלבן' }
                        ].map(sh => (
                          <button
                            key={sh.id}
                            type="button"
                            onClick={() => setPosterShape(sh.id as any)}
                            className={`p-1 rounded border font-bold ${
                              posterShape === sh.id ? 'bg-pink-600 text-white' : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            {sh.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Permanent Logo Controls (הלוגו שקבעתי) */}
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
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
                        className="w-14 h-14 rounded-xl object-contain bg-black/60 border border-slate-800 p-1 shrink-0"
                      />
                      <div className="flex-1 space-y-2">
                        <button
                          onClick={() => logoFileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-pink-300 flex items-center gap-1.5 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>החלף קובץ לוגו (PNG / SVG)</span>
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
                              r.onload = () => {
                                const newUrl = r.result as string;
                                setLogoConfig(prev => ({ ...prev, url: newUrl }));
                                savePermanentLogo({ ...logoConfig, url: newUrl });
                              };
                              r.readAsDataURL(file);
                            }
                          }}
                        />

                        {/* Size and Opacity Controls */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>גודל לוגו:</span>
                              <span className="font-mono text-pink-400">{logoConfig.size || 64}px</span>
                            </div>
                            <input
                              type="range"
                              min="32"
                              max="360"
                              value={logoConfig.size || 64}
                              onChange={(e) => {
                                const s = parseInt(e.target.value);
                                setLogoConfig(prev => ({ ...prev, size: s }));
                                savePermanentLogo({ ...logoConfig, size: s });
                              }}
                              className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-500"
                            />
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                              <span>שקיפות:</span>
                              <span className="font-mono text-pink-400">{Math.round((logoConfig.opacity ?? 0.9) * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.05"
                              value={logoConfig.opacity ?? 0.9}
                              onChange={(e) => {
                                const op = parseFloat(e.target.value);
                                setLogoConfig(prev => ({ ...prev, opacity: op }));
                                savePermanentLogo({ ...logoConfig, opacity: op });
                              }}
                              className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-pink-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rating Card Overlay Quick Box */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5" />
                        <span>ציוני סרט וביקורת (Rating Card):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRatingOverlay(!showRatingOverlay)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          showRatingOverlay ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {showRatingOverlay ? 'פעיל בפריים ✓' : 'מוסתר'}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input
                        type="text"
                        value={imdbScore}
                        onChange={(e) => setImdbScore(e.target.value)}
                        placeholder="IMDb"
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-center text-white font-mono"
                      />
                      <input
                        type="text"
                        value={rottenScore}
                        onChange={(e) => setRottenScore(e.target.value)}
                        placeholder="RT"
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-center text-white font-mono"
                      />
                      <input
                        type="text"
                        value={personalScore}
                        onChange={(e) => setPersonalScore(e.target.value)}
                        placeholder="אישי"
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-center text-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Spoiler Alert Quick Box */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>אזהרת ספוילר (Spoiler Alert):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowSpoilerOverlay(!showSpoilerOverlay)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                          showSpoilerOverlay ? 'bg-rose-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {showSpoilerOverlay ? 'פעיל בפריים ✓' : 'מוסתר'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={spoilerText}
                      onChange={(e) => setSpoilerText(e.target.value)}
                      placeholder="נוסח אזהרת הספוילר..."
                      className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                    />
                  </div>

                  {/* Subtitles Quick Box */}
                  <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5" />
                      <span>כתוביות מסונכרנות (Subtitles):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSubtitles(!showSubtitles)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                        showSubtitles ? 'bg-yellow-500 text-slate-950 font-black' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {showSubtitles ? 'פעיל בפריים ✓' : 'מוסתר'}
                    </button>
                  </div>
                </div>
              )}

              {/* 3. AUDIO TRIMMER & SOUND FX TAB */}
              {activeTab === 'trimmer' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Scissors className="w-4 h-4" />
                        <span>חיתוך מקטע מהיר (Reels / Shorts):</span>
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        סה״כ: {formatTime(duration, true)}
                      </span>
                    </div>

                    {/* Quick Clip Presets */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(30, duration));
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 text-center transition-colors"
                      >
                        ⚡ 30 שנ׳ (טיקטוק)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(60, duration));
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 text-center transition-colors"
                      >
                        🎬 60 שנ׳ (Reels)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(90, duration));
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 text-center transition-colors"
                      >
                        🌟 90 שנ׳ (Shorts)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
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

                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">אורך המקטע הנבחר:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatTime(Math.max(0, trimEnd - trimStart), true)}
                      </span>
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
                      יוצר קובץ וידאו באיכות גבוהה עם גלי הקול המונפשים, הרקע, הלוגו, הכתוביות והחלוניות להעלאה ליוטיוב, ספוטיפיי וידאו, אינסטגרם רילס וטיקטוק!
                    </p>

                    {/* Resolution Selector: FHD 1080p vs HD 720p vs 4K */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-slate-300 block">איכות ורזולוציית הווידאו:</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setExportResolution('1080p')}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                            exportResolution === '1080p'
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="font-bold">FHD 1080p</span>
                          <span className="text-[9px] opacity-75">(מומלץ לסושיאל)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportResolution('720p')}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                            exportResolution === '720p'
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="font-bold">HD 720p</span>
                          <span className="text-[9px] opacity-75">(קובץ קל ומהיר)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportResolution('4k')}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                            exportResolution === '4k'
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="font-bold">4K UHD</span>
                          <span className="text-[9px] opacity-75">(איכות מקסימלית)</span>
                        </button>
                      </div>
                    </div>

                    {/* Format Selector: MP4 vs WEBM */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-slate-300 block">פורמט קובץ הווידאו:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setExportFormat('mp4')}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            exportFormat === 'mp4'
                              ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>🎬 MP4 (H.264 / AAC)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setExportFormat('webm')}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                            exportFormat === 'webm'
                              ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span>🌐 WebM (VP9 / Opus)</span>
                        </button>
                      </div>
                    </div>

                    {/* Export Action Button */}
                    <button
                      onClick={handleExportAudiogramVideo}
                      disabled={isExportingVideo || duration === 0}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                    >
                      {isExportingVideo ? (
                        <>
                          <Activity className="w-4 h-4 animate-spin text-white" />
                          <span>מייצא וידאו... ({exportProgress}%)</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>ייצא וידאו {exportFormat.toUpperCase()} עכשיו</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 3. AUDIO TRIMMER & CUTTING TAB */}
              {activeTab === 'trimmer' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Scissors className="w-4 h-4" />
                        <span>חיתוך מקטע מהיר (Reels / Shorts):</span>
                      </h4>
                      <span className="text-[10px] font-mono text-slate-400">
                        סה״כ: {formatTime(duration, true)}
                      </span>
                    </div>

                    {/* Quick Clip Presets */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(30, duration));
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 text-center transition-colors"
                      >
                        ⚡ 30 שנ׳ (טיקטוק)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(60, duration));
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 text-center transition-colors"
                      >
                        🎬 60 שנ׳ (Reels)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTrimStart(0);
                          setTrimEnd(Math.min(90, duration));
                        }}
                        className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 text-center transition-colors"
                      >
                        🌟 90 שנ׳ (Shorts)
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
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

                    <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">אורך המקטע הנבחר:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {formatTime(Math.max(0, trimEnd - trimStart), true)}
                      </span>
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

                    {/* Resolution Selector: FHD 1080p vs HD 720p vs 4K */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-slate-300 block">איכות ורזולוציית הווידאו:</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setExportResolution('1080p')}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                            exportResolution === '1080p'
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="font-black text-xs">💎 Full HD 1080p</span>
                          <span className="text-[10px] text-purple-200 font-mono">1920×1080 (מומלץ)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportResolution('720p')}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                            exportResolution === '720p'
                              ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="font-black text-xs">⚡ HD 720p</span>
                          <span className="text-[10px] text-indigo-200 font-mono">1280×720 (מהיר)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportResolution('4k')}
                          className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all ${
                            exportResolution === '4k'
                              ? 'bg-gradient-to-r from-amber-600 to-rose-600 border-amber-400 text-white shadow-lg shadow-amber-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="font-black text-xs">🚀 4K Ultra HD</span>
                          <span className="text-[10px] text-amber-200 font-mono">3840×2160 (מקסימום)</span>
                        </button>
                      </div>
                    </div>

                    {/* Format Selector: MP4 vs WebM */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-slate-300 block">פורמט קובץ הווידאו לייצוא:</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setExportFormat('mp4')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            exportFormat === 'mp4'
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Film className="w-3.5 h-3.5" />
                          <span>🎬 MP4 (H.264 / AAC - מומלץ)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setExportFormat('webm')}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            exportFormat === 'webm'
                              ? 'bg-gradient-to-r from-cyan-600 to-teal-600 border-cyan-400 text-white shadow-lg shadow-cyan-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>🌐 WebM (Google / Web)</span>
                        </button>
                      </div>
                    </div>

                    {/* Duration Notice */}
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-purple-500/30 flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-400" />
                        <span>משך הווידאו שייוצר:</span>
                      </span>
                      <span className="font-mono font-bold text-purple-300">
                        {formatTime(trimEnd > trimStart ? trimEnd - trimStart : duration, true)}
                      </span>
                    </div>

                    {/* Helpful Speed Tip */}
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 leading-snug">
                      💡 <strong>איכות Full HD מובטחת</strong>: הרינדור מבוצע באיכות 1080p FHD גבוהה (12 Mbps). לקבלת סרטון מהיר לרשתות, ניתן לחתוך ל-30–60 שניות בלשונית ה-<strong>✂️ חיתוך</strong>.
                    </div>

                    {isExportingVideo && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs text-purple-300 font-bold">
                          <span>מייצא וידאו {exportResolution.toUpperCase()} {exportFormat.toUpperCase()}...</span>
                          <span className="font-mono">{exportProgress}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 rounded-full transition-all duration-300"
                            style={{ width: `${exportProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleExportAudiogramVideo}
                      disabled={isExportingVideo}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-xs shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>{isExportingVideo ? `מרנדר וידאו (${exportResolution.toUpperCase()} ${exportFormat.toUpperCase()})...` : `ייצא והורד וידאו ב-${exportResolution === '1080p' ? 'Full HD 1080p' : exportResolution.toUpperCase()} (${exportFormat.toUpperCase()})`}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Image, Poster & Logo Picker Modal */}
      {isStockModalOpen && (
        <ImageStockPickerModal
          isOpen={isStockModalOpen}
          initialTarget={stockPickerTarget}
          onClose={() => setIsStockModalOpen(false)}
          onSelectImage={(url) => {
            if (stockPickerTarget === 'poster') {
              setPosterUrl(url);
              setShowPosterPip(true);
            } else if (stockPickerTarget === 'logo') {
              setLogoConfig(prev => ({ ...prev, url, show: true }));
              savePermanentLogo({ ...logoConfig, url, showByDefault: true });
            } else {
              setCustomBgImage(url);
              setBgType('image');
            }
            setIsStockModalOpen(false);
          }}
        />
      )}

      {/* Modal for Saving New Custom Template */}
      {isNewTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-indigo-400" />
                <span>שמירת תבנית עיצוב אישית</span>
              </h4>
              <button
                onClick={() => setIsNewTemplateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              התבנית תשמור את כל הגדרות הרקע, גלי הקול, הצבעים, הפונטים ומיקומי האלמנטים שעיצבת, ותאפשר להחיל אותם בלחיצה אחת על כל פרק אחר.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400">שם התבנית:</label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="למשל: סגנון סייברפאנק לרילס / קולנוע יוקרתי"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveAsTemplate(newTemplateName);
                }}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsNewTemplateModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                ביטול
              </button>
              <button
                onClick={() => handleSaveAsTemplate(newTemplateName)}
                disabled={!newTemplateName.trim()}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white disabled:opacity-50 transition-all shadow"
              >
                שמור תבנית
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
