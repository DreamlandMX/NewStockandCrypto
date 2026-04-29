const test = require('node:test');
const assert = require('node:assert/strict');
const { createCryptoRoutes } = require('../server/crypto-routes');

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
        handleCryptoPrices: handler('handleCryptoPrices'),
        handleCryptoUniverse: handler('handleCryptoUniverse'),
        handleCryptoHistory: handler('handleCryptoHistory'),
        handleCryptoPrediction: handler('handleCryptoPrediction'),
        handleCryptoPerformance: handler('handleCryptoPerformance'),
        handleCryptoSessionForecast: handler('handleCryptoSessionForecast')
    };

    return {
        calls,
        req,
        res,
        routeCryptoRequest: createCryptoRoutes(context)
    };
}

test('crypto routes dispatch history with the decoded symbol', () => {
    const { calls, req, res, routeCryptoRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/crypto/history/BTC%2FUSDT');

    const matched = routeCryptoRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleCryptoHistory');
    assert.equal(calls[0].args[3], 'BTC/USDT');
    assert.equal(calls[1].errorCode, 'CRYPTO_HISTORY_FAILED');
});

test('crypto routes return false for non-crypto paths', () => {
    const { calls, req, res, routeCryptoRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/cn-equity/prices');

    const matched = routeCryptoRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
