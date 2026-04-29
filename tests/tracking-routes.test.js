const test = require('node:test');
const assert = require('node:assert/strict');
const { createTrackingRoutes } = require('../server/tracking-routes');

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
        handleTrackingSummary: handler('handleTrackingSummary'),
        handleTrackingUniverse: handler('handleTrackingUniverse'),
        handleTrackingFactors: handler('handleTrackingFactors'),
        handleTrackingCoverage: handler('handleTrackingCoverage'),
        handleTrackingActions: handler('handleTrackingActions'),
        handleTrackingSimulate: handler('handleTrackingSimulate')
    };

    return {
        calls,
        req,
        res,
        routeTrackingRequest: createTrackingRoutes(context)
    };
}

test('tracking routes dispatch factors with the parsed url', () => {
    const { calls, req, res, routeTrackingRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/tracking/factors?symbol=BTC');

    const matched = routeTrackingRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleTrackingFactors');
    assert.equal(calls[0].args[2], parsedUrl);
    assert.equal(calls[1].errorCode, 'TRACKING_FACTORS_FAILED');
});

test('tracking routes return false for non-tracking paths', () => {
    const { calls, req, res, routeTrackingRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/home/landing');

    const matched = routeTrackingRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
