# Podcast Studio - Guidelines & Rules

## Deployment & Updates
תמיד להוסיף בסיום כל עדכון או שינוי בקוד את פקודות הטרמינל המלאות להתחברות לשרת של Vercel ולעדכון.

### Vercel Commands:
```bash
# 1. ניווט לתיקיית הפרויקט
cd /Users/omerokon/.gemini/antigravity/scratch/podcast-studio

# 2. התחברות לחשבון Vercel (בפעם הראשונה - יש לבחור Continue with GitHub או להזין מייל)
npx vercel login

# 3. העלאה ועדכון לשרת (Production) - הפרויקט כבר מקושר ישירות ל-podcasts-73hz
npx vercel --prod --yes
```

> טיפ: להתקנה גלובלית קבועה של הפקודה `vercel` במחשב: `npm install -g vercel`

