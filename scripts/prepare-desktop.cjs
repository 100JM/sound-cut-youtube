const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.desktop');
const binaries = ['yt-dlp.exe', 'ffmpeg.exe', 'ffprobe.exe', 'deno.exe'];
for (const name of binaries) {
  if (!fs.existsSync(path.join(root, '.tools', name))) throw new Error(`${name} 누락: npm run setup:tools를 먼저 실행하세요.`);
}
// Only remove the fixed staging directory inside this project.
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(path.join(root, '.next', 'standalone'), path.join(target, 'server'), {
  recursive: true,
  filter: source => path.basename(source) !== '.tools' && !path.basename(source).startsWith('.env'),
});
fs.cpSync(path.join(root, '.next', 'static'), path.join(target, 'server', '.next', 'static'), { recursive: true });
if (fs.existsSync(path.join(root, 'public'))) fs.cpSync(path.join(root, 'public'), path.join(target, 'server', 'public'), { recursive: true });
fs.mkdirSync(path.join(target, 'tools'));
for (const name of binaries) fs.copyFileSync(path.join(root, '.tools', name), path.join(target, 'tools', name));
const ffmpegPackages = path.join(root, '.tools', 'ffmpeg-package');
if (fs.existsSync(ffmpegPackages)) {
  for (const entry of fs.readdirSync(ffmpegPackages)) {
    const license = path.join(ffmpegPackages, entry, 'LICENSE');
    if (fs.existsSync(license)) fs.copyFileSync(license, path.join(target, 'tools', 'FFmpeg-LICENSE.txt'));
  }
}
console.log('Desktop resources ready.');
