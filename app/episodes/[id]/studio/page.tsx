'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Episode } from '@/lib/types';
import { getEpisodeById } from '@/lib/storage';
import RecordingStudio from '@/components/studio/RecordingStudio';

interface StudioPageProps {
  params: Promise<{ id: string }>;
}

export default function StudioPage({ params }: StudioPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const data = getEpisodeById(resolvedParams.id);
    if (data) {
      setEpisode(data);
    }
    setIsLoaded(true);
  }, [resolvedParams.id]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-300">טוען את אולפן ההקלטות...</span>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="p-12 text-center rounded-3xl bg-[#121620] border border-slate-800 space-y-4">
        <h2 className="text-xl font-bold text-white">הפרק לא נמצא</h2>
        <p className="text-xs text-slate-400">לא נמצא פרק תואם להקלטה באולפן.</p>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
        >
          חזרה לדשבורד
        </button>
      </div>
    );
  }

  return <RecordingStudio episode={episode} />;
}
