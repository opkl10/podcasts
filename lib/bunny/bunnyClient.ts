// Bunny.net (BunnyCDN & Bunny Storage) Client Integration
// Uploads, lists, and downloads podcast recordings, audio master files, and media from Bunny Storage / CDN

export interface BunnyConfig {
  enabled: boolean;
  storageZoneName: string;
  accessKey: string; // Storage Zone Password
  pullZoneUrl: string; // e.g. cdn.myblog.co.il or myzone.b-cdn.net
  storageRegion?: string; // '' (Frankfurt/Global), 'ny', 'la', 'sg', 'syd', 'uk', 'jh', 'br'
  folderName?: string; // default: 'podcasts'
}

export interface BunnyFileItem {
  guid: string;
  name: string;
  path: string;
  size: number;
  lastModified: string;
  isDirectory: boolean;
  contentType: string;
  cdnUrl: string;
  isImage: boolean;
}

const STORAGE_KEY_BUNNY = 'podcast_studio_bunny_config_v1';

export const DEFAULT_BUNNY_CONFIG: BunnyConfig = {
  enabled: false,
  storageZoneName: '',
  accessKey: '',
  pullZoneUrl: '',
  storageRegion: '',
  folderName: 'podcasts'
};

// Client-side storage helpers
export function getBunnyConfig(): BunnyConfig {
  if (typeof window === 'undefined') return DEFAULT_BUNNY_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BUNNY);
    if (!raw) return DEFAULT_BUNNY_CONFIG;
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_BUNNY_CONFIG;
  }
}

export function saveBunnyConfig(config: BunnyConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_BUNNY, JSON.stringify(config));
  } catch (e) {}
}

// Get storage endpoint URL based on region
export function getBunnyStorageEndpoint(region?: string): string {
  if (!region || region === 'de' || region === 'global') {
    return 'https://storage.bunnycdn.com';
  }
  return `https://${region}.storage.bunnycdn.com`;
}

// Test Bunny Storage Connection
export async function testBunnyStorageConnection(config: BunnyConfig): Promise<{ success: boolean; message: string }> {
  if (!config.storageZoneName.trim() || !config.accessKey.trim()) {
    return { success: false, message: 'נא להזין שם Storage Zone ומפתח Access Key' };
  }

  const endpoint = getBunnyStorageEndpoint(config.storageRegion);
  const cleanZone = config.storageZoneName.trim();
  const testUrl = `${endpoint}/${cleanZone}/`;

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: {
        AccessKey: config.accessKey.trim(),
        Accept: 'application/json'
      }
    });

    if (res.status === 200 || res.status === 404) {
      return {
        success: true,
        message: `החיבור ל-Bunny Storage Zone "${cleanZone}" הצליח בהצלחה!`
      };
    }

    if (res.status === 401) {
      return { success: false, message: 'שגיאת אימות (401): מפתח ה-Access Key שגוי.' };
    }

    return { success: false, message: `שגיאת תקשורת עם BunnyCDN (קוד ${res.status})` };
  } catch (err: any) {
    return {
      success: false,
      message: `שגיאה בחיבור ל-BunnyCDN: ${err.message || 'ודא שאין חסימת רשת'}`
    };
  }
}

// List all files & images in Bunny Storage Zone
export async function listBunnyStorageFiles(
  config: BunnyConfig,
  folder: string = ''
): Promise<{ success: boolean; files: BunnyFileItem[]; error?: string }> {
  if (!config.storageZoneName || !config.accessKey) {
    return { success: false, files: [], error: 'הגדרות BunnyCDN אינן מוגדרות במערכת.' };
  }

  // Use proxy API to avoid browser CORS restrictions
  try {
    const res = await fetch('/api/bunny/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, folder })
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, files: data.files || [] };
    }
  } catch (e) {}

  // Fallback: direct fetch
  const endpoint = getBunnyStorageEndpoint(config.storageRegion);
  const cleanZone = config.storageZoneName.trim();
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const targetUrl = cleanFolder ? `${endpoint}/${cleanZone}/${cleanFolder}/` : `${endpoint}/${cleanZone}/`;

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        AccessKey: config.accessKey.trim(),
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      return { success: false, files: [], error: `שגיאה בקריאת קבצים מ-Bunny (קוד: ${res.status})` };
    }

    const rawList = await res.json();
    if (!Array.isArray(rawList)) {
      return { success: true, files: [] };
    }

    let pullDomain = config.pullZoneUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (!pullDomain) {
      pullDomain = `${cleanZone}.b-cdn.net`;
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'];

    const files: BunnyFileItem[] = rawList.map((item: any) => {
      const objName = item.ObjectName || '';
      const isDir = item.IsDirectory || false;
      const lower = objName.toLowerCase();
      const isImg = imageExtensions.some(ext => lower.endsWith(ext)) || (item.ContentType && item.ContentType.startsWith('image/'));
      
      const filePath = cleanFolder ? `${cleanFolder}/${objName}` : objName;
      const cdnUrl = `https://${pullDomain}/${filePath}`;

      return {
        guid: item.Guid || objName,
        name: objName,
        path: filePath,
        size: item.Length || 0,
        lastModified: item.LastChanged || '',
        isDirectory: isDir,
        contentType: item.ContentType || '',
        cdnUrl,
        isImage: isImg
      };
    });

    return { success: true, files };
  } catch (err: any) {
    return { success: false, files: [], error: err.message || 'שגיאה בקריאת קבצים מ-Bunny Storage' };
  }
}

// Upload Blob directly to Bunny Storage
export async function uploadBlobToBunny(
  config: BunnyConfig,
  blob: Blob,
  fileName: string,
  folder: string = 'podcasts'
): Promise<{ success: boolean; cdnUrl?: string; error?: string }> {
  if (!config.storageZoneName || !config.accessKey) {
    return { success: false, error: 'הגדרות BunnyCDN אינן מוגדרות במערכת.' };
  }

  const endpoint = getBunnyStorageEndpoint(config.storageRegion);
  const cleanZone = config.storageZoneName.trim();
  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const cleanFileName = fileName.replace(/[^\w\d.-]/g, '_');
  
  const uploadPath = cleanFolder ? `${cleanFolder}/${cleanFileName}` : cleanFileName;
  const targetUrl = `${endpoint}/${cleanZone}/${uploadPath}`;

  try {
    const res = await fetch(targetUrl, {
      method: 'PUT',
      headers: {
        AccessKey: config.accessKey.trim(),
        'Content-Type': blob.type || 'application/octet-stream'
      },
      body: blob
    });

    if (res.status === 201 || res.status === 200) {
      let pullDomain = config.pullZoneUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      if (!pullDomain) {
        pullDomain = `${cleanZone}.b-cdn.net`;
      }
      const cdnUrl = `https://${pullDomain}/${uploadPath}`;

      return {
        success: true,
        cdnUrl
      };
    }

    return {
      success: false,
      error: `שגיאה בהעלאה ל-BunnyCDN (קוד: ${res.status})`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'שגיאה בעת שידור הקובץ ל-BunnyCDN'
    };
  }
}

// Generate ready-to-embed HTML player code for WordPress & Blogs
export function generateBlogEmbedCode(
  mediaUrl: string, 
  title: string, 
  type: 'video' | 'audio' = 'video',
  posterUrl?: string
): string {
  if (type === 'audio') {
    return `<!-- CastFlow Podcast Player (BunnyCDN Master Audio) -->
<div class="castflow-audio-player" style="max-width: 100%; margin: 20px 0; padding: 15px; border-radius: 16px; background: #121620; color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.3); font-family: sans-serif;">
  <h4 style="margin: 0 0 10px 0; font-size: 16px; color: #a5b4fc;">🎙️ ${title}</h4>
  <audio controls style="width: 100%; border-radius: 8px;" preload="metadata">
    <source src="${mediaUrl}" type="audio/webm">
    <source src="${mediaUrl}" type="audio/mp4">
    הדפדפן שלך אינו תומך בניגון אודיו.
  </audio>
</div>`;
  }

  return `<!-- CastFlow Podcast Video Player (BunnyCDN Fast Stream) -->
<div class="castflow-video-player" style="position: relative; width: 100%; max-width: 850px; margin: 24px auto; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.4); background: #000;">
  <video 
    controls 
    playsinline 
    preload="metadata" 
    ${posterUrl ? `poster="${posterUrl}"` : ''} 
    style="width: 100%; height: auto; display: block; border-radius: 20px;"
  >
    <source src="${mediaUrl}" type="video/webm">
    <source src="${mediaUrl}" type="video/mp4">
    הדפדפן שלך אינו תומך בניגון וידאו.
  </video>
</div>`;
}
