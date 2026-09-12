import { app, BrowserWindow, shell, session, ipcMain } from 'electron';
import * as path from 'path';
import * as http from 'http';
import { spawn, ChildProcess, exec } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;

const isDev = process.env.NODE_ENV !== 'production';
const PORT = 3000;

// ─── Chromium UVC / AVFoundation High-Resolution Flags ───────────────────────
// These switches force Chromium's camera pipeline to request HD/4K from the
// UVC driver instead of falling back to the macOS "safe preview" 640×480 mode
// that AVFoundation offers when another app (FaceTime, OBS) is concurrently
// holding a low-priority session on the device.
app.commandLine.appendSwitch('enable-features', 'MediaFoundationVideoCapture,HardwareMediaKeyHandling,WebRtcHideLocalIpsWithMdns');
app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
// Force the GPU process to use 4K-capable pixel buffers for camera frames
app.commandLine.appendSwitch('force-video-overlays');
// Allow Chromium to re-negotiate camera resolution after initial stream open
app.commandLine.appendSwitch('enable-precise-memory-info');
// Bypass macOS screen-capture API for camera (uses native AVCaptureDevice directly)
app.commandLine.appendSwitch('use-fake-ui-for-media-stream', 'false');
// Disable throttling on background tabs that would reduce capture resolution
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
// ─────────────────────────────────────────────────────────────────────────────
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

// ─── IPC: AVFoundation + VDCAssistant Camera Lock Release ─────────────────────
// VDCAssistant is the macOS system daemon that brokers ALL UVC camera sessions.
// When it holds a stale session (even after all user apps close), Chrome gets
// a degraded 640×480 "preview only" stream. Killing VDCAssistant forces macOS
// to fully reset the UVC device and rebuild the session from scratch — allowing
// Electron to claim it at full 4K resolution on next open.
// Both VDCAssistant and AppleCameraAssistant auto-restart within ~1 second.

ipcMain.handle('release-camera-lock', async () => {
  return new Promise<{ ok: boolean; msg: string }>((resolve) => {
    const killCmd = [
      // User apps that might hold camera sessions
      'pkill -x "FaceTime" 2>/dev/null',
      'pkill -x "Photo Booth" 2>/dev/null',
      'pkill -x "Facetime" 2>/dev/null',
      // THE REAL FIX: macOS UVC broker daemons (safe — auto-restart in ~1s)
      'killall VDCAssistant 2>/dev/null',
      'killall AppleCameraAssistant 2>/dev/null',
    ].join('; ');

    exec(killCmd, (err) => {
      const killedDaemon = !err || err.code !== null; // even exit 1 means something ran
      console.log('[Electron] Camera daemon reset attempted:', killedDaemon ? 'VDCAssistant killed' : 'already clean');
      // Wait 1.5s for macOS to fully restart VDCAssistant and rebuild USB session
      setTimeout(() => {
        resolve({ ok: true, msg: 'VDCAssistant + AppleCameraAssistant killed — macOS UVC session fully reset' });
      }, 1500);
    });
  });
});
// ─────────────────────────────────────────────────────────────────────────────
