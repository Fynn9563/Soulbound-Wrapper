// main.js
const { app, BrowserWindow, globalShortcut, Menu, ipcMain } = require('electron');
const path = require('path');

let win;               
let exitWindow = null; 
let quitMenu;          
let isQuitDialogOpen = false;

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

// Apply Chromium flags before app is ready
PERFORMANCE_FLAGS.forEach(flag => {
  const [key, value] = flag.split('=');
  if (value !== undefined) {
    app.commandLine.appendSwitch(key, value);
  } else {
    app.commandLine.appendSwitch(key);
  }
});

function createWindow() {
  // Remove default menu
  Menu.setApplicationMenu(null);

  win = new BrowserWindow({
    fullscreen: true,
    frame: true,
    resizable: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: false,
      backgroundThrottling: false,
      sandbox: true,
      powerPreference: 'high-performance',
      offscreen: false
    }
  });

  win.setAspectRatio(16 / 9);
  win.setMenuBarVisibility(false);

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadURL('https://play.soulbound.game/');

  win.webContents.on('did-finish-load', () => {
    win.webContents.setZoomFactor(1);
    win.webContents.insertCSS(`
      html, body, canvas, img {
        image-rendering: pixelated !important;
      }
    `);
  });

  win.on('enter-full-screen', () => {
    win.setMenuBarVisibility(false);
  });

  win.on('leave-full-screen', () => {
    win.setMenuBarVisibility(false);
  });

  // Quit context menu on right-click
  quitMenu = Menu.buildFromTemplate([
    { label: 'Quit', click: confirmQuit }
  ]);
  win.webContents.on('context-menu', () => {
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
  exitWindow.once('ready-to-show', () => {
    exitWindow.show();
  });
  exitWindow.on('closed', () => {
    isQuitDialogOpen = false;
    exitWindow = null;
  });
}

ipcMain.on('exit-dialog-selection', (e, action) => {
  if (action === 'cancel' && exitWindow && !exitWindow.isDestroyed()) {
    exitWindow.close();
  } else if (action === 'quit') {
    app.quit();
  }
});

function registerShortcuts() {
  globalShortcut.register('Escape', confirmQuit);
  globalShortcut.register('F11', () => {
    if (win && win.isFullScreen()) {
      win.setFullScreen(false);
    }
  });
}

function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

function start() {
  return app.whenReady().then(() => {
    createWindow();
    registerShortcuts();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        registerShortcuts();
      }
    });
  }).then(() => {
    app.on('will-quit', unregisterShortcuts);
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  });
}

start();

module.exports = {
  PERFORMANCE_FLAGS,
  start
};