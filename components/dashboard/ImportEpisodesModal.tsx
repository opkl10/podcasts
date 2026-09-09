'use client';

import React, { useState, useRef } from 'react';
import { Episode, PodcastShow, TopicItem, MovieFactCard } from '@/lib/types';
import { 
  X, 
  Upload, 
  FileText, 
  FileJson, 
  Check, 
  Copy, 
  Sparkles, 
  Layers, 
  PlusCircle, 
  Radio, 
  Clock, 
  AlertCircle, 
  Download, 
  CheckCircle2,
  Trash2,
  ListChecks
} from 'lucide-react';

interface ImportEpisodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  podcasts: PodcastShow[];
  currentPodcastId?: string;
  onEpisodesImported: (newEpisodes: Episode[]) => void;
}

export default function ImportEpisodesModal({
  isOpen,
  onClose,
  podcasts,
  currentPodcastId,
  onEpisodesImported
}: ImportEpisodesModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'text' | 'templates'>('upload');
  const [rawInput, setRawInput] = useState('');
  const [targetPodcastId, setTargetPodcastId] = useState<string>(
    currentPodcastId && currentPodcastId !== 'all' ? currentPodcastId : (podcasts[0]?.id || 'pod-tech')
  );
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Smart Parser for Episodes from JSON / Markdown / Text
  const parseEpisodesFromContent = (content: string): Partial<Episode>[] => {
    const trimmed = content.trim();
    if (!trimmed) return [];

    // 1. Try JSON Parse
    try {
      const parsed = JSON.parse(trimmed);
      let rawList: any[] = [];

      if (Array.isArray(parsed)) {
        rawList = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (Array.isArray(parsed.episodes)) rawList = parsed.episodes;
        else if (Array.isArray(parsed['פרקים'])) rawList = parsed['פרקים'];
        else if (Array.isArray(parsed.data)) rawList = parsed.data;
        else if (Array.isArray(parsed.items)) rawList = parsed.items;
        else if (parsed.title || parsed['כותרת'] || parsed.name) {
          // Single episode object
          rawList = [parsed];
        }
      }

      if (rawList.length > 0) {
        return rawList.map((item: any, idx: number) => {
          const rawTopics = item.topics || item['נושאים'] || item['ראשי פרקים'] || [];
          const rawFacts = item.movieFacts || item.facts || item['עובדות'] || [];

          const normalizedTopics: TopicItem[] = Array.isArray(rawTopics)
            ? rawTopics.map((t: any, tIdx: number) => {
                if (typeof t === 'string') {
                  return {
                    id: `top-imp-${Date.now()}-${tIdx}`,
                    title: t,
                    estimatedMinutes: 10,
                    notes: '',
                    talkingPoints: [],
                    questions: [],
                    resources: [],
                    completed: false,
                    order: tIdx + 1
                  };
                }
                return {
                  id: t.id || `top-imp-${Date.now()}-${tIdx}`,
                  title: t.title || t.name || t['כותרת'] || `נושא ${tIdx + 1}`,
                  estimatedMinutes: Number(t.estimatedMinutes || t.minutes || t['זמן'] || 10),
                  notes: t.notes || t['הערות'] || '',
                  talkingPoints: Array.isArray(t.talkingPoints || t.points || t['נקודות'])
                    ? (t.talkingPoints || t.points || t['נקודות']).map(String)
                    : [],
                  questions: Array.isArray(t.questions || t['שאלות'])
                    ? (t.questions || t['שאלות']).map(String)
                    : [],
                  resources: Array.isArray(t.resources || t['מקורות'])
                    ? (t.resources || t['מקורות']).map((r: any, rIdx: number) => ({
                        id: r.id || `res-imp-${Date.now()}-${rIdx}`,
                        title: r.title || r['כותרת'] || 'קישור',
                        url: r.url || r['קישור'] || '#'
                      }))
                    : [],
                  completed: false,
                  order: tIdx + 1
                };
              })
            : [];

          const normalizedFacts: MovieFactCard[] = Array.isArray(rawFacts)
            ? rawFacts.map((f: any, fIdx: number) => {
                if (typeof f === 'string') {
                  return {
                    id: `fact-imp-${Date.now()}-${fIdx}`,
                    movieTitle: item.title || 'פודקאסט',
                    category: 'behind_the_scenes',
                    fact: f,
                    source: 'Other'
                  };
                }
                return {
                  id: f.id || `fact-imp-${Date.now()}-${fIdx}`,
                  movieTitle: f.movieTitle || f['סרט'] || item.title || 'פודקאסט',
                  category: f.category || 'behind_the_scenes',
                  fact: f.fact || f['עובדה'] || String(f),
                  source: f.source || f['מקור'] || 'IMDb',
                  sourceUrl: f.sourceUrl || f['קישור'],
                  ratingScore: f.ratingScore || f['ציון'],
                  year: f.year || f['שנה'],
                  tags: Array.isArray(f.tags) ? f.tags : []
                };
              })
            : [];

          return {
            id: item.id || `ep_imp_${Date.now()}_${idx}`,
            podcastId: item.podcastId || targetPodcastId,
            title: item.title || item.name || item['כותרת'] || `פרק חדש ${idx + 1}`,
            description: item.description || item['תיאור'] || 'פרק שיובא מקובץ חיצוני',
            season: Number(item.season || item['עונה'] || 1),
            episodeNumber: Number(item.episodeNumber || item.number || item['מספר פרק'] || item['פרק'] || (idx + 1)),
            status: item.status || 'research',
            mediaType: item.mediaType || 'video',
            targetDurationMinutes: Number(item.targetDurationMinutes || item.duration || item['דקות'] || 30),
            hostName: item.hostName || item['מנחה'] || item['מגיש'],
            guest: item.guest ? {
              name: item.guest.name || item.guest['שם'] || '',
              role: item.guest.role || item.guest['תפקיד'] || '',
              bio: item.guest.bio || item.guest['ביו'] || ''
            } : undefined,
            topics: normalizedTopics,
            movieFacts: normalizedFacts,
            subtitles: Array.isArray(item.subtitles) ? item.subtitles : [],
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
        });
      }
    } catch (e) {
      // Not JSON, continue to text/markdown parser
    }

    // 2. Try Markdown / Free Text Parse
    const lines = trimmed.split(/\r?\n/);
    const resultEpisodes: Partial<Episode>[] = [];
    let curEp: Partial<Episode> | null = null;
    let inTopics = false;
    let inFacts = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Detect episode header: e.g. "# פרק 1: שם הפרק", "## פרק 2 - כותרת", "פרק 3: כותרת"
      const isEpisodeHeader = /^#{1,3}\s+(?:פרק|episode)\s*\d*/i.test(line) || 
                             /^(?:פרק|episode)\s*\d+[:\-]/i.test(line) ||
                             (/^#{1,2}\s+[^#]+$/i.test(line) && !line.includes('נושא') && !line.includes('עובד'));

      if (isEpisodeHeader) {
        if (curEp && curEp.title) {
          resultEpisodes.push(curEp);
        }

        let cleanTitle = line
          .replace(/^#{1,3}\s+/, '')
          .replace(/^(?:פרק|episode)\s*\d*[:\-]?\s*/i, '')
          .trim();

        // Extract duration e.g. (45 דק')
        let dur = 30;
        const durMatch = cleanTitle.match(/\((\d+)\s*(?:דק['ות]|min)?\)/i);
        if (durMatch) {
          dur = parseInt(durMatch[1], 10);
          cleanTitle = cleanTitle.replace(durMatch[0], '').trim();
        }

        curEp = {
          id: `ep_imp_${Date.now()}_${resultEpisodes.length}`,
          podcastId: targetPodcastId,
          title: cleanTitle || `פרק ${resultEpisodes.length + 1}`,
          description: '',
          season: 1,
          episodeNumber: resultEpisodes.length + 1,
          status: 'research',
          mediaType: 'video',
          targetDurationMinutes: dur,
          topics: [],
          movieFacts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        inTopics = false;
        inFacts = false;
        continue;
      }

      if (!curEp) {
        // Start a default episode if text begins directly
        curEp = {
          id: `ep_imp_${Date.now()}_0`,
          podcastId: targetPodcastId,
          title: line.replace(/^#{1,3}\s+/, '').trim() || 'פרק חדש',
          description: '',
          season: 1,
          episodeNumber: 1,
          status: 'research',
          mediaType: 'video',
          targetDurationMinutes: 30,
          topics: [],
          movieFacts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        continue;
      }

      // Check section switches
      if (/^(?:נושאים|ראשי פרקים|topics?|chapters?)\s*[:\-]?/i.test(line) || /^#{2,4}\s+(?:נושאים|ראשי פרקים)/i.test(line)) {
        inTopics = true;
        inFacts = false;
        continue;
      }
      if (/^(?:עובדות|facts?|טריוויה)\s*[:\-]?/i.test(line) || /^#{2,4}\s+(?:עובדות|facts?)/i.test(line)) {
        inFacts = true;
        inTopics = false;
        continue;
      }
      if (/^(?:תיאור|description)\s*[:\-]\s*(.*)$/i.test(line)) {
        curEp.description = line.replace(/^(?:תיאור|description)\s*[:\-]\s*/i, '').trim();
        continue;
      }
      if (/^(?:אורח|guest)\s*[:\-]\s*(.*)$/i.test(line)) {
        curEp.guest = { name: line.replace(/^(?:אורח|guest)\s*[:\-]\s*/i, '').trim() };
        continue;
      }

      // Bullet points
      const isBullet = /^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line);
      const cleanBulletText = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim();

      if (inFacts && isBullet) {
        curEp.movieFacts = curEp.movieFacts || [];
        curEp.movieFacts.push({
          id: `fact-${Date.now()}-${curEp.movieFacts.length}`,
          movieTitle: curEp.title || 'פודקאסט',
          category: 'behind_the_scenes',
          fact: cleanBulletText,
          source: 'Other'
        });
      } else if ((inTopics && isBullet) || (!inFacts && isBullet)) {
        curEp.topics = curEp.topics || [];
        curEp.topics.push({
          id: `top-${Date.now()}-${curEp.topics.length}`,
          title: cleanBulletText,
          estimatedMinutes: 10,
          notes: '',
          talkingPoints: [],
          questions: [],
          resources: [],
          completed: false,
          order: curEp.topics.length + 1
        });
      } else if (!curEp.description) {
        curEp.description = line;
      } else {
        curEp.description += ' ' + line;
      }
    }

    if (curEp && curEp.title) {
      resultEpisodes.push(curEp);
    }

    return resultEpisodes;
  };

  const detectedEpisodes = parseEpisodesFromContent(rawInput);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawInput(content);
        setActiveTab('text');
      }
    };
    reader.readAsText(file);
  };

  // Submit Handler
  const handleApplyImport = () => {
    if (detectedEpisodes.length === 0) {
      alert('לא זוהו פרקים בקובץ או בטקסט שהוזן. אנא ודאו את הפורמט או טענו דוגמה.');
      return;
    }

    setIsProcessing(true);
    try {
      const fullEpisodes: Episode[] = detectedEpisodes.map((ep, idx) => ({
        id: ep.id || `ep_${Date.now()}_${idx}`,
        podcastId: ep.podcastId || targetPodcastId,
        title: ep.title || `פרק ${idx + 1}`,
        description: ep.description || 'פרק שנוצר מייבוא חיצוני',
        season: ep.season || 1,
        episodeNumber: ep.episodeNumber || (idx + 1),
        status: ep.status || 'research',
        mediaType: ep.mediaType || 'video',
        targetDurationMinutes: ep.targetDurationMinutes || 30,
        hostName: ep.hostName,
        guest: ep.guest,
        topics: ep.topics || [],
        movieFacts: ep.movieFacts || [],
        subtitles: ep.subtitles || [],
        createdAt: ep.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      onEpisodesImported(fullEpisodes);
      onClose();
    } catch (err: any) {
      alert('שגיאה בייבוא הפרקים: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Sample Templates
  const sampleJson = `[
  {
    "title": "עתיד הקולנוע בעידן הבינה המלאכותית",
    "description": "דיון מעמיק על האופן שבו מודלי שפה, יצירת וידאו ו-CGI ישנו את תעשיית הסרטים.",
    "season": 1,
    "episodeNumber": 1,
    "targetDurationMinutes": 45,
    "guest": {
      "name": "ד״ר אלון מזרחי",
      "role": "חוקר AI וקולנוע"
    },
    "topics": [
      {
        "title": "פתיח ומצב הקולנוע הנוכחי",
        "estimatedMinutes": 10,
        "talkingPoints": [
          "השביתות בהוליווד והדרישות סביב AI",
          "טכנולוגיות וידאו גנרטיביות חדשות"
        ]
      },
      {
        "title": "עבודה בפועל על הסט",
        "estimatedMinutes": 20,
        "talkingPoints": [
          "החלפת ניצבים ורקעים",
          "תסריטאות ועריכה מואצת"
        ]
      }
    ],
    "movieFacts": [
      {
        "movieTitle": "הוליווד 2026",
        "fact": "מעל 60% מאולפני האפקטים משלבים כעת מודלי AI גנרטיביים בתהליך הפוסט-פרודקשן.",
        "source": "Variety"
      }
    ]
  },
  {
    "title": "יצירת פסקול ואודיוגרמות לפודקאסטים",
    "description": "איך לבנות סאונד מנצח וגלי קול מונפשים שמושכים צופים בסושיאל.",
    "season": 1,
    "episodeNumber": 2,
    "targetDurationMinutes": 35,
    "topics": [
      {
        "title": "עיצוב סאונד ומיקס",
        "estimatedMinutes": 15,
        "talkingPoints": ["עבודה עם מיקרופונים דינמיים", "דחיסה וניקוי רעשים"]
      }
    ]
  }
]`;

  const sampleMarkdown = `# פרק 1: סודות הפודקאסט המנצח (40 דק')
תיאור: מדריך מעשי ליצירת תוכן מרתק, בניית ראשי פרקים נכונים ושימוש בעובדות מעניינות.
אורח: דניאל כהן

## ראשי פרקים
- פתיח: מה גורם למאזין להישאר מעבר ל-30 השניות הראשונות?
- חמשת השלבים למחקר פרק לפני הקלטה
- שאלות זהב לאורחים שמחלצות תשובות מפתיעות
- סיכום וטיפ השבוע למגישים

## עובדות
- פודקאסטים עם פתיח של פחות מ-60 שניות שומרים על 35% יותר מאזינים.
- הוספת גלי קול מונפשים (Audiogram) מכפילה את שיעור המעורבות ברילס ובטיקטוק.

# פרק 2: אולפן סאונד ביתי בתקציב נגיש (30 דק')
תיאור: כל מה שצריך לדעת על אקוסטיקה, מיקרופונים וכרטיסי קול.

## ראשי פרקים
- בחירת המיקרופון הנכון: דינמי לעומת קונדנסר
- טיפול אקוסטי פשוט בחדר בלי לשבור קירות
- הגדרות תוכנה ומיקס בסיסי`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-[#0f121a] border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-right" dir="rtl">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>ייבוא פרקים מקובץ חיצוני</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  JSON / Markdown / Text
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                טעינה מרוכזת של פרקים, ראשי פרקים ועובדות ישירות לדשבורד הפודקאסטים
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

        {/* Podcast Selection & Mode Bar */}
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              שייך לפודקאסט:
            </span>
            <select
              value={targetPodcastId}
              onChange={(e) => setTargetPodcastId(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-1.5 font-semibold focus:outline-none focus:border-indigo-500"
            >
              {podcasts.map(pod => (
                <option key={pod.id} value={pod.id}>
                  {pod.title}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'upload' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              העלאת קובץ
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'text' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              עריכת טקסט ({detectedEpisodes.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                activeTab === 'templates' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              פורמטים ודוגמאות
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: FILE UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.txt,.md,.csv,application/json,text/plain,text/markdown"
                onChange={handleFileUpload}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-3xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-900/30 hover:bg-slate-900/60 transition-all text-center group"
              >
                <div className="p-4 rounded-2xl bg-indigo-600/10 group-hover:bg-indigo-600/20 text-indigo-400 transition-all">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    לחצו לבחירת קובץ מהמחשב או גררו לכאן
                  </h4>
                  <p className="text-xs text-slate-400">
                    תמיכה מלאה בקובצי JSON, Markdown (.md), טקסט חופשי (.txt) ו-CSV
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300">
                  .json / .md / .txt / .csv
                </span>
              </div>

              {rawInput && detectedEpisodes.length > 0 && (
                <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>זוהו {detectedEpisodes.length} פרקים תקינים מוכנים לייבוא!</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('text')}
                    className="underline text-emerald-400 hover:text-white"
                  >
                    צפייה בפרטים ועריכה
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEXT & PREVIEW */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    הדביקו או ערכו את תוכן הפרקים (JSON או Markdown):
                  </label>
                  {rawInput && (
                    <button
                      onClick={() => setRawInput('')}
                      className="text-[11px] text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      נקה תוכן
                    </button>
                  )}
                </div>
                <textarea
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={`הדביקו כאן מערך JSON של פרקים, או טקסט עם כותרות:
# פרק 1: שם הפרק
- נושא 1
- נושא 2`}
                  rows={8}
                  dir="auto"
                  className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Detected Episodes Preview Cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    תצוגה מקדימה של הפרקים שיסודרו ({detectedEpisodes.length}):
                  </span>
                </div>

                {detectedEpisodes.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {detectedEpisodes.map((ep, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">
                            {ep.title || `פרק ${idx + 1}`}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300 font-mono">
                            עונה {ep.season || 1} • פרק {ep.episodeNumber || (idx + 1)}
                          </span>
                        </div>
                        {ep.description && (
                          <p className="text-slate-400 line-clamp-1 text-[11px]">
                            {ep.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            {ep.targetDurationMinutes || 30} דקות
                          </span>
                          <span className="flex items-center gap-1">
                            <ListChecks className="w-3 h-3 text-indigo-400" />
                            {ep.topics?.length || 0} נושאים וראשי פרקים
                          </span>
                          {ep.movieFacts && ep.movieFacts.length > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              ⭐ {ep.movieFacts.length} עובדות קולנוע
                            </span>
                          )}
                          {ep.guest?.name && (
                            <span className="text-purple-300 font-semibold">
                              אורח: {ep.guest.name}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-950/50 border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                    טרם זוהו פרקים. הדביקו תוכן או טענו קובץ כדי לצפות בפרקים שיסודרו.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TEMPLATES & EXAMPLES */}
          {activeTab === 'templates' && (
            <div className="space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                תוכלו לשמור את המידע החיצוני שלכם בכל אחד משני הפורמטים המומלצים הבאים ולהעלות אותו ישירות. המערכת תסדר אותם בצורה מושלמת עם כל הנושאים והעובדות:
              </p>

              {/* Template 1: JSON */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <FileJson className="w-4 h-4 text-indigo-400" />
                    <span>פורמט 1: קובץ JSON (מומלץ ביותר לארגון מלא)</span>
                  </div>
                  <button
                    onClick={() => {
                      setRawInput(sampleJson);
                      setActiveTab('text');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white font-semibold transition-all text-[11px]"
                  >
                    טען דוגמה זו לעריכה
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
                  {sampleJson}
                </pre>
              </div>

              {/* Template 2: Markdown */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>פורמט 2: טקסט חופשי או Markdown (פשוט ומהיר)</span>
                  </div>
                  <button
                    onClick={() => {
                      setRawInput(sampleMarkdown);
                      setActiveTab('text');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600 text-cyan-200 hover:text-white font-semibold transition-all text-[11px]"
                  >
                    טען דוגמה זו לעריכה
                  </button>
                </div>
                <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-40">
                  {sampleMarkdown}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-all"
          >
            ביטול
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={detectedEpisodes.length === 0 || isProcessing}
              onClick={handleApplyImport}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <span>מייבא פרקים...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>ייבא {detectedEpisodes.length} פרקים עכשיו</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
