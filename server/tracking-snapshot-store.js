const fs = require('fs');
const path = require('path');
const { deepCopy } = require('./value-helpers');

function createTrackingSnapshotStore({
    cacheDir,
    fsModule = fs,
    pathModule = path,
    logger = console,
    now = () => new Date().toISOString()
} = {}) {
    function snapshotPath(name) {
        return pathModule.join(cacheDir, `${name}.json`);
    }

    function readSnapshot(name) {
        try {
            const filePath = snapshotPath(name);
            if (!fsModule.existsSync(filePath)) {
                return null;
            }
            return JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
        } catch (error) {
            return null;
        }
    }

    function writeSnapshot(name, payload) {
        try {
            fsModule.mkdirSync(cacheDir, { recursive: true });
            fsModule.writeFileSync(snapshotPath(name), JSON.stringify(payload));
        } catch (error) {
            logger.warn(`tracking snapshot write failed for ${name}: ${error.message}`);
        }
    }

    function markBucketStale(bucket, reason, fallbackSource = 'tracking') {
        const stalePayload = deepCopy(bucket);
        stalePayload.meta = {
            ...stalePayload.meta,
            source: stalePayload.meta?.source || fallbackSource,
            stale: true,
            staleReason: reason,
            timestamp: now()
        };
        stalePayload.rows = Array.isArray(stalePayload.rows)
            ? stalePayload.rows.map((row) => ({
                ...row,
                stale: true,
                staleReason: reason,
                status: row.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'STALE'
            }))
            : [];
        return stalePayload;
    }

    return {
        markBucketStale,
        readSnapshot,
        writeSnapshot
    };
}

module.exports = {
    createTrackingSnapshotStore
};
