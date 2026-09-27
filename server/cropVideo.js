const ffmpeg = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const input = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'netflow-demo.mp4');

// Crop the top 90px (browser tabs & URL address bar) and any side/bottom borders
// Input is 1920x1080.
// Top bar takes ~95px.
// Crop box: w=1920, h=1080-95 = 985, x=0, y=95
// Then scale back to clean 1920x1080 or aspect ratio
console.log('Testing crop with ffmpeg...');

const tempCropped = path.join(__dirname, 'edited-demo-cropped.mp4');
const dest1 = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'netflow-demo.mp4');
const dest2 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'assets', 'netflow-demo.mp4');
const dest3 = path.join(__dirname, '..', 'frontend', 'public', 'netflow-demo.mp4');
const dest4 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'netflow-demo.mp4');

// We crop out y=95 (top browser chrome with tabs & URL bar) and scale cleanly
const cmd = `"${ffmpeg}" -y -i "${input}" -filter_complex "[0:v]crop=in_w:in_h-95:0:95,scale=1920:1080:flags=lanczos[v]" -map "[v]" -c:v libx264 -preset veryfast -crf 22 -movflags +faststart "${tempCropped}"`;

console.log('Running crop command...');
execSync(cmd, { stdio: 'inherit' });

console.log('Cropped video created successfully! Size:', fs.statSync(tempCropped).size, 'bytes');

[dest1, dest2, dest3, dest4].forEach(d => {
  if (fs.existsSync(path.dirname(d))) {
    fs.copyFileSync(tempCropped, d);
    console.log('Updated:', d);
  }
});

console.log('All public video files updated with cleanly cropped version without browser tabs or URL bar!');
