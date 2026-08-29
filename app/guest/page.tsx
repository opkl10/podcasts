'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Camera, 
  RotateCcw, 
  Radio, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  Headphones, 
  User, 
  Briefcase, 
  Settings, 
  Activity, 
  Wifi, 
  PhoneOff, 
  Maximize2
} from 'lucide-react';

function GuestBroadcastContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || 'guest_default_room';
  const episodeTitle = searchParams.get('title') || 'פרק פודקאסט מיוחד';

  // Green Room state vs On Air state
  const [isOnAir, setIsOnAir] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestRole, setGuestRole] = useState('');

  // Hardware states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [hasHeadphones, setHasHeadphones] = useState(true);

  // Media Streams & WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Enumerate Devices and Start Local Preview in Green Room
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    const startLocalPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        activeStream = stream;
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Setup VU Meter
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          const source = ctx.createMediaStreamSource(stream);
          source.connect(analyser);

          const checkLevel = () => {
            if (!analyserRef.current) return;
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i];
            const avg = sum / data.length;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
            requestAnimationFrame(checkLevel);
          };
          requestAnimationFrame(checkLevel);
        } catch (e) {}

        // Enumerate devices
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevs = devices.filter(d => d.kind === 'videoinput');
        const aDevs = devices.filter(d => d.kind === 'audioinput');
        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        if (vDevs[0]) setSelectedVideoId(vDevs[0].deviceId);
        if (aDevs[0]) setSelectedAudioId(aDevs[0].deviceId);
      } catch (err) {
        console.error('Error accessing camera/mic:', err);
      }
    };

    startLocalPreview();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (peerRef.current) peerRef.current.close();
    };
  }, []);

  // 2. Switch Devices
  const handleSwitchDevice = async (videoDeviceId?: string, audioDeviceId?: string) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (videoDeviceId) setSelectedVideoId(videoDeviceId);
      if (audioDeviceId) setSelectedAudioId(audioDeviceId);

      // If already connected, replace WebRTC tracks
      if (peerRef.current) {
        const senders = peerRef.current.getSenders();
        stream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) sender.replaceTrack(track);
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 3. Connect to Studio & Enter Live Broadcast (On-Air)
  const handleJoinBroadcast = async () => {
    if (!guestName.trim()) {
      alert('נא להזין את שמך לפני הכניסה לשידור.');
      return;
    }

    setIsOnAir(true);
    setConnectionStatus('connecting');

    try {
      const RTC_CONFIG: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.services.mozilla.com' }
        ]
      };

      const peer = new RTCPeerConnection(RTC_CONFIG);
      peerRef.current = peer;

      // Add local guest stream tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peer.addTrack(track, localStreamRef.current!);
        });
      }

      // Receive host return video/audio stream
      peer.ontrack = (event) => {
        if (event.streams && event.streams[0] && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      peer.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send-candidate',
                roomId,
                role: 'client',
                data: event.candidate
              })
            });
          } catch {}
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setConnectionStatus('connected');
        } else if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
          setConnectionStatus('error');
        }
      };

      // Notify signaling server about guest joining with name & role
      await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomId,
          role: 'client',
          guestInfo: { name: guestName, role: guestRole }
        })
      });

      // Poll for host WebRTC offer
      let offerProcessed = false;
      pollIntervalRef.current = setInterval(async () => {
        if (!peerRef.current) return;

        if (!offerProcessed) {
          try {
            const res = await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'get-offer', roomId })
            });
            const json = await res.json();
            if (json.offer) {
              offerProcessed = true;
              await peerRef.current.setRemoteDescription(new RTCSessionDescription(json.offer));
              const answer = await peerRef.current.createAnswer();
              await peerRef.current.setLocalDescription(answer);

              await fetch('/api/signaling', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'send-answer',
                  roomId,
                  role: 'client',
                  data: answer
                })
              });
            }
          } catch (e) {}
        }

        // Fetch ICE candidates from host
        try {
          const cRes = await fetch('/api/signaling', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-candidates', roomId, role: 'client' })
          });
          const cJson = await cRes.json();
          if (cJson.candidates && Array.isArray(cJson.candidates)) {
            for (const cand of cJson.candidates) {
              try {
                await peerRef.current.addIceCandidate(new RTCIceCandidate(cand));
              } catch {}
            }
          }
        } catch (e) {}
      }, 1000);

      // Live High-Frequency Frame Streaming Fallback (Guaranteed to stream even behind symmetric NAT / mobile 5G firewall)
      const offscreenCanvas = document.createElement('canvas');
      const offCtx = offscreenCanvas.getContext('2d');
      offscreenCanvas.width = 640;
      offscreenCanvas.height = 360;

      frameIntervalRef.current = setInterval(async () => {
        if (localVideoRef.current && offCtx && !isVideoMuted) {
          try {
            offCtx.drawImage(localVideoRef.current, 0, 0, 640, 360);
            const jpegData = offscreenCanvas.toDataURL('image/jpeg', 0.65);
            await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'push-frame',
                roomId,
                frame: jpegData
              })
            });
          } catch {}
        }
      }, 120);

    } catch (err) {
      console.error('Connection error:', err);
      setConnectionStatus('error');
    }
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isAudioMuted;
        setIsAudioMuted(!isAudioMuted);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoMuted;
        setIsVideoMuted(!isVideoMuted);
      }
    }
  };

  const handleLeaveBroadcast = () => {
    if (confirm('האם לעזוב את השידור באולפן?')) {
      setIsOnAir(false);
      setConnectionStatus('idle');
      if (peerRef.current) peerRef.current.close();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col font-sans select-none">
      {/* Header */}
      <header className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>אולפן אירוח אורחים (CastFlow Guest Room)</span>
              {isOnAir && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-mono font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  ON AIR
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 truncate max-w-sm sm:max-w-md">{episodeTitle}</p>
          </div>
        </div>

        {isOnAir && (
          <button
            onClick={handleLeaveBroadcast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 hover:text-white border border-rose-500/40 text-xs font-bold transition-all active:scale-95"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>עזוב שידור</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {!isOnAir ? (
          /* GREEN ROOM PRE-FLIGHT CHECK */
          <div className="w-full max-w-2xl rounded-3xl bg-[#0f121a] border border-slate-800 p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in">
            <div className="text-center space-y-1">
              <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/30 inline-block mb-1">
                חדר המתנה ירוק (Green Room)
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">ברוכים הבאים לשידור הפודקאסט!</h2>
              <p className="text-xs text-slate-400">בדקו את המצלמה והמיקרופון לפני הכניסה לשידור החי עם המארח</p>
            </div>

            {/* Video Preview Viewport */}
            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl group">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />

              {isVideoMuted && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <VideoOff className="w-8 h-8 text-rose-500" />
                  <span className="text-xs font-bold">המצלמה כבויה</span>
                </div>
              )}

              {/* VU Meter overlay */}
              <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                <Mic className={`w-3.5 h-3.5 ${isAudioMuted ? 'text-rose-500' : 'text-emerald-400'}`} />
                <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 ${
                      isAudioMuted ? 'w-0' : audioLevel > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: isAudioMuted ? '0%' : `${audioLevel}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-300 font-bold">
                  {isAudioMuted ? 'מושתק' : `${audioLevel}%`}
                </span>
              </div>

              {/* Floating Mute Controls */}
              <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  className={`p-2.5 rounded-xl backdrop-blur-md border transition-all ${
                    isAudioMuted ? 'bg-rose-600 text-white border-rose-500' : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                  }`}
                  title={isAudioMuted ? 'בטל השתקה' : 'השתק מיקרופון'}
                >
                  {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  onClick={handleToggleVideo}
                  className={`p-2.5 rounded-xl backdrop-blur-md border transition-all ${
                    isVideoMuted ? 'bg-rose-600 text-white border-rose-500' : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                  }`}
                  title={isVideoMuted ? 'הפעל מצלמה' : 'כבה מצלמה'}
                >
                  {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Guest Identity Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>שמך המלא (יוצג על המסך): *</span>
                </label>
                <input
                  type="text"
                  placeholder="למשל: ד״ר ירון לוי"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                  <span>תפקיד / תיאור קצר:</span>
                </label>
                <input
                  type="text"
                  placeholder="למשל: במאי קולנוע וחוקר תרבות"
                  value={guestRole}
                  onChange={(e) => setGuestRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Headphone Tip Card */}
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-600/30 text-indigo-300 shrink-0">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs text-slate-300">
                <span className="font-bold text-white block">טיפ לאיכות שידור מושלמת:</span>
                <span>מומלץ להשתמש באוזניות כדי למנוע הדהוד (Echo) וליהנות מסאונד נקי וחד.</span>
              </div>
            </div>

            {/* Join Button */}
            <button
              onClick={handleJoinBroadcast}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <Sparkles className="w-5 h-5" />
              <span>הצטרף לשידור החי באולפן</span>
            </button>
          </div>
        ) : (
          /* ON AIR LIVE BROADCAST VIEW */
          <div className="w-full max-w-5xl space-y-4 animate-in fade-in">
            {/* Live Dual Stage Viewport */}
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-slate-800 shadow-2xl grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-950">
              {/* Host Program Feed */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-indigo-300 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-indigo-400" />
                  <span>שידור מארח האולפן (Host Studio)</span>
                </div>
              </div>

              {/* Guest Self Return Feed */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-indigo-500/50 flex items-center justify-center">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>אתה בשידור: {guestName}</span>
                </div>
              </div>
            </div>

            {/* In-Broadcast Floating Control Bar */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleMute}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    isAudioMuted ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                  <span>{isAudioMuted ? 'מיקרופון מושתק' : 'מיקרופון פעיל'}</span>
                </button>

                <button
                  onClick={handleToggleVideo}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                    isVideoMuted ? 'bg-rose-600 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-indigo-400" />}
                  <span>{isVideoMuted ? 'מצלמה כבויה' : 'מצלמה פעילה'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">סטטוס חיבור:</span>
                <span className={`text-xs font-bold flex items-center gap-1 ${
                  connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  <Wifi className="w-3.5 h-3.5" />
                  {connectionStatus === 'connected' ? 'מחובר לאולפן' : 'מתחבר...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function GuestBroadcastPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <GuestBroadcastContent />
    </Suspense>
  );
}
