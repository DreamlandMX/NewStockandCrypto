const { normalizePositionPayload } = require('./payload-normalizers');
const {
    sendMethodNotAllowed,
    sendNotFound
} = require('./route-response-helpers');
const { getPositionFilters } = require('./site-query-helpers');

const POSITION_NOT_FOUND = 'Position not found.';

function createPositionRouteHandlers(config) {
    const {
        positionsStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleSitePositionsCollectionRoute(req, res, parsedUrl) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const positions = positionsStore.listPositions(user.id, getPositionFilters(parsedUrl));
            sendJson(res, 200, { success: true, positions });
            return;
        }

        if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const position = positionsStore.createPosition(user.id, normalizePositionPayload(body));
            sendJson(res, 201, { success: true, position });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    async function handleSitePositionCloseRoute(req, res, positionId) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method !== 'POST') {
            sendMethodNotAllowed(sendJson, res);
            return;
        }

        const body = await readJsonBody(req);
        const result = positionsStore.closePosition(user.id, positionId, {
            price: body.price,
            quantity: body.quantity,
            reason: body.reason
        });

        if (!result) {
            sendNotFound(sendJson, res, POSITION_NOT_FOUND);
            return;
        }

        sendJson(res, 200, { success: true, ...result });
    }

    async function handleSitePositionHistoryRoute(req, res, positionId, parsedUrl) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method !== 'GET') {
            sendMethodNotAllowed(sendJson, res);
            return;
        }

        const history = positionsStore.listPositionHistory(user.id, positionId, parsedUrl.searchParams.get('limit'));
        if (!history) {
            sendNotFound(sendJson, res, POSITION_NOT_FOUND);
            return;
        }

        sendJson(res, 200, { success: true, history });
    }

    return {
        handleSitePositionCloseRoute,
        handleSitePositionHistoryRoute,
        handleSitePositionsCollectionRoute
    };
}

module.exports = {
    createPositionRouteHandlers
};
