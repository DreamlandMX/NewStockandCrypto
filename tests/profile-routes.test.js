const test = require('node:test');
const assert = require('node:assert/strict');
const { createProfileRoutes } = require('../server/profile-routes');

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

test('profile route returns the signed-in user profile', async () => {
    const user = { id: 'user-1' };
    const routes = createProfileRoutes({
        profileStore: {
            getProfile(profileUser) {
                assert.equal(profileUser, user);
                return { id: profileUser.id, username: 'ava' };
            }
        },
        uploadStore: {},
        readJsonBody: async () => ({}),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleProfileRoute({ method: 'GET' }, res);

    assert.equal(res.status, 200);
    assert.deepEqual(res.payload.profile, { id: user.id, username: 'ava' });
});

test('profile route updates only editable profile fields', async () => {
    const user = { id: 'user-1' };
    const routes = createProfileRoutes({
        profileStore: {
            updateProfile(profileUser, payload) {
                assert.equal(profileUser, user);
                assert.deepEqual(payload, {
                    username: 'ava',
                    bio: 'Trader',
                    website: undefined,
                    location: undefined
                });
                return { id: profileUser.id, ...payload };
            }
        },
        uploadStore: {},
        readJsonBody: async () => ({ username: 'ava', bio: 'Trader', role: 'admin' }),
        requireAuthenticatedSiteUser: () => user,
        sendJson
    });
    const res = fakeResponse();

    await routes.handleProfileRoute({ method: 'PATCH' }, res);

    assert.equal(res.status, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.profile.username, 'ava');
});
