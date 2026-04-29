const test = require('node:test');
const assert = require('node:assert/strict');
const {
    clampLimit,
    normalizeBoolean,
    normalizeTextContent,
    nowIso,
    parseJsonOrNull
} = require('../server/store-helpers');

test('nowIso returns an ISO timestamp string', () => {
    assert.match(nowIso(), /^\d{4}-\d{2}-\d{2}T/);
});

test('clampLimit keeps valid positive limits under the max', () => {
    assert.equal(clampLimit('12', 50), 12);
    assert.equal(clampLimit('999', 50, 100), 100);
    assert.equal(clampLimit('bad', 50), 50);
});

test('normalizeBoolean accepts common true values and fallback values', () => {
    assert.equal(normalizeBoolean('yes'), true);
    assert.equal(normalizeBoolean(0), false);
    assert.equal(normalizeBoolean(undefined, true), true);
});

test('normalizeTextContent converts escaped line breaks to real newlines', () => {
    assert.equal(normalizeTextContent('a\\nb'), 'a\nb');
});

test('parseJsonOrNull returns null when JSON is missing or invalid', () => {
    assert.deepEqual(parseJsonOrNull('{"ok":true}'), { ok: true });
    assert.equal(parseJsonOrNull('not-json'), null);
    assert.equal(parseJsonOrNull(''), null);
});
