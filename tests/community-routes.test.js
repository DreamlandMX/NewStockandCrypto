const test = require('node:test');
const assert = require('node:assert/strict');
const { createCommunityRoutes } = require('../server/community-routes');

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

test('community ideas route lists ideas with optional viewer info', async () => {
    const viewer = { id: 'user-1', displayName: 'Ava', email: 'ava@example.com' };
    const parsedUrl = new URL('http://local/api/community/ideas?market=crypto&limit=3');
    const routes = createCommunityRoutes({
        notesStore: {
            listIdeas(viewerId, filters) {
                assert.equal(viewerId, viewer.id);
                assert.equal(filters.market, 'crypto');
                assert.equal(filters.limit, '3');
                return [{ id: 'idea-1' }];
            }
        },
        getAuthenticatedSiteUser: () => viewer,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleCommunityIdeasRoute({ method: 'GET' }, res, parsedUrl);

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.ideas, [{ id: 'idea-1' }]);
    assert.deepEqual(res.payload.viewer, viewer);
});

test('community note route returns related ideas', async () => {
    const note = { id: 'note-1', title: 'Public setup' };
    const routes = createCommunityRoutes({
        notesStore: {
            getNoteForViewer(viewerId, noteId) {
                assert.equal(viewerId, null);
                assert.equal(noteId, 'note-1');
                return note;
            },
            getRelatedIdeas(viewerId, relatedNote, limit) {
                assert.equal(viewerId, null);
                assert.equal(relatedNote, note);
                assert.equal(limit, 4);
                return [{ id: 'note-2' }];
            }
        },
        getAuthenticatedSiteUser: () => null,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleCommunityNoteRoute({ method: 'GET' }, res, 'note-1');

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.related, [{ id: 'note-2' }]);
});
