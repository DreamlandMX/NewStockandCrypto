const test = require('node:test');
const assert = require('node:assert/strict');
const { createUsEquityRoutes } = require('../server/us-equity-routes');

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
        handleUsPrices: handler('handleUsPrices'),
        handleUsIndicesHistory: handler('handleUsIndicesHistory'),
        handleUsIndices: handler('handleUsIndices'),
        handleUsSp500Quotes: handler('handleUsSp500Quotes'),
        handleUsTopMovers: handler('handleUsTopMovers'),
        handleUsIndexPrediction: handler('handleUsIndexPrediction'),
        handleUsStock: handler('handleUsStock'),
        handleUsPredictionsAlias: handler('handleUsPredictionsAlias')
    };

    return {
        calls,
        req,
        res,
        routeUsEquityRequest: createUsEquityRoutes(context)
    };
}

test('US equity routes dispatch prediction with the decoded symbol', () => {
    const { calls, req, res, routeUsEquityRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/us-equity/prediction/%5EGSPC');

    const matched = routeUsEquityRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleUsIndexPrediction');
    assert.equal(calls[0].args[2], '^GSPC');
    assert.equal(calls[1].errorCode, 'US_PREDICTION_FAILED');
});

test('US equity routes return false for non-US paths', () => {
    const { calls, req, res, routeUsEquityRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/tracking/summary');

    const matched = routeUsEquityRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
