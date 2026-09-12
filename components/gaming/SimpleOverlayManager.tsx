'use client';

import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Zap,
  Move,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Sliders,
  X,
  Star,
} from 'lucide-react';
import {
  OverlayItem,
  OverlayType,
  OVERLAY_CATALOG,
  VerdictConfig,
  SceneLabelConfig,
  ReviewScoreConfig,
  HealthBarConfig,
  ScoreCounterConfig,
  GameTitleConfig,
  ReactionConfig,
  LowerThirdConfig,
  ProConConfig,
  LiveBadgeConfig,
  SessionTimerConfig,
} from './overlays/overlayTypes';

// ── 1-Click Presets ──────────────────────────────────────────────────────────
export const OVERLAY_PRESETS = [
  {
    id: 'gaming',
    name: 'ערכת גיימינג קלאסית',
    badge: 'מומלץ לגיימרים',
    description: 'באדג׳ שידור חי, שעון משחק, מד חיים וכרטיס שם המשחק',
    icon: '🎮',
    themeColor: 'from-purple-600/30 to-indigo-600/20 border-purple-500/40 text-purple-300',
    items: [
      {
        type: 'live_badge' as OverlayType,
        x: 4,
        y: 4,
        config: { channelName: 'Gaming Live', color: '#ef4444' },
      },
      {
        type: 'session_timer' as OverlayType,
        x: 75,
        y: 4,
        config: { mode: 'stopwatch' as const, elapsedSeconds: 0 },
      },
      {
        type: 'health_bar' as OverlayType,
        x: 4,
        y: 84,
        config: { label: 'HP', value: 85, color: '#10b981', showValue: true },
      },
      {
        type: 'game_title' as OverlayType,
        x: 65,
        y: 82,
        config: { title: 'שם המשחק', genre: 'Action / Adventure', year: '2025', platform: 'PS5' },
      },
    ],
  },
  {
    id: 'review',
    name: 'ערכת ביקורת משחקים',
    badge: 'למבקרים ויוטיוב',
    description: 'תגית ביקורת, ציון 9.5 עם כוכבים, תג פסק דין ויתרונות/חסרונות',
    icon: '⭐',
    themeColor: 'from-amber-600/30 to-orange-600/20 border-amber-500/40 text-amber-300',
    items: [
      {
        type: 'scene_label' as OverlayType,
        x: 4,
        y: 4,
        config: { scene: 'REVIEW', color: '#a855f7' },
      },
      {
        type: 'review_score' as OverlayType,
        x: 75,
        y: 4,
        config: { score: 9.5, maxScore: 10, showStars: true, label: 'ציון סופי' },
      },
      {
        type: 'verdict' as OverlayType,
        x: 70,
        y: 75,
        config: { verdict: 'MASTERPIECE' as const, subtitle: 'חובת משחק לכל גיימר!' },
      },
      {
        type: 'pro_con' as OverlayType,
        x: 4,
        y: 48,
        config: {
          title: 'סיכום יתרונות וחסרונות',
          pros: ['גרפיקה עוצרת נשימה ב-4K', 'מערכת קרבות הדוקה ומהנה', 'עולם פתוח עשיר בתוכן'],
          cons: ['זמני טעינה מעט ארוכים'],
        },
      },
    ],
  },
  {
    id: 'streamer',
    name: 'ערכת סטרימר ושידור חי',
    badge: 'ליוצרי תוכן',
    description: 'באדג׳ לייב, פס כותרת מנחה תחתון, וקישורי רשתות חברתיות',
    icon: '📡',
    themeColor: 'from-cyan-600/30 to-blue-600/20 border-cyan-500/40 text-cyan-300',
    items: [
      {
        type: 'live_badge' as OverlayType,
        x: 4,
        y: 4,
        config: { channelName: 'LIVE NOW', color: '#ef4444' },
      },
      {
        type: 'lower_third' as OverlayType,
        x: 4,
        y: 80,
        config: { name: 'עומר אוקון', title: 'שידור גיימינג חי', color: '#06b6d4' },
      },
      {
        type: 'social_bar' as OverlayType,
        x: 65,
        y: 86,
        config: {
          handles: [
            { platform: 'youtube' as const, handle: '@channel' },
            { platform: 'twitch' as const, handle: 'live' },
          ],
        },
      },
    ],
  },
];

// ── Quick Reactions ─────────────────────────────────────────────────────────
export const QUICK_REACTIONS = [
  { code: 'GG' as const, label: 'GG', subtitle: 'Good Game', emoji: '⚡', color: '#10b981', border: 'border-emerald-500/60', text: 'text-emerald-400' },
  { code: 'CLUTCH' as const, label: 'CLUTCH', subtitle: 'קלאץ׳ מטורף', emoji: '🔥', color: '#f97316', border: 'border-orange-500/60', text: 'text-orange-400' },
  { code: 'FAIL' as const, label: 'FAIL', subtitle: 'נפילה / פדיחה', emoji: '💀', color: '#ef4444', border: 'border-rose-500/60', text: 'text-rose-400' },
  { code: 'WIN' as const, label: 'WIN', subtitle: 'ניצחון ענק!', emoji: '🏆', color: '#eab308', border: 'border-yellow-500/60', text: 'text-yellow-400' },
  { code: 'LOL' as const, label: 'LOL', subtitle: 'קורע מצחוק', emoji: '😂', color: '#a855f7', border: 'border-purple-500/60', text: 'text-purple-400' },
  { code: 'WTF' as const, label: 'WTF', subtitle: 'מה קרה פה?!', emoji: '😱', color: '#06b6d4', border: 'border-cyan-500/60', text: 'text-cyan-400' },
];

// ── Quick Snap Positions ───────────────────────────────────────────────────
export const SNAP_POSITIONS = [
  { id: 'tl', label: 'שמאל למעלה', icon: '↖️', x: 4, y: 4 },
  { id: 'tc', label: 'מרכז למעלה', icon: '⬆️', x: 38, y: 4 },
  { id: 'tr', label: 'ימין למעלה', icon: '↗️', x: 72, y: 4 },
  { id: 'c', label: 'מרכז מסך', icon: '🎯', x: 38, y: 38 },
  { id: 'bl', label: 'שמאל למטה', icon: '↙️', x: 4, y: 80 },
  { id: 'bc', label: 'מרכז למטה', icon: '⬇️', x: 38, y: 80 },
  { id: 'br', label: 'ימין למטה', icon: '↘️', x: 72, y: 80 },
];

// ── Vibrant Color Palette ───────────────────────────────────────────────────
export const COLOR_SWATCHES = [
  { hex: '#ef4444', label: 'אדום', bg: 'bg-red-500' },
  { hex: '#a855f7', label: 'סגול', bg: 'bg-purple-500' },
  { hex: '#06b6d4', label: 'טורקיז', bg: 'bg-cyan-500' },
  { hex: '#10b981', label: 'ירוק', bg: 'bg-emerald-500' },
  { hex: '#f59e0b', label: 'זהב', bg: 'bg-amber-500' },
  { hex: '#ec4899', label: 'ורוד', bg: 'bg-pink-500' },
  { hex: '#3b82f6', label: 'כחול', bg: 'bg-blue-500' },
  { hex: '#ffffff', label: 'לבן', bg: 'bg-white' },
];

// ── Verdict Options ─────────────────────────────────────────────────────────
export const VERDICT_OPTIONS = [
  { id: 'MASTERPIECE', label: '🏆 יצירת מופת (MASTERPIECE)', color: '#f59e0b' },
  { id: 'EXCELLENT', label: '💎 מעולה (EXCELLENT)', color: '#10b981' },
  { id: 'GOOD', label: '✨ טוב מאוד (GOOD)', color: '#10b981' },
  { id: 'RECOMMENDED', label: '👍 מומלץ (RECOMMENDED)', color: '#06b6d4' },
  { id: 'AVERAGE', label: '⚖️ בינוני (AVERAGE)', color: '#eab308' },
  { id: 'SKIP', label: '⚠️ לוותר (SKIP)', color: '#f97316' },
  { id: 'AVOID', label: '🚫 להתרחק (AVOID)', color: '#ef4444' },
  { id: 'TRASH', label: '🗑️ גרוע (TRASH)', color: '#ef4444' },
];

// ── Scene Options ───────────────────────────────────────────────────────────
export const SCENE_OPTIONS = [
  { id: 'GAMEPLAY', label: '🎮 גיימפליי' },
  { id: 'REVIEW', label: '⭐ ביקורת' },
  { id: 'HIGHLIGHT', label: '⚡ רגע שיא' },
  { id: 'UNBOXING', label: '📦 פתיחת קופסה' },
  { id: 'CUTSCENE', label: '🎬 קטע מעבר' },
  { id: 'SPOILER', label: '⚠️ ספוילר' },
  { id: 'TUTORIAL', label: '📚 מדריך' },
  { id: 'INTERVIEW', label: '🎙️ ראיון' },
];

// ── Hebrew Friendly Catalog Meta ────────────────────────────────────────────
export const CATALOG_FRIENDLY_META: Record<OverlayType, { title: string; desc: string }> = {
  live_badge: { title: 'באדג׳ שידור חי', desc: 'נקודה אדומה מהבהבת + LIVE ושם ערוץ' },
  session_timer: { title: 'שעון משחק / סטופר', desc: 'מונה זמן דיגיטלי לשידור' },
  achievement: { title: 'הישג נפתח (Trophy)', desc: 'הודעת קפיצה יוקרתית על גבי המסך' },
  health_bar: { title: 'מד חיים (HP Bar)', desc: 'מד בריאות ויזואלי בצבעים משתנים' },
  chat_bubble: { title: 'בועת צ׳אט צופים', desc: 'הודעת תגובה עם שם משתמש מודגש' },
  score_counter: { title: 'מונה הריגות / ניקוד', desc: 'ספרות גדולות עם כפתורי פלוס ומינוס' },
  game_title: { title: 'כרטיס שם המשחק', desc: 'שם משחק, ז׳אנר, שנה וקונסולה' },
  reaction: { title: 'מדבקת תגובה מהירה', desc: 'מדבקה גדולה (GG, WIN, FAIL וכדומה)' },
  lower_third: { title: 'פס כותרת תחתון', desc: 'שם המנחה ותפקיד בעיצוב טלוויזיוני' },
  review_score: { title: 'ציון ביקורת (1-10)', desc: 'ציון מספרי גדול עם כוכבים מנצנצים' },
  verdict: { title: 'תג פסק דין וסיכום', desc: 'חותמת סיכום (יצירת מופת, מומלץ...)' },
  pro_con: { title: 'כרטיס יתרונות וחסרונות', desc: 'נקודות ירוקות ואדומות מסודרות' },
  scene_label: { title: 'תגית סצנה פעילה', desc: 'תגית מעוצבת לפי קטע המשחק' },
  rating_meter: { title: 'מד הערכה (גרפיקה/הנאה)', desc: 'סליידר אחוזים גרפי' },
  tip_card: { title: 'כרטיס טיפ / אזהרה', desc: 'הודעת מידע קופצת עם אייקון' },
  social_bar: { title: 'פס רשתות חברתיות', desc: 'יוטיוב, טוויץ׳, טיקטוק ודיסקורד' },
  watermark: { title: 'קרדיט / סימן מים', desc: 'טקסט עדין ושקוף בפינת המסך' },
};

interface SimpleOverlayManagerProps {
  overlays: OverlayItem[];
  setOverlays: React.Dispatch<React.SetStateAction<OverlayItem[]>>;
  isEditMode: boolean;
  setIsEditMode: (v: boolean) => void;
  editingOverlayId: string | null;
  setEditingOverlayId: (id: string | null) => void;
  onAddOverlay: (type: OverlayType) => void;
  onRemoveOverlay: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onUpdateConfig: (id: string, key: string, value: any) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

export default function SimpleOverlayManager({
  overlays,
  setOverlays,
  isEditMode,
  setIsEditMode,
  editingOverlayId,
  setEditingOverlayId,
  onAddOverlay,
  onRemoveOverlay,
  onToggleVisible,
  onUpdateConfig,
  onUpdatePosition,
}: SimpleOverlayManagerProps) {
  const [activeTab, setActiveTab] = useState<'reactions' | 'presets' | 'add' | 'active'>('reactions');
  const [catalogCategory, setCatalogCategory] = useState<'all' | 'gaming' | 'streaming' | 'review' | 'cinema'>('all');

  // 1-Click apply preset
  const handleApplyPreset = (preset: typeof OVERLAY_PRESETS[0]) => {
    const newItems: OverlayItem[] = preset.items.map((item, idx) => ({
      id: `${item.type}_${Date.now()}_${idx}`,
      type: item.type,
      x: item.x,
      y: item.y,
      visible: true,
      config: { ...item.config },
    }));

    setOverlays(prev => [...prev, ...newItems]);
    setActiveTab('active');
  };

  // 1-Click Clear All
  const handleClearAll = () => {
    if (overlays.length === 0) return;
    if (window.confirm('האם להסיר את כל האלמנטים מהמסך?')) {
      setOverlays([]);
      setEditingOverlayId(null);
    }
  };

  // 1-Click Quick Reaction Toggle
  const handleTriggerReaction = (code: ReactionConfig['reaction']) => {
    const existingIndex = overlays.findIndex(o => o.type === 'reaction');
    if (existingIndex >= 0) {
      const existing = overlays[existingIndex];
      if ((existing.config as ReactionConfig).reaction === code && existing.visible) {
        onToggleVisible(existing.id);
        return;
      }
      onUpdateConfig(existing.id, 'reaction', code);
      if (!existing.visible) onToggleVisible(existing.id);
      onUpdatePosition(existing.id, 38, 38);
    } else {
      const newOverlay: OverlayItem = {
        id: `reaction_${Date.now()}`,
        type: 'reaction',
        x: 38,
        y: 38,
        visible: true,
        config: { reaction: code },
      };
      setOverlays(prev => [...prev, newOverlay]);
    }
  };

  const existingReaction = overlays.find(o => o.type === 'reaction');
  const currentEditing = overlays.find(o => o.id === editingOverlayId);

  return (
    <div className="p-5 rounded-3xl bg-gradient-to-b from-[#141226]/95 via-[#0e1222]/95 to-[#0b0e18]/95 border border-cyan-500/30 shadow-2xl space-y-4">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 text-cyan-400 border border-cyan-500/30 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white tracking-wide">עיצוב מסך ואלמנטים ויזואליים</h3>
              {overlays.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {overlays.length} פעילים
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              הוספה ועריכה בלחיצה אחת — ללא צורך בידע טכני או קוד
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {overlays.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all flex items-center gap-1 cursor-pointer"
              title="נקה את כל האלמנטים מהמסך"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>נקה הכל</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
              isEditMode
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-amber-500/20 shadow-md'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:text-white hover:border-cyan-500/40'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>{isEditMode ? 'נעילת מיקום' : 'הזזה חופשית'}</span>
          </button>
        </div>
      </div>

      {/* ── SIMPLE TABS ── */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('reactions')}
          className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'reactions'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>מדבקות תגובה</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'presets'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>ערכות מוכנות</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'add'
              ? 'bg-cyan-600 text-white font-black shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>הוספת אלמנט</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`py-2 px-2 rounded-xl transition-all flex items-center justify-center gap-1.5 relative cursor-pointer ${
            activeTab === 'active'
              ? 'bg-emerald-600 text-white font-black shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>פעילים ({overlays.length})</span>
          {overlays.length > 0 && activeTab !== 'active' && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse absolute top-1.5 left-2" />
          )}
        </button>
      </div>

      {/* ── TAB 1: QUICK REACTIONS ── */}
      {activeTab === 'reactions' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300">
              לחץ על מדבקה להקפצה מיידית למרכז המסך בזמן משחק:
            </span>
            {existingReaction && (
              <button
                type="button"
                onClick={() => onRemoveOverlay(existingReaction.id)}
                className="text-[10px] text-rose-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <X className="w-3 h-3" /> הסר מדבקה מהמסך
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {QUICK_REACTIONS.map(r => {
              const isActive =
                existingReaction &&
                (existingReaction.config as ReactionConfig).reaction === r.code &&
                existingReaction.visible;

              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => handleTriggerReaction(r.code)}
                  className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 text-center group relative overflow-hidden cursor-pointer ${
                    isActive
                      ? `bg-slate-800 ${r.border} ring-2 ring-amber-400 shadow-lg scale-105`
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 hover:scale-102'
                  }`}
                >
                  <span className="text-2xl group-hover:scale-125 transition-transform">{r.emoji}</span>
                  <span className={`font-black text-sm ${r.text}`}>{r.label}</span>
                  <span className="text-[9px] text-slate-400 truncate w-full">{r.subtitle}</span>
                  {isActive && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: 1-CLICK PRESETS ── */}
      {activeTab === 'presets' && (
        <div className="space-y-2.5 animate-in fade-in duration-200">
          <span className="text-[11px] font-bold text-slate-300 block">
            בחר ערכה מוכנה להוספה מהירה של כל האלמנטים המומלצים ביחד:
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {OVERLAY_PRESETS.map(preset => (
              <div
                key={preset.id}
                className={`p-3.5 rounded-2xl bg-gradient-to-b ${preset.themeColor} border flex flex-col justify-between gap-3 group`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{preset.icon}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-900/80 text-white border border-slate-700">
                      {preset.badge}
                    </span>
                  </div>
                  <h4 className="font-black text-white text-xs">{preset.name}</h4>
                  <p className="text-[10px] text-slate-300 leading-relaxed">{preset.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="w-full py-2 px-3 rounded-xl bg-white text-slate-950 hover:bg-cyan-300 font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>החל ערכה זו</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: ADD ELEMENT CATALOG ── */}
      {activeTab === 'add' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] font-bold">
            {[
              { id: 'all', label: 'הכל' },
              { id: 'gaming', label: '🎮 גיימינג' },
              { id: 'streaming', label: '📡 שידור' },
              { id: 'review', label: '⭐ ביקורות' },
              { id: 'cinema', label: '🎬 קולנוע' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCatalogCategory(cat.id as any)}
                className={`px-3 py-1 rounded-xl shrink-0 transition-colors cursor-pointer ${
                  catalogCategory === cat.id
                    ? 'bg-cyan-600 text-white font-black'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Elements Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1 bg-slate-950/70 rounded-2xl border border-slate-800/80">
            {OVERLAY_CATALOG.filter(c => catalogCategory === 'all' || c.category === catalogCategory).map(item => {
              const meta = CATALOG_FRIENDLY_META[item.type] || { title: item.label, desc: '' };

              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    onAddOverlay(item.type);
                    setActiveTab('active');
                  }}
                  className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 hover:border-cyan-500/50 text-right transition-all flex items-start gap-2.5 group cursor-pointer"
                >
                  <span className="text-xl p-1 rounded-lg bg-slate-950 border border-slate-800 shrink-0 group-hover:scale-110 transition-transform">
                    {item.emoji}
                  </span>
                  <div className="truncate min-w-0 flex-1">
                    <span className="font-bold text-white block text-xs truncate">{meta.title}</span>
                    <span className="text-[10px] text-slate-400 block truncate">{meta.desc}</span>
                  </div>
                  <Plus className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 4: ACTIVE OVERLAYS & VISUAL INSPECTOR ── */}
      {activeTab === 'active' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          {overlays.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-bold">אין עדיין אלמנטים פעילים על המסך</p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('presets')}
                  className="px-3 py-1 rounded-xl bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[11px] font-bold hover:bg-purple-600/50 cursor-pointer"
                >
                  בחר ערכה מוכנה
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('add')}
                  className="px-3 py-1 rounded-xl bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold hover:bg-cyan-600/50 cursor-pointer"
                >
                  הוסף אלמנט ראשון
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 block">
                בחר אלמנט לכיוונון מיקום, צבע ותוכן:
              </span>

              {/* Horizontal List of Active Overlays */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {overlays.map(o => {
                  const catalogItem = OVERLAY_CATALOG.find(c => c.type === o.type);
                  const meta = CATALOG_FRIENDLY_META[o.type];
                  const isSelected = editingOverlayId === o.id;

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setEditingOverlayId(isSelected ? null : o.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black'
                          : o.visible
                          ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-cyan-500/50'
                          : 'bg-slate-900/40 text-slate-500 border-slate-800'
                      }`}
                    >
                      <span>{catalogItem?.emoji || '🎨'}</span>
                      <span>{meta?.title || catalogItem?.label || o.type}</span>
                      {!o.visible && <EyeOff className="w-3 h-3 text-slate-500" />}
                    </button>
                  );
                })}
              </div>

              {/* Inspector for Selected Overlay */}
              {currentEditing ? (
                <div className="p-4 rounded-2xl bg-slate-950/90 border border-amber-500/40 space-y-3.5 shadow-xl">
                  {/* Top bar of selected item */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">
                        {OVERLAY_CATALOG.find(c => c.type === currentEditing.type)?.emoji || '🎨'}
                      </span>
                      <div>
                        <h4 className="text-xs font-black text-white">
                          {CATALOG_FRIENDLY_META[currentEditing.type]?.title || currentEditing.type}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          מיקום נוכחי: {Math.round(currentEditing.x)}% רוחב, {Math.round(currentEditing.y)}% גובה
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleVisible(currentEditing.id)}
                        className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                          currentEditing.visible
                            ? 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-600/30'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-white'
                        }`}
                        title={currentEditing.visible ? 'הסתר אלמנט' : 'הצג אלמנט'}
                      >
                        {currentEditing.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onRemoveOverlay(currentEditing.id);
                          setEditingOverlayId(null);
                        }}
                        className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/40 text-xs transition-colors cursor-pointer"
                        title="מחק אלמנט זה"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingOverlayId(null)}
                        className="p-1.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 hover:text-white cursor-pointer"
                        title="סגור חלונית עריכה"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* ── 1-CLICK SNAP TO POSITION ── */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-300 block">
                      📍 מיקום מהיר במסך (ללא גרירה ידנית):
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {SNAP_POSITIONS.map(pos => (
                        <button
                          key={pos.id}
                          type="button"
                          onClick={() => onUpdatePosition(currentEditing.id, pos.x, pos.y)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-[10px] font-bold text-slate-300 hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>{pos.icon}</span>
                          <span>{pos.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── VISUAL CONTENT EDITOR PER OVERLAY TYPE ── */}
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    {/* VERDICT BADGE */}
                    {currentEditing.type === 'verdict' && (
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black text-slate-300 block">בחר פסק דין:</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {VERDICT_OPTIONS.map(v => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => onUpdateConfig(currentEditing.id, 'verdict', v.id)}
                              className={`p-2 rounded-xl border text-[11px] font-bold text-right transition-all cursor-pointer ${
                                (currentEditing.config as VerdictConfig).verdict === v.id
                                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-1 ring-amber-400'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {v.label}
                            </button>
                          ))}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">תת-כותרת / סיכום קצר:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as VerdictConfig).subtitle || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'subtitle', e.target.value)}
                            placeholder="למשל: חובת משחק!"
                            className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* REVIEW SCORE */}
                    {currentEditing.type === 'review_score' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-300">ציון ביקורת (מתוך 10):</label>
                          <span className="text-base font-black text-amber-400 font-mono">
                            {(currentEditing.config as ReviewScoreConfig).score ?? 9} / 10
                          </span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="0.5"
                          value={(currentEditing.config as ReviewScoreConfig).score ?? 9}
                          onChange={e => onUpdateConfig(currentEditing.id, 'score', parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] text-slate-400 font-bold">כותרת הציון:</label>
                            <input
                              type="text"
                              value={(currentEditing.config as ReviewScoreConfig).label || ''}
                              onChange={e => onUpdateConfig(currentEditing.id, 'label', e.target.value)}
                              placeholder="ציון סופי"
                              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs w-36"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateConfig(
                                currentEditing.id,
                                'showStars',
                                !(currentEditing.config as ReviewScoreConfig).showStars
                              )
                            }
                            className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                              (currentEditing.config as ReviewScoreConfig).showStars
                                ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}
                          >
                            <Star className="w-3 h-3" />
                            <span>{(currentEditing.config as ReviewScoreConfig).showStars ? 'כוכבים מוצגים' : 'הסתר כוכבים'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* SCENE LABEL */}
                    {currentEditing.type === 'scene_label' && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-300 block">בחר תגית סצנה:</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {SCENE_OPTIONS.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => onUpdateConfig(currentEditing.id, 'scene', s.id)}
                              className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all cursor-pointer ${
                                (currentEditing.config as SceneLabelConfig).scene === s.id
                                  ? 'bg-purple-600/30 border-purple-400 text-purple-200 ring-1 ring-purple-400'
                                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HEALTH BAR */}
                    {currentEditing.type === 'health_bar' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-300">אחוז חיים (HP):</label>
                          <span className="text-xs font-black text-emerald-400 font-mono">
                            {(currentEditing.config as HealthBarConfig).value ?? 80}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={(currentEditing.config as HealthBarConfig).value ?? 80}
                          onChange={e => onUpdateConfig(currentEditing.id, 'value', parseInt(e.target.value))}
                          className="w-full accent-emerald-500 cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[100, 75, 50, 25, 10].map(v => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => onUpdateConfig(currentEditing.id, 'value', v)}
                              className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer"
                            >
                              {v}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SCORE COUNTER */}
                    {currentEditing.type === 'score_counter' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-slate-300">ערך הניקוד / הריגות:</label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const cur = (currentEditing.config as ScoreCounterConfig).value || 0;
                                onUpdateConfig(currentEditing.id, 'value', Math.max(0, cur - 1));
                              }}
                              className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 text-white font-black hover:bg-slate-800 text-sm cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-xl font-black text-cyan-400 font-mono px-3">
                              {(currentEditing.config as ScoreCounterConfig).value ?? 0}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const cur = (currentEditing.config as ScoreCounterConfig).value || 0;
                                onUpdateConfig(currentEditing.id, 'value', cur + 1);
                              }}
                              className="w-7 h-7 rounded-lg bg-cyan-600 text-white font-black hover:bg-cyan-500 text-sm cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] text-slate-400 font-bold">תווית:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as ScoreCounterConfig).label || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'label', e.target.value)}
                            placeholder="KILLS"
                            className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs w-32"
                          />
                        </div>
                      </div>
                    )}

                    {/* GAME TITLE CARD */}
                    {currentEditing.type === 'game_title' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">שם המשחק:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as GameTitleConfig).title || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'title', e.target.value)}
                            placeholder="למשל: God of War Ragnarok"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">ז׳אנר:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as GameTitleConfig).genre || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'genre', e.target.value)}
                            placeholder="Action / RPG"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">קונסולה / פלטפורמה:</label>
                          <div className="flex items-center gap-1">
                            {['PS5', 'Xbox', 'PC', 'Switch'].map(plt => (
                              <button
                                key={plt}
                                type="button"
                                onClick={() => onUpdateConfig(currentEditing.id, 'platform', plt)}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                                  (currentEditing.config as GameTitleConfig).platform === plt
                                    ? 'bg-cyan-600 text-white border-cyan-400'
                                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {plt}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">שנה:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as GameTitleConfig).year || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'year', e.target.value)}
                            placeholder="2025"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* LOWER THIRD */}
                    {currentEditing.type === 'lower_third' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">שם מלא / כינוי:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as LowerThirdConfig).name || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'name', e.target.value)}
                            placeholder="שם המנחה"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">תיאור / תפקיד:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as LowerThirdConfig).title || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'title', e.target.value)}
                            placeholder="יוצר תוכן / גיימר"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* LIVE BADGE */}
                    {currentEditing.type === 'live_badge' && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold block">שם הערוץ בשידור:</label>
                        <input
                          type="text"
                          value={(currentEditing.config as LiveBadgeConfig).channelName || ''}
                          onChange={e => onUpdateConfig(currentEditing.id, 'channelName', e.target.value)}
                          placeholder="Gaming Live"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    )}

                    {/* SESSION TIMER */}
                    {currentEditing.type === 'session_timer' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-bold block">מצב שעון:</label>
                        <div className="flex items-center gap-2">
                          {[
                            { mode: 'stopwatch' as const, label: '⏱️ סטופר סופר קדימה' },
                            { mode: 'countdown' as const, label: '⏳ טיימר סופר לאחור' },
                          ].map(m => (
                            <button
                              key={m.mode}
                              type="button"
                              onClick={() => onUpdateConfig(currentEditing.id, 'mode', m.mode)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                                (currentEditing.config as SessionTimerConfig).mode === m.mode
                                  ? 'bg-cyan-600 text-white border-cyan-400'
                                  : 'bg-slate-900 text-slate-400 border-slate-800'
                              }`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PRO CON CARD */}
                    {currentEditing.type === 'pro_con' && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-bold block">כותרת:</label>
                          <input
                            type="text"
                            value={(currentEditing.config as ProConConfig).title || ''}
                            onChange={e => onUpdateConfig(currentEditing.id, 'title', e.target.value)}
                            placeholder="סיכום יתרונות וחסרונות"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] text-emerald-400 font-bold block">יתרונות (שורה לכל יתרון):</label>
                            <textarea
                              rows={3}
                              value={((currentEditing.config as ProConConfig).pros || []).join('\n')}
                              onChange={e =>
                                onUpdateConfig(
                                  currentEditing.id,
                                  'pros',
                                  e.target.value.split('\n').filter(s => s.trim())
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs resize-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] text-rose-400 font-bold block">חסרונות (שורה לכל חיסרון):</label>
                            <textarea
                              rows={3}
                              value={((currentEditing.config as ProConConfig).cons || []).join('\n')}
                              onChange={e =>
                                onUpdateConfig(
                                  currentEditing.id,
                                  'cons',
                                  e.target.value.split('\n').filter(s => s.trim())
                                )
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── COLOR SWATCHES ── */}
                    {('color' in currentEditing.config || 'avatarColor' in currentEditing.config) && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] font-black text-slate-300 block">
                          🎨 בחר צבע מוביל לאלמנט:
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {COLOR_SWATCHES.map(sw => {
                            const currentColor =
                              (currentEditing.config as any).color || (currentEditing.config as any).avatarColor;
                            const isMatch = currentColor?.toLowerCase() === sw.hex.toLowerCase();

                            return (
                              <button
                                key={sw.hex}
                                type="button"
                                onClick={() => {
                                  if ('color' in currentEditing.config) onUpdateConfig(currentEditing.id, 'color', sw.hex);
                                  if ('avatarColor' in currentEditing.config) onUpdateConfig(currentEditing.id, 'avatarColor', sw.hex);
                                }}
                                className={`w-6 h-6 rounded-full ${sw.bg} border-2 transition-transform cursor-pointer ${
                                  isMatch ? 'border-white scale-125 ring-2 ring-cyan-400 shadow-md' : 'border-transparent hover:scale-110'
                                }`}
                                title={sw.label}
                              />
                            );
                          })}
                          <input
                            type="color"
                            value={(currentEditing.config as any).color || '#06b6d4'}
                            onChange={e => {
                              if ('color' in currentEditing.config) onUpdateConfig(currentEditing.id, 'color', e.target.value);
                              if ('avatarColor' in currentEditing.config) onUpdateConfig(currentEditing.id, 'avatarColor', e.target.value);
                            }}
                            className="w-6 h-6 rounded-full bg-transparent border-0 cursor-pointer"
                            title="בחר צבע מותאם אישית"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 text-center py-2 bg-slate-950/40 rounded-xl border border-slate-800">
                  לחץ על אחד האלמנטים למעלה כדי לפתוח את כפתורי המיקום המהיר ועורך התוכן
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
