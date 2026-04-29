const { getNumberAfter, runRoute } = require('./route-helpers');

function createSiteChatRoutes(context) {
    return function routeChatRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/chat/boards') {
            return runRoute(context, res, context.handleChatBoardsRoute(req, res), 'CHAT_BOARDS_FAILED');
        }
        if (/^\/api\/chat\/boards\/\d+\/join$/.test(pathname)) {
            const boardId = getNumberAfter(pathname, '/api/chat/boards/');
            return runRoute(context, res, context.handleChatBoardJoinRoute(req, res, boardId), 'CHAT_JOIN_FAILED');
        }
        if (/^\/api\/chat\/boards\/\d+\/messages$/.test(pathname)) {
            const boardId = getNumberAfter(pathname, '/api/chat/boards/');
            return runRoute(context, res, context.handleChatBoardMessagesRoute(req, res, boardId, parsedUrl), 'CHAT_MESSAGES_FAILED');
        }
        if (/^\/api\/chat\/messages\/\d+\/reactions$/.test(pathname)) {
            const messageId = getNumberAfter(pathname, '/api/chat/messages/');
            return runRoute(context, res, context.handleChatMessageReactionsRoute(req, res, messageId, parsedUrl), 'CHAT_REACTIONS_FAILED');
        }
        if (/^\/api\/chat\/messages\/\d+$/.test(pathname)) {
            const messageId = getNumberAfter(pathname, '/api/chat/messages/');
            return runRoute(context, res, context.handleChatMessageItemRoute(req, res, messageId), 'CHAT_MESSAGE_ITEM_FAILED');
        }
        if (pathname === '/api/chat/presence') {
            return runRoute(context, res, context.handleChatPresenceRoute(req, res, parsedUrl), 'CHAT_PRESENCE_FAILED');
        }

        return false;
    };
}

module.exports = {
    createSiteChatRoutes
};
