export type OverlayType =
  | 'live_badge'
  | 'session_timer'
  | 'achievement'
  | 'health_bar'
  | 'chat_bubble'
  | 'score_counter'
  | 'game_title'
  | 'reaction'
  | 'lower_third'
  | 'review_score'
  | 'verdict'
  | 'pro_con'
  | 'scene_label'
  | 'rating_meter'
  | 'tip_card'
  | 'social_bar'
  | 'watermark';

export interface OverlayBaseConfig {
  opacity?: number; // 0-100
}

export interface LiveBadgeConfig extends OverlayBaseConfig {
  channelName?: string;
  color?: string; // hex
}

export interface SessionTimerConfig extends OverlayBaseConfig {
  mode: 'stopwatch' | 'countdown';
  targetSeconds?: number;
  elapsedSeconds?: number;
}

export interface AchievementConfig extends OverlayBaseConfig {
  title: string;
  description?: string;
  icon?: string; // emoji
  color?: string;
}

export interface HealthBarConfig extends OverlayBaseConfig {
  label?: string;
  value: number; // 0-100
  color?: string;
  showValue?: boolean;
}

export interface ChatBubbleConfig extends OverlayBaseConfig {
  username: string;
  message: string;
  avatarColor?: string;
}

export interface ScoreCounterConfig extends OverlayBaseConfig {
  label?: string;
  value: number;
  maxValue?: number;
  icon?: string;
  color?: string;
}

export interface GameTitleConfig extends OverlayBaseConfig {
  title: string;
  genre?: string;
  year?: string;
  platform?: string;
}

export interface ReactionConfig extends OverlayBaseConfig {
  reaction: 'GG' | 'EZ' | 'RAGE' | 'LOL' | 'WTF' | 'GJ' | 'NOOB' | 'CLUTCH';
  color?: string;
}

export interface LowerThirdConfig extends OverlayBaseConfig {
  name: string;
  title?: string;
  color?: string;
}

export interface ReviewScoreConfig extends OverlayBaseConfig {
  score: number; // 0-10
  maxScore?: number;
  label?: string;
  showStars?: boolean;
}

export interface VerdictConfig extends OverlayBaseConfig {
  verdict: 'MASTERPIECE' | 'EXCELLENT' | 'GOOD' | 'RECOMMENDED' | 'AVERAGE' | 'SKIP' | 'AVOID' | 'TRASH';
  subtitle?: string;
}

export interface ProConConfig extends OverlayBaseConfig {
  pros: string[];
  cons: string[];
  title?: string;
}

export interface SceneLabelConfig extends OverlayBaseConfig {
  scene: 'GAMEPLAY' | 'REVIEW' | 'UNBOXING' | 'CUTSCENE' | 'INTERVIEW' | 'REACTION' | 'TUTORIAL' | 'SPOILER' | 'HIGHLIGHT' | string;
  color?: string;
}

export interface RatingMeterConfig extends OverlayBaseConfig {
  value: number; // 0-100
  label?: string;
  color?: string;
  orientation?: 'horizontal' | 'vertical';
}

export interface TipCardConfig extends OverlayBaseConfig {
  type: 'tip' | 'spoiler' | 'warning' | 'note' | 'fun_fact';
  text: string;
  title?: string;
}

export interface SocialBarConfig extends OverlayBaseConfig {
  handles: { platform: 'youtube' | 'twitch' | 'tiktok' | 'instagram' | 'twitter' | 'discord'; handle: string }[];
}

export interface WatermarkConfig extends OverlayBaseConfig {
  text: string;
  position?: 'tl' | 'tr' | 'bl' | 'br';
  color?: string;
}

export type OverlayConfig =
  | LiveBadgeConfig
  | SessionTimerConfig
  | AchievementConfig
  | HealthBarConfig
  | ChatBubbleConfig
  | ScoreCounterConfig
  | GameTitleConfig
  | ReactionConfig
  | LowerThirdConfig
  | ReviewScoreConfig
  | VerdictConfig
  | ProConConfig
  | SceneLabelConfig
  | RatingMeterConfig
  | TipCardConfig
  | SocialBarConfig
  | WatermarkConfig;

export interface OverlayItem {
  id: string;
  type: OverlayType;
  x: number; // % from left
  y: number; // % from top
  visible: boolean;
  config: OverlayConfig;
}

export const OVERLAY_CATALOG: { type: OverlayType; label: string; emoji: string; category: 'gaming' | 'streaming' | 'review' | 'cinema'; defaultConfig: OverlayConfig }[] = [
  { type: 'live_badge', label: 'LIVE Badge', emoji: '🔴', category: 'streaming', defaultConfig: { channelName: 'MyChannel' } },
  { type: 'session_timer', label: 'Session Timer', emoji: '⏱️', category: 'streaming', defaultConfig: { mode: 'stopwatch', elapsedSeconds: 0 } },
  { type: 'achievement', label: 'Achievement', emoji: '🏆', category: 'gaming', defaultConfig: { title: 'Achievement Unlocked!', description: 'You did something awesome', icon: '🏆' } },
  { type: 'health_bar', label: 'Health Bar', emoji: '❤️', category: 'gaming', defaultConfig: { value: 75, label: 'HP', color: '#10b981', showValue: true } },
  { type: 'chat_bubble', label: 'Chat Bubble', emoji: '💬', category: 'streaming', defaultConfig: { username: 'Viewer123', message: 'Great stream!' } },
  { type: 'score_counter', label: 'Score / Kills', emoji: '🎯', category: 'gaming', defaultConfig: { label: 'KILLS', value: 0, icon: '💀' } },
  { type: 'game_title', label: 'Game Title Card', emoji: '🎮', category: 'gaming', defaultConfig: { title: 'Game Title', genre: 'Action', year: '2024', platform: 'PS5' } },
  { type: 'reaction', label: 'Reaction Sticker', emoji: '⚡', category: 'gaming', defaultConfig: { reaction: 'GG' } },
  { type: 'lower_third', label: 'Lower Third', emoji: '📢', category: 'streaming', defaultConfig: { name: 'Your Name', title: 'Creator / Reviewer' } },
  { type: 'review_score', label: 'Review Score', emoji: '⭐', category: 'review', defaultConfig: { score: 8, maxScore: 10, showStars: true, label: 'Overall Score' } },
  { type: 'verdict', label: 'Verdict Badge', emoji: '✅', category: 'review', defaultConfig: { verdict: 'RECOMMENDED', subtitle: 'Worth your time!' } },
  { type: 'pro_con', label: 'Pro / Con Card', emoji: '📋', category: 'review', defaultConfig: { pros: ['Great gameplay', 'Beautiful visuals'], cons: ['Repetitive missions', 'Short campaign'], title: 'Verdict' } },
  { type: 'scene_label', label: 'Scene Label', emoji: '🎬', category: 'cinema', defaultConfig: { scene: 'GAMEPLAY', color: '#a855f7' } },
  { type: 'rating_meter', label: 'Rating Meter', emoji: '📊', category: 'review', defaultConfig: { value: 80, label: 'Enjoyment', color: '#06b6d4', orientation: 'horizontal' } },
  { type: 'tip_card', label: 'Tip / Alert', emoji: '💡', category: 'cinema', defaultConfig: { type: 'tip', text: 'Pro tip: Always check your surroundings!', title: 'Pro Tip' } },
  { type: 'social_bar', label: 'Social Bar', emoji: '📱', category: 'streaming', defaultConfig: { handles: [{ platform: 'youtube', handle: '@mychannel' }, { platform: 'twitch', handle: 'mychannel' }] } },
  { type: 'watermark', label: 'Watermark', emoji: '💧', category: 'cinema', defaultConfig: { text: '© MyChannel 2025', position: 'br' } },
];
