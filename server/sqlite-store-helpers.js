const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function getAppDataPaths(options = {}) {
    const baseDir = options.baseDir || process.cwd();
    const dataDir = options.dataDir || process.env.APP_DATA_DIR || path.join(baseDir, 'data');
    const dbPath = path.join(dataDir, 'stockandcrypto.db');

    return { dataDir, dbPath };
}

function openAppDatabase(options = {}) {
    const { dataDir, dbPath } = getAppDataPaths(options);
    fs.mkdirSync(dataDir, { recursive: true });

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    return { db, dbPath, dataDir };
}

module.exports = {
    getAppDataPaths,
    openAppDatabase
};
