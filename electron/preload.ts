import { contextBridge, ipcRenderer } from 'electron';

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  // Asks the main process to kill FaceTime/Photo Booth so the UVC device
  // can be reclaimed at full HD/4K resolution by this Electron session
  releaseCameraLock: () => ipcRenderer.invoke('release-camera-lock'),
});
