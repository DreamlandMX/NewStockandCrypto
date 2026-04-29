const test = require('node:test');
const assert = require('node:assert/strict');
const { createCnEquityRoutes } = require('../server/cn-equity-routes');

function createHarness() {
    const calls = [];
    const req = {};
    const res = {};
    const handler = (name) => (...args) => {
        calls.push({ name, args });
        return `${name}-promise`;
    };
    const context = {
        handleAsyncRoute(response, promise, errorCode) {
            calls.push({ response, promise, errorCode });
        },
        handleCnLive: handler('handleCnLive'),
        handleCnPrices: handler('handleCnPrices'),
        handleCnIndicesHistory: handler('handleCnIndicesHistory'),
        handleCnQuotes: handler('handleCnQuotes'),
        handleCnRanking: handler('handleCnRanking'),
        handleCnIndexPrediction: handler('handleCnIndexPrediction'),
        handleCnStock: handler('handleCnStock'),
        handleCnPredictionsAlias: handler('handleCnPredictionsAlias')
    };

    return {
        calls,
        req,
        res,
        routeCnEquityRequest: createCnEquityRoutes(context)
    };
}

test('CN equity routes dispatch stock detail with the decoded code', () => {
    const { calls, req, res, routeCnEquityRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/cn-equity/stock/600519.SH');

    const matched = routeCnEquityRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleCnStock');
    assert.equal(calls[0].args[2], '600519.SH');
    assert.equal(calls[1].errorCode, 'CN_STOCK_FAILED');
});

test('CN equity routes return false for non-CN paths', () => {
    const { calls, req, res, routeCnEquityRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/us-equity/prices');

    const matched = routeCnEquityRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
