const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('soundcutUpdates', {
  getState: () => ipcRenderer.invoke('updates:state'),
  check: () => ipcRenderer.invoke('updates:check'),
  install: () => ipcRenderer.invoke('updates:install'),
  subscribe: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:changed', listener);
    return () => ipcRenderer.removeListener('updates:changed', listener);
  },
});
