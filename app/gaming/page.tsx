'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Episode } from '@/lib/types';
import { getEpisodeById, saveEpisode } from '@/lib/storage';
import GamingRecordingStudio from '@/components/gaming/GamingRecordingStudio';
import { Gamepad2 } from 'lucide-react';

function GamingStudioSessionLoader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const episodeId = searchParams.get('episodeId');
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (episodeId) {
      const existing = getEpisodeById(episodeId);
      if (existing) {
        setEpisode(existing);
        setIsLoaded(true);
        return;
      }
    }

    // Quick Start: Create an instant gaming recording session
    const quickStartSession: Episode = {
      id: `gaming-${Date.now()}`,
      podcastId: 'pod-gaming',
      title: `סשן גיימינג ויוצרים - ${new Date().toLocaleDateString('he-IL')}`,
      description: 'הקלטת גיימפליי ב-60FPS עם מצלמת פנים רב-ערוצית ומיקסר אודיו כפול',
      episodeNumber: 1,
      season: 1,
      status: 'ready',
      mediaType: 'gaming_creator',
      targetDurationMinutes: 30,
      topics: [
        {
          id: 'topic-gameplay',
          title: 'משחק חי וגיימפליי',
          estimatedMinutes: 30,
          notes: 'לכידת מסך / כרטיס אלגטו ב-60FPS',
          talkingPoints: ['הצגת המשחק וההגדרות', 'גיימפליי חי ב-60FPS'],
          questions: [],
          resources: [],
          completed: false,
          order: 1
        }
      ],
      subtitles: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveEpisode(quickStartSession);
    setEpisode(quickStartSession);
    setIsLoaded(true);
  }, [episodeId]);

  if (!isLoaded || !episode) {
    return (
      <div className="flex items-center justify-center min-h-[75vh]">
        <div className="flex flex-col items-center gap-3.5 p-8 rounded-3xl bg-[#121626] border border-purple-500/30 shadow-2xl">
          <div className="p-3 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/40 animate-bounce">
            <Gamepad2 className="w-8 h-8" />
          </div>
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-slate-200">מכין את אולפן הגיימינג וה-60FPS...</span>
        </div>
      </div>
    );
  }

  return <GamingRecordingStudio episode={episode} />;
}

export default function GamingStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[75vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm font-semibold text-slate-400">טוען אולפן גיימינג...</span>
          </div>
        </div>
      }
    >
      <GamingStudioSessionLoader />
    </Suspense>
  );
}
