import { NextRequest, NextResponse } from 'next/server';
import { smartRebalanceSubtitles, buildSubtitlesFromWhisperWords, splitTextIntoPacedSubtitles, cleanAndPolishHebrewSubtitleText } from '@/lib/audioUtils';

// Free Google Translate fallback (fast, zero API key required)
async function freeTranslateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const clean = text.trim();
  if (!clean) return '';
  try {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const tl = targetLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(clean)}`;
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
      audioBase64, 
      mimeType = 'audio/wav', 
      wordsPerLine = 4, 
      duration = 60,
      apiKey, 
      openaiApiKey,
      provider = 'auto',
      spokenLanguage = 'auto',
      translateToHebrew = false,
      highEffortMode = true
    } = body;

    const geminiKey = (apiKey && apiKey.trim()) 
      ? apiKey.trim() 
      : process.env.GEMINI_API_KEY;

    const openaiKey = (openaiApiKey && openaiApiKey.trim())
      ? openaiApiKey.trim()
      : process.env.OPENAI_API_KEY;

    if (!audioBase64) {
      return NextResponse.json(
        { error: 'לא התקבל קובץ אודיו לתמלול' },
        { status: 400 }
      );
    }

    if (!geminiKey && !openaiKey) {
      return NextResponse.json(
        { 
          error: 'נא להזין מפתח API של Google Gemini או OpenAI Whisper בהגדרות ה-AI, או להשתמש בתמלול הישיר בדפדפן (ללא מפתח / חינם).' 
        },
        { status: 401 }
      );
    }

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    const sanitizedMime = (mimeType || 'audio/wav').split(';')[0].trim() || 'audio/wav';

    let lastErrorDetails = '';

    // 1. If OpenAI Whisper is requested or available
    if ((provider === 'openai' || (!geminiKey && openaiKey)) && openaiKey) {
      try {
        const audioBuffer = Buffer.from(cleanBase64, 'base64');
        const fileExt = sanitizedMime.includes('mp4') ? 'mp4' 
          : sanitizedMime.includes('webm') ? 'webm' 
          : sanitizedMime.includes('mpeg') || sanitizedMime.includes('mp3') ? 'mp3' 
          : 'wav';
        const fileBlob = new Blob([audioBuffer], { type: sanitizedMime });

        // Attempt A: Detailed Word-Level Verbose JSON
        let formData = new FormData();
        formData.append('file', fileBlob, `recording.${fileExt}`);
        formData.append('model', 'whisper-1');
        if (spokenLanguage && spokenLanguage !== 'auto') {
          formData.append('language', spokenLanguage);
        }
        if (spokenLanguage === 'he' || (!spokenLanguage && !translateToHebrew)) {
          formData.append('prompt', highEffortMode 
            ? 'תמלול עברית מלא ומדויק מילה במילה. פענוח מדויק גם של דיבור עמום, חלש, מהיר או ממלמל, ללא דילוג על מילים.'
            : 'תמלול עברית מלא ומדויק מילה במילה.');
        }
        formData.append('temperature', '0');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'word');

        let whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${openaiKey}` },
          body: formData
        });

        // Attempt B: Fallback to standard JSON if verbose_json failed
        if (!whisperRes.ok) {
          const errData = await whisperRes.json().catch(() => ({}));
          const errMsg = errData.error?.message || '';
          
          // If error is quota or auth, fail immediately with clear guidance
          if (whisperRes.status === 401 || whisperRes.status === 429 || errMsg.includes('quota') || errMsg.includes('key')) {
            const quotaHelp = errMsg.includes('quota')
              ? 'נגמרה יתרת הקרדיטים בחשבון ה-OpenAI שלכם. נא להטעין קרדיטים ב-OpenAI Platform, או להשתמש ב-Google Gemini בחינם ללא הגבלה!'
              : `שגיאת אימות מול OpenAI: ${errMsg}`;
            return NextResponse.json({ error: quotaHelp }, { status: 400 });
          }

          // Retry with simple JSON format
          formData = new FormData();
          formData.append('file', fileBlob, `recording.${fileExt}`);
          formData.append('model', 'whisper-1');
          if (spokenLanguage && spokenLanguage !== 'auto') {
            formData.append('language', spokenLanguage);
          }
          if (spokenLanguage === 'he' || (!spokenLanguage && !translateToHebrew)) {
            formData.append('prompt', highEffortMode 
              ? 'תמלול עברית מלא ומדויק מילה במילה. פענוח מדויק גם של דיבור עמום, חלש, מהיר או ממלמל, ללא דילוג על מילים.'
              : 'תמלול עברית מלא ומדויק מילה במילה.');
          }
          formData.append('temperature', '0');

          whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}` },
            body: formData
          });
        }

        if (whisperRes.ok) {
          const whisperJson = await whisperRes.json();
          let formattedSubtitles: any[] = [];

          if (whisperJson.words && whisperJson.words.length > 0) {
            formattedSubtitles = buildSubtitlesFromWhisperWords(whisperJson.words, wordsPerLine);
          } else if (whisperJson.segments && whisperJson.segments.length > 0) {
            const raw = whisperJson.segments.map((seg: any, idx: number) => ({
              id: `sub_whisper_${Date.now()}_${idx}`,
              startTime: Number(Number(seg.start).toFixed(2)),
              endTime: Number(Number(seg.end).toFixed(2)),
              text: String(seg.text || '').trim()
            })).filter((s: any) => s.text.length > 0);

            formattedSubtitles = smartRebalanceSubtitles(raw, wordsPerLine, 1);
          } else if (whisperJson.text) {
            formattedSubtitles = splitTextIntoPacedSubtitles(
              whisperJson.text,
              wordsPerLine,
              1,
              0,
              Math.max(10, duration || 60)
            );
          }

          if (formattedSubtitles.length > 0) {
            // If user requested Hebrew translation and output is English/other, translate each subtitle
            if (translateToHebrew) {
              for (let k = 0; k < formattedSubtitles.length; k++) {
                if (/[a-zA-Z]/.test(formattedSubtitles[k].text)) {
                  formattedSubtitles[k].text = await freeTranslateText(formattedSubtitles[k].text, spokenLanguage || 'auto', 'he');
                }
              }
            }

            return NextResponse.json({
              success: true,
              subtitles: formattedSubtitles,
              source: translateToHebrew ? 'OpenAI Whisper + תרגום לעברית' : 'OpenAI Whisper (דיוק אקוסטי מילה במילה)'
            });
          }
        } else {
          const errJson = await whisperRes.json().catch(() => ({}));
          lastErrorDetails = errJson.error?.message || `OpenAI Error ${whisperRes.status}`;
          console.warn('Whisper API error:', lastErrorDetails);
          if (provider === 'openai') {
            const isQuota = lastErrorDetails.includes('quota');
            const customMsg = isQuota
              ? 'נגמרה יתרת הקרדיטים בחשבון ה-OpenAI שלכם. מומלץ להשתמש ב-Google Gemini בחינם ללא הגבלה בהגדרות ה-AI!'
              : `שגיאת OpenAI Whisper: ${lastErrorDetails}`;
            return NextResponse.json(
              { error: customMsg },
              { status: 400 }
            );
          }
        }
      } catch (whisperErr: any) {
        lastErrorDetails = whisperErr.message;
        console.warn('Whisper processing error:', whisperErr);
        if (provider === 'openai') {
          return NextResponse.json({ error: whisperErr.message }, { status: 500 });
        }
      }
    }

    // 2. Google Gemini Audio Understanding Pipeline
    if (geminiKey) {
      const highEffortInstructions = highEffortMode ? `
הנחיות התאמצות ודיוק מרבי (High-Effort Deep Acoustic & Contextual Recognition):
- הקדש מאמץ אקוסטי והקשרי מקסימלי לפענוח קטעים עמומים, דיבור חלש, לחישות, דיבור מהיר, בליעת מילים, מלמול, או רעשי רקע.
- שחזור פונטי והקשרי (Contextual Phonetic Recovery): אם מילה או הברה אינה נשמעת בצורה חדה או נבלעה על ידי הדובר, נתח את ההקשר התחבירי והנושאי של המשפט ושחזר בדיוק את המילה שהדובר התכוון לומר. לעולם אל תוותר ואל תדלג על אף מילה או משפט!
- סנכרון תזמונים מדויק: התאם את ה-startTime בדיוק לרגע תחילת הגיית המילה הראשונה, ואת ה-endTime בדיוק לסיום המילה האחרונה בשורת הכתובית.` : '';

      const prompt = translateToHebrew ? `
אתה מודל תמלול ותרגום אודיו מקצועי ומתקדם ביותר לפודקאסטים וסרטוני תוכן.
האזן ישירות לקובץ האודיו המצורף (שעשוי להיות באנגלית או בכל שפה אחרת).
תמלל ותרגם את כל מה שנאמר ישירות לעברית טבעית, תקנית, קולחת ומדויקת (Speech-to-Hebrew Subtitle Translation).

${highEffortInstructions}

הנחיות איכות קריטיות:
1. תרגם 100% ממה שנאמר לעברית. חל איסור להשאיר טקסט באנגלית (למעט שמות מותגים מוכרים במידת הצורך).
2. חלק לשורות כתוביות קצרות וקצביות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בכל שורה.
3. ספק תזמון מדויק בשניות (startTime, endTime) לכל שורת כתובית שתואם בדיוק את זמן הדיבור באודיו (משך קטע זה: ${duration} שניות).
4. הקפד על עברית תקנית, פיסוק מדויק וללא קיצורים.

החזר אך ורק מערך JSON תקין במבנה הבא:
[
  {
    "startTime": 1.2,
    "endTime": 3.8,
    "text": "שלום לכולם וברוכים הבאים"
  },
  {
    "startTime": 4.1,
    "endTime": 6.9,
    "text": "היום בסרטון נדבר על הנושא המרכזי"
  }
]
` : `
אתה מודל תמלול אודיו מקצועי ומתקדם ביותר לפודקאסטים וסרטונים בעברית ברמת דיוק פונטית מקסימלית (Deep Verbatim Hebrew Speech-to-Text).
האזן ישירות לקובץ האודיו המצורף ותמלל בדיוק של 100% מילה במילה את מה שנאמר בפועל בהקלטה.

${highEffortInstructions}

הנחיות איכות קריטיות:
1. תמלל בדיוק של 100% מילה במילה את כל המילים שנאמרו בהקלטה. חל איסור מוחלט להשמיט אף מילה, אף משפט ואף הברה.
2. חלק לשורות כתוביות קצרות וקצביות של ${wordsPerLine} עד ${wordsPerLine + 2} מילים בכל שורה.
3. ספק תזמון מדויק בשניות (startTime, endTime) לכל שורת כתובית שתואם בדיוק את זמן הדיבור באודיו (משך כולל: ${duration} שניות).
4. הקפד על עברית תקנית, פיסוק מדויק וללא קיצורים.

החזר אך ורק מערך JSON תקין במבנה הבא:
[
  {
    "startTime": 1.2,
    "endTime": 3.8,
    "text": "שלום לכולם וברוכים הבאים"
  },
  {
    "startTime": 4.1,
    "endTime": 6.9,
    "text": "היום בפרק נדבר על הקולנוע"
  }
]
`;

      const models = highEffortMode 
        ? ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] 
        : ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-8b'];
      
      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };

          const payload = {
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: sanitizedMime,
                      data: cleanBase64
                    }
                  },
                  {
                    text: prompt
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: highEffortMode ? 0.05 : 0.1
            }
          };

          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });

          if (res.ok) {
            const json = await res.json();
            const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText && rawText.trim().length > 0) {
              const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
              let rawSubtitles: any = null;
              
              // 1. Try JSON array parse
              try {
                rawSubtitles = JSON.parse(cleanText);
              } catch {
                const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
                if (arrayMatch) {
                  try {
                    rawSubtitles = JSON.parse(arrayMatch[0]);
                  } catch {}
                }
              }

              const subsList = Array.isArray(rawSubtitles) 
                ? rawSubtitles 
                : (rawSubtitles?.subtitles || rawSubtitles?.items || []);

              if (subsList.length > 0) {
                let formatted = subsList.map((s: any, idx: number) => ({
                  id: `sub_spoken_${Date.now()}_${idx}`,
                  startTime: Number(Number(s.startTime || s.start || idx * 3).toFixed(2)),
                  endTime: Number(Number(s.endTime || s.end || (idx + 1) * 3).toFixed(2)),
                  text: String(s.text || s.content || '').trim()
                })).filter((s: any) => s.text.length > 0);

                if (translateToHebrew) {
                  for (let k = 0; k < formatted.length; k++) {
                    if (/[a-zA-Z]/.test(formatted[k].text)) {
                      formatted[k].text = await freeTranslateText(formatted[k].text, spokenLanguage || 'auto', 'he');
                    }
                  }
                }

                const rebalanced = smartRebalanceSubtitles(formatted, wordsPerLine, 1);

                return NextResponse.json({
                  success: true,
                  subtitles: rebalanced,
                  source: translateToHebrew 
                    ? `Google Gemini תרגום לעברית (${model})` 
                    : `Google Gemini Audio Understanding (${model})`
                });
              }

              // 2. Verbatim Plain Text Fallback
              let plainTextToProcess = cleanText;
              if (translateToHebrew && /[a-zA-Z]/.test(plainTextToProcess)) {
                plainTextToProcess = await freeTranslateText(plainTextToProcess, spokenLanguage || 'auto', 'he');
              }
              const plainHebrew = cleanAndPolishHebrewSubtitleText(plainTextToProcess);
              if (plainHebrew.length > 0) {
                const pacedSubtitles = splitTextIntoPacedSubtitles(
                  plainHebrew,
                  wordsPerLine,
                  1,
                  0,
                  Math.max(10, duration || 60)
                );

                if (pacedSubtitles.length > 0) {
                  return NextResponse.json({
                    success: true,
                    subtitles: pacedSubtitles,
                    source: translateToHebrew 
                      ? `Google Gemini תרגום לעברית (${model})` 
                      : `Google Gemini Audio Speech-to-Text (${model})`
                  });
                }
              }
            }
          } else {
            const errJson = await res.json().catch(() => ({}));
            lastErrorDetails = errJson.error?.message || `Google API Error ${res.status}`;
            console.warn(`Gemini API Error with ${model}:`, lastErrorDetails);
          }
        } catch (err: any) {
          lastErrorDetails = err.message === 'fetch failed' 
            ? 'שגיאת תקשורת עם שרת Google Gemini (fetch failed)'
            : err.message;
          console.warn(`Fetch error with ${model}:`, err.message);
        }
      }
    }

    const friendlyError = lastErrorDetails 
      ? `שגיאת עיבוד: ${lastErrorDetails}. ודאו שמפתח ה-API תקין ופעיל בהגדרות ה-AI.`
      : 'שגיאה בעיבוד האודיו. ודאו שהמפתח שהוזן תקין ושקובץ האודיו כולל דיבור ברור.';

    return NextResponse.json(
      { error: friendlyError },
      { status: 400 }
    );
  } catch (error: any) {
    const isFetchFail = error?.message === 'fetch failed';
    const errText = isFetchFail 
      ? 'שגיאת תקשורת ברשת מול שרתי ה-AI (fetch failed). נסו שוב או השתמשו בתמלול מנושאי הפרק / הכתבה חיה בדפדפן.'
      : (error?.message || 'שגיאת שרת פנימית בתמלול');

    return NextResponse.json(
      { error: errText },
      { status: 500 }
    );
  }
}
