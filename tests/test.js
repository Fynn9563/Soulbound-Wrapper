// tests/test.js
const assert = require('assert');
const Module = require('module');
const path = require('path');

let windowCreated = false;

// Stub out Electron to intercept BrowserWindow creation
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        commandLine: { appendSwitch() {} },
        whenReady: () => Promise.resolve(),
        on() {},
        quit() {}
      },
      BrowserWindow: class {
        constructor() {
          windowCreated = true;
        }
        setAspectRatio() {}
        once(event, callback) {
          if (event === 'ready-to-show') callback();
        }
        show() {}
        loadURL() {}
        setMenuBarVisibility() {}
        get webContents() {
          return {
            on() {},
            setZoomFactor() {},
            insertCSS() {}
          };
        }
      },
      globalShortcut: { register() {}, unregisterAll() {} },
      Menu: { buildFromTemplate: () => ({ popup() {} }) },
      ipcMain: { on() {} }
    };
  }
  return originalLoad(request, parent, isMain);
};

// Load main.js, which applies PERFORMANCE_FLAGS and calls start()
const mainModule = require(path.join(__dirname, '..', 'main.js'));

// Verify PERFORMANCE_FLAGS exists and is an array
assert.ok(
  Array.isArray(mainModule.PERFORMANCE_FLAGS),
  'PERFORMANCE_FLAGS should be an array'
);

// Call start() and check that BrowserWindow was instantiated
mainModule.start()
  .then(() => {
    Module._load = originalLoad;
    assert.ok(windowCreated, 'BrowserWindow should have been created');
    console.log('All tests passed');
  })
  .catch(err => {
    Module._load = originalLoad;
    console.error('Tests failed:', err);
    process.exit(1);
  });