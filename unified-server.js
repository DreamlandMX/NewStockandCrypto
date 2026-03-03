// Unified server for StockandCrypto.
// Exposes static frontend and API routes on the same port (default: 9000).

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 9000);
const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = Number(process.env.API_PORT || 5001);
const WEB_ROOT = path.join(__dirname, 'web');

const CRYPTO_CACHE_TTL_MS = Number(process.env.CRYPTO_CACHE_TTL_MS || 9000);
const CN_CACHE_TTL_MS = Number(process.env.CN_CACHE_TTL_MS || 9000);
const CN_POLL_INTERVAL_SEC = Number(process.env.CN_POLL_INTERVAL_SEC || 10);
const BINANCE_US_URL = 'https://api.binance.us/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D';
const EASTMONEY_ULIST_FIELDS = 'f2,f3,f4,f12,f13,f14,f15,f16,f17,f18,f47,f48';
const EASTMONEY_ULIST_BASE = 'https://push2.eastmoney.com/api/qt/ulist.np/get';
const CSI300_SNAPSHOT_PATH = path.join(WEB_ROOT, 'assets', 'csi300-constituents.json');
const INDEX_SECIDS = {
    '000001.SH': '1.000001',
    '000300.SH': '1.000300'
};
const INDEX_NAME_BY_CODE = {
    '000001.SH': 'SSE Composite',
    '000300.SH': 'CSI 300'
};

let cryptoPriceCache = null;
let cryptoPriceCacheAt = 0;
let cnCache = null;
let cnCacheAt = 0;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    });
    res.end(body);
}

function parseNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
}

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTickerRows(rows) {
    if (!Array.isArray(rows)) {
        throw new Error('Unexpected Binance US payload');
    }

    const bySymbol = Object.fromEntries(rows.map((row) => [row.symbol, row]));
    const extract = (symbol) => {
        const row = bySymbol[symbol];
        if (!row) throw new Error(`Missing symbol ${symbol}`);

        const price = parseNumber(row.lastPrice);
        const change = parseNumber(row.priceChangePercent);
        const volume = parseNumber(row.quoteVolume);
        if (price === null || change === null || volume === null) {
            throw new Error(`Invalid numeric field for ${symbol}`);
        }

        return { symbol, price, change, volume };
    };

    return {
        meta: {
            source: 'binance_us',
            timestamp: new Date().toISOString(),
            stale: false
        },
        btc: extract('BTCUSDT'),
        eth: extract('ETHUSDT'),
        sol: extract('SOLUSDT')
    };
}

function fetchJsonFromHttps(url, timeoutMs = 5000, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const request = https.request(
            url,
            {
                method: 'GET',
                timeout: timeoutMs,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    Accept: 'application/json,text/plain,*/*'
                }
            },
            (upstream) => {
                let body = '';
                upstream.on('data', (chunk) => { body += chunk.toString('utf8'); });
                upstream.on('end', () => {
                    const statusCode = upstream.statusCode || 500;
                    if (statusCode >= 300 && statusCode <= 399 && upstream.headers.location) {
                        if (redirectCount >= 5) {
                            reject(new Error(`Too many upstream redirects from ${url}`));
                            return;
                        }
                        const nextUrl = new URL(upstream.headers.location, url).toString();
                        fetchJsonFromHttps(nextUrl, timeoutMs, redirectCount + 1).then(resolve).catch(reject);
                        return;
                    }
                    if (statusCode < 200 || statusCode > 299) {
                        reject(new Error(`Upstream status ${upstream.statusCode}`));
                        return;
                    }

                    try {
                        resolve(JSON.parse(body));
                    } catch (error) {
                        reject(new Error(`Invalid upstream JSON: ${error.message}`));
                    }
                });
            }
        );

        request.on('timeout', () => request.destroy(new Error('Upstream timeout')));
        request.on('error', reject);
        request.end();
    });
}

function fetchBinanceUS() {
    return fetchJsonFromHttps(BINANCE_US_URL, 5000).then(normalizeTickerRows);
}

function loadCsi300Snapshot() {
    if (!fs.existsSync(CSI300_SNAPSHOT_PATH)) {
        throw new Error(`Missing CSI300 snapshot file: ${CSI300_SNAPSHOT_PATH}`);
    }

    let parsed;
    try {
        const raw = fs.readFileSync(CSI300_SNAPSHOT_PATH, 'utf8').replace(/^\uFEFF/, '');
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(`Failed to parse CSI300 snapshot: ${error.message}`);
    }

    if (!Array.isArray(parsed.constituents)) {
        throw new Error('Invalid CSI300 snapshot format: constituents must be an array');
    }

    if (parsed.constituents.length !== 300) {
        throw new Error(`Invalid CSI300 snapshot size: expected 300, got ${parsed.constituents.length}`);
    }

    const seenSecids = new Set();
    return parsed.constituents.map((row, index) => {
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

const csi300Snapshot = loadCsi300Snapshot();
const csi300ByCode = new Map(csi300Snapshot.map((row) => [row.code, row]));
const csi300Secids = csi300Snapshot.map((row) => row.secid);

async function handleCryptoPrices(req, res) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const now = Date.now();
    if (cryptoPriceCache && now - cryptoPriceCacheAt <= CRYPTO_CACHE_TTL_MS) {
        sendJson(res, 200, cryptoPriceCache);
        return;
    }

    try {
        const payload = await fetchBinanceUS();
        cryptoPriceCache = payload;
        cryptoPriceCacheAt = Date.now();
        sendJson(res, 200, payload);
    } catch (error) {
        if (cryptoPriceCache) {
            sendJson(res, 200, {
                ...cryptoPriceCache,
                meta: {
                    ...cryptoPriceCache.meta,
                    stale: true,
                    stale_reason: error.message
                }
            });
            return;
        }
        sendJson(res, 502, {
            error: 'Failed to fetch crypto prices from Binance US',
            detail: error.message
        });
    }
}

function buildEastMoneyUListUrl(secids) {
    const secidsParam = encodeURIComponent(secids.join(','));
    return `${EASTMONEY_ULIST_BASE}?fltt=2&invt=2&fields=${EASTMONEY_ULIST_FIELDS}&secids=${secidsParam}`;
}

async function fetchEastMoneyQuotesForChunk(secids) {
    const payload = await fetchJsonFromHttps(buildEastMoneyUListUrl(secids), 9000);
    const diff = payload?.data?.diff;
    if (!Array.isArray(diff)) {
        throw new Error('Unexpected EastMoney quote payload');
    }
    return diff;
}

async function fetchEastMoneyQuotes(secids) {
    const CHUNK_SIZE = 60;
    const allRows = [];
    for (let i = 0; i < secids.length; i += CHUNK_SIZE) {
        const chunk = secids.slice(i, i + CHUNK_SIZE);
        const rows = await fetchEastMoneyQuotesForChunk(chunk);
        allRows.push(...rows);
    }

    const bySecid = new Map();
    for (const item of allRows) {
        const code = String(item.f12 || '').padStart(6, '0');
        const marketId = Number(item.f13);
        const secid = `${marketId}.${code}`;
        bySecid.set(secid, {
            code,
            secid,
            market: marketId === 1 ? 'SH' : marketId === 0 ? 'SZ' : '',
            name: String(item.f14 || ''),
            price: parseNumber(item.f2),
            changePct: parseNumber(item.f3),
            changeAmount: parseNumber(item.f4),
            high: parseNumber(item.f15),
            low: parseNumber(item.f16),
            open: parseNumber(item.f17),
            prevClose: parseNumber(item.f18),
            volume: parseNumber(item.f47),
            turnover: parseNumber(item.f48)
        });
    }
    return bySecid;
}

function calculatePrediction(quote) {
    const changePct = quote.changePct ?? 0;
    const prevClose = quote.prevClose || quote.price || 1;
    const intradayPct = prevClose > 0 && quote.open !== null && quote.price !== null
        ? ((quote.price - quote.open) / prevClose) * 100
        : 0;
    const high = quote.high ?? quote.price ?? prevClose;
    const low = quote.low ?? quote.price ?? prevClose;
    const rangePct = prevClose > 0 ? (high - low) / prevClose : 0;

    const trendComponent = clamp(changePct / 6, -1, 1);
    const intradayComponent = clamp(intradayPct / 4, -1, 1);
    const pUpRaw = 0.5 + trendComponent * 0.22 + intradayComponent * 0.18;
    const pUp = clamp(pUpRaw, 0.05, 0.95);
    const pDown = clamp(1 - pUp, 0.05, 0.95);

    const distance = Math.abs(pUp - 0.5) * 2;
    const rangePenalty = clamp(rangePct / 0.08, 0, 1);
    const confidence = clamp(0.45 + distance * 0.5 - rangePenalty * 0.15, 0.4, 0.98);

    const center = clamp((changePct / 100) * 0.45 + (pUp - 0.5) * 0.08, -0.09, 0.09);
    const spread = clamp(0.012 + rangePct * 0.6 + (1 - confidence) * 0.04, 0.01, 0.08);
    let q10 = clamp(center - spread * 0.9, -0.1, 0.1);
    let q50 = clamp(center, -0.09, 0.09);
    let q90 = clamp(center + spread * 0.9, -0.1, 0.1);
    const sorted = [q10, q50, q90].sort((a, b) => a - b);
    [q10, q50, q90] = sorted;

    const trendBias = clamp((pUp - 0.5) * 2, -1, 1);
    let w1 = clamp(0.24 + 0.18 * trendBias + 0.10 * confidence, 0.05, 0.60);
    let w2 = clamp(0.21 + 0.08 * trendBias + 0.06 * confidence, 0.05, 0.45);
    let w3 = clamp(0.20 - 0.05 * trendBias + 0.05 * (1 - confidence), 0.05, 0.40);
    let w4 = clamp(0.13 - 0.04 * trendBias + 0.06 * (1 - confidence), 0.03, 0.30);
    let w0 = Math.max(0.01, 1 - (w1 + w2 + w3 + w4));
    const total = w0 + w1 + w2 + w3 + w4;
    w0 /= total;
    w1 /= total;
    w2 /= total;
    w3 /= total;
    w4 /= total;

    const windowValues = { W0: w0, W1: w1, W2: w2, W3: w3, W4: w4 };
    const mostLikelyWindow = Object.entries(windowValues).sort((a, b) => b[1] - a[1])[0][0];
    const signal = pUp >= 0.55 ? 'LONG' : 'FLAT';

    return {
        pUp: Number(pUp.toFixed(4)),
        pDown: Number(pDown.toFixed(4)),
        confidence: Number(confidence.toFixed(4)),
        signal,
        q10: Number(q10.toFixed(4)),
        q50: Number(q50.toFixed(4)),
        q90: Number(q90.toFixed(4)),
        window: {
            W0: Number(w0.toFixed(4)),
            W1: Number(w1.toFixed(4)),
            W2: Number(w2.toFixed(4)),
            W3: Number(w3.toFixed(4)),
            W4: Number(w4.toFixed(4)),
            mostLikely: mostLikelyWindow
        }
    };
}

function calculatePolicy(prediction) {
    const pUp = prediction.pUp;
    const confidence = prediction.confidence;
    const uncertainty = prediction.q90 - prediction.q10;

    let signal = 'FLAT';
    let action = 'Hold';
    if (pUp >= 0.55 && confidence >= 0.85) {
        signal = 'LONG';
        action = 'Buy';
    } else if (pUp >= 0.55) {
        signal = 'LONG';
        action = 'Buy (Reduced Size)';
    } else if (pUp <= 0.45) {
        signal = 'FLAT';
        action = 'Sell Existing Position';
    }

    let sizeMultiplier = 0.9;
    if (uncertainty > 0.05) {
        sizeMultiplier = 0.5;
    } else if (uncertainty > 0.03) {
        sizeMultiplier = 0.7;
    }

    const positionSize = clamp(confidence * sizeMultiplier, 0, 1);
    return {
        signal,
        action,
        shortAllowed: false,
        leverage: 1.0,
        positionSize: Number(positionSize.toFixed(4))
    };
}

function calculateTpSl(entryPrice, prediction, signal) {
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        return {
            entryPrice: null,
            stopLoss: null,
            stopLossPct: null,
            takeProfit1: null,
            takeProfit1Pct: null,
            takeProfit2: null,
            takeProfit2Pct: null
        };
    }

    const q10 = prediction.q10;
    const q50 = prediction.q50;
    const q90 = prediction.q90;
    let stopLossPct;
    let takeProfit1Pct;
    let takeProfit2Pct;
    if (signal === 'LONG') {
        stopLossPct = Math.max(q10 * 0.8, -0.09);
        takeProfit1Pct = Math.min(q50 * 0.8, 0.09);
        takeProfit2Pct = Math.min(q90 * 0.7, 0.09);
    } else {
        stopLossPct = Math.min(Math.abs(q90) * 0.8, 0.09);
        takeProfit1Pct = Math.max(Math.abs(q50) * 0.8, 0.005);
        takeProfit2Pct = Math.max(Math.abs(q10) * 0.7, 0.008);
    }

    return {
        entryPrice: Number(entryPrice.toFixed(4)),
        stopLoss: Number((entryPrice * (1 + stopLossPct)).toFixed(4)),
        stopLossPct: Number(stopLossPct.toFixed(4)),
        takeProfit1: Number((entryPrice * (1 + takeProfit1Pct)).toFixed(4)),
        takeProfit1Pct: Number(takeProfit1Pct.toFixed(4)),
        takeProfit2: Number((entryPrice * (1 + takeProfit2Pct)).toFixed(4)),
        takeProfit2Pct: Number(takeProfit2Pct.toFixed(4))
    };
}

function asUniverseRow(constituent, quote) {
    const merged = quote || {
        code: constituent.code,
        secid: constituent.secid,
        market: constituent.market,
        name: constituent.name,
        price: null,
        changePct: null,
        changeAmount: null,
        high: null,
        low: null,
        open: null,
        prevClose: null,
        volume: null,
        turnover: null
    };
    const prediction = calculatePrediction(merged);
    const policy = calculatePolicy(prediction);
    const totalScore = clamp(
        prediction.pUp * 0.5 + prediction.confidence * 0.3 + clamp(((merged.changePct ?? 0) + 5) / 10, 0, 1) * 0.2,
        0,
        1
    );

    return {
        code: constituent.code,
        name: constituent.name || merged.name || '',
        market: constituent.market,
        secid: constituent.secid,
        price: merged.price,
        changePct: merged.changePct,
        changeAmount: merged.changeAmount,
        open: merged.open,
        high: merged.high,
        low: merged.low,
        prevClose: merged.prevClose,
        volume: merged.volume,
        turnover: merged.turnover,
        prediction: {
            pUp: prediction.pUp,
            pDown: prediction.pDown,
            confidence: prediction.confidence,
            signal: prediction.signal,
            q10: prediction.q10,
            q50: prediction.q50,
            q90: prediction.q90
        },
        policy: {
            action: policy.action,
            positionSize: policy.positionSize,
            shortAllowed: false,
            leverage: 1.0
        },
        totalScore: Number(totalScore.toFixed(4)),
        status: Number.isFinite(merged.price) ? 'LIVE' : 'ERROR'
    };
}

function normalizeIndex(indexCode, quote) {
    return {
        code: indexCode,
        name: INDEX_NAME_BY_CODE[indexCode],
        price: quote?.price ?? null,
        changePct: quote?.changePct ?? null,
        open: quote?.open ?? null,
        high: quote?.high ?? null,
        low: quote?.low ?? null,
        prevClose: quote?.prevClose ?? null,
        volume: quote?.volume ?? null,
        turnover: quote?.turnover ?? null
    };
}

async function fetchCnLivePayload() {
    const secids = [...Object.values(INDEX_SECIDS), ...csi300Secids];
    const quoteMap = await fetchEastMoneyQuotes(secids);
    const sseQuote = quoteMap.get(INDEX_SECIDS['000001.SH']);
    const csiQuote = quoteMap.get(INDEX_SECIDS['000300.SH']);
    if (!sseQuote || !csiQuote) {
        throw new Error('Missing critical CN index quotes from upstream');
    }

    const rows = csi300Snapshot.map((constituent) => asUniverseRow(constituent, quoteMap.get(constituent.secid)));

    return {
        meta: {
            source: 'eastmoney',
            timestamp: new Date().toISOString(),
            stale: false,
            pollIntervalSec: CN_POLL_INTERVAL_SEC
        },
        indices: {
            sse: normalizeIndex('000001.SH', sseQuote),
            csi300: normalizeIndex('000300.SH', csiQuote)
        },
        universe: {
            total: csi300Snapshot.length,
            rows
        }
    };
}

async function getCnPayloadWithCache() {
    const now = Date.now();
    if (cnCache && now - cnCacheAt <= CN_CACHE_TTL_MS) {
        return deepCopy(cnCache);
    }

    try {
        const payload = await fetchCnLivePayload();
        cnCache = payload;
        cnCacheAt = Date.now();
        return deepCopy(payload);
    } catch (error) {
        if (cnCache) {
            const stalePayload = deepCopy(cnCache);
            stalePayload.meta.stale = true;
            stalePayload.meta.staleReason = error.message;
            stalePayload.meta.timestamp = new Date().toISOString();
            return stalePayload;
        }
        throw error;
    }
}

function getSortValue(row, sortKey) {
    switch (sortKey) {
    case 'code': return row.code;
    case 'name': return row.name;
    case 'price': return row.price ?? Number.NEGATIVE_INFINITY;
    case 'changePct': return row.changePct ?? Number.NEGATIVE_INFINITY;
    case 'volume': return row.volume ?? Number.NEGATIVE_INFINITY;
    case 'pUp': return row.prediction.pUp;
    case 'totalScore': return row.totalScore;
    default: return row.prediction.pUp;
    }
}

function applyUniverseQuery(rows, search, sort, direction, page, pageSize) {
    const keyword = (search || '').trim().toLowerCase();
    const filtered = keyword
        ? rows.filter((row) => row.code.includes(keyword) || row.name.toLowerCase().includes(keyword))
        : [...rows];

    const directionFactor = direction === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
        const av = getSortValue(a, sort);
        const bv = getSortValue(b, sort);
        if (typeof av === 'string' && typeof bv === 'string') {
            return av.localeCompare(bv) * directionFactor;
        }
        if (av === bv) return 0;
        return av > bv ? directionFactor : -directionFactor;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = clamp(page, 1, totalPages);
    const start = (safePage - 1) * pageSize;
    const pagedRows = filtered.slice(start, start + pageSize);

    return {
        total,
        page: safePage,
        pageSize,
        totalPages,
        rows: pagedRows
    };
}

function parseCnListQuery(parsedUrl) {
    const page = parseInteger(parsedUrl.searchParams.get('page'), 1);
    const pageSize = clamp(parseInteger(parsedUrl.searchParams.get('pageSize'), 50), 10, 100);
    const sort = parsedUrl.searchParams.get('sort') || 'pUp';
    const direction = (parsedUrl.searchParams.get('direction') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
    const search = parsedUrl.searchParams.get('search') || '';
    return { page, pageSize, sort, direction, search };
}

function normalizeIndexCode(rawCode) {
    const candidate = String(rawCode || '').trim().toUpperCase();
    if (candidate === '000001.SH' || candidate === '000001' || candidate === 'SSE') return '000001.SH';
    if (candidate === '000300.SH' || candidate === '000300' || candidate === 'CSI300') return '000300.SH';
    return null;
}

async function handleCnPrices(req, res, parsedUrl) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const query = parseCnListQuery(parsedUrl);
    try {
        const payload = await getCnPayloadWithCache();
        const universe = applyUniverseQuery(payload.universe.rows, query.search, query.sort, query.direction, query.page, query.pageSize);
        const status = payload.meta.stale ? 'STALE' : 'LIVE';
        universe.rows = universe.rows.map((row) => ({ ...row, status }));

        sendJson(res, 200, {
            meta: payload.meta,
            indices: payload.indices,
            universe
        });
    } catch (error) {
        sendJson(res, 502, {
            error: 'Failed to fetch CN equity prices from EastMoney',
            detail: error.message
        });
    }
}

async function handleCnQuotes(req, res, parsedUrl) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const query = parseCnListQuery(parsedUrl);
    try {
        const payload = await getCnPayloadWithCache();
        const universe = applyUniverseQuery(payload.universe.rows, query.search, query.sort, query.direction, query.page, query.pageSize);
        const status = payload.meta.stale ? 'STALE' : 'LIVE';
        universe.rows = universe.rows.map((row) => ({ ...row, status }));

        sendJson(res, 200, {
            meta: payload.meta,
            universe
        });
    } catch (error) {
        sendJson(res, 502, {
            error: 'Failed to fetch CN equity quotes',
            detail: error.message
        });
    }
}

async function handleCnIndexPrediction(req, res, rawIndexCode) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const indexCode = normalizeIndexCode(rawIndexCode);
    if (!indexCode) {
        sendJson(res, 404, { error: `Unsupported index code: ${rawIndexCode}` });
        return;
    }

    try {
        const payload = await getCnPayloadWithCache();
        const indexData = indexCode === '000001.SH' ? payload.indices.sse : payload.indices.csi300;
        const quoteLike = {
            price: indexData.price,
            changePct: indexData.changePct,
            open: indexData.open,
            high: indexData.high,
            low: indexData.low,
            prevClose: indexData.prevClose
        };
        const prediction = calculatePrediction(quoteLike);
        const policy = calculatePolicy(prediction);
        const tpSl = calculateTpSl(indexData.price || 0, prediction, policy.signal);

        sendJson(res, 200, {
            meta: payload.meta,
            indexCode,
            indexName: INDEX_NAME_BY_CODE[indexCode],
            currentValue: indexData.price,
            prediction: {
                direction: {
                    pUp: prediction.pUp,
                    pDown: prediction.pDown,
                    confidence: prediction.confidence,
                    signal: prediction.signal,
                    horizon: '1d'
                },
                window: prediction.window,
                magnitude: {
                    q10: prediction.q10,
                    q50: prediction.q50,
                    q90: prediction.q90
                }
            },
            policy: {
                action: policy.action,
                signal: policy.signal,
                positionSize: policy.positionSize,
                shortAllowed: false,
                leverage: 1.0
            },
            tpSl
        });
    } catch (error) {
        sendJson(res, 502, {
            error: 'Failed to generate index prediction',
            detail: error.message
        });
    }
}

async function handleCnStock(req, res, rawStockCode) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const stockCode = String(rawStockCode || '').trim().replace(/[^0-9]/g, '').padStart(6, '0');
    if (!/^\d{6}$/.test(stockCode)) {
        sendJson(res, 400, { error: 'Invalid stock code' });
        return;
    }
    const constituent = csi300ByCode.get(stockCode);
    if (!constituent) {
        sendJson(res, 404, { error: `Stock ${stockCode} is not in CSI 300 snapshot` });
        return;
    }

    try {
        const payload = await getCnPayloadWithCache();
        const row = payload.universe.rows.find((item) => item.code === stockCode);
        if (!row) {
            sendJson(res, 404, { error: `Stock ${stockCode} quote unavailable` });
            return;
        }

        const policySignal = row.policy.action.includes('Buy') ? 'LONG' : 'FLAT';
        const tpSl = calculateTpSl(row.price || 0, row.prediction, policySignal);

        sendJson(res, 200, {
            meta: payload.meta,
            code: row.code,
            name: row.name,
            market: row.market,
            secid: row.secid,
            currentPrice: row.price,
            changePct: row.changePct,
            volume: row.volume,
            turnover: row.turnover,
            prediction: row.prediction,
            policy: row.policy,
            tpSl
        });
    } catch (error) {
        sendJson(res, 502, {
            error: 'Failed to generate stock prediction',
            detail: error.message
        });
    }
}

async function handleCnPredictionsAlias(req, res, parsedUrl) {
    const code = parsedUrl.searchParams.get('code');
    if (!code) {
        sendJson(res, 400, { error: 'Missing required query param: code' });
        return;
    }
    await handleCnStock(req, res, code);
}

async function handleCnRanking(req, res, parsedUrl) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }
    if (req.method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
    }

    const top = clamp(parseInteger(parsedUrl.searchParams.get('top'), 20), 1, 100);
    try {
        const payload = await getCnPayloadWithCache();
        const status = payload.meta.stale ? 'STALE' : 'LIVE';
        const rankings = [...payload.universe.rows]
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, top)
            .map((row, index) => ({
                rank: index + 1,
                code: row.code,
                name: row.name,
                market: row.market,
                price: row.price,
                changePct: row.changePct,
                pUp: row.prediction.pUp,
                confidence: row.prediction.confidence,
                momentum: row.changePct === null ? null : Number((row.changePct / 100).toFixed(4)),
                totalScore: row.totalScore,
                signal: row.prediction.signal,
                status
            }));

        sendJson(res, 200, {
            meta: payload.meta,
            date: payload.meta.timestamp.slice(0, 10),
            rankings
        });
    } catch (error) {
        sendJson(res, 502, {
            error: 'Failed to compute CSI300 ranking',
            detail: error.message
        });
    }
}

function handleAlertContract(req, res) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }

    const contract = {
        route: '/api/alerts',
        status: 'not_implemented',
        storage: 'planned_server_storage',
        current_mode: 'client_local_storage',
        schema: {
            id: 'string',
            symbol: 'BTCUSDT|ETHUSDT|SOLUSDT|...',
            type: 'move_gt_pct_24h',
            thresholdPct: 'number',
            enabled: 'boolean',
            lastTriggeredAt: 'ISO8601|null',
            createdAt: 'ISO8601'
        }
    };

    if (req.method === 'GET') {
        sendJson(res, 501, {
            ...contract,
            message: 'Use localStorage key "crypto_alerts_v1" for this phase.'
        });
        return;
    }

    if (req.method === 'POST') {
        sendJson(res, 501, {
            ...contract,
            expected_request: {
                symbol: 'BTCUSDT',
                type: 'move_gt_pct_24h',
                thresholdPct: 5,
                enabled: true
            }
        });
        return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
}

function proxyApi(req, res) {
    if (req.method === 'OPTIONS') {
        sendJson(res, 200, { ok: true });
        return;
    }

    const proxyReq = http.request(
        {
            hostname: API_HOST,
            port: API_PORT,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                host: `${API_HOST}:${API_PORT}`
            }
        },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 502, {
                ...proxyRes.headers,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
            });
            proxyRes.pipe(res);
        }
    );

    proxyReq.on('error', (error) => {
        sendJson(res, 502, {
            error: 'API proxy failed',
            detail: error.message
        });
    });

    req.pipe(proxyReq);
}

function safeJoin(basePath, targetPath) {
    const resolvedPath = path.normalize(path.join(basePath, targetPath));
    if (!resolvedPath.startsWith(basePath)) {
        return null;
    }
    return resolvedPath;
}

function serveStatic(req, res) {
    const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    const filePath = safeJoin(WEB_ROOT, decodeURIComponent(requestPath));

    if (!filePath) {
        sendJson(res, 400, { error: 'Invalid path' });
        return;
    }

    const targetPath = fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()
        ? path.join(filePath, 'index.html')
        : filePath;

    fs.readFile(targetPath, (error, data) => {
        if (error) {
            if (error.code === 'ENOENT') {
                sendJson(res, 404, { error: 'Not found' });
            } else {
                sendJson(res, 500, { error: 'File read failed', detail: error.message });
            }
            return;
        }

        const extension = path.extname(targetPath).toLowerCase();
        const contentType = MIME_TYPES[extension] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    if (!req.url) {
        sendJson(res, 400, { error: 'Empty URL' });
        return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

    if (parsedUrl.pathname === '/api/crypto/prices') {
        handleCryptoPrices(req, res);
        return;
    }

    if (parsedUrl.pathname === '/api/cn-equity/prices') {
        handleCnPrices(req, res, parsedUrl);
        return;
    }
    if (parsedUrl.pathname === '/api/cn-equity/csi300/quotes') {
        handleCnQuotes(req, res, parsedUrl);
        return;
    }
    if (parsedUrl.pathname === '/api/cn-equity/csi300/ranking') {
        handleCnRanking(req, res, parsedUrl);
        return;
    }
    if (parsedUrl.pathname.startsWith('/api/cn-equity/prediction/')) {
        const indexCode = decodeURIComponent(parsedUrl.pathname.replace('/api/cn-equity/prediction/', ''));
        handleCnIndexPrediction(req, res, indexCode);
        return;
    }
    if (parsedUrl.pathname.startsWith('/api/cn-equity/stock/')) {
        const stockCode = decodeURIComponent(parsedUrl.pathname.replace('/api/cn-equity/stock/', ''));
        handleCnStock(req, res, stockCode);
        return;
    }
    if (parsedUrl.pathname === '/api/cn-equity/predictions') {
        handleCnPredictionsAlias(req, res, parsedUrl);
        return;
    }

    if (parsedUrl.pathname === '/api/alerts') {
        handleAlertContract(req, res);
        return;
    }

    if (parsedUrl.pathname.startsWith('/api/')) {
        proxyApi(req, res);
        return;
    }

    serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
    console.log(`Unified server listening at http://${HOST}:${PORT}`);
    console.log(`API proxy target: http://${API_HOST}:${API_PORT}`);
    console.log(`Web root: ${WEB_ROOT}`);
    console.log(`Loaded CSI300 snapshot rows: ${csi300Snapshot.length}`);
});
