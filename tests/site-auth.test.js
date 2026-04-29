const test = require('node:test');
const assert = require('node:assert/strict');
const { createSiteAuth } = require('../server/site-auth');

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

test('site auth returns the current session user', () => {
    const user = { id: 'user-1', email: 'user@example.com' };
    const siteAuth = createSiteAuth({
        authStore: { getSessionUser: () => user },
        sendJson
    });

    assert.equal(siteAuth.getAuthenticatedSiteUser({}), user);
});

test('site auth sends a simple 401 response when login is missing', () => {
    const siteAuth = createSiteAuth({
        authStore: { getSessionUser: () => null },
        sendJson
    });
    const res = fakeResponse();

    const user = siteAuth.requireAuthenticatedSiteUser({}, res);

    assert.equal(user, null);
    assert.equal(res.status, 401);
    assert.equal(res.payload.error, 'UNAUTHORIZED');
    assert.equal(res.payload.message, 'Sign in is required.');
});
