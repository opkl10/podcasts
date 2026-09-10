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
  const { username, message, avatarColor } = config;

  const colorIdx = deriveColorIndex(username);
  const avatarBg = avatarColor ? undefined : AVATAR_COLORS[colorIdx];
  const usernameColor = TEXT_COLORS[colorIdx];
  const avatarLetter = username.charAt(0).toUpperCase();

  return (
    <div className={['inline-flex items-start gap-2.5 max-w-xs', className].join(' ')}>
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
        {/* Speech tail (CSS triangle pointing left) */}
        <div className="absolute -left-1.5 top-2.5 h-0 w-0 border-y-4 border-y-transparent border-r-[6px] border-r-white/8" />

        <div
          className={[
            'px-3 py-2 rounded-2xl rounded-tl-sm',
            'bg-black/70 backdrop-blur-sm',
            'border border-white/10',
            'shadow-lg shadow-black/30',
          ].join(' ')}
        >
          {/* Username */}
          <span className={['text-xs font-black leading-none block mb-1', usernameColor].join(' ')}>
            {username}
          </span>

          {/* Message */}
          <p className="text-sm text-white/90 font-medium leading-snug break-words">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

export type { ChatBubbleConfig };
export default ChatBubble;
