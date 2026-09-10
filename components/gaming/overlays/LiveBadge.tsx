import React from 'react';
import type { LiveBadgeConfig } from './overlayTypes';

interface LiveBadgeProps {
  config: LiveBadgeConfig;
  className?: string;
}

/**
 * LiveBadge — A pulsing LIVE indicator overlay for streaming sessions.
 * Shows a red pulse dot, "LIVE" text, and optional channel name.
 */
export const LiveBadge: React.FC<LiveBadgeProps> = ({ config, className = '' }) => {
  const { channelName } = config;

  return (
    <div
      className={[
        'inline-flex items-center gap-2.5 px-3 py-1.5',
        'rounded-full',
        'bg-black/70 backdrop-blur-sm',
        'border border-rose-500/40',
        'shadow-lg shadow-rose-900/30',
        className,
      ].join(' ')}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
      </span>

      {/* LIVE label */}
      <span className="text-xs font-black uppercase tracking-widest text-rose-400 leading-none">
        LIVE
      </span>

      {/* Divider + channel name */}
      {channelName && (
        <>
          <span className="h-3.5 w-px bg-white/20" />
          <span className="text-xs font-semibold tracking-wide text-white/80 leading-none">
            {channelName}
          </span>
        </>
      )}
    </div>
  );
};

export type { LiveBadgeConfig };
export default LiveBadge;
