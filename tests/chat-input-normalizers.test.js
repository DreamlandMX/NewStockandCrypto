const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeBoardName,
    normalizeBoardTopic,
    normalizeMessageContent
} = require('../server/chat-input-normalizers');

test('chat input normalizers keep board names simple and give empty names a fallback', () => {
    assert.equal(normalizeBoardName('  Crypto Room  '), 'Crypto Room');
    assert.equal(normalizeBoardName('   '), 'New Lounge');
});

test('chat input normalizers trim board topics', () => {
    assert.equal(normalizeBoardTopic('  trading  '), 'trading');
});

test('chat input normalizers trim message content after shared text cleanup', () => {
    assert.equal(normalizeMessageContent('  hello\\nworld  '), 'hello\nworld');
});
