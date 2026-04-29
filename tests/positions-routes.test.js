const test = require('node:test');
const assert = require('node:assert/strict');
const { createPositionsRoutes } = require('../server/positions-routes');

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

test('positions route lists positions for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const parsedUrl = new URL('http://local/api/site-positions?status=open&limit=10');
    const routes = createPositionsRoutes({
        positionsStore: {
            listPositions(userId, filters) {
                assert.equal(userId, user.id);
                assert.deepEqual(filters, { status: 'open', limit: '10' });
                return [{ id: 1, symbol: 'BTC' }];
            }
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleSitePositionsCollectionRoute({ method: 'GET' }, res, parsedUrl);

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.positions, [{ id: 1, symbol: 'BTC' }]);
});

test('positions route creates positions with normalized field names', async () => {
    const user = { id: 'user-1' };
    const routes = createPositionsRoutes({
        positionsStore: {
            createPosition(userId, payload) {
                assert.equal(userId, user.id);
                assert.deepEqual(payload, {
                    symbol: 'AAPL',
                    market: 'us',
                    side: 'long',
                    entry_price: 190,
                    quantity: 2,
                    notes: 'starter'
                });
                return { id: 7, ...payload };
            }
        },
        readJsonBody: async () => ({
            symbol: 'AAPL',
            market: 'us',
            side: 'long',
            entry_price: 190,
            quantity: 2,
            notes: 'starter'
        }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleSitePositionsCollectionRoute({ method: 'POST' }, res, new URL('http://local/api/site-positions'));

    assert.equal(res.status, 201);
    assert.equal(res.payload.position.id, 7);
});

test('close position route returns not found when the position is missing', async () => {
    const routes = createPositionsRoutes({
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
    assert.equal(res.payload.error, 'NOT_FOUND');
    assert.equal(res.payload.message, 'Position not found.');
});
