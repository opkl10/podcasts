import { app, BrowserWindow, shell, session } from 'electron';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

const isDev = process.env.NODE_ENV !== 'production';
const PORT = 3000;
const APP_URL = `http://localhost:${PORT}`;

function waitForServer(url: string, maxTries = 60, interval = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      }).on('error', retry);
    };
    const retry = () => {
      tries++;
      if (tries >= maxTries) reject(new Error('Server not ready'));
      else setTimeout(check, interval);
    };
    check();
  });
}

function startNextServer(): Promise<void> {
  return new Promise((resolve) => {
    const appDir = app.getAppPath();
    const nextBin = path.join(appDir, 'node_modules', '.bin', 'next');
    console.log('[Electron] Starting Next.js from:', appDir);
    nextServer = spawn(nextBin, ['start', '--port', String(PORT)], {
      cwd: appDir,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    nextServer.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      console.log('[Next]', msg);
      if (msg.includes('Ready') || msg.includes('started server')) resolve();
    });
    nextServer.stderr?.on('data', (d: Buffer) => console.error('[Next:err]', d.toString().trim()));
    nextServer.on('error', (err) => console.error('[Electron] Next.js error:', err));
    setTimeout(resolve, 8000); // fallback after 8s
  });
}

async function createWindow() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone', 'screen', 'display-capture', 'mediaKeySystem'];
    callback(allowed.includes(permission));
  });

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0b0e18',
    title: 'Podcast Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  if (isDev) {
    mainWindow.loadURL(APP_URL);
  } else {
    await startNextServer();
    await waitForServer(APP_URL).catch(() => {});
    mainWindow.loadURL(APP_URL);
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') {
    const { systemPreferences } = require('electron');
    await systemPreferences.askForMediaAccess('camera').catch(() => {});
    await systemPreferences.askForMediaAccess('microphone').catch(() => {});
  }
  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (nextServer) { nextServer.kill(); nextServer = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (nextServer) nextServer.kill();
});
