// Mock vscode module for benchmarks
module.exports = {
    window: {
        activeTextEditor: null,
        showErrorMessage: () => {},
        showWarningMessage: () => {},
        showInformationMessage: () => {},
        createOutputChannel: () => ({
            append: () => {},
            appendLine: () => {},
            clear: () => {},
            show: () => {},
            hide: () => {},
            dispose: () => {}
        })
    },
    workspace: {
        getConfiguration: () => ({
            get: () => false
        })
    },
    OutputChannel: class {
        append() {}
        appendLine() {}
        clear() {}
        show() {}
        hide() {}
        dispose() {}
    }
};