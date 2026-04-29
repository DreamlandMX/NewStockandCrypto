const test = require('node:test');
const assert = require('node:assert/strict');
const { seedDefaultChatBoards } = require('../server/chat-seed-boards');

test('chat seed boards inserts default boards when the database is empty', () => {
    const inserted = [];
    const db = fakeSeedDb({
        boardCount: 0,
        onInsert: (board) => inserted.push(board)
    });

    seedDefaultChatBoards(db, { now: () => '2026-01-01T00:00:00.000Z' });

    assert.deepEqual(inserted.map((board) => board.name), [
        'Crypto Trading',
        'Stock Trading',
        'Forex Trading'
    ]);
    assert.equal(inserted[0].created_at, '2026-01-01T00:00:00.000Z');
    assert.equal(inserted[0].updated_at, '2026-01-01T00:00:00.000Z');
});

test('chat seed boards skips defaults when boards already exist', () => {
    const inserted = [];
    const db = fakeSeedDb({
        boardCount: 2,
        onInsert: (board) => inserted.push(board)
    });

    seedDefaultChatBoards(db);

    assert.deepEqual(inserted, []);
});

function fakeSeedDb({ boardCount, onInsert }) {
    return {
        prepare(sql) {
            if (sql.includes('COUNT(*)')) {
                return {
                    get: () => ({ count: boardCount })
                };
            }
            return {
                run: onInsert
            };
        }
    };
}
