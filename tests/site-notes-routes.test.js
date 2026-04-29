const test = require('node:test');
const assert = require('node:assert/strict');
const { createSiteNotesRoutes } = require('../server/site-notes-routes');

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
        handleNotebooksCollectionRoute: handler('handleNotebooksCollectionRoute'),
        handleNotebookItemRoute: handler('handleNotebookItemRoute'),
        handleNotesCollectionRoute: handler('handleNotesCollectionRoute'),
        handleNoteShareRoute: handler('handleNoteShareRoute'),
        handleNoteVersionsRoute: handler('handleNoteVersionsRoute'),
        handleNoteItemRoute: handler('handleNoteItemRoute')
    };

    return {
        calls,
        req,
        res,
        routeNotesRequest: createSiteNotesRoutes(context)
    };
}

test('site notes routes dispatch note versions before generic note detail', () => {
    const { calls, req, res, routeNotesRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/notes/77/versions');

    const matched = routeNotesRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleNoteVersionsRoute');
    assert.equal(calls[0].args[2], 77);
    assert.equal(calls[1].errorCode, 'NOTE_VERSIONS_FAILED');
});

test('site notes routes return false for other paths', () => {
    const { calls, req, res, routeNotesRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/community/ideas');

    const matched = routeNotesRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
