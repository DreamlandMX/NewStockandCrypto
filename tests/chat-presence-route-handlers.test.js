const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatPresenceRouteHandlers } = require('../server/chat-presence-route-handlers');

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

test('chat presence route handlers list online users for a board', async () => {
    const routes = createChatPresenceRouteHandlers({
        chatStore: {
            listOnlineUsers(boardId) {
                assert.equal(boardId, '7');
                return [{ id: 'user-1' }];
            }
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => null,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatPresenceRoute({ method: 'GET' }, res, new URL('http://local/api/chat/presence?boardId=7'));

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.users, [{ id: 'user-1' }]);
});

test('chat presence route handlers update presence for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const calls = [];
    const routes = createChatPresenceRouteHandlers({
        chatStore: {
            updatePresence(...args) {
                calls.push(args);
            }
        },
        readJsonBody: async () => ({ status: 'away', boardId: 7 }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatPresenceRoute({ method: 'POST' }, res, new URL('http://local/api/chat/presence'));

    assert.equal(res.status, 200);
    assert.deepEqual(calls[0], ['user-1', 'away', 7]);
});
