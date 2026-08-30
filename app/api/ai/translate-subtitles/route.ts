import { NextRequest, NextResponse } from 'next/server';
import { SubtitleItem } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      subtitles = [], 
      targetLanguage = 'en', 
      sourceLanguage = 'he', 
      apiKey,
      openaiApiKey 
    } = body;

    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json({ error: 'אין כתוביות לתרגום' }, { status: 400 });
    }

    const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;
    const openaiKey = openaiApiKey?.trim() || process.env.OPENAI_API_KEY;

    if (!geminiKey && !openaiKey) {
      return NextResponse.json({ 
        error: 'נא להזין מפתח API של Google Gemini או OpenAI בהגדרות ה-AI כדי לתרגם כתוביות.' 
      }, { status: 401 });
    }

    const langNames: Record<string, string> = {
      en: 'English (אנגלית)',
      es: 'Spanish (ספרדית)',
      fr: 'French (צרפתית)',
      ru: 'Russian (רוסית)',
      ar: 'Arabic (ערבית)',
      he: 'Hebrew (עברית)',
      de: 'German (גרמנית)',
      it: 'Italian (איטלקית)',
      pt: 'Portuguese (פורטוגזית)'
    };

    const targetLangName = langNames[targetLanguage] || targetLanguage;

    const translationPrompt = `
אתה מתרגם כתוביות מקצועי לפודקאסטים וסרטים.
עליך לתרגם את רשימת הכתוביות הבאה מ-${sourceLanguage} לשפת היעד: ${targetLangName}.

כללים קריטיים לתרגום כתוביות:
1. שמור במדויק על כל שורת כתובית ועל מבנה ה-JSON, כולל startTime ו-endTime המקוריים ללא שום שינוי!
2. תרגם בשפה קולחת, טבעית ומדוברת שמתאימה לפודקאסט ולקולנוע.
3. שמור על אורך משפט תמציתי ומדויק שמתאים לקריאה מהירה על המסך.

רשימת הכתוביות לתרגום:
${JSON.stringify(subtitles, null, 2)}

החזר אך ורק מערך JSON תקין עם אותם אובייקטים והתרגום בשדה "text":
[
  {
    "id": "...",
    "startTime": 0.0,
    "endTime": 2.5,
    "text": "Translated text here"
  }
]
`;

    // 1. Try Gemini
    if (geminiKey) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: translationPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const clean = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(clean);
              const list = Array.isArray(parsed) ? parsed : (parsed.subtitles || parsed.items || []);
              if (list.length > 0) {
                return NextResponse.json({
                  success: true,
                  subtitles: list,
                  targetLanguage,
                  source: `Gemini AI (${model})`
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    // 2. Try OpenAI
    if (openaiKey) {
      try {
        const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: translationPrompt }],
            response_format: { type: 'json_object' }
          })
        });

        if (openAiRes.ok) {
          const oJson = await openAiRes.json();
          const content = oJson.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            const list = Array.isArray(parsed) ? parsed : (parsed.subtitles || parsed.items || []);
            if (list.length > 0) {
              return NextResponse.json({
                success: true,
                subtitles: list,
                targetLanguage,
                source: 'OpenAI GPT-4o'
              });
            }
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({ error: 'שגיאה בתרגום הכתוביות. ודאו שמפתח ה-API תקין.' }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
