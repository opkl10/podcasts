import { NextRequest, NextResponse } from 'next/server';
import { readDatabase, writeDatabase, dbSyncAll } from '@/lib/db/serverDb';

export async function GET() {
  try {
    const db = readDatabase();
    return NextResponse.json({
      success: true,
      lastUpdated: db.lastUpdated,
      podcasts: db.podcasts,
      episodes: db.episodes,
      settings: db.settings
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to read database' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const updatedDb = dbSyncAll(body);
    return NextResponse.json({
      success: true,
      message: 'Database synced successfully',
      lastUpdated: updatedDb.lastUpdated
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update database' }, { status: 500 });
  }
}
