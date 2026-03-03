// ========================================
// StockandCrypto - Crypto Page Logic
// ========================================

const CRYPTO_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const SIGNAL_FILTERS = ['ALL', 'LONG', 'SHORT', 'FLAT'];
const REASON_CODE_TEXT = {
    p_bull_gate: 'Direction probability exceeds bullish threshold',
    p_bear_gate: 'Direction probability below bearish threshold',
    momentum_gate: 'Momentum confirms the directional signal',
    volatility_gate: 'Volatility remains within accepted range',
    volume_gate: 'Volume supports the current move',
    drift_block: 'Drift monitor reduces confidence',
    risk_cap: 'Position size capped by risk controls'
};

const state = {
    selectedSymbol: 'BTCUSDT',
    timeframe: '7d',
    signalFilter: 'ALL',
    query: '',
    dataMode: 'Simulated Feed',
    prices: {},
    prediction: null,
    performance: null,
    health: null,
    universe: [],
    chartSeries: {},
    chart: null
};

const els = {};

document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    bindEvents();
    initializeChart();
    await refreshData(true);

    setInterval(async () => {
        await refreshData(false);
    }, 10000);
});

function cacheElements() {
    const byId = (id) => document.getElementById(id);
    Object.assign(els, {
        symbolSelect: byId('symbolSelect'),
        dataModeBadge: byId('dataModeBadge'),
        transportBadge: byId('transportBadge'),
        lastUpdated: byId('lastUpdated'),
        priceChartTitle: byId('priceChartTitle'),
        modelAccuracy: byId('modelAccuracy'),
        btcPrice: byId('btcPrice'),
        btcChange: byId('btcChange'),
        ethPrice: byId('ethPrice'),
        ethChange: byId('ethChange'),
        solPrice: byId('solPrice'),
        solChange: byId('solChange'),
        pUpValue: byId('pUpValue'),
        pDownValue: byId('pDownValue'),
        signalPill: byId('signalPill'),
        directionConfidence: byId('directionConfidence'),
        w0Fill: byId('w0Fill'),
        w1Fill: byId('w1Fill'),
        w2Fill: byId('w2Fill'),
        w3Fill: byId('w3Fill'),
        w0Prob: byId('w0Prob'),
        w1Prob: byId('w1Prob'),
        w2Prob: byId('w2Prob'),
        w3Prob: byId('w3Prob'),
        mostLikelyWindow: byId('mostLikelyWindow'),
        expectedStart: byId('expectedStart'),
        q10Value: byId('q10Value'),
        q50Value: byId('q50Value'),
        q90Value: byId('q90Value'),
        intervalWidth: byId('intervalWidth'),
        expectedReturn: byId('expectedReturn'),
        actionPill: byId('actionPill'),
        positionSize: byId('positionSize'),
        entryPrice: byId('entryPrice'),
        stopLoss: byId('stopLoss'),
        takeProfit1: byId('takeProfit1'),
        takeProfit2: byId('takeProfit2'),
        rrRatio1: byId('rrRatio1'),
        rrRatio2: byId('rrRatio2'),
        explanationSummary: byId('explanationSummary'),
        topFeaturesList: byId('topFeaturesList'),
        reasonCodesList: byId('reasonCodesList'),
        healthStatusBadge: byId('healthStatusBadge'),
        driftAlerts: byId('driftAlerts'),
        healthSharpe: byId('healthSharpe'),
        sharpeStability: byId('sharpeStability'),
        dataFreshness: byId('dataFreshness'),
        lastTraining: byId('lastTraining'),
        directionAccuracy: byId('directionAccuracy'),
        intervalCoverage: byId('intervalCoverage'),
        brierScore: byId('brierScore'),
        winRate: byId('winRate'),
        searchInput: byId('searchInput'),
        filterBtn: byId('filterBtn'),
        cryptoTableBody: byId('cryptoTableBody'),
        priceChart: byId('priceChart')
    });
}

function bindEvents() {
    if (els.symbolSelect) {
        els.symbolSelect.value = state.selectedSymbol;
        els.symbolSelect.addEventListener('change', async (event) => {
            state.selectedSymbol = event.target.value;
            updateChartTitle();
            await loadPredictionAndPerformance();
            renderChart();
            renderUniverseTable();
        });
    }

    document.querySelectorAll('.timeframe-btn').forEach((button) => {
        button.addEventListener('click', () => {
            state.timeframe = button.dataset.timeframe;
            document.querySelectorAll('.timeframe-btn').forEach((item) => {
                item.classList.remove('btn-primary');
                item.classList.add('btn-secondary');
            });
            button.classList.add('btn-primary');
            button.classList.remove('btn-secondary');
            renderChart();
        });
    });

    if (els.searchInput) {
        els.searchInput.addEventListener('input', utils.debounce((event) => {
            state.query = event.target.value.toLowerCase();
            renderUniverseTable();
        }, 250));
    }

    if (els.filterBtn) {
        els.filterBtn.addEventListener('click', () => {
            const index = SIGNAL_FILTERS.indexOf(state.signalFilter);
            state.signalFilter = SIGNAL_FILTERS[(index + 1) % SIGNAL_FILTERS.length];
            els.filterBtn.textContent = `Signal: ${state.signalFilter}`;
            renderUniverseTable();
        });
    }
}

function initializeChart() {
    if (!els.priceChart) return;
    state.chart = new Chart(els.priceChart.getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: '#00E5FF', backgroundColor: 'rgba(0,229,255,0.12)', fill: true, tension: 0.35, pointRadius: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#94A3B8', maxTicksLimit: 8 }, grid: { display: false } },
                y: {
                    ticks: { color: '#94A3B8', callback: (value) => `$${Number(value).toLocaleString('en-US')}` },
                    grid: { color: 'rgba(148,163,184,0.15)' }
                }
            }
        }
    });
}

async function refreshData(loadFullPrediction) {
    await loadPrices();
    if (loadFullPrediction || !state.prediction) {
        await loadPredictionAndPerformance();
    }
    pushLatestPriceToChart();
    renderChart();
    renderUniverseTable();
    setLastUpdated();
}

async function loadPrices() {
    try {
        const payload = await api.getCryptoPrices();
        const normalized = normalizePrices(payload);
        if (Object.keys(normalized).length === 0) throw new Error('No live prices');
        state.prices = normalized;
        state.dataMode = 'Live Feed';
    } catch (error) {
        state.prices = simulatedPrices();
        state.dataMode = 'Simulated Feed';
    }

    ensureChartSeries();
    renderPriceCards();
    renderDataMode();
    buildUniverseRows();
}

async function loadPredictionAndPerformance() {
    const [prediction, performance] = await Promise.all([
        fetchPrediction(state.selectedSymbol),
        fetchPerformance(state.selectedSymbol)
    ]);

    state.prediction = prediction;
    state.performance = performance;
    state.health = prediction.health || defaultHealth();

    renderPrediction();
    renderPerformance();
    renderHealth();
    renderExplanation();
}

async function fetchPrediction(symbol) {
    try {
        if (typeof api.getCryptoPrediction === 'function') {
            const payload = await api.getCryptoPrediction(symbol);
            return normalizePrediction(payload, symbol);
        }
        if (typeof api.getCryptoPredictions === 'function') {
            const payload = await api.getCryptoPredictions(symbol.replace('USDT', ''));
            return normalizePrediction(payload, symbol);
        }
    } catch (error) {
        // Fallback below.
    }
    return simulatedPrediction(symbol);
}

async function fetchPerformance(symbol) {
    try {
        if (typeof api.getCryptoPerformance === 'function') {
            const payload = await api.getCryptoPerformance(symbol, 30);
            return normalizePerformance(payload);
        }
    } catch (error) {
        // Fallback below.
    }
    return defaultPerformance();
}

function normalizePrices(payload) {
    const normalized = {};
    if (!payload || typeof payload !== 'object') return normalized;

    const addRow = (key, value) => {
        const symbol = toCanonicalSymbol(key);
        if (!symbol || !value || typeof value !== 'object') return;
        const price = asNumber(value.price ?? value.current_price ?? value.last_price ?? value.close);
        if (!Number.isFinite(price)) return;
        normalized[symbol] = {
            symbol,
            price,
            change: asNumber(value.change ?? value.change_24h ?? value['24h_change'] ?? 0),
            volume: asNumber(value.volume ?? value.volume_24h ?? value['24h_volume'] ?? 0)
        };
    };

    if (Array.isArray(payload.data)) {
        payload.data.forEach((row) => addRow(row.symbol, row));
    }
    if (Array.isArray(payload)) {
        payload.forEach((row) => addRow(row.symbol, row));
    }

    Object.entries(payload).forEach(([key, value]) => addRow(key, value));
    return normalized;
}

function normalizePrediction(payload, symbol) {
    const fallback = simulatedPrediction(symbol);
    if (!payload || typeof payload !== 'object') return fallback;

    const packet = payload.prediction ? payload : { prediction: payload };
    const directionRaw = packet.prediction.direction || packet.prediction;
    const pUp = normalizeProbability(asNumber(directionRaw.p_up ?? directionRaw.pUp ?? fallback.direction.pUp));
    const pDown = normalizeProbability(asNumber(directionRaw.p_down ?? directionRaw.pDown ?? (1 - pUp)));
    const confidence = normalizeProbability(asNumber(directionRaw.confidence ?? fallback.direction.confidence));
    const signal = (directionRaw.signal || packet.signal?.action || inferSignal(pUp)).toUpperCase();

    const startRaw = packet.prediction.start_window || packet.prediction.startWindow || {};
    const window = {
        w0: normalizeProbability(asNumber(startRaw.w0 ?? startRaw.w0_prob ?? fallback.window.w0)),
        w1: normalizeProbability(asNumber(startRaw.w1 ?? startRaw.w1_prob ?? fallback.window.w1)),
        w2: normalizeProbability(asNumber(startRaw.w2 ?? startRaw.w2_prob ?? fallback.window.w2)),
        w3: normalizeProbability(asNumber(startRaw.w3 ?? startRaw.w3_prob ?? fallback.window.w3)),
        mostLikely: startRaw.most_likely || startRaw.mostLikely || fallback.window.mostLikely,
        expectedStart: startRaw.expected_start || startRaw.expectedStart || fallback.window.expectedStart
    };

    const magnitudeRaw = packet.prediction.magnitude || packet.prediction;
    const q10 = normalizeReturn(asNumber(magnitudeRaw.q10 ?? fallback.magnitude.q10));
    const q50 = normalizeReturn(asNumber(magnitudeRaw.q50 ?? fallback.magnitude.q50));
    const q90 = normalizeReturn(asNumber(magnitudeRaw.q90 ?? fallback.magnitude.q90));
    const sorted = [q10, q50, q90].sort((a, b) => a - b);

    const entryPrice = asNumber(packet.signal?.entry_price ?? fallback.signal.entryPrice) || currentPrice(symbol) || 100;
    const action = (packet.signal?.action || signal).toUpperCase();
    const stopLoss = asNumber(packet.signal?.stop_loss) || estimateStopLoss(entryPrice, sorted[0], action);
    const takeProfit1 = asNumber(packet.signal?.take_profit_1) || estimateTakeProfit(entryPrice, sorted[1], action);
    const takeProfit2 = asNumber(packet.signal?.take_profit_2) || estimateTakeProfit(entryPrice, sorted[2], action);

    return {
        symbol,
        timestamp: packet.timestamp || new Date().toISOString(),
        direction: { pUp, pDown, confidence, signal },
        window,
        magnitude: {
            q10: sorted[0],
            q50: sorted[1],
            q90: sorted[2],
            intervalWidth: sorted[2] - sorted[0],
            expectedReturn: sorted[1]
        },
        signal: {
            action,
            positionSize: asNumber(packet.signal?.position_size ?? fallback.signal.positionSize),
            entryPrice,
            stopLoss,
            takeProfit1,
            takeProfit2,
            rr1: calculateRiskReward(entryPrice, stopLoss, takeProfit1),
            rr2: calculateRiskReward(entryPrice, stopLoss, takeProfit2)
        },
        explanation: {
            summary: packet.explanation?.summary || fallback.explanation.summary,
            topFeatures: Array.isArray(packet.explanation?.top_features) ? packet.explanation.top_features : fallback.explanation.topFeatures,
            reasonCodes: Array.isArray(packet.explanation?.reason_codes) ? packet.explanation.reason_codes : fallback.explanation.reasonCodes
        },
        health: defaultHealth()
    };
}

function normalizePerformance(payload) {
    const metrics = payload?.metrics || payload || {};
    const fallback = defaultPerformance();
    return {
        directionAccuracy: normalizeProbability(asNumber(metrics.direction_accuracy ?? fallback.directionAccuracy)),
        intervalCoverage: normalizeProbability(asNumber(metrics.interval_coverage ?? fallback.intervalCoverage)),
        sharpeRatio: asNumber(metrics.sharpe_ratio ?? fallback.sharpeRatio),
        winRate: normalizeProbability(asNumber(metrics.win_rate ?? fallback.winRate)),
        brierScore: asNumber(metrics.brier_score ?? fallback.brierScore)
    };
}

function simulatedPrices() {
    const base = {
        BTCUSDT: { price: 67234.5, change: 2.34, volume: 28500000000 },
        ETHUSDT: { price: 3456.8, change: 3.12, volume: 12000000000 },
        SOLUSDT: { price: 145.2, change: -1.45, volume: 3500000000 }
    };
    const output = {};
    Object.entries(base).forEach(([symbol, item]) => {
        const drift = 1 + (Math.random() - 0.5) * 0.004;
        output[symbol] = {
            symbol,
            price: item.price * drift,
            change: item.change + (Math.random() - 0.5) * 0.3,
            volume: item.volume * (1 + (Math.random() - 0.5) * 0.05)
        };
    });
    return output;
}

function simulatedPrediction(symbol) {
    const preset = {
        BTCUSDT: { pUp: 0.62, confidence: 0.95, q10: -0.012, q50: 0.008, q90: 0.021 },
        ETHUSDT: { pUp: 0.65, confidence: 0.92, q10: -0.015, q50: 0.01, q90: 0.026 },
        SOLUSDT: { pUp: 0.48, confidence: 0.89, q10: -0.021, q50: 0.004, q90: 0.033 }
    }[symbol] || { pUp: 0.58, confidence: 0.9, q10: -0.012, q50: 0.008, q90: 0.02 };

    const signal = inferSignal(preset.pUp);
    const entry = currentPrice(symbol) || 100;
    const stopLoss = estimateStopLoss(entry, preset.q10, signal);
    const takeProfit1 = estimateTakeProfit(entry, preset.q50, signal);
    const takeProfit2 = estimateTakeProfit(entry, preset.q90, signal);

    return {
        symbol,
        timestamp: new Date().toISOString(),
        direction: { pUp: preset.pUp, pDown: 1 - preset.pUp, confidence: preset.confidence, signal },
        window: { w0: 0.25, w1: 0.35, w2: 0.28, w3: 0.12, mostLikely: 'W1', expectedStart: 'Within 1 hour' },
        magnitude: { q10: preset.q10, q50: preset.q50, q90: preset.q90, intervalWidth: preset.q90 - preset.q10, expectedReturn: preset.q50 },
        signal: {
            action: signal,
            positionSize: 1.2,
            entryPrice: entry,
            stopLoss,
            takeProfit1,
            takeProfit2,
            rr1: calculateRiskReward(entry, stopLoss, takeProfit1),
            rr2: calculateRiskReward(entry, stopLoss, takeProfit2)
        },
        explanation: {
            summary: 'Signal is driven by momentum, volatility regime, and volume alignment.',
            topFeatures: [
                { feature: 'momentum_20d', shap_value: 0.342, contribution: 'Strong momentum support' },
                { feature: 'volatility_score', shap_value: 0.287, contribution: 'Volatility remains controlled' },
                { feature: 'volume_ratio', shap_value: 0.231, contribution: 'Volume confirms move quality' }
            ],
            reasonCodes: signal === 'SHORT' ? ['p_bear_gate', 'volatility_gate', 'risk_cap'] : ['p_bull_gate', 'momentum_gate', 'volume_gate']
        },
        health: defaultHealth()
    };
}

function defaultPerformance() {
    return { directionAccuracy: 0.672, intervalCoverage: 0.813, sharpeRatio: 2.34, winRate: 0.542, brierScore: 0.234 };
}

function defaultHealth() {
    return { status: 'IN REVIEW', driftAlerts: 47, sharpeRatio: -0.36, sharpeStability: 2.3, dataFreshness: '2 hours ago', lastTraining: '2026-02-06' };
}

function renderPriceCards() {
    renderPriceCard('BTCUSDT', els.btcPrice, els.btcChange);
    renderPriceCard('ETHUSDT', els.ethPrice, els.ethChange);
    renderPriceCard('SOLUSDT', els.solPrice, els.solChange);
}

function renderPriceCard(symbol, priceEl, changeEl) {
    const item = state.prices[symbol];
    if (!item) return;
    if (priceEl) priceEl.textContent = utils.formatCurrency(item.price);
    if (changeEl) {
        changeEl.textContent = utils.formatPercent((item.change || 0) / 100);
        changeEl.className = `metric-change ${item.change >= 0 ? 'positive' : 'negative'}`;
    }
}

function renderPrediction() {
    const p = state.prediction;
    if (!p) return;

    text(els.pUpValue, p.direction.pUp.toFixed(2));
    text(els.pDownValue, p.direction.pDown.toFixed(2));
    text(els.directionConfidence, p.direction.confidence.toFixed(2));
    setSignalPill(els.signalPill, p.direction.signal);

    renderWindow(els.w0Fill, els.w0Prob, p.window.w0);
    renderWindow(els.w1Fill, els.w1Prob, p.window.w1);
    renderWindow(els.w2Fill, els.w2Prob, p.window.w2);
    renderWindow(els.w3Fill, els.w3Prob, p.window.w3);
    text(els.mostLikelyWindow, p.window.mostLikely);
    text(els.expectedStart, p.window.expectedStart);

    text(els.q10Value, formatSignedPercent(p.magnitude.q10));
    text(els.q50Value, formatSignedPercent(p.magnitude.q50));
    text(els.q90Value, formatSignedPercent(p.magnitude.q90));
    text(els.intervalWidth, formatSignedPercent(p.magnitude.intervalWidth, false));
    text(els.expectedReturn, formatSignedPercent(p.magnitude.expectedReturn));

    setSignalPill(els.actionPill, p.signal.action);
    text(els.positionSize, `${p.signal.positionSize.toFixed(2)}x`);
    text(els.entryPrice, utils.formatCurrency(p.signal.entryPrice));
    text(els.stopLoss, utils.formatCurrency(p.signal.stopLoss));
    text(els.takeProfit1, utils.formatCurrency(p.signal.takeProfit1));
    text(els.takeProfit2, utils.formatCurrency(p.signal.takeProfit2));
    text(els.rrRatio1, p.signal.rr1.toFixed(2));
    text(els.rrRatio2, p.signal.rr2.toFixed(2));
}

function renderExplanation() {
    const explanation = state.prediction?.explanation;
    if (!explanation) return;

    text(els.explanationSummary, explanation.summary || 'No explanation available');
    if (els.topFeaturesList) {
        els.topFeaturesList.innerHTML = explanation.topFeatures.map((item) => {
            const shap = Number.isFinite(asNumber(item.shap_value)) ? ` (${asNumber(item.shap_value).toFixed(3)})` : '';
            return `<li class=\"feature-item\"><strong>${item.feature}</strong>${shap} - ${item.contribution || 'n/a'}</li>`;
        }).join('');
    }
    if (els.reasonCodesList) {
        els.reasonCodesList.innerHTML = explanation.reasonCodes.map((code) => {
            return `<li class=\"reason-item\"><strong>${code}</strong> - ${REASON_CODE_TEXT[code] || code}</li>`;
        }).join('');
    }
}

function renderHealth() {
    const health = state.health || defaultHealth();
    text(els.healthStatusBadge, health.status);
    text(els.driftAlerts, String(health.driftAlerts));
    text(els.healthSharpe, Number(health.sharpeRatio).toFixed(2));
    text(els.sharpeStability, Number(health.sharpeStability).toFixed(2));
    text(els.dataFreshness, health.dataFreshness);
    text(els.lastTraining, health.lastTraining);
    if (els.healthSharpe) {
        els.healthSharpe.style.color = health.sharpeRatio >= 0 ? 'var(--success)' : 'var(--danger)';
    }
}

function renderPerformance() {
    const perf = state.performance || defaultPerformance();
    text(els.directionAccuracy, formatRate(perf.directionAccuracy));
    text(els.intervalCoverage, formatRate(perf.intervalCoverage));
    text(els.brierScore, perf.brierScore.toFixed(3));
    text(els.winRate, formatRate(perf.winRate));
    if (els.modelAccuracy) {
        els.modelAccuracy.textContent = perf.directionAccuracy.toFixed(2);
    }
}

function renderDataMode() {
    if (!els.dataModeBadge) return;
    const isLive = state.dataMode === 'Live Feed';
    els.dataModeBadge.textContent = state.dataMode;
    els.dataModeBadge.className = `status-badge ${isLive ? 'success' : 'warning'}`;
    if (els.transportBadge) {
        els.transportBadge.textContent = 'Polling';
        els.transportBadge.className = 'status-badge info';
    }
}

function buildUniverseRows() {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'LTCUSDT'];
    state.universe = symbols.map((symbol, index) => {
        const priceRow = state.prices[symbol] || simulatedUniversePrice(index);
        const previous = state.universe.find((row) => row.symbol === symbol);
        const pUp = previous ? previous.pUp : 0.45 + ((index * 7) % 25) / 100;
        return {
            symbol,
            price: priceRow.price,
            change: priceRow.change,
            pUp,
            signal: inferSignal(pUp),
            volume: priceRow.volume,
            status: state.dataMode === 'Live Feed' && CRYPTO_SYMBOLS.includes(symbol) ? 'Live' : 'Simulated'
        };
    });

    if (state.prediction) {
        const current = state.universe.find((item) => item.symbol === state.selectedSymbol);
        if (current) {
            current.pUp = state.prediction.direction.pUp;
            current.signal = state.prediction.direction.signal;
        }
    }
}

function renderUniverseTable() {
    if (!els.cryptoTableBody) return;
    const rows = state.universe.filter((row) => {
        const queryMatch = row.symbol.toLowerCase().includes(state.query);
        const signalMatch = state.signalFilter === 'ALL' || row.signal === state.signalFilter;
        return queryMatch && signalMatch;
    });

    els.cryptoTableBody.innerHTML = rows.map((row) => {
        const signalClass = row.signal === 'LONG' ? 'success' : row.signal === 'SHORT' ? 'danger' : 'warning';
        const statusClass = row.status === 'Live' ? 'success' : 'warning';
        const changeColor = row.change >= 0 ? 'var(--success)' : 'var(--danger)';
        return `
            <tr>
                <td><strong>${toDisplaySymbol(row.symbol)}</strong></td>
                <td>${utils.formatCurrency(row.price)}</td>
                <td style="color: ${changeColor};">${utils.formatPercent(row.change / 100)}</td>
                <td>${row.pUp.toFixed(2)}</td>
                <td><span class="status-badge ${signalClass}">${row.signal}</span></td>
                <td>${formatLargeMoney(row.volume)}</td>
                <td><span class="status-badge ${statusClass}">${row.status}</span></td>
            </tr>
        `;
    }).join('');
}

function ensureChartSeries() {
    Object.entries(state.prices).forEach(([symbol, item]) => {
        if (!state.chartSeries[symbol]) {
            state.chartSeries[symbol] = createSeries(item.price);
        }
    });
    if (!state.chartSeries[state.selectedSymbol]) {
        state.chartSeries[state.selectedSymbol] = createSeries(currentPrice(state.selectedSymbol) || 100);
    }
}

function createSeries(anchor) {
    const make = (count, volatility) => {
        const labels = [];
        const values = [];
        let value = anchor;
        for (let i = count - 1; i >= 0; i -= 1) {
            value *= 1 + ((Math.random() - 0.5) * volatility);
            labels.push(timeLabel(i));
            values.push(value);
        }
        return { labels, values };
    };
    return { '1h': make(60, 0.0015), '24h': make(96, 0.0025), '7d': make(168, 0.004) };
}

function pushLatestPriceToChart() {
    const symbol = state.selectedSymbol;
    const latest = currentPrice(symbol);
    const bucket = state.chartSeries[symbol];
    if (!Number.isFinite(latest) || !bucket) return;
    [['1h', 60], ['24h', 96], ['7d', 168]].forEach(([tf, limit]) => {
        bucket[tf].labels.push(timeLabel(0));
        bucket[tf].values.push(latest);
        if (bucket[tf].labels.length > limit) bucket[tf].labels.shift();
        if (bucket[tf].values.length > limit) bucket[tf].values.shift();
    });
}

function renderChart() {
    if (!state.chart) return;
    const bucket = state.chartSeries[state.selectedSymbol]?.[state.timeframe];
    if (!bucket) return;
    state.chart.data.labels = bucket.labels;
    state.chart.data.datasets[0].data = bucket.values;
    state.chart.update('none');
    updateChartTitle();
}

function updateChartTitle() {
    text(els.priceChartTitle, `${toDisplaySymbol(state.selectedSymbol)} Price Movement`);
}

function setLastUpdated(timestamp = new Date().toISOString()) {
    text(els.lastUpdated, `Updated ${utils.formatTimestamp(timestamp, 'time')}`);
}

function renderWindow(fillEl, valueEl, value) {
    const normalized = normalizeProbability(value);
    if (fillEl) fillEl.style.width = `${(normalized * 100).toFixed(1)}%`;
    if (valueEl) valueEl.textContent = normalized.toFixed(2);
}

function setSignalPill(element, signal) {
    if (!element) return;
    const normalized = (signal || 'FLAT').toUpperCase();
    const type = normalized === 'LONG' ? 'long' : normalized === 'SHORT' ? 'short' : 'flat';
    element.textContent = normalized;
    element.className = `signal-pill ${type}`;
}

function simulatedUniversePrice(index) {
    const anchors = [67234, 3456, 145, 312, 0.52, 0.63, 0.18, 36, 17, 84];
    const base = anchors[index % anchors.length];
    return {
        price: base * (1 + (Math.random() - 0.5) * (base > 100 ? 0.01 : 0.08)),
        change: (Math.random() - 0.5) * 6,
        volume: Math.max(1000000, Math.random() * 4000000000)
    };
}

function normalizeProbability(value) {
    if (!Number.isFinite(value)) return 0;
    if (value > 1) return value / 100;
    return Math.max(0, Math.min(1, value));
}

function normalizeReturn(value) {
    if (!Number.isFinite(value)) return 0;
    if (Math.abs(value) > 1) return value / 100;
    return value;
}

function inferSignal(pUp) {
    if (pUp >= 0.55) return 'LONG';
    if (pUp <= 0.45) return 'SHORT';
    return 'FLAT';
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
    return risk ? reward / risk : 0;
}

function currentPrice(symbol) {
    return state.prices[symbol]?.price;
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
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    return utils.formatCurrency(value);
}

function asNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function timeLabel(offsetMinutes) {
    const date = new Date();
    date.setMinutes(date.getMinutes() - offsetMinutes);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function text(el, value) {
    if (el) el.textContent = value;
}
