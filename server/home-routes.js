const { runRoute } = require('./route-helpers');

function createHomeRoutes(context) {
    return function routeHomeRequest(req, res, parsedUrl) {
        if (parsedUrl.pathname === '/api/home/landing') {
            return runRoute(context, res, context.handleHomeLanding(req, res), 'HOME_LANDING_FAILED');
        }

        return false;
    };
}

module.exports = {
    createHomeRoutes
};
