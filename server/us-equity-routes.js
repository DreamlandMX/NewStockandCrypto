const { getTextAfter, runRoute } = require('./route-helpers');

function createUsEquityRoutes(context) {
    return function routeUsEquityRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/us-equity/prices') {
            return runRoute(context, res, context.handleUsPrices(req, res, parsedUrl), 'US_PRICES_FAILED');
        }
        if (pathname === '/api/us-equity/indices/history') {
            return runRoute(context, res, context.handleUsIndicesHistory(req, res, parsedUrl), 'US_INDICES_HISTORY_FAILED');
        }
        if (pathname === '/api/us-equity/indices') {
            return runRoute(context, res, context.handleUsIndices(req, res), 'US_INDICES_FAILED');
        }
        if (pathname === '/api/us-equity/sp500/quotes') {
            return runRoute(context, res, context.handleUsSp500Quotes(req, res, parsedUrl), 'US_SP500_QUOTES_FAILED');
        }
        if (pathname === '/api/us-equity/top-movers') {
            return runRoute(context, res, context.handleUsTopMovers(req, res, parsedUrl), 'US_TOP_MOVERS_FAILED');
        }
        if (pathname.startsWith('/api/us-equity/prediction/')) {
            const indexSymbol = getTextAfter(pathname, '/api/us-equity/prediction/');
            return runRoute(context, res, context.handleUsIndexPrediction(req, res, indexSymbol), 'US_PREDICTION_FAILED');
        }
        if (pathname.startsWith('/api/us-equity/stock/')) {
            const symbol = getTextAfter(pathname, '/api/us-equity/stock/');
            return runRoute(context, res, context.handleUsStock(req, res, symbol), 'US_STOCK_FAILED');
        }
        if (pathname === '/api/us-equity/predictions') {
            return runRoute(context, res, context.handleUsPredictionsAlias(req, res, parsedUrl), 'US_PREDICTIONS_FAILED');
        }

        return false;
    };
}

module.exports = {
    createUsEquityRoutes
};
