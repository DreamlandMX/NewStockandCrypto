const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketRoutes } = require('../server/market-routes');

function createRouteHarness(overrides = {}) {
    const calls = [];
    const req = { method: 'GET' };
    const res = {};
    const handleAsyncRoute = (response, promise, errorCode) => {
        calls.push({ response, promise, errorCode });
    };
    const handler = (name) => (...args) => {
        calls.push({ name, args });
        return `${name}-promise`;
    };

    const routeMarketRequest = createMarketRoutes({
        handleAsyncRoute,
        handleCryptoPrices: handler('handleCryptoPrices'),
        handleCryptoUniverse: handler('handleCryptoUniverse'),
        handleCryptoHistory: handler('handleCryptoHistory'),
        handleCryptoPrediction: handler('handleCryptoPrediction'),
        handleCryptoPerformance: handler('handleCryptoPerformance'),
        handleCryptoSessionForecast: handler('handleCryptoSessionForecast'),
        handleCnLive: handler('handleCnLive'),
        handleCnPrices: handler('handleCnPrices'),
        handleCnIndicesHistory: handler('handleCnIndicesHistory'),
        handleCnQuotes: handler('handleCnQuotes'),
        handleCnRanking: handler('handleCnRanking'),
        handleCnIndexPrediction: handler('handleCnIndexPrediction'),
        handleCnStock: handler('handleCnStock'),
        handleCnPredictionsAlias: handler('handleCnPredictionsAlias'),
        handleUsPrices: handler('handleUsPrices'),
        handleUsIndicesHistory: handler('handleUsIndicesHistory'),
        handleUsIndices: handler('handleUsIndices'),
        handleUsSp500Quotes: handler('handleUsSp500Quotes'),
        handleUsTopMovers: handler('handleUsTopMovers'),
        handleUsIndexPrediction: handler('handleUsIndexPrediction'),
        handleUsStock: handler('handleUsStock'),
        handleUsPredictionsAlias: handler('handleUsPredictionsAlias'),
        handleTrackingSummary: handler('handleTrackingSummary'),
        handleTrackingUniverse: handler('handleTrackingUniverse'),
        handleTrackingFactors: handler('handleTrackingFactors'),
        handleTrackingCoverage: handler('handleTrackingCoverage'),
        handleTrackingActions: handler('handleTrackingActions'),
        handleTrackingSimulate: handler('handleTrackingSimulate'),
        handleHomeLanding: handler('handleHomeLanding'),
        ...overrides
    });

    return { calls, req, res, routeMarketRequest };
}

test('market routes dispatch crypto history with the symbol from the path', () => {
    const { calls, req, res, routeMarketRequest } = createRouteHarness();
    const parsedUrl = new URL('http://local/api/crypto/history/BTCUSDT');

    const matched = routeMarketRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleCryptoHistory');
    assert.equal(calls[0].args[3], 'BTCUSDT');
    assert.equal(calls[1].errorCode, 'CRYPTO_HISTORY_FAILED');
});

test('market routes dispatch CN stock detail with a decoded stock code', () => {
    const { calls, req, res, routeMarketRequest } = createRouteHarness();
    const parsedUrl = new URL('http://local/api/cn-equity/stock/600519.SH');

    const matched = routeMarketRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleCnStock');
    assert.equal(calls[0].args[2], '600519.SH');
    assert.equal(calls[1].errorCode, 'CN_STOCK_FAILED');
});

test('market routes dispatch US prediction with a decoded index symbol', () => {
    const { calls, req, res, routeMarketRequest } = createRouteHarness();
    const parsedUrl = new URL('http://local/api/us-equity/prediction/%5EGSPC');

    const matched = routeMarketRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleUsIndexPrediction');
    assert.equal(calls[0].args[2], '^GSPC');
    assert.equal(calls[1].errorCode, 'US_PREDICTION_FAILED');
});

test('market routes return false for non-market paths', () => {
    const { calls, req, res, routeMarketRequest } = createRouteHarness();
    const parsedUrl = new URL('http://local/api/profile');

    const matched = routeMarketRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
