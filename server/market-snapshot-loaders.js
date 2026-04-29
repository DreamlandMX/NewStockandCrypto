const fs = require('fs');
const {
    normalizeUsSourceSymbol,
    normalizeUsSymbol
} = require('./us-market-data');

function readSnapshotFile(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing ${label} snapshot file: ${filePath}`);
    }

    try {
        const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Failed to parse ${label} snapshot: ${error.message}`);
    }
}

function expectConstituentRows(parsed, label, expectedCount) {
    if (!Array.isArray(parsed.constituents)) {
        throw new Error(`Invalid ${label} snapshot format: constituents must be an array`);
    }
    if (parsed.constituents.length !== expectedCount) {
        throw new Error(`Invalid ${label} snapshot size: expected ${expectedCount}, got ${parsed.constituents.length}`);
    }
    return parsed.constituents;
}

function loadCsi300Snapshot(filePath) {
    const parsed = readSnapshotFile(filePath, 'CSI300');
    const rows = expectConstituentRows(parsed, 'CSI300', 300);
    const seenSecids = new Set();

    return rows.map((row, index) => {
        const code = String(row.code || '').trim();
        const name = String(row.name || '').trim();
        const market = String(row.market || '').toUpperCase();
        const secid = String(row.secid || '').trim();
        const expectedSecid = `${market === 'SH' ? 1 : 0}.${code}`;

        if (!/^\d{6}$/.test(code)) {
            throw new Error(`Invalid code at row ${index + 1}: ${code}`);
        }
        if (market !== 'SH' && market !== 'SZ') {
            throw new Error(`Invalid market at row ${index + 1}: ${market}`);
        }
        if (secid !== expectedSecid) {
            throw new Error(`Invalid secid at row ${index + 1}: ${secid}, expected ${expectedSecid}`);
        }
        if (seenSecids.has(secid)) {
            throw new Error(`Duplicate secid at row ${index + 1}: ${secid}`);
        }

        seenSecids.add(secid);
        return { code, name, market, secid };
    });
}

function loadSp500Snapshot(filePath) {
    const parsed = readSnapshotFile(filePath, 'S&P 500');
    const rows = expectConstituentRows(parsed, 'S&P 500', 500);
    const seenSymbols = new Set();

    return rows.map((row, index) => {
        const symbol = normalizeUsSymbol(row.symbol);
        const name = String(row.name || '').trim();
        const sector = String(row.sector || '').trim() || 'Other';
        const sourceSymbol = String(row.sourceSymbol || normalizeUsSourceSymbol(symbol)).trim().toUpperCase();

        if (!symbol || !/^[A-Z0-9.]+$/.test(symbol)) {
            throw new Error(`Invalid symbol at row ${index + 1}: ${row.symbol}`);
        }
        if (!name) {
            throw new Error(`Missing security name at row ${index + 1}`);
        }
        if (!sourceSymbol.endsWith('.US')) {
            throw new Error(`Invalid sourceSymbol at row ${index + 1}: ${sourceSymbol}`);
        }
        if (seenSymbols.has(symbol)) {
            throw new Error(`Duplicate symbol at row ${index + 1}: ${symbol}`);
        }

        seenSymbols.add(symbol);
        return { symbol, name, sector, sourceSymbol };
    });
}

module.exports = {
    loadCsi300Snapshot,
    loadSp500Snapshot
};
