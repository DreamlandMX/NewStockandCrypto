const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getClientIp,
    isSecureRequest,
    isValidEmail,
    normalizeEmail,
    parseCookies,
    serializeCookie
} = require('../server/auth-request-helpers');

test('parseCookies reads simple cookie headers', () => {
    assert.deepEqual(parseCookies('sc_session=abc%20123; theme=dark'), {
        sc_session: 'abc 123',
        theme: 'dark'
    });
});

test('serializeCookie writes a browser cookie string', () => {
    const cookie = serializeCookie('sc_session', 'abc', {
        maxAge: 10,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
        secure: true
    });

    assert.equal(cookie, 'sc_session=abc; Max-Age=10; Path=/; HttpOnly; SameSite=Lax; Secure');
});

test('request helpers normalize email and detect valid emails', () => {
    assert.equal(normalizeEmail(' TEST@Example.COM '), 'test@example.com');
    assert.equal(isValidEmail('test@example.com'), true);
    assert.equal(isValidEmail('bad-email'), false);
});

test('request helpers read proxy security and client IP headers', () => {
    const req = {
        headers: {
            'x-forwarded-proto': 'https',
            'x-forwarded-for': '203.0.113.10, 10.0.0.1'
        },
        socket: {}
    };

    assert.equal(isSecureRequest(req), true);
    assert.equal(getClientIp(req), '203.0.113.10');
});
