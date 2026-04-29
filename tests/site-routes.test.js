const test = require('node:test');
const assert = require('node:assert/strict');
const { createSiteRoutes } = require('../server/site-routes');

function createHarness() {
    const calls = [];
    const req = {};
    const res = {};
    const handler = (name) => (...args) => {
        calls.push({ name, args });
        return `${name}-promise`;
    };
    const context = {
        authStore: {
            handleRegister: handler('handleRegister'),
            handleLogin: handler('handleLogin'),
            handleMe: handler('handleMe'),
            handleLogout: handler('handleLogout')
        },
        sendJson: () => {},
        readJsonBody: () => {},
        handleAsyncRoute(response, promise, errorCode) {
            calls.push({ response, promise, errorCode });
        },
        handleProfileRoute: handler('handleProfileRoute'),
        handleProfileAvatarRoute: handler('handleProfileAvatarRoute'),
        handleNoteImageUploadRoute: handler('handleNoteImageUploadRoute'),
        handleChatBoardsRoute: handler('handleChatBoardsRoute'),
        handleChatBoardJoinRoute: handler('handleChatBoardJoinRoute'),
        handleChatBoardMessagesRoute: handler('handleChatBoardMessagesRoute'),
        handleChatMessageReactionsRoute: handler('handleChatMessageReactionsRoute'),
        handleChatMessageItemRoute: handler('handleChatMessageItemRoute'),
        handleChatPresenceRoute: handler('handleChatPresenceRoute'),
        handleNotebooksCollectionRoute: handler('handleNotebooksCollectionRoute'),
        handleNotebookItemRoute: handler('handleNotebookItemRoute'),
        handleNotesCollectionRoute: handler('handleNotesCollectionRoute'),
        handleNoteShareRoute: handler('handleNoteShareRoute'),
        handleCommunityIdeasRoute: handler('handleCommunityIdeasRoute'),
        handleCommunityShareRoute: handler('handleCommunityShareRoute'),
        handleCommunityNoteRoute: handler('handleCommunityNoteRoute'),
        handleNoteVersionsRoute: handler('handleNoteVersionsRoute'),
        handleNoteItemRoute: handler('handleNoteItemRoute'),
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
        routeSiteRequest: createSiteRoutes(context)
    };
}

test('site routes dispatch auth login', () => {
    const { calls, req, res, routeSiteRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/auth/login');

    const matched = routeSiteRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleLogin');
    assert.equal(calls[1].errorCode, 'LOGIN_FAILED');
});

test('site routes dispatch chat board messages with a numeric board id', () => {
    const { calls, req, res, routeSiteRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/chat/boards/42/messages?limit=20');

    const matched = routeSiteRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleChatBoardMessagesRoute');
    assert.equal(calls[0].args[2], 42);
    assert.equal(calls[1].errorCode, 'CHAT_MESSAGES_FAILED');
});

test('site routes dispatch note versions before generic note detail', () => {
    const { calls, req, res, routeSiteRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/notes/77/versions');

    const matched = routeSiteRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleNoteVersionsRoute');
    assert.equal(calls[0].args[2], 77);
    assert.equal(calls[1].errorCode, 'NOTE_VERSIONS_FAILED');
});

test('site routes return false for market paths', () => {
    const { calls, req, res, routeSiteRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/crypto/prices');

    const matched = routeSiteRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
