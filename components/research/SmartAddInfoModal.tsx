'use client';

import React, { useState } from 'react';
import { TopicItem, MovieFactCard } from '@/lib/types';
import { smartIntegrateAdditionalInfo, SmartIntegrationResult, SmartIntegrationAction } from '@/lib/smartIntegrator';
import { getStoredGeminiApiKey } from '@/lib/apiConfig';
import { 
  Sparkles, 
  X, 
  Layers, 
  CheckCircle2, 
  PlusCircle, 
  ArrowRight, 
  ListChecks, 
  Film, 
  Tag, 
  HelpCircle, 
  Info,
  Check,
  AlertCircle,
  Wand2,
  RefreshCw
} from 'lucide-react';

interface SmartAddInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  episodeTitle: string;
  existingTopics: TopicItem[];
  existingFacts: MovieFactCard[];
  onApply: (updatedTopics: TopicItem[], updatedFacts: MovieFactCard[], message: string) => void;
  defaultScope?: 'all' | 'topics' | 'facts';
}

const PRESET_IDEAS = [
  { label: '🎬 סוד מהסט', text: 'במהלך צילומי סצנת המרדף השחקן הראשי שבר אצבע אבל המשיך לשחק בלי לעצור את הטייק.' },
  { label: '🎭 ליהוק ודמויות', text: 'לתפקיד הראשי נבחנו למעלה מ-200 מועמדים, כולל שחקנים מוכרים שסורבו ברגע האחרון.' },
  { label: '🎥 החלטת בימוי', text: 'הבמאי התעקש להשתמש באפקטים פרקטיים בלבד וללא מסך ירוק, כדי ליצור תחושת ריאליזם מוחלטת.' },
  { label: '📊 קופות וציונים', text: 'הסרט שבר שיא פתיחה עולמי עם 140 מיליון דולר בסוף השבוע הראשון וציון 94% ב-Rotten Tomatoes.' },
  { label: '💡 זווית חדשה לדיון', text: 'הקמפיין השיווקי בטיקטוק שהפך את הסרט לתופעה תרבותית ויראלית בקרב דור ה-Z.' }
];

export default function SmartAddInfoModal({
  isOpen,
  onClose,
  episodeTitle,
  existingTopics = [],
  existingFacts = [],
  onApply,
  defaultScope = 'all'
}: SmartAddInfoModalProps) {
  const [additionalText, setAdditionalText] = useState('');
  const [targetScope, setTargetScope] = useState<'all' | 'topics' | 'facts'>(defaultScope);
  const [isProcessing, setIsProcessing] = useState(false);
  const [integrationResult, setIntegrationResult] = useState<SmartIntegrationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!additionalText.trim()) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setIntegrationResult(null);

    try {
      const apiKey = getStoredGeminiApiKey();
      const result = await smartIntegrateAdditionalInfo({
        additionalInfo: additionalText.trim(),
        existingTopics,
        existingFacts,
        episodeTitle,
        targetScope,
        apiKey
      });

      if (!result.success && result.summary.actions.length === 0) {
        throw new Error('לא זוהה מידע תקף לסיווג');
      }

      setIntegrationResult(result);
    } catch (err: any) {
      console.error('Smart integrate error:', err);
      setErrorMsg(err?.message || 'שגיאה בניתוח וסיווג המידע הנוסף');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyChanges = () => {
    if (!integrationResult) return;

    const matchedCount = integrationResult.summary.matchedCount;
    const newCount = integrationResult.summary.newCount;
    
    let msg = 'המידע שולב בהצלחה!';
    if (matchedCount > 0 && newCount > 0) {
      msg = `שולב בהצלחה: ${matchedCount} פריטים תוייגו ושויכו לתוכן קיים, ו-${newCount} נושאים/כרטיסיות חדשים נוספו במקום משלהם!`;
    } else if (matchedCount > 0) {
      msg = `תוייגו ושויכו בהצלחה ${matchedCount} פריטים לתוך התוכן הקיים בצורה מסודרת!`;
    } else if (newCount > 0) {
      msg = `נוספו בהצלחה ${newCount} פריטים חדשים במקום משלהם!`;
    }

    onApply(integrationResult.updatedTopics, integrationResult.updatedFacts, msg);
    onClose();
  };

  const insertPreset = (text: string) => {
    setAdditionalText(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${text}` : text;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-3xl rounded-3xl bg-[#121620] border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800/80 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">הוספת מידע חכם (מיזוג ותיוג אוטומטי)</h3>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  AI Smart Classifier
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                הזינו כל מידע נוסף — המערכת תתייג ותשלב אותו במה שקיים, או תוסיף למקום משלו אם הוא חדש
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

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 relative z-10">
          {/* Target Scope Switcher */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>לאן למזג ולסווג את המידע הנוסף?</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  targetScope === 'all'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>הכל (נושאים + עובדות)</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope('topics')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  targetScope === 'topics'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                <span>ראשי פרקים בלבד ({existingTopics.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setTargetScope('facts')}
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  targetScope === 'facts'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>עובדות קולנוע בלבד ({existingFacts.length})</span>
              </button>
            </div>
          </div>

          {/* Preset Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400">הצעות מהירות למידע (לחץ להוספה):</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_IDEAS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertPreset(preset.text)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-1"
                >
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Freeform Additional Information Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-400" />
                <span>הזן כאן את המידע הנוסף (טקסט חופשי, פסקאות, נקודות או עובדות):</span>
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                {additionalText.length} תווים
              </span>
            </div>

            <textarea
              value={additionalText}
              onChange={(e) => setAdditionalText(e.target.value)}
              placeholder="לדוגמה:&#10;• השחקן הראשי שבר אצבע בסצנת המרדף אבל המשיך לשחק.&#10;• הבמאי בחר לצלם על פילם 70 מ״מ בלוקיישנים אמיתיים באיסלנד.&#10;• קמפיין השיווק והסושיאל שבר שיאי צפיות בטיקטוק..."
              rows={6}
              className="w-full rounded-2xl bg-slate-950/80 border border-slate-800 p-4 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
            />
          </div>

          {/* Action Trigger Button */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isProcessing || !additionalText.trim()}
              className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>מנתח, מתייג ומסווג את המידע מול התוכן הקיים...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-white" />
                  <span>⚡ נתח וסווג עכשיו (מיזוג לקיים או יצירת חדש)</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Integration Diff & Categorization Results Preview */}
          {integrationResult && (
            <div className="space-y-4 pt-4 border-t border-slate-800 animate-in fade-in slide-in-from-bottom-2">
              {/* Summary Stats Header */}
              <div className="flex items-center justify-between bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">תוצאות סיווג המידע:</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
                    <span>🔗 {integrationResult.summary.matchedCount} שויכו לקיים</span>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1">
                    <span>🆕 {integrationResult.summary.newCount} נוצרו במקום משלהם</span>
                  </span>
                </div>
              </div>

              {/* Categorization Actions List */}
              <div className="space-y-2.5">
                {integrationResult.summary.actions.map((act, i) => (
                  <div
                    key={i}
                    className={`p-3.5 rounded-2xl border text-right space-y-1.5 transition-all ${
                      act.action === 'matched_existing'
                        ? 'bg-emerald-950/20 border-emerald-500/30 ring-1 ring-emerald-500/20'
                        : 'bg-purple-950/20 border-purple-500/30 ring-1 ring-purple-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {act.action === 'matched_existing' ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black text-[10px] uppercase border border-emerald-500/30">
                            🔗 שויך ותוייג בקיים
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-black text-[10px] uppercase border border-purple-500/30">
                            🆕 מקום חדש ועצמאי
                          </span>
                        )}
                        <span className="text-xs font-bold text-white">
                          {act.type === 'topic' ? 'ראשי פרקים' : 'עובדת קולנוע'}: {act.targetTitle}
                        </span>
                      </div>

                      {act.tag && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          🏷️ {act.tag}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                      {act.explanation}
                    </p>

                    <div className="text-[11px] text-slate-400 bg-black/40 p-2 rounded-xl font-mono border border-white/5 truncate">
                      {act.taggedContent}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-3 relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors"
          >
            ביטול
          </button>

          {integrationResult && (
            <button
              type="button"
              onClick={handleApplyChanges}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95 animate-in fade-in"
            >
              <Check className="w-4 h-4" />
              <span>החל שינויים ושמור בפרק</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
