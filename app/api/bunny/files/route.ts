import { NextRequest, NextResponse } from 'next/server';
import { getBunnyStorageEndpoint, BunnyConfig } from '@/lib/bunny/bunnyClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config: BunnyConfig = body.config;
    const folder: string = body.folder || '';

    if (!config || !config.storageZoneName || !config.accessKey) {
      return NextResponse.json(
        { error: 'הגדרות BunnyCDN אינן מוגדרות במערכת.' },
        { status: 400 }
      );
    }

    const endpoint = getBunnyStorageEndpoint(config.storageRegion);
    const cleanZone = config.storageZoneName.trim();
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
    const targetUrl = cleanFolder 
      ? `${endpoint}/${cleanZone}/${cleanFolder}/` 
      : `${endpoint}/${cleanZone}/`;

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        AccessKey: config.accessKey.trim(),
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Bunny API Error (Status ${res.status})` },
        { status: res.status }
      );
    }

    const rawList = await res.json();
    if (!Array.isArray(rawList)) {
      return NextResponse.json({ files: [] });
    }

    let pullDomain = config.pullZoneUrl ? config.pullZoneUrl.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') : '';
    if (!pullDomain) {
      pullDomain = `${cleanZone}.b-cdn.net`;
    }

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'];

    const files = rawList.map((item: any) => {
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

    return NextResponse.json({ files });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to list files from Bunny Storage' },
      { status: 500 }
    );
  }
}
