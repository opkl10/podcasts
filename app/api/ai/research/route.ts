import { NextRequest, NextResponse } from 'next/server';
import { fetchMultiSourceWebResearch, extractCompleteSentences } from '@/lib/webResearch';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      topic, 
      episodeTitle, 
      guestName, 
      guestRole, 
      targetDurationMinutes = 45, 
      tone = 'deep', 
      apiKey, 
      mode = 'full_episode', 
      singleTopicTitle,
      userReview,
      category = 'movie_tv'
    } = body;

    const querySubject = (singleTopicTitle || topic || episodeTitle || '').trim();

    if (!querySubject) {
      return NextResponse.json({ error: 'נושא המחקר חסר' }, { status: 400 });
    }

    // 1. Movie Facts Generation Mode
    if (mode === 'movie_facts') {
      const factPrompt = `
אתה מומחה לקולנוע וטריוויה קולנועית עמוקה. עבור הסרט: "${querySubject}", חלץ בדיוק 12 עד 16 עובדות קולנוע מרתקות, מפורטות, מעמיקות ומאומתות מ-IMDb, ויקיפדיה, Rotten Tomatoes, Letterboxd וראיונות.

קטגוריות מבוקשות (שלב לפחות 2 מכל סוג):
- "behind_the_scenes": סודות הפקה ואפקטים מעשיים (צילומים, אתגרים טכניים, פעלולים)
- "cast_secret": ליהוק ושחקנים (הכנות לתפקיד, אודישנים, אלתורים מפורסמים)
- "director_vision": חזון הבמאי ותסריט (כתיבה, השראות, סצינות שנחתכו)
- "easter_egg": איסטר אגז, רמזים חבויים ומשמעויות נסתרות בעלילה
- "critical_reception": ציוני IMDb, Rotten Tomatoes, הכנסות ושיאי קופות, פרסי אוסקר
- "trivia": טריוויה מדהימה ופרטים נדירים על הפסקול וההפקה

החזר אך ורק JSON תקין במבנה הבא:
{
  "movieTitle": "${querySubject}",
  "facts": [
    {
      "category": "behind_the_scenes",
      "fact": "ניסוח מלא ומעמיק של העובדה.",
      "source": "IMDb",
      "ratingScore": "8.8/10",
      "year": "2010",
      "tags": ["הפקה", "נולאן"]
    }
  ]
}
`;

      if (apiKey && apiKey.trim().startsWith('AIza')) {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        for (const model of models) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: factPrompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.7
                }
              })
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                return NextResponse.json({
                  success: true,
                  source: `Gemini AI (${model})`,
                  data: parsed
                });
              }
            }
          } catch (e) {}
        }
      }
    }

    // 2. Live Multi-Source Research
    const webInfo = await fetchMultiSourceWebResearch(querySubject);

    // 3. Direct Gemini Call if API Key provided
    if (apiKey && apiKey.trim().startsWith('AIza')) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

      const prompt = `
אתה עורך תוכן ראשי לפודקאסט. עליך לייצר ראשי פרקים מובנים ומדויקים עבור: "${querySubject}".
${webInfo.found ? `מידע עובדתי מהרשת: ${webInfo.fullPlot} ${webInfo.productionFacts.join(' ')}` : ''}
${userReview?.trim() ? `ביקורת המגיש: "${userReview.trim()}"` : ''}
${guestName ? `אורח: ${guestName} (${guestRole || ''})` : ''}

חוקי ניסוח קריטיים:
1. משפטים מלאים ושלמים בלבד! אל תקטע משפטים באמצע ואל תשתמש בשלוש נקודות (...).
2. שדה "notes": משפט אחד מלא ומדויק.
3. שדה "talkingPoints": 3-4 נקודות מפתח שלמות וקצרות.
4. שדה "questions": 2-3 שאלות עומק חדות.

החזר JSON תקין בלבד:
{
  "executiveSummary": "תקציר מנהלים מלא",
  "suggestedTitle": "כותרת לפרק",
  "topics": [
    {
      "title": "שם הנושא",
      "estimatedMinutes": 10,
      "notes": "משפט שלם המסביר את מהות הנושא.",
      "talkingPoints": ["נקודה 1.", "נקודה 2.", "נקודה 3."],
      "questions": ["שאלה 1?", "שאלה 2?"],
      "resources": []
    }
  ]
}
`;

      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
              return NextResponse.json({
                success: true,
                source: `Gemini AI (${model})`,
                webGrounding: webInfo.found,
                data: parsed
              });
            }
          }
        } catch (e) {}
      }
    }

    // 3. Deterministic Full-Sentence Fallback
    const realTitle = webInfo.title || querySubject;
    const cleanReviewSentences = userReview?.trim() ? extractCompleteSentences(userReview, 3) : [];

    const topics = [
      {
        title: `פתיח, חזון היוצרים וקו העלילה: ${realTitle}`,
        estimatedMinutes: Math.max(5, Math.round(targetDurationMinutes * 0.2)),
        notes: `סקירת החזון הקולנועי של היוצרים והקונספט המרכזי שמוביל את העלילה.`,
        talkingPoints: [
          `ההשפעה התרבותית והחשיבות של "${realTitle}" בעולם הקולנוע והטלוויזיה.`,
          webInfo.cast.length > 0 ? `צוות השחקנים המוביל: ${webInfo.cast.slice(0, 3).join(', ')}.` : `הליהוק והתאמת השחקנים הראשיים.`,
          webInfo.fullPlot ? extractCompleteSentences(webInfo.fullPlot, 1)[0] || `נקודת הפתיחה של הסיפור והאתגר המרכזי.` : `נקודת הפתיחה של הסיפור והאתגר המרכזי.`
        ],
        questions: [
          `איזו סצנה ביצירה מגדירה בצורה המדויקת ביותר את הטון והאווירה?`,
          `האם הליהוק של הדמויות הראשיות ענה על הציפיות שלכם?`
        ],
        resources: webInfo.sourceUrl ? [{ title: `ערך: ${realTitle}`, url: webInfo.sourceUrl }] : []
      },
      {
        title: `ניתוח דמויות, קונפליקטים ותמות מרכזיות`,
        estimatedMinutes: Math.max(10, Math.round(targetDurationMinutes * 0.35)),
        notes: `צלילת עומק לתמות הפילוסופיות ולמניעים הפסיכולוגיים של הדמויות.`,
        talkingPoints: [
          `המסע הפנימי של הדמות הראשית והמחיר האישי שהיא משלמת לאורך הסיפור.`,
          `הקונפליקט המוסרי שמוצג ביצירה והשאלות האנושיות שהיא מעלה.`,
          `הסמליות והרמזים המקדימים ששזורים בעלילה לקראת רגעי השיא.`
        ],
        questions: [
          `מהו לדעתכם הרגע הרגשי החזק ביותר שמגדיר את היצירה?`,
          `האם הבחירות המוסריות של הגיבור מוצדקות בעיניכם בסיום היצירה?`
        ],
        resources: []
      },
      {
        title: `מאחורי הקלעים, אתגרי הפקה ושפת הבימוי`,
        estimatedMinutes: Math.max(5, Math.round(targetDurationMinutes * 0.2)),
        notes: `סקירת החלטות הבימוי, אתגרי הצילומים והתפקיד של העיצוב הקולי.`,
        talkingPoints: [
          webInfo.productionFacts.length > 0 ? extractCompleteSentences(webInfo.productionFacts.join(' '), 1)[0] || `אתגרי ההפקה והעבודה המורכבת של הצוות על סט הצילומים.` : `אתגרי ההפקה והעבודה המורכבת על הסט.`,
          `השפה הויזואלית, זוויות הצילום והתאורה שנבחרו לבניית המתח.`,
          `הפסקול והעיצוב הקולי והאופן שבו הם מעצימים את חוויית הצפייה.`
        ],
        questions: [
          `כיצד שפת הצילום והעיצוב הויזואלי תרמו לתחושת ההזדהות של הצופה?`,
          `איזה פרט מאחורי הקלעים הפתיע אתכם ביותר במהלך המחקר?`
        ],
        resources: []
      },
      {
        title: userReview ? `דיבייט סביב ביקורת המגיש, סיום וציון` : `קבלת היצירה בציבור, סיום והמלצה סופית`,
        estimatedMinutes: Math.max(5, Math.round(targetDurationMinutes * 0.25)),
        notes: userReview ? `עימות עמדת המגיש מול טיעוני נגד של מבקרים ומעריצים.` : `שקלול תגובות המבקרים, ניתוח הסיום והציון המסכם.`,
        talkingPoints: cleanReviewSentences.length > 0 ? [
          `טענת המפתח של המגיש: ${cleanReviewSentences[0]}`,
          cleanReviewSentences[1] ? `דגש מרכזי נוסף מתוך הביקורת: ${cleanReviewSentences[1]}` : `הנימוקים המרכזיים שמחזקים את נקודת המבט של המגיש.`,
          `טיעוני נגד אפשריים מצד מעריצים הרואים את היצירה באור חיובי יותר.`,
          `השורה התחתונה, ההמלצה לקהל והציון המסכם מתוך עשר.`
        ] : [
          `כיצד התקבלה היצירה על ידי קהל הצופים ומבקרי הקולנוע בעולם.`,
          `הוויכוחים והפרשנויות השונות שנוצרו סביב סצנת הסיום.`,
          `פסק הדין הסופי: למי היצירה מומלצת והציון המסכם מתוך עשר.`
        ],
        questions: [
          userReview ? `איך הייתם משיבים למי שטוען שהסרט השיג בדיוק את מטרתו למרות הביקורת?` : `איך אתם מפרשים את המסר הסופי שהבמאי בחר להשאיר עם הצופים?`,
          `איזה ציון מגיע ליצירה זו בעיניכם, ולמי הייתם ממליצים לצפות בה?`
        ],
        resources: []
      }
    ];

    return NextResponse.json({
      success: true,
      source: webInfo.source,
      webGrounding: webInfo.found,
      data: {
        executiveSummary: `מחקר מקיף על "${realTitle}": מערך ראשי פרקים מובנה ומלא הכולל נתונים עובדתיים מהאינטרנט, ניתוח דמויות ושאלות עומק.`,
        suggestedTitle: `ניתוח מעמיק: "${realTitle}"`,
        topics
      }
    });

  } catch (error: any) {
    console.error('AI Research route error:', error);
    return NextResponse.json({ error: error.message || 'שגיאה בעיבוד המחקר' }, { status: 500 });
  }
}
