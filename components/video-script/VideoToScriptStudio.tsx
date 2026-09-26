'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  VideoAnalysisResult, 
  TargetPlatform, 
  ScriptTone,
  ProductionScriptScene
} from '@/types/videoScript';
import { getStoredGeminiApiKey } from '@/lib/apiConfig';
import { saveEpisode, getEpisodes, getPodcasts } from '@/lib/storage';
import { Episode } from '@/lib/types';
import { 
  Video, 
  Link as LinkIcon, 
  Upload, 
  FileText, 
  Sparkles, 
  Languages, 
  Copy, 
  Check, 
  Download, 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Tv, 
  Sliders, 
  Film, 
  Mic, 
  Clapperboard, 
  Eye, 
  Volume2, 
  Maximize2, 
  Share2, 
  ListOrdered, 
  Layers,
  Wand2
} from 'lucide-react';

export default function VideoToScriptStudio() {
  const router = useRouter();

  // Input States
  const [inputMode, setInputMode] = useState<'url' | 'upload' | 'text'>('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [directTranscriptText, setDirectTranscriptText] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');

  // Generation Settings
  const [targetPlatform, setTargetPlatform] = useState<TargetPlatform>('youtube');
  const [scriptTone, setScriptTone] = useState<ScriptTone>('viral_energetic');
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(3);

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'script' | 'transcript' | 'teleprompter' | 'video'>('script');

  // Teleprompter States
  const [isPrompterRunning, setIsPrompterRunning] = useState(false);
  const [prompterSpeed, setPrompterSpeed] = useState(3);
  const [prompterFontSize, setPrompterFontSize] = useState(38);
  const prompterContainerRef = useRef<HTMLDivElement>(null);
  const prompterIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Copy Feedback
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [exportedEpisodeId, setExportedEpisodeId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (videoPreviewUrl && videoPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Teleprompter Auto-scroll
  useEffect(() => {
    if (isPrompterRunning && activeTab === 'teleprompter') {
      prompterIntervalRef.current = setInterval(() => {
        if (prompterContainerRef.current) {
          prompterContainerRef.current.scrollTop += prompterSpeed * 0.7;
        }
      }, 30);
    } else {
      if (prompterIntervalRef.current) {
        clearInterval(prompterIntervalRef.current);
      }
    }

    return () => {
      if (prompterIntervalRef.current) {
        clearInterval(prompterIntervalRef.current);
      }
    };
  }, [isPrompterRunning, prompterSpeed, activeTab]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    const url = URL.createObjectURL(file);
    setVideoPreviewUrl(url);
    if (!videoTitleInput) {
      setVideoTitleInput(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Run Analysis & Generation
  const handleAnalyzeVideo = async () => {
    setErrorMsg(null);

    if (inputMode === 'url' && !videoUrl.trim()) {
      setErrorMsg('נא להזין קישור תקין לסרטון');
      return;
    }
    if (inputMode === 'upload' && !uploadedFile) {
      setErrorMsg('נא לבחור או להעלות קובץ וידאו/אודיו');
      return;
    }
    if (inputMode === 'text' && !directTranscriptText.trim()) {
      setErrorMsg('נא להזין או להדביק את תמליל הסרטון');
      return;
    }

    setIsProcessing(true);
    setCurrentStep(1);

    const s2 = setTimeout(() => setCurrentStep(2), 1200);
    const s3 = setTimeout(() => setCurrentStep(3), 2800);
    const s4 = setTimeout(() => setCurrentStep(4), 4500);

    try {
      let audioBase64: string | undefined;
      let mimeType: string | undefined;

      if (inputMode === 'upload' && uploadedFile) {
        audioBase64 = await fileToBase64(uploadedFile);
        mimeType = uploadedFile.type;
      }

      const apiKey = getStoredGeminiApiKey();

      const res = await fetch('/api/ai/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: inputMode === 'url' ? videoUrl.trim() : undefined,
          audioBase64,
          mimeType,
          directTranscript: inputMode === 'text' ? directTranscriptText.trim() : undefined,
          videoTitle: videoTitleInput.trim() || undefined,
          targetPlatform,
          tone: scriptTone,
          targetDurationMinutes,
          apiKey
        })
      });

      clearTimeout(s2);
      clearTimeout(s3);
      clearTimeout(s4);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'שגיאה בעיבוד הסרטון והפקת התסריט');
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error('לא התקבלו תוצאות מהשרת');
      }

      setResult(json.data);
      setActiveTab('script');
    } catch (err: any) {
      console.error('Video analysis failed:', err);
      setErrorMsg(err.message || 'שגיאה בניתוח הווידאו');
    } finally {
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  // Copy helper
  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Download Full Script as Markdown
  const handleDownloadMarkdown = () => {
    if (!result) return;
    const s = result.script;
    const t = result.transcript;

    const md = `
# ${s.titleHebrew}
**פלטפורמה מיועדת:** ${s.targetPlatform} | **משך זמן משוער:** ${s.targetDurationMinutes} דקות
**תאריך הפקה:** ${new Date().toLocaleDateString('he-IL')}

---

## 🎯 כותרות חלופיות
${s.alternateTitles.map((alt, i) => `${i + 1}. ${alt}`).join('\n')}

---

## 💥 הוק פתיחה (0-5 שניות)
> "${s.hook}"

---

## 🎬 תסריט סצנות מלא להפקה
${s.scenes.map(scene => `
### סצנה ${scene.sceneNumber}: ${scene.sceneTitle} (~${scene.estimatedSeconds} שניות)
- **🎥 ויז'ואל והוראות בימוי:** ${scene.visualDirection}
- **🗣️ טקסט לדיבור:** "${scene.spokenHebrewText}"
${scene.audioSoundEffect ? `- **🔊 סאונד:** ${scene.audioSoundEffect}` : ''}
${scene.directorTip ? `- **💡 דגש למגיש:** ${scene.directorTip}` : ''}
`).join('\n')}

---

## 🚀 הנעה לפעולה (Call to Action)
"${s.callToAction}"

---

## 📝 תיאור מומלץ לפרסום
${s.descriptionHebrew}

**תגיות:**
${s.hashtags.join(' ')}

---

## 🗣️ מה שנאמר בסרטון המקורי באנגלית
${t.englishText}

## 🇮🇱 תרגום מלא של המקור לעברית
${t.hebrewText}
`.trim();

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hebrew-script-${s.titleHebrew.slice(0, 20).replace(/\s+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Direct to Studio Episode
  const handleExportToStudioEpisode = () => {
    if (!result) return;

    const podcasts = getPodcasts();
    const targetPodcast = podcasts[0]?.id || 'pod-tech';
    const allEps = getEpisodes();

    const newEpisodeId = `ep_script_${Date.now()}`;
    const newEpisode: Episode = {
      id: newEpisodeId,
      podcastId: targetPodcast,
      title: result.script.titleHebrew,
      episodeNumber: allEps.length + 1,
      season: 1,
      status: 'ready',
      mediaType: 'video',
      description: result.script.descriptionHebrew || result.transcript.summary,
      targetDurationMinutes: result.script.targetDurationMinutes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      topics: result.script.scenes.map((scene, idx) => ({
        id: `top_${Date.now()}_${idx}`,
        title: `סצנה ${scene.sceneNumber}: ${scene.sceneTitle}`,
        estimatedMinutes: Math.max(1, Math.round(scene.estimatedSeconds / 60)),
        notes: `ויז'ואל: ${scene.visualDirection}`,
        talkingPoints: [
          `🗣️ דיבור: ${scene.spokenHebrewText}`,
          scene.directorTip ? `💡 דגש למגיש: ${scene.directorTip}` : ''
        ].filter(Boolean),
        questions: [],
        resources: result.metadata.sourceUrl ? [{ id: `res_${idx}`, title: 'סרטון מקור באנגלית', url: result.metadata.sourceUrl }] : [],
        completed: false,
        order: idx + 1
      })),
      movieFacts: result.transcript.keyPoints.map((kp, idx) => ({
        id: `fact_${Date.now()}_${idx}`,
        movieTitle: result.script.titleHebrew,
        category: 'behind_the_scenes',
        fact: kp,
        source: result.metadata.author || 'Video Analysis',
        sourceUrl: result.metadata.sourceUrl,
        seriesOrder: idx + 1
      }))
    };

    saveEpisode(newEpisode);
    setExportedEpisodeId(newEpisodeId);

    setTimeout(() => {
      router.push(`/episodes/${newEpisodeId}`);
    }, 1200);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-950/90 via-[#131722] to-[#0e111a] border border-purple-900/40 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:text-white font-semibold transition-colors mb-2"
            >
              <ArrowRight className="w-4 h-4" />
              <span>חזרה לדשבורד האולפן</span>
            </Link>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Video-to-Script Studio</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              מנתח סרטונים ותסריטאי הפקה בעברית
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              הזינו קישור לסרטון באנגלית (יוטיוב, רשת) או העלו קובץ — המערכת תנתח את הווידאו, תספק עותק מדויק של מה שנאמר (באנגלית ובתרגום לעברית), ותייצר תסריט הפקה מלא בעברית עם בימוי וטלפרומפטר!
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/subtitles"
              className="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-all flex items-center gap-2"
            >
              <Tv className="w-4 h-4 text-purple-400" />
              <span>אולפן כתוביות</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Input Section Card */}
      <div className="rounded-3xl bg-[#121620] border border-slate-800/90 p-6 sm:p-8 shadow-xl space-y-6">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-indigo-400" />
          <span>1. בחירת מקור הווידאו לניתוח</span>
        </h3>

        {/* Input Mode Selector */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setInputMode('url')}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all ${
              inputMode === 'url'
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-4 h-4" />
            <span>קישור לסרטון (YouTube / URL)</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('upload')}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all ${
              inputMode === 'upload'
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>העלאת קובץ וידאו / אודיו</span>
          </button>

          <button
            type="button"
            onClick={() => setInputMode('text')}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs sm:text-sm font-bold transition-all ${
              inputMode === 'text'
                ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>הדבקת תמליל ישיר</span>
          </button>
        </div>

        {/* Dynamic Input Body */}
        {inputMode === 'url' && (
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300">
              הדבק כאן קישור לסרטון באנגלית (יוטיוב רגיל, Shorts, או קישור ישיר):
            </label>
            <div className="relative">
              <LinkIcon className="w-4 h-4 text-purple-400 absolute right-4 top-1/2 -translate-y-1/2" />
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... או https://youtu.be/..."
                className="w-full pr-11 pl-4 py-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              💡 טיפ: המערכת תזהה את הווידאו, תחלץ את מה שנאמר, תתרגם לעברית ותפיק תסריט מצלמה מותאם.
            </p>
          </div>
        )}

        {inputMode === 'upload' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,.mp4,.mov,.webm,.m4v,.mp3,.wav,.m4a"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-purple-500 bg-slate-950/60 hover:bg-purple-950/10 rounded-3xl p-8 text-center cursor-pointer transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center mx-auto border border-purple-500/30">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {uploadedFile ? uploadedFile.name : 'לחץ או גרור קובץ וידאו / אודיו לכאן'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  תומך ב-MP4, MOV, WebM, MP3, WAV, M4A (אנגלית)
                </p>
              </div>
            </div>

            {videoPreviewUrl && (
              <div className="max-w-md mx-auto rounded-2xl overflow-hidden border border-slate-800 bg-black">
                <video src={videoPreviewUrl} controls className="w-full aspect-video object-cover" />
              </div>
            )}
          </div>
        )}

        {inputMode === 'text' && (
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300">
              הדבק כאן את מה שנאמר בסרטון באנגלית (Transcript):
            </label>
            <textarea
              rows={6}
              value={directTranscriptText}
              onChange={(e) => setDirectTranscriptText(e.target.value)}
              placeholder="Paste the English transcript here..."
              className="w-full p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono leading-relaxed"
            />
          </div>
        )}

        {/* Customization Options Bar */}
        <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5 text-purple-400" />
              <span>פלטפורמת היעד לתסריט:</span>
            </label>
            <select
              value={targetPlatform}
              onChange={(e) => setTargetPlatform(e.target.value as TargetPlatform)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
            >
              <option value="youtube">🎬 סרטון YouTube מלא (3-6 דקות)</option>
              <option value="tiktok_reels">📱 סרטון קצר ל-Shorts / Reels / TikTok (עד 60 שניות)</option>
              <option value="podcast">🎙️ פרק עומק לפודקאסט (8-12 דקות)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>סגנון וטון התסריט:</span>
            </label>
            <select
              value={scriptTone}
              onChange={(e) => setScriptTone(e.target.value as ScriptTone)}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none"
            >
              <option value="viral_energetic">⚡ ויראלי, קצבי וסוחף</option>
              <option value="deep_storytelling">🎭 סטוריטלינג, עומק ומתח</option>
              <option value="educational">💡 הסברתי, חינוכי ומקצועי</option>
              <option value="entertaining">🍿 הומוריסטי, שנון וקליל</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>אורך יעד (דקות):</span>
            </label>
            <input
              type="number"
              min={1}
              max={25}
              value={targetDurationMinutes}
              onChange={(e) => setTargetDurationMinutes(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Submit Analyze Button */}
        <button
          type="button"
          onClick={handleAnalyzeVideo}
          disabled={isProcessing}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black text-sm sm:text-base shadow-2xl shadow-purple-900/40 flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin text-white" />
              <span>
                {currentStep === 1 ? 'קורא את הסרטון והמטא-דאטה...' :
                 currentStep === 2 ? 'מתמלל את מה שנאמר באנגלית...' :
                 currentStep === 3 ? 'מתרגם במדויק לעברית...' :
                 'בונה תסריט הפקה מלא בעברית עם הוראות בימוי...'}
              </span>
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5 text-amber-300" />
              <span>⚡ נתח סרטון, תרגם לעברית וייצר תסריט הפקה מלא</span>
            </>
          )}
        </button>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Results View Container */}
      {result && (
        <div className="rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in">
          {/* Result Header & Tab Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase border border-emerald-500/30">
                  ניתוח הושלם בהצלחה ✓
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {result.metadata.title}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                {result.script.titleHebrew}
              </h2>
            </div>

            {/* Quick Export Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportToStudioEpisode}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-all active:scale-95"
                title="ייצא תסריט זה ישירות כפרק באולפן ההקלטות"
              >
                <Mic className="w-4 h-4 text-emerald-200" />
                <span>{exportedEpisodeId ? 'פותח באולפן...' : '🎙️ ייצא כפרק לאולפן'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="הורד תסריט כקובץ Markdown"
              >
                <Download className="w-3.5 h-3.5 text-purple-400" />
                <span>הורד Markdown</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopy(result.script.scenes.map(s => `${s.sceneTitle}:\n${s.spokenHebrewText}`).join('\n\n'), 'all_script')}
                className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                {copiedSection === 'all_script' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                <span>{copiedSection === 'all_script' ? 'הועתק!' : 'העתק תסריט'}</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 w-fit flex-wrap">
            <button
              onClick={() => setActiveTab('script')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'script'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clapperboard className="w-4 h-4" />
              <span>🎬 תסריט הפקה בעברית ({result.script.scenes.length} סצנות)</span>
            </button>

            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'transcript'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Languages className="w-4 h-4" />
              <span>🗣️ עותק מה שנאמר (אנגלית מול עברית)</span>
            </button>

            <button
              onClick={() => setActiveTab('teleprompter')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'teleprompter'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-4 h-4" />
              <span>📺 טלפרומפטר אינטראקטיבי</span>
            </button>

            {(result.metadata.videoId || videoPreviewUrl) && (
              <button
                onClick={() => setActiveTab('video')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'video'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>🎥 הסרטון המקורי</span>
              </button>
            )}
          </div>

          {/* TAB 1: PRODUCTION SCRIPT */}
          {activeTab === 'script' && (
            <div className="space-y-6">
              {/* Hook Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/40 shadow-xl space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase">
                    💥 הוק פתיחה ממגנט (0-5 שניות)
                  </span>
                  <button
                    onClick={() => handleCopy(result.script.hook, 'hook')}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs flex items-center gap-1"
                  >
                    {copiedSection === 'hook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-sm sm:text-base font-black text-amber-200 leading-relaxed">
                  "{result.script.hook}"
                </p>
                <p className="text-[11px] text-slate-400">
                  💡 פתחו עם המשפט הזה בדיוק על השניה הראשונה כדי לעצור את הגלילה (Stop the scroll).
                </p>
              </div>

              {/* Alternate Titles */}
              {result.script.alternateTitles.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                  <span className="text-xs font-bold text-slate-300">🎯 כותרות קליקבייטיות מומלצות בעברית:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {result.script.alternateTitles.map((alt, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCopy(alt, `title_${idx}`)}
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white cursor-pointer transition-all flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{alt}</span>
                        {copiedSection === `title_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3 h-3 text-slate-500 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scenes Breakdown */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Film className="w-4 h-4 text-purple-400" />
                  <span>מהלך הסרטון לפי סצנות ובימוי:</span>
                </h4>

                <div className="space-y-3">
                  {result.script.scenes.map((scene) => (
                    <div
                      key={scene.sceneNumber}
                      className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800/90 hover:border-slate-700 transition-all space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-purple-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                            {scene.sceneNumber}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-white">
                            {scene.sceneTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-800/40">
                            ⏱️ ~{scene.estimatedSeconds} שניות
                          </span>
                          <button
                            onClick={() => handleCopy(scene.spokenHebrewText, `scene_${scene.sceneNumber}`)}
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
                          >
                            {copiedSection === `scene_${scene.sceneNumber}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {/* Visual Direction Box */}
                      <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-indigo-200 text-xs flex items-start gap-2">
                        <Eye className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-indigo-300 ml-1">הוראות ויז'ואל:</strong>
                          <span>{scene.visualDirection}</span>
                        </div>
                      </div>

                      {/* Spoken Hebrew Script */}
                      <div className="p-3.5 rounded-xl bg-black/60 border border-white/5 space-y-1">
                        <div className="text-[11px] font-mono text-slate-500">🗣️ מה לומר (טקסט לקריינות):</div>
                        <p className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                          {scene.spokenHebrewText}
                        </p>
                      </div>

                      {/* Audio & Host Tips */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                        {scene.audioSoundEffect && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                            <span>סאונד: {scene.audioSoundEffect}</span>
                          </span>
                        )}
                        {scene.directorTip && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                            <span>דגש: {scene.directorTip}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Call to Action Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/30 space-y-2">
                <span className="text-[10px] font-black uppercase text-emerald-400">
                  🚀 הנעה לפעולה (Call to Action)
                </span>
                <p className="text-sm font-bold text-emerald-200 leading-relaxed">
                  "{result.script.callToAction}"
                </p>
              </div>

              {/* Description & Hashtags */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">📝 תיאור מוכן להעתקה ליוטיוב / רשתות:</span>
                  <button
                    onClick={() => handleCopy(`${result.script.descriptionHebrew}\n\n${result.script.hashtags.join(' ')}`, 'desc')}
                    className="p-1.5 rounded-lg bg-slate-900 text-xs text-slate-300 hover:text-white flex items-center gap-1"
                  >
                    {copiedSection === 'desc' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>העתק תיאור</span>
                  </button>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {result.script.descriptionHebrew}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {result.script.hashtags.map((h, i) => (
                    <span key={i} className="text-xs text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-800/40">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSCRIPT (ENGLISH VS HEBREW) */}
          {activeTab === 'transcript' && (
            <div className="space-y-6">
              {/* Key Takeaways */}
              {result.transcript.keyPoints.length > 0 && (
                <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                  <span className="text-xs font-bold text-purple-200">💡 נקודות מפתח מרכזיות שנאמרו בסרטון:</span>
                  <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                    {result.transcript.keyPoints.map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Side by Side Transcript */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* English Original */}
                <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🇺🇸</span> מה שנאמר במקור (English)
                    </span>
                    <button
                      onClick={() => handleCopy(result.transcript.englishText, 'en_trans')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedSection === 'en_trans' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>העתק</span>
                    </button>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans max-h-[500px] overflow-y-auto whitespace-pre-wrap ltr text-left">
                    {result.transcript.englishText}
                  </div>
                </div>

                {/* Hebrew Translation */}
                <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>🇮🇱</span> תרגום מדויק לעברית
                    </span>
                    <button
                      onClick={() => handleCopy(result.transcript.hebrewText, 'he_trans')}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {copiedSection === 'he_trans' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>העתק</span>
                    </button>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans max-h-[500px] overflow-y-auto whitespace-pre-wrap rtl text-right">
                    {result.transcript.hebrewText}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INTERACTIVE TELEPROMPTER */}
          {activeTab === 'teleprompter' && (
            <div className="space-y-4">
              {/* Teleprompter Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPrompterRunning(!isPrompterRunning)}
                    className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                      isPrompterRunning
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isPrompterRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{isPrompterRunning ? 'השהה גלילה' : 'הפעל גלילה'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (prompterContainerRef.current) prompterContainerRef.current.scrollTop = 0;
                    }}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800"
                    title="חזרה להתחלה"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Speed Slider */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">מהירות: {prompterSpeed}</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={prompterSpeed}
                    onChange={(e) => setPrompterSpeed(Number(e.target.value))}
                    className="w-24 accent-purple-500"
                  />
                </div>

                {/* Font Size Slider */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">גודל גופן: {prompterFontSize}px</span>
                  <input
                    type="range"
                    min={24}
                    max={56}
                    value={prompterFontSize}
                    onChange={(e) => setPrompterFontSize(Number(e.target.value))}
                    className="w-24 accent-purple-500"
                  />
                </div>
              </div>

              {/* Teleprompter Screen */}
              <div
                ref={prompterContainerRef}
                className="w-full h-[550px] overflow-y-auto rounded-3xl bg-black border-2 border-slate-800 p-8 sm:p-12 text-center select-none relative scroll-smooth shadow-inner"
              >
                {/* Center eye line marker */}
                <div className="sticky top-1/2 -translate-y-1/2 pointer-events-none w-full border-t border-b border-purple-500/20 py-8 bg-purple-500/5 -mx-8 sm:-mx-12 px-8 sm:px-12 flex justify-between items-center text-[10px] text-purple-400/50 font-mono">
                  <span>▶ קו קריאה</span>
                  <span>קו קריאה ◀</span>
                </div>

                <div className="space-y-12 max-w-2xl mx-auto py-24 text-white font-black leading-relaxed" style={{ fontSize: `${prompterFontSize}px` }}>
                  {/* Hook */}
                  <div className="text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                    {result.script.hook}
                  </div>

                  {/* Scenes */}
                  {result.script.scenes.map((scene) => (
                    <div key={scene.sceneNumber} className="space-y-4">
                      <div className="text-sm font-mono text-purple-400 tracking-widest uppercase">
                        [סצנה {scene.sceneNumber}: {scene.sceneTitle}]
                      </div>
                      <div>
                        {scene.spokenHebrewText}
                      </div>
                    </div>
                  ))}

                  {/* CTA */}
                  <div className="text-emerald-400">
                    {result.script.callToAction}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ORIGINAL VIDEO PLAYER */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              <div className="max-w-3xl mx-auto aspect-video rounded-3xl overflow-hidden border border-slate-800 bg-black shadow-2xl">
                {result.metadata.videoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${result.metadata.videoId}?autoplay=0`}
                    className="w-full h-full"
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : videoPreviewUrl ? (
                  <video src={videoPreviewUrl} controls className="w-full h-full object-contain" />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                    אין פריוויו זמין לווידאו
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
