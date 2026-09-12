'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Episode } from '@/lib/types';
import { 
  getEpisodeById, 
  getOrCreateActiveGamingSession, 
  cleanupDuplicateEmptyGamingSessions 
} from '@/lib/storage';
import GamingRecordingStudio from '@/components/gaming/GamingRecordingStudio';
import { Gamepad2 } from 'lucide-react';

function GamingStudioSessionLoader() {
  const searchParams = useSearchParams();
  const episodeId = searchParams.get('episodeId');
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // 1. Clean up duplicate empty ghost sessions created by past refreshes
    cleanupDuplicateEmptyGamingSessions();

    // 2. If episodeId is provided in URL, load that exact session
    if (episodeId) {
      const existing = getEpisodeById(episodeId);
      if (existing) {
        setEpisode(existing);
        setIsLoaded(true);
        return;
      }
    }

    // 3. If no episodeId, reuse the active unrecorded gaming session or create ONE session
    const activeSession = getOrCreateActiveGamingSession();

    // Update browser URL without page reload so any future refreshes (F5 / Cmd+R)
    // keep the EXACT same episode and NEVER duplicate!
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `/gaming?episodeId=${activeSession.id}`);
    }

    setEpisode(activeSession);
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
