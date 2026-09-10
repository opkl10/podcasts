'use client';

import React from 'react';
import { ReviewScoreConfig } from './overlayTypes';

interface ReviewScoreProps {
  config: ReviewScoreConfig;
  className?: string;
}

export default function ReviewScore({ config, className = '' }: ReviewScoreProps) {
  const max = config.maxScore || 10;
  const score = Math.min(config.score, max);
  const starsCount = 5;
  const filledStars = Math.round((score / max) * starsCount);

  return (
    <div
      className={`flex flex-col items-center justify-center p-4 rounded-3xl bg-slate-950/90 backdrop-blur-xl border border-amber-500/40 shadow-2xl ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      {config.label && (
        <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider mb-1">
          {config.label}
        </span>
      )}
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-black text-white tracking-tight">{score}</span>
        <span className="text-sm font-bold text-slate-500">/{max}</span>
      </div>
      {config.showStars !== false && (
        <div className="flex items-center gap-1 mt-1.5 text-amber-400 text-sm">
          {Array.from({ length: starsCount }).map((_, i) => (
            <span key={i} className={i < filledStars ? 'text-amber-400' : 'text-slate-700'}>
              ★
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
