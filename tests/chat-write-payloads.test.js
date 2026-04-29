const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildCreateBoardPayload,
    buildDeleteMessagePayload,
    buildEditMessagePayload,
    buildJoinBoardPayload,
    buildMessagePayload,
    buildPresencePayload,
    buildReactionPayload
} = require('../server/chat-write-payloads');

test('chat write payloads build simple board and join records', () => {
    const created = buildCreateBoardPayload(3, { name: '  Room  ', topic: ' crypto ' }, 'now');
    const joined = buildJoinBoardPayload(3, 9, 'owner', 'now');

    assert.deepEqual(created, {
        name: 'Room',
        topic: 'crypto',
        is_public: 1,
        created_by_user_id: 3,
        created_at: 'now',
        updated_at: 'now'
    });
    assert.deepEqual(joined, {
        board_id: 9,
        user_id: 3,
        role: 'owner',
        joined_at: 'now'
    });
});

test('chat write payloads build message records and reject empty messages without attachments', () => {
    const message = buildMessagePayload(3, 9, {
        content: ' hello ',
        reply_to: '4',
        attachment_url: '',
        attachment_type: '',
        attachment_name: ''
    }, 'now');

    assert.equal(message.content, 'hello');
    assert.equal(message.reply_to, 4);
    assert.equal(message.attachment_url, null);
    assert.throws(
        () => buildMessagePayload(3, 9, { content: '' }, 'now'),
        /Message content is required/
    );
});

test('chat write payloads build edit delete reaction and presence records', () => {
    assert.deepEqual(buildEditMessagePayload(3, 8, ' edited ', 'now'), {
        id: 8,
        user_id: 3,
        content: 'edited',
        edited_at: 'now',
        updated_at: 'now'
    });
    assert.deepEqual(buildDeleteMessagePayload(3, 8, 'now'), {
        id: 8,
        user_id: 3,
        deleted_at: 'now',
        updated_at: 'now'
    });
    assert.deepEqual(buildReactionPayload(3, 8, '', 'now'), {
        message_id: 8,
        user_id: 3,
        emoji: 'Like',
        created_at: 'now'
    });
    assert.deepEqual(buildPresencePayload(3, '', '', 'now'), {
        user_id: 3,
        board_id: null,
        status: 'online',
        updated_at: 'now'
    });
});
