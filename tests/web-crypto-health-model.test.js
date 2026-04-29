const test = require('node:test');
const assert = require('node:assert/strict');
const { createCryptoHealthModel } = require('../web/js/crypto-health-model');

const healthModel = createCryptoHealthModel();

test('crypto health model estimates performance from a prediction packet', () => {
    const performance = healthModel.deriveEstimatedPerformanceFromPrediction({
        direction: { pUp: 0.6, confidence: 0.75 },
        magnitude: { expectedReturn: 0.02, intervalWidth: 0.05 }
    });

    assert.equal(performance.estimated, true);
    assert.ok(performance.directionAccuracy > 0.6);
    assert.ok(performance.intervalCoverage > 0.8);
    assert.ok(performance.sharpeRatio > 0);
});

test('crypto health model returns unavailable health without a prediction packet', () => {
    const health = healthModel.deriveHealthFromPrediction(null, null, 'Unavailable');

    assert.deepEqual(health, {
        status: 'Unavailable',
        driftAlerts: 0,
        sharpeRatio: 0,
        sharpeStability: 0,
        dataFreshness: 'unavailable',
        lastTraining: 'N/A'
    });
});

test('crypto health model converts confidence and sharpe into status labels', () => {
    const health = healthModel.deriveHealthFromPrediction(
        {
            direction: { confidence: 0.8 },
            magnitude: { expectedReturn: 0.02, intervalWidth: 0.04 }
        },
        null,
        'Live'
    );

    assert.equal(health.status, 'MONITORED');
    assert.equal(health.driftAlerts, 0);
    assert.equal(health.dataFreshness, 'live');
    assert.deepEqual(healthModel.computeRegimeFromSharpe(-0.1), {
        label: 'Defensive',
        className: 'defensive'
    });
});
