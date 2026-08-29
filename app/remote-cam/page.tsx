'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RemoteCameraSender } from '@/lib/webrtcClient';
import { 
  Camera, 
  SwitchCamera, 
  Mic, 
  MicOff, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  Video,
  Smartphone,
  Sparkles,
  Lock,
  Play,
  RotateCcw,
  Info,
  Radio,
  RefreshCw
} from 'lucide-react';

function RemoteCamContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || 'default-room';

  const videoRef = useRef<HTMLVideoElement>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'connected' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('לחצו על הכפתור למטה להפעלת המצלמה');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [sender, setSender] = useState<RemoteCameraSender | null>(null);
  const [isStarted, setIsStarted] = useState(false);

  // Initialize camera on user tap
  const startCamera = async (facing: 'environment' | 'user') => {
    setErrorDetails('');
    setStatus('waiting');
    setStatusMsg('מבקש גישה למצלמת האייפון...');

    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }

      // Check MediaDevices support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('הדפדפן אינו מאפשר גישה למצלמה. ודא שהקישור נפתח ב-HTTPS (מאובטח) ב-Safari.');
      }

      // Attempt 1: 4K UHD / Full HD video + high quality audio
      let newStream: MediaStream | null = null;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: facing },
            width: { ideal: 3840, min: 1920 },
            height: { ideal: 2160, min: 1080 },
            frameRate: { ideal: 60, min: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: { ideal: 48000 }
          }
        });
      } catch (err1) {
        // Attempt 2: 1080p standard
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: { ideal: facing },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: true
          });
        } catch (err2) {
          // Attempt 3: Flexible video only
          try {
            newStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facing }
            });
          } catch (err3) {
            // Attempt 4: Any camera device
            newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }
      }

      if (!newStream) {
        throw new Error('לא ניתן היה לקבל זרם וידאו מהמצלמה');
      }

      setStream(newStream);
      setIsStarted(true);
      setStatus('connected');
      setStatusMsg('מחובר ומשדר לאולפן בשידור חי!');

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Autoplay handled:', playErr);
        }
      }

      // 1. WebRTC sender
      const rtcSender = new RemoteCameraSender(roomId, (newStatus, msg) => {
        if (newStatus === 'connected') {
          setStatus('connected');
          if (msg) setStatusMsg(msg);
        }
      });
      setSender(rtcSender);
      await rtcSender.start(newStream);

      // 2. Continuous Live Frame Relay (Guaranteed stream via HTTPS)
      const offscreenCanvas = document.createElement('canvas');
      const ctx = offscreenCanvas.getContext('2d');
      offscreenCanvas.width = 640;
      offscreenCanvas.height = 360;

      frameIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        try {
          ctx?.drawImage(videoRef.current, 0, 0, 640, 360);
          const base64Data = offscreenCanvas.toDataURL('image/jpeg', 0.55);
          
          await fetch('/api/signaling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'push-frame',
              roomId,
              frame: base64Data
            })
          });
        } catch (e) {}
      }, 120);

    } catch (err: any) {
      console.error('Camera access error:', err);
      setStatus('error');
      const msg = err.message || err.name || 'שגיאה לא ידועה';
      setStatusMsg('שגיאה בהפעלת המצלמה');
      setErrorDetails(msg);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (sender) {
        sender.stop();
      }
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [roomId]);

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const toggleMute = () => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioMuted(!audioTrack.enabled);
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col justify-between select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <div className="z-20 flex items-center justify-between px-5 py-4 bg-gradient-to-b from-black/90 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-wide">CastFlow iPhone Live Cam</h1>
            <p className="text-[10px] text-slate-400">חדר: {roomId}</p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div>
          {status === 'connected' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold shadow-lg">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              משדר לאולפן (LIVE)
            </div>
          ) : status === 'waiting' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              מתחבר...
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-bold">
              <AlertCircle className="w-3.5 h-3.5" />
              שגיאה
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs">
              מוכן להפעלה
            </div>
          )}
        </div>
      </div>

      {/* Main Video Area */}
      <div className="relative flex-1 w-full h-full flex flex-col items-center justify-center bg-zinc-950 overflow-hidden px-4 text-center">
        {isStarted ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />

            {/* Status overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-xs text-slate-200 pointer-events-none flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{statusMsg}</span>
            </div>
          </>
        ) : (
          <div className="max-w-sm space-y-5 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
              <Video className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-base font-bold text-white">חיבור מצלמת iPhone לאולפן</h2>
              <p className="text-xs text-slate-400 mt-1">
                לחצו על הכפתור למטה ואשרו גישה למצלמה בדפדפן.
              </p>
            </div>

            {/* Display error if occurred */}
            {status === 'error' && errorDetails && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-[11px] text-right space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  פירוט השגיאה:
                </p>
                <p className="text-slate-300 font-mono text-[10px] break-all">{errorDetails}</p>
                <p className="text-slate-400 pt-1">ודא שהאתר נפתח ב-HTTPS ואושרה הרשאת מצלמה בהגדרות Safari.</p>
              </div>
            )}

            <button
              onClick={() => startCamera(facingMode)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{status === 'error' ? 'נסה שוב כעת' : 'הפעל מצלמה ושידור עכשיו'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Control Toolbar */}
      {isStarted && (
        <div className="z-20 flex items-center justify-around px-6 py-6 bg-gradient-to-t from-black via-black/80 to-transparent">
          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className={`p-4 rounded-full text-white transition-all shadow-lg active:scale-95 ${
              isAudioMuted ? 'bg-rose-600' : 'bg-white/20 backdrop-blur-md hover:bg-white/30'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* Camera Info */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-red-500 bg-red-600/20">
              <Video className="w-6 h-6 text-red-500 animate-pulse" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              {facingMode === 'environment' ? 'מצלמה אחורית (HD)' : 'מצלמת סלפי'}
            </span>
          </div>

          {/* Switch Camera Button */}
          <button
            onClick={toggleFacingMode}
            className="p-4 rounded-full bg-white/20 backdrop-blur-md hover:bg-white/30 text-white transition-all shadow-lg active:scale-95"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function RemoteCamPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-white">טוען מצלמת אייפון...</div>}>
      <RemoteCamContent />
    </Suspense>
  );
}
