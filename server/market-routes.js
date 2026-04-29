const { createCryptoRoutes } = require('./crypto-routes');
const { createCnEquityRoutes } = require('./cn-equity-routes');
const { createHomeRoutes } = require('./home-routes');
const { createTrackingRoutes } = require('./tracking-routes');
const { createUsEquityRoutes } = require('./us-equity-routes');

function createMarketRoutes(context) {
    const routeCryptoRequest = createCryptoRoutes(context);
    const routeCnEquityRequest = createCnEquityRoutes(context);
    const routeTrackingRequest = createTrackingRoutes(context);
    const routeUsEquityRequest = createUsEquityRoutes(context);
    const routeHomeRequest = createHomeRoutes(context);

    return function routeMarketRequest(req, res, parsedUrl) {
        if (routeCryptoRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeCnEquityRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeUsEquityRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeTrackingRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeHomeRequest(req, res, parsedUrl)) {
            return true;
        }

        return false;
    };
}

module.exports = {
    createMarketRoutes
};
