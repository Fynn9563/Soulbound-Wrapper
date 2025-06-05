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
  win = new BrowserWindow({
    fullscreen: true,
    frame: true,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
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

  if (typeof win.setAspectRatio === 'function') {
    win.setAspectRatio(16 / 9);
  }

  if (typeof win.once === 'function') {
    win.once('ready-to-show', () => {
      if (typeof win.show === 'function') {
        win.show();
      }
    });
  }

  if (typeof win.loadURL === 'function') {
    win.loadURL('https://play.soulbound.game/');
  }

  if (win.webContents && typeof win.webContents.on === 'function') {
    win.webContents.on('did-finish-load', () => {
      if (typeof win.webContents.setZoomFactor === 'function') {
        win.webContents.setZoomFactor(1);
      }
      if (typeof win.webContents.insertCSS === 'function') {
        win.webContents.insertCSS(`
          html, body, canvas, img {
            image-rendering: pixelated !important;
          }
        `);
      }
    });
  }

  if (typeof win.on === 'function') {
    win.on('enter-full-screen', () => {
      if (typeof win.setMenuBarVisibility === 'function') {
        win.setMenuBarVisibility(false);
      }
    });

    win.on('leave-full-screen', () => {
      if (typeof win.setMenuBarVisibility === 'function') {
        win.setMenuBarVisibility(false);
      }
    });
  }

  if (Menu && typeof Menu.buildFromTemplate === 'function' && win.webContents && typeof win.webContents.on === 'function') {
    quitMenu = Menu.buildFromTemplate([
      { label: 'Quit', click: confirmQuit }
    ]);
    win.webContents.on('context-menu', () => {
      if (quitMenu && typeof quitMenu.popup === 'function') {
        quitMenu.popup({ window: win });
      }
    });
  }
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

  if (typeof exitWindow.loadFile === 'function') {
    exitWindow.loadFile(path.join(__dirname, 'exit.html'));
  }

  if (typeof exitWindow.once === 'function') {
    exitWindow.once('ready-to-show', () => {
      if (typeof exitWindow.show === 'function') {
        exitWindow.show();
      }
    });
  }

  if (typeof exitWindow.on === 'function') {
    exitWindow.on('closed', () => {
      isQuitDialogOpen = false;
      exitWindow = null;
    });
  }
}

ipcMain.on('exit-dialog-selection', (e, action) => {
  if (action === 'cancel' && exitWindow && !exitWindow.isDestroyed()) {
    exitWindow.close();
  } else if (action === 'quit') {
    app.quit();
  }
});

function registerShortcuts() {
  if (typeof globalShortcut.register === 'function') {
    globalShortcut.register('Escape', confirmQuit);
    globalShortcut.register('F11', () => {
      if (win && typeof win.isFullScreen === 'function' && win.isFullScreen()) {
        win.setFullScreen(false);
      }
    });
  }
}

function unregisterShortcuts() {
  if (typeof globalShortcut.unregisterAll === 'function') {
    globalShortcut.unregisterAll();
  }
}

function start() {
  return app.whenReady().then(() => {
    createWindow();
    registerShortcuts();

    if (typeof app.on === 'function') {
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
          registerShortcuts();
        }
      });
    }
  }).then(() => {
    if (typeof app.on === 'function') {
      app.on('will-quit', unregisterShortcuts);
      app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
          app.quit();
        }
      });
    }
  });
}

start();

module.exports = {
  PERFORMANCE_FLAGS,
  start
};