import { NextRequest, NextResponse } from 'next/server';
import { SubtitleItem } from '@/lib/types';

// Free Google Translate fallback function (fast, zero API key required)
async function freeTranslateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const tl = targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(clean)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((chunk: any) => chunk[0] || '').join('').trim();
        if (translated) return translated;
      }
    }
  } catch (e) {
    console.warn('Free translation fallback error:', e);
  }
  return clean; // Fallback to original text if translation failed
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      subtitles = [], 
      targetLanguage = 'he', 
      sourceLanguage = 'auto', 
      apiKey,
      openaiApiKey 
    } = body;

    if (!Array.isArray(subtitles) || subtitles.length === 0) {
      return NextResponse.json({ error: 'אין כתוביות לתרגום' }, { status: 400 });
    }

    const geminiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;
    const openaiKey = openaiApiKey?.trim() || process.env.OPENAI_API_KEY;

    // Detect language if auto
    const sampleText = subtitles.slice(0, 10).map((s: SubtitleItem) => s.text).join(' ');
    const hasHebrew = /[\u0590-\u05FF]/.test(sampleText);
    const hasEnglish = /[a-zA-Z]/.test(sampleText);

    let effectiveSource = sourceLanguage;
    let effectiveTarget = targetLanguage;

    if (effectiveSource === 'auto') {
      if (hasEnglish && !hasHebrew) {
        effectiveSource = 'en';
        effectiveTarget = targetLanguage === 'en' ? 'he' : targetLanguage;
      } else if (hasHebrew) {
        effectiveSource = 'he';
        effectiveTarget = targetLanguage === 'he' ? 'en' : targetLanguage;
      } else {
        effectiveSource = 'auto';
      }
    }

    // If source and target end up the same, smart flip:
    if (effectiveSource === effectiveTarget) {
      effectiveTarget = effectiveSource === 'he' ? 'en' : 'he';
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

    const targetLangName = langNames[effectiveTarget] || effectiveTarget;
    const sourceLangName = langNames[effectiveSource] || effectiveSource;

    const translationPrompt = `
אתה מתרגם כתוביות מקצועי לפודקאסטים, סרטוני תוכן וקולנוע.
עליך לתרגם את רשימת הכתוביות הבאה מ-${sourceLangName} לשפת היעד: ${targetLangName}.

כללים קריטיים לתרגום כתוביות:
1. שמור במדויק על כל שורת כתובית ועל מבנה ה-JSON, כולל id, startTime ו-endTime המקוריים ללא שום שינוי!
2. תרגם בשפה קולחת, טבעית ומדוברת שמתאימה לקריאה מהירה על המסך.
3. אם שפת המקור היא אנגלית ושפת היעד עברית: תרגם לעברית טבעית (לא תרגום מכונה יבש).
4. אם מופיע סלנג או שמות מותגים/טכנולוגיות, השאר אותם מוכרים וברורים (או בתעתיק מתאים).

רשימת הכתוביות לתרגום:
${JSON.stringify(subtitles, null, 2)}

החזר אך ורק מערך JSON תקין עם אותם אובייקטים והתרגום בשדה "text":
[
  {
    "id": "...",
    "startTime": 0.0,
    "endTime": 2.5,
    "text": "טקסט מתורגם כאן"
  }
]
`;

    // 1. Try Gemini AI if key available
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
                // Ensure timings are preserved from original
                const merged = subtitles.map((orig: SubtitleItem, idx: number) => ({
                  ...orig,
                  text: list[idx]?.text || list.find((item: any) => item.id === orig.id)?.text || orig.text
                }));
                return NextResponse.json({
                  success: true,
                  subtitles: merged,
                  targetLanguage: effectiveTarget,
                  source: `Gemini AI (${model})`
                });
              }
            }
          }
        } catch (e) {
          console.warn(`Gemini model ${model} translation failed:`, e);
        }
      }
    }

    // 2. Try OpenAI if key available
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
              const merged = subtitles.map((orig: SubtitleItem, idx: number) => ({
                ...orig,
                text: list[idx]?.text || list.find((item: any) => item.id === orig.id)?.text || orig.text
              }));
              return NextResponse.json({
                success: true,
                subtitles: merged,
                targetLanguage: effectiveTarget,
                source: 'OpenAI GPT-4o'
              });
            }
          }
        }
      } catch (e) {
        console.warn('OpenAI translation failed:', e);
      }
    }

    // 3. Robust Free Translation Fallback (Zero API key needed, never fails!)
    try {
      const translatedItems: SubtitleItem[] = [];
      // Translate in parallel batches of 5 for high speed
      const batchSize = 5;
      for (let i = 0; i < subtitles.length; i += batchSize) {
        const batch = subtitles.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (item: SubtitleItem) => {
            const translated = await freeTranslateText(item.text, effectiveSource, effectiveTarget);
            return {
              ...item,
              text: translated || item.text
            };
          })
        );
        translatedItems.push(...batchResults);
      }

      return NextResponse.json({
        success: true,
        subtitles: translatedItems,
        targetLanguage: effectiveTarget,
        source: 'מנוע תרגום מובנה (Google Translate - חינם ללא צורך במפתח)'
      });
    } catch (fallbackErr: any) {
      console.error('All translation options failed:', fallbackErr);
      return NextResponse.json({ 
        error: 'שגיאה בתרגום הכתוביות. אנא נסו שוב או הזינו מפתח Gemini בהגדרות ה-AI.' 
      }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
