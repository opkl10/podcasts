'use client';

import React, { useState } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  MicOff, 
  Headphones, 
  Radio, 
  Activity, 
  Settings, 
  Sliders, 
  Wifi, 
  Users, 
  ChevronUp, 
  ChevronDown,
  Sparkles
} from 'lucide-react';

interface DiscordVoiceBarProps {
  // Host status
  isHostSpeaking: boolean;
  isHostMuted: boolean;
  onToggleHostMute: () => void;
  hostAudioLevel: number;
  
  // Co-Host / Guest status
  guestName?: string;
  guestRole?: string;
  isCoHost?: boolean;
  guestStatus: 'idle' | 'connecting' | 'connected' | 'error';
  isGuestSpeaking: boolean;
  guestAudioLevel: number;
  guestVolume: number;
  onChangeGuestVolume: (vol: number) => void;
  
  // Actions
  onOpenAudioSettings: () => void;
  onOpenInviteModal?: () => void;
  onPlayTestTone?: () => void;
}

export default function DiscordVoiceBar({
  isHostSpeaking,
  isHostMuted,
  onToggleHostMute,
  hostAudioLevel,
  guestName,
  guestRole,
  isCoHost = true,
  guestStatus,
  isGuestSpeaking,
  guestAudioLevel,
  guestVolume,
  onChangeGuestVolume,
  onOpenAudioSettings,
  onOpenInviteModal,
  onPlayTestTone
}: DiscordVoiceBarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isConnected = guestStatus === 'connected';

  return (
    <div className="w-full bg-[#11131c]/95 border border-[#1f2333] rounded-2xl shadow-2xl p-3 sm:p-4 text-white font-sans backdrop-blur-xl transition-all">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          {/* Status Dot */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isConnected 
                ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-500' 
                : guestStatus === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-slate-500'
            }`} />
            <span className="text-[11px] font-bold text-slate-300">
              {isConnected 
                ? '🟢 ערוץ קולי מחובר (Discord P2P Voice)' 
                : guestStatus === 'connecting'
                ? '🟡 מתחבר לערוץ קולי...'
                : '⚪ ממתין להתחברות השותפ/ה'}
            </span>
          </div>

          {isConnected && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <Wifi className="w-3 h-3" />
              <span>שיהוי נמוך (P2P Duplex)</span>
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {onPlayTestTone && (
            <button
              type="button"
              onClick={onPlayTestTone}
              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-bold text-cyan-300 hover:text-white flex items-center gap-1 transition-all active:scale-95"
              title="בדיקת צליל אולפני באוזניות"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline">צליל מבחן</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAudioSettings}
            className="px-2.5 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[11px] font-bold text-cyan-300 hover:text-white flex items-center gap-1 transition-all active:scale-95"
            title="מרכז הגדרות סאונד מלא"
          >
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">הגדרות סאונד</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isCollapsed ? 'פתח בר צ׳אט קולי' : 'צמצם בר צ׳אט קולי'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Voice Channel Roster */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
          {/* USER 1: Studio Host (You) */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* Host Avatar with Discord Green Speaking Glow */}
              <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-gradient-to-tr from-indigo-600 to-violet-500 transition-all duration-150 ${
                  isHostSpeaking
                    ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-emerald-500/40 scale-105'
                    : 'border-2 border-slate-700'
                }`}>
                  🎙️
                </div>
                {/* Speaking Wave Indicator */}
                {isHostSpeaking && (
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-black"></span>
                  </span>
                )}
              </div>

              {/* Host Info */}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">אתה (מארח האולפן)</span>
                  {isHostSpeaking && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                      מדבר...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>שידור חי יוצא</span>
                </div>
              </div>
            </div>

            {/* Host Mute Button */}
            <button
              type="button"
              onClick={onToggleHostMute}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                isHostMuted
                  ? 'bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-900/30'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={isHostMuted ? 'בטל השתקת המיקרופון שלך' : 'השתק את המיקרופון שלך'}
            >
              {isHostMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          </div>

          {/* USER 2: Co-Host / Remote Guest */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Guest Avatar with Discord Green Speaking Glow */}
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-gradient-to-tr from-emerald-600 to-teal-500 transition-all duration-150 ${
                    isGuestSpeaking && isConnected
                      ? 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-slate-950 shadow-lg shadow-emerald-500/40 scale-105'
                      : 'border-2 border-slate-700'
                  }`}>
                    {isConnected ? '👥' : '⏳'}
                  </div>
                  {/* Speaking Wave Indicator */}
                  {isGuestSpeaking && isConnected && (
                    <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-black"></span>
                    </span>
                  )}
                </div>

                {/* Guest Info */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">
                      {guestName || (isCoHost ? 'מנחה שותפ/ה' : 'אורח/ת')}
                    </span>
                    {isConnected && isGuestSpeaking && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                        מדבר/ת...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span>{isConnected ? 'מחובר/ת בצ׳אט קולי' : 'טרם התחבר/ה'}</span>
                  </div>
                </div>
              </div>

              {/* Connect / Invite action if not connected */}
              {!isConnected && onOpenInviteModal && (
                <button
                  type="button"
                  onClick={onOpenInviteModal}
                  className="px-2.5 py-1 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition-all active:scale-95"
                >
                  הזמן לשידור
                </button>
              )}
            </div>

            {/* Discord-Style User Volume Slider (0% - 200%) */}
            {isConnected && (
              <div className="pt-2 border-t border-slate-800/60 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangeGuestVolume(guestVolume === 0 ? 1.0 : 0)}
                  className={`p-1 rounded-lg transition-colors ${
                    guestVolume === 0 ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 hover:text-white'
                  }`}
                  title={guestVolume === 0 ? 'בטל השתקת שותפ/ה' : 'השתק שותפ/ה (Deafen)'}
                >
                  {guestVolume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={guestVolume}
                    onChange={(e) => onChangeGuestVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg accent-emerald-400 cursor-pointer"
                    title={`ווליום שותפ/ה: ${Math.round(guestVolume * 100)}%`}
                  />
                  <span className="font-mono text-[10px] font-bold text-emerald-400 w-10 text-left">
                    {Math.round(guestVolume * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
