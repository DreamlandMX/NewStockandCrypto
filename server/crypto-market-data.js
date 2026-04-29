const { parseNumber } = require('./value-helpers');

const BINANCE_US_KLINES_BASE = 'https://api.binance.us/api/v3/klines';
const COINGECKO_MARKET_CHART_BASE = 'https://api.coingecko.com/api/v3/coins';

function normalizeTickerRows(rows) {
    if (!Array.isArray(rows)) {
        throw new Error('Unexpected Binance US payload');
    }

    const bySymbol = Object.fromEntries(rows.map((row) => [row.symbol, row]));

    return {
        meta: {
            source: 'binance_us',
            timestamp: new Date().toISOString(),
            stale: false
        },
        btc: readTickerRow(bySymbol, 'BTCUSDT'),
        eth: readTickerRow(bySymbol, 'ETHUSDT'),
        sol: readTickerRow(bySymbol, 'SOLUSDT')
    };
}

function readTickerRow(bySymbol, symbol) {
    const row = bySymbol[symbol];
    if (!row) throw new Error(`Missing symbol ${symbol}`);

    const price = parseNumber(row.lastPrice);
    const change = parseNumber(row.priceChangePercent);
    const volume = parseNumber(row.quoteVolume);
    if (price === null || change === null || volume === null) {
        throw new Error(`Invalid numeric field for ${symbol}`);
    }

    return { symbol, price, change, volume };
}

function resolveCryptoHistoryRange(rawRange, rangeConfig) {
    const normalized = String(rawRange || '24h').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(rangeConfig, normalized) ? normalized : null;
}

function buildBinanceKlinesUrl(symbol, interval, limit) {
    const query = new URLSearchParams({
        symbol,
        interval,
        limit: String(limit)
    });
    return `${BINANCE_US_KLINES_BASE}?${query.toString()}`;
}

function normalizeCryptoSymbol(rawSymbol) {
    const normalized = String(rawSymbol || '').trim().toUpperCase().replace(/\//g, '');
    if (!normalized) return null;
    if (normalized.endsWith('USDT')) return normalized;
    return `${normalized}USDT`;
}

function cryptoBaseSymbol(symbol) {
    const normalized = normalizeCryptoSymbol(symbol);
    if (!normalized) return null;
    return normalized.endsWith('USDT') ? normalized.slice(0, -4) : normalized;
}

function buildCoinGeckoMarketChartUrl(coinId, days) {
    const query = new URLSearchParams({
        vs_currency: 'usd',
        days: String(days)
    });
    return `${COINGECKO_MARKET_CHART_BASE}/${encodeURIComponent(coinId)}/market_chart?${query.toString()}`;
}

function normalizeKlineRows(rows) {
    if (!Array.isArray(rows)) {
        throw new Error('Unexpected Binance US kline payload');
    }

    const series = rows
        .map(normalizeKlineRow)
        .filter((row) => row !== null)
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    if (!series.length) {
        throw new Error('No valid kline points from Binance US');
    }

    return series;
}

function normalizeKlineRow(row) {
    if (!Array.isArray(row) || row.length < 7) return null;

    const openTime = Number(row[0]);
    const open = parseNumber(row[1]);
    const high = parseNumber(row[2]);
    const low = parseNumber(row[3]);
    const close = parseNumber(row[4]);
    const volume = parseNumber(row[5]);

    if (!Number.isFinite(openTime) || open === null || high === null || low === null || close === null || volume === null) {
        return null;
    }

    return {
        ts: new Date(openTime).toISOString(),
        open,
        high,
        low,
        close,
        volume
    };
}

function normalizeCoinGeckoMarketChartRows(payload, windowMs = null, limit = 240) {
    const prices = Array.isArray(payload?.prices) ? payload.prices : [];
    const volumes = Array.isArray(payload?.total_volumes) ? payload.total_volumes : [];
    const floorTs = Number.isFinite(windowMs) && windowMs > 0 ? Date.now() - windowMs : 0;

    const series = prices
        .map((point, index) => normalizeCoinGeckoPoint(point, volumes[index], floorTs))
        .filter((row) => row !== null)
        .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    if (!series.length) {
        throw new Error('No valid CoinGecko market chart points');
    }

    return series.length <= limit ? series : series.slice(series.length - limit);
}

function normalizeCoinGeckoPoint(pricePoint, volumePoint, floorTs) {
    const openTime = parseNumber(pricePoint?.[0]);
    const price = parseNumber(pricePoint?.[1]);
    const volume = Array.isArray(volumePoint) ? parseNumber(volumePoint[1]) ?? 0 : 0;

    if (!Number.isFinite(openTime) || !Number.isFinite(price)) return null;
    if (floorTs && openTime < floorTs) return null;

    return {
        ts: new Date(openTime).toISOString(),
        open: price,
        high: price,
        low: price,
        close: price,
        volume
    };
}

module.exports = {
    buildBinanceKlinesUrl,
    buildCoinGeckoMarketChartUrl,
    cryptoBaseSymbol,
    normalizeCoinGeckoMarketChartRows,
    normalizeCryptoSymbol,
    normalizeKlineRows,
    normalizeTickerRows,
    resolveCryptoHistoryRange
};
