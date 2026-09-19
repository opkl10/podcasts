import { NextRequest, NextResponse } from 'next/server';
import { SubtitleItem } from '@/lib/types';
import { cleanAndPolishHebrewSubtitleText } from '@/lib/audioUtils';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      subtitles = [], 
      contextHint = '',
      apiKey,
      openaiApiKey 
    } = body;

    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json({ error: 'אין כתוביות לדיוק ושיפור' }, { status: 400 });
    }

    const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;
    const openaiKey = openaiApiKey?.trim() || process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return NextResponse.json({ 
        error: 'נא להזין מפתח API של Google Gemini או OpenAI בהגדרות ה-AI לצורך דיוק כתוביות.' 
      }, { status: 401 });
    }

    const refinementPrompt = `
אתה מומחה לשוני וקולנועי בכיר לעריכה, שחזור ודיוק כתוביות בעברית (AI Subtitle Precision & Speech Recovery Specialist).
לפניך רשימת כתוביות שנוצרו מתמלול דיבור של סרטון/פודקאסט. ייתכן שחלק מהדיבור היה עמום, חלש, מהיר, ממלמל או מלווה ברעשי רקע.
${contextHint ? `הקשר ונושא הסרטון: "${contextHint}"` : ''}

משימתך הקריטית:
1. תקן מילים שנשמעו לא נכון (Speech-to-Text Errors / Misheard Words):
   זהה מילים שאינן הגיוניות בהקשר של המשפט ושנובעות מדיבור עמום או מלמול, והחלף אותן במילה המדויקת שהדובר התכוון לומר, בהתבסס על קרבה פונטית והקשר השיחה הטבעי.
2. שחזר מילים או הברות שנבלעו: אם המשפט נשמע קטוע בגלל מילה שנבלעה, תקן אותו כך שיזרום בעברית מדוברת, תקנית וקולחת.
3. פיסוק וחלוקה קצבית: ודא פיסוק נכון (פסיקים וסימני שאלה היכן שצריך) שמותאם לקריאה מהירה בכתוביות וידאו (TikTok / YouTube).
4. כלל ברזל: שמור בדיוק של 100% על ה-id, startTime וה-endTime של כל כתובית! אל תמחק שורות ואל תשנה את התזמונים.

רשימת הכתוביות לדיוק וליטוש:
${JSON.stringify(subtitles.map((s: SubtitleItem) => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, text: s.text })), null, 2)}

החזר אך ורק מערך JSON תקין (Valid JSON Array) באותו מבנה בדיוק:
[
  {
    "id": "sub_1",
    "startTime": 1.2,
    "endTime": 3.5,
    "text": "טקסט מדויק, מתוקן וקולח"
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
              contents: [{ parts: [{ text: refinementPrompt }] }],
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
              const items = Array.isArray(parsed) ? parsed : (parsed.subtitles || []);
              if (items.length > 0) {
                const itemMap = new Map<string, string>();
                items.forEach((it: any) => {
                  if (it.id && it.text) {
                    itemMap.set(it.id, cleanAndPolishHebrewSubtitleText(it.text));
                  }
                });

                let changesCount = 0;
                const refinedSubtitles: SubtitleItem[] = subtitles.map((orig: SubtitleItem) => {
                  const newText = itemMap.get(orig.id);
                  if (newText && newText !== orig.text) {
                    changesCount++;
                    return { ...orig, text: newText };
                  }
                  return orig;
                });

                return NextResponse.json({
                  success: true,
                  subtitles: refinedSubtitles,
                  changesCount,
                  source: `Google Gemini Subtitle Precision (${model})`
                });
              }
            }
          }
        } catch (gemErr) {
          console.warn(`Gemini refine error with ${model}:`, gemErr);
        }
      }
    }

    // 2. OpenAI Fallback
    if (openaiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are an expert Hebrew subtitle editor. Fix misheard words and grammatical slips while keeping exact IDs and timestamps. Output valid JSON only.' },
              { role: 'user', content: refinementPrompt }
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' }
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const items = Array.isArray(parsed) ? parsed : (parsed.subtitles || parsed.items || []);
            if (items.length > 0) {
              const itemMap = new Map<string, string>();
              items.forEach((it: any) => {
                if (it.id && it.text) {
                  itemMap.set(it.id, cleanAndPolishHebrewSubtitleText(it.text));
                }
              });

              let changesCount = 0;
              const refinedSubtitles: SubtitleItem[] = subtitles.map((orig: SubtitleItem) => {
                const newText = itemMap.get(orig.id);
                if (newText && newText !== orig.text) {
                  changesCount++;
                  return { ...orig, text: newText };
                }
                return orig;
              });

              return NextResponse.json({
                success: true,
                subtitles: refinedSubtitles,
                changesCount,
                source: 'OpenAI Subtitle Precision (GPT-4o)'
              });
            }
          }
        }
      } catch (openErr) {
        console.warn('OpenAI refine error:', openErr);
      }
    }

    return NextResponse.json({ error: 'לא ניתן היה לדייק את הכתוביות. ודאו שמפתח ה-API תקין.' }, { status: 400 });
  } catch (error: any) {
    console.error('Refine subtitles error:', error);
    return NextResponse.json({ error: error.message || 'שגיאה פנימית בדיוק כתוביות' }, { status: 500 });
  }
}
