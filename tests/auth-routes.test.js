const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthRoutes } = require('../server/auth-routes');

function createHarness() {
    const calls = [];
    const req = {};
    const res = {};
    const handler = (name) => (...args) => {
        calls.push({ name, args });
        return `${name}-promise`;
    };
    const context = {
        authStore: {
            handleRegister: handler('handleRegister'),
            handleLogin: handler('handleLogin'),
            handleMe: handler('handleMe'),
            handleLogout: handler('handleLogout')
        },
        sendJson: () => {},
        readJsonBody: () => {},
        handleAsyncRoute(response, promise, errorCode) {
            calls.push({ response, promise, errorCode });
        }
    };

    return {
        calls,
        req,
        res,
        routeAuthRequest: createAuthRoutes(context)
    };
}

test('auth routes dispatch login', () => {
    const { calls, req, res, routeAuthRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/auth/login');

    const matched = routeAuthRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleLogin');
    assert.equal(calls[1].errorCode, 'LOGIN_FAILED');
});

test('auth routes return false for non-auth paths', () => {
    const { calls, req, res, routeAuthRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/profile');

    const matched = routeAuthRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
