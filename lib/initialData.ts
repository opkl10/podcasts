import { Episode, PodcastShow } from './types';

export const INITIAL_PODCASTS: PodcastShow[] = [
  {
    id: 'pod-tech',
    title: 'טק & קוד בדרכים (Tech & Code)',
    description: 'פודקאסט שבועי על עולם הפיתוח, ארכיטקטורת תוכנה, AI וטכנולוגיות העתיד.',
    category: 'טכנולוגיה',
    coverColor: 'from-indigo-600 to-purple-600',
    hostName: 'עומר כהן',
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    id: 'pod-startup',
    title: 'מ-0 ל-1: יזמות וסטארטאפים',
    description: 'ראיונות עומק עם יזמים ומייסדים על הדרך מרעיון ראשוני עד לגיוס הון והצלחה.',
    category: 'עסקים ויזמות',
    coverColor: 'from-amber-600 to-rose-600',
    hostName: 'עומר כהן',
    createdAt: '2026-08-05T00:00:00.000Z'
  }
];

export const INITIAL_EPISODES: Episode[] = [
  {
    id: 'ep-001',
    podcastId: 'pod-tech',
    title: 'עתיד ה-AI והפיתוח: איך סוכני קוד משנים את חוקי המשחק',
    episodeNumber: 1,
    season: 1,
    status: 'ready',
    description: 'בפרק זה נארח את ד"ר אלון כהן, חוקר ומהנדס בינה מלאכותית, לשיחה מרתקת על מהפכת ה-Coding Agents, השפעתם על שוק העבודה וכיצד לבנות פרויקטים פי 10 מהר יותר.',
    guest: {
      name: 'ד"ר אלון כהן',
      role: 'VP AI Research & Head of Autonomous Systems',
      bio: 'חוקר בינה מלאכותית מוביל, יזם סדרתי ומרצה לפיתוח מערכות אוטונומיות.',
      links: [
        { platform: 'Twitter/X', url: 'https://twitter.com' },
        { platform: 'LinkedIn', url: 'https://linkedin.com' }
      ]
    },
    targetDurationMinutes: 45,
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-28T18:30:00.000Z',
    tags: ['AI', 'פיתוח תוכנה', 'טכנולוגיה', 'סטארטאפים'],
    topics: [
      {
        id: 'top-1',
        title: 'פתיח והצגת האורח',
        estimatedMinutes: 5,
        notes: 'להציג את הרקע של אלון, מה הוביל אותו לתחום ה-AI והחזון שלו לשנים הקרובות.',
        talkingPoints: [
          'ברוכים הבאים לפודקאסט - פרק פתיחה חגיגי',
          'הצגת האורח: ד"ר אלון כהן - ממובילי המחקר בישראל',
          'טיזר קצר: מהם 3 הכלים שכל מתכנת חייב להכיר היום'
        ],
        questions: [
          'אלון, איך הגעת מהעולם האקדמי לעבודה על סוכני בינה מלאכותית פרקטיים?',
          'מה הרגע שבו הבנת שעולם הפיתוח הולך להשתנות לתמיד?'
        ],
        resources: [
          { id: 'res-1', title: 'המאמר האחרון על Autonomous Agents', url: 'https://arxiv.org' }
        ],
        completed: false,
        order: 1
      },
      {
        id: 'top-2',
        title: 'מהפכת סוכני ה-AI לעומת Chatbots רגילים',
        estimatedMinutes: 15,
        notes: 'הסבר מעמיק על ההבדל בין מודל טקסט פסיבי (LLM) לבין Agent בעל כלים, זיכרון ותכנון עצמאי.',
        talkingPoints: [
          'ההבדל העקרוני בין Chatbot שעונה על שאלות ל-Agent שמבצע משימות',
          'תכנון רב-שלבי (Multi-step Reasoning) ושימוש בכלים (Tool Calling)',
          'ארכיטקטורות מובילות: ReAct, Tree of Thoughts, Sub-agents'
        ],
        questions: [
          'למה סוכנים עצמאיים נחשבים לקפיצת מדרגה הרבה יותר גדולה ממודל שפה רגיל?',
          'איפה נמצא צוואר הבקבוק העיקרי היום בבניית סוכנים אמינים?'
        ],
        resources: [
          { id: 'res-2', title: 'DeepMind Agent Frameworks', url: 'https://deepmind.google' }
        ],
        completed: false,
        order: 2
      },
      {
        id: 'top-3',
        title: 'איך לתכנן ולפתח עם סוכני AI בפועל',
        estimatedMinutes: 15,
        notes: 'דוגמאות חיות ופרקטיות: תהליך Pair Programming, כתיבת טסטים אוטומטית וארכיטקטורה.',
        talkingPoints: [
          'שילוב סוכנים ב-IDE ובסביבת הפיתוח המודרנית',
          'שיטת עבודה מומלצת: תכנון תחילה (Planning Phase) ואז ביצוע (Execution)',
          'שמירה על איכות הקוד ומניעת הזיות קוד (Code Hallucinations)'
        ],
        questions: [
          'מה ההמלצה הכי טובה שלך למפתח שרוצה להתחיל להשתמש בסוכנים בעבודה היומיומית?',
          'האם בעתיד עדיין נצטרך לכתוב שורות קוד ידנית?'
        ],
        resources: [],
        completed: false,
        order: 3
      },
      {
        id: 'top-4',
        title: 'סיכום, שאלות בזק וטיפ הזהב למאזינים',
        estimatedMinutes: 10,
        notes: 'סבב שאלות מהירות, סגירת הפרק והמלצות להמשך מעקב ברשתות.',
        talkingPoints: [
          'שאלות בזק: שפת תכנות אהובה, מודל מועדף, הרגל בוקר',
          'טיפ אחד שכל יזם או מפתח צריכים ליישם מחר בבוקר',
          'איפה אפשר למצוא את אלון ברשת'
        ],
        questions: [
          'אם היית צריך לבחור רק ספר אחד או מקור ידע אחד להמליץ עליו - מה הוא היה?',
          'מה המשאלה הטכנולוגית שלך לשנה הקרובה?'
        ],
        resources: [],
        completed: false,
        order: 4
      }
    ]
  },
  {
    id: 'ep-002',
    podcastId: 'pod-startup',
    title: 'בניית מוצר מ-0 ל-1: מסטארטאפ לגיוס סבב A',
    episodeNumber: 1,
    season: 1,
    status: 'research',
    description: 'איך מאמתים רעיון מוצרי במהירות, בונים MVP אפקטיבי ומגייסים משקיעים ראשונים. שיחה עם יזמת ומייסדת בתחום ה-SaaS.',
    guest: {
      name: 'מיכל שחר',
      role: 'Co-Founder & CEO at CloudPulse',
      bio: 'מייסדת סטארטאפ בתחום ניטור ענן שגייס 12M$, בוגרת 8200 ו-Y Combinator.',
      links: [{ platform: 'LinkedIn', url: 'https://linkedin.com' }]
    },
    targetDurationMinutes: 40,
    createdAt: '2026-08-25T14:00:00.000Z',
    updatedAt: '2026-08-27T11:20:00.000Z',
    tags: ['סטארטאפים', 'יזמות', 'גיוס הון', 'Product'],
    topics: [
      {
        id: 'top-201',
        title: 'אימות הרעיון הראשוני (Validation)',
        estimatedMinutes: 10,
        notes: 'לדבר על שיחות עם 50 לקוחות פוטנציאליים לפני כתיבת שורת קוד אחת.',
        talkingPoints: ['טכניקת The Mom Test', 'איך לדעת מתי רעיון שווה השקעה'],
        questions: ['איך ידעת שהבעיה שפתרתם שווה מוצר בתשלום?'],
        resources: [],
        completed: false,
        order: 1
      },
      {
        id: 'top-202',
        title: 'בניית ה-MVP וגיוס לקוחות ראשונים',
        estimatedMinutes: 15,
        notes: 'בנייה מהירה, חיתוך פיצ\'רים לא קריטיים, וקבלת פידבק ראשוני.',
        talkingPoints: ['מה חובה ב-MVP ועל מה לוותר', 'השגת 10 הלקוחות המשלמים הראשונים'],
        questions: ['מה היה הויתור הכי כואב שעשיתם בגרסה הראשונה?'],
        resources: [],
        completed: false,
        order: 2
      }
    ]
  },
  {
    id: 'ep-cinema-001',
    podcastId: 'pod-tech',
    title: 'אינספשן (Inception) - עשור לסרט המופת: סודות הפקה, ציונים ועובדות',
    episodeNumber: 3,
    season: 1,
    status: 'ready',
    description: 'ניתוח מעמיק ומאחורי הקלעים של סרט המדע הבדיוני האייקוני של כריסטופר נולאן: איך צולמה סצנת המסדרון המסתובב ללא CGI, מה הסוד האמיתי של הסביבון בסיום, והציונים ב-IMDb ו-Rotten Tomatoes.',
    guest: {
      name: 'יונתן גולדשטיין',
      role: 'מבקר קולנוע ומרצה לתולדות הקולנוע',
      bio: 'חוקר קולנוע ומפיק תוכן, מחבר הספר "השפה הסודית של כריסטופר נולאן".'
    },
    targetDurationMinutes: 50,
    createdAt: '2026-08-28T12:00:00.000Z',
    updatedAt: '2026-08-29T10:00:00.000Z',
    tags: ['קולנוע', 'אינספשן', 'נולאן', 'מאחורי הקלעים', 'IMDb', 'ביקורות'],
    topics: [
      {
        id: 'top-c1',
        title: 'פתיח: התופעה הקולנועית שנקראת אינספשן',
        estimatedMinutes: 8,
        notes: 'הסבר על ההצלחה הקופתית (836M$) ו-4 פרסי האוסקר.',
        talkingPoints: [
          'למה הסרט עדיין רלוונטי ומעורר דיונים יותר מעשור אחרי שיצא',
          'הקונספט המבריק של שוד בתוך חלום (Heist in a Dream)',
          'הציונים הגבוהים ב-IMDb (8.8/10) ו-Rotten Tomatoes (87%)'
        ],
        questions: [
          'יונתן, מתי בפעם הראשונה צפית בסרט ומה הייתה התגובה שלך לסוף?',
          'מה מייחד את נולאן כיוצר שמשלב בלוקבסטר ענק עם עלילה מורכבת?'
        ],
        resources: [
          { id: 'rc-1', title: 'IMDb Inception Page', url: 'https://www.imdb.com/title/tt1375666/' }
        ],
        completed: false,
        order: 1
      },
      {
        id: 'top-c2',
        title: 'מאחורי הקלעים: סצנת המסדרון המסתובב והאפקטים',
        estimatedMinutes: 15,
        notes: 'ההחלטה של נולאן לוותר כמעט לחלוטין על CGI ולבנות צנטריפוגה ענקית.',
        talkingPoints: [
          'בניית המסדרון המסתובב באורך 30 מטרים',
          'האימונים המפרכים של ג׳וזף גורדון-לוויט',
          'הפסקול של הנס זימר והאטת השיר של אדית פיאף'
        ],
        questions: [
          'איך ההתעקשות על אפקטים מעשיים משפיעה על האמינות שמרגיש הצופה?'
        ],
        resources: [],
        completed: false,
        order: 2
      },
      {
        id: 'top-c3',
        title: 'סוד הסיום והוויכוח הנצחי: האם הסביבון נפל?',
        estimatedMinutes: 12,
        notes: 'הציטוט של מייקל קיין שמכריע את הוויכוח.',
        talkingPoints: [
          'הטוטם האמיתי של קוב - הטבעת נישואין לעומת הסביבון',
          'הווידוי של מייקל קיין: "אם אני בסצנה - זו המציאות"',
          'המסר הפילוסופי של נולאן על חזרה למשפחה'
        ],
        questions: [
          'האם חשוב בכלל לדעת אם זה היה חלום או מציאות?'
        ],
        resources: [],
        completed: false,
        order: 3
      }
    ],
    movieFacts: [
      {
        id: 'fact-1',
        movieTitle: 'אינספשן (Inception)',
        category: 'behind_the_scenes',
        fact: 'סצנת הקרב המפורסמת במסדרון המסתובב צולמה כולה ללא CGI. ההפקה בנתה מסדרון צנטריפוגלי ענק באורך 30 מטרים שהסתובב 360 מעלות.',
        source: 'IMDb',
        sourceUrl: 'https://www.imdb.com/title/tt1375666/',
        ratingScore: '8.8/10 (Top #14)',
        year: '2010',
        tags: ['אפקטים מעשיים', 'ג׳וזף גורדון-לוויט', 'פעלולים'],
        isPinnedToHUD: true
      },
      {
        id: 'fact-2',
        movieTitle: 'אינספשן (Inception)',
        category: 'easter_egg',
        fact: 'השיר "Non, je ne regrette rien" של אדית פיאף הוא הבסיס לכל הפסקול של הנס זימר. זימר האט את השיר פי כמה כדי ליצור את צליל ה-"BRAAAM" האייקוני.',
        source: 'Letterboxd',
        year: '2010',
        tags: ['הנס זימר', 'פסקול', 'סודות מוזיקה'],
        isPinnedToHUD: true
      },
      {
        id: 'fact-3',
        movieTitle: 'אינספשן (Inception)',
        category: 'trivia',
        fact: 'מייקל קיין אישר שהסביבון בסוף כן נופל: נולאן אמר לו "אם אתה בסצנה - זו המציאות, אם אתה לא בסצנה - זה חלום". מאחר שקיין מופיע בסצנת הסיום, קוב באמת חזר לילדיו.',
        source: 'Variety / Empire',
        year: '2010',
        tags: ['סוף הסרט', 'מייקל קיין', 'הסביבון'],
        isPinnedToHUD: true
      },
      {
        id: 'fact-4',
        movieTitle: 'אינספשן (Inception)',
        category: 'critical_reception',
        fact: 'הסרט זכה ב-4 פרסי אוסקר (צילום, מיקס סאונד, עריכת סאונד ואפקטים ויזואליים) והכניס מעל 836 מיליון דולר ברחבי העולם.',
        source: 'Rotten Tomatoes',
        ratingScore: '87% Critics | 91% Audience',
        year: '2010',
        tags: ['אוסקר', 'שיאי קופות', 'ביקורות']
      },
      {
        id: 'fact-5',
        movieTitle: 'אינספשן (Inception)',
        category: 'director_vision',
        fact: 'כריסטופר נולאן כתב את התסריט במשך קרוב ל-10 שנים. הוא רצה במקור לביים את הסרט כסרט אימה על עולם החלומות, לפני שהפך אותו לסרט שוד קולנועי.',
        source: 'Wikipedia',
        sourceUrl: 'https://he.wikipedia.org/wiki/%D7%90%D7%99%D7%A0%D7%A1%D7%A4%D7%A9%D7%9F',
        year: '2010',
        tags: ['כריסטופר נולאן', 'תסריט']
      }
    ]
  }
];
