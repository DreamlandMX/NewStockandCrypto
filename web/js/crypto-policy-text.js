(function initCryptoPolicyText(root) {
    'use strict';

    function createCryptoPolicyText(options = {}) {
        const gateText = options.gateText || {};

        function formatPolicyPercent(value) {
            const numeric = asNumber(value, NaN);
            if (!Number.isFinite(numeric)) return '--';
            return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
        }

        function formatPolicyQuality(policyPacket) {
            if (!policyPacket || !Number.isFinite(policyPacket.tradeQualityScore)) return '--';
            const band = policyPacket.tradeQualityBand ? ` (${policyPacket.tradeQualityBand})` : '';
            return `${policyPacket.tradeQualityScore.toFixed(1)}${band}`;
        }

        function formatPolicyGateList(gates) {
            if (!Array.isArray(gates) || !gates.length) return 'None';
            return gates.map(getGateLabel).join(', ');
        }

        function formatPolicyBlockingList(policyPacket) {
            const blocking = buildPolicyBlockingList(policyPacket);
            return blocking.length ? blocking.map(getGateLabel).join(', ') : 'None';
        }

        function buildPolicyBlockingList(policyPacket) {
            if (!policyPacket) return ['net_edge'];

            const gates = Array.isArray(policyPacket.gates) ? policyPacket.gates : [];
            const blocking = [];
            if (!gates.includes('cost_ok') || asNumber(policyPacket.expectedNetEdgePct, 0) <= 0) {
                blocking.push('net_edge');
            }
            if (!gates.includes('confidence_ok')) blocking.push('confidence_ok');
            if (!gates.includes('regime_ok')) blocking.push('regime_ok');
            if (!gates.includes('liquidity_ok')) blocking.push('liquidity_ok');

            const action = String(policyPacket.action || '').toUpperCase();
            if (
                (action === 'WAIT' || action === 'FLAT')
                && asNumber(policyPacket.expectedNetEdgePct, 0) > 0
                && blocking.length === 0
            ) {
                blocking.push('policy_threshold');
            }
            return blocking;
        }

        function buildPolicyReasonSummary(policyPacket) {
            const reasons = Array.isArray(policyPacket?.reasons) ? policyPacket.reasons.filter(Boolean) : [];
            return reasons.length ? reasons.join(' ') : 'Policy Engine is waiting for cleaner execution conditions.';
        }

        function buildPolicyStandbyNote(policyPacket) {
            const reason = buildPolicyReasonSummary(policyPacket);
            const blocking = formatPolicyBlockingList(policyPacket);
            return `${reason} Blocking: ${blocking}.`;
        }

        function getGateLabel(gate) {
            return gateText[gate] || gate;
        }

        return {
            buildPolicyBlockingList,
            buildPolicyReasonSummary,
            buildPolicyStandbyNote,
            formatPolicyBlockingList,
            formatPolicyGateList,
            formatPolicyPercent,
            formatPolicyQuality
        };
    }

    function asNumber(value, fallback = NaN) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    const api = {
        createCryptoPolicyText
    };

    root.StockCryptoPolicyText = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
