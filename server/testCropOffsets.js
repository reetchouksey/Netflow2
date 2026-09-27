const ffmpeg = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Raw original recording from user's Captures folder (or backup)
const rawVideo = 'C:/Users/rchouksey/Videos/Captures/NetFlow and 13 more pages - Work - Microsoft? Edge 2026-09-25 14-30-16.mp4';
// Local copy
const input = path.join(__dirname, 'edited-demo-fast.mp4');

console.log('Extracting sample frames at crop y=120, y=140, y=150...');

// Let's test with input video (edited-demo-fast.mp4)
[120, 140, 150, 160].forEach(y => {
  const outImg = path.join(__dirname, `test-crop-y${y}.png`);
  const cmd = `"${ffmpeg}" -y -ss 00:00:25 -i "${input}" -vf "crop=in_w:in_h-${y}:0:${y}" -vframes 1 "${outImg}"`;
  try {
    execSync(cmd, { stdio: 'ignore' });
    console.log(`Saved frame test-crop-y${y}.png (${fs.statSync(outImg).size} bytes)`);
  } catch(e) {}
});
