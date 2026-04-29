const test = require('node:test');
const assert = require('node:assert/strict');
const { createCryptoChartSeries } = require('../web/js/crypto-chart-series');

const oneHour = 60 * 60 * 1000;
const oneDay = 24 * oneHour;
const sevenDays = 7 * oneDay;

const chartSeries = createCryptoChartSeries({
    rangeWindowMs: {
        '1h': oneHour,
        '24h': oneDay,
        '7d': sevenDays
    },
    reseedIntervalMs: {
        '1h': 60000,
        '24h': 300000,
        '7d': 300000
    },
    now: () => 10 * oneHour
});

test('crypto chart series returns a simple config for each timeframe', () => {
    assert.deepEqual(chartSeries.getChartHistoryConfig('1h'), {
        range: '1h',
        reseedMs: 60000,
        windowMs: oneHour
    });
    assert.equal(chartSeries.getChartHistoryConfig('unknown').range, '7d');
});

test('crypto chart series creates empty buckets and per-symbol groups', () => {
    const store = {};
    const group = chartSeries.ensureSymbolChartSeries(store, 'BTCUSDT');

    assert.deepEqual(Object.keys(group), ['1h', '24h', '7d']);
    assert.deepEqual(group['1h'].values, []);
    assert.equal(chartSeries.ensureSymbolChartSeries(store, ''), null);
});

test('crypto chart series formats labels by timeframe', () => {
    const label = chartSeries.formatChartLabelFromTs(Date.UTC(2026, 0, 2, 3, 4, 5), '1h');

    assert.match(label, /03:04:05|21:04:05|22:04:05/);
    assert.equal(chartSeries.formatChartLabelFromTs('bad-date', '1h'), '--');
});

test('crypto chart series prunes points outside the selected window', () => {
    const bucket = chartSeries.createEmptyChartBucket();
    bucket.timestamps = [
        8 * oneHour,
        9.5 * oneHour,
        10 * oneHour
    ];
    bucket.labels = ['old', 'fresh', 'now'];
    bucket.values = [1, 2, 3];

    chartSeries.pruneChartBucket(bucket, '1h');

    assert.deepEqual(bucket.timestamps, [9.5 * oneHour, 10 * oneHour]);
    assert.deepEqual(bucket.labels, ['fresh', 'now']);
    assert.deepEqual(bucket.values, [2, 3]);
});
