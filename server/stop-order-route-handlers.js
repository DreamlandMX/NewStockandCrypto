const { normalizeStopOrderPayload } = require('./payload-normalizers');
const {
    sendMethodNotAllowed,
    sendNotFound
} = require('./route-response-helpers');
const { getStopOrderFilters } = require('./site-query-helpers');

const STOP_ORDER_NOT_FOUND = 'Stop order not found.';

function createStopOrderRouteHandlers(config) {
    const {
        positionsStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleSiteStopOrdersCollectionRoute(req, res, parsedUrl) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const orders = positionsStore.listStopOrders(user.id, getStopOrderFilters(parsedUrl));
            sendJson(res, 200, { success: true, orders });
            return;
        }

        if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const order = positionsStore.createStopOrder(user.id, normalizeStopOrderPayload(body));
            sendJson(res, 201, { success: true, order });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    async function handleSiteStopOrderCancelRoute(req, res, stopOrderId) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method !== 'POST') {
            sendMethodNotAllowed(sendJson, res);
            return;
        }

        const cancelled = positionsStore.cancelStopOrder(user.id, stopOrderId);
        if (!cancelled) {
            sendNotFound(sendJson, res, STOP_ORDER_NOT_FOUND);
            return;
        }

        sendJson(res, 200, { success: true });
    }

    return {
        handleSiteStopOrderCancelRoute,
        handleSiteStopOrdersCollectionRoute
    };
}

module.exports = {
    createStopOrderRouteHandlers
};
