import { NextRequest, NextResponse } from 'next/server';
import { parseElevenLabsAlignmentToTimedWords, buildSubtitlesFromTimedWords, splitTextIntoPacedSubtitles } from '@/lib/audioUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      text, 
      apiKey, 
      voiceId = '21m00Tcm4TlvDq8ikWAM', 
      modelId = 'eleven_multilingual_v2',
      wordsPerLine = 4,
      speakerName = 'קריין AI'
    } = body;

    const key = (apiKey && apiKey.trim()) ? apiKey.trim() : process.env.ELEVENLABS_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: 'לא הוגדר מפתח ElevenLabs API. נא להזין מפתח בהגדרות ה-AI.' },
        { status: 401 }
      );
    }

    const cleanText = (text || '').trim();
    if (!cleanText) {
      return NextResponse.json(
        { error: 'נא להזין טקסט ליצירת כתוביות וקריינות' },
        { status: 400 }
      );
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
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
      const errText = await res.text();
      let errMsg = `שגיאה מ-ElevenLabs (${res.status})`;
      try {
        const parsed = JSON.parse(errText);
        errMsg = parsed.detail?.message || parsed.error?.message || parsed.message || errMsg;
      } catch (e) {
        errMsg = errText || errMsg;
      }
      return NextResponse.json(
        { error: errMsg },
        { status: res.status }
      );
    }

    const data = await res.json();
    const audioBase64 = data.audio_base64;
    const alignment = data.alignment;

    let subtitles: any[] = [];
    let duration = 5;

    if (alignment && Array.isArray(alignment.characters) && alignment.characters.length > 0) {
      const endTimes = alignment.character_end_times_seconds || [];
      if (endTimes.length > 0) {
        duration = Math.max(1, endTimes[endTimes.length - 1] || 1);
      }
      const timedWords = parseElevenLabsAlignmentToTimedWords(alignment, speakerName);
      subtitles = buildSubtitlesFromTimedWords(timedWords, wordsPerLine);
    }

    // Fallback if alignment parsing returned empty
    if (subtitles.length === 0) {
      subtitles = splitTextIntoPacedSubtitles(cleanText, wordsPerLine, 1, 0, Math.max(5, duration));
    }

    const audioUrl = audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : null;

    return NextResponse.json({
      success: true,
      subtitles,
      audioUrl,
      duration: Number(duration.toFixed(2)),
      source: 'ElevenLabs With-Timestamps'
    });
  } catch (error: any) {
    console.error('ElevenLabs generate-subtitles error:', error);
    return NextResponse.json(
      { error: error?.message || 'שגיאת שרת פנימית ביצירת כתוביות עם ElevenLabs' },
      { status: 500 }
    );
  }
}
