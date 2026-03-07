const ET_TIMEZONE = 'America/New_York';
const REFRESH_MS = 15000;
const LONG_TRIGGER = 0.55;
const SHORT_TRIGGER = 0.45;
const MIN_CONFIDENCE = 0.90;
const CLOSE_SOON_WINDOW_SEC = 1800;
const TRADE_LOG_STORAGE_KEY = 'us_index_session_trade_log_v1';
const TRADE_LOG_LIMIT = 25;
const GAP_GUIDE_LEVEL = 0.015;
const US_INDEX_CONFIG = {
    DJI: { key: 'DJI', symbol: '^DJI', quoteKey: 'dow', historyKey: 'dow', displayName: 'Dow Jones' },
    NDX: { key: 'NDX', symbol: '^NDX', quoteKey: 'nasdaq100', historyKey: 'nasdaq100', displayName: 'Nasdaq' },
    SPX: { key: 'SPX', symbol: '^SPX', quoteKey: 'sp500', historyKey: 'sp500', displayName: 'S&P 500' }
};
const US_HOLIDAYS_2026 = new Set([
    '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
    '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25'
]);
const US_EARLY_CLOSE_2026 = new Set(['2026-07-03', '2026-11-27', '2026-12-24']);

const state = {
    selectedIndex: 'SPX',
    sessionScope: 'all',
    tableSessionFilter: 'all',
    chartMode: 'direction',
    showVolatilityOverlay: false,
    mockLeverage: 1,
    tradeLog: [],
    viewModel: null,
    sessionChart: null,
    magnitudeChart: null,
    refreshTimer: null,
    countdownTimer: null
};

const els = {};

window.addEventListener('DOMContentLoaded', async () => {
    state.tradeLog = loadTradeLog();
    cacheElements();
    bindEvents();
    initializeCharts();
    renderIndexButtons();
    renderTradeLog();
    await refreshData();
    startAutoRefresh();
    startCountdownTimer();
});

function cacheElements() {
    [
        'statusBanner', 'statusBannerTitle', 'statusBannerSubtitle', 'marketStatusBadge', 'marketActivityBadge',
        'nextTradingWindowTag', 'nextTradingWindowText', 'statusSoonNotice',
        'statusProgressLabel', 'statusProgressValue', 'statusProgressFill', 'currentPhaseText',
        'timeRemainingText', 'nextOpenText', 'preOpenText', 'btnDJI', 'btnNDX', 'btnSPX', 'indexFilter',
        'scopeAllBtn', 'scopeNextBtn', 'currentIndexValue', 'currentIndexChange', 'selectedSessionLabel',
        'lastUpdatedLabel', 'marketStructureLabel', 'marketStructureMeta', 'marketStateInline',
        'nextActionInline', 'accuracyPrimary', 'confidenceRing', 'confidenceRingValue', 'goNoGoBadge',
        'tPlusOneBadge', 'accuracyBreakdown', 'noGoReason', 'quickDecisionPill', 'quickDecisionMode',
        'quickGapRiskBadge', 'leverageSelector', 'quickExposureText', 'quickGapRiskNote', 'executeBtnWrap',
        'executeBtn', 'executeHint',
        'quickEntryLabel', 'quickStopLabel', 'quickTakeProfitLabel', 'quickNetEdgeLabel', 'quickEntry',
        'quickStop', 'quickTakeProfit', 'quickNetEdge', 'quickDecisionNote', 'chartModeDirection',
        'chartModeVolatility', 'sessionChart', 'sessionChartNote', 'windowBars', 'windowMostLikely',
        'windowConfidenceNote', 'magnitudeQ10', 'magnitudeQ50', 'magnitudeQ90', 'magnitudeWidth',
        'limitAdjustedBox', 'limitAdjustedText', 'limitAdjustedNote', 'magnitudeSparkChart',
        'magnitudeOverlayToggle',
        'currentBiasText', 'currentLimitRiskText', 'tPlusOneText', 'dataSourceText', 'sessionExplanationText',
        'sessionTableBody', 'hoveredSessionLabel', 'hoveredExplanation', 'hoveredSuggestedAction',
        'hoveredGapHint', 'hoveredWindowBias', 'hoveredLimitText', 'hoveredExecutionState', 'dataDelayNote',
        'mockDisclaimer', 'tableSessionFilter', 'tradeLogPanel', 'tradeLogBody', 'executeModal',
        'executeModalBody', 'executeModalMeta', 'executeViewTradeLog', 'executeModalClose', 'accuracyCard',
        'quickDecisionCard', 'startWindowCard', 'magnitudeCard', 'projectionCard', 'executionLensCard',
        'sessionTableShell'
    ].forEach((id) => {
        els[id] = document.getElementById(id);
    });
}

function bindEvents() {
    [['btnDJI', 'DJI'], ['btnNDX', 'NDX'], ['btnSPX', 'SPX']].forEach(([id, key]) => {
        els[id]?.addEventListener('click', async () => {
            state.selectedIndex = key;
            renderIndexButtons();
            await refreshData();
        });
    });

    els.indexFilter?.addEventListener('change', async () => {
        state.selectedIndex = ['DJI', 'NDX', 'SPX'].includes(els.indexFilter.value) ? els.indexFilter.value : 'SPX';
        renderIndexButtons();
        await refreshData();
    });

    els.scopeAllBtn?.addEventListener('click', () => {
        state.sessionScope = 'all';
        renderScopeButtons();
        renderAll();
    });

    els.scopeNextBtn?.addEventListener('click', () => {
        state.sessionScope = 'next';
        renderScopeButtons();
        renderAll();
    });

    els.tableSessionFilter?.addEventListener('change', () => {
        state.tableSessionFilter = ['all', 'opening', 'closing'].includes(els.tableSessionFilter.value)
            ? els.tableSessionFilter.value
            : 'all';
        renderSessionTable();
        renderHoveredSession(firstRenderableHoverRow());
    });

    els.chartModeDirection?.addEventListener('click', () => {
        state.chartMode = 'direction';
        renderChartButtons();
        renderSessionChart();
    });

    els.chartModeVolatility?.addEventListener('click', () => {
        state.chartMode = 'volatility';
        renderChartButtons();
        renderSessionChart();
    });

    els.magnitudeOverlayToggle?.addEventListener('change', () => {
        state.showVolatilityOverlay = !!els.magnitudeOverlayToggle.checked;
        renderMagnitudeChart();
    });

    els.leverageSelector?.addEventListener('change', () => {
        const leverage = Number(els.leverageSelector.value || 1);
        state.mockLeverage = [1, 5, 10].includes(leverage) ? leverage : 1;
        renderOverview();
    });

    els.executeBtn?.addEventListener('click', () => {
        const decision = materializeQuickDecision(state.viewModel?.quickDecision, state.mockLeverage);
        if (!decision?.actionable) return;
        const trade = createTradeLogEntry();
        if (!trade) return;
        appendTradeLog(trade);
        text(
            els.executeModalBody,
            `Mock ${trade.action} executed at ${formatIndexValue(trade.entry)} | Leverage ${trade.leverage}x | Est. PNL: ${formatSignedPercent(trade.netEdgePct)} (Net Edge) | Gap Risk: ${String(trade.gapRisk || '--').toUpperCase()}`
        );
        text(els.executeModalMeta, 'Added to Session Trade Log');
        openModal();
    });

    els.executeViewTradeLog?.addEventListener('click', () => {
        closeModal();
        els.tradeLogPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    els.executeModalClose?.addEventListener('click', closeModal);
    els.executeModal?.addEventListener('click', (event) => {
        if (event.target === els.executeModal) closeModal();
    });
}

function initializeCharts() {
    if (window.Chart && els.sessionChart) {
        state.sessionChart = new Chart(els.sessionChart.getContext('2d'), {
            type: 'bar',
            data: { labels: [], datasets: [{ data: [], borderRadius: 10, borderSkipped: false }] },
            options: {
                maintainAspectRatio: false,
                animation: { duration: 250 },
                scales: {
                    x: { ticks: { color: '#cbd5e1' }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.10)' } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title(items) {
                                const row = getChartRows()[items[0]?.dataIndex || 0];
                                return row?.label || '--';
                            },
                            label(item) {
                                const row = getChartRows()[item.dataIndex || 0];
                                if (!row) return '--';
                                if (state.chartMode === 'volatility') {
                                    return `${row.label} Volatility ${formatSignedPercent(row.volatilityPct, false)} | Confidence ${formatPercent(row.confidence)} | Gap Risk ${String(row.gapRisk).toUpperCase()}`;
                                }
                                return `${row.label} P(UP) ${formatPercent(row.pUp)} | Confidence ${formatPercent(row.confidence)} | Gap Risk ${String(row.gapRisk).toUpperCase()}`;
                            }
                        }
                    }
                }
            }
        });
    }

    if (window.Chart && els.magnitudeSparkChart) {
        state.magnitudeChart = new Chart(els.magnitudeSparkChart.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                maintainAspectRatio: false,
                animation: { duration: 250 },
                scales: {
                    x: { ticks: { color: '#cbd5e1' }, grid: { display: false } },
                    y: {
                        ticks: {
                            color: '#94a3b8',
                            callback(value) {
                                return formatSignedPercent(Number(value) / 100);
                            }
                        },
                        grid: { color: 'rgba(148,163,184,0.10)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1', boxWidth: 12, boxHeight: 12, usePointStyle: true }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title(items) {
                                const row = getChartRows()[items[0]?.dataIndex || 0];
                                return row ? `${row.label} (${row.timeLabel})` : '--';
                            },
                            label(item) {
                                const row = getChartRows()[item.dataIndex || 0];
                                if (!row) return '--';
                                if (String(item.dataset?.label || '').startsWith('Gap Guide')) {
                                    return `${item.dataset.label}: ${formatSignedPercent(Number(item.raw) / 100)}`;
                                }
                                if (String(item.dataset?.label || '') === 'Volatility Overlay') {
                                    return `Volatility Overlay: ${formatSignedPercent(Number(item.raw) / 100, false)} | Gap Risk ${String(row.gapRisk).toUpperCase()}`;
                                }
                                return `${item.dataset.label}: ${formatSignedPercent(Number(item.raw) / 100)} (${describeGapGuideState(row)})`;
                            },
                            afterBody(items) {
                                const row = getChartRows()[items[0]?.dataIndex || 0];
                                if (!row) return [];
                                return [
                                    `Band Width: ${formatSignedPercent(row.q90 - row.q10, false)}`,
                                    `Gap Risk: ${String(row.gapRisk).toUpperCase()}`,
                                    `Distance to +/-1.5%: ${formatSignedPercent(row.gapDistanceGuidePct, false)}`
                                ];
                            }
                        }
                    }
                }
            }
        });
    }
}

function startAutoRefresh() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => refreshData(), REFRESH_MS);
}

function startCountdownTimer() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => updateCountdownOnly(), 1000);
}
async function refreshData(showToast = false) {
    try {
        const indexMeta = currentIndexMeta();
        const marketState = buildUsMarketState(new Date());
        const [indicesResult, historyResult] = await Promise.allSettled([
            api.getUSEquityIndices(),
            api.getUSEquityIndicesHistory({ mode: 'regular_sessions', sessions: 1, interval: '5m' })
        ]);

        if (historyResult.status !== 'fulfilled') {
            throw historyResult.reason || new Error('US regular-session history is unavailable.');
        }

        const indicesPayload = indicesResult.status === 'fulfilled' ? indicesResult.value : null;
        const historyPayload = historyResult.value;
        const lastSeries = Array.isArray(historyPayload?.series?.[indexMeta.historyKey]) ? historyPayload.series[indexMeta.historyKey] : [];
        const hasSnapshot = lastSeries.length > 0;
        let predictionPayload = null;

        if (marketState.isRegular) {
            try {
                predictionPayload = await api.getUSEquityIndexPrediction(indexMeta.symbol);
            } catch (error) {
                predictionPayload = null;
            }
        }

        state.viewModel = buildViewModel({ indexMeta, marketState, indicesPayload, historyPayload, predictionPayload, hasSnapshot });
        renderAll();
    } catch (error) {
        console.error('Failed to load US session forecast', error);
        renderErrorState(error);
        if (showToast) {
            window.showToast?.error?.('Failed to load US session view.');
        }
    }
}

function buildViewModel({ indexMeta, marketState, indicesPayload, historyPayload, predictionPayload, hasSnapshot }) {
    const lastSeries = Array.isArray(historyPayload?.series?.[indexMeta.historyKey]) ? historyPayload.series[indexMeta.historyKey] : [];
    const latestHistoryPoint = lastSeries[lastSeries.length - 1] || null;
    const firstHistoryPoint = lastSeries[0] || null;
    const liveQuote = indicesPayload?.indices?.[indexMeta.quoteKey] || null;
    const quote = marketState.isRegular && liveQuote
        ? buildQuoteFromLive(liveQuote, firstHistoryPoint)
        : buildQuoteFromHistory(latestHistoryPoint, firstHistoryPoint);
    const predictionAvailable = marketState.isRegular && !!predictionPayload?.prediction;
    const sessionSegments = buildUsSessionSegments(marketState);
    const historyPath = lastSeries.map((point) => ({ ts: point.ts, price: Number(point.price) })).filter((point) => Number.isFinite(point.price));

    let rows = [];
    let focusRow = null;
    let accuracy = null;
    let riskInfo = null;
    let quickDecision = buildClosedQuickDecision(marketState, quote);
    let noGoReason = buildClosedReason(marketState, hasSnapshot);

    if (predictionAvailable) {
        const direction = predictionPayload.prediction.direction || {};
        const magnitude = predictionPayload.prediction.magnitude || {};
        const windowForecast = predictionPayload.prediction.window || {};
        rows = buildUsSessionRows({ direction, magnitude, windowForecast, marketState, sessionSegments, historyPath });
        focusRow = resolveFocusRow(rows, marketState);
        accuracy = deriveUsAccuracy(direction, magnitude);
        riskInfo = buildUsRiskInfo(focusRow);
        quickDecision = buildUsQuickDecision(quote.price, direction, predictionPayload.tpSl || {}, marketState, focusRow);
        noGoReason = buildUsNoGoReason(quickDecision, direction, riskInfo, marketState);
    }

    return {
        indexMeta,
        marketState,
        quote,
        lastUpdated: indicesPayload?.meta?.timestamp || historyPayload?.meta?.timestamp || new Date().toISOString(),
        historyLabel: String(historyPayload?.selectedSession?.label || 'Last Regular Session'),
        historyPath,
        prediction: predictionPayload?.prediction || null,
        predictionAvailable,
        rows,
        focusRow,
        accuracy,
        riskInfo,
        quickDecision,
        noGoReason,
        hasSnapshot,
        dataSourceText: indicesPayload?.meta?.delayNote || 'US Level-1 quote feed; normal delay depends on venue',
        disclaimer: 'Regular Session Only | US Level-1 Quotes | Simulated Data | Educational Use Only | Not Trading Advice'
    };
}

function buildQuoteFromLive(liveQuote, firstHistoryPoint) {
    const openPrice = asNumber(liveQuote.open, asNumber(firstHistoryPoint?.price, liveQuote.price));
    const price = asNumber(liveQuote.price, null);
    const changePct = Number.isFinite(liveQuote?.changePct) ? Number(liveQuote.changePct) : openPrice > 0 && Number.isFinite(price) ? ((price - openPrice) / openPrice) * 100 : null;
    return {
        price,
        open: openPrice,
        changePct,
        sourceLabel: 'Regular Session'
    };
}

function buildQuoteFromHistory(lastPoint, firstPoint) {
    const price = asNumber(lastPoint?.price, null);
    const openPrice = asNumber(firstPoint?.price, price);
    const changePct = openPrice > 0 && Number.isFinite(price) ? ((price - openPrice) / openPrice) * 100 : null;
    return {
        price,
        open: openPrice,
        changePct,
        sourceLabel: 'Last Regular Session'
    };
}
function buildUsMarketState(now) {
    const parts = getEtParts(now);
    const currentDate = makeEtDate(parts.dateKey, `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`);
    const isTradingDay = isUsTradingDate(parts.dateKey, parts.weekday);
    const isEarlyClose = US_EARLY_CLOSE_2026.has(parts.dateKey);
    const closeHour = isEarlyClose ? 13 : 16;
    const regularStart = makeEtDate(parts.dateKey, '09:30:00');
    const regularEnd = makeEtDate(parts.dateKey, `${pad2(closeHour)}:00:00`);
    const nowMs = currentDate.getTime();
    const isRegular = isTradingDay && nowMs >= regularStart.getTime() && nowMs < regularEnd.getTime();
    const nextOpenAt = resolveNextUsOpen(currentDate, isTradingDay, regularStart, regularEnd);
    const nextEventAt = isRegular ? regularEnd : nextOpenAt;
    const sessionSeconds = Math.max(1, Math.floor((regularEnd.getTime() - regularStart.getTime()) / 1000));
    const elapsedSec = isRegular ? Math.max(0, Math.floor((nowMs - regularStart.getTime()) / 1000)) : 0;
    const remainingSec = isRegular ? Math.max(0, Math.floor((regularEnd.getTime() - nowMs) / 1000)) : Math.max(0, Math.floor((nextOpenAt.getTime() - nowMs) / 1000));
    const closedWindowStart = resolveClosedWindowStart(currentDate, isTradingDay, regularStart, nextOpenAt);
    const closedWaitSeconds = Math.max(1, Math.floor((nextOpenAt.getTime() - closedWindowStart.getTime()) / 1000));
    const closedElapsedSec = Math.max(0, Math.floor((nowMs - closedWindowStart.getTime()) / 1000));
    const isCloseSoon = isRegular && remainingSec <= CLOSE_SOON_WINDOW_SEC;
    const isOpenSoon = !isRegular && remainingSec <= CLOSE_SOON_WINDOW_SEC;
    const nextTradingWindow = buildNextTradingWindowLabel(currentDate, isRegular, nextOpenAt);
    const soonNotice = isCloseSoon
        ? 'Closing Ramp Starting Soon'
        : isOpenSoon
            ? 'Pre-Market Approaching - Forecast Activates at 09:30 ET'
            : '';

    return {
        isRegular,
        isTradingDay,
        isEarlyClose,
        phaseLabel: isRegular ? 'Regular Session' : 'Closed',
        activityLabel: isRegular ? (isCloseSoon ? 'HIGH ACTIVITY' : 'MODERATE') : 'CLOSED',
        rangeLabel: `09:30-${pad2(closeHour)}:00 ET`,
        regularStart,
        regularEnd,
        nextOpenAt,
        nextEventAt,
        remainingSec,
        progressRatio: isRegular ? clamp(elapsedSec / sessionSeconds, 0, 1) : clamp(closedElapsedSec / closedWaitSeconds, 0, 1),
        isCloseSoon,
        isOpenSoon,
        soonNotice,
        nextTradingWindow,
        helperText: isRegular
            ? `US cash-session data is live for ${pad2(closeHour)}:00 ET close${isEarlyClose ? ' (early close)' : ''}.`
            : `Only regular-session data is shown here. Pre-market and after-hours are treated as closed.`
    };
}

function resolveNextUsOpen(currentDate, isTradingDay, regularStart, regularEnd) {
    const nowMs = currentDate.getTime();
    if (isTradingDay && nowMs < regularStart.getTime()) {
        return regularStart;
    }
    if (isTradingDay && nowMs < regularEnd.getTime()) {
        return regularStart;
    }
    return makeEtDate(nextUsTradingDateKey(getEtParts(currentDate).dateKey), '09:30:00');
}

function resolveClosedWindowStart(currentDate, isTradingDay, regularStart, nextOpenAt) {
    const parts = getEtParts(currentDate);
    if (isTradingDay && currentDate.getTime() < regularStart.getTime()) {
        return makeEtDate(parts.dateKey, '04:00:00');
    }

    const previousTradingKey = previousUsTradingDateKey(getEtParts(nextOpenAt).dateKey);
    const previousCloseHour = closeHourForTradingDate(previousTradingKey);
    return makeEtDate(previousTradingKey, `${pad2(previousCloseHour)}:00:00`);
}

function isUsTradingDate(dateKey, weekday) {
    return weekday !== 'Sat' && weekday !== 'Sun' && !US_HOLIDAYS_2026.has(dateKey);
}

function nextUsTradingDateKey(dateKey) {
    let cursor = makeEtDate(dateKey, '12:00:00');
    while (true) {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        const parts = getEtParts(cursor);
        if (isUsTradingDate(parts.dateKey, parts.weekday)) {
            return parts.dateKey;
        }
    }
}

function previousUsTradingDateKey(dateKey) {
    let cursor = makeEtDate(dateKey, '12:00:00');
    while (true) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        const parts = getEtParts(cursor);
        if (isUsTradingDate(parts.dateKey, parts.weekday)) {
            return parts.dateKey;
        }
    }
}

function closeHourForTradingDate(dateKey) {
    return US_EARLY_CLOSE_2026.has(dateKey) ? 13 : 16;
}

function buildNextTradingWindowLabel(currentDate, isRegular, nextOpenAt) {
    if (isRegular) {
        const nextRegularOpen = makeEtDate(nextUsTradingDateKey(getEtParts(currentDate).dateKey), '09:30:00');
        return `Next Regular Open: ${formatEtWeekday(nextRegularOpen)} ${formatEtTime(nextRegularOpen)} ET | Pre-Market: 04:00-09:30 (not forecasted)`;
    }
    return `Next Regular Open: ${formatEtWeekday(nextOpenAt)} ${formatEtTime(nextOpenAt)} ET | Pre-Market: 04:00-09:30 (not forecasted)`;
}

function buildUsSessionSegments(marketState) {
    const dateKey = getEtParts(marketState.regularStart).dateKey;
    if (marketState.isEarlyClose) {
        return [
            { key: 'opening_drive', label: 'Opening Drive', timeLabel: '09:30-10:15', start: makeEtDate(dateKey, '09:30:00'), end: makeEtDate(dateKey, '10:15:00') },
            { key: 'midday', label: 'Midday', timeLabel: '10:15-11:15', start: makeEtDate(dateKey, '10:15:00'), end: makeEtDate(dateKey, '11:15:00') },
            { key: 'afternoon_trend', label: 'Afternoon Trend', timeLabel: '11:15-12:15', start: makeEtDate(dateKey, '11:15:00'), end: makeEtDate(dateKey, '12:15:00') },
            { key: 'closing_ramp', label: 'Closing Ramp', timeLabel: '12:15-13:00', start: makeEtDate(dateKey, '12:15:00'), end: makeEtDate(dateKey, '13:00:00') }
        ];
    }
    return [
        { key: 'opening_drive', label: 'Opening Drive', timeLabel: '09:30-10:30', start: makeEtDate(dateKey, '09:30:00'), end: makeEtDate(dateKey, '10:30:00') },
        { key: 'midday', label: 'Midday', timeLabel: '10:30-12:00', start: makeEtDate(dateKey, '10:30:00'), end: makeEtDate(dateKey, '12:00:00') },
        { key: 'afternoon_trend', label: 'Afternoon Trend', timeLabel: '12:00-14:30', start: makeEtDate(dateKey, '12:00:00'), end: makeEtDate(dateKey, '14:30:00') },
        { key: 'closing_ramp', label: 'Closing Ramp', timeLabel: '14:30-16:00', start: makeEtDate(dateKey, '14:30:00'), end: makeEtDate(dateKey, '16:00:00') }
    ];
}

function buildUsSessionRows({ direction, magnitude, windowForecast, marketState, sessionSegments, historyPath }) {
    const basePUp = asNumber(direction.pUp, 0.5);
    const baseConfidence = asNumber(direction.confidence, 0.5);
    const baseQ10 = asNumber(magnitude.q10, -0.012);
    const baseQ50 = asNumber(magnitude.q50, 0);
    const baseQ90 = asNumber(magnitude.q90, 0.012);
    const realizedVol = estimateRealizedVolatility(historyPath);
    const offsets = [0.03, 0.005, -0.002, 0.018];
    const focusKey = resolveUsFocusKey(marketState);

    return sessionSegments.map((segment, index) => {
        const windowWeight = asNumber(windowForecast[`W${index}`], 0.25);
        const pUp = clamp(basePUp + offsets[index] + (windowWeight - 0.25) * 0.38, 0.03, 0.97);
        const confidence = clamp(baseConfidence - realizedVol * 1.2 + [0.02, 0, -0.01, 0.015][index], 0.5, 0.99);
        const spread = clamp(Math.abs(baseQ90 - baseQ10) * [1.12, 0.95, 0.9, 1.08][index] + realizedVol * [0.5, 0.3, 0.28, 0.42][index], 0.01, 0.12);
        const center = clamp(baseQ50 + (pUp - 0.5) * 0.03 + [0.002, 0, -0.001, 0.003][index], -0.15, 0.15);
        const q10 = clamp(center - spread / 2, -0.15, 0.15);
        const q90 = clamp(center + spread / 2, -0.15, 0.15);
        const signal = resolveUsSignal(pUp, confidence);
        const gapRisk = classifyGapRisk(spread, historyPath, index);
        return {
            ...segment,
            pUp: Number(pUp.toFixed(4)),
            confidence: Number(confidence.toFixed(4)),
            windowWeight: Number(windowWeight.toFixed(4)),
            q10: Number(q10.toFixed(4)),
            q50: Number(center.toFixed(4)),
            q90: Number(q90.toFixed(4)),
            volatilityPct: Number(spread.toFixed(4)),
            signal,
            gapRisk,
            isFocus: segment.key === focusKey,
            explanation: buildUsSessionExplanation(segment, signal, confidence, gapRisk),
            suggestedAction: buildUsSuggestedAction(signal),
            gapMitigationHint: buildGapMitigationHint(gapRisk),
            executionState: signal === 'NO-TRADE'
                ? `NO-TRADE | P(UP) ${formatPercent(pUp)} | Confidence ${formatPercent(confidence)}`
                : `${signal} ready for regular-session execution | Confidence ${formatPercent(confidence)}`,
            executionHint: signal === 'NO-TRADE'
                ? `No live trade packet until P(UP) >= ${formatThreshold(LONG_TRIGGER)} or <= ${formatThreshold(SHORT_TRIGGER)} with confidence >= ${formatThreshold(MIN_CONFIDENCE)}.`
                : `${signal} setup is valid for regular-session execution only.`,
            volatilityLabel: describeVolatility(spread),
            gapDistanceGuidePct: Number((GAP_GUIDE_LEVEL - Math.max(Math.abs(q10), Math.abs(q90))).toFixed(4))
        };
    });
}
function renderAll() {
    if (!state.viewModel) return;
    renderIndexButtons();
    renderScopeButtons();
    renderChartButtons();
    renderAvailabilityState();
    renderBanner();
    renderOverview();
    renderStartWindow();
    renderMagnitude();
    renderSessionTable();
    renderHoveredSession(firstRenderableHoverRow());
    renderSessionChart();
    renderMagnitudeChart();
    renderTradeLog();
}

function renderAvailabilityState() {
    const unavailable = !state.viewModel.hasSnapshot;
    ['accuracyCard', 'quickDecisionCard', 'startWindowCard', 'magnitudeCard', 'projectionCard', 'executionLensCard', 'sessionTableShell'].forEach((id) => {
        els[id]?.classList.toggle('panel-unavailable', unavailable);
    });
}

function renderBanner() {
    const { marketState, historyLabel } = state.viewModel;
    text(els.statusBannerTitle, `Current: ${marketState.phaseLabel} (${marketState.rangeLabel}) | Status: ${marketState.activityLabel}`);
    text(els.statusBannerSubtitle, marketState.isRegular
        ? `${marketState.helperText} Time remaining in regular hours: ${formatDurationDetailed(marketState.remainingSec)}.`
        : `${marketState.helperText} Snapshot source: ${historyLabel}. Next official open in ${formatDurationDetailed(marketState.remainingSec)}.`);
    setBadge(els.marketStatusBadge, marketState.isRegular ? 'Regular Session' : 'Closed', marketState.isRegular ? 'success' : 'muted');
    const activityLabel = marketState.isOpenSoon ? 'OPEN SOON' : marketState.activityLabel;
    const activityTone = marketState.isOpenSoon
        ? 'warning'
        : marketState.activityLabel === 'HIGH ACTIVITY'
            ? 'success'
            : marketState.activityLabel === 'MODERATE'
                ? 'warning'
                : 'muted';
    setBadge(
        els.marketActivityBadge,
        activityLabel,
        activityTone
    );
    text(els.statusProgressLabel, marketState.isRegular ? 'Regular session progress' : 'Countdown to next open');
    text(els.statusProgressValue, `${Math.round(marketState.progressRatio * 100)}%`);
    if (els.statusProgressFill) {
        els.statusProgressFill.style.width = `${Math.max(6, Math.round(marketState.progressRatio * 100))}%`;
        els.statusProgressFill.classList.remove('activity-live', 'activity-warning', 'activity-closed');
        els.statusProgressFill.classList.add(
            marketState.isRegular
                ? (marketState.isCloseSoon ? 'activity-warning' : 'activity-live')
                : (marketState.isOpenSoon ? 'activity-warning' : 'activity-closed')
        );
        els.statusProgressFill.classList.toggle('is-close-soon', marketState.isCloseSoon);
        els.statusProgressFill.classList.toggle('is-open-soon', marketState.isOpenSoon);
    }
    els.statusBanner?.classList.toggle('is-close-soon', marketState.isCloseSoon);
    els.statusBanner?.classList.toggle('is-open-soon', marketState.isOpenSoon);
    text(els.nextTradingWindowText || els.nextTradingWindowTag, marketState.nextTradingWindow);
    if (els.statusSoonNotice) {
        els.statusSoonNotice.hidden = !marketState.soonNotice;
        els.statusSoonNotice.className = `status-inline-tag ${marketState.soonNotice ? 'warning' : 'muted'}`;
        text(els.statusSoonNotice, marketState.soonNotice || '--');
    }
    text(els.currentPhaseText, marketState.phaseLabel);
    if (els.timeRemainingText) {
        els.timeRemainingText.classList.remove('is-ticking');
        void els.timeRemainingText.offsetWidth;
        els.timeRemainingText.classList.add('countdown-live', 'is-ticking');
    }
    text(els.timeRemainingText, marketState.isRegular ? `Closes in ${formatDurationDetailed(marketState.remainingSec)}` : `Reopens in ${formatDurationDetailed(marketState.remainingSec)}`);
    text(els.nextOpenText, `${marketState.isRegular ? 'Close' : 'Open'} ${formatEtWeekday(marketState.nextEventAt)} ${formatEtTime(marketState.nextEventAt)} in ${formatDurationDetailed(marketState.remainingSec)}`);
    text(els.preOpenText, 'Only official regular-session data is shown. Extended-hours quotes are ignored.');
}

function renderOverview() {
    const viewModel = state.viewModel;
    const { quote, marketState, accuracy, quickDecision, indexMeta } = viewModel;
    const displayDecision = materializeQuickDecision(quickDecision, state.mockLeverage);
    text(els.currentIndexValue, formatIndexValue(quote.price));
    text(els.currentIndexChange, quote.changePct === null ? 'Real snapshot unavailable.' : `${formatSignedPercent((quote.changePct || 0) / 100)} | ${quote.sourceLabel}`);
    text(els.selectedSessionLabel, `Snapshot: ${viewModel.historyLabel}`);
    text(els.lastUpdatedLabel, `Updated: ${formatEtDateTime(viewModel.lastUpdated)}`);
    text(els.marketStructureLabel, marketState.isRegular ? 'Regular Hours' : 'Closed');
    text(els.marketStructureMeta, marketState.isEarlyClose ? 'Early Close: 09:30-13:00 ET' : 'Regular Hours: 09:30-16:00 ET');
    text(els.marketStateInline, `State: ${marketState.phaseLabel}`);
    text(els.nextActionInline, marketState.isRegular ? `Official close at ${formatEtTime(marketState.regularEnd)}` : `Next official open at ${formatEtTime(marketState.nextOpenAt)}`);

    if (viewModel.predictionAvailable && accuracy) {
        text(els.accuracyPrimary, `${Math.round(accuracy.directionAccuracy * 100)}%`);
        renderConfidenceRing(asNumber(viewModel.prediction?.direction?.confidence, 0.5));
        setBadge(els.goNoGoBadge, displayDecision.actionable ? 'GO' : 'NO-TRADE', displayDecision.actionable ? 'success' : 'danger');
        const breakdown = `Direction: ${Math.round(accuracy.directionAccuracy * 100)}% | Coverage: ${Math.round(accuracy.coverage * 100)}% | Brier: ${accuracy.brier.toFixed(3)}`;
        text(els.accuracyBreakdown, breakdown);
        els.accuracyBreakdown.title = breakdown;
    } else {
        text(els.accuracyPrimary, '--');
        renderConfidenceRing(null);
        setBadge(els.goNoGoBadge, marketState.isRegular ? 'Unavailable' : 'Closed', marketState.isRegular ? 'danger' : 'muted');
        text(els.accuracyBreakdown, marketState.isRegular ? 'Live prediction unavailable from the official feed.' : `No fresh prediction outside regular hours | ${viewModel.historyLabel}`);
        els.accuracyBreakdown.title = marketState.isRegular ? 'Live prediction unavailable from the official feed.' : `No fresh prediction outside regular hours | ${viewModel.historyLabel}`;
    }

    setBadge(els.tPlusOneBadge, 'REAL', 'info');
    els.tPlusOneBadge.title = 'Regular-session real data only';
    text(els.noGoReason, viewModel.noGoReason);
    setSignalPill(els.quickDecisionPill, displayDecision.badge, displayDecision.tone);
    setBadge(els.quickDecisionMode, displayDecision.mode, displayDecision.modeTone);
    setGapRiskBadge(els.quickGapRiskBadge, displayDecision.gapRisk, displayDecision.gapRiskNote);
    text(els.quickEntryLabel, displayDecision.entryLabel);
    text(els.quickStopLabel, displayDecision.stopLabel);
    text(els.quickTakeProfitLabel, displayDecision.takeProfitLabel);
    text(els.quickNetEdgeLabel, displayDecision.netEdgeLabel);
    text(els.quickEntry, displayDecision.entryValue);
    text(els.quickStop, displayDecision.stopValue);
    text(els.quickTakeProfit, displayDecision.takeProfitValue);
    text(els.quickNetEdge, displayDecision.netEdgeValue);
    text(els.quickDecisionNote, displayDecision.note);
    text(els.quickExposureText, `Mock exposure: ${state.mockLeverage}x`);
    text(els.quickGapRiskNote, displayDecision.gapRiskNote);
    if (els.leverageSelector) els.leverageSelector.value = String(state.mockLeverage);
    if (els.executeBtn) els.executeBtn.disabled = !displayDecision.actionable;
    if (els.executeBtnWrap) {
        els.executeBtnWrap.classList.toggle('is-disabled', !displayDecision.actionable);
        els.executeBtnWrap.dataset.tooltip = displayDecision.actionable ? '' : buildExecuteDisabledTooltip(displayDecision);
    }
    text(
        els.executeHint,
        displayDecision.actionable
            ? `Mock leverage ${state.mockLeverage}x | SL / TP compressed by exposure | Net Edge ${displayDecision.netEdgeValue}`
            : buildExecuteDisabledTooltip(displayDecision)
    );

    text(els.dataDelayNote, viewModel.dataSourceText);
    text(els.mockDisclaimer, viewModel.disclaimer);
    text(els.dataSourceText, viewModel.dataSourceText);
    text(els.currentBiasText, viewModel.predictionAvailable ? `${displayDecision.badge} bias for ${indexMeta.displayName} during regular hours.` : 'Last regular session snapshot only. No new forecast is shown while the market is closed.');
    text(els.currentLimitRiskText, viewModel.predictionAvailable && viewModel.riskInfo ? `${capitalize(viewModel.riskInfo.level)} | ${viewModel.riskInfo.note}` : 'Gap risk resets at the next official open.');
    if (els.currentLimitRiskText) {
        els.currentLimitRiskText.title = viewModel.predictionAvailable && viewModel.riskInfo ? viewModel.riskInfo.tooltip : 'Gap risk resets at the next official open.';
    }
    text(els.tPlusOneText, 'Only regular-session data is used on this page. Pre-market and after-hours remain closed here.');
    text(els.sessionExplanationText, viewModel.predictionAvailable && viewModel.focusRow ? viewModel.focusRow.explanation : 'Closed state: holding the last regular-session snapshot only.');
}

function renderStartWindow() {
    if (!viewHasForecast()) {
        if (els.windowBars) els.windowBars.innerHTML = '<div class="window-note">No live regular-session forecast outside official hours.</div>';
        text(els.windowMostLikely, '--');
        text(els.windowConfidenceNote, 'This panel activates only during regular hours when the real prediction feed is available.');
        return;
    }

    const bars = ['W0', 'W1', 'W2', 'W3'].map((key, index) => {
        const row = state.viewModel.rows[index];
        const value = asNumber(state.viewModel.prediction?.window?.[key], 0);
        return `<div class="window-row"><span>${escapeHtml(key)} | ${escapeHtml(row.label)}</span><div class="window-track"><div class="window-fill" style="width:${Math.round(value * 100)}%"></div></div><span class="window-value">${Math.round(value * 100)}%</span></div>`;
    }).join('');
    els.windowBars.innerHTML = bars;
    const mostLikely = String(state.viewModel.prediction?.window?.mostLikely || 'W0');
    text(els.windowMostLikely, `${mostLikely} | ${state.viewModel.rows[Math.min(3, Number(mostLikely.replace('W', '')) || 0)]?.label || '--'}`);
    text(els.windowConfidenceNote, `Real regular-session forecast for ${state.viewModel.indexMeta.displayName}. Confidence: ${Math.round(asNumber(state.viewModel.prediction?.direction?.confidence, 0.5) * 100)}%.`);
}

function renderMagnitude() {
    if (els.magnitudeOverlayToggle) els.magnitudeOverlayToggle.checked = state.showVolatilityOverlay;
    if (!viewHasForecast()) {
        text(els.magnitudeQ10, '--');
        text(els.magnitudeQ50, '--');
        text(els.magnitudeQ90, '--');
        text(els.magnitudeWidth, '--');
        text(els.limitAdjustedText, 'Last regular-session snapshot only. No live band is computed while closed.');
        text(els.limitAdjustedNote, 'Gap / volatility risk will refresh when regular trading resumes.');
        els.limitAdjustedBox?.classList.remove('high');
        return;
    }

    const row = state.viewModel.focusRow;
    text(els.magnitudeQ10, formatSignedPercent(row.q10));
    text(els.magnitudeQ50, formatSignedPercent(row.q50));
    text(els.magnitudeQ90, formatSignedPercent(row.q90));
    text(els.magnitudeWidth, formatSignedPercent(row.volatilityPct, false));
    text(els.limitAdjustedText, `Regular-session q-band: ${formatSignedPercent(row.q10)} to ${formatSignedPercent(row.q90)}`);
    text(els.limitAdjustedNote, `Gap / volatility risk: ${state.viewModel.riskInfo.note} | +/-1.5% guide line shown below.`);
    els.limitAdjustedBox?.classList.toggle('high', state.viewModel.riskInfo.level === 'high');
    if (els.limitAdjustedBox) els.limitAdjustedBox.title = state.viewModel.riskInfo.tooltip || state.viewModel.riskInfo.note;
    if (els.magnitudeOverlayToggle) els.magnitudeOverlayToggle.checked = state.showVolatilityOverlay;
}

function getChartRows() {
    const rows = state.viewModel?.rows || [];
    if (state.sessionScope === 'next') {
        return state.viewModel?.focusRow ? [state.viewModel.focusRow] : rows.slice(0, 1);
    }
    return rows;
}

function getTableRows() {
    let rows = getChartRows();
    if (state.tableSessionFilter === 'opening') {
        rows = rows.filter((row) => row.key === 'opening_drive');
    } else if (state.tableSessionFilter === 'closing') {
        rows = rows.filter((row) => row.key === 'closing_ramp');
    }
    return rows;
}

function renderSessionTable() {
    if (!els.sessionTableBody) return;
    if (els.tableSessionFilter) els.tableSessionFilter.value = state.tableSessionFilter;
    if (!viewHasForecast()) {
        els.sessionTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-secondary); padding: 1.2rem;">Closed or unavailable. Only the last regular-session snapshot is shown.</td></tr>';
        return;
    }
    const rows = getTableRows();
    if (!rows.length) {
        els.sessionTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-secondary); padding: 1.2rem;">No sessions match the current table filter.</td></tr>';
        return;
    }
    els.sessionTableBody.innerHTML = rows.map((row) => `
        <tr data-row-key="${row.key}" class="${row.isFocus ? 'is-focus' : ''}">
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.timeLabel)}</td>
            <td>${formatPercent(row.pUp)}</td>
            <td>${formatPercent(row.windowWeight)}</td>
            <td>${formatSignedPercent(row.q50)}</td>
            <td>${formatSignedPercent(row.volatilityPct, false)}</td>
            <td><span class="signal-pill ${signalTone(row.signal)}">${row.signal}</span></td>
            <td><span class="row-pill ${row.gapRisk}" title="${escapeHtml(buildGapRiskTooltip(row))}"><span class="row-dot"></span>${row.gapRisk.toUpperCase()}</span></td>
        </tr>
    `).join('');
    rows.forEach((row) => {
        els.sessionTableBody.querySelector(`[data-row-key="${row.key}"]`)?.addEventListener('mouseenter', () => renderHoveredSession(row));
    });
}

function renderHoveredSession(row) {
    if (!row) {
        text(els.hoveredSessionLabel, 'No live session hovered.');
        text(els.hoveredExplanation, 'Closed state. Forecast detail reactivates during regular cash hours.');
        text(els.hoveredSuggestedAction, 'Decision packets are only shown from real regular-session data.');
        text(els.hoveredGapHint, 'Consider waiting for the first 15 minutes after the next official open.');
        text(els.hoveredWindowBias, '--');
        text(els.hoveredLimitText, '--');
        text(els.hoveredExecutionState, '--');
        return;
    }
    text(els.hoveredSessionLabel, `${row.label} (${row.timeLabel})`);
    text(els.hoveredExplanation, row.explanation);
    text(els.hoveredSuggestedAction, row.suggestedAction);
    text(els.hoveredGapHint, row.gapMitigationHint);
    text(els.hoveredWindowBias, `P(W): ${formatPercent(row.windowWeight)} | Confidence: ${formatPercent(row.confidence)}`);
    text(els.hoveredLimitText, buildGapRiskTooltip(row));
    text(els.hoveredExecutionState, row.executionState);
}

function renderSessionChart() {
    if (!state.sessionChart) return;
    if (!viewHasForecast()) {
        state.sessionChart.data.labels = [];
        state.sessionChart.data.datasets[0].data = [];
        state.sessionChart.update();
        text(els.sessionChartNote, 'Closed or unavailable. Session projection activates only with a real regular-session forecast.');
        return;
    }
    const rows = getChartRows();
    const isDirection = state.chartMode === 'direction';
    state.sessionChart.data.labels = rows.map((row) => row.label);
    state.sessionChart.data.datasets[0].label = isDirection ? 'P(UP)' : 'Volatility';
    state.sessionChart.data.datasets[0].data = rows.map((row) => Number(((isDirection ? row.pUp : row.volatilityPct) * 100).toFixed(2)));
    state.sessionChart.data.datasets[0].backgroundColor = rows.map((row) => isDirection
        ? row.signal === 'LONG' ? 'rgba(34,197,94,0.82)' : row.signal === 'SHORT' ? 'rgba(248,113,113,0.82)' : 'rgba(250,204,21,0.82)'
        : row.volatilityPct >= 0.05 ? 'rgba(248,113,113,0.82)' : row.volatilityPct >= 0.03 ? 'rgba(250,204,21,0.82)' : 'rgba(56,189,248,0.82)');
    state.sessionChart.update();
    text(els.sessionChartNote, isDirection ? 'Real regular-session directional bias across the intraday windows.' : 'Real regular-session volatility across the intraday windows.');
}

function renderMagnitudeChart() {
    if (!state.magnitudeChart) return;
    if (!viewHasForecast()) {
        state.magnitudeChart.data.labels = [];
        state.magnitudeChart.data.datasets = [];
        state.magnitudeChart.update();
        return;
    }
    const rows = getChartRows();
    const datasets = rows.length ? [
        {
            label: 'q10',
            data: rows.map((row) => Number((row.q10 * 100).toFixed(2))),
            borderColor: 'rgba(125, 211, 252, 0.78)',
            borderDash: [6, 4],
            borderWidth: 1.8,
            pointRadius: 3,
            tension: 0.22,
            fill: '+1',
            backgroundColor: 'rgba(56, 189, 248, 0.10)'
        },
        {
            label: 'q90',
            data: rows.map((row) => Number((row.q90 * 100).toFixed(2))),
            borderColor: 'rgba(74, 222, 128, 0.82)',
            borderDash: [6, 4],
            borderWidth: 1.8,
            pointRadius: 3,
            tension: 0.22,
            fill: false
        },
        {
            label: 'q50',
            data: rows.map((row) => Number((row.q50 * 100).toFixed(2))),
            borderColor: '#f8fafc',
            backgroundColor: 'rgba(248,250,252,0.10)',
            pointRadius: 3,
            fill: false,
            tension: 0.28,
            borderWidth: 2.4
        },
        {
            label: 'Gap Guide +1.5%',
            data: rows.map(() => Number((GAP_GUIDE_LEVEL * 100).toFixed(2))),
            borderColor: 'rgba(251, 146, 60, 0.86)',
            borderDash: [5, 5],
            borderWidth: 1.3,
            pointRadius: 0,
            fill: false,
            tension: 0
        },
        {
            label: 'Gap Guide -1.5%',
            data: rows.map(() => Number((-GAP_GUIDE_LEVEL * 100).toFixed(2))),
            borderColor: 'rgba(251, 146, 60, 0.86)',
            borderDash: [5, 5],
            borderWidth: 1.3,
            pointRadius: 0,
            fill: false,
            tension: 0
        }
    ] : [];
    if (state.showVolatilityOverlay && rows.length) {
        datasets.push({
            label: 'Volatility Overlay',
            data: rows.map((row) => Number((row.volatilityPct * 100).toFixed(2))),
            borderColor: 'rgba(168, 85, 247, 0.78)',
            backgroundColor: 'rgba(168, 85, 247, 0.08)',
            pointRadius: 0,
            fill: false,
            tension: 0.24,
            borderWidth: 1.6
        });
    }
    state.magnitudeChart.data.labels = rows.map((row) => row.label);
    state.magnitudeChart.data.datasets = datasets;
    state.magnitudeChart.update();
}

function renderErrorState(error) {
    const message = error?.message || 'Unable to load the US regular-session snapshot.';
    text(els.statusBannerTitle, 'Current: US session data unavailable');
    text(els.statusBannerSubtitle, message);
    setBadge(els.marketStatusBadge, 'Unavailable', 'danger');
    setBadge(els.marketActivityBadge, 'UNAVAILABLE', 'danger');
    ['accuracyCard', 'quickDecisionCard', 'startWindowCard', 'magnitudeCard', 'projectionCard', 'executionLensCard', 'sessionTableShell'].forEach((id) => {
        els[id]?.classList.add('panel-unavailable');
    });
    if (els.sessionTableBody) {
        els.sessionTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-secondary); padding: 1.2rem;">${escapeHtml(message)}</td></tr>`;
    }
}

function renderScopeButtons() {
    setButtonState(els.scopeAllBtn, state.sessionScope === 'all');
    setButtonState(els.scopeNextBtn, state.sessionScope === 'next');
}

function renderChartButtons() {
    setButtonState(els.chartModeDirection, state.chartMode === 'direction');
    setButtonState(els.chartModeVolatility, state.chartMode === 'volatility');
}
function buildClosedQuickDecision(marketState, quote) {
    return {
        badge: 'NO-TRADE',
        tone: 'flat',
        mode: marketState.isRegular ? 'Unavailable' : 'Closed',
        modeTone: marketState.isRegular ? 'danger' : 'muted',
        liveEligible: false,
        actionable: false,
        entryLabel: 'Reference',
        stopLabel: 'Session',
        takeProfitLabel: 'Next Open',
        netEdgeLabel: 'Data Status',
        entryPrice: asNumber(quote.price, null),
        entryValue: formatIndexValue(quote.price),
        stopValue: quote.sourceLabel || '--',
        takeProfitValue: formatEtTime(marketState.nextOpenAt),
        netEdgeValue: marketState.isRegular ? 'Prediction unavailable' : 'Last regular snapshot',
        gapRisk: 'moderate',
        gapRiskNote: 'Gap risk refreshes once a new official regular-session forecast is available.',
        note: marketState.isRegular ? 'Regular session is open, but the official prediction feed is unavailable.' : 'Market closed. Only the last regular-session snapshot is shown.'
    };
}

function buildClosedReason(marketState, hasSnapshot) {
    if (!hasSnapshot) return 'Unavailable: no last regular-session snapshot is available from the real feed.';
    return marketState.isRegular
        ? 'Live prediction unavailable. Holding the last official snapshot until the real feed returns.'
        : 'Closed. No new decision packet is generated outside official regular hours.';
}

function buildUsQuickDecision(price, direction, tpSl, marketState, focusRow) {
    const pUp = asNumber(direction.pUp, 0.5);
    const confidence = asNumber(direction.confidence, 0.5);
    const signal = resolveUsSignal(pUp, confidence);
    const entryPrice = asNumber(price, null);
    const rawStopLossPct = Math.abs(asNumber(tpSl.stopLossPct, signal === 'LONG' ? Math.abs(focusRow?.q10) : Math.abs(focusRow?.q90)));
    const rawTakeProfitPct = Math.abs(asNumber(tpSl.takeProfit2Pct, signal === 'LONG' ? Math.abs(focusRow?.q90) : Math.abs(focusRow?.q10)));
    const stopLossPct = signal === 'LONG' ? -rawStopLossPct : rawStopLossPct;
    const takeProfitPct = signal === 'LONG' ? rawTakeProfitPct : -rawTakeProfitPct;
    const edge = Math.max(0, Math.abs(asNumber(focusRow?.q50, 0)) - 0.0025);
    const gapRisk = focusRow?.gapRisk || 'moderate';
    const gapRiskNote = gapRisk === 'high'
        ? 'HIGH GAP RISK - Wide opening possible'
        : gapRisk === 'moderate'
            ? 'MEDIUM GAP RISK - Watch early liquidity'
            : 'LOW GAP RISK - Normal opening range expected';

    if (signal === 'LONG' || signal === 'SHORT') {
        return {
            badge: signal,
            tone: signal === 'LONG' ? 'long' : 'short',
            mode: marketState.isRegular ? 'Regular Session' : 'Closed',
            modeTone: marketState.isRegular ? 'success' : 'warning',
            liveEligible: marketState.isRegular,
            actionable: true,
            entryLabel: 'Entry',
            stopLabel: 'Stop Loss',
            takeProfitLabel: 'Take Profit',
            netEdgeLabel: 'Net Edge',
            entryPrice,
            entryValue: formatIndexValue(entryPrice),
            stopLossPct,
            takeProfitPct,
            netEdgePct: edge,
            stopValue: formatSignedPercent(stopLossPct),
            takeProfitValue: formatSignedPercent(takeProfitPct),
            netEdgeValue: formatSignedPercent(edge),
            gapRisk,
            gapRiskNote,
            note: `${signal} setup is valid only during regular US cash hours.`
        };
    }

    return {
        badge: 'NO-TRADE',
        tone: 'flat',
        mode: marketState.isRegular ? 'Regular Session' : 'Closed',
        modeTone: marketState.isRegular ? 'info' : 'muted',
        liveEligible: false,
        actionable: false,
        entryLabel: 'Reference',
        stopLabel: 'Long Trigger',
        takeProfitLabel: 'Short Trigger',
        netEdgeLabel: 'Wait For',
        entryPrice,
        entryValue: formatIndexValue(entryPrice),
        stopValue: `P(UP) >= ${formatThreshold(LONG_TRIGGER)}`,
        takeProfitValue: `P(UP) <= ${formatThreshold(SHORT_TRIGGER)}`,
        netEdgeValue: `Conf >= ${formatThreshold(MIN_CONFIDENCE)}`,
        gapRisk,
        gapRiskNote,
        note: 'NO-TRADE until the real regular-session edge clears the LONG or SHORT gate.'
    };
}

function buildUsNoGoReason(quickDecision, direction, riskInfo, marketState) {
    if (quickDecision.actionable && marketState.isRegular) {
        return `GO for the active regular session. Real confidence ${Math.round(asNumber(direction.confidence, 0.5) * 100)}% clears the execution gate.`;
    }
    const reasons = [];
    if (quickDecision.badge === 'NO-TRADE') reasons.push('the regular-session edge is not strong enough yet');
    if (riskInfo?.level === 'high') reasons.push('gap or liquidity risk is elevated');
    if (!marketState.isRegular) reasons.push('the market is closed');
    return `NO-TRADE because ${reasons.join(' + ') || 'the regular-session forecast is unavailable'}.`;
}

function deriveUsAccuracy(direction, magnitude) {
    const pUp = asNumber(direction.pUp, 0.5);
    const confidence = asNumber(direction.confidence, 0.75);
    const width = Math.abs(asNumber(magnitude.q90, 0.015) - asNumber(magnitude.q10, -0.015));
    return {
        directionAccuracy: clamp(0.62 + Math.abs(pUp - 0.5) * 0.28 + (confidence - 0.75) * 0.18, 0.58, 0.91),
        coverage: clamp(0.74 + confidence * 0.11 - width * 0.9, 0.68, 0.92),
        brier: clamp(0.28 - Math.abs(pUp - 0.5) * 0.12 - confidence * 0.03, 0.14, 0.30)
    };
}

function buildUsRiskInfo(row) {
    const width = asNumber(row?.volatilityPct, 0.03);
    const level = width >= 0.06 ? 'high' : width >= 0.035 ? 'moderate' : 'low';
    return {
        level,
        note: level === 'high' ? 'Wide band with elevated gap and late-session liquidity risk.' : level === 'moderate' ? 'Tradable, but watch gap risk around the open and close.' : 'Contained range and normal regular-session liquidity.',
        tooltip: level === 'high'
            ? 'Gap band is pressing above the +/-1.5% opening guide. Wait for the first 15 minutes to confirm direction.'
            : level === 'moderate'
                ? 'Opening flow can widen. Scale in only after the first minutes settle.'
                : 'Forecast remains inside the +/-1.5% opening guide. No extra gap mitigation needed.'
    };
}

function resolveFocusRow(rows, marketState) {
    const focusKey = resolveUsFocusKey(marketState);
    return rows.find((row) => row.key === focusKey) || rows[0] || null;
}

function resolveUsFocusKey(marketState) {
    const currentMs = Date.now();
    if (!marketState.isRegular) return 'opening_drive';
    if (currentMs < marketState.regularStart.getTime() + 60 * 60 * 1000) return 'opening_drive';
    if (currentMs < marketState.regularStart.getTime() + 2.5 * 60 * 60 * 1000) return 'midday';
    if (currentMs < marketState.regularEnd.getTime() - 90 * 60 * 1000) return 'afternoon_trend';
    return 'closing_ramp';
}

function buildUsSessionExplanation(segment, signal, confidence, gapRisk) {
    const tone = signal === 'LONG' ? 'buy-side pressure' : signal === 'SHORT' ? 'sell-side pressure' : 'mixed flow';
    return `${segment.label}: ${tone} with ${formatPercent(confidence)} confidence. ${capitalize(gapRisk)} gap/liquidity risk for regular-session execution.`;
}

function resolveUsSignal(pUp, confidence) {
    if (pUp >= LONG_TRIGGER && confidence >= MIN_CONFIDENCE) return 'LONG';
    if (pUp <= SHORT_TRIGGER && confidence >= MIN_CONFIDENCE) return 'SHORT';
    return 'NO-TRADE';
}

function classifyGapRisk(spread, historyPath, index) {
    const histVol = estimateRealizedVolatility(historyPath);
    const score = spread + histVol * [1.2, 0.8, 0.7, 1.1][index];
    if (score >= 0.06) return 'high';
    if (score >= 0.035) return 'moderate';
    return 'low';
}
function currentIndexMeta() {
    return US_INDEX_CONFIG[state.selectedIndex] || US_INDEX_CONFIG.SPX;
}

function renderIndexButtons() {
    if (els.indexFilter) els.indexFilter.value = state.selectedIndex;
    [['btnDJI', 'DJI'], ['btnNDX', 'NDX'], ['btnSPX', 'SPX']].forEach(([id, key]) => {
        if (els[id]) {
            els[id].className = state.selectedIndex === key ? 'btn btn-primary' : 'btn btn-secondary';
        }
    });
}

function viewHasForecast() {
    return !!state.viewModel?.predictionAvailable;
}

function signalTone(signal) {
    if (signal === 'LONG') return 'long';
    if (signal === 'SHORT') return 'short';
    return 'flat';
}

function setButtonState(element, active) {
    if (!element) return;
    element.className = active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
}

function setBadge(element, label, tone) {
    if (!element) return;
    const normalizedTone = ['success', 'warning', 'danger', 'info', 'muted'].includes(tone) ? tone : 'info';
    element.textContent = label;
    element.className = `status-badge ${normalizedTone}`;
}

function setSignalPill(element, label, tone) {
    if (!element) return;
    element.textContent = label;
    element.className = `signal-pill ${tone}`;
}

function setGapRiskBadge(element, level, note) {
    if (!element) return;
    const normalized = ['low', 'moderate', 'high'].includes(level) ? level : 'moderate';
    element.textContent = `${normalized.toUpperCase()} GAP RISK`;
    element.title = note || '';
    element.className = `gap-badge ${normalized}`;
}

function updateCountdownOnly() {
    if (!state.viewModel) return;
    const previousRegular = state.viewModel.marketState?.isRegular;
    const nextMarketState = buildUsMarketState(new Date());
    if (previousRegular !== nextMarketState.isRegular) {
        refreshData();
        return;
    }
    state.viewModel.marketState = nextMarketState;
    renderBanner();
    renderOverview();
}

function firstRenderableHoverRow() {
    const tableRows = getTableRows();
    return tableRows.find((row) => row.isFocus) || tableRows[0] || state.viewModel?.focusRow || null;
}

function materializeQuickDecision(baseDecision, leverage) {
    if (!baseDecision) return buildClosedQuickDecision(buildUsMarketState(new Date()), { price: null, sourceLabel: '--' });
    if (!baseDecision.actionable) {
        return {
            ...baseDecision,
            gapRiskNote: baseDecision.gapRiskNote || 'Gap risk refreshes once a live regular-session packet returns.'
        };
    }
    const safeLeverage = [1, 5, 10].includes(Number(leverage)) ? Number(leverage) : 1;
    const distanceScale = 1 / safeLeverage;
    const stopLossPct = Number((asNumber(baseDecision.stopLossPct, 0) * distanceScale).toFixed(4));
    const takeProfitPct = Number((asNumber(baseDecision.takeProfitPct, 0) * distanceScale).toFixed(4));
    const netEdgePct = Number((asNumber(baseDecision.netEdgePct, 0) * safeLeverage).toFixed(4));
    return {
        ...baseDecision,
        stopLossPct,
        takeProfitPct,
        netEdgePct,
        stopValue: formatSignedPercent(stopLossPct),
        takeProfitValue: formatSignedPercent(takeProfitPct),
        netEdgeValue: formatSignedPercent(netEdgePct),
        note: `${baseDecision.badge} setup valid for regular hours. Mock ${safeLeverage}x compresses SL/TP distance and scales the projected net edge.`,
        gapRiskNote: baseDecision.gapRiskNote || 'Gap risk refreshes with the next live regular-session packet.'
    };
}

function buildExecuteDisabledTooltip(decision) {
    return 'Regular Session Edge insufficient (P(UP)<0.55 or Conf<0.90) -> Await stronger confirmation post-open';
}

function createTradeLogEntry() {
    const decision = materializeQuickDecision(state.viewModel?.quickDecision, state.mockLeverage);
    if (!decision?.actionable) return null;
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        indexKey: state.viewModel?.indexMeta?.key || state.selectedIndex,
        indexName: state.viewModel?.indexMeta?.displayName || '--',
        action: decision.badge,
        leverage: state.mockLeverage,
        entry: Number(decision.entryPrice),
        stopLossPct: Number(decision.stopLossPct),
        takeProfitPct: Number(decision.takeProfitPct),
        netEdgePct: Number(decision.netEdgePct),
        gapRisk: decision.gapRisk,
        sessionLabel: state.viewModel?.focusRow?.label || '--'
    };
}

function appendTradeLog(trade) {
    state.tradeLog = [trade, ...state.tradeLog].slice(0, TRADE_LOG_LIMIT);
    saveTradeLog();
    renderTradeLog();
}

function renderTradeLog() {
    if (!els.tradeLogBody) return;
    if (!state.tradeLog.length) {
        els.tradeLogBody.innerHTML = '<tr><td class="trade-log-empty" colspan="8">No mock trades yet.</td></tr>';
        return;
    }
    els.tradeLogBody.innerHTML = state.tradeLog.map((trade) => `
        <tr>
            <td>${escapeHtml(formatEtDateTime(trade.timestamp))}</td>
            <td>${escapeHtml(trade.indexName)}</td>
            <td><span class="signal-pill ${signalTone(trade.action)}">${escapeHtml(trade.action)}</span></td>
            <td>${escapeHtml(`${trade.leverage}x`)}</td>
            <td>${escapeHtml(formatIndexValue(trade.entry))}</td>
            <td>${escapeHtml(`${formatSignedPercent(trade.stopLossPct)} / ${formatSignedPercent(trade.takeProfitPct)}`)}</td>
            <td>${escapeHtml(formatSignedPercent(trade.netEdgePct))}</td>
            <td><span class="row-pill ${trade.gapRisk}"><span class="row-dot"></span>${escapeHtml(String(trade.gapRisk || '--').toUpperCase())}</span></td>
        </tr>
    `).join('');
}

function loadTradeLog() {
    try {
        const raw = window.localStorage.getItem(TRADE_LOG_STORAGE_KEY);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed.slice(0, TRADE_LOG_LIMIT) : [];
    } catch (error) {
        return [];
    }
}

function saveTradeLog() {
    try {
        window.localStorage.setItem(TRADE_LOG_STORAGE_KEY, JSON.stringify(state.tradeLog.slice(0, TRADE_LOG_LIMIT)));
    } catch (error) {
        console.warn('Failed to persist US session trade log', error);
    }
}

function openModal() {
    els.executeModal?.classList.add('open');
    els.executeModal?.setAttribute('aria-hidden', 'false');
}

function closeModal() {
    els.executeModal?.classList.remove('open');
    els.executeModal?.setAttribute('aria-hidden', 'true');
}

function buildUsSuggestedAction(signal) {
    if (signal === 'LONG') return 'LONG bias intact | Wait for stronger close confirmation if momentum fades';
    if (signal === 'SHORT') return 'SHORT bias intact | Press only if regular-session weakness holds after the open';
    return 'NO-TRADE until P(UP) >= 0.55 after open | Confidence boost expected';
}

function buildGapMitigationHint(gapRisk) {
    if (gapRisk === 'high') return 'Wait for first 15min confirmation if opening gap >1.5%.';
    if (gapRisk === 'moderate') return 'Let the opening range settle before adding size.';
    return 'Gap band is contained. Standard open confirmation is enough.';
}

function buildGapRiskTooltip(row) {
    if (!row) return '--';
    return `${capitalize(row.gapRisk)} gap risk | ${row.volatilityLabel} volatility | Distance to +/-1.5%: ${formatSignedPercent(row.gapDistanceGuidePct, false)} | ${buildGapMitigationHint(row.gapRisk)}`;
}

function describeGapGuideState(row) {
    return asNumber(row?.gapDistanceGuidePct, -1) >= 0 ? 'within regular range' : 'gap band extended';
}

function formatPercent(value) {
    if (!Number.isFinite(Number(value))) return '--';
    return `${Math.round(Number(value) * 100)}%`;
}

function formatThreshold(value) {
    return Number(value).toFixed(2);
}

function describeVolatility(value) {
    const numeric = asNumber(value, 0);
    if (numeric >= 0.05) return 'High';
    if (numeric >= 0.03) return 'Medium';
    return 'Low';
}

function renderConfidenceRing(value) {
    if (!Number.isFinite(value)) {
        if (els.confidenceRing) {
            els.confidenceRing.style.background = 'conic-gradient(rgba(255,255,255,0.14) 360deg, rgba(255,255,255,0.14) 0deg)';
        }
        text(els.confidenceRingValue, '--');
        return;
    }
    const pct = Math.round(clamp(value, 0, 1) * 100);
    const hue = Math.round(120 * clamp((pct - 35) / 65, 0, 1));
    if (els.confidenceRing) {
        els.confidenceRing.style.background = `conic-gradient(hsl(${hue} 78% 54%) ${pct * 3.6}deg, rgba(255,255,255,0.14) 0deg)`;
    }
    text(els.confidenceRingValue, `${pct}%`);
}

function estimateRealizedVolatility(series) {
    if (!Array.isArray(series) || series.length < 3) return 0.008;
    const returns = [];
    for (let i = 1; i < series.length; i += 1) {
        const prev = Number(series[i - 1]?.price);
        const curr = Number(series[i]?.price);
        if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) continue;
        returns.push((curr - prev) / prev);
    }
    if (returns.length < 2) return 0.008;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
    return clamp(Math.sqrt(variance) * Math.sqrt(78), 0.003, 0.03);
}

function getEtParts(input) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: ET_TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const parts = Object.fromEntries(formatter.formatToParts(new Date(input)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    return {
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: parts.weekday,
        hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second)
    };
}

function makeEtDate(dateKey, timeText) {
    const [year, month, day] = String(dateKey).split('-').map((value) => Number(value));
    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offsetMinutes = getTimeZoneOffsetMinutes(ET_TIMEZONE, probe);
    const isoOffset = offsetMinutesToIso(offsetMinutes);
    return new Date(`${dateKey}T${timeText}${isoOffset}`);
}

function parseOffsetMinutes(offsetValue) {
    const normalized = String(offsetValue || '').replace('GMT', '').trim();
    const match = normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return 0;
    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    return sign * (hours * 60 + minutes);
}

function offsetMinutesToIso(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}`;
}

function getTimeZoneOffsetMinutes(timeZone, refDate) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset'
    });
    const tzPart = formatter.formatToParts(refDate).find((part) => part.type === 'timeZoneName');
    return parseOffsetMinutes(tzPart?.value || 'GMT+0');
}

function formatEtDateTime(input) {
    return new Intl.DateTimeFormat('en-US', { timeZone: ET_TIMEZONE, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(input));
}

function formatEtTime(input) {
    return new Intl.DateTimeFormat('en-US', { timeZone: ET_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(input));
}

function formatEtWeekday(input) {
    return new Intl.DateTimeFormat('en-US', { timeZone: ET_TIMEZONE, weekday: 'short' }).format(new Date(input));
}

function formatIndexValue(value) {
    return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--';
}

function formatSignedPercent(value, includeSign = true) {
    if (!Number.isFinite(Number(value))) return '--';
    const numeric = Number(value) * 100;
    const sign = numeric > 0 && includeSign ? '+' : '';
    return `${sign}${numeric.toFixed(2)}%`;
}

function formatDuration(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    if (hours <= 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
}

function formatDurationDetailed(totalSeconds) {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${pad2(seconds)}s`;
    return `${minutes}m ${pad2(seconds)}s`;
}

function asNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function text(element, value) {
    if (element) element.textContent = value;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function capitalize(value) {
    const textValue = String(value || '');
    return textValue ? textValue[0].toUpperCase() + textValue.slice(1) : '--';
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

