const { getTextAfter, runRoute } = require('./route-helpers');

function createCryptoRoutes(context) {
    return function routeCryptoRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/crypto/prices') {
            return runRoute(context, res, context.handleCryptoPrices(req, res), 'CRYPTO_PRICES_FAILED');
        }
        if (pathname === '/api/crypto/universe') {
            return runRoute(context, res, context.handleCryptoUniverse(req, res), 'CRYPTO_UNIVERSE_FAILED');
        }
        if (pathname.startsWith('/api/crypto/history/')) {
            const symbol = getTextAfter(pathname, '/api/crypto/history/');
            return runRoute(context, res, context.handleCryptoHistory(req, res, parsedUrl, symbol), 'CRYPTO_HISTORY_FAILED');
        }
        if (pathname.startsWith('/api/crypto/prediction/')) {
            const symbol = getTextAfter(pathname, '/api/crypto/prediction/');
            return runRoute(context, res, context.handleCryptoPrediction(req, res, symbol), 'CRYPTO_PREDICTION_FAILED');
        }
        if (pathname.startsWith('/api/crypto/performance/')) {
            const symbol = getTextAfter(pathname, '/api/crypto/performance/');
            return runRoute(context, res, context.handleCryptoPerformance(req, res, symbol), 'CRYPTO_PERFORMANCE_FAILED');
        }
        if (pathname === '/api/session/crypto') {
            return runRoute(context, res, context.handleCryptoSessionForecast(req, res, parsedUrl), 'CRYPTO_SESSION_FAILED');
        }

        return false;
    };
}

module.exports = {
    createCryptoRoutes
};
