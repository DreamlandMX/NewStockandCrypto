const test = require('node:test');
const assert = require('node:assert/strict');
const { createSiteCommunityRoutes } = require('../server/site-community-routes');

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
        handleCommunityIdeasRoute: handler('handleCommunityIdeasRoute'),
        handleCommunityShareRoute: handler('handleCommunityShareRoute'),
        handleCommunityNoteRoute: handler('handleCommunityNoteRoute')
    };

    return {
        calls,
        req,
        res,
        routeCommunityRequest: createSiteCommunityRoutes(context)
    };
}

test('site community routes dispatch note detail with a numeric note id', () => {
    const { calls, req, res, routeCommunityRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/community/notes/88');

    const matched = routeCommunityRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleCommunityNoteRoute');
    assert.equal(calls[0].args[2], 88);
    assert.equal(calls[1].errorCode, 'COMMUNITY_NOTE_FAILED');
});

test('site community routes return false for other paths', () => {
    const { calls, req, res, routeCommunityRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/site-positions');

    const matched = routeCommunityRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
