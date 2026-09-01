import { NextRequest, NextResponse } from 'next/server';
import { SubtitleItem, TopicItem, HighlightClip } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      subtitles = [],
      topics = [],
      episodeTitle = 'פרק פודקאסט',
      description = '',
      apiKey,
      targetMinSeconds = 20,
      targetMaxSeconds = 60
    }: {
      subtitles: SubtitleItem[];
      topics: TopicItem[];
      episodeTitle: string;
      description?: string;
      apiKey?: string;
      targetMinSeconds?: number;
      targetMaxSeconds?: number;
    } = body;

    // Filter valid subtitles if available
    const validSubs = (subtitles || [])
      .filter(s => s && typeof s.startTime === 'number' && typeof s.endTime === 'number' && s.text?.trim())
      .sort((a, b) => a.startTime - b.startTime);

    const hasValidSubs = validSubs.length > 0;
    const totalDuration = hasValidSubs ? validSubs[validSubs.length - 1].endTime : (topics.length * 90 || 180);

    const effectiveKey = apiKey || process.env.GEMINI_API_KEY || '';

    // 1. Try Gemini AI
    if (effectiveKey && effectiveKey.trim().startsWith('AIza')) {
      try {
        let contentContext = '';
        if (hasValidSubs) {
          const transcriptFormatted = validSubs
            .map((s, idx) => `[#${idx + 1} | ${s.startTime.toFixed(1)}s - ${s.endTime.toFixed(1)}s]: ${s.text}`)
            .join('\n');
          contentContext = `תמליל הכתוביות עם חותמות זמן מדויקות:\n${transcriptFormatted.slice(0, 12000)}`;
        } else {
          const topicsFormatted = (topics || [])
            .map((t, idx) => `נושא ${idx + 1}: ${t.title}\nנקודות שיחה: ${t.talkingPoints?.join(', ') || ''}\nשאלות: ${t.questions?.join(', ') || ''}`)
            .join('\n\n');
          contentContext = `נושאי השיחה ותוכן הפרק:\n${description ? `תיאור: ${description}\n` : ''}${topicsFormatted || episodeTitle}`;
        }

        const prompt = `
אתה עורך וידאו ומומחה אסטרטגיית תוכן ויראלי לסושיאל מדיה (TikTok, Instagram Reels, YouTube Shorts).
עליך לנתח את תוכן הפרק "${episodeTitle}" ולזהות בין 4 ל-7 הקטעים המעניינים, המותחים, המפתיעים והוויראליים ביותר עבור סרטונים קצרים.

כללי חיתוך וזיהוי:
1. משך כל קליפ: בין ${targetMinSeconds} ל-${targetMaxSeconds} שניות!
2. זמן התחלה (startTime) וזמן סיום (endTime): ${hasValidSubs ? 'התאם לחותמות הזמן של הכתוביות' : 'הגדר טווחי זמן הגיוניים ברצף הפרק'}.
3. הוק פתיחה חזק: משפט פתיחה, שאלה חדה, או הצהרה מפתיעה שגורמת לצופה להישאר (0-3 שניות ראשונות).
4. רצף שלם: רעיון, פאנץ', ויכוח, או סיפור מלא.

${contentContext}

החזר אך ורק JSON תקין במבנה הבא:
{
  "clips": [
    {
      "title": "כותרת הוק קצרה ומושכת לרילס (עד 6 מילים)",
      "headline": "כותרת עליונה משנית מסקרנת",
      "startTime": 12.0,
      "endTime": 45.0,
      "viralScore": 95,
      "category": "debate",
      "reason": "הסבר מדויק למה הקטע יתפוס וייצר שיתופים ותגובות ברשת",
      "hookText": "משפט הפתיחה שפותח את הקליפ",
      "summary": "תמצית תוכן הקטע במשפט אחד",
      "tags": ["קולנוע", "Reels"]
    }
  ]
}

קטגוריות עבור "category": "debate", "punchline", "insight", "behind_the_scenes", "emotional", "quote", "highlight".
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
                  const sTime = Math.max(0, Number(c.startTime) || (i * 45));
                  let eTime = Math.max(sTime + 10, Number(c.endTime) || (sTime + 40));
                  if (eTime - sTime > targetMaxSeconds) eTime = sTime + targetMaxSeconds;
                  if (eTime - sTime < targetMinSeconds) eTime = sTime + targetMinSeconds;

                  return {
                    id: `clip_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
                    title: c.title || `קליפ נבחר #${i + 1}`,
                    headline: c.headline || `רגע שיא מתוך ${episodeTitle}`,
                    startTime: Math.round(sTime * 10) / 10,
                    endTime: Math.round(eTime * 10) / 10,
                    duration: Math.round((eTime - sTime) * 10) / 10,
                    viralScore: Math.min(99, Math.max(72, Number(c.viralScore) || 92)),
                    category: c.category || 'highlight',
                    reason: c.reason || 'רגע שיא מעניין ומסקרן המתאים במיוחד לסרטונים קצרים',
                    summary: c.summary || c.title || '',
                    suggestedAspectRatio: '9:16',
                    hookText: c.hookText || c.title || '',
                    tags: Array.isArray(c.tags) ? c.tags : ['Reels', 'Shorts']
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
        console.error('Gemini clip detection error, falling back to algorithmic detector:', aiErr);
      }
    }

    // 2. High-Accuracy Algorithmic Fallback
    const detectedClips = hasValidSubs
      ? algorithmicClipDetectorFromSubs(validSubs, episodeTitle, targetMinSeconds, targetMaxSeconds)
      : algorithmicClipDetectorFromTopics(topics, episodeTitle, targetMinSeconds, targetMaxSeconds);

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
 * Algorithmic Highlight Extractor From Subtitles
 */
function algorithmicClipDetectorFromSubs(
  subtitles: SubtitleItem[], 
  episodeTitle: string, 
  minSec: number = 25, 
  maxSec: number = 55
): HighlightClip[] {
  const clips: HighlightClip[] = [];
  const totalSubs = subtitles.length;
  if (totalSubs === 0) return [];

  const VIRAL_TRIGGER_WORDS = [
    'מטורף', 'סוד', 'אף פעם', 'הכי טוב', 'הכי גרוע', 'שערורייה', 'תקלה', 'ספוילר',
    'חייב לראות', 'לא ייאמן', 'אמת', 'למה', 'איך', 'במאי', 'שחקן', 'סצנה', 'סיום',
    'כסף', 'מיליון', 'אוסקר', 'ציון', 'ביקורת', 'הפקה', 'בעיה', 'הלם', 'גאוני'
  ];

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

      let score = 75;
      let category: HighlightClip['category'] = 'highlight';

      if (combinedText.includes('?')) {
        score += 8;
        category = 'debate';
      }
      if (combinedText.includes('!')) {
        score += 5;
      }

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

    windowStartIdx = Math.max(windowStartIdx + 1, windowEndIdx - 1);
  }

  return clips.sort((a, b) => b.viralScore - a.viralScore).slice(0, 6);
}

/**
 * Algorithmic Highlight Extractor From Topics (When Subtitles Not Yet Generated)
 */
function algorithmicClipDetectorFromTopics(
  topics: TopicItem[],
  episodeTitle: string,
  minSec: number = 30,
  maxSec: number = 55
): HighlightClip[] {
  const clips: HighlightClip[] = [];
  const safeTopics = topics && topics.length > 0 ? topics : [
    { title: `פתיח ונושא מרכזי: ${episodeTitle}`, talkingPoints: ['השאלות הגדולות והציפיות של הקהל'], questions: ['מה הדבר המפתיע ביותר ביצירה?'] },
    { title: 'מאחורי הקלעים וסודות הפקה', talkingPoints: ['איך הצוות התמודד עם האתגרים על הסט'], questions: ['איזו סצנה הייתה הקשה ביותר לצילום?'] },
    { title: 'דיבייט סוער וניתוח הסיום', talkingPoints: ['הפרשנויות השונות של המבקרים'], questions: ['האם הסיום מוצדק בעיניכם?'] }
  ];

  let curTime = 0;
  safeTopics.forEach((t, i) => {
    const questions = t.questions || [];
    const talkingPoints = t.talkingPoints || [];
    const hook = questions[0] || talkingPoints[0] || t.title;
    const duration = 45;

    let category: HighlightClip['category'] = 'highlight';
    if (t.title.includes('מאחורי הקלעים') || t.title.includes('הפקה')) category = 'behind_the_scenes';
    else if (t.title.includes('דיבייט') || t.title.includes('ביקורת')) category = 'debate';
    else if (t.title.includes('דמויות') || t.title.includes('שחקנים')) category = 'insight';
    else if (i === 0) category = 'punchline';

    clips.push({
      id: `clip_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
      title: hook.length > 45 ? `${hook.slice(0, 42)}...` : hook,
      headline: t.title,
      startTime: curTime,
      endTime: curTime + duration,
      duration,
      viralScore: 90 + (i % 8),
      category,
      reason: 'נקודת עניין מרכזית מתוך נושאי הפרק המתאימה לחיתוך סרטון קצר',
      summary: `${t.title} — ${talkingPoints.slice(0, 2).join('. ')}`,
      suggestedAspectRatio: '9:16',
      hookText: hook,
      tags: [category, 'Shorts', 'Reels']
    });

    curTime += duration + 10;
  });

  return clips.slice(0, 5);
}
