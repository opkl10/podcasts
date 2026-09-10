'use client';

import React from 'react';
import { SocialBarConfig } from './overlayTypes';

interface SocialBarProps {
  config: SocialBarConfig;
  className?: string;
}

export default function SocialBar({ config, className = '' }: SocialBarProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-slate-800 shadow-2xl ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      {config.handles.map((h, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <span className="text-purple-400 font-black uppercase text-[10px] px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800">
            {h.platform}
          </span>
          <span>{h.handle}</span>
        </div>
      ))}
    </div>
  );
}
