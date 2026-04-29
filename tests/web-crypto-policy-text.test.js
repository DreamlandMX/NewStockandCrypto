const test = require('node:test');
const assert = require('node:assert/strict');
const { createCryptoPolicyText } = require('../web/js/crypto-policy-text');

const policyText = createCryptoPolicyText({
    gateText: {
        confidence_ok: 'Confidence',
        cost_ok: 'Cost',
        liquidity_ok: 'Liquidity',
        net_edge: 'Net Edge',
        policy_threshold: 'Edge Threshold',
        regime_ok: 'Regime'
    }
});

test('crypto policy text formats policy numbers and quality scores', () => {
    assert.equal(policyText.formatPolicyPercent(1.25), '+1.25%');
    assert.equal(policyText.formatPolicyPercent(-0.4), '-0.40%');
    assert.equal(policyText.formatPolicyPercent('bad'), '--');
    assert.equal(policyText.formatPolicyQuality({ tradeQualityScore: 72.4, tradeQualityBand: 'A' }), '72.4 (A)');
});

test('crypto policy text explains passed and blocking gates', () => {
    const policyPacket = {
        action: 'WAIT',
        expectedNetEdgePct: 0.5,
        gates: ['cost_ok', 'confidence_ok', 'regime_ok']
    };

    assert.equal(policyText.formatPolicyGateList(policyPacket.gates), 'Cost, Confidence, Regime');
    assert.equal(policyText.formatPolicyBlockingList(policyPacket), 'Liquidity');
});

test('crypto policy text builds a standby note from reasons and blockers', () => {
    const note = policyText.buildPolicyStandbyNote({
        expectedNetEdgePct: -0.1,
        gates: ['confidence_ok'],
        reasons: ['Edge is too thin.']
    });

    assert.equal(note, 'Edge is too thin. Blocking: Net Edge, Regime, Liquidity.');
});
