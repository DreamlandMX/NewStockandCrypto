const { sendMethodNotAllowed } = require('./route-response-helpers');

function createChatPresenceRouteHandlers(config) {
    const {
        chatStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleChatPresenceRoute(req, res, parsedUrl) {
        if (req.method === 'GET') {
            const boardId = parsedUrl.searchParams.get('boardId');
            sendJson(res, 200, {
                success: true,
                users: chatStore.listOnlineUsers(boardId)
            });
            return;
        }

        if (req.method === 'POST') {
            const user = requireAuthenticatedSiteUser(req, res);
            if (!user) return;

            const body = await readJsonBody(req);
            chatStore.updatePresence(user.id, body.status, body.boardId ?? body.board_id ?? null);
            sendJson(res, 200, { success: true });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    return {
        handleChatPresenceRoute
    };
}

module.exports = {
    createChatPresenceRouteHandlers
};
