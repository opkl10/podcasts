'use client';

import React, { useState, useEffect, use } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { Episode, TopicItem, MovieFactCard, HighlightClip } from '@/lib/types';
import { getEpisodeById, saveEpisode } from '@/lib/storage';
import EpisodeDetailsHeader from '@/components/research/EpisodeDetailsHeader';
import TopicManager from '@/components/research/TopicManager';
import ShowNotesExportModal from '@/components/research/ShowNotesExportModal';
import DeepResearchModal from '@/components/research/DeepResearchModal';
import AudioEditorAudiogramStudio from '@/components/audio/AudioEditorAudiogramStudio';
import MovieFactCardsManager from '@/components/research/MovieFactCardsManager';
import HighlightClipsManager from '@/components/research/HighlightClipsManager';
import { ListChecks, Film, Flame } from 'lucide-react';

interface EpisodePageProps {
  params: Promise<{ id: string }>;
}

export default function EpisodePage({ params }: EpisodePageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [activeResearchTab, setActiveResearchTab] = useState<'topics' | 'facts' | 'clips'>('topics');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDeepResearchOpen, setIsDeepResearchOpen] = useState(false);
  const [isAudiogramOpen, setIsAudiogramOpen] = useState(false);
  const [selectedClipForStudio, setSelectedClipForStudio] = useState<HighlightClip | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const data = getEpisodeById(resolvedParams.id);
    if (data) {
      setEpisode(data);
    }
    setIsLoaded(true);
  }, [resolvedParams.id]);

  const handleUpdateEpisode = (updated: Episode) => {
    setEpisode(updated);
    saveEpisode(updated);
  };

  const handleUpdateTopics = (newTopics: TopicItem[]) => {
    if (!episode) return;
    const updated = {
      ...episode,
      topics: newTopics,
      status: (episode.status === 'draft' && newTopics.length > 0) ? 'research' : episode.status
    };
    handleUpdateEpisode(updated);
  };

  const handleUpdateMovieFacts = (newFacts: MovieFactCard[]) => {
    if (!episode) return;
    const updated = {
      ...episode,
      movieFacts: newFacts
    };
    handleUpdateEpisode(updated);
  };

  const handleAddFactAsTopicPoint = (fact: MovieFactCard) => {
    if (!episode || episode.topics.length === 0) return;
    const updatedTopics = episode.topics.map((t, idx) => {
      if (idx === 0) {
        return {
          ...t,
          talkingPoints: [...t.talkingPoints, `[${fact.source}] ${fact.fact}`]
        };
      }
      return t;
    });
    handleUpdateTopics(updatedTopics);
    alert('העובדה נוספה בהצלחה לנקודות השיחה של הנושא הראשון!');
  };

  const handleApplyDeepResearch = (topics: TopicItem[], suggestedTitle?: string) => {
    if (!episode) return;
    const updated = {
      ...episode,
      title: suggestedTitle && suggestedTitle !== episode.title ? suggestedTitle : episode.title,
      topics,
      status: 'research' as const
    };
    handleUpdateEpisode(updated);
  };

  const handleOpenAudiogramForClip = (clip: HighlightClip) => {
    setSelectedClipForStudio(clip);
    setIsAudiogramOpen(true);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="p-12 text-center rounded-3xl bg-[#121620] border border-slate-800 space-y-4">
        <h2 className="text-xl font-bold text-white">הפרק המבוקש לא נמצא</h2>
        <p className="text-xs text-slate-400">ייתכן שהפרק נמחק או שהקישור שגוי.</p>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
        >
          חזרה לדשבורד
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Metadata Editor */}
      <EpisodeDetailsHeader
        episode={episode}
        onUpdateEpisode={handleUpdateEpisode}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenAudiogram={() => {
          setSelectedClipForStudio(null);
          setIsAudiogramOpen(true);
        }}
      />

      {/* Research Tabs Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800 w-fit flex-wrap">
        <button
          onClick={() => setActiveResearchTab('topics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeResearchTab === 'topics'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>מבנה הפרק ונושאי שיחה ({episode.topics.length})</span>
        </button>

        <button
          onClick={() => setActiveResearchTab('facts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeResearchTab === 'facts'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>כרטיסיות עובדות קולנוע ומקורות ({episode.movieFacts?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveResearchTab('clips')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeResearchTab === 'clips'
              ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/30'
              : 'text-slate-400 hover:text-amber-300'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>🔥 קליפים ויראליים ו-Shorts ({episode.highlightClips?.length || 0})</span>
        </button>
      </div>

      {/* Main View: Topics vs Movie Facts vs Viral Clips */}
      {activeResearchTab === 'topics' ? (
        <TopicManager
          topics={episode.topics}
          episodeTitle={episode.title}
          targetDurationMinutes={episode.targetDurationMinutes}
          onUpdateTopics={handleUpdateTopics}
          onOpenDeepResearch={() => setIsDeepResearchOpen(true)}
        />
      ) : activeResearchTab === 'facts' ? (
        <MovieFactCardsManager
          movieFacts={episode.movieFacts || []}
          episodeTitle={episode.title}
          onUpdateMovieFacts={handleUpdateMovieFacts}
          onAddFactAsTopicPoint={handleAddFactAsTopicPoint}
        />
      ) : (
        <HighlightClipsManager
          episode={episode}
          onUpdateEpisode={handleUpdateEpisode}
          onOpenAudiogramForClip={handleOpenAudiogramForClip}
        />
      )}

      {/* Export Show Notes Modal */}
      <ShowNotesExportModal
        episode={episode}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      {/* Deep AI Research Modal */}
      <DeepResearchModal
        isOpen={isDeepResearchOpen}
        onClose={() => setIsDeepResearchOpen(false)}
        episodeTitle={episode.title}
        guestName={episode.guest?.name}
        guestRole={episode.guest?.role}
        targetDurationMinutes={episode.targetDurationMinutes}
        onApplyTopics={handleApplyDeepResearch}
      />

      {/* Audio Editor & Audiogram Studio */}
      {isAudiogramOpen && (
        <AudioEditorAudiogramStudio
          episode={episode}
          isOpen={isAudiogramOpen}
          initialClip={selectedClipForStudio}
          onClose={() => {
            setIsAudiogramOpen(false);
            setSelectedClipForStudio(null);
          }}
          onUpdateEpisode={handleUpdateEpisode}
        />
      )}
    </div>
  );
}
