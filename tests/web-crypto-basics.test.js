const test = require('node:test');
const assert = require('node:assert/strict');
const { createCryptoBasics } = require('../web/js/crypto-basics');

const basics = createCryptoBasics({
    formatCurrency: (value) => `$${Number(value).toFixed(2)}`
});

test('crypto basics normalize probabilities from percent or ratio input', () => {
    assert.equal(basics.normalizeProbability(62), 0.62);
    assert.equal(basics.normalizeProbability(0.62), 0.62);
    assert.equal(basics.normalizeProbability(-10), 0);
    assert.equal(basics.normalizeProbability(250), 1);
});

test('crypto basics resolve trade signal with confidence gate', () => {
    assert.equal(basics.resolveTradeSignal(0.6, 0.6), 'LONG');
    assert.equal(basics.resolveTradeSignal(0.4, 0.6), 'SHORT');
    assert.equal(basics.resolveTradeSignal(0.6, 0.2), 'FLAT');
});

test('crypto basics convert short symbols into canonical USDT symbols', () => {
    assert.equal(basics.toCanonicalSymbol('btc'), 'BTCUSDT');
    assert.equal(basics.toCanonicalSymbol('ETH/USDT'), 'ETHUSDT');
    assert.equal(basics.toDisplaySymbol('SOLUSDT'), 'SOL/USDT');
});

test('crypto basics format common market values for the page', () => {
    assert.equal(basics.formatSignedPercent(0.034), '+3.40%');
    assert.equal(basics.formatSignedPercent(3.4), '+3.40%');
    assert.equal(basics.formatRate(0.753), '75.3%');
    assert.equal(basics.formatLargeMoney(2500000), '$2.50M');
    assert.equal(basics.formatNullableCurrency(12.3), '$12.30');
    assert.equal(basics.formatNullableCurrency(Number.NaN), '--');
});
