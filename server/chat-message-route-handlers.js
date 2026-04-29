const {
    isEditMethod,
    sendMethodNotAllowed,
    sendNotFound
} = require('./route-response-helpers');

const MESSAGE_NOT_FOUND = 'Message not found.';

function createChatMessageRouteHandlers(config) {
    const {
        chatStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleChatMessageItemRoute(req, res, messageId) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (isEditMethod(req)) {
            const body = await readJsonBody(req);
            const message = chatStore.editMessage(user.id, messageId, body.content);
            if (!message) {
                sendNotFound(sendJson, res, MESSAGE_NOT_FOUND);
                return;
            }
            sendJson(res, 200, { success: true, message });
            return;
        }

        if (req.method === 'DELETE') {
            const deleted = chatStore.deleteMessage(user.id, messageId);
            if (!deleted) {
                sendNotFound(sendJson, res, MESSAGE_NOT_FOUND);
                return;
            }
            sendJson(res, 200, { success: true });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    async function handleChatMessageReactionsRoute(req, res, messageId, parsedUrl) {
        if (req.method === 'GET') {
            sendJson(res, 200, {
                success: true,
                reactions: chatStore.listReactions(messageId)
            });
            return;
        }

        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const reactions = chatStore.addReaction(user.id, messageId, body.emoji);
            sendJson(res, 200, { success: true, reactions });
            return;
        }

        if (req.method === 'DELETE') {
            const emoji = parsedUrl.searchParams.get('emoji');
            const reactions = chatStore.removeReaction(user.id, messageId, emoji);
            sendJson(res, 200, { success: true, reactions });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    return {
        handleChatMessageItemRoute,
        handleChatMessageReactionsRoute
    };
}

module.exports = {
    createChatMessageRouteHandlers
};
