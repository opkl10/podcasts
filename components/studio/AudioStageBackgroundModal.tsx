'use client';

import React, { useState, useRef } from 'react';
import { 
  Palette, 
  Image as ImageIcon, 
  Upload, 
  Sliders, 
  Check, 
  X, 
  Sparkles, 
  Eye, 
  Flame, 
  Activity, 
  Save, 
  Trash2,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { AudioStageConfig, saveAudioStageConfig } from '@/lib/storage';
import ImageStockPickerModal from './ImageStockPickerModal';

export const AUDIO_STAGE_PRESETS = [
  { id: 'obsidian', name: 'Obsidian Void', style: 'linear-gradient(180deg, #090d16 0%, #03060d 100%)', sampleColor: '#090d16' },
  { id: 'cyberpunk', name: 'Neon Cyberpunk', style: 'linear-gradient(135deg, #1e1035 0%, #0c0824 50%, #050814 100%)', sampleColor: '#1e1035' },
  { id: 'cinema', name: 'Cinema Velvet', style: 'linear-gradient(180deg, #1a0f0f 0%, #0d0606 50%, #000000 100%)', sampleColor: '#1a0f0f' },
  { id: 'galaxy', name: 'Cosmic Galaxy', style: 'linear-gradient(135deg, #110d2b 0%, #060b1e 50%, #02030a 100%)', sampleColor: '#110d2b' },
  { id: 'gold', name: 'Golden Luxury', style: 'linear-gradient(135deg, #1c1508 0%, #0f0c05 50%, #050402 100%)', sampleColor: '#1c1508' },
  { id: 'emerald', name: 'Emerald Studio', style: 'linear-gradient(180deg, #061a14 0%, #030d0a 50%, #010403 100%)', sampleColor: '#061a14' },
  { id: 'slate', name: 'Midnight Studio', style: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)', sampleColor: '#0f172a' },
  { id: 'royal', name: 'Royal Indigo', style: 'linear-gradient(135deg, #1e1b4b 0%, #0f0b2e 50%, #030712 100%)', sampleColor: '#1e1b4b' }
];

export const WAVEFORM_GRADIENT_PRESETS = [
  { id: 'cyberpunk', name: 'Cyberpunk (ורוד לציאן)', start: '#ec4899', end: '#06b6d4' },
  { id: 'sunset', name: 'Sunset Flame (ענבר לאדום)', start: '#f59e0b', end: '#ef4444' },
  { id: 'galaxy', name: 'Cosmic Galaxy (אינדיגו לסגול)', start: '#6366f1', end: '#d946ef' },
  { id: 'emerald', name: 'Emerald Stream (ירוק לטורקיז)', start: '#10b981', end: '#3b82f6' },
  { id: 'gold', name: 'Golden Glow (זהב לענבר)', start: '#fbbf24', end: '#b45309' },
  { id: 'pure_white', name: 'Neon White (לבן לציאן)', start: '#ffffff', end: '#38bdf8' }
];

interface AudioStageBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AudioStageConfig;
  onChangeConfig: (newConfig: AudioStageConfig) => void;
  podcastId?: string;
}

export default function AudioStageBackgroundModal({
  isOpen,
  onClose,
  config,
  onChangeConfig,
  podcastId
}: AudioStageBackgroundModalProps) {
  const [activeTab, setActiveTab] = useState<'preset' | 'image' | 'solid'>((config.bgType as any) || 'preset');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string) => {
    setActiveTab('preset');
    const updated: AudioStageConfig = {
      ...config,
      bgType: 'preset',
      presetId
    };
    onChangeConfig(updated);
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        setActiveTab('image');
        const updated: AudioStageConfig = {
          ...config,
          bgType: 'image',
          customBgImage: url
        };
        onChangeConfig(updated);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSelectStockImage = (url: string) => {
    setActiveTab('image');
    const updated: AudioStageConfig = {
      ...config,
      bgType: 'image',
      customBgImage: url
    };
    onChangeConfig(updated);
  };

  const handleSaveAsDefault = () => {
    saveAudioStageConfig(config, podcastId);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none animate-in fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-[#0f121a] border border-slate-800 shadow-2xl overflow-hidden flex flex-col space-y-5 p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 text-slate-950 shadow-lg shadow-amber-500/20">
              <Palette className="w-6 h-6 font-black" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>עיצוב רקע וידאו-קאסט (Audio Stage Design)</span>
              </h3>
              <p className="text-xs text-slate-400">
                קבעו את הרקע, הצבעים וגלי הקול שיוצגו בשידור חי ובייצוא פרקי אודיו
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

        {/* Tab Switcher: Presets / Custom Image / Solid Color */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => {
              setActiveTab('preset');
              onChangeConfig({ ...config, bgType: 'preset' });
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'preset'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>ערכות קולנוע מוכנות</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('image');
              onChangeConfig({ ...config, bgType: 'image' });
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'image'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>תמונת רקע מותאמת</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('solid');
              onChangeConfig({ ...config, bgType: 'solid' });
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'solid'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>צבע אחיד</span>
          </button>
        </div>

        {/* Presets Grid */}
        {activeTab === 'preset' && (
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 block">בחר ערכת רקע ואווירה:</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {AUDIO_STAGE_PRESETS.map((p) => {
                const isSelected = config.bgType === 'preset' && config.presetId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    className={`h-20 rounded-2xl p-2.5 flex flex-col justify-end text-right border transition-all relative overflow-hidden group ${
                      isSelected
                        ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                    style={{ background: p.style }}
                  >
                    <span className="text-[11px] font-bold text-white relative z-10">{p.name}</span>
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center z-10">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Image Upload / Stock Picker */}
        {activeTab === 'image' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Upload className="w-4 h-4" />
                <span>העלה תמונה מהמחשב</span>
              </button>

              <button
                onClick={() => setIsStockModalOpen(true)}
                className="flex-1 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <FolderOpen className="w-4 h-4 text-purple-400" />
                <span>בחר ממאגר רקעים וקולנוע</span>
              </button>
            </div>

            {/* Custom Image Preview & Blur Controls */}
            {config.customBgImage && (
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 rounded-xl overflow-hidden bg-black border border-white/10 shrink-0">
                    <img src={config.customBgImage} alt="Custom Background" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <span className="text-white font-bold block">תמונת רקע פעילה</span>
                    <span className="text-slate-400 text-[11px]">מוחלת על מסך האולפן והייצוא</span>
                  </div>
                  <button
                    onClick={() => onChangeConfig({ ...config, customBgImage: '', bgType: 'preset' })}
                    className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-xl transition-colors"
                    title="הסר תמונה"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Blur Slider */}
                <div className="space-y-1 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">טשטוש רקע (Background Blur):</span>
                    <span className="font-mono text-indigo-300">{config.bgBlur || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={config.bgBlur || 0}
                    onChange={(e) => onChangeConfig({ ...config, bgBlur: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Darken Overlay Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-semibold">הכהיית רקע (Darken Dim):</span>
                    <span className="font-mono text-indigo-300">{config.bgDarken || 20}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="80"
                    step="5"
                    value={config.bgDarken ?? 20}
                    onChange={(e) => onChangeConfig({ ...config, bgDarken: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Solid Color Picker */}
        {activeTab === 'solid' && (
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 block">בחר צבע אחיד לרקע:</label>
            <div className="grid grid-cols-6 gap-2">
              {['#090d16', '#020617', '#0f172a', '#180d2b', '#1a0f0f', '#061a14', '#1c1508', '#111827', '#000000', '#172554', '#2e1065', '#450a0a'].map(c => (
                <button
                  key={c}
                  onClick={() => onChangeConfig({ ...config, bgType: 'solid', solidColor: c })}
                  className={`h-10 rounded-xl border transition-all relative ${
                    config.bgType === 'solid' && config.solidColor === c
                      ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {config.bgType === 'solid' && config.solidColor === c && (
                    <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-slate-400 font-semibold">צבע מותאם אישית:</span>
              <input
                type="color"
                value={config.solidColor || '#090d16'}
                onChange={(e) => onChangeConfig({ ...config, bgType: 'solid', solidColor: e.target.value })}
                className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
              />
              <span className="text-xs font-mono text-indigo-300">{config.solidColor || '#090d16'}</span>
            </div>
          </div>
        )}

        {/* Waveform Style & Color Presets */}
        <div className="space-y-3 pt-3 border-t border-slate-800/80">
          <label className="text-xs font-bold text-slate-300 block">סגנון גל הקול (Waveform Style):</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { id: 'bars', label: 'עמודות EQ' },
              { id: 'sine', label: 'גל סינוס' },
              { id: 'radial', label: 'מעגל פעימות' },
              { id: 'mirror', label: 'עמודות מראה' },
              { id: 'pulse', label: 'קו דופק' },
              { id: 'liquid', label: 'גלי ים' }
            ].map(w => (
              <button
                key={w.id}
                onClick={() => onChangeConfig({ ...config, waveformStyle: w.id as any })}
                className={`py-2 px-1 rounded-xl border text-[11px] font-bold text-center transition-all ${
                  config.waveformStyle === w.id
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          <label className="text-xs font-bold text-slate-300 block pt-1">צבעי גרדיאנט לגל הקול:</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {WAVEFORM_GRADIENT_PRESETS.map(g => (
              <button
                key={g.id}
                onClick={() => onChangeConfig({ ...config, waveformColorMode: 'gradient', waveformGradientId: g.id })}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                  config.waveformGradientId === g.id
                    ? 'bg-slate-800 border-amber-400 text-white ring-1 ring-amber-400/40'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${g.start}, ${g.end})` }}
                />
                <span className="truncate text-[11px]">{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons: Save as Default & Close */}
        <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
          <button
            onClick={handleSaveAsDefault}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-98 transition-all"
          >
            {savedBanner ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedBanner ? 'נשמר בהצלחה כברירת מחדל!' : 'קבע כרקע קבוע לאולפן ולייצוא'}</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            סגור
          </button>
        </div>
      </div>

      {/* Cinema Stock Photo Picker */}
      <ImageStockPickerModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        onSelectImage={handleSelectStockImage}
      />
    </div>
  );
}
