const test = require('node:test');
const assert = require('node:assert/strict');
const {
    hashPassword,
    hashToken,
    randomToken,
    verifyPassword
} = require('../server/auth-crypto-helpers');

test('hashToken returns a stable sha256 hex hash', () => {
    assert.equal(hashToken('abc'), hashToken('abc'));
    assert.notEqual(hashToken('abc'), 'abc');
});

test('randomToken returns a long random hex token', () => {
    assert.match(randomToken(), /^[a-f0-9]{64}$/);
});

test('password helpers hash and verify passwords', async () => {
    const hash = await hashPassword('correct horse battery staple');

    assert.equal(await verifyPassword('correct horse battery staple', hash), true);
    assert.equal(await verifyPassword('wrong password', hash), false);
});
