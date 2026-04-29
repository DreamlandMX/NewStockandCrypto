(function initCryptoBasics(root) {
    'use strict';

    function createCryptoBasics(options = {}) {
        const longSignalThreshold = options.longSignalThreshold ?? 0.55;
        const shortSignalThreshold = options.shortSignalThreshold ?? 0.45;
        const minActionableConfidence = options.minActionableConfidence ?? 0.45;
        const formatCurrency = options.formatCurrency || defaultCurrencyFormatter;

        function displaySignalLabel(signal) {
            const normalized = String(signal || 'FLAT').toUpperCase().replace(/_/g, ' ');
            return normalized === 'FLAT' ? 'NO TRADE' : normalized;
        }

        function formatSignalFilterLabel(signal) {
            const normalized = String(signal || 'ALL').toUpperCase();
            return `Signal: ${normalized === 'ALL' ? 'ALL' : displaySignalLabel(normalized)}`;
        }

        function isActionableSignal(signal) {
            const normalized = String(signal || '').toUpperCase().replace(/_/g, ' ');
            return normalized.includes('LONG') || normalized.includes('SHORT');
        }

        function resolveTradeSignal(pUp, confidence = 1) {
            const normalizedPUp = clamp(asNumber(pUp, 0.5), 0, 1);
            const normalizedConfidence = clamp(asNumber(confidence, 0), 0, 1);

            if (normalizedConfidence >= minActionableConfidence && normalizedPUp >= longSignalThreshold) {
                return 'LONG';
            }
            if (normalizedConfidence >= minActionableConfidence && normalizedPUp <= shortSignalThreshold) {
                return 'SHORT';
            }
            return 'FLAT';
        }

        function inferSignal(pUp) {
            return resolveTradeSignal(pUp, 1);
        }

        function formatNullableCurrency(value) {
            return Number.isFinite(value) ? formatCurrency(value) : '--';
        }

        function formatNullableRatio(value) {
            return Number.isFinite(value) ? Number(value).toFixed(2) : '--';
        }

        function formatNullableProbability(value) {
            return Number.isFinite(value) ? normalizeProbability(value).toFixed(2) : '--';
        }

        function formatCurrentEdge(pUp, confidence) {
            const normalizedPUp = clamp(asNumber(pUp, 0.5), 0, 1);
            const normalizedConfidence = clamp(asNumber(confidence, 0), 0, 1);
            const confidenceGap = minActionableConfidence - normalizedConfidence;

            if ((normalizedPUp >= longSignalThreshold || normalizedPUp <= shortSignalThreshold) && confidenceGap > 0) {
                return `Conf gate -${confidenceGap.toFixed(2)}`;
            }

            const leaningLong = normalizedPUp >= 0.5;
            const trigger = leaningLong ? longSignalThreshold : shortSignalThreshold;
            const gap = Math.abs(trigger - normalizedPUp);
            return `${gap.toFixed(2)} from ${leaningLong ? 'LONG' : 'SHORT'}`;
        }

        function estimateStopLoss(entry, q10, action) {
            if (action === 'SHORT') return entry * (1 + Math.abs(q10) * 0.8);
            return entry * (1 + q10 * 0.8);
        }

        function estimateTakeProfit(entry, quantileValue, action) {
            if (action === 'SHORT') return entry * (1 - Math.abs(quantileValue) * 0.8);
            return entry * (1 + quantileValue * 0.8);
        }

        function calculateRiskReward(entry, stopLoss, takeProfit) {
            const risk = Math.abs(entry - stopLoss);
            const reward = Math.abs(takeProfit - entry);
            return risk > 0 ? reward / risk : 0;
        }

        function normalizeProbability(value) {
            if (!Number.isFinite(value)) return 0;
            if (value > 1) return clamp(value / 100, 0, 1);
            return clamp(value, 0, 1);
        }

        function normalizeReturn(value) {
            if (!Number.isFinite(value)) return 0;
            if (Math.abs(value) > 1) return value / 100;
            return value;
        }

        function toCanonicalSymbol(raw) {
            if (!raw) return null;
            const value = String(raw).toUpperCase().replace('/', '');
            if (value === 'BTC') return 'BTCUSDT';
            if (value === 'ETH') return 'ETHUSDT';
            if (value === 'SOL') return 'SOLUSDT';
            if (value.endsWith('USDT')) return value;
            return `${value}USDT`;
        }

        function toDisplaySymbol(symbol) {
            return symbol.endsWith('USDT') ? `${symbol.slice(0, -4)}/USDT` : symbol;
        }

        function formatSignedPercent(value, includeSign = true) {
            const percent = normalizeReturn(value) * 100;
            const sign = includeSign && percent > 0 ? '+' : '';
            return `${sign}${percent.toFixed(2)}%`;
        }

        function formatRate(value) {
            return `${(normalizeProbability(value) * 100).toFixed(1)}%`;
        }

        function formatLargeMoney(value) {
            if (!Number.isFinite(value)) return '-';
            if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
            if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
            return formatCurrency(value);
        }

        return {
            asNumber,
            calculateRiskReward,
            clamp,
            displaySignalLabel,
            escapeHtml,
            estimateStopLoss,
            estimateTakeProfit,
            formatCurrentEdge,
            formatLargeMoney,
            formatNullableCurrency,
            formatNullableProbability,
            formatNullableRatio,
            formatRate,
            formatSignalFilterLabel,
            formatSignedPercent,
            inferSignal,
            isActionableSignal,
            normalizeProbability,
            normalizeReturn,
            nullableNumber,
            resolveTradeSignal,
            stdDev,
            timeStampLabel,
            toCanonicalSymbol,
            toDisplaySymbol
        };
    }

    function nullableNumber(value, fallback = null) {
        if (value === null || value === undefined || value === '') return fallback;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function asNumber(value, fallback = NaN) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function stdDev(values) {
        if (!values.length) return 0;
        const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
        const variance = values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / values.length;
        return Math.sqrt(Math.max(variance, 0));
    }

    function timeStampLabel(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function defaultCurrencyFormatter(value) {
        return `$${Number(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    const api = {
        createCryptoBasics
    };

    root.StockCryptoBasics = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
