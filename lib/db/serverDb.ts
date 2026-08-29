import fs from 'fs';
import path from 'path';
import { Episode, PodcastShow } from '../types';
import { INITIAL_EPISODES, INITIAL_PODCASTS } from '../initialData';

export interface DatabaseSchema {
  version: number;
  lastUpdated: string;
  podcasts: PodcastShow[];
  episodes: Episode[];
  settings: Record<string, any>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'podcast_studio.db.json');

// Ensure database directory and file exist with initial data
function ensureDbExists(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      const initialDb: DatabaseSchema = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        podcasts: INITIAL_PODCASTS,
        episodes: INITIAL_EPISODES,
        settings: {
          defaultDurationMinutes: 45,
          defaultTone: 'deep',
          noiseSuppression: true
        }
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error ensuring DB file exists:', err);
  }
}

// Read database from file with fallback
export function readDatabase(): DatabaseSchema {
  ensureDbExists();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database file:', err);
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      podcasts: INITIAL_PODCASTS,
      episodes: INITIAL_EPISODES,
      settings: {}
    };
  }
}

// Write database atomically to disk
export function writeDatabase(db: DatabaseSchema): void {
  ensureDbExists();
  try {
    db.lastUpdated = new Date().toISOString();
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error writing to database file:', err);
  }
}

// === PODCASTS CRUD ===
export function dbGetPodcasts(): PodcastShow[] {
  const db = readDatabase();
  return db.podcasts || [];
}

export function dbSavePodcast(podcast: PodcastShow): PodcastShow {
  const db = readDatabase();
  const index = db.podcasts.findIndex(p => p.id === podcast.id);
  if (index >= 0) {
    db.podcasts[index] = podcast;
  } else {
    db.podcasts.push(podcast);
  }
  writeDatabase(db);
  return podcast;
}

export function dbDeletePodcast(id: string): void {
  const db = readDatabase();
  db.podcasts = db.podcasts.filter(p => p.id !== id);
  writeDatabase(db);
}

// === EPISODES CRUD ===
export function dbGetEpisodes(): Episode[] {
  const db = readDatabase();
  return db.episodes || [];
}

export function dbGetEpisodeById(id: string): Episode | null {
  const db = readDatabase();
  return db.episodes.find(e => e.id === id) || null;
}

export function dbSaveEpisode(episode: Episode): Episode {
  const db = readDatabase();
  const index = db.episodes.findIndex(e => e.id === episode.id);
  const updated: Episode = {
    ...episode,
    updatedAt: new Date().toISOString()
  };

  if (index >= 0) {
    db.episodes[index] = updated;
  } else {
    db.episodes.unshift(updated);
  }

  writeDatabase(db);
  return updated;
}

export function dbDeleteEpisode(id: string): void {
  const db = readDatabase();
  db.episodes = db.episodes.filter(e => e.id !== id);
  writeDatabase(db);
}

// === FULL SYNC / BACKUP / RESTORE ===
export function dbSyncAll(data: { podcasts?: PodcastShow[]; episodes?: Episode[]; settings?: any }): DatabaseSchema {
  const db = readDatabase();
  if (data.podcasts && data.podcasts.length > 0) {
    db.podcasts = data.podcasts;
  }
  if (data.episodes && data.episodes.length > 0) {
    db.episodes = data.episodes;
  }
  if (data.settings) {
    db.settings = { ...db.settings, ...data.settings };
  }
  writeDatabase(db);
  return db;
}
