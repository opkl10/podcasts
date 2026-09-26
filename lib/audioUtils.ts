import { SubtitleItem } from './types';
import { Mp3Encoder } from '@breezystack/lamejs';

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

// Convert Web Audio Buffer to 16-bit PCM WAV Blob
function audioBufferToWav(buffer: AudioBuffer, isMono = false): Blob {
  const numChannels = isMono ? 1 : Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length;
  const byteLength = length * blockAlign;
  const bufferArray = new ArrayBuffer(44 + byteLength);
  const view = new DataView(bufferArray);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + byteLength, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, byteLength, true);

  // Write Audio Channel Data with Peak Normalization
  if (isMono) {
    const channel0 = buffer.getChannelData(0);
    const channel1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    
    // Auto Gain Control: Boost quiet microphone inputs safely up to 3.5x
    let maxAmp = 0.001;
    for (let i = 0; i < length; i++) {
      const s = channel1 ? Math.max(Math.abs(channel0[i]), Math.abs(channel1[i])) : Math.abs(channel0[i]);
      if (s > maxAmp) maxAmp = s;
    }
    const gain = Math.min(3.5, 0.95 / maxAmp);

    let offset = 44;
    for (let i = 0; i < length; i++) {
      // Pick higher signal channel or mix without phase cancellation
      const raw = channel1 
        ? (Math.abs(channel0[i]) >= Math.abs(channel1[i]) ? channel0[i] : channel1[i])
        : channel0[i];
      const sample = Math.max(-1, Math.min(1, raw * gain));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  } else {
    // Stereo Interleaved
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const l = Math.max(-1, Math.min(1, left[i]));
      const r = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7FFF, true);
      view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7FFF, true);
      offset += 4;
    }
  }

  return new Blob([bufferArray], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Convert any Audio/Video Blob to Pure Stereo WAV
export async function convertBlobToStereoWav(blob: Blob): Promise<Blob> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const stereoWav = audioBufferToWav(audioBuffer, false);
  await audioContext.close();
  return stereoWav;
}

// Convert any Audio/Video Blob to Pure Downmixed Mono WAV
export async function convertBlobToMonoWav(blob: Blob): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const monoWav = audioBufferToWav(audioBuffer, true);
  await audioContext.close();
  return monoWav;
}

// Options for MP3 conversion
export interface Mp3ConversionOptions {
  bitrate?: number; // 128, 192, 256, 320 kbps (default 192)
  isMono?: boolean;
  normalize?: boolean; // Peak normalization (default true)
  onProgress?: (progress: number) => void;
}

// Convert Web Audio Buffer to Pure MP3 Blob using LAME MP3 Encoder
export function audioBufferToMp3(
  buffer: AudioBuffer,
  options: Mp3ConversionOptions = {}
): Blob {
  const { bitrate = 192, isMono = false, normalize = true, onProgress } = options;
  const numChannels = isMono ? 1 : Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;

  const leftFloat = buffer.getChannelData(0);
  const rightFloat = (numChannels > 1 && buffer.numberOfChannels > 1) ? buffer.getChannelData(1) : leftFloat;

  // Calculate safe broadcast loudness normalization gain
  let gain = 1.0;
  if (normalize) {
    let maxAmp = 0.001;
    for (let i = 0; i < length; i++) {
      const ampL = Math.abs(leftFloat[i]);
      if (ampL > maxAmp) maxAmp = ampL;
      if (numChannels > 1) {
        const ampR = Math.abs(rightFloat[i]);
        if (ampR > maxAmp) maxAmp = ampR;
      }
    }
    gain = Math.min(3.0, 0.98 / maxAmp);
  }

  const left = new Int16Array(length);
  const right = numChannels > 1 ? new Int16Array(length) : null;

  for (let i = 0; i < length; i++) {
    const sL = Math.max(-1, Math.min(1, leftFloat[i] * gain));
    left[i] = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
    if (right) {
      const sR = Math.max(-1, Math.min(1, rightFloat[i] * gain));
      right[i] = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
    }
  }

  const encoder = new Mp3Encoder(numChannels, sampleRate, bitrate);
  const mp3Data: Uint8Array[] = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < length; i += sampleBlockSize) {
    const leftChunk = left.subarray(i, i + sampleBlockSize);
    let mp3buf: Uint8Array;
    if (numChannels === 2 && right) {
      const rightChunk = right.subarray(i, i + sampleBlockSize);
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
    if (onProgress && (i % (sampleBlockSize * 15) === 0 || i + sampleBlockSize >= length)) {
      onProgress(Math.min(99, Math.round((i / length) * 100)));
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(endBuf);
  }
  if (onProgress) {
    onProgress(100);
  }

  return new Blob(mp3Data as BlobPart[], { type: 'audio/mp3' });
}

// Convert any Audio or Video Blob directly to High-Quality Broadcast MP3
export async function convertBlobToMp3(
  blob: Blob,
  options: Mp3ConversionOptions = {}
): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const mp3Blob = audioBufferToMp3(audioBuffer, options);
    return mp3Blob;
  } finally {
    try {
      await audioContext.close();
    } catch (e) {}
  }
}

// Acoustic Speech Clarity Filter Chain:
// 1. Highpass Filter (85 Hz) to remove low-frequency rumbles, AC hum, and microphone pops
// 2. Peaking EQ Filter (2800 Hz, +5dB, Q 1.2) to boost the formant/intelligibility frequency band of Hebrew consonants
// 3. DynamicsCompressorNode (threshold -32dB, knee 12dB, ratio 4:1, attack 0.003s, release 0.15s) to boost whispers and low-volume mumbling
export function applyAcousticSpeechEnhancement(
  offlineCtx: OfflineAudioContext,
  sourceNode: AudioNode,
  destinationNode: AudioNode
) {
  try {
    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;

    const speechPresence = offlineCtx.createBiquadFilter();
    speechPresence.type = 'peaking';
    speechPresence.frequency.value = 2800;
    speechPresence.Q.value = 1.2;
    speechPresence.gain.value = 5.0; // +5dB boost to speech intelligibility

    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -32;
    compressor.knee.value = 12;
    compressor.ratio.value = 4.0;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;

    // Chain: Source -> Highpass -> SpeechPresence -> Compressor -> Destination
    sourceNode.connect(highpass);
    highpass.connect(speechPresence);
    speechPresence.connect(compressor);
    compressor.connect(destinationNode);
  } catch (err) {
    console.warn('Acoustic speech enhancement fallback to direct connection:', err);
    sourceNode.connect(destinationNode);
  }
}

// Convert any Audio/Video Blob to Ultra-Lightweight 16kHz Speech-Optimized Mono WAV
export async function convertBlobToSpeechMonoWav(blob: Blob, targetSampleRate = 16000): Promise<Blob> {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(audioBuffer.duration * targetSampleRate),
      targetSampleRate
    );

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    applyAcousticSpeechEnhancement(offlineContext, source, offlineContext.destination);
    source.start(0);

    const resampledBuffer = await offlineContext.startRendering();
    return audioBufferToWav(resampledBuffer, true);
  } catch (e) {
    console.warn('Speech mono WAV downsampling fallback:', e);
    return convertBlobToMonoWav(blob);
  }
}

export interface AudioChunk {
  blob: Blob;
  startSec: number;
  endSec: number;
  durationSec: number;
  index: number;
  total: number;
}

// Convert Blob directly to base64 string
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Slice long Audio/Video Blob into 16kHz Mono WAV Chunks (Supports 20+, 60+, 120+ minute podcasts!)
export async function sliceAudioBlobIntoChunks(
  blob: Blob,
  chunkDurationSec: number = 120, // 2-minute chunks (safely ~3.8 MB each)
  targetSampleRate = 16000
): Promise<AudioChunk[]> {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();

    const totalDuration = audioBuffer.duration;
    const numChunks = Math.max(1, Math.ceil(totalDuration / chunkDurationSec));
    const chunks: AudioChunk[] = [];

    for (let i = 0; i < numChunks; i++) {
      const startSec = i * chunkDurationSec;
      const endSec = Math.min(totalDuration, (i + 1) * chunkDurationSec);
      const duration = endSec - startSec;

      if (duration <= 0.2) continue;

      const startSample = Math.floor(startSec * audioBuffer.sampleRate);
      const endSample = Math.min(audioBuffer.length, Math.floor(endSec * audioBuffer.sampleRate));
      const sampleLength = endSample - startSample;

      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(duration * targetSampleRate),
        targetSampleRate
      );

      const sliceBuffer = offlineCtx.createBuffer(
        audioBuffer.numberOfChannels,
        sampleLength,
        audioBuffer.sampleRate
      );

      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        const channelData = audioBuffer.getChannelData(c).subarray(startSample, endSample);
        sliceBuffer.copyToChannel(channelData, c, 0);
      }

      const source = offlineCtx.createBufferSource();
      source.buffer = sliceBuffer;
      applyAcousticSpeechEnhancement(offlineCtx, source, offlineCtx.destination);
      source.start(0);

      const resampledBuffer = await offlineCtx.startRendering();
      const chunkBlob = audioBufferToWav(resampledBuffer, true);

      chunks.push({
        blob: chunkBlob,
        startSec,
        endSec,
        durationSec: duration,
        index: i,
        total: numChunks
      });
    }

    return chunks;
  } catch (decodeErr) {
    console.warn('sliceAudioBlobIntoChunks decodeAudioData fallback to single chunk:', decodeErr);
    // Fallback: Return the original media blob directly as a single chunk
    return [{
      blob,
      startSec: 0,
      endSec: 120,
      durationSec: 120,
      index: 0,
      total: 1
    }];
  }
}

// Extract and Enhance a specific short audio snippet for granular re-decoding of unclear/mumbled speech
export async function extractAndEnhanceAudioSnippet(
  blob: Blob,
  startSec: number,
  endSec: number,
  targetSampleRate = 16000
): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  await audioContext.close();

  // Add 0.4s safety padding on each side to avoid clipping the first or last syllable
  const paddedStart = Math.max(0, startSec - 0.4);
  const paddedEnd = Math.min(audioBuffer.duration, endSec + 0.4);
  const duration = Math.max(0.2, paddedEnd - paddedStart);

  const startSample = Math.floor(paddedStart * audioBuffer.sampleRate);
  const endSample = Math.min(audioBuffer.length, Math.floor(paddedEnd * audioBuffer.sampleRate));
  const sampleLength = endSample - startSample;

  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil(duration * targetSampleRate),
    targetSampleRate
  );

  const snippetBuffer = offlineCtx.createBuffer(
    audioBuffer.numberOfChannels,
    sampleLength,
    audioBuffer.sampleRate
  );

  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const channelData = audioBuffer.getChannelData(c).subarray(startSample, endSample);
    snippetBuffer.copyToChannel(channelData, c, 0);
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = snippetBuffer;

  applyAcousticSpeechEnhancement(offlineCtx, source, offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return audioBufferToWav(renderedBuffer, true);
}

// Format seconds into SRT Timestamp (00:00:00,000)
export function formatSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Format seconds into WebVTT Timestamp (00:00:00.000)
export function formatVttTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// Parse SRT/VTT timestamp string (00:01:23,456 or 00:01:23.456) into seconds
export function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0;
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    const s = parseFloat(parts[2]) || 0;
    return Number((h * 3600 + m * 60 + s).toFixed(2));
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]) || 0;
    const s = parseFloat(parts[1]) || 0;
    return Number((m * 60 + s).toFixed(2));
  }
  return parseFloat(clean) || 0;
}

// Parse SRT string into SubtitleItem[]
export function parseSRT(srtContent: string): SubtitleItem[] {
  if (!srtContent || !srtContent.trim()) return [];
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const result: SubtitleItem[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].trim().split('\n');
    if (lines.length >= 2) {
      let timeLineIndex = 0;
      if (/^\d+$/.test(lines[0].trim())) {
        timeLineIndex = 1;
      }
      const timeLine = lines[timeLineIndex];
      if (timeLine && timeLine.includes('-->')) {
        const [startStr, endStr] = timeLine.split('-->');
        const startTime = parseTimestampToSeconds(startStr);
        const endTime = parseTimestampToSeconds(endStr);
        const textLines = lines.slice(timeLineIndex + 1).join(' ').trim();
        if (textLines) {
          result.push({
            id: `sub_srt_${Date.now()}_${i}`,
            startTime,
            endTime: Math.max(startTime + 0.5, endTime),
            text: textLines
          });
        }
      }
    }
  }
  return result;
}

// Parse WebVTT string into SubtitleItem[]
export function parseVTT(vttContent: string): SubtitleItem[] {
  if (!vttContent || !vttContent.trim()) return [];
  const clean = vttContent.replace(/^WEBVTT[^\n]*\n+/i, '');
  return parseSRT(clean);
}
// Export Subtitles Array to SRT String
export function exportToSRT(subtitles: SubtitleItem[]): string {
  return subtitles
    .sort((a, b) => a.startTime - b.startTime)
    .map((sub, index) => {
      const start = formatSrtTimestamp(sub.startTime);
      const end = formatSrtTimestamp(sub.endTime);
      return `${index + 1}\n${start} --> ${end}\n${sub.text.trim()}\n`;
    })
    .join('\n');
}

// Export Subtitles Array to WebVTT String
export function exportToVTT(subtitles: SubtitleItem[]): string {
  const header = 'WEBVTT - CastFlow Podcast Subtitles\n\n';
  const body = subtitles
    .sort((a, b) => a.startTime - b.startTime)
    .map((sub, index) => {
      const start = formatVttTimestamp(sub.startTime);
      const end = formatVttTimestamp(sub.endTime);
      return `${index + 1}\n${start} --> ${end}\n${sub.text.trim()}\n`;
    })
    .join('\n');
  return header + body;
}

// Generate Subtitles from Episode Outline & Topics
export function generateSubtitlesFromTopics(
  topics: { title: string; description?: string; talkingPoints?: string[]; questions?: string[] }[],
  totalDurationSeconds: number = 600,
  wordsPerLine: number = 4
): SubtitleItem[] {
  if (!topics || topics.length === 0) return [];

  const sentences: string[] = [];
  topics.forEach((topic, idx) => {
    sentences.push(`נושא ${idx + 1}: ${topic.title}`);
    if (topic.description) sentences.push(topic.description);
    if (topic.talkingPoints && topic.talkingPoints.length > 0) {
      topic.talkingPoints.forEach(p => sentences.push(p));
    }
    if (topic.questions && topic.questions.length > 0) {
      topic.questions.forEach(q => sentences.push(q));
    }
  });

  const fullText = sentences.join('. ');
  return splitTextIntoPacedSubtitles(fullText, wordsPerLine, 1, 0, totalDurationSeconds);
}

// Hebrew secular and calendar months for date normalization
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'מרס', 'אפריל', 'מאי', 'יוני', 'יולי', 
  'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
  'תשרי', 'חשוון', 'מרחשוון', 'כסלו', 'טבת', 'שבט', 'אדר א', 'אדר ב', 'אדר', 
  'ניסן', 'אייר', 'סיוון', 'סיון', 'תמוז', 'אב', 'אלול'
];

const HEBREW_DAYS_MAP: { words: string[]; num: number }[] = [
  { words: ['שלושים ואחד', 'שלושים ואחת'], num: 31 },
  { words: ['שלושים'], num: 30 },
  { words: ['עשרים ותשעה', 'עשרים ותשע'], num: 29 },
  { words: ['עשרים ושמונה'], num: 28 },
  { words: ['עשרים ושבעה', 'עשרים ושבע'], num: 27 },
  { words: ['עשרים ושישה', 'עשרים ושש'], num: 26 },
  { words: ['עשרים וחמישה', 'עשרים וחמש'], num: 25 },
  { words: ['עשרים וארבעה', 'עשרים וארבע'], num: 24 },
  { words: ['עשרים ושלושה', 'עשרים ושלוש'], num: 23 },
  { words: ['עשרים ושניים', 'עשרים ושתיים', 'עשרים ושני'], num: 22 },
  { words: ['עשרים ואחד', 'עשרים ואחת'], num: 21 },
  { words: ['עשרים'], num: 20 },
  { words: ['תשעה עשר', 'תשע עשרה'], num: 19 },
  { words: ['שמונה עשר', 'שמונה עשרה'], num: 18 },
  { words: ['שבעה עשר', 'שבע עשרה'], num: 17 },
  { words: ['שישה עשר', 'שש עשרה'], num: 16 },
  { words: ['חמישה עשר', 'חמש עשרה'], num: 15 },
  { words: ['ארבעה עשר', 'ארבע עשרה'], num: 14 },
  { words: ['שלושה עשר', 'שלוש עשרה'], num: 13 },
  { words: ['שנים עשר', 'שניים עשר', 'שתים עשרה', 'שתיים עשרה'], num: 12 },
  { words: ['אחד עשר', 'אחת עשרה'], num: 11 },
  { words: ['עשרה', 'עשר'], num: 10 },
  { words: ['תשעה', 'תשע'], num: 9 },
  { words: ['שמונה'], num: 8 },
  { words: ['שבעה', 'שבע'], num: 7 },
  { words: ['שישה', 'שש'], num: 6 },
  { words: ['חמישה', 'חמש'], num: 5 },
  { words: ['ארבעה', 'ארבע'], num: 4 },
  { words: ['שלושה', 'שלוש'], num: 3 },
  { words: ['שניים', 'שני', 'שתיים'], num: 2 },
  { words: ['ראשון', 'אחד', 'אחת'], num: 1 }
];

const HEBREW_YEARS_MAP: { words: string[]; year: number }[] = [
  { words: ['אלפיים שלושים וחמש'], year: 2035 },
  { words: ['אלפיים שלושים'], year: 2030 },
  { words: ['אלפיים עשרים ותשע', 'אלפיים ועשרים ותשע'], year: 2029 },
  { words: ['אלפיים עשרים ושמונה', 'אלפיים ועשרים ושמונה'], year: 2028 },
  { words: ['אלפיים עשרים ושבע', 'אלפיים ועשרים ושבע'], year: 2027 },
  { words: ['אלפיים עשרים ושש', 'אלפיים ועשרים ושש'], year: 2026 },
  { words: ['אלפיים עשרים וחמש', 'אלפיים ועשרים וחמש'], year: 2025 },
  { words: ['אלפיים עשרים וארבע', 'אלפיים ועשרים וארבע'], year: 2024 },
  { words: ['אלפיים עשרים ושלוש', 'אלפיים ועשרים ושלוש'], year: 2023 },
  { words: ['אלפיים עשרים ושתיים', 'אלפיים ועשרים ושתיים'], year: 2022 },
  { words: ['אלפיים עשרים ואחת', 'אלפיים ועשרים ואחת'], year: 2021 },
  { words: ['אלפיים עשרים', 'אלפיים ועשרים'], year: 2020 },
  { words: ['אלפיים ותשע עשרה', 'אלפיים תשע עשרה'], year: 2019 },
  { words: ['אלפיים ושמונה עשרה', 'אלפיים שמונה עשרה'], year: 2018 },
  { words: ['אלפיים ושבע עשרה', 'אלפיים שבע עשרה'], year: 2017 },
  { words: ['אלפיים ושש עשרה', 'אלפיים שש עשרה'], year: 2016 },
  { words: ['אלפיים וחמש עשרה', 'אלפיים חמש עשרה'], year: 2015 },
  { words: ['אלפיים וארבע עשרה', 'אלפיים ארבע עשרה'], year: 2014 },
  { words: ['אלפיים ושלוש עשרה', 'אלפיים שלוש עשרה'], year: 2013 },
  { words: ['אלפיים ושתים עשרה', 'אלפיים שתים עשרה'], year: 2012 },
  { words: ['אלפיים ואחת עשרה', 'אלפיים אחת עשרה'], year: 2011 },
  { words: ['אלפיים ועשר', 'אלפיים עשר'], year: 2010 },
  { words: ['אלפיים ותשע'], year: 2009 },
  { words: ['אלפיים ושמונה'], year: 2008 },
  { words: ['אלפיים ושבע'], year: 2007 },
  { words: ['אלפיים ושש'], year: 2006 },
  { words: ['אלפיים וחמש'], year: 2005 },
  { words: ['אלפיים וארבע'], year: 2004 },
  { words: ['אלפיים ושלוש'], year: 2003 },
  { words: ['אלפיים ושתיים'], year: 2002 },
  { words: ['אלפיים ואחת'], year: 2001 },
  { words: ['אלפיים'], year: 2000 },
  { words: ['תשע עשרה שמונים וארבע'], year: 1984 },
  { words: ['אלף תשע מאות תשעים'], year: 1990 },
  { words: ['אלף תשע מאות שמונים'], year: 1980 },
  { words: ['אלף תשע מאות שבעים'], year: 1970 }
];

const HEBREW_PERCENT_MAP: { words: string[]; val: string }[] = [
  { words: ['מאה אחוז'], val: '100%' },
  { words: ['תשעים ותשעה אחוז', 'תשעים ותשע אחוז'], val: '99%' },
  { words: ['תשעים אחוז'], val: '90%' },
  { words: ['שמונים וחמישה אחוז', 'שמונים וחמש אחוז'], val: '85%' },
  { words: ['שמונים אחוז'], val: '80%' },
  { words: ['שבעים וחמישה אחוז', 'שבעים וחמש אחוז'], val: '75%' },
  { words: ['שבעים אחוז'], val: '70%' },
  { words: ['שישים אחוז', 'ששים אחוז'], val: '60%' },
  { words: ['חמישים אחוז'], val: '50%' },
  { words: ['ארבעים אחוז'], val: '40%' },
  { words: ['שלושים אחוז'], val: '30%' },
  { words: ['עשרים וחמישה אחוז', 'עשרים וחמש אחוז'], val: '25%' },
  { words: ['עשרים אחוז'], val: '20%' },
  { words: ['חמישה עשר אחוז', 'חמש עשרה אחוז'], val: '15%' },
  { words: ['עשרה אחוזים', 'עשרה אחוז', 'עשר אחוז'], val: '10%' },
  { words: ['חמישה אחוזים', 'חמישה אחוז', 'חמש אחוז'], val: '5%' }
];

const HEBREW_UNITS_MAP: { words: string[]; val: string }[] = [
  { words: ['עשרים וארבע שעות', 'עשרים וארבעה שעות'], val: '24 שעות' },
  { words: ['ארבעים ושמונה שעות'], val: '48 שעות' },
  { words: ['שבעים ושתיים שעות'], val: '72 שעות' },
  { words: ['שבעה ימים', 'שבע ימים'], val: '7 ימים' },
  { words: ['ארבעה עשר יום', 'ארבעה עשר ימים'], val: '14 ימים' },
  { words: ['שלושים יום', 'שלושים ימים'], val: '30 ימים' },
  { words: ['עשרה שקלים', 'עשר שקלים'], val: '10 שקלים' },
  { words: ['עשרים שקלים', 'עשרים שקל'], val: '20 ש״ח' },
  { words: ['חמישים שקלים', 'חמישים שקל'], val: '50 ש״ח' },
  { words: ['מאה שקלים', 'מאה שקל'], val: '100 ש״ח' },
  { words: ['מאתיים שקל', 'מאתיים שקלים'], val: '200 ש״ח' },
  { words: ['חמש מאות שקל', 'חמש מאות שקלים'], val: '500 ש״ח' },
  { words: ['אלף שקל', 'אלף שקלים'], val: '1,000 ש״ח' },
  { words: ['מאה דולר'], val: '100$' },
  { words: ['אלף דולר'], val: '1,000$' },
  { words: ['מיליון דולר'], val: '1,000,000$' }
];

// Remove hesitation and filler sounds in Hebrew and English speech ("אה", "אממ", "uh", "um", etc.)
export function removeHebrewFillerWords(text: string): { cleaned: string; removedCount: number } {
  if (!text) return { cleaned: '', removedCount: 0 };
  let count = 0;
  
  // Safe boundaries in Hebrew and English text
  const fillerRegex = /(?:^|(?<=[\s,;:.!?()"'״׳\-–—]))(?:[ושכ])?(?:אה+|אמ+|אהמ+|המ+|אֶה|עמ+|uh+|um+|er+|ah+|eh+|hmm+)[.…]*(?=[,\s;:.!?()"'״׳\-–—]|$)/gi;

  let cleaned = text.replace(fillerRegex, () => {
    count++;
    return '';
  });

  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,\.!\?:;…])/g, '$1')
    .replace(/^[,;:]\s*/, '')
    .replace(/([,\.!\?:;…])\s*([,\.!\?:;…])/g, '$1')
    .trim();

  return { cleaned, removedCount: count };
}

// Convert written-out Hebrew dates, spelled years, percentages and common units to digits
export function convertHebrewDatesAndWordsToNumbers(text: string): { cleaned: string; convertedCount: number } {
  if (!text) return { cleaned: '', convertedCount: 0 };
  let res = text;
  let count = 0;

  // 1. Full dates: [ב/ל]? [day_words] ב/ל?[month]
  const dayEntries: { word: string; num: number }[] = [];
  for (const item of HEBREW_DAYS_MAP) {
    for (const w of item.words) {
      dayEntries.push({ word: w, num: item.num });
    }
  }
  dayEntries.sort((a, b) => b.word.length - a.word.length);

  const monthsPattern = HEBREW_MONTHS.join('|');

  for (const d of dayEntries) {
    const escapedDay = d.word.replace(/\s+/g, '\\s+');
    const dateRegex = new RegExp(
      '(?:^|(?<=[\\s,;:.!?()\"\'״׳\\-–—]))(ב|ל)?(' + escapedDay + ')\\s+(ב|ל|בחודש\\s+)?(' + monthsPattern + ')(?=[,\\s;:.!?()\"\'״׳\\-–—]|$)',
      'gi'
    );
    res = res.replace(dateRegex, (match, prefix, dayW, monthPrefix, month) => {
      count++;
      const p = prefix ? (prefix === 'ב' ? 'ב-' : prefix === 'ל' ? 'ל-' : prefix) : '';
      const mp = monthPrefix ? (monthPrefix.startsWith('בחודש') ? ' בחודש ' : 'ב') : 'ב';
      return (p ? p : '') + d.num + ' ' + mp + month;
    });
  }

  // Also normalize already-numeric day followed by "ל[חודש]": e.g. "19 לספטמבר" -> "19 בספטמבר", "ב-19 לספטמבר" -> "ב-19 בספטמבר"
  const numericDateRegex = new RegExp(
    '(?:^|(?<=[\\s,;:.!?()\"\'״׳\\-–—]))(ב-|ב|ל-|ל)?(\\d{1,2})\\s+(ל)(' + monthsPattern + ')(?=[,\\s;:.!?()\"\'״׳\\-–—]|$)',
    'gi'
  );
  res = res.replace(numericDateRegex, (match, prefix, dayNum, lPrefix, month) => {
    count++;
    const p = prefix ? (prefix.startsWith('ב') ? 'ב-' : 'ל-') : '';
    return p + dayNum + ' ב' + month;
  });

  // 2. Year expressions: "שנת אלפיים עשרים ושש" -> "שנת 2026", "בשנת 2024", etc.
  for (const y of HEBREW_YEARS_MAP) {
    for (const w of y.words) {
      const escapedYear = w.replace(/\s+/g, '\\s+');
      const yearRegex = new RegExp(
        '(?:^|(?<=[\\s,;:.!?()\"\'״׳\\-–—]))(בשנת|שנת|משנת|עד שנת|ב)?(' + escapedYear + ')(?=[,\\s;:.!?()\"\'״׳\\-–—]|$)',
        'gi'
      );
      res = res.replace(yearRegex, (match, prefix) => {
        count++;
        if (prefix === 'ב') return 'ב-' + y.year;
        if (prefix) return prefix + ' ' + y.year;
        return String(y.year);
      });
    }
  }

  // 3. Percentages: "מאה אחוז" -> "100%", etc.
  for (const p of HEBREW_PERCENT_MAP) {
    for (const w of p.words) {
      const escaped = w.replace(/\s+/g, '\\s+');
      const r = new RegExp('(?:^|(?<=[\\s,;:.!?()\"\'״׳\\-–—]))' + escaped + '(?=[,\\s;:.!?()\"\'״׳\\-–—]|$)', 'gi');
      res = res.replace(r, () => {
        count++;
        return p.val;
      });
    }
  }

  // 4. Units & quantities: "עשרים וארבע שעות" -> "24 שעות", etc.
  for (const u of HEBREW_UNITS_MAP) {
    for (const w of u.words) {
      const escaped = w.replace(/\s+/g, '\\s+');
      const r = new RegExp('(?:^|(?<=[\\s,;:.!?()\"\'״׳\\-–—]))' + escaped + '(?=[,\\s;:.!?()\"\'״׳\\-–—]|$)', 'gi');
      res = res.replace(r, () => {
        count++;
        return u.val;
      });
    }
  }

  return { cleaned: res.replace(/\s{2,}/g, ' ').trim(), convertedCount: count };
}

// Clean and polish Hebrew subtitle text (removes filler sounds, converts dates and numbers to digits, fixes spacing and punctuation)
export function cleanAndPolishHebrewSubtitleText(
  text: string,
  options?: { removeFillers?: boolean; formatDatesAndNumbers?: boolean }
): string {
  if (!text) return '';
  let result = text;

  const removeFillers = options?.removeFillers ?? true;
  const formatDatesAndNumbers = options?.formatDatesAndNumbers ?? true;

  if (removeFillers) {
    result = removeHebrewFillerWords(result).cleaned;
  }

  if (formatDatesAndNumbers) {
    result = convertHebrewDatesAndWordsToNumbers(result).cleaned;
  }

  return result
    .replace(/\s+/g, ' ')
    .replace(/\s+([,\.!\?:;…])/g, '$1')
    .replace(/^[,;:]\s*/, '')
    .trim();
}

// Batch cleanup helper for an array of SubtitleItems
export function processSubtitlesCleanup(
  subtitles: SubtitleItem[],
  options?: {
    removeFillers?: boolean;
    formatDatesAndNumbers?: boolean;
    dropEmptyCues?: boolean;
  }
): {
  subtitles: SubtitleItem[];
  fillersRemoved: number;
  datesConverted: number;
  emptyCuesDropped: number;
} {
  if (!subtitles || subtitles.length === 0) {
    return { subtitles: [], fillersRemoved: 0, datesConverted: 0, emptyCuesDropped: 0 };
  }

  const removeFillers = options?.removeFillers ?? true;
  const formatDatesAndNumbers = options?.formatDatesAndNumbers ?? true;
  const dropEmptyCues = options?.dropEmptyCues ?? true;

  let totalFillers = 0;
  let totalDates = 0;
  let emptyDropped = 0;

  const cleanedItems: SubtitleItem[] = [];

  for (const item of subtitles) {
    let text = item.text || '';

    if (removeFillers) {
      const fRes = removeHebrewFillerWords(text);
      text = fRes.cleaned;
      totalFillers += fRes.removedCount;
    }

    if (formatDatesAndNumbers) {
      const dRes = convertHebrewDatesAndWordsToNumbers(text);
      text = dRes.cleaned;
      totalDates += dRes.convertedCount;
    }

    text = text
      .replace(/\s+/g, ' ')
      .replace(/\s+([,\.!\?:;…])/g, '$1')
      .replace(/^[,;:]\s*/, '')
      .trim();

    if (!text && dropEmptyCues) {
      emptyDropped++;
      continue;
    }

    cleanedItems.push({
      ...item,
      text
    });
  }

  return {
    subtitles: cleanedItems,
    fillersRemoved: totalFillers,
    datesConverted: totalDates,
    emptyCuesDropped: emptyDropped
  };
}

// Build Subtitle Cues Directly from Whisper Acoustic Word-Level Timestamps
export function buildSubtitlesFromWhisperWords(
  words: WhisperWord[],
  wordsPerLine: number = 4
): SubtitleItem[] {
  if (!words || words.length === 0) return [];

  const validWords = words.filter(w => w.word && w.word.trim().length > 0);
  if (validWords.length === 0) return [];

  const subtitles: SubtitleItem[] = [];
  let currentGroup: WhisperWord[] = [];

  for (let i = 0; i < validWords.length; i++) {
    const w = validWords[i];
    const prevW = currentGroup[currentGroup.length - 1];

    // Check for natural pause (gap > 0.65s) or punctuation ending (. ! ?) or reached word count
    const hasLongPause = prevW ? (w.start - prevW.end) > 0.65 : false;
    const prevEndsWithPunctuation = prevW ? /[.!?]$/.test(prevW.word.trim()) : false;

    if (currentGroup.length >= wordsPerLine || hasLongPause || prevEndsWithPunctuation) {
      if (currentGroup.length > 0) {
        subtitles.push({
          id: `sub_w_${Date.now()}_${subtitles.length}_${Math.random().toString(36).substring(2, 5)}`,
          startTime: Number(currentGroup[0].start.toFixed(2)),
          endTime: Number(currentGroup[currentGroup.length - 1].end.toFixed(2)),
          text: currentGroup.map(item => item.word.trim()).join(' ')
        });
        currentGroup = [];
      }
    }

    currentGroup.push(w);
  }

  if (currentGroup.length > 0) {
    subtitles.push({
      id: `sub_w_${Date.now()}_${subtitles.length}_${Math.random().toString(36).substring(2, 5)}`,
      startTime: Number(currentGroup[0].start.toFixed(2)),
      endTime: Number(currentGroup[currentGroup.length - 1].end.toFixed(2)),
      text: currentGroup.map(item => item.word.trim()).join(' ')
    });
  }

  return subtitles;
}

export interface TimedWord {
  word: string;
  start: number;
  end: number;
  speaker?: string;
}

// Convert any timed word array (Whisper / ElevenLabs) into paced SubtitleItem[] with diarization support
export function buildSubtitlesFromTimedWords(
  words: TimedWord[],
  wordsPerLine: number = 4
): SubtitleItem[] {
  if (!words || words.length === 0) return [];

  const validWords = words.filter(w => w.word && w.word.trim().length > 0);
  if (validWords.length === 0) return [];

  const subtitles: SubtitleItem[] = [];
  let currentGroup: TimedWord[] = [];

  for (let i = 0; i < validWords.length; i++) {
    const w = validWords[i];
    const prevW = currentGroup[currentGroup.length - 1];

    const hasLongPause = prevW ? (w.start - prevW.end) > 0.65 : false;
    const prevEndsWithPunctuation = prevW ? /[.!?]$/.test(prevW.word.trim()) : false;
    const speakerChanged = prevW && w.speaker && prevW.speaker && w.speaker !== prevW.speaker;

    if (currentGroup.length >= wordsPerLine || hasLongPause || prevEndsWithPunctuation || speakerChanged) {
      if (currentGroup.length > 0) {
        subtitles.push({
          id: `sub_el_${Date.now()}_${subtitles.length}_${Math.random().toString(36).substring(2, 5)}`,
          startTime: Number(currentGroup[0].start.toFixed(2)),
          endTime: Number(currentGroup[currentGroup.length - 1].end.toFixed(2)),
          text: currentGroup.map(item => item.word.trim()).join(' '),
          speaker: currentGroup[0].speaker
        });
        currentGroup = [];
      }
    }

    currentGroup.push(w);
  }

  if (currentGroup.length > 0) {
    subtitles.push({
      id: `sub_el_${Date.now()}_${subtitles.length}_${Math.random().toString(36).substring(2, 5)}`,
      startTime: Number(currentGroup[0].start.toFixed(2)),
      endTime: Number(currentGroup[currentGroup.length - 1].end.toFixed(2)),
      text: currentGroup.map(item => item.word.trim()).join(' '),
      speaker: currentGroup[0].speaker
    });
  }

  return subtitles;
}

// Convert ElevenLabs character-level alignment from /with-timestamps to TimedWord[]
export function parseElevenLabsAlignmentToTimedWords(
  alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  },
  speakerName?: string
): TimedWord[] {
  if (!alignment || !alignment.characters || alignment.characters.length === 0) return [];
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  const timedWords: TimedWord[] = [];

  let currentWord = '';
  let wordStart = -1;
  let wordEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const start = character_start_times_seconds[i] ?? 0;
    const end = character_end_times_seconds[i] ?? (start + 0.1);

    if (char === ' ' || char === '\n' || char === '\t') {
      if (currentWord.trim().length > 0) {
        timedWords.push({
          word: currentWord.trim(),
          start: Number(wordStart.toFixed(2)),
          end: Number(wordEnd.toFixed(2)),
          speaker: speakerName
        });
        currentWord = '';
        wordStart = -1;
      }
    } else {
      if (wordStart === -1) {
        wordStart = start;
      }
      currentWord += char;
      wordEnd = end;
    }
  }

  if (currentWord.trim().length > 0) {
    timedWords.push({
      word: currentWord.trim(),
      start: Number(wordStart.toFixed(2)),
      end: Number(wordEnd.toFixed(2)),
      speaker: speakerName
    });
  }

  return timedWords;
}

// Smart Subtitle Pacing Splitter: Splits raw text into timed chunks
export function splitTextIntoPacedSubtitles(
  rawText: string,
  wordsPerLine: number = 4,
  maxLines: number = 1,
  startOffsetSeconds: number = 0,
  totalDurationSeconds: number = 60
): SubtitleItem[] {
  const cleaned = cleanAndPolishHebrewSubtitleText(rawText);
  const words = cleaned.split(' ').filter(w => w.trim().length > 0);
  if (words.length === 0) return [];

  const maxWordsPerSub = wordsPerLine * maxLines;
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += maxWordsPerSub) {
    const chunkWords = words.slice(i, i + maxWordsPerSub);
    if (maxLines > 1 && chunkWords.length > wordsPerLine) {
      const line1 = chunkWords.slice(0, wordsPerLine).join(' ');
      const line2 = chunkWords.slice(wordsPerLine).join(' ');
      chunks.push(`${line1}\n${line2}`);
    } else {
      chunks.push(chunkWords.join(' '));
    }
  }

  const durationPerChunk = Math.max(1.0, totalDurationSeconds / chunks.length);

  return chunks.map((chunkText, idx) => {
    const start = startOffsetSeconds + idx * durationPerChunk;
    const end = Math.min(startOffsetSeconds + totalDurationSeconds, start + durationPerChunk - 0.05);
    return {
      id: `sub_${Date.now()}_${idx}`,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      text: chunkText
    };
  });
}

// Smart Rebalancer: Takes existing subtitles with real recorded timestamps and re-chunks them into short, punchy 3-5 word lines
export function smartRebalanceSubtitles(
  subtitles: SubtitleItem[],
  targetWordsPerLine: number = 4,
  maxLines: number = 1
): SubtitleItem[] {
  if (!subtitles || subtitles.length === 0) return [];

  const newSubtitles: SubtitleItem[] = [];
  const maxWordsPerCard = targetWordsPerLine * maxLines;

  for (const sub of subtitles) {
    const cleaned = cleanAndPolishHebrewSubtitleText(sub.text);
    const words = cleaned.split(' ').filter(w => w.trim().length > 0);
    if (words.length === 0) continue;

    if (words.length <= maxWordsPerCard) {
      newSubtitles.push({
        ...sub,
        text: words.join(' ')
      });
      continue;
    }

    // Split long cue into smaller proportional cues
    const totalDuration = Math.max(0.6, sub.endTime - sub.startTime);
    const totalChars = cleaned.length || 1;
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += maxWordsPerCard) {
      const chunkWords = words.slice(i, i + maxWordsPerCard);
      if (maxLines > 1 && chunkWords.length > targetWordsPerLine) {
        const l1 = chunkWords.slice(0, targetWordsPerLine).join(' ');
        const l2 = chunkWords.slice(targetWordsPerLine).join(' ');
        chunks.push(`${l1}\n${l2}`);
      } else {
        chunks.push(chunkWords.join(' '));
      }
    }

    let currentStart = sub.startTime;
    chunks.forEach((chunkText, cIdx) => {
      const chunkWeight = Math.max(0.15, chunkText.length / totalChars);
      const chunkDuration = totalDuration * chunkWeight;
      const chunkEnd = cIdx === chunks.length - 1 
        ? sub.endTime 
        : Number((currentStart + chunkDuration).toFixed(2));

      newSubtitles.push({
        id: `sub_rebalanced_${Date.now()}_${cIdx}_${Math.random().toString(36).substring(2, 5)}`,
        startTime: Number(currentStart.toFixed(2)),
        endTime: Number(chunkEnd.toFixed(2)),
        text: chunkText,
        speaker: sub.speaker,
        customStyle: sub.customStyle
      });

      currentStart = chunkEnd + 0.05;
    });
  }

  // Ensure timestamps are monotonic and sorted
  return newSubtitles.sort((a, b) => a.startTime - b.startTime);
}

// Split a single subtitle card at a specific word index
export function splitSubtitleItemAtWordIndex(sub: SubtitleItem, wordIndex: number): [SubtitleItem, SubtitleItem] {
  const words = sub.text.trim().replace(/\s+/g, ' ').split(' ');
  const safeIndex = Math.max(1, Math.min(words.length - 1, wordIndex));
  
  const part1Text = words.slice(0, safeIndex).join(' ');
  const part2Text = words.slice(safeIndex).join(' ');

  const totalDuration = Math.max(0.4, sub.endTime - sub.startTime);
  const ratio = safeIndex / words.length;
  const splitTime = Number((sub.startTime + totalDuration * ratio).toFixed(2));

  const sub1: SubtitleItem = {
    id: `sub_split1_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    startTime: sub.startTime,
    endTime: Math.max(sub.startTime + 0.1, Number((splitTime - 0.05).toFixed(2))),
    text: part1Text,
    speaker: sub.speaker,
    customStyle: sub.customStyle
  };

  const sub2: SubtitleItem = {
    id: `sub_split2_${Date.now() + 1}_${Math.random().toString(36).substring(2, 5)}`,
    startTime: splitTime,
    endTime: sub.endTime,
    text: part2Text,
    speaker: sub.speaker,
    customStyle: sub.customStyle
  };

  return [sub1, sub2];
}

// Split a single subtitle card right down the middle
export function splitSubtitleItemAtMiddle(sub: SubtitleItem): [SubtitleItem, SubtitleItem] {
  const words = sub.text.trim().replace(/\s+/g, ' ').split(' ');
  const mid = Math.ceil(words.length / 2);
  return splitSubtitleItemAtWordIndex(sub, mid);
}

// Semantic Sentence Splitter: Groups and splits subtitles strictly by natural punctuation (. , ? ! - :) and Hebrew conjunctions
export function segmentSubtitlesByPunctuation(subtitles: SubtitleItem[]): SubtitleItem[] {
  if (!subtitles || subtitles.length === 0) return [];

  const results: SubtitleItem[] = [];

  for (const sub of subtitles) {
    const text = cleanAndPolishHebrewSubtitleText(sub.text);
    // Split by punctuation marks while keeping the punctuation with the preceding sentence
    const parts = text.split(/(?<=[.!?,\-–—:;])\s+/).filter(p => p.trim().length > 0);

    if (parts.length <= 1) {
      results.push(sub);
      continue;
    }

    const totalDuration = Math.max(0.6, sub.endTime - sub.startTime);
    const totalChars = text.length || 1;
    let currentStart = sub.startTime;

    parts.forEach((part, pIdx) => {
      const weight = Math.max(0.15, part.length / totalChars);
      const partDuration = totalDuration * weight;
      const partEnd = pIdx === parts.length - 1 
        ? sub.endTime 
        : Number((currentStart + partDuration).toFixed(2));

      results.push({
        id: `sub_punct_${Date.now()}_${pIdx}_${Math.random().toString(36).substring(2, 5)}`,
        startTime: Number(currentStart.toFixed(2)),
        endTime: Number(partEnd.toFixed(2)),
        text: part.trim(),
        speaker: sub.speaker,
        customStyle: sub.customStyle
      });

      currentStart = partEnd + 0.05;
    });
  }

  return results.sort((a, b) => a.startTime - b.startTime);
}

// Max Character Limit Segmenter: Ensures no subtitle line exceeds maxChars (e.g. 28 chars for mobile / Reels)
export function segmentSubtitlesByMaxChars(subtitles: SubtitleItem[], maxChars: number = 30): SubtitleItem[] {
  if (!subtitles || subtitles.length === 0) return [];

  const results: SubtitleItem[] = [];

  for (const sub of subtitles) {
    const cleaned = cleanAndPolishHebrewSubtitleText(sub.text);
    if (cleaned.length <= maxChars) {
      results.push(sub);
      continue;
    }

    const words = cleaned.split(' ').filter(w => w.trim().length > 0);
    const lines: string[] = [];
    let currentLine = '';

    for (const w of words) {
      if ((currentLine + ' ' + w).trim().length <= maxChars) {
        currentLine = (currentLine + ' ' + w).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = w;
      }
    }
    if (currentLine) lines.push(currentLine);

    const totalDuration = Math.max(0.6, sub.endTime - sub.startTime);
    const totalChars = cleaned.length || 1;
    let currentStart = sub.startTime;

    lines.forEach((line, lIdx) => {
      const weight = Math.max(0.15, line.length / totalChars);
      const lineDuration = totalDuration * weight;
      const lineEnd = lIdx === lines.length - 1 
        ? sub.endTime 
        : Number((currentStart + lineDuration).toFixed(2));

      results.push({
        id: `sub_char_${Date.now()}_${lIdx}_${Math.random().toString(36).substring(2, 5)}`,
        startTime: Number(currentStart.toFixed(2)),
        endTime: Number(lineEnd.toFixed(2)),
        text: line.trim(),
        speaker: sub.speaker,
        customStyle: sub.customStyle
      });

      currentStart = lineEnd + 0.05;
    });
  }

  return results.sort((a, b) => a.startTime - b.startTime);
}

// Merge subtitle at index with next subtitle
export function mergeSubtitleWithNext(subtitles: SubtitleItem[], index: number): SubtitleItem[] {
  if (index < 0 || index >= subtitles.length - 1) return subtitles;
  const current = subtitles[index];
  const next = subtitles[index + 1];

  const merged: SubtitleItem = {
    id: current.id,
    startTime: current.startTime,
    endTime: next.endTime,
    text: `${current.text} ${next.text}`.trim(),
    speaker: current.speaker || next.speaker,
    customStyle: current.customStyle
  };

  const copy = [...subtitles];
  copy.splice(index, 2, merged);
  return copy;
}

// Merge subtitle at index with previous subtitle
export function mergeSubtitleWithPrevious(subtitles: SubtitleItem[], index: number): SubtitleItem[] {
  if (index <= 0 || index >= subtitles.length) return subtitles;
  return mergeSubtitleWithNext(subtitles, index - 1);
}

// Shift all timestamps by +/- delta seconds to fix global latency / audio offset
export function shiftAllSubtitleTimestamps(subtitles: SubtitleItem[], deltaSeconds: number): SubtitleItem[] {
  return subtitles.map(s => ({
    ...s,
    startTime: Number(Math.max(0, s.startTime + deltaSeconds).toFixed(2)),
    endTime: Number(Math.max(0.1, s.endTime + deltaSeconds).toFixed(2))
  }));
}

// Slice / Trim Audio Blob between startSeconds and endSeconds
export async function trimAudioBlob(blob: Blob, startSeconds: number, endSeconds: number): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const sampleRate = audioBuffer.sampleRate;
  const startOffset = Math.max(0, Math.floor(startSeconds * sampleRate));
  const endOffset = Math.min(audioBuffer.length, Math.floor(endSeconds * sampleRate));
  const frameCount = Math.max(1, endOffset - startOffset);
  
  const trimmedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    frameCount,
    sampleRate
  );
  
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    const channelData = audioBuffer.getChannelData(i);
    const trimmedData = trimmedBuffer.getChannelData(i);
    trimmedData.set(channelData.subarray(startOffset, endOffset));
  }
  
  await audioContext.close();
  return audioBufferToWav(trimmedBuffer, false);
}

// Multi-Speaker Diarization Color Palette & Utilities
export const DEFAULT_SPEAKER_COLORS = [
  '#06b6d4', // Cyan
  '#f59e0b', // Amber / Gold
  '#ec4899', // Pink / Rose
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#f97316', // Orange
  '#3b82f6', // Blue
  '#14b8a6', // Teal
  '#e11d48'  // Crimson
];

export function getSpeakerColor(speakerName?: string, customMap?: Record<string, string>): string {
  if (!speakerName) return '#06b6d4';
  const cleanName = speakerName.trim();
  if (customMap && customMap[cleanName]) {
    return customMap[cleanName];
  }
  // Check for common 'דובר 1', 'דובר 2' pattern
  const match = cleanName.match(/\d+/);
  if (match) {
    const num = parseInt(match[0], 10);
    if (!isNaN(num) && num > 0) {
      return DEFAULT_SPEAKER_COLORS[(num - 1) % DEFAULT_SPEAKER_COLORS.length];
    }
  }
  // Deterministic color hash based on string
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEFAULT_SPEAKER_COLORS.length;
  return DEFAULT_SPEAKER_COLORS[index];
}

// ========================================================
// Audio Splice & Filler Sound Removal Engine ("אה", "אממ")
// ========================================================

export interface AudioCutInterval {
  start: number;
  end: number;
  label?: string;
  subtitleId?: string;
}

export interface RemoveFillerAudioResult {
  cleanedBlob: Blob;
  totalCuts: number;
  totalDurationCutSeconds: number;
  updatedSubtitles: SubtitleItem[];
  intervalsCut: AudioCutInterval[];
}

/**
 * Detect all time intervals in subtitles where filler sounds ("אה", "אממ", "אהה", "הממ", "uh", "um", etc.) occur.
 */
export function detectFillerIntervalsFromSubtitles(
  subtitles: SubtitleItem[],
  minCutDurationSec: number = 0.25,
  maxCutDurationSec: number = 3.5
): AudioCutInterval[] {
  if (!subtitles || subtitles.length === 0) return [];

  const intervals: AudioCutInterval[] = [];

  for (const sub of subtitles) {
    const rawText = (sub.text || '').trim();
    if (!rawText) continue;

    // Check if the entire cue is a filler sound
    const cleaned = removeHebrewFillerWords(rawText).cleaned;
    const dur = sub.endTime - sub.startTime;

    const isPureFiller = cleaned.length === 0;
    const startsWithFiller = /^(?:אה+|אמ+|אהמ+|המ+|אֶה|uh+|um+|er+|ah+)[.…]*\s+/i.test(rawText);
    const endsWithFiller = /\s+(?:אה+|אמ+|אהמ+|המ+|אֶה|uh+|um+|er+|ah+)[.…]*$/i.test(rawText);

    if (isPureFiller) {
      if (dur >= minCutDurationSec && dur <= maxCutDurationSec) {
        intervals.push({
          start: Math.max(0, sub.startTime),
          end: sub.endTime,
          label: rawText,
          subtitleId: sub.id
        });
      }
    } else if (startsWithFiller && dur > 1.0) {
      // Estimate first ~0.4s is the filler
      intervals.push({
        start: Math.max(0, sub.startTime),
        end: Math.min(sub.endTime, sub.startTime + 0.45),
        label: 'היסוס בתחילת משפט',
        subtitleId: sub.id
      });
    } else if (endsWithFiller && dur > 1.0) {
      // Estimate last ~0.4s is the filler
      intervals.push({
        start: Math.max(sub.startTime, sub.endTime - 0.45),
        end: sub.endTime,
        label: 'היסוס בסוף משפט',
        subtitleId: sub.id
      });
    }
  }

  // Merge overlapping or adjacent intervals (< 0.1s gap)
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a.start - b.start);

  const merged: AudioCutInterval[] = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = intervals[i];
    if (curr.start <= prev.end + 0.08) {
      prev.end = Math.max(prev.end, curr.end);
      prev.label = `${prev.label}, ${curr.label}`;
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

/**
 * Remove audio intervals (like "אה", hesitations, silence) from an Audio/Video Blob.
 * Uses Web Audio API with a smooth micro-crossfade (15ms) across cut points
 * to eliminate pops/clicks, and automatically recalculates all subtitle timestamps!
 */
export async function removeIntervalsFromAudioBlob(
  blob: Blob,
  rawIntervals: AudioCutInterval[],
  options?: {
    subtitles?: SubtitleItem[];
    crossfadeMs?: number;
    outputFormat?: 'wav' | 'mp3';
  }
): Promise<RemoveFillerAudioResult> {
  const crossfadeMs = options?.crossfadeMs ?? 15;
  const subtitles = options?.subtitles ? [...options.subtitles] : [];

  if (!rawIntervals || rawIntervals.length === 0) {
    return {
      cleanedBlob: blob,
      totalCuts: 0,
      totalDurationCutSeconds: 0,
      updatedSubtitles: subtitles,
      intervalsCut: []
    };
  }

  // 1. Decode original Audio Data
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioCtx();
  let audioBuffer: AudioBuffer;

  try {
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    try {
      await audioContext.close();
    } catch {}
  }

  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const totalDuration = audioBuffer.duration;
  const crossfadeFrames = Math.max(16, Math.floor((crossfadeMs / 1000) * sampleRate));

  // 2. Normalize and sanitize intervals
  const sorted = [...rawIntervals]
    .map(inv => ({
      start: Math.max(0, Math.min(totalDuration, inv.start)),
      end: Math.max(0, Math.min(totalDuration, inv.end)),
      label: inv.label,
      subtitleId: inv.subtitleId
    }))
    .filter(inv => inv.end - inv.start >= 0.05)
    .sort((a, b) => a.start - b.start);

  if (sorted.length === 0) {
    return {
      cleanedBlob: blob,
      totalCuts: 0,
      totalDurationCutSeconds: 0,
      updatedSubtitles: subtitles,
      intervalsCut: []
    };
  }

  // Merge overlapping
  const cleanIntervals: AudioCutInterval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = cleanIntervals[cleanIntervals.length - 1];
    const curr = sorted[i];
    if (curr.start <= prev.end + 0.05) {
      prev.end = Math.max(prev.end, curr.end);
      prev.label = `${prev.label} + ${curr.label}`;
    } else {
      cleanIntervals.push(curr);
    }
  }

  // 3. Compute Retained Audio Segments (Keep ranges)
  interface AudioSegment {
    startFrame: number;
    endFrame: number;
  }

  const retainedSegments: AudioSegment[] = [];
  let currentFrame = 0;

  for (const cut of cleanIntervals) {
    const cutStartFrame = Math.floor(cut.start * sampleRate);
    const cutEndFrame = Math.ceil(cut.end * sampleRate);

    if (cutStartFrame > currentFrame) {
      retainedSegments.push({
        startFrame: currentFrame,
        endFrame: cutStartFrame
      });
    }
    currentFrame = Math.max(currentFrame, cutEndFrame);
  }

  const totalFrames = audioBuffer.length;
  if (currentFrame < totalFrames) {
    retainedSegments.push({
      startFrame: currentFrame,
      endFrame: totalFrames
    });
  }

  // Calculate new audio length (accounting for crossfade overlaps if applicable)
  let totalNewFrames = 0;
  for (const seg of retainedSegments) {
    totalNewFrames += Math.max(0, seg.endFrame - seg.startFrame);
  }

  if (totalNewFrames <= 0) {
    throw new Error('החיתוך מוחק את כל קובץ השמע');
  }

  // 4. Create new AudioBuffer and copy samples with micro-crossfade at joints
  const offlineCtx = new OfflineAudioContext(numChannels, totalNewFrames, sampleRate);
  const newBuffer = offlineCtx.createBuffer(numChannels, totalNewFrames, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const sourceData = audioBuffer.getChannelData(ch);
    const targetData = newBuffer.getChannelData(ch);

    let writeOffset = 0;

    for (let segIdx = 0; segIdx < retainedSegments.length; segIdx++) {
      const seg = retainedSegments[segIdx];
      const segLen = seg.endFrame - seg.startFrame;
      if (segLen <= 0) continue;

      const segData = sourceData.subarray(seg.startFrame, seg.endFrame);
      targetData.set(segData, writeOffset);

      // Apply micro-fadeout to end of previous and micro-fadein to start of next segment to prevent audio pops
      if (segIdx > 0 && writeOffset > 0) {
        const fadeLen = Math.min(crossfadeFrames, Math.floor(segLen / 2));
        for (let f = 0; f < fadeLen; f++) {
          const ratio = f / fadeLen;
          const pos = writeOffset + f;
          if (pos < targetData.length) {
            targetData[pos] *= ratio; // Linear fade in
          }
        }
      }

      if (segIdx < retainedSegments.length - 1) {
        const fadeLen = Math.min(crossfadeFrames, Math.floor(segLen / 2));
        for (let f = 0; f < fadeLen; f++) {
          const ratio = (fadeLen - f) / fadeLen;
          const pos = writeOffset + segLen - fadeLen + f;
          if (pos >= 0 && pos < targetData.length) {
            targetData[pos] *= ratio; // Linear fade out
          }
        }
      }

      writeOffset += segLen;
    }
  }

  // 5. Adjust all Subtitle Timestamps to maintain 100% Lip-Sync!
  let totalDurationCut = 0;
  for (const cut of cleanIntervals) {
    totalDurationCut += (cut.end - cut.start);
  }

  const updatedSubtitles: SubtitleItem[] = [];

  for (const sub of subtitles) {
    // If cue is inside a cut interval, drop it
    const isInsideCut = cleanIntervals.some(
      cut => sub.startTime >= cut.start - 0.05 && sub.endTime <= cut.end + 0.05
    );

    if (isInsideCut) {
      continue;
    }

    // Calculate how much cut time occurred before sub.startTime and sub.endTime
    let cutBeforeStart = 0;
    let cutBeforeEnd = 0;

    for (const cut of cleanIntervals) {
      const cutDur = cut.end - cut.start;
      if (cut.end <= sub.startTime) {
        cutBeforeStart += cutDur;
        cutBeforeEnd += cutDur;
      } else if (cut.start < sub.startTime && cut.end > sub.startTime) {
        cutBeforeStart += (sub.startTime - cut.start);
        cutBeforeEnd += cutDur;
      } else if (cut.start >= sub.startTime && cut.end <= sub.endTime) {
        cutBeforeEnd += cutDur;
      } else if (cut.start < sub.endTime && cut.end > sub.endTime) {
        cutBeforeEnd += (sub.endTime - cut.start);
      }
    }

    const newStart = Math.max(0, sub.startTime - cutBeforeStart);
    const newEnd = Math.max(newStart + 0.3, sub.endTime - cutBeforeEnd);

    // Also remove any residual filler words from the text
    const cleanText = removeHebrewFillerWords(sub.text).cleaned;

    if (cleanText.length > 0) {
      updatedSubtitles.push({
        ...sub,
        startTime: Number(newStart.toFixed(3)),
        endTime: Number(newEnd.toFixed(3)),
        text: cleanText
      });
    }
  }

  // 6. Encode the new buffer to WAV or MP3
  const isMp3 = options?.outputFormat === 'mp3';
  const cleanedBlob = isMp3
    ? audioBufferToMp3(newBuffer, { bitrate: 192 })
    : audioBufferToWav(newBuffer, numChannels === 1);

  return {
    cleanedBlob,
    totalCuts: cleanIntervals.length,
    totalDurationCutSeconds: Number(totalDurationCut.toFixed(2)),
    updatedSubtitles,
    intervalsCut: cleanIntervals
  };
}

