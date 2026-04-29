const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatMessageRouteHandlers } = require('../server/chat-message-route-handlers');

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

test('chat message route handlers edit a message for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const routes = createChatMessageRouteHandlers({
        chatStore: {
            editMessage(userId, messageId, content) {
                assert.equal(userId, user.id);
                assert.equal(messageId, 5);
                assert.equal(content, 'updated');
                return { id: 5, content };
            }
        },
        readJsonBody: async () => ({ content: 'updated' }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatMessageItemRoute({ method: 'PATCH' }, res, 5);

    assert.equal(res.status, 200);
    assert.equal(res.payload.message.content, 'updated');
});

test('chat message route handlers list reactions without login', async () => {
    const routes = createChatMessageRouteHandlers({
        chatStore: {
            listReactions: () => [{ emoji: '👍' }]
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => null,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleChatMessageReactionsRoute({ method: 'GET' }, res, 5, new URL('http://local/api/chat/messages/5/reactions'));

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.reactions, [{ emoji: '👍' }]);
});
