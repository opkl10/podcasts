'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Episode, HighlightClip, SubtitleItem } from '@/lib/types';
import { getAISettings } from '@/lib/apiConfig';
import { 
  Sparkles, 
  Flame, 
  Play, 
  Pause, 
  Film, 
  Scissors, 
  Trash2, 
  Plus, 
  Clock, 
  Share2, 
  Check, 
  Info, 
  Layers, 
  Zap, 
  ArrowRight,
  TrendingUp,
  MessageSquare,
  Video,
  FileText,
  Volume2,
  Edit3,
  Sliders,
  X
} from 'lucide-react';

interface HighlightClipsManagerProps {
  episode: Episode;
  onUpdateEpisode: (updated: Episode) => void;
  onOpenAudiogramForClip: (clip: HighlightClip) => void;
}

export default function HighlightClipsManager({
  episode,
  onUpdateEpisode,
  onOpenAudiogramForClip
}: HighlightClipsManagerProps) {
  const [clips, setClips] = useState<HighlightClip[]>(episode.highlightClips || []);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectStatusMessage, setDetectStatusMessage] = useState<string>('');
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingClip, setEditingClip] = useState<HighlightClip | null>(null);

  // New Clip Form State
  const [newClipTitle, setNewClipTitle] = useState<string>('');
  const [newClipStart, setNewClipStart] = useState<number>(0);
  const [newClipEnd, setNewClipEnd] = useState<number>(30);
  const [newClipCategory, setNewClipCategory] = useState<HighlightClip['category']>('highlight');
  const [newClipReason, setNewClipReason] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const subtitles = episode.subtitles || [];
  const hasSubtitles = subtitles.length > 0;
  const audioBlobUrl = (episode as any).audioFileUrl || episode.recording?.audioBlobKey || '';

  // Keep local state synced with episode
  useEffect(() => {
    if (episode.highlightClips) {
      setClips(episode.highlightClips);
    }
  }, [episode.highlightClips]);

  // Audio Playback Listener for Clipping Boundaries
  const handleTimeUpdate = () => {
    if (!audioRef.current || !playingClipId) return;
    const current = audioRef.current.currentTime;
    setCurrentTime(current);

    const activeClip = clips.find(c => c.id === playingClipId);
    if (activeClip && current >= activeClip.endTime) {
      audioRef.current.pause();
      setPlayingClipId(null);
    }
  };

  const togglePlayClip = (clip: HighlightClip) => {
    if (!audioRef.current) return;

    if (playingClipId === clip.id) {
      audioRef.current.pause();
      setPlayingClipId(null);
    } else {
      audioRef.current.currentTime = clip.startTime;
      audioRef.current.play().then(() => {
        setPlayingClipId(clip.id);
      }).catch(err => {
        console.error('Audio play error:', err);
        alert('לא ניתן להשמיע את הקובץ. אנא ודא שקיים קובץ שמע לפרק.');
      });
    }
  };

  // AI Detect Clips Trigger
  const handleDetectClips = async () => {
    setIsDetecting(true);
    setDetectStatusMessage(
      hasSubtitles 
        ? 'מנתח את תמליל וכתוביות הפרק ומאתר הוקים ויראליים...' 
        : 'מנתח את נושאי הפרק והמחקר ומייצר קליפים מומלצים ל-Shorts...'
    );

    try {
      const aiSettings = getAISettings();
      const res = await fetch('/api/ai/detect-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles: episode.subtitles || [],
          topics: episode.topics || [],
          movieFacts: episode.movieFacts || [],
          episodeTitle: episode.title,
          description: episode.description || '',
          duration: episode.recording?.duration || (episode.targetDurationMinutes * 60) || 1620,
          apiKey: aiSettings.geminiApiKey || aiSettings.openaiApiKey || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'שגיאה בזיהוי הקטעים');
      }

      const detectedClips: HighlightClip[] = data.clips || [];
      if (detectedClips.length === 0) {
        alert('לא אותרו קטעים העונים לקריטריונים. נסה להוסיף קליפ ידנית.');
      } else {
        setClips(detectedClips);
        const updated = {
          ...episode,
          highlightClips: detectedClips
        };
        onUpdateEpisode(updated);
        setDetectStatusMessage(`נמצאו ${detectedClips.length} קטעים ויראליים בהצלחה!`);
        setTimeout(() => setDetectStatusMessage(''), 4000);
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'אירעה שגיאה בעת זיהוי הקטעים');
    } finally {
      setIsDetecting(false);
    }
  };

  // Save changes to episode
  const handleSaveClips = (newClips: HighlightClip[]) => {
    setClips(newClips);
    onUpdateEpisode({
      ...episode,
      highlightClips: newClips
    });
  };

  // Delete Clip
  const handleDeleteClip = (id: string) => {
    if (confirm('האם למחוק קליפ זה?')) {
      const filtered = clips.filter(c => c.id !== id);
      handleSaveClips(filtered);
    }
  };

  // Add Manual Clip
  const handleAddManualClip = () => {
    if (!newClipTitle.trim()) {
      alert('נא להזין כותרת לקליפ');
      return;
    }

    const duration = Math.max(5, newClipEnd - newClipStart);
    const newClip: HighlightClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: newClipTitle.trim(),
      headline: `קטע מתוך ${episode.title}`,
      startTime: Number(newClipStart),
      endTime: Number(newClipEnd),
      duration,
      viralScore: 88,
      category: newClipCategory,
      reason: newClipReason.trim() || 'קליפ שנוצר ונבחר ידנית על ידי המפיק',
      summary: newClipTitle.trim(),
      suggestedAspectRatio: '9:16',
      hookText: newClipTitle.trim()
    };

    const updated = [...clips, newClip];
    handleSaveClips(updated);
    setIsAddModalOpen(false);
    setNewClipTitle('');
    setNewClipReason('');
  };

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Category visual styles
  const getCategoryBadge = (cat: HighlightClip['category']) => {
    switch (cat) {
      case 'debate':
        return { label: '🎭 דיבייט סוער', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      case 'punchline':
        return { label: '💥 פאנץ׳ מחץ', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'insight':
        return { label: '💡 תובנה עמוקה', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'behind_the_scenes':
        return { label: '🤫 מאחורי הקלעים', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
      case 'emotional':
        return { label: '❤️ רגע מרגש', bg: 'bg-pink-500/10 text-pink-400 border-pink-500/30' };
      case 'quote':
        return { label: '💬 ציטוט בלתי נשכח', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
      default:
        return { label: '⭐ רגע שיא', bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' };
    }
  };

  // Get subtitles in clip range for preview
  const getClipSubtitles = (clip: HighlightClip) => {
    return subtitles
      .filter(s => s.startTime >= clip.startTime - 1 && s.endTime <= clip.endTime + 1)
      .map(s => s.text)
      .join(' ');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hidden Audio for Snippet Preview */}
      <audio
        ref={audioRef}
        src={audioBlobUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setPlayingClipId(null)}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-rose-950/40 border border-amber-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Flame className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>גלאי רגעים ויראליים ויוצר Shorts & Reels</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  AI Viral Hunter
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                סריקה אוטומטית של הפרק, זיהוי הוקים חזקים וייצוא מהיר לסרטוני טיקטוק, אינסטגרם רילס ויוטיוב שורטס
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleDetectClips}
            disabled={isDetecting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-slate-950 font-black text-xs shadow-xl shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDetecting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>סורק רגעים ויראליים...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>✨ זהה קטעים ויראליים עם AI</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>הוסף קליפ ידני</span>
          </button>
        </div>
      </div>

      {/* Status Message Notification */}
      {detectStatusMessage && (
        <div className="px-4 py-2.5 rounded-2xl bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{detectStatusMessage}</span>
        </div>
      )}

      {/* Notice if no subtitles */}
      {!hasSubtitles && (
        <div className="p-4 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">טרם הופקו כתוביות לפרק זה</h4>
              <p className="text-[11px] text-slate-400">
                ה-AI יכול לזהות רגעים מתוך נושאי השיחה, או שתוכל לתמלל את השמע לקבלת דיוק של 100% לפי זמני דיבור.
              </p>
            </div>
          </div>
          <a
            href={`/episodes/${episode.id}/subtitles`}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition-all shrink-0 text-center"
          >
            🎙️ פתח אולפן כתוביות
          </a>
        </div>
      )}

      {/* Clips Grid */}
      {clips.length === 0 ? (
        <div className="p-12 rounded-3xl bg-slate-950/60 border border-slate-900 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <Flame className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">אין קטעים ויראליים שמורים עדיין</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            לחץ על כפתור <strong>&quot;✨ זהה קטעים ויראליים עם AI&quot;</strong> למעלה כדי שהמערכת תאתר עבורך את 5 הקטעים הכי חזקים בפרק.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {clips.map((clip, index) => {
            const badge = getCategoryBadge(clip.category);
            const isPlaying = playingClipId === clip.id;
            const subtitleText = getClipSubtitles(clip);

            return (
              <div
                key={clip.id}
                className="group relative p-5 rounded-3xl bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all shadow-xl hover:shadow-2xl hover:shadow-amber-950/20 flex flex-col justify-between space-y-4"
              >
                {/* Top Row: Category + Viral Score */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${badge.bg}`}>
                    {badge.label}
                  </span>

                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-black text-xs shadow-inner">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    <span>{clip.viralScore}% ויראלי</span>
                  </div>
                </div>

                {/* Main Content: Title & Timestamps */}
                <div className="space-y-2">
                  <h4 className="text-sm sm:text-base font-black text-white group-hover:text-amber-300 transition-colors leading-snug">
                    {clip.title}
                  </h4>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>{formatTime(clip.startTime)} - {formatTime(clip.endTime)}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 font-bold">
                      {Math.round(clip.duration)} שנ׳
                    </span>
                  </div>

                  {/* Why It's Viral Note */}
                  {clip.reason && (
                    <div className="p-2.5 rounded-2xl bg-amber-950/30 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{clip.reason}</span>
                    </div>
                  )}

                  {/* Subtitle Snippet Preview */}
                  {subtitleText && (
                    <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300 line-clamp-3 leading-relaxed">
                      <span className="text-slate-500 font-bold ml-1">תמליל:</span>
                      &quot;{subtitleText}&quot;
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  {/* Play Audio Snippet Button */}
                  <button
                    onClick={() => togglePlayClip(clip)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isPlaying 
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 animate-pulse' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                    title="השמעת קטע האודיו הנבחר"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>עצור</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span>השמע</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Open in 9:16 Video Studio Button */}
                    <button
                      onClick={() => onOpenAudiogramForClip(clip)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-black shadow-lg shadow-pink-600/20 active:scale-95 transition-all"
                      title="יצירת סרטון קצר מעוצב (9:16) בסטודיו הווידאו"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>🎬 צור סרטון קצר (9:16)</span>
                    </button>

                    {/* Edit Clip Timestamps / Title Button */}
                    <button
                      onClick={() => setEditingClip(clip)}
                      className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 transition-colors"
                      title="ערוך טווח זמנים וכותרת הקליפ"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Clip Button */}
                    <button
                      onClick={() => handleDeleteClip(clip.id)}
                      className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-colors"
                      title="מחיקת קליפ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Add Clip Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>הוספת קליפ ויראלי ידני</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">כותרת הקליפ (Hook):</label>
                <input
                  type="text"
                  value={newClipTitle}
                  onChange={(e) => setNewClipTitle(e.target.value)}
                  placeholder="למשל: הסוד מאחורי סצנת הסיום..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">זמן התחלה (שניות):</label>
                  <input
                    type="number"
                    value={newClipStart}
                    onChange={(e) => setNewClipStart(Number(e.target.value))}
                    min={0}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">זמן סיום (שניות):</label>
                  <input
                    type="number"
                    value={newClipEnd}
                    onChange={(e) => setNewClipEnd(Number(e.target.value))}
                    min={newClipStart + 1}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">קטגוריה:</label>
                <select
                  value={newClipCategory}
                  onChange={(e) => setNewClipCategory(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="debate">🎭 דיבייט סוער</option>
                  <option value="punchline">💥 פאנץ׳ מחץ</option>
                  <option value="insight">💡 תובנה עמוקה</option>
                  <option value="behind_the_scenes">🤫 מאחורי הקלעים</option>
                  <option value="emotional">❤️ רגע מרגש</option>
                  <option value="quote">💬 ציטוט בלתי נשכח</option>
                  <option value="highlight">⭐ רגע שיא</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">למה הקטע ויראלי (הסבר קצר):</label>
                <input
                  type="text"
                  value={newClipReason}
                  onChange={(e) => setNewClipReason(e.target.value)}
                  placeholder="למשל: שאלה שמעוררת ויכוח מיידי בתגובות"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
              >
                ביטול
              </button>
              <button
                onClick={handleAddManualClip}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg"
              >
                הוסף קליפ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Clip Modal */}
      {editingClip && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>עריכת טווח זמנים וכותרת לקליפ</span>
              </h3>
              <button
                onClick={() => setEditingClip(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">כותרת הוק ל-Shorts:</label>
                <input
                  type="text"
                  value={editingClip.title}
                  onChange={(e) => setEditingClip({ ...editingClip, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">נקודת התחלה (שניות / In-Point):</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editingClip.startTime}
                    onChange={(e) => {
                      const s = parseFloat(e.target.value) || 0;
                      setEditingClip({
                        ...editingClip,
                        startTime: s,
                        duration: Math.max(5, editingClip.endTime - s)
                      });
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-amber-400 font-mono mt-0.5 block">
                    טיימקוד: {formatTime(editingClip.startTime)}
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">נקודת סיום (שניות / Out-Point):</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editingClip.endTime}
                    onChange={(e) => {
                      const end = parseFloat(e.target.value) || 0;
                      setEditingClip({
                        ...editingClip,
                        endTime: end,
                        duration: Math.max(5, end - editingClip.startTime)
                      });
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs"
                  />
                  <span className="text-[10px] text-amber-400 font-mono mt-0.5 block">
                    טיימקוד: {formatTime(editingClip.endTime)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">משך הקליפ הנבחר:</span>
                <span className="font-mono font-bold text-amber-400">
                  {Math.round(editingClip.endTime - editingClip.startTime)} שניות
                </span>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">קטגוריה:</label>
                <select
                  value={editingClip.category}
                  onChange={(e) => setEditingClip({ ...editingClip, category: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                >
                  <option value="behind_the_scenes">🤫 מאחורי הקלעים / סוד הפקה</option>
                  <option value="debate">🎭 דיבייט סוער / ויכוח</option>
                  <option value="punchline">💥 פאנץ׳ / פסק דין וציון</option>
                  <option value="insight">💡 תובנה עמוקה / דילמה</option>
                  <option value="emotional">❤️ רגע מרגש / דרמטי</option>
                  <option value="quote">💬 ציטוט בלתי נשכח</option>
                  <option value="highlight">⭐ רגע שיא כללי</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => togglePlayClip(editingClip)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                >
                  {playingClipId === editingClip.id ? 'עצור האזנה' : '▶️ האזן לקטע זה'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updated = clips.map(c => c.id === editingClip.id ? editingClip : c);
                    handleSaveClips(updated);
                    setEditingClip(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg"
                >
                  שמור שינויים
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
