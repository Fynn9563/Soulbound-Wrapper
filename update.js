const { BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let updaterWindow = null;

function initAutoUpdater(mainWin) {
  autoUpdater.on('update-available', () => {
    if (updaterWindow) return;

    updaterWindow = new BrowserWindow({
      width: 320,
      height: 200,
      frame: false,
      transparent: true,
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true
      }
    });

    updaterWindow.removeMenu();
    updaterWindow.loadFile(path.join(__dirname, 'update.html'));
    updaterWindow.once('ready-to-show', () => {
      updaterWindow.show();
    });

    updaterWindow.on('closed', () => {
      updaterWindow = null;
    });
  });

  autoUpdater.on('download-progress', progress => {
    // ensure percent is integer
    const percentInt = Math.floor(progress.percent);
    updaterWindow?.webContents.send('download-progress', {
      percent: percentInt,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', () => {
    updaterWindow?.webContents.send('update-downloaded');
  });

  autoUpdater.checkForUpdates();
}

module.exports = { initAutoUpdater };