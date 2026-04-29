const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openAppDatabase } = require('../server/sqlite-store-helpers');

test('openAppDatabase creates the data folder and opens the shared app database', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-db-'));

    const { db, dbPath, dataDir } = openAppDatabase({ baseDir });

    try {
        assert.equal(dataDir, path.join(baseDir, 'data'));
        assert.equal(dbPath, path.join(baseDir, 'data', 'stockandcrypto.db'));
        assert.equal(fs.existsSync(dataDir), true);
        assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    } finally {
        db.close();
        fs.rmSync(baseDir, { recursive: true, force: true });
    }
});
