const test = require('node:test');
const assert = require('node:assert/strict');
const { createSiteProfileRoutes } = require('../server/site-profile-routes');

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
        handleProfileRoute: handler('handleProfileRoute'),
        handleProfileAvatarRoute: handler('handleProfileAvatarRoute'),
        handleNoteImageUploadRoute: handler('handleNoteImageUploadRoute')
    };

    return {
        calls,
        req,
        res,
        routeProfileRequest: createSiteProfileRoutes(context)
    };
}

test('site profile routes dispatch avatar upload', () => {
    const { calls, req, res, routeProfileRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/profile/avatar');

    const matched = routeProfileRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleProfileAvatarRoute');
    assert.equal(calls[1].errorCode, 'PROFILE_AVATAR_FAILED');
});

test('site profile routes return false for other paths', () => {
    const { calls, req, res, routeProfileRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/chat/boards');

    const matched = routeProfileRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
