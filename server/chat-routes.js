const { createChatBoardRouteHandlers } = require('./chat-board-route-handlers');
const { createChatMessageRouteHandlers } = require('./chat-message-route-handlers');
const { createChatPresenceRouteHandlers } = require('./chat-presence-route-handlers');

function createChatRoutes(config) {
    return {
        ...createChatBoardRouteHandlers(config),
        ...createChatMessageRouteHandlers(config),
        ...createChatPresenceRouteHandlers(config)
    };
}

module.exports = {
    createChatRoutes
};
