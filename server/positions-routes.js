const { createPositionRouteHandlers } = require('./position-route-handlers');
const { createStopOrderRouteHandlers } = require('./stop-order-route-handlers');

function createPositionsRoutes(config) {
    return {
        ...createPositionRouteHandlers(config),
        ...createStopOrderRouteHandlers(config)
    };
}

module.exports = {
    createPositionsRoutes
};
