const assert = require('assert');
const Module = require('module');

// Provide a minimal stub for the 'electron' module so main.js can be required
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        commandLine: { appendSwitch() {} },
        whenReady: () => Promise.resolve(),
        on() {}
      },
      BrowserWindow: class {},
      globalShortcut: { register() {}, unregisterAll() {} },
      Menu: { buildFromTemplate: () => ({ popup() {} }) },
      ipcMain: { on() {} }
    };
  }
  return originalLoad(request, parent, isMain);
};

const main = require('../main.js');
Module._load = originalLoad;

assert.ok(Array.isArray(main.PERFORMANCE_FLAGS), 'PERFORMANCE_FLAGS should be an array');
assert.ok(main.PERFORMANCE_FLAGS.includes('enable-async-dns'), 'enable-async-dns flag is present');

console.log('All tests passed');

