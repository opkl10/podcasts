import { Episode, PodcastShow, TimestampMarker, TopicItem } from './types';
import { INITIAL_EPISODES, INITIAL_PODCASTS } from './initialData';

const STORAGE_KEY_EPISODES = 'podcast_studio_episodes_v2';
const STORAGE_KEY_PODCASTS = 'podcast_studio_shows_v2';
const DB_NAME = 'PodcastStudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

// Open IndexedDB database for large media storage
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Window not defined'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Store a large recorded media blob into IndexedDB
export async function saveMediaBlob(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to save media blob to IndexedDB', err);
  }
}

// Retrieve a recorded media blob from IndexedDB
export async function getMediaBlob(key: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to get media blob from IndexedDB', err);
    return null;
  }
}

// Delete media blob from IndexedDB
export async function deleteMediaBlob(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to delete media blob from IndexedDB', err);
  }
}

// Async Background Sync to Server Database
async function syncToServerDatabase(payload: { episodes?: Episode[]; podcasts?: PodcastShow[] }) {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    // Graceful offline fallback
  }
}

// Full Initial Sync between Server Database & Client Storage
export async function syncWithServerDatabase(): Promise<{ episodes: Episode[]; podcasts: PodcastShow[] }> {
  try {
    const res = await fetch('/api/db');
    if (res.ok) {
      const data = await res.json();
      if (data.episodes && data.episodes.length > 0) {
        saveEpisodes(data.episodes, false);
      }
      if (data.podcasts && data.podcasts.length > 0) {
        savePodcasts(data.podcasts, false);
      }
      return {
        episodes: data.episodes || getEpisodes(),
        podcasts: data.podcasts || getPodcasts()
      };
    }
  } catch (e) {}

  return {
    episodes: getEpisodes(),
    podcasts: getPodcasts()
  };
}

// === PODCAST SHOWS CRUD ===

export function getPodcasts(): PodcastShow[] {
  if (typeof window === 'undefined') return INITIAL_PODCASTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PODCASTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_PODCASTS, JSON.stringify(INITIAL_PODCASTS));
      syncToServerDatabase({ podcasts: INITIAL_PODCASTS });
      return INITIAL_PODCASTS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading podcasts from localStorage', err);
    return INITIAL_PODCASTS;
  }
}

export function savePodcasts(podcasts: PodcastShow[], shouldSyncServer = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_PODCASTS, JSON.stringify(podcasts));
    if (shouldSyncServer) {
      syncToServerDatabase({ podcasts });
    }
  } catch (err) {
    console.error('Error saving podcasts to localStorage', err);
  }
}

export function getPodcastById(id: string): PodcastShow | null {
  const podcasts = getPodcasts();
  return podcasts.find(p => p.id === id) || null;
}

export function savePodcast(podcast: PodcastShow): PodcastShow {
  const podcasts = getPodcasts();
  const index = podcasts.findIndex(p => p.id === podcast.id);
  if (index >= 0) {
    podcasts[index] = podcast;
  } else {
    podcasts.push(podcast);
  }
  savePodcasts(podcasts);
  return podcast;
}

export function deletePodcast(id: string): void {
  const podcasts = getPodcasts();
  const filtered = podcasts.filter(p => p.id !== id);
  savePodcasts(filtered);
}

// === EPISODES CRUD ===

export function getEpisodes(): Episode[] {
  if (typeof window === 'undefined') return INITIAL_EPISODES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EPISODES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_EPISODES, JSON.stringify(INITIAL_EPISODES));
      syncToServerDatabase({ episodes: INITIAL_EPISODES });
      return INITIAL_EPISODES;
    }
    const parsed: Episode[] = JSON.parse(raw);
    return parsed.map(ep => ({
      ...ep,
      podcastId: ep.podcastId || 'pod-tech'
    }));
  } catch (err) {
    console.error('Error reading episodes from localStorage', err);
    return INITIAL_EPISODES;
  }
}

export function saveEpisodes(episodes: Episode[], shouldSyncServer = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_EPISODES, JSON.stringify(episodes));
    if (shouldSyncServer) {
      syncToServerDatabase({ episodes });
    }
  } catch (err) {
    console.error('Error saving episodes to localStorage', err);
  }
}

export function getEpisodeById(id: string): Episode | null {
  const episodes = getEpisodes();
  return episodes.find(ep => ep.id === id) || null;
}

export function saveEpisode(episode: Episode): Episode {
  const episodes = getEpisodes();
  const index = episodes.findIndex(ep => ep.id === episode.id);
  const updated: Episode = {
    ...episode,
    podcastId: episode.podcastId || 'pod-tech',
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) {
    episodes[index] = updated;
  } else {
    episodes.unshift(updated);
  }

  saveEpisodes(episodes);
  return updated;
}

export async function deleteEpisode(id: string): Promise<void> {
  const episodes = getEpisodes();
  const target = episodes.find(ep => ep.id === id);
  if (target?.recording?.videoBlobKey) {
    await deleteMediaBlob(target.recording.videoBlobKey);
  }
  const filtered = episodes.filter(ep => ep.id !== id);
  saveEpisodes(filtered);
}

// Export Show Notes & YouTube Chapters as Markdown
export function exportEpisodeNotes(episode: Episode): string {
  const podcast = getPodcastById(episode.podcastId);
  let text = `# ${episode.title}\n`;
  if (podcast) {
    text += `פודקאסט: ${podcast.title}\n`;
  }
  text += `עונה ${episode.season} | פרק ${episode.episodeNumber}\n\n`;
  text += `## תיאור הפרק\n${episode.description}\n\n`;

  if (episode.guest) {
    text += `## אורח/ת: ${episode.guest.name}\n`;
    if (episode.guest.role) text += `תפקיד: ${episode.guest.role}\n`;
    if (episode.guest.bio) text += `${episode.guest.bio}\n`;
    text += `\n`;
  }

  text += `## נושאים וראשי פרקים\n`;
  episode.topics.forEach((topic, idx) => {
    text += `### ${idx + 1}. ${topic.title} (${topic.estimatedMinutes} דק')\n`;
    if (topic.notes) text += `הערות: ${topic.notes}\n`;
    if (topic.talkingPoints.length > 0) {
      text += `נקודות עיקריות:\n`;
      topic.talkingPoints.forEach(tp => {
        text += `- ${tp}\n`;
      });
    }
    if (topic.questions.length > 0) {
      text += `שאלות שנשאלו:\n`;
      topic.questions.forEach(q => {
        text += `- ❓ ${q}\n`;
      });
    }
    if (topic.resources.length > 0) {
      text += `מקורות וקישורים:\n`;
      topic.resources.forEach(r => {
        text += `- [${r.title}](${r.url})\n`;
      });
    }
    text += `\n`;
  });

  if (episode.recording && episode.recording.markers.length > 0) {
    text += `## חותמות זמן ליוטיוב ולספוטיפיי (YouTube & Spotify Chapters)\n`;
    episode.recording.markers.forEach(m => {
      const minutes = Math.floor(m.timestamp / 60);
      const seconds = Math.floor(m.timestamp % 60);
      const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      text += `${formatted} - ${m.label}\n`;
    });
  }

  return text;
}

// Format seconds into MM:SS or HH:MM:SS
export function formatTime(totalSeconds: number, includeHours = false): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  if (includeHours || hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Permanent Logo / Watermark Configuration
export interface PermanentLogoConfig {
  url: string;
  opacity: number;
  size: number;
  positionPreset: 'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center';
  showByDefault: boolean;
  transform?: { x: number; y: number; scale: number };
}

export const DEFAULT_PERMANENT_LOGO: PermanentLogoConfig = {
  url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&q=80',
  opacity: 0.9,
  size: 64,
  positionPreset: 'top-right',
  showByDefault: true,
  transform: { x: 88, y: 5, scale: 1.0 }
};

export function getPermanentLogo(podcastId?: string): PermanentLogoConfig {
  if (typeof window === 'undefined') return DEFAULT_PERMANENT_LOGO;
  try {
    const key = podcastId ? `castflow_permanent_logo_${podcastId}` : 'castflow_permanent_logo';
    const raw = localStorage.getItem(key) || localStorage.getItem('castflow_permanent_logo');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load permanent logo:', e);
  }
  return DEFAULT_PERMANENT_LOGO;
}

export function savePermanentLogo(config: PermanentLogoConfig, podcastId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = podcastId ? `castflow_permanent_logo_${podcastId}` : 'castflow_permanent_logo';
    localStorage.setItem(key, JSON.stringify(config));
    // Also save global fallback
    localStorage.setItem('castflow_permanent_logo', JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save permanent logo:', e);
  }
}

// Audio-Only Videocast Stage Background & Waveform Config
export interface AudioStageConfig {
  bgType: 'preset' | 'image' | 'solid';
  presetId: string;
  customBgImage?: string;
  solidColor?: string;
  bgBlur: number;
  bgDarken: number;
  waveformStyle: 'bars' | 'sine' | 'radial' | 'mirror' | 'pulse' | 'liquid';
  waveformColorMode: 'single' | 'gradient';
  waveformColor: string;
  waveformGradientId: string;
}

export const DEFAULT_AUDIO_STAGE_CONFIG: AudioStageConfig = {
  bgType: 'preset',
  presetId: 'obsidian',
  solidColor: '#090d16',
  bgBlur: 0,
  bgDarken: 20,
  waveformStyle: 'bars',
  waveformColorMode: 'gradient',
  waveformColor: '#06b6d4',
  waveformGradientId: 'cyberpunk'
};

export function getAudioStageConfig(podcastId?: string): AudioStageConfig {
  if (typeof window === 'undefined') return DEFAULT_AUDIO_STAGE_CONFIG;
  try {
    const key = podcastId ? `castflow_audio_stage_${podcastId}` : 'castflow_audio_stage';
    const raw = localStorage.getItem(key) || localStorage.getItem('castflow_audio_stage');
    if (raw) {
      return { ...DEFAULT_AUDIO_STAGE_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load audio stage config:', e);
  }
  return DEFAULT_AUDIO_STAGE_CONFIG;
}

export function saveAudioStageConfig(config: AudioStageConfig, podcastId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = podcastId ? `castflow_audio_stage_${podcastId}` : 'castflow_audio_stage';
    localStorage.setItem(key, JSON.stringify(config));
    localStorage.setItem('castflow_audio_stage', JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save audio stage config:', e);
  }
}


