// tests/test.js
const assert = require('assert');
const Module = require('module');
const path = require('path');
const fs = require('fs');

console.log('\n=== Starting Soulbound Wrapper Tests ===\n');

// Read blocked URLs from blocked_urls.txt
const blockedUrls = fs.readFileSync(
  path.join(__dirname, '..', 'blocked_urls.txt'),
  'utf-8'
)
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));

let windowCreatedCount = 0;
let windowInstance = null;
const shortcuts = {};
const blockedRequests = [];

// Stub out Electron and electron-updater
console.log('1) Stubbing Electron and electron-updater modules...\n');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  // Stub electron
  if (request === 'electron') {
    return {
      app: {
        getVersion() { return require(path.join(__dirname, '..', 'package.json')).version; },
        getPath() { return __dirname; },
        commandLine: { appendSwitch() {} },
        whenReady() { return Promise.resolve(); },
        on() {},
        quit() {}
      },
      BrowserWindow: class {
        constructor() {
          windowCreatedCount++;
          this._isFullScreen = true;
          this._devToolsOpened = false;
          this._listeners = {};
          windowInstance = this;
        }
        setAspectRatio() {}
        once(event, cb) { if (event === 'ready-to-show') cb(); }
        show() {}
        loadURL() {}
        loadFile() {}
        setMenuBarVisibility() {}
        isFullScreen() { return this._isFullScreen; }
        setFullScreen(flag) { this._isFullScreen = flag; }
        on(event, cb) {
          this._listeners[event] = this._listeners[event] || [];
          this._listeners[event].push(cb);
        }
        get webContents() {
          return {
            isDevToolsOpened: () => windowInstance._devToolsOpened,
            openDevTools: () => { windowInstance._devToolsOpened = true; },
            closeDevTools: () => { windowInstance._devToolsOpened = false; },
            on: (evt, cb) => {
              windowInstance._listeners['webContents:' + evt] =
                windowInstance._listeners['webContents:' + evt] || [];
              windowInstance._listeners['webContents:' + evt].push(cb);
            },
            setZoomFactor() {},
            insertCSS() {},
            session: {
              webRequest: {
                onBeforeRequest: (filter, cb) => {
                  blockedRequests.push({ filter, cb });
                }
              }
            }
          };
        }
      },
      globalShortcut: {
        register(accel, cb) { shortcuts[accel] = cb; },
        unregisterAll() {}
      },
      Menu: {
        buildFromTemplate: () => ({ popup() {} })
      },
      ipcMain: { on() {} }
    };
  }
  // Stub electron-updater
  if (request === 'electron-updater') {
    return {
      autoUpdater: {
        setFeedURL() {},
        checkForUpdates() {},
        on() {},
        quitAndInstall() {}
      }
    };
  }
  return originalLoad(request, parent, isMain);
};

// Load main.js
console.log('2) Requiring main.js...\n');
const mainModule = require(path.join(__dirname, '..', 'main.js'));

// Verify PERFORMANCE_FLAGS
console.log('3) Verifying PERFORMANCE_FLAGS...\n');
assert.ok(
  Array.isArray(mainModule.PERFORMANCE_FLAGS),
  'ERROR: PERFORMANCE_FLAGS should be an array'
);

// Call start() and run tests
console.log('4) Calling start()...\n');
mainModule.start()
  .then(() => {
    console.log('5) start() resolved. Running tests...\n');

    // BrowserWindow creation
    assert.ok(windowCreatedCount >= 1, 'ERROR: BrowserWindow should have been created');
    console.log('   ✓ BrowserWindow created');

    // F11 toggle
    assert.strictEqual(windowInstance.isFullScreen(), true);
    shortcuts['F11']();
    assert.strictEqual(windowInstance.isFullScreen(), false);
    shortcuts['F11']();
    assert.strictEqual(windowInstance.isFullScreen(), true);
    console.log('   ✓ F11 toggles fullscreen');

    // F12 toggle
    const f12Listeners = windowInstance._listeners['webContents:before-input-event'];
    assert.ok(f12Listeners && f12Listeners.length > 0, 'ERROR: No before-input-event listener');
    f12Listeners.forEach(cb => cb({ preventDefault() {} }, { key: 'F12', type: 'keyDown', isAutoRepeat: false }));
    assert.strictEqual(windowInstance._devToolsOpened, true);
    f12Listeners.forEach(cb => cb({ preventDefault() {} }, { key: 'F12', type: 'keyDown', isAutoRepeat: false }));
    assert.strictEqual(windowInstance._devToolsOpened, false);
    console.log('   ✓ F12 toggles DevTools');

    // URL blocking
    assert.ok(blockedRequests.length > 0, 'ERROR: No webRequest.onBeforeRequest listener registered');
    blockedRequests.forEach(({ filter, cb }) => {
      const url = filter.urls[0];
      let cancelled = false;
      cb({ method: 'GET', url }, res => { cancelled = res.cancel; });
      assert.strictEqual(cancelled, true, `ERROR: URL ${url} was not blocked`);
    });
    console.log('   ✓ URL blocking works');

    // Cleanup
    Module._load = originalLoad;
    console.log('\n✓ All tests passed successfully.\n');
  })
  .catch(err => {
    Module._load = originalLoad;
    console.error('\n✗ Tests failed:\n', err);
    process.exit(1);
  });