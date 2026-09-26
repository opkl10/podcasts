import { NextRequest, NextResponse } from 'next/server';
import { 
  VideoAnalysisResult, 
  OriginalVideoMeta, 
  VideoTranscript, 
  ProductionScript, 
  TargetPlatform, 
  ScriptTone 
} from '@/types/videoScript';

export const maxDuration = 60; // Next.js route max timeout

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Free Google Translate fallback
async function freeTranslateText(text: string, targetLang: string = 'he'): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(clean)}`;
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
  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      videoUrl,
      audioBase64,
      mimeType = 'audio/wav',
      directTranscript,
      videoTitle,
      targetPlatform = 'youtube',
      tone = 'viral_energetic',
      targetDurationMinutes = 3,
      apiKey
    } = body;

    const geminiKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;

    let metadata: OriginalVideoMeta = {
      title: videoTitle || 'סרטון מקור באנגלית',
      sourceUrl: videoUrl,
      platform: 'direct'
    };

    let englishSpokenText = (directTranscript || '').trim();

    // 1. If YouTube link provided, fetch metadata
    if (videoUrl) {
      const ytId = extractYouTubeId(videoUrl);
      if (ytId) {
        metadata.videoId = ytId;
        metadata.platform = 'youtube';
        metadata.thumbnailUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;

        try {
          const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
          if (oembedRes.ok) {
            const oembedData = await oembedRes.json();
            metadata.title = oembedData.title || metadata.title;
            metadata.author = oembedData.author_name || metadata.author;
            if (oembedData.thumbnail_url) {
              metadata.thumbnailUrl = oembedData.thumbnail_url;
            }
          }
        } catch (e) {
          console.warn('Could not fetch oEmbed metadata:', e);
        }

        // Attempt to fetch public YouTube subtitles if not provided
        if (!englishSpokenText) {
          try {
            const pageRes = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              const match = html.match(/"captionTracks":\s*(\[.*?\])/);
              if (match) {
                const tracks = JSON.parse(match[1]);
                const enTrack = tracks.find((t: any) => t.languageCode === 'en' || t.vssId?.includes('.en'));
                if (enTrack && enTrack.baseUrl) {
                  const capRes = await fetch(enTrack.baseUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                  });
                  if (capRes.ok) {
                    const xml = await capRes.text();
                    const textMatches = Array.from(xml.matchAll(/<text[^>]*>([^<]+)<\/text>/g)).map(m => m[1]);
                    if (textMatches.length > 0) {
                      englishSpokenText = textMatches
                        .map(t => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
                        .join(' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                    }
                  }
                }
              }
            }
          } catch (capErr) {
            console.warn('YouTube caption fetch error:', capErr);
          }
        }
      } else {
        metadata.title = videoTitle || videoUrl.split('/').pop()?.split('?')[0] || 'וידאו מקור ברשת';
      }
    }

    // 2. If uploaded audio/video is provided, transcribe with Gemini
    if (audioBase64 && !englishSpokenText && geminiKey) {
      try {
        const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
        const sanitizedMime = (mimeType || 'audio/wav').split(';')[0].trim();

        const transcribePrompt = `
You are an expert speech recognition model.
Listen carefully to this entire audio track and transcribe EVERYTHING spoken in complete, exact English.
Do not summarize. Transcribe verbatim. Return only the English transcription text.
`;
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: transcribePrompt },
                  { inlineData: { mimeType: sanitizedMime, data: cleanBase64 } }
                ]
              }]
            })
          }
        );

        if (geminiRes.ok) {
          const transData = await geminiRes.json();
          const spoken = transData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (spoken) {
            englishSpokenText = spoken.trim();
          }
        }
      } catch (audioErr) {
        console.warn('Audio transcription error:', audioErr);
      }
    }

    // 3. Fallback context if no text was directly transcribed but video title/metadata exists
    if (!englishSpokenText) {
      englishSpokenText = `Video titled "${metadata.title}" by ${metadata.author || 'creator'}. Source: ${metadata.sourceUrl || 'Video file'}.`;
    }

    // 4. Generate Hebrew Translation & Complete Creator Production Script via Gemini AI
    if (geminiKey) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

      const toneGuide = 
        tone === 'viral_energetic' ? 'קצבי, אנרגטי, סוחף, מותאם ל-TikTok, Reels ו-YouTube ויראלי' :
        tone === 'deep_storytelling' ? 'סטוריטלינג עמוק, מתח, בניית עניין ורגש' :
        tone === 'entertaining' ? 'הומוריסטי, שנון, זורם, קליל ומבדר' :
        'מקצועי, הסברתי, חינוכי ומשכיל';

      const platformGuide = 
        targetPlatform === 'tiktok_reels' ? 'סרטון קצר של 45-60 שניות (Shorts / Reels) - מהיר, חד, חיתוכים מהירים' :
        targetPlatform === 'podcast' ? 'קטע עומק לפודקאסט של 8-12 דקות' :
        'סרטון YouTube מלא ומובנה של 3-6 דקות';

      const prompt = `
אתה תסריטאי יוטיוב, במאי ועורך תוכן בכיר בעברית עבור יוצרי תוכן ופודקאסטים מובילים.
לפניך סרטון באנגלית שצריך לנתח, להפיק ממנו עותק מלא ומתורגם של מה שנאמר, ולכתוב תסריט הפקה מלא בעברית כדי שהיוצר הישראלי יוכל לצלם ולהפיק סרטון מנצח בעברית על הנושא!

פרטי הסרטון המקורי:
- כותרת: "${metadata.title}"
- יוצר / מקור: "${metadata.author || 'לא צוין'}"
- קישור: "${metadata.sourceUrl || 'קובץ הועלה'}"

מה שנאמר בסרטון באנגלית (עותק המקור):
"""
${englishSpokenText.slice(0, 15000)}
"""

דרישות ההפקה לסרטון בעברית:
- פלטפורמת יעד: ${platformGuide}
- טון דיבור וסגנון: ${toneGuide}
- שפת התסריט: עברית טבעית, מדוברת, שוטפת, קולחת ומזמינה (עברית ישראלית של יוצרי תוכן מצליחים, ללא תרגום מילולי יבש ומסורבל!).

עליך להחזיר מבנה JSON תקני לחלוטין עם שני חלקים מרכזיים:
חלק 1: עותק של מה שנאמר (תמליל מלא באנגלית + תרגום מדויק וקולח לעברית + נקודות מפתח).
חלק 2: תסריט הפקה מלא בעברית הכולל:
  - 3 כותרות חזקות בעברית (Click-worthy titles).
  - "hook": פתיח ממגנט של 3-5 שניות שתופס את הצופה מיידית.
  - "scenes": בין 4 ל-7 סצנות מסודרות ברצף הפקה כרונולוגי:
    * "sceneNumber": מספר הסצנה (1, 2, 3...)
    * "sceneTitle": כותרת הסצנה
    * "estimatedSeconds": משך זמן מוערך בשניות
    * "visualDirection": מה מראים על המסך (למשל: "מצלמה לפנים זום קל", "חיתוך לתמונת B-Roll", "טקסט מודגש על המסך", "הדגמת מסך")
    * "spokenHebrewText": הטקסט המדויק לדיבור מול המצלמה (מנוסח מושלם לקריאה מטלפרומפטר)
    * "audioSoundEffect": אפקט סאונד מומלץ (Whoosh, מתח, ביט, וכו')
    * "directorTip": דגש הגשה למגיש (אינטונציה, קשר עין, חיוך, פאוזה)
  - "callToAction": משפט סיום והנעה לפעולה (להגיב, לעקוב, לשתף).
  - "descriptionHebrew": תיאור מלא מומלץ לפרסום הסרטון ביוטיוב/רשתות.
  - "hashtags": מערך של 5-8 האשטגים מומלצים.
  - "productionNotes": טיפים להפקה (מוזיקת רקע, קצב עריכה, תאורה).

החזר אך ורק JSON תקין במבנה הבא:
{
  "transcript": {
    "englishText": "Full clean English text of what was spoken...",
    "hebrewText": "תרגום עברי מלא, קולח ומדויק של כל מה שנאמר...",
    "summary": "תקציר של 2-3 משפטים בעברית על מהות הסרטון...",
    "keyPoints": [
      "נקודת מפתח 1 שהוזכרה בסרטון",
      "נקודת מפתח 2",
      "נקודת מפתח 3",
      "נקודת מפתח 4"
    ]
  },
  "script": {
    "titleHebrew": "כותרת ראשית מושכת בעברית לסרטון",
    "alternateTitles": [
      "כותרת אלטרנטיבית 1",
      "כותרת אלטרנטיבית 2",
      "כותרת אלטרנטיבית 3"
    ],
    "targetPlatform": "${targetPlatform}",
    "targetDurationMinutes": ${targetDurationMinutes},
    "hook": "משפט פתיחה ממגנט בעברית של 3-5 שניות שמדביק את הצופה למסך!",
    "scenes": [
      {
        "sceneNumber": 1,
        "sceneTitle": "הפתיח וההבטחה הגדולה",
        "estimatedSeconds": 15,
        "visualDirection": "צילום פנים ישיר, זום אין איטי, כותרת מודגשת צפה בצד שמאל.",
        "spokenHebrewText": "טקסט בעברית לדיבור שפותח את הנושא...",
        "audioSoundEffect": "צליל Whoosh קל בפתיחה",
        "directorTip": "דבר באנרגיה גבוהה וישירה למצלמה"
      }
    ],
    "callToAction": "סגירה והנעה חזקה לפעולה...",
    "descriptionHebrew": "תיאור מוכן להעתקה עבור יוטיוב או הרשתות החברתיות...",
    "hashtags": ["#יוטיוב", "#תוכן", "#ישראל"],
    "productionNotes": "טיפים להפקה: השתמשו בתאורה רכה מול הפנים, קצב חיתוכים מהיר כל 4 שניות."
  }
}
`;

      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.4
                }
              })
            }
          );

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
              if (parsed.script && parsed.transcript) {
                const result: VideoAnalysisResult = {
                  metadata,
                  transcript: {
                    englishText: parsed.transcript.englishText || englishSpokenText,
                    hebrewText: parsed.transcript.hebrewText,
                    summary: parsed.transcript.summary,
                    keyPoints: parsed.transcript.keyPoints || []
                  },
                  script: {
                    titleHebrew: parsed.script.titleHebrew,
                    alternateTitles: parsed.script.alternateTitles || [],
                    targetPlatform,
                    targetDurationMinutes,
                    hook: parsed.script.hook,
                    scenes: parsed.script.scenes || [],
                    callToAction: parsed.script.callToAction,
                    descriptionHebrew: parsed.script.descriptionHebrew || '',
                    hashtags: parsed.script.hashtags || [],
                    productionNotes: parsed.script.productionNotes || ''
                  },
                  createdAt: new Date().toISOString()
                };

                return NextResponse.json({
                  success: true,
                  source: `Gemini AI Video Script Engine (${model})`,
                  data: result
                });
              }
            }
          }
        } catch (e) {
          console.warn(`Model ${model} failed for video script:`, e);
        }
      }
    }

    // 5. Deterministic local generator fallback (always returns clean, complete result)
    const translatedHebrew = await freeTranslateText(englishSpokenText.slice(0, 3000), 'he');
    const cleanTitleHebrew = await freeTranslateText(metadata.title, 'he') || metadata.title;

    const fallbackResult: VideoAnalysisResult = {
      metadata,
      transcript: {
        englishText: englishSpokenText,
        hebrewText: translatedHebrew || englishSpokenText,
        summary: `ניתוח הסרטון "${cleanTitleHebrew}" שנערך בהתבסס על תוכן המקור.`,
        keyPoints: [
          `הסבר התובנה המרכזית המוצגת בסרטון`,
          `דוגמה מוחשית והוכחה מהשטח`,
          `משמעות הפרט הזה עבור הקהל`,
          `מסקנה ויישום מעשי`
        ]
      },
      script: {
        titleHebrew: `האמת מאחורי ${cleanTitleHebrew}`,
        alternateTitles: [
          `איך הדבר הזה משנה הכל: ${cleanTitleHebrew}`,
          `מה שכולם מפספסים ב-${cleanTitleHebrew}`,
          `הסוד שלא סיפרו לכם על ${cleanTitleHebrew}`
        ],
        targetPlatform,
        targetDurationMinutes,
        hook: `אתם לא תאמינו מה גיליתי על ${cleanTitleHebrew} – וזה הולך לשנות לחלוטין את הדרך שבה אתם מסתכלים על זה!`,
        scenes: [
          {
            sceneNumber: 1,
            sceneTitle: 'הפתיח וההבטחה הגדולה',
            estimatedSeconds: 15,
            visualDirection: 'צילום פנים ישיר למצלמה, קלוז אפ קל, כתובית מודגשת עם שאלת פתיחה.',
            spokenHebrewText: `שלום חברים! היום אנחנו צוללים לנושא שכולם מדברים עליו: ${cleanTitleHebrew}. אבל יש כאן זווית שאף אחד לא מספר לכם, ובסרטון הזה אני אחשוף אותה צעד אחרי צעד.`,
            audioSoundEffect: 'צליל Whoosh קצבי בפתיח',
            directorTip: 'קשר עין ישיר למצלמה, אנרגיה פותחת וסוחפת'
          },
          {
            sceneNumber: 2,
            sceneTitle: 'הקונפליקט והרקע המרכזי',
            estimatedSeconds: 40,
            visualDirection: 'חיתוך לצילומי B-Roll והמחשה, טקסט נקודות מרכזיות בצד המסך.',
            spokenHebrewText: `הכל מתחיל בעובדה הפשוטה הזו: ${translatedHebrew.slice(0, 200)}... זה נשמע מטורף, אבל זה בדיוק מה שקורה מאחורי הקלעים.`,
            audioSoundEffect: 'מוזיקת רקע עדינה וקצבית',
            directorTip: 'דיבור מובנה, הדגשת מילות מפתח'
          },
          {
            sceneNumber: 3,
            sceneTitle: 'התגלית המפתיעה והפתרון',
            estimatedSeconds: 45,
            visualDirection: 'חזרה לצילום פנים, הדגשת נתונים מספריים באנימציה.',
            spokenHebrewText: `מה שהופך את זה למרתק באמת זה מה שקורה כשמחברים את כל הנקודות יחד. הנה מה שחובה להבין: ${translatedHebrew.slice(200, 450) || 'ההשלכות של זה רחבות בהרבה ממה שנראה לעין'}.`,
            audioSoundEffect: 'צליל הדגשה (Ding)',
            directorTip: 'פאוזה קלה לפני חשיפת התובנה'
          },
          {
            sceneNumber: 4,
            sceneTitle: 'סיכום ומסקנה לקחת הביתה',
            estimatedSeconds: 20,
            visualDirection: 'זום אאוט קל, תצוגת לוגו האולפן וסרטונים קשורים.',
            spokenHebrewText: `אז מה השורה התחתונה? ${cleanTitleHebrew} מלמד אותנו שחייבים לבדוק לעומק ולא להסתמך רק על השטח.`,
            audioSoundEffect: 'מוזיקת סגירה עולה',
            directorTip: 'נימה חמה ומזמינה'
          }
        ],
        callToAction: 'מה דעתכם על זה? ספרו לי עכשיו בתגובות למטה, ואל תשכחו לתת לייק ולהירשם לערוץ כדי לא לפספס את הסרטון הבא!',
        descriptionHebrew: `בסרטון הזה נצלול לתוך ${cleanTitleHebrew} ונחשוף את כל מה שחשוב לדעת. ספרו לי בתגובות מה אתם חושבים!`,
        hashtags: ['#יוטיוב', `#${cleanTitleHebrew.replace(/\s+/g, '_')}`, '#תוכן_ישראלי', '#סרטונים_בעברית'],
        productionNotes: 'מומלץ לצלם עם תאורת מפתח רכה וסאונד באיכות אולפן. חתכו כל שקט בעריכה לשמירה על קצב גבוה.'
      },
      createdAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      source: 'Deterministic Local Script Engine',
      data: fallbackResult
    });

  } catch (err: any) {
    console.error('Video script generation error:', err);
    return NextResponse.json(
      { error: err?.message || 'שגיאה בניתוח הסרטון והפקת התסריט' },
      { status: 500 }
    );
  }
}
