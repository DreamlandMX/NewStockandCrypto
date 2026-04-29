const { nowIso } = require('./store-helpers');

const DEFAULT_CHAT_BOARDS = [
    { name: 'Crypto Trading', topic: 'crypto', is_public: 1 },
    { name: 'Stock Trading', topic: 'stock', is_public: 1 },
    { name: 'Forex Trading', topic: 'forex', is_public: 1 }
];

function seedDefaultChatBoards(db, options = {}) {
    const now = options.now || nowIso;
    const boardCount = db.prepare('SELECT COUNT(*) AS count FROM chat_boards').get();
    if (Number(boardCount?.count || 0)) {
        return;
    }

    const insertSeedBoard = db.prepare(`
        INSERT INTO chat_boards (name, topic, is_public, created_by_user_id, created_at, updated_at)
        VALUES (@name, @topic, @is_public, NULL, @created_at, @updated_at)
    `);
    const timestamp = now();
    for (const board of DEFAULT_CHAT_BOARDS) {
        insertSeedBoard.run({
            ...board,
            created_at: timestamp,
            updated_at: timestamp
        });
    }
}

module.exports = {
    DEFAULT_CHAT_BOARDS,
    seedDefaultChatBoards
};
