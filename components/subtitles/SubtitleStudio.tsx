'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Episode, SubtitleItem, SubtitleStyle } from '@/lib/types';
import { saveEpisode, getMediaBlob, saveMediaBlob } from '@/lib/storage';
import { 
  exportToSRT, 
  exportToVTT, 
  splitTextIntoPacedSubtitles, 
  formatSrtTimestamp, 
  formatVttTimestamp,
  convertBlobToMonoWav,
  convertBlobToSpeechMonoWav,
  smartRebalanceSubtitles,
  splitSubtitleItemAtMiddle,
  splitSubtitleItemAtWordIndex,
  segmentSubtitlesByPunctuation,
  segmentSubtitlesByMaxChars,
  mergeSubtitleWithNext,
  mergeSubtitleWithPrevious,
  cleanAndPolishHebrewSubtitleText,
  shiftAllSubtitleTimestamps,
  buildSubtitlesFromWhisperWords,
  parseSRT,
  parseVTT,
  generateSubtitlesFromTopics,
  sliceAudioBlobIntoChunks,
  blobToBase64
} from '@/lib/audioUtils';
import { 
  Subtitles, 
  Type, 
  Upload, 
  Download, 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  Palette, 
  Sliders, 
  Sparkles, 
  Clock, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Eye,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Layers,
  Wand2,
  Mic,
  MicOff,
  Volume2,
  Key,
  Scissors,
  GitMerge,
  RotateCw,
  FileText,
  Pin,
  FastForward,
  Rewind,
  Globe,
  Languages,
  ArrowRight,
  Split,
  Zap,
  Bookmark
} from 'lucide-react';
import { getAISettings, AISettingsConfig } from '@/lib/apiConfig';
import SubtitleAISettingsModal from './SubtitleAISettingsModal';

interface SubtitleStudioProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
  onUpdateEpisode?: (updated: Episode) => void;
  isStandalonePage?: boolean;
  onBack?: () => void;
}

const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: 'Rubik, sans-serif',
  fontSize: 28,
  fontWeight: 'bold',
  textColor: '#FFFFFF',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  backgroundOpacity: 80,
  strokeColor: '#000000',
  strokeWidth: 2,
  textShadow: 'soft',
  shadowColor: 'rgba(0,0,0,0.85)',
  highlightWordColor: '#FACC15',
  activeWordAnimation: 'color-pop',
  textAlign: 'center',
  positionY: 80,
  boxStyle: 'rounded-badge',
  isBold: true,
  letterSpacing: 0.5,
  animation: 'karaoke-pop'
};

const SUBTITLE_THEMES = [
  {
    id: 'tiktok_pop',
    name: '📱 טיקטוק ורילס',
    desc: 'הדגשת מילה מדוברת בצהוב ניאון עם קו מתאר מודגש',
    style: {
      fontFamily: 'Rubik, sans-serif',
      fontSize: 32,
      fontWeight: '900' as const,
      textColor: '#FFFFFF',
      highlightWordColor: '#FACC15',
      boxStyle: 'none' as const,
      textShadow: 'hard-outline' as const,
      strokeWidth: 2,
      strokeColor: '#000000',
      activeWordAnimation: 'color-pop' as const,
      positionY: 78,
      textAlign: 'center' as const
    }
  },
  {
    id: 'netflix_cinema',
    name: '🎬 נטפליקס קולנועי',
    desc: 'טקסט לבן אלגנטי עם גלולת רקע כהה וצל רך',
    style: {
      fontFamily: 'Assistant, sans-serif',
      fontSize: 26,
      fontWeight: 'bold' as const,
      textColor: '#FFFFFF',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      boxStyle: 'pill-badge' as const,
      textShadow: 'soft' as const,
      strokeWidth: 0,
      activeWordAnimation: 'none' as const,
      positionY: 84,
      textAlign: 'center' as const
    }
  },
  {
    id: 'podcast_gold',
    name: '🎙️ פודקאסט זהב',
    desc: 'טקסט מוזהב יוקרתי עם רקע זכוכית וזוהר חם',
    style: {
      fontFamily: '"Secular One", sans-serif',
      fontSize: 28,
      fontWeight: 'bold' as const,
      textColor: '#F59E0B',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      boxStyle: 'glassmorphism' as const,
      textShadow: 'neon-glow' as const,
      shadowColor: '#F59E0B',
      strokeWidth: 1,
      strokeColor: '#D97706',
      activeWordAnimation: 'glow' as const,
      positionY: 80,
      textAlign: 'center' as const
    }
  },
  {
    id: 'cyberpunk_neon',
    name: '⚡ סייבר ניאון',
    desc: 'טורקיז ורוד בוהק עם אפקט זוהר עתידני',
    style: {
      fontFamily: 'Rubik, sans-serif',
      fontSize: 30,
      fontWeight: '800' as const,
      textColor: '#06B6D4',
      highlightWordColor: '#F43F5E',
      backgroundColor: 'rgba(8, 12, 22, 0.9)',
      boxStyle: 'rounded-badge' as const,
      textShadow: 'neon-glow' as const,
      shadowColor: '#06B6D4',
      strokeWidth: 0,
      activeWordAnimation: 'color-pop' as const,
      positionY: 76,
      textAlign: 'center' as const
    }
  },
  {
    id: 'classic_yellow',
    name: '📺 צהוב טלוויזיוני',
    desc: 'צהוב קלאסי בולט עם מסגרת שחורה חדה',
    style: {
      fontFamily: 'Impact, sans-serif',
      fontSize: 30,
      fontWeight: 'bold' as const,
      textColor: '#FDE047',
      boxStyle: 'none' as const,
      textShadow: 'hard-outline' as const,
      strokeWidth: 3,
      strokeColor: '#000000',
      activeWordAnimation: 'none' as const,
      positionY: 82,
      textAlign: 'center' as const
    }
  },
  {
    id: 'clean_minimal',
    name: '⚪ מינימליסטי נקי',
    desc: 'גופן דק וקריא במיוחד ללא הסחות דעת',
    style: {
      fontFamily: 'Assistant, sans-serif',
      fontSize: 24,
      fontWeight: '500' as const,
      textColor: '#F8FAFC',
      boxStyle: 'none' as const,
      textShadow: 'soft' as const,
      strokeWidth: 0,
      activeWordAnimation: 'none' as const,
      positionY: 85,
      textAlign: 'center' as const
    }
  }
];

const BUILT_IN_FONTS = [
  { name: 'Rubik (עבה וקולנועי - מומלץ)', value: 'Rubik, sans-serif' },
  { name: 'Heebo (מודרני ונקי)', value: 'Heebo, sans-serif' },
  { name: 'Secular One (פודקאסט בולט)', value: '"Secular One", sans-serif' },
  { name: 'Assistant (אלגנטי וקריא)', value: 'Assistant, sans-serif' },
  { name: 'Frank Ruhl Libre (קלאסי ועיתונאי)', value: '"Frank Ruhl Libre", serif' },
  { name: 'Impact (טיקטוק ורילס)', value: 'Impact, sans-serif' },
  { name: 'Varela Round (מעוגל וידידותי)', value: '"Varela Round", sans-serif' },
  { name: 'Comic Sans / Casual (חופשי)', value: '"Comic Sans MS", cursive' }
];

export default function SubtitleStudio({
  episode,
  isOpen,
  onClose,
  onUpdateEpisode,
  isStandalonePage = false,
  onBack
}: SubtitleStudioProps) {
  const [subtitles, setSubtitles] = useState<SubtitleItem[]>([]);
  const [globalStyle, setGlobalStyle] = useState<SubtitleStyle>(DEFAULT_STYLE);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Custom Fonts State
  const [customFonts, setCustomFonts] = useState<{ name: string; value: string }[]>([]);
  const fontInputRef = useRef<HTMLInputElement>(null);

  // Video & Playback State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // AI Providers & API Keys State (Gemini & ElevenLabs)
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettingsConfig>(getAISettings());
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Real Spoken Audio Transcription States
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState<string>('');
  const [isDictating, setIsDictating] = useState(false);
  const dictationRecRef = useRef<any>(null);

  // Subtitles AI Translation State
  const [isTranslateModalOpen, setIsTranslateModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [selectedTargetLang, setSelectedTargetLang] = useState('en');
  const [transcribeProgress, setTranscribeProgress] = useState<{ current: number; total: number } | null>(null);

  // ElevenLabs Voiceover Handler
  const handlePlayVoiceover = async (sub: SubtitleItem) => {
    if (!aiSettings.elevenLabsApiKey.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    setPlayingAudioId(sub.id);
    try {
      const res = await fetch('/api/elevenlabs/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sub.text,
          apiKey: aiSettings.elevenLabsApiKey,
          voiceId: aiSettings.elevenLabsVoiceId,
          modelId: aiSettings.elevenLabsModel
        })
      });

      const data = await res.json();
      if (res.ok && data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.onended = () => setPlayingAudioId(null);
        audio.play();
      } else {
        alert(data.error || 'שגיאה ביצירת קול דיבוב מ-ElevenLabs. בדקו את מפתח ה-API.');
        setPlayingAudioId(null);
      }
    } catch (e: any) {
      alert('שגיאה: ' + e.message);
      setPlayingAudioId(null);
    }
  };

  // Pacing Controls
  const [wordsPerLine, setWordsPerLine] = useState(4);
  const [linesPerSubtitle, setLinesPerSubtitle] = useState(1);
  const [rawScriptText, setRawScriptText] = useState('');
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);

  // Active Tab in Sidebar
  const [sidebarTab, setSidebarTab] = useState<'editor' | 'style' | 'pacing'>('editor');

  useEffect(() => {
    if (isOpen) {
      setAISettings(getAISettings());
      // 1. Initialize strictly from actual recorded spoken subtitles (NO mock script placeholders!)
      if (episode.subtitles && episode.subtitles.length > 0) {
        setSubtitles(episode.subtitles);
      } else {
        setSubtitles([]);
      }

      if (episode.subtitleStyle) {
        setGlobalStyle(episode.subtitleStyle);
      }

      // Load Video or Audio Blob for in-studio preview and syncing
      const loadMedia = async () => {
        let blob: Blob | null = null;
        if (episode.recording?.videoBlobKey) {
          blob = await getMediaBlob(episode.recording.videoBlobKey);
        }
        if (!blob && episode.recording?.audioBlobKey) {
          blob = await getMediaBlob(episode.recording.audioBlobKey);
        }
        if (!blob) {
          blob = await getMediaBlob(`emergency_rec_${episode.id}`);
        }
        if (blob) {
          setVideoUrl(URL.createObjectURL(blob));
        } else {
          setVideoUrl(null);
        }
      };

      loadMedia();
    }
  }, [isOpen, episode]);

  if (!isOpen) return null;

  // 1. Robust Chunked AI Transcription Engine (Supports 20+, 60+, 120+ minutes flawlessly!)
  const handleTranscribeRecordedAudio = async () => {
    const currentSettings = getAISettings();
    if (!currentSettings.geminiApiKey?.trim() && !currentSettings.openaiApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    setIsTranscribing(true);
    setTranscribeStatus('מאתר את קובץ האודיו המוקלט של הפרק...');
    setTranscribeProgress(null);

    try {
      let audioBlob: Blob | null = null;

      // 1. Try master audio track
      if (episode.recording?.audioBlobKey) {
        audioBlob = await getMediaBlob(episode.recording.audioBlobKey);
      }
      // 2. Try main video track
      if (!audioBlob && episode.recording?.videoBlobKey) {
        audioBlob = await getMediaBlob(episode.recording.videoBlobKey);
      }
      // 3. Try crash recovery emergency blob
      if (!audioBlob) {
        audioBlob = await getMediaBlob(`emergency_rec_${episode.id}`);
      }

      if (!audioBlob) {
        alert('לא נמצא קובץ הקלטה שמור עבור פרק זה. נא להקליט את הפרק באולפן או להעלות קובץ שמע מהמחשב לפני הפעלת תמלול.');
        setIsTranscribing(false);
        return;
      }

      setTranscribeStatus('מנתח ומחלק את ההקלטה למקטעי עיבוד מדויקים של 2 דקות (תמיכה מלאה בפרקים ארוכים)...');
      
      // Slicing into 120s (2-minute) chunks - each chunk is safely ~3.8MB
      const chunks = await sliceAudioBlobIntoChunks(audioBlob, 120);
      const totalChunks = chunks.length;
      
      if (totalChunks === 0) {
        alert('קובץ השמע קצר מדי או ריק.');
        setIsTranscribing(false);
        return;
      }

      setTranscribeProgress({ current: 0, total: totalChunks });
      let accumulatedSubtitles: SubtitleItem[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const pct = Math.round(((i + 1) / totalChunks) * 100);
        setTranscribeProgress({ current: i + 1, total: totalChunks });
        setTranscribeStatus(`מתמלל מקטע ${i + 1} מתוך ${totalChunks} (${pct}%)... [${formatSrtTimestamp(chunk.startSec).slice(3, 8)} - ${formatSrtTimestamp(chunk.endSec).slice(3, 8)}]`);

        let chunkSubs: SubtitleItem[] = [];
        const chunkBase64 = await blobToBase64(chunk.blob);
        const cleanChunkBase64 = chunkBase64.replace(/^data:[^;]+;base64,/, '');

        // Attempt A: Next.js Server Transcribe Endpoint (Small ~3MB chunk)
        try {
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: chunkBase64,
              mimeType: 'audio/wav',
              wordsPerLine,
              duration: chunk.durationSec,
              apiKey: currentSettings.geminiApiKey,
              openaiApiKey: currentSettings.openaiApiKey,
              provider: currentSettings.transcriptionProvider
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
              chunkSubs = data.subtitles;
            }
          }
        } catch (serverErr) {
          console.warn(`Server transcribe error on chunk ${i + 1}:`, serverErr);
        }

        // Attempt B: Direct Browser Gemini Pipeline (if server route was bypassed)
        if (chunkSubs.length === 0 && currentSettings.geminiApiKey?.trim()) {
          try {
            const geminiPrompt = `אתה מודל תמלול אודיו מקצועי לפודקאסטים בעברית.
תמלל בדיוק של 100% מילה במילה את הדיבור באודיו לעברית (Verbatim Hebrew Speech-to-Text).
חלק לכתוביות קצרות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בשורה, עם תזמונים (startTime, endTime) בשניות (משך מקטע זה: ${chunk.durationSec} שניות).
החזר אך ורק מערך JSON תקין: [{"startTime": 0.5, "endTime": 3.0, "text": "טקסט שנאמר"}]`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentSettings.geminiApiKey.trim()}`;
            const gRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inlineData: { mimeType: 'audio/wav', data: cleanChunkBase64 } },
                    { text: geminiPrompt }
                  ]
                }],
                generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
              })
            });

            if (gRes.ok) {
              const gJson = await gRes.json();
              const rawText = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawText) {
                const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
                const list = Array.isArray(parsed) ? parsed : (parsed.subtitles || []);
                chunkSubs = list;
              }
            }
          } catch (gErr) {
            console.warn(`Direct Gemini chunk ${i + 1} error:`, gErr);
          }
        }

        // Attempt C: Direct Whisper Pipeline for this small chunk
        if (chunkSubs.length === 0 && currentSettings.openaiApiKey?.trim()) {
          try {
            const formData = new FormData();
            formData.append('file', chunk.blob, `chunk_${i}.wav`);
            formData.append('model', 'whisper-1');
            formData.append('language', 'he');
            formData.append('prompt', 'תמלול עברית מלא ומדויק מילה במילה.');
            formData.append('temperature', '0');
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities[]', 'word');

            const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${currentSettings.openaiApiKey.trim()}` },
              body: formData
            });

            if (whisperRes.ok) {
              const wData = await whisperRes.json();
              if (wData.words && wData.words.length > 0) {
                chunkSubs = buildSubtitlesFromWhisperWords(wData.words, wordsPerLine);
              } else if (wData.segments) {
                chunkSubs = wData.segments.map((seg: any, idx: number) => ({
                  id: `sub_whisper_${Date.now()}_${idx}`,
                  startTime: Number(Number(seg.start).toFixed(2)),
                  endTime: Number(Number(seg.end).toFixed(2)),
                  text: String(seg.text || '').trim()
                })).filter((s: any) => s.text.length > 0);
              }
            }
          } catch (wErr) {
            console.warn(`Whisper chunk ${i + 1} error:`, wErr);
          }
        }

        // Offset chunk timestamps and append to accumulated results
        if (chunkSubs.length > 0) {
          const offsetSubs: SubtitleItem[] = chunkSubs.map((s, sIdx) => ({
            id: `sub_${Date.now()}_c${i}_${sIdx}`,
            startTime: Number((chunk.startSec + (Number(s.startTime) || 0)).toFixed(2)),
            endTime: Number((chunk.startSec + (Number(s.endTime) || chunk.durationSec)).toFixed(2)),
            text: String(s.text || '').trim()
          })).filter(s => s.text.length > 0);

          accumulatedSubtitles = [...accumulatedSubtitles, ...offsetSubs];
          setSubtitles([...accumulatedSubtitles]); // Stream live results to UI immediately!
        }
      }

      if (accumulatedSubtitles.length > 0) {
        const sorted = accumulatedSubtitles.sort((a, b) => a.startTime - b.startTime);
        setSubtitles(sorted);
        const updated: Episode = { ...episode, subtitles: sorted };
        saveEpisode(updated);
        if (onUpdateEpisode) onUpdateEpisode(updated);
        setIsTranscribing(false);
        setTranscribeProgress(null);
        alert(`התמלול הושלם בהצלחה! נוצרו ${sorted.length} כתוביות מסונכרנות על פני כל ${totalChunks} המקטעים של הפרק.`);
        return;
      }

      // Fallback to Topics if AI returned 0 words
      if (episode.topics && episode.topics.length > 0) {
        const totalDurationSec = videoRef.current?.duration || episode.recording?.duration || 600;
        const generated = generateSubtitlesFromTopics(episode.topics, totalDurationSec, wordsPerLine);
        if (generated.length > 0) {
          setSubtitles(generated);
          const updated: Episode = { ...episode, subtitles: generated };
          saveEpisode(updated);
          if (onUpdateEpisode) onUpdateEpisode(updated);
          setIsTranscribing(false);
          setTranscribeProgress(null);
          alert('שרתי ה-AI החזירו תוצאה ריקה עבור הקלטה זו. יצרנו עבורך כתוביות מסונכרנות מנושאי הפרק.');
          return;
        }
      }

      setIsTranscribing(false);
      setTranscribeProgress(null);
      setIsAIModalOpen(true);
      alert('לא התקבל תמלול. נא לבדוק את מפתח ה-API בהגדרות ה-AI ולוודא שההקלטה מכילה דיבור ברור.');
    } catch (err: any) {
      setIsTranscribing(false);
      setTranscribeProgress(null);
      alert('שגיאה במהלך תמלול הפרק: ' + err.message);
    }
  };

  // 2. AI Subtitles Translation Handler (Translate to English, Spanish, French, Russian, Arabic, etc.)
  const handleTranslateSubtitles = async (targetLang: string) => {
    if (subtitles.length === 0) {
      alert('אין כתוביות לתרגום.');
      return;
    }

    const currentSettings = getAISettings();
    if (!currentSettings.geminiApiKey?.trim() && !currentSettings.openaiApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    setIsTranslating(true);
    try {
      const res = await fetch('/api/ai/translate-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitles,
          targetLanguage: targetLang,
          sourceLanguage: 'he',
          apiKey: currentSettings.geminiApiKey,
          openaiApiKey: currentSettings.openaiApiKey
        })
      });

      const data = await res.json();
      if (res.ok && data.subtitles && Array.isArray(data.subtitles) && data.subtitles.length > 0) {
        setSubtitles(data.subtitles);
        const updated: Episode = { ...episode, subtitles: data.subtitles };
        saveEpisode(updated);
        if (onUpdateEpisode) onUpdateEpisode(updated);
        setIsTranslating(false);
        setIsTranslateModalOpen(false);
        alert(`התרגום הושלם בהצלחה! תורגמו ${data.subtitles.length} כתוביות תוך שמירה על כל התזמונים.`);
      } else {
        alert(data.error || 'שגיאה בתרגום הכתוביות. בדקו את מפתח ה-API בהגדרות.');
        setIsTranslating(false);
      }
    } catch (err: any) {
      setIsTranslating(false);
      alert('שגיאה בתרגום: ' + err.message);
    }
  };

  // 2. Live Hebrew Speech Recognition Dictation
  const toggleLiveDictation = () => {
    if (isDictating) {
      if (dictationRecRef.current) {
        dictationRecRef.current.stop();
        dictationRecRef.current = null;
      }
      setIsDictating(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('דפדפן זה אינו תומך בהכתבה חיה. מומלץ להשתמש ב-Google Chrome.');
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'he-IL';

      rec.onresult = (event: any) => {
        const nowT = videoRef.current ? videoRef.current.currentTime : currentTime;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const spoken = event.results[i][0]?.transcript?.trim();
            if (spoken) {
              const newSub: SubtitleItem = {
                id: `sub_dictate_${Date.now()}_${subtitles.length}`,
                startTime: Number(nowT.toFixed(2)),
                endTime: Number((nowT + 3.0).toFixed(2)),
                text: spoken
              };
              setSubtitles(prev => [...prev, newSub]);
            }
          }
        }
      };

      rec.onend = () => setIsDictating(false);
      rec.start();
      dictationRecRef.current = rec;
      setIsDictating(true);
    } catch (e: any) {
      alert('שגיאה בהפעלת מיקרופון: ' + e.message);
    }
  };

  // 3. Generate Subtitles automatically from Episode Topics & Outline
  const handleGenerateFromTopics = () => {
    if (!episode.topics || episode.topics.length === 0) {
      alert('לא נמצאו נושאי שיחה בפרק זה.');
      return;
    }
    const dur = videoRef.current?.duration || (episode.targetDurationMinutes ? episode.targetDurationMinutes * 60 : 600);
    const generated = generateSubtitlesFromTopics(episode.topics, dur, wordsPerLine);
    if (generated.length > 0) {
      setSubtitles(generated);
      const updated: Episode = { ...episode, subtitles: generated };
      saveEpisode(updated);
      if (onUpdateEpisode) onUpdateEpisode(updated);
      alert(`נוצרו ${generated.length} כתוביות בהצלחה מתוך נושאי השיחה ותסריט הפרק!`);
    }
  };

  // 4. Import Subtitles from external .SRT or .VTT file
  const srtFileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadDirectAudioForTranscribe = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setTranscribeStatus('טוען ושומר את קובץ השמע...');
      setIsTranscribing(true);
      const blobKey = `rec_uploaded_${episode.id}_${Date.now()}`;
      await saveMediaBlob(blobKey, file);

      // Determine duration
      let durationSeconds = 60;
      try {
        const url = URL.createObjectURL(file);
        const tempAudio = new Audio(url);
        await new Promise((resolve) => {
          tempAudio.onloadedmetadata = () => {
            durationSeconds = Math.round(tempAudio.duration) || 60;
            resolve(true);
          };
          tempAudio.onerror = () => resolve(true);
          setTimeout(() => resolve(true), 2500);
        });
      } catch {}

      const updated: Episode = {
        ...episode,
        status: 'recorded',
        recording: {
          recordedAt: new Date().toISOString(),
          duration: durationSeconds,
          audioBlobKey: blobKey,
          markers: [],
          topicsCovered: []
        }
      };

      saveEpisode(updated);
      if (onUpdateEpisode) onUpdateEpisode(updated);
      setVideoUrl(URL.createObjectURL(file));

      // Trigger automatic transcription
      handleTranscribeRecordedAudio();
    } catch (err: any) {
      setIsTranscribing(false);
      alert('שגיאה בטעינת קובץ השמע: ' + err.message);
    }
  };

  const handleImportSrtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const isVtt = file.name.toLowerCase().endsWith('.vtt');
      const parsed = isVtt ? parseVTT(content) : parseSRT(content);
      if (parsed.length > 0) {
        setSubtitles(parsed);
        const updated: Episode = { ...episode, subtitles: parsed };
        saveEpisode(updated);
        if (onUpdateEpisode) onUpdateEpisode(updated);
        alert(`נטענו ${parsed.length} כתוביות בהצלחה מקובץ ${file.name}!`);
      } else {
        alert('לא נמצאו כתוביות תקינות בקובץ שהועלה.');
      }
    };
    reader.readAsText(file);
  };

  // 5. Custom Font Upload Handler
  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fontName = file.name.replace(/\.[^/.]+$/, '').replace(/[^\w\d]/g, '_');
    const reader = new FileReader();
    reader.onload = (event) => {
      const fontUrl = event.target?.result as string;
      const newStyle = document.createElement('style');
      newStyle.appendChild(document.createTextNode(`
        @font-face {
          font-family: '${fontName}';
          src: url('${fontUrl}');
        }
      `));
      document.head.appendChild(newStyle);

      const newFontEntry = { name: `פונט אישי: ${file.name}`, value: `'${fontName}', sans-serif` };
      setCustomFonts(prev => [...prev, newFontEntry]);
      setGlobalStyle(prev => ({ ...prev, fontFamily: newFontEntry.value }));
      alert(`הפונט "${file.name}" נטען והוחל בהצלחה!`);
    };
    reader.readAsDataURL(file);
  };

  // 4. Playback Controls
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const jumpToTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const activeSubtitle = subtitles.find(s => currentTime >= s.startTime && currentTime <= s.endTime);

  // Selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === subtitles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(subtitles.map(s => s.id));
    }
  };

  // Apply style to selected or global
  const applyStyleUpdate = (updates: Partial<SubtitleStyle>) => {
    setGlobalStyle(prev => ({ ...prev, ...updates }));

    if (selectedIds.length > 0) {
      setSubtitles(prev => prev.map(s => {
        if (selectedIds.includes(s.id)) {
          return {
            ...s,
            customStyle: { ...(s.customStyle || globalStyle), ...updates }
          };
        }
        return s;
      }));
    }
  };

  // Subtitle CRUD
  const handleAddSubtitle = () => {
    const start = Number(currentTime.toFixed(2));
    const end = Number((currentTime + 3.0).toFixed(2));
    const newSub: SubtitleItem = {
      id: `sub_${Date.now()}`,
      startTime: start,
      endTime: end,
      text: 'מילים שנאמרו בפועל...'
    };
    setSubtitles(prev => [...prev, newSub].sort((a, b) => a.startTime - b.startTime));
  };

  const handleUpdateText = (id: string, text: string) => {
    setSubtitles(prev => prev.map(s => s.id === id ? { ...s, text } : s));
  };

  const adjustTiming = (id: string, field: 'startTime' | 'endTime', delta: number) => {
    setSubtitles(prev => prev.map(s => {
      if (s.id === id) {
        const newVal = Math.max(0, Number((s[field] + delta).toFixed(2)));
        if (field === 'startTime' && newVal >= s.endTime) return s;
        if (field === 'endTime' && newVal <= s.startTime) return s;
        return { ...s, [field]: newVal };
      }
      return s;
    }));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setSubtitles(prev => prev.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
  };

  const handleDeleteSubtitle = (id: string) => {
    setSubtitles(prev => prev.filter(s => s.id !== id));
    setSelectedIds(prev => prev.filter(item => item !== id));
  };

  // Apply Preset Theme
  const handleApplyTheme = (theme: typeof SUBTITLE_THEMES[0]) => {
    applyStyleUpdate(theme.style);
    alert(`סגנון "${theme.name}" הוחל בהצלחה על הכתוביות!`);
  };

  // Re-split and re-balance all subtitles into target words per line
  const handleRebalanceAll = (words: number) => {
    if (subtitles.length === 0) return;
    const rebalanced = smartRebalanceSubtitles(subtitles, words, linesPerSubtitle);
    setSubtitles(rebalanced);
    const updated: Episode = { ...episode, subtitles: rebalanced };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Semantic Sentence Splitter: Groups and splits subtitles strictly by punctuation (. , ? ! - :)
  const handleSegmentByPunctuation = () => {
    if (subtitles.length === 0) return;
    const segmented = segmentSubtitlesByPunctuation(subtitles);
    setSubtitles(segmented);
    const updated: Episode = { ...episode, subtitles: segmented };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
    alert(`בוצעה חלוקה סמנטית לפי משפטים וסימני פיסוק! נוצרו ${segmented.length} כתוביות.`);
  };

  // Max Character Limit Segmenter (e.g. 28/35/45 chars for mobile)
  const handleSegmentByMaxChars = (maxChars: number = 30) => {
    if (subtitles.length === 0) return;
    const segmented = segmentSubtitlesByMaxChars(subtitles, maxChars);
    setSubtitles(segmented);
    const updated: Episode = { ...episode, subtitles: segmented };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
    alert(`בוצעה חלוקה לפי מגבלת רוחב של עד ${maxChars} תווים לשורה!`);
  };

  // Split single cue into two proportional halves
  const handleSplitSingleSubtitle = (sub: SubtitleItem) => {
    const [sub1, sub2] = splitSubtitleItemAtMiddle(sub);
    const idx = subtitles.findIndex(s => s.id === sub.id);
    if (idx === -1) return;
    const copy = [...subtitles];
    copy.splice(idx, 1, sub1, sub2);
    setSubtitles(copy);
    const updated: Episode = { ...episode, subtitles: copy };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Split single cue at an exact word index
  const handleSplitAtWord = (sub: SubtitleItem, wordIdx: number) => {
    const [sub1, sub2] = splitSubtitleItemAtWordIndex(sub, wordIdx);
    const idx = subtitles.findIndex(s => s.id === sub.id);
    if (idx === -1) return;
    const copy = [...subtitles];
    copy.splice(idx, 1, sub1, sub2);
    setSubtitles(copy);
    const updated: Episode = { ...episode, subtitles: copy };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Merge cue with subsequent cue
  const handleMergeWithNext = (idx: number) => {
    const merged = mergeSubtitleWithNext(subtitles, idx);
    setSubtitles(merged);
    const updated: Episode = { ...episode, subtitles: merged };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Merge cue with previous cue
  const handleMergeWithPrev = (idx: number) => {
    const merged = mergeSubtitleWithPrevious(subtitles, idx);
    setSubtitles(merged);
    const updated: Episode = { ...episode, subtitles: merged };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Clean Hebrew fillers and fix punctuation
  const handlePolishSingleSubtitle = (id: string) => {
    setSubtitles(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, text: cleanAndPolishHebrewSubtitleText(s.text) };
      }
      return s;
    }));
  };

  const handlePolishAllSubtitles = () => {
    setSubtitles(prev => prev.map(s => ({
      ...s,
      text: cleanAndPolishHebrewSubtitleText(s.text)
    })));
  };

  // Shift all timestamps by +/- delta seconds to fix microphone/video delay
  const handleShiftAll = (delta: number) => {
    if (subtitles.length === 0) return;
    const shifted = shiftAllSubtitleTimestamps(subtitles, delta);
    setSubtitles(shifted);
    const updated: Episode = { ...episode, subtitles: shifted };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
  };

  // Snap subtitle start to current playback position in video
  const handleSnapToCurrentTime = (id: string) => {
    const current = Number(currentTime.toFixed(2));
    setSubtitles(prev => prev.map(s => {
      if (s.id === id) {
        const duration = Math.max(0.5, s.endTime - s.startTime);
        return {
          ...s,
          startTime: current,
          endTime: Number((current + duration).toFixed(2))
        };
      }
      return s;
    }));
  };

  // Save to DB
  const handleSaveSubtitles = () => {
    const updated: Episode = {
      ...episode,
      subtitles,
      subtitleStyle: globalStyle
    };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
    alert('הכתוביות ועיצוב הגופנים נשמרו בהצלחה במסד הנתונים!');
  };

  // Export SRT & VTT
  const handleExportSRT = () => {
    const srtContent = exportToSRT(subtitles);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${episode.title}_subtitles.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportVTT = () => {
    const vttContent = exportToVTT(subtitles);
    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${episode.title}_subtitles.vtt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const allFontsList = [...customFonts, ...BUILT_IN_FONTS];

  return (
    <div className={isStandalonePage ? "w-full h-screen flex flex-col bg-[#0a0d14] font-sans overflow-hidden" : "fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in font-sans"}>
      <div className={isStandalonePage ? "w-full h-full flex flex-col overflow-hidden relative" : "w-full max-w-7xl h-[94vh] rounded-3xl bg-[#121620] border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative"}>
        {/* Top Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800 shrink-0 bg-[#0d1017]">
          <div className="flex items-center gap-3">
            {isStandalonePage && (
              <button
                onClick={onBack || onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="חזרה לפרק"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>אולפן כתוביות מקצועי (תמלול לפי דיבור בפועל)</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                  {subtitles.length} כתוביות
                </span>
              </h2>
              <p className="text-xs text-slate-400">תמלול מילים אמיתיות מההקלטה, סנכרון תזמונים של 0.1s, פונטים אישיים ועיצוב ויזואלי</p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {/* Hidden SRT / VTT File Input */}
            <input
              ref={srtFileInputRef}
              type="file"
              accept=".srt,.vtt,text/plain"
              onChange={handleImportSrtFile}
              className="hidden"
            />

            {/* Hidden Audio File Input */}
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/*,video/*,.mp3,.wav,.m4a,.webm,.ogg"
              onChange={handleUploadDirectAudioForTranscribe}
              className="hidden"
            />

            {/* Direct Audio Upload Button */}
            <button
              onClick={() => audioFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold transition-all active:scale-98"
              title="העלאת קובץ הקלטה (MP3/WAV) מהמחשב לתמלול מיידי"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>טען שמע מהמחשב</span>
            </button>

            {/* AI Transcribe Spoken Audio Button */}
            <button
              onClick={handleTranscribeRecordedAudio}
              disabled={isTranscribing}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-xs font-bold text-white shadow-lg shadow-amber-600/30 transition-all active:scale-98 disabled:opacity-50"
              title="תמלל מילים בפועל מקובץ האודיו של הפרק"
            >
              <Wand2 className={`w-3.5 h-3.5 ${isTranscribing ? 'animate-spin' : ''}`} />
              <span>{isTranscribing ? 'מתמלל אודיו...' : 'תמלל דיבור מהקלטה (AI)'}</span>
            </button>

            {/* Auto Generate from Topics Button */}
            <button
              onClick={handleGenerateFromTopics}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold transition-all active:scale-98"
              title="צור כתוביות מיידית מנושאי השיחה והתסריט של הפרק"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>צור מנושאי הפרק</span>
            </button>

            {/* Import SRT / VTT Button */}
            <button
              onClick={() => srtFileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all"
              title="ייבא קובץ כתוביות SRT או WebVTT"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>ייבוא SRT/VTT</span>
            </button>

            {/* Live Microphone Dictation */}
            <button
              onClick={toggleLiveDictation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isDictating 
                  ? 'bg-red-600 text-white border-red-500 animate-pulse' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="הכתב כתוביות ישירות בדיבור למיקרופון"
            >
              {isDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{isDictating ? 'עצור הכתבה' : 'הכתב בדיבור'}</span>
            </button>

            {/* AI Subtitle Translate Button */}
            <button
              onClick={() => setIsTranslateModalOpen(true)}
              disabled={subtitles.length === 0 || isTranslating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/40 text-xs font-bold transition-all active:scale-98 disabled:opacity-40"
              title="תרגם את כל הכתוביות לשפה אחרת (אנגלית, ספרדית, צרפתית, רוסית, ערבית וכו') באמצעות AI"
            >
              <Globe className={`w-3.5 h-3.5 text-blue-400 ${isTranslating ? 'animate-spin' : ''}`} />
              <span>{isTranslating ? 'מתרגם...' : 'תרגם כתוביות (AI)'}</span>
            </button>

            {/* AI Keys Settings Modal Trigger */}
            <button
              onClick={() => setIsAIModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors relative"
              title="הגדרות מפתחות Gemini & ElevenLabs API"
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>מפתחות AI</span>
              {(aiSettings.geminiApiKey || aiSettings.elevenLabsApiKey) && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow" />
              )}
            </button>

            {/* Export SRT */}
            <button
              onClick={handleExportSRT}
              disabled={subtitles.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>ייצוא SRT</span>
            </button>

            {/* Save Button */}
            <button
              onClick={handleSaveSubtitles}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-bold text-white shadow-lg shadow-purple-600/30 transition-all active:scale-98"
            >
              <Check className="w-3.5 h-3.5" />
              <span>שמור הכל</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Transcribing Progress Banner */}
        {isTranscribing && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
              <span className="font-bold">{transcribeStatus}</span>
            </div>
            {transcribeProgress && (
              <div className="flex items-center gap-3">
                <div className="w-36 h-2 bg-slate-800 rounded-full overflow-hidden border border-amber-500/30">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${Math.round((transcribeProgress.current / transcribeProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {transcribeProgress.current}/{transcribeProgress.total} ({Math.round((transcribeProgress.current / transcribeProgress.total) * 100)}%)
                </span>
              </div>
            )}
            <span className="text-[11px] text-amber-400/80">תמלול מקטעים מקבילי לפרקים ארוכים (20-60+ דקות)</span>
          </div>
        )}

        {/* Main Content Grid: Video Preview & Subtitles Controls */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Column: Interactive Video Preview (7 Cols) */}
          <div className="lg:col-span-7 p-4 sm:p-6 flex flex-col items-center justify-center bg-black/40 border-b lg:border-b-0 lg:border-l border-slate-800 relative overflow-hidden">
            {/* Live Video / Canvas Player */}
            <div className="w-full max-w-2xl relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-8 text-slate-500 space-y-2">
                  <Play className="w-12 h-12 mx-auto text-slate-600" />
                  <p className="text-xs">תצוגה מקדימה של הכתוביות והווידאו</p>
                </div>
              )}

              {/* Dynamic Styled Subtitle Overlay on Top of Video */}
              {activeSubtitle && (() => {
                const st = activeSubtitle.customStyle || globalStyle;
                const posPercent = typeof st.positionY === 'number'
                  ? st.positionY
                  : st.positionY === 'top'
                  ? 12
                  : st.positionY === 'center'
                  ? 50
                  : 82;

                const getShadow = () => {
                  if (st.textShadow === 'none') return 'none';
                  if (st.textShadow === 'hard-outline') {
                    return '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 3px 6px rgba(0,0,0,0.9)';
                  }
                  if (st.textShadow === 'neon-glow') {
                    const glowCol = st.shadowColor || st.highlightWordColor || '#06b6d4';
                    return `0 0 10px ${glowCol}, 0 0 20px ${glowCol}, 0 2px 8px rgba(0,0,0,0.9)`;
                  }
                  if (st.textShadow === 'cinema-blur') {
                    return '0 4px 20px rgba(0,0,0,0.95)';
                  }
                  return '0 2px 8px rgba(0,0,0,0.85)';
                };

                const getBoxClasses = () => {
                  if (st.boxStyle === 'pill-badge') return 'rounded-full px-6 py-2 shadow-2xl';
                  if (st.boxStyle === 'glassmorphism') return 'rounded-2xl px-5 py-2.5 backdrop-blur-md border border-white/15 shadow-2xl';
                  if (st.boxStyle === 'full-bar') return 'w-full rounded-none px-6 py-3 shadow-2xl';
                  if (st.boxStyle === 'rounded-badge') return 'rounded-2xl px-5 py-2.5 shadow-xl';
                  return 'p-0 bg-transparent';
                };

                const words = activeSubtitle.text.split(' ');
                const elapsed = currentTime - activeSubtitle.startTime;
                const duration = Math.max(0.1, activeSubtitle.endTime - activeSubtitle.startTime);
                const activeWordIndex = Math.min(words.length - 1, Math.floor((elapsed / duration) * words.length));

                return (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      top: `${posPercent}%`,
                      width: st.boxStyle === 'full-bar' ? '100%' : '90%',
                      textAlign: st.textAlign || 'center',
                      pointerEvents: 'none',
                      zIndex: 20
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-block',
                        fontFamily: st.fontFamily || 'Rubik, sans-serif',
                        fontSize: `${st.fontSize || 28}px`,
                        color: st.textColor || '#FFFFFF',
                        fontWeight: st.fontWeight === '900' ? 900 : st.fontWeight === '800' ? 800 : st.isBold || st.fontWeight === 'bold' ? 'bold' : 'normal',
                        backgroundColor: st.boxStyle === 'none' 
                          ? 'transparent' 
                          : (st.backgroundColor || 'rgba(0,0,0,0.8)'),
                        WebkitTextStroke: `${st.strokeWidth || 0}px ${st.strokeColor || '#000000'}`,
                        textShadow: getShadow(),
                        lineHeight: st.lineHeight || 1.3,
                        letterSpacing: `${st.letterSpacing || 0}px`,
                        direction: 'rtl'
                      }}
                      className={`${getBoxClasses()} animate-in zoom-in-95 duration-100 transition-all`}
                    >
                      {st.activeWordAnimation === 'color-pop' || st.activeWordAnimation === 'glow' ? (
                        words.map((w, wIdx) => {
                          const isWordActive = wIdx === activeWordIndex;
                          const activeCol = st.highlightWordColor || '#FACC15';
                          return (
                            <span
                              key={wIdx}
                              style={{
                                color: isWordActive ? activeCol : undefined,
                                textShadow: isWordActive && st.activeWordAnimation === 'glow' ? `0 0 15px ${activeCol}` : undefined,
                                transform: isWordActive ? 'scale(1.08)' : 'scale(1)',
                                display: 'inline-block',
                                transition: 'all 0.1s ease',
                                margin: '0 3px'
                              }}
                            >
                              {w}
                            </span>
                          );
                        })
                      ) : (
                        activeSubtitle.text
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Video Playback Scrubber & Micro Controls */}
            <div className="w-full max-w-2xl mt-4 flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
              <button
                onClick={togglePlay}
                className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs font-mono text-indigo-300 font-bold min-w-[45px]">
                  {formatSrtTimestamp(currentTime).split(',')[0]}
                </span>
                <input
                  type="range"
                  min={0}
                  max={videoRef.current?.duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => jumpToTime(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Jump Back / Forward 2s */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => jumpToTime(Math.max(0, currentTime - 2))}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 text-[11px] font-mono"
                >
                  -2s
                </button>
                <button
                  onClick={() => jumpToTime(currentTime + 2)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 text-[11px] font-mono"
                >
                  +2s
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Subtitles List & Controls (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col bg-[#121620] overflow-hidden">
            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 p-2 bg-slate-950/60 border-b border-slate-800 text-xs">
              <button
                onClick={() => setSidebarTab('editor')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  sidebarTab === 'editor' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span>עריכת דיבור ({subtitles.length})</span>
              </button>

              <button
                onClick={() => setSidebarTab('style')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  sidebarTab === 'style' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>עיצוב וגופנים</span>
              </button>

              <button
                onClick={() => setSidebarTab('pacing')}
                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all ${
                  sidebarTab === 'pacing' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>קצב מילים ושורות</span>
              </button>
            </div>

            {/* TAB 1: Subtitle Cues Timeline Editor */}
            {sidebarTab === 'editor' && (
              <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {/* Control bar */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800 shrink-0">
                  <button
                    onClick={selectAll}
                    disabled={subtitles.length === 0}
                    className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white disabled:opacity-40"
                  >
                    {selectedIds.length === subtitles.length && subtitles.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-purple-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                    <span>בחר הכל ({selectedIds.length})</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {selectedIds.length > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>מחק ({selectedIds.length})</span>
                      </button>
                    )}

                    <button
                      onClick={handleAddSubtitle}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-bold border border-purple-500/30 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>הוסף כתובית</span>
                    </button>
                  </div>
                </div>

                {/* Smart Rebalance & Pacing Control Bar */}
                {subtitles.length > 0 && (
                  <div className="space-y-1.5 shrink-0 my-2">
                    <div className="p-2.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-purple-300 font-bold">
                          <Sliders className="w-3.5 h-3.5 text-purple-400" />
                          <span>חלוקה חכמה מחדש (Pacing & Split):</span>
                        </div>
                        <button
                          onClick={handlePolishAllSubtitles}
                          className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                          title="נקה מילות מילוי (אהה, כאילו) ותקן פיסוק בכל הכתוביות"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>ליטוש ופיסוק להכל</span>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { words: 3, label: '3 מילים (TikTok/Shorts)' },
                          { words: 4, label: '4 מילים (קצבי מומלץ)' },
                          { words: 6, label: '6 מילים (פודקאסט)' },
                          { words: 8, label: '8 מילים (משפט שלם)' }
                        ].map(opt => (
                          <button
                            key={opt.words}
                            type="button"
                            onClick={() => handleRebalanceAll(opt.words)}
                            className="py-1 px-1 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-200 text-[10px] font-bold text-center transition-all active:scale-95"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Global Audio Sync Delay Offset Bar */}
                    <div className="flex items-center justify-between gap-1.5 p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-[10px]">
                      <span className="font-bold text-indigo-300 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" />
                        <span>סנכרון כללי (הזזת כל הכתוביות קדימה/אחורה):</span>
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleShiftAll(-0.5)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות חצי שנייה אחורה"
                        >
                          -0.5s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShiftAll(-0.1)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות 0.1s אחורה"
                        >
                          -0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShiftAll(0.1)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות 0.1s קדימה"
                        >
                          +0.1s
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShiftAll(0.5)}
                          className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-indigo-300 font-mono font-bold border border-indigo-500/30"
                          title="הזז את כל הכתוביות חצי שנייה קדימה"
                        >
                          +0.5s
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtitle List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 py-2 pr-1">
                  {subtitles.length > 0 ? (
                    subtitles.map((sub, idx) => {
                      const isSelected = selectedIds.includes(sub.id);
                      const isActive = currentTime >= sub.startTime && currentTime <= sub.endTime;

                      return (
                        <div
                          key={sub.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            isActive 
                              ? 'bg-purple-950/40 border-purple-500 shadow-lg' 
                              : isSelected 
                              ? 'bg-slate-900 border-indigo-500/50' 
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Cue Header */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <button onClick={() => toggleSelect(sub.id)}>
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-500" />
                                )}
                              </button>
                              <span className="text-[11px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                            </div>

                            {/* Precision Micro-Timers */}
                            <div className="flex items-center gap-1.5">
                              {/* Snap to current playhead */}
                              <button
                                type="button"
                                onClick={() => handleSnapToCurrentTime(sub.id)}
                                className="px-1.5 py-0.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-emerald-400 hover:text-emerald-300 border border-slate-800 text-[10px] font-mono flex items-center gap-1"
                                title="קבע זמן התחלה לפי מיקום הווידאו הנוכחי"
                              >
                                <Pin className="w-2.5 h-2.5" />
                                <span>נעץ זמן</span>
                              </button>

                              {/* Start Time */}
                              <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                                <span className="text-[10px] text-slate-500">התחלה:</span>
                                <button
                                  onClick={() => adjustTiming(sub.id, 'startTime', -0.1)}
                                  className="text-[10px] text-purple-400 hover:text-white px-1 font-mono"
                                >
                                  -
                                </button>
                                <span className="text-[11px] font-mono font-bold text-indigo-300">{sub.startTime}s</span>
                                <button
                                  onClick={() => adjustTiming(sub.id, 'startTime', 0.1)}
                                  className="text-[10px] text-purple-400 hover:text-white px-1 font-mono"
                                >
                                  +
                                </button>
                              </div>

                              {/* End Time */}
                              <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                                <span className="text-[10px] text-slate-500">סיום:</span>
                                <button
                                  onClick={() => adjustTiming(sub.id, 'endTime', -0.1)}
                                  className="text-[10px] text-purple-400 hover:text-white px-1 font-mono"
                                >
                                  -
                                </button>
                                <span className="text-[11px] font-mono font-bold text-indigo-300">{sub.endTime}s</span>
                                <button
                                  onClick={() => adjustTiming(sub.id, 'endTime', 0.1)}
                                  className="text-[10px] text-purple-400 hover:text-white px-1 font-mono"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                onClick={() => jumpToTime(sub.startTime)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                                title="קפיצה לזמן זה בווידאו"
                              >
                                <Play className="w-3 h-3" />
                              </button>

                              {/* ElevenLabs AI Voiceover Generator */}
                              <button
                                onClick={() => handlePlayVoiceover(sub)}
                                disabled={playingAudioId === sub.id}
                                className="p-1 rounded-lg hover:bg-slate-800 text-purple-400 hover:text-purple-300 transition-colors"
                                title="הקראת דיבוב קולי AI (ElevenLabs)"
                              >
                                <Volume2 className={`w-3.5 h-3.5 ${playingAudioId === sub.id ? 'animate-bounce text-amber-400' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleDeleteSubtitle(sub.id)}
                                className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Spoken Hebrew Text */}
                          <textarea
                            value={sub.text}
                            onChange={(e) => handleUpdateText(sub.id, e.target.value)}
                            rows={2}
                            className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 resize-none font-sans"
                          />

                          {/* Word-Level Precision Splitter (Interactive Tokens) */}
                          <div className="flex flex-wrap items-center gap-1 my-1.5 p-1.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                            <span className="text-[9px] text-slate-500 font-bold ml-1">חיתוך במילה:</span>
                            {sub.text.trim().split(/\s+/).map((w, wIdx, arr) => (
                              <button
                                key={wIdx}
                                type="button"
                                onClick={() => handleSplitAtWord(sub, wIdx + 1)}
                                disabled={wIdx === arr.length - 1}
                                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-purple-600/30 hover:border-purple-500/50 border border-slate-800 text-[10px] text-slate-300 hover:text-purple-200 transition-all flex items-center gap-0.5 group/w"
                                title={wIdx < arr.length - 1 ? `פצל את הכתובית אחרי המילה "${w}"` : ''}
                              >
                                <span>{w}</span>
                                {wIdx < arr.length - 1 && (
                                  <Scissors className="w-2.5 h-2.5 text-slate-600 group-hover/w:text-purple-400 opacity-0 group-hover/w:opacity-100 transition-opacity" />
                                )}
                              </button>
                            ))}
                          </div>

                          {/* Subtitle Action Bar (Split, Merge, Polish, Word Counter) */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 mt-1 border-t border-slate-800/60 text-[10px]">
                            <div className="flex items-center gap-1">
                              {/* Merge with prev */}
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleMergeWithPrev(idx)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700/80 transition-colors"
                                  title="מזג כתובית זו עם הכתובית הקודמת"
                                >
                                  <GitMerge className="w-3 h-3 rotate-180" />
                                  <span>עם הקודם</span>
                                </button>
                              )}

                              {/* Split in half */}
                              <button
                                type="button"
                                onClick={() => handleSplitSingleSubtitle(sub)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold border border-slate-700/80 transition-colors"
                                title="פצל כתובית זו לשני חלקים שווים עם חלוקת זמנים מדויקת"
                              >
                                <Scissors className="w-3 h-3" />
                                <span>פצל לשניים</span>
                              </button>

                              {/* Merge with next */}
                              {idx < subtitles.length - 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleMergeWithNext(idx)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold border border-slate-700/80 transition-colors"
                                  title="מזג כתובית זו עם הכתובית הבאה"
                                >
                                  <GitMerge className="w-3 h-3" />
                                  <span>עם הבא</span>
                                </button>
                              )}

                              {/* Polish Hebrew */}
                              <button
                                type="button"
                                onClick={() => handlePolishSingleSubtitle(sub.id)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold border border-slate-700/80 transition-colors"
                                title="נקה מילות מילוי ותקן פיסוק בכתובית זו"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>לטש</span>
                              </button>
                            </div>

                            <div className="text-slate-500 font-mono">
                              {sub.text.trim().split(/\s+/).filter(Boolean).length} מילים • {(sub.endTime - sub.startTime).toFixed(1)}s
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 px-5 text-center rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600/20 via-indigo-600/20 to-pink-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto shadow-lg shadow-purple-950/50">
                        <Subtitles className="w-6 h-6" />
                      </div>

                      <div className="space-y-1 max-w-md mx-auto">
                        <h4 className="text-sm font-bold text-white">אין עדיין כתוביות לפרק זה</h4>
                        <p className="text-xs text-slate-400">
                          בחרו את הדרך המועדפת עליכם ליצירת כתוביות מסונכרנות ומעוצבות:
                        </p>
                      </div>

                      {/* 4 Action Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-right">
                        {/* 1. Speech-to-Text AI */}
                        <button
                          type="button"
                          onClick={handleTranscribeRecordedAudio}
                          disabled={isTranscribing}
                          className="p-3 rounded-2xl bg-gradient-to-tr from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 text-amber-200 transition-all text-right group shadow-md"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Wand2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">תמלול AI מהקלטה</span>
                          </div>
                          <p className="text-[10px] text-slate-400">תמלול מילה במילה מהקלטת הפרק</p>
                        </button>

                        {/* 2. Generate from Outline / Topics */}
                        <button
                          type="button"
                          onClick={handleGenerateFromTopics}
                          className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 border border-indigo-500/30 text-indigo-200 transition-all text-right group shadow-md"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">צור מנושאי הפרק</span>
                          </div>
                          <p className="text-[10px] text-slate-400">סנכרון תסריט הפרק לפי קצב דיבור</p>
                        </button>

                        {/* 3. Import SRT / VTT */}
                        <button
                          type="button"
                          onClick={() => srtFileInputRef.current?.click()}
                          className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 text-slate-200 transition-all text-right group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Upload className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">ייבוא קובץ כתוביות</span>
                          </div>
                          <p className="text-[10px] text-slate-400">טעינת קובץ SRT או VTT חיצוני</p>
                        </button>

                        {/* 4. Live Dictation Web Speech */}
                        <button
                          type="button"
                          onClick={toggleLiveDictation}
                          className="p-3 rounded-2xl bg-slate-900/90 hover:bg-slate-850 border border-slate-700/80 text-slate-200 transition-all text-right group"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Mic className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-xs text-white">הכתבה בדיבור ישיר</span>
                          </div>
                          <p className="text-[10px] text-slate-400">הכתבה למיקרופון ללא צורך במפתח</p>
                        </button>
                      </div>

                      {/* Manual Add Cue */}
                      <button
                        type="button"
                        onClick={handleAddSubtitle}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>או הוסף כתובית ידנית בנקודת הזמן הנוכחית</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Visual Styling & Font Manager */}
            {sidebarTab === 'style' && (
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                {/* Preset Themes Gallery */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                    <span>תבניות עיצוב מוכנות מראש (Presets):</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SUBTITLE_THEMES.map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => handleApplyTheme(th)}
                        className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 hover:bg-purple-950/20 text-right transition-all group"
                      >
                        <div className="font-bold text-xs text-white group-hover:text-purple-300 mb-0.5">{th.name}</div>
                        <p className="text-[10px] text-slate-400 line-clamp-2">{th.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs text-purple-200">
                  {selectedIds.length > 0 ? (
                    <p className="font-bold">עיצוב עבור {selectedIds.length} כתוביות שנבחרו</p>
                  ) : (
                    <p className="font-bold">עיצוב גלובלי לכל הכתוביות בפודקאסט</p>
                  )}
                </div>

                {/* Font Selector & Custom Font Uploader */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">גופן כתוביות (Font Family)</label>
                    <button
                      onClick={() => fontInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs font-semibold text-purple-400 hover:text-purple-300"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>העלאת פונט (.ttf / .otf / .woff)</span>
                    </button>
                    <input
                      ref={fontInputRef}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={handleFontUpload}
                      className="hidden"
                    />
                  </div>

                  <select
                    value={globalStyle.fontFamily}
                    onChange={(e) => applyStyleUpdate({ fontFamily: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    {allFontsList.map((f, i) => (
                      <option key={i} value={f.value}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {/* Font Size & Weight */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">גודל גופן ({globalStyle.fontSize}px)</label>
                    <input
                      type="range"
                      min={16}
                      max={56}
                      value={globalStyle.fontSize || 28}
                      onChange={(e) => applyStyleUpdate({ fontSize: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">משקל גופן</label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      {[
                        { id: 'normal', label: 'רגיל' },
                        { id: 'bold', label: 'בולט' },
                        { id: '900', label: 'Black' }
                      ].map((w) => (
                        <button
                          key={w.id}
                          onClick={() => applyStyleUpdate({ fontWeight: w.id as any, isBold: w.id !== 'normal' })}
                          className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                            (globalStyle.fontWeight === w.id || (w.id === 'bold' && globalStyle.isBold && !globalStyle.fontWeight))
                              ? 'bg-purple-600 text-white' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Text Alignment */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400">יישור טקסט</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    {[
                      { id: 'right', label: 'לימין (עברית)', icon: AlignRight },
                      { id: 'center', label: 'למרכז', icon: AlignCenter },
                      { id: 'left', label: 'לשמאל (אנגלית)', icon: AlignLeft }
                    ].map((a) => {
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.id}
                          onClick={() => applyStyleUpdate({ textAlign: a.id as any })}
                          className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all ${
                            (globalStyle.textAlign || 'center') === a.id 
                              ? 'bg-purple-600 text-white' 
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Box / Background Style */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">סגנון רקע ותגית</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'ללא רקע (טקסט נקי)' },
                      { id: 'rounded-badge', label: 'תגית מעוגלת' },
                      { id: 'pill-badge', label: 'גלולה מעוגלת (Pill)' },
                      { id: 'glassmorphism', label: 'זכוכית מטושטשת' },
                      { id: 'full-bar', label: 'פס מלא לרוחב' }
                    ].map((b) => (
                      <button
                        key={b.id}
                        onClick={() => applyStyleUpdate({ boxStyle: b.id as any })}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                          globalStyle.boxStyle === b.id 
                            ? 'bg-purple-600 border-purple-400 text-white shadow' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Shadow & Glow Effects */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">אפקטי צל וזוהר</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'none', label: 'ללא אפקט' },
                      { id: 'soft', label: 'צל רך (Soft)' },
                      { id: 'hard-outline', label: 'מסגרת חדה (Outline)' },
                      { id: 'neon-glow', label: 'זוהר ניאון (Glow)' },
                      { id: 'cinema-blur', label: 'טשטוש קולנועי' }
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => applyStyleUpdate({ textShadow: s.id as any })}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                          (globalStyle.textShadow || 'soft') === s.id 
                            ? 'bg-purple-600 border-purple-400 text-white shadow' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Karaoke Word Animation */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">אפקט הדגשת מילה מדוברת (Karaoke Pop)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'color-pop', label: 'צהוב קופץ (TikTok)' },
                      { id: 'glow', label: 'זוהר ניאון למילה' },
                      { id: 'none', label: 'ללא הדגשת מילה' }
                    ].map((anim) => (
                      <button
                        key={anim.id}
                        onClick={() => applyStyleUpdate({ activeWordAnimation: anim.id as any })}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                          (globalStyle.activeWordAnimation || 'color-pop') === anim.id 
                            ? 'bg-purple-600 border-purple-400 text-white shadow' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {anim.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">צבע טקסט</label>
                    <input
                      type="color"
                      value={globalStyle.textColor || '#FFFFFF'}
                      onChange={(e) => applyStyleUpdate({ textColor: e.target.value })}
                      className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">צבע מילה מודגשת</label>
                    <input
                      type="color"
                      value={globalStyle.highlightWordColor || '#FACC15'}
                      onChange={(e) => applyStyleUpdate({ highlightWordColor: e.target.value })}
                      className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">צבע רקע</label>
                    <input
                      type="color"
                      value={(globalStyle.backgroundColor && globalStyle.backgroundColor.startsWith('#')) ? globalStyle.backgroundColor : '#000000'}
                      onChange={(e) => applyStyleUpdate({ backgroundColor: e.target.value })}
                      className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">צבע קו מתאר</label>
                    <input
                      type="color"
                      value={globalStyle.strokeColor || '#000000'}
                      onChange={(e) => applyStyleUpdate({ strokeColor: e.target.value })}
                      className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                    />
                  </div>
                </div>

                {/* Vertical Position */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">מיקום אנכי על המסך</label>
                    <span className="text-[11px] font-mono text-purple-400">
                      {typeof globalStyle.positionY === 'number' ? `${globalStyle.positionY}%` : globalStyle.positionY}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { id: 15, label: 'למעלה (15%)' },
                      { id: 50, label: 'במרכז (50%)' },
                      { id: 82, label: 'למטה (82%)' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyStyleUpdate({ positionY: p.id })}
                        className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          globalStyle.positionY === p.id 
                            ? 'bg-purple-600 border-purple-400 text-white' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={typeof globalStyle.positionY === 'number' ? globalStyle.positionY : 80}
                    onChange={(e) => applyStyleUpdate({ positionY: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: Pacing & Precision Sentence Segmentation Suite */}
            {sidebarTab === 'pacing' && (
              <div className="flex-1 p-5 overflow-y-auto space-y-5">
                <div className="p-4 rounded-2xl bg-gradient-to-tr from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 space-y-1.5">
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <Split className="w-4 h-4 text-purple-400" />
                    <span>מנוע דיוק וחלוקת משפטים חכם</span>
                  </h4>
                  <p className="text-xs text-slate-300">
                    בחרו את האסטרטגיה המדויקת לחלוקת המשפטים והדיבור – לפי משמעות סמנטית, כמות מילים קצבית או מגבלת תווים למובייל.
                  </p>
                </div>

                {/* 1. Semantic Sentence Splitter */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">חלוקה סמנטית לפי פיסוק ומשפטים</div>
                        <div className="text-[10px] text-slate-400">חותך משפטים אך ורק בסיום רעיון לוגי (נקודות, פסיקים, מקפים וסימני שאלה)</div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSegmentByPunctuation}
                    disabled={subtitles.length === 0}
                    className="w-full py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    הפעל חלוקה סמנטית על כל {subtitles.length} הכתוביות
                  </button>
                </div>

                {/* 2. Paced Word Count Splitter */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-600/20 text-purple-400">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">חלוקה לפי קצב מילים קבוע</div>
                        <div className="text-[10px] text-slate-400">קביעת כמות מילים מדויקת בכל שורת כתובית</div>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-purple-600/30 text-purple-300 font-mono font-bold text-xs">
                      {wordsPerLine} מילים
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={8}
                    value={wordsPerLine}
                    onChange={(e) => setWordsPerLine(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>1-2 (רילס מהיר)</span>
                    <span>3-4 (מומלץ)</span>
                    <span>6-8 (משפט שלם)</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRebalanceAll(wordsPerLine)}
                    disabled={subtitles.length === 0}
                    className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all disabled:opacity-40"
                  >
                    חלק מחדש את כל הכתוביות ל-{wordsPerLine} מילים
                  </button>
                </div>

                {/* 3. Mobile Max Character Width Splitter */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400">
                      <Type className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">מגבלת רוחב תווים למובייל (Reels / Shorts)</div>
                      <div className="text-[10px] text-slate-400">מונע שבירת שורות מכוערת ומתאים את הטקסט בדיוק לרוחב הטלפון</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {[
                      { chars: 22, label: 'קצרצר (22 תווים)' },
                      { chars: 32, label: 'סטנדרט (32 תווים)' },
                      { chars: 45, label: 'רחב (45 תווים)' }
                    ].map(c => (
                      <button
                        key={c.chars}
                        type="button"
                        onClick={() => handleSegmentByMaxChars(c.chars)}
                        disabled={subtitles.length === 0}
                        className="py-2 rounded-xl bg-slate-900 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-emerald-300 text-[11px] font-bold transition-all disabled:opacity-40"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Global AI Polish & Spacing */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">ליטוש וניקוי עברית אוטומטי (AI Polish)</div>
                      <div className="text-[10px] text-slate-400">מסיר מילות מילוי (אהה, כאילו), מתקן רווחים לפני פיסוק ומיישר זרימה</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePolishAllSubtitles}
                    disabled={subtitles.length === 0}
                    className="w-full py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all disabled:opacity-40"
                  >
                    בצע ליטוש ויישור עברית לכל הכתוביות
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtitles AI Translation Modal */}
      {isTranslateModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#161b26] border border-slate-700 shadow-2xl text-right">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <button 
                onClick={() => setIsTranslateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">תרגום כתוביות חכם (AI Translate)</h3>
                  <p className="text-xs text-slate-400">תרגום כל {subtitles.length} הכתוביות תוך שמירה מדויקת על כל התזמונים</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <label className="block text-xs font-bold text-slate-300">בחר שפת יעד לתרגום:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { code: 'en', label: '🇺🇸 אנגלית (English)' },
                  { code: 'es', label: '🇪🇸 ספרדית (Español)' },
                  { code: 'fr', label: '🇫🇷 צרפתית (Français)' },
                  { code: 'ru', label: '🇷🇺 רוסית (Русский)' },
                  { code: 'ar', label: '🇸🇦 ערבית (العربية)' },
                  { code: 'de', label: '🇩🇪 גרמנית (Deutsch)' },
                  { code: 'it', label: '🇮🇹 איטלקית (Italiano)' },
                  { code: 'he', label: '🇮🇱 עברית (עריכה)' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedTargetLang(lang.code)}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-right transition-all flex items-center justify-between ${
                      selectedTargetLang === lang.code
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{lang.label}</span>
                    {selectedTargetLang === lang.code && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTranslateModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                ביטול
              </button>
              <button
                onClick={() => handleTranslateSubtitles(selectedTargetLang)}
                disabled={isTranslating}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isTranslating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>מתרגם כתוביות...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>בצע תרגום AI עכשיו</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini & ElevenLabs AI Settings Modal */}
      <SubtitleAISettingsModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSaved={(updated) => setAISettings(updated)}
      />
    </div>
  );
}
