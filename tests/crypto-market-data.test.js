const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildBinanceKlinesUrl,
    buildCoinGeckoMarketChartUrl,
    cryptoBaseSymbol,
    normalizeCoinGeckoMarketChartRows,
    normalizeCryptoSymbol,
    normalizeKlineRows,
    normalizeTickerRows,
    resolveCryptoHistoryRange
} = require('../server/crypto-market-data');

test('crypto market data normalizes Binance ticker rows', () => {
    const payload = normalizeTickerRows([
        { symbol: 'BTCUSDT', lastPrice: '100', priceChangePercent: '1.5', quoteVolume: '2000' },
        { symbol: 'ETHUSDT', lastPrice: '50', priceChangePercent: '-2', quoteVolume: '1000' },
        { symbol: 'SOLUSDT', lastPrice: '10', priceChangePercent: '0.5', quoteVolume: '500' }
    ]);

    assert.equal(payload.meta.source, 'binance_us');
    assert.deepEqual(payload.btc, { symbol: 'BTCUSDT', price: 100, change: 1.5, volume: 2000 });
});

test('crypto market data normalizes symbols and base symbols', () => {
    assert.equal(normalizeCryptoSymbol('btc/usdt'), 'BTCUSDT');
    assert.equal(normalizeCryptoSymbol('eth'), 'ETHUSDT');
    assert.equal(cryptoBaseSymbol('SOLUSDT'), 'SOL');
    assert.equal(normalizeCryptoSymbol(''), null);
});

test('crypto market data builds simple upstream URLs', () => {
    assert.equal(
        buildBinanceKlinesUrl('BTCUSDT', '5m', 12),
        'https://api.binance.us/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=12'
    );
    assert.equal(
        buildCoinGeckoMarketChartUrl('bitcoin', 1),
        'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=1'
    );
});

test('crypto market data resolves supported history ranges', () => {
    const rangeConfig = { '24h': {}, '7d': {} };

    assert.equal(resolveCryptoHistoryRange('7D', rangeConfig), '7d');
    assert.equal(resolveCryptoHistoryRange('bad', rangeConfig), null);
});

test('crypto market data normalizes kline rows', () => {
    const rows = normalizeKlineRows([
        [Date.parse('2026-04-28T00:05:00.000Z'), '2', '3', '1', '2.5', '10', Date.parse('2026-04-28T00:09:59.000Z')],
        [Date.parse('2026-04-28T00:00:00.000Z'), '1', '2', '0.5', '1.5', '20', Date.parse('2026-04-28T00:04:59.000Z')]
    ]);

    assert.equal(rows[0].ts, '2026-04-28T00:00:00.000Z');
    assert.equal(rows[1].close, 2.5);
});

test('crypto market data normalizes CoinGecko chart rows', () => {
    const rows = normalizeCoinGeckoMarketChartRows({
        prices: [
            [Date.parse('2026-04-28T00:00:00.000Z'), 100],
            [Date.parse('2026-04-28T00:05:00.000Z'), 101]
        ],
        total_volumes: [
            [Date.parse('2026-04-28T00:00:00.000Z'), 2000],
            [Date.parse('2026-04-28T00:05:00.000Z'), 3000]
        ]
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[1].volume, 3000);
});
