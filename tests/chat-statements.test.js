const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatStatements } = require('../server/chat-statements');

test('chat statements prepares every statement used by chat-store', () => {
    const preparedSql = [];
    const db = {
        prepare(sql) {
            preparedSql.push(sql);
            return { sql };
        }
    };

    const statements = createChatStatements(db);

    assert.deepEqual(Object.keys(statements), [
        'getBoard',
        'listBoards',
        'createBoard',
        'joinBoard',
        'insertMessage',
        'getMessageForOwner',
        'updateMessage',
        'deleteMessage',
        'listMessages',
        'listReactions',
        'addReaction',
        'removeReaction',
        'setPresence',
        'listOnlineUsers'
    ]);
    assert.equal(preparedSql.length, 14);
});

test('chat statements keeps message and presence queries easy to inspect', () => {
    const statements = createChatStatements({
        prepare(sql) {
            return { sql };
        }
    });

    assert.match(statements.listMessages.sql, /FROM chat_messages AS messages/);
    assert.match(statements.listMessages.sql, /messages.is_deleted = 0/);
    assert.match(statements.setPresence.sql, /ON CONFLICT\(user_id\) DO UPDATE/);
    assert.match(statements.listOnlineUsers.sql, /chat_presence.status = 'online'/);
});
