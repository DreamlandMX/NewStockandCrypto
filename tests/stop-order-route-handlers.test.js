const test = require('node:test');
const assert = require('node:assert/strict');
const { createStopOrderRouteHandlers } = require('../server/stop-order-route-handlers');

function fakeResponse() {
    return {
        status: null,
        payload: null
    };
}

function sendJson(res, status, payload) {
    res.status = status;
    res.payload = payload;
}

test('stop order route handlers create a stop order for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const routes = createStopOrderRouteHandlers({
        positionsStore: {
            createStopOrder(userId, payload) {
                assert.equal(userId, user.id);
                assert.equal(payload.position_id, 7);
                return { id: 1, ...payload };
            }
        },
        readJsonBody: async () => ({ position_id: 7, trigger_price: 90 }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleSiteStopOrdersCollectionRoute({ method: 'POST' }, res, new URL('http://local/api/site-stop-orders'));

    assert.equal(res.status, 201);
    assert.equal(res.payload.order.id, 1);
});

test('stop order route handlers return 404 when cancel cannot find the order', async () => {
    const routes = createStopOrderRouteHandlers({
        positionsStore: {
            cancelStopOrder() {
                return false;
            }
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => ({ id: 'user-1' }),
        sendJson
    });
    const res = fakeResponse();

    await routes.handleSiteStopOrderCancelRoute({ method: 'POST' }, res, 123);

    assert.equal(res.status, 404);
    assert.equal(res.payload.message, 'Stop order not found.');
});
