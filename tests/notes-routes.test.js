const test = require('node:test');
const assert = require('node:assert/strict');
const { createNotesRoutes } = require('../server/notes-routes');

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

test('notes collection route lists notes for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const parsedUrl = new URL('http://local/api/notes?market=crypto&limit=5');
    const routes = createNotesRoutes({
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

test('notes collection route creates notes with normalized field names', async () => {
    const user = { id: 'user-1' };
    const routes = createNotesRoutes({
        notesStore: {
            createNote(userId, payload) {
                assert.equal(userId, user.id);
                assert.equal(payload.notebook_id, 'book-1');
                return { id: 'note-1', ...payload };
            }
        },
        readJsonBody: async () => ({ notebookId: 'book-1', title: 'Trade note' }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleNotesCollectionRoute({ method: 'POST' }, res, new URL('http://local/api/notes'));

    assert.equal(res.status, 201);
    assert.equal(res.payload.note.id, 'note-1');
    assert.equal(res.payload.note.title, 'Trade note');
});
