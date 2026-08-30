import { NextRequest, NextResponse } from 'next/server';
import { getBunnyStorageEndpoint, BunnyConfig } from '@/lib/bunny/bunnyClient';

const BUNNY_REGIONS = [
  '',     // Frankfurt / Global
  'de',   // Falkenstein
  'uk',   // London
  'ny',   // New York
  'la',   // Los Angeles
  'sg',   // Singapore
  'syd',  // Sydney
  'se',   // Stockholm
  'jh',   // Johannesburg
  'br'    // Sao Paulo
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let config: BunnyConfig = body.config;
    const folder: string = body.folder || '';

    // Fallback to server environment variables if client config is empty
    if (!config || !config.storageZoneName || !config.accessKey) {
      if (process.env.BUNNY_STORAGE_ZONE_NAME && process.env.BUNNY_ACCESS_KEY) {
        config = {
          enabled: true,
          storageZoneName: process.env.BUNNY_STORAGE_ZONE_NAME,
          accessKey: process.env.BUNNY_ACCESS_KEY,
          pullZoneUrl: process.env.BUNNY_PULL_ZONE_URL || `${process.env.BUNNY_STORAGE_ZONE_NAME}.b-cdn.net`,
          storageRegion: process.env.BUNNY_STORAGE_REGION || '',
          folderName: 'podcasts'
        };
      } else {
        return NextResponse.json(
          { error: 'הגדרות BunnyCDN אינן מוגדרות במערכת.' },
          { status: 400 }
        );
      }
    }

    const cleanZone = config.storageZoneName.trim();
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const candidateRegions = config.storageRegion 
      ? [config.storageRegion, ...BUNNY_REGIONS.filter(r => r !== config.storageRegion)]
      : BUNNY_REGIONS;

    let res: Response | null = null;
    let detectedRegion = config.storageRegion || '';

    // Try configured region first, then auto-discover if needed
    for (const region of candidateRegions) {
      const endpoint = getBunnyStorageEndpoint(region);
      const targetUrl = cleanFolder 
        ? `${endpoint}/${cleanZone}/${cleanFolder}/` 
        : `${endpoint}/${cleanZone}/`;

      try {
        const attemptRes = await fetch(targetUrl, {
          method: 'GET',
          headers: {
            AccessKey: config.accessKey.trim(),
            Accept: 'application/json'
          }
        });

        if (attemptRes.ok) {
          res = attemptRes;
          detectedRegion = region;
          break;
        } else if (attemptRes.status === 404 && cleanFolder) {
          // If subfolder 404s, test root
          const rootUrl = `${endpoint}/${cleanZone}/`;
          const rootRes = await fetch(rootUrl, {
            method: 'GET',
            headers: {
              AccessKey: config.accessKey.trim(),
              Accept: 'application/json'
            }
          });
          if (rootRes.ok) {
            res = attemptRes; // folder is genuinely empty or missing
            detectedRegion = region;
            break;
          }
        }
      } catch (e) {}
    }

    if (!res || !res.ok) {
      return NextResponse.json(
        { error: 'לא הצלחנו להתחבר ל-Bunny Storage. אנא ודא ששם ה-Storage Zone וה-Access Key מדויקים.' },
        { status: 401 }
      );
    }

    const rawList = await res.json();
    if (!Array.isArray(rawList)) {
      return NextResponse.json({ files: [], detectedRegion });
    }

    let pullDomain = config.pullZoneUrl ? config.pullZoneUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') : '';
    if (!pullDomain) {
      pullDomain = `${cleanZone}.b-cdn.net`;
    }

    const imageExtensions = [
      '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.avif', '.ico', '.tiff', '.jfif', '.heic', '.heif'
    ];

    const files = rawList.map((item: any) => {
      const objName = item.ObjectName || '';
      const isDir = item.IsDirectory || false;
      const lower = objName.toLowerCase();
      const isImg = isDir ? false : imageExtensions.some(ext => lower.endsWith(ext)) || (item.ContentType && item.ContentType.startsWith('image/'));
      
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

    return NextResponse.json({ files, detectedRegion });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to list files from Bunny Storage' },
      { status: 500 }
    );
  }
}
