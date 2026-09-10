'use client';

import React from 'react';
import { SceneLabelConfig } from './overlayTypes';

interface SceneLabelProps {
  config: SceneLabelConfig;
  className?: string;
}

export default function SceneLabel({ config, className = '' }: SceneLabelProps) {
  const color = config.color || '#a855f7';

  return (
    <div
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/90 backdrop-blur-md border border-slate-800 shadow-xl ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
      <span className="text-xs font-black tracking-widest uppercase text-white">{config.scene}</span>
    </div>
  );
}
