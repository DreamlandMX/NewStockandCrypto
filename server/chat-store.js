const { openAppDatabase } = require('./sqlite-store-helpers');
const {
    clampLimit,
    nowIso
} = require('./store-helpers');
const {
    mapBoardRow,
    mapMessageRow,
    mapOnlineUserRow,
    mapReactionRow
} = require('./chat-row-mappers');
const { createChatTables } = require('./chat-schema');
const { seedDefaultChatBoards } = require('./chat-seed-boards');
const { createChatStatements } = require('./chat-statements');
const {
    buildCreateBoardPayload,
    buildDeleteMessagePayload,
    buildEditMessagePayload,
    buildJoinBoardPayload,
    buildMessagePayload,
    buildPresencePayload,
    buildReactionPayload
} = require('./chat-write-payloads');

function createChatStore(options = {}) {
    const { db, dbPath } = openAppDatabase(options);
    createChatTables(db);
    seedDefaultChatBoards(db);
    const statements = createChatStatements(db);

    function ensureBoardExists(boardId) {
        return statements.getBoard.get(Number(boardId));
    }

    function listBoards() {
        return statements.listBoards.all().map(mapBoardRow);
    }

    function createBoard(userId, payload = {}) {
        const timestamp = nowIso();
        const result = statements.createBoard.run(buildCreateBoardPayload(userId, payload, timestamp));

        statements.joinBoard.run(buildJoinBoardPayload(userId, result.lastInsertRowid, 'owner', timestamp));

        return mapBoardRow({
            ...ensureBoardExists(result.lastInsertRowid),
            member_count: 1
        });
    }

    function joinBoard(userId, boardId) {
        const board = ensureBoardExists(boardId);
        if (!board) {
            return null;
        }

        statements.joinBoard.run(buildJoinBoardPayload(userId, board.id, 'member', nowIso()));
        return mapBoardRow({
            ...board,
            member_count: 0
        });
    }

    function listMessages(boardId, limit = 100) {
        return statements.listMessages
            .all(Number(boardId), clampLimit(limit, 100, 300))
            .map(mapMessageRow);
    }

    function sendMessage(userId, boardId, payload = {}) {
        const board = ensureBoardExists(boardId);
        if (!board) {
            return null;
        }

        const timestamp = nowIso();
        statements.joinBoard.run(buildJoinBoardPayload(userId, board.id, 'member', timestamp));
        const result = statements.insertMessage.run(buildMessagePayload(userId, board.id, payload, timestamp));

        return listMessages(board.id, 300).find((message) => message.id === result.lastInsertRowid) || null;
    }

    function editMessage(userId, messageId, content) {
        const owned = statements.getMessageForOwner.get(Number(messageId), userId);
        if (!owned) {
            return null;
        }

        const timestamp = nowIso();
        statements.updateMessage.run(buildEditMessagePayload(userId, owned.id, content, timestamp));
        return listMessages(owned.board_id, 300).find((message) => message.id === owned.id) || null;
    }

    function deleteMessage(userId, messageId) {
        const owned = statements.getMessageForOwner.get(Number(messageId), userId);
        if (!owned) {
            return false;
        }

        const timestamp = nowIso();
        return statements.deleteMessage.run(buildDeleteMessagePayload(userId, owned.id, timestamp)).changes > 0;
    }

    function listReactions(messageId) {
        return statements.listReactions.all(Number(messageId)).map(mapReactionRow);
    }

    function addReaction(userId, messageId, emoji) {
        statements.addReaction.run(buildReactionPayload(userId, messageId, emoji, nowIso()));
        return listReactions(messageId);
    }

    function removeReaction(userId, messageId, emoji) {
        statements.removeReaction.run(Number(messageId), userId, String(emoji || '').trim());
        return listReactions(messageId);
    }

    function updatePresence(userId, status = 'online', boardId = null) {
        statements.setPresence.run(buildPresencePayload(userId, status, boardId, nowIso()));
    }

    function listOnlineUsers(boardId = null) {
        const cutoff = new Date(Date.now() - (2 * 60 * 1000)).toISOString();
        return statements.listOnlineUsers
            .all(cutoff, boardId ? Number(boardId) : null, boardId ? Number(boardId) : null)
            .map(mapOnlineUserRow);
    }

    return {
        dbPath,
        listBoards,
        createBoard,
        joinBoard,
        listMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        listReactions,
        addReaction,
        removeReaction,
        updatePresence,
        listOnlineUsers
    };
}

module.exports = {
    createChatStore
};
