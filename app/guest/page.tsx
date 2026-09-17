'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RemoteGuestSender } from '@/lib/webrtcClient';
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
  Maximize2,
  Users,
  Volume2
} from 'lucide-react';

function GuestBroadcastContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('room') || 'guest_default_room';
  const episodeTitle = searchParams.get('title') || 'פרק פודקאסט מיוחד';
  const roleParam = searchParams.get('role');
  const isCoHost = roleParam === 'cohost';
  const nameParam = searchParams.get('name') || '';

  // Green Room state vs On Air state
  const [isOnAir, setIsOnAir] = useState(false);
  const [guestName, setGuestName] = useState(nameParam);
  const [guestRole, setGuestRole] = useState(isCoHost ? 'מנחה שותף/ה' : '');

  // Hardware states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedAudioId, setSelectedAudioId] = useState<string>('');
  const [selectedAudioOutputId, setSelectedAudioOutputId] = useState<string>('');
  const [isPlayingSoundTest, setIsPlayingSoundTest] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [hasHeadphones, setHasHeadphones] = useState(true);

  const [hostVolume, setHostVolume] = useState<number>(1.0);
  const [hostAudioLevel, setHostAudioLevel] = useState<number>(0);
  const [isHostSpeaking, setIsHostSpeaking] = useState<boolean>(false);
  const isCoHostSpeaking = audioLevel > 10 && !isAudioMuted;

  // Media Streams & WebRTC Refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const hostFallbackAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const lastHostAudioTimeRef = useRef<number>(0);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const guestSenderRef = useRef<RemoteGuestSender | null>(null);
  const frameSuccessCountRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const latestAudioChunkRef = useRef<string | null>(null);

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
        const outDevs = devices.filter(d => d.kind === 'audiooutput');
        setVideoDevices(vDevs);
        setAudioDevices(aDevs);
        setAudioOutputDevices(outDevs);
        if (vDevs[0]) setSelectedVideoId(vDevs[0].deviceId);
        if (aDevs[0]) setSelectedAudioId(aDevs[0].deviceId);
        if (outDevs[0]) setSelectedAudioOutputId(outDevs[0].deviceId);
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
      if (fallbackAudioRecorderRef.current) {
        try { fallbackAudioRecorderRef.current.stop(); } catch {}
      }
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
      if (guestSenderRef.current) {
        guestSenderRef.current.replaceStream(stream);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Switch Audio Output Device (Headphones / Speakers)
  const handleSwitchAudioOutput = async (sinkId: string) => {
    setSelectedAudioOutputId(sinkId);
    if (remoteAudioRef.current && 'setSinkId' in remoteAudioRef.current) {
      try {
        await (remoteAudioRef.current as any).setSinkId(sinkId);
      } catch (e) {
        console.warn('Failed to set sinkId on guest audio element', e);
      }
    }
  };

  // Play Test Sound Chime in Headphones/Speakers
  const playTestSound = async () => {
    try {
      setIsPlayingSoundTest(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.24); // D6

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.75);

      setTimeout(() => {
        setIsPlayingSoundTest(false);
        ctx.close().catch(() => {});
      }, 800);
    } catch (e) {
      setIsPlayingSoundTest(false);
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
    frameSuccessCountRef.current = 0;

    // Pre-unlock audio element for mobile browser autoplay policy
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play().catch(() => {});
    }

    const participantInfo = { 
      name: guestName.trim() || (isCoHost ? 'מנחה שותף/ה' : 'אורח/ת'), 
      role: guestRole.trim() || (isCoHost ? 'מנחה שותף/ה' : undefined), 
      isCoHost 
    };

    try {
      // 1. Start bidirectional WebRTC sender to host Studio
      if (localStreamRef.current) {
        guestSenderRef.current = new RemoteGuestSender(
          roomId,
          (status, message) => {
            if (status === 'connected') {
              setConnectionStatus('connected');
            } else if (status === 'disconnected') {
              if (frameSuccessCountRef.current < 2) {
                setConnectionStatus('connecting');
              }
            } else if (status === 'error') {
              if (frameSuccessCountRef.current < 2) {
                setConnectionStatus('error');
              }
            }
          },
          (stream) => {
            setRemoteStream(stream);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
            }
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = stream;
              remoteAudioRef.current.volume = 1.0;
              remoteAudioRef.current.play().catch(() => {});
            }
          }
        );
        guestSenderRef.current.start(localStreamRef.current, participantInfo);
      }

      // 2. Fallback Audio Stream Recorder (Transmits audio chunks via HTTP fallback if WebRTC UDP is blocked)
      try {
        if (localStreamRef.current) {
          const audioTracks = localStreamRef.current.getAudioTracks();
          if (audioTracks.length > 0 && typeof MediaRecorder !== 'undefined') {
            const audioStream = new MediaStream(audioTracks);
            let mimeType = 'audio/webm;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
            }
            const rec = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream);
            fallbackAudioRecorderRef.current = rec;
            rec.ondataavailable = async (e) => {
              if (e.data && e.data.size > 0 && !isAudioMuted) {
                try {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    latestAudioChunkRef.current = reader.result as string;
                  };
                  reader.readAsDataURL(e.data);
                } catch {}
              }
            };
            rec.start(750);
          }
        }
      } catch (ae) {
        console.warn('Fallback audio recorder setup error:', ae);
      }

      // 3. Live High-Frequency Frame Streaming Fallback (Guaranteed to stream even behind symmetric NAT / mobile 5G firewall)
      const offscreenCanvas = document.createElement('canvas');
      const offCtx = offscreenCanvas.getContext('2d');
      offscreenCanvas.width = 640;
      offscreenCanvas.height = 360;

      frameIntervalRef.current = setInterval(async () => {
        if (localVideoRef.current && offCtx && !isVideoMuted) {
          try {
            offCtx.drawImage(localVideoRef.current, 0, 0, 640, 360);
            const jpegData = offscreenCanvas.toDataURL('image/jpeg', 0.65);
            const payload: any = {
              action: 'push-frame',
              roomId,
              frame: jpegData
            };
            if (latestAudioChunkRef.current) {
              payload.audioChunk = latestAudioChunkRef.current;
              latestAudioChunkRef.current = null;
            }
            const res = await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (res.ok) {
              frameSuccessCountRef.current++;
              // As soon as frames reach the studio, mark connection as connected!
              if (frameSuccessCountRef.current >= 2) {
                setConnectionStatus('connected');
              }
              try {
                const json = await res.json();
                if (json.hostAudioChunk && json.hostAudioTime && json.hostAudioTime > lastHostAudioTimeRef.current) {
                  lastHostAudioTimeRef.current = json.hostAudioTime;
                  const hasLiveWebRTCAudio = remoteStream && remoteStream.getAudioTracks().some(t => t.readyState === 'live' && t.enabled);
                  if (!hasLiveWebRTCAudio) {
                    if (!hostFallbackAudioPlayerRef.current) {
                      hostFallbackAudioPlayerRef.current = new Audio();
                    }
                    hostFallbackAudioPlayerRef.current.src = json.hostAudioChunk;
                    hostFallbackAudioPlayerRef.current.volume = hostVolume;
                    if (selectedAudioOutputId && 'setSinkId' in hostFallbackAudioPlayerRef.current) {
                      (hostFallbackAudioPlayerRef.current as any).setSinkId(selectedAudioOutputId).catch(() => {});
                    }
                    hostFallbackAudioPlayerRef.current.play().catch(() => {});
                  }
                }
              } catch {}
            }
          } catch {}
        }
      }, 180);

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
      if (guestSenderRef.current) guestSenderRef.current.stop();
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      if (fallbackAudioRecorderRef.current) {
        try { fallbackAudioRecorderRef.current.stop(); } catch {}
        fallbackAudioRecorderRef.current = null;
      }
    }
  };

  // Sync Remote Host Stream with Dedicated Audio Player & Web Audio Pipeline
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.volume = hostVolume;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, hostVolume]);

  // Analyze and Play Host Audio with Web Audio pipeline (Fail-Safe Dual Playback + Discord VAD)
  useEffect(() => {
    if (!remoteStream || remoteStream.getAudioTracks().length === 0) {
      setHostAudioLevel(0);
      setIsHostSpeaking(false);
      return;
    }

    let animId: number;
    let audioCtx: AudioContext | null = null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      const source = audioCtx.createMediaStreamSource(remoteStream);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = hostVolume;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;

      source.connect(analyser);
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkHostLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const level = Math.min(100, Math.round((avg / 128) * 100));
        setHostAudioLevel(level);
        setIsHostSpeaking(level > 10);
        animId = requestAnimationFrame(checkHostLevel);
      };
      animId = requestAnimationFrame(checkHostLevel);
    } catch (e) {}

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx) audioCtx.close().catch(() => {});
    };
  }, [remoteStream, hostVolume]);

  // Sync Audio Output (Headphones / Speakers) using setSinkId
  useEffect(() => {
    if (remoteAudioRef.current && selectedAudioOutputId && 'setSinkId' in remoteAudioRef.current) {
      (remoteAudioRef.current as any).setSinkId(selectedAudioOutputId).catch(() => {});
    }
    if (hostFallbackAudioPlayerRef.current && selectedAudioOutputId && 'setSinkId' in hostFallbackAudioPlayerRef.current) {
      (hostFallbackAudioPlayerRef.current as any).setSinkId(selectedAudioOutputId).catch(() => {});
    }
  }, [selectedAudioOutputId, remoteStream]);

  // Mobile Audio Touch Unlocker (for iOS Safari and mobile Chrome autoplay restriction)
  useEffect(() => {
    const unlock = () => {
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject && remoteAudioRef.current.paused) {
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#07090e] text-white flex flex-col font-sans select-none">
      {/* Permanent Dedicated Host Audio Player */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Header */}
      <header className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl text-white shadow-lg ${
            isCoHost 
              ? 'bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 shadow-emerald-600/30' 
              : 'bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-600/30'
          }`}>
            {isCoHost ? <Users className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>{isCoHost ? 'אולפן מנחה שותף/ה (CastFlow Co-Host Room)' : 'אולפן אירוח אורחים (CastFlow Guest Room)'}</span>
              {isOnAir && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-mono font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" />
                  {isCoHost ? '👥 מנחה שותף ON AIR' : 'ON AIR'}
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
              <span className={`text-xs font-bold px-3 py-1 rounded-full border inline-block mb-1 ${
                isCoHost 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' 
                  : 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
              }`}>
                {isCoHost ? '👥 חדר מנחה שותף/ה (Co-Host Green Room)' : 'חדר המתנה ירוק (Green Room)'}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {isCoHost ? 'ברוך/ה הבא/ה לשידור המשותף!' : 'ברוכים הבאים לשידור הפודקאסט!'}
              </h2>
              <p className="text-xs text-slate-400">
                {isCoHost 
                  ? 'בדקו את המצלמה והמיקרופון לפני הכניסה לשידור המשותף כמנחה' 
                  : 'בדקו את המצלמה והמיקרופון לפני הכניסה לשידור החי עם המארח'}
              </p>
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

            {/* Guest / Co-Host Identity Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                  {isCoHost ? <Users className="w-3.5 h-3.5 text-emerald-400" /> : <User className="w-3.5 h-3.5 text-indigo-400" />}
                  <span>{isCoHost ? 'שמך המלא (יוצג כמנחה שותף/ה): *' : 'שמך המלא (יוצג על המסך): *'}</span>
                </label>
                <input
                  type="text"
                  placeholder={isCoHost ? 'למשל: דניאל לוי (מנחה)' : 'למשל: ד״ר ירון לוי'}
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
                  placeholder={isCoHost ? 'למשל: מנחה שותף / מומחה תוכן' : 'למשל: במאי קולנוע וחוקר תרבות'}
                  value={guestRole}
                  onChange={(e) => setGuestRole(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Device Selectors & Sound Test */}
            <div className="space-y-3 bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-cyan-400" />
                  <span>הגדרות חומרה ושמע (אוזניות ומיקרופון)</span>
                </span>
                {/* Audio Output Test Tone */}
                <button
                  type="button"
                  onClick={playTestSound}
                  disabled={isPlayingSoundTest}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-white border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-all active:scale-95"
                  title="נגן צליל בדיקה באוזניות"
                >
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isPlayingSoundTest ? 'מנגן צליל...' : '▶️ בדיקת שמע באוזניות'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Microphone selector */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Mic className="w-3 h-3 text-indigo-400" />
                    <span>מיקרופון:</span>
                  </label>
                  <select
                    value={selectedAudioId}
                    onChange={(e) => handleSwitchDevice(undefined, e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {audioDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `מיקרופון ${d.deviceId.slice(0, 5)}`}</option>
                    ))}
                  </select>
                </div>

                {/* Headphone / Speaker output selector */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Headphones className="w-3 h-3 text-cyan-400" />
                    <span>אוזניות / רמקולים (פלט שמע):</span>
                  </label>
                  <select
                    value={selectedAudioOutputId}
                    onChange={(e) => handleSwitchAudioOutput(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {audioOutputDevices.length > 0 ? (
                      audioOutputDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>{d.label || `אוזניות/רמקול ${d.deviceId.slice(0, 5)}`}</option>
                      ))
                    ) : (
                      <option value="">ברירת מחדל של מערכת ההפעלה</option>
                    )}
                  </select>
                </div>
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
              className={`w-full py-4 rounded-2xl text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 active:scale-98 transition-all ${
                isCoHost
                  ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 shadow-indigo-600/30'
              }`}
            >
              {isCoHost ? <Users className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              <span>{isCoHost ? 'הצטרף לאולפן כמנחה שותף/ה' : 'הצטרף לשידור החי באולפן'}</span>
            </button>
          </div>
        ) : (
          /* ON AIR LIVE BROADCAST VIEW */
          <div className="w-full max-w-5xl space-y-4 animate-in fade-in">
            {/* Live Dual Stage Viewport */}
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-slate-800 shadow-2xl grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 bg-slate-950">
              {/* Host Program Feed */}
              <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border flex items-center justify-center transition-all duration-150 ${
                isHostSpeaking
                  ? 'border-emerald-400 ring-4 ring-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                  : 'border-slate-800'
              }`}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-indigo-300 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-indigo-400" />
                  <span>שידור מארח האולפן (Host Studio)</span>
                  {isHostSpeaking && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white animate-pulse flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>מדבר/ת...</span>
                    </span>
                  )}
                </div>

                {/* Host Volume Slider in feed */}
                <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10">
                  <Volume2 className="w-3 h-3 text-cyan-400" />
                  <input
                    type="range"
                    min="0"
                    max="2.0"
                    step="0.05"
                    value={hostVolume}
                    onChange={(e) => setHostVolume(parseFloat(e.target.value))}
                    className="w-16 sm:w-24 h-1 bg-slate-700 rounded accent-cyan-400 cursor-pointer"
                    title={`עוצמת שמע מארח: ${Math.round(hostVolume * 100)}%`}
                  />
                  <span className="text-[10px] font-mono text-cyan-300 font-bold">{Math.round(hostVolume * 100)}%</span>
                </div>
              </div>

              {/* Guest / Co-Host Self Return Feed */}
              <div className={`relative rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border transition-all duration-150 ${
                isCoHostSpeaking
                  ? 'border-emerald-400 ring-4 ring-emerald-500/80 shadow-[0_0_25px_rgba(16,185,129,0.6)]'
                  : isCoHost ? 'border-emerald-500/50' : 'border-indigo-500/50'
              }`}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{isCoHost ? `👥 מנחה שותף: ${guestName || 'אתה'}` : `אתה בשידור: ${guestName}`}</span>
                  {isCoHostSpeaking && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-white animate-pulse flex items-center gap-1 shadow">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      <span>מדבר/ת...</span>
                    </span>
                  )}
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

                <button
                  type="button"
                  onClick={playTestSound}
                  disabled={isPlayingSoundTest}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 transition-all border border-cyan-500/20 active:scale-95"
                  title="נגן צליל בדיקה באוזניות"
                >
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>{isPlayingSoundTest ? 'בודק...' : '🔊 בדיקת שמע'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">סטטוס חיבור:</span>
                <span className={`text-xs font-bold flex items-center gap-1.5 px-3 py-1 rounded-xl border ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : connectionStatus === 'error'
                      ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                      : 'bg-amber-500/15 border-amber-500/30 text-amber-400 animate-pulse'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`} />
                  <Wifi className="w-3.5 h-3.5" />
                  <span>
                    {connectionStatus === 'connected'
                      ? (isCoHost ? 'מנחה שותף/ה בשידור חי' : 'מחובר/ת לאולפן בשידור חי')
                      : connectionStatus === 'error'
                        ? 'תקלת חיבור (בדוק רשת)'
                        : 'מתחבר לאולפן...'}
                  </span>
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
