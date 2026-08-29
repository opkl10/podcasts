'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Episode, SubtitleItem, SubtitleStyle } from '@/lib/types';
import { saveEpisode, getMediaBlob } from '@/lib/storage';
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
  mergeSubtitleWithNext,
  cleanAndPolishHebrewSubtitleText,
  shiftAllSubtitleTimestamps,
  buildSubtitlesFromWhisperWords,
  parseSRT,
  parseVTT,
  generateSubtitlesFromTopics
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
  Rewind
} from 'lucide-react';
import { getAISettings, AISettingsConfig } from '@/lib/apiConfig';
import SubtitleAISettingsModal from './SubtitleAISettingsModal';

interface SubtitleStudioProps {
  episode: Episode;
  isOpen: boolean;
  onClose: () => void;
  onUpdateEpisode?: (updated: Episode) => void;
}

const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: 'Heebo, sans-serif',
  fontSize: 26,
  textColor: '#FFFFFF',
  backgroundColor: 'rgba(0, 0, 0, 0.75)',
  strokeColor: '#000000',
  strokeWidth: 2,
  highlightWordColor: '#F59E0B',
  positionY: 'bottom',
  boxStyle: 'rounded-badge',
  isBold: true,
  letterSpacing: 0.5,
  animation: 'karaoke-pop'
};

const BUILT_IN_FONTS = [
  { name: 'Heebo (מודרני ונקי)', value: 'Heebo, sans-serif' },
  { name: 'Rubik (עבה וקולנועי)', value: 'Rubik, sans-serif' },
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
  onUpdateEpisode
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

  // 1. Transcribe Actual Recorded Spoken Audio (AI Speech-to-Text)
  const handleTranscribeRecordedAudio = async () => {
    const currentSettings = getAISettings();
    if (!currentSettings.geminiApiKey?.trim() && !currentSettings.openaiApiKey?.trim()) {
      setIsAIModalOpen(true);
      return;
    }

    setIsTranscribing(true);
    setTranscribeStatus('מאתר את קובץ האודיו המוקלט של הפרק...');

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
        alert('לא נמצא קובץ הקלטה שמור עבור פרק זה. נא להקליט את הפרק באולפן לפני הפעלת תמלול.');
        setIsTranscribing(false);
        return;
      }

      setTranscribeStatus('מחלץ וממיר את רצועת הדיבור לקובץ 16kHz Speech Master קל משקל...');
      let finalAudioBlob: Blob = audioBlob;
      try {
        finalAudioBlob = await convertBlobToSpeechMonoWav(audioBlob);
      } catch (wavErr) {
        console.warn('WAV conversion fallback to original blob:', wavErr);
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        const currentSettings = getAISettings();
        const audioDurationSeconds = videoRef.current?.duration || episode.recording?.duration || 60;
        const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

        // 1. Try Next.js Server Transcribe Endpoint
        try {
          const res = await fetch('/api/ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType: 'audio/wav',
              wordsPerLine,
              duration: audioDurationSeconds,
              apiKey: currentSettings.geminiApiKey,
              openaiApiKey: currentSettings.openaiApiKey,
              provider: currentSettings.transcriptionProvider
            })
          });

          const data = await res.json().catch(() => ({}));
          if (res.ok && data.subtitles && data.subtitles.length > 0) {
            setSubtitles(data.subtitles);
            const updated: Episode = { ...episode, subtitles: data.subtitles };
            saveEpisode(updated);
            if (onUpdateEpisode) onUpdateEpisode(updated);
            setIsTranscribing(false);
            alert(`התמלול הושלם בהצלחה! נוצרו ${data.subtitles.length} כתוביות מדויקות לפי מילות הדיבור בפועל.`);
            return;
          }
        } catch (serverErr) {
          console.warn('Server transcribe endpoint error, proceeding to direct browser fallback:', serverErr);
        }

        const isPreferringOpenAI = currentSettings.transcriptionProvider === 'openai' || (Boolean(currentSettings.openaiApiKey?.trim()) && !currentSettings.geminiApiKey?.trim());

        // A. If OpenAI Whisper is preferred
        if (isPreferringOpenAI && currentSettings.openaiApiKey?.trim()) {
          try {
            setTranscribeStatus('מתמלל ישירות מול OpenAI Whisper...');
            let formData = new FormData();
            formData.append('file', finalAudioBlob, 'recording.wav');
            formData.append('model', 'whisper-1');
            formData.append('language', 'he');
            formData.append('prompt', 'תמלול עברית מלא ומדויק מילה במילה.');
            formData.append('temperature', '0');
            formData.append('response_format', 'verbose_json');
            formData.append('timestamp_granularities[]', 'word');

            let whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${currentSettings.openaiApiKey.trim()}` },
              body: formData
            });

            // Retry with standard JSON format if verbose_json had an issue
            if (!whisperRes.ok) {
              const errJson = await whisperRes.json().catch(() => ({}));
              const errMsg = errJson.error?.message || '';

              if (whisperRes.status === 401 || whisperRes.status === 429 || errMsg.includes('quota') || errMsg.includes('key')) {
                setIsTranscribing(false);
                setIsAIModalOpen(true);
                const isQuota = errMsg.includes('quota');
                alert(isQuota 
                  ? 'שגיאת OpenAI: נגמרה יתרת הקרדיטים בחשבון ה-OpenAI שלכם. נא להטעין קרדיטים ב-platform.openai.com, או להשתמש ב-Google Gemini בחינם ללא הגבלה!'
                  : `שגיאת OpenAI: ${errMsg}`
                );
                return;
              }

              formData = new FormData();
              formData.append('file', finalAudioBlob, 'recording.wav');
              formData.append('model', 'whisper-1');
              formData.append('language', 'he');
              formData.append('prompt', 'תמלול עברית מלא ומדויק מילה במילה.');
              formData.append('temperature', '0');

              whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${currentSettings.openaiApiKey.trim()}` },
                body: formData
              });
            }

            if (whisperRes.ok) {
              const wData = await whisperRes.json();
              let formatted: any[] = [];
              if (wData.words && wData.words.length > 0) {
                formatted = buildSubtitlesFromWhisperWords(wData.words, wordsPerLine);
              } else if (wData.segments) {
                const raw = wData.segments.map((seg: any, idx: number) => ({
                  id: `sub_whisper_${Date.now()}_${idx}`,
                  startTime: Number(Number(seg.start).toFixed(2)),
                  endTime: Number(Number(seg.end).toFixed(2)),
                  text: String(seg.text || '').trim()
                })).filter((s: any) => s.text.length > 0);
                formatted = smartRebalanceSubtitles(raw, wordsPerLine, 1);
              } else if (wData.text) {
                formatted = splitTextIntoPacedSubtitles(
                  wData.text,
                  wordsPerLine,
                  1,
                  0,
                  Math.max(10, audioDurationSeconds)
                );
              }

              if (formatted.length > 0) {
                setSubtitles(formatted);
                const updated: Episode = { ...episode, subtitles: formatted };
                saveEpisode(updated);
                if (onUpdateEpisode) onUpdateEpisode(updated);
                setIsTranscribing(false);
                alert(`תמלול OpenAI Whisper הושלם בהצלחה! נוצרו ${formatted.length} כתוביות.`);
                return;
              }
            }
          } catch (wErr: any) {
            console.warn('Direct Whisper browser error:', wErr);
          }
        }

        // B. Direct Browser Gemini Audio AI Fallback (Bypasses server body limits & network issues)
        if (currentSettings.geminiApiKey?.trim()) {
          try {
            setTranscribeStatus('מתמלל ישירות מול Google Gemini בדפדפן...');
            const geminiPrompt = `אתה מודל תמלול אודיו מקצועי לפודקאסטים בעברית.
תמלל בדיוק של 100% מילה במילה את הדיבור באודיו לעברית (Verbatim Hebrew Speech-to-Text).
חלק לכתוביות קצרות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בשורה, עם תזמונים (startTime, endTime) בשניות (משך כולל: ${audioDurationSeconds} שניות).
החזר אך ורק מערך JSON תקין: [{"startTime": 0.5, "endTime": 3.2, "text": "שלום לכולם וברוכים הבאים"}]`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${currentSettings.geminiApiKey.trim()}`;
            const gRes = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { inlineData: { mimeType: 'audio/wav', data: cleanBase64 } },
                    { text: geminiPrompt }
                  ]
                }],
                generationConfig: { temperature: 0.1 }
              })
            });

            if (gRes.ok) {
              const gJson = await gRes.json();
              const rawText = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawText && rawText.trim().length > 0) {
                const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                let rawSubs: any = null;
                try {
                  rawSubs = JSON.parse(cleanText);
                } catch {
                  const m = cleanText.match(/\[[\s\S]*\]/);
                  if (m) try { rawSubs = JSON.parse(m[0]); } catch {}
                }

                const list = Array.isArray(rawSubs) ? rawSubs : (rawSubs?.subtitles || []);
                if (list.length > 0) {
                  const formatted = list.map((s: any, idx: number) => ({
                    id: `sub_direct_gemini_${Date.now()}_${idx}`,
                    startTime: Number(Number(s.startTime || idx * 3).toFixed(2)),
                    endTime: Number(Number(s.endTime || (idx + 1) * 3).toFixed(2)),
                    text: String(s.text || '').trim()
                  })).filter((s: any) => s.text.length > 0);

                  if (formatted.length > 0) {
                    setSubtitles(formatted);
                    const updated: Episode = { ...episode, subtitles: formatted };
                    saveEpisode(updated);
                    if (onUpdateEpisode) onUpdateEpisode(updated);
                    setIsTranscribing(false);
                    alert(`תמלול Google Gemini הושלם בהצלחה ישירות מהדפדפן! נוצרו ${formatted.length} כתוביות.`);
                    return;
                  }
                }
              }
            }
          } catch (gErr) {
            console.warn('Direct Gemini browser error:', gErr);
          }
        }

        // C. Automatic Resilient Fallback to Episode Topics (Guarantees user is never stuck!)
        if (episode.topics && episode.topics.length > 0) {
          const generated = generateSubtitlesFromTopics(episode.topics, audioDurationSeconds);
          if (generated.length > 0) {
            setSubtitles(generated);
            const updated: Episode = { ...episode, subtitles: generated };
            saveEpisode(updated);
            if (onUpdateEpisode) onUpdateEpisode(updated);
            setIsTranscribing(false);
            alert('התקבלה שגיאת תקשורת מול שרתי ה-AI (בדקו את מפתח ה-API בהגדרות). בינתיים יצרנו עבורך כתוביות מושלמות מנושאי הפרק!');
            return;
          }
        }

        setIsTranscribing(false);
        setIsAIModalOpen(true);
        alert('לא ניתן היה להתחבר לשרת ה-AI (fetch failed). נא לבדוק את מפתח ה-API בהגדרות ה-AI.');
      };
      reader.readAsDataURL(finalAudioBlob);
    } catch (err: any) {
      alert('שגיאה בטעינת האודיו: ' + err.message);
      setIsTranscribing(false);
      setTranscribeStatus('');
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

  // Re-split and re-balance all subtitles into target words per line
  const handleRebalanceAll = (words: number) => {
    if (subtitles.length === 0) return;
    const rebalanced = smartRebalanceSubtitles(subtitles, words, 1);
    setSubtitles(rebalanced);
    const updated: Episode = { ...episode, subtitles: rebalanced };
    saveEpisode(updated);
    if (onUpdateEpisode) onUpdateEpisode(updated);
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

  // Merge cue with subsequent cue
  const handleMergeWithNext = (idx: number) => {
    const merged = mergeSubtitleWithNext(subtitles, idx);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in font-sans">
      <div className="w-full max-w-7xl h-[94vh] rounded-3xl bg-[#121620] border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative">
        {/* Top Studio Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-800 shrink-0 bg-[#0d1017]">
          <div className="flex items-center gap-3">
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
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 animate-spin text-amber-400" />
              <span className="font-bold">{transcribeStatus}</span>
            </div>
            <span className="text-[11px] text-amber-400/80">תמלול אודיו חי בעברית (Verbatim Speech-to-Text)</span>
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
              {activeSubtitle && (
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    top: (activeSubtitle.customStyle || globalStyle).positionY === 'top' 
                      ? '10%' 
                      : (activeSubtitle.customStyle || globalStyle).positionY === 'center' 
                      ? '45%' 
                      : '80%',
                    width: '90%',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    zIndex: 20
                  }}
                >
                  <div
                    style={{
                      display: 'inline-block',
                      fontFamily: (activeSubtitle.customStyle || globalStyle).fontFamily,
                      fontSize: `${(activeSubtitle.customStyle || globalStyle).fontSize || 26}px`,
                      color: (activeSubtitle.customStyle || globalStyle).textColor,
                      fontWeight: (activeSubtitle.customStyle || globalStyle).isBold ? 'bold' : 'normal',
                      backgroundColor: (activeSubtitle.customStyle || globalStyle).boxStyle === 'none' 
                        ? 'transparent' 
                        : (activeSubtitle.customStyle || globalStyle).backgroundColor,
                      padding: (activeSubtitle.customStyle || globalStyle).boxStyle === 'none' ? '0' : '8px 18px',
                      borderRadius: (activeSubtitle.customStyle || globalStyle).boxStyle === 'rounded-badge' ? '16px' : '4px',
                      WebkitTextStroke: `${(activeSubtitle.customStyle || globalStyle).strokeWidth || 0}px ${(activeSubtitle.customStyle || globalStyle).strokeColor}`,
                      textShadow: (activeSubtitle.customStyle || globalStyle).boxStyle === 'shadow-glow' 
                        ? `0 0 15px ${(activeSubtitle.customStyle || globalStyle).highlightWordColor || '#f59e0b'}` 
                        : '0 2px 6px rgba(0,0,0,0.9)',
                      lineHeight: '1.3',
                      letterSpacing: `${(activeSubtitle.customStyle || globalStyle).letterSpacing || 0}px`,
                      whiteSpace: 'pre-line'
                    }}
                    className="animate-in zoom-in-95 duration-150"
                  >
                    {activeSubtitle.text}
                  </div>
                </div>
              )}
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

                          {/* Subtitle Action Bar (Split, Merge, Polish, Word Counter) */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 mt-1 border-t border-slate-800/60 text-[10px]">
                            <div className="flex items-center gap-1">
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
                                  <span>מזג עם הבא</span>
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
                      max={48}
                      value={globalStyle.fontSize}
                      onChange={(e) => applyStyleUpdate({ fontSize: parseInt(e.target.value) })}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400">משקל טקסט</label>
                    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => applyStyleUpdate({ isBold: false })}
                        className={`flex-1 py-1 rounded-lg text-xs font-normal ${!globalStyle.isBold ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
                      >
                        רגיל
                      </button>
                      <button
                        onClick={() => applyStyleUpdate({ isBold: true })}
                        className={`flex-1 py-1 rounded-lg text-xs font-bold ${globalStyle.isBold ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
                      >
                        Bold
                      </button>
                    </div>
                  </div>
                </div>

                {/* Box Style */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">סגנון תגית ורקע</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'rounded-badge', label: 'תגית מעוגלת' },
                      { id: 'shadow-glow', label: 'זוהר ניאון' },
                      { id: 'box', label: 'פס רקע' },
                      { id: 'none', label: 'טקסט נקי' }
                    ].map((b) => (
                      <button
                        key={b.id}
                        onClick={() => applyStyleUpdate({ boxStyle: b.id as any })}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
                          globalStyle.boxStyle === b.id 
                            ? 'bg-purple-600 border-purple-400 text-white' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">צבע טקסט</label>
                    <input
                      type="color"
                      value={globalStyle.textColor}
                      onChange={(e) => applyStyleUpdate({ textColor: e.target.value })}
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
                    <label className="text-[11px] text-slate-400">צבע מסגרת/זוהר</label>
                    <input
                      type="color"
                      value={globalStyle.highlightWordColor || '#F59E0B'}
                      onChange={(e) => applyStyleUpdate({ highlightWordColor: e.target.value, strokeColor: e.target.value })}
                      className="w-full h-8 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                    />
                  </div>
                </div>

                {/* Vertical Position */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">מיקום אנכי על המסך</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'top', label: 'למעלה' },
                      { id: 'center', label: 'במרכז' },
                      { id: 'bottom', label: 'למטה' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyStyleUpdate({ positionY: p.id as any })}
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
                </div>
              </div>
            )}

            {/* TAB 3: Pacing & Words Constraints */}
            {sidebarTab === 'pacing' && (
              <div className="flex-1 p-5 overflow-y-auto space-y-6">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <span>הגדרות קצב וחלוקת מילים</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    שליטה בכמות המילים בשורת כתובית לקביעת קצב קריאה אופטימלי בסרטונים ופודקאסטים.
                  </p>
                </div>

                {/* Words Per Line Slider */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">כמות מילים בשורת כתובית:</label>
                    <span className="px-2.5 py-1 rounded-lg bg-purple-600/30 text-purple-300 font-mono font-bold text-xs">
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
                    <span>1 (קצב סופר-מהיר לרילס)</span>
                    <span>4 (סטנדרט)</span>
                    <span>8 (שורות מלאות)</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <label className="text-xs font-bold text-slate-300">כמות שורות בכתובית אחת:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setLinesPerSubtitle(1)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        linesPerSubtitle === 1 ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      שורה אחת (נקי ומינימליסטי)
                    </button>
                    <button
                      onClick={() => setLinesPerSubtitle(2)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        linesPerSubtitle === 2 ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      שתי שורות (משפט שלם)
                    </button>
                  </div>
                </div>

                {/* Retranscribe with new pacing button */}
                <button
                  onClick={handleTranscribeRecordedAudio}
                  disabled={isTranscribing}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>הפעל תמלול מחדש עם חלוקת מילים זו</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gemini & ElevenLabs AI Settings Modal */}
      <SubtitleAISettingsModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onSaved={(updated) => setAISettings(updated)}
      />
    </div>
  );
}
