const { contextBridge, ipcRenderer } = require('electron');

// The desktop helpers are only for ATLAS's own local interface (file://).
// When the window shows YORU, the website gets nothing extra: no system
// details, no file dialogs (main.js checks the sender as well).
if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('atlas', {
    getSystemStats: () => ipcRenderer.invoke('get-system-stats'),
    getCameraPermission: () => ipcRenderer.invoke('get-camera-permission'),
    pickAudioFiles: () => ipcRenderer.invoke('pick-audio-files'),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
  });
}
