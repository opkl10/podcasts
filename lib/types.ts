export type EpisodeStatus = 
  | 'draft'       // רעיון ראשוני
  | 'research'    // בשלבי מחקר וכתיבה
  | 'ready'       // מוכן להקלטה
  | 'recording'   // באולפן / בהקלטה
  | 'recorded'    // הוקלט בהצלחה
  | 'published';  // פורסם

export interface PodcastShow {
  id: string;
  title: string;
  description: string;
  coverColor?: string;
  category?: string;
  hostName?: string;
  createdAt: string;
}

export type MarkerType = 'highlight' | 'topic_change' | 'clip_cut' | 'note' | 'question';

export interface TimestampMarker {
  id: string;
  timestamp: number; // in seconds
  label: string;
  type: MarkerType;
  topicId?: string;
  createdAt: string;
}

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  description?: string;
}

export interface TopicItem {
  id: string;
  title: string;
  estimatedMinutes: number;
  actualSeconds?: number;
  notes: string;
  talkingPoints: string[];
  questions: string[];
  resources: ResourceLink[];
  completed: boolean;
  order: number;
}

export interface GuestInfo {
  name: string;
  role?: string;
  bio?: string;
  avatar?: string;
  links?: { platform: string; url: string }[];
}

export interface RecordingMetadata {
  duration: number; // in seconds
  recordedAt: string;
  videoBlobKey?: string; // key in IndexedDB
  audioBlobKey?: string;
  videoUrl?: string; // object URL or data URL
  fileSize?: number;
  mimeType?: string;
  resolution?: '720p' | '1080p' | '4k';
  markers: TimestampMarker[];
  topicsCovered: string[]; // topic IDs
}

export interface SubtitleStyle {
  fontFamily?: string;
  fontSize?: number; // in px (14 - 48)
  textColor?: string;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  highlightWordColor?: string;
  positionY?: 'bottom' | 'center' | 'top' | number; // percentage from top (10 - 90)
  boxStyle?: 'none' | 'rounded-badge' | 'full-bar' | 'shadow-glow';
  isBold?: boolean;
  isUppercase?: boolean;
  letterSpacing?: number;
  animation?: 'none' | 'karaoke-pop' | 'fade' | 'bounce';
}

export interface SubtitleItem {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  speaker?: string;
  customStyle?: SubtitleStyle;
}

export interface Episode {
  id: string;
  podcastId: string; // מסווג לפודקאסט מסוים
  title: string;
  episodeNumber: number;
  season: number;
  status: EpisodeStatus;
  mediaType?: 'video' | 'audio_only'; // תמיכה בפרק וידאו או אודיו בלבד
  description: string;
  guest?: GuestInfo;
  targetDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
  topics: TopicItem[];
  movieFacts?: MovieFactCard[];
  recording?: RecordingMetadata;
  subtitles?: SubtitleItem[];
  subtitleStyle?: SubtitleStyle;
  coverImage?: string;
  tags?: string[];
}

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface VideoInputDevice {
  deviceId: string;
  label: string;
  isIPhone?: boolean;
  isContinuity?: boolean;
}

export type FactCategory = 
  | 'trivia' 
  | 'behind_the_scenes' 
  | 'box_office' 
  | 'critical_reception' 
  | 'easter_egg' 
  | 'director_vision' 
  | 'cast_secret';

export interface MovieFactCard {
  id: string;
  movieTitle: string;
  category: FactCategory;
  fact: string;
  source: 'IMDb' | 'Wikipedia' | 'Rotten Tomatoes' | 'Letterboxd' | 'Metacritic' | 'Variety / Empire' | 'Box Office Mojo' | 'Other';
  sourceUrl?: string;
  ratingScore?: string;
  year?: string;
  tags?: string[];
  isPinnedToHUD?: boolean;
  spoilerLevel?: 'none' | 'mild' | 'heavy';
  directorOrActor?: string;
  verified?: boolean;
}

// Live Broadcast Graphic Overlays with Position & Scale Controls
export interface ElementTransform {
  x: number;      // percentage (0 - 100)
  y: number;      // percentage (0 - 100)
  scale: number;  // scale factor (0.5 - 2.5)
}

export interface LiveOverlayState {
  isLayoutEditMode?: boolean;
  poster: {
    show: boolean;
    url: string;
    title?: string;
    caption?: string;
    transform: ElementTransform;
  };
  quote: {
    show: boolean;
    text: string;
    speaker?: string;
    transform: ElementTransform;
  };
  rating: {
    show: boolean;
    imdb?: string;
    rottenTomatoes?: string;
    personalScore?: string;
    transform: ElementTransform;
  };
  customBanner: {
    show: boolean;
    title: string;
    subtitle?: string;
    transform: ElementTransform;
  };
  spoilerAlert: {
    show: boolean;
    text?: string;
    transform: ElementTransform;
  };
  logo: {
    show: boolean;
    url: string;
    opacity: number; // 0.2 - 1.0 (watermark transparency)
    positionPreset?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
    size?: number; // width/height in px (40 - 200)
    transform: ElementTransform;
  };
  factCard?: {
    show: boolean;
    fact: MovieFactCard | null;
    transform: ElementTransform;
  };
}
