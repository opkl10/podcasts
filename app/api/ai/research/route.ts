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
      const webInfo = await fetchMultiSourceWebResearch(querySubject);

      const factPrompt = `
אתה היסטוריון ומבקר קולנוע בכיר עם ידע אנציקלופדי מדויק ומעמיק ביותר על הסרט: "${querySubject}".
להלן מידע עובדתי אמיתי שנאסף מהרשת על הסרט:
- תקציר ועלילה: ${webInfo.fullPlot}
- שחקנים ודמויות: ${webInfo.cast.join(', ')}
- הפקה ובימוי: ${webInfo.productionFacts.join(' ')}
- ביקורות, הכנסות וקופות: ${webInfo.criticalReception}

עליך לייצר בין 15 ל-20 כרטיסיות מידע ועובדות עמוקות, מרתקות, ספציפיות ומדויקות ביותר על "${querySubject}".

קריטי - איסור מוחלט על ניסוחים כלליים, גנריים או מעורפלים!
חוקי דיוק עובדתי מחייבים לכל אחת מ-5 הקטגוריות (לפחות 3 כרטיסיות מכל קטגוריה):

1. "plot" (עלילה):
   - ציין במפורש את שמות הדמויות, מיקומי ההתרחשות, נקודת המפנה המרכזית, סצנת הפתיחה/הסיום ומשמעות הסרט.
   - אסור לכתוב משפטים כלליים כמו "העלילה עוקבת אחר מאבק פנימי". חובה לפרט מי הדמות, מה הקונפליקט ומה קורה בסצנות מפתח!

2. "cast" (שחקנים):
   - ציין שמות שחקנים מלאים ושמות דמויות מדויקים (למשל: לא "השחקן הראשי", אלא שם השחקן ושם הדמות).
   - פרט אודישנים אמיתיים, שחקנים אחרים שנשקלו לתפקיד, הכנות פיזיות או נפשיות קיצוניות, ואלתורים אמיתיים על הסט.

3. "production_crew" (צוותי הפקה + בימוי ויתר התפקידים):
   - ציין שמות אמיתיים של הבמאי, התסריטאי, הצלם הראשי (Cinematographer), המלחין (Composer), ועורכי הסאונד והאפקטים.
   - פרט ציוד צילום אמיתי (למשל IMAX 70mm, מצלמות 35mm), לוקיישנים אמיתיים (שמות ערים/מדינות), תקציב הפקה ($), ושיטות צילום מעשיות.

4. "reviews" (ביקורות כלליות):
   - ציין נתונים מדויקים: ציון IMDb מדויק, אחוז Rotten Tomatoes אמיתי, דירוג ב-Letterboxd או Metacritic.
   - ציין הכנסות עולמיות בקופות במספרים מדויקים ($), ורשימת פרסי אוסקר/פסטיבלים שבהם הסרט זכה או היה מועמד.

5. "behind_the_scenes" (סיפורי מאחורי הקלעים):
   - ספק אנקדוטות אמיתיות שקרו על הסט: פציעות, תקלות צילום שהפכו לחלק מהסרט, סודות צילום ואיסטר אגז חבויים.

החזר אך ורק JSON תקין במבנה הבא:
{
  "movieTitle": "${querySubject}",
  "facts": [
    {
      "category": "plot",
      "fact": "ניסוח מלא, ספציפי עם שמות ופרטים מדויקים.",
      "source": "Wikipedia",
      "ratingScore": "8.8/10",
      "year": "2010",
      "tags": ["שם דמות", "פרט ספציפי"]
    }
  ]
}
`;

      const effectiveKey = apiKey || process.env.GEMINI_API_KEY || '';
      if (effectiveKey && effectiveKey.trim().startsWith('AIza')) {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        for (const model of models) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey.trim()}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: factPrompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.5
                }
              })
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                if (parsed.facts && parsed.facts.length > 0) {
                  return NextResponse.json({
                    success: true,
                    source: `Gemini AI Grounded (${model})`,
                    data: parsed
                  });
                }
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
אתה עורך תוכן ראשי לפודקאסט קולנוע ותרבות. עליך לייצר ראשי פרקים מובנים, מרתקים ומדויקים עבור: "${querySubject}".
${webInfo.found ? `מידע עובדתי מהרשת: ${webInfo.fullPlot} ${webInfo.productionFacts.join(' ')}` : ''}
${userReview?.trim() ? `ביקורת המגיש: "${userReview.trim()}"` : ''}
${guestName ? `אורח: ${guestName} (${guestRole || ''})` : ''}

מבנה פרק הפודקאסט המבוקש (חלק את ראשי הפרקים לפי 5 הצירים הבאים):
1. 🎬 עלילה ותמות (ניתוח הנרטיב, קונפליקט מרכזי, סצנות מפתח, רבדים פילוסופיים)
2. 🎭 שחקנים ודמויות (ליהוקים, הופעות בולטות, דינמיקה, אלתורים ואתגרי משחק)
3. 🎥 צוותי הפקה + בימוי ויתר התפקידים (חזון הבמאי, צילום, פסקול ומוזיקה, עיצוב ועריכה)
4. ⭐ ביקורות כלליות וציונים (תגובת הקהל והמבקרים, דירוגים, הישגים בקופות ובפסטיבלים)
5. 🤫 סיפורי מאחורי הקלעים (אנקדוטות מהסט, סודות הפקה, תקלות שהפכו לקאלט)

חוקי ניסוח קריטיים:
1. משפטים מלאים ושלמים בלבד! אל תקטע משפטים באמצע ואל תשתמש בשלוש נקודות (...).
2. שדה "notes": משפט אחד מלא ומדויק.
3. שדה "talkingPoints": 3-4 נקודות מפתח שלמות, עמוקות וחדות.
4. שדה "questions": 2-3 שאלות עומק חדות ומעוררות דיון.

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
