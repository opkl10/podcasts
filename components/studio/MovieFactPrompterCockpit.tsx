'use client';

import React, { useState } from 'react';
import { MovieFactCard, LiveOverlayState, FactCategory } from '@/lib/types';
import { 
  Film, 
  Tv, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Award, 
  Star, 
  Clapperboard, 
  Flame, 
  Info, 
  ChevronLeft, 
  ChevronRight,
  Pin,
  ExternalLink,
  CheckCircle2,
  Check
} from 'lucide-react';

interface MovieFactPrompterCockpitProps {
  movieFacts: MovieFactCard[];
  activeOverlayFact: MovieFactCard | null;
  isOverlayShowing: boolean;
  onToggleBroadcastOverlay: (fact: MovieFactCard | null, show: boolean) => void;
  onPinFact?: (id: string) => void;
}

export default function MovieFactPrompterCockpit({
  movieFacts = [],
  activeOverlayFact,
  isOverlayShowing,
  onToggleBroadcastOverlay,
  onPinFact
}: MovieFactPrompterCockpitProps) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [usedFactIds, setUsedFactIds] = useState<Set<string>>(new Set());

  const filteredFacts = movieFacts.filter(f => {
    if (filterCategory === 'all') return true;
    if (filterCategory === 'plot') return f.category === 'plot';
    if (filterCategory === 'cast') return f.category === 'cast' || f.category === 'cast_secret';
    if (filterCategory === 'production_crew') return f.category === 'production_crew' || f.category === 'director_vision';
    if (filterCategory === 'reviews') return f.category === 'reviews' || f.category === 'critical_reception' || f.category === 'box_office';
    if (filterCategory === 'behind_the_scenes') return f.category === 'behind_the_scenes' || f.category === 'trivia' || f.category === 'easter_egg';
    return f.category === filterCategory;
  });

  const currentFact = filteredFacts[activeCardIndex] || filteredFacts[0] || null;

  const handleNext = () => {
    if (filteredFacts.length === 0) return;
    setActiveCardIndex((prev) => (prev + 1) % filteredFacts.length);
  };

  const handlePrev = () => {
    if (filteredFacts.length === 0) return;
    setActiveCardIndex((prev) => (prev - 1 + filteredFacts.length) % filteredFacts.length);
  };

  const toggleMarkUsed = (id: string) => {
    setUsedFactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSourceStyle = (source: string) => {
    switch (source) {
      case 'IMDb':
        return 'bg-[#f5c518] text-slate-950 font-black';
      case 'Rotten Tomatoes':
        return 'bg-[#fa320a] text-white font-bold';
      case 'Wikipedia':
        return 'bg-slate-700 text-white font-bold';
      case 'Letterboxd':
        return 'bg-[#00e054] text-slate-950 font-black';
      default:
        return 'bg-purple-900/60 text-purple-200 border border-purple-500/30';
    }
  };

  if (movieFacts.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
        <Film className="w-8 h-8 mx-auto text-amber-400 opacity-60" />
        <h5 className="text-xs font-bold text-white">אין כרטיסיות עובדות שהוגדרו לסרט זה</h5>
        <p className="text-[11px] text-slate-400">
          ניתן לחלץ עובדות על הסרט בלשונית המחקר מ-IMDb וויקיפדיה לפני תחילת ההקלטה.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category Mini Tabs (5 Standard Cinema Categories) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
        {[
          { id: 'all', label: `הכל (${movieFacts.length})` },
          { id: 'plot', label: '🎬 עלילה' },
          { id: 'cast', label: '🎭 שחקנים' },
          { id: 'production_crew', label: '🎥 הפקה ובימוי' },
          { id: 'reviews', label: '⭐ ביקורות' },
          { id: 'behind_the_scenes', label: '🤫 מאחורי הקלעים' }
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => {
              setFilterCategory(cat.id);
              setActiveCardIndex(0);
            }}
            className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all ${
              filterCategory === cat.id
                ? 'bg-amber-500 text-slate-950 shadow font-black'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Flashcard Display */}
      {currentFact && (
        <div className={`p-4 rounded-2xl border transition-all ${
          isOverlayShowing && activeOverlayFact?.id === currentFact.id
            ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-500 shadow-xl shadow-amber-500/10 ring-1 ring-amber-500/50'
            : 'bg-slate-900/90 border-slate-800'
        }`}>
          {/* Card Meta Bar */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-mono tracking-wider ${getSourceStyle(currentFact.source)}`}>
                {currentFact.source}
              </span>
              {currentFact.ratingScore && (
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  ⭐ {currentFact.ratingScore}
                </span>
              )}
              {usedFactIds.has(currentFact.id) && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
                  <Check className="w-3 h-3" />
                  <span>נאמר בשידור</span>
                </span>
              )}
            </div>

            <span className="text-[10px] font-mono text-slate-500 font-bold">
              {activeCardIndex + 1} מתוך {filteredFacts.length}
            </span>
          </div>

          {/* Fact Content Text */}
          <p className="text-xs sm:text-sm font-medium text-slate-100 leading-relaxed min-h-[55px]">
            {currentFact.fact}
          </p>

          {/* On-Air Broadcast Button, Mark Used & Navigation */}
          <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {/* Show on Broadcast Toggle */}
              <button
                onClick={() => {
                  const isCurrentlyActive = isOverlayShowing && activeOverlayFact?.id === currentFact.id;
                  onToggleBroadcastOverlay(currentFact, !isCurrentlyActive);
                  if (!isCurrentlyActive) {
                    toggleMarkUsed(currentFact.id);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                  isOverlayShowing && activeOverlayFact?.id === currentFact.id
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black'
                }`}
              >
                {isOverlayShowing && activeOverlayFact?.id === currentFact.id ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>הסר מהשידור (Live)</span>
                  </>
                ) : (
                  <>
                    <Tv className="w-3.5 h-3.5" />
                    <span>📺 הצג בשידור לצופים</span>
                  </>
                )}
              </button>

              {/* Mark as Done / Used */}
              <button
                onClick={() => toggleMarkUsed(currentFact.id)}
                className={`p-1.5 px-2 rounded-xl text-xs font-bold border transition-colors ${
                  usedFactIds.has(currentFact.id)
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title="סמן כעובדה שכבר נאמרה בשידור"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Prev / Next Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="עובדה קודמת על הסרט"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="עובדה הבאה על הסרט"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Pinned Grid Preview */}
      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {filteredFacts.map((fact, idx) => (
          <div
            key={fact.id}
            onClick={() => setActiveCardIndex(idx)}
            className={`p-2 rounded-xl border text-[11px] cursor-pointer transition-all flex items-center justify-between gap-2 ${
              idx === activeCardIndex
                ? 'bg-slate-800 border-amber-500/50 text-white font-semibold'
                : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-[9px] text-slate-500 font-bold">#{idx + 1}</span>
              {usedFactIds.has(fact.id) && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              )}
              <span className={`truncate ${usedFactIds.has(fact.id) ? 'line-through text-slate-500' : ''}`}>
                {fact.fact}
              </span>
            </div>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono shrink-0 ${getSourceStyle(fact.source)}`}>
              {fact.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
