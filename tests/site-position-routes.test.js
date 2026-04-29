const test = require('node:test');
const assert = require('node:assert/strict');
const { createSitePositionRoutes } = require('../server/site-position-routes');

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
        handleSitePositionsCollectionRoute: handler('handleSitePositionsCollectionRoute'),
        handleSitePositionCloseRoute: handler('handleSitePositionCloseRoute'),
        handleSitePositionHistoryRoute: handler('handleSitePositionHistoryRoute'),
        handleSiteStopOrdersCollectionRoute: handler('handleSiteStopOrdersCollectionRoute'),
        handleSiteStopOrderCancelRoute: handler('handleSiteStopOrderCancelRoute')
    };

    return {
        calls,
        req,
        res,
        routePositionRequest: createSitePositionRoutes(context)
    };
}

test('site position routes dispatch close with a numeric position id', () => {
    const { calls, req, res, routePositionRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/site-positions/99/close');

    const matched = routePositionRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleSitePositionCloseRoute');
    assert.equal(calls[0].args[2], 99);
    assert.equal(calls[1].errorCode, 'SITE_POSITION_CLOSE_FAILED');
});

test('site position routes return false for other paths', () => {
    const { calls, req, res, routePositionRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/auth/login');

    const matched = routePositionRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
