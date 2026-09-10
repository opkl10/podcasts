import React from 'react';
import type { GameTitleConfig } from './overlayTypes';

interface GameTitleCardProps {
  config: GameTitleConfig;
  className?: string;
}

/**
 * GameTitleCard — Cinematic "Now Playing" game title reveal card.
 * Purple/cyan gradient header, bold game title, and metadata pills for
 * genre, year, and platform.
 */
export const GameTitleCard: React.FC<GameTitleCardProps> = ({ config, className = '' }) => {
  const { title, genre, year, platform } = config;

  const pills = [
    genre && { label: genre, colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
    year && { label: year, colorClass: 'bg-white/10 text-white/60 border-white/15' },
    platform && { label: platform, colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  ].filter(Boolean) as { label: string; colorClass: string }[];

  return (
    <div
      className={[
        'relative inline-flex flex-col overflow-hidden',
        'rounded-2xl',
        'bg-black/80 backdrop-blur-md',
        'border border-white/10',
        'shadow-2xl shadow-black/60',
        'min-w-[220px] max-w-sm',
        className,
      ].join(' ')}
    >
      {/* Gradient header bar */}
      <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400" />

      {/* Content */}
      <div className="px-4 py-3 flex flex-col gap-2">
        {/* Eyebrow label */}
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/35 leading-none">
          Now Playing
        </span>

        {/* Game title */}
        <h2 className="text-xl font-black text-white leading-tight tracking-tight">
          {title}
        </h2>

        {/* Metadata pills */}
        {pills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {pills.map(({ label, colorClass }) => (
              <span
                key={label}
                className={[
                  'inline-flex items-center px-2 py-0.5',
                  'rounded-full text-[10px] font-bold uppercase tracking-wide',
                  'border',
                  colorClass,
                ].join(' ')}
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Decorative corner glow */}
      <div className="absolute top-0 right-0 h-16 w-16 rounded-bl-full bg-gradient-to-bl from-purple-500/15 to-transparent pointer-events-none" />
    </div>
  );
};

export type { GameTitleConfig };
export default GameTitleCard;
