const TRACKING_REFRESH_MS = 10000;

const trackingState = {
    market: 'all',
    action: 'all',
    search: '',
    sortBy: 'totalScore',
    sortDir: 'desc',
    page: 1,
    pageSize: 20,
    view: 'top',
    actionType: 'all',
    factorMode: 'all',
    focusedFactor: 'momentum',
    selectedSymbol: '',
    selectedMarket: '',
    summary: null,
    meta: null,
    universe: null,
    coverage: null,
    actions: null,
    factorPayload: null,
    contributionChart: null,
    simulation: null,
    loading: false,
    refreshHandle: null
};

const dom = {};

document.addEventListener('DOMContentLoaded', initializeTrackingPage);

function initializeTrackingPage() {
    cacheDom();
    bindEvents();
    loadTrackingDashboard();
    trackingState.refreshHandle = window.setInterval(() => {
        loadTrackingDashboard({ silent: true });
    }, TRACKING_REFRESH_MS);
}

function cacheDom() {
    const ids = [
        'trackingModeBadge', 'trackingRefreshBadge', 'trackingLastUpdated', 'trackingLatestAction',
        'summaryCryptoCount', 'summaryCryptoCaption', 'summaryCryptoStatus',
        'summaryCnCount', 'summaryCnCaption', 'summaryCnStatus',
        'summaryUsCount', 'summaryUsCaption', 'summaryUsStatus',
        'summaryCoverageValue', 'summaryCoverageCaption', 'summaryCoverageFill',
        'factorSelectedMeta', 'factorFocusSelect', 'factorList', 'factorContributionSummary', 'factorContributionChart',
        'coverageMatrix', 'coverageSummary', 'coverageBadge',
        'trackingSearchInput', 'trackingMarketFilter', 'trackingActionFilter', 'trackingSortSelect',
        'viewAllRankedBtn', 'rankedUniverseCaption', 'rankedUniverseMeta', 'rankedUniverseBody',
        'paginationInfo', 'paginationPrev', 'paginationNext',
        'simulatePortfolioBtn', 'exportUniverseBtn', 'simulationCard', 'simulationGrid', 'simulationMeta',
        'trackingActionTypeFilter', 'trackingActionsMeta', 'trackingActionsGrid'
    ];
    ids.forEach((id) => { dom[id] = document.getElementById(id); });
    dom.factorModeButtons = Array.from(document.querySelectorAll('[data-factor-mode]'));
    dom.sortButtons = Array.from(document.querySelectorAll('[data-sort-key]'));
}

function bindEvents() {
    dom.trackingMarketFilter?.addEventListener('change', (event) => {
        trackingState.market = event.target.value;
        trackingState.page = 1;
        loadTrackingDashboard();
    });
    dom.trackingActionFilter?.addEventListener('change', (event) => {
        trackingState.action = event.target.value;
        trackingState.page = 1;
        loadTrackingDashboard();
    });
    dom.trackingActionTypeFilter?.addEventListener('change', (event) => {
        trackingState.actionType = event.target.value;
        loadTrackingDashboard();
    });
    dom.trackingSortSelect?.addEventListener('change', (event) => {
        const [sortBy, sortDir] = String(event.target.value).split(':');
        trackingState.sortBy = sortBy;
        trackingState.sortDir = sortDir || 'desc';
        trackingState.page = 1;
        loadTrackingDashboard();
    });
    dom.trackingSearchInput?.addEventListener('input', utils.debounce((event) => {
        trackingState.search = event.target.value.trim();
        trackingState.page = 1;
        loadTrackingDashboard();
    }, 250));
    dom.viewAllRankedBtn?.addEventListener('click', () => {
        trackingState.view = trackingState.view === 'all' ? 'top' : 'all';
        trackingState.page = 1;
        loadTrackingDashboard();
    });
    dom.paginationPrev?.addEventListener('click', () => {
        if ((trackingState.universe?.page || 1) > 1) {
            trackingState.page -= 1;
            loadTrackingDashboard();
        }
    });
    dom.paginationNext?.addEventListener('click', () => {
        if ((trackingState.universe?.page || 1) < (trackingState.universe?.totalPages || 1)) {
            trackingState.page += 1;
            loadTrackingDashboard();
        }
    });
    dom.simulatePortfolioBtn?.addEventListener('click', simulatePortfolio);
    dom.exportUniverseBtn?.addEventListener('click', exportUniverseData);
    dom.factorModeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            trackingState.factorMode = button.dataset.factorMode || 'all';
            renderFactorPanel();
        });
    });
    dom.factorFocusSelect?.addEventListener('change', (event) => {
        trackingState.focusedFactor = event.target.value;
        renderFactorPanel();
    });
    dom.sortButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const sortKey = button.dataset.sortKey;
            if (!sortKey) return;
            if (trackingState.sortBy === sortKey) {
                trackingState.sortDir = trackingState.sortDir === 'desc' ? 'asc' : 'desc';
            } else {
                trackingState.sortBy = sortKey;
                trackingState.sortDir = sortKey === 'symbol' || sortKey === 'market' ? 'asc' : 'desc';
            }
            trackingState.page = 1;
            syncSortSelect();
            loadTrackingDashboard();
        });
    });
    dom.rankedUniverseBody?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-symbol-select]');
        if (!button) return;
        trackingState.selectedSymbol = button.dataset.symbolSelect || '';
        trackingState.selectedMarket = button.dataset.market || '';
        loadFactorPayload().then(renderFactorPanel);
    });
}

async function loadTrackingDashboard({ silent = false } = {}) {
    if (trackingState.loading) return;
    trackingState.loading = true;
    try {
        const universeParams = {
            market: trackingState.market,
            action: trackingState.action,
            search: trackingState.search,
            sortBy: trackingState.sortBy,
            sortDir: trackingState.sortDir,
            page: trackingState.page,
            pageSize: trackingState.pageSize,
            view: trackingState.view
        };
        const [summaryResponse, universeResponse, coverageResponse, actionsResponse] = await Promise.all([
            api.getTrackingSummary(),
            api.getTrackingUniverse(universeParams),
            api.getTrackingCoverage(),
            api.getTrackingActions({ type: trackingState.actionType, limit: 20 })
        ]);

        trackingState.summary = summaryResponse.summary;
        trackingState.meta = universeResponse.meta || summaryResponse.meta;
        trackingState.universe = universeResponse.universe;
        trackingState.coverage = coverageResponse.coverage;
        trackingState.actions = actionsResponse;
        syncSelectedRow();
        await loadFactorPayload();
        renderDashboard();
    } catch (error) {
        renderError(error, silent);
    } finally {
        trackingState.loading = false;
    }
}

function syncSelectedRow() {
    const rows = trackingState.universe?.rows || [];
    if (!rows.length) {
        trackingState.selectedSymbol = '';
        trackingState.selectedMarket = '';
        return;
    }
    const existing = rows.find((row) => row.symbol === trackingState.selectedSymbol && row.market === trackingState.selectedMarket);
    if (!existing) {
        trackingState.selectedSymbol = rows[0].symbol;
        trackingState.selectedMarket = rows[0].market;
    }
}

async function loadFactorPayload() {
    if (!trackingState.selectedSymbol) {
        trackingState.factorPayload = null;
        return;
    }
    trackingState.factorPayload = await api.getTrackingFactors({
        symbol: trackingState.selectedSymbol,
        market: trackingState.selectedMarket
    });
}

function renderDashboard() {
    renderStatusBar();
    renderSummaryCards();
    renderCoverage();
    renderUniverse();
    renderFactorPanel();
    renderActions();
    renderPagination();
}

function renderStatusBar() {
    const stale = Boolean(trackingState.meta?.stale);
    dom.trackingModeBadge.textContent = stale ? 'STALE' : 'LIVE';
    dom.trackingModeBadge.className = `status-badge ${stale ? 'warning' : 'success'}`;
    dom.trackingRefreshBadge.textContent = `Refresh ${trackingState.summary?.refreshIntervalSec || 10}s`;
    dom.trackingLastUpdated.textContent = `Updated ${formatUtc(trackingState.summary?.lastUpdatedAt)}`;
    dom.trackingLatestAction.textContent = `Latest Action ${trackingState.summary?.latestActionAt ? formatUtc(trackingState.summary.latestActionAt) : 'Waiting'}`;
}

function renderSummaryCards() {
    const summary = trackingState.summary || {};
    dom.summaryCryptoCount.textContent = utils.formatNumber(summary.cryptoCount || 0, 0);
    dom.summaryCnCount.textContent = utils.formatNumber(summary.cnCount || 0, 0);
    dom.summaryUsCount.textContent = utils.formatNumber(summary.usCount || 0, 0);
    dom.summaryCoverageValue.textContent = `${(summary.totalCoveragePct || 0).toFixed(1)}%`;
    dom.summaryCoverageCaption.textContent = `Avg quality ${(summary.averageQualityPct || 0).toFixed(1)}%`;
    dom.summaryCoverageFill.style.width = `${summary.totalCoveragePct || 0}%`;
    dom.summaryCoverageFill.className = `progress-fill ${coverageTone(summary.totalCoveragePct || 0)}`;
    const stale = Boolean(summary.stale);
    [dom.summaryCryptoStatus, dom.summaryCnStatus, dom.summaryUsStatus].forEach((badge) => {
        badge.textContent = stale ? 'Stale' : 'Live';
        badge.className = `status-badge ${stale ? 'warning' : 'info'}`;
    });
}

function renderCoverage() {
    const coverage = trackingState.coverage;
    if (!coverage?.rows?.length) {
        dom.coverageMatrix.innerHTML = '<div class="tracking-empty">Coverage unavailable.</div>';
        return;
    }
    const header = `
        <div class="tracking-coverage-row header">
            <div>Market</div>
            <div>Coverage</div>
            <div>Missing</div>
            <div>Quality</div>
        </div>
    `;
    const body = coverage.rows.map((row) => `
        <div class="tracking-coverage-row" title="${escapeHtml(row.tooltip || '')}">
            <div class="tracking-coverage-cell" style="background:${heatColor(row.qualityPct, 'market')}">
                <div class="tracking-coverage-label">${escapeHtml(row.marketLabel)}</div>
                <div class="tracking-coverage-value">${utils.formatNumber(row.totalSymbols || 0, 0)}</div>
                <div class="tracking-coverage-subtext">${row.stale ? 'Stale snapshot' : 'Live feed'}</div>
            </div>
            <div class="tracking-coverage-cell" style="background:${heatColor(row.coveragePct, 'coverage')}">
                <div class="tracking-coverage-label">Coverage</div>
                <div class="tracking-coverage-value">${row.coveragePct.toFixed(1)}%</div>
            </div>
            <div class="tracking-coverage-cell" style="background:${heatColor(100 - row.missingPct, 'missing')}">
                <div class="tracking-coverage-label">Missing</div>
                <div class="tracking-coverage-value">${row.missingPct.toFixed(1)}%</div>
            </div>
            <div class="tracking-coverage-cell" style="background:${heatColor(row.qualityPct, 'quality')}">
                <div class="tracking-coverage-label">Quality</div>
                <div class="tracking-coverage-value">${row.qualityPct.toFixed(1)}%</div>
                <div class="tracking-coverage-subtext">${escapeHtml(row.qualityText)}</div>
            </div>
        </div>
    `).join('');
    dom.coverageMatrix.innerHTML = header + body;
    dom.coverageSummary.textContent = `Avg Quality ${coverage.averageQualityPct.toFixed(1)}% | ${coverage.totalSymbols} live symbols covered`;
    dom.coverageSummary.title = coverage.summaryTooltip || '';
}

function renderUniverse() {
    const universe = trackingState.universe;
    if (!universe?.rows?.length) {
        dom.rankedUniverseBody.innerHTML = '<tr><td colspan="7"><div class="tracking-empty">No ranked rows match the current filter.</div></td></tr>';
        return;
    }
    dom.rankedUniverseCaption.textContent = `Showing ${universe.rows.length} of ${universe.total} ranked rows. Auto-refreshing every ${trackingState.summary?.refreshIntervalSec || 10}s.`;
    dom.rankedUniverseMeta.textContent = `${trackingState.meta?.stale ? 'STALE' : 'LIVE'} | ${universe.total} rows`;
    dom.viewAllRankedBtn.textContent = trackingState.view === 'all' ? 'Show Top 20' : 'View All Ranked';
    updateSortIndicators();
    dom.rankedUniverseBody.innerHTML = universe.rows.map((row) => {
        const selected = row.symbol === trackingState.selectedSymbol && row.market === trackingState.selectedMarket;
        return `
            <tr${selected ? ' style="background: rgba(0, 229, 255, 0.06);"' : ''}>
                <td class="tracking-rank-cell">#${row.rank}</td>
                <td>
                    <div class="tracking-symbol-cell">
                        <button type="button" data-symbol-select="${escapeHtml(row.symbol)}" data-market="${escapeHtml(row.market)}">${escapeHtml(row.symbol)}</button>
                        <span class="tracking-symbol-name">${escapeHtml(row.name)}</span>
                    </div>
                </td>
                <td>${escapeHtml(row.marketLabel)}</td>
                <td>${formatRatioPercent(row.totalScore, 1)}</td>
                <td>${formatRatioPercent(row.pUp, 1)}</td>
                <td>${formatRatioPercent(row.factorScore, 1)}</td>
                <td><span class="status-badge ${badgeTone(row.actionTone)}" title="${escapeHtml(row.actionTooltip)}">${escapeHtml(row.action)}</span></td>
            </tr>
        `;
    }).join('');
}

function renderFactorPanel() {
    const payload = trackingState.factorPayload;
    if (!payload) {
        dom.factorSelectedMeta.innerHTML = '<span class="status-badge warning">No selection</span>';
        dom.factorList.innerHTML = '<div class="tracking-empty">Choose a ranked symbol to inspect factor details.</div>';
        return;
    }
    dom.factorSelectedMeta.innerHTML = [
        `<span class="status-badge info">${escapeHtml(payload.symbol)}</span>`,
        `<span class="status-badge info">${escapeHtml(payload.marketLabel)}</span>`,
        `<span class="status-badge ${badgeTone(payload.action === 'REDUCE' ? 'danger' : payload.action === 'HOLD' ? 'warning' : 'success')}">${escapeHtml(payload.action)}</span>`,
        `<span class="status-badge info">Total ${formatRatioPercent(payload.totalScore, 1)}</span>`
    ].join('');
    dom.factorModeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.factorMode === trackingState.factorMode);
    });
    dom.factorFocusSelect.style.display = trackingState.factorMode === 'single' ? 'block' : 'none';
    const factors = payload.factors || [];
    const visibleFactors = trackingState.factorMode === 'single'
        ? factors.filter((item) => item.key === trackingState.focusedFactor)
        : factors;
    dom.factorList.innerHTML = visibleFactors.map((factor) => `
        <div class="tracking-factor-item" title="${escapeHtml(factor.explanation)}">
            <div class="tracking-factor-head">
                <span class="tracking-factor-label">${escapeHtml(factor.label)}</span>
                <span class="tracking-factor-value">${formatRatioPercent(factor.value, 1)}</span>
            </div>
            <div class="tracking-factor-bar"><div class="tracking-factor-fill" style="width:${factor.value * 100}%"></div></div>
            <div class="tracking-factor-note">${escapeHtml(factor.explanation)}</div>
        </div>
    `).join('');
    const contributionText = Object.entries(payload.contribution || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, value]) => `${titleize(key)} ${value.toFixed(1)}%`)
        .join(' | ');
    dom.factorContributionSummary.textContent = `${payload.symbol} contribution mix: ${contributionText || 'No contribution data'}`;
    renderContributionChart(payload);
}

function renderContributionChart(payload) {
    if (!dom.factorContributionChart) return;
    const labels = Object.keys(payload.contribution || {}).map(titleize);
    const values = Object.values(payload.contribution || {});
    const colors = ['#22d3ee', '#6ee7b7', '#f59e0b', '#fb7185', '#94a3b8'];
    if (trackingState.contributionChart) {
        trackingState.contributionChart.destroy();
    }
    trackingState.contributionChart = new Chart(dom.factorContributionChart.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#cbd5e1' } } }
        }
    });
}

function renderActions() {
    const items = trackingState.actions?.items || [];
    dom.trackingActionsMeta.textContent = `Latest Action: ${trackingState.actions?.latestActionAt ? formatUtc(trackingState.actions.latestActionAt) : 'Waiting for first live delta'}`;
    if (!items.length) {
        dom.trackingActionsGrid.innerHTML = '<div class="tracking-empty">Waiting for the next live universe delta.</div>';
        return;
    }
    dom.trackingActionsGrid.innerHTML = items.map((item) => `
        <div class="tracking-action-card ${badgeTone(item.tone)}">
            <div class="tracking-action-type">${escapeHtml(item.label)}</div>
            <div class="tracking-action-text">${escapeHtml(item.symbol)} - ${escapeHtml(item.reason)}</div>
            <div class="tracking-action-time">${formatUtc(item.timestamp)}</div>
            <div class="tracking-action-detail">
                <div style="font-size:0.86rem; color: var(--text-primary); font-weight:700;">${escapeHtml(item.symbol)} | ${escapeHtml(item.marketLabel)}</div>
                <div style="margin-top:0.35rem; color:var(--text-secondary); font-size:0.8rem;">${escapeHtml(item.symbolDetail?.whyAdded || item.reason)}</div>
                <div class="tracking-action-detail-grid">
                    <div class="tracking-action-detail-block"><span>P(UP)</span><span>${formatRatioPercent(item.symbolDetail?.pUp ?? 0, 1)}</span></div>
                    <div class="tracking-action-detail-block"><span>Confidence</span><span>${formatRatioPercent(item.symbolDetail?.confidence ?? 0, 1)}</span></div>
                    <div class="tracking-action-detail-block"><span>Momentum</span><span>${formatRatioPercent(item.symbolDetail?.factors?.momentum ?? 0, 1)}</span></div>
                    <div class="tracking-action-detail-block"><span>Edge</span><span>${formatRatioPercent(item.symbolDetail?.factors?.edge ?? 0, 1)}</span></div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPagination() {
    const universe = trackingState.universe || { page: 1, totalPages: 1, total: 0, rows: [] };
    dom.paginationInfo.textContent = trackingState.view === 'all'
        ? `Viewing all ${universe.total} ranked rows`
        : `Page ${universe.page} / ${universe.totalPages} | ${universe.total} total rows`;
    dom.paginationPrev.disabled = trackingState.view === 'all' || universe.page <= 1;
    dom.paginationNext.disabled = trackingState.view === 'all' || universe.page >= universe.totalPages;
}

async function simulatePortfolio() {
    dom.simulatePortfolioBtn.disabled = true;
    try {
        const response = await api.simulateTrackingPortfolio({
            topN: 10,
            market: trackingState.market,
            action: trackingState.action,
            search: trackingState.search,
            sortBy: trackingState.sortBy,
            sortDir: trackingState.sortDir
        });
        trackingState.simulation = response.simulation;
        renderSimulation();
    } catch (error) {
        dom.simulationCard.classList.add('visible');
        dom.simulationGrid.innerHTML = `<div class="tracking-error">Simulation failed: ${escapeHtml(error.message)}</div>`;
    } finally {
        dom.simulatePortfolioBtn.disabled = false;
    }
}

function renderSimulation() {
    const simulation = trackingState.simulation;
    if (!simulation) return;
    dom.simulationCard.classList.add('visible');
    dom.simulationMeta.textContent = `Top ${simulation.topN} | Mock Sharpe ${simulation.sharpe}`;
    const holdingsSummary = (simulation.holdings || [])
        .slice(0, 5)
        .map((holding) => `${holding.symbol} ${holding.weightPct.toFixed(1)}%`)
        .join(' | ');
    const metrics = [
        ['Expected Return', `${simulation.expectedReturnPct.toFixed(2)}%`],
        ['Sharpe', simulation.sharpe.toFixed(2)],
        ['Downside', `${simulation.downsidePct.toFixed(2)}%`],
        ['Upside', `${simulation.upsidePct.toFixed(2)}%`],
        ['Mock PNL', utils.formatCurrency(simulation.pnlUsd || 0)],
        ['Holdings', String(simulation.topN)]
    ];
    dom.simulationGrid.innerHTML = metrics.map(([label, value]) => `
        <div class="tracking-simulation-metric"><span>${label}</span><span>${value}</span></div>
    `).join('') + `
        <div class="tracking-simulation-metric tracking-simulation-metric-wide">
            <span>Top Holdings</span>
            <span>${escapeHtml(holdingsSummary || 'No holdings selected')}</span>
        </div>
    `;
}

async function exportUniverseData() {
    const response = await api.getTrackingUniverse({
        market: trackingState.market,
        action: trackingState.action,
        search: trackingState.search,
        sortBy: trackingState.sortBy,
        sortDir: trackingState.sortDir,
        view: 'all',
        page: 1,
        pageSize: 100
    });
    const rows = response.universe?.rows || [];
    const csv = [
        ['Rank', 'Symbol', 'Name', 'Market', 'Total Score', 'P(UP)', 'Factor Score', 'Action'],
        ...rows.map((row) => [row.rank, row.symbol, row.name, row.marketLabel, row.totalScore, row.pUp, row.factorScore, row.action])
    ].map((line) => line.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracking-universe-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function renderError(error, silent) {
    console.error('Tracking page error:', error);
    dom.trackingModeBadge.textContent = 'UNAVAILABLE';
    dom.trackingModeBadge.className = 'status-badge danger';
    dom.rankedUniverseBody.innerHTML = `<tr><td colspan="7"><div class="tracking-error">Tracking unavailable: ${escapeHtml(error.message)}</div></td></tr>`;
    if (!silent) {
        dom.coverageMatrix.innerHTML = `<div class="tracking-error">Coverage unavailable: ${escapeHtml(error.message)}</div>`;
        dom.factorList.innerHTML = `<div class="tracking-error">Factor payload unavailable: ${escapeHtml(error.message)}</div>`;
        dom.trackingActionsGrid.innerHTML = `<div class="tracking-error">Actions unavailable: ${escapeHtml(error.message)}</div>`;
    }
}

function syncSortSelect() {
    if (!dom.trackingSortSelect) {
        return;
    }
    const desiredValue = `${trackingState.sortBy}:${trackingState.sortDir}`;
    const hasExactMatch = Array.from(dom.trackingSortSelect.options).some((option) => option.value === desiredValue);
    dom.trackingSortSelect.value = hasExactMatch ? desiredValue : `${trackingState.sortBy}:desc`;
}

function updateSortIndicators() {
    dom.sortButtons.forEach((button) => {
        const active = button.dataset.sortKey === trackingState.sortBy;
        button.classList.toggle('active', active);
        const labelSource = button.dataset.baseLabel || button.textContent || '';
        const baseLabel = labelSource.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
        button.dataset.baseLabel = baseLabel;
        button.innerHTML = active
            ? `${escapeHtml(baseLabel)} <span aria-hidden="true">${trackingState.sortDir === 'desc' ? '&darr;' : '&uarr;'}</span>`
            : escapeHtml(baseLabel);
    });
    syncSortSelect();
}

function coverageTone(value) {
    if (value > 95) return 'high';
    if (value >= 80) return 'medium';
    return 'low';
}

function badgeTone(tone) {
    return tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'info' ? 'info' : 'success';
}

function formatRatioPercent(value, decimals = 0) {
    if (!Number.isFinite(value)) return '--';
    return `${(value * 100).toFixed(decimals)}%`;
}

function formatUtc(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function titleize(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function heatColor(value, type) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    if (type === 'missing') {
        return `linear-gradient(135deg, rgba(239,68,68,${0.18 + ((100 - pct) / 100) * 0.36}), rgba(15,23,42,0.88))`;
    }
    if (type === 'quality') {
        return `linear-gradient(135deg, rgba(34,197,94,${0.15 + (pct / 100) * 0.3}), rgba(8,12,29,0.9))`;
    }
    if (type === 'coverage') {
        return `linear-gradient(135deg, rgba(34,211,238,${0.12 + (pct / 100) * 0.28}), rgba(8,12,29,0.9))`;
    }
    return `linear-gradient(135deg, rgba(148,163,184,${0.08 + (pct / 100) * 0.16}), rgba(8,12,29,0.9))`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeCsv(value) {
    const stringValue = String(value ?? '');
    return `"${stringValue.replace(/"/g, '""')}"`;
}
