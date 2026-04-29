const test = require('node:test');
const assert = require('node:assert/strict');
const {
    calculateUsPolicy,
    calculateUsPrediction,
    calculateUsTpSl
} = require('../server/us-trading-rules');

test('US trading rules calculate a prediction from one quote', () => {
    const prediction = calculateUsPrediction({
        price: 104,
        open: 100,
        high: 105,
        low: 99,
        changePct: 4
    });

    assert.equal(prediction.pUp, 0.852);
    assert.equal(prediction.pDown, 0.148);
    assert.equal(prediction.confidence, 0.861);
    assert.equal(prediction.signal, 'FLAT');
    assert.equal(prediction.q50, 0.0363);
    assert.equal(prediction.window.mostLikely, 'W1');
});

test('US trading rules turn a strong prediction into a policy', () => {
    const policy = calculateUsPolicy({
        pUp: 0.7,
        confidence: 0.96,
        q10: -0.02,
        q50: 0.03
    });

    assert.deepEqual(policy, {
        signal: 'STRONG LONG',
        action: 'Buy (aggressive)',
        positionSize: 0.48,
        shortAllowed: true,
        leverage: 2
    });
});

test('US trading rules calculate long stop loss and take profits', () => {
    const tpSl = calculateUsTpSl(100, {
        q10: -0.02,
        q50: 0.03,
        q90: 0.06
    }, 'LONG');

    assert.deepEqual(tpSl, {
        entryPrice: 100,
        stopLoss: 98.2,
        stopLossPct: -0.018,
        takeProfit1: 102.4,
        takeProfit1Pct: 0.024,
        takeProfit2: 104.2,
        takeProfit2Pct: 0.042
    });
});
