const test = require('node:test');
const assert = require('node:assert/strict');
const { createHomeRoutes } = require('../server/home-routes');

function createHarness() {
    const calls = [];
    const req = {};
    const res = {};
    const context = {
        handleAsyncRoute(response, promise, errorCode) {
            calls.push({ response, promise, errorCode });
        },
        handleHomeLanding() {
            calls.push({ name: 'handleHomeLanding' });
            return 'handleHomeLanding-promise';
        }
    };

    return {
        calls,
        req,
        res,
        routeHomeRequest: createHomeRoutes(context)
    };
}

test('home routes dispatch the landing endpoint', () => {
    const { calls, req, res, routeHomeRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/home/landing');

    const matched = routeHomeRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleHomeLanding');
    assert.equal(calls[1].errorCode, 'HOME_LANDING_FAILED');
});

test('home routes return false for other paths', () => {
    const { calls, req, res, routeHomeRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/crypto/prices');

    const matched = routeHomeRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
