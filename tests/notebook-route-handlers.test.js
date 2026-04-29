const test = require('node:test');
const assert = require('node:assert/strict');
const { createNotebookRouteHandlers } = require('../server/notebook-route-handlers');

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

test('notebook route handlers create a notebook for the signed-in user', async () => {
    const user = { id: 'user-1' };
    const routes = createNotebookRouteHandlers({
        notesStore: {
            createNotebook(userId, payload) {
                assert.equal(userId, user.id);
                assert.equal(payload.sort_order, 3);
                return { id: 'book-1', ...payload };
            }
        },
        readJsonBody: async () => ({ title: 'Trades', sortOrder: 3 }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleNotebooksCollectionRoute({ method: 'POST' }, res);

    assert.equal(res.status, 201);
    assert.equal(res.payload.notebook.id, 'book-1');
});

test('notebook route handlers return 404 when a notebook is missing', async () => {
    const routes = createNotebookRouteHandlers({
        notesStore: {
            getNotebook() {
                return null;
            }
        },
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => ({ id: 'user-1' }),
        sendJson
    });
    const res = fakeResponse();

    await routes.handleNotebookItemRoute({ method: 'GET' }, res, 123);

    assert.equal(res.status, 404);
    assert.equal(res.payload.message, 'Notebook not found.');
});
