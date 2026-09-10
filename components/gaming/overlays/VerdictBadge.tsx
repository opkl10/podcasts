'use client';

import React from 'react';
import { VerdictConfig } from './overlayTypes';

interface VerdictProps {
  config: VerdictConfig;
  className?: string;
}

const VERDICT_STYLES: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  MASTERPIECE: { bg: 'bg-amber-950/90', border: 'border-amber-500', text: 'text-amber-300', emoji: '🏆' },
  EXCELLENT: { bg: 'bg-emerald-950/90', border: 'border-emerald-500', text: 'text-emerald-300', emoji: '💎' },
  GOOD: { bg: 'bg-emerald-950/80', border: 'border-emerald-600', text: 'text-emerald-400', emoji: '👍' },
  RECOMMENDED: { bg: 'bg-cyan-950/90', border: 'border-cyan-500', text: 'text-cyan-300', emoji: '⭐' },
  AVERAGE: { bg: 'bg-slate-900/90', border: 'border-slate-600', text: 'text-slate-300', emoji: '⚖️' },
  SKIP: { bg: 'bg-orange-950/90', border: 'border-orange-500', text: 'text-orange-300', emoji: '⚠️' },
  AVOID: { bg: 'bg-rose-950/90', border: 'border-rose-600', text: 'text-rose-300', emoji: '🚫' },
  TRASH: { bg: 'bg-rose-950/95', border: 'border-rose-500', text: 'text-rose-400', emoji: '🗑️' },
};

export default function VerdictBadge({ config, className = '' }: VerdictProps) {
  const style = VERDICT_STYLES[config.verdict] || VERDICT_STYLES.RECOMMENDED;

  return (
    <div
      className={`p-4 rounded-3xl backdrop-blur-xl border ${style.bg} ${style.border} shadow-2xl flex flex-col items-center text-center ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{style.emoji}</span>
        <span className={`text-lg font-black tracking-wider ${style.text}`}>{config.verdict}</span>
      </div>
      {config.subtitle && (
        <span className="text-xs font-bold text-slate-300 mt-1">{config.subtitle}</span>
      )}
    </div>
  );
}
