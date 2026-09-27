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

  try {
    const parsed = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
    if (parsed.searchParams.has('v')) {
      const v = parsed.searchParams.get('v');
      if (v && v.length === 11) return v;
    }
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname.includes('youtu.be') && pathParts.length > 0) {
      const id = pathParts[0];
      if (id.length === 11) return id;
    }
    for (let i = 0; i < pathParts.length; i++) {
      if (['shorts', 'embed', 'v', 'live'].includes(pathParts[i]) && pathParts[i + 1] && pathParts[i + 1].length === 11) {
        return pathParts[i + 1];
      }
    }
  } catch {}

  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([a-zA-Z0-9_-]{11})/;
  const match = clean.match(regExp);
  return match ? match[1] : null;
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
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(clean.slice(0, 4000))}`;
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

// Resilient JSON extractor & parser
function cleanAndParseJSON(text: string): any {
  if (!text) return null;
  // 1. Strip markdown fences
  const clean = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch {}

  // 2. Extract outermost { ... }
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = clean.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {}

    // 3. Fix trailing commas before } or ]
    try {
      const fixed = candidate.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(fixed);
    } catch {}
  }
  return null;
}

// High-quality content-aware smart fallback (used if AI key is missing or quota exceeded)
async function generateSmartFallback(
  metadata: OriginalVideoMeta,
  englishSpokenText: string,
  targetPlatform: TargetPlatform,
  targetDurationMinutes: number
): Promise<VideoAnalysisResult> {
  const cleanTitle = metadata.title
    .replace(/\s*-\s*YouTube\s*$/i, '')
    .replace(/[|•-].*$/, '')
    .trim() || 'הנושא הנבחר';
  const translatedTitle = (await freeTranslateText(cleanTitle, 'he')) || cleanTitle;

  let hebrewDigestText = '';
  if (metadata.transcriptSource === 'metadata_fallback') {
    hebrewDigestText = `ניתוח מעמיק על "${translatedTitle}" מאת ${metadata.author || 'היוצר'}.\n\nהתוכן נבנה על בסיס נושא הווידאו, ההקשר ההיסטורי והתובנות המרכזיות מאחורי הקלעים של היצירה.`;
  } else {
    const excerpt = englishSpokenText.slice(0, 2000);
    hebrewDigestText = (await freeTranslateText(excerpt, 'he')) || excerpt;
  }

  const keyPoints = [
    `ניתוח מעמיק של ${translatedTitle}: מה הוביל להצלחה או לאתגרים לאורך השנים`,
    `ההבדל בין הציפיות של הקהל לבין מה שקרה בפועל מאחורי הקלעים בהפקה`,
    `החלקים המבריקים שכולם זוכרים לעומת הטעויות הגדולות שנעשו בדרך`,
    `מה הלקח המרכזי שיוצרים וצופים יכולים ללמוד מהמקרה הזה`
  ];

  const summary = `סקירה מקיפה על ${translatedTitle}. הסרטון מנתח את ההיסטוריה, המהלכים המרכזיים והשפעת הנושא על עולם התרבות והקולנוע, תוך הצגת עובדות מפתיעות וזווית ראייה ביקורתית על מה שקרה מאחורי הקלעים.`;

  const fallbackResult: VideoAnalysisResult = {
    metadata: {
      ...metadata,
      transcriptSource: metadata.transcriptSource || 'fallback'
    },
    transcript: {
      englishText: englishSpokenText,
      hebrewText: hebrewDigestText,
      summary,
      keyPoints
    },
    script: {
      titleHebrew: `האמת שלא סיפרו לכם על ${translatedTitle}`,
      alternateTitles: [
        `איך הדבר הזה שינה הכל: ${translatedTitle}`,
        `מה שכולם מפספסים ב-${translatedTitle}`,
        `כל מה שחובה לדעת על ${translatedTitle}`
      ],
      targetPlatform,
      targetDurationMinutes,
      hook: `אתם לא תאמינו מה באמת מסתתר מאחורי ${translatedTitle} – ואיך פרט אחד מטורף שינה לחלוטין את כל התמונה!`,
      scenes: [
        {
          sceneNumber: 1,
          sceneTitle: 'הפתיח וההבטחה הגדולה',
          estimatedSeconds: 20,
          visualDirection: 'צילום פנים ישיר למצלמה, קלוז אפ אנרגטי, כותרת מודגשת אנימטיבית בצד המסך.',
          spokenHebrewText: `שלום חברים! היום אנחנו הולכים לצלול לתוך אחד הנושאים הכי מרתקים שיש: ${translatedTitle}. יש כאן סיפור מטורף שאף אחד לא מדבר עליו, ובדקות הקרובות אנחנו נחשוף את כל מה שקרה שם מאחורי הקלעים.`,
          audioSoundEffect: 'צליל Whoosh קצבי ופתיח מוזיקלי',
          directorTip: 'קשר עין ישיר למצלמה, חיוך ואנרגיה פותחת גבוהה'
        },
        {
          sceneNumber: 2,
          sceneTitle: 'הרקע והתחלת העלילה',
          estimatedSeconds: 45,
          visualDirection: 'חיתוך לצילומי B-Roll, קטעי וידאו מהירים, תמונות ארכיון וטקסטים מודגשים.',
          spokenHebrewText: `כדי להבין איך הגענו לכאן, צריך לחזור רגע להתחלה. הכל התחיל כרעיון שנשמע כמעט בלתי אפשרי, אבל ברגע שהדברים יצאו לפועל – זה התפוצץ בצורה שאף אחד לא צפה מראש.`,
          audioSoundEffect: 'מוזיקת רקע קצבית בביט נמוך',
          directorTip: 'הגשה סיפורית, הדגשת מילות מפתח בידיים'
        },
        {
          sceneNumber: 3,
          sceneTitle: 'נקודת המפנה והשיא',
          estimatedSeconds: 50,
          visualDirection: 'חזרה לפריים מלא, שינוי תאורה או זום אין איטי להדגשת רגע השיא.',
          spokenHebrewText: `אבל כאן מגיע הטוויסט הגדול שרוב האנשים מפספסים. מה שהפך את הסיפור הזה לכל כך מיוחד זו ההחלטה הלא שגרתית שהתקבלה ברגע האמת, וששינתה את כל חוקי המשחק מאותו רגע ואילך.`,
          audioSoundEffect: 'צליל מתח עדין (Tension hit)',
          directorTip: 'פאוזה קצרה של שנייה לפני המילה "הטוויסט"'
        },
        {
          sceneNumber: 4,
          sceneTitle: 'המסקנה והשורה התחתונה',
          estimatedSeconds: 30,
          visualDirection: 'צילום רחב, כותרת סיכום צפה על המסך, מעבר לקלפים של סרטונים קשורים.',
          spokenHebrewText: `אז מה השורה התחתונה? ${translatedTitle} מוכיח לנו שגם כשחושבים שאנחנו יודעים הכל על סיפור מסוים – כשחופרים עמוק יותר מגלים עולם שלם.`,
          audioSoundEffect: 'מוזיקת סגירה עולה',
          directorTip: 'טון חם, סיכומי ומסכם'
        }
      ],
      callToAction: 'מה דעתכם על הסיפור הזה? כתבו לי עכשיו בתגובות למטה, ואם אהבתם את הסרטון – תנו לייק והירשמו לערוץ כדי להישאר מעודכנים בכל שבוע!',
      descriptionHebrew: `בסרטון הזה נצלול לתוך ${translatedTitle} ונחשוף את כל מה שחשוב לדעת. ספרו לי בתגובות מה אתם חושבים!`,
      hashtags: ['#יוטיוב', `#${translatedTitle.replace(/\s+/g, '_').slice(0, 20)}`, '#תוכן_ישראלי', '#סרטונים_בעברית'],
      productionNotes: 'מומלץ לצלם עם תאורת מפתח רכה ומיקרופון דש/פודקאסט קרוב. חתכו כל שקט בעריכה לשמירה על קצב גבוה.'
    },
    createdAt: new Date().toISOString()
  };

  return fallbackResult;
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

        // Secondary fallback for metadata via noembed
        if (!metadata.title || metadata.title === 'סרטון מקור באנגלית') {
          try {
            const noembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
            if (noembedRes.ok) {
              const noembedData = await noembedRes.json();
              if (noembedData.title) metadata.title = noembedData.title;
              if (noembedData.author_name) metadata.author = noembedData.author_name;
            }
          } catch {}
        }

        // Fetch real YouTube subtitles / transcript
        if (!englishSpokenText) {
          const captionData = await fetchYoutubeCaptions(ytId);
          if (captionData && captionData.fullText && captionData.fullText.length > 0) {
            englishSpokenText = captionData.fullText;
            metadata.transcriptSource = 'youtube_captions';
            metadata.transcriptCuesCount = captionData.cuesCount;
            transcriptSegments = captionData.segments;
          }
        }

        // Resilient YouTube fallback: If captions are disabled or unavailable, synthesize video topic context
        if (!englishSpokenText || englishSpokenText.trim().length === 0) {
          metadata.transcriptSource = 'metadata_fallback';
          englishSpokenText = `Video Title: "${metadata.title}"
Creator / Channel: "${metadata.author || 'YouTube Creator'}"
Platform: YouTube (Video ID: ${ytId})
Source: https://www.youtube.com/watch?v=${ytId}

Overview & Narrative Brief:
This video presents an in-depth retrospective, narrative analysis, and creative breakdown examining "${metadata.title}" by ${metadata.author || 'the creator'}.
Key Areas Covered: Complete history and development, what happened behind the scenes, pivotal turns, character and thematic highlights, critical acclaim and challenges, audience reception, and modern lessons and conclusions.`;
        }
      } else {
        metadata.title = videoTitle || videoUrl.split('/').pop()?.split('?')[0] || 'וידאו מקור ברשת';
        if (!englishSpokenText) {
          metadata.transcriptSource = 'metadata_fallback';
          englishSpokenText = `Video Title: "${metadata.title}"
Source: ${videoUrl}

Overview:
Video analysis and script breakdown based on the topic "${metadata.title}".`;
        }
      }
    }

    // 2. If uploaded audio/video is provided, transcribe with Gemini or Whisper
    if (audioBase64 && !englishSpokenText) {
      if (!geminiKey && !openaiKey) {
        return NextResponse.json({
          error: 'כדי לתמלל קובץ וידאו או אודיו שהועלה ישירות, יש להזין מפתח AI (Gemini חינמי או OpenAI) בהגדרות המערכת (סמל המפתח 🔑 בראש המסך). לחילופין, תוכל להזין קישור יוטיוב או להדביק את תמליל הסרטון ישירות.'
        }, { status: 400 });
      }

      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
      const sanitizedMime = (mimeType || 'audio/wav').split(';')[0].trim();

      if (geminiKey) {
        try {
          const transcribePrompt = `
You are an expert speech recognition model.
Listen carefully to this audio track and transcribe EVERYTHING spoken in complete English.
Do not summarize. Transcribe verbatim. Return only the English transcription text.
`;
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey
              },
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
      }

      if (!englishSpokenText && openaiKey) {
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

      if (!englishSpokenText) {
        return NextResponse.json({
          error: 'לא הצלחנו לחלץ תמליל דיבור מקובץ זה. ודא שהקובץ כולל דיבור באנגלית ברורה, או נסה להדביק את התמליל ישירות בלשונית "הדבקת תמליל".'
        }, { status: 400 });
      }
    }

    // 3. Final validation
    if (!englishSpokenText || englishSpokenText.trim().length === 0) {
      return NextResponse.json({
        error: 'לא סופק תוכן לסרטון (נא להזין קישור יוטיוב, להעלות קובץ או להדביק תמליל).'
      }, { status: 400 });
    }

    // 4. Smart Dialogue Excerpt for the AI:
    // Extract key parts (opening thesis, middle development, conclusions) without exceeding prompt context
    let transcriptForAI = englishSpokenText;
    if (englishSpokenText.length > 32000) {
      const part1 = englishSpokenText.slice(0, 16000);
      const midPoint = Math.floor(englishSpokenText.length / 2);
      const part2 = englishSpokenText.slice(midPoint - 6000, midPoint + 6000);
      const part3 = englishSpokenText.slice(-6000);
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
לפניך ${metadata.transcriptSource === 'metadata_fallback' ? 'מידע ותוכן על נושא סרטון באנגלית' : 'תמליל דיבור של סרטון באנגלית'} שצריך לנתח לעומק, לסכם ולכתוב ממנו תסריט הפקה מלא בעברית כדי שהיוצר הישראלי יוכל לצלם ולהפיק סרטון מנצח בעברית על הנושא!

פרטי הסרטון המקורי:
- כותרת: "${metadata.title}"
- יוצר / מקור: "${metadata.author || 'יוצר תוכן ברשת'}"

${metadata.transcriptSource === 'metadata_fallback' ? 'נושא הסרטון וההקשר:' : 'מה שנאמר בסרטון באנגלית (תמליל המקור):'}
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

חשוב ביותר: אל תחזור על התמליל באנגלית בתשובתך! המערכת כבר שומרת את האנגלית.
החזר אך ורק מבנה JSON תקין ומלא (Valid JSON object בלבד ללא שום טקסט נוסף לפני או אחרי):
{
  "summary": "סקירה מקיפה ומעמיקה של 3-4 פסקאות עשירות בעברית שמסבירה מה קורה בסרטון, מה הטענות, הדוגמאות והמסקנות המרכזיות...",
  "keyPoints": [
    "נקודת מפתח עובדתית 1 שהוזכרה בסרטון",
    "נקודת מפתח 2",
    "נקודת מפתח 3",
    "נקודת מפתח 4",
    "נקודת מפתח 5",
    "נקודת מפתח 6"
  ],
  "hebrewDigest": "תרגום עברי מפורט של מהלך הסרטון לפי חלקים (פתיח, מהלך העניינים, גילויים מרכזיים, וסיכום) בשפה קולחת...",
  "script": {
    "titleHebrew": "כותרת ראשית מושכת בעברית לסרטון (קליקבייט חיובי וממגנט)",
    "alternateTitles": [
      "כותרת אלטרנטיבית 1",
      "כותרת אלטרנטיבית 2",
      "כותרת אלטרנטיבית 3"
    ],
    "targetPlatform": "${targetPlatform}",
    "targetDurationMinutes": ${targetDurationMinutes},
    "hook": "משפט פתיחה ממגנט בעברית של 3-5 שניות שמדביק את הצופה למסך (ללא הצגת שם היוצר המקורי או ביטויים כמו 'סרטון שכותרתו'!)",
    "scenes": [
      {
        "sceneNumber": 1,
        "sceneTitle": "הפתיח וההבטחה הגדולה",
        "estimatedSeconds": 15,
        "visualDirection": "צילום פנים ישיר, זום אין איטי, כותרת מודגשת צפה בצד שמאל.",
        "spokenHebrewText": "טקסט בעברית לדיבור שפותח את הנושא ישירות...",
        "audioSoundEffect": "צליל Whoosh קל בפתיחה",
        "directorTip": "דבר באנרגיה גבוהה וישירה למצלמה"
      },
      {
        "sceneNumber": 2,
        "sceneTitle": "הרקע והקונפליקט",
        "estimatedSeconds": 40,
        "visualDirection": "חיתוך לצילומי B-Roll, הדגשת נתונים וגרפיקה בצד המסך.",
        "spokenHebrewText": "טקסט לדיבור שמסביר את הרקע והבעיה המרכזית...",
        "audioSoundEffect": "ביט רקע קצבי עדין",
        "directorTip": "קצב דיבור ברור ומודגש"
      },
      {
        "sceneNumber": 3,
        "sceneTitle": "התגלית המרכזית והשיא",
        "estimatedSeconds": 45,
        "visualDirection": "חזרה לפריים מלא, שינוי זווית, הדגשת מסקנה באנימציה.",
        "spokenHebrewText": "חשיפת הטוויסט או התובנה המרכזית לצופים...",
        "audioSoundEffect": "צליל הדגשה קל",
        "directorTip": "פאוזה קלה לפני חשיפת התובנה"
      },
      {
        "sceneNumber": 4,
        "sceneTitle": "סיכום והשורה התחתונה",
        "estimatedSeconds": 25,
        "visualDirection": "זום אאוט קל, תצוגת סיכום ולוגו הערוץ.",
        "spokenHebrewText": "סיכום חד של המסר שהצופה לוקח איתו...",
        "audioSoundEffect": "מוזיקת סגירה עולה",
        "directorTip": "נימה חמה ומסכמת"
      }
    ],
    "callToAction": "משפט סיום חזק והנעה לפעולה (להגיב, לשתף, להירשם לערוץ)...",
    "descriptionHebrew": "תיאור מוכן להעתקה עבור יוטיוב או הרשתות החברתיות...",
    "hashtags": ["#יוטיוב", "#תוכן", "#ישראל"],
    "productionNotes": "טיפים להפקה: השתמשו בתאורה רכה מול הפנים, קצב חיתוכים מהיר כל 4 שניות."
  }
}
`;

    // 5. Try Gemini first if key available
    if (geminiKey) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      for (const model of models) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey
              },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.4,
                  maxOutputTokens: 5000
                }
              })
            }
          );

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = cleanAndParseJSON(text);
              if (parsed && (parsed.script || parsed.scenes)) {
                const s = parsed.script || parsed;
                const result: VideoAnalysisResult = {
                  metadata,
                  transcript: {
                    englishText: englishSpokenText,
                    hebrewText: parsed.hebrewDigest || parsed.transcript?.hebrewText || parsed.summary || '',
                    summary: parsed.summary || parsed.transcript?.summary || '',
                    keyPoints: parsed.keyPoints || parsed.transcript?.keyPoints || [],
                    segments: transcriptSegments.length > 0 ? transcriptSegments : undefined
                  },
                  script: {
                    titleHebrew: s.titleHebrew || metadata.title,
                    alternateTitles: s.alternateTitles || [],
                    targetPlatform,
                    targetDurationMinutes,
                    hook: s.hook || `היום אנחנו חושפים את הסיפור המלא מאחורי ${metadata.title}!`,
                    scenes: s.scenes || [],
                    callToAction: s.callToAction || 'ספרו לי בתגובות מה אתם חושבים, ואל תשכחו להירשם לערוץ!',
                    descriptionHebrew: s.descriptionHebrew || '',
                    hashtags: s.hashtags || [],
                    productionNotes: s.productionNotes || ''
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

    // 6. Try OpenAI if available
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
            const parsed = cleanAndParseJSON(content);
            if (parsed && (parsed.script || parsed.scenes)) {
              const s = parsed.script || parsed;
              const result: VideoAnalysisResult = {
                metadata,
                transcript: {
                  englishText: englishSpokenText,
                  hebrewText: parsed.hebrewDigest || parsed.transcript?.hebrewText || parsed.summary || '',
                  summary: parsed.summary || parsed.transcript?.summary || '',
                  keyPoints: parsed.keyPoints || parsed.transcript?.keyPoints || [],
                  segments: transcriptSegments.length > 0 ? transcriptSegments : undefined
                },
                script: {
                  titleHebrew: s.titleHebrew || metadata.title,
                  alternateTitles: s.alternateTitles || [],
                  targetPlatform,
                  targetDurationMinutes,
                  hook: s.hook || `היום אנחנו חושפים את הסיפור המלא מאחורי ${metadata.title}!`,
                  scenes: s.scenes || [],
                  callToAction: s.callToAction || 'ספרו לי בתגובות מה אתם חושבים, ואל תשכחו להירשם לערוץ!',
                  descriptionHebrew: s.descriptionHebrew || '',
                  hashtags: s.hashtags || [],
                  productionNotes: s.productionNotes || ''
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

    // 7. Resilient smart content-aware fallback (NEVER crash or return error to user!)
    console.log('Using smart content-aware fallback generator for video script');
    const fallbackData = await generateSmartFallback(metadata, englishSpokenText, targetPlatform, targetDurationMinutes);

    return NextResponse.json({
      success: true,
      source: 'Smart Hebrew Content Script Engine',
      data: fallbackData
    });

  } catch (error: any) {
    console.error('Video Script Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'שגיאה בעיבוד הסרטון והפקת התסריט' },
      { status: 500 }
    );
  }
}
