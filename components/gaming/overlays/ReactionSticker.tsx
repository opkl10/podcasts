import React from 'react';
import type { ReactionConfig } from './overlayTypes';

interface ReactionStickerProps {
  config: ReactionConfig;
  className?: string;
}

/**
 * Per-reaction theme: text color, outline/stroke color, and background glow.
 * Designed to feel like authentic esports/gaming stream stickers.
 */
const REACTION_THEMES: Record<
  ReactionConfig['reaction'],
  { textClass: string; glowClass: string; bgClass: string; emoji: string }
> = {
  GG: {
    textClass: 'text-emerald-400',
    glowClass: 'drop-shadow-[0_0_12px_rgba(16,185,129,0.9)]',
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
    emoji: '🤝',
  },
  EZ: {
    textClass: 'text-cyan-300',
    glowClass: 'drop-shadow-[0_0_12px_rgba(6,182,212,0.9)]',
    bgClass: 'bg-cyan-500/10 border-cyan-500/30',
    emoji: '😎',
  },
  RAGE: {
    textClass: 'text-rose-500',
    glowClass: 'drop-shadow-[0_0_16px_rgba(244,63,94,1)]',
    bgClass: 'bg-rose-500/10 border-rose-500/30',
    emoji: '😤',
  },
  LOL: {
    textClass: 'text-yellow-300',
    glowClass: 'drop-shadow-[0_0_12px_rgba(253,224,71,0.9)]',
    bgClass: 'bg-yellow-400/10 border-yellow-400/30',
    emoji: '😂',
  },
  WTF: {
    textClass: 'text-fuchsia-400',
    glowClass: 'drop-shadow-[0_0_12px_rgba(232,121,249,0.9)]',
    bgClass: 'bg-fuchsia-500/10 border-fuchsia-500/30',
    emoji: '😱',
  },
  GJ: {
    textClass: 'text-amber-400',
    glowClass: 'drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    emoji: '👏',
  },
  NOOB: {
    textClass: 'text-orange-400',
    glowClass: 'drop-shadow-[0_0_12px_rgba(251,146,60,0.9)]',
    bgClass: 'bg-orange-500/10 border-orange-500/30',
    emoji: '🐣',
  },
  CLUTCH: {
    textClass: 'text-purple-400',
    glowClass: 'drop-shadow-[0_0_16px_rgba(168,85,247,1)]',
    bgClass: 'bg-purple-500/10 border-purple-500/30',
    emoji: '🎯',
  },
  FAIL: {
    textClass: 'text-red-500',
    glowClass: 'drop-shadow-[0_0_16px_rgba(239,68,68,1)]',
    bgClass: 'bg-red-500/10 border-red-500/30',
    emoji: '💀',
  },
  WIN: {
    textClass: 'text-amber-300',
    glowClass: 'drop-shadow-[0_0_16px_rgba(245,158,11,1)]',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    emoji: '🏆',
  },
};

/**
 * ReactionSticker — Bold gaming reaction sticker overlay.
 * Each reaction has a unique neon-glow color theme.
 * Text uses a heavy outlined/sticker look via multiple text-shadow layers.
 */
export const ReactionSticker: React.FC<ReactionStickerProps> = ({
  config,
  className = '',
}) => {
  const { reaction } = config;
  const theme = REACTION_THEMES[reaction];

  return (
    <div
      className={[
        'inline-flex flex-col items-center gap-1',
        'px-4 py-2.5 rounded-2xl',
        'bg-black/70 backdrop-blur-sm',
        'border',
        theme.bgClass,
        'shadow-xl shadow-black/50',
        className,
      ].join(' ')}
    >
      {/* Emoji accent */}
      <span className="text-xl leading-none select-none" role="img" aria-label={reaction}>
        {theme.emoji}
      </span>

      {/* Main reaction text — outlined sticker style */}
      <span
        className={[
          'text-5xl font-black uppercase leading-none tracking-tight select-none',
          theme.textClass,
          theme.glowClass,
          // Paint-order stroke simulation via multiple shadows
          '[text-shadow:_-2px_-2px_0_#000,_2px_-2px_0_#000,_-2px_2px_0_#000,_2px_2px_0_#000,_0_0_20px_currentColor]',
        ].join(' ')}
      >
        {reaction}
      </span>
    </div>
  );
};

export type { ReactionConfig };
export default ReactionSticker;
