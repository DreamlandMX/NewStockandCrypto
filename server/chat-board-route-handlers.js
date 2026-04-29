const { normalizeChatBoardPayload, normalizeChatMessagePayload } = require('./payload-normalizers');
const {
    sendMethodNotAllowed,
    sendNotFound
} = require('./route-response-helpers');

const BOARD_NOT_FOUND = 'Board not found.';

function createChatBoardRouteHandlers(config) {
    const {
        chatStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleChatBoardsRoute(req, res) {
        if (req.method === 'GET') {
            sendJson(res, 200, {
                success: true,
                boards: chatStore.listBoards()
            });
            return;
        }

        if (req.method === 'POST') {
            const user = requireAuthenticatedSiteUser(req, res);
            if (!user) return;

            const body = await readJsonBody(req);
            const board = chatStore.createBoard(user.id, normalizeChatBoardPayload(body));
            sendJson(res, 201, { success: true, board });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    async function handleChatBoardJoinRoute(req, res, boardId) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method !== 'POST') {
            sendMethodNotAllowed(sendJson, res);
            return;
        }

        const board = chatStore.joinBoard(user.id, boardId);
        if (!board) {
            sendNotFound(sendJson, res, BOARD_NOT_FOUND);
            return;
        }

        chatStore.updatePresence(user.id, 'online', boardId);
        sendJson(res, 200, { success: true, board });
    }

    async function handleChatBoardMessagesRoute(req, res, boardId, parsedUrl) {
        if (req.method === 'GET') {
            sendJson(res, 200, {
                success: true,
                messages: chatStore.listMessages(boardId, parsedUrl.searchParams.get('limit'))
            });
            return;
        }

        if (req.method === 'POST') {
            const user = requireAuthenticatedSiteUser(req, res);
            if (!user) return;

            const body = await readJsonBody(req);
            const message = chatStore.sendMessage(user.id, boardId, normalizeChatMessagePayload(body));
            if (!message) {
                sendNotFound(sendJson, res, BOARD_NOT_FOUND);
                return;
            }

            chatStore.updatePresence(user.id, 'online', boardId);
            sendJson(res, 201, { success: true, message });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    return {
        handleChatBoardJoinRoute,
        handleChatBoardMessagesRoute,
        handleChatBoardsRoute
    };
}

module.exports = {
    createChatBoardRouteHandlers
};
