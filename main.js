// main.js
const { app, BrowserWindow, Menu, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let exitWindow = null;
let quitMenu;
let isQuitDialogOpen = false;
let escHoldTimeout = null;
let escDialogOpened = false;
let escKeyDownTime = null;

// Load blocked URLs from "blocked_urls.txt"
let blockedUrls = [];
try {
  const lines = fs.readFileSync(path.join(__dirname, 'blocked_urls.txt'), 'utf-8').split(/\r?\n/);
  blockedUrls = lines.map(line => line.trim()).filter(line => line && !line.startsWith('#'));
} catch {
  console.warn('Could not load blocked_urls.txt; no URLs will be blocked.');
}

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
PERFORMANCE_FLAGS.forEach(flag => {
  const [key, value] = flag.split('=');
  app.commandLine.appendSwitch(key, value);
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
  const webContents = win.webContents;
  const session = webContents.session;

  if (blockedUrls.length > 0) {
    session.webRequest.onBeforeRequest({ urls: blockedUrls }, (details, callback) => {
      console.log(`[BLOCKED] ${details.method} ${details.url}`);
      callback({ cancel: true });
    });
  }

  webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      if (input.type === 'keyDown' && !input.isAutoRepeat) {
        escKeyDownTime = Date.now();
        escHoldTimeout = setTimeout(() => {
          escDialogOpened = true;
          confirmQuit();
        }, 500);
      } else if (input.type === 'keyUp' && escKeyDownTime !== null) {
        if (!escDialogOpened) {
          clearTimeout(escHoldTimeout);
        } else {
          event.preventDefault();
        }
        escKeyDownTime = null;
      }
    }

    if (input.key === 'F12' && input.type === 'keyDown') {
      console.log('[DEBUG] F12 pressed – toggling DevTools');
      if (!webContents.isDevToolsOpened()) {
        webContents.openDevTools({ mode: 'detach' });
        console.log('[DEBUG] DevTools opened');
      } else {
        webContents.closeDevTools();
        console.log('[DEBUG] DevTools closed');
      }
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL('https://play.soulbound.game/');

  webContents.on('did-finish-load', () => {
    webContents.setZoomFactor(1);
    webContents.insertCSS(`
      html, body, canvas, img {
        image-rendering: pixelated !important;
      }
    `);
  });

  win.on('enter-full-screen', () => win.setMenuBarVisibility(false));
  win.on('leave-full-screen', () => win.setMenuBarVisibility(false));

  quitMenu = Menu.buildFromTemplate([{ label: 'Quit', click: confirmQuit }]);
  webContents.on('context-menu', () => {
    quitMenu.popup({ window: win });
  });
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
  if (action === 'cancel' && exitWindow && !exitWindow.isDestroyed()) {
    exitWindow.close();
  } else if (action === 'quit') {
    app.quit();
  }
});

function start() {
  return app.whenReady().then(() => {
    createWindow();
    globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
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