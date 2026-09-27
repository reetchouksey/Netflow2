const ffmpeg = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const input = path.join(__dirname, 'edited-demo-fast.mp4');
const tempCropped = path.join(__dirname, 'edited-demo-perfect-crop.mp4');

const dest1 = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'netflow-demo.mp4');
const dest2 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'assets', 'netflow-demo.mp4');
const dest3 = path.join(__dirname, '..', 'frontend', 'public', 'netflow-demo.mp4');
const dest4 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'netflow-demo.mp4');

console.log('Rendering perfect crop (removing top browser tabs/URL and bottom black bar)...');

// Crop top 146px and bottom 40px:
// in_w = 1920, height = 1080 - 146 - 40 = 894
const cmd = `"${ffmpeg}" -y -i "${input}" -filter_complex "[0:v]crop=1920:894:0:146,scale=1920:1080:flags=lanczos[v]" -map "[v]" -c:v libx264 -preset veryfast -crf 21 -movflags +faststart "${tempCropped}"`;

console.log('Running command...');
execSync(cmd, { stdio: 'inherit' });

console.log('Perfect cropped video created! Size:', fs.statSync(tempCropped).size, 'bytes');

[dest1, dest2, dest3, dest4].forEach(d => {
  if (fs.existsSync(path.dirname(d))) {
    fs.copyFileSync(tempCropped, d);
    console.log('Updated:', d);
  }
});

console.log('All public video destinations updated successfully!');
