const { app, BrowserWindow, Menu, Tray, nativeImage, dialog, utilityProcess } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const { execFile } = require('node:child_process');

let window, tray, server, quitting = false, stopped = false;
let exitCode = 0;
const smoke = process.argv.includes('--smoke-test');
app.setName('Soundcut');
const hidden = process.argv.includes('--hidden');
if (smoke) {
  const profile = path.join(process.cwd(), '.desktop', 'smoke-profile');
  fs.mkdirSync(profile, { recursive: true });
  app.setPath('userData', profile);
}
const root = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '.desktop');
const icon = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
app.setAppUserModelId('com.soundcut.desktop');

function show() {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

async function start() {
  const log = fs.createWriteStream(path.join(app.getPath('userData'), 'desktop.log'), { flags: 'a' });
  const port = await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  const url = `http://127.0.0.1:${port}`;
  const tools = path.join(root, 'tools');
  server = utilityProcess.fork(path.join(root, 'server', 'server.js'), [], {
    cwd: path.join(root, 'server'), stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port),
      YTDLP_PATH: path.join(tools, 'yt-dlp.exe'), FFMPEG_PATH: path.join(tools, 'ffmpeg.exe'),
      DENO_PATH: path.join(tools, 'deno.exe'), NEXT_TELEMETRY_DISABLED: '1', SOUNDCUT_ORIGIN: url },
  });
  server.stdout.pipe(log, { end: false });
  server.stderr.pipe(log, { end: false });
  let exited = false;
  server.on('exit', () => {
    exited = true;
    if (!quitting) {
      if (!smoke) dialog.showErrorBox('Soundcut', '서버가 종료되었습니다. 앱을 다시 실행해 주세요. 자세한 내용은 desktop.log에서 확인할 수 있습니다.');
      app.exit(1);
    }
  });
  let ready = false;
  for (let i = 0; i < 120 && !exited; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('로컬 서버를 시작하지 못했습니다.');
  window = new BrowserWindow({ width: 1180, height: 860, minWidth: 720, minHeight: 600,
    show: false, icon, autoHideMenuBar: true, title: 'Soundcut',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== url) event.preventDefault();
  });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.on('close', event => { if (!quitting) { event.preventDefault(); window.hide(); } });
  tray = new Tray(icon);
  tray.setToolTip('Soundcut — MP3 추출');
  const updateMenu = () => tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Soundcut 열기', click: show },
    { label: 'Windows 로그인 시 자동 실행', type: 'checkbox', enabled: app.isPackaged,
      checked: app.isPackaged && app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin,
      click: item => { app.setLoginItemSettings({ openAtLogin: item.checked, path: process.execPath, args: ['--hidden'] }); updateMenu(); } },
    { type: 'separator' }, { label: '종료', click: () => app.quit() },
  ]));
  updateMenu();
  tray.on('double-click', show);
  await window.loadURL(url);
  if (smoke) {
    for (const [name, args] of [['yt-dlp.exe', ['--version']], ['ffmpeg.exe', ['-version']], ['ffprobe.exe', ['-version']], ['deno.exe', ['--version']]]) {
      await new Promise((resolve, reject) => execFile(path.join(tools, name), args, { windowsHide: true, timeout: 30000 }, error => error ? reject(error) : resolve()));
    }
    const title = await window.webContents.executeJavaScript('document.title');
    if (!title) throw new Error('화면 로딩 실패');
    const apiStatus = await window.webContents.executeJavaScript(`fetch('/api/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(response => response.status)`);
    if (apiStatus !== 400) throw new Error(`앱 화면 API 입력 검증 실패: ${apiStatus}`);
    const rejected = await fetch(`${url}/api/extract`, { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: '{}' });
    if (rejected.status !== 403) throw new Error('외부 출처 차단 검증 실패');
    fs.writeFileSync(path.join(app.getPath('userData'), 'smoke-test.json'), JSON.stringify({ title, apiStatus, rejectedOriginStatus: rejected.status, packaged: app.isPackaged }));
    app.quit();
  } else if (!hidden) show();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', show);
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => {
    quitting = true;
    if (!server?.pid || stopped) return;
    event.preventDefault();
    stopped = true;
    execFile('taskkill', ['/pid', String(server.pid), '/T', '/F'], { windowsHide: true }, () => app.exit(exitCode));
  });
  app.whenReady().then(start).catch(error => {
    console.error(error);
    if (!smoke) dialog.showErrorBox('Soundcut 실행 오류', error.message);
    exitCode = 1;
    app.quit();
  });
}
