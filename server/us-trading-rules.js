const { clamp } = require('./value-helpers');

const US_MAX_LEVERAGE = 2.0;
const US_LIMIT_POSITION = 2.0;

function calculateUsPrediction(quote) {
    const price = quote?.price ?? null;
    const open = quote?.open ?? price ?? null;
    const high = quote?.high ?? price ?? null;
    const low = quote?.low ?? price ?? null;
    const changePct = quote?.changePct ?? 0;

    const intradayPct = Number.isFinite(price) && Number.isFinite(open) && open !== 0
        ? ((price - open) / open) * 100
        : 0;
    const rangePct = Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(open) && open !== 0
        ? (high - low) / open
        : 0;

    const trendComponent = clamp(changePct / 5, -1, 1);
    const intradayComponent = clamp(intradayPct / 4, -1, 1);
    const pUp = clamp(0.5 + trendComponent * 0.24 + intradayComponent * 0.16, 0.02, 0.98);
    const pDown = clamp(1 - pUp, 0.02, 0.98);
    const distance = Math.abs(pUp - 0.5) * 2;

    const rangePenalty = clamp(rangePct / 0.07, 0, 1);
    const confidence = clamp(0.82 + distance * 0.18 - rangePenalty * 0.10, 0.75, 0.99);
    const center = clamp((changePct / 100) * 0.38 + (pUp - 0.5) * 0.06, -0.11, 0.11);
    const spread = clamp(0.012 + rangePct * 0.55 + (1 - confidence) * 0.05, 0.01, 0.09);
    const [q10, q50, q90] = [
        clamp(center - spread * 0.95, -0.15, 0.15),
        clamp(center, -0.12, 0.12),
        clamp(center + spread * 0.95, -0.15, 0.15)
    ].sort((a, b) => a - b);

    return {
        pUp: Number(pUp.toFixed(4)),
        pDown: Number(pDown.toFixed(4)),
        confidence: Number(confidence.toFixed(4)),
        signal: choosePredictionSignal(pUp, confidence),
        q10: Number(q10.toFixed(4)),
        q50: Number(q50.toFixed(4)),
        q90: Number(q90.toFixed(4)),
        window: buildPredictionWindow(pUp, distance)
    };
}

function choosePredictionSignal(pUp, confidence) {
    if (pUp >= 0.65 && confidence >= 0.95) return 'STRONG LONG';
    if (pUp >= 0.55 && confidence >= 0.90) return 'LONG';
    if (pUp <= 0.35 && confidence >= 0.95) return 'STRONG SHORT';
    if (pUp <= 0.45 && confidence >= 0.90) return 'SHORT';
    return 'FLAT';
}

function buildPredictionWindow(pUp, distance) {
    let w1 = clamp(0.26 + (pUp - 0.5) * 0.35, 0.08, 0.55);
    let w2 = clamp(0.28 + distance * 0.12, 0.10, 0.50);
    let w3 = clamp(0.24 + (0.5 - Math.abs(pUp - 0.5)) * 0.12, 0.08, 0.45);
    let w0 = Math.max(0.02, 1 - (w1 + w2 + w3));

    const total = w0 + w1 + w2 + w3;
    w0 /= total;
    w1 /= total;
    w2 /= total;
    w3 /= total;

    return {
        W0: Number(w0.toFixed(4)),
        W1: Number(w1.toFixed(4)),
        W2: Number(w2.toFixed(4)),
        W3: Number(w3.toFixed(4)),
        mostLikely: Object.entries({ W0: w0, W1: w1, W2: w2, W3: w3 }).sort((a, b) => b[1] - a[1])[0][0]
    };
}

function calculateUsPolicy(prediction) {
    const pUp = prediction.pUp;
    const confidence = prediction.confidence;
    const q10 = prediction.q10;
    const q50 = prediction.q50;
    const signal = choosePredictionSignal(pUp, confidence);

    return {
        signal,
        action: actionForSignal(signal),
        positionSize: Number(positionSizeForSignal(signal, pUp, confidence, q10, q50).toFixed(4)),
        shortAllowed: true,
        leverage: US_MAX_LEVERAGE
    };
}

function actionForSignal(signal) {
    if (signal === 'STRONG LONG') return 'Buy (aggressive)';
    if (signal === 'LONG') return 'Buy';
    if (signal === 'STRONG SHORT') return 'Sell short (aggressive)';
    if (signal === 'SHORT') return 'Sell short';
    return 'Hold';
}

function positionSizeForSignal(signal, pUp, confidence, q10, q50) {
    if (signal === 'FLAT') return 0;

    const isLong = signal.includes('LONG');
    const winProb = isLong ? pUp : 1 - pUp;
    const winReturn = Math.max(isLong ? q50 : Math.abs(q10), 0.001);
    const lossReturn = Math.max(isLong ? Math.abs(q10) : q50, 0.001);
    const kelly = (winProb * winReturn - (1 - winProb) * lossReturn) / winReturn;
    const capped = clamp(Math.abs(kelly), 0, US_LIMIT_POSITION);
    return clamp(capped * confidence, 0, US_LIMIT_POSITION);
}

function calculateUsTpSl(entryPrice, prediction, signal) {
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        return emptyTpSl();
    }

    if (signal === 'FLAT') {
        return {
            entryPrice: Number(entryPrice.toFixed(4)),
            stopLoss: null,
            stopLossPct: null,
            takeProfit1: null,
            takeProfit1Pct: null,
            takeProfit2: null,
            takeProfit2Pct: null
        };
    }

    const isLong = signal.includes('LONG');
    const stopLossPct = isLong ? prediction.q10 * 0.9 : -prediction.q90 * 0.9;
    const takeProfit1Pct = isLong ? prediction.q50 * 0.8 : -prediction.q10 * 0.8;
    const takeProfit2Pct = isLong ? prediction.q90 * 0.7 : -prediction.q10 * 1.5;

    return {
        entryPrice: Number(entryPrice.toFixed(4)),
        stopLoss: Number((entryPrice * (1 + stopLossPct)).toFixed(4)),
        stopLossPct: Number(stopLossPct.toFixed(4)),
        takeProfit1: Number((entryPrice * (1 + takeProfit1Pct)).toFixed(4)),
        takeProfit1Pct: Number(takeProfit1Pct.toFixed(4)),
        takeProfit2: Number((entryPrice * (1 + takeProfit2Pct)).toFixed(4)),
        takeProfit2Pct: Number(takeProfit2Pct.toFixed(4))
    };
}

function emptyTpSl() {
    return {
        entryPrice: null,
        stopLoss: null,
        stopLossPct: null,
        takeProfit1: null,
        takeProfit1Pct: null,
        takeProfit2: null,
        takeProfit2Pct: null
    };
}

module.exports = {
    calculateUsPolicy,
    calculateUsPrediction,
    calculateUsTpSl
};
