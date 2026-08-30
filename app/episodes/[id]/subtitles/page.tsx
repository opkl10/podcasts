'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getEpisodeById, saveEpisode } from '@/lib/storage';
import { Episode } from '@/lib/types';
import SubtitleStudio from '@/components/subtitles/SubtitleStudio';
import { ArrowRight, Sparkles, Subtitles } from 'lucide-react';
import Link from 'next/link';

export default function StandaloneSubtitlesPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const ep = getEpisodeById(id);
    if (ep) {
      setEpisode(ep);
    }
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-bold">טוען את אולפן הכתוביות...</p>
        </div>
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="p-4 rounded-3xl bg-purple-600/10 border border-purple-500/20 mb-4 text-purple-400">
          <Subtitles className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold mb-2">הפרק המבוקש לא נמצא</h2>
        <p className="text-sm text-slate-400 mb-6 max-w-md">ייתכן שהפרק נמחק או שהמזהה שגוי.</p>
        <Link
          href="/"
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all"
        >
          חזרה ללוח הבקרה
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#0a0d14] overflow-hidden">
      <SubtitleStudio
        episode={episode}
        isOpen={true}
        isStandalonePage={true}
        onClose={() => router.push(`/episodes/${episode.id}`)}
        onBack={() => router.push(`/episodes/${episode.id}`)}
        onUpdateEpisode={(updated) => {
          setEpisode(updated);
          saveEpisode(updated);
        }}
      />
    </div>
  );
}
