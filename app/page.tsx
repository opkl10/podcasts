'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Episode, PodcastShow } from '@/lib/types';
import { getEpisodes, getPodcasts, saveEpisode, saveEpisodes, deleteEpisode, saveMediaBlob, autoHealAllEpisodes } from '@/lib/storage';
import StatsOverview from '@/components/dashboard/StatsOverview';
import EpisodeCard from '@/components/dashboard/EpisodeCard';
import PodcastManagerModal from '@/components/dashboard/PodcastManagerModal';
import DatabaseBackupModal from '@/components/dashboard/DatabaseBackupModal';
import CloudIntegrationsModal from '@/components/dashboard/CloudIntegrationsModal';
import ImportEpisodesModal from '@/components/dashboard/ImportEpisodesModal';
import RecordedEpisodesVault from '@/components/recordings/RecordedEpisodesVault';
import SubtitleStudio from '@/components/subtitles/SubtitleStudio';
import AudioEditorAudiogramStudio from '@/components/audio/AudioEditorAudiogramStudio';
import { 
  PlusCircle, 
  Search, 
  Filter, 
  Mic2, 
  Sparkles, 
  RotateCcw,
  Smartphone,
  Radio,
  Clock,
  Layers,
  FolderKanban,
  Settings2,
  Database,
  Cloud,
  FolderArchive,
  Subtitles,
  Activity,
  Upload,
  FileJson,
  AlertCircle,
  CheckCircle2,
  Gamepad2
} from 'lucide-react';

export default function DashboardPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastShow[]>([]);
  const [selectedPodcastId, setSelectedPodcastId] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [mainView, setMainView] = useState<'episodes' | 'vault'>('episodes');
  const [subtitleEpisode, setSubtitleEpisode] = useState<Episode | null>(null);
  const [audiogramEpisode, setAudiogramEpisode] = useState<Episode | null>(null);

  const [isPodcastModalOpen, setIsPodcastModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isImportEpisodesModalOpen, setIsImportEpisodesModalOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const importAudioFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportAudioAsNewEpisode = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    const newEpisodesCreated: Episode[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const lowerName = file.name.toLowerCase();

        // 1. If it's a JSON or Text/Markdown file containing episode definitions
        if (lowerName.endsWith('.json') || lowerName.endsWith('.txt') || lowerName.endsWith('.md')) {
          try {
            const text = await file.text();
            if (lowerName.endsWith('.json')) {
              const parsed = JSON.parse(text);
              const list = Array.isArray(parsed) ? parsed : (parsed.episodes || parsed.פרקים || parsed.data || [parsed]);
              for (const item of list) {
                if (typeof item === 'object' && item !== null) {
                  const epId = item.id || `ep_imp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                  newEpisodesCreated.push({
                    id: epId,
                    podcastId: item.podcastId || (selectedPodcastId !== 'all' ? selectedPodcastId : (podcasts[0]?.id || 'pod-tech')),
                    title: item.title || item.כותרת || file.name.replace(/\.[^/.]+$/, ''),
                    description: item.description || item.תיאור || 'פרק שיובא מקובץ נתונים',
                    season: Number(item.season || item.עונה) || 1,
                    episodeNumber: Number(item.episodeNumber || item.פרק || item['מספר פרק']) || (episodes.length + newEpisodesCreated.length + 1),
                    status: item.status || 'research',
                    mediaType: item.mediaType || 'video',
                    targetDurationMinutes: Number(item.targetDurationMinutes || item.duration) || 30,
                    topics: item.topics || [],
                    movieFacts: item.movieFacts || [],
                    subtitles: item.subtitles || [],
                    guest: item.guest,
                    createdAt: item.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  });
                }
              }
              continue;
            }
          } catch (jsonErr) {
            console.warn('File not parsed as JSON, treating as raw media if applicable', jsonErr);
          }
        }

        // 2. Audio or Video media file upload
        const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const epId = `ep_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
        const blobKey = `rec_uploaded_${epId}_${Date.now()}`;
        await saveMediaBlob(blobKey, file);

        // Detect duration
        let durationSeconds = 60;
        try {
          const url = URL.createObjectURL(file);
          const isVideo = file.type.startsWith('video') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mov') || lowerName.endsWith('.webm');
          const mediaEl = isVideo ? document.createElement('video') : new Audio(url);
          await new Promise((resolve) => {
            mediaEl.onloadedmetadata = () => {
              durationSeconds = Math.round(mediaEl.duration) || 60;
              resolve(true);
            };
            mediaEl.onerror = () => resolve(true);
            setTimeout(() => resolve(true), 2500);
          });
        } catch {}

        const nowIso = new Date().toISOString();
        const isVideo = file.type.startsWith('video') || lowerName.endsWith('.mp4') || lowerName.endsWith('.mov');

        const newEpisode: Episode = {
          id: epId,
          podcastId: selectedPodcastId !== 'all' ? selectedPodcastId : (podcasts[0]?.id || 'pod-tech'),
          title: cleanTitle || `פרק מוקלט ${new Date().toLocaleDateString('he-IL')}`,
          description: `פרק שנוצר מהעלאת קובץ: ${file.name}`,
          season: 1,
          episodeNumber: episodes.length + newEpisodesCreated.length + 1,
          status: 'recorded',
          mediaType: isVideo ? 'video' : 'audio_only',
          targetDurationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
          createdAt: nowIso,
          updatedAt: nowIso,
          topics: [
            {
              id: `topic_${Date.now()}_${i}_1`,
              title: 'נושא מרכזי מההקלטה',
              estimatedMinutes: Math.max(1, Math.round(durationSeconds / 60)),
              notes: `קובץ מקור: ${file.name}`,
              talkingPoints: ['דיון פודקאסט ראשי'],
              questions: ['מהם עיקרי הדברים שנאמרו בפרק?'],
              resources: [],
              completed: true,
              order: 1
            }
          ],
          subtitles: [],
          movieFacts: [],
          recording: {
            recordedAt: nowIso,
            duration: durationSeconds,
            audioBlobKey: blobKey,
            videoBlobKey: isVideo ? blobKey : undefined,
            markers: [],
            topicsCovered: []
          }
        };

        newEpisodesCreated.push(newEpisode);
      }

      if (newEpisodesCreated.length > 0) {
        const existing = getEpisodes();
        const merged = [...newEpisodesCreated, ...existing];
        saveEpisodes(merged);
        setEpisodes(merged);

        // Auto-reset filters so new episodes appear immediately!
        setSelectedPodcastId('all');
        setActiveFilter('all');
        setMainView('episodes');
        setSearchQuery('');

        alert(`🎉 הועלו/יובאו בהצלחה ${newEpisodesCreated.length} פרקים! כל הסינונים אופסו כדי שתוכלו לראות אותם מיד בראש הרשימה ובסטודיו.`);
      }
    } catch (err: any) {
      alert('שגיאה בייבוא הקבצים: ' + (err?.message || err));
    } finally {
      if (importAudioFileInputRef.current) importAudioFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const episodesData = getEpisodes();
    const podcastsData = getPodcasts();
    setEpisodes(episodesData);
    setPodcasts(podcastsData);
    setIsLoaded(true);

    // Auto-heal all episodes with unlinked or 0-duration recordings
    autoHealAllEpisodes().then(healed => {
      if (healed && healed.length > 0) {
        setEpisodes(healed);
      }
    });
  }, []);

  const handleDeleteEpisode = async (id: string) => {
    await deleteEpisode(id);
    setEpisodes(prev => prev.filter(e => e.id !== id));
  };

  const handleResetDemoData = () => {
    if (confirm('האם לאתחל את רשימת הפרקים והפודקאסטים לדוגמה?')) {
      localStorage.removeItem('podcast_studio_episodes_v2');
      localStorage.removeItem('podcast_studio_shows_v2');
      const resetEps = getEpisodes();
      const resetPods = getPodcasts();
      setEpisodes(resetEps);
      setPodcasts(resetPods);
    }
  };

  // Filter by Podcast Show AND by Status AND by Search Query
  const filteredEpisodes = episodes.filter(ep => {
    const matchesPodcast = selectedPodcastId === 'all' || ep.podcastId === selectedPodcastId;
    const matchesStatus = activeFilter === 'all' || ep.status === activeFilter;
    const matchesSearch = searchQuery === '' || 
      ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ep.guest && ep.guest.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPodcast && matchesStatus && matchesSearch;
  });

  const currentPodcast = podcasts.find(p => p.id === selectedPodcastId);

  const filterTabs = [
    { id: 'all', label: 'כל הסטטוסים', count: episodes.filter(e => selectedPodcastId === 'all' || e.podcastId === selectedPodcastId).length },
    { id: 'ready', label: 'מוכנים לאולפן', count: episodes.filter(e => (selectedPodcastId === 'all' || e.podcastId === selectedPodcastId) && e.status === 'ready').length },
    { id: 'research', label: 'במחקר', count: episodes.filter(e => (selectedPodcastId === 'all' || e.podcastId === selectedPodcastId) && e.status === 'research').length },
    { id: 'recorded', label: 'הוקלטו', count: episodes.filter(e => (selectedPodcastId === 'all' || e.podcastId === selectedPodcastId) && (e.status === 'recorded' || e.status === 'published')).length },
    { id: 'draft', label: 'טיוטות', count: episodes.filter(e => (selectedPodcastId === 'all' || e.podcastId === selectedPodcastId) && e.status === 'draft').length },
  ];

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400">טוען את אולפן הפודקאסטים...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-[#131722] to-[#0e111a] border border-indigo-900/40 p-8 shadow-2xl">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              מערכת אולפן וקטלוג רב-פודקאסטים
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              {currentPodcast ? currentPodcast.title : 'כל הפודקאסטים והתוכניות'}
            </h1>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-xl">
              {currentPodcast?.description || 'קטלוג וניהול תוכניות פודקאסט מרובות, הכנת ראשי פרקים ושאלות, הקלטת וידאו HD עם iPhone ושעון הקלטה חי.'}
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-3 shrink-0">
            {/* Hidden Input for Instant Audio Import */}
            <input
              ref={importAudioFileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.ogg,.mp4,.mov,.aac,.flac,.opus,.json,.txt,.md,.csv"
              multiple
              onChange={handleImportAudioAsNewEpisode}
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/episodes/new"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95 transition-all text-center whitespace-nowrap"
              >
                <PlusCircle className="w-5 h-5" />
                <span>יצירת פרק חדש</span>
              </Link>

              <Link
                href="/gaming"
                className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-purple-600/40 hover:scale-[1.02] active:scale-95 transition-all text-center whitespace-nowrap border border-purple-400/30"
                title="כניסה ישירה לאולפן גיימינג ויוצרים ב-60FPS"
              >
                <Gamepad2 className="w-4 h-4 text-purple-200" />
                <span>🎮 אולפן גיימינג ב-60FPS</span>
              </Link>

              <button
                onClick={() => importAudioFileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold text-xs shadow-lg transition-all active:scale-95 whitespace-nowrap"
                title="העלאת קובצי שמע ווידאו מוקלטים (MP3/WAV/M4A/MP4) ליצירת פרקים באופן מיידי"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>העלאת הקלטות</span>
              </button>

              <button
                onClick={() => setIsImportEpisodesModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/40 font-bold text-xs shadow-lg transition-all active:scale-95 whitespace-nowrap"
                title="ייבוא פרקים מקובץ JSON, מסמך טקסט או רשימת נושאים"
              >
                <FileJson className="w-4 h-4 text-indigo-400" />
                <span>ייבוא פרקים מקובץ</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPodcastModalOpen(true)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white border border-slate-700/60 font-semibold text-xs transition-all"
              >
                <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>תוכניות ({podcasts.length})</span>
              </button>

              <button
                onClick={() => setIsCloudModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/30 font-semibold text-xs transition-all"
                title="חיבור BunnyCDN ו-uPress"
              >
                <span className="text-sm">🐰</span>
                <span>Bunny & ענן</span>
              </button>

              <button
                onClick={() => setIsDbModalOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition-all"
                title="ניהול וגיבוי מסד הנתונים"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>מסד נתונים</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Switcher */}
      <div className="flex items-center p-1.5 bg-[#121620] rounded-2xl border border-slate-800 shadow-lg">
        <button
          onClick={() => setMainView('episodes')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            mainView === 'episodes'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>ניהול וקטלוג פרקים ({episodes.length})</span>
        </button>

        <button
          onClick={() => setMainView('vault')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            mainView === 'vault'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderArchive className="w-4 h-4 text-purple-400" />
          <span>ארכיון הקלטות והורדות (וידאו, סטריאו, מונו, כתוביות)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/20 text-purple-300 font-mono">
            {episodes.filter(e => e.status === 'recorded' || e.status === 'published' || e.recording).length}
          </span>
        </button>
      </div>

      {mainView === 'vault' ? (
        <RecordedEpisodesVault
          episodes={episodes}
          podcasts={podcasts}
          onOpenSubtitles={(ep) => setSubtitleEpisode(ep)}
          onOpenAudiogram={(ep) => setAudiogramEpisode(ep)}
          onDeleteEpisode={(id) => setEpisodes(prev => prev.filter(e => e.id !== id))}
          onUpdateEpisodes={(updated) => setEpisodes(updated)}
        />
      ) : (
        <>
          {/* Podcast Shows Selector Tabs */}
          <div className="p-4 rounded-2xl bg-[#121620] border border-slate-800/90 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-indigo-400" />
            סנן לפי תוכנית פודקאסט:
          </span>
          <button
            onClick={() => setIsPodcastModalOpen(true)}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            + הוסף פודקאסט חדש
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedPodcastId('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedPodcastId === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>כל הפודקאסטים</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400">
              {episodes.length}
            </span>
          </button>

          {podcasts.map(pod => {
            const count = episodes.filter(e => e.podcastId === pod.id).length;
            return (
              <button
                key={pod.id}
                onClick={() => setSelectedPodcastId(pod.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedPodcastId === pod.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{pod.title}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  selectedPodcastId === pod.id ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Metrics & Overview */}
      <StatsOverview episodes={episodes.filter(e => selectedPodcastId === 'all' || e.podcastId === selectedPodcastId)} />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeFilter === tab.id
                  ? 'bg-slate-800 text-white border border-indigo-500/50 shadow-md'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800/60'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeFilter === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar + Reset */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="חיפוש לפי כותרת, אורח או תיאור..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={handleResetDemoData}
            title="טעינה מחדש של נתוני דמו"
            className="p-2 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Active Filters Notification Bar */}
      {(selectedPodcastId !== 'all' || activeFilter !== 'all' || searchQuery !== '') && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs shadow-lg">
          <div className="flex items-center gap-2 text-slate-300">
            <Filter className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              מציג <strong className="text-white font-bold">{filteredEpisodes.length}</strong> מתוך <strong className="text-white font-bold">{episodes.length}</strong> פרקים קיימים
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-indigo-300">
              {selectedPodcastId !== 'all' && `תוכנית: "${podcasts.find(p => p.id === selectedPodcastId)?.title || selectedPodcastId}" `}
              {activeFilter !== 'all' && `סטטוס: "${filterTabs.find(t => t.id === activeFilter)?.label || activeFilter}" `}
              {searchQuery && `חיפוש: "${searchQuery}"`}
            </span>
          </div>
          <button
            onClick={() => {
              setSelectedPodcastId('all');
              setActiveFilter('all');
              setSearchQuery('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 font-semibold text-xs transition-all w-fit"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>הצג את כל הפרקים (איפוס סינונים)</span>
          </button>
        </div>
      )}

      {/* Episodes Grid */}
      {filteredEpisodes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEpisodes.map(episode => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onDelete={handleDeleteEpisode}
              onOpenAudiogram={(ep) => setAudiogramEpisode(ep)}
            />
          ))}
        </div>
      ) : episodes.length > 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-gradient-to-b from-amber-500/10 via-slate-900/50 to-slate-900/80 border border-amber-500/30 shadow-2xl">
          <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-300 mb-4 border border-amber-500/30 shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-white mb-2">
            נמצאו {episodes.length} פרקים במערכת — אך הם מוסתרים עקב סינונים פעילים!
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mb-4 leading-relaxed">
            הפרקים שהעליתם קיימים ושמורים במערכת, אך אינם תואמים לתוכנית הפודקאסט או לסטטוס המסונן כרגע.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-6 text-xs text-slate-300">
            {selectedPodcastId !== 'all' && (
              <span className="px-3 py-1 rounded-lg bg-slate-800/90 text-indigo-300 border border-indigo-500/30">
                תוכנית: <strong>{podcasts.find(p => p.id === selectedPodcastId)?.title || selectedPodcastId}</strong>
              </span>
            )}
            {activeFilter !== 'all' && (
              <span className="px-3 py-1 rounded-lg bg-slate-800/90 text-purple-300 border border-purple-500/30">
                סטטוס: <strong>{filterTabs.find(t => t.id === activeFilter)?.label || activeFilter}</strong>
              </span>
            )}
            {searchQuery && (
              <span className="px-3 py-1 rounded-lg bg-slate-800/90 text-amber-300 border border-amber-500/30">
                חיפוש: &quot;{searchQuery}&quot;
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setSelectedPodcastId('all');
                setActiveFilter('all');
                setSearchQuery('');
              }}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-indigo-600/40 hover:scale-[1.02] active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>הצג את כל {episodes.length} הפרקים (איפוס כל הסינונים)</span>
            </button>

            <button
              onClick={() => setIsImportEpisodesModalOpen(true)}
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
            >
              <FileJson className="w-4 h-4 text-indigo-400" />
              <span>ייבוא פרקים מקובץ</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800">
          <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">אין עדיין פרקים במערכת</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            התחילו ביצירת פרק חדש, העלאת הקלטות שמע/וידאו או ייבוא פרקים מקובץ JSON / טקסט.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/episodes/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>יצירת פרק חדש</span>
            </Link>
            <button
              onClick={() => importAudioFileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>העלאת הקלטות</span>
            </button>
            <button
              onClick={() => setIsImportEpisodesModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold"
            >
              <FileJson className="w-4 h-4 text-indigo-400" />
              <span>ייבוא פרקים מקובץ</span>
            </button>
          </div>
        </div>
      )}
      </>
    )}

      {/* Podcast Manager Modal */}
      <PodcastManagerModal
        podcasts={podcasts}
        isOpen={isPodcastModalOpen}
        onClose={() => setIsPodcastModalOpen(false)}
        onUpdatePodcasts={(updated) => setPodcasts(updated)}
        onSelectPodcast={(id) => setSelectedPodcastId(id)}
      />

      {/* Database Backup & Restore Modal */}
      <DatabaseBackupModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        onRefreshData={() => {
          setEpisodes(getEpisodes());
          setPodcasts(getPodcasts());
        }}
      />

      {/* Cloud & CDN Integrations Modal (BunnyCDN & uPress) */}
      <CloudIntegrationsModal
        isOpen={isCloudModalOpen}
        onClose={() => setIsCloudModalOpen(false)}
      />

      {/* Import Episodes Modal */}
      <ImportEpisodesModal
        isOpen={isImportEpisodesModalOpen}
        onClose={() => setIsImportEpisodesModalOpen(false)}
        podcasts={podcasts}
        currentPodcastId={selectedPodcastId}
        onEpisodesImported={(importedEpisodes) => {
          const existing = getEpisodes();
          const merged = [...importedEpisodes, ...existing];
          saveEpisodes(merged);
          setEpisodes(merged);
          setSelectedPodcastId('all');
          setActiveFilter('all');
          setMainView('episodes');
          setSearchQuery('');
          alert(`🎉 יובאו בהצלחה ${importedEpisodes.length} פרקים חדשים! כל הסינונים אופסו והפרקים מופיעים כעת בראש הרשימה.`);
        }}
      />

      {/* Professional Subtitle Studio Pro */}
      {subtitleEpisode && (
        <SubtitleStudio
          episode={subtitleEpisode}
          isOpen={!!subtitleEpisode}
          onClose={() => setSubtitleEpisode(null)}
          onUpdateEpisode={(updated) => {
            setEpisodes(prev => prev.map(e => e.id === updated.id ? updated : e));
            setSubtitleEpisode(updated);
          }}
        />
      )}

      {/* Audio Editor & Audiogram Studio */}
      {audiogramEpisode && (
        <AudioEditorAudiogramStudio
          episode={audiogramEpisode}
          allEpisodes={episodes}
          isOpen={!!audiogramEpisode}
          onClose={() => setAudiogramEpisode(null)}
          onSwitchEpisode={(newEp) => setAudiogramEpisode(newEp)}
          onUpdateEpisode={(updated) => {
            setEpisodes(prev => prev.map(e => e.id === updated.id ? updated : e));
            setAudiogramEpisode(updated);
          }}
        />
      )}
    </div>
  );
}
