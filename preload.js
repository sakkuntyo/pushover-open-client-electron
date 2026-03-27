const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsApi', {
  loadConfig: () => ipcRenderer.invoke('settings:load-config'),
  loginAndSave: (payload) => ipcRenderer.invoke('settings:login-and-save', payload)
});