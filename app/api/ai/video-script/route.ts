import { NextRequest, NextResponse } from 'next/server';
import { 
  VideoAnalysisResult, 
  OriginalVideoMeta, 
  VideoTranscript, 
  ProductionScript, 
  TargetPlatform, 
  ScriptTone,
  TranscriptSegment 
} from '@/types/videoScript';
import { YoutubeTranscript } from 'youtube-transcript';

export const maxDuration = 120; // 2 minutes timeout for large transcripts & video analysis

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/;
  const match = clean.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Fetch YouTube captions safely with multiple language and fallback attempts
async function fetchYoutubeCaptions(videoId: string): Promise<{ fullText: string; cuesCount: number; segments: TranscriptSegment[] }> {
  const tryFetch = async (config?: any) => {
    try {
      const raw = await YoutubeTranscript.fetchTranscript(videoId, config);
      if (raw && raw.length > 0) {
        const fullText = raw.map(r => r.text).join(' ').replace(/\s+/g, ' ').trim();
        const segments: TranscriptSegment[] = raw.map((r, i) => ({
          id: `seg_${i + 1}`,
          startTime: Number((r.offset / 1000).toFixed(2)),
          endTime: Number(((r.offset + r.duration) / 1000).toFixed(2)),
          englishText: r.text.trim(),
          hebrewText: ''
        }));
        return { fullText, cuesCount: raw.length, segments };
      }
    } catch {
      // try next
    }
    return null;
  };

  // 1. Default (auto-detect English / primary language)
  const res1 = await tryFetch();
  if (res1 && res1.fullText.length > 0) return res1;

  // 2. Explicit English
  const res2 = await tryFetch({ lang: 'en' });
  if (res2 && res2.fullText.length > 0) return res2;

  // 3. Fallbacks
  const res3 = await tryFetch({ lang: 'en-US' });
  if (res3 && res3.fullText.length > 0) return res3;

  const res4 = await tryFetch({ lang: 'en-GB' });
  if (res4 && res4.fullText.length > 0) return res4;

  const res5 = await tryFetch({ lang: 'auto' });
  if (res5 && res5.fullText.length > 0) return res5;

  return { fullText: '', cuesCount: 0, segments: [] };
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
      apiKey,
      openaiApiKey
    } = body;

    const geminiKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY;
    const openaiKey = (openaiApiKey && openaiApiKey.trim()) || process.env.OPENAI_API_KEY;

    let metadata: OriginalVideoMeta = {
      title: videoTitle || 'סרטון מקור באנגלית',
      sourceUrl: videoUrl,
      platform: 'direct',
      transcriptSource: 'direct_text'
    };

    let englishSpokenText = (directTranscript || '').trim();
    let transcriptSegments: TranscriptSegment[] = [];

    // 1. If YouTube link provided, fetch metadata and transcript
    if (videoUrl) {
      const ytId = extractYouTubeId(videoUrl);
      if (ytId) {
        metadata.videoId = ytId;
        metadata.platform = 'youtube';
        metadata.thumbnailUrl = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;

        // Fetch title and author via oembed
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

        // Fetch real YouTube subtitles / transcript
        if (!englishSpokenText) {
          const captionData = await fetchYoutubeCaptions(ytId);
          if (captionData.fullText.length > 0) {
            englishSpokenText = captionData.fullText;
            metadata.transcriptSource = 'youtube_captions';
            metadata.transcriptCuesCount = captionData.cuesCount;
            transcriptSegments = captionData.segments;
          }
        }
      } else {
        metadata.title = videoTitle || videoUrl.split('/').pop()?.split('?')[0] || 'וידאו מקור ברשת';
      }
    }

    // 2. If uploaded audio/video is provided, transcribe with Gemini or Whisper
    if (audioBase64 && !englishSpokenText) {
      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const sanitizedMime = (mimeType || 'audio/wav').split(';')[0].trim();

      if (geminiKey) {
        try {
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
            if (spoken && spoken.trim().length > 0) {
              englishSpokenText = spoken.trim();
              metadata.transcriptSource = 'gemini_audio';
            }
          }
        } catch (audioErr) {
          console.warn('Gemini audio transcription error:', audioErr);
        }
      } else if (openaiKey) {
        try {
          const audioBuffer = Buffer.from(cleanBase64, 'base64');
          const fileExt = sanitizedMime.includes('mp4') ? 'mp4' 
            : sanitizedMime.includes('webm') ? 'webm' 
            : sanitizedMime.includes('mpeg') || sanitizedMime.includes('mp3') ? 'mp3' 
            : 'wav';
          const fileBlob = new Blob([audioBuffer], { type: sanitizedMime });

          const formData = new FormData();
          formData.append('file', fileBlob, `upload.${fileExt}`);
          formData.append('model', 'whisper-1');
          formData.append('language', 'en');
          formData.append('temperature', '0');

          const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}` },
            body: formData
          });

          if (whisperRes.ok) {
            const wData = await whisperRes.json();
            if (wData.text && wData.text.trim().length > 0) {
              englishSpokenText = wData.text.trim();
              metadata.transcriptSource = 'whisper_audio';
            }
          }
        } catch (wErr) {
          console.warn('Whisper transcription error:', wErr);
        }
      }
    }

    // 3. Strict Check: If no transcript could be obtained, return helpful guidance
    if (!englishSpokenText || englishSpokenText.trim().length === 0) {
      if (videoUrl) {
        return NextResponse.json({
          error: 'לא נמצא תמליל דיבור אוטומטי לסרטון יוטיוב זה (ייתכן שהיוצר לא אפשר כתוביות). באפשרותך להעלות את קובץ הסרטון/האודיו בלשונית "העלאת קובץ" לתמלול מלא ב-AI, או להדביק תמליל ישירות בלשונית "הדבקת תמליל".'
        }, { status: 400 });
      }
      return NextResponse.json({
        error: 'לא סופק תוכן לסרטון (נא להזין קישור, להעלות קובץ או להדביק תמליל).'
      }, { status: 400 });
    }

    // 4. Verify AI Key exists
    if (!geminiKey && !openaiKey) {
      return NextResponse.json({
        error: 'נא להזין מפתח AI (Google Gemini בחינם או OpenAI) בהגדרות כדי להפיק תסריט מקצועי בעברית וניתוח מעמיק של הסרטון.'
      }, { status: 401 });
    }

    // 5. Build Smart Dialogue Excerpt for the AI
    // For large videos (e.g. 145,000 characters), cover the beginning, middle, and end
    let transcriptForAI = englishSpokenText;
    if (englishSpokenText.length > 70000) {
      const part1 = englishSpokenText.slice(0, 30000);
      const midPoint = Math.floor(englishSpokenText.length / 2);
      const part2 = englishSpokenText.slice(midPoint - 10000, midPoint + 10000);
      const part3 = englishSpokenText.slice(-20000);
      transcriptForAI = `[חלק 1: פתיחה ורקע]\n${part1}\n\n[חלק 2: אמצע הסרטון וניתוח עומק]\n${part2}\n\n[חלק 3: סיום ומסקנות]\n${part3}`;
    }

    const toneGuide = 
      tone === 'viral_energetic' ? 'קצבי, אנרגטי, סוחף, מותאם ל-TikTok, Reels ו-YouTube ויראלי' :
      tone === 'deep_storytelling' ? 'סטוריטלינג עמוק, מתח, בניית עניין, רגש וחיבור עמוק' :
      tone === 'entertaining' ? 'הומוריסטי, שנון, זורם, קליל, מבדר ומלא שנינות' :
      'מקצועי, הסברתי, חינוכי, מעמיק ומשכיל';

    const platformGuide = 
      targetPlatform === 'tiktok_reels' ? 'סרטון קצר של 45-60 שניות (Shorts / Reels) - מהיר, חד, חיתוכים מהירים, ללא רגע מת' :
      targetPlatform === 'podcast' ? 'קטע עומק לפודקאסט של 8-12 דקות - דיאלוגי, עמוק, מעורר מחשבה' :
      'סרטון YouTube מלא ומובנה של 3-6 דקות - פתיח חזק, חלוקה לנושאים, שמירה על קצב';

    const prompt = `
אתה תסריטאי יוטיוב, במאי ועורך תוכן בכיר בעברית עבור יוצרי תוכן ופודקאסטים מובילים בישראל.
לפניך תמליל דיבור מלא ומדויק של סרטון באנגלית שצריך לנתח לעומק, להפיק ממנו עותק מתורגם ומלא של מה שנאמר, ולכתוב תסריט הפקה מלא בעברית כדי שהיוצר הישראלי יוכל לצלם ולהפיק סרטון מנצח בעברית על הנושא!

פרטי הסרטון המקורי:
- כותרת: "${metadata.title}"
- יוצר / מקור: "${metadata.author || 'לא צוין'}"
- קישור: "${metadata.sourceUrl || 'קובץ ישיר'}"

מה שנאמר בסרטון באנגלית (תמליל המקור):
"""
${transcriptForAI}
"""

דרישות ההפקה לסרטון בעברית:
- פלטפורמת יעד: ${platformGuide}
- טון דיבור וסגנון: ${toneGuide}
- שפת התסריט: עברית טבעית, מדוברת, שוטפת, קולחת ומזמינה (עברית ישראלית של יוצרי תוכן מצליחים, ללא תרגום מילולי יבש ומסורבל!).
- כלל ברזל חשוב מכל: דבר ישירות אל הצופה בעברית שוטפת כאילו אתה המגיש שמספר את הסיפור, העובדות, הדוגמאות והתובנות!
  לעולם אל תשתמש במשפטים טכניים או יבשים כמו "סרטון שכותרתו...", "מאת היוצר...", קישורי אינטרנט או "הכל מתחיל בעובדה הפשוטה הזו".
  הכנס את הצופה ישר לתוך הסיפור והנושא המסקרן מהשנייה הראשונה!

עליך להחזיר מבנה JSON תקני לחלוטין עם שני חלקים מרכזיים:
חלק 1: עותק של מה שנאמר (תמליל מלא באנגלית + תרגום מדויק וקולח לעברית מחולק לפסקאות נקיות + נקודות מפתח מרכזיות + תקציר).
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

החזר אך ורק JSON תקין (Valid JSON object) במבנה הבא:
{
  "transcript": {
    "englishText": "Full clean English text of what was spoken...",
    "hebrewText": "תרגום עברי מלא, מפורט, קולח ומדויק של כל מה שנאמר בסרטון...",
    "summary": "תקציר של 2-4 משפטים בעברית על מהות ותובנות הסרטון...",
    "keyPoints": [
      "נקודת מפתח 1 שהוזכרה בסרטון",
      "נקודת מפתח 2",
      "נקודת מפתח 3",
      "נקודת מפתח 4",
      "נקודת מפתח 5"
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

    // 6. Execute with Gemini or OpenAI
    if (geminiKey) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
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
              const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(clean);
              if (parsed.script && parsed.transcript) {
                const result: VideoAnalysisResult = {
                  metadata,
                  transcript: {
                    englishText: parsed.transcript.englishText || englishSpokenText,
                    hebrewText: parsed.transcript.hebrewText,
                    summary: parsed.transcript.summary,
                    keyPoints: parsed.transcript.keyPoints || [],
                    segments: transcriptSegments.length > 0 ? transcriptSegments : undefined
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

    // Fallback to OpenAI if Gemini was not available or failed
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
              { role: 'system', content: 'You are an elite video scriptwriter and producer. Always respond with valid JSON matching the requested structure.' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.4
          })
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed.script && parsed.transcript) {
              const result: VideoAnalysisResult = {
                metadata,
                transcript: {
                  englishText: parsed.transcript.englishText || englishSpokenText,
                  hebrewText: parsed.transcript.hebrewText,
                  summary: parsed.transcript.summary,
                  keyPoints: parsed.transcript.keyPoints || [],
                  segments: transcriptSegments.length > 0 ? transcriptSegments : undefined
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
                source: 'OpenAI Video Script Engine (GPT-4o)',
                data: result
              });
            }
          }
        }
      } catch (openAiErr) {
        console.warn('OpenAI video script failed:', openAiErr);
      }
    }

    return NextResponse.json({
      error: 'עיבוד הסרטון נכשל מול שרתי ה-AI. נא לוודא שמפתח ה-API תקין בהגדרות.'
    }, { status: 500 });
  } catch (error: any) {
    console.error('Video Script Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בעיבוד הסרטון והפקת התסריט' },
      { status: 500 }
    );
  }
}
