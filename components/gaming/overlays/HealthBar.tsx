import React from 'react';
import type { HealthBarConfig } from './overlayTypes';

interface HealthBarProps {
  config: HealthBarConfig;
  className?: string;
}

/**
 * Derives the fill color class and glow color based on the current HP value.
 * > 60%  → emerald (healthy)
 * 30–60% → amber   (warning)
 * < 30%  → rose    (critical)
 */
function resolveBarTheme(value: number): {
  fillClass: string;
  glowClass: string;
  pulseClass: string;
} {
  if (value > 60) {
    return {
      fillClass: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
      glowClass: 'shadow-[0_0_8px_2px_rgba(16,185,129,0.5)]',
      pulseClass: '',
    };
  }
  if (value > 30) {
    return {
      fillClass: 'bg-gradient-to-r from-amber-500 to-yellow-400',
      glowClass: 'shadow-[0_0_8px_2px_rgba(245,158,11,0.5)]',
      pulseClass: '',
    };
  }
  return {
    fillClass: 'bg-gradient-to-r from-rose-600 to-red-400',
    glowClass: 'shadow-[0_0_10px_3px_rgba(244,63,94,0.6)]',
    pulseClass: 'animate-pulse',
  };
}

/**
 * HealthBar — HUD-style health/resource bar overlay.
 * Color transitions automatically from green → amber → red as value drops.
 * Clamps value between 0–100.
 */
export const HealthBar: React.FC<HealthBarProps> = ({ config, className = '' }) => {
  const { label = 'HP', value, showValue = true } = config;
  const clampedValue = Math.min(100, Math.max(0, value));
  const { fillClass, glowClass, pulseClass } = resolveBarTheme(clampedValue);

  return (
    <div
      className={[
        'inline-flex flex-col gap-1 min-w-[160px]',
        'px-3 py-2 rounded-lg',
        'bg-black/75 backdrop-blur-sm',
        'border border-white/10',
        'shadow-lg shadow-black/30',
        className,
      ].join(' ')}
    >
      {/* Header row: label + value */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50 leading-none">
          {label}
        </span>
        {showValue && (
          <span
            className={[
              'text-[10px] font-bold tabular-nums leading-none',
              clampedValue > 60
                ? 'text-emerald-400'
                : clampedValue > 30
                ? 'text-amber-400'
                : 'text-rose-400',
              pulseClass,
            ].join(' ')}
          >
            {clampedValue}%
          </span>
        )}
      </div>

      {/* Bar track */}
      <div className="relative h-3 w-full rounded-full bg-white/10 overflow-hidden">
        {/* Notch marks */}
        {[25, 50, 75].map((notch) => (
          <div
            key={notch}
            className="absolute top-0 bottom-0 w-px bg-black/40 z-10"
            style={{ left: `${notch}%` }}
          />
        ))}

        {/* Fill bar */}
        <div
          className={[
            'h-full rounded-full transition-all duration-500 ease-out',
            fillClass,
            glowClass,
            pulseClass,
          ].join(' ')}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};

export type { HealthBarConfig };
export default HealthBar;
