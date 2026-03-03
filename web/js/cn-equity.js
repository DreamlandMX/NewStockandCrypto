// ========================================
// StockandCrypto - CN Equity Page Logic
// ========================================

const CN_POLL_INTERVAL_MS = 10000;
const MAX_CHART_POINTS = 48;

const state = {
    page: 1,
    pageSize: 50,
    sort: 'pUp',
    direction: 'desc',
    search: '',
    predictionIndexCode: '000001.SH',
    tickCount: 0,
    lastUpdated: null,
    mode: 'loading',
    loading: false,
    indices: null,
    prediction: null,
    universe: {
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        rows: []
    },
    chart: null,
    chartLabels: [],
    chartValues: [],
    pollTimer: null
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    initializeChart();
    refreshAll();
    startPolling();
});

function cacheElements() {
    const byId = (id) => document.getElementById(id);
    Object.assign(els, {
        feedModeBadge: byId('feedModeBadge'),
        feedTickCount: byId('feedTickCount'),
        feedLastUpdate: byId('feedLastUpdate'),
        feedMessage: byId('feedMessage'),
        dataSourceValue: byId('dataSourceValue'),
        pollingLabel: byId('pollingLabel'),
        feedHealthStatus: byId('feedHealthStatus'),
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
    }, 350);

    if (els.searchInput) {
        els.searchInput.addEventListener('input', debouncedSearch);
    }

    if (els.pageSizeSelect) {
        els.pageSizeSelect.addEventListener('change', () => {
            state.page = 1;
            state.pageSize = Number(els.pageSizeSelect.value || 50);
            refreshAll();
        });
    }

    if (els.prevPageBtn) {
        els.prevPageBtn.addEventListener('click', () => {
            if (state.page <= 1) return;
            state.page -= 1;
            refreshAll();
        });
    }

    if (els.nextPageBtn) {
        els.nextPageBtn.addEventListener('click', () => {
            if (state.page >= state.universe.totalPages) return;
            state.page += 1;
            refreshAll();
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
            const sort = th.getAttribute('data-sort');
            if (!sort) return;
            if (state.sort === sort) {
                state.direction = state.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort = sort;
                state.direction = sort === 'name' || sort === 'code' ? 'asc' : 'desc';
            }
            state.page = 1;
            refreshAll();
        });
    });
}

function initializeChart() {
    if (!els.indexChart || !window.Chart) return;
    state.chart = new Chart(els.indexChart.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'SSE Composite',
                    data: [],
                    borderColor: '#00E5FF',
                    backgroundColor: 'rgba(0, 229, 255, 0.15)',
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0,
                    fill: true
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
    state.pollTimer = setInterval(() => {
        refreshAll();
    }, CN_POLL_INTERVAL_MS);
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
            search: state.search
        });

        state.indices = payload.indices || null;
        state.universe = payload.universe || state.universe;
        state.lastUpdated = payload.meta?.timestamp || new Date().toISOString();
        state.tickCount += 1;
        state.mode = payload.meta?.stale ? 'stale' : 'live';

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
        const payload = await api.getCNEquityIndexPrediction(state.predictionIndexCode);
        state.prediction = payload;
    } catch (error) {
        state.prediction = null;
    }
}

function renderAll() {
    renderModeBanner();
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

function renderIndices() {
    const sse = state.indices?.sse;
    const csi = state.indices?.csi300;
    renderIndexCard(sse, els.sseIndexValue, els.sseIndexChange, els.sseIndexStatus);
    renderIndexCard(csi, els.csi300IndexValue, els.csi300IndexChange, els.csi300IndexStatus);
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
        els.signalBadge.textContent = direction.signal || '--';
        els.signalBadge.className = `status-badge ${direction.signal === 'LONG' ? 'success' : 'warning'}`;
    }
    text(els.actionValue, policy.action || '--');
    text(els.positionSizeValue, policy.positionSize === undefined ? '--' : `${(policy.positionSize * 100).toFixed(1)}%`);

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
        els.csi300TableBody.innerHTML = '<tr><td colspan=\"8\">No data available.</td></tr>';
    } else {
        els.csi300TableBody.innerHTML = rows.map((row) => {
            const changeClass = row.changePct >= 0 ? 'positive' : 'negative';
            const signalClass = row.prediction.signal === 'LONG' ? 'success' : 'warning';
            const statusClass = row.status === 'LIVE' ? 'cn-status-live' : row.status === 'STALE' ? 'cn-status-stale' : 'cn-status-error';
            return `
                <tr>
                    <td><strong>${escapeHtml(row.code)}</strong></td>
                    <td>${escapeHtml(row.name)}</td>
                    <td>${row.price === null ? '--' : utils.formatNumber(row.price, 2)}</td>
                    <td class="${changeClass}">${row.changePct === null ? '--' : formatSignedPercentFromPercent(row.changePct)}</td>
                    <td>${formatRate(row.prediction.pUp)}</td>
                    <td>${row.volume === null ? '--' : utils.formatNumber(row.volume, 0)}</td>
                    <td><span class="status-badge ${signalClass}">${row.prediction.signal}</span></td>
                    <td><span class="${statusClass}">${row.status}</span></td>
                </tr>
            `;
        }).join('');
    }

    state.page = state.universe.page || state.page;
    const totalPages = state.universe.totalPages || 1;
    text(els.pageInfo, `Page ${state.page} / ${totalPages} · ${state.universe.total || 0} rows`);
    if (els.prevPageBtn) els.prevPageBtn.disabled = state.page <= 1;
    if (els.nextPageBtn) els.nextPageBtn.disabled = state.page >= totalPages;
}

function renderTableError(errorMessage) {
    if (!els.csi300TableBody) return;
    els.csi300TableBody.innerHTML = `<tr><td colspan="8">Error: ${escapeHtml(errorMessage)}</td></tr>`;
    text(els.pageInfo, 'Page -- / --');
}

function renderSortIndicators() {
    document.querySelectorAll('[data-sort]').forEach((th) => {
        const key = th.getAttribute('data-sort');
        const marker = document.getElementById(`sort-${key}`);
        th.classList.toggle('active', key === state.sort);
        if (marker) {
            marker.textContent = key === state.sort ? (state.direction === 'asc' ? '▲' : '▼') : '';
        }
    });
}

function pushChartPoint(price, timestamp) {
    if (!state.chart || !Number.isFinite(price)) return;
    state.chartLabels.push(utils.formatTimestamp(timestamp, 'time'));
    state.chartValues.push(Number(price.toFixed(2)));
    if (state.chartLabels.length > MAX_CHART_POINTS) {
        state.chartLabels.shift();
        state.chartValues.shift();
    }
    state.chart.data.labels = state.chartLabels;
    state.chart.data.datasets[0].data = state.chartValues;
    state.chart.update('none');
}

function formatRate(value) {
    if (!Number.isFinite(value)) return '--';
    return value.toFixed(2);
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
