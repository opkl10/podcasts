import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { provider, apiKey, voiceId } = await req.json();

    if (!apiKey || !apiKey.trim()) {
      return NextResponse.json({ success: false, message: 'נא להזין מפתח לבדיקה' }, { status: 400 });
    }

    const key = apiKey.trim();

    if (provider === 'gemini') {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      let lastError = '';

      for (const model of models) {
        // Attempt 1: Official Header 'x-goog-api-key' (Preferred by Google AI Studio for AQ. keys)
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': key
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'שלום' }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          });

          if (res.ok) {
            return NextResponse.json({
              success: true,
              message: `חיבור Gemini API (${model}) מאומת ופעיל בהצלחה!`
            });
          }

          const errData = await res.json().catch(() => ({}));
          lastError = errData.error?.message || `קוד שגיאה מ-Google: ${res.status}`;

          // Attempt 2: Query param ?key=
          const resQuery = await fetch(`${url}?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'שלום' }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          });

          if (resQuery.ok) {
            return NextResponse.json({
              success: true,
              message: `חיבור Gemini API (${model}) מאומת ופעיל בהצלחה!`
            });
          }

          // Attempt 3: Authorization: Bearer
          const resBearer = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'שלום' }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          });

          if (resBearer.ok) {
            return NextResponse.json({
              success: true,
              message: `חיבור Gemini API (${model}) מאומת ופעיל בהצלחה!`
            });
          }
        } catch (e: any) {
          lastError = e.message;
        }
      }

      return NextResponse.json({
        success: false,
        message: lastError || 'שגיאת אימות מול Google Gemini API'
      });
    }

    if (provider === 'openai') {
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${key}`
          }
        });

        if (res.ok) {
          return NextResponse.json({
            success: true,
            message: 'חיבור OpenAI API (Whisper & GPT-4o) מאומת ופעיל בהצלחה!'
          });
        }

        const err = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          message: err.error?.message || `שגיאת אימות מול OpenAI (קוד ${res.status})`
        });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          message: 'שגיאת תקשורת מול OpenAI: ' + e.message
        });
      }
    }

    if (provider === 'elevenlabs') {
      try {
        const res = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: {
            'xi-api-key': key,
            'Accept': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          const tier = data.subscription?.tier || 'Free/Creator';
          const charLimit = data.subscription?.character_limit || 0;
          const charUsed = data.subscription?.character_count || 0;
          return NextResponse.json({
            success: true,
            message: `חיבור ElevenLabs מאומת! מסלול: ${tier} (נוצלו ${charUsed}/${charLimit} תווים)`,
            user: data
          });
        }

        if (res.status === 401) {
          return NextResponse.json({
            success: false,
            message: 'מפתח ElevenLabs API אינו תקין (401 Unauthorized)'
          });
        }

        return NextResponse.json({
          success: false,
          message: `שגיאה מ-ElevenLabs (קוד ${res.status})`
        });
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          message: 'שגיאת תקשורת מול ElevenLabs: ' + e.message
        });
      }
    }

    return NextResponse.json({ success: false, message: 'ספק לא מוכר' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
