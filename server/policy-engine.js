function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function round(value, digits = 4) {
    return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function asFiniteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function inferMarketDefaults(market) {
    const normalized = String(market || '').trim().toLowerCase();
    if (normalized === 'crypto') {
        return {
            market: 'crypto',
            leverageCap: 2,
            shortAllowed: true,
            baseRiskBudgetPct: 0.75,
            feePct: 0.08,
            spreadPct: 0.02,
            minConfidence: 0.52,
            baseEdgePct: 0.18,
            strongEdgePct: 0.55
        };
    }
    if (normalized === 'cn_equity' || normalized === 'cn' || normalized === 'session_cn') {
        return {
            market: 'cn_equity',
            leverageCap: 1,
            shortAllowed: false,
            baseRiskBudgetPct: 0.55,
            feePct: 0.04,
            spreadPct: 0.03,
            minConfidence: 0.55,
            baseEdgePct: 0.15,
            strongEdgePct: 0.45
        };
    }
    if (normalized === 'us_equity' || normalized === 'us' || normalized === 'session_us') {
        return {
            market: 'us_equity',
            leverageCap: 2,
            shortAllowed: true,
            baseRiskBudgetPct: 0.65,
            feePct: 0.03,
            spreadPct: 0.02,
            minConfidence: 0.54,
            baseEdgePct: 0.16,
            strongEdgePct: 0.5
        };
    }
    return {
        market: 'session',
        leverageCap: 1.5,
        shortAllowed: true,
        baseRiskBudgetPct: 0.6,
        feePct: 0.05,
        spreadPct: 0.03,
        minConfidence: 0.54,
        baseEdgePct: 0.15,
        strongEdgePct: 0.45
    };
}

function inferVolatilityState(changePct, q10, q90, ohlc) {
    const bandWidthRatio = Math.max(0, q90 - q10);
    const intradayRange = ohlc.open > 0
        ? Math.abs((ohlc.high - ohlc.low) / ohlc.open)
        : 0;
    const changeRatio = Math.abs(changePct) / 100;
    const composite = bandWidthRatio * 0.55 + intradayRange * 0.3 + changeRatio * 0.15;

    if (composite >= 0.055) return { label: 'High Volatility', penalty: 0.82, sizeMultiplier: 0.62 };
    if (composite <= 0.018) return { label: 'Low Volatility', penalty: 0.18, sizeMultiplier: 1.05 };
    return { label: 'Balanced', penalty: 0.42, sizeMultiplier: 1.0 };
}

function inferLiquidityState(volume, price, market) {
    const liquidityProxy = Math.max(asFiniteNumber(volume, 0) * Math.max(asFiniteNumber(price, 0), 1), asFiniteNumber(volume, 0));
    const logProxy = liquidityProxy > 0 ? Math.log10(liquidityProxy) : 0;

    if (market === 'crypto') {
        if (logProxy >= 8) return { label: 'Good', score: 0.9, slippagePct: 0.03, sizeMultiplier: 1.0 };
        if (logProxy >= 6.5) return { label: 'Moderate', score: 0.68, slippagePct: 0.06, sizeMultiplier: 0.85 };
        return { label: 'Low Liquidity', score: 0.35, slippagePct: 0.11, sizeMultiplier: 0.55 };
    }

    if (logProxy >= 7.5) return { label: 'Good', score: 0.88, slippagePct: 0.02, sizeMultiplier: 1.0 };
    if (logProxy >= 6) return { label: 'Moderate', score: 0.66, slippagePct: 0.04, sizeMultiplier: 0.82 };
    return { label: 'Low Liquidity', score: 0.32, slippagePct: 0.08, sizeMultiplier: 0.55 };
}

function inferTrendState(changePct, pUp) {
    if (changePct >= 1.25 || pUp >= 0.63) {
        return { label: 'Trend Up', score: 0.84, directionBias: 'long', thresholdAdjPct: -0.04, sizeMultiplier: 1.08, tp2Multiplier: 1.18 };
    }
    if (changePct <= -1.25 || pUp <= 0.37) {
        return { label: 'Trend Down', score: 0.84, directionBias: 'short', thresholdAdjPct: -0.04, sizeMultiplier: 1.08, tp2Multiplier: 1.18 };
    }
    return { label: 'Balanced', score: 0.64, directionBias: 'neutral', thresholdAdjPct: 0, sizeMultiplier: 1, tp2Multiplier: 1 };
}

function buildRegime(trendState, volatilityState, liquidityState, sessionMeta = {}, regimeHints = {}) {
    if (regimeHints.eventRisk) {
        return {
            label: 'Event Risk',
            score: 0.3,
            adjustments: {
                edgeThresholdPct: 0.18,
                sizeMultiplier: 0.28,
                leverageCapMultiplier: 0.5,
                tp2Multiplier: 0.8
            }
        };
    }

    if (liquidityState.label === 'Low Liquidity') {
        return {
            label: 'Low Liquidity',
            score: 0.36,
            adjustments: {
                edgeThresholdPct: 0.12,
                sizeMultiplier: liquidityState.sizeMultiplier,
                leverageCapMultiplier: 0.65,
                tp2Multiplier: 0.95
            }
        };
    }

    if (volatilityState.label === 'High Volatility') {
        return {
            label: 'High Volatility',
            score: 0.42,
            adjustments: {
                edgeThresholdPct: 0.16,
                sizeMultiplier: volatilityState.sizeMultiplier,
                leverageCapMultiplier: 0.7,
                tp2Multiplier: 0.9
            }
        };
    }

    const isTrend = trendState.label === 'Trend Up' || trendState.label === 'Trend Down';
    if (isTrend) {
        return {
            label: trendState.label,
            score: round((trendState.score + liquidityState.score + (1 - volatilityState.penalty)) / 3, 4),
            adjustments: {
                edgeThresholdPct: trendState.thresholdAdjPct,
                sizeMultiplier: trendState.sizeMultiplier * volatilityState.sizeMultiplier,
                leverageCapMultiplier: 1,
                tp2Multiplier: trendState.tp2Multiplier
            }
        };
    }

    const sessionScore = sessionMeta?.qualityScore !== undefined ? clamp(asFiniteNumber(sessionMeta.qualityScore, 0.5), 0, 1) : 0.6;
    return {
        label: 'Balanced',
        score: round((0.62 + sessionScore + liquidityState.score + (1 - volatilityState.penalty)) / 4, 4),
        adjustments: {
            edgeThresholdPct: 0,
            sizeMultiplier: 1,
            leverageCapMultiplier: 1,
            tp2Multiplier: 1
        }
    };
}

function buildReasonAndGateState(packetSeed) {
    const reasons = [];
    const gates = [];

    if (packetSeed.expectedNetEdgePct > 0) gates.push('cost_ok');
    if (packetSeed.confidence >= packetSeed.minConfidence) gates.push('confidence_ok');
    if (packetSeed.regime.score >= 0.45) gates.push('regime_ok');
    if (packetSeed.liquidityState.label !== 'Low Liquidity') gates.push('liquidity_ok');

    reasons.push(packetSeed.expectedNetEdgePct > 0
        ? 'Positive net edge after transaction cost.'
        : 'Expected edge is fully consumed by downside and execution cost.');

    reasons.push(packetSeed.regime.label === 'Balanced'
        ? 'Balanced regime keeps thresholds neutral.'
        : `${packetSeed.regime.label} regime is shaping thresholds, sizing, and target width.`);

    if (packetSeed.liquidityState.label === 'Low Liquidity') {
        reasons.push('Low liquidity increases slippage and reduces size allowance.');
    }
    if (packetSeed.volatilityState.label === 'High Volatility') {
        reasons.push('High volatility adds uncertainty and tightens risk budget.');
    }
    if (packetSeed.confidence < packetSeed.minConfidence) {
        reasons.push('Forecast confidence is below the minimum policy threshold.');
    }

    return { reasons, gates };
}

function buildTradePlan(price, longSide, stopLossPct, takeProfit1Pct, takeProfit2Pct, status) {
    const hasPlan = price > 0
        && Number.isFinite(stopLossPct)
        && Number.isFinite(takeProfit1Pct)
        && Number.isFinite(takeProfit2Pct);
    if (!hasPlan) {
        return {
            available: false,
            status: status || 'preview',
            direction: longSide ? 'LONG' : 'SHORT',
            entryPrice: null,
            stopLoss: null,
            stopLossPct: null,
            takeProfit1: null,
            takeProfit1Pct: null,
            takeProfit2: null,
            takeProfit2Pct: null,
            rewardRisk1: null,
            rewardRisk2: null,
            basis: 'reference_price'
        };
    }

    const entryPrice = price;
    const stopLoss = price * (1 + stopLossPct / 100);
    const takeProfit1 = price * (1 + takeProfit1Pct / 100);
    const takeProfit2 = price * (1 + takeProfit2Pct / 100);
    const rewardRisk1 = Math.abs(takeProfit1Pct / (stopLossPct || 1));
    const rewardRisk2 = Math.abs(takeProfit2Pct / (stopLossPct || 1));

    return {
        available: true,
        status: status || 'preview',
        direction: longSide ? 'LONG' : 'SHORT',
        entryPrice: round(entryPrice, 4),
        stopLoss: round(stopLoss, 4),
        stopLossPct: round(stopLossPct, 2),
        takeProfit1: round(takeProfit1, 4),
        takeProfit1Pct: round(takeProfit1Pct, 2),
        takeProfit2: round(takeProfit2, 4),
        takeProfit2Pct: round(takeProfit2Pct, 2),
        rewardRisk1: round(rewardRisk1, 2),
        rewardRisk2: round(rewardRisk2, 2),
        basis: 'reference_price'
    };
}

function buildPolicyPacket(input = {}) {
    const defaults = inferMarketDefaults(input.market);
    const price = Math.max(asFiniteNumber(input.price, 0), 0);
    const changePct = asFiniteNumber(input.changePct, 0);
    const open = asFiniteNumber(input.open, price);
    const high = asFiniteNumber(input.high, Math.max(price, open));
    const low = asFiniteNumber(input.low, Math.min(price, open));
    const volume = asFiniteNumber(input.volume, 0);
    const pUp = clamp(asFiniteNumber(input.pUp, 0.5), 0.01, 0.99);
    const confidence = clamp(asFiniteNumber(input.confidence, 0.5), 0.01, 0.99);
    let q10 = asFiniteNumber(input.q10, -0.01);
    let q50 = asFiniteNumber(input.q50, 0);
    let q90 = asFiniteNumber(input.q90, 0.01);
    [q10, q50, q90] = [q10, q50, q90].sort((a, b) => a - b);

    const trendState = inferTrendState(changePct, pUp);
    const volatilityState = inferVolatilityState(changePct, q10, q90, { open, high, low });
    const liquidityState = inferLiquidityState(volume, price, defaults.market);
    const regime = buildRegime(trendState, volatilityState, liquidityState, input.sessionMeta, input.regimeHints);

    const longSide = pUp >= 0.5;
    const stopProxyPct = clamp(Math.max(Math.abs(q10) * 0.75, Math.abs(q90 - q10) * 0.35, Math.abs(changePct) / 100 * 0.18, 0.0035), 0.0035, 0.09);
    const longUpsideEstimatePct = Math.max(q50, 0);
    const longDownsideEstimatePct = Math.max(Math.abs(Math.min(q10, 0)), stopProxyPct);
    const shortUpsideEstimatePct = Math.max(Math.abs(Math.min(q50, 0)), stopProxyPct * 0.9);
    const shortDownsideEstimatePct = Math.max(Math.max(q90, 0), stopProxyPct);
    const expectedRawEdgeRatio = longSide
        ? pUp * longUpsideEstimatePct - (1 - pUp) * longDownsideEstimatePct
        : (1 - pUp) * shortUpsideEstimatePct - pUp * shortDownsideEstimatePct;

    const spreadPct = defaults.spreadPct + clamp(Math.abs(high - low) / Math.max(open || price || 1, 1) * 0.12, 0, 0.08);
    const slippagePct = liquidityState.slippagePct + volatilityState.penalty * 0.06;
    const uncertaintyBufferPct = (input.regimeHints?.eventRisk ? 0.12 : 0.04) + Math.max(0, 0.62 - confidence) * 0.24;
    const costPct = defaults.feePct + spreadPct + slippagePct + uncertaintyBufferPct;

    const expectedRawEdgePct = expectedRawEdgeRatio * 100;
    const expectedNetEdgePct = expectedRawEdgePct - costPct;
    const minConfidence = defaults.minConfidence;
    const edgeThresholdPct = defaults.baseEdgePct + regime.adjustments.edgeThresholdPct;
    const strongEdgePct = defaults.strongEdgePct + Math.max(regime.adjustments.edgeThresholdPct, 0);

    let action = 'FLAT';
    if (expectedNetEdgePct <= 0) {
        action = 'FLAT';
    } else if (confidence < minConfidence || regime.score < 0.45) {
        action = 'WAIT';
    } else if (expectedNetEdgePct >= strongEdgePct) {
        action = longSide ? 'STRONG_LONG' : 'STRONG_SHORT';
    } else if (expectedNetEdgePct >= edgeThresholdPct) {
        action = longSide ? 'LONG' : 'SHORT';
    } else {
        action = 'WAIT';
    }

    if (!defaults.shortAllowed && action.includes('SHORT')) {
        action = expectedNetEdgePct > 0 ? 'WAIT' : 'FLAT';
    }

    const stopLossRatioAbs = clamp(
        longSide
            ? Math.max(Math.abs(Math.min(q10, 0)), stopProxyPct)
            : Math.max(Math.max(q90, 0), stopProxyPct),
        stopProxyPct,
        0.12
    );
    const confidenceMultiplier = confidence >= 0.8 ? 1.2 : confidence >= 0.7 ? 1.0 : confidence >= 0.6 ? 0.8 : 0.5;
    const volatilityMultiplier = volatilityState.label === 'Low Volatility' ? 0.9 : volatilityState.label === 'High Volatility' ? 1.45 : 1.0;
    const liquidityMultiplier = liquidityState.sizeMultiplier;
    const rawRiskBudgetPct = defaults.baseRiskBudgetPct * confidenceMultiplier * regime.adjustments.sizeMultiplier * liquidityMultiplier / volatilityMultiplier;
    const leverageCap = round(defaults.leverageCap * regime.adjustments.leverageCapMultiplier, 2);
    const positionSize = clamp(rawRiskBudgetPct / Math.max(stopLossRatioAbs * 100, 0.1), 0, leverageCap);

    const hasTradePlan = action !== 'FLAT' && action !== 'WAIT';
    const stopLossPct = longSide ? -(stopLossRatioAbs * 100) : (stopLossRatioAbs * 100);
    const target1Ratio = clamp(
        longSide
            ? Math.max(q50, stopProxyPct * 0.9)
            : Math.max(Math.abs(Math.min(q50, 0)), stopProxyPct * 0.9),
        stopProxyPct * 0.9,
        0.09
    );
    const target2Ratio = clamp(
        (
            longSide
                ? Math.max(q90, target1Ratio * 1.35)
                : Math.max(Math.abs(Math.min(q10, 0)), target1Ratio * 1.35)
        ) * regime.adjustments.tp2Multiplier,
        target1Ratio,
        0.14
    );
    const takeProfit1Pct = longSide ? target1Ratio * 100 : -(target1Ratio * 100);
    const takeProfit2Pct = longSide ? target2Ratio * 100 : -(target2Ratio * 100);

    const previewPlan = buildTradePlan(price, longSide, stopLossPct, takeProfit1Pct, takeProfit2Pct, hasTradePlan ? 'live' : 'preview');
    const stopLoss = hasTradePlan ? previewPlan.stopLoss : null;
    const takeProfit1 = hasTradePlan ? previewPlan.takeProfit1 : null;
    const takeProfit2 = hasTradePlan ? previewPlan.takeProfit2 : null;
    const rewardRisk1 = hasTradePlan ? previewPlan.rewardRisk1 : null;
    const rewardRisk2 = hasTradePlan ? previewPlan.rewardRisk2 : null;

    const confidenceScore = confidence;
    const edgeScore = clamp(expectedNetEdgePct / Math.max(strongEdgePct, 0.35), 0, 1);
    const liquidityScore = liquidityState.score;
    const costPenaltyScore = clamp(costPct / 0.45, 0, 1);
    const tradeQualityScore = clamp(100 * (
        0.30 * confidenceScore +
        0.30 * edgeScore +
        0.20 * regime.score +
        0.10 * liquidityScore +
        0.10 * (1 - costPenaltyScore)
    ), 0, 100);
    const tradeQualityBand = tradeQualityScore >= 80 ? 'A' : tradeQualityScore >= 65 ? 'B' : tradeQualityScore >= 50 ? 'C' : 'D';

    const { reasons, gates } = buildReasonAndGateState({
        expectedNetEdgePct,
        confidence,
        minConfidence,
        regime,
        liquidityState,
        volatilityState
    });

    const signal = action.includes('LONG') ? 'BULLISH' : action.includes('SHORT') ? 'BEARISH' : 'NEUTRAL';

    return {
        signal,
        action,
        expectedRawEdgePct: round(expectedRawEdgePct, 2),
        expectedNetEdgePct: round(expectedNetEdgePct, 2),
        costPct: round(costPct, 2),
        tradeQualityScore: round(tradeQualityScore, 1),
        tradeQualityBand,
        regime: regime.label,
        regimeScore: round(regime.score, 4),
        regimeAdjustments: {
            edgeThresholdPct: round(regime.adjustments.edgeThresholdPct, 2),
            sizeMultiplier: round(regime.adjustments.sizeMultiplier, 3),
            leverageCapMultiplier: round(regime.adjustments.leverageCapMultiplier, 3),
            tp2Multiplier: round(regime.adjustments.tp2Multiplier, 3)
        },
        positionSize: round(hasTradePlan ? positionSize : 0, 4),
        leverageCap,
        riskBudgetPct: round(rawRiskBudgetPct, 2),
        stopLoss: round(stopLoss, 4),
        stopLossPct: round(hasTradePlan ? stopLossPct : null, 2),
        takeProfit1: round(takeProfit1, 4),
        takeProfit1Pct: round(hasTradePlan ? takeProfit1Pct : null, 2),
        takeProfit2: round(takeProfit2, 4),
        takeProfit2Pct: round(hasTradePlan ? takeProfit2Pct : null, 2),
        rewardRisk1: round(rewardRisk1, 2),
        rewardRisk2: round(rewardRisk2, 2),
        previewPlan,
        reasons,
        gates,
        forecastTimestamp: input.forecastTimestamp || new Date().toISOString(),
        inputSource: input.inputSource || 'unknown',
        engineVersion: 'policy-engine-v1'
    };
}

function deriveLegacyPolicy(packet, options = {}) {
    const marketDefaults = inferMarketDefaults(options.market);
    const actionText = packet.action === 'STRONG_LONG'
        ? 'Buy (aggressive)'
        : packet.action === 'LONG'
            ? 'Buy'
            : packet.action === 'STRONG_SHORT'
                ? 'Sell short (aggressive)'
                : packet.action === 'SHORT'
                    ? 'Sell short'
                    : packet.action === 'WAIT'
                        ? 'Wait'
                        : 'Hold';
    return {
        signal: packet.action.replace('STRONG_', '').replace('_', ' '),
        action: actionText,
        shortAllowed: marketDefaults.shortAllowed,
        shortEligible: marketDefaults.shortAllowed,
        leverage: packet.leverageCap,
        positionSize: packet.positionSize,
        marginEligible: options.market !== 'cn_equity' && options.market !== 'cn',
        shortReason: marketDefaults.shortAllowed ? 'Short side allowed under current policy engine.' : 'CN strict no-short mode',
        tPlusOneApplied: options.market === 'cn_equity' || options.market === 'cn',
        expectedNetEdgePct: packet.expectedNetEdgePct,
        tradeQualityScore: packet.tradeQualityScore,
        tradeQualityBand: packet.tradeQualityBand,
        regime: packet.regime,
        costPct: packet.costPct,
        rewardRisk2: packet.rewardRisk2,
        reasons: packet.reasons,
        gates: packet.gates
    };
}

function deriveLegacyTpSl(packet, entryPrice = null) {
    return {
        entryPrice: round(asFiniteNumber(entryPrice, packet.stopLoss ? packet.stopLoss / (1 + (packet.stopLossPct || 0) / 100) : null), 4),
        stopLoss: packet.stopLoss,
        stopLossPct: packet.stopLossPct !== null ? round(packet.stopLossPct / 100, 4) : null,
        takeProfit1: packet.takeProfit1,
        takeProfit1Pct: packet.takeProfit1Pct !== null ? round(packet.takeProfit1Pct / 100, 4) : null,
        takeProfit2: packet.takeProfit2,
        takeProfit2Pct: packet.takeProfit2Pct !== null ? round(packet.takeProfit2Pct / 100, 4) : null,
        rewardRisk1: packet.rewardRisk1,
        rewardRisk2: packet.rewardRisk2
    };
}

module.exports = {
    buildPolicyPacket,
    deriveLegacyPolicy,
    deriveLegacyTpSl
};
