'use client';

import React, { useState } from 'react';
import { MovieFactCard, FactCategory } from '@/lib/types';
import { 
  fetchMovieFactCards, 
  mergeAndSequenceMovieFacts, 
  extractCompleteSentences 
} from '@/lib/webResearch';
import { getStoredGeminiApiKey } from '@/lib/apiConfig';
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
  Users, 
  Target,
  Upload,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
  ListOrdered,
  GitMerge,
  X
} from 'lucide-react';

interface MovieFactCardsManagerProps {
  movieFacts: MovieFactCard[];
  episodeTitle: string;
  onUpdateMovieFacts: (facts: MovieFactCard[]) => void;
  onAddFactAsTopicPoint?: (fact: MovieFactCard) => void;
  onOpenImport?: () => void;
  onOpenSmartAdd?: () => void;
}

export default function MovieFactCardsManager({
  movieFacts = [],
  episodeTitle,
  onUpdateMovieFacts,
  onAddFactAsTopicPoint,
  onOpenImport,
  onOpenSmartAdd
}: MovieFactCardsManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [isSequencing, setIsSequencing] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFactIds, setSelectedFactIds] = useState<Set<string>>(new Set());
  const [sortBySeries, setSortBySeries] = useState(true);

  const [searchQuery, setSearchQuery] = useState(episodeTitle);
  const [focusNotes, setFocusNotes] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<'success' | 'info' | 'error' | null>(null);

  // New Custom Fact Form State
  const [customFactText, setCustomFactText] = useState('');
  const [customCategory, setCustomCategory] = useState<FactCategory>('behind_the_scenes');
  const [customSource, setCustomSource] = useState<'IMDb' | 'Wikipedia' | 'Rotten Tomatoes' | 'Letterboxd' | 'Metacritic' | 'Variety / Empire'>('IMDb');
  const [customScore, setCustomScore] = useState('');
  const [customYear, setCustomYear] = useState('');

  const hasSequencedFacts = movieFacts.some(f => f.seriesOrder !== undefined);

  // Fetch facts strictly for this movie via Multi-Source AI & Web Scraping
  const handleFetchFacts = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setFeedbackMsg(null);

    try {
      const apiKey = getStoredGeminiApiKey();
      const facts = await fetchMovieFactCards(searchQuery, apiKey, focusNotes);
      
      // Merge with existing avoiding exact duplicate facts
      const existingFactsText = new Set(movieFacts.map(f => f.fact.trim()));
      const newUnique = facts.filter(f => !existingFactsText.has(f.fact.trim()));

      if (newUnique.length > 0) {
        const updated = [...newUnique, ...movieFacts];
        onUpdateMovieFacts(updated);
        setFeedbackMsg(`נוספו בהצלחה ${newUnique.length} כרטיסיות עובדות חדשות (הוצמדו לראש הרשימה)!`);
        setFeedbackType('success');
      } else {
        setFeedbackMsg('העובדות שנמצאו כבר מוצגות ברשימה שלך.');
        setFeedbackType('info');
      }
      setTimeout(() => {
        setFeedbackMsg(null);
        setFeedbackType(null);
      }, 4000);
    } catch (err) {
      console.error('Failed to fetch movie facts:', err);
      setFeedbackMsg('שגיאה באיתור כרטיסיות עובדות');
      setFeedbackType('error');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setIsSearching(false);
    }
  };

  // Smart Auto-Merge & Sequence into Chronological Series ("אחד אחרי השני")
  const handleSmartMergeAndSequence = async () => {
    if (movieFacts.length === 0) {
      setFeedbackMsg('אין עובדות לאיחוד. שלפו עובדות קודם לכן.');
      setFeedbackType('info');
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    setIsSequencing(true);
    setFeedbackMsg(null);

    try {
      const apiKey = getStoredGeminiApiKey();
      const sequenced = await mergeAndSequenceMovieFacts(movieFacts, searchQuery || episodeTitle, apiKey);

      if (sequenced && sequenced.length > 0) {
        onUpdateMovieFacts(sequenced);
        setSortBySeries(true);
        setSelectedCategory('all');
        setSelectedFactIds(new Set());
        setIsSelectionMode(false);
        setFeedbackMsg(`אוחדו בהצלחה ${movieFacts.length} עובדות לכדי סדרה עוקבת של ${sequenced.length} פרקים (אחד אחרי השני)! נמחקו כפילויות ופרטים מקוטעים.`);
        setFeedbackType('success');
      } else {
        setFeedbackMsg('לא ניתן היה לאחד את העובדות כרגע.');
        setFeedbackType('error');
      }
      setTimeout(() => {
        setFeedbackMsg(null);
        setFeedbackType(null);
      }, 5000);
    } catch (err) {
      console.error('Sequencing error:', err);
      setFeedbackMsg('שגיאה בתהליך איחוד וסידור הסדרה');
      setFeedbackType('error');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setIsSequencing(false);
    }
  };

  // Toggle selection for a fact card
  const handleToggleSelect = (id: string) => {
    setSelectedFactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all currently visible cards
  const handleSelectAll = () => {
    setSelectedFactIds(new Set(displayedFacts.map(f => f.id)));
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedFactIds(new Set());
  };

  // Delete all selected facts
  const handleDeleteSelected = () => {
    if (selectedFactIds.size === 0) return;
    const remaining = movieFacts.filter(f => !selectedFactIds.has(f.id));
    onUpdateMovieFacts(remaining);
    setFeedbackMsg(`נמחקו ${selectedFactIds.size} כרטיסיות נבחרות.`);
    setFeedbackType('info');
    setSelectedFactIds(new Set());
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Merge selected facts into a single unified card in the series
  const handleMergeSelected = () => {
    if (selectedFactIds.size < 2) {
      setFeedbackMsg('אנא בחרו לפחות 2 כרטיסיות עובדות שברצונכם לחבר יחד.');
      setFeedbackType('info');
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    const selectedCards = movieFacts.filter(f => selectedFactIds.has(f.id));
    const firstSelectedIndex = movieFacts.findIndex(f => selectedFactIds.has(f.id));
    if (firstSelectedIndex === -1) return;

    // Combine sentences cleanly
    const allSentences: string[] = [];
    const seenSentences = new Set<string>();

    for (const card of selectedCards) {
      const sentences = extractCompleteSentences(card.fact, 4);
      for (const s of sentences) {
        const norm = s.trim().toLowerCase();
        if (!seenSentences.has(norm) && s.length > 15) {
          seenSentences.add(norm);
          allSentences.push(s);
        }
      }
    }

    const combinedText = allSentences.length > 0 
      ? allSentences.join(' ') 
      : selectedCards.map(c => c.fact).join(' ');

    const primaryCard = selectedCards.find(c => c.sourceUrl) || selectedCards[0];
    const mergedTags = Array.from(new Set(selectedCards.flatMap(c => c.tags || []))).slice(0, 6);
    const totalMerged = selectedCards.reduce((acc, c) => acc + (c.relatedCount || 1), 0);

    const mergedCard: MovieFactCard = {
      id: `fact_merged_${Date.now()}`,
      movieTitle: primaryCard.movieTitle || searchQuery || episodeTitle,
      category: primaryCard.category,
      fact: combinedText,
      source: primaryCard.source,
      sourceUrl: primaryCard.sourceUrl,
      ratingScore: selectedCards.find(c => c.ratingScore)?.ratingScore,
      year: selectedCards.find(c => c.year)?.year,
      tags: mergedTags,
      isPinnedToHUD: selectedCards.some(c => c.isPinnedToHUD),
      seriesOrder: selectedCards.find(c => c.seriesOrder)?.seriesOrder,
      seriesGroup: selectedCards.find(c => c.seriesGroup)?.seriesGroup || 'עובדות מאוחדות',
      relatedCount: totalMerged
    };

    // Replace first selected card with mergedCard and remove all others
    const updatedFacts: MovieFactCard[] = [];
    for (let i = 0; i < movieFacts.length; i++) {
      if (i === firstSelectedIndex) {
        updatedFacts.push(mergedCard);
      } else if (!selectedFactIds.has(movieFacts[i].id)) {
        updatedFacts.push(movieFacts[i]);
      }
    }

    onUpdateMovieFacts(updatedFacts);
    setSelectedFactIds(new Set());
    setFeedbackMsg(`אוחדו בהצלחה ${selectedCards.length} עובדות לכרטיסייה אחת עשירה! נמחקו הפיצולים.`);
    setFeedbackType('success');
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Reorder item up or down in the sequence ("אחד אחרי השני")
  const handleMoveSeriesItem = (id: string, direction: 'up' | 'down') => {
    const index = movieFacts.findIndex(f => f.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === movieFacts.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...movieFacts];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    // Renumber seriesOrder strictly one after another
    const updatedWithOrder = reordered.map((f, i) => ({
      ...f,
      seriesOrder: i + 1
    }));

    onUpdateMovieFacts(updatedWithOrder);
  };

  // Merge this fact with the one directly after it
  const handleMergeWithNext = (index: number) => {
    if (index >= displayedFacts.length - 1) return;
    const cardA = displayedFacts[index];
    const cardB = displayedFacts[index + 1];

    const sentencesA = extractCompleteSentences(cardA.fact, 4);
    const sentencesB = extractCompleteSentences(cardB.fact, 4);
    const combinedSentences = Array.from(new Set([...sentencesA, ...sentencesB]));
    const combinedText = combinedSentences.length > 0 
      ? combinedSentences.join(' ') 
      : `${cardA.fact} ${cardB.fact}`;

    const mergedCard: MovieFactCard = {
      ...cardA,
      id: `fact_merged_${Date.now()}`,
      fact: combinedText,
      sourceUrl: cardA.sourceUrl || cardB.sourceUrl,
      tags: Array.from(new Set([...(cardA.tags || []), ...(cardB.tags || [])])).slice(0, 6),
      relatedCount: (cardA.relatedCount || 1) + (cardB.relatedCount || 1)
    };

    const updated = movieFacts
      .map(f => (f.id === cardA.id ? mergedCard : f))
      .filter(f => f.id !== cardB.id)
      .map((f, i) => f.seriesOrder !== undefined ? { ...f, seriesOrder: i + 1 } : f);

    onUpdateMovieFacts(updated);
    setFeedbackMsg('הכרטיסייה אוחדה בהצלחה עם הכרטיסייה הבאה בסדרה!');
    setFeedbackType('success');
    setTimeout(() => setFeedbackMsg(null), 3000);
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

  // Delete single fact
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
      isPinnedToHUD: true,
      seriesOrder: movieFacts.length + 1
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

  // Displayed facts with Series Order Sorting ("אחד אחרי השני")
  const displayedFacts = [...filteredFacts].sort((a, b) => {
    if (sortBySeries && hasSequencedFacts) {
      const aOrder = a.seriesOrder ?? 9999;
      const bOrder = b.seriesOrder ?? 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;
    }
    return 0;
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
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black text-white">
                  עובדות ומאחורי הקלעים על הסרט "{episodeTitle}"
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                  {movieFacts.length} עובדות
                </span>
                {hasSequencedFacts && (
                  <span className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <ListOrdered className="w-3 h-3" />
                    סדרה עוקבת מוגדרת ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                עובדות מאומתות על הסרט הספציפי מ-IMDb, ויקיפדיה, Rotten Tomatoes ו-Letterboxd לשימוש במחקר ובשידור חי באולפן
              </p>
            </div>
          </div>

          {/* Action Buttons with Primary Merge & Sequence Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* The Requested Button: Merge Related & Order as Chronological Series ("אחד אחרי השני") */}
            <button
              onClick={handleSmartMergeAndSequence}
              disabled={isSequencing || movieFacts.length === 0}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-lg shadow-purple-900/30 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              title="חבר עובדות קשורות ביחד, מחק כפילויות וסדר כסדרה עוקבת אחד אחרי השני"
            >
              <Layers className={`w-3.5 h-3.5 text-amber-300 ${isSequencing ? 'animate-spin' : ''}`} />
              <span>{isSequencing ? 'מאחד ומסדר סדרה...' : '⚡ אחד וסדר כסדרה (אחד אחרי השני)'}</span>
            </button>

            {/* Smart Add & Auto-Tag Info Button */}
            {onOpenSmartAdd && (
              <button
                onClick={onOpenSmartAdd}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 border border-amber-300/40"
                title="הוספת מידע נוסף: המערכת תתייג ותשלב בעובדה קיימת או תוסיף כרטיסייה חדשה במקום משלה"
              >
                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                <span>✨ הוספת מידע חכם</span>
              </button>
            )}

            {/* Manual Multi-Select & Merge/Delete Toggle Button */}
            <button
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedFactIds(new Set());
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                isSelectionMode 
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md shadow-amber-500/20' 
                  : 'bg-slate-800/90 hover:bg-slate-750 text-slate-200 border-slate-700'
              }`}
              title="מצב בחירה ידנית לאיחוד ומחיקה"
            >
              <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSelectionMode ? 'סיים בחירה' : 'איחוד / מחיקה ידנית'}</span>
            </button>

            {onOpenImport && (
              <button
                onClick={onOpenImport}
                className="px-3 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-200 hover:text-white text-xs font-bold border border-indigo-700/50 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>ייבוא</span>
              </button>
            )}

            <button
              onClick={() => setIsAddingCustom(!isAddingCustom)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>הוסף עובדה</span>
            </button>

            <button
              onClick={handleFetchFacts}
              disabled={isSearching}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-95"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>{isSearching ? `מחלץ עובדות...` : `שלוף עובדות מהרשת`}</span>
            </button>
          </div>
        </div>

        {/* Live Search Query Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-800/80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="שם הסרט המדויק לחיפוש עובדות (למשל: אינספשן / Inception)..."
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="relative flex-1">
            <Target className="w-4 h-4 text-amber-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={focusNotes}
              onChange={(e) => setFocusNotes(e.target.value)}
              placeholder="דרישות מחקר מחייבות (פסקול, תקציב, שחקן, במאי, סצנת סיום)..."
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs text-amber-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Feedback Messages */}
        {feedbackMsg && (
          <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200 ${
            feedbackType === 'success' 
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' 
              : feedbackType === 'error'
              ? 'bg-rose-950/40 text-rose-300 border-rose-500/30'
              : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/30'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Add Custom Fact Inline Form */}
        {isAddingCustom && (
          <form onSubmit={handleAddCustomFact} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 animate-in fade-in">
            <h4 className="text-xs font-bold text-slate-200">הוספת כרטיסיית עובדה חדשה על הסרט</h4>
            <textarea
              rows={2}
              value={customFactText}
              onChange={(e) => setCustomFactText(e.target.value)}
              placeholder="הזן עובדה, פרט עלילה, אנקדוטה או ציון ספציפי על הסרט..."
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              required
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as FactCategory)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="behind_the_scenes">מאחורי הקלעים</option>
                <option value="plot">עלילה ותמות</option>
                <option value="cast">שחקנים ודמויות</option>
                <option value="production_crew">צוות הפקה ובימוי</option>
                <option value="reviews">ביקורות וקופות</option>
              </select>

              <select
                value={customSource}
                onChange={(e) => setCustomSource(e.target.value as any)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="IMDb">IMDb</option>
                <option value="Wikipedia">Wikipedia</option>
                <option value="Rotten Tomatoes">Rotten Tomatoes</option>
                <option value="Letterboxd">Letterboxd</option>
                <option value="Metacritic">Metacritic</option>
                <option value="Variety / Empire">Variety / Empire</option>
              </select>

              <input
                type="text"
                placeholder="ציון (למשל: 8.8/10)"
                value={customScore}
                onChange={(e) => setCustomScore(e.target.value)}
                className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />

              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  הוסף עובדה
                </button>
                {onOpenSmartAdd && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustom(false);
                      onOpenSmartAdd();
                    }}
                    className="py-2 px-2.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 font-bold text-xs flex items-center gap-1"
                    title="סיווג אוטומטי של המידע הנוסף"
                  >
                    <Sparkles className="w-3 h-3 text-purple-300" />
                    <span>סיווג חכם</span>
                  </button>
                )}
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

      {/* Category, Series & Source Multi-Filter Bar */}
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

        {/* Series Sort & Sources Filter */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {hasSequencedFacts && (
            <button
              onClick={() => setSortBySeries(!sortBySeries)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-all ${
                sortBySeries
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 border-amber-400 font-black shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="הצג לפי סדר כרונולוגי של הסדרה (אחד אחרי השני)"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>סדרה עוקבת {sortBySeries ? '✓' : ''}</span>
            </button>
          )}

          <div className="flex items-center gap-1 text-xs">
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
      </div>

      {/* Cards Grid */}
      {displayedFacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedFacts.map((factItem, idx) => {
            const meta = getCategoryMeta(factItem.category);
            const Icon = meta.icon;
            const isSelected = selectedFactIds.has(factItem.id);

            return (
              <div
                key={factItem.id}
                onClick={() => {
                  if (isSelectionMode) handleToggleSelect(factItem.id);
                }}
                className={`p-4 rounded-3xl border transition-all flex flex-col justify-between group relative ${
                  isSelected
                    ? 'bg-amber-950/30 border-amber-400 ring-2 ring-amber-400 shadow-xl shadow-amber-500/10'
                    : factItem.isPinnedToHUD
                    ? 'bg-gradient-to-b from-slate-900 to-indigo-950/40 border-amber-500/50 shadow-xl shadow-amber-500/5 ring-1 ring-amber-500/30'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                } ${isSelectionMode ? 'cursor-pointer' : ''}`}
              >
                <div>
                  {/* Sequence Pill Badge: Order 1 by 1 */}
                  {factItem.seriesOrder && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                      <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 flex items-center gap-1 shadow-sm">
                        <ListOrdered className="w-3 h-3" />
                        <span>חלק {factItem.seriesOrder} בסדרה</span>
                      </span>
                      {factItem.seriesGroup && (
                        <span className="text-[10px] text-amber-300 font-medium bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/20 truncate max-w-[210px]">
                          {factItem.seriesGroup}
                        </span>
                      )}
                      {factItem.relatedCount && factItem.relatedCount > 1 && (
                        <span className="text-[10px] text-purple-300 bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-500/30 font-bold flex items-center gap-1">
                          <Layers className="w-2.5 h-2.5 text-purple-400" />
                          <span>אוחדו {factItem.relatedCount} עובדות</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      {isSelectionMode && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(factItem.id);
                          }}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      )}

                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${meta.color}`}>
                        <Icon className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>

                      {/* Source Badge */}
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold tracking-wider ${getSourceBadge(factItem.source)}`}>
                        {factItem.source}
                      </span>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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

                {/* Card Footer: Scores, Sequence Shift & Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
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
                    {/* Sequence order move buttons (Up / Down: אחד אחרי השני) */}
                    <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/60">
                      <button
                        onClick={() => handleMoveSeriesItem(factItem.id, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded"
                        title="הזז קודם בסדרה (אחד אחרי השני)"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleMoveSeriesItem(factItem.id, 'down')}
                        disabled={idx === displayedFacts.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded"
                        title="הזז הבא בסדרה (אחד אחרי השני)"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Quick merge with next card */}
                    {idx < displayedFacts.length - 1 && (
                      <button
                        onClick={() => handleMergeWithNext(idx)}
                        className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/40 text-[10px] font-bold flex items-center gap-1 transition-colors"
                        title="חבר כרטיסייה זו עם הכרטיסייה הבאה בסדרה (מונע פיצול)"
                      >
                        <GitMerge className="w-3 h-3 text-purple-400" />
                        <span className="hidden sm:inline">חבר לבאה</span>
                      </button>
                    )}

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
            לחצו על הכפתור "שלוף עובדות מהרשת" או הזינו עובדה מותאמת אישית כדי להתחיל לבנות את מערך העובדות.
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

      {/* Floating Multi-Select & Merge Action Toolbar */}
      {(isSelectionMode || selectedFactIds.size > 0) && (
        <div className="sticky bottom-4 z-30 p-3.5 rounded-2xl bg-[#0f1422]/95 backdrop-blur-md border border-amber-500/40 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-amber-400" />
              <span>נבחרו {selectedFactIds.size} מתוך {displayedFacts.length} כרטיסיות</span>
            </span>
            <button
              onClick={handleSelectAll}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold underline"
            >
              בחר הכל
            </button>
            {selectedFactIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                נקה בחירה
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMergeSelected}
              disabled={selectedFactIds.size < 2}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 shadow-md shadow-purple-900/30 transition-all active:scale-95"
            >
              <Layers className="w-3.5 h-3.5 text-amber-300" />
              <span>חבר עובדות שנבחרו לסדרה אחת</span>
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedFactIds.size === 0}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>מחק נבחרים ({selectedFactIds.size})</span>
            </button>

            <button
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedFactIds(new Set());
              }}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="סגור מצב בחירה"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
