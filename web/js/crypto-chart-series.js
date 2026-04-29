(function initCryptoChartSeries(root) {
    'use strict';

    function createCryptoChartSeries(options = {}) {
        const rangeWindowMs = options.rangeWindowMs || {};
        const reseedIntervalMs = options.reseedIntervalMs || {};
        const now = options.now || (() => Date.now());

        function getChartHistoryConfig(timeframe) {
            if (timeframe === '1h') {
                return buildConfig('1h');
            }
            if (timeframe === '24h') {
                return buildConfig('24h');
            }
            return buildConfig('7d');
        }

        function buildConfig(range) {
            return {
                range,
                reseedMs: reseedIntervalMs[range],
                windowMs: rangeWindowMs[range]
            };
        }

        function createEmptyChartBucket() {
            return {
                labels: [],
                values: [],
                timestamps: [],
                stale: false,
                source: null,
                lastSeedAt: 0,
                lastAppendAt: 0
            };
        }

        function ensureSymbolChartSeries(store, symbol) {
            if (!symbol) return null;
            if (!store[symbol]) {
                store[symbol] = {
                    '1h': createEmptyChartBucket(),
                    '24h': createEmptyChartBucket(),
                    '7d': createEmptyChartBucket()
                };
            }
            return store[symbol];
        }

        function formatChartLabelFromTs(timestamp, timeframe) {
            const date = new Date(timestamp);
            if (!Number.isFinite(date.getTime())) return '--';

            if (timeframe === '1h') {
                return date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
            }
            if (timeframe === '24h') {
                return date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            }
            return date.toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }

        function pruneChartBucket(bucket, timeframe) {
            if (!bucket || !Array.isArray(bucket.timestamps)) return;

            const config = getChartHistoryConfig(timeframe);
            const threshold = now() - config.windowMs;
            while (bucket.timestamps.length > 1 && bucket.timestamps[0] < threshold) {
                bucket.timestamps.shift();
                bucket.labels.shift();
                bucket.values.shift();
            }
        }

        return {
            createEmptyChartBucket,
            ensureSymbolChartSeries,
            formatChartLabelFromTs,
            getChartHistoryConfig,
            pruneChartBucket
        };
    }

    const api = {
        createCryptoChartSeries
    };

    root.StockCryptoChartSeries = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
