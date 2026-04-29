const test = require('node:test');
const assert = require('node:assert/strict');
const { createSiteRouteBundle } = require('../server/site-route-bundle');

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

function createBundle() {
    const user = { id: 'user-1', displayName: 'Ava', email: 'ava@example.com' };
    const calls = [];
    const bundle = createSiteRouteBundle({
        authStore: {
            getSessionUser: () => user,
            handleRegister: () => 'register-promise',
            handleLogin: () => 'login-promise',
            handleMe: () => 'me-promise',
            handleLogout: () => 'logout-promise'
        },
        profileStore: {
            getProfile: () => ({ id: user.id, username: 'ava' }),
            updateProfile: () => ({ id: user.id, username: 'ava' })
        },
        uploadStore: {},
        notesStore: {
            listIdeas: () => [{ id: 'idea-1' }],
            getNoteForViewer: () => null,
            getSharedIdea: () => null,
            getRelatedIdeas: () => [],
            listNotebooks: () => [],
            listNotes: () => []
        },
        positionsStore: {
            listPositions: () => []
        },
        chatStore: {
            listBoards: () => [{ id: 1, name: 'General' }],
            listMessages: () => [],
            listOnlineUsers: () => []
        },
        readJsonBody: async () => ({}),
        sendJson,
        handleAsyncRoute(res, promise, errorCode) {
            calls.push({ res, promise, errorCode });
        }
    });

    return { bundle, calls };
}

test('site route bundle exposes auth helpers', () => {
    const { bundle } = createBundle();

    assert.equal(bundle.getAuthenticatedSiteUser({}).id, 'user-1');
    assert.equal(bundle.requireAuthenticatedSiteUser({}, fakeResponse()).id, 'user-1');
});

test('site route bundle dispatches profile routes through the site router', () => {
    const { bundle, calls } = createBundle();
    const req = { method: 'GET' };
    const res = fakeResponse();
    const parsedUrl = new URL('http://local/api/profile');

    const matched = bundle.routeSiteRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].errorCode, 'PROFILE_FAILED');
});

test('site route bundle dispatches chat routes through the site router', () => {
    const { bundle, calls } = createBundle();
    const req = { method: 'GET' };
    const res = fakeResponse();
    const parsedUrl = new URL('http://local/api/chat/boards');

    const matched = bundle.routeSiteRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].errorCode, 'CHAT_BOARDS_FAILED');
});
