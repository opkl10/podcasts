'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Episode, PodcastShow } from '@/lib/types';
import { getEpisodes, getPodcasts, saveEpisode, deleteEpisode, saveMediaBlob } from '@/lib/storage';
import StatsOverview from '@/components/dashboard/StatsOverview';
import EpisodeCard from '@/components/dashboard/EpisodeCard';
import PodcastManagerModal from '@/components/dashboard/PodcastManagerModal';
import DatabaseBackupModal from '@/components/dashboard/DatabaseBackupModal';
import CloudIntegrationsModal from '@/components/dashboard/CloudIntegrationsModal';
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
  Upload
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
  const [isLoaded, setIsLoaded] = useState(false);
  const importAudioFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportAudioAsNewEpisode = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const epId = `ep_${Date.now()}`;
      const blobKey = `rec_uploaded_${epId}_${Date.now()}`;
      await saveMediaBlob(blobKey, file);

      // Detect duration
      let durationSeconds = 60;
      try {
        const url = URL.createObjectURL(file);
        const tempAudio = new Audio(url);
        await new Promise((resolve) => {
          tempAudio.onloadedmetadata = () => {
            durationSeconds = Math.round(tempAudio.duration) || 60;
            resolve(true);
          };
          tempAudio.onerror = () => resolve(true);
          setTimeout(() => resolve(true), 2500);
        });
      } catch {}

      const nowIso = new Date().toISOString();
      const newEpisode: Episode = {
        id: epId,
        podcastId: selectedPodcastId !== 'all' ? selectedPodcastId : (podcasts[0]?.id || 'pod-tech'),
        title: cleanTitle || `פרק מוקלט ${new Date().toLocaleDateString('he-IL')}`,
        description: `פרק שנוצר מייבוא קובץ שמע: ${file.name}`,
        season: 1,
        episodeNumber: episodes.length + 1,
        status: 'recorded',
        targetDurationMinutes: Math.round(durationSeconds / 60) || 30,
        createdAt: nowIso,
        updatedAt: nowIso,
        topics: [
          {
            id: `topic_${Date.now()}_1`,
            title: 'נושא מרכזי מההקלטה',
            estimatedMinutes: Math.round(durationSeconds / 60) || 30,
            notes: 'הוקלט והועלה למערכת',
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
          recordedAt: new Date().toISOString(),
          duration: durationSeconds,
          audioBlobKey: blobKey,
          markers: [],
          topicsCovered: []
        }
      };

      saveEpisode(newEpisode);
      setEpisodes(prev => [newEpisode, ...prev]);
      alert(`הפרק "${newEpisode.title}" נוצר בהצלחה עם קובץ השמע! הפרק מוכן לעריכת סאונד ב-Audiogram Studio, כתוביות AI ושיתוף.`);
    } catch (err: any) {
      alert('שגיאה בייבוא קובץ השמע: ' + err.message);
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
              accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.ogg"
              onChange={handleImportAudioAsNewEpisode}
              className="hidden"
            />

            <div className="flex items-center gap-2">
              <Link
                href="/episodes/new"
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-95 transition-all text-center whitespace-nowrap"
              >
                <PlusCircle className="w-5 h-5" />
                <span>יצירת פרק חדש</span>
              </Link>

              <button
                onClick={() => importAudioFileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 font-bold text-xs shadow-lg transition-all active:scale-95 whitespace-nowrap"
                title="העלאת קובץ שמע מוקלט (MP3/WAV/M4A) ליצירת פרק מוכן באופן מיידי"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>העלאת הקלטה</span>
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

      {/* Episodes Grid */}
      {filteredEpisodes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEpisodes.map(episode => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onDelete={handleDeleteEpisode}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-slate-900/30 border border-dashed border-slate-800">
          <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
            <Radio className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">לא נמצאו פרקים בפילטר זה</h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6">
            לא נמצאו פרקים התואמים את התוכנית או הסינון הנוכחי. תוכלו ליצור פרק חדש לפודקאסט זה.
          </p>
          <Link
            href="/episodes/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>יצירת פרק חדש עכשיו</span>
          </Link>
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
          isOpen={!!audiogramEpisode}
          onClose={() => setAudiogramEpisode(null)}
          onUpdateEpisode={(updated) => {
            setEpisodes(prev => prev.map(e => e.id === updated.id ? updated : e));
            setAudiogramEpisode(updated);
          }}
        />
      )}
    </div>
  );
}
