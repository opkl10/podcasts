import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface RoomState {
  offer?: any;
  answer?: any;
  candidates: { sender: 'host' | 'client'; candidate: any; id: string }[];
  lastActive: number;
  lastFrame?: string; // base64 JPEG live fallback frame
  lastFrameTime?: number;
}

// In-memory room storage with persistent /tmp fallback for serverless
const rooms = new Map<string, RoomState>();
const TMP_FILE = path.join(process.platform === 'win32' ? process.cwd() : '/tmp', 'castflow_signaling_v2.json');

function loadCache() {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const raw = fs.readFileSync(TMP_FILE, 'utf-8');
      const obj = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) {
        if (!rooms.has(k)) {
          rooms.set(k, v as RoomState);
        }
      }
    }
  } catch (e) {}
}

function persistCache() {
  try {
    const obj: Record<string, RoomState> = {};
    for (const [k, v] of rooms.entries()) {
      // Don't write huge base64 frames to disk file, keep frames in memory
      obj[k] = { ...v, lastFrame: undefined };
    }
    fs.writeFileSync(TMP_FILE, JSON.stringify(obj), 'utf-8');
  } catch (e) {}
}

function cleanStaleRooms() {
  const now = Date.now();
  for (const [roomId, state] of rooms.entries()) {
    if (now - state.lastActive > 30 * 60 * 1000) {
      rooms.delete(roomId);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    loadCache();
    cleanStaleRooms();
    const body = await req.json();
    const { action, roomId, data, role, frame } = body;

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = { candidates: [], lastActive: Date.now() };
      rooms.set(roomId, room);
    }
    room.lastActive = Date.now();

    switch (action) {
      case 'join':
        return NextResponse.json({
          status: 'ok',
          hasOffer: !!room.offer,
          hasAnswer: !!room.answer,
          hasFrame: !!room.lastFrame
        });

      case 'send-offer':
        room.offer = data;
        room.answer = undefined;
        // Keep candidate history clean
        room.candidates = room.candidates.filter(c => c.sender !== (role || 'client'));
        persistCache();
        return NextResponse.json({ status: 'offer-saved' });

      case 'get-offer':
        return NextResponse.json({ offer: room.offer || null });

      case 'send-answer':
        room.answer = data;
        persistCache();
        return NextResponse.json({ status: 'answer-saved' });

      case 'get-answer':
        return NextResponse.json({ answer: room.answer || null });

      case 'send-candidate':
        if (data) {
          const senderRole = (role || 'client') as 'host' | 'client';
          const candId = typeof data === 'string' ? data : (data.candidate || JSON.stringify(data));
          if (!room.candidates.some(c => c.id === candId)) {
            room.candidates.push({ sender: senderRole, candidate: data, id: candId });
            persistCache();
          }
        }
        return NextResponse.json({ status: 'candidate-added' });

      case 'get-candidates':
        const targetSender = role === 'host' ? 'client' : 'host';
        const candidates = room.candidates.filter(c => c.sender === targetSender);
        return NextResponse.json({ candidates: candidates.map(c => c.candidate) });

      // Frame Streaming Fallback (Guaranteed to work even if router blocks WebRTC UDP)
      case 'push-frame':
        if (frame) {
          room.lastFrame = frame;
          room.lastFrameTime = Date.now();
        }
        return NextResponse.json({ status: 'frame-received' });

      case 'pull-frame':
        return NextResponse.json({ 
          frame: room.lastFrame || null,
          frameTime: room.lastFrameTime || 0,
          isFresh: room.lastFrameTime ? (Date.now() - room.lastFrameTime < 6000) : false
        });

      case 'reset':
        rooms.delete(roomId);
        persistCache();
        return NextResponse.json({ status: 'room-reset' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
