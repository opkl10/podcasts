import React, { useMemo } from 'react';
import type { SessionTimerConfig } from './overlayTypes';

interface SessionTimerProps {
  config: SessionTimerConfig;
  className?: string;
}

/**
 * Formats a total number of seconds into HH:MM:SS string.
 */
function formatTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * SessionTimer — Digital clock overlay displaying elapsed or countdown time.
 * Reads `elapsedSeconds` from config; parent is responsible for updating it.
 * Displays in HH:MM:SS monospace format with a cyan/purple glass card.
 */
export const SessionTimer: React.FC<SessionTimerProps> = ({ config, className = '' }) => {
  const { mode, elapsedSeconds = 0, targetSeconds = 0 } = config;

  const displaySeconds = useMemo(() => {
    if (mode === 'countdown') {
      return Math.max(0, targetSeconds - elapsedSeconds);
    }
    return elapsedSeconds;
  }, [mode, elapsedSeconds, targetSeconds]);

  const timeString = formatTime(displaySeconds);
  const isCountdownCritical =
    mode === 'countdown' && displaySeconds <= 10 && displaySeconds > 0;
  const isCountdownDone = mode === 'countdown' && displaySeconds === 0;

  // Split the time string into segments for individual digit styling
  const [hh, mm, ss] = timeString.split(':');

  return (
    <div
      className={[
        'inline-flex flex-col items-center gap-1',
        'px-4 py-2.5 rounded-xl',
        'bg-black/75 backdrop-blur-md',
        'border border-white/10',
        'shadow-xl shadow-black/40',
        className,
      ].join(' ')}
    >
      {/* Mode label */}
      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40 leading-none">
        {mode === 'countdown' ? '⏳ COUNTDOWN' : '⏱ SESSION'}
      </span>

      {/* Time display */}
      <div
        className={[
          'flex items-center gap-0.5 font-mono font-black tabular-nums',
          isCountdownDone
            ? 'text-rose-400 animate-pulse'
            : isCountdownCritical
            ? 'text-amber-400 animate-pulse'
            : mode === 'countdown'
            ? 'text-cyan-300'
            : 'text-white',
        ].join(' ')}
      >
        <TimeSegment value={hh} />
        <Colon />
        <TimeSegment value={mm} />
        <Colon />
        <TimeSegment
          value={ss}
          highlight={isCountdownCritical || isCountdownDone}
        />
      </div>

      {/* Cyan underline accent */}
      <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent" />
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TimeSegmentProps {
  value: string;
  highlight?: boolean;
}

const TimeSegment: React.FC<TimeSegmentProps> = ({ value, highlight = false }) => (
  <span
    className={[
      'text-3xl leading-none tracking-tight',
      highlight ? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : '',
    ].join(' ')}
  >
    {value}
  </span>
);

const Colon: React.FC = () => (
  <span className="text-3xl leading-none text-white/30 -mx-0.5 pb-1 select-none">:</span>
);

export type { SessionTimerConfig };
export default SessionTimer;
