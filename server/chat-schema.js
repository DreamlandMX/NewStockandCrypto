function createChatTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS chat_boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            topic TEXT NOT NULL DEFAULT '',
            is_public INTEGER NOT NULL DEFAULT 1,
            created_by_user_id INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS chat_members (
            board_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            joined_at TEXT NOT NULL,
            PRIMARY KEY (board_id, user_id),
            FOREIGN KEY (board_id) REFERENCES chat_boards(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            reply_to INTEGER,
            attachment_url TEXT,
            attachment_type TEXT,
            attachment_name TEXT,
            is_edited INTEGER NOT NULL DEFAULT 0,
            edited_at TEXT,
            is_deleted INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (board_id) REFERENCES chat_boards(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reply_to) REFERENCES chat_messages(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS message_reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            emoji TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(message_id, user_id, emoji),
            FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS chat_presence (
            user_id INTEGER PRIMARY KEY,
            board_id INTEGER,
            status TEXT NOT NULL DEFAULT 'offline',
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (board_id) REFERENCES chat_boards(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chat_messages_board_id ON chat_messages(board_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
        CREATE INDEX IF NOT EXISTS idx_chat_presence_board_id ON chat_presence(board_id, updated_at);
    `);
}

module.exports = {
    createChatTables
};
