import { NextRequest, NextResponse } from 'next/server';
import { SubtitleItem, TopicItem, HighlightClip } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      subtitles = [],
      topics = [],
      episodeTitle = 'פרק פודקאסט',
      apiKey,
      targetMinSeconds = 20,
      targetMaxSeconds = 60
    }: {
      subtitles: SubtitleItem[];
      topics: TopicItem[];
      episodeTitle: string;
      apiKey?: string;
      targetMinSeconds?: number;
      targetMaxSeconds?: number;
    } = body;

    if (!subtitles || subtitles.length === 0) {
      return NextResponse.json({ 
        error: 'לא נמצאו כתוביות או תמליל עבור הפרק. יש ליצור או לתמלל כתוביות תחילה.' 
      }, { status: 400 });
    }

    // Sort subtitles by time
    const validSubs = subtitles
      .filter(s => s && typeof s.startTime === 'number' && typeof s.endTime === 'number' && s.text?.trim())
      .sort((a, b) => a.startTime - b.startTime);

    if (validSubs.length === 0) {
      return NextResponse.json({
        error: 'אין כתוביות עם חותמות זמן תקינות עבור הפרק.'
      }, { status: 400 });
    }

    const totalDuration = validSubs[validSubs.length - 1].endTime;

    // 1. Try Gemini AI if key available
    const effectiveKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (effectiveKey && effectiveKey.trim().startsWith('AIza')) {
      try {
        const transcriptFormatted = validSubs
          .map((s, idx) => `[#${idx + 1} | ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s]: ${s.text}`)
          .join('\n');

        const topicsContext = topics.length > 0 
          ? `\nנושאי הפרק:\n${topics.map(t => `- ${t.title}: ${t.talkingPoints?.join(', ') || ''}`).join('\n')}`
          : '';

        const prompt = `
אתה עורך וידאו ומומחה אסטרטגיית תוכן ויראלי לסושיאל מדיה (TikTok, Instagram Reels, YouTube Shorts).
עליך לנתח את תמליל הכתוביות של הפרק "${episodeTitle}" ולזהות בין 4 ל-7 הקטעים המעניינים, המותחים, המפתיעים והוויראליים ביותר.

כללי חיתוך וזיהוי קריטיים:
1. משך כל קליפ: בין ${targetMinSeconds} ל-${targetMaxSeconds} שניות בלבד!
2. זמן התחלה (startTime) וזמן סיום (endTime): חייבים להתאים בדיוק לחותמות הזמן בשניות של כתוביות קיימות מהרשימה!
3. הוק פתיחה חזק: הקליפ חייב להתחיל עם משפט פתיחה חזק, שאלה מסקרנת, או הצהרה מפתיעה שגורמת לצופה להישאר (0-3 שניות ראשונות).
4. רצף שלם: הקטע חייב להכיל רעיון, פאנץ', ויכוח, או סיפור מלא בעל התחלה וסוף ברורים (ללא קטיעה באמצע משפט).

${topicsContext}

תמליל הכתוביות עם חותמות זמן:
${transcriptFormatted.slice(0, 12000)}

החזר אך ורק JSON תקין במבנה הבא:
{
  "clips": [
    {
      "title": "כותרת הוק קצרה ומושכת לרילס (עד 6 מילים)",
      "headline": "כותרת עליונה משנית מסקרנת",
      "startTime": 12.5,
      "endTime": 48.0,
      "viralScore": 95,
      "category": "debate",
      "reason": "הסבר מדויק למה הקטע יתפוס וייצר שיתופים ותגובות ברשת",
      "hookText": "משפט הפתיחה שפותח את הקליפ",
      "summary": "תמצית תוכן הקטע במשפט אחד",
      "tags": ["קולנוע", "רידלי סקוט"]
    }
  ]
}

הקטגוריות האפשריות עבור "category":
- "debate" (ויכוח סוער / חילוקי דעות)
- "punchline" (פאנץ' / משפט מחץ)
- "insight" (תובנה עמוקה / גילוי מפתיע)
- "behind_the_scenes" (סיפור מאחורי הקלעים / סוד הפקה)
- "emotional" (רגע מרגש / דרמטי)
- "quote" (ציטוט בלתי נשכח)
- "highlight" (רגע שיא מרכזי)
`;

        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        for (const model of models) {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.6
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
              if (parsed.clips && Array.isArray(parsed.clips) && parsed.clips.length > 0) {
                const formattedClips: HighlightClip[] = parsed.clips.map((c: any, i: number) => {
                  const sTime = Math.max(0, Math.min(totalDuration, Number(c.startTime) || 0));
                  let eTime = Math.max(sTime + 5, Math.min(totalDuration, Number(c.endTime) || sTime + 35));
                  if (eTime - sTime > targetMaxSeconds) eTime = sTime + targetMaxSeconds;
                  if (eTime - sTime < targetMinSeconds && sTime + targetMinSeconds <= totalDuration) {
                    eTime = sTime + targetMinSeconds;
                  }

                  return {
                    id: `clip_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                    title: c.title || `קליפ נבחר #${i + 1}`,
                    headline: c.headline || 'רגע שיא מתוך הפרק',
                    startTime: Math.round(sTime * 10) / 10,
                    endTime: Math.round(eTime * 10) / 10,
                    duration: Math.round((eTime - sTime) * 10) / 10,
                    viralScore: Math.min(100, Math.max(70, Number(c.viralScore) || 90)),
                    category: c.category || 'highlight',
                    reason: c.reason || 'רגע שיא מעניין ומסקרן המתאים במיוחד לסרטונים קצרים',
                    summary: c.summary || c.title || '',
                    suggestedAspectRatio: '9:16',
                    hookText: c.hookText || c.title || '',
                    tags: Array.isArray(c.tags) ? c.tags : []
                  };
                });

                return NextResponse.json({
                  success: true,
                  source: `Gemini AI Viral Hunter (${model})`,
                  clips: formattedClips
                });
              }
            }
          }
        }
      } catch (aiErr) {
        console.error('Gemini clip detection error, falling back to algorithmic detection:', aiErr);
      }
    }

    // 2. High-Accuracy Algorithmic Fallback
    const detectedClips = algorithmicClipDetector(validSubs, episodeTitle, targetMinSeconds, targetMaxSeconds);

    return NextResponse.json({
      success: true,
      source: 'Algorithmic Smart Viral Detector',
      clips: detectedClips
    });

  } catch (error: any) {
    console.error('Clip detection error:', error);
    return NextResponse.json({ 
      error: error.message || 'שגיאה בזיהוי קטעים ויראליים' 
    }, { status: 500 });
  }
}

/**
 * Smart Algorithmic Highlight & Viral Clip Extractor
 */
function algorithmicClipDetector(
  subtitles: SubtitleItem[], 
  episodeTitle: string, 
  minSec: number = 25, 
  maxSec: number = 55
): HighlightClip[] {
  const clips: HighlightClip[] = [];
  const totalSubs = subtitles.length;
  if (totalSubs === 0) return [];

  // Keywords that trigger viral interest in Hebrew
  const VIRAL_TRIGGER_WORDS = [
    'מטורף', 'סוד', 'אף פעם', 'הכי טוב', 'הכי גרוע', 'שערורייה', 'תקלה', 'ספוילר',
    'חייב לראות', 'לא ייאמן', 'אמת', 'למה', 'איך', 'במאי', 'שחקן', 'סצנה', 'סיום',
    'כסף', 'מיליון', 'אוסקר', 'ציון', 'ביקורת', 'הפקה', 'בעיה', 'הלם', 'גאוני'
  ];

  // Group subtitles into candidate windows of 25-50 seconds
  let windowStartIdx = 0;

  while (windowStartIdx < totalSubs) {
    const startSub = subtitles[windowStartIdx];
    const targetEndSec = startSub.startTime + ((minSec + maxSec) / 2);

    let windowEndIdx = windowStartIdx;
    while (
      windowEndIdx < totalSubs - 1 &&
      subtitles[windowEndIdx].endTime < targetEndSec
    ) {
      windowEndIdx++;
    }

    const endSub = subtitles[windowEndIdx];
    const duration = endSub.endTime - startSub.startTime;

    if (duration >= minSec - 5 && duration <= maxSec + 10) {
      const windowSubs = subtitles.slice(windowStartIdx, windowEndIdx + 1);
      const combinedText = windowSubs.map(s => s.text).join(' ');

      // Score this window
      let score = 75;
      let category: HighlightClip['category'] = 'highlight';

      // Check question count
      if (combinedText.includes('?')) {
        score += 8;
        category = 'debate';
      }

      // Check exclamation count
      if (combinedText.includes('!')) {
        score += 5;
      }

      // Check trigger words
      let matchedTriggers = 0;
      for (const word of VIRAL_TRIGGER_WORDS) {
        if (combinedText.includes(word)) {
          matchedTriggers++;
          score += 4;
        }
      }

      if (matchedTriggers >= 2) {
        if (combinedText.includes('סוד') || combinedText.includes('מאחורי הקלעים') || combinedText.includes('הפקה')) {
          category = 'behind_the_scenes';
        } else if (combinedText.includes('מטורף') || combinedText.includes('לא ייאמן')) {
          category = 'punchline';
        } else {
          category = 'insight';
        }
      }

      // First sentence as hook
      const firstSentence = windowSubs[0]?.text?.trim() || episodeTitle;
      const cleanTitle = firstSentence.length > 40 ? `${firstSentence.slice(0, 38)}...` : firstSentence;

      clips.push({
        id: `clip_${Date.now()}_${clips.length}_${Math.random().toString(36).substr(2, 4)}`,
        title: cleanTitle,
        headline: `קטע נבחר מתוך ${episodeTitle}`,
        startTime: Math.round(startSub.startTime * 10) / 10,
        endTime: Math.round(endSub.endTime * 10) / 10,
        duration: Math.round(duration * 10) / 10,
        viralScore: Math.min(99, Math.max(72, score)),
        category,
        reason: matchedTriggers > 0 
          ? `מכיל אלמנטים מסקרנים ומילות מפתח חזקות (${matchedTriggers} מילות מפתח) שמושכות תשומת לב בסושיאל`
          : 'קצב דיבור רציף ומבנה שאלה ותשובה מושלם לסרטון קצר',
        summary: combinedText.slice(0, 100) + (combinedText.length > 100 ? '...' : ''),
        suggestedAspectRatio: '9:16',
        hookText: firstSentence,
        tags: [category, 'Reels', 'Shorts']
      });
    }

    // Step forward by 4-6 subtitles to find next distinct moment
    windowStartIdx = Math.max(windowStartIdx + 1, windowEndIdx - 1);
  }

  // Sort by viralScore descending and return top 6
  return clips
    .sort((a, b) => b.viralScore - a.viralScore)
    .slice(0, 6);
}
