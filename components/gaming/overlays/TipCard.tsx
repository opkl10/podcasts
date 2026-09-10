'use client';

import React from 'react';
import { TipCardConfig } from './overlayTypes';

interface TipCardProps {
  config: TipCardConfig;
  className?: string;
}

const TYPE_STYLES: Record<string, { border: string; bg: string; icon: string; title: string }> = {
  tip: { border: 'border-cyan-500', bg: 'bg-cyan-950/80', icon: '💡', title: 'טיפ מקצועי' },
  spoiler: { border: 'border-amber-500', bg: 'bg-amber-950/80', icon: '⚠️', title: 'אזהרת ספוילר' },
  warning: { border: 'border-rose-500', bg: 'bg-rose-950/80', icon: '🚨', title: 'אזהרה' },
  note: { border: 'border-purple-500', bg: 'bg-purple-950/80', icon: '📝', title: 'הערה' },
  fun_fact: { border: 'border-emerald-500', bg: 'bg-emerald-950/80', icon: '🎲', title: 'עובדה מעניינת' },
};

export default function TipCard({ config, className = '' }: TipCardProps) {
  const style = TYPE_STYLES[config.type] || TYPE_STYLES.tip;

  return (
    <div
      className={`p-3.5 rounded-2xl backdrop-blur-xl border-r-4 border ${style.border} ${style.bg} shadow-2xl max-w-sm ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{style.icon}</span>
        <span className="text-xs font-black text-white">{config.title || style.title}</span>
      </div>
      <p className="text-xs font-medium text-slate-300 leading-relaxed">{config.text}</p>
    </div>
  );
}
