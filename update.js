// update.js
const { BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let updaterWindow = null;

function initAutoUpdater(mainWin) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Fynn9563',
    repo: 'Soulbound-Wrapper'
  });

  autoUpdater.on('update-available', () => {
    if (updaterWindow) return;

    updaterWindow = new BrowserWindow({
      parent: mainWin,
      width: 360,
      height: 200,
      frame: false,
      resizable: false,
      transparent: true,
      movable: true,
      closable: false,
      alwaysOnTop: true,
      skipTaskbar: false,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true
      }
    });

    updaterWindow.loadFile(path.join(__dirname, 'update.html'));
    updaterWindow.once('ready-to-show', () => updaterWindow.show());
    updaterWindow.on('closed', () => { updaterWindow = null; });
  });

  autoUpdater.on('download-progress', progress => {
    const percent = Math.floor(progress.percent);
    updaterWindow?.webContents.send('download-progress', {
      percent,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', () => {
    updaterWindow?.webContents.send('update-downloaded');
  });


  autoUpdater.checkForUpdates();
}

ipcMain.on('update-now', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on('update-later', () => {
  if (updaterWindow) updaterWindow.close();
});

module.exports = { initAutoUpdater };