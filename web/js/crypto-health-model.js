(function initCryptoHealthModel(root) {
    'use strict';

    function createCryptoHealthModel() {
        function deriveEstimatedPerformanceFromPrediction(packet) {
            if (!packet) return null;

            const pUp = packet.direction.pUp;
            const confidence = packet.direction.confidence;
            const spread = Math.max(packet.magnitude.intervalWidth, 0.0001);
            const directionAccuracy = clamp(0.52 + Math.abs(pUp - 0.5) * 0.28 + confidence * 0.16, 0.45, 0.9);
            const intervalCoverage = clamp(0.72 + confidence * 0.16, 0.6, 0.94);
            const brierScore = clamp(0.33 - Math.abs(pUp - 0.5) * 0.20 + (1 - confidence) * 0.06, 0.12, 0.42);
            const winRate = clamp(0.5 + (pUp - 0.5) * 0.6, 0.05, 0.95);
            const sharpeRatio = clamp(packet.magnitude.expectedReturn / spread * 0.65, -3, 3);

            return {
                directionAccuracy,
                intervalCoverage,
                sharpeRatio,
                winRate,
                brierScore,
                estimated: true
            };
        }

        function deriveHealthFromPrediction(packet, performance, dataMode) {
            if (!packet) {
                return {
                    status: 'Unavailable',
                    driftAlerts: 0,
                    sharpeRatio: 0,
                    sharpeStability: 0,
                    dataFreshness: dataMode === 'Unavailable' ? 'unavailable' : 'unknown',
                    lastTraining: 'N/A'
                };
            }

            const spread = Math.max(packet.magnitude.intervalWidth, 0);
            const confidence = packet.direction.confidence;
            const fallbackSharpe = clamp(packet.magnitude.expectedReturn / Math.max(spread, 0.0001) * 0.65, -3, 3);
            const sharpeRatio = Number((performance?.sharpeRatio ?? fallbackSharpe).toFixed(3));
            const driftAlerts = Math.max(0, Math.round((0.65 - confidence) * 40));
            const status = dataMode === 'Unavailable'
                ? 'Unavailable'
                : driftAlerts > 10
                    ? 'IN REVIEW'
                    : 'MONITORED';

            return {
                status,
                driftAlerts,
                sharpeRatio,
                sharpeStability: Number((spread * 100).toFixed(3)),
                dataFreshness: dataMode === 'Stale Feed' ? 'stale cache' : 'live',
                lastTraining: 'N/A (live derived)'
            };
        }

        function computeRegimeFromSharpe(sharpeRatio) {
            if (asNumber(sharpeRatio, 0) < 0) {
                return { label: 'Defensive', className: 'defensive' };
            }
            return { label: 'Balanced', className: 'balanced' };
        }

        return {
            computeRegimeFromSharpe,
            deriveEstimatedPerformanceFromPrediction,
            deriveHealthFromPrediction
        };
    }

    function asNumber(value, fallback = NaN) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    const api = {
        createCryptoHealthModel
    };

    root.StockCryptoHealthModel = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
