'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Episode, EpisodeFormat, PodcastShow, TopicItem } from '@/lib/types';
import { getEpisodes, getPodcasts, saveEpisode } from '@/lib/storage';
import { 
  ArrowRight, 
  Sparkles, 
  User, 
  Clock, 
  FileText, 
  Check, 
  Layers,
  Mic,
  BookOpen,
  Radio,
  Video,
  Users
} from 'lucide-react';

const TEMPLATES = [
  {
    id: 'duo',
    label: '👥 פודקאסט צמד מנחים (Duo Co-Hosts)',
    description: 'מבנה דינמי ומאוזן לצמד: סמול-טוק ועדכונים, פינג-פונג נושא מרכזי, פינת המלצות כפולה וסגירה משותפת.',
    targetDuration: 35,
    format: 'duo' as EpisodeFormat,
    topics: [
      {
        id: 'top-d1',
        title: 'פתיח, סמול-טוק ועדכונים הדדיים (Catch-up)',
        estimatedMinutes: 5,
        notes: 'פתיחה חמה, אנרגיה משותפת, מה חדש אצל כל אחד מהמנחים מאז הפרק הקודם.',
        talkingPoints: ['חימום וכימיה בין המנחים', 'הצגת הנושא המרכזי של הפרק', 'נקודת פתיחה או חוויה שקרתה השבוע'],
        questions: ['מה הדבר הכי מעניין שקרה לך השבוע?', 'איך נתקלת בנושא הזה לראשונה?'],
        resources: [],
        completed: false,
        order: 1
      },
      {
        id: 'top-d2',
        title: 'הנושא המרכזי: דיבייט, ניתוח ופינג-פונג דעות',
        estimatedMinutes: 20,
        notes: 'דיון עומק דו-צדדי: הצגת שתי זוויות שונות, אתגר הדדי, סיפורים מהשטח.',
        talkingPoints: ['זווית ראייה של מנחה 1', 'זווית ראייה של מנחה 2 (קונטרה / השלמה)', 'ההשלכות והמסקנות המשותפות'],
        questions: ['האם אתה מסכים עם הטענה הזו?', 'איפה לדעתך הגישה הזו נכשלת?', 'איך אתה היית פותר את זה?'],
        resources: [],
        completed: false,
        order: 2
      },
      {
        id: 'top-d3',
        title: 'פינת ההמלצות הכפולה (Dual Weekly Picks)',
        estimatedMinutes: 5,
        notes: 'כל מנחה משתף כלי, ספר, סרט, אפליקציה או תובנה מעשית.',
        talkingPoints: ['ההמלצה השבועית של מנחה 1', 'ההמלצה השבועית של מנחה 2'],
        questions: ['למה דווקא ההמלצה הזו שווה את הזמן של המאזינים?'],
        resources: [],
        completed: false,
        order: 3
      },
      {
        id: 'top-d4',
        title: 'סיכום משותף, מסקנות וקריאה לפעולה',
        estimatedMinutes: 5,
        notes: 'סגירה קצבית עם פאנץ׳, הנעה לפעולה ופרטים על הפרק הבא.',
        talkingPoints: ['מסקנה אחת שכל מאזין חייב לקחת', 'שאלה למאזינים לתגובות בסושיאל'],
        questions: ['מה השורה התחתונה שלנו מהפרק?'],
        resources: [],
        completed: false,
        order: 4
      }
    ]
  },
  {
    id: 'interview',
    label: '🎙️ ראיון אורח קלאסי',
    description: 'פתיח והצגת האורח, סיפור אישי, דיון מעמיק בנושא המרכזי, שאלות מהירות וסיכום.',
    targetDuration: 45,
    format: 'interview' as EpisodeFormat,
    topics: [
      {
        id: 'top-1',
        title: 'פתיח והיכרות עם האורח',
        estimatedMinutes: 5,
        notes: 'להציג את הרקע והחזון של האורח.',
        talkingPoints: ['הצגת הנושא המרכזי', 'הצגת האורח ופועלו'],
        questions: ['איך הגעת לתחום הזה?', 'מה הוביל לפריצת הדרך שלך?'],
        resources: [],
        completed: false,
        order: 1
      },
      {
        id: 'top-2',
        title: 'הנושא המרכזי: אתגרים, פתרונות ותובנות',
        estimatedMinutes: 25,
        notes: 'צלילת עומק לפרקטיקה וטיפים מהשטח.',
        talkingPoints: ['הבעיה הגדולה ביותר בתחום', 'איך מתמודדים איתה בפועל', 'מקרי בוחן מהחיים'],
        questions: ['מה הטעות שרוב האנשים עושים?', 'מה הסוד שרק אנשי מקצוע יודעים?'],
        resources: [],
        completed: false,
        order: 2
      },
      {
        id: 'top-3',
        title: 'סיכום, שאלות בזק וטיפ הזהב',
        estimatedMinutes: 15,
        notes: 'סגירה עוצמתית עם מסר לקחת הביתה.',
        talkingPoints: ['שאלות בזק מהירות', 'איפה המאזינים יכולים לעקוב'],
        questions: ['איזה טיפ היית נותן לעצמך בתחילת הדרך?'],
        resources: [],
        completed: false,
        order: 3
      }
    ]
  },
  {
    id: 'solo',
    label: '👤 פרק סולו / מונולוג לימודי',
    description: 'מבנה ממוקד של מגיש יחיד: הוק, הצגת הבעיה, 3 עקרונות פעולה וקריאה לפעולה.',
    targetDuration: 20,
    format: 'solo' as EpisodeFormat,
    topics: [
      {
        id: 'top-s1',
        title: 'הוק (Hook) והצגת הבעיה',
        estimatedMinutes: 3,
        notes: 'לתפוס את תשומת הלב ב-30 השניות הראשונות.',
        talkingPoints: ['למה הנושא הזה קריטי עכשיו', 'ההבטחה של הפרק'],
        questions: [],
        resources: [],
        completed: false,
        order: 1
      },
      {
        id: 'top-s2',
        title: '3 שלבים / עקרונות ליישום מיידי',
        estimatedMinutes: 12,
        notes: 'תוכן מעשי ומובנה צעד-אחר-צעד.',
        talkingPoints: ['שלב 1: הבנת היסודות', 'שלב 2: תוכנית פעולה', 'שלב 3: מדידת תוצאות'],
        questions: [],
        resources: [],
        completed: false,
        order: 2
      },
      {
        id: 'top-s3',
        title: 'סיכום ומשימה למאזינים',
        estimatedMinutes: 5,
        notes: 'קריאה לפעולה והנעת המאזינים.',
        talkingPoints: ['סיכום נקודות מפתח', 'האתגר השבועי למאזינים'],
        questions: [],
        resources: [],
        completed: false,
        order: 3
      }
    ]
  }
];

export default function NewEpisodePage() {
  const router = useRouter();
  const [podcasts, setPodcasts] = useState<PodcastShow[]>([]);
  const [selectedPodcastId, setSelectedPodcastId] = useState<string>('');
  const [mediaType, setMediaType] = useState<'video' | 'audio_only'>('video');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('duo');
  const [episodeFormat, setEpisodeFormat] = useState<EpisodeFormat>('duo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hostName, setHostName] = useState('');
  const [hostRole, setHostRole] = useState('');
  const [coHostName, setCoHostName] = useState('');
  const [coHostRole, setCoHostRole] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestRole, setGuestRole] = useState('');
  const [season, setSeason] = useState(1);
  const [episodeNumber, setEpisodeNumber] = useState(1);
  const [targetDuration, setTargetDuration] = useState(35);

  useEffect(() => {
    const existingPods = getPodcasts();
    setPodcasts(existingPods);
    if (existingPods.length > 0) {
      setSelectedPodcastId(existingPods[0].id);
      if (existingPods[0].hostName) {
        setHostName(existingPods[0].hostName);
      }
      if (existingPods[0].coHostName) {
        setCoHostName(existingPods[0].coHostName);
      }
    }

    const existingEps = getEpisodes();
    if (existingEps.length > 0) {
      setEpisodeNumber(existingEps.length + 1);
    }
  }, []);

  // Sync podcast hosts when podcast selection changes
  const handleSelectPodcast = (podId: string) => {
    setSelectedPodcastId(podId);
    const chosen = podcasts.find(p => p.id === podId);
    if (chosen) {
      if (chosen.hostName) setHostName(chosen.hostName);
      if (chosen.coHostName) {
        setCoHostName(chosen.coHostName);
        setEpisodeFormat('duo');
        setSelectedTemplate('duo');
      }
    }
  };

  const handleSelectFormat = (fmt: EpisodeFormat) => {
    setEpisodeFormat(fmt);
    const matchingTemplate = TEMPLATES.find(t => t.format === fmt);
    if (matchingTemplate) {
      setSelectedTemplate(matchingTemplate.id);
      setTargetDuration(matchingTemplate.targetDuration);
    }
  };

  const handleSelectTemplate = (tmplId: string) => {
    setSelectedTemplate(tmplId);
    const tmpl = TEMPLATES.find(t => t.id === tmplId);
    if (tmpl) {
      setTargetDuration(tmpl.targetDuration);
      if (tmpl.format) {
        setEpisodeFormat(tmpl.format);
      }
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const template = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0];

    const newEpisode: Episode = {
      id: `ep-${Date.now()}`,
      podcastId: selectedPodcastId || (podcasts[0]?.id ?? 'pod-tech'),
      title: title.trim(),
      season: Number(season),
      episodeNumber: Number(episodeNumber),
      status: 'research',
      mediaType,
      episodeFormat,
      description: description.trim(),
      hostName: hostName.trim() || undefined,
      host: hostName.trim() ? { name: hostName.trim(), role: hostRole.trim() || undefined } : undefined,
      coHost: (episodeFormat === 'duo' && coHostName.trim()) 
        ? { name: coHostName.trim(), role: coHostRole.trim() || undefined } 
        : undefined,
      targetDurationMinutes: Number(targetDuration) || template.targetDuration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      guest: (episodeFormat !== 'solo' && guestName.trim())
        ? {
            name: guestName.trim(),
            role: guestRole.trim(),
            links: []
          }
        : undefined,
      topics: template.topics.map(t => ({
        ...t,
        id: `top-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      }))
    };

    saveEpisode(newEpisode);
    router.push(`/episodes/${newEpisode.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowRight className="w-4 h-4" />
        <span>חזרה לדשבורד</span>
      </Link>

      <div className="rounded-3xl bg-[#121620] border border-slate-800/90 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Title */}
        <div className="mb-8 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            יצירת פרק חדש
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            הגדרת פרק חדש לפודקאסט
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            בחרו את תוכנית הפודקאסט, פורמט ההגשה (צמד מנחים / ראיון / סולו), והזינו את נושאי הפרק.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-6 relative z-10">
          {/* Select Podcast Show */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              שיוך לתוכנית פודקאסט:
            </label>
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400" />
              <select
                value={selectedPodcastId}
                onChange={(e) => handleSelectPodcast(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {podcasts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.category || 'כללי'}) {p.coHostName ? '• 👥 צמד' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Episode Format Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              פורמט ההגשה של הפרק:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectFormat('duo')}
                className={`p-3 rounded-2xl border text-right transition-all ${
                  episodeFormat === 'duo'
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users className={`w-4 h-4 ${episodeFormat === 'duo' ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-bold ${episodeFormat === 'duo' ? 'text-white' : 'text-slate-300'}`}>
                    👥 צמד מנחים (Duo)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  שני מגישים קבועים (Co-Hosts) בדיאלוג שוויוני ופינג-פונג
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFormat('interview')}
                className={`p-3 rounded-2xl border text-right transition-all ${
                  episodeFormat === 'interview'
                    ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Mic className={`w-4 h-4 ${episodeFormat === 'interview' ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-bold ${episodeFormat === 'interview' ? 'text-white' : 'text-slate-300'}`}>
                    🎙️ מנחה ואורח/ת
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  מגיש יחיד המארח מומחה באולפן או בחיבור מרחוק
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleSelectFormat('solo')}
                className={`p-3 rounded-2xl border text-right transition-all ${
                  episodeFormat === 'solo'
                    ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/40'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <User className={`w-4 h-4 ${episodeFormat === 'solo' ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className={`text-xs font-bold ${episodeFormat === 'solo' ? 'text-white' : 'text-slate-300'}`}>
                    👤 סולו יחיד
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  מונולוג ממוקד, מדריך מעשי או שיעור קצר של מגיש אחד
                </p>
              </button>
            </div>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              תבנית המבנה לפרק:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TEMPLATES.map(tmpl => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedTemplate === tmpl.id
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/40'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white truncate">{tmpl.label}</span>
                    <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">
                      {tmpl.targetDuration} דק'
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">{tmpl.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Format: Video Podcast vs Audio Only Radio */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              פורמט ההקלטה:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setMediaType('video')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                  mediaType === 'video'
                    ? 'bg-indigo-950/50 border-indigo-500 shadow-lg ring-1 ring-indigo-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${mediaType === 'video' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">🎬 וידאו פודקאסט</h4>
                  <p className="text-[10px] text-slate-400">צילום 4K/1080p, מסך מפוצל, מצלמת אייפון, אוברלייז</p>
                </div>
              </div>

              <div
                onClick={() => setMediaType('audio_only')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                  mediaType === 'audio_only'
                    ? 'bg-amber-950/40 border-amber-500 shadow-lg ring-1 ring-amber-500/30'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${mediaType === 'audio_only' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'}`}>
                  <Mic className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">🎙️ אודיו בלבד (Radio)</h4>
                  <p className="text-[10px] text-slate-400">הקלטת קול נקייה ב-320kbps ללא מצלמה</p>
                </div>
              </div>
            </div>
          </div>

          {/* Title and numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                כותרת הפרק <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="למשל: סודות האוטומציה שחוסכים 20 שעות בשבוע..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                משך מתוכנן (דקות)
              </label>
              <input
                type="number"
                min={5}
                max={240}
                value={targetDuration}
                onChange={(e) => setTargetDuration(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">עונה</label>
              <input
                type="number"
                min={1}
                value={season}
                onChange={(e) => setSeason(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">מספר פרק</label>
              <input
                type="number"
                min={1}
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(Number(e.target.value))}
                className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-sm text-white text-center focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">תיאור קצר של הפרק</label>
            <textarea
              rows={3}
              placeholder="על מה נדבר בפרק זה, למי הוא מיועד ומה המסר המרכזי..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Host & Co-Host / Guest Identity Card */}
          {episodeFormat === 'duo' ? (
            /* Duo Co-Hosts Format Section */
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-emerald-500/30 space-y-4 shadow-lg shadow-emerald-950/20">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">צוות המנחים הקבוע (צמד מנחים - Duo)</h4>
                    <p className="text-[10px] text-slate-400">הזינו את פרטי שני המנחים שיובילו את השידור יחד</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">
                  👥 צמד שותפים
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Host 1 */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-cyan-400" />
                    מנחה 1 (מגיש/ת ראשי/ת)
                  </label>
                  <input
                    type="text"
                    placeholder="שם מנחה 1 (למשל: עומר אוקון)"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="תפקיד / תיאור (למשל: יזם וטכנולוג)"
                    value={hostRole}
                    onChange={(e) => setHostRole(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Host 2 / Co-Host */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    מנחה 2 (מנחה שותף/ה - Co-Host)
                  </label>
                  <input
                    type="text"
                    placeholder="שם מנחה 2 (למשל: דניאל לוי)"
                    value={coHostName}
                    onChange={(e) => setCoHostName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="תפקיד / תיאור (למשל: מפיק ומומחה תוכן)"
                    value={coHostRole}
                    onChange={(e) => setCoHostRole(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Optional guest in addition to duo */}
              <div className="pt-2 border-t border-slate-800/80">
                <details className="group">
                  <summary className="text-[11px] font-semibold text-slate-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1">
                    <span>+ האם בפרק זה הצמד מארח גם אורח/ת חיצוני/ת? (אופציונלי)</span>
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                    <input
                      type="text"
                      placeholder="שם האורח/ת (למשל: פרופ' רון כהן)"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <input
                      type="text"
                      placeholder="תפקיד / ארגון האורח/ת"
                      value={guestRole}
                      onChange={(e) => setGuestRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </details>
              </div>
            </div>
          ) : (
            /* Solo / Interview Format Section */
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 mb-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  שם המגיש / מנחה הפרק (אופציונלי)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="למשל: עומר אוקון"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="תפקיד / תיאור (למשל: מגיש הפודקאסט)"
                    value={hostRole}
                    onChange={(e) => setHostRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {episodeFormat === 'interview' && (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    פרטי אורח/ת (אופציונלי)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="שם האורח/ת (למשל: דניאל לוי)"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="תפקיד / חברה (למשל: מנהל טכנולוגיות ראשי)"
                        value={guestRole}
                        onChange={(e) => setGuestRole(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors"
            >
              ביטול
            </Link>
            <button
              type="submit"
              disabled={!title.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>יצירת הפרק ומעבר למחקר</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
