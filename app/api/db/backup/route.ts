import { NextRequest, NextResponse } from 'next/server';
import { readDatabase, writeDatabase } from '@/lib/db/serverDb';

export async function GET() {
  try {
    const db = readDatabase();
    const backupJson = JSON.stringify(db, null, 2);
    
    return new NextResponse(backupJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="castflow_podcast_backup_${new Date().toISOString().slice(0, 10)}.json"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate backup' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const backupData = await req.json();
    if (!backupData || !Array.isArray(backupData.episodes) || !Array.isArray(backupData.podcasts)) {
      return NextResponse.json({ error: 'Invalid backup file format' }, { status: 400 });
    }

    writeDatabase(backupData);
    return NextResponse.json({
      success: true,
      message: 'Database restored successfully',
      episodesCount: backupData.episodes.length,
      podcastsCount: backupData.podcasts.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to restore database' }, { status: 500 });
  }
}
