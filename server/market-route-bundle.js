const { createMarketRoutes } = require('./market-routes');

function createMarketRouteBundle(config) {
    return createMarketRoutes({
        handleAsyncRoute: config.handleAsyncRoute,
        handleCryptoPrices: config.crypto.prices,
        handleCryptoUniverse: config.crypto.universe,
        handleCryptoHistory: config.crypto.history,
        handleCryptoPrediction: config.crypto.prediction,
        handleCryptoPerformance: config.crypto.performance,
        handleCryptoSessionForecast: config.crypto.sessionForecast,
        handleCnLive: config.cn.live,
        handleCnPrices: config.cn.prices,
        handleCnIndicesHistory: config.cn.indicesHistory,
        handleCnQuotes: config.cn.quotes,
        handleCnRanking: config.cn.ranking,
        handleCnIndexPrediction: config.cn.indexPrediction,
        handleCnStock: config.cn.stock,
        handleCnPredictionsAlias: config.cn.predictionsAlias,
        handleUsPrices: config.us.prices,
        handleUsIndicesHistory: config.us.indicesHistory,
        handleUsIndices: config.us.indices,
        handleUsSp500Quotes: config.us.sp500Quotes,
        handleUsTopMovers: config.us.topMovers,
        handleUsIndexPrediction: config.us.indexPrediction,
        handleUsStock: config.us.stock,
        handleUsPredictionsAlias: config.us.predictionsAlias,
        handleTrackingSummary: config.tracking.summary,
        handleTrackingUniverse: config.tracking.universe,
        handleTrackingFactors: config.tracking.factors,
        handleTrackingCoverage: config.tracking.coverage,
        handleTrackingActions: config.tracking.actions,
        handleTrackingSimulate: config.tracking.simulate,
        handleHomeLanding: config.home.landing
    });
}

module.exports = {
    createMarketRouteBundle
};
