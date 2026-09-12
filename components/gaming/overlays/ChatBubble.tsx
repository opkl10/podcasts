import React from 'react';
import type { ChatBubbleConfig } from './overlayTypes';

interface ChatBubbleProps {
  config: ChatBubbleConfig;
  className?: string;
}

/**
 * Derives a deterministic Tailwind color class from a username string
 * so each chatter gets a consistent accent color.
 */
const AVATAR_COLORS = [
  'bg-purple-500',
  'bg-cyan-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-teal-500',
] as const;

const TEXT_COLORS = [
  'text-purple-400',
  'text-cyan-400',
  'text-emerald-400',
  'text-amber-400',
  'text-rose-400',
  'text-indigo-400',
  'text-pink-400',
  'text-teal-400',
] as const;

function deriveColorIndex(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return hash % AVATAR_COLORS.length;
}

/**
 * ChatBubble — Twitch/YouTube-style chat message overlay.
 * Shows avatar circle (first letter), bold colored username, and message text.
 * The speech-bubble tail is implemented with a CSS border triangle.
 */
export const ChatBubble: React.FC<ChatBubbleProps> = ({ config, className = '' }) => {
  const { username, message, avatarColor, badge } = config;

  const colorIdx = deriveColorIndex(username || 'Viewer');
  const avatarBg = avatarColor ? undefined : AVATAR_COLORS[colorIdx];
  const usernameColor = TEXT_COLORS[colorIdx];
  const avatarLetter = (username || 'V').charAt(0).toUpperCase();

  return (
    <div
      className={['inline-flex items-start gap-2.5 max-w-xs', className].join(' ')}
      style={{ opacity: (config.opacity ?? 100) / 100 }}
    >
      {/* Avatar */}
      <div
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center',
          'rounded-full text-white text-xs font-black uppercase',
          'shadow-md ring-2 ring-black/30',
          avatarBg ?? '',
        ].join(' ')}
        style={avatarColor ? { backgroundColor: avatarColor } : undefined}
      >
        {avatarLetter}
      </div>

      {/* Bubble body */}
      <div className="relative flex flex-col gap-0.5">
        {/* Speech tail */}
        <div className="absolute -left-1.5 top-2.5 h-0 w-0 border-y-4 border-y-transparent border-r-[6px] border-r-white/10" />

        <div
          className={[
            'px-3.5 py-2.5 rounded-2xl rounded-tl-sm',
            'bg-slate-950/90 backdrop-blur-md',
            'border border-slate-700/60 shadow-xl shadow-black/50',
          ].join(' ')}
        >
          {/* Header with Username and optional badge */}
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={['text-xs font-black leading-none', usernameColor].join(' ')}>
              {username || 'צופה'}
            </span>

            {badge && (
              <span className={`inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded ${
                badge === 'YouTube'
                  ? 'bg-red-950/90 text-red-300 border border-red-800/80'
                  : badge === 'Member'
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-800/80'
                  : badge === 'Mod'
                  ? 'bg-blue-950/90 text-blue-300 border border-blue-800/80'
                  : 'bg-purple-950/90 text-purple-300 border border-purple-800/80'
              }`}>
                {badge === 'YouTube' && (
                  <svg className="w-2.5 h-2.5 fill-red-400 shrink-0" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                )}
                <span>{badge}</span>
              </span>
            )}
          </div>

          {/* Message */}
          <p className="text-xs text-slate-100 font-medium leading-snug break-words">
            {message || 'הודעת צ׳אט'}
          </p>
        </div>
      </div>
    </div>
  );
};

export type { ChatBubbleConfig };
export default ChatBubble;
