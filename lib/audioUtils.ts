import { SubtitleItem } from './types';

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
    source.connect(offlineContext.destination);
    source.start(0);

    const resampledBuffer = await offlineContext.startRendering();
    return audioBufferToWav(resampledBuffer, true);
  } catch (e) {
    console.warn('Speech mono WAV downsampling fallback:', e);
    return convertBlobToMonoWav(blob);
  }
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

// Clean and polish Hebrew subtitle text (preserves 100% of spoken words, fixes spacing and punctuation)
export function cleanAndPolishHebrewSubtitleText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,\.!\?:;])/g, '$1')
    .trim();
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
        text: chunkText
      });

      currentStart = chunkEnd + 0.05;
    });
  }

  // Ensure timestamps are monotonic and sorted
  return newSubtitles.sort((a, b) => a.startTime - b.startTime);
}

// Split a single subtitle card right down the middle
export function splitSubtitleItemAtMiddle(sub: SubtitleItem): [SubtitleItem, SubtitleItem] {
  const words = sub.text.trim().replace(/\s+/g, ' ').split(' ');
  const mid = Math.ceil(words.length / 2);
  const part1Text = words.slice(0, mid).join(' ');
  const part2Text = words.slice(mid).join(' ');

  const totalDuration = sub.endTime - sub.startTime;
  const midTime = Number((sub.startTime + totalDuration * 0.5).toFixed(2));

  const sub1: SubtitleItem = {
    id: `sub_split1_${Date.now()}`,
    startTime: sub.startTime,
    endTime: midTime - 0.05,
    text: part1Text
  };

  const sub2: SubtitleItem = {
    id: `sub_split2_${Date.now() + 1}`,
    startTime: midTime,
    endTime: sub.endTime,
    text: part2Text
  };

  return [sub1, sub2];
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
    text: `${current.text} ${next.text}`.trim()
  };

  const copy = [...subtitles];
  copy.splice(index, 2, merged);
  return copy;
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

