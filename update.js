// update.js
const { BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let updaterWindow = null;

function initAutoUpdater(mainWin) {
  autoUpdater.on('update-available', () => {
    if (updaterWindow) return;
    updaterWindow = new BrowserWindow({
      width: 400,
      height: 160,
      frame: true,
      resizable: false,
      movable: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      show: false,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true
      }
    });
    updaterWindow.loadFile(path.join(__dirname, 'update.html'));
    updaterWindow.once('ready-to-show', () => {
      updaterWindow.show();
    });
  });

  autoUpdater.on('download-progress', progress => {
    updaterWindow?.webContents.send('download-progress', {
      percent: Math.floor(progress.percent),
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