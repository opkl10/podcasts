import { AudioInputDevice, VideoInputDevice } from './types';

// Detect and enumerate media devices with special flag for iPhone / Continuity Camera
export async function getMediaDevices(): Promise<{
  audioInputs: AudioInputDevice[];
  videoInputs: VideoInputDevice[];
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return { audioInputs: [], videoInputs: [] };
  }

  try {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {}

    const devices = await navigator.mediaDevices.enumerateDevices();

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    const audioInputs: AudioInputDevice[] = [];
    const videoInputs: VideoInputDevice[] = [];

    devices.forEach(device => {
      if (device.kind === 'audioinput') {
        audioInputs.push({
          deviceId: device.deviceId,
          label: device.label || `מיקרופון (${audioInputs.length + 1})`
        });
      } else if (device.kind === 'videoinput') {
        const labelLower = device.label.toLowerCase();
        const isIPhone = labelLower.includes('iphone') || labelLower.includes('continuity') || labelLower.includes('desk view') || labelLower.includes('center stage');
        const isContinuity = labelLower.includes('continuity') || labelLower.includes('iphone');

        videoInputs.push({
          deviceId: device.deviceId,
          label: device.label || `מצלמה (${videoInputs.length + 1})`,
          isIPhone,
          isContinuity
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

// High-Precision Video Resolution Constraints for Full HD & 4K Ultra HD
export function getVideoConstraints(resolution: VideoResolution = '1080p', deviceId?: string): MediaTrackConstraints {
  const base: MediaTrackConstraints = deviceId ? { deviceId: { ideal: deviceId } } : {};

  switch (resolution) {
    case '4k':
      return {
        ...base,
        width: { ideal: 3840, min: 1920 },
        height: { ideal: 2160, min: 1080 },
        frameRate: { ideal: 60, min: 30 }
      };
    case '1080p':
      return {
        ...base,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        frameRate: { ideal: 60, min: 30 }
      };
    case '720p':
    default:
      return {
        ...base,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
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
