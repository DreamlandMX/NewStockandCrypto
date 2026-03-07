const HOME_DEFAULT_REFRESH_MS = 10000;

const homeState = {
    payload: null,
    selectedCardKey: '',
    loading: false,
    refreshHandle: null,
    refreshMs: HOME_DEFAULT_REFRESH_MS
};

const homeDom = {};

document.addEventListener('DOMContentLoaded', initializeHomePage);

function initializeHomePage() {
    cacheHomeDom();
    bindHomeEvents();
    renderHomeLoading();
    loadHomeLanding();
}

function cacheHomeDom() {
    const ids = [
        'homeStatusBadge', 'homeRefreshBadge', 'homeUpdatedBadge', 'homeActionBadge',
        'heroCoverageValue', 'heroCoverageMeta',
        'heroAssetsValue', 'heroAssetsMeta',
        'heroSignalsValue', 'heroSignalsMeta',
        'marketOverviewGrid',
        'featurePanelBadge', 'featurePanelTitle', 'featurePanelMeta', 'featurePanelList', 'featurePanelExplanation',
        'homeFooterCopy'
    ];
    ids.forEach((id) => {
        homeDom[id] = document.getElementById(id);
    });
}

function bindHomeEvents() {
    const overviewGrid = document.getElementById('marketOverviewGrid');
    overviewGrid?.addEventListener('click', (event) => {
        const card = event.target.closest('[data-home-card-key]');
        if (!card) return;
        homeState.selectedCardKey = card.dataset.homeCardKey || '';
        renderOverviewCards();
        renderFeaturePanel();
    });
}

async function loadHomeLanding({ silent = false } = {}) {
    if (homeState.loading) return;
    homeState.loading = true;
    try {
        const payload = await api.getHomeLanding();
        homeState.payload = payload;
        syncSelectedCard();
        syncRefreshHandle(payload.meta?.refreshIntervalSec);
        renderHome();
    } catch (error) {
        console.error('Home landing load failed:', error);
        if (homeState.payload) {
            homeState.payload = {
                ...homeState.payload,
                meta: {
                    ...(homeState.payload.meta || {}),
                    stale: true,
                    staleReasons: uniqueStrings([...(homeState.payload.meta?.staleReasons || []), error.message])
                }
            };
            renderHeroStatus();
            renderFooter();
            if (!silent) {
                renderFeaturePanel();
            }
        } else {
            renderHardError(error);
        }
    } finally {
        homeState.loading = false;
    }
}

function syncRefreshHandle(refreshIntervalSec) {
    const nextMs = Math.max(1000, Number(refreshIntervalSec || 10) * 1000);
    if (homeState.refreshHandle && homeState.refreshMs === nextMs) return;
    if (homeState.refreshHandle) {
        window.clearInterval(homeState.refreshHandle);
    }
    homeState.refreshMs = nextMs;
    homeState.refreshHandle = window.setInterval(() => {
        loadHomeLanding({ silent: true });
    }, nextMs);
}

function syncSelectedCard() {
    const cards = homeState.payload?.overview?.cards || [];
    const selected = cards.find((card) => card.cardKey === homeState.selectedCardKey && !card.unavailable);
    if (selected) return;
    const featured = cards.find((card) => card.cardKey === homeState.payload?.featuredCardKey && !card.unavailable);
    const fallback = cards.find((card) => !card.unavailable);
    homeState.selectedCardKey = featured?.cardKey || fallback?.cardKey || cards[0]?.cardKey || '';
}

function renderHome() {
    renderHeroStatus();
    renderHeroMetrics();
    renderOverviewCards();
    renderFeaturePanel();
    renderFooter();
}

function renderHomeLoading() {
    if (homeDom.marketOverviewGrid) {
        homeDom.marketOverviewGrid.innerHTML = Array.from({ length: 9 }).map(() => `
            <div class="metric-card home-overview-card is-loading">
                <div class="metric-label">Loading</div>
                <div class="metric-value mono" style="font-size: 1.5rem;">--</div>
                <div class="home-card-footer">
                    <span class="metric-change mono">--</span>
                    <div class="home-card-signal">
                        <div class="mono home-card-pup">P(UP): --</div>
                        <div class="mono home-card-conf">-- Conf</div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    if (homeDom.featurePanelList) {
        homeDom.featurePanelList.innerHTML = '<div class="home-panel-empty">Waiting for live factor payload...</div>';
    }
}

function renderHeroStatus() {
    const meta = homeState.payload?.meta || {};
    const stale = Boolean(meta.stale);
    const latestActionAt = homeState.payload?.hero?.latestActionAt;
    homeDom.homeStatusBadge.textContent = stale ? 'STALE' : 'LIVE';
    homeDom.homeStatusBadge.className = `status-badge ${stale ? 'warning' : 'success'}`;
    homeDom.homeRefreshBadge.textContent = `Refresh ${meta.refreshIntervalSec || 10}s`;
    homeDom.homeUpdatedBadge.textContent = `Updated ${formatUtc(meta.lastUpdatedAt)}`;
    homeDom.homeActionBadge.textContent = `Latest Action ${latestActionAt ? formatUtc(latestActionAt) : 'Waiting'}`;
    homeDom.homeActionBadge.className = `status-badge ${stale ? 'warning' : 'info'}`;
}

function renderHeroMetrics() {
    const hero = homeState.payload?.hero || {};
    homeDom.heroCoverageValue.textContent = `${Number(hero.liveCoveragePct || 0).toFixed(1)}%`;
    homeDom.heroCoverageMeta.textContent = `${homeState.payload?.meta?.stale ? 'Stale snapshot' : 'Live multi-market completeness'}`;

    homeDom.heroAssetsValue.textContent = utils.formatNumber(hero.assetsCovered || 0, 0);
    homeDom.heroAssetsMeta.textContent = 'Crypto + CN A-Shares + US Equities';

    homeDom.heroSignalsValue.textContent = utils.formatNumber(hero.actionableSignals || 0, 0);
    homeDom.heroSignalsMeta.textContent = `${utils.formatNumber(hero.strongBuyCount || 0, 0)} strong buy | ${utils.formatNumber(hero.buyCount || 0, 0)} buy`;
}

function renderOverviewCards() {
    const cards = homeState.payload?.overview?.cards || [];
    if (!cards.length) {
        homeDom.marketOverviewGrid.innerHTML = '<div class="home-panel-empty">No live market cards available.</div>';
        return;
    }
    homeDom.marketOverviewGrid.innerHTML = cards.map((card) => {
        const selected = card.cardKey === homeState.selectedCardKey;
        const toneClass = selected ? 'is-selected' : '';
        const staleClass = card.stale ? 'is-stale' : '';
        const unavailableClass = card.unavailable ? 'is-unavailable' : '';
        const leaderMeta = card.leaderMeta ? `<div class="home-card-subcopy">${escapeHtml(card.leaderMeta.symbol)} | ${escapeHtml(card.leaderMeta.name || '')}</div>` : '';
        const actionBadge = `<span class="status-badge ${badgeTone(card.actionTone)}">${escapeHtml(card.stale ? `${card.action} / STALE` : card.action || 'LIVE')}</span>`;
        return `
            <button type="button" class="metric-card home-overview-card ${toneClass} ${staleClass} ${unavailableClass}" data-home-card-key="${escapeHtml(card.cardKey)}">
                <div class="home-card-head">
                    <div>
                        <div class="metric-label">${escapeHtml(card.label || '--')}</div>
                        ${leaderMeta}
                    </div>
                    ${actionBadge}
                </div>
                <div class="metric-value mono home-card-price">${formatCardPrice(card)}</div>
                <div class="home-card-footer">
                    <span class="metric-change ${changeToneClass(card.changePct)} mono">${formatCardChange(card.changePct)}</span>
                    <div class="home-card-signal">
                        <div class="mono home-card-pup">${formatCardPUp(card.pUp)}</div>
                        <div class="mono home-card-conf">${formatConfidence(card.confidence)}</div>
                    </div>
                </div>
            </button>
        `;
    }).join('');
}

function renderFeaturePanel() {
    const details = homeState.payload?.detailsByCard?.[homeState.selectedCardKey];
    if (!details) {
        homeDom.featurePanelBadge.textContent = 'Unavailable';
        homeDom.featurePanelBadge.className = 'status-badge danger';
        homeDom.featurePanelTitle.textContent = 'Feature Importance';
        homeDom.featurePanelMeta.textContent = 'Choose an available card to inspect live factors.';
        homeDom.featurePanelList.innerHTML = '<div class="home-panel-empty">Factor payload unavailable.</div>';
        homeDom.featurePanelExplanation.textContent = 'No live explanation available.';
        return;
    }

    homeDom.featurePanelBadge.textContent = details.badge || 'Live Factors';
    homeDom.featurePanelBadge.className = `status-badge ${details.stale ? 'warning' : badgeTone(details.actionTone)}`;
    homeDom.featurePanelTitle.textContent = details.title || 'Feature Importance';
    homeDom.featurePanelMeta.textContent = details.subtitle || `${details.marketLabel || '--'} | ${details.symbol || '--'}`;

    const factors = Array.isArray(details.factors) ? details.factors : [];
    homeDom.featurePanelList.innerHTML = factors.length ? factors.map((factor) => `
        <div class="home-factor-row" title="${escapeHtml(factor.explanation || '')}">
            <div class="home-factor-labels">
                <span>${escapeHtml(factor.label)}</span>
                <span class="mono ${factorValueTone(factor.value)}">${formatSignedFactorValue(factor.value)}</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${factorBarTone(factor.key)}" style="width:${Math.max(8, Math.min(100, (factor.contributionPct || 0)))}%;"></div>
            </div>
            <div class="home-factor-meta mono">${Number(factor.contributionPct || 0).toFixed(1)}% contribution</div>
        </div>
    `).join('') : '<div class="home-panel-empty">No factor details available.</div>';

    homeDom.featurePanelExplanation.textContent = details.explanation || details.actionTooltip || 'Live explanation unavailable.';
}

function renderFooter() {
    const staleText = homeState.payload?.meta?.stale ? 'STALE SNAPSHOT' : 'LIVE SNAPSHOT';
    const updatedText = formatUtc(homeState.payload?.meta?.lastUpdatedAt);
    homeDom.homeFooterCopy.textContent = `${staleText} | Auto-refresh ${Math.round(homeState.refreshMs / 1000)}s | Updated ${updatedText} | Not Investment Advice`;
}

function renderHardError(error) {
    homeDom.homeStatusBadge.textContent = 'UNAVAILABLE';
    homeDom.homeStatusBadge.className = 'status-badge danger';
    homeDom.homeUpdatedBadge.textContent = 'Updated --';
    homeDom.homeActionBadge.textContent = `Home feed unavailable`;
    homeDom.marketOverviewGrid.innerHTML = `<div class="home-panel-empty">Home landing unavailable: ${escapeHtml(error.message)}</div>`;
    homeDom.featurePanelList.innerHTML = '<div class="home-panel-empty">Live factor payload unavailable.</div>';
    homeDom.featurePanelExplanation.textContent = 'Home landing feed is currently unavailable.';
    homeDom.homeFooterCopy.textContent = 'LIVE SNAPSHOT UNAVAILABLE | Not Investment Advice';
}

function formatCardPrice(card) {
    if (!Number.isFinite(card?.price)) return '--';
    switch (card.displayKind) {
    case 'usd':
        return utils.formatCurrency(card.price, 'USD', card.price >= 100 ? 0 : 2);
    case 'cny':
        return utils.formatCurrency(card.price, 'CNY', card.price >= 100 ? 0 : 2);
    case 'number':
    default:
        return utils.formatNumber(card.price, card.price >= 1000 ? 0 : 2);
    }
}

function formatCardChange(changePct) {
    if (!Number.isFinite(changePct)) return '--';
    return `${changePct >= 0 ? '+' : ''}${(changePct * 100).toFixed(2)}%`;
}

function formatCardPUp(pUp) {
    if (!Number.isFinite(pUp)) return 'P(UP): --';
    return `P(UP): ${Number(pUp).toFixed(2)}`;
}

function formatConfidence(confidence) {
    if (!Number.isFinite(confidence)) return '-- Conf';
    return `${Math.round(confidence * 100)}% Conf`;
}

function changeToneClass(changePct) {
    if (!Number.isFinite(changePct)) return '';
    return changePct >= 0 ? 'positive' : 'negative';
}

function badgeTone(tone) {
    if (tone === 'success') return 'success';
    if (tone === 'danger') return 'danger';
    if (tone === 'warning') return 'warning';
    return 'info';
}

function factorValueTone(value) {
    if (!Number.isFinite(value)) return '';
    if (value >= 0.6) return 'home-factor-positive';
    if (value <= 0.35) return 'home-factor-negative';
    return 'home-factor-neutral';
}

function factorBarTone(key) {
    if (key === 'momentum') return 'home-bar-momentum';
    if (key === 'edge') return 'home-bar-edge';
    if (key === 'liquidity') return 'home-bar-liquidity';
    if (key === 'volatility') return 'home-bar-volatility';
    return 'home-bar-coverage';
}

function formatSignedFactorValue(value) {
    if (!Number.isFinite(value)) return '--';
    const signed = ((value - 0.5) * 2).toFixed(3);
    return `${value >= 0.5 ? '+' : ''}${signed}`;
}

function formatUtc(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function uniqueStrings(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
