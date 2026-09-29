// Run with Electron against `npm run dev`; mock only the external YouTube player.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1100, height: 1300, webPreferences: { contextIsolation: true, sandbox: true } });
  await win.loadURL('http://127.0.0.1:3000');
  if (process.argv.includes('--live')) {
    await win.webContents.executeJavaScript(`new Promise(resolve => setTimeout(resolve, 1200)).then(() => {
      const input = document.querySelector('#url');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })`);
    await new Promise(resolve => setTimeout(resolve, 22000));
    console.log(await win.webContents.executeJavaScript(`JSON.stringify({ iframe: !!document.querySelector('.video-frame iframe'), sliders: !!document.querySelector('[aria-label="시작 지점"]'), status: document.querySelector('.video-editor')?.innerText })`));
    app.exit(0);
    return;
  }
  const result = await win.webContents.executeJavaScript(`(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const change = (selector, value) => {
      const input = document.querySelector(selector);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    window.YT = { Player: class {
      constructor(host, options) { this.time = 0; this.duration = options.videoId === 'dQw4w9WgXcQ' ? 120 : 10; this.options = options; window.testPlayer = this; host.textContent = 'YouTube player test fixture'; setTimeout(options.events.onReady, 0); }
      destroy() { this.destroyed = true; } getDuration() { return this.duration; } getCurrentTime() { return this.time; }
      seekTo(time) { this.time = time; } playVideo() { this.playing = true; } pauseVideo() { this.playing = false; }
    }};
    await wait(1200);
    change('#url', 'https://youtu.be/dQw4w9WgXcQ'); await wait(700);
    check(document.querySelector('[aria-label="시작 지점"]'), 'sliders missing');
    change('[aria-label="시작 지점"]', '12.5'); await wait(100);
    check(document.querySelector('#start').value === '00:12.5', 'slider to text sync failed');
    change('#end', '01:10'); await wait(100);
    check(document.querySelector('[aria-label="종료 지점"]').value === '70', 'text to slider sync failed');
    document.querySelector('.preview-button').click(); await wait(50);
    check(window.testPlayer.playing && window.testPlayer.time === 12.5, 'preview start failed');
    window.testPlayer.time = 70; await wait(300);
    check(window.testPlayer.playing === false, 'preview did not stop');
    change('[aria-label="시작 지점"]', '90'); await wait(100);
    check(document.querySelector('#start').value === '01:30', 'start did not cross old end');
    check(document.querySelector('#end').value === '02:00', 'end did not advance 30 seconds');
    change('[aria-label="시작 지점"]', '120'); await wait(100);
    check(document.querySelector('#start').value === '01:59.9', 'start must leave a positive clip at video end');
    check(document.querySelector('#end').value === '02:00', 'end exceeded video duration');
    change('#end', '00:30'); await wait(100);
    document.querySelector('#start').focus();
    change('#start', '01:00'); await wait(100);
    document.querySelector('#start').dispatchEvent(new FocusEvent('focusout', { bubbles: true })); await wait(100);
    check(document.querySelector('#end').value === '01:30', 'typed start did not advance end');
    change('[aria-label="시작 지점"]', '115'); await wait(100);
    check(document.querySelector('#end').value === '02:00', 'automatic end was not clamped');
    const previous = window.testPlayer;
    change('#url', 'https://youtu.be/aqz-KE-bpKQ'); await wait(700);
    check(previous.destroyed, 'old player leaked');
    check(document.querySelector('#end').value === '00:10', 'short video boundary failed');
    change('#end', 'bad'); await wait(100);
    check(document.querySelector('.preview-button').disabled, 'invalid time enabled playback');
    change('#end', '00:08'); await wait(100);
    document.querySelector('.video-editor').scrollIntoView(); await wait(300);
    return { sliderSync: true, textSync: true, previewStops: true, shortVideoClamp: true, cleanup: true };
  })()`);
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/video-editor.png', (await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify(result));
  app.exit(0);
}).catch(error => { console.error(error); app.exit(1); });
