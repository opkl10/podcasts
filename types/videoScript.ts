// Types for Video Analyzer & Hebrew Production Script Studio

export type VideoSourceType = 'url' | 'upload' | 'direct_text';

export type TargetPlatform = 'youtube' | 'tiktok_reels' | 'podcast' | 'general';

export type ScriptTone = 'viral_energetic' | 'deep_storytelling' | 'educational' | 'entertaining';

export interface OriginalVideoMeta {
  title: string;
  author?: string;
  duration?: number; // seconds
  thumbnailUrl?: string;
  sourceUrl?: string;
  videoId?: string;
  platform?: 'youtube' | 'tiktok' | 'vimeo' | 'direct' | 'uploaded';
}

export interface TranscriptSegment {
  id: string;
  startTime?: number; // in seconds
  endTime?: number;
  englishText: string;
  hebrewText: string;
  speaker?: string;
}

export interface VideoTranscript {
  englishText: string;
  hebrewText: string;
  summary: string;
  keyPoints: string[];
  segments?: TranscriptSegment[];
}

export interface ProductionScriptScene {
  sceneNumber: number;
  sceneTitle: string;
  estimatedSeconds: number;
  visualDirection: string; // מה רואים על המסך: זוויות מצלמה, זום, B-roll, כתוביות מודגשות, גרפיקה
  spokenHebrewText: string; // הטקסט המדויק לדיבור מול המצלמה בעברית טבעית וקולחת
  audioSoundEffect?: string; // אפקט צליל Whoosh, מוזיקת מתח, ביט קצבי
  directorTip?: string; // טיפ להגשה: קצב, אינטונציה, שפת גוף
}

export interface ProductionScript {
  titleHebrew: string; // כותרת ראשית מושכת בעברית
  alternateTitles: string[]; // 3 כותרות נוספות לבחירה
  targetPlatform: TargetPlatform;
  targetDurationMinutes: number;
  hook: string; // הוק פתיחה ממגנט (0-5 שניות)
  scenes: ProductionScriptScene[];
  callToAction: string; // משפט סיום והנעה לפעולה
  descriptionHebrew: string; // תיאור מומלץ לסרטון ביוטיוב/סושיאל
  hashtags: string[];
  productionNotes: string; // טיפים להפקה: ציוד, תאורה, סגנון עריכה
}

export interface VideoAnalysisResult {
  metadata: OriginalVideoMeta;
  transcript: VideoTranscript;
  script: ProductionScript;
  createdAt: string;
}
