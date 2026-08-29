'use client';

import React from 'react';
import Link from 'next/link';
import { Episode, EpisodeStatus } from '@/lib/types';
import { 
  Mic, 
  BookOpen, 
  User, 
  Clock, 
  Layers, 
  Trash2, 
  Play, 
  Video,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Radio
} from 'lucide-react';
import { formatTime, getPodcastById } from '@/lib/storage';

interface EpisodeCardProps {
  episode: Episode;
  onDelete: (id: string) => void;
}

const statusConfig: Record<EpisodeStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
  draft: {
    label: 'טיוטה ראשונית',
    bg: 'bg-slate-800/80',
    text: 'text-slate-300',
    border: 'border-slate-700',
    icon: AlertCircle
  },
  research: {
    label: 'במחקר וכתיבה',
    bg: 'bg-blue-950/60',
    text: 'text-blue-400',
    border: 'border-blue-800/50',
    icon: BookOpen
  },
  ready: {
    label: 'מוכן לאולפן',
    bg: 'bg-amber-950/60',
    text: 'text-amber-400',
    border: 'border-amber-700/50',
    icon: Sparkles
  },
  recording: {
    label: 'באולפן הקלטה',
    bg: 'bg-red-950/60',
    text: 'text-red-400',
    border: 'border-red-800/50',
    icon: Mic
  },
  recorded: {
    label: 'הוקלט בהצלחה',
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-400',
    border: 'border-emerald-800/50',
    icon: CheckCircle
  },
  published: {
    label: 'פורסם',
    bg: 'bg-purple-950/60',
    text: 'text-purple-400',
    border: 'border-purple-800/50',
    icon: CheckCircle
  }
};

export default function EpisodeCard({ episode, onDelete }: EpisodeCardProps) {
  const status = statusConfig[episode.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const podcast = getPodcastById(episode.podcastId);

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl bg-[#121620] border border-slate-800/90 hover:border-indigo-500/40 p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-950/20">
      <div>
        {/* Top badge: Podcast Show Title */}
        {podcast && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
              <Radio className="w-3 h-3 text-indigo-400" />
              {podcast.title}
            </span>
          </div>
        )}

        {/* Header: Season/Ep + Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-wide">
              עונה {episode.season} • פרק {episode.episodeNumber}
            </span>
            {episode.recording?.duration ? (
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                <Video className="w-3 h-3" />
                {formatTime(episode.recording.duration)} הוקלט
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg} ${status.text} ${status.border}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>

            <button
              onClick={() => {
                if (confirm(`האם למחוק את פרק "${episode.title}"?`)) {
                  onDelete(episode.id);
                }
              }}
              title="מחק פרק"
              className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Title */}
        <Link href={`/episodes/${episode.id}`} className="block group-hover:text-indigo-300 transition-colors">
          <h3 className="text-lg font-bold text-white leading-snug line-clamp-2 mb-2">
            {episode.title}
          </h3>
        </Link>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
          {episode.description || 'אין תיאור לפרק זה עדיין.'}
        </p>

        {/* Guest info if exists */}
        {episode.guest && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow">
              {episode.guest.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{episode.guest.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{episode.guest.role || 'אורח/ת מיוחד/ת'}</p>
            </div>
          </div>
        )}

        {/* Meta Stats */}
        <div className="grid grid-cols-2 gap-2 py-3 border-t border-slate-800/60 text-xs text-slate-400 mb-5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>{episode.topics.length} נושאי מחקר</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>יעד: {episode.targetDurationMinutes} דקות</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <Link
          href={`/episodes/${episode.id}`}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700/50 transition-all text-center"
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          מחקר ואג'נדה
        </Link>

        <Link
          href={`/episodes/${episode.id}/studio`}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-xs font-semibold text-white shadow-md shadow-red-950/40 hover:shadow-red-900/60 transition-all text-center group/btn"
        >
          <Mic className="w-3.5 h-3.5 group-hover/btn:animate-pulse" />
          כניסה לאולפן
        </Link>
      </div>
    </div>
  );
}
