// Independent of Electron so update lifecycle and install guards can be tested.
function createUpdates({ updater, version, enabled, notify, reserve, release, install, log = () => {} }) {
  let state = { currentVersion: version, status: enabled ? 'idle' : 'disabled', message: enabled ? '업데이트를 확인할 수 있습니다.' : '설치 앱에서 업데이트를 사용할 수 있습니다.' };
  let checking = false;
  const set = patch => { state = { ...state, ...patch }; notify(state); };
  const error = err => {
    log(String(err?.message || err));
    set({ status: 'error', message: '업데이트를 확인하거나 다운로드하지 못했습니다. 인터넷 연결과 배포 상태를 확인한 뒤 다시 시도해 주세요.' });
  };
  updater.autoDownload = true;
  updater.autoInstallOnAppQuit = false;
  updater.allowPrerelease = false;
  updater.allowDowngrade = false;
  updater.on('checking-for-update', () => set({ status: 'checking', message: '새 버전을 확인하고 있습니다.' }));
  updater.on('update-available', info => set({ status: 'downloading', version: info.version, percent: 0, message: `${info.version} 버전을 다운로드하고 있습니다.` }));
  updater.on('download-progress', progress => set({ percent: Math.round(progress.percent) }));
  updater.on('update-not-available', () => set({ status: 'idle', message: '최신 버전입니다.' }));
  updater.on('update-downloaded', info => set({ status: 'ready', version: info.version, percent: 100, message: '새 버전이 준비되었습니다. 작업을 마친 뒤 업데이트해 주세요.' }));
  updater.on('error', error);
  return {
    getState: () => state,
    async check() {
      if (!enabled || checking || ['downloading', 'ready', 'installing'].includes(state.status)) return state;
      checking = true;
      try { const result = await updater.checkForUpdates(); await result?.downloadPromise; }
      catch (err) { error(err); }
      finally { checking = false; }
      return state;
    },
    async install() {
      if (!enabled || state.status !== 'ready') return state;
      set({ status: 'installing', message: '업데이트 설치를 준비하고 있습니다.' });
      let reserved = false;
      try {
        reserved = await reserve();
        if (!reserved) { set({ status: 'ready', message: '추출 작업이 진행 중입니다. 완료하거나 취소한 뒤 업데이트해 주세요.' }); return state; }
        await install();
      } catch (err) {
        if (reserved) await release().catch(() => {});
        log(String(err?.message || err));
        set({ status: 'ready', message: '설치를 시작하지 못했습니다. 앱을 다시 실행한 뒤 시도해 주세요.' });
      }
      return state;
    },
  };
}
module.exports = { createUpdates };
