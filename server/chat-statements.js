function createChatStatements(db) {
    return {
        getBoard: db.prepare(`
            SELECT id, name, topic, is_public, created_at, updated_at
            FROM chat_boards
            WHERE id = ?
            LIMIT 1
        `),
        listBoards: db.prepare(`
            SELECT
                chat_boards.id,
                chat_boards.name,
                chat_boards.topic,
                chat_boards.is_public,
                chat_boards.created_at,
                chat_boards.updated_at,
                COUNT(chat_members.user_id) AS member_count
            FROM chat_boards
            LEFT JOIN chat_members ON chat_members.board_id = chat_boards.id
            WHERE chat_boards.is_public = 1
            GROUP BY chat_boards.id
            ORDER BY chat_boards.created_at ASC
        `),
        createBoard: db.prepare(`
            INSERT INTO chat_boards (name, topic, is_public, created_by_user_id, created_at, updated_at)
            VALUES (@name, @topic, @is_public, @created_by_user_id, @created_at, @updated_at)
        `),
        joinBoard: db.prepare(`
            INSERT INTO chat_members (board_id, user_id, role, joined_at)
            VALUES (@board_id, @user_id, @role, @joined_at)
            ON CONFLICT(board_id, user_id) DO UPDATE SET role = excluded.role
        `),
        insertMessage: db.prepare(`
            INSERT INTO chat_messages (
                board_id, user_id, content, reply_to, attachment_url, attachment_type, attachment_name,
                is_edited, edited_at, is_deleted, deleted_at, created_at, updated_at
            ) VALUES (
                @board_id, @user_id, @content, @reply_to, @attachment_url, @attachment_type, @attachment_name,
                0, NULL, 0, NULL, @created_at, @updated_at
            )
        `),
        getMessageForOwner: db.prepare(`
            SELECT id, board_id, user_id
            FROM chat_messages
            WHERE id = ? AND user_id = ?
            LIMIT 1
        `),
        updateMessage: db.prepare(`
            UPDATE chat_messages
            SET content = @content, is_edited = 1, edited_at = @edited_at, updated_at = @updated_at
            WHERE id = @id AND user_id = @user_id
        `),
        deleteMessage: db.prepare(`
            UPDATE chat_messages
            SET is_deleted = 1, deleted_at = @deleted_at, updated_at = @updated_at
            WHERE id = @id AND user_id = @user_id
        `),
        listMessages: db.prepare(`
            SELECT
                messages.id,
                messages.board_id,
                messages.user_id,
                messages.content,
                messages.reply_to,
                messages.attachment_url,
                messages.attachment_type,
                messages.attachment_name,
                messages.is_edited,
                messages.is_deleted,
                messages.created_at,
                messages.edited_at,
                users.display_name AS username,
                reply.id AS reply_message_id,
                reply.content AS reply_content,
                reply_users.display_name AS reply_username
            FROM chat_messages AS messages
            JOIN users ON users.id = messages.user_id
            LEFT JOIN chat_messages AS reply ON reply.id = messages.reply_to
            LEFT JOIN users AS reply_users ON reply_users.id = reply.user_id
            WHERE messages.board_id = ? AND messages.is_deleted = 0
            ORDER BY messages.created_at ASC
            LIMIT ?
        `),
        listReactions: db.prepare(`
            SELECT
                message_reactions.id,
                message_reactions.message_id,
                message_reactions.user_id,
                message_reactions.emoji,
                message_reactions.created_at,
                users.display_name AS username
            FROM message_reactions
            JOIN users ON users.id = message_reactions.user_id
            WHERE message_reactions.message_id = ?
            ORDER BY message_reactions.created_at ASC
        `),
        addReaction: db.prepare(`
            INSERT INTO message_reactions (message_id, user_id, emoji, created_at)
            VALUES (@message_id, @user_id, @emoji, @created_at)
            ON CONFLICT(message_id, user_id, emoji) DO NOTHING
        `),
        removeReaction: db.prepare(`
            DELETE FROM message_reactions
            WHERE message_id = ? AND user_id = ? AND emoji = ?
        `),
        setPresence: db.prepare(`
            INSERT INTO chat_presence (user_id, board_id, status, updated_at)
            VALUES (@user_id, @board_id, @status, @updated_at)
            ON CONFLICT(user_id) DO UPDATE SET
                board_id = excluded.board_id,
                status = excluded.status,
                updated_at = excluded.updated_at
        `),
        listOnlineUsers: db.prepare(`
            SELECT
                chat_presence.user_id,
                chat_presence.board_id,
                chat_presence.status,
                chat_presence.updated_at,
                users.display_name AS username
            FROM chat_presence
            JOIN users ON users.id = chat_presence.user_id
            WHERE chat_presence.status = 'online'
              AND chat_presence.updated_at >= ?
              AND (? IS NULL OR chat_presence.board_id = ?)
            ORDER BY chat_presence.updated_at DESC
        `)
    };
}

module.exports = {
    createChatStatements
};
