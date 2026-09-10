'use client';

import React from 'react';
import { RatingMeterConfig } from './overlayTypes';

interface RatingMeterProps {
  config: RatingMeterConfig;
  className?: string;
}

export default function RatingMeter({ config, className = '' }: RatingMeterProps) {
  const val = Math.max(0, Math.min(100, config.value));
  const color = config.color || '#06b6d4';

  return (
    <div
      className={`p-3 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-slate-800 shadow-2xl min-w-[200px] space-y-1.5 ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      <div className="flex items-center justify-between text-xs font-bold">
        <span className="text-slate-300">{config.label || 'מד דירוג'}</span>
        <span className="font-mono text-cyan-400">{val}%</span>
      </div>
      <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${val}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
