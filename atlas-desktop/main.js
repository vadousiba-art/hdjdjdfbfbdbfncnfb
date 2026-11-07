const { app, BrowserWindow, ipcMain, systemPreferences, dialog, session, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// ---------------------------------------------------------------------------
// Two ways to run ATLAS
// ---------------------------------------------------------------------------
// "yoru"  (default): opens Atlas inside YORU (https://yoru-social.vercel.app/atlas)
//          in a locked-down window. The AI keys live on YORU's server, so
//          nothing secret is on this computer. Sign in with your YORU account.
// "local": Jesse's original setup — starts the Python backend on this machine
//          and loads the local interface (src/index.html), exactly as before.
//
// The mode is picked automatically: "local" if the backend folder exists next
// to this app, otherwise "yoru". Force one with ATLAS_MODE=yoru|local.

const BACKEND_DIR = path.join(__dirname, '..', 'voice-assistant');
const BACKEND_PORT = Number(process.env.ATLAS_BACKEND_PORT || 5000); // 5000 clashes with AirPlay on macOS; change it here if needed
const BACKEND_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/api/health`;
const BACKEND_STARTUP_TIMEOUT_MS = 25000;
const YORU_URL = process.env.ATLAS_YORU_URL || 'https://yoru-social.vercel.app/atlas';

const hasLocalBackend = fs.existsSync(path.join(BACKEND_DIR, 'backend', 'server.py'));
const MODE = process.env.ATLAS_MODE === 'local' || process.env.ATLAS_MODE === 'yoru'
  ? process.env.ATLAS_MODE
  : hasLocalBackend ? 'local' : 'yoru';
const YORU_ORIGIN = new URL(YORU_URL).origin;

let mainWindow;
let backendProcess = null; // only set if THIS app spawned the backend — so we know it's ours to kill on quit
let backendSpawnedByUs = false;

// One window at a time: opening ATLAS again focuses the existing one.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

// ---------------------------------------------------------------------------
// Local mode: auto-start the Python backend (unchanged behaviour)
// ---------------------------------------------------------------------------

function checkBackendHealth() {
  return new Promise((resolve) => {
    const req = http.get(BACKEND_HEALTH_URL, { timeout: 1500 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function pythonCommand() {
  // Override with ATLAS_PYTHON if your interpreter isn't on PATH as
  // "python"/"python3" (e.g. a specific venv).
  if (process.env.ATLAS_PYTHON) return process.env.ATLAS_PYTHON;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function spawnBackend() {
  const py = pythonCommand();
  const child = spawn(py, [path.join('backend', 'server.py')], {
    cwd: BACKEND_DIR,
    stdio: 'inherit', // backend logs show up in this app's console
    env: { ...process.env, PORT: String(BACKEND_PORT) },
  });
  child.on('error', (err) => {
    dialog.showErrorBox(
      'ATLAS backend failed to start',
      `Couldn't launch the Python backend with "${py}".\n\n${err.message}\n\n` +
      'If Python isn\'t on your PATH under that name, set the ATLAS_PYTHON ' +
      'environment variable to the full path of your python executable.'
    );
  });
  child.on('exit', (code) => {
    if (backendSpawnedByUs && code !== null && code !== 0) console.error(`ATLAS backend exited unexpectedly with code ${code}`);
    backendProcess = null;
  });
  backendProcess = child;
  backendSpawnedByUs = true;
}

async function waitForBackend(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkBackendHealth()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function ensureBackendRunning() {
  if (await checkBackendHealth()) return true; // already running (manual start, service, etc.)
  spawnBackend();
  return waitForBackend(BACKEND_STARTUP_TIMEOUT_MS);
}

function loadingSplashHtml(text) {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(
    `<html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
     background:#080808;color:#ffeee9;font-family:sans-serif;letter-spacing:2px;">${text}</body></html>`
  );
}

// ---------------------------------------------------------------------------
// System stats (local interface only)
// ---------------------------------------------------------------------------

// Free/used space on the system drive. fs.statfs works on Windows, macOS and
// Linux (wmic, used before, has been removed from current Windows 11).
async function getDiskUsage() {
  try {
    const root = process.platform === 'win32' ? `${process.env.SystemDrive || 'C:'}\\` : '/';
    const s = await fs.promises.statfs(root);
    const total = s.blocks * s.bsize;
    const used = total - s.bavail * s.bsize;
    return { usedGB: (used / 1024 ** 3).toFixed(1), totalGB: (total / 1024 ** 3).toFixed(1), pct: total ? Math.round((used / total) * 100) : 0 };
  } catch {
    return { usedGB: '0', totalGB: '0', pct: 0 };
  }
}

function getCpuUsage() {
  return new Promise((resolve) => {
    const start = os.cpus();
    setTimeout(() => {
      const end = os.cpus();
      let idleDiff = 0, totalDiff = 0;
      for (let i = 0; i < start.length; i++) {
        const s = start[i].times, e = end[i].times;
        const idle = e.idle - s.idle;
        idleDiff += idle;
        totalDiff += (e.user - s.user) + (e.nice - s.nice) + (e.sys - s.sys) + (e.irq - s.irq) + idle;
      }
      resolve(totalDiff ? Math.round(100 - (idleDiff / totalDiff) * 100) : 0);
    }, 150);
  });
}

// Only the bundled local interface may use these (never a web page), so a
// website can't read this computer's details or open its file dialogs.
const fromLocalUi = (event) => (event.senderFrame?.url || '').startsWith('file://');

ipcMain.handle('get-system-stats', async (event) => {
  if (!fromLocalUi(event)) return null;
  const [cpu, disk] = await Promise.all([getCpuUsage(), getDiskUsage()]);
  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  return {
    cpu,
    ramUsedGB: (usedMem / 1024 ** 3).toFixed(2),
    ramTotalGB: (totalMem / 1024 ** 3).toFixed(2),
    ramPct: Math.round((usedMem / totalMem) * 100),
    diskUsedGB: disk.usedGB,
    diskTotalGB: disk.totalGB,
    diskPct: disk.pct,
    uptimeSec: os.uptime(),
    platform: os.platform(),
    hostname: os.hostname(),
  };
});

ipcMain.handle('get-camera-permission', async (event) => {
  if (!fromLocalUi(event)) return 'unknown';
  return process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('camera') : 'unknown';
});

ipcMain.handle('pick-audio-files', async (event) => {
  if (!fromLocalUi(event)) return [];
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose music to play',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac'] }],
  });
  if (result.canceled) return [];
  // file:// URLs so the local <audio> element can play them directly.
  return result.filePaths.map((p) => ({ path: p, url: 'file://' + p.replace(/\\/g, '/'), name: path.basename(p) }));
});

for (const [channel, fn] of [['window-minimize', (w) => w.minimize()], ['window-close', (w) => w.close()],
  ['window-maximize', (w) => (w.isMaximized() ? w.unmaximize() : w.maximize())]]) {
  ipcMain.on(channel, (event) => { if (mainWindow && fromLocalUi(event)) fn(mainWindow); });
}

// ---------------------------------------------------------------------------
// Window and security
// ---------------------------------------------------------------------------

function allowedUrl(url) {
  if (MODE === 'local') return url.startsWith('file://') || url.startsWith('data:');
  try {
    return new URL(url).origin === YORU_ORIGIN || url.startsWith('data:');
  } catch {
    return false;
  }
}

function lockDown(win) {
  // Stay on YORU (or the local UI); other links open in the normal browser.
  win.webContents.on('will-navigate', (e, url) => {
    if (allowedUrl(url)) return;
    e.preventDefault();
    if (/^https:\/\//.test(url)) shell.openExternal(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // Microphone (and camera for the local UI) only; nothing else, and only for our own pages.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    const ok = allowedUrl(details.requestingUrl || wc.getURL()) &&
      (permission === 'media' || permission === 'clipboard-sanitized-write' || permission === 'speaker-selection');
    cb(ok);
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) =>
    allowedUrl(origin || '') && (permission === 'media' || permission === 'clipboard-sanitized-write'));
}

function createWindow() {
  const local = MODE === 'local';
  mainWindow = new BrowserWindow({
    width: local ? 1536 : 1180,
    height: local ? 1024 : 860,
    minWidth: local ? 1024 : 380,
    minHeight: 700,
    backgroundColor: '#080808',
    // The local interface draws its own title bar; YORU uses the normal one.
    frame: !local,
    titleBarStyle: local ? 'hidden' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  lockDown(mainWindow);

  if (!local) {
    mainWindow.loadURL(YORU_URL);
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMain) => {
      if (isMain && code !== -3) mainWindow.loadURL(loadingSplashHtml(`Can't reach YORU (${desc}). Check your connection and reopen ATLAS.`));
    });
    return;
  }

  // Local: a quick splash while the backend starts, then the real UI.
  mainWindow.loadURL(loadingSplashHtml('Starting ATLAS backend&hellip;'));
  ensureBackendRunning().then((ok) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!ok) {
      dialog.showErrorBox(
        'ATLAS backend not responding',
        `Timed out waiting for the backend at ${BACKEND_HEALTH_URL}.\n\n` +
        'Check that Python and its packages are installed, and that nothing else ' +
        `is using port ${BACKEND_PORT} (set ATLAS_BACKEND_PORT to change it).`
      );
    }
    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  // Only stop the backend if we started it — never one that was already
  // running before this app launched (it might be serving another device).
  if (backendSpawnedByUs && backendProcess) backendProcess.kill();
});
