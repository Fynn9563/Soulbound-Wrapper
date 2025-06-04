// main.js
const { app, BrowserWindow, globalShortcut, Menu, ipcMain } = require('electron');
const path = require('path');

let win;
let exitWindow = null;
let quitMenu;
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
  `disable-features=AudioServiceOutOfProcess,MouseSubsampling,SubpixelFontScaling,SharedImageCacheOnDisk,SkiaVulkan`,

  // (Safe) asynchronous DNS
  'enable-async-dns'
];

// Apply everything before app.whenReady()
PERFORMANCE_FLAGS.forEach(flag => {
  const [key, value] = flag.split('=');
  if (value !== undefined) {
    app.commandLine.appendSwitch(key, value);
  } else {
    app.commandLine.appendSwitch(key);
  }
});

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    frame: false,
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

  // Enforce 16:9 so the game’s native resolution isn’t stretched
  win.setAspectRatio(16 / 9);

  win.once('ready-to-show', () => win.show());

  win.loadURL('https://play.soulbound.game/');
  win.setMenuBarVisibility(false);

  win.webContents.on('did-finish-load', () => {
    // 1) Make sure we’re at normal zoom
    win.webContents.setZoomFactor(1);

    // 2) Preserve pixel-art scaling (nearest-neighbor)
    win.webContents.insertCSS(`
      html, body, canvas, img {
        image-rendering: pixelated !important;
      }
    `);
  });

  // Right-click → “Quit” menu
  quitMenu = Menu.buildFromTemplate([{
    label: 'Quit',
    click: confirmQuit
  }]);
  win.webContents.on('context-menu', () => {
    quitMenu.popup({ window: win });
  });
}

function confirmQuit() {
  if (isQuitDialogOpen) return;
  if (exitWindow && !exitWindow.isDestroyed()) return;
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
}
function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}

if (require.main === module) {
  app.whenReady().then(() => {
    createWindow();
    registerShortcuts();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
        registerShortcuts();
      }
    });
  });

  app.on('will-quit', unregisterShortcuts);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

module.exports = {
  PERFORMANCE_FLAGS
};
