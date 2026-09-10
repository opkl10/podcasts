'use client';

import React from 'react';
import { WatermarkConfig } from './overlayTypes';

interface WatermarkProps {
  config: WatermarkConfig;
  className?: string;
}

export default function Watermark({ config, className = '' }: WatermarkProps) {
  return (
    <div
      className={`text-xs font-mono font-bold tracking-wider text-slate-400 select-none ${className}`}
      style={{ opacity: (config.opacity ?? 40) / 100, color: config.color }}
    >
      {config.text}
    </div>
  );
}
