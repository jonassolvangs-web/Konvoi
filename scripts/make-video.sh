#!/bin/bash
FFMPEG=$(node -e "console.log(require('ffmpeg-static'))")
DIR="demo-screenshots"
OUT="demo-tekniker.mp4"

# Create file list with 2 seconds per frame
FILELIST="$DIR/filelist.txt"
rm -f "$FILELIST"

for f in $(ls $DIR/*.png | sort); do
  echo "file '$(basename $f)'" >> "$FILELIST"
  echo "duration 2" >> "$FILELIST"
done
# Add last frame again (ffmpeg concat demuxer needs it)
LAST=$(ls $DIR/*.png | sort | tail -1)
echo "file '$(basename $LAST)'" >> "$FILELIST"

$FFMPEG -y -f concat -safe 0 -i "$FILELIST" \
  -vf "scale=780:1688:flags=lanczos,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -r 30 -movflags +faststart \
  "$OUT" 2>&1 | tail -5

echo ""
echo "Video info:"
$FFMPEG -i "$OUT" 2>&1 | grep -E "Duration|Video"
ls -lh "$OUT"
echo ""
echo "Done: $(pwd)/$OUT"
