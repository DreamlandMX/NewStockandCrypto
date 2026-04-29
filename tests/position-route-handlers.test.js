const test = require('node:test');
const assert = require('node:assert/strict');
const { createPositionRouteHandlers } = require('../server/position-route-handlers');

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

test('position route handlers list positions for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const parsedUrl = new URL('http://local/api/site-positions?status=open&limit=10');
    const routes = createPositionRouteHandlers({
        positionsStore: {
            listPositions(userId, filters) {
                assert.equal(userId, user.id);
                assert.deepEqual(filters, { status: 'open', limit: '10' });
                return [{ id: 1 }];
            }
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleSitePositionsCollectionRoute({ method: 'GET' }, res, parsedUrl);

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.positions, [{ id: 1 }]);
});

test('position route handlers return 404 when close cannot find the position', async () => {
    const routes = createPositionRouteHandlers({
        positionsStore: {
            closePosition() {
                return null;
            }
        },
        readJsonBody: async () => ({ price: 200 }),
        requireAuthenticatedSiteUser: () => ({ id: 'user-1' }),
        sendJson
    });
    const res = fakeResponse();

    await routes.handleSitePositionCloseRoute({ method: 'POST' }, res, 123);

    assert.equal(res.status, 404);
    assert.equal(res.payload.message, 'Position not found.');
});
