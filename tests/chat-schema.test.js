const test = require('node:test');
const assert = require('node:assert/strict');
const { createChatTables } = require('../server/chat-schema');

test('chat schema creates every table used by the chat store', () => {
    const executedSql = [];
    const db = {
        exec(sql) {
            executedSql.push(sql);
        }
    };

    createChatTables(db);

    const sql = executedSql.join('\n');
    assert.match(sql, /CREATE TABLE IF NOT EXISTS chat_boards/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS chat_members/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS chat_messages/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS message_reactions/);
    assert.match(sql, /CREATE TABLE IF NOT EXISTS chat_presence/);
});

test('chat schema creates indexes for message and presence lookups', () => {
    const db = {
        sql: '',
        exec(sql) {
            this.sql = sql;
        }
    };

    createChatTables(db);

    assert.match(db.sql, /idx_chat_messages_board_id/);
    assert.match(db.sql, /idx_message_reactions_message_id/);
    assert.match(db.sql, /idx_chat_presence_board_id/);
});
