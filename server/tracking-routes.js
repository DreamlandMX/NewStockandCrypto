const { runRoute } = require('./route-helpers');

function createTrackingRoutes(context) {
    return function routeTrackingRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/tracking/summary') {
            return runRoute(context, res, context.handleTrackingSummary(req, res), 'TRACKING_SUMMARY_FAILED');
        }
        if (pathname === '/api/tracking/universe') {
            return runRoute(context, res, context.handleTrackingUniverse(req, res, parsedUrl), 'TRACKING_UNIVERSE_FAILED');
        }
        if (pathname === '/api/tracking/factors') {
            return runRoute(context, res, context.handleTrackingFactors(req, res, parsedUrl), 'TRACKING_FACTORS_FAILED');
        }
        if (pathname === '/api/tracking/coverage') {
            return runRoute(context, res, context.handleTrackingCoverage(req, res), 'TRACKING_COVERAGE_FAILED');
        }
        if (pathname === '/api/tracking/actions') {
            return runRoute(context, res, context.handleTrackingActions(req, res, parsedUrl), 'TRACKING_ACTIONS_FAILED');
        }
        if (pathname === '/api/tracking/simulate') {
            return runRoute(context, res, context.handleTrackingSimulate(req, res), 'TRACKING_SIMULATE_FAILED');
        }

        return false;
    };
}

module.exports = {
    createTrackingRoutes
};
