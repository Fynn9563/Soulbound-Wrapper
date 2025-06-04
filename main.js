// main.js
const { app, BrowserWindow, globalShortcut, Menu, ipcMain } = require('electron');
const path = require('path');

let win;               // Main game window
let exitWindow = null; // Custom “pixel” exit dialog window
let quitMenu;          // Right-click context menu for “Quit”
let isQuitDialogOpen = false;

// All Chromium flags for maximum GPU performance + no unnecessary subsystems
const PERFORMANCE_FLAGS = [
  // ----- GPU / rendering -----
  'enable-gpu',
  'ignore-gpu-blocklist',
  'enable-zero-copy',
  'disable-frame-rate-limit',
  'disable-gpu-vsync',
  'disable-gpu-driver-bug-workarounds',
  'disable-software-rasterizer',
  'enable-native-gpu-memory-buffers',
  'powerPreference=high-performance',

  // Force 100% device-scale to prevent OS DPI scaling
  'high-dpi-support=1',
  'force-device-scale-factor=1',

  // ----- Disable unused subsystems -----
  'disable-backgrounding-occluded-windows',
  'disable-breakpad',
  'disable-features=AudioServiceOutOfProcess,MouseSubsampling,SubpixelFontScaling,SharedImageCacheOnDisk,SkiaVulkan',

  // (Safe) asynchronous DNS
  'enable-async-dns'
];

// Apply all Chromium switches before app.whenReady() fires
PERFORMANCE_FLAGS.forEach(flag => {
  const [key, value] = flag.split('=');
  if (value !== undefined) {
    app.commandLine.appendSwitch(key, value);
  } else {
    app.commandLine.appendSwitch(key);
  }
});

function createWindow() {
  console.log('[main.js] createWindow() called');
  win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    show: false,            // wait for ready-to-show
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

  // Enforce 16:9 so the game’s native resolution isn’t stretched
  win.setAspectRatio(16 / 9);

  win.once('ready-to-show', () => {
    console.log('[main.js] BrowserWindow is ready-to-show, calling win.show()');
    win.show();
  });

  // Load the browser game
  console.log('[main.js] Loading URL: https://play.soulbound.game/');
  win.loadURL('https://play.soulbound.game/');
  win.setMenuBarVisibility(false);

  win.webContents.on('did-finish-load', () => {
    console.log('[main.js] did-finish-load triggered');
    // 1) Ensure zoom factor = 1
    win.webContents.setZoomFactor(1);

    // 2) Preserve pixel-art scaling (nearest-neighbor)
    win.webContents.insertCSS(`
      html, body, canvas, img {
        image-rendering: pixelated !important;
      }
    `);
  });

  // Right-click → “Quit” context menu
  quitMenu = Menu.buildFromTemplate([
    {
      label: 'Quit',
      click: confirmQuit
    }
  ]);
  win.webContents.on('context-menu', () => {
    quitMenu.popup({ window: win });
  });
}

function confirmQuit() {
  if (isQuitDialogOpen) {
    console.log('[main.js] confirmQuit() called, but isQuitDialogOpen=true → returning');
    return;
  }
  if (exitWindow && !exitWindow.isDestroyed()) {
    console.log('[main.js] confirmQuit() called, but exitWindow already exists → returning');
    return;
  }

  console.log('[main.js] Opening quit-confirm dialog');
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
    console.log('[main.js] exitWindow ready, showing dialog');
    exitWindow.show();
  });
  exitWindow.on('closed', () => {
    console.log('[main.js] exitWindow closed');
    isQuitDialogOpen = false;
    exitWindow = null;
  });
}

ipcMain.on('exit-dialog-selection', (e, action) => {
  console.log('[main.js] Received exit-dialog-selection:', action);
  if (action === 'cancel' && exitWindow && !exitWindow.isDestroyed()) {
    exitWindow.close();
  } else if (action === 'quit') {
    console.log('[main.js] User chose QUIT → app.quit()');
    app.quit();
  }
});

function registerShortcuts() {
  console.log('[main.js] registerShortcuts()');
  globalShortcut.register('Escape', confirmQuit);
}
function unregisterShortcuts() {
  console.log('[main.js] unregisterShortcuts()');
  globalShortcut.unregisterAll();
}

function start() {
  // Return the promise so tests (or anything else) can await it
  return app.whenReady().then(() => {
    console.log('[main.js] app.whenReady() fulfilled');
    createWindow();
    registerShortcuts();

    app.on('activate', () => {
      console.log('[main.js] app.activate event');
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        registerShortcuts();
      }
    });
  }).then(() => {
    app.on('will-quit', unregisterShortcuts);
    app.on('window-all-closed', () => {
      console.log('[main.js] app.window-all-closed');
      if (process.platform !== 'darwin') {
        console.log('[main.js] app.quit()');
        app.quit();
      }
    });
  });
}

// Always call start() when Electron loads this file
start();

// Export PERFORMANCE_FLAGS and start() for testing
module.exports = {
  PERFORMANCE_FLAGS,
  start
};