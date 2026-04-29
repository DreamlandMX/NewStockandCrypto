const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketRouteBundle } = require('../server/market-route-bundle');

function handler(name, calls) {
    return (...args) => {
        calls.push({ name, args });
        return `${name}-promise`;
    };
}

function createBundle() {
    const calls = [];
    const routeMarketRequest = createMarketRouteBundle({
        handleAsyncRoute(res, promise, errorCode) {
            calls.push({ res, promise, errorCode });
        },
        crypto: {
            prices: handler('crypto.prices', calls),
            universe: handler('crypto.universe', calls),
            history: handler('crypto.history', calls),
            prediction: handler('crypto.prediction', calls),
            performance: handler('crypto.performance', calls),
            sessionForecast: handler('crypto.sessionForecast', calls)
        },
        cn: {
            live: handler('cn.live', calls),
            prices: handler('cn.prices', calls),
            indicesHistory: handler('cn.indicesHistory', calls),
            quotes: handler('cn.quotes', calls),
            ranking: handler('cn.ranking', calls),
            indexPrediction: handler('cn.indexPrediction', calls),
            stock: handler('cn.stock', calls),
            predictionsAlias: handler('cn.predictionsAlias', calls)
        },
        us: {
            prices: handler('us.prices', calls),
            indicesHistory: handler('us.indicesHistory', calls),
            indices: handler('us.indices', calls),
            sp500Quotes: handler('us.sp500Quotes', calls),
            topMovers: handler('us.topMovers', calls),
            indexPrediction: handler('us.indexPrediction', calls),
            stock: handler('us.stock', calls),
            predictionsAlias: handler('us.predictionsAlias', calls)
        },
        tracking: {
            summary: handler('tracking.summary', calls),
            universe: handler('tracking.universe', calls),
            factors: handler('tracking.factors', calls),
            coverage: handler('tracking.coverage', calls),
            actions: handler('tracking.actions', calls),
            simulate: handler('tracking.simulate', calls)
        },
        home: {
            landing: handler('home.landing', calls)
        }
    });

    return { calls, routeMarketRequest };
}

test('market route bundle dispatches grouped crypto handlers', () => {
    const { calls, routeMarketRequest } = createBundle();
    const matched = routeMarketRequest({}, {}, new URL('http://local/api/crypto/prices'));

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'crypto.prices');
    assert.equal(calls[1].errorCode, 'CRYPTO_PRICES_FAILED');
});

test('market route bundle dispatches grouped tracking handlers', () => {
    const { calls, routeMarketRequest } = createBundle();
    const matched = routeMarketRequest({}, {}, new URL('http://local/api/tracking/actions'));

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'tracking.actions');
    assert.equal(calls[1].errorCode, 'TRACKING_ACTIONS_FAILED');
});
