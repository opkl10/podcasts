'use client';

import React, { useState, useEffect, useRef } from 'react';
import { YouTubeChatConfig } from './overlayTypes';

interface YouTubeLiveChatProps {
  config: YouTubeChatConfig;
  className?: string;
}

interface ChatMsg {
  id: string;
  username: string;
  message: string;
  badge?: string;
  superChatAmount?: string;
  avatarColor: string;
  time: string;
}

const INITIAL_MESSAGES: ChatMsg[] = [
  { id: '1', username: 'Matan_Gamer', message: 'בהצלחה בשידור החי! 🔥', badge: 'Member', avatarColor: 'bg-emerald-500', time: '19:30' },
  { id: '2', username: 'Dana_Plays', message: 'איזה איכות מטורפת ב-60FPS!', badge: 'VIP', avatarColor: 'bg-purple-500', time: '19:31' },
  { id: '3', username: 'Alex_Pro', message: 'תעשה את המשימה הצדדית קודם', avatarColor: 'bg-cyan-500', time: '19:31' },
  { id: '4', username: 'GamingBoss', message: 'שחקן מעולה! קבל סופר צ׳אט 💪', badge: 'SuperChat', superChatAmount: '₪20.00', avatarColor: 'bg-amber-500', time: '19:32' },
];

export default function YouTubeLiveChat({ config, className = '' }: YouTubeLiveChatProps) {
  const [messages] = useState<ChatMsg[]>(INITIAL_MESSAGES);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoId = config.videoId ? config.videoId.trim() : '';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const cleanVideoId = videoId.replace(/(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|live\/)|youtu\.be\/)/, '').split('&')[0];

  return (
    <div
      className={`w-72 sm:w-80 rounded-2xl overflow-hidden border border-red-500/40 shadow-2xl bg-slate-950/90 backdrop-blur-md flex flex-col ${className}`}
      style={{
        opacity: (config.opacity ?? 100) / 100,
        height: '320px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-950 border-b border-red-500/30">
        <div className="flex items-center gap-1.5">
          <svg className="w-4 h-4 fill-red-500" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span className="text-xs font-black text-white">{config.title || 'YouTube Live Chat'}</span>
        </div>
        <span className="text-[9px] font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-800/80 flex items-center gap-1 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span>LIVE</span>
        </span>
      </div>

      {/* Embedded YouTube Chat or Live Stream Message List */}
      {cleanVideoId ? (
        <div className="flex-1 w-full relative bg-black/60">
          <iframe
            src={`https://www.youtube.com/live_chat?v=${cleanVideoId}&embed_domain=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`}
            className="w-full h-full border-0"
            title="YouTube Live Chat Embed"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 p-2.5 space-y-2 overflow-y-auto font-sans text-xs scrollbar-thin scrollbar-thumb-slate-700"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-2 rounded-xl border transition-all ${
                m.superChatAmount
                  ? 'bg-amber-950/50 border-amber-500/50 text-amber-200 shadow-sm'
                  : 'bg-slate-900/70 border-slate-800/80 text-slate-200'
              }`}
            >
              {m.superChatAmount && (
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-amber-500/30 text-[10px] font-black text-amber-300">
                  <span>💰 סופר צ׳אט</span>
                  <span>{m.superChatAmount}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`w-4 h-4 rounded-full ${m.avatarColor} text-[9px] font-black text-white flex items-center justify-center`}>
                  {m.username.charAt(0).toUpperCase()}
                </span>
                <span className="font-bold text-white text-[11px]">{m.username}</span>
                {m.badge && (
                  <span className={`text-[8px] font-black px-1 rounded ${
                    m.badge === 'Member' ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40' :
                    m.badge === 'VIP' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' :
                    'bg-red-600/30 text-red-300 border border-red-500/40'
                  }`}>
                    {m.badge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-100 font-medium leading-relaxed pl-5">
                {m.message}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
