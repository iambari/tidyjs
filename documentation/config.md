/** @type {import('tidyjs').Config} */
module.exports = {
    groups: [
        {
            name: "Misc",
            order: 0,
            priority: 999,
            isDefault: true,
        },
        {
            name: "DS",
            order: 1,
            match: /^ds$/
        },
        {
            name: "@app/dossier",
            order: 2,
            match: /^@app\/dossier/
        },
        {
            name: "@app",
            order: 3,
            match: /^@app/
        },
        {
            name: "@core",
            order: 4,
            match: /^@core/
        },
        {
            name: "@library",
            order: 5,
            match: /^@library/
        },
        {
            name: "Utils",
            order: 6,
            match: /^yutils/
        }
    ],

    format: {
        onSave: false,
    },

    patterns: {
        appModules: /^@app\/([a-zA-Z0-9_-]+)/,
    }
}

