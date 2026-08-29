'use client';

import React, { useState, useRef } from 'react';
import { LiveOverlayState, Episode, ElementTransform } from '@/lib/types';
import { 
  Tv, 
  Image as ImageIcon, 
  Quote, 
  Star, 
  AlertTriangle, 
  Type, 
  Check, 
  X, 
  Sparkles, 
  Eye, 
  EyeOff, 
  Move, 
  Maximize2, 
  RotateCcw, 
  Sliders, 
  Upload,
  FolderOpen,
  Award,
  ShieldAlert,
  Film
} from 'lucide-react';
import ImageStockPickerModal from './ImageStockPickerModal';
import { MovieFactCard } from '@/lib/types';
import { savePermanentLogo, getPermanentLogo } from '@/lib/storage';

interface LiveBroadcastDeckProps {
  episode: Episode;
  overlayState: LiveOverlayState;
  onUpdateOverlay: (updates: Partial<LiveOverlayState>) => void;
}

export default function LiveBroadcastDeck({
  episode,
  overlayState,
  onUpdateOverlay
}: LiveBroadcastDeckProps) {
  const [activeTab, setActiveTab] = useState<'logo' | 'poster' | 'quote' | 'rating' | 'banner' | 'spoiler' | 'facts'>('logo');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockPickerTarget, setStockPickerTarget] = useState<'poster' | 'logo'>('poster');
  const [isPermanentSaved, setIsPermanentSaved] = useState(false);
  const movieFacts = episode.movieFacts || [];

  // Input states
  const [logoUrl, setLogoUrl] = useState(overlayState.logo?.url || 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&q=80');
  const [logoOpacity, setLogoOpacity] = useState(overlayState.logo?.opacity ?? 0.9);
  const [logoSize, setLogoSize] = useState(overlayState.logo?.size ?? 64);
  const [logoPreset, setLogoPreset] = useState<'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center'>(overlayState.logo?.positionPreset || 'top-right');
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [posterUrl, setPosterUrl] = useState(overlayState.poster?.url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&q=80');
  const [posterTitle, setPosterTitle] = useState(overlayState.poster?.title || episode.title);

  const [quoteText, setQuoteText] = useState(overlayState.quote?.text || '״אסור לך לפחד לחלום קצת יותר בגדול...״');
  const [quoteSpeaker, setQuoteSpeaker] = useState(overlayState.quote?.speaker || 'אימס (Eames)');

  const [imdbScore, setImdbScore] = useState(overlayState.rating?.imdb || '8.8');
  const [rottenScore, setRottenScore] = useState(overlayState.rating?.rottenTomatoes || '94%');
  const [personalScore, setPersonalScore] = useState(overlayState.rating?.personalScore || '9.0/10');

  const [customTitle, setCustomTitle] = useState(overlayState.customBanner?.title || episode.title);
  const [customSubtitle, setCustomSubtitle] = useState(overlayState.customBanner?.subtitle || 'ניתוח מיוחד באולפן');

  // 1. Logo Position Preset Applyer
  const applyLogoPreset = (preset: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center') => {
    setLogoPreset(preset);
    let coords = { x: 88, y: 5 };
    switch (preset) {
      case 'top-left': coords = { x: 5, y: 5 }; break;
      case 'top-center': coords = { x: 46, y: 5 }; break;
      case 'top-right': coords = { x: 88, y: 5 }; break;
      case 'bottom-left': coords = { x: 5, y: 82 }; break;
      case 'bottom-center': coords = { x: 46, y: 82 }; break;
      case 'bottom-right': coords = { x: 88, y: 82 }; break;
    }

    onUpdateOverlay({
      logo: {
        ...overlayState.logo,
        show: true,
        url: logoUrl,
        opacity: logoOpacity,
        size: logoSize,
        positionPreset: preset,
        transform: { ...overlayState.logo?.transform, ...coords, scale: overlayState.logo?.transform?.scale || 1.0 }
      }
    });
  };

  const toggleLogo = () => {
    onUpdateOverlay({
      logo: {
        ...overlayState.logo,
        show: !overlayState.logo?.show,
        url: logoUrl,
        opacity: logoOpacity,
        size: logoSize,
        positionPreset: logoPreset,
        transform: overlayState.logo?.transform || { x: 88, y: 5, scale: 1.0 }
      }
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLogoUrl(dataUrl);
      onUpdateOverlay({
        logo: {
          ...overlayState.logo,
          show: true,
          url: dataUrl,
          opacity: logoOpacity,
          size: logoSize,
          positionPreset: logoPreset,
          transform: overlayState.logo?.transform || { x: 88, y: 5, scale: 1.0 }
        }
      });
    };
    reader.readAsDataURL(file);
  };

  // Quick Toggle Helpers
  const togglePoster = () => {
    onUpdateOverlay({
      poster: {
        ...overlayState.poster,
        show: !overlayState.poster?.show,
        url: posterUrl,
        title: posterTitle
      }
    });
  };

  const toggleQuote = () => {
    onUpdateOverlay({
      quote: {
        ...overlayState.quote,
        show: !overlayState.quote?.show,
        text: quoteText,
        speaker: quoteSpeaker
      }
    });
  };

  const toggleRating = () => {
    onUpdateOverlay({
      rating: {
        ...overlayState.rating,
        show: !overlayState.rating?.show,
        imdb: imdbScore,
        rottenTomatoes: rottenScore,
        personalScore: personalScore
      }
    });
  };

  const toggleCustomBanner = () => {
    onUpdateOverlay({
      customBanner: {
        ...overlayState.customBanner,
        show: !overlayState.customBanner?.show,
        title: customTitle,
        subtitle: customSubtitle
      }
    });
  };

  const toggleSpoiler = () => {
    onUpdateOverlay({
      spoilerAlert: {
        ...overlayState.spoilerAlert,
        show: !overlayState.spoilerAlert?.show,
        text: 'זהירות: ספוילרים קריטיים לעלילה!'
      }
    });
  };

  const toggleLayoutEditMode = () => {
    onUpdateOverlay({
      isLayoutEditMode: !overlayState.isLayoutEditMode
    });
  };

  const resetAllTransforms = () => {
    onUpdateOverlay({
      logo: {
        ...overlayState.logo,
        positionPreset: 'top-right',
        transform: { x: 88, y: 5, scale: 1.0 }
      },
      poster: {
        ...overlayState.poster,
        transform: { x: 4, y: 8, scale: 1.0 }
      },
      quote: {
        ...overlayState.quote,
        transform: { x: 18, y: 68, scale: 1.0 }
      },
      rating: {
        ...overlayState.rating,
        transform: { x: 74, y: 10, scale: 1.0 }
      },
      customBanner: {
        ...overlayState.customBanner,
        transform: { x: 48, y: 74, scale: 1.0 }
      },
      spoilerAlert: {
        ...overlayState.spoilerAlert,
        transform: { x: 28, y: 4, scale: 1.0 }
      }
    });
  };

  const hideAllOverlays = () => {
    onUpdateOverlay({
      logo: { ...overlayState.logo, show: false },
      poster: { ...overlayState.poster, show: false },
      quote: { ...overlayState.quote, show: false },
      rating: { ...overlayState.rating, show: false },
      customBanner: { ...overlayState.customBanner, show: false },
      spoilerAlert: { ...overlayState.spoilerAlert, show: false }
    });
  };

  const updateScale = (target: 'logo' | 'poster' | 'quote' | 'rating' | 'customBanner' | 'spoilerAlert', delta: number) => {
    const current = overlayState[target]?.transform || { x: 50, y: 50, scale: 1.0 };
    onUpdateOverlay({
      [target]: {
        ...overlayState[target],
        transform: {
          ...current,
          scale: delta
        }
      }
    });
  };

  const hasAnyActiveOverlay = 
    overlayState.logo?.show ||
    overlayState.poster?.show || 
    overlayState.quote?.show || 
    overlayState.rating?.show || 
    overlayState.customBanner?.show || 
    overlayState.spoilerAlert?.show;

  return (
    <div className="p-3.5 rounded-2xl bg-[#121620] border border-slate-800 shadow-xl space-y-3 font-sans">
      {/* Top Header & Layout Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-pink-600/20 text-pink-400 border border-pink-500/30">
            <Tv className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <span>לוח גרפיקה ואוברלייז לשידור חי</span>
              {hasAnyActiveOverlay && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400">לוגו מותג בקצוות, פוסטרים, ציונים, ציטוטים ובאנרים נגררים</p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleLayoutEditMode}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              overlayState.isLayoutEditMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black animate-pulse'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800'
            }`}
            title="מצב עריכת מיקומים מאפשר גרירה ושינוי גודל על גבי הווידאו"
          >
            <Move className="w-3 h-3" />
            <span>{overlayState.isLayoutEditMode ? 'סיום הזזה' : 'הזזת אלמנטים'}</span>
          </button>

          <button
            onClick={resetAllTransforms}
            className="text-[10px] text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg flex items-center gap-1"
            title="אפס מיקומים וגדלים של כל הגרפיקה לברירת מחדל"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">איפוס מיקומים</span>
          </button>

          {hasAnyActiveOverlay && (
            <button
              onClick={hideAllOverlays}
              className="text-[10px] text-rose-400 hover:text-rose-300 font-bold bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg flex items-center gap-1"
            >
              <EyeOff className="w-3 h-3" />
              <span>הסתר הכל</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs (7 Overlays Tabs) */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('logo')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'logo' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Award className="w-3 h-3" />
          <span>לוגו מותג</span>
        </button>

        <button
          onClick={() => setActiveTab('facts')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'facts' ? 'bg-amber-500 text-slate-950 shadow font-black' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Film className="w-3 h-3" />
          <span>עובדות ({movieFacts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('poster')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'poster' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <ImageIcon className="w-3 h-3" />
          <span>פוסטר</span>
        </button>

        <button
          onClick={() => setActiveTab('quote')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'quote' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Quote className="w-3 h-3" />
          <span>ציטוט</span>
        </button>

        <button
          onClick={() => setActiveTab('rating')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'rating' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Star className="w-3 h-3" />
          <span>ציונים</span>
        </button>

        <button
          onClick={() => setActiveTab('spoiler')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'spoiler' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          <span>ספוילר</span>
        </button>

        <button
          onClick={() => setActiveTab('banner')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all ${
            activeTab === 'banner' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Type className="w-3 h-3" />
          <span>באנר</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 space-y-3">
        {/* 1. Logo & Watermark Tab */}
        {activeTab === 'logo' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">לוגו שידור וסימן מים:</span>
                <span className="text-[10px] text-slate-400">ניתן לגרירה חופשית או מיקום מהיר בקצוות</span>
              </div>

              <button
                onClick={toggleLogo}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  overlayState.logo?.show 
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' 
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {overlayState.logo?.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{overlayState.logo?.show ? 'הסר לוגו' : 'הצג לוגו'}</span>
              </button>
            </div>

            {/* Logo Positioning Grid (6 Presets: Corners & Centers) */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                <span>מיקום מהיר בפריים (קצוות ומרכז למעלה/למטה):</span>
              </label>
              
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {[
                  { id: 'top-left', label: '↖️ שמאל למעלה' },
                  { id: 'top-center', label: '⬆️ מרכז למעלה' },
                  { id: 'top-right', label: '↗️ ימין למעלה' },
                  { id: 'bottom-left', label: '↙️ שמאל למטה' },
                  { id: 'bottom-center', label: '⬇️ מרכז למטה' },
                  { id: 'bottom-right', label: '↘️ ימין למטה' }
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => applyLogoPreset(pos.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all ${
                      logoPreset === pos.id 
                        ? 'bg-pink-600 border-pink-400 text-white shadow-md' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Image & Controls Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
              {/* Preview Thumbnail */}
              <div className="sm:col-span-3 flex items-center gap-3">
                <div 
                  onClick={() => logoFileInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-700 bg-black/80 shrink-0 relative group cursor-pointer flex items-center justify-center p-1.5 shadow-inner"
                  title="לחצו להעלאת קובץ לוגו (PNG שקוף / JPG / SVG)"
                >
                  <img
                    src={logoUrl}
                    alt="Logo Preview"
                    className="max-w-full max-h-full object-contain group-hover:opacity-75 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs font-bold text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>העלאת לוגו מהמחשב</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockPickerTarget('logo');
                      setIsStockModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                  >
                    <FolderOpen className="w-3 h-3" />
                    <span>ממאגר Bunny CDN</span>
                  </button>
                  <input
                    ref={logoFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Sliders: Opacity & Size */}
              <div className="sm:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                {/* Size Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-bold">
                    <span>גודל לוגו:</span>
                    <span className="font-mono text-pink-400">{logoSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={32}
                    max={180}
                    value={logoSize}
                    onChange={(e) => {
                      const sz = parseInt(e.target.value);
                      setLogoSize(sz);
                      onUpdateOverlay({
                        logo: {
                          ...overlayState.logo,
                          size: sz
                        }
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                </div>

                {/* Opacity Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-bold">
                    <span>שקיפות (Watermark):</span>
                    <span className="font-mono text-pink-400">{Math.round(logoOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={1.0}
                    step={0.05}
                    value={logoOpacity}
                    onChange={(e) => {
                      const op = parseFloat(e.target.value);
                      setLogoOpacity(op);
                      onUpdateOverlay({
                        logo: {
                          ...overlayState.logo,
                          opacity: op
                        }
                      });
                    }}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* Permanent Logo Saver Bar */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-slate-950 border border-pink-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>הגדרת לוגו קבוע (Permanent Watermark)</span>
                </span>
                <p className="text-[11px] text-slate-400">
                  שמירת הלוגו, המיקום והשקיפות כברירת מחדל קבועה שתיטען אוטומטית בכל הפרקים וההקלטות
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  savePermanentLogo({
                    url: logoUrl,
                    opacity: logoOpacity,
                    size: logoSize,
                    positionPreset: logoPreset,
                    showByDefault: overlayState.logo?.show ?? true,
                    transform: overlayState.logo?.transform
                  }, episode.podcastId);
                  setIsPermanentSaved(true);
                  setTimeout(() => setIsPermanentSaved(false), 3000);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-lg active:scale-95 ${
                  isPermanentSaved
                    ? 'bg-emerald-600 text-white shadow-emerald-600/30 font-black'
                    : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-pink-600/30'
                }`}
              >
                {isPermanentSaved ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>✓ הלוגו נשמר כקבוע!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>קבע כלוגו קבוע לפודקאסט</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 2. Poster PiP */}
        {activeTab === 'poster' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">תמונת פוסטר (ניתנת לגרירה):</span>
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                  <span className="text-slate-400">גודל:</span>
                  <button onClick={() => updateScale('poster', 0.75)} className={`px-1 rounded ${overlayState.poster?.transform?.scale === 0.75 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>S</button>
                  <button onClick={() => updateScale('poster', 1.0)} className={`px-1 rounded ${overlayState.poster?.transform?.scale === 1.0 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>M</button>
                  <button onClick={() => updateScale('poster', 1.35)} className={`px-1 rounded ${overlayState.poster?.transform?.scale === 1.35 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>L</button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setStockPickerTarget('poster');
                    setIsStockModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold transition-all active:scale-98"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>מאגר פוסטרים והעלאת קובץ</span>
                </button>

                <button
                  onClick={togglePoster}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    overlayState.poster?.show 
                      ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' 
                      : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                >
                  {overlayState.poster?.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{overlayState.poster?.show ? 'הסר מהמסך' : 'הצג על המסך'}</span>
                </button>
              </div>
            </div>

            {/* Poster Preview & Title Inputs */}
            <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-950/80 border border-slate-800">
              <div 
                onClick={() => {
                  setStockPickerTarget('poster');
                  setIsStockModalOpen(true);
                }}
                className="w-12 h-16 rounded-lg overflow-hidden border border-slate-700 bg-black shrink-0 relative group cursor-pointer"
                title="לחצו להחלפת תמונה ממאגר או מהמחשב"
              >
                <img
                  src={posterUrl}
                  alt="Poster Preview"
                  className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                  <Upload className="w-4 h-4 text-white" />
                </div>
              </div>

              <div className="flex-1 space-y-1.5">
                <input
                  type="text"
                  value={posterTitle}
                  onChange={(e) => {
                    setPosterTitle(e.target.value);
                    if (overlayState.poster?.show) {
                      onUpdateOverlay({
                        poster: { ...overlayState.poster, title: e.target.value }
                      });
                    }
                  }}
                  placeholder="כותרת הפוסטר (יוצג מתחת לתמונה)"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>💡 ניתן לגרור את הפוסטר לכל מקום בפריים</span>
                  <button
                    onClick={() => {
                      setStockPickerTarget('poster');
                      setIsStockModalOpen(true);
                    }}
                    className="text-pink-400 hover:text-pink-300 font-semibold"
                  >
                    החלף תמונה...
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Quote Lower-Third */}
        {activeTab === 'quote' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">ציטוט קולנועי / באנר אמירה:</span>
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                  <span className="text-slate-400">גודל:</span>
                  <button onClick={() => updateScale('quote', 0.85)} className={`px-1 rounded ${overlayState.quote?.transform?.scale === 0.85 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>S</button>
                  <button onClick={() => updateScale('quote', 1.0)} className={`px-1 rounded ${overlayState.quote?.transform?.scale === 1.0 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>M</button>
                  <button onClick={() => updateScale('quote', 1.25)} className={`px-1 rounded ${overlayState.quote?.transform?.scale === 1.25 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>L</button>
                </div>
              </div>

              <button
                onClick={toggleQuote}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  overlayState.quote?.show 
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' 
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {overlayState.quote?.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{overlayState.quote?.show ? 'הסר מהמסך' : 'הצג על המסך'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <textarea
                value={quoteText}
                onChange={(e) => {
                  setQuoteText(e.target.value);
                  if (overlayState.quote?.show) {
                    onUpdateOverlay({
                      quote: { ...overlayState.quote, text: e.target.value }
                    });
                  }
                }}
                rows={2}
                placeholder="הקלד ציטוט או אמירה בולטת מהפרק..."
                className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500 resize-none"
              />

              <input
                type="text"
                value={quoteSpeaker}
                onChange={(e) => {
                  setQuoteSpeaker(e.target.value);
                  if (overlayState.quote?.show) {
                    onUpdateOverlay({
                      quote: { ...overlayState.quote, speaker: e.target.value }
                    });
                  }
                }}
                placeholder="שם הדובר / הסרט (לדוגמה: אימס מתוך Inception)"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>
        )}

        {/* 4. Ratings Card */}
        {activeTab === 'rating' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">כרטיסיית ציונים וביקורת:</span>
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                  <span className="text-slate-400">גודל:</span>
                  <button onClick={() => updateScale('rating', 0.85)} className={`px-1 rounded ${overlayState.rating?.transform?.scale === 0.85 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>S</button>
                  <button onClick={() => updateScale('rating', 1.0)} className={`px-1 rounded ${overlayState.rating?.transform?.scale === 1.0 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>M</button>
                  <button onClick={() => updateScale('rating', 1.25)} className={`px-1 rounded ${overlayState.rating?.transform?.scale === 1.25 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>L</button>
                </div>
              </div>

              <button
                onClick={toggleRating}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  overlayState.rating?.show 
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' 
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {overlayState.rating?.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{overlayState.rating?.show ? 'הסר מהמסך' : 'הצג על המסך'}</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-amber-400 font-bold">⭐ ציון IMDb:</label>
                <input
                  type="text"
                  value={imdbScore}
                  onChange={(e) => {
                    setImdbScore(e.target.value);
                    if (overlayState.rating?.show) {
                      onUpdateOverlay({ rating: { ...overlayState.rating, imdb: e.target.value } });
                    }
                  }}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-rose-400 font-bold">🍅 Rotten Tomatoes:</label>
                <input
                  type="text"
                  value={rottenScore}
                  onChange={(e) => {
                    setRottenScore(e.target.value);
                    if (overlayState.rating?.show) {
                      onUpdateOverlay({ rating: { ...overlayState.rating, rottenTomatoes: e.target.value } });
                    }
                  }}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-emerald-400 font-bold">🏆 ציון המגיש:</label>
                <input
                  type="text"
                  value={personalScore}
                  onChange={(e) => {
                    setPersonalScore(e.target.value);
                    if (overlayState.rating?.show) {
                      onUpdateOverlay({ rating: { ...overlayState.rating, personalScore: e.target.value } });
                    }
                  }}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. Spoiler Alert Banner */}
        {activeTab === 'spoiler' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-300">באנר אזהרת ספוילר:</span>
                <span className="text-[10px] text-slate-400">אזהרה בולטת למאזינים ולצופים</span>
              </div>

              <button
                onClick={toggleSpoiler}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  overlayState.spoilerAlert?.show 
                    ? 'bg-amber-600 text-slate-950 shadow-lg shadow-amber-600/30 font-black' 
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {overlayState.spoilerAlert?.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{overlayState.spoilerAlert?.show ? 'הסר אזהרה' : 'הפעל אזהרת ספוילר'}</span>
              </button>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>הפעלת באנר אזהרת ספוילר מהבהב באולפן בזמן דיון על סוף הסרט או טוויסטים בעלילה.</span>
            </div>
          </div>
        )}

        {/* 6. Custom Title Lower-Third */}
        {activeTab === 'banner' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300">באנר כותרת אישי:</span>
                <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 text-[10px]">
                  <span className="text-slate-400">גודל:</span>
                  <button onClick={() => updateScale('customBanner', 0.85)} className={`px-1 rounded ${overlayState.customBanner?.transform?.scale === 0.85 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>S</button>
                  <button onClick={() => updateScale('customBanner', 1.0)} className={`px-1 rounded ${overlayState.customBanner?.transform?.scale === 1.0 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>M</button>
                  <button onClick={() => updateScale('customBanner', 1.25)} className={`px-1 rounded ${overlayState.customBanner?.transform?.scale === 1.25 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>L</button>
                </div>
              </div>

              <button
                onClick={toggleCustomBanner}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  overlayState.customBanner?.show 
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' 
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {overlayState.customBanner?.show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{overlayState.customBanner?.show ? 'הסר מהמסך' : 'הצג על המסך'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={customTitle}
                onChange={(e) => {
                  setCustomTitle(e.target.value);
                  if (overlayState.customBanner?.show) {
                    onUpdateOverlay({
                      customBanner: { ...overlayState.customBanner, title: e.target.value }
                    });
                  }
                }}
                placeholder="כותרת ראשית (לדוגמה: שם הפרק או הפינה)"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />

              <input
                type="text"
                value={customSubtitle}
                onChange={(e) => {
                  setCustomSubtitle(e.target.value);
                  if (overlayState.customBanner?.show) {
                    onUpdateOverlay({
                      customBanner: { ...overlayState.customBanner, subtitle: e.target.value }
                    });
                  }
                }}
                placeholder="כותרת משנה (לדוגמה: מנתחים את יצירת המופת)"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>
        )}

        {/* 7. Movie Facts Overlay Selector */}
        {activeTab === 'facts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-300">הצגת כרטיסיות עובדות על המסך:</span>
                <span className="text-[10px] text-slate-400">באנר מאומת מ-IMDb/ויקיפדיה</span>
              </div>

              {overlayState.factCard?.show && (
                <button
                  onClick={() => onUpdateOverlay({ factCard: { ...overlayState.factCard!, show: false } })}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>הסר מהמסך</span>
                </button>
              )}
            </div>

            {movieFacts.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {movieFacts.map((fact) => {
                  const isShowing = overlayState.factCard?.show && overlayState.factCard.fact?.id === fact.id;
                  return (
                    <div
                      key={fact.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-3 transition-all ${
                        isShowing
                          ? 'bg-amber-950/40 border-amber-500 text-white shadow-lg ring-1 ring-amber-500/30'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
                            {fact.source}
                          </span>
                          {fact.ratingScore && (
                            <span className="text-[9px] font-mono font-bold text-amber-400">
                              ⭐ {fact.ratingScore}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] truncate font-medium">{fact.fact}</p>
                      </div>

                      <button
                        onClick={() => {
                          const isCurrentlyShowingThis = overlayState.factCard?.show && overlayState.factCard.fact?.id === fact.id;
                          onUpdateOverlay({
                            factCard: {
                              show: !isCurrentlyShowingThis,
                              fact: !isCurrentlyShowingThis ? fact : overlayState.factCard?.fact || null,
                              transform: overlayState.factCard?.transform || { x: 20, y: 72, scale: 1.0 }
                            }
                          });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 flex items-center gap-1 transition-all ${
                          isShowing
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow'
                        }`}
                      >
                        {isShowing ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isShowing ? 'הסר' : 'הצג'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs">
                אין כרטיסיות עובדות זמינות לפרק זה. הוסף כרטיסיות בלשונית המחקר.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stock Image & Poster & Logo Picker Modal */}
      <ImageStockPickerModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        onSelectImage={(url, title) => {
          if (stockPickerTarget === 'logo') {
            setLogoUrl(url);
            onUpdateOverlay({
              logo: {
                ...overlayState.logo,
                show: true,
                url,
                opacity: logoOpacity,
                size: logoSize,
                positionPreset: logoPreset,
                transform: overlayState.logo?.transform || { x: 88, y: 5, scale: 1.0 }
              }
            });
          } else {
            setPosterUrl(url);
            if (title) setPosterTitle(title);
            onUpdateOverlay({
              poster: {
                ...overlayState.poster,
                show: true,
                url,
                title: title || posterTitle
              }
            });
          }
          setIsStockModalOpen(false);
        }}
      />
    </div>
  );
}
