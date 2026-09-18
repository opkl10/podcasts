'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getEpisodes, saveEpisode } from '@/lib/storage';
import { Episode, SubtitleItem } from '@/lib/types';
import SubtitleStudio from '@/components/subtitles/SubtitleStudio';
import { 
  Subtitles, 
  Upload, 
  Video, 
  Music, 
  ArrowRight, 
  Sparkles, 
  FolderOpen, 
  Plus, 
  FileText, 
  CheckCircle2,
  Sliders,
  Type,
  Move,
  Image as ImageIcon,
  Clock,
  Layers,
  Check,
  X
} from 'lucide-react';
import Link from 'next/link';

function SubtitlesHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedEpisodeId = searchParams?.get('episodeId');

  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSelectEpisodeModalOpen, setIsSelectEpisodeModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = getEpisodes();
    setEpisodes(list);

    if (requestedEpisodeId) {
      const found = list.find(e => e.id === requestedEpisodeId);
      if (found) {
        setActiveEpisode(found);
      }
    }
  }, [requestedEpisodeId]);

  // Handle direct file upload (Video or Audio)
  const handleFileSelect = (file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaUrl(url);

    // Create a standalone in-memory episode wrapper
    const newStandaloneEp: Episode = {
      id: `standalone_${Date.now()}`,
      podcastId: 'pod-default',
      title: file.name.replace(/\.[^/.]+$/, ''),
      description: `קובץ מדיה שהועלה: ${file.name}`,
      season: 1,
      episodeNumber: 1,
      status: 'published',
      mediaType: file.type.startsWith('video') ? 'video' : 'audio_only',
      targetDurationMinutes: 15,
      topics: [],
      movieFacts: [],
      subtitles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setActiveEpisode(newStandaloneEp);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Start with a blank canvas / import subtitles directly
  const handleStartBlankProject = () => {
    const blankEp: Episode = {
      id: `standalone_blank_${Date.now()}`,
      podcastId: 'pod-default',
      title: 'פרויקט כתוביות חדש',
      description: 'עריכת כתוביות עצמאית',
      season: 1,
      episodeNumber: 1,
      status: 'published',
      mediaType: 'video',
      targetDurationMinutes: 10,
      topics: [],
      movieFacts: [],
      subtitles: [
        {
          id: `sub_${Date.now()}_1`,
          startTime: 0.0,
          endTime: 2.5,
          text: 'ברוכים הבאים לאולפן הכתוביות העצמאי!'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setActiveEpisode(blankEp);
  };

  // If a project is active, display the full SubtitleStudio in standalone page mode
  if (activeEpisode || mediaUrl) {
    return (
      <div className="w-full h-screen bg-[#0a0d14] overflow-hidden">
        <SubtitleStudio
          episode={activeEpisode || undefined}
          isOpen={true}
          isStandalonePage={true}
          initialMediaUrl={mediaUrl || undefined}
          initialMediaFile={mediaFile}
          onClose={() => {
            setActiveEpisode(null);
            setMediaUrl(null);
            setMediaFile(null);
          }}
          onBack={() => {
            setActiveEpisode(null);
            setMediaUrl(null);
            setMediaFile(null);
          }}
          onUpdateEpisode={(updated) => {
            setActiveEpisode(updated);
            if (!updated.id.startsWith('standalone_')) {
              saveEpisode(updated);
            }
          }}
        />
      </div>
    );
  }

  // Welcome Screen: Choose Media, Episode, or Blank Project
  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-purple-500 selection:text-white">
      {/* Top Navbar */}
      <header className="w-full h-16 border-b border-slate-800/80 bg-[#0a0d14]/80 backdrop-blur-xl px-6 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-800/60 transition-colors text-xs font-semibold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>חזרה ללוח הבקרה</span>
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>אולפן כתוביות עצמאי</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono border border-purple-500/30">
                  Standalone Studio
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleStartBlankProject}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            <span>פרויקט ריק חדש</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col justify-center items-center">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>מערכת כתוביות מקצועית, עצמאית ומשוחררת מכל תלות</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            עריכת כתוביות, תזמון מהיר ולוגו מותג קבוע
          </h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            טען סרטון או קובץ שמע ישירות מהמחשב, או בחר פרק קיים מספריית הפודקאסטים.
            שליטה מלאה בבחירת כתוביות מרובות, לוגו קבוע בימין/שמאל, גופנים אישיים, מיקום פיזי בגרירה חופשית, וכמות מילים בשורה.
          </p>
        </div>

        {/* Primary Action: Drag & Drop Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full max-w-2xl p-10 rounded-3xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center text-center group ${
            isDragOver 
              ? 'border-purple-500 bg-purple-950/30 scale-[1.01] shadow-2xl shadow-purple-900/30' 
              : 'border-slate-800 bg-slate-950/60 hover:border-purple-500/50 hover:bg-slate-900/40 shadow-xl'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*,audio/mp3,audio/wav,audio/m4a,audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-purple-600/20 transition-all shadow-lg">
            <Upload className="w-8 h-8" />
          </div>

          <h3 className="text-lg font-black text-white mb-1 group-hover:text-purple-300 transition-colors">
            גרור לכאן קובץ וידאו או אודיו, או לחץ לבחירה
          </h3>
          <p className="text-xs text-slate-400 max-w-md mb-4">
            תמיכה מלאה בכל הפורמטים: MP4, WebM, MOV, MP3, WAV, M4A ללא הגבלת גודל
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-purple-300 flex items-center gap-1">
              <Video className="w-3 h-3 text-purple-400" />
              <span>וידאו 16:9 / 9:16</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-indigo-300 flex items-center gap-1">
              <Music className="w-3 h-3 text-indigo-400" />
              <span>אודיו ופודקאסט</span>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-300 flex items-center gap-1">
              <FileText className="w-3 h-3 text-emerald-400" />
              <span>יבוא SRT/VTT</span>
            </span>
          </div>
        </div>

        {/* Secondary Choices: Choose Existing Episode or Blank */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl mt-6">
          {/* Option 1: Choose from episodes library */}
          <button
            type="button"
            onClick={() => setIsSelectEpisodeModalOpen(true)}
            className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60 text-right transition-all flex items-center gap-4 group"
          >
            <div className="p-3 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                בחר פרק קיים מהספרייה
              </h4>
              <p className="text-xs text-slate-400">
                טען פרק שהוקלט במערכת לעריכת כתוביות מיידית
              </p>
            </div>
          </button>

          {/* Option 2: Start blank canvas */}
          <button
            type="button"
            onClick={handleStartBlankProject}
            className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900/60 text-right transition-all flex items-center gap-4 group"
          >
            <div className="p-3 rounded-xl bg-purple-600/10 text-purple-400 border border-purple-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                התחל מפרויקט ריק
              </h4>
              <p className="text-xs text-slate-400">
                הקלד כתוביות ידנית או ייבא קובץ כתוביות SRT / VTT
              </p>
            </div>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-4xl mt-12 pt-8 border-t border-slate-800/80 text-right">
          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>בחירה מרובה (Batch)</span>
            </div>
            <p className="text-[11px] text-slate-400">סמן כמה כתוביות יחד להזזת תזמון מרוכזת, איחוד או מחיקה.</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>לוגו מותג קבוע</span>
            </div>
            <p className="text-[11px] text-slate-400">העלה לוגו לימין/שמאל שנשמר קבוע בדפדפן לכל הפרויקטים.</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Type className="w-3.5 h-3.5 text-indigo-400" />
              <span>פונטים אישיים</span>
            </div>
            <p className="text-[11px] text-slate-400">העלאת גופנים אישיים (.ttf/.otf) עם שמירה קבועה וגופנים עבריים.</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
              <Move className="w-3.5 h-3.5 text-amber-400" />
              <span>גרירה חופשית (Drag)</span>
            </div>
            <p className="text-[11px] text-slate-400">גרור את הכתובית בעכבר על גבי הווידאו לכל מיקום רצוי.</p>
          </div>
        </div>
      </main>

      {/* Select Episode Modal */}
      {isSelectEpisodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1420] border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">בחר פרק קיים לעריכת כתוביות</h3>
              </div>
              <button
                onClick={() => setIsSelectEpisodeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/50">
              <input
                type="text"
                placeholder="חפש לפי שם פרק..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Episodes List */}
            <div className="p-4 max-h-80 overflow-y-auto space-y-2">
              {episodes
                .filter(ep => ep.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((ep) => (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      setActiveEpisode(ep);
                      setIsSelectEpisodeModalOpen(false);
                    }}
                    className="w-full p-3 rounded-xl bg-slate-900/60 hover:bg-indigo-950/30 border border-slate-800 hover:border-indigo-500/40 text-right transition-all flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {ep.title}
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        {ep.subtitles?.length || 0} כתוביות קיימות
                      </p>
                    </div>
                    <span className="text-xs font-bold text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      פתח באולפן ←
                    </span>
                  </button>
                ))}

              {episodes.length === 0 && (
                <div className="text-center py-8 text-slate-500 text-xs">
                  לא נמצאו פרקים במערכת.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StandaloneSubtitlesHubPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07090e] flex items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    }>
      <SubtitlesHubContent />
    </Suspense>
  );
}
