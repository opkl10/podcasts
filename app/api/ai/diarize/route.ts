import { NextRequest, NextResponse } from 'next/server';
import { SubtitleItem } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      subtitles = [], 
      knownSpeakers = [],
      contextHint = '',
      apiKey,
      openaiApiKey 
    } = body;

    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json({ error: 'אין כתוביות לזיהוי דוברים' }, { status: 400 });
    }

    const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;
    const openaiKey = openaiApiKey?.trim() || process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return NextResponse.json({ 
        error: 'נא להזין מפתח API של Google Gemini או OpenAI בהגדרות ה-AI לצורך זיהוי דוברים.' 
      }, { status: 401 });
    }

    const diarizationPrompt = `
אתה מומחה בינלאומי לניתוח שיח וזיהוי דוברים בפודקאסטים וסרטונים (AI Speaker Diarization Specialist).
לפניך תמליל של כתוביות מתוך פודקאסט או שיחה בעברית.
${contextHint ? `הקשר ונושא הפרק: "${contextHint}"` : ''}
${knownSpeakers.length > 0 ? `שמות דוברים מוכרים: ${knownSpeakers.join(', ')}` : ''}

משימתך:
1. נתח את מהלך השיחה, תורות הדיבור (turn-taking), שאלות ותשובות, פניות ישירות, שמות שהוזכרו, ודפוסי התבטאות.
2. זהה מתי מתחלף הדובר, ושייך לכל שורת כתובית את הדובר המדויק שלה ("speaker").
3. תיוג דוברים: השתמש בשמות "דובר 1", "דובר 2" (או בשמות המפורשים אם הם ברורים מתוך תוכן השיחה, למשל "עומר", "דניאל", "אורח").
4. שמור על עקביות: אם "דובר 1" שואל שאלה ו"דובר 2" עונה, הקפד לשמור על אותו דובר לאורך כל קטעי התשובה שלו עד לחילוף הבא.
5. חובה לשמור במדויק על ה-id של כל שורה!

רשימת הכתוביות:
${JSON.stringify(subtitles.map((s: SubtitleItem) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, text: s.text })), null, 2)}

החזר אך ורק מערך JSON תקין במבנה הבא:
[
  {
    "id": "sub_1",
    "speaker": "דובר 1"
  },
  {
    "id": "sub_2",
    "speaker": "דובר 2"
  }
]
`;

    // 1. Try Gemini
    if (geminiKey) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: diarizationPrompt }] }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
              const clean = textContent.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(clean);
              const items = Array.isArray(parsed) ? parsed : (parsed.subtitles || parsed.items || []);
              if (items.length > 0) {
                const speakerMap = new Map<string, string>();
                items.forEach((it: any) => {
                  if (it.id && it.speaker) {
                    speakerMap.set(it.id, String(it.speaker).trim());
                  }
                });

                let diarizedCount = 0;
                const diarizedSubtitles: SubtitleItem[] = subtitles.map((orig: SubtitleItem) => {
                  const assigned = speakerMap.get(orig.id);
                  if (assigned) {
                    diarizedCount++;
                    return { ...orig, speaker: assigned };
                  }
                  return orig;
                });

                const uniqueDetected = Array.from(new Set(Array.from(speakerMap.values())));

                return NextResponse.json({
                  success: true,
                  subtitles: diarizedSubtitles,
                  diarizedCount,
                  speakers: uniqueDetected,
                  engine: `Google Gemini (${model})`
                });
              }
            }
          }
        } catch (mErr) {
          console.warn(`Gemini diarize error with ${model}:`, mErr);
        }
      }
    }

    // 2. OpenAI Fallback
    if (openaiKey) {
      try {
        const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an AI speaker diarization specialist for Hebrew dialogues. Return valid JSON only.'
              },
              { role: 'user', content: diarizationPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1
          })
        });

        if (oRes.ok) {
          const oJson = await oRes.json();
          const content = oJson.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const items = Array.isArray(parsed) ? parsed : (parsed.subtitles || parsed.items || []);
            const speakerMap = new Map<string, string>();
            items.forEach((it: any) => {
              if (it.id && it.speaker) {
                speakerMap.set(it.id, String(it.speaker).trim());
              }
            });

            const diarizedSubtitles: SubtitleItem[] = subtitles.map((orig: SubtitleItem) => {
              const assigned = speakerMap.get(orig.id);
              return assigned ? { ...orig, speaker: assigned } : orig;
            });

            return NextResponse.json({
              success: true,
              subtitles: diarizedSubtitles,
              speakers: Array.from(new Set(Array.from(speakerMap.values()))),
              engine: 'OpenAI GPT-4o-mini'
            });
          }
        }
      } catch (oErr) {
        console.warn('OpenAI diarize error:', oErr);
      }
    }

    return NextResponse.json({ error: 'לא הצלחנו לזהות דוברים באופן אוטומטי. אנא ודאו שמפתח ה-API פעיל.' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'שגיאת שרת פנימית בזיהוי דוברים' }, { status: 500 });
  }
}
