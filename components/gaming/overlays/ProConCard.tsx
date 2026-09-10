'use client';

import React from 'react';
import { ProConConfig } from './overlayTypes';

interface ProConProps {
  config: ProConConfig;
  className?: string;
}

export default function ProConCard({ config, className = '' }: ProConProps) {
  return (
    <div
      className={`p-4 rounded-3xl bg-slate-950/90 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-3 min-w-[280px] ${className}`}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      {config.title && (
        <h4 className="text-xs font-black uppercase tracking-wider text-purple-400 text-center pb-2 border-b border-slate-800">
          {config.title}
        </h4>
      )}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Pros */}
        <div className="space-y-1.5">
          <span className="font-bold text-emerald-400 block pb-1">פרוס (PROS)</span>
          {config.pros.slice(0, 4).map((pro, i) => (
            <div key={i} className="flex items-start gap-1 text-slate-300">
              <span className="text-emerald-400 shrink-0">✓</span>
              <span className="leading-tight">{pro}</span>
            </div>
          ))}
        </div>

        {/* Cons */}
        <div className="space-y-1.5 border-r border-slate-800 pr-3">
          <span className="font-bold text-rose-400 block pb-1">קונטרס (CONS)</span>
          {config.cons.slice(0, 4).map((con, i) => (
            <div key={i} className="flex items-start gap-1 text-slate-300">
              <span className="text-rose-400 shrink-0">✗</span>
              <span className="leading-tight">{con}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
