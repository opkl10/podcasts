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
      category = 'movie_tv',
      specificFocus,
      focusNotes,
      userNotes
    } = body;

    const querySubject = (singleTopicTitle || topic || episodeTitle || '').trim();
    const effectiveFocus = (specificFocus || focusNotes || userNotes || '').trim();
    const effectiveKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!querySubject) {
      return NextResponse.json({ error: 'נושא המחקר חסר' }, { status: 400 });
    }

    // 1. Movie Facts Generation Mode
    if (mode === 'movie_facts') {
      const webInfo = await fetchMultiSourceWebResearch(querySubject, effectiveFocus);

      const factPrompt = `
אתה היסטוריון ומבקר קולנוע בכיר עם ידע אנציקלופדי מדויק ומעמיק ביותר על הסרט: "${querySubject}".
${effectiveFocus ? `
הנחיות, דגשים ובקשות מיוחדות מהמשתמש למחקר:
"${effectiveFocus}"
חובה עליך להתמקד ולייצר כרטיסיות עובדות מעמיקות סביב דגשים אלו (לדוגמה: פסקול, שחקנים, הפקה, בימוי, תקציב או מאחורי הקלעים)!
` : ''}
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

      if (effectiveKey && effectiveKey.length >= 10) {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        for (const model of models) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`, {
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

    // 2. Single Topic Expansion Mode
    if (mode === 'single_topic') {
      const webInfo = await fetchMultiSourceWebResearch(querySubject, effectiveFocus);
      
      if (effectiveKey && effectiveKey.length >= 10) {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        const singlePrompt = `
אתה עורך תוכן ראשי לפודקאסט מקצועי. עליך להעמיק, להרחיב ולחדד את נושא הדיון הבא: "${querySubject}".
${episodeTitle ? `כחלק מפרק פודקאסט בנושא: "${episodeTitle}".` : ''}
${effectiveFocus ? `הנחיות, דגשים והערות מיקוד מהמגיש:\n"${effectiveFocus}"\nחובה לשלב את הדגש המבוקש בנקודות ובשאלות!` : ''}
${webInfo.found ? `מידע עובדתי מהרשת:\n${webInfo.completeTalkingPoints.join('\n')}` : ''}
${webInfo.focusFindings && webInfo.focusFindings.length > 0 ? `ממצאי מחקר ספציפיים סביב המיקוד:\n${webInfo.focusFindings.join('\n')}` : ''}

חוקי ניסוח מחייבים:
1. **משפטים מלאים ושלמים בלבד!** אל תקטע משפטים באמצע, אל תשתמש בשלוש נקודות (...).
2. שדה "notes": משפט הסבר מעמיק שמחדד את מטרת הנושא וחיבורו לפרק.
3. שדה "talkingPoints": 3-5 נקודות דיון חדות, עמוקות ומפורטות (12-20 מילים כל אחת).
4. שדה "questions": 2-3 שאלות עומק ודיבייט חדות עבור האורח או הדיון.
5. איסור מוחלט על ניסוחים כלליים או שאלות גנריות.

החזר אך ורק JSON תקין במבנה הבא:
{
  "notes": "משפט שלם המסביר את מהות הנושא.",
  "talkingPoints": [
    "משפט שלם ומדויק על נקודה ראשונה.",
    "משפט שלם ומדויק על נקודה שנייה.",
    "משפט שלם ומדויק על נקודה שלישית."
  ],
  "questions": [
    "שאלה שלמה וחדה לאורח?",
    "שאלה שלמה וחדה נוספת?"
  ],
  "resources": [
    { "title": "ערך רקע", "url": "https://..." }
  ]
}
`;

        for (const model of models) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: singlePrompt }] }],
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
                if (parsed.talkingPoints && parsed.talkingPoints.length > 0) {
                  return NextResponse.json({
                    success: true,
                    source: `Gemini AI (${model})`,
                    webGrounding: webInfo.found,
                    data: parsed
                  });
                }
              }
            }
          } catch (e) {}
        }
      }

      // Fallback for single topic
      const cleanSubject = querySubject;
      const talkingPoints: string[] = [];
      if (webInfo.focusFindings && webInfo.focusFindings.length > 0) {
        talkingPoints.push(...webInfo.focusFindings.slice(0, 2));
      }
      if (webInfo.completeTalkingPoints.length > 0) {
        talkingPoints.push(...webInfo.completeTalkingPoints.slice(0, 2));
      }
      if (effectiveFocus && !talkingPoints.some(p => p.includes(effectiveFocus))) {
        talkingPoints.unshift(`מוקד דיון מיוחד לבקשת המגיש: ${effectiveFocus}.`);
      }
      if (talkingPoints.length === 0) {
        talkingPoints.push(
          `ניתוח ההיבטים המרכזיים והמשמעות של "${cleanSubject}" במהלך הפרק.`,
          `ההשפעה של נושא זה על המבנה הכללי והתפתחות הדיון עם המאזינים.`
        );
      }

      const questions = [
        effectiveFocus 
          ? `כיצד הדגש על "${effectiveFocus}" מעשיר את הדיון סביב "${cleanSubject}"?`
          : `איזו נקודת מבט ייחודית ניתן לחשוף כאשר מעמיקים בנושא "${cleanSubject}"?`,
        `מהי השאלה המרכזית שצריכה להנחות את השיחה בחלק זה של הפרק?`
      ];

      return NextResponse.json({
        success: true,
        source: webInfo.source,
        webGrounding: webInfo.found,
        data: {
          notes: effectiveFocus 
            ? `העמקה וחידוד של ${cleanSubject} תוך התמקדות מיוחדת ב-${effectiveFocus}.`
            : `העמקה וחידוד של ${cleanSubject} כחלק ממהלך הפרק.`,
          talkingPoints,
          questions,
          resources: webInfo.sourceUrl ? [{ title: `ערך: ${cleanSubject}`, url: webInfo.sourceUrl }] : []
        }
      });
    }

    // 3. Live Multi-Source Research with Targeted Focus
    const webInfo = await fetchMultiSourceWebResearch(querySubject, effectiveFocus);

    // 4. Direct Gemini Call if API Key provided
    if (effectiveKey && effectiveKey.length >= 10) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

      const prompt = `
אתה עורך תוכן ראשי לפודקאסט קולנוע ותרבות. עליך לייצר ראשי פרקים מובנים, מדויקים, עשירים וממוקדים עבור: "${querySubject}".
${webInfo.found ? `
מידע עובדתי מהרשת:
- עלילה: ${webInfo.fullPlot}
- הפקה וצוות: ${webInfo.productionFacts.join(' ')}
- שחקנים: ${webInfo.cast.join(', ')}
${webInfo.focusFindings && webInfo.focusFindings.length > 0 ? `
🔎 ממצאי מחקר רשת עובדתיים שנאספו בזמן אמת סביב בקשת המיקוד של המגיש ("${effectiveFocus}"):
${webInfo.focusFindings.map(f => `• ${f}`).join('\n')}
` : ''}` : ''}
${userReview?.trim() ? `ביקורת המגיש: "${userReview.trim()}"` : ''}
${effectiveFocus ? `
🎯 הנחיות מיקוד, הערות ובקשות מיוחדות מהמגיש:
"${effectiveFocus}"
חובה עליך ליישם את בקשת המיקוד הזו בעוצמה וברמת פירוט מקסימלית!
` : ''}
${guestName ? `אורח: ${guestName} (${guestRole || ''})` : ''}

${effectiveFocus ? `
🎯 חוק ברזל מחייב - הקדשת נושא מרכזי ייעודי לבקשת המיקוד ("${effectiveFocus}"):
1. חובה שאחד מראשי הפרקים (נושא 2 או נושא 3) יוקדש כולו, באופן בלעדי ומפורט, ישירות לבקשת המיקוד של המגיש!
   - כותרת הנושא חייבת לציין במפורש את התחום הממוקד (לדוגמה: "צלילת עומק: ${effectiveFocus} - [זווית הניתוח/הדיבייט]").
   - נקודות השיחה ("talkingPoints") בנושא זה חייבות להכיל עובדות מדויקות, שמות, טכניקות, נתונים קונקרטיים וציטוטים מתוך ממצאי המחקר.
   - השאלות ("questions") חייבות להיות שאלות עומק מאתגרות, מקצועיות וספציפיות על הנושא הממוקד.
2. ביתר הנושאים שלב קישור ודיון סביב הדגש הזה.
` : `
מבנה פרק הפודקאסט המבוקש (חלק את ראשי הפרקים לפי 5 הצירים הבאים):
1. 🎬 עלילה ותמות (ניתוח הנרטיב, קונפליקט מרכזי, סצנות מפתח, רבדים פילוסופיים)
2. 🎭 שחקנים ודמויות (ליהוקים, הופעות בולטות, דינמיקה, אלתורים ואתגרי משחק)
3. 🎥 צוותי הפקה + בימוי ויתר התפקידים (חזון הבמאי, צילום, פסקול ומוזיקה, עיצוב ועריכה)
4. ⭐ ביקורות כלליות וציונים (תגובת הקהל והמבקרים, דירוגים, הישגים בקופות ובפסטיבלים)
5. 🤫 סיפורי מאחורי הקלעים (אנקדוטות מהסט, סודות הפקה, תקלות שהפכו לקאלט)
`}

חוקי ניסוח קריטיים:
1. **משפטים מלאים ושלמים בלבד!** אל תקטע משפטים באמצע ואל תשתמש בשלוש נקודות (...).
2. שדה "notes": משפט אחד מלא ומדויק.
3. שדה "talkingPoints": 3-4 נקודות מפתח שלמות, עמוקות, חדות ועשירות בפרטים.
4. שדה "questions": 2-3 שאלות עומק חדות ומעוררות דיון (איסור מוחלט על שאלות גנריות כמו "מה דעתכם?").

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
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey.trim()}`, {
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

    if (effectiveFocus) {
      const focusFindings = webInfo.focusFindings || [];
      const focusTopic = {
        title: `🎯 מוקד מחקר מיוחד: ${effectiveFocus}`,
        estimatedMinutes: Math.max(10, Math.round(targetDurationMinutes * 0.3)),
        notes: `צלילת עומק ייעודית שנחקרה לבקשת המגיש סביב "${effectiveFocus}".`,
        talkingPoints: focusFindings.length > 0 ? [
          ...focusFindings.slice(0, 3),
          `ההשלכות והמשמעות של ${effectiveFocus} על החוויה הכוללת וההצלחה של היצירה.`
        ] : [
          `ניתוח ההיבטים המרכזיים והחידוש שמביא איתו תחום זה: ${effectiveFocus}.`,
          `האתגרים המרכזיים והבחירות המקצועיות שנעשו בהפקה סביב ${effectiveFocus}.`,
          `השוואה בין הביצוע של ${effectiveFocus} ביצירה זו לבין פרויקטים מקבילים.`,
          `התגובות והעניין שהנושא עורר בקרב מעריצים ומבקרים מקצועיים.`
        ],
        questions: [
          `כיצד הדגש הממוקד סביב "${effectiveFocus}" משנה את התפיסה והרושם מהיצירה?`,
          `האם לדעתכם היוצרים מיצו את הפוטנציאל של "${effectiveFocus}" בצורה האופטימלית?`,
          `איזו תובנה חדשה מתגלה כאשר מתמקדים במיוחד ב-${effectiveFocus}?`
        ],
        resources: webInfo.sourceUrl ? [{ title: `מקור רקע: ${effectiveFocus}`, url: webInfo.sourceUrl }] : []
      };

      // Place as Topic 2 so it is prominent and cannot be missed
      topics.splice(1, 0, focusTopic);
    }

    return NextResponse.json({
      success: true,
      source: webInfo.source,
      webGrounding: webInfo.found,
      data: {
        executiveSummary: effectiveFocus
          ? `מחקר מקיף וממוקד עבור "${realTitle}". בהתאם לבקשת המגיש, מנוע המחקר העמיק במיוחד בנושא: "${effectiveFocus}", שילב ממצאים עובדתיים ייעודיים והקדיש פרק מרכזי לדיון סביבו.`
          : `מחקר מקיף על "${realTitle}": מערך ראשי פרקים מובנה ומלא הכולל נתונים עובדתיים מהאינטרנט, ניתוח דמויות ושאלות עומק.`,
        suggestedTitle: effectiveFocus ? `ניתוח מעמיק: "${realTitle}" (דגש על ${effectiveFocus})` : `ניתוח מעמיק: "${realTitle}"`,
        topics
      }
    });

  } catch (error: any) {
    console.error('AI Research route error:', error);
    return NextResponse.json({ error: error.message || 'שגיאה בעיבוד המחקר' }, { status: 500 });
  }
}
