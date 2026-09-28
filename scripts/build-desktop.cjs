// Use Electron's bundled Node runtime so packaging also works on older host Node versions.
const { spawn } = require('node:child_process');
const path = require('node:path');
if (!process.versions.electron) {
  const child = spawn(require('electron'), [__filename, '--worker'], {
    stdio: 'inherit', windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  });
  child.on('error', error => { console.error(error); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  process.noAsar = true;
  const { build, Platform, Arch } = require('electron-builder');
  build({ projectDir: path.resolve(__dirname, '..'), targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64), publish: 'never' })
    .catch(error => { console.error(error); process.exitCode = 1; });
}
