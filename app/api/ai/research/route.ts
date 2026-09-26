import { NextRequest, NextResponse } from 'next/server';
import { 
  fetchMultiSourceWebResearch, 
  extractCompleteSentences, 
  parseUserDirectives,
  WebSourceItem,
  DirectiveResearchResult,
  mergeAndSequenceFactsLocally 
} from '@/lib/webResearch';
import { integrateLocally } from '@/lib/smartIntegrator';

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
      userNotes,
      movieFacts
    } = body;

    const querySubject = (singleTopicTitle || topic || episodeTitle || '').trim();
    const effectiveFocus = (specificFocus || focusNotes || userNotes || '').trim();
    const effectiveKey = (apiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!querySubject && mode !== 'merge_and_sequence_facts') {
      return NextResponse.json({ error: 'נושא המחקר חסר' }, { status: 400 });
    }

    // 0. Merge & Sequence Facts into Chronological Series
    if (mode === 'merge_and_sequence_facts') {
      const incomingFacts: any[] = movieFacts || body.facts || [];
      if (!incomingFacts || incomingFacts.length === 0) {
        return NextResponse.json({ error: 'אין כרטיסיות עובדות לאיחוד' }, { status: 400 });
      }

      if (effectiveKey && effectiveKey.length >= 10) {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        const mergePrompt = `
אתה עורך תוכן קולנועי ותסריטאי מומחה.
לפניך ${incomingFacts.length} כרטיסיות עובדות שנאספו על היצירה/הסרט "${querySubject}".
חלק מהעובדות קשורות זו לזו, מקוטעות, חופפות או מפוזרות ללא סדר כרונולוגי.

רשימת העובדות הקיימות:
${incomingFacts.map((f, i) => `${i + 1}. [${f.category || 'כללי'}] ${f.fact}`).join('\n')}

משימתך העליונה:
1. לחבר ולאחד עובדות קשורות ביחד - כך שלא יהיו פרטים קשורים בנפרד (למזג עובדות על אותו נושא, שחקן, סצנה, פסקול או שלב הפקה לכדי כרטיסיות שלמות, עשירות, רציפות ומדויקות).
2. למחוק כפילויות, משפטים מיותרים וקטעי מידע חופפים או מקוטעים.
3. והכי חשוב: לסדר את כל הכרטיסיות המאוחדות כסדרה אחת אחרי השנייה ברצף הגיוני וכרונולוגי מושלם ("אחד אחרי השני"):
   - שלב 1: חזון היוצרים, הרעיון המקורי והכתיבה
   - שלב 2: מהלך העלילה והתמות ברצף כרונולוגי (פתיחה, נקודות מפנה וקונפליקט מרכזי)
   - שלב 3: ליהוק השחקנים, האודישנים והכנות לתפקידים
   - שלב 4: שלבי ההפקה, הצילומים בלוקיישנים והאתגרים על הסט
   - שלב 5: פסקול, מוזיקה, עיצוב סאונד ואפקטים
   - שלב 6: ביקורות, קופות, ציונים ומורשת
4. החזר בין 6 ל-12 כרטיסיות מאוחדות ועשירות בלבד.
5. לכל כרטיסייה חובה לציין:
   - "seriesOrder": מספר סידורי ברצף מ-1 ומעלה (1, 2, 3...)
   - "seriesGroup": כותרת השלב בסדרה (למשל: "שלב 1 בסדרה: חזון היוצרים", "שלב 2 בסדרה: מהלך העלילה", וכו')
   - "relatedCount": כמה עובדות קשורות אוחדו לכאן (מספר שלם)
   - "fact": הניסוח המאוחד המלא, השלם והעשיר (ללא קיטועים)
   - "category": plot / cast / production_crew / reviews / behind_the_scenes / director_vision
   - "source": מקור אמין
   - "tags": מערך תגיות

החזר JSON תקין בלבד במבנה הבא:
{
  "movieTitle": "${querySubject}",
  "facts": [
    {
      "seriesOrder": 1,
      "seriesGroup": "שלב 1 בסדרה: חזון היוצרים והרעיון",
      "relatedCount": 2,
      "category": "director_vision",
      "fact": "ניסוח מלא ומאוחד...",
      "source": "Wikipedia",
      "tags": ["חזון", "בימוי"]
    }
  ]
}
`;

        for (const model of models) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: mergePrompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.4
                }
              })
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                if (parsed.facts && parsed.facts.length > 0) {
                  const finalFacts = parsed.facts.map((f: any, idx: number) => {
                    const matchOld = incomingFacts.find((old: any) => old.sourceUrl && (f.fact.includes(old.fact?.slice(0, 15) || '') || f.category === old.category));
                    return {
                      id: `fact_seq_ai_${Date.now()}_${idx + 1}`,
                      movieTitle: querySubject,
                      category: f.category || 'behind_the_scenes',
                      fact: f.fact,
                      source: f.source || matchOld?.source || 'Wikipedia',
                      sourceUrl: f.sourceUrl || matchOld?.sourceUrl || undefined,
                      seriesOrder: f.seriesOrder || (idx + 1),
                      seriesGroup: f.seriesGroup || `שלב ${idx + 1} בסדרה`,
                      relatedCount: f.relatedCount || 2,
                      tags: f.tags || ['סדרה עוקבת', querySubject],
                      isPinnedToHUD: idx < 3
                    };
                  });

                  return NextResponse.json({
                    success: true,
                    source: `Gemini AI Sequencer (${model})`,
                    data: {
                      movieTitle: querySubject,
                      facts: finalFacts
                    }
                  });
                }
              }
            }
          } catch (e) {}
        }
      }

      // Deterministic Local Merge & Sequence
      const localSequenced = mergeAndSequenceFactsLocally(incomingFacts, querySubject);
      return NextResponse.json({
        success: true,
        source: 'Built-in Chronological Sequencer',
        data: {
          movieTitle: querySubject,
          facts: localSequenced
        }
      });
    }

    // 0.5 Smart Integration of Additional Information (Tag existing or create new place)
    if (mode === 'smart_integrate_info') {
      const additionalInfo: string = (body.additionalInfo || effectiveFocus || '').trim();
      const existingTopics = body.existingTopics || [];
      const existingFacts = body.existingFacts || body.movieFacts || body.facts || [];
      const targetScope: 'all' | 'topics' | 'facts' = body.targetScope || 'all';

      if (!additionalInfo) {
        return NextResponse.json({ error: 'אין מידע נוסף לסיווג' }, { status: 400 });
      }

      if (effectiveKey && effectiveKey.length >= 10) {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        const integratePrompt = `
אתה עורך תוכן, תסריטאי ומנהל מחקר פודקאסטים ראשי.
לפניך פרק פודקאסט בנושא: "${querySubject}".

להלן ראשי הפרקים ונושאי השיחה הקיימים כרגע (${existingTopics.length}):
${existingTopics.map((t: any, i: number) => `${i + 1}. [נושא מזהה: ${t.id}] כותרת: "${t.title}" | הערות: "${t.notes}" | נקודות שיחה: ${(t.talkingPoints || []).join(' • ')}`).join('\n')}

להלן כרטיסיות עובדות הקולנוע הקיימות כרגע (${existingFacts.length}):
${existingFacts.map((f: any, i: number) => `${i + 1}. [עובדה מזהה: ${f.id}] קטגוריה: [${f.category}] | עובדה: "${f.fact}" | תגיות: ${(f.tags || []).join(', ')}`).join('\n')}

המשתמש הזין כעת "מידע נוסף" (הערות, עובדות חדשות, ציטוטים, רעיונות או תובנות):
"""
${additionalInfo}
"""

משימתך המדויקת:
נתח את כל המידע הנוסף, וסווג כל פריט מידע לאחת משתי האפשרויות:
1. "matched_existing" (תיוג ומיזוג במה שקיים בצורה מסודרת):
   - אם המידע מתקשר ישירות לנושא קיים, שייך אותו לאותו נושא!
     -> הוסף נקודת שיחה חדה ומנוסחת היטב ב-talkingPoints של הנושא (עם תיוג מסודר בפורמט: "🏷️ [תוספת: תגית קצרה] התוכן המלא").
     -> אם רלוונטי, עדכן את שדה ה-notes של הנושא.
   - אם המידע מתקשר לכרטיסיית עובדה קיימת (או לקטגוריה קיימת), מזג אותו לתוכה או הוסף תגית ופרט משלים.
2. "created_new" (הוספה למקום משלו אם הוא חדש):
   - אם המידע מהווה נושא חדש/נפרד שלא כוסה בנושאים הקיימים:
     -> צור עבורו נושא חדש ועצמאי ב-topics! תן לו כותרת מצוינת, זמן מוערך בדקות (10 דקות), נקודות שיחה מפורטות, שאלת פתיחה, והערות.
   - אם המידע מהווה עובדת קולנוע חדשה:
     -> צור כרטיסיית עובדה חדשה ועצמאית עם קטגוריה מתאימה (plot / cast / production_crew / reviews / behind_the_scenes / director_vision), מקור ותגיות.

החזר JSON במבנה מדויק בלבד:
{
  "summary": {
    "matchedCount": 2,
    "newCount": 1,
    "actions": [
      {
        "action": "matched_existing",
        "type": "topic",
        "targetTitle": "שם הנושא הקיים שאליו שויך",
        "explanation": "הסבר בעברית מדוע המידע תוייג לנושא זה",
        "taggedContent": "הטקסט כפי שתוייג",
        "tag": "עלילה"
      },
      {
        "action": "created_new",
        "type": "topic",
        "targetTitle": "כותרת הנושא החדש שנוצר",
        "explanation": "הסבר בעברית מדוע נוצר מקום חדש נפרד עבור מידע זה",
        "taggedContent": "התוכן שנוצר",
        "tag": "הפקה"
      }
    ]
  },
  "updatedTopics": [...],
  "updatedFacts": [...]
}
`;

        for (const model of models) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: integratePrompt }] }],
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.3
                }
              })
            });

            if (res.ok) {
              const data = await res.json();
              const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                if (parsed.updatedTopics || parsed.updatedFacts) {
                  return NextResponse.json({
                    success: true,
                    source: `Gemini AI Smart Integrator (${model})`,
                    data: {
                      summary: parsed.summary || { matchedCount: 0, newCount: 0, actions: [] },
                      updatedTopics: parsed.updatedTopics || existingTopics,
                      updatedFacts: parsed.updatedFacts || existingFacts
                    }
                  });
                }
              }
            }
          } catch (e) {}
        }
      }

      // Deterministic local integration fallback
      const localResult = integrateLocally(additionalInfo, existingTopics, existingFacts, querySubject, targetScope);
      return NextResponse.json({
        success: true,
        source: 'Built-in Local Smart Integrator',
        data: {
          summary: localResult.summary,
          updatedTopics: localResult.updatedTopics,
          updatedFacts: localResult.updatedFacts
        }
      });
    }

    // Parse user notes into individual, binding research directives
    const directives = parseUserDirectives(effectiveFocus);

    // 1. Movie Facts Generation Mode
    if (mode === 'movie_facts') {
      const webInfo = await fetchMultiSourceWebResearch(querySubject, effectiveFocus);

      const directivePromptContext = directives.length > 0 ? `
🎯 דרישות מחקר מחייבות שהוגדרו על ידי המשתמש (חובה לחקור, להביא מקור ולייצר כרטיסיות עובדות ייעודיות לכל דרישה):
${directives.map((d, i) => `${i + 1}. "${d}"`).join('\n')}

🌐 מקורות מחקר אמיתיים ומאומתים שנאספו ברשת (חובה להשתמש בהם ב-source ו-sourceUrl):
${webInfo.verifiedSources.map(s => `- ${s.title}: ${s.url}`).join('\n')}

🔎 ממצאי מחקר שנאספו ברשת עבור דרישות המשתמש:
${(webInfo.directiveResults || []).map(dr => `דרישה: "${dr.directive}"\nממצאים:\n${dr.findings.map(f => `  • ${f}`).join('\n')}`).join('\n\n')}

חוק ברזל: לכל אחת מדרישות המחקר של המשתמש, חובה לייצר לפחות 2 כרטיסיות עובדות מעמיקות, מדויקות וספציפיות שעונות ישירות לדרישה, כולל ציון 'source' וכן 'sourceUrl' אמיתי ותקין!
` : '';

      const factPrompt = `
אתה היסטוריון ומבקר קולנוע בכיר עם ידע אנציקלופדי מדויק ומעמיק ביותר על הסרט: "${querySubject}".
${directivePromptContext}
להלן מידע עובדתי אמיתי שנאסף מהרשת על הסרט:
- תקציר ועלילה: ${webInfo.fullPlot}
- שחקנים ודמויות: ${webInfo.cast.join(', ')}
- הפקה ובימוי: ${webInfo.productionFacts.join(' ')}
- ביקורות, הכנסות וקופות: ${webInfo.criticalReception}

עליך לייצר בין 15 ל-20 כרטיסיות מידע ועובדות עמוקות, מרתקות, ספציפיות ומדויקות ביותר על "${querySubject}".

קריטי - איסור מוחלט על ניסוחים כלליים, גנריים או מעורפלים!
חוקי דיוק עובדתי מחייבים לכל אחת מ-5 הקטגוריות:

1. "plot" (עלילה):
   - ציין במפורש את שמות הדמויות, מיקומי ההתרחשות, נקודת המפנה המרכזית, סצנת הפתיחה/הסיום ומשמעות הסרט.
   - אסור לכתוב משפטים כלליים כמו "העלילה עוקבת אחר מאבק פנימי". חובה לפרט מי הדמות, מה הקונפליקט ומה קורה בסצנות מפתח!

2. "cast" (שחקנים):
   - ציין שמות שחקנים מלאים ושמות דמויות מדויקים.
   - פרט אודישנים אמיתיים, שחקנים אחרים שנשקלו לתפקיד, הכנות פיזיות או נפשיות קיצוניות, ואלתורים אמיתיים על הסט.

3. "production_crew" (צוותי הפקה + בימוי ויתר התפקידים):
   - ציין שמות אמיתיים של הבמאי, התסריטאי, הצלם הראשי (Cinematographer), המלחין (Composer), ועורכי הסאונד והאפקטים.
   - פרט ציוד צילום אמיתי, לוקיישנים אמיתיים, תקציב הפקה ($), ושיטות צילום מעשיות.

4. "reviews" (ביקורות כלליות):
   - ציין נתונים מדויקים: ציון IMDb מדויק, אחוז Rotten Tomatoes אמיתי, דירוג ב-Letterboxd או Metacritic.
   - ציין הכנסות עולמיות בקופות במספרים מדויקים ($), ורשימת פרסי אוסקר/פסטיבלים שבהם הסרט זכה או היה מועמד.

5. "behind_the_scenes" (סיפורי מאחורי הקלעים):
   - ספק אנקדוטות אמיתיות שקרו על הסט: פציעות, תקלות צילום שהפכו לחלק מהסרט, סודות צילום ואיסטר אגז חבויים.

חובה לכלול מקור אמין וכתובת URL אמיתית (sourceUrl) לכל עובדה!

החזר אך ורק JSON תקין במבנה הבא:
{
  "movieTitle": "${querySubject}",
  "facts": [
    {
      "category": "plot",
      "fact": "ניסוח מלא, ספציפי עם שמות ופרטים מדויקים.",
      "source": "Wikipedia / IMDb / Rotten Tomatoes",
      "sourceUrl": "https://...",
      "ratingScore": "8.8/10",
      "year": "2010",
      "tags": ["שם דמות", "פרט ספציפי"],
      "directiveMatch": "שם הדרישה (אם עונה על דרישת משתמש)"
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
                  // Safety net: ensure each fact has a valid source and sourceUrl
                  parsed.facts = parsed.facts.map((f: any, idx: number) => {
                    const fallbackSource = webInfo.verifiedSources[idx % (webInfo.verifiedSources.length || 1)];
                    return {
                      ...f,
                      source: f.source || fallbackSource?.title || webInfo.source,
                      sourceUrl: f.sourceUrl || fallbackSource?.url || webInfo.sourceUrl || 'https://wikipedia.org'
                    };
                  });

                  return NextResponse.json({
                    success: true,
                    source: `Gemini AI Grounded (${model})`,
                    data: parsed,
                    verifiedSources: webInfo.verifiedSources
                  });
                }
              }
            }
          } catch (e) {}
        }
      }

      // Deterministic Movie Facts Fallback with verified sources & directive cards
      const facts: any[] = [];
      const primaryUrl = webInfo.sourceUrl || 'https://he.wikipedia.org';

      if (webInfo.fullPlot) {
        facts.push({
          category: 'plot',
          fact: extractCompleteSentences(webInfo.fullPlot, 1)[0] || `הנרטיב המרכזי של "${querySubject}".`,
          source: 'Wikipedia (עלילה ותמות)',
          sourceUrl: primaryUrl,
          tags: ['עלילה מרכזית']
        });
      }

      if (webInfo.cast.length > 0) {
        facts.push({
          category: 'cast',
          fact: `הקאסט המוביל של "${querySubject}" כולל את: ${webInfo.cast.slice(0, 4).join(', ')}.`,
          source: 'IMDb / Wikipedia (ליהוק)',
          sourceUrl: primaryUrl,
          tags: ['קאסט', 'שחקנים']
        });
      }

      if (webInfo.productionFacts.length > 0) {
        facts.push({
          category: 'production_crew',
          fact: extractCompleteSentences(webInfo.productionFacts.join(' '), 1)[0] || `אתגרי ההפקה והבימוי של "${querySubject}".`,
          source: 'מאגרי הפקה ובימוי',
          sourceUrl: primaryUrl,
          tags: ['הפקה', 'בימוי']
        });
      }

      // Add facts specifically generated for user's directives
      if (webInfo.directiveResults && webInfo.directiveResults.length > 0) {
        for (const dr of webInfo.directiveResults) {
          const drSource = dr.sources[0] || webInfo.verifiedSources[0];
          for (const finding of dr.findings.slice(0, 2)) {
            facts.push({
              category: 'behind_the_scenes',
              fact: finding,
              source: drSource?.title || `מקור מחקר: ${dr.directive}`,
              sourceUrl: drSource?.url || primaryUrl,
              tags: [dr.directive.slice(0, 15)],
              directiveMatch: dr.directive
            });
          }
        }
      }

      return NextResponse.json({
        success: true,
        source: 'Built-in Research Engine',
        data: {
          movieTitle: querySubject,
          facts
        },
        verifiedSources: webInfo.verifiedSources
      });
    }

    // 2. Single Topic Expansion Mode
    if (mode === 'single_topic') {
      const webInfo = await fetchMultiSourceWebResearch(querySubject, effectiveFocus);
      
      if (effectiveKey && effectiveKey.length >= 10) {
        const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        const singlePrompt = `
אתה עורך תוכן ראשי לפודקאסט מקצועי. עליך להעמיק, להרחיב ולחדד את נושא הדיון הבא: "${querySubject}".
${episodeTitle ? `כחלק מפרק פודקאסט בנושא: "${episodeTitle}".` : ''}

${directives.length > 0 ? `
🎯 דרישות מחקר מחייבות שהוגדרו על ידי המשתמש (חובה לחקור, לשלב בנקודות ובשאלות ולהביא מקורות מאומתים):
${directives.map((d, i) => `${i + 1}. "${d}"`).join('\n')}

🌐 מקורות מחקר אמיתיים ומאומתים מהרשת (חובה לשלבם בשדה resources):
${webInfo.verifiedSources.map(s => `- ${s.title}: ${s.url}`).join('\n')}

🔎 ממצאי מחקר עבור דרישות המשתמש:
${(webInfo.directiveResults || []).map(dr => `דרישה: "${dr.directive}"\n${dr.findings.map(f => `  • ${f}`).join('\n')}`).join('\n')}
` : ''}

${webInfo.found ? `מידע עובדתי נוסף מהרשת:\n${webInfo.completeTalkingPoints.join('\n')}` : ''}

חוקי ניסוח מחייבים:
1. **משפטים מלאים ושלמים בלבד!** אל תקטע משפטים באמצע, אל תשתמש בשלוש נקודות (...).
2. שדה "notes": משפט הסבר מעמיק שמחדד את מטרת הנושא, דרישות המשתמש וחיבורו לפרק.
3. שדה "talkingPoints": 3-5 נקודות דיון חדות, עמוקות ומפורטות (12-20 מילים כל אחת) המבוססות על ממצאי המחקר.
4. שדה "questions": 2-3 שאלות עומק ודיבייט חדות עבור האורח או הדיון.
5. שדה "resources": חובה לכלול לפחות 1-2 מקורות מחקר אמיתיים ומאומתים מתוך המקורות שלעיל, עם ה-URL המדויק.

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
    { "title": "ערך רקע / מקור מחקר", "url": "https://..." }
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
                  // Ensure resources are populated with real URLs
                  if (!parsed.resources || parsed.resources.length === 0) {
                    parsed.resources = webInfo.verifiedSources.slice(0, 2).map(s => ({
                      title: s.title,
                      url: s.url
                    }));
                  }
                  return NextResponse.json({
                    success: true,
                    source: `Gemini AI (${model})`,
                    webGrounding: webInfo.found,
                    data: parsed,
                    verifiedSources: webInfo.verifiedSources
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
        talkingPoints.push(...webInfo.focusFindings.slice(0, 3));
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

      const fallbackResources = webInfo.verifiedSources.length > 0
        ? webInfo.verifiedSources.slice(0, 3).map(s => ({ title: s.title, url: s.url }))
        : (webInfo.sourceUrl ? [{ title: `ערך: ${cleanSubject}`, url: webInfo.sourceUrl }] : []);

      return NextResponse.json({
        success: true,
        source: webInfo.source,
        webGrounding: webInfo.found,
        data: {
          notes: effectiveFocus 
            ? `העמקה וחידוד של ${cleanSubject} תוך יישום דרישת המחקר: ${effectiveFocus}.`
            : `העמקה וחידוד של ${cleanSubject} כחלק ממהלך הפרק.`,
          talkingPoints,
          questions,
          resources: fallbackResources
        },
        verifiedSources: webInfo.verifiedSources
      });
    }

    // 3. Full Episode Live Multi-Source Research with Comprehensive Directives
    const webInfo = await fetchMultiSourceWebResearch(querySubject, effectiveFocus);

    // 4. Direct Gemini Call if API Key provided
    if (effectiveKey && effectiveKey.length >= 10) {
      const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

      const directivePromptSection = directives.length > 0 ? `
🎯 דרישות מחקר מחייבות שהוגדרו על ידי המשתמש (חובה לבצע מחקר אינטרנטי מקיף, להביא מקורות ולשלב בעוצמה):
${directives.map((d, i) => `${i + 1}. "${d}"`).join('\n')}

🌐 מקורות מחקר אמיתיים ומאומתים שנאספו ברשת (חובה להשתמש בהם ולשלבם בתוך שדה resources של כל נושא עם ה-URL המדויק!):
${webInfo.verifiedSources.map(s => `- ${s.title}: ${s.url}`).join('\n')}

🔎 ממצאי מחקר שנאספו ברשת בזמן אמת עבור דרישות המשתמש:
${(webInfo.directiveResults || []).map(dr => `דרישה: "${dr.directive}"\nממצאים עובדתיים שנאספו:\n${dr.findings.map(f => `  • ${f}`).join('\n')}`).join('\n\n')}

חוק השילוב הכפול המחייב (Double Integration Rule):
1. הקדש ראשי פרקים ייעודיים לכל אחת מדרישות המחקר של המשתמש!
   - לכל דרישה (או זוג דרישות קרובות), צור ראש פרק עצמאי ונפרד (כנושא 2, נושא 3 וכו').
   - כותרת הנושא חייבת לציין במפורש את הדרישה: "🎯 מוקד מחקר ייעודי: [שם הדרישה]".
   - נקודות השיחה ("talkingPoints") בנושא זה חייבות להתבסס ישירות על הממצאים העובדתיים, הנתונים, השמות והציטוטים שנאספו ברשת עבור הדרישה.
   - השאלות ("questions") חייבות להיות שאלות עומק חדות ומקצועיות על הדרישה הזו.
   - שדה "resources" של הנושא חייב להכיל את המקורות המאומתים עם הקישור (URL) המדויק שנאספו עבור דרישה זו!
2. שזור את ממצאי המחקר של הדרישות גם ביתר ראשי הפרקים (בתוך נקודות השיחה והשאלות של העלילה, הדמויות, ההפקה והביקורת).
3. חובה קריטית: בכל אחד ואחד מראשי הפרקים (ללא יוצא מן הכלל), שדה ה-"resources" חייב להכיל לפחות מקור אחד או שניים אמיתיים ומאומתים מתוך רשימת המקורות שלעיל, במבנה [{ "title": "שם המקור", "url": "https://..." }].
` : `
מבנה פרק הפודקאסט המבוקש (חלק את ראשי הפרקים לפי 5 הצירים הבאים):
1. 🎬 עלילה ותמות (ניתוח הנרטיב, קונפליקט מרכזי, סצנות מפתח, רבדים פילוסופיים)
2. 🎭 שחקנים ודמויות (ליהוקים, הופעות בולטות, דינמיקה, אלתורים ואתגרי משחק)
3. 🎥 צוותי הפקה + בימוי ויתר התפקידים (חזון הבמאי, צילום, פסקול ומוזיקה, עיצוב ועריכה)
4. ⭐ ביקורות כלליות וציונים (תגובת הקהל והמבקרים, דירוגים, הישגים בקופות ובפסטיבלים)
5. 🤫 סיפורי מאחורי הקלעים (אנקדוטות מהסט, סודות הפקה, תקלות שהפכו לקאלט)
`;

      const prompt = `
אתה עורך תוכן ראשי לפודקאסט קולנוע ותרבות. עליך לייצר ראשי פרקים מובנים, מדויקים, עשירים וממוקדים עבור: "${querySubject}".
${webInfo.found ? `
מידע עובדתי כללי מהרשת:
- עלילה: ${webInfo.fullPlot}
- הפקה וצוות: ${webInfo.productionFacts.join(' ')}
- שחקנים: ${webInfo.cast.join(', ')}
- קבלת היצירה והכנסות: ${webInfo.criticalReception}
` : ''}
${userReview?.trim() ? `ביקורת המגיש: "${userReview.trim()}"` : ''}
${directivePromptSection}
${guestName ? `אורח: ${guestName} (${guestRole || ''})` : ''}
משך היעד: ${targetDurationMinutes} דקות
סגנון: ${tone === 'provocative' ? 'דיבייט סוער ומאתגר' : 'ניתוח עומק קולנועי מבוסס מקורות'}

חוקי ניסוח קריטיים:
1. **משפטים מלאים ושלמים בלבד!** אל תקטע משפטים באמצע ואל תשתמש בשלוש נקודות (...).
2. שדה "notes": משפט אחד מלא ומדויק המסביר את מהות הנושא וההקשר שלו.
3. שדה "talkingPoints": 3-4 נקודות מפתח שלמות, עמוקות, חדות ועשירות בפרטים (שמות, מספרים, עובדות אמיתיות).
4. שדה "questions": 2-3 שאלות עומק חדות ומעוררות דיון (איסור מוחלט על שאלות גנריות כמו "מה דעתכם?").
5. שדה "resources": חובה לכלול לפחות 1-2 מקורות אמיתיים מתוך מקורות המחקר המאומתים שהובאו לעיל, עם כתובת URL אמיתית.

החזר JSON תקין בלבד במבנה הבא:
{
  "executiveSummary": "תקציר מנהלים מלא של 2-3 משפטים שלמים.",
  "suggestedTitle": "כותרת לפרק",
  "topics": [
    {
      "title": "שם הנושא",
      "estimatedMinutes": 10,
      "notes": "משפט שלם המסביר את מהות הנושא.",
      "talkingPoints": ["נקודה 1.", "נקודה 2.", "נקודה 3."],
      "questions": ["שאלה 1?", "שאלה 2?"],
      "resources": [
        { "title": "שם מקור המחקר", "url": "https://..." }
      ]
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
                temperature: 0.6
              }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
              
              if (parsed.topics && parsed.topics.length > 0) {
                // Post-Processing Guarantee 1: Ensure all topics have valid resources with real URLs
                parsed.topics = parsed.topics.map((t: any, idx: number) => {
                  let topicResources = Array.isArray(t.resources) ? t.resources.filter((r: any) => r && r.url && r.url.startsWith('http')) : [];
                  
                  if (topicResources.length === 0 && webInfo.verifiedSources.length > 0) {
                    // Try to find source matching directive or topic title
                    const matching = webInfo.verifiedSources.filter(s => 
                      (s.directiveMatch && t.title.includes(s.directiveMatch)) ||
                      t.title.includes(s.title.slice(0, 6))
                    );
                    if (matching.length > 0) {
                      topicResources = matching.map(s => ({ title: s.title, url: s.url }));
                    } else {
                      const assigned = webInfo.verifiedSources[idx % webInfo.verifiedSources.length];
                      topicResources = [{ title: assigned.title, url: assigned.url }];
                    }
                  } else if (topicResources.length === 0 && webInfo.sourceUrl) {
                    topicResources = [{ title: `ערך אנציקלופדי: ${webInfo.title}`, url: webInfo.sourceUrl }];
                  }

                  return {
                    ...t,
                    resources: topicResources
                  };
                });

                // Post-Processing Guarantee 2: Double check that every user directive has a dedicated topic
                if (directives.length > 0) {
                  for (let dIdx = 0; dIdx < directives.length; dIdx++) {
                    const dir = directives[dIdx];
                    const hasDedicated = parsed.topics.some((t: any) => 
                      t.title.toLowerCase().includes(dir.slice(0, 8).toLowerCase()) ||
                      t.notes?.toLowerCase().includes(dir.slice(0, 8).toLowerCase())
                    );

                    if (!hasDedicated) {
                      const dr = webInfo.directiveResults?.find(r => r.directive === dir);
                      const drSources = (dr?.sources && dr.sources.length > 0) ? dr.sources : webInfo.verifiedSources;
                      const dirTopic = {
                        title: `🎯 מוקד מחקר ייעודי: ${dir}`,
                        estimatedMinutes: Math.max(8, Math.round(targetDurationMinutes * 0.25)),
                        notes: `צלילת עומק ומחקר אינטרנטי ייעודי שנערך לבקשת המגיש בנושא "${dir}".`,
                        talkingPoints: dr?.findings && dr.findings.length > 0 ? [
                          ...dr.findings.slice(0, 3),
                          `ניתוח ההשפעה של ${dir} על התוצאה הסופית והצלחת היצירה.`
                        ] : [
                          `ניתוח ההיבטים המרכזיים והמשמעות של ${dir}.`,
                          `ההשפעה והתובנות המרכזיות שעלו מתוך המחקר ברשת.`
                        ],
                        questions: [
                          `כיצד הדגש על "${dir}" מעצב מחדש את התפיסה של היצירה?`,
                          `מהי התובנה המרכזית שעולה מתוך הנתונים על "${dir}"?`
                        ],
                        resources: drSources.slice(0, 2).map(s => ({ title: s.title, url: s.url }))
                      };
                      parsed.topics.splice(1 + dIdx, 0, dirTopic);
                    }
                  }
                }

                return NextResponse.json({
                  success: true,
                  source: `Gemini AI (${model}) + Web Grounding`,
                  webGrounding: webInfo.found,
                  data: parsed,
                  verifiedSources: webInfo.verifiedSources
                });
              }
            }
          }
        } catch (e) {}
      }
    }

    // 5. Deterministic Full-Sentence Fallback with Guaranteed Directives & Verified Sources
    const realTitle = webInfo.title || querySubject;
    const cleanReviewSentences = userReview?.trim() ? extractCompleteSentences(userReview, 3) : [];
    const primarySourceList = webInfo.verifiedSources.length > 0 
      ? webInfo.verifiedSources.map(s => ({ title: s.title, url: s.url }))
      : (webInfo.sourceUrl ? [{ title: `ערך אנציקלופדי: ${realTitle}`, url: webInfo.sourceUrl }] : []);

    const topics: any[] = [
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
        resources: primarySourceList.slice(0, 2)
      },
      {
        title: `ניתוח דמויות, קונפליקטים ותמות מרכזיות`,
        estimatedMinutes: Math.max(10, Math.round(targetDurationMinutes * 0.3)),
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
        resources: primarySourceList.slice(0, 1)
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
        resources: primarySourceList.slice(1, 3).length > 0 ? primarySourceList.slice(1, 3) : primarySourceList.slice(0, 1)
      },
      {
        title: userReview ? `דיבייט סביב ביקורת המגיש, סיום וציון` : `קבלת היצירה בציבור, סיום והמלצה סופית`,
        estimatedMinutes: Math.max(5, Math.round(targetDurationMinutes * 0.2)),
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
        resources: primarySourceList.slice(0, 2)
      }
    ];

    // Double Integration in Fallback: Create dedicated topics for user's research directives
    if (directives.length > 0) {
      directives.forEach((dir, dIdx) => {
        const dr = webInfo.directiveResults?.find(r => r.directive === dir);
        const drFindings = dr?.findings || [];
        const drSources = (dr?.sources && dr.sources.length > 0) ? dr.sources : webInfo.verifiedSources;

        const focusTopic = {
          title: `🎯 מוקד מחקר ייעודי: ${dir}`,
          estimatedMinutes: Math.max(8, Math.round(targetDurationMinutes * 0.25)),
          notes: `צלילת עומק ומחקר אינטרנטי ייעודי שנערך לבקשת המגיש בנושא "${dir}".`,
          talkingPoints: drFindings.length > 0 ? [
            ...drFindings.slice(0, 3),
            `ההשלכות והמשמעות של ${dir} על החוויה הכוללת וההצלחה של היצירה.`
          ] : [
            `ניתוח ההיבטים המרכזיים והחידוש שמביא איתו תחום זה: ${dir}.`,
            `האתגרים המרכזיים והבחירות המקצועיות שנעשו בהפקה סביב ${dir}.`,
            `השוואה בין הביצוע של ${dir} ביצירה זו לבין פרויקטים מקבילים.`,
            `התגובות והעניין שהנושא עורר בקרב מעריצים ומבקרים מקצועיים.`
          ],
          questions: [
            `כיצד הדגש הממוקד סביב "${dir}" משנה את התפיסה והרושם מהיצירה?`,
            `האם לדעתכם היוצרים מיצו את הפוטנציאל של "${dir}" בצורה האופטימלית?`,
            `איזו תובנה חדשה מתגלה כאשר מתמקדים במיוחד ב-${dir}?`
          ],
          resources: drSources.slice(0, 2).map(s => ({ title: s.title, url: s.url }))
        };

        // Insert after intro topic
        topics.splice(1 + dIdx, 0, focusTopic);
      });
    }

    return NextResponse.json({
      success: true,
      source: webInfo.source,
      webGrounding: webInfo.found,
      data: {
        executiveSummary: directives.length > 0
          ? `מחקר מקיף וממוקד עבור "${realTitle}". בהתאם לדרישות המחקר של המשתמש (${directives.join(', ')}), מנוע המחקר ביצע איסוף עובדות ומקורות מהאינטרנט, ייצר ראשי פרקים ייעודיים ושילב את הממצאים והמקורות המאומתים בכל חלקי הפרק.`
          : `מחקר מקיף על "${realTitle}": מערך ראשי פרקים מובנה ומלא הכולל נתונים עובדתיים מהאינטרנט, מקורות מאומתים, ניתוח דמויות ושאלות עומק.`,
        suggestedTitle: directives.length > 0 ? `ניתוח מעמיק: "${realTitle}" (דגש על ${directives[0]})` : `ניתוח מעמיק: "${realTitle}"`,
        topics
      },
      verifiedSources: webInfo.verifiedSources
    });

  } catch (error: any) {
    console.error('AI Research route error:', error);
    return NextResponse.json({ error: error.message || 'שגיאה בעיבוד המחקר' }, { status: 500 });
  }
}
