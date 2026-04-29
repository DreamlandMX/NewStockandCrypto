const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    loadCsi300Snapshot,
    loadSp500Snapshot
} = require('../server/market-snapshot-loaders');

function makeTempSnapshotFile(t, payload) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-snapshot-'));
    const filePath = path.join(tempDir, 'snapshot.json');
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
    t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));
    return filePath;
}

function makeCsi300Rows() {
    return Array.from({ length: 300 }, (_, index) => {
        const code = String(600000 + index).padStart(6, '0');
        return {
            code,
            name: `CSI ${index + 1}`,
            market: 'SH',
            secid: `1.${code}`
        };
    });
}

function makeSp500Rows() {
    return Array.from({ length: 500 }, (_, index) => ({
        symbol: `T${index + 1}`,
        name: `S&P ${index + 1}`,
        sector: 'Technology',
        sourceSymbol: `T${index + 1}.US`
    }));
}

test('market snapshot loaders read CSI300 rows from a JSON file', (t) => {
    const filePath = makeTempSnapshotFile(t, { constituents: makeCsi300Rows() });
    const rows = loadCsi300Snapshot(filePath);

    assert.equal(rows.length, 300);
    assert.deepEqual(rows[0], {
        code: '600000',
        name: 'CSI 1',
        market: 'SH',
        secid: '1.600000'
    });
});

test('market snapshot loaders reject invalid CSI300 row counts', (t) => {
    const filePath = makeTempSnapshotFile(t, { constituents: makeCsi300Rows().slice(0, 2) });

    assert.throws(() => loadCsi300Snapshot(filePath), /expected 300/);
});

test('market snapshot loaders read and normalize S&P 500 rows', (t) => {
    const rows = makeSp500Rows();
    rows[0] = {
        symbol: 'BRK-B.US',
        name: 'Berkshire Hathaway',
        sector: '',
        sourceSymbol: ''
    };
    const filePath = makeTempSnapshotFile(t, { constituents: rows });
    const parsed = loadSp500Snapshot(filePath);

    assert.equal(parsed.length, 500);
    assert.deepEqual(parsed[0], {
        symbol: 'BRK.B',
        name: 'Berkshire Hathaway',
        sector: 'Other',
        sourceSymbol: 'BRK-B.US'
    });
});
