const ffmpeg = require('ffmpeg-static');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Use the local copied source video (130 MB raw recording)
const input = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'netflow-demo.mp4');

const tempOut = path.join(__dirname, 'edited-demo-fast.mp4');
const dest1 = path.join(__dirname, '..', 'frontend', 'public', 'assets', 'netflow-demo.mp4');
const dest2 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'assets', 'netflow-demo.mp4');
const dest3 = path.join(__dirname, '..', 'frontend', 'public', 'netflow-demo.mp4');
const dest4 = path.join('c:', 'Users', 'rchouksey', 'Downloads', 'NetFlow-main (3)', 'NetFlow-main', 'frontend', 'public', 'netflow-demo.mp4');

console.log('Editing & Speeding up video with ffmpeg...');
// We speed up video by 2.5x: setpts=0.4*PTS
// Scale to 1920x1080 web-optimized H.264 MP4 with faststart
const cmd = `"${ffmpeg}" -y -i "${input}" -filter_complex "[0:v]setpts=0.4*PTS,fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[v]" -map "[v]" -c:v libx264 -preset veryfast -crf 23 -movflags +faststart "${tempOut}"`;

console.log('Running command...');
execSync(cmd, { stdio: 'inherit' });

console.log('Video edited successfully! Size:', fs.statSync(tempOut).size, 'bytes');

[dest1, dest2, dest3, dest4].forEach(d => {
  if (fs.existsSync(path.dirname(d))) {
    fs.copyFileSync(tempOut, d);
    console.log('Copied to:', d);
  }
});

console.log('All destinations updated with short, fast & edited video!');
