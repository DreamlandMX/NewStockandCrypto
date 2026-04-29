const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeChatMessagePayload,
    normalizeNotebookPayload,
    normalizeNotePayload,
    normalizeProfilePayload
} = require('../server/payload-normalizers');

test('note payload keeps the field names used by the notes store', () => {
    assert.deepEqual(normalizeNotePayload({
        notebookId: 'book-1',
        title: 'Plan',
        content: 'Buy low',
        market: 'crypto',
        tags: ['btc'],
        is_public: true
    }), {
        notebook_id: 'book-1',
        title: 'Plan',
        content: 'Buy low',
        market: 'crypto',
        tags: ['btc'],
        is_pinned: undefined,
        is_favorite: undefined,
        is_public: true
    });
});

test('notebook payload accepts the browser sortOrder name', () => {
    assert.deepEqual(normalizeNotebookPayload({
        name: 'Ideas',
        color: '#55ddaa',
        icon: 'star',
        sortOrder: 7
    }), {
        name: 'Ideas',
        color: '#55ddaa',
        icon: 'star',
        sort_order: 7
    });
});

test('profile payload only keeps editable profile fields', () => {
    assert.deepEqual(normalizeProfilePayload({
        username: 'ava',
        bio: 'Trader',
        website: 'https://example.com',
        location: 'Chicago',
        ignored: true
    }), {
        username: 'ava',
        bio: 'Trader',
        website: 'https://example.com',
        location: 'Chicago'
    });
});

test('chat message payload accepts camelCase attachment fields', () => {
    assert.deepEqual(normalizeChatMessagePayload({
        content: 'hello',
        replyTo: 'message-1',
        attachmentUrl: '/uploads/a.png',
        attachmentType: 'image/png',
        attachmentName: 'a.png'
    }), {
        content: 'hello',
        reply_to: 'message-1',
        attachment_url: '/uploads/a.png',
        attachment_type: 'image/png',
        attachment_name: 'a.png'
    });
});
