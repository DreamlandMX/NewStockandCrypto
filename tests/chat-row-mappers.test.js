const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mapBoardRow,
    mapMessageRow,
    mapReactionRow
} = require('../server/chat-row-mappers');

test('chat row mappers turn board rows into browser-friendly boards', () => {
    const board = mapBoardRow({
        id: 7,
        name: 'Crypto Trading',
        topic: 'crypto',
        is_public: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        member_count: '3'
    });

    assert.deepEqual(board, {
        id: 7,
        name: 'Crypto Trading',
        topic: 'crypto',
        is_public: true,
        created_at: '2026-01-01T00:00:00.000Z',
        members: 3
    });
});

test('chat row mappers include reply details when a message replies to another message', () => {
    const message = mapMessageRow({
        id: 11,
        board_id: 1,
        user_id: 2,
        content: 'Hello',
        attachment_url: '',
        attachment_type: '',
        attachment_name: '',
        is_edited: 1,
        is_deleted: 0,
        created_at: 'now',
        edited_at: 'later',
        username: 'Ava',
        reply_message_id: 10,
        reply_content: 'Original',
        reply_username: 'Kai'
    });

    assert.equal(message.reply_to.content, 'Original');
    assert.equal(message.users.username, 'Ava');
    assert.equal(message.is_edited, true);
    assert.equal(message.attachment_url, null);
});

test('chat row mappers use safe community member names for reaction rows', () => {
    const reaction = mapReactionRow({
        id: 5,
        message_id: 11,
        user_id: 2,
        emoji: 'Like',
        created_at: 'now',
        username: ''
    });

    assert.equal(reaction.user_profiles.username, 'Community Member');
});
