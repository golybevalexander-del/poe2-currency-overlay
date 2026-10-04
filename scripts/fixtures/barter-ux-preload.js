'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  uiLang: 'en',
  getConfig: () => ipcRenderer.invoke('fixture-config'),
  setBarterMode: (mode) => ipcRenderer.invoke('fixture-mode', mode),
  directBarter: (args) => ipcRenderer.invoke('fixture-query', args),
  onLeagueAutoChanged: () => {},
  onBarterFocusSearch: (fn) => ipcRenderer.on('barter-focus-search', fn),
  onShown: (fn) => ipcRenderer.on('fixture-shown', fn)
});
contextBridge.exposeInMainWorld('fixture', {
  control: (command) => ipcRenderer.invoke('fixture-control', command)
});
