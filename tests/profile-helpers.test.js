const test = require('node:test');
const assert = require('node:assert/strict');
const {
    deriveDefaultUsername,
    mapProfileRow,
    normalizeText
} = require('../server/profile-helpers');

test('normalizeText trims and limits text length', () => {
    assert.equal(normalizeText('  hello world  ', 5), 'hello');
});

test('deriveDefaultUsername prefers display name then email name', () => {
    assert.equal(deriveDefaultUsername({ displayName: 'Ava Trader', email: 'ava@example.com' }), 'Ava Trader');
    assert.equal(deriveDefaultUsername({ email: 'sam@example.com' }), 'sam');
});

test('mapProfileRow fills missing profile fields from the fallback user', () => {
    const profile = mapProfileRow(null, {
        id: 7,
        displayName: 'Ava',
        email: 'ava@example.com',
        createdAt: '2026-01-01T00:00:00.000Z'
    });

    assert.equal(profile.user_id, 7);
    assert.equal(profile.username, 'Ava');
    assert.equal(profile.created_at, '2026-01-01T00:00:00.000Z');
});
