const { getTextAfter, runRoute } = require('./route-helpers');

function createCnEquityRoutes(context) {
    return function routeCnEquityRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/cn-equity/live') {
            return runRoute(context, res, context.handleCnLive(req, res), 'CN_LIVE_FAILED');
        }
        if (pathname === '/api/cn-equity/prices') {
            return runRoute(context, res, context.handleCnPrices(req, res, parsedUrl), 'CN_PRICES_FAILED');
        }
        if (pathname === '/api/cn-equity/indices/history') {
            return runRoute(context, res, context.handleCnIndicesHistory(req, res, parsedUrl), 'CN_INDICES_HISTORY_FAILED');
        }
        if (pathname === '/api/cn-equity/csi300/quotes') {
            return runRoute(context, res, context.handleCnQuotes(req, res, parsedUrl), 'CN_QUOTES_FAILED');
        }
        if (pathname === '/api/cn-equity/csi300/ranking') {
            return runRoute(context, res, context.handleCnRanking(req, res, parsedUrl), 'CN_RANKING_FAILED');
        }
        if (pathname.startsWith('/api/cn-equity/prediction/')) {
            const indexSymbol = getTextAfter(pathname, '/api/cn-equity/prediction/');
            return runRoute(context, res, context.handleCnIndexPrediction(req, res, indexSymbol), 'CN_PREDICTION_FAILED');
        }
        if (pathname.startsWith('/api/cn-equity/stock/')) {
            const stockCode = getTextAfter(pathname, '/api/cn-equity/stock/');
            return runRoute(context, res, context.handleCnStock(req, res, stockCode), 'CN_STOCK_FAILED');
        }
        if (pathname === '/api/cn-equity/predictions') {
            return runRoute(context, res, context.handleCnPredictionsAlias(req, res, parsedUrl), 'CN_PREDICTIONS_FAILED');
        }

        return false;
    };
}

module.exports = {
    createCnEquityRoutes
};
