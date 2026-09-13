#!/usr/bin/env bash

# Podcast & Gaming Studio — Apple-Compliant MP4 Video Converter
# Uses Mac Apple Silicon Hardware Acceleration (h264_videotoolbox) + AAC + yuv420p

set -e

FFMPEG_BIN=""
if [ -x "/opt/homebrew/bin/ffmpeg" ]; then
  FFMPEG_BIN="/opt/homebrew/bin/ffmpeg"
elif command -v ffmpeg >/dev/null 2>&1; then
  FFMPEG_BIN="$(command -v ffmpeg)"
elif [ -x "/usr/local/bin/ffmpeg" ]; then
  FFMPEG_BIN="/usr/local/bin/ffmpeg"
else
  echo "❌ שגיאה: כלי ffmpeg לא נמצא במחשב."
  exit 1
fi

# Detect encoder (Apple Silicon Hardware or CPU)
ENCODER="libx264"
EXTRA_FLAGS="-preset fast -crf 18"
if $FFMPEG_BIN -encoders 2>/dev/null | grep -q "h264_videotoolbox"; then
  ENCODER="h264_videotoolbox"
  EXTRA_FLAGS="-b:v 12M"
fi

echo "🎬 מנוע המרה פעיל: $ENCODER (Apple Silicon Hardware Accelerator)"

TARGET="$1"

# If a single file was passed
if [ -n "$TARGET" ] && [ -f "$TARGET" ]; then
  OUT_FILE="${TARGET%.*}.mp4"
  if [ "$OUT_FILE" = "$TARGET" ]; then
    OUT_FILE="${TARGET%.*}_converted.mp4"
  fi
  echo "⏳ ממיר את: $TARGET"
  echo "➡️ לקובץ: $OUT_FILE"
  
  $FFMPEG_BIN -i "$TARGET" \
    -c:v "$ENCODER" $EXTRA_FLAGS -pix_fmt yuv420p \
    -c:a aac -b:a 256k \
    -movflags +faststart \
    "$OUT_FILE" -y
    
  echo "✅ ההמרה הושלמה בהצלחה! הקובץ מוכן לפתיחה ב-QuickTime, Premiere ויוטיוב:"
  echo "📁 $OUT_FILE"
  exit 0
fi

# Otherwise scan ~/Downloads for any .webm files
DOWNLOADS_DIR="$HOME/Downloads"
echo "🔍 סורק קבצי WebM בתיקיית ההורדות ($DOWNLOADS_DIR)..."

FOUND=0
for f in "$DOWNLOADS_DIR"/*.webm; do
  [ -e "$f" ] || continue
  FOUND=$((FOUND + 1))
  OUT_FILE="${f%.webm}.mp4"
  echo ""
  echo "--------------------------------------------------------"
  echo "⏳ ממיר ($FOUND): $(basename "$f")"
  echo "➡️ יעד: $(basename "$OUT_FILE")"
  
  $FFMPEG_BIN -i "$f" \
    -c:v "$ENCODER" $EXTRA_FLAGS -pix_fmt yuv420p \
    -c:a aac -b:a 256k \
    -movflags +faststart \
    "$OUT_FILE" -y
    
  echo "✅ הושלם בהצלחה: $(basename "$OUT_FILE")"
done

if [ "$FOUND" -eq 0 ]; then
  echo "ℹ️ לא נמצאו קבצי .webm בתיקיית ההורדות."
  echo "שימוש לדוגמה בקובץ ספציפי:"
  echo "  npm run convert -- ~/Downloads/my-video.webm"
else
  echo ""
  echo "🎉 כל קבצי ה-WebM הומרו בהצלחה ל-MP4 תקני!"
fi
