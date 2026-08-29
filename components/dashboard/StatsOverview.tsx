'use client';

import React from 'react';
import { Episode } from '@/lib/types';
import { Radio, Mic2, FileText, CheckCircle2, Clock } from 'lucide-react';

interface StatsOverviewProps {
  episodes: Episode[];
}

export default function StatsOverview({ episodes }: StatsOverviewProps) {
  const totalEpisodes = episodes.length;
  const readyToRecord = episodes.filter(e => e.status === 'ready').length;
  const recordedEpisodes = episodes.filter(e => e.status === 'recorded' || e.status === 'published').length;
  const totalTopics = episodes.reduce((acc, ep) => acc + ep.topics.length, 0);

  // Total recorded seconds across episodes
  const totalRecordedSeconds = episodes.reduce((acc, ep) => acc + (ep.recording?.duration || 0), 0);
  const totalRecordedMinutes = Math.round(totalRecordedSeconds / 60);

  const stats = [
    {
      label: 'סה״כ פרקים',
      value: totalEpisodes,
      icon: Radio,
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-blue-400',
      bgGlow: 'group-hover:border-blue-500/50'
    },
    {
      label: 'מוכנים להקלטה באולפן',
      value: readyToRecord,
      icon: Mic2,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-400',
      bgGlow: 'group-hover:border-amber-500/50'
    },
    {
      label: 'פרקים שהוקלטו',
      value: recordedEpisodes,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-400',
      bgGlow: 'group-hover:border-emerald-500/50'
    },
    {
      label: 'נושאי מחקר שנבנו',
      value: totalTopics,
      icon: FileText,
      color: 'from-purple-500 to-pink-600',
      textColor: 'text-purple-400',
      bgGlow: 'group-hover:border-purple-500/50'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className={`group relative overflow-hidden rounded-2xl bg-[#12161f] border border-slate-800/80 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 ${stat.bgGlow}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400">{stat.label}</span>
              <div className={`p-2 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-md shadow-black/30`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold tracking-tight text-white">{stat.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
