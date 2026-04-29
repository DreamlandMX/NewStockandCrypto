const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatRoutes } = require('../server/chat-routes');

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

test('chat boards route lists public boards without requiring login', async () => {
    const routes = createChatRoutes({
        chatStore: {
            listBoards() {
                return [{ id: 1, name: 'General' }];
            }
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

test('chat boards route creates a board for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const routes = createChatRoutes({
        chatStore: {
            createBoard(userId, payload) {
                assert.equal(userId, user.id);
                assert.deepEqual(payload, {
                    name: 'Trades',
                    topic: 'Daily setups',
                    is_public: true
                });
                return { id: 2, ...payload };
            }
        },
        readJsonBody: async () => ({ name: 'Trades', topic: 'Daily setups', is_public: true }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatBoardsRoute({ method: 'POST' }, res);

    assert.equal(res.status, 201);
    assert.equal(res.payload.board.id, 2);
});

test('chat messages route updates presence after sending a message', async () => {
    const user = { id: 'user-1' };
    const presenceUpdates = [];
    const routes = createChatRoutes({
        chatStore: {
            sendMessage(userId, boardId, payload) {
                assert.equal(userId, user.id);
                assert.equal(boardId, 3);
                assert.equal(payload.content, 'hello');
                return { id: 9, content: payload.content };
            },
            updatePresence(userId, status, boardId) {
                presenceUpdates.push({ userId, status, boardId });
            }
        },
        readJsonBody: async () => ({ content: 'hello' }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatBoardMessagesRoute({ method: 'POST' }, res, 3, new URL('http://local/api/chat/boards/3/messages'));

    assert.equal(res.status, 201);
    assert.deepEqual(res.payload.message, { id: 9, content: 'hello' });
    assert.deepEqual(presenceUpdates, [{ userId: user.id, status: 'online', boardId: 3 }]);
});
