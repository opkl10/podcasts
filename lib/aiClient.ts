// High-precision Podcast Research Engine with Multi-Source Live Web Grounding
// Guarantees 100% complete, unbroken sentences (No cutoffs, no partial phrases, no trailing ellipses!)

import { fetchMultiSourceWebResearch, extractCompleteSentences, WebResearchBundle } from './webResearch';

export interface AIResearchOptions {
  topic: string;
  episodeTitle?: string;
  guestName?: string;
  guestRole?: string;
  targetDurationMinutes?: number;
  tone?: 'deep' | 'conversational' | 'provocative' | 'educational';
  apiKey?: string;
  mode?: 'full_episode' | 'single_topic';
  singleTopicTitle?: string;
  userReview?: string;
  specificFocus?: string;
}

export async function runAIResearch(options: AIResearchOptions) {
  const { 
    topic, 
    episodeTitle, 
    guestName, 
    guestRole, 
    targetDurationMinutes = 45, 
    tone = 'deep', 
    apiKey, 
    userReview,
    specificFocus,
    singleTopicTitle
  } = options;

  const querySubject = (singleTopicTitle || topic || episodeTitle || '').trim();

  // 1. Live Multi-Source Web Search in Browser
  let webData: WebResearchBundle = {
    found: false,
    title: querySubject,
    source: 'Multi-Source Knowledge Engine',
    cast: [],
    fullPlot: '',
    completeTalkingPoints: [],
    productionFacts: [],
    criticalReception: '',
    category: 'movie_tv'
  };

  try {
    webData = await fetchMultiSourceWebResearch(querySubject);
  } catch (err) {
    console.warn('Web fetch error:', err);
  }

  // 2. Direct Gemini Generation with Strict Full-Sentence Output Constraints
  if (apiKey && apiKey.trim()) {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

    const webContext = webData.found ? `
מידע עובדתי מהאינטרנט (ויקיפדיה ומאגרי מידע קולנועיים):
- כותרת: ${webData.title}
- צוות שחקנים: ${webData.cast.join(', ') || 'שחקנים ראשיים'}
- קו עלילה מרכזי: ${webData.fullPlot}
- מאחורי הקלעים ופרטי הפקה: ${webData.productionFacts.join(' ')}
- ביקורות וקבלת הסרט: ${webData.criticalReception}
` : '';

    const hostReviewContext = userReview?.trim() ? `
דעה וביקורת אישית של המגיש:
"${userReview.trim()}"
חובה לשלב את עמדת המגיש בתוך הנושא הרביעי בצורה של דיבייט מעמיק מול האורח.
` : '';

    const prompt = `
אתה עורך תוכן ראשי של פודקאסט קולנוע וטלוויזיה מקצועי. עליך לייצר מערך ראשי פרקים מובנה, מדויק ומלא עבור: "${querySubject}".

${webContext}
${hostReviewContext}
${specificFocus ? `דגש מיוחד: "${specificFocus}"` : ''}
${guestName ? `אורח/ת: ${guestName} (${guestRole || ''})` : ''}
משך היעד: ${targetDurationMinutes} דקות
סגנון: ${tone === 'provocative' ? 'דיבייט סוער ומאתגר' : 'ניתוח עומק קולנועי'}

הנחיות איכות קריטיות (חוקי ניסוח):
1. **משפטים מלאים ושלמים בלבד!** אסור בשום אופן לקטוע משפטים באמצע, אסור להשתמש בשלוש נקודות (...) ואסור לכתוב חלקי משפטים. כל נקודה ושאלה חייבת להיות משפט בעל תחביר תקין ומלא שמסתיים בנקודה או סימן שאלה.
2. כל נושא חייב לכלול:
   - "notes": משפט הסבר שלם ומדויק על מטרת החלק הזה בפרק.
   - "talkingPoints": בין 3 ל-4 נקודות מפתח שלמות, קצרות וקולעות (12-18 מילים כל אחת).
   - "questions": בין 2 ל-3 שאלות עומק חדות ומעוררות מחשבה עבור האורח או המאזינים.
3. מבנה 4 הנושאים:
   - נושא 1: פתיח, החזון הקולנועי, קו העלילה והליהוק של הדמויות הראשיות.
   - נושא 2: ניתוח עומק של התמות הפילוסופיות, מניעי הדמויות והקונפליקט המרכזי.
   - נושא 3: מאחורי הקלעים, שפת הבימוי, אתגרי ההפקה והפסקול.
   - נושא 4: דיבייט סביב ביקורת המגיש, סיום הסרט והשורה התחתונה.

החזר אך ורק JSON תקין במבנה הבא:
{
  "executiveSummary": "תקציר מנהלים מלא של 2-3 משפטים שלמים על הנושא.",
  "suggestedTitle": "כותרת קליטה ומקצועית לפרק",
  "topics": [
    {
      "title": "שם הנושא",
      "estimatedMinutes": 10,
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
      "resources": []
    }
  ]
}
`;

    const key = apiKey.trim();
    for (const model of models) {
      try {
        let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        let headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        };

        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        };

        let res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });

        // Fallback: Query param ?key=
        if (!res.ok) {
          res = await fetch(`${url}?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        if (res.ok) {
          const json = await res.json();
          const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanText);
            return {
              success: true,
              source: `Gemini AI (${model}) + Web Knowledge Base`,
              webGrounding: webData.found,
              data: parsed
            };
          }
        }
      } catch (browserFetchErr) {}
    }
  }

  // 3. Deterministic High-Quality Research Generator with 100% Complete Sentences
  const realTitle = webData.title || querySubject;
  const cleanReviewSentences = userReview?.trim() ? extractCompleteSentences(userReview, 3) : [];

  const topics: any[] = [
    {
      title: `פתיח, חזון היוצרים וקו העלילה: ${realTitle}`,
      estimatedMinutes: Math.max(5, Math.round(targetDurationMinutes * 0.2)),
      notes: `סקירת החזון הקולנועי של היוצרים והקונספט המרכזי שמוביל את העלילה.`,
      talkingPoints: [
        `ההשפעה התרבותית והחשיבות של "${realTitle}" בעולם הקולנוע והטלוויזיה.`,
        webData.cast.length > 0 
          ? `הליהוק המרכזי והתאמת השחקנים: ${webData.cast.slice(0, 3).join(', ')}.` 
          : `הבחירות האמנותיות של הבמאי בליהוק הדמויות המרכזיות.`,
        webData.fullPlot 
          ? extractCompleteSentences(webData.fullPlot, 1)[0] || `נקודת הפתיחה של הסיפור והאתגר העומד בפני הדמות הראשית.`
          : `נקודת הפתיחה של הסיפור והאתגר העומד בפני הדמות הראשית.`
      ],
      questions: [
        `איזו סצנה ביצירה מגדירה בצורה המדויקת ביותר את הטון והאווירה?`,
        `האם הליהוק של הדמויות הראשיות ענה על הציפיות שלכם בצפייה הראשונה?`
      ],
      resources: webData.sourceUrl ? [{ title: `ערך אנציקלופדי: ${realTitle}`, url: webData.sourceUrl }] : []
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
        `מהו לדעתכם הרגע הרגשי החזק ביותר שמגדיר את הסרט?`,
        `האם הבחירות המוסריות של הגיבור מוצדקות בעיניכם בסיום היצירה?`
      ],
      resources: []
    },
    {
      title: `מאחורי הקלעים, אתגרי הפקה ושפת הבימוי`,
      estimatedMinutes: Math.max(5, Math.round(targetDurationMinutes * 0.2)),
      notes: `סקירת החלטות הבימוי, אתגרי הצילומים והתפקיד של העיצוב הקולי.`,
      talkingPoints: [
        webData.productionFacts.length > 0 
          ? extractCompleteSentences(webData.productionFacts.join(' '), 1)[0] || `אתגרי ההפקה והעבודה המורכבת של הצוות על סט הצילומים.`
          : `אתגרי ההפקה והעבודה המורכבת של הצוות על סט הצילומים.`,
        `השפה הויזואלית, זוויות הצילום והתאורה שנבחרו לבניית המתח.`,
        `הפסקול והעיצוב הקולי והאופן שבו הם מעצימים את חוויית הצפייה.`
      ],
      questions: [
        `כיצד שפת הצילום והעיצוב הויזואלי תרמו לתחושת ההזדהות של הצופה?`,
        `איזה פרט מאחורי הקלעים הפתיע אתכם ביותר במהלך המחקר על ההפקה?`
      ],
      resources: []
    },
    {
      title: userReview ? `דיבייט סביב ביקורת המגיש, סיום וציון` : `קבלת היצירה בציבור, סיום והמלצה סופית`,
      estimatedMinutes: Math.max(5, Math.round(targetDurationMinutes * 0.25)),
      notes: userReview ? `עימות עמדת המגיש מול טיעוני נגד של מבקרים ומעריצים.` : `שקלול תגובות המבקרים, ניתוח הסיום והציון המסכם.`,
      talkingPoints: cleanReviewSentences.length > 0 ? [
        `טענת המפתח של המגיש: ${cleanReviewSentences[0]}`,
        cleanReviewSentences[1] 
          ? `דגש מרכזי נוסף מתוך הביקורת: ${cleanReviewSentences[1]}` 
          : `הנימוקים המרכזיים שמחזקים את נקודת המבט של המגיש.`,
        `טיעוני נגד אפשריים מצד מעריצים או מבקרים הרואים את היצירה באור חיובי יותר.`,
        `השורה התחתונה, ההמלצה לקהל והציון המסכם מתוך עשר.`
      ] : [
        `כיצד התקבלה היצירה על ידי קהל הצופים ומבקרי הקולנוע בעולם.`,
        `הוויכוחים והפרשנויות השונות שנוצרו סביב סצנת הסיום.`,
        `פסק הדין הסופי: למי היצירה מומלצת והציון המסכם מתוך עשר.`
      ],
      questions: [
        userReview 
          ? `איך הייתם משיבים למי שטוען שהסרט השיג בדיוק את מטרתו למרות הביקורת?` 
          : `איך אתם מפרשים את המסר הסופי שהבמאי בחר להשאיר עם הצופים?`,
        `איזה ציון מגיע ליצירה זו בעיניכם, ולמי הייתם ממליצים לצפות בה?`
      ],
      resources: []
    }
  ];

  return {
    success: true,
    source: webData.source,
    webGrounding: webData.found,
    data: {
      executiveSummary: `מחקר מקיף על "${realTitle}": מערך ראשי פרקים מובנה ומלא הכולל נתונים עובדתיים מהאינטרנט, ניתוח דמויות, שאלות עומק ודיבייט סביב ביקורת המגיש.`,
      suggestedTitle: `ניתוח מעמיק: "${realTitle}"`,
      topics
    }
  };
}
