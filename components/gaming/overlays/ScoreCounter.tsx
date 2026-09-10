import React from 'react';
import type { ScoreCounterConfig } from './overlayTypes';

interface ScoreCounterProps {
  config: ScoreCounterConfig;
  className?: string;
}

/**
 * ScoreCounter — Bold HUD-style score / kill counter overlay.
 * Displays a large number with optional icon emoji, label, and max value.
 * Accent color is customizable via config.color (defaults to purple).
 */
export const ScoreCounter: React.FC<ScoreCounterProps> = ({ config, className = '' }) => {
  const {
    label = 'SCORE',
    value,
    maxValue,
    icon,
    color = '#a855f7',
  } = config;

  const formatted = value.toLocaleString();
  const hasMax = maxValue !== undefined;

  return (
    <div
      className={[
        'inline-flex flex-col items-center gap-1',
        'px-5 py-3 rounded-2xl',
        'bg-black/75 backdrop-blur-md',
        'border border-white/10',
        'shadow-2xl shadow-black/50',
        className,
      ].join(' ')}
    >
      {/* Icon */}
      {icon && (
        <span
          className="text-2xl leading-none select-none"
          role="img"
          aria-label={label}
        >
          {icon}
        </span>
      )}

      {/* Label */}
      <span
        className="text-[9px] font-black uppercase tracking-[0.25em] leading-none"
        style={{ color }}
      >
        {label}
      </span>

      {/* Divider */}
      <div
        className="h-px w-8 rounded-full opacity-60"
        style={{ backgroundColor: color }}
      />

      {/* Primary number */}
      <div className="flex items-baseline gap-1">
        <span
          className="text-4xl font-black tabular-nums leading-none tracking-tight"
          style={{ color }}
        >
          {formatted}
        </span>

        {hasMax && (
          <span className="text-sm font-bold text-white/30 leading-none tabular-nums">
            /{maxValue!.toLocaleString()}
          </span>
        )}
      </div>

      {/* Bottom glow strip */}
      <div
        className="h-0.5 w-full rounded-full opacity-50"
        style={{
          background: `linear-gradient(to right, transparent, ${color}, transparent)`,
        }}
      />
    </div>
  );
};

export type { ScoreCounterConfig };
export default ScoreCounter;
