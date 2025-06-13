// main.js
const { app, BrowserWindow, Menu, ipcMain, globalShortcut, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { initAutoUpdater } = require('./update.js');

let win;
let exitWindow = null;
let quitMenu;
let isQuitDialogOpen = false;
let escHoldTimeout = null;
let escDialogOpened = false;
let escKeyDownTime = null;

let blockedUrls = [];
try {
  blockedUrls = fs
    .readFileSync(path.join(__dirname, 'blocked_urls.txt'), 'utf-8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
} catch {}

const PERFORMANCE_FLAGS = [
  'enable-gpu',
  'ignore-gpu-blocklist',
  'enable-zero-copy',
  'disable-frame-rate-limit',
  'disable-gpu-vsync',
  'disable-gpu-driver-bug-workarounds',
  'disable-software-rasterizer',
  'enable-native-gpu-memory-buffers',
  'powerPreference=high-performance',
  'high-dpi-support=1',
  'force-device-scale-factor=1',
  'disable-backgrounding-occluded-windows',
  'disable-breakpad',
  'disable-features=AudioServiceOutOfProcess,MouseSubsampling,SubpixelFontScaling,SharedImageCacheOnDisk,SkiaVulkan',
  'enable-async-dns'
];
PERFORMANCE_FLAGS.forEach(f => {
  const [k, v] = f.split('=');
  app.commandLine.appendSwitch(k, v);
});

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    frame: true,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      devTools: true,
      backgroundThrottling: false,
      sandbox: true,
      powerPreference: 'high-performance'
    }
  });

  win.setAspectRatio(16 / 9);

  const wc = win.webContents;
  const ses = wc.session;

  if (ses?.webRequest && blockedUrls.length) {
    const patterns = blockedUrls.map(u => {
      const [base] = u.split('?');
      return base + '*';
    });

    console.log('[URL BLOCK] blocking these patterns:', patterns);
    ses.webRequest.onBeforeRequest({ urls: patterns }, (details, callback) => {
      console.log(`[URL BLOCKED] ${details.method} ${details.url}`);
      callback({ cancel: true });
    });
  }

  wc.on('before-input-event', (e, input) => {
    if (input.key === 'Escape') {
      if (input.type === 'keyDown' && !input.isAutoRepeat) {
        escKeyDownTime = Date.now();
        escHoldTimeout = setTimeout(() => {
          escDialogOpened = true;
          confirmQuit();
        }, 500);
      } else if (input.type === 'keyUp' && escKeyDownTime !== null) {
        if (!escDialogOpened) clearTimeout(escHoldTimeout);
        else e.preventDefault();
        escKeyDownTime = null;
      }
      return;
    }
    if (input.key === 'F12' && input.type === 'keyDown') {
      if (!wc.isDevToolsOpened()) wc.openDevTools({ mode: 'detach' });
      else wc.closeDevTools();
      e.preventDefault();
    }
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL('https://play.soulbound.game/');
  wc.on('did-finish-load', () => {
    wc.setZoomFactor(1);
    wc.insertCSS('html, body, canvas, img { image-rendering: pixelated !important; }');
  });

  win.on('enter-full-screen', () => win.setMenuBarVisibility(false));
  win.on('leave-full-screen', () => win.setMenuBarVisibility(false));

  quitMenu = Menu.buildFromTemplate([{ label: 'Quit', click: confirmQuit }]);
  wc.on('context-menu', () => quitMenu.popup({ window: win }));
}

function confirmQuit() {
  if (isQuitDialogOpen || (exitWindow && !exitWindow.isDestroyed())) return;
  isQuitDialogOpen = true;

  exitWindow = new BrowserWindow({
    parent: win,
    modal: true,
    show: false,
    width: 320,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      devTools: false
    }
  });

  exitWindow.loadFile(path.join(__dirname, 'exit.html'));
  exitWindow.once('ready-to-show', () => exitWindow.show());
  exitWindow.on('closed', () => {
    isQuitDialogOpen = false;
    exitWindow = null;
    escDialogOpened = false;
    escHoldTimeout = null;
  });
}

ipcMain.on('exit-dialog-selection', (e, action) => {
  if (action === 'cancel') exitWindow?.close();
  else if (action === 'quit') app.quit();
});

function start() {
  return app.whenReady().then(() => {
    createWindow();
    globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));

    initAutoUpdater(win);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
      }
    });
  }).then(() => {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') app.quit();
    });
  });
}

start();

module.exports = {
  PERFORMANCE_FLAGS,
  start
};