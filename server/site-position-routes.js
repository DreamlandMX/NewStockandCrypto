const { getNumberAfter, runRoute } = require('./route-helpers');

function createSitePositionRoutes(context) {
    return function routePositionRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/site-positions') {
            return runRoute(context, res, context.handleSitePositionsCollectionRoute(req, res, parsedUrl), 'SITE_POSITIONS_FAILED');
        }
        if (/^\/api\/site-positions\/\d+\/close$/.test(pathname)) {
            const positionId = getNumberAfter(pathname, '/api/site-positions/');
            return runRoute(context, res, context.handleSitePositionCloseRoute(req, res, positionId), 'SITE_POSITION_CLOSE_FAILED');
        }
        if (/^\/api\/site-positions\/\d+\/history$/.test(pathname)) {
            const positionId = getNumberAfter(pathname, '/api/site-positions/');
            return runRoute(context, res, context.handleSitePositionHistoryRoute(req, res, positionId, parsedUrl), 'SITE_POSITION_HISTORY_FAILED');
        }
        if (pathname === '/api/site-stop-orders') {
            return runRoute(context, res, context.handleSiteStopOrdersCollectionRoute(req, res, parsedUrl), 'SITE_STOP_ORDERS_FAILED');
        }
        if (/^\/api\/site-stop-orders\/\d+\/cancel$/.test(pathname)) {
            const stopOrderId = getNumberAfter(pathname, '/api/site-stop-orders/');
            return runRoute(context, res, context.handleSiteStopOrderCancelRoute(req, res, stopOrderId), 'SITE_STOP_ORDER_CANCEL_FAILED');
        }

        return false;
    };
}

module.exports = {
    createSitePositionRoutes
};
