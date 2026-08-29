import { NextRequest, NextResponse } from 'next/server';

interface RoomState {
  offer?: any;
  answer?: any;
  candidates: { sender: 'host' | 'client'; candidate: any }[];
  lastActive: number;
  lastFrame?: string; // base64 JPEG live fallback frame
  lastFrameTime?: number;
}

// In-memory room storage
const rooms = new Map<string, RoomState>();

function cleanStaleRooms() {
  const now = Date.now();
  for (const [roomId, state] of rooms.entries()) {
    if (now - state.lastActive > 15 * 60 * 1000) {
      rooms.delete(roomId);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
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
        room.candidates = room.candidates.filter(c => c.sender !== 'host');
        return NextResponse.json({ status: 'offer-saved' });

      case 'get-offer':
        return NextResponse.json({ offer: room.offer || null });

      case 'send-answer':
        room.answer = data;
        return NextResponse.json({ status: 'answer-saved' });

      case 'get-answer':
        return NextResponse.json({ answer: room.answer || null });

      case 'send-candidate':
        if (data) {
          room.candidates.push({ sender: role || 'client', candidate: data });
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
          isFresh: room.lastFrameTime ? (Date.now() - room.lastFrameTime < 4000) : false
        });

      case 'reset':
        rooms.delete(roomId);
        return NextResponse.json({ status: 'room-reset' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
