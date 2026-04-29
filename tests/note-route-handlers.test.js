const test = require('node:test');
const assert = require('node:assert/strict');
const { createNoteRouteHandlers } = require('../server/note-route-handlers');

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

test('note route handlers list notes with filters from the URL', async () => {
    const user = { id: 'user-1' };
    const parsedUrl = new URL('http://local/api/notes?market=crypto&limit=5');
    const routes = createNoteRouteHandlers({
        notesStore: {
            listNotes(userId, filters) {
                assert.equal(userId, user.id);
                assert.equal(filters.market, 'crypto');
                assert.equal(filters.limit, '5');
                return [{ id: 'note-1' }];
            }
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleNotesCollectionRoute({ method: 'GET' }, res, parsedUrl);

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.notes, [{ id: 'note-1' }]);
});

test('note route handlers return 404 when a note is missing', async () => {
    const routes = createNoteRouteHandlers({
        notesStore: {
            getNoteForUser() {
                return null;
            }
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => ({ id: 'user-1' }),
        sendJson
    });
    const res = fakeResponse();

    await routes.handleNoteItemRoute({ method: 'GET' }, res, 123);

    assert.equal(res.status, 404);
    assert.equal(res.payload.message, 'Note not found.');
});
