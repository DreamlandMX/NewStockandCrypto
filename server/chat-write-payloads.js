const {
    normalizeBoardName,
    normalizeBoardTopic,
    normalizeMessageContent
} = require('./chat-input-normalizers');

function buildCreateBoardPayload(userId, payload = {}, timestamp) {
    return {
        name: normalizeBoardName(payload.name),
        topic: normalizeBoardTopic(payload.topic),
        is_public: payload.is_public === false ? 0 : 1,
        created_by_user_id: userId,
        created_at: timestamp,
        updated_at: timestamp
    };
}

function buildJoinBoardPayload(userId, boardId, role, timestamp) {
    return {
        board_id: Number(boardId),
        user_id: userId,
        role,
        joined_at: timestamp
    };
}

function buildMessagePayload(userId, boardId, payload = {}, timestamp) {
    const content = normalizeMessageContent(payload.content);
    if (!content && !payload.attachment_url) {
        throw new Error('Message content is required.');
    }

    return {
        board_id: Number(boardId),
        user_id: userId,
        content,
        reply_to: payload.reply_to ? Number(payload.reply_to) : null,
        attachment_url: payload.attachment_url || null,
        attachment_type: payload.attachment_type || null,
        attachment_name: payload.attachment_name || null,
        created_at: timestamp,
        updated_at: timestamp
    };
}

function buildEditMessagePayload(userId, messageId, content, timestamp) {
    const normalized = normalizeMessageContent(content);
    if (!normalized) {
        throw new Error('Message content is required.');
    }

    return {
        id: Number(messageId),
        user_id: userId,
        content: normalized,
        edited_at: timestamp,
        updated_at: timestamp
    };
}

function buildDeleteMessagePayload(userId, messageId, timestamp) {
    return {
        id: Number(messageId),
        user_id: userId,
        deleted_at: timestamp,
        updated_at: timestamp
    };
}

function buildReactionPayload(userId, messageId, emoji, timestamp) {
    return {
        message_id: Number(messageId),
        user_id: userId,
        emoji: String(emoji || '').trim() || 'Like',
        created_at: timestamp
    };
}

function buildPresencePayload(userId, status = 'online', boardId = null, timestamp) {
    return {
        user_id: userId,
        board_id: boardId ? Number(boardId) : null,
        status: String(status || 'online').trim() || 'online',
        updated_at: timestamp
    };
}

module.exports = {
    buildCreateBoardPayload,
    buildDeleteMessagePayload,
    buildEditMessagePayload,
    buildJoinBoardPayload,
    buildMessagePayload,
    buildPresencePayload,
    buildReactionPayload
};
