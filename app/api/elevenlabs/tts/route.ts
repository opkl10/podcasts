import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, apiKey, voiceId = '21m00Tcm4TlvDq8ikWAM', modelId = 'eleven_multilingual_v2' } = body;

    const key = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.ELEVENLABS_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: 'לא הוגדר מפתח ElevenLabs API במערכת' },
        { status: 401 }
      );
    }

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'נא לספק טקסט להקראה' },
        { status: 400 }
      );
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `שגיאה מ-ElevenLabs: ${err}` },
        { status: res.status }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const dataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    return NextResponse.json({
      success: true,
      audioUrl: dataUrl
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
