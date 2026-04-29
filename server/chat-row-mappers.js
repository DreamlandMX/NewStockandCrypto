function mapReactionRow(row) {
    return {
        id: row.id,
        message_id: row.message_id,
        user_id: row.user_id,
        emoji: row.emoji,
        created_at: row.created_at,
        user_profiles: {
            username: row.username || 'Community Member'
        }
    };
}

function mapMessageRow(row) {
    const reply = row.reply_message_id ? {
        id: row.reply_message_id,
        content: row.reply_content || '',
        users: {
            username: row.reply_username || 'Community Member'
        }
    } : null;

    return {
        id: row.id,
        board_id: row.board_id,
        user_id: row.user_id,
        content: row.content,
        reply_to: reply,
        attachment_url: row.attachment_url || null,
        attachment_type: row.attachment_type || null,
        attachment_name: row.attachment_name || null,
        is_edited: Boolean(row.is_edited),
        is_deleted: Boolean(row.is_deleted),
        created_at: row.created_at,
        edited_at: row.edited_at || null,
        users: {
            username: row.username || 'Community Member'
        }
    };
}

function mapBoardRow(row) {
    return {
        id: row.id,
        name: row.name,
        topic: row.topic,
        is_public: Boolean(row.is_public),
        created_at: row.created_at,
        members: Number(row.member_count || 0)
    };
}

function mapOnlineUserRow(row) {
    return {
        user_id: row.user_id,
        status: row.status,
        updated_at: row.updated_at,
        user_profiles: {
            username: row.username || 'Community Member'
        }
    };
}

module.exports = {
    mapBoardRow,
    mapMessageRow,
    mapOnlineUserRow,
    mapReactionRow
};
