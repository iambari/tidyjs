// Setup mock for vscode module
const Module = require('module');
const path = require('path');

const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
    if (id === 'vscode') {
        return require('./vscode-mock.js');
    }
    return originalRequire.apply(this, arguments);
};

// Also handle the _resolveFilename for import statements
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain) {
    if (request === 'vscode') {
        return path.join(__dirname, 'vscode-mock.js');
    }
    return originalResolveFilename.apply(this, arguments);
};