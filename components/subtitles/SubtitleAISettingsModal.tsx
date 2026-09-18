'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Key, 
  Check, 
  X, 
  ExternalLink, 
  Bot, 
  Volume2, 
  Eye, 
  EyeOff, 
  RotateCw, 
  AlertCircle, 
  CheckCircle2,
  Sliders,
  Zap,
  HelpCircle,
  Code
} from 'lucide-react';
import { 
  getAISettings, 
  saveAISettings, 
  testGeminiConnection, 
  testOpenAIConnection,
  testElevenLabsConnection, 
  POPULAR_ELEVENLABS_VOICES, 
  AISettingsConfig 
} from '@/lib/apiConfig';

interface SubtitleAISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (settings: AISettingsConfig) => void;
}

export default function SubtitleAISettingsModal({
  isOpen,
  onClose,
  onSaved
}: SubtitleAISettingsModalProps) {
  const [settings, setSettings] = useState<AISettingsConfig>(getAISettings());
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [showElevenKey, setShowElevenKey] = useState(false);

  // Testing States
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [isTestingEleven, setIsTestingEleven] = useState(false);
  const [elevenTestResult, setElevenTestResult] = useState<{ success: boolean; message: string; user?: any } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(getAISettings());
      setOpenAITestResult(null);
      setGeminiTestResult(null);
      setElevenTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestOpenAI = async () => {
    setIsTestingOpenAI(true);
    setOpenAITestResult(null);
    try {
      const res = await testOpenAIConnection(settings.openaiApiKey);
      setOpenAITestResult(res);
    } finally {
      setIsTestingOpenAI(false);
    }
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const res = await testGeminiConnection(settings.geminiApiKey);
      setGeminiTestResult(res);
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleTestEleven = async () => {
    setIsTestingEleven(true);
    setElevenTestResult(null);
    try {
      const res = await testElevenLabsConnection(settings.elevenLabsApiKey);
      setElevenTestResult(res);
    } finally {
      setIsTestingEleven(false);
    }
  };

  const handleSave = () => {
    saveAISettings(settings);
    if (onSaved) onSaved(settings);
    alert('הגדרות מפתחות ה-AI נשמרו בהצלחה בדפדפן!');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in font-sans">
      <div className="w-full max-w-2xl max-h-[92vh] rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-8 shadow-2xl flex flex-col overflow-y-auto relative text-right" dir="rtl">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-600 text-white shadow-lg shadow-indigo-600/30">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>הגדרות מפתחות AI (Gemini & OpenAI)</span>
              </h3>
              <p className="text-xs text-slate-400">תמלול אודיו, חלוקת מילים, ותרגום כתוביות חכם</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Guide Card: Where to put API keys */}
        <div className="my-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-purple-950/30 to-slate-900 border border-indigo-500/30 space-y-2.5">
          <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
            <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>איפה משיגים מפתח ואיך שמים אותו? (הסבר פשוט ב-3 צעדים):</span>
          </div>
          <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside pr-1 leading-relaxed">
            <li>
              <strong>Google Gemini (מומלץ וחינם לגמרי):</strong> היכנסו ל-
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer" 
                className="text-indigo-400 underline font-bold mx-1 hover:text-indigo-300"
              >
                Google AI Studio (לחצו כאן)
              </a>
              ולחצו <strong>Get API key</strong> ⬅️ <strong>Create API key</strong>.
            </li>
            <li>
              העתיקו את המפתח והדביקו אותו בתיבת <strong>Google Gemini API Key</strong> למטה.
            </li>
            <li>
              לחצו <strong>&quot;שמור מפתחות API&quot;</strong> – וזהו! המפתח נשמר ומוכן לפעולה.
            </li>
          </ol>
          <div className="pt-2 border-t border-indigo-500/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <Check className="w-3.5 h-3.5" />
              תרגום כתוביות פועל תמיד – גם אם לא תזינו שום מפתח (מנוע מובנה חינם)!
            </span>
            <span className="flex items-center gap-1 text-slate-400 font-mono text-[10px]">
              <Code className="w-3 h-3 text-purple-400" />
              למפתחים: ניתן גם להגדיר GEMINI_API_KEY ב-.env.local או ב-Vercel
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="py-2 space-y-5">
          
          {/* 1. Google Gemini API Section (Recommended & Free) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/40 space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-indigo-600/20 text-indigo-300 text-[10px] font-bold px-3 py-1 rounded-br-xl border-b border-r border-indigo-500/30">
              מומלץ • חינמי ללא כרטיס אשראי
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Google Gemini API Key (חינם)</h4>
                  <p className="text-[11px] text-slate-400">תמלול אודיו, תרגום כתוביות עשיר, חלוקת שורות ומחקר ראשי פרקים</p>
                </div>
              </div>

              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                <span>השג מפתח חינם</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  value={settings.geminiApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                  placeholder="הדבק מפתח Gemini כאן (AIzaSy...)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-left"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestGemini}
                disabled={isTestingGemini || !settings.geminiApiKey.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              >
                {isTestingGemini ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>בדיקת חיבור</span>
              </button>
            </div>

            {/* Test Result Message */}
            {geminiTestResult && (
              <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                geminiTestResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {geminiTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{geminiTestResult.message}</span>
              </div>
            )}
          </div>

          {/* 2. OpenAI API Section (Alternative) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">OpenAI API Key (אופציונלי - Whisper & GPT)</h4>
                  <p className="text-[11px] text-slate-400">תמלול מילה במילה עם Whisper-1 ותרגום GPT-4o</p>
                </div>
              </div>

              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                <span>השג מפתח OpenAI</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showOpenAIKey ? 'text' : 'password'}
                  value={settings.openaiApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                  placeholder="הדבק מפתח OpenAI (sk-... או sk-proj-...)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-left"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showOpenAIKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestOpenAI}
                disabled={isTestingOpenAI || !settings.openaiApiKey.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              >
                {isTestingOpenAI ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>בדיקת חיבור</span>
              </button>
            </div>

            {/* Test Result Message */}
            {openAITestResult && (
              <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                openAITestResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {openAITestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{openAITestResult.message}</span>
              </div>
            )}
          </div>

          {/* Preferred Transcription Provider */}
          <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>ספק תמלול ראשי מועדף:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, transcriptionProvider: 'gemini' }))}
                className={`p-2.5 rounded-xl border text-right transition-all ${
                  settings.transcriptionProvider === 'gemini'
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Google Gemini (חינם ומהיר)</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">זיהוי דיבור חכם ומדויק, ללא צורך בתשלום</p>
              </button>

              <button
                type="button"
                onClick={() => setSettings(prev => ({ ...prev, transcriptionProvider: 'openai' }))}
                className={`p-2.5 rounded-xl border text-right transition-all ${
                  settings.transcriptionProvider === 'openai'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-xs">
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>OpenAI Whisper (מילה במילה)</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">דיוק מקסימלי עם חותמות זמן לכל מילה</p>
              </button>
            </div>
          </div>

          {/* 3. ElevenLabs API Section */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">ElevenLabs API Key (קריינות ודיבוב קולי)</h4>
                  <p className="text-[11px] text-slate-400">הקראת כתוביות בקול אנושי בעברית ובאנגלית</p>
                </div>
              </div>

              <a
                href="https://elevenlabs.io/app/speech-synthesis"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 hover:underline"
              >
                <span>השג מפתח ElevenLabs</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showElevenKey ? 'text' : 'password'}
                  value={settings.elevenLabsApiKey}
                  onChange={(e) => setSettings(prev => ({ ...prev, elevenLabsApiKey: e.target.value }))}
                  placeholder="הדבק מפתח ElevenLabs (sk_...)"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-left"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowElevenKey(!showElevenKey)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showElevenKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleTestEleven}
                disabled={isTestingEleven || !settings.elevenLabsApiKey.trim()}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
              >
                {isTestingEleven ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>בדיקת חיבור</span>
              </button>
            </div>

            {/* Test Result Message */}
            {elevenTestResult && (
              <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                elevenTestResult.success 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {elevenTestResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span>{elevenTestResult.message}</span>
              </div>
            )}

            {/* Voice Selector */}
            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                <span>קול קריינות ברירת מחדל:</span>
                <span className="text-[10px] text-purple-400">תומך בעברית (Multilingual v2)</span>
              </label>
              <select
                value={settings.elevenLabsVoiceId}
                onChange={(e) => setSettings(prev => ({ ...prev, elevenLabsVoiceId: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                {POPULAR_ELEVENLABS_VOICES.map(voice => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
          >
            סגור
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>שמור מפתחות AI</span>
          </button>
        </div>
      </div>
    </div>
  );
}
