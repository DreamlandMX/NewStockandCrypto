const test = require('node:test');
const assert = require('node:assert/strict');
const { createSiteChatRoutes } = require('../server/site-chat-routes');

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
        handleChatBoardsRoute: handler('handleChatBoardsRoute'),
        handleChatBoardJoinRoute: handler('handleChatBoardJoinRoute'),
        handleChatBoardMessagesRoute: handler('handleChatBoardMessagesRoute'),
        handleChatMessageReactionsRoute: handler('handleChatMessageReactionsRoute'),
        handleChatMessageItemRoute: handler('handleChatMessageItemRoute'),
        handleChatPresenceRoute: handler('handleChatPresenceRoute')
    };

    return {
        calls,
        req,
        res,
        routeChatRequest: createSiteChatRoutes(context)
    };
}

test('site chat routes dispatch board messages with a numeric board id', () => {
    const { calls, req, res, routeChatRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/chat/boards/42/messages?limit=20');

    const matched = routeChatRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleChatBoardMessagesRoute');
    assert.equal(calls[0].args[2], 42);
    assert.equal(calls[1].errorCode, 'CHAT_MESSAGES_FAILED');
});

test('site chat routes return false for other paths', () => {
    const { calls, req, res, routeChatRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/notes');

    const matched = routeChatRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
