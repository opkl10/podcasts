import React from 'react';
import type { AchievementConfig } from './overlayTypes';

interface AchievementPopupProps {
  config: AchievementConfig;
  className?: string;
}

/**
 * AchievementPopup — Xbox/PlayStation-style achievement unlock notification.
 * Gold/amber themed with icon, title, and optional description.
 * Uses animate-bounce for entrance energy; parent can control mount/unmount
 * timing for full show/hide sequencing.
 */
export const AchievementPopup: React.FC<AchievementPopupProps> = ({
  config,
  className = '',
}) => {
  const { title, description, icon = '🏆' } = config;

  return (
    <div
      className={[
        'relative inline-flex items-center gap-3',
        'pl-2 pr-5 py-2',
        'rounded-xl overflow-hidden',
        'bg-black/80 backdrop-blur-md',
        'border border-amber-500/50',
        'shadow-2xl shadow-amber-900/40',
        'animate-bounce',
        className,
      ].join(' ')}
    >
      {/* Left gold accent bar */}
      <div className="absolute left-0 inset-y-0 w-1 bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-600 rounded-l-xl" />

      {/* Icon medallion */}
      <div
        className={[
          'relative ml-1 flex h-11 w-11 shrink-0 items-center justify-center',
          'rounded-lg',
          'bg-gradient-to-br from-amber-400/30 to-yellow-600/20',
          'border border-amber-400/40',
          'shadow-inner',
        ].join(' ')}
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-lg bg-amber-400/10 animate-pulse" />
        <span className="relative text-2xl leading-none select-none" role="img" aria-label="achievement icon">
          {icon}
        </span>
      </div>

      {/* Text content */}
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Header row */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/80 leading-none">
            Achievement Unlocked
          </span>
          <span className="text-[9px] text-amber-300/50">✦</span>
        </div>

        {/* Title */}
        <span className="text-sm font-black text-white leading-tight truncate">
          {title}
        </span>

        {/* Description */}
        {description && (
          <span className="text-[11px] font-medium text-white/55 leading-snug line-clamp-1">
            {description}
          </span>
        )}
      </div>

      {/* Corner shimmer accent */}
      <div className="absolute top-0 right-0 h-8 w-8 bg-gradient-to-bl from-amber-300/20 to-transparent rounded-tr-xl pointer-events-none" />
    </div>
  );
};

export type { AchievementConfig };
export default AchievementPopup;
