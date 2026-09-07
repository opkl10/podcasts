'use client';

import React, { useState, useId } from 'react';
import { TopicItem, MovieFactCard, FactCategory } from '@/lib/types';
import { 
  X, 
  Upload, 
  FileText, 
  FileJson, 
  Check, 
  Copy, 
  Sparkles, 
  Film, 
  ListChecks, 
  HelpCircle, 
  Layers, 
  BookOpen,
  CheckCircle2
} from 'lucide-react';

interface ImportResearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (topics: TopicItem[], movieFacts: MovieFactCard[], mode: 'append' | 'replace') => void;
  currentTopicCount: number;
  currentFactCount: number;
}

export default function ImportResearchModal({
  isOpen,
  onClose,
  onApply,
  currentTopicCount,
  currentFactCount
}: ImportResearchModalProps) {
  const [activeTab, setActiveTab] = useState<'import' | 'templates'>('import');
  const [rawInput, setRawInput] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [copiedTemplate, setCopiedTemplate] = useState<string | null>(null);
  const fileInputId = useId();

  if (!isOpen) return null;

  // Smart Parser for JSON & Markdown / Free Text
  const parseContent = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return { topics: [], movieFacts: [], format: 'none' as const };
    }

    // 1. Attempt JSON parse
    try {
      const parsed = JSON.parse(trimmed);
      let parsedTopics: TopicItem[] = [];
      let parsedFacts: MovieFactCard[] = [];

      // Handle array of topics or array of facts
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && ('fact' in parsed[0] || 'category' in parsed[0])) {
          parsedFacts = parsed as MovieFactCard[];
        } else {
          parsedTopics = parsed as TopicItem[];
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Handle object with topics and/or movieFacts
        const rawTopics = parsed.topics || parsed['נושאים'] || parsed['ראשי פרקים'] || [];
        const rawFacts = parsed.movieFacts || parsed.facts || parsed['עובדות'] || parsed['עובדות קולנוע'] || [];

        if (Array.isArray(rawTopics)) {
          parsedTopics = rawTopics;
        }
        if (Array.isArray(rawFacts)) {
          parsedFacts = rawFacts;
        }
      }

      // Normalize topics
      const normalizedTopics: TopicItem[] = parsedTopics.map((t: any, idx: number) => ({
        id: t.id || `top-imp-${Date.now()}-${idx}`,
        title: t.title || t.name || t['כותרת'] || `נושא ${idx + 1}`,
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
        order: idx + 1
      }));

      // Normalize movie facts
      const normalizedFacts: MovieFactCard[] = parsedFacts.map((f: any, idx: number) => {
        const validCategories: FactCategory[] = ['plot', 'cast', 'production_crew', 'reviews', 'behind_the_scenes'];
        const cat = validCategories.includes(f.category) ? f.category : 'behind_the_scenes';
        return {
          id: f.id || `fact-imp-${Date.now()}-${idx}`,
          movieTitle: f.movieTitle || f.movie || f['סרט'] || 'כללי',
          category: cat,
          fact: f.fact || f['עובדה'] || f.text || '',
          source: f.source || f['מקור'] || 'IMDb',
          ratingScore: f.ratingScore || f.rating || f['ציון'] || undefined,
          year: f.year || f['שנה'] || undefined,
          tags: Array.isArray(f.tags) ? f.tags : [],
          isPinnedToHUD: false
        };
      }).filter(f => f.fact.trim().length > 0);

      if (normalizedTopics.length > 0 || normalizedFacts.length > 0) {
        return { topics: normalizedTopics, movieFacts: normalizedFacts, format: 'json' as const };
      }
    } catch {
      // Not JSON, continue to Markdown parser
    }

    // 2. Markdown / Structured Text Parser
    const lines = trimmed.split('\n');
    const topics: TopicItem[] = [];
    const movieFacts: MovieFactCard[] = [];

    let currentTopic: Partial<TopicItem> | null = null;
    let isInFactsSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check if entering a movie facts section
      if (/^(?:#+\s*)?(?:💡|🎬|📽️)?\s*(?:עובדות|עובדות קולנוע|כרטיסיות עובדות|movie\s*facts|facts)/i.test(line)) {
        if (currentTopic && currentTopic.title) {
          topics.push(finalizeTopic(currentTopic, topics.length + 1));
          currentTopic = null;
        }
        isInFactsSection = true;
        continue;
      }

      // Check for Movie Fact bullet line anywhere (e.g. starts with 💡 or "עובדה:")
      if (line.startsWith('💡') || line.startsWith('🎬') || /^עובדה\s*[:\-]/i.test(line) || isInFactsSection) {
        const cleanLine = line.replace(/^[💡🎬•*\-]\s*/, '').replace(/^עובדה\s*[:\-]\s*/i, '').trim();
        if (cleanLine) {
          // Check for bracket metadata: e.g. [מאחורי הקלעים | IMDb | 8.5]: הטקסט
          const metaMatch = cleanLine.match(/^\[([^\]]+)\]\s*[:\-]?\s*(.*)$/);
          let factText = cleanLine;
          let category: FactCategory = 'behind_the_scenes';
          let source: MovieFactCard['source'] = 'IMDb';
          let score: string | undefined = undefined;

          if (metaMatch) {
            const metaParts = metaMatch[1].split('|').map(s => s.trim());
            factText = metaMatch[2].trim() || factText;

            metaParts.forEach(p => {
              if (/מאחורי הקלעים|behind/i.test(p)) category = 'behind_the_scenes';
              else if (/שחקנים|cast/i.test(p)) category = 'cast';
              else if (/עלילה|plot/i.test(p)) category = 'plot';
              else if (/הפקה|בימוי|production/i.test(p)) category = 'production_crew';
              else if (/ביקורת|reviews/i.test(p)) category = 'reviews';

              if (/imdb/i.test(p)) source = 'IMDb';
              else if (/wiki|ויקי/i.test(p)) source = 'Wikipedia';
              else if (/rotten|עגבניות/i.test(p)) source = 'Rotten Tomatoes';
              else if (/letterboxd/i.test(p)) source = 'Letterboxd';
              else if (/metacritic/i.test(p)) source = 'Metacritic';

              if (/^\d+(?:\.\d+)?(?:%|\/10)?$/.test(p)) score = p;
            });
          }

          movieFacts.push({
            id: `fact-imp-${Date.now()}-${movieFacts.length}`,
            movieTitle: 'כללי',
            category,
            fact: factText,
            source,
            ratingScore: score,
            isPinnedToHUD: false
          });
          continue;
        }
      }

      // Check for a new Topic Header (e.g. # Topic, ### 1. Topic, or "נושא 1: Topic")
      const isHeader = /^#{1,4}\s+/.test(line) || /^(?:נושא|פרק|חלק)\s*\d*\s*[:\-]/i.test(line) || /^\d+\.\s+[^?\-•*]/.test(line);

      if (isHeader) {
        if (currentTopic && currentTopic.title) {
          topics.push(finalizeTopic(currentTopic, topics.length + 1));
        }
        isInFactsSection = false;

        // Clean header text
        let title = line
          .replace(/^#{1,4}\s+/, '')
          .replace(/^(?:נושא|פרק|חלק)\s*\d*\s*[:\-]\s*/i, '')
          .replace(/^\d+\.\s+/, '')
          .trim();

        // Extract duration in parentheses e.g. (10 דק') or (15 min)
        let minutes = 10;
        const durMatch = title.match(/\((\d+)\s*(?:דק['ות]|min|minutes)?\)/i);
        if (durMatch) {
          minutes = parseInt(durMatch[1], 10);
          title = title.replace(durMatch[0], '').trim();
        }

        currentTopic = {
          title,
          estimatedMinutes: minutes,
          notes: '',
          talkingPoints: [],
          questions: [],
          resources: []
        };
        continue;
      }

      // If we don't have an active topic yet, create a default one
      if (!currentTopic && !isInFactsSection) {
        currentTopic = {
          title: 'ראשי פרקים ונקודות',
          estimatedMinutes: 10,
          notes: '',
          talkingPoints: [],
          questions: [],
          resources: []
        };
      }

      if (!currentTopic) continue;

      // Check for Notes line
      if (/^(?:הערות?|דגשים?|notes?)\s*[:\-]/i.test(line)) {
        const noteText = line.replace(/^(?:הערות?|דגשים?|notes?)\s*[:\-]\s*/i, '').trim();
        currentTopic.notes = currentTopic.notes ? `${currentTopic.notes}\n${noteText}` : noteText;
        continue;
      }

      // Check for Questions
      const isQuestion = line.startsWith('?') || 
                         line.startsWith('❓') || 
                         /^[-*•]\s*❓/i.test(line) || 
                         /^[-*•]\s*\?/i.test(line) || 
                         /^(?:שאלה|שאלות)\s*[:\-]/i.test(line) ||
                         (line.endsWith('?') && !line.startsWith('#'));

      if (isQuestion) {
        const qText = line
          .replace(/^[-*•]\s*/, '')
          .replace(/^❓\s*/, '')
          .replace(/^\?\s*/, '')
          .replace(/^(?:שאלה|שאלות)\s*[:\-]\s*/i, '')
          .trim();
        if (qText) {
          currentTopic.questions = [...(currentTopic.questions || []), qText];
        }
        continue;
      }

      // Check for Links / Resources [Title](URL)
      const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        currentTopic.resources = [
          ...(currentTopic.resources || []),
          {
            id: `res-imp-${Date.now()}-${(currentTopic.resources || []).length}`,
            title: linkMatch[1],
            url: linkMatch[2]
          }
        ];
        continue;
      }

      // Check for Talking Points (bullet points)
      if (/^[-*•]\s+/.test(line)) {
        const pointText = line.replace(/^[-*•]\s+/, '').trim();
        if (pointText) {
          currentTopic.talkingPoints = [...(currentTopic.talkingPoints || []), pointText];
        }
        continue;
      }

      // Fallback: regular line into notes or talking point
      if (line.length > 0) {
        currentTopic.talkingPoints = [...(currentTopic.talkingPoints || []), line];
      }
    }

    if (currentTopic && currentTopic.title) {
      topics.push(finalizeTopic(currentTopic, topics.length + 1));
    }

    return { topics, movieFacts, format: 'markdown' as const };
  };

  const finalizeTopic = (t: Partial<TopicItem>, order: number): TopicItem => {
    return {
      id: `top-imp-${Date.now()}-${order}`,
      title: t.title || `נושא ${order}`,
      estimatedMinutes: t.estimatedMinutes || 10,
      notes: t.notes || '',
      talkingPoints: t.talkingPoints && t.talkingPoints.length > 0 ? t.talkingPoints : ['נקודה ראשונה לדיון'],
      questions: t.questions || [],
      resources: t.resources || [],
      completed: false,
      order
    };
  };

  const parsedResult = parseContent(rawInput);
  const totalDetectedTopics = parsedResult.topics.length;
  const totalDetectedFacts = parsedResult.movieFacts.length;
  const totalTalkingPoints = parsedResult.topics.reduce((acc, t) => acc + t.talkingPoints.length, 0);
  const totalQuestions = parsedResult.topics.reduce((acc, t) => acc + t.questions.length, 0);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawInput(content);
      }
    };
    reader.readAsText(file);
  };

  // Submit Handler
  const handleApply = () => {
    if (totalDetectedTopics === 0 && totalDetectedFacts === 0) {
      alert('לא זוהו נושאים או עובדות בטקסט שהוזן. אנא בדקו את הפורמט או טענו דוגמה.');
      return;
    }
    onApply(parsedResult.topics, parsedResult.movieFacts, importMode);
    onClose();
  };

  // Sample Templates
  const sampleJson = `{
  "topics": [
    {
      "title": "פתיח: סקירת הסרט והבאזז סביבו",
      "estimatedMinutes": 8,
      "notes": "להתחיל עם השאלה מה עשה את הסרט לתופעה",
      "talkingPoints": [
        "ההצלחה הקופתית המפתיעה בעולם",
        "השיח ברשתות החברתיות ובטיקטוק",
        "ההשוואה לסרטים קודמים של אותו יוצר"
      ],
      "questions": [
        "מה לדעתך הפך את הסרט לשיחת היום?",
        "האם ההייפ היה מוצדק בעיניך?"
      ],
      "resources": [
        { "title": "כתבה ב-Variety", "url": "https://variety.com" }
      ]
    },
    {
      "title": "ניתוח עלילה ומבנה תסריטאי",
      "estimatedMinutes": 15,
      "notes": "להתמקד בטוויסט של המערכה השלישית",
      "talkingPoints": [
        "הקצב במערכה הראשונה לעומת הסיום",
        "התפתחות הדמות הראשית והקונפליקט",
        "רמזים מקדימים שנשתלו לאורך הסרט"
      ],
      "questions": [
        "האם חזית את הטוויסט מראש?",
        "איך התסריט מייצר הזדהות עם הדמות המרכזית?"
      ]
    }
  ],
  "movieFacts": [
    {
      "movieTitle": "אופנהיימר",
      "category": "behind_the_scenes",
      "fact": "הבמאי בחר לשחזר את פיצוץ מבחן טריניטי ללא שימוש ב-CGI ממוחשב כלל",
      "source": "IMDb",
      "ratingScore": "8.9"
    },
    {
      "movieTitle": "אופנהיימר",
      "category": "reviews",
      "fact": "הסרט הפך לביוגרפיה הרווחית ביותר בהיסטוריה של הקולנוע עם מעל 950 מיליון דולר",
      "source": "Box Office Mojo",
      "ratingScore": "93%"
    }
  ]
}`;

  const sampleMarkdown = `# 1. פתיח: סקירת הסרט והבאזז (8 דק')
הערות: לפתוח בשאלה חמה על התגובות ברשת
- ההצלחה הקופתית המפתיעה בישראל ובעולם
- השיח הסוער בטיקטוק ובאינסטגרם
- ההשוואה לסרטים קודמים של הבמאי
? מה לדעתך הפך את הסרט לתופעה תרבותית כזו?
? האם ההייפ היה מוצדק בעיניך?
[כתבה ב-Variety](https://variety.com)

# 2. ניתוח עלילה ומבנה תסריטאי (15 דק')
הערות: להקפיד על אזהרת ספוילרים
- הקצב של המערכה הראשונה לעומת הסיום הדרמטי
- התפתחות הדמות הראשית והמוטיבציה שלה
- רמזים מקדימים שנשתלו לאורך הסרט
? האם הטוויסט בסיום עבד עליך רגשית?
? מה היה הרגע הכי מפתיע לדעתך?

💡 עובדות קולנוע:
- [מאחורי הקלעים | IMDb | 8.9]: הבמאי שחזר את פיצוץ מבחן טריניטי ללא שימוש ב-CGI כלל
- [ביקורות | Rotten Tomatoes | 93%]: הסרט זכה לציון של 93% מהמבקרים ברחבי העולם
- [שחקנים | Wikipedia]: השחקן הראשי השיל ממשקלו כ-12 קילוגרם במיוחד עבור התפקיד`;

  const chatGptPrompt = `אנא הכן לי מערך ראשי פרקים ועובדות לפרק פודקאסט על הסרט [שם הסרט/הנושא].
החזר לי את התוצאה במדויק בפורמט Markdown הבא כדי שאוכל להדביק ישירות בתוכנה:

# 1. [שם הנושא הראשון] ([משך משוער בדקות] דק')
הערות: [הערות רקע או דגש להנחיה]
- [נקודה עיקרית ראשונה לדיון]
- [נקודה עיקרית שנייה לדיון]
- [נקודה נוספת]
? [שאלה חדה ומעניינת לאורח או לדיון]
? [שאלה נוספת]

# 2. [שם הנושא השני] ([משך] דק')
- [נקודה לדיון]
? [שאלה]

💡 עובדות קולנוע:
- [מאחורי הקלעים | IMDb]: [עובדה מרתקת על הפקת הסרט]
- [ביקורות | Rotten Tomatoes | ציון]: [נתון ביקורתי או קופתי מעניין]
- [שחקנים | Wikipedia]: [עובדה על הליהוק או השחקנים]`;

  const handleCopyTemplate = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTemplate(label);
      setTimeout(() => setCopiedTemplate(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-3xl rounded-3xl bg-[#121620] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                ייבוא ראשי פרקים ועובדות קולנוע
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  JSON / Markdown / Text
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                העלו קובץ או הדביקו טקסט חופשי – המערכת תסדר אוטומטית נושאים, זמנים, שאלות ועובדות
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>הזנת תוכן וייבוא</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'templates'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>מדריך פורמטים ופרומפט ל-AI</span>
          </button>
        </div>

        {/* Tab 1: Import Content */}
        {activeTab === 'import' ? (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <label 
                  htmlFor={fileInputId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 cursor-pointer transition-all active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>בחירת קובץ (.json, .md, .txt)</span>
                </label>
                <input
                  id={fileInputId}
                  type="file"
                  accept=".json,.md,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <button
                  onClick={() => setRawInput(sampleMarkdown)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] transition-colors"
                >
                  טען דוגמת Markdown
                </button>
                <button
                  onClick={() => setRawInput(sampleJson)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[11px] transition-colors"
                >
                  טען דוגמת JSON
                </button>
              </div>

              {rawInput && (
                <button
                  onClick={() => setRawInput('')}
                  className="text-rose-400 hover:text-rose-300 text-[11px] underline"
                >
                  נקה תיבה
                </button>
              )}
            </div>

            {/* Input Textarea */}
            <div className="relative">
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="הדביקו כאן קובץ JSON מלא, או רשימת Markdown עם # כותרות, - נקודות דיון, ? שאלות ו-💡 עובדות קולנוע..."
                rows={10}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed"
              />
            </div>

            {/* Live Parsing Stats */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  זיהוי תוכן בזמן אמת:
                </span>
                <span className="text-[11px] text-slate-400">
                  פורמט שזוהה: <strong className="text-white uppercase">{parsedResult.format}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <ListChecks className="w-3 h-3 text-indigo-400" />
                    נושאים
                  </span>
                  <span className={`text-xs font-bold ${totalDetectedTopics > 0 ? 'text-indigo-400' : 'text-slate-500'}`}>
                    {totalDetectedTopics}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    נקודות דיון
                  </span>
                  <span className={`text-xs font-bold ${totalTalkingPoints > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {totalTalkingPoints}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-sky-400" />
                    שאלות
                  </span>
                  <span className={`text-xs font-bold ${totalQuestions > 0 ? 'text-sky-400' : 'text-slate-500'}`}>
                    {totalQuestions}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Film className="w-3 h-3 text-amber-400" />
                    עובדות קולנוע
                  </span>
                  <span className={`text-xs font-bold ${totalDetectedFacts > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                    {totalDetectedFacts}
                  </span>
                </div>
              </div>
            </div>

            {/* Merge Mode Options */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <div className="text-xs">
                <span className="font-bold text-slate-300 block">אופן שילוב המידע בפרק:</span>
                <span className="text-[11px] text-slate-500">
                  (כרגע יש בפרק {currentTopicCount} נושאים ו-{currentFactCount} עובדות)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('append')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    importMode === 'append'
                      ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  הוסף לקיים (Append)
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    importMode === 'replace'
                      ? 'bg-rose-600/20 text-rose-300 border-rose-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  החלף את הקיים (Replace)
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Tab 2: Format Guide & AI Prompts */
          <div className="space-y-5 flex-1 overflow-y-auto pr-1 text-xs">
            {/* ChatGPT Prompt Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-purple-950/30 border border-indigo-800/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>פרומפט מוכן להעתקה ל-ChatGPT או Claude</span>
                </div>
                <button
                  onClick={() => handleCopyTemplate(chatGptPrompt, 'prompt')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors"
                >
                  {copiedTemplate === 'prompt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTemplate === 'prompt' ? 'הועתק!' : 'העתקת הפרומפט'}</span>
                </button>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                שלחו את הפרומפט הזה ל-ChatGPT יחד עם שם הסרט או נושא הפרק. התשובה שתקבלו תהיה מותאמת בול להדבקה מיידית בתיבה!
              </p>
              <pre className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap">
                {chatGptPrompt}
              </pre>
            </div>

            {/* Explanation of the 2 formats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Markdown Format Box */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    1. פורמט Markdown / טקסט חופשי
                  </span>
                  <button
                    onClick={() => handleCopyTemplate(sampleMarkdown, 'md')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                  >
                    {copiedTemplate === 'md' ? 'הועתק!' : 'העתקת דוגמה'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  הכי קל ונוח לכתיבה ידנית או העתקה מ-Word/Notion.
                  סימון <code className="text-indigo-300">#</code> מציין נושא, 
                  <code className="text-indigo-300">-</code> נקודת דיון, 
                  <code className="text-indigo-300">?</code> שאלת מפתח, 
                  ו-<code className="text-indigo-300">💡 עובדה:</code> עובדת קולנוע.
                </p>
              </div>

              {/* JSON Format Box */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <FileJson className="w-4 h-4 text-emerald-400" />
                    2. פורמט JSON (מבנה מדויק 100%)
                  </span>
                  <button
                    onClick={() => handleCopyTemplate(sampleJson, 'json')}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 underline"
                  >
                    {copiedTemplate === 'json' ? 'הועתק!' : 'העתקת דוגמה'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  מושלם לשמירה מלאה, גיבוי או מעבר בין פרקים. שומר את כל הפרטים: זמנים, שאלות, נקודות, מקורות ודירוגים.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            ביטול
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={totalDetectedTopics === 0 && totalDetectedFacts === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:pointer-events-none text-xs font-bold text-white shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {importMode === 'append' ? 'הוסף לפרק' : 'החלף והחל על הפרק'} ({totalDetectedTopics} נושאים, {totalDetectedFacts} עובדות)
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
