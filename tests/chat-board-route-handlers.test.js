const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatBoardRouteHandlers } = require('../server/chat-board-route-handlers');

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

test('chat board route handlers list public boards without login', async () => {
    const routes = createChatBoardRouteHandlers({
        chatStore: {
            listBoards: () => [{ id: 1, name: 'General' }]
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => null,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatBoardsRoute({ method: 'GET' }, res);

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.boards, [{ id: 1, name: 'General' }]);
});

test('chat board route handlers return 404 when joining a missing board', async () => {
    const routes = createChatBoardRouteHandlers({
        chatStore: {
            joinBoard: () => null
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => ({ id: 'user-1' }),
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatBoardJoinRoute({ method: 'POST' }, res, 123);

    assert.equal(res.status, 404);
    assert.equal(res.payload.message, 'Board not found.');
});
