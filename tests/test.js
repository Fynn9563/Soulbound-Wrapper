// tests/test.js
const assert = require('assert');
const Module = require('module');
const path = require('path');

console.log('\n=== Starting Soulbound Wrapper Tests ===\n');

let windowCreatedCount = 0;
let windowInstance = null;
const shortcuts = {};

// Stub out Electron to intercept BrowserWindow creation and track functionality
console.log('1) Stubbing Electron module to intercept "electron" requires.\n');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    console.log('   ➤ Intercepted require("electron") – returning stubbed Electron API.\n');
    return {
      app: {
        commandLine: {
          appendSwitch(flag, value) {
            console.log(`   [Stub] app.commandLine.appendSwitch called with: ${flag}${value ? `=${value}` : ''}`);
          }
        },
        whenReady() {
          console.log('   [Stub] app.whenReady called – simulating app readiness.');
          return Promise.resolve();
        },
        on(event) {
          console.log(`   [Stub] app.on called for event: "${event}"`);
        },
        quit() {
          console.log('   [Stub] app.quit called.');
        }
      },
      BrowserWindow: class {
        constructor(options) {
          windowCreatedCount++;
          console.log(`   [Stub] BrowserWindow constructor called (${windowCreatedCount} total).`);
          this._isMainWindow = windowCreatedCount === 1;
          this._isFullScreen = true; // default initial state
          this._listeners = {};
          windowInstance = this;
        }
        setAspectRatio(ratio) {
          console.log(`   [Stub] BrowserWindow.setAspectRatio called with ratio: ${ratio}`);
        }
        once(event, callback) {
          console.log(`   [Stub] BrowserWindow.once called for event: "${event}" – invoking callback immediately.`);
          if (event === 'ready-to-show') {
            callback();
          }
        }
        show() {
          console.log('   [Stub] BrowserWindow.show called – window would be shown.');
        }
        loadURL(url) {
          console.log(`   [Stub] BrowserWindow.loadURL called with URL: ${url}`);
        }
        loadFile(filePath) {
          console.log(`   [Stub] BrowserWindow.loadFile called with path: ${filePath}`);
        }
        setMenuBarVisibility(visible) {
          console.log(`   [Stub] BrowserWindow.setMenuBarVisibility called with: ${visible}`);
        }
        isFullScreen() {
          return this._isFullScreen;
        }
        setFullScreen(flag) {
          this._isFullScreen = flag;
          console.log(`   [Stub] BrowserWindow.setFullScreen called, new state: ${flag}`);
        }
        on(event, callback) {
          console.log(`   [Stub] BrowserWindow.on called for event: "${event}"`);
          this._listeners[event] = this._listeners[event] || [];
          this._listeners[event].push(callback);
        }
        get webContents() {
          return {
            on: (evt, cb) => {
              console.log(`   [Stub] webContents.on called for event: "${evt}"`);
              windowInstance._listeners['webContents:' + evt] = windowInstance._listeners['webContents:' + evt] || [];
              windowInstance._listeners['webContents:' + evt].push(cb);
            },
            setZoomFactor: (f) => {
              console.log(`   [Stub] webContents.setZoomFactor called with: ${f}`);
            },
            insertCSS: (css) => {
              console.log(`   [Stub] webContents.insertCSS called (CSS length: ${css.length} characters).`);
            }
          };
        }
      },
      globalShortcut: {
        register(accelerator, callback) {
          console.log(`   [Stub] globalShortcut.register called for: "${accelerator}"`);
          shortcuts[accelerator] = callback;
        },
        unregisterAll() {
          console.log('   [Stub] globalShortcut.unregisterAll called.');
        }
      },
      Menu: {
        buildFromTemplate(template) {
          console.log('   [Stub] Menu.buildFromTemplate called – building context menu.');
          return {
            popup: (options) => {
              console.log('   [Stub] menu.popup called with options:', options);
            }
          };
        }
      },
      ipcMain: {
        on(channel, listener) {
          console.log(`   [Stub] ipcMain.on called for channel: "${channel}"`);
        }
      }
    };
  }
  return originalLoad(request, parent, isMain);
};

// Load main.js, which applies PERFORMANCE_FLAGS and calls start()
const mainPath = path.join(__dirname, '..', 'main.js');
console.log(`2) Requiring main module from: ${mainPath}\n`);
const mainModule = require(mainPath);

// Verify PERFORMANCE_FLAGS exists and is an array
console.log('3) Verifying PERFORMANCE_FLAGS in mainModule...');
assert.ok(
  Array.isArray(mainModule.PERFORMANCE_FLAGS),
  'ERROR: PERFORMANCE_FLAGS should be an array'
);
console.log(`   ✓ PERFORMANCE_FLAGS is an array (length: ${mainModule.PERFORMANCE_FLAGS.length}).`);
console.log(`   ✓ PERFORMANCE_FLAGS content: ${JSON.stringify(mainModule.PERFORMANCE_FLAGS)}\n`);

// Call start() and perform tests
console.log('4) Calling mainModule.start() to create main BrowserWindow...');
mainModule.start()
  .then(() => {
    // After start resolves, windowInstance should refer to main window stub
    console.log('\n5) mainModule.start() resolved – verifying main window creation...');
    console.log(`   ➤ Total BrowserWindow instances created: ${windowCreatedCount} (expecting at least 1)`);
    assert.ok(windowCreatedCount >= 1, 'ERROR: BrowserWindow should have been created at least once');
    console.log('   ✓ Main BrowserWindow created successfully.\n');

    // Test F11 toggles fullscreen and windowed
    console.log('6) Testing F11 functionality (toggle fullscreen/windowed)...');
    console.log(`   • Initially, isFullScreen(): ${windowInstance.isFullScreen()}`);
    assert.strictEqual(windowInstance.isFullScreen(), true, 'ERROR: Window should start in fullscreen');
    console.log('   • Pressing F11 to toggle state...');
    shortcuts['F11']();
    console.log(`   • After first F11, isFullScreen(): ${windowInstance.isFullScreen()}`);
    assert.strictEqual(windowInstance.isFullScreen(), false, 'ERROR: Window should be windowed after first F11');
    console.log('   • Pressing F11 again to toggle back...');
    shortcuts['F11']();
    console.log(`   • After second F11, isFullScreen(): ${windowInstance.isFullScreen()}`);
    assert.strictEqual(windowInstance.isFullScreen(), true, 'ERROR: Window should return to fullscreen after second F11');
    console.log('   ✓ F11 toggles fullscreen/windowed as expected.\n');

    // Test ESC hold to open quit dialog
    console.log('7) Testing ESC hold functionality (open quit dialog)...');
    const beforeEscWindows = windowCreatedCount;
    console.log(`   • Before ESC hold, BrowserWindow count: ${beforeEscWindows}`);
    const escListeners = windowInstance._listeners['webContents:before-input-event'];
    assert.ok(escListeners && escListeners.length > 0, 'ERROR: No before-input-event listener registered');
    // Simulate ESC keyDown and keyUp with preventDefault stub
    console.log('   • Simulating ESC keyDown...');
    escListeners.forEach(cb => cb({ preventDefault: () => {} }, { key: 'Escape', type: 'keyDown', isAutoRepeat: false }));
    // Wait 600ms to exceed 500ms threshold
    setTimeout(() => {
      // Simulate ESC keyUp after hold
      console.log('   • Simulating ESC keyUp after hold...');
      escListeners.forEach(cb => cb({ preventDefault: () => {} }, { key: 'Escape', type: 'keyUp' }));
      console.log(`   • After ESC hold, BrowserWindow count: ${windowCreatedCount} (should be previous + 1)`);
      assert.strictEqual(windowCreatedCount, beforeEscWindows + 1, 'ERROR: Quit confirmation window was not opened on ESC hold');
      console.log('   ✓ ESC hold opened quit confirmation window as expected.\n');

      // Restore original Module._load
      Module._load = originalLoad;
      console.log('8) Module._load restored to original implementation.\n');
      console.log('✓ All tests passed successfully.\n');
    }, 600);
  })
  .catch(err => {
    // Restore original Module._load
    Module._load = originalLoad;
    console.error('\n✗ Tests failed with error:\n', err);
    process.exit(1);
  });