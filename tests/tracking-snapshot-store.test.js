const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrackingSnapshotStore } = require('../server/tracking-snapshot-store');

test('tracking snapshot store reads and writes named JSON snapshots', () => {
    const files = new Map();
    const store = createTrackingSnapshotStore({
        cacheDir: '/cache',
        fsModule: {
            existsSync: (filePath) => files.has(filePath),
            mkdirSync: () => {},
            readFileSync: (filePath) => files.get(filePath),
            writeFileSync: (filePath, value) => files.set(filePath, value)
        }
    });

    store.writeSnapshot('crypto', { ok: true });

    assert.deepEqual(store.readSnapshot('crypto'), { ok: true });
    assert.equal(store.readSnapshot('missing'), null);
});

test('tracking snapshot store returns null when a snapshot cannot be parsed', () => {
    const store = createTrackingSnapshotStore({
        cacheDir: '/cache',
        fsModule: {
            existsSync: () => true,
            readFileSync: () => '{not json'
        }
    });

    assert.equal(store.readSnapshot('bad'), null);
});

test('tracking snapshot store marks bucket rows stale without mutating the original bucket', () => {
    const store = createTrackingSnapshotStore({
        cacheDir: '/cache',
        now: () => '2026-01-01T00:00:00.000Z'
    });
    const bucket = {
        meta: { source: 'live' },
        rows: [{ symbol: 'BTC', status: 'LIVE' }]
    };

    const stale = store.markBucketStale(bucket, 'network down');

    assert.equal(bucket.rows[0].status, 'LIVE');
    assert.equal(stale.meta.stale, true);
    assert.equal(stale.meta.staleReason, 'network down');
    assert.equal(stale.rows[0].status, 'STALE');
});
