// ========================================
// StockandCrypto - CN Equity Page Logic
// ========================================

const CN_POLL_INTERVAL_MS = 10000;
const MAX_CHART_POINTS = 48;
const CHART_PHASE_MARKERS = [
    { label: 'Open', ratio: 0.15 },
    { label: 'Lunch', ratio: 0.56 },
    { label: 'Close Auction', ratio: 0.9 }
];

const state = {
    page: 1,
    pageSize: 50,
    sort: 'pUp',
    direction: 'desc',
    search: '',
    limitFilter: 'all',
    predictionIndexCode: '000001.SH',
    tickCount: 0,
    lastUpdated: null,
    mode: 'loading',
    loading: false,
    indices: null,
    prediction: null,
    marketSession: null,
    universe: {
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        rows: []
    },
    chart: null,
    chartLabels: [],
    chartSeries: {
        actual: [],
        upperLimit: [],
        lowerLimit: [],
        predictedOpen: [],
        predictedClose: []
    },
    pollTimer: null,
    countdownTimer: null,
    localCountdownSec: 0
};

const els = {};

const phaseToneToBadge = {
    success: 'success',
    warning: 'warning',
    danger: 'danger',
    info: 'info',
    muted: 'muted'
};

const phaseCodeToDisplay = {
    PRE_OPEN_AUCTION: 'Pre-Open Auction',
    CONTINUOUS_AM: 'Continuous Trading',
    CONTINUOUS_PM: 'Continuous Trading',
    LUNCH_BREAK: 'Lunch Break',
    CLOSE_AUCTION: 'Close Auction',
    CLOSED: 'Post-Market Closed'
};

const phaseMarkerPlugin = {
    id: 'cn-phase-markers',
    afterDatasetsDraw(chart) {
        const area = chart.chartArea;
        const xScale = chart.scales.x;
        if (!area || !xScale || !chart.data.labels?.length) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'left';
        CHART_PHASE_MARKERS.forEach((marker) => {
            const idx = Math.floor((chart.data.labels.length - 1) * marker.ratio);
            const pixel = xScale.getPixelForValue(idx);
            ctx.strokeStyle = 'rgba(148,163,184,0.35)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(pixel, area.top);
            ctx.lineTo(pixel, area.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(148,163,184,0.85)';
            ctx.fillText(marker.label, pixel + 4, area.top + 12);
        });
        ctx.restore();
    }
};

if (window.Chart && !window.Chart.registry.plugins.get('cn-phase-markers')) {
    window.Chart.register(phaseMarkerPlugin);
}

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    initializeChart();
    refreshAll();
    startPolling();
    startCountdownTimer();
});

function cacheElements() {
    const byId = (id) => document.getElementById(id);
    Object.assign(els, {
        feedModeBadge: byId('feedModeBadge'),
        feedTickCount: byId('feedTickCount'),
        feedLastUpdate: byId('feedLastUpdate'),
        feedMessage: byId('feedMessage'),
        sourceDelayNote: byId('sourceDelayNote'),
        disclaimerText: byId('disclaimerText'),
        dataSourceValue: byId('dataSourceValue'),
        pollingLabel: byId('pollingLabel'),
        feedHealthStatus: byId('feedHealthStatus'),
        sseSessionBadge: byId('sseSessionBadge'),
        csiSessionBadge: byId('csiSessionBadge'),
        sseSessionCountdown: byId('sseSessionCountdown'),
        csiSessionCountdown: byId('csiSessionCountdown'),
        sessionPhaseValue: byId('sessionPhaseValue'),
        sessionTimezoneValue: byId('sessionTimezoneValue'),
        nextPhaseBadge: byId('nextPhaseBadge'),
        sseIndexValue: byId('sseIndexValue'),
        sseIndexChange: byId('sseIndexChange'),
        sseIndexStatus: byId('sseIndexStatus'),
        csi300IndexValue: byId('csi300IndexValue'),
        csi300IndexChange: byId('csi300IndexChange'),
        csi300IndexStatus: byId('csi300IndexStatus'),
        indexChart: byId('indexChart'),
        refreshNowBtn: byId('refreshNowBtn'),
        indexSelector: byId('indexSelector'),
        pUpValue: byId('pUpValue'),
        pDownValue: byId('pDownValue'),
        confidenceValue: byId('confidenceValue'),
        signalBadge: byId('signalBadge'),
        actionValue: byId('actionValue'),
        positionSizeValue: byId('positionSizeValue'),
        shortEligibleValue: byId('shortEligibleValue'),
        marginEligibleValue: byId('marginEligibleValue'),
        shortReasonValue: byId('shortReasonValue'),
        tPlusOneValue: byId('tPlusOneValue'),
        w0Bar: byId('w0Bar'),
        w1Bar: byId('w1Bar'),
        w2Bar: byId('w2Bar'),
        w3Bar: byId('w3Bar'),
        w4Bar: byId('w4Bar'),
        w0Text: byId('w0Text'),
        w1Text: byId('w1Text'),
        w2Text: byId('w2Text'),
        w3Text: byId('w3Text'),
        w4Text: byId('w4Text'),
        q10Value: byId('q10Value'),
        q50Value: byId('q50Value'),
        q90Value: byId('q90Value'),
        intervalWidthValue: byId('intervalWidthValue'),
        searchInput: byId('searchInput'),
        pageSizeSelect: byId('pageSizeSelect'),
        csi300TableBody: byId('csi300TableBody'),
        prevPageBtn: byId('prevPageBtn'),
        nextPageBtn: byId('nextPageBtn'),
        pageInfo: byId('pageInfo')
    });
}

function bindEvents() {
    const debouncedSearch = utils.debounce(() => {
        state.page = 1;
        state.search = (els.searchInput?.value || '').trim();
        refreshAll();
    }, 300);

    if (els.searchInput) els.searchInput.addEventListener('input', debouncedSearch);

    if (els.pageSizeSelect) {
        els.pageSizeSelect.addEventListener('change', () => {
            state.page = 1;
            state.pageSize = Number(els.pageSizeSelect.value || 50);
            refreshAll();
        });
    }

    if (els.prevPageBtn) {
        els.prevPageBtn.addEventListener('click', () => {
            if (state.page > 1) {
                state.page -= 1;
                refreshAll();
            }
        });
    }

    if (els.nextPageBtn) {
        els.nextPageBtn.addEventListener('click', () => {
            if (state.page < (state.universe.totalPages || 1)) {
                state.page += 1;
                refreshAll();
            }
        });
    }

    if (els.indexSelector) {
        els.indexSelector.addEventListener('change', async () => {
            state.predictionIndexCode = els.indexSelector.value;
            await loadPrediction();
            renderPrediction();
        });
    }

    if (els.refreshNowBtn) {
        els.refreshNowBtn.addEventListener('click', () => refreshAll(true));
    }

    document.querySelectorAll('[data-sort]').forEach((th) => {
        th.addEventListener('click', () => {
            const sortKey = th.getAttribute('data-sort');
            if (!sortKey) return;
            if (state.sort === sortKey) {
                state.direction = state.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort = sortKey;
                state.direction = (sortKey === 'name' || sortKey === 'code' || sortKey === 'sector') ? 'asc' : 'desc';
            }
            state.page = 1;
            refreshAll();
        });
    });

    document.querySelectorAll('[data-limit-filter]').forEach((button) => {
        button.addEventListener('click', () => {
            const filter = button.getAttribute('data-limit-filter') || 'all';
            state.limitFilter = filter;
            state.page = 1;
            document.querySelectorAll('[data-limit-filter]').forEach((el) => el.classList.toggle('active', el === button));
            refreshAll();
        });
    });
}

function initializeChart() {
    if (!els.indexChart || !window.Chart) return;
    const ctx = els.indexChart.getContext('2d');
    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Actual',
                    data: [],
                    borderColor: '#00E5FF',
                    backgroundColor: 'rgba(0,229,255,0.12)',
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0,
                    fill: true
                },
                {
                    label: 'Upper Limit (+10%)',
                    data: [],
                    borderColor: 'rgba(255,77,79,0.8)',
                    borderWidth: 1.2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Lower Limit (-10%)',
                    data: [],
                    borderColor: 'rgba(16,185,129,0.8)',
                    borderWidth: 1.2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Predicted Open',
                    data: [],
                    borderColor: 'rgba(245,158,11,0.85)',
                    borderDash: [3, 5],
                    pointRadius: 2,
                    pointHoverRadius: 3,
                    fill: false
                },
                {
                    label: 'Predicted Close',
                    data: [],
                    borderColor: 'rgba(139,92,246,0.85)',
                    borderDash: [3, 5],
                    pointRadius: 2,
                    pointHoverRadius: 3,
                    fill: false
                }
            ]
        },
        options: {
            maintainAspectRatio: false,
            animation: { duration: 250 },
            scales: {
                x: {
                    ticks: { color: '#94A3B8', maxTicksLimit: 8 },
                    grid: { color: 'rgba(148,163,184,0.08)' }
                },
                y: {
                    ticks: { color: '#94A3B8' },
                    grid: { color: 'rgba(148,163,184,0.08)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#F8FAFC' } }
            }
        }
    });
}

function startPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => refreshAll(), CN_POLL_INTERVAL_MS);
}

function startCountdownTimer() {
    if (state.countdownTimer) clearInterval(state.countdownTimer);
    state.countdownTimer = setInterval(() => {
        if (state.localCountdownSec > 0) {
            state.localCountdownSec -= 1;
        }
        renderSession();
    }, 1000);
}

async function refreshAll(manual = false) {
    if (state.loading) return;
    state.loading = true;

    try {
        const payload = await api.getCNEquityPrices({
            page: state.page,
            pageSize: state.pageSize,
            sort: state.sort,
            direction: state.direction,
            search: state.search,
            limitFilter: state.limitFilter
        });

        state.indices = payload.indices || null;
        state.universe = payload.universe || state.universe;
        state.marketSession = payload.marketSession || null;
        state.localCountdownSec = Math.max(0, Number(payload.marketSession?.countdownSec || 0));
        state.lastUpdated = payload.meta?.timestamp || new Date().toISOString();
        state.tickCount += 1;
        state.mode = payload.meta?.stale ? 'stale' : 'live';

        text(els.sourceDelayNote, payload.meta?.delayNote || 'Data Source: EastMoney API | Delay: ~3-10s (Level-1)');
        text(els.disclaimerText, payload.meta?.disclaimer || 'Not for actual trading - Simulation only');

        if (state.indices?.sse?.price !== null && state.indices?.sse?.price !== undefined) {
            pushChartPoint(state.indices.sse.price, state.lastUpdated);
        }

        await loadPrediction();
        renderAll();
    } catch (error) {
        state.mode = 'error';
        renderModeBanner(error.message || 'CN data request failed.');
        renderTableError(error.message || 'CN data request failed.');
        if (manual && window.showToast?.error) {
            window.showToast.error('Failed to refresh CN equity data.');
        }
    } finally {
        state.loading = false;
    }
}

async function loadPrediction() {
    try {
        state.prediction = await api.getCNEquityIndexPrediction(state.predictionIndexCode);
    } catch (error) {
        state.prediction = null;
    }
}

function renderAll() {
    renderModeBanner();
    renderSession();
    renderIndices();
    renderPrediction();
    renderTable();
    renderSortIndicators();
}

function renderModeBanner(message) {
    let label = 'LIVE FEED';
    let badgeClass = 'status-badge success';
    let feedText = message || 'Streaming via EastMoney polling.';
    if (state.mode === 'stale') {
        label = 'STALE FEED';
        badgeClass = 'status-badge warning';
        feedText = message || 'Serving cached data because upstream refresh failed.';
    } else if (state.mode === 'error') {
        label = 'ERROR';
        badgeClass = 'status-badge danger';
        feedText = message || 'No data available from upstream.';
    }

    if (els.feedModeBadge) {
        els.feedModeBadge.className = badgeClass;
        els.feedModeBadge.textContent = label;
    }

    text(els.feedTickCount, String(state.tickCount));
    text(els.feedLastUpdate, state.lastUpdated ? utils.formatTimestamp(state.lastUpdated, 'time') : '--');
    text(els.feedMessage, feedText);
    text(els.dataSourceValue, 'EastMoney');
    text(els.pollingLabel, `Polling ${Math.round(CN_POLL_INTERVAL_MS / 1000)}s`);
    text(els.feedHealthStatus, state.mode === 'error' ? 'DEGRADED' : 'IN REVIEW');
    if (els.feedHealthStatus) {
        els.feedHealthStatus.className = `status-badge ${state.mode === 'error' ? 'danger' : state.mode === 'stale' ? 'warning' : 'info'}`;
    }
}

function renderSession() {
    const session = state.marketSession;
    if (!session) return;
    const phaseLabel = phaseCodeToDisplay[session.phaseCode] || session.phaseLabel || 'Post-Market Closed';
    const tone = phaseToneToBadge[session.phaseTone] || 'info';
    const nextLabel = session.nextPhaseLabel || '--';
    const countdownText = formatCountdown(state.localCountdownSec);
    const nextLine = `Next Phase: ${nextLabel} in ${countdownText}`;

    text(els.sessionPhaseValue, phaseLabel);
    text(els.sessionTimezoneValue, session.timezoneLabel || 'Beijing Time (CST, UTC+8)');
    text(els.nextPhaseBadge, nextLine);
    if (els.nextPhaseBadge) {
        els.nextPhaseBadge.className = `status-badge ${tone}`;
    }
    if (els.sseSessionBadge) {
        els.sseSessionBadge.className = `status-badge ${tone}`;
        els.sseSessionBadge.textContent = phaseLabel;
    }
    if (els.csiSessionBadge) {
        els.csiSessionBadge.className = `status-badge ${tone}`;
        els.csiSessionBadge.textContent = phaseLabel;
    }
    text(els.sseSessionCountdown, nextLine);
    text(els.csiSessionCountdown, nextLine);
}

function renderIndices() {
    renderIndexCard(state.indices?.sse, els.sseIndexValue, els.sseIndexChange, els.sseIndexStatus);
    renderIndexCard(state.indices?.csi300, els.csi300IndexValue, els.csi300IndexChange, els.csi300IndexStatus);
}

function renderIndexCard(data, valueEl, changeEl, statusEl) {
    if (!data) return;
    text(valueEl, data.price === null ? '--' : utils.formatNumber(data.price, 2));
    if (changeEl) {
        const change = data.changePct;
        text(changeEl, change === null ? '--' : formatSignedPercentFromPercent(change));
        changeEl.className = `metric-change ${change >= 0 ? 'positive' : 'negative'}`;
    }
    if (statusEl) {
        statusEl.textContent = state.mode === 'live' ? 'LIVE' : state.mode === 'stale' ? 'STALE' : 'ERROR';
        statusEl.className = `status-badge ${state.mode === 'live' ? 'success' : state.mode === 'stale' ? 'warning' : 'danger'}`;
    }
}

function renderPrediction() {
    const packet = state.prediction;
    if (!packet?.prediction) {
        text(els.pUpValue, '--');
        text(els.pDownValue, '--');
        text(els.confidenceValue, '--');
        text(els.signalBadge, '--');
        text(els.actionValue, '--');
        text(els.positionSizeValue, '--');
        text(els.shortEligibleValue, 'No');
        text(els.marginEligibleValue, '--');
        text(els.shortReasonValue, 'CN strict no-short mode');
        text(els.tPlusOneValue, 'Applied');
        return;
    }

    const direction = packet.prediction.direction || {};
    const window = packet.prediction.window || {};
    const magnitude = packet.prediction.magnitude || {};
    const policy = packet.policy || {};

    text(els.pUpValue, formatRate(direction.pUp));
    text(els.pDownValue, formatRate(direction.pDown));
    text(els.confidenceValue, formatRate(direction.confidence));
    if (els.signalBadge) {
        const signal = direction.signal || '--';
        els.signalBadge.className = `status-badge ${signal === 'LONG' ? 'success' : 'warning'}`;
        els.signalBadge.textContent = signal;
    }
    text(els.actionValue, policy.action || '--');
    text(els.positionSizeValue, policy.positionSize === undefined ? '--' : `${(policy.positionSize * 100).toFixed(1)}%`);
    text(els.shortEligibleValue, policy.shortEligible ? 'Yes' : 'No');
    text(els.marginEligibleValue, policy.marginEligible ? 'Yes' : 'No');
    text(els.shortReasonValue, policy.shortReason || 'CN strict no-short mode');
    text(els.tPlusOneValue, policy.tPlusOneApplied ? 'Applied' : 'N/A');

    renderWindow('w0', window.W0);
    renderWindow('w1', window.W1);
    renderWindow('w2', window.W2);
    renderWindow('w3', window.W3);
    renderWindow('w4', window.W4);

    text(els.q10Value, formatSignedPercentFromRatio(magnitude.q10));
    text(els.q50Value, formatSignedPercentFromRatio(magnitude.q50));
    text(els.q90Value, formatSignedPercentFromRatio(magnitude.q90));
    const width = (magnitude.q90 ?? 0) - (magnitude.q10 ?? 0);
    text(els.intervalWidthValue, formatSignedPercentFromRatio(width, false));

    updateChartOverlays(magnitude);
}

function renderWindow(prefix, value) {
    const bar = els[`${prefix}Bar`];
    const textEl = els[`${prefix}Text`];
    const rate = clamp(Number(value) || 0, 0, 1);
    if (bar) bar.style.width = `${(rate * 100).toFixed(1)}%`;
    if (textEl) textEl.textContent = `${(rate * 100).toFixed(1)}%`;
}

function renderTable() {
    if (!els.csi300TableBody) return;
    const rows = state.universe.rows || [];
    if (!rows.length) {
        els.csi300TableBody.innerHTML = '<tr><td colspan="10">No data available.</td></tr>';
    } else {
        els.csi300TableBody.innerHTML = rows.map((row) => {
            const changeClass = row.changePct >= 0 ? 'positive' : 'negative';
            const signalClass = row.prediction.signal === 'LONG' ? 'success' : 'warning';
            const statusClass = row.status === 'LIVE' ? 'cn-status-live' : row.status === 'STALE' ? 'cn-status-stale' : 'cn-status-error';
            const limitClass = row.limitStatus === 'LIMIT_UP' ? 'cn-limit-up' : row.limitStatus === 'LIMIT_DOWN' ? 'cn-limit-down' : 'cn-limit-normal';
            const limitText = row.limitStatus === 'LIMIT_UP' ? 'LIMIT UP' : row.limitStatus === 'LIMIT_DOWN' ? 'LIMIT DOWN' : 'NORMAL';
            const rowClass = row.limitStatus === 'LIMIT_UP' ? 'cn-row-limit-up' : row.limitStatus === 'LIMIT_DOWN' ? 'cn-row-limit-down' : '';
            const tooltip = `PE: ${formatOptional(row.valuation?.peTtm)} | MCap: ${formatLargeMoney(row.valuation?.marketCap)} | Margin Eligible: ${row.marginEligible ? 'Yes' : 'No'}`;
            return `
                <tr class="${rowClass}" title="${escapeHtml(tooltip)}">
                    <td><strong>${escapeHtml(row.code)}</strong></td>
                    <td>${escapeHtml(row.name)}${row.isSt ? '<span class="cn-st-tag">ST</span>' : ''}</td>
                    <td>${escapeHtml(row.sector || 'Other')}</td>
                    <td>${row.price === null ? '--' : utils.formatNumber(row.price, 2)}</td>
                    <td class="${changeClass}">${row.changePct === null ? '--' : formatSignedPercentFromPercent(row.changePct)}</td>
                    <td>${formatRate(row.prediction.pUp)}</td>
                    <td>${row.volume === null ? '--' : utils.formatNumber(row.volume, 0)}</td>
                    <td><span class="cn-limit-badge ${limitClass}">${limitText}</span></td>
                    <td><span class="status-badge ${signalClass}">${row.prediction.signal}</span></td>
                    <td><span class="${statusClass}">${row.status}</span></td>
                </tr>
            `;
        }).join('');
    }

    state.page = state.universe.page || state.page;
    const totalPages = state.universe.totalPages || 1;
    text(els.pageInfo, `Page ${state.page} / ${totalPages} | ${state.universe.total || 0} rows`);
    if (els.prevPageBtn) els.prevPageBtn.disabled = state.page <= 1;
    if (els.nextPageBtn) els.nextPageBtn.disabled = state.page >= totalPages;
}

function renderTableError(errorMessage) {
    if (!els.csi300TableBody) return;
    els.csi300TableBody.innerHTML = `<tr><td colspan="10">Error: ${escapeHtml(errorMessage)}</td></tr>`;
    text(els.pageInfo, 'Page -- / --');
}

function renderSortIndicators() {
    document.querySelectorAll('[data-sort]').forEach((th) => {
        const key = th.getAttribute('data-sort');
        const marker = document.getElementById(`sort-${key}`);
        th.classList.toggle('active', key === state.sort);
        if (marker) marker.textContent = key === state.sort ? (state.direction === 'asc' ? '^' : 'v') : '';
    });
}

function pushChartPoint(price, timestamp) {
    if (!state.chart || !Number.isFinite(price)) return;
    state.chartLabels.push(utils.formatTimestamp(timestamp, 'time'));
    state.chartSeries.actual.push(Number(price.toFixed(2)));

    const prevClose = state.indices?.sse?.prevClose;
    const upperLimit = Number.isFinite(prevClose) ? Number((prevClose * 1.1).toFixed(2)) : null;
    const lowerLimit = Number.isFinite(prevClose) ? Number((prevClose * 0.9).toFixed(2)) : null;
    state.chartSeries.upperLimit.push(upperLimit);
    state.chartSeries.lowerLimit.push(lowerLimit);

    if (state.chartLabels.length > MAX_CHART_POINTS) {
        state.chartLabels.shift();
        Object.keys(state.chartSeries).forEach((key) => state.chartSeries[key].shift());
    }
    syncChartDatasets();
}

function updateChartOverlays(magnitude) {
    if (!state.chart || !state.chartSeries.actual.length) return;
    const latestPrice = state.chartSeries.actual[state.chartSeries.actual.length - 1];
    const q10 = Number(magnitude?.q10 || 0);
    const q50 = Number(magnitude?.q50 || 0);
    const predictedOpen = Number((latestPrice * (1 + q10 * 0.35)).toFixed(2));
    const predictedClose = Number((latestPrice * (1 + q50)).toFixed(2));

    state.chartSeries.predictedOpen = state.chartSeries.actual.map(() => null);
    state.chartSeries.predictedClose = state.chartSeries.actual.map(() => null);
    state.chartSeries.predictedOpen[state.chartSeries.predictedOpen.length - 1] = predictedOpen;
    state.chartSeries.predictedClose[state.chartSeries.predictedClose.length - 1] = predictedClose;

    syncChartDatasets();
}

function syncChartDatasets() {
    if (!state.chart) return;
    state.chart.data.labels = state.chartLabels;
    state.chart.data.datasets[0].data = state.chartSeries.actual;
    state.chart.data.datasets[1].data = state.chartSeries.upperLimit;
    state.chart.data.datasets[2].data = state.chartSeries.lowerLimit;
    state.chart.data.datasets[3].data = state.chartSeries.predictedOpen;
    state.chart.data.datasets[4].data = state.chartSeries.predictedClose;
    state.chart.update('none');
}

function formatRate(value) {
    if (!Number.isFinite(value)) return '--';
    return value.toFixed(2);
}

function formatOptional(value) {
    if (!Number.isFinite(value)) return '--';
    return value.toFixed(2);
}

function formatLargeMoney(value) {
    if (!Number.isFinite(value)) return '--';
    if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    return value.toFixed(0);
}

function formatSignedPercentFromPercent(value) {
    if (!Number.isFinite(value)) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

function formatSignedPercentFromRatio(value, forceSign = true) {
    if (!Number.isFinite(value)) return '--';
    const pct = value * 100;
    const sign = pct >= 0 && forceSign ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
}

function formatCountdown(totalSec) {
    const sec = Math.max(0, Number(totalSec) || 0);
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function text(el, value) {
    if (el) el.textContent = value;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
