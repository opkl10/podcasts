import { AudioInputDevice, VideoInputDevice } from './types';

// Detect and enumerate media devices with special flag for iPhone / Continuity Camera / Capture Cards
export async function getMediaDevices(): Promise<{
  audioInputs: AudioInputDevice[];
  videoInputs: VideoInputDevice[];
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return { audioInputs: [], videoInputs: [] };
  }

  try {
    // Check if device labels are already available (permissions already granted)
    let devices = await navigator.mediaDevices.enumerateDevices();
    const hasLabels = devices.some(d => (d.kind === 'videoinput' || d.kind === 'audioinput') && d.label && d.label.trim().length > 0);

    if (!hasLabels) {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch {}
        }
      }

      devices = await navigator.mediaDevices.enumerateDevices();

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        await new Promise(r => setTimeout(r, 200));
      }
    }

    const audioInputs: AudioInputDevice[] = [];
    const videoInputs: VideoInputDevice[] = [];

    devices.forEach(device => {
      if (device.kind === 'audioinput') {
        const labelLower = (device.label || '').toLowerCase();
        // Console / Elgato HDMI audio is strictly capture hardware (NEVER USB Audio CODEC!)
        const isGameAudio = 
          !labelLower.includes('codec') && (
            labelLower.includes('elgato') || 
            labelLower.includes('cam link') || 
            labelLower.includes('camlink') || 
            labelLower.includes('hd60') || 
            labelLower.includes('4k s') ||
            labelLower.includes('4k x') ||
            labelLower.includes('4k60') ||
            (labelLower.includes('capture') && !labelLower.includes('mic')) || 
            labelLower.includes('hdmi audio')
          );

        audioInputs.push({
          deviceId: device.deviceId,
          label: device.label || (isGameAudio ? `שמע קונסולה / אלגטו (${audioInputs.length + 1})` : `מיקרופון (${audioInputs.length + 1})`),
          isGameAudio
        });
      } else if (device.kind === 'videoinput') {
        const labelLower = (device.label || '').toLowerCase();
        
        // Accurate iPhone / Continuity matching (do NOT match 'apple' or general terms that include MacBook webcam)
        const isIPhone = 
          labelLower.includes('iphone') || 
          labelLower.includes('אייפון') || 
          labelLower.includes('continuity camera') || 
          labelLower.includes('מצלמת המשכיות') || 
          labelLower.includes('camo') || 
          labelLower.includes('epoccam') || 
          labelLower.includes('iriun') || 
          labelLower.includes('droidcam');

        const isContinuity = 
          labelLower.includes('continuity') || 
          labelLower.includes('המשכיות') || 
          labelLower.includes('iphone') || 
          labelLower.includes('אייפון');

        // Comprehensive Capture Card matching (Elgato, Cam Link, HD60, 4K X/Pro, HDMI, USB Video, OBS Virtual Camera)
        const isCaptureCard = 
          labelLower.includes('elgato') || 
          labelLower.includes('cam link') || 
          labelLower.includes('camlink') || 
          labelLower.includes('hd60') || 
          labelLower.includes('4k x') || 
          labelLower.includes('4kx') || 
          labelLower.includes('4k60') || 
          labelLower.includes('4k pro') || 
          labelLower.includes('capture') || 
          labelLower.includes('לוכד') || 
          labelLower.includes('hdmi') || 
          labelLower.includes('usb video') || 
          labelLower.includes('usb3.0') || 
          labelLower.includes('avermedia') || 
          labelLower.includes('shadowcast') || 
          labelLower.includes('obs') || 
          labelLower.includes('virtual') || 
          labelLower.includes('game capture');

        videoInputs.push({
          deviceId: device.deviceId,
          label: device.label || (isCaptureCard ? `לוכד מסך / Elgato (${videoInputs.length + 1})` : `מצלמה (${videoInputs.length + 1})`),
          isIPhone,
          isContinuity,
          isCaptureCard
        });
      }
    });

    return { audioInputs, videoInputs };
  } catch (err) {
    console.error('Error enumerating devices', err);
    return { audioInputs: [], videoInputs: [] };
  }
}

export type VideoResolution = '720p' | '1080p' | '4k';

// Progressive constraint stages for Hardware Capture Cards (Elgato 4K, Cam Link 4K, HD60)
export function getCaptureCardConstraints(resolution: VideoResolution = '1080p', deviceId?: string): MediaTrackConstraints[] {
  const baseId = deviceId ? { deviceId: { exact: deviceId } } : {};
  const idealId = deviceId ? { deviceId: { ideal: deviceId } } : {};

  if (resolution === '4k') {
    return [
      // 1. Exact 4K 30FPS (Native hardware standard for Cam Link 4K & USB 3.0 HDMI capture cards)
      { ...baseId, width: { exact: 3840 }, height: { exact: 2160 }, frameRate: { ideal: 30, max: 60 } },
      // 2. Exact 4K 60FPS (For Elgato 4K X / 4K60 Pro)
      { ...baseId, width: { exact: 3840 }, height: { exact: 2160 }, frameRate: { ideal: 60 } },
      // 3. True 4K with min 2560 and ideal 30FPS (prevents macOS dropping to 640x480)
      { ...baseId, width: { ideal: 3840, min: 2560 }, height: { ideal: 2160, min: 1440 }, frameRate: { ideal: 30 } },
      // 4. Quad HD 1440p with min 1920
      { ...baseId, width: { min: 2560, ideal: 2560 }, height: { min: 1440, ideal: 1440 }, frameRate: { ideal: 60, min: 30 } },
      // 5. Full HD Exact 60FPS
      { ...baseId, width: { exact: 1920 }, height: { exact: 1080 }, frameRate: { ideal: 60 } },
      // 6. Full HD with STRICT min 1920 (ensures Chrome does not silently give 640x480)
      { ...baseId, width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 }, frameRate: { ideal: 60 } },
      // 7. HD fallback with min 1280 (never accept 640x480 as long as HD is available)
      { ...baseId, width: { min: 1280, ideal: 1920 }, height: { min: 720, ideal: 1080 }, frameRate: { ideal: 60 } },
      // 8. Unconstrained fallback only if all strict constraints fail
      { ...idealId }
    ];
  }

  // 1080p
  return [
    { ...baseId, width: { exact: 1920 }, height: { exact: 1080 }, frameRate: { ideal: 60 } },
    { ...baseId, width: { exact: 1920 }, height: { exact: 1080 }, frameRate: { ideal: 30 } },
    { ...baseId, width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 }, frameRate: { ideal: 60 } },
    { ...baseId, width: { min: 1280, ideal: 1920 }, height: { min: 720, ideal: 1080 }, frameRate: { ideal: 60 } },
    { ...idealId }
  ];
}

/**
 * Actively forces resolution constraints onto an existing capture card video track.
 * On macOS / Chrome, UVC devices often start in a 640x480 fallback mode until forced via applyConstraints.
 */
export async function applyCaptureCardResolution(
  track: MediaStreamTrack,
  targetRes: VideoResolution
): Promise<{ width: number; height: number; fps: number; applied: boolean }> {
  const tryConstraintSets: MediaTrackConstraints[] = [];

  if (targetRes === '4k') {
    tryConstraintSets.push(
      { width: { exact: 3840 }, height: { exact: 2160 }, frameRate: { ideal: 30 } },
      { width: { exact: 3840 }, height: { exact: 2160 } },
      { width: { min: 2560, ideal: 3840 }, height: { min: 1440, ideal: 2160 } },
      { width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 }, frameRate: { ideal: 60 } },
      { width: { min: 1280 }, height: { min: 720 } }
    );
  } else if (targetRes === '1080p') {
    tryConstraintSets.push(
      { width: { exact: 1920 }, height: { exact: 1080 }, frameRate: { ideal: 60 } },
      { width: { exact: 1920 }, height: { exact: 1080 } },
      { width: { min: 1920, ideal: 1920 }, height: { min: 1080, ideal: 1080 } },
      { width: { min: 1280 }, height: { min: 720 } }
    );
  } else {
    tryConstraintSets.push(
      { width: { exact: 1280 }, height: { exact: 720 } },
      { width: { min: 1280 }, height: { min: 720 } }
    );
  }

  for (const c of tryConstraintSets) {
    try {
      await track.applyConstraints(c);
      const settings = track.getSettings();
      if (settings.width && settings.width >= 1280) {
        console.log(`%c[MediaManager] 🎯 applyConstraints succeeded with width: ${settings.width}x${settings.height}`, 'color: #10b981; font-weight: bold;');
        return {
          width: settings.width || 0,
          height: settings.height || 0,
          fps: Math.round(settings.frameRate || 0),
          applied: true
        };
      }
    } catch (err) {
      // Continue to next constraint set
    }
  }

  const finalSettings = track.getSettings();
  return {
    width: finalSettings.width || 0,
    height: finalSettings.height || 0,
    fps: Math.round(finalSettings.frameRate || 0),
    applied: false
  };
}

// High-Precision Video Resolution Constraints for Full HD & 4K Ultra HD
export function getVideoConstraints(resolution: VideoResolution = '1080p', deviceId?: string): MediaTrackConstraints {
  const base: MediaTrackConstraints = deviceId ? { deviceId: { ideal: deviceId } } : {};

  switch (resolution) {
    case '4k':
      return {
        ...base,
        width: { ideal: 3840, min: 1920 },
        height: { ideal: 2160, min: 1080 },
        aspectRatio: { ideal: 1.7777777778 },
        frameRate: { ideal: 60, min: 24 }
      };
    case '1080p':
      return {
        ...base,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        aspectRatio: { ideal: 1.7777777778 },
        frameRate: { ideal: 30, max: 60, min: 24 }
      };
    case '720p':
    default:
      return {
        ...base,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        aspectRatio: { ideal: 1.7777777778 },
        frameRate: { ideal: 30, min: 24 }
      };
  }
}

// Studio DSP Audio Processor with Volume Gain, Noise Filter, Warmth EQ & Gentle Mastering Compressor
export class StudioAudioProcessor {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private presenceFilter: BiquadFilterNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;

  private onLevelChange?: (level: number, isClipping: boolean) => void;
  private onFrequencyData?: (data: Uint8Array) => void;

  private currentGain: number = 1.0;
  private isNoiseSuppressionOn: boolean = false; // Default to natural transparent capture

  constructor(
    onLevelChange?: (level: number, isClipping: boolean) => void,
    onFrequencyData?: (data: Uint8Array) => void
  ) {
    this.onLevelChange = onLevelChange;
    this.onFrequencyData = onFrequencyData;
  }

  public process(stream: MediaStream): MediaStream {
    this.stop();

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return stream;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx({ sampleRate: 48000 });

      // Immediate AudioContext Resume to prevent initial start-recording latency
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);

      // 1. Highpass Rumble Filter (Gentle 55Hz cutoff only when enabled to remove sub-audible table thumps without thinning vocal warmth)
      this.highpassFilter = this.audioCtx.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.value = this.isNoiseSuppressionOn ? 55 : 10;
      this.highpassFilter.Q.value = 0.65;

      // 2. Vocal Presence EQ (Gentle broadcast warmth & clarity)
      this.presenceFilter = this.audioCtx.createBiquadFilter();
      this.presenceFilter.type = 'peaking';
      this.presenceFilter.frequency.value = 3000;
      this.presenceFilter.gain.value = this.isNoiseSuppressionOn ? 1.5 : 0;
      this.presenceFilter.Q.value = 0.8;

      // 3. Smooth Mastering Dynamics Compressor
      // 20ms attack preserves initial consonant articulation ('B', 'P', 'T', 'Sh') from the very first millisecond!
      this.compressor = this.audioCtx.createDynamicsCompressor();
      this.compressor.threshold.value = this.isNoiseSuppressionOn ? -18 : 0;
      this.compressor.knee.value = 15; // Smooth soft-knee curve
      this.compressor.ratio.value = this.isNoiseSuppressionOn ? 2.5 : 1.0;
      this.compressor.attack.value = 0.020; // 20ms attack - prevents swallowing/clipping beginning of words
      this.compressor.release.value = 0.150; // 150ms release - transparent decay without pumping

      // 4. Master Gain Node (Volume control 0% - 250%)
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.currentGain;

      // 5. Analyser for VU Meter
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // 6. Output Destination
      this.destinationNode = this.audioCtx.createMediaStreamDestination();

      // Connect DSP chain: Source -> Highpass -> Presence -> Compressor -> Gain -> Destination & Analyser
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.presenceFilter);
      this.presenceFilter.connect(this.compressor);
      this.compressor.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);
      this.gainNode.connect(this.destinationNode);

      this.startMeterLoop();

      // Combine processed audio with original video tracks
      const processedAudioTrack = this.destinationNode.stream.getAudioTracks()[0];
      const videoTracks = stream.getVideoTracks();
      return new MediaStream([...videoTracks, processedAudioTrack]);

    } catch (err) {
      console.warn('Audio DSP Processor failed, using pristine raw stream:', err);
      return stream;
    }
  }

  public setGain(value: number) {
    this.currentGain = Math.max(0, Math.min(2.5, value));
    if (this.gainNode && this.audioCtx) {
      this.gainNode.gain.setTargetAtTime(this.currentGain, this.audioCtx.currentTime, 0.03);
    }
  }

  public setNoiseSuppression(enabled: boolean) {
    this.isNoiseSuppressionOn = enabled;
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      const now = this.audioCtx.currentTime;
      if (this.highpassFilter) {
        this.highpassFilter.frequency.setTargetAtTime(enabled ? 55 : 10, now, 0.03);
      }
      if (this.presenceFilter) {
        this.presenceFilter.gain.setTargetAtTime(enabled ? 1.5 : 0, now, 0.03);
      }
      if (this.compressor) {
        this.compressor.threshold.setTargetAtTime(enabled ? -18 : 0, now, 0.03);
        this.compressor.ratio.setTargetAtTime(enabled ? 2.5 : 1.0, now, 0.03);
      }
    }
  }

  private startMeterLoop() {
    if (!this.analyserNode) return;
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      if (!this.analyserNode) return;
      this.analyserNode.getByteFrequencyData(dataArray);

      let sum = 0;
      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        sum += val;
        if (val > peak) peak = val;
      }

      const avg = sum / bufferLength;
      const normalized = Math.min(100, Math.round((avg / 128) * 100));
      const isClipping = peak >= 250;

      if (this.onLevelChange) {
        this.onLevelChange(normalized, isClipping);
      }
      if (this.onFrequencyData) {
        this.onFrequencyData(dataArray);
      }

      this.animationFrameId = requestAnimationFrame(update);
    };

    update();
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch {}
      this.sourceNode = null;
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch {}
      this.gainNode = null;
    }
    if (this.highpassFilter) {
      try { this.highpassFilter.disconnect(); } catch {}
      this.highpassFilter = null;
    }
    if (this.compressor) {
      try { this.compressor.disconnect(); } catch {}
      this.compressor = null;
    }
    if (this.destinationNode) {
      try { this.destinationNode.disconnect(); } catch {}
      this.destinationNode = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }
    this.analyserNode = null;
    if (this.onLevelChange) this.onLevelChange(0, false);
  }
}

// Legacy AudioMeter wrapper for backwards compatibility
export class AudioMeter {
  private processor: StudioAudioProcessor;

  constructor(
    onLevelChange: (level: number, isClipping: boolean) => void,
    onFrequencyData?: (data: Uint8Array) => void
  ) {
    this.processor = new StudioAudioProcessor(onLevelChange, onFrequencyData);
  }

  public start(stream: MediaStream) {
    this.processor.process(stream);
  }

  public stop() {
    this.processor.stop();
  }
}

// High-FPS Screen & Game Capture Stream Helper (Supports 4K UHD & Full HD 1080p)
export async function getScreenCaptureStream(options: { 
  frameRate?: number; 
  audio?: boolean; 
  resolution?: VideoResolution 
} = {}): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser environment');
  }

  const { frameRate = 60, audio = true, resolution = '1080p' } = options;
  const width = resolution === '4k' ? 3840 : resolution === '1080p' ? 1920 : 1280;
  const height = resolution === '4k' ? 2160 : resolution === '1080p' ? 1080 : 720;

  return await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: width, max: 3840 },
      height: { ideal: height, max: 2160 },
      frameRate: { ideal: frameRate, max: 60 },
      displaySurface: 'window',
      cursor: 'always'
    } as any,
    audio: audio ? {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 2
    } : false
  });
}

// Dual Audio Mixer: Mic Audio + Game/Console Audio with Live VU Metering, Channel Splitting & Headphone Monitoring
export class GamingAudioMixer {
  private audioCtx: AudioContext | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private gameSource: MediaStreamAudioSourceNode | null = null;
  private micGainNode: GainNode | null = null;
  private gameGainNode: GainNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private masterDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private micDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private gameDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private backupMicDestinationNode: MediaStreamAudioDestinationNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private gameAnalyser: AnalyserNode | null = null;
  private backupMicAnalyser: AnalyserNode | null = null;
  private mergerNode: ChannelMergerNode | null = null;
  private animId: number | null = null;

  // Emergency Backup Microphone Channel
  private backupMicSource: MediaStreamAudioSourceNode | null = null;
  private backupMicGainNode: GainNode | null = null;
  private backupMicHighPass: BiquadFilterNode | null = null;
  private backupMicCompressor: DynamicsCompressorNode | null = null;
  private isBackupMicInMix: boolean = false;

  // Broadcast Studio Vocal DSP Chain (Professional Radio / Streaming Voice)
  private isStudioVocalDspEnabled: boolean = true;
  private micHighPass: BiquadFilterNode | null = null;
  private micDeMud: BiquadFilterNode | null = null;
  private micPresence: BiquadFilterNode | null = null;
  private micAir: BiquadFilterNode | null = null;
  private micCompressor: DynamicsCompressorNode | null = null;
  private isMonitoringGame: boolean = true;
  private isMonitoringMic: boolean = false;
  private micMonitorVolume: number = 1.0;
  private micMonitorGainNode: GainNode | null = null;
  private isChannelSplit: boolean = false;
  private onLevelsChange?: (micLevel: number, gameLevel: number, backupMicLevel?: number) => void;

  constructor(onLevelsChange?: (micLevel: number, gameLevel: number, backupMicLevel?: number) => void) {
    this.onLevelsChange = onLevelsChange;
  }

  public setup(
    micStream: MediaStream | null, 
    gameStream: MediaStream | null, 
    options?: { 
      splitChannels?: boolean; 
      monitorGame?: boolean; 
      monitorMic?: boolean;
      micMonitorVolume?: number;
      studioVocalDsp?: boolean;
      backupMicStream?: MediaStream | null;
      backupMicInMix?: boolean;
      backupMicVolume?: number;
    }
  ): { 
    mixedStream: MediaStream | null; 
    isolatedMicStream: MediaStream | null; 
    isolatedGameStream: MediaStream | null; 
    isolatedBackupMicStream: MediaStream | null;
  } {
    this.stop();

    if (options) {
      if (options.splitChannels !== undefined) this.isChannelSplit = options.splitChannels;
      if (options.monitorGame !== undefined) this.isMonitoringGame = options.monitorGame;
      if (options.monitorMic !== undefined) this.isMonitoringMic = options.monitorMic;
      if (options.micMonitorVolume !== undefined) this.micMonitorVolume = options.micMonitorVolume;
      if (options.studioVocalDsp !== undefined) this.isStudioVocalDspEnabled = options.studioVocalDsp;
      if (options.backupMicInMix !== undefined) this.isBackupMicInMix = options.backupMicInMix;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return { mixedStream: null, isolatedMicStream: null, isolatedGameStream: null, isolatedBackupMicStream: null };

    this.audioCtx = new AudioContextClass({ latencyHint: 'interactive' });
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    this.masterDestinationNode = this.audioCtx.createMediaStreamDestination();
    this.micDestinationNode = this.audioCtx.createMediaStreamDestination();
    this.gameDestinationNode = this.audioCtx.createMediaStreamDestination();
    this.backupMicDestinationNode = this.audioCtx.createMediaStreamDestination();

    // 1. Mic Channel with Broadcast Studio Vocal DSP
    if (micStream && micStream.getAudioTracks().length > 0) {
      try {
        this.micSource = this.audioCtx.createMediaStreamSource(micStream);
        this.micGainNode = this.audioCtx.createGain();
        this.micAnalyser = this.audioCtx.createAnalyser();
        this.micAnalyser.fftSize = 64;

        // Stage 1: High-Pass Rumble Filter (80Hz Butterworth - cuts desk taps, HVAC hum)
        this.micHighPass = this.audioCtx.createBiquadFilter();
        this.micHighPass.type = 'highpass';
        this.micHighPass.frequency.setValueAtTime(80, this.audioCtx.currentTime);
        this.micHighPass.Q.setValueAtTime(0.707, this.audioCtx.currentTime);

        // Stage 2: De-Mud Filter (cuts 320Hz boxy room resonance by -2dB)
        this.micDeMud = this.audioCtx.createBiquadFilter();
        this.micDeMud.type = 'peaking';
        this.micDeMud.frequency.setValueAtTime(320, this.audioCtx.currentTime);
        this.micDeMud.Q.setValueAtTime(1.0, this.audioCtx.currentTime);
        this.micDeMud.gain.setValueAtTime(this.isStudioVocalDspEnabled ? -2.0 : 0.0, this.audioCtx.currentTime);

        // Stage 3: Vocal Presence & Articulation Boost (3.8kHz +3.5dB for crisp radio clarity)
        this.micPresence = this.audioCtx.createBiquadFilter();
        this.micPresence.type = 'peaking';
        this.micPresence.frequency.setValueAtTime(3800, this.audioCtx.currentTime);
        this.micPresence.Q.setValueAtTime(1.2, this.audioCtx.currentTime);
        this.micPresence.gain.setValueAtTime(this.isStudioVocalDspEnabled ? 3.5 : 0.0, this.audioCtx.currentTime);

        // Stage 4: Broadcast Air & Condenser Sparkle (10kHz High Shelf +2.5dB)
        this.micAir = this.audioCtx.createBiquadFilter();
        this.micAir.type = 'highshelf';
        this.micAir.frequency.setValueAtTime(10000, this.audioCtx.currentTime);
        this.micAir.gain.setValueAtTime(this.isStudioVocalDspEnabled ? 2.5 : 0.0, this.audioCtx.currentTime);

        // Stage 5: Studio Broadcast Dynamics Compressor / Peak Limiter (smooths peaks, prevents clipping)
        this.micCompressor = this.audioCtx.createDynamicsCompressor();
        this.micCompressor.threshold.setValueAtTime(this.isStudioVocalDspEnabled ? -18 : 0, this.audioCtx.currentTime);
        this.micCompressor.knee.setValueAtTime(12, this.audioCtx.currentTime);
        this.micCompressor.ratio.setValueAtTime(this.isStudioVocalDspEnabled ? 3.5 : 1.0, this.audioCtx.currentTime);
        this.micCompressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
        this.micCompressor.release.setValueAtTime(0.20, this.audioCtx.currentTime);

        // Connect Chain: Source -> HPF -> DeMud -> Presence -> Air -> Compressor -> MicGain
        this.micSource
          .connect(this.micHighPass)
          .connect(this.micDeMud)
          .connect(this.micPresence)
          .connect(this.micAir)
          .connect(this.micCompressor)
          .connect(this.micGainNode);

        this.micGainNode.connect(this.micAnalyser);
        
        // Connect to isolated mic track destination
        this.micGainNode.connect(this.micDestinationNode);

        // Live Audio Output for Streamer Mic Sidetone / Headphone Monitoring (bypasses to output)
        this.micMonitorGainNode = this.audioCtx.createGain();
        this.micMonitorGainNode.gain.setValueAtTime(this.isMonitoringMic ? this.micMonitorVolume : 0.0, this.audioCtx.currentTime);
        this.micGainNode.connect(this.micMonitorGainNode);
        this.micMonitorGainNode.connect(this.audioCtx.destination);
      } catch (err) {
        console.warn('Could not connect mic track to mixer:', err);
      }
    }

    // 2. Game Channel (Console / Elgato / Desktop)
    if (gameStream && gameStream.getAudioTracks().length > 0) {
      try {
        this.gameSource = this.audioCtx.createMediaStreamSource(gameStream);
        this.gameGainNode = this.audioCtx.createGain();
        this.gameAnalyser = this.audioCtx.createAnalyser();
        this.gameAnalyser.fftSize = 64;

        this.gameSource.connect(this.gameGainNode);
        this.gameGainNode.connect(this.gameAnalyser);

        // Connect to isolated game track destination
        this.gameGainNode.connect(this.gameDestinationNode);

        // Live Audio Output for Console Game Audio (Always audible through speakers / headphones automatically!)
        this.monitorGainNode = this.audioCtx.createGain();
        this.monitorGainNode.gain.setValueAtTime(this.isMonitoringGame ? 1.0 : 0.0, this.audioCtx.currentTime);
        this.gameGainNode.connect(this.monitorGainNode);
        this.monitorGainNode.connect(this.audioCtx.destination);
      } catch (err) {
        console.warn('Could not connect game track to mixer:', err);
      }
    }

    // 3. Emergency Backup Microphone Channel (Isolated Stem + Optional In-Mix / Hot-Swap)
    if (options?.backupMicStream && options.backupMicStream.getAudioTracks().length > 0) {
      try {
        this.backupMicSource = this.audioCtx.createMediaStreamSource(options.backupMicStream);
        this.backupMicGainNode = this.audioCtx.createGain();
        this.backupMicGainNode.gain.setValueAtTime(options.backupMicVolume !== undefined ? options.backupMicVolume : 1.0, this.audioCtx.currentTime);
        this.backupMicAnalyser = this.audioCtx.createAnalyser();
        this.backupMicAnalyser.fftSize = 64;

        // Stage 1: High-Pass Rumble Filter for backup mic (80Hz)
        this.backupMicHighPass = this.audioCtx.createBiquadFilter();
        this.backupMicHighPass.type = 'highpass';
        this.backupMicHighPass.frequency.setValueAtTime(80, this.audioCtx.currentTime);

        // Stage 2: Studio Compressor / Limiter for backup mic
        this.backupMicCompressor = this.audioCtx.createDynamicsCompressor();
        this.backupMicCompressor.threshold.setValueAtTime(-16, this.audioCtx.currentTime);
        this.backupMicCompressor.ratio.setValueAtTime(3.0, this.audioCtx.currentTime);

        this.backupMicSource
          .connect(this.backupMicHighPass)
          .connect(this.backupMicCompressor)
          .connect(this.backupMicGainNode);

        this.backupMicGainNode.connect(this.backupMicAnalyser);

        // Always connect to isolated backup mic stem for rescue/emergency recovery
        this.backupMicGainNode.connect(this.backupMicDestinationNode);
      } catch (err) {
        console.warn('Could not connect backup mic track to mixer:', err);
      }
    }

    // 4. Connect to Master Destination (either Split Channels or Stereo Mix)
    if (this.isChannelSplit) {
      // Channel 0 = Mic (Left), Channel 1 = Game (Right)
      this.mergerNode = this.audioCtx.createChannelMerger(2);
      if (this.micGainNode) this.micGainNode.connect(this.mergerNode, 0, 0);
      if (this.gameGainNode) this.gameGainNode.connect(this.mergerNode, 0, 1);
      if (this.isBackupMicInMix && this.backupMicGainNode) {
        this.backupMicGainNode.connect(this.mergerNode, 0, 0);
      }
      this.mergerNode.connect(this.masterDestinationNode);
    } else {
      // Standard stereo composite mix
      if (this.micGainNode) this.micGainNode.connect(this.masterDestinationNode);
      if (this.gameGainNode) this.gameGainNode.connect(this.masterDestinationNode);
      if (this.isBackupMicInMix && this.backupMicGainNode) {
        this.backupMicGainNode.connect(this.masterDestinationNode);
      }
    }

    // Start Level Loop
    this.startLevelLoop();

    return {
      mixedStream: this.masterDestinationNode.stream,
      isolatedMicStream: this.micDestinationNode.stream,
      isolatedGameStream: this.gameDestinationNode.stream,
      isolatedBackupMicStream: this.backupMicDestinationNode.stream
    };
  }

  public setMicVolume(volume: number) {
    if (this.micGainNode && this.audioCtx) {
      this.micGainNode.gain.setValueAtTime(Math.max(0, volume), this.audioCtx.currentTime);
    }
  }

  public setBackupMicVolume(volume: number) {
    if (this.backupMicGainNode && this.audioCtx) {
      this.backupMicGainNode.gain.setValueAtTime(Math.max(0, volume), this.audioCtx.currentTime);
    }
  }

  public setBackupMicInMix(inMix: boolean) {
    if (this.isBackupMicInMix === inMix) return;
    this.isBackupMicInMix = inMix;
    if (!this.backupMicGainNode || !this.masterDestinationNode) return;
    try {
      this.backupMicGainNode.disconnect(this.masterDestinationNode);
      if (this.mergerNode) this.backupMicGainNode.disconnect(this.mergerNode);
    } catch {}
    if (inMix) {
      try {
        if (this.isChannelSplit && this.mergerNode) {
          this.backupMicGainNode.connect(this.mergerNode, 0, 0);
        } else {
          this.backupMicGainNode.connect(this.masterDestinationNode);
        }
      } catch {}
    }
  }

  public setGameVolume(volume: number) {
    if (this.gameGainNode && this.audioCtx) {
      this.gameGainNode.gain.setValueAtTime(Math.max(0, volume), this.audioCtx.currentTime);
    }
  }

  public setMonitoringGameAudio(enabled: boolean) {
    this.isMonitoringGame = enabled;
    if (this.monitorGainNode && this.audioCtx) {
      this.monitorGainNode.gain.setValueAtTime(enabled ? 1.0 : 0.0, this.audioCtx.currentTime);
    }
  }

  public setMonitoringMic(enabled: boolean) {
    this.isMonitoringMic = enabled;
    if (this.micMonitorGainNode && this.audioCtx) {
      this.micMonitorGainNode.gain.setValueAtTime(enabled ? this.micMonitorVolume : 0.0, this.audioCtx.currentTime);
    }
  }

  public setMicMonitorVolume(volume: number) {
    this.micMonitorVolume = Math.max(0, volume);
    if (this.micMonitorGainNode && this.audioCtx && this.isMonitoringMic) {
      this.micMonitorGainNode.gain.setValueAtTime(this.micMonitorVolume, this.audioCtx.currentTime);
    }
  }

  public setStudioVocalEnhance(enabled: boolean) {
    this.isStudioVocalDspEnabled = enabled;
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (this.micDeMud) this.micDeMud.gain.setValueAtTime(enabled ? -2.0 : 0.0, now);
    if (this.micPresence) this.micPresence.gain.setValueAtTime(enabled ? 3.5 : 0.0, now);
    if (this.micAir) this.micAir.gain.setValueAtTime(enabled ? 2.5 : 0.0, now);
    if (this.micCompressor) {
      this.micCompressor.threshold.setValueAtTime(enabled ? -18 : 0, now);
      this.micCompressor.ratio.setValueAtTime(enabled ? 3.5 : 1.0, now);
    }
  }

  public setSplitChannels(enabled: boolean) {
    this.isChannelSplit = enabled;
  }

  public getIsolatedMicStream(): MediaStream | null {
    return this.micDestinationNode?.stream || null;
  }

  public getIsolatedBackupMicStream(): MediaStream | null {
    return this.backupMicDestinationNode?.stream || null;
  }

  public getIsolatedGameStream(): MediaStream | null {
    return this.gameDestinationNode?.stream || null;
  }

  public resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  private startLevelLoop() {
    const micData = new Uint8Array(32);
    const gameData = new Uint8Array(32);
    const backupData = new Uint8Array(32);

    const check = () => {
      let micLevel = 0;
      let gameLevel = 0;
      let backupLevel = 0;

      if (this.micAnalyser) {
        this.micAnalyser.getByteFrequencyData(micData);
        let sum = 0;
        for (let i = 0; i < micData.length; i++) sum += micData[i];
        micLevel = Math.min(100, Math.round((sum / (micData.length * 255)) * 100 * 2.2));
      }

      if (this.gameAnalyser) {
        this.gameAnalyser.getByteFrequencyData(gameData);
        let sum = 0;
        for (let i = 0; i < gameData.length; i++) sum += gameData[i];
        gameLevel = Math.min(100, Math.round((sum / (gameData.length * 255)) * 100 * 2.2));
      }

      if (this.backupMicAnalyser) {
        this.backupMicAnalyser.getByteFrequencyData(backupData);
        let sum = 0;
        for (let i = 0; i < backupData.length; i++) sum += backupData[i];
        backupLevel = Math.min(100, Math.round((sum / (backupData.length * 255)) * 100 * 2.2));
      }

      if (this.onLevelsChange) {
        this.onLevelsChange(micLevel, gameLevel, backupLevel);
      }

      this.animId = requestAnimationFrame(check);
    };

    this.animId = requestAnimationFrame(check);
  }

  public stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.micSource) {
      try { this.micSource.disconnect(); } catch {}
      this.micSource = null;
    }
    if (this.micHighPass) {
      try { this.micHighPass.disconnect(); } catch {}
      this.micHighPass = null;
    }
    if (this.micDeMud) {
      try { this.micDeMud.disconnect(); } catch {}
      this.micDeMud = null;
    }
    if (this.micPresence) {
      try { this.micPresence.disconnect(); } catch {}
      this.micPresence = null;
    }
    if (this.micAir) {
      try { this.micAir.disconnect(); } catch {}
      this.micAir = null;
    }
    if (this.micCompressor) {
      try { this.micCompressor.disconnect(); } catch {}
      this.micCompressor = null;
    }
    if (this.backupMicSource) {
      try { this.backupMicSource.disconnect(); } catch {}
      this.backupMicSource = null;
    }
    if (this.backupMicHighPass) {
      try { this.backupMicHighPass.disconnect(); } catch {}
      this.backupMicHighPass = null;
    }
    if (this.backupMicCompressor) {
      try { this.backupMicCompressor.disconnect(); } catch {}
      this.backupMicCompressor = null;
    }
    if (this.backupMicGainNode) {
      try { this.backupMicGainNode.disconnect(); } catch {}
      this.backupMicGainNode = null;
    }
    if (this.gameSource) {
      try { this.gameSource.disconnect(); } catch {}
      this.gameSource = null;
    }
    if (this.monitorGainNode) {
      try { this.monitorGainNode.disconnect(); } catch {}
      this.monitorGainNode = null;
    }
    if (this.micMonitorGainNode) {
      try { this.micMonitorGainNode.disconnect(); } catch {}
      this.micMonitorGainNode = null;
    }
    if (this.mergerNode) {
      try { this.mergerNode.disconnect(); } catch {}
      this.mergerNode = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try { this.audioCtx.close(); } catch {}
      this.audioCtx = null;
    }
  }
}
