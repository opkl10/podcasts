// Smart Information Auto-Tagger and Integrator
// Intelligently analyzes user-provided additional information:
// 1. Tags and integrates it neatly into existing topics / fact cards if related
// 2. Creates a dedicated place of its own if it is new

import { TopicItem, MovieFactCard, FactCategory } from './types';
import { getStoredGeminiApiKey } from './apiConfig';

export interface SmartIntegrationAction {
  action: 'matched_existing' | 'created_new';
  type: 'topic' | 'fact';
  targetTitle: string;
  explanation: string;
  taggedContent: string;
  tag?: string;
}

export interface SmartIntegrationSummary {
  matchedCount: number;
  newCount: number;
  actions: SmartIntegrationAction[];
}

export interface SmartIntegrationResult {
  success: boolean;
  source: string;
  summary: SmartIntegrationSummary;
  updatedTopics: TopicItem[];
  updatedFacts: MovieFactCard[];
}

const STOP_WORDS = new Set([
  'את', 'על', 'של', 'זה', 'זו', 'אשר', 'עם', 'כי', 'אם', 'גם', 'רק', 'כל', 'כמו', 
  'מה', 'מי', 'לו', 'לה', 'הוא', 'היא', 'הם', 'הן', 'אבל', 'או', 'בין', 'כדי',
  'לא', 'כן', 'יש', 'אין', 'היה', 'היתה', 'היו', 'שלנו', 'שלו', 'שלה', 'אותו', 'אותה',
  'the', 'and', 'to', 'of', 'a', 'in', 'is', 'that', 'for', 'on', 'with', 'as', 'at'
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\u0590-\u05FF\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

function detectCategoryAndTag(text: string): { category: FactCategory; tag: string } {
  const lower = text.toLowerCase();

  if (/עליל|טוויסט|סיום|דמות|דמויות|קונפליקט|תסריט|פתיחה|עלילת|plot|twist|ending/i.test(lower)) {
    return { category: 'plot', tag: 'עלילה ודמויות' };
  }
  if (/שחקן|שחקנית|ליהוק|אודישן|משחק|תפקיד|כוכב|שחקנים|cast|actor|actress/i.test(lower)) {
    return { category: 'cast', tag: 'שחקנים וליהוק' };
  }
  if (/במאי|בימוי|צלם|צילום|פסקול|מוזיקה|מלחין|אפקטים|תקציב|הפקה|לוקיישן|סט|camera|director|soundtrack|score|budget/i.test(lower)) {
    return { category: 'production_crew', tag: 'הפקה ובימוי' };
  }
  if (/ציון|ביקורת|קופות|הכנסות|דולר|מיליון|רוטן|אימדב|imdb|letterboxd|metacritic|box office|revenue|review/i.test(lower)) {
    return { category: 'reviews', tag: 'ביקורות וקופות' };
  }
  if (/מאחורי הקלעים|תקלה|פציעה|אלתור|סוד|איסטר אג|אנלדוטה|bts|behind the scenes|trivia/i.test(lower)) {
    return { category: 'behind_the_scenes', tag: 'מאחורי הקלעים' };
  }

  return { category: 'behind_the_scenes', tag: 'מידע נוסף' };
}

// Split freeform input text into distinct thoughts / bullet points / sentences
function splitIntoInfoSegments(text: string): string[] {
  if (!text) return [];

  // Split by line breaks, bullet marks, or numbered lists
  const lines = text
    .split(/\n+/)
    .map(l => l.trim().replace(/^[-*•\d+.]\s*/, ''))
    .filter(l => l.length >= 10);

  if (lines.length > 1) {
    return lines;
  }

  // If it's a single block of text, split by full stops if sufficiently long
  const sentences = text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 15);

  return sentences.length > 0 ? sentences : [text.trim()];
}

// Deterministic local integration engine (used as fallback or offline)
export function integrateLocally(
  additionalInfo: string,
  existingTopics: TopicItem[],
  existingFacts: MovieFactCard[],
  episodeTitle: string,
  targetScope: 'all' | 'topics' | 'facts' = 'all'
): SmartIntegrationResult {
  const segments = splitIntoInfoSegments(additionalInfo);
  const actions: SmartIntegrationAction[] = [];

  let updatedTopics: TopicItem[] = existingTopics.map(t => ({
    ...t,
    talkingPoints: [...t.talkingPoints],
    questions: [...t.questions],
    resources: [...t.resources]
  }));

  let updatedFacts: MovieFactCard[] = existingFacts.map(f => ({
    ...f,
    tags: f.tags ? [...f.tags] : []
  }));

  let matchedCount = 0;
  let newCount = 0;

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const segment = segments[sIdx];
    const segmentKeywords = extractKeywords(segment);
    const { category, tag } = detectCategoryAndTag(segment);

    // 1. TOPICS INTEGRATION
    if (targetScope === 'all' || targetScope === 'topics') {
      let bestTopicMatchIndex = -1;
      let highestTopicScore = 0;

      for (let tIdx = 0; tIdx < updatedTopics.length; tIdx++) {
        const topic = updatedTopics[tIdx];
        const topicText = `${topic.title} ${topic.notes || ''} ${topic.talkingPoints.join(' ')}`;
        const topicKeywords = new Set(extractKeywords(topicText));

        let matchScore = 0;
        for (const kw of segmentKeywords) {
          if (topicKeywords.has(kw)) matchScore += 2;
        }

        // Direct phrase inclusion bonus
        const cleanTitleWords = extractKeywords(topic.title);
        for (const tw of cleanTitleWords) {
          if (segment.toLowerCase().includes(tw)) matchScore += 3;
        }

        if (matchScore > highestTopicScore) {
          highestTopicScore = matchScore;
          bestTopicMatchIndex = tIdx;
        }
      }

      // Threshold for topic matching
      if (highestTopicScore >= 3 && bestTopicMatchIndex !== -1) {
        // MATCHED: Tag and integrate into existing topic!
        const targetTopic = updatedTopics[bestTopicMatchIndex];
        const formattedPoint = `🏷️ [תוספת: ${tag}] ${segment}`;
        
        targetTopic.talkingPoints.push(formattedPoint);
        matchedCount++;

        actions.push({
          action: 'matched_existing',
          type: 'topic',
          targetTitle: targetTopic.title,
          explanation: `המידע זוהה כשייך לנושא הקיים "${targetTopic.title}" ותוייג תחת "${tag}".`,
          taggedContent: formattedPoint,
          tag
        });
      } else {
        // NEW: Create a new Topic in its own dedicated place!
        const topicTitle = segment.length > 40
          ? `${tag}: ${segment.slice(0, 35)}...`
          : `${tag}: ${segment}`;

        const newTopic: TopicItem = {
          id: `top_new_${Date.now()}_${sIdx}`,
          title: topicTitle,
          estimatedMinutes: 10,
          notes: `נושא חדש שנוצר אוטומטית על סמך מידע נוסף שהוזן: "${segment.slice(0, 60)}..."`,
          talkingPoints: [
            `🏷️ [מידע חדש - ${tag}] ${segment}`,
            `ניתוח ההשפעה של פרט זה על מכלול היצירה וההקשר הרחב`,
            `דיון ביקורתי וזווית השוואתית מול מקרים דומים`
          ],
          questions: [
            `כיצד הגילוי אודות ${tag} מאיר את הסרט באור שונה?`
          ],
          resources: [],
          completed: false,
          order: updatedTopics.length + 1
        };

        updatedTopics.push(newTopic);
        newCount++;

        actions.push({
          action: 'created_new',
          type: 'topic',
          targetTitle: topicTitle,
          explanation: `המידע מהווה נושא חדש שלא כוסה בנושאים הקיימים, ונוצר עבורו פרק עצמאי חדש.`,
          taggedContent: segment,
          tag
        });
      }
    }

    // 2. FACTS INTEGRATION
    if (targetScope === 'all' || targetScope === 'facts') {
      let bestFactMatchIndex = -1;
      let highestFactScore = 0;

      for (let fIdx = 0; fIdx < updatedFacts.length; fIdx++) {
        const fact = updatedFacts[fIdx];
        const factKeywords = new Set(extractKeywords(`${fact.fact} ${(fact.tags || []).join(' ')}`));

        let score = 0;
        if (fact.category === category) score += 2;

        for (const kw of segmentKeywords) {
          if (factKeywords.has(kw)) score += 2;
        }

        if (score > highestFactScore) {
          highestFactScore = score;
          bestFactMatchIndex = fIdx;
        }
      }

      // If high overlap with existing fact, enrich it
      if (highestFactScore >= 5 && bestFactMatchIndex !== -1) {
        const targetFact = updatedFacts[bestFactMatchIndex];
        const updatedFactText = `${targetFact.fact} | [העשרה: ${segment}]`;
        
        targetFact.fact = updatedFactText;
        if (!targetFact.tags) targetFact.tags = [];
        if (!targetFact.tags.includes('הועשר')) targetFact.tags.push('הועשר');
        if (!targetFact.tags.includes(tag)) targetFact.tags.push(tag);

        actions.push({
          action: 'matched_existing',
          type: 'fact',
          targetTitle: `כרטיסיית [${targetFact.category}]`,
          explanation: `המידע חובר והעשיר כרטיסיית עובדה קיימת בקטגוריית "${tag}".`,
          taggedContent: segment,
          tag
        });
      } else {
        // Create new Fact card in its own place!
        const newFact: MovieFactCard = {
          id: `fact_new_${Date.now()}_${sIdx}`,
          movieTitle: episodeTitle,
          category,
          fact: segment,
          source: 'מידע נוסף שהוזן',
          tags: [tag, 'מידע נוסף', episodeTitle],
          isPinnedToHUD: true,
          seriesOrder: updatedFacts.length + 1
        };

        updatedFacts.unshift(newFact); // Place prominent at top or ordered

        actions.push({
          action: 'created_new',
          type: 'fact',
          targetTitle: `כרטיסייה חדשה: ${tag}`,
          explanation: `המידע נשמר ככרטיסיית עובדה חדשה במקום משלה עם תיוג "${tag}".`,
          taggedContent: segment,
          tag
        });
      }
    }
  }

  return {
    success: true,
    source: 'Built-in Local Smart Integrator',
    summary: {
      matchedCount,
      newCount,
      actions
    },
    updatedTopics,
    updatedFacts
  };
}

// Main exported function: attempts Server-Side AI with Gemini API, falls back cleanly to local
export async function smartIntegrateAdditionalInfo(params: {
  additionalInfo: string;
  existingTopics: TopicItem[];
  existingFacts: MovieFactCard[];
  episodeTitle: string;
  targetScope?: 'all' | 'topics' | 'facts';
  apiKey?: string;
}): Promise<SmartIntegrationResult> {
  const {
    additionalInfo,
    existingTopics,
    existingFacts,
    episodeTitle,
    targetScope = 'all',
    apiKey
  } = params;

  if (!additionalInfo || !additionalInfo.trim()) {
    return {
      success: false,
      source: 'Empty Input',
      summary: { matchedCount: 0, newCount: 0, actions: [] },
      updatedTopics: existingTopics,
      updatedFacts: existingFacts
    };
  }

  const effectiveKey = (apiKey || getStoredGeminiApiKey() || '').trim();

  // 1. Try Server-Side API endpoint
  try {
    const res = await fetch('/api/ai/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'smart_integrate_info',
        additionalInfo: additionalInfo.trim(),
        existingTopics,
        existingFacts,
        episodeTitle,
        targetScope,
        apiKey: effectiveKey || undefined
      })
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          success: true,
          source: json.source || 'Gemini AI Smart Integrator',
          summary: json.data.summary || { matchedCount: 0, newCount: 0, actions: [] },
          updatedTopics: json.data.updatedTopics || existingTopics,
          updatedFacts: json.data.updatedFacts || existingFacts
        };
      }
    }
  } catch (err) {
    console.warn('Server-side smart integration unavailable, running local smart engine:', err);
  }

  // 2. Direct Gemini Call from Client if Server wasn't reachable
  if (effectiveKey && effectiveKey.length >= 10) {
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
    const prompt = `
אתה עורך תוכן, תסריטאי ומנהל מחקר פודקאסטים ראשי.
לפניך פרק פודקאסט בנושא: "${episodeTitle}".

להלן ראשי הפרקים ונושאי השיחה הקיימים כרגע (${existingTopics.length}):
${existingTopics.map((t, i) => `${i + 1}. [מזהה: ${t.id}] כותרת: "${t.title}" | נקודות שיחה: ${t.talkingPoints.join(' • ')}`).join('\n')}

להלן כרטיסיות עובדות הקולנוע הקיימות כרגע (${existingFacts.length}):
${existingFacts.map((f, i) => `${i + 1}. [מזהה: ${f.id}] קטגוריה: [${f.category}] | עובדה: "${f.fact}"`).join('\n')}

המשתמש הזין כעת "מידע נוסף":
"""
${additionalInfo}
"""

משימתך המדויקת:
סווג כל פיסת מידע בטקסט הנוסף:
1. אם המידע מתקשר לנושא קיים -> תייג אותו ושייך אותו לאותו נושא קיים כנקודת שיחה מתויגת (למשל: "🏷️ [תוספת: תגית] ...").
2. אם המידע מהווה נושא חדש שלא קיים -> צור עבורו נושא חדש ועצמאי במקום משלו (עם כותרת, זמן, נקודות שיחה מפורטות).
3. אם רלוונטי לעובדות קולנוע -> מזג לעובדה קיימת או צור כרטיסיית עובדה חדשה במקום משלה עם קטגוריה מדויקת ותגית.

החזר אך ורק JSON תקין במבנה הבא:
{
  "summary": {
    "matchedCount": 2,
    "newCount": 1,
    "actions": [
      {
        "action": "matched_existing",
        "type": "topic",
        "targetTitle": "שם הנושא הקיים",
        "explanation": "הסבר בעברית מדוע המידע תוייג לנושא זה",
        "taggedContent": "הטקסט המתויג",
        "tag": "עלילה"
      },
      {
        "action": "created_new",
        "type": "topic",
        "targetTitle": "כותרת הנושא החדש",
        "explanation": "הסבר מדוע נוצר נושא חדש במקום משלו",
        "taggedContent": "תוכן המידע",
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
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3
              }
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
            if (parsed.updatedTopics || parsed.updatedFacts) {
              return {
                success: true,
                source: `Direct Gemini AI (${model})`,
                summary: parsed.summary || { matchedCount: 0, newCount: 0, actions: [] },
                updatedTopics: parsed.updatedTopics || existingTopics,
                updatedFacts: parsed.updatedFacts || existingFacts
              };
            }
          }
        }
      } catch (geminiErr) {
        console.warn(`Model ${model} failed:`, geminiErr);
      }
    }
  }

  // 3. Fallback to local integration engine
  return integrateLocally(additionalInfo, existingTopics, existingFacts, episodeTitle, targetScope);
}
