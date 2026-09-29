const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdates } = require('../desktop/updates.cjs');
function fixture(overrides = {}) {
  const updater = new EventEmitter();
  updater.checkForUpdates = async () => { updater.emit('checking-for-update'); updater.emit('update-not-available'); };
  let installed = 0;
  const control = createUpdates({ updater, version: '1.2.0', enabled: true, notify() {}, reserve: async () => true, release: async () => {}, install: async () => { installed++; }, ...overrides });
  return { updater, control, installed: () => installed };
}
test('checks/downloads automatically but never installs on ordinary quit', async () => {
  const { updater, control, installed } = fixture();
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, false);
  await control.check();
  assert.equal(control.getState().status, 'idle');
  updater.emit('update-available', { version: '1.3.0' });
  updater.emit('download-progress', { percent: 42.4 });
  assert.equal(control.getState().percent, 42);
  updater.emit('update-downloaded', { version: '1.3.0' });
  assert.equal(installed(), 0);
  await control.install();
  assert.equal(installed(), 1);
});
test('active extraction prevents installation and a later retry succeeds', async () => {
  let busy = true;
  const { updater, control, installed } = fixture({ reserve: async () => !busy });
  updater.emit('update-downloaded', { version: '1.3.0' });
  await control.install();
  assert.equal(installed(), 0);
  assert.equal(control.getState().status, 'ready');
  busy = false;
  await control.install();
  assert.equal(installed(), 1);
});
test('check failures allow retry, duplicate checks are ignored', async () => {
  const { updater, control } = fixture();
  let calls = 0;
  updater.checkForUpdates = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); throw new Error('offline'); };
  await Promise.all([control.check(), control.check()]);
  assert.equal(calls, 1);
  assert.equal(control.getState().status, 'error');
  await control.check();
  assert.equal(calls, 2);
});
test('failed install releases server reservation', async () => {
  let released = false;
  const { updater, control } = fixture({ release: async () => { released = true; }, install: async () => { throw new Error('failed'); } });
  updater.emit('update-downloaded', { version: '1.3.0' });
  await control.install();
  assert.equal(released, true);
  assert.equal(control.getState().status, 'ready');
});
