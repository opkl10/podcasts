'use client';

import React, { useState, useEffect } from 'react';
import { TopicItem } from '@/lib/types';
import { runAIResearch } from '@/lib/aiClient';
import { 
  X, 
  Sparkles, 
  Key, 
  Search, 
  Check, 
  Plus, 
  Clock, 
  HelpCircle, 
  ListChecks, 
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Zap,
  BookOpen,
  ArrowRight,
  MessageSquare,
  MessageCircle,
  ThumbsUp,
  Target
} from 'lucide-react';

interface DeepResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  episodeTitle: string;
  guestName?: string;
  guestRole?: string;
  targetDurationMinutes: number;
  onApplyTopics: (topics: TopicItem[], suggestedTitle?: string) => void;
}

export default function DeepResearchModal({
  isOpen,
  onClose,
  episodeTitle,
  guestName,
  guestRole,
  targetDurationMinutes,
  onApplyTopics
}: DeepResearchModalProps) {
  const [topicQuery, setTopicQuery] = useState(episodeTitle);
  const [userReview, setUserReview] = useState('');
  const [specificFocus, setSpecificFocus] = useState('');
  const [tone, setTone] = useState<'deep' | 'conversational' | 'provocative' | 'educational'>('deep');
  const [duration, setDuration] = useState(targetDurationMinutes);
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Status & Results
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [researchResult, setResearchResult] = useState<{
    executiveSummary: string;
    suggestedTitle?: string;
    topics: TopicItem[];
    source?: string;
    webGrounding?: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('castflow_gemini_api_key') || '';
      setApiKey(savedKey);
      if (!savedKey) {
        setShowKeyInput(true);
      }
    }
    setTopicQuery(episodeTitle);
    setDuration(targetDurationMinutes);
  }, [episodeTitle, targetDurationMinutes, isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('castflow_gemini_api_key', apiKey.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const handleRunResearch = async () => {
    if (!topicQuery.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    setResearchResult(null);

    setLoadingStep(1);
    const s1 = setTimeout(() => setLoadingStep(2), 600);
    const s2 = setTimeout(() => setLoadingStep(3), 1200);

    try {
      const result = await runAIResearch({
        topic: topicQuery.trim(),
        episodeTitle,
        guestName,
        guestRole,
        targetDurationMinutes: Number(duration),
        tone,
        apiKey: apiKey.trim() || undefined,
        mode: 'full_episode',
        userReview: userReview.trim() || undefined,
        specificFocus: specificFocus.trim() || undefined
      });

      clearTimeout(s1);
      clearTimeout(s2);

      if (!result || !result.data) {
        throw new Error('לא התקבלו תוצאות מחקר');
      }

      const generatedTopics: TopicItem[] = (result.data.topics || []).map((t: any, idx: number) => ({
        id: `top-ai-${Date.now()}-${idx}`,
        title: t.title,
        estimatedMinutes: t.estimatedMinutes || 10,
        notes: t.notes || '',
        talkingPoints: t.talkingPoints || [],
        questions: t.questions || [],
        resources: (t.resources || []).map((r: any, rIdx: number) => ({
          id: `res-${Date.now()}-${rIdx}`,
          title: r.title,
          url: r.url || 'https://google.com'
        })),
        completed: false,
        order: idx + 1
      }));

      setResearchResult({
        executiveSummary: result.data.executiveSummary,
        suggestedTitle: result.data.suggestedTitle,
        topics: generatedTopics,
        source: result.source,
        webGrounding: result.webGrounding
      });
    } catch (err: any) {
      console.error('Research error:', err);
      setErrorMsg(err.message || 'שגיאה בביצוע המחקר');
    } finally {
      setIsLoading(false);
      setLoadingStep(0);
    }
  };

  const handleApplyAll = () => {
    if (!researchResult) return;
    onApplyTopics(researchResult.topics, researchResult.suggestedTitle);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-3xl rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">מחקר פודקאסט מעמיק וממוקד עם AI</h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 font-bold px-2 py-0.5 rounded-full border border-purple-500/30">
                  סרטים • קולנוע • טכנולוגיה
                </span>
              </div>
              <p className="text-xs text-slate-400">איסוף עובדות מהרשת, שילוב הדעה והביקורת האישית שלכם ושאלות עומק לדיון</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* API Key Drawer (Gemini API) */}
        <div className="relative z-10 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-300">חיבור למודל AI חיצוני (Google Gemini API)</span>
            </div>
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-xs text-indigo-400 hover:underline font-medium"
            >
              {showKeyInput ? 'הסתר מפתח' : (apiKey ? 'מפתח מוגדר ✓ (החלף)' : 'הזן מפתח API')}
            </button>
          </div>

          {showKeyInput && (
            <div className="pt-2 border-t border-slate-800 space-y-2 animate-in fade-in">
              <p className="text-[11px] text-slate-400">
                הזינו מפתח חינמי מ-
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline mx-1">
                  Google AI Studio (Gemini)
                </a>
                לביצוע מחקר חי בזמן אמת, או השתמשו במנוע המחקר המובנה.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSaveKey}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1"
                >
                  {keySaved ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                  <span>{keySaved ? 'נשמר!' : 'שמור מפתח'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Input Parameters Form with User Review */}
        <div className="space-y-4 relative z-10 bg-slate-900/60 p-5 rounded-2xl border border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1.5">
              שם הסרט / היצירה / הנושא המרכזי: <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              placeholder="למשל: הסרט אינספשן (Inception), אופנהיימר, הסנדק, מטריקס..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* User Review / Take Field */}
          <div>
            <label className="block text-xs font-bold text-indigo-300 mb-1.5 flex items-center gap-1.5">
              <MessageCircle className="w-3.5 h-3.5 text-indigo-400" />
              הביקורת / הדעה האישית שלך (ה-AI יבנה דיבייט סביבה):
            </label>
            <textarea
              rows={2}
              value={userReview}
              onChange={(e) => setUserReview(e.target.value)}
              placeholder="למשל: 'אהבתי את האפקטים של המסדרון המסתובב, אבל הרגשתי שהסוף עם הסביבון היה קצת מאולץ. לדעתי הציון הוא 8/10'..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">סגנון השיחה והדיבייט</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="deep">🎬 ניתוח עומק קולנועי מבוסס עובדות</option>
                <option value="provocative">⚡ דיבייט חריף וביקורתי (שאלות מאתגרות)</option>
                <option value="conversational">☕ שיחתי, קליל ומעורר השראה</option>
                <option value="educational">📚 ניתוח תסריט, מבנה ומאחורי הקלעים</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">משך היעד של הפרק (דקות)</label>
              <input
                type="number"
                min={10}
                max={180}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white text-center focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Trigger Button */}
          <div className="pt-2">
            <button
              onClick={handleRunResearch}
              disabled={isLoading || !topicQuery.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-purple-900/40 active:scale-98 transition-all"
            >
              <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'מבצע מחקר עומק קונקרטי...' : 'בצע מחקר מעמיק וממוקד עכשיו'}</span>
            </button>
          </div>
        </div>

        {/* Loading Progress State */}
        {isLoading && (
          <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-800/30 text-center space-y-3 animate-in fade-in">
            <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-purple-200">
                {loadingStep === 1 && '🌐 סורק נתונים מהרשת על הבמאי, הדמויות והעלילה...'}
                {loadingStep === 2 && '💡 משלב את הביקורת שלך ומחלץ שאלות דיבייט ספציפיות...'}
                {loadingStep === 3 && '📊 בונה מערך ראשי פרקים מתוזמנים ללא שאלות גנריות...'}
              </p>
              <p className="text-[11px] text-slate-400">מודל ה-AI מעבד נתונים קונקרטיים</p>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/50 flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Results Viewer */}
        {researchResult && !isLoading && (
          <div className="space-y-5 relative z-10 animate-in fade-in duration-300">
            {/* Executive Summary Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-800/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  תקציר מחקר ממוקד
                </span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                  {researchResult.source || 'AI Engine'}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {researchResult.executiveSummary}
              </p>
            </div>

            {/* Generated Topics Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">
                  ראשי פרקים ושאלות ספציפיות שהופקו ({researchResult.topics.length}):
                </span>
              </div>

              <div className="space-y-3">
                {researchResult.topics.map((t, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-purple-600/30 text-purple-300 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span>{t.title}</span>
                      </h4>
                      <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t.estimatedMinutes} דק'
                      </span>
                    </div>

                    {t.notes && (
                      <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/60">
                        {t.notes}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Talking points */}
                      <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800/60 space-y-1">
                        <span className="text-[11px] font-bold text-indigo-300">נקודות מפתח ספציפיות:</span>
                        <ul className="space-y-1">
                          {t.talkingPoints.map((tp, pIdx) => (
                            <li key={pIdx} className="text-slate-300 text-[11px] flex items-start gap-1.5">
                              <span className="text-indigo-400 mt-0.5">•</span>
                              <span>{tp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Questions */}
                      <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-900/30 space-y-1">
                        <span className="text-[11px] font-bold text-purple-300">שאלות עומק ודיבייט:</span>
                        <ul className="space-y-1">
                          {t.questions.map((q, qIdx) => (
                            <li key={qIdx} className="text-purple-200 text-[11px] flex items-start gap-1.5">
                              <span>❓</span>
                              <span>{q}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Apply Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                סגור
              </button>

              <button
                onClick={handleApplyAll}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>ייבא את כל הנושאים לפרק זה</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
