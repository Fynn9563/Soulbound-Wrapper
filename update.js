// update.js
const { BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let updaterWindow = null;

function initAutoUpdater(mainWin) {
  // Point to your GitHub repo
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'Fynn9563',
    repo: 'Soulbound-Wrapper'
  });

  // Show the update window when there’s an available update
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
      closable: false,         // disable the “X” button
      alwaysOnTop: true,
      skipTaskbar: false,      // show in taskbar
      autoHideMenuBar: true,   // hide File/Edit/etc
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

    updaterWindow.on('closed', () => {
      updaterWindow = null;
    });
  });

  // Send integer-only progress
  autoUpdater.on('download-progress', progress => {
    const percent = Math.floor(progress.percent);
    updaterWindow?.webContents.send('download-progress', {
      percent,
      transferred: progress.transferred,
      total: progress.total
    });
  });

  // Signal when download is finished
  autoUpdater.on('update-downloaded', () => {
    updaterWindow?.webContents.send('update-downloaded');
  });

  // Kick off the check
  autoUpdater.checkForUpdatesAndNotify();
}

// “Now” button → quit & install immediately
ipcMain.on('update-now', () => {
  autoUpdater.quitAndInstall();
});

// “Later” button → close the updater window
ipcMain.on('update-later', () => {
  if (updaterWindow) updaterWindow.close();
});

module.exports = { initAutoUpdater };