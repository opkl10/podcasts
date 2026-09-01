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
  fontSize?: number; // in px (14 - 56)
  fontWeight?: 'normal' | '500' | 'bold' | '800' | '900';
  textColor?: string;
  backgroundColor?: string;
  backgroundOpacity?: number; // 0 - 100
  strokeColor?: string;
  strokeWidth?: number;
  textShadow?: 'none' | 'soft' | 'hard-outline' | 'neon-glow' | 'cinema-blur';
  shadowColor?: string;
  shadowBlur?: number;
  highlightWordColor?: string;
  activeWordAnimation?: 'none' | 'color-pop' | 'glow' | 'bounce' | 'background-box';
  textAlign?: 'right' | 'center' | 'left';
  positionY?: 'bottom' | 'center' | 'top' | number; // percentage from top (10 - 90)
  positionPreset?: 'bottom-low' | 'bottom-standard' | 'center' | 'top-banner';
  boxStyle?: 'none' | 'rounded-badge' | 'full-bar' | 'shadow-glow' | 'glassmorphism' | 'pill-badge';
  isBold?: boolean;
  isUppercase?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  animation?: 'none' | 'karaoke-pop' | 'fade' | 'bounce' | 'slide-up' | 'zoom-in';
  themePreset?: string;
}

export interface SubtitleItem {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
  speaker?: string;
  customStyle?: SubtitleStyle;
}

export interface HighlightClip {
  id: string;
  title: string;           // כותרת הקליפ / הוק מושך
  headline?: string;        // כותרת עליונה משנית
  startTime: number;       // זמן התחלה בשניות
  endTime: number;         // זמן סיום בשניות
  duration: number;        // משך הקטע בשניות
  viralScore: number;      // ציון ויראליות 1-100
  category: 'debate' | 'punchline' | 'insight' | 'behind_the_scenes' | 'emotional' | 'quote' | 'highlight';
  reason: string;          // הסבר מדוע הקטע ויראלי ומתאים לסושיאל
  summary: string;         // תמצית תוכן הקטע
  suggestedAspectRatio?: '9:16' | '16:9' | '1:1';
  hookText?: string;       // טקסט ה-Hook להצגה מיידית
  tags?: string[];
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
  hostName?: string; // שם המגיש / מנחה
  host?: { name: string; role?: string; avatar?: string };
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
  audiogramStudioConfig?: AudiogramStudioConfig;
  highlightClips?: HighlightClip[];
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
  | 'plot'                // 🎬 עלילה וסיפור הסרט
  | 'cast'                // 🎭 שחקנים ודמויות
  | 'production_crew'     // 🎥 צוותי הפקה + בימוי ויתר התפקידים
  | 'reviews'             // ⭐ ביקורות כלליות
  | 'behind_the_scenes'   // 🤫 סיפורי מאחורי הקלעים
  // Compatibility fallbacks:
  | 'trivia' 
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

export interface CustomOverlayStyle {
  fontFamily?: string;
  fontSize?: number; // in px (Primary text size, e.g. Host Name / Title / Quote)
  fontWeight?: 'normal' | '500' | 'bold' | '800' | '900';
  textColor?: string;
  secondaryFontSize?: number; // in px (Secondary text size, e.g. Host Role / Episode Number / Speaker / Source)
  secondaryTextColor?: string;
  secondaryFontWeight?: 'normal' | '500' | 'bold' | '800' | '900';
  backgroundColor?: string;
  backgroundOpacity?: number; // 0 to 100
  borderColor?: string;
  borderWidth?: number; // 0 to 8 px
  borderRadius?: number; // 0 to 40 px
  glowColor?: string;
  glowBlur?: number; // 0 to 30 px
  padding?: number; // 4 to 32 px
  textAlign?: 'right' | 'center' | 'left';
  boxShadow?: string;
  badgeStyle?: 'rounded-badge' | 'pill-badge' | 'glassmorphism' | 'full-bar' | 'none';
}

export interface LiveOverlayState {
  isLayoutEditMode?: boolean;
  poster: {
    show: boolean;
    url: string;
    title?: string;
    caption?: string;
    transform: ElementTransform;
    customStyle?: CustomOverlayStyle;
  };
  quote: {
    show: boolean;
    text: string;
    speaker?: string;
    transform: ElementTransform;
    customStyle?: CustomOverlayStyle;
  };
  rating: {
    show: boolean;
    imdb?: string;
    rottenTomatoes?: string;
    personalScore?: string;
    transform: ElementTransform;
    customStyle?: CustomOverlayStyle;
  };
  customBanner: {
    show: boolean;
    title: string;
    subtitle?: string;
    transform: ElementTransform;
    customStyle?: CustomOverlayStyle;
  };
  spoilerAlert: {
    show: boolean;
    text?: string;
    transform: ElementTransform;
    customStyle?: CustomOverlayStyle;
  };
  logo: {
    show: boolean;
    url: string;
    opacity: number; // 0.2 - 1.0 (watermark transparency)
    positionPreset?: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
    size?: number; // width/height in px (40 - 200)
    transform: ElementTransform;
    customStyle?: CustomOverlayStyle;
  };
  factCard?: {
    show: boolean;
    fact: MovieFactCard | null;
    transform: ElementTransform;
    customStyle?: CustomOverlayStyle;
  };
}

export interface AudiogramStudioConfig {
  aspectRatio: '16:9' | '9:16' | '1:1';
  bgType: 'preset' | 'image' | 'solid';
  selectedBgPreset: string;
  customBgImage: string;
  bgDim: number;
  solidColor: string;
  ambientVignette: boolean;

  waveformStyle: string;
  waveformColorMode: 'gradient' | 'single';
  singleColor: string;
  selectedGradient: string;
  customGradStart: string;
  customGradEnd: string;
  waveformPosition: 'center' | 'bottom' | 'top' | 'custom';
  waveformCustomY: number;
  waveformHeight: number;
  waveformSensitivity: number;

  trimStart: number;
  trimEnd: number;

  showLogo: boolean;
  logoUrl?: string;
  logoSize?: number;
  logoOpacity?: number;
  logoTransform: ElementTransform;

  showHostTag: boolean;
  hostName: string;
  hostRole: string;
  hostTransform: ElementTransform;
  hostCustomStyle: CustomOverlayStyle;

  showFactOverlay: boolean;
  factTransform: ElementTransform;
  factCustomStyle: CustomOverlayStyle;

  showQuoteOverlay: boolean;
  quoteText: string;
  quoteSpeaker: string;
  quoteTransform: ElementTransform;
  quoteCustomStyle: CustomOverlayStyle;

  showBannerOverlay: boolean;
  bannerSubtitle: string;
  episodeTitleText: string;
  bannerTransform: ElementTransform;
  bannerCustomStyle: CustomOverlayStyle;

  showRatingOverlay: boolean;
  imdbScore: string;
  rottenScore: string;
  personalScore: string;
  ratingTransform: ElementTransform;
  ratingCustomStyle: CustomOverlayStyle;

  showSpoilerOverlay: boolean;
  spoilerText: string;
  spoilerTransform: ElementTransform;
  spoilerCustomStyle: CustomOverlayStyle;

  showPosterPip: boolean;
  posterUrl: string;
  posterShape: 'rounded_square' | 'rectangle' | 'circle';
  posterTransform: ElementTransform;
  posterCustomStyle: CustomOverlayStyle;

  showSubtitles: boolean;
  subtitleTransform: ElementTransform;
  subtitleCustomStyle: CustomOverlayStyle;

  savedAt?: string;
  templateName?: string;
}

export interface AudiogramStudioTemplate {
  id: string;
  name: string;
  createdAt: string;
  config: Partial<AudiogramStudioConfig>;
}
