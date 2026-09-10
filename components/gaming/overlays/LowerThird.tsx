'use client';

import React from 'react';
import { LowerThirdConfig } from './overlayTypes';

interface LowerThirdProps {
  config: LowerThirdConfig;
  className?: string;
}

export default function LowerThird({ config, className = '' }: LowerThirdProps) {
  const accentColor = config.color || '#a855f7';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-950/90 backdrop-blur-md border border-slate-800 p-4 shadow-2xl transition-all duration-300 ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      <div
        className="absolute top-0 bottom-0 right-0 w-1.5 rounded-r-full"
        style={{ backgroundColor: accentColor }}
      />
      <div className="pr-3">
        <h4 className="text-lg font-black text-white tracking-wide">{config.name}</h4>
        {config.title && (
          <p className="text-xs font-bold text-slate-400 mt-0.5">{config.title}</p>
        )}
      </div>
    </div>
  );
}
