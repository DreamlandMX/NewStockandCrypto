const test = require('node:test');
const assert = require('node:assert/strict');
const { getNumberAfter, getTextAfter, runRoute } = require('../server/route-helpers');

test('getNumberAfter reads a numeric id from a route path', () => {
    const id = getNumberAfter('/api/notes/77/versions', '/api/notes/');

    assert.equal(id, 77);
});

test('getTextAfter reads and decodes the text after a route prefix', () => {
    const symbol = getTextAfter('/api/us-equity/prediction/%5EGSPC', '/api/us-equity/prediction/');

    assert.equal(symbol, '^GSPC');
});

test('runRoute sends a promise to the shared async route handler', () => {
    const calls = [];
    const res = {};
    const context = {
        handleAsyncRoute(response, promise, errorCode) {
            calls.push({ response, promise, errorCode });
        }
    };

    const matched = runRoute(context, res, 'route-promise', 'ROUTE_FAILED');

    assert.equal(matched, true);
    assert.deepEqual(calls[0], {
        response: res,
        promise: 'route-promise',
        errorCode: 'ROUTE_FAILED'
    });
});
