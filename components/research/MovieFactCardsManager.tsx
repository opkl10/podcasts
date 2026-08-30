'use client';

import React, { useState } from 'react';
import { MovieFactCard, FactCategory } from '@/lib/types';
import { fetchMovieFactCards } from '@/lib/webResearch';
import { 
  Film, 
  Sparkles, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Pin, 
  Award, 
  Search, 
  Check, 
  Tv, 
  Star, 
  HelpCircle, 
  Clapperboard, 
  Popcorn, 
  Flame,
  Info,
  Copy,
  AlertTriangle,
  Layers,
  Filter,
  CheckCircle2,
  BookOpen,
  Users
} from 'lucide-react';

interface MovieFactCardsManagerProps {
  movieFacts: MovieFactCard[];
  episodeTitle: string;
  onUpdateMovieFacts: (facts: MovieFactCard[]) => void;
  onAddFactAsTopicPoint?: (fact: MovieFactCard) => void;
}

export default function MovieFactCardsManager({
  movieFacts = [],
  episodeTitle,
  onUpdateMovieFacts,
  onAddFactAsTopicPoint
}: MovieFactCardsManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState(episodeTitle);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Custom Fact Form State
  const [customFactText, setCustomFactText] = useState('');
  const [customCategory, setCustomCategory] = useState<FactCategory>('behind_the_scenes');
  const [customSource, setCustomSource] = useState<'IMDb' | 'Wikipedia' | 'Rotten Tomatoes' | 'Letterboxd' | 'Metacritic' | 'Variety / Empire'>('IMDb');
  const [customScore, setCustomScore] = useState('');
  const [customYear, setCustomYear] = useState('');

  // Fetch facts strictly for this movie via Multi-Source AI & Web Scraping
  const handleFetchFacts = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);

    try {
      const apiKey = typeof window !== 'undefined' ? localStorage.getItem('castflow_gemini_api_key') || '' : '';
      const facts = await fetchMovieFactCards(searchQuery, apiKey);
      
      // Merge with existing avoiding exact duplicate facts
      const existingFactsText = new Set(movieFacts.map(f => f.fact.trim()));
      const newUnique = facts.filter(f => !existingFactsText.has(f.fact.trim()));

      const updated = [...movieFacts, ...newUnique];
      onUpdateMovieFacts(updated);
    } catch (err) {
      console.error('Failed to fetch movie facts:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle Pin to Studio HUD
  const handleTogglePin = (id: string) => {
    const updated = movieFacts.map(f => {
      if (f.id === id) {
        return { ...f, isPinnedToHUD: !f.isPinnedToHUD };
      }
      return f;
    });
    onUpdateMovieFacts(updated);
  };

  // Delete Fact
  const handleDeleteFact = (id: string) => {
    onUpdateMovieFacts(movieFacts.filter(f => f.id !== id));
  };

  // Copy Fact Text
  const handleCopyFact = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Add Custom Fact
  const handleAddCustomFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFactText.trim()) return;

    const newFact: MovieFactCard = {
      id: `fact_custom_${Date.now()}`,
      movieTitle: searchQuery || episodeTitle,
      category: customCategory,
      fact: customFactText.trim(),
      source: customSource,
      ratingScore: customScore.trim() || undefined,
      year: customYear.trim() || undefined,
      isPinnedToHUD: true
    };

    onUpdateMovieFacts([newFact, ...movieFacts]);
    setCustomFactText('');
    setCustomScore('');
    setIsAddingCustom(false);
  };

  // Filter facts strictly for this movie
  const filteredFacts = movieFacts.filter(f => {
    let matchesCategory = selectedCategory === 'all';
    if (!matchesCategory) {
      if (selectedCategory === 'plot') matchesCategory = f.category === 'plot';
      else if (selectedCategory === 'cast') matchesCategory = f.category === 'cast' || f.category === 'cast_secret';
      else if (selectedCategory === 'production_crew') matchesCategory = f.category === 'production_crew' || f.category === 'director_vision';
      else if (selectedCategory === 'reviews') matchesCategory = f.category === 'reviews' || f.category === 'critical_reception' || f.category === 'box_office';
      else if (selectedCategory === 'behind_the_scenes') matchesCategory = f.category === 'behind_the_scenes' || f.category === 'trivia' || f.category === 'easter_egg';
      else matchesCategory = f.category === selectedCategory;
    }
    const matchesSource = selectedSource === 'all' || f.source === selectedSource;
    return matchesCategory && matchesSource;
  });

  const getCategoryMeta = (cat: FactCategory) => {
    switch (cat) {
      case 'plot':
        return { label: 'עלילה וסיפור הסרט', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30', icon: BookOpen };
      case 'cast':
      case 'cast_secret':
        return { label: 'שחקנים ודמויות', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', icon: Users };
      case 'production_crew':
      case 'director_vision':
        return { label: 'צוותי הפקה + בימוי ויתר התפקידים', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30', icon: Film };
      case 'reviews':
      case 'critical_reception':
      case 'box_office':
        return { label: 'ביקורות כלליות וציונים', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: Award };
      case 'behind_the_scenes':
      case 'easter_egg':
      case 'trivia':
      default:
        return { label: 'סיפורי מאחורי הקלעים', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Clapperboard };
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'IMDb':
        return 'bg-[#f5c518] text-black font-black';
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

  return (
    <div className="space-y-6">
      {/* Top Banner & Search Controls */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20 font-black">
              <Film className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>עובדות ומאחורי הקלעים על הסרט "{episodeTitle}"</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                  {movieFacts.length} עובדות
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                עובדות מאומתות על הסרט הספציפי מ-IMDb, ויקיפדיה, Rotten Tomatoes ו-Letterboxd לשימוש במחקר ובשידור חי באולפן
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>הוסף עובדה על הסרט</span>
            </button>

            <button
              onClick={handleFetchFacts}
              disabled={isSearching}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>{isSearching ? `מחלץ עובדות על ${searchQuery}...` : `שלוף עובדות על ${searchQuery}`}</span>
            </button>
          </div>
        </div>

        {/* Live Search Query Input */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="שם הסרט לחילוץ עובדות מ-IMDb וויקיפדיה (למשל: אינספשן, אופנהיימר, הסנדק, ספרות זולה, מועדון קרב)..."
              className="w-full pl-3 pr-10 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Custom Fact Creation Modal / Drawer */}
        {isAddingCustom && (
          <form onSubmit={handleAddCustomFact} className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3 animate-in fade-in">
            <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>הוספת עובדה חדשה על הסרט:</span>
            </h4>

            <textarea
              value={customFactText}
              onChange={(e) => setCustomFactText(e.target.value)}
              rows={2}
              placeholder={`כתוב עובדה, סיפור מאחורי הקלעים או איסטר אג על הסרט ${searchQuery}...`}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
              required
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">קטגוריה בסרט:</label>
                <select
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value as FactCategory)}
                  className="w-full p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="plot">🎬 עלילה וסיפור הסרט</option>
                  <option value="cast">🎭 שחקנים ודמויות</option>
                  <option value="production_crew">🎥 צוותי הפקה + בימוי ויתר התפקידים</option>
                  <option value="reviews">⭐ ביקורות כלליות וציונים</option>
                  <option value="behind_the_scenes">🤫 סיפורי מאחורי הקלעים</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">מקור המידע:</label>
                <select
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value as any)}
                  className="w-full p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                >
                  <option value="IMDb">IMDb</option>
                  <option value="Wikipedia">Wikipedia</option>
                  <option value="Rotten Tomatoes">Rotten Tomatoes</option>
                  <option value="Letterboxd">Letterboxd</option>
                  <option value="Variety / Empire">Variety / Empire</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">ציון / דירוג בסרט (אופציונלי):</label>
                <input
                  type="text"
                  value={customScore}
                  onChange={(e) => setCustomScore(e.target.value)}
                  placeholder="למשל 8.8/10 או 94%"
                  className="w-full p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition-all"
                >
                  שמור עובדה
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  ביטול
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Category & Source Multi-Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
        {/* Categories (5 Standard Movie Fact Sections) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: `כל העובדות (${movieFacts.length})` },
            { id: 'plot', label: '🎬 עלילה' },
            { id: 'cast', label: '🎭 שחקנים' },
            { id: 'production_crew', label: '🎥 צוותי הפקה ובימוי' },
            { id: 'reviews', label: '⭐ ביקורות כלליות' },
            { id: 'behind_the_scenes', label: '🤫 מאחורי הקלעים' }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sources Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[10px] text-slate-500 font-bold">מקור:</span>
          {['all', 'IMDb', 'Rotten Tomatoes', 'Wikipedia', 'Letterboxd'].map(src => (
            <button
              key={src}
              onClick={() => setSelectedSource(src)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedSource === src
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {src === 'all' ? 'הכל' : src}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {filteredFacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFacts.map((factItem) => {
            const meta = getCategoryMeta(factItem.category);
            const Icon = meta.icon;

            return (
              <div
                key={factItem.id}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between group relative ${
                  factItem.isPinnedToHUD
                    ? 'bg-gradient-to-b from-slate-900 to-indigo-950/40 border-amber-500/50 shadow-xl shadow-amber-500/5 ring-1 ring-amber-500/30'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${meta.color}`}>
                        <Icon className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>

                      {/* Source Badge */}
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold tracking-wider ${getSourceBadge(factItem.source)}`}>
                        {factItem.source}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Copy Fact Text */}
                      <button
                        onClick={() => handleCopyFact(factItem.id, factItem.fact)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="העתק טקסט"
                      >
                        {copiedId === factItem.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>

                      {/* Pin to On-Air HUD */}
                      <button
                        onClick={() => handleTogglePin(factItem.id)}
                        className={`p-1.5 rounded-xl transition-all ${
                          factItem.isPinnedToHUD
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title={factItem.isPinnedToHUD ? 'נעוץ ללוח השידור באולפן ✓' : 'נעץ כרטיסייה ללוח השידור באולפן'}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fact Content */}
                  <p className="text-xs sm:text-sm text-slate-100 font-medium leading-relaxed mb-3">
                    {factItem.fact}
                  </p>
                </div>

                {/* Card Footer: Scores & Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {factItem.ratingScore && (
                      <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        ⭐ {factItem.ratingScore}
                      </span>
                    )}
                    {factItem.year && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {factItem.year}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {onAddFactAsTopicPoint && (
                      <button
                        onClick={() => onAddFactAsTopicPoint(factItem)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        title="הוסף נקודה זו לנושאי השיחה של הפרק"
                      >
                        <Plus className="w-3 h-3" />
                        <span>לנושאים</span>
                      </button>
                    )}

                    {factItem.sourceUrl && (
                      <a
                        href={factItem.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                        title="צפה במקור ברשת"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    <button
                      onClick={() => handleDeleteFact(factItem.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-500 hover:text-rose-400 transition-colors"
                      title="מחק עובדה זו"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-10 rounded-3xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">אין כרטיסיות עובדות על {searchQuery || episodeTitle}</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            לחצו על הכפתור "שלוף עובדות על {searchQuery || episodeTitle}" כדי לשאוב מידע מאומת, ציונים, סודות הפקה וטריוויה ישירות מ-IMDb וויקיפדיה.
          </p>
          <button
            onClick={handleFetchFacts}
            disabled={isSearching}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all active:scale-95"
          >
            שלוף עובדות על הסרט {searchQuery || episodeTitle}
          </button>
        </div>
      )}
    </div>
  );
}
