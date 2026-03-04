(function () {
    'use strict';

    const state = {
        model: 'lstm',
        asset: 'BTCUSDT',
        horizon: '1H',
        mode: 'UNKNOWN',
        modelVersion: '--',
        loading: false,
        heatmapChart: null,
        heatmapScale: { min: -1, max: 1 },
        highlightedFeatureKey: null,
        lastTopFeatures: [],
        assetHorizonMap: {},
    };

    const els = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function safeText(value, fallback = '--') {
        if (value === null || value === undefined || value === '') return fallback;
        return String(value);
    }

    function toNumber(value, fallback = NaN) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeFeatureKey(name) {
        return safeText(name, '').trim().toLowerCase();
    }

    function titleCase(text) {
        return text
            .split(' ')
            .map((chunk) => (chunk ? chunk[0].toUpperCase() + chunk.slice(1) : chunk))
            .join(' ');
    }

    function formatFeatureName(rawName) {
        const key = normalizeFeatureKey(rawName);
        const map = {
            momentum_20d: 'Momentum (20d)',
            volatility_score: 'Volatility Score',
            us_correlation: 'US Correlation',
            size_factor: 'Size Factor',
            volume_change: 'Volume Change',
            volume_ratio: 'Volume Ratio',
            news_sentiment: 'News Sentiment',
            return_1: 'Return (1)',
            return_3: 'Return (3)',
            return_6: 'Return (6)',
            momentum_6: 'Momentum (6)',
            momentum_12: 'Momentum (12)',
            vol_6: 'Volatility (6)',
            missing_coverage: 'Missing Coverage',
        };

        if (map[key]) {
            return map[key];
        }

        const trailingWindow = key.match(/^(.*)_(\d+)([a-z])$/i);
        if (trailingWindow) {
            const label = titleCase(trailingWindow[1].replace(/_/g, ' '));
            return `${label} (${trailingWindow[2]}${trailingWindow[3].toUpperCase()})`;
        }

        const trailingNumber = key.match(/^(.*)_(\d+)$/);
        if (trailingNumber) {
            const label = titleCase(trailingNumber[1].replace(/_/g, ' '));
            return `${label} (${trailingNumber[2]})`;
        }

        return titleCase(key.replace(/_/g, ' '));
    }

    function formatRatio(value, digits = 2) {
        const num = toNumber(value);
        if (!Number.isFinite(num)) return '--';
        return num.toFixed(digits);
    }

    function formatSignedPercent(value, digits = 2) {
        const num = toNumber(value);
        if (!Number.isFinite(num)) return '--';
        const sign = num >= 0 ? '+' : '';
        return `${sign}${(num * 100).toFixed(digits)}%`;
    }

    function formatPercentNoSign(value, digits = 1) {
        const num = toNumber(value);
        if (!Number.isFinite(num)) return '--';
        return `${(num * 100).toFixed(digits)}%`;
    }

    function modeClass(mode) {
        const normalized = String(mode || '').toUpperCase();
        if (normalized === 'MOCK') return 'warning';
        if (normalized === 'LIVE') return 'success';
        return 'info';
    }

    function setLoading(flag) {
        state.loading = flag;
        if (!els.loadingMask) return;
        els.loadingMask.style.display = flag ? 'flex' : 'none';
    }

    function notifyError(message) {
        if (window.showToast && typeof window.showToast.error === 'function') {
            window.showToast.error(message, 3800);
            return;
        }
        console.error(message);
    }

    function collectElements() {
        els.modeBadge = byId('modelModeBadge');
        els.loadedModelBadge = byId('loadedModelBadge');
        els.predictionContext = byId('predictionContext');
        els.predictionConfidenceTag = byId('predictionConfidenceTag');
        els.pUpValue = byId('predictionPUp');
        els.q50Value = byId('predictionQ50');
        els.intervalWidthValue = byId('predictionIntervalWidth');
        els.explanationSummary = byId('modelExplanationSummary');

        els.metricAccuracy = byId('metricDirectionAccuracy');
        els.metricBrier = byId('metricBrierScore');
        els.metricEce = byId('metricEce');
        els.metricCoverage = byId('metricCoverage');

        els.assetSelect = byId('assetSelect');
        els.modelButtons = Array.from(document.querySelectorAll('[data-model-btn], [data-model]'));
        els.horizonButtons = Array.from(document.querySelectorAll('[data-horizon-btn], [data-horizon]'));
        els.featuresList = byId('topFeaturesList');

        els.heatmapCanvas = byId('heatmapChart');
        els.heatmapEmptyState = byId('heatmapEmptyState');
        els.insightPositive = byId('heatmapInsightPositive');
        els.insightNegative = byId('heatmapInsightNegative');
        els.insightNeutral = byId('heatmapInsightNeutral');

        els.loadingMask = byId('modelExplorerLoading');
        els.refreshButton = byId('modelExplorerRefresh');
    }

    function getModelFromButton(button) {
        return button.dataset.modelBtn || button.dataset.model || '';
    }

    function getHorizonFromButton(button) {
        return button.dataset.horizonBtn || button.dataset.horizon || '';
    }

    function syncHorizonAvailability() {
        const allowed = new Set(state.assetHorizonMap[state.asset] || ['1H', '4H', '1D', '3D']);
        els.horizonButtons.forEach((button) => {
            const horizon = getHorizonFromButton(button);
            const enabled = allowed.has(horizon);
            button.disabled = !enabled;
            button.style.opacity = enabled ? '1' : '0.45';
            button.style.cursor = enabled ? 'pointer' : 'not-allowed';
        });

        if (!allowed.has(state.horizon)) {
            state.horizon = Array.from(allowed)[0] || '1H';
        }
    }

    function applyButtonStates() {
        els.modelButtons.forEach((button) => {
            const active = getModelFromButton(button) === state.model;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        els.horizonButtons.forEach((button) => {
            const active = getHorizonFromButton(button) === state.horizon;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        if (els.assetSelect) {
            els.assetSelect.value = state.asset;
        }
    }

    function renderMeta(meta) {
        if (!meta) return;

        state.mode = safeText(meta.mode, 'unknown').toUpperCase();
        state.modelVersion = safeText(meta.modelVersion, '--');

        if (els.modeBadge) {
            els.modeBadge.className = `status-badge ${modeClass(state.mode)}`;
            els.modeBadge.textContent = state.mode === 'MOCK' ? 'MOCK FEED' : state.mode === 'LIVE' ? 'LIVE MODEL' : state.mode;
        }

        if (els.loadedModelBadge) {
            els.loadedModelBadge.textContent = `Model ${state.modelVersion}`;
        }

        if (els.predictionContext) {
            els.predictionContext.textContent = `${state.asset} | ${state.horizon} Horizon | ${state.model.toUpperCase()} | ${state.modelVersion}`;
        }
    }

    function normalizeSummary(summary, features) {
        let result = safeText(summary, 'No explanation available.');
        if (!Array.isArray(features)) return result;

        features.forEach((feature) => {
            const rawName = safeText(feature.name, '');
            if (!rawName) return;
            const readable = formatFeatureName(rawName);
            const escaped = rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escaped, 'g'), readable);
        });

        return result;
    }

    function renderPrediction(payload) {
        if (!payload) return;

        renderMeta(payload.meta);

        const prediction = payload.prediction || {};
        if (els.pUpValue) els.pUpValue.textContent = formatRatio(prediction.pUp, 2);
        if (els.q50Value) els.q50Value.textContent = formatSignedPercent(prediction.q50, 2);
        if (els.intervalWidthValue) els.intervalWidthValue.textContent = formatSignedPercent(prediction.intervalWidth, 2);

        if (els.predictionConfidenceTag) {
            const confidence = toNumber(prediction.confidence);
            els.predictionConfidenceTag.textContent = Number.isFinite(confidence)
                ? `${Math.round(confidence * 100)}% Confidence`
                : 'Confidence --';
            els.predictionConfidenceTag.className = `status-badge ${confidence >= 0.75 ? 'success' : confidence >= 0.55 ? 'warning' : 'info'}`;
        }

        const explanation = payload.explanation || {};
        if (els.explanationSummary) {
            els.explanationSummary.textContent = normalizeSummary(explanation.summary, explanation.topFeatures || []);
        }

        renderTopFeatures(explanation.topFeatures || []);
    }

    function setHighlightedFeature(featureKey) {
        state.highlightedFeatureKey = featureKey || null;
        if (state.heatmapChart) {
            state.heatmapChart.update('none');
        }

        if (!els.featuresList) return;
        Array.from(els.featuresList.querySelectorAll('.feature-bar')).forEach((row) => {
            const key = row.dataset.featureKey || '';
            row.classList.toggle('active', !!featureKey && key === featureKey);
        });
    }

    function renderHeatmapInsights() {
        if (!els.insightPositive || !els.insightNegative || !els.insightNeutral) {
            return;
        }

        const features = Array.isArray(state.lastTopFeatures) ? state.lastTopFeatures : [];
        const positive = features.find((feature) => toNumber(feature.value, 0) > 0.01);
        const negative = features.find((feature) => toNumber(feature.value, 0) < -0.01);
        const neutral = features.find((feature) => Math.abs(toNumber(feature.value, 0)) <= 0.01) || features[features.length - 1];

        if (positive) {
            els.insightPositive.textContent = `If ${formatFeatureName(positive.name)} is bright green, the model reads a bullish push and increases LONG confidence.`;
        }
        if (negative) {
            els.insightNegative.textContent = `If ${formatFeatureName(negative.name)} is red, the model reads bearish pressure and may reduce LONG confidence.`;
        }
        if (neutral) {
            els.insightNeutral.textContent = `If ${formatFeatureName(neutral.name)} stays yellow, the signal is neutral and has limited directional influence.`;
        }
    }

    function renderTopFeatures(features) {
        if (!els.featuresList) return;

        if (!Array.isArray(features) || features.length === 0) {
            state.lastTopFeatures = [];
            els.featuresList.innerHTML = [
                '<div class="feature-list-note">Hover a feature to highlight its row in the heatmap.</div>',
                '<div style="color: var(--text-muted);">No feature contribution data available.</div>',
            ].join('');
            renderHeatmapInsights();
            return;
        }

        const sorted = [...features].sort((a, b) => Math.abs(toNumber(b.value, 0)) - Math.abs(toNumber(a.value, 0)));
        state.lastTopFeatures = sorted;
        const maxAbs = sorted.reduce((acc, item) => Math.max(acc, Math.abs(toNumber(item.value, 0))), 0) || 1;

        const rows = sorted.slice(0, 8).map((item) => {
            const rawValue = toNumber(item.value, 0);
            const sign = rawValue >= 0 ? '+' : '';
            const width = Math.max(6, Math.round((Math.abs(rawValue) / maxAbs) * 100));
            const featureKey = normalizeFeatureKey(item.name);
            const valueClass = Math.abs(rawValue) < 0.01 ? 'neutral' : rawValue > 0 ? 'positive' : 'negative';

            return `
                <div class="feature-bar" data-feature-key="${featureKey}">
                    <div class="feature-name">${formatFeatureName(item.name)}</div>
                    <div class="feature-impact ${valueClass}">${sign}${rawValue.toFixed(3)}</div>
                    <div class="progress-bar" style="margin-left: 0.7rem; width: 34%;">
                        <div class="progress-fill" style="width:${width}%; background:${rawValue > 0 ? '#22c55e' : rawValue < 0 ? '#ef4444' : '#facc15'};"></div>
                    </div>
                </div>
            `;
        }).join('');

        els.featuresList.innerHTML = `
            <div class="feature-list-note">Hover a feature to highlight its row in the heatmap.</div>
            ${rows}
        `;

        Array.from(els.featuresList.querySelectorAll('.feature-bar')).forEach((row) => {
            const key = row.dataset.featureKey || '';
            row.addEventListener('mouseenter', () => setHighlightedFeature(key));
            row.addEventListener('mouseleave', () => setHighlightedFeature(null));
        });

        renderHeatmapInsights();
    }

    function renderPerformance(payload) {
        if (!payload) return;

        renderMeta(payload.meta);
        const perf = payload.performance || {};

        if (els.metricAccuracy) els.metricAccuracy.textContent = formatPercentNoSign(perf.directionAccuracy, 1);
        if (els.metricBrier) els.metricBrier.textContent = formatRatio(perf.brierScore, 3);
        if (els.metricEce) els.metricEce.textContent = formatRatio(perf.ece, 3);
        if (els.metricCoverage) els.metricCoverage.textContent = formatPercentNoSign(perf.intervalCoverage, 1);
    }

    function toggleHeatmapEmpty(show, message) {
        if (!els.heatmapEmptyState) return;
        els.heatmapEmptyState.textContent = message || 'No strong feature contribution detected.';
        els.heatmapEmptyState.style.display = show ? 'flex' : 'none';
    }

    function interpolateColor(start, end, ratio) {
        const t = Math.max(0, Math.min(1, ratio));
        return [
            Math.round(start[0] + (end[0] - start[0]) * t),
            Math.round(start[1] + (end[1] - start[1]) * t),
            Math.round(start[2] + (end[2] - start[2]) * t),
        ];
    }

    function computeHeatmapScale(values, meta) {
        const metaMin = toNumber(meta?.scaleMin);
        const metaMax = toNumber(meta?.scaleMax);
        if (Number.isFinite(metaMin) && Number.isFinite(metaMax) && metaMin < metaMax) {
            return { min: metaMin, max: metaMax };
        }

        const maxAbs = Math.max(...values.map((value) => Math.abs(value)), 0);
        if (!Number.isFinite(maxAbs) || maxAbs === 0) {
            return { min: -1, max: 1 };
        }

        return { min: -maxAbs, max: maxAbs };
    }

    function describeImpact(value, neutralBand) {
        if (Math.abs(value) <= neutralBand) {
            return {
                direction: 'Neutral',
                meaning: 'Neutral impact on P(UP)',
            };
        }

        if (value > 0) {
            return {
                direction: 'Bullish',
                meaning: 'Increases P(UP)',
            };
        }

        return {
            direction: 'Bearish',
            meaning: 'Decreases P(UP)',
        };
    }

    function colorForHeatValue(value) {
        const min = state.heatmapScale.min;
        const max = state.heatmapScale.max;
        const neutralBand = Math.max((max - min) * 0.03, 0.01);

        const red = [239, 68, 68];
        const yellow = [250, 204, 21];
        const green = [34, 197, 94];

        let rgb;
        if (Math.abs(value) <= neutralBand) {
            rgb = yellow;
        } else if (value > 0) {
            const ratio = max <= 0 ? 1 : Math.min(value / max, 1);
            rgb = interpolateColor(yellow, green, ratio);
        } else {
            const ratio = min >= 0 ? 1 : Math.min(Math.abs(value / min), 1);
            rgb = interpolateColor(yellow, red, ratio);
        }

        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.9)`;
    }

    function renderHeatmap(payload) {
        if (!els.heatmapCanvas || !window.Chart || !payload) return;

        renderMeta(payload.meta);

        let xLabels = Array.isArray(payload.xLabels) ? payload.xLabels : [];
        let yLabels = Array.isArray(payload.yLabels) ? payload.yLabels : [];
        let matrix = Array.isArray(payload.matrix) ? payload.matrix : [];

        if (xLabels.length === 0) xLabels = ['W0'];
        if (yLabels.length === 0) yLabels = ['missing_coverage'];

        const normalizedMatrix = yLabels.map((_, rowIndex) => {
            const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
            return xLabels.map((__, columnIndex) => toNumber(row[columnIndex], 0));
        });

        const allValues = normalizedMatrix.flat();
        const allNeutral = allValues.length === 0 || allValues.every((value) => Math.abs(value) < 1e-8);
        toggleHeatmapEmpty(allNeutral, allNeutral ? 'No strong feature contribution detected.' : '');

        state.heatmapScale = computeHeatmapScale(allValues, payload.meta);

        const points = [];
        for (let row = 0; row < yLabels.length; row += 1) {
            for (let col = 0; col < xLabels.length; col += 1) {
                points.push({
                    x: col,
                    y: yLabels.length - row - 1,
                    r: 10,
                    v: normalizedMatrix[row][col],
                    featureKey: normalizeFeatureKey(yLabels[row]),
                    featureName: formatFeatureName(yLabels[row]),
                    window: xLabels[col],
                });
            }
        }

        if (state.heatmapChart) {
            state.heatmapChart.destroy();
        }

        state.heatmapChart = new Chart(els.heatmapCanvas, {
            type: 'bubble',
            data: {
                datasets: [
                    {
                        label: 'Feature Heatmap',
                        data: points,
                        backgroundColor: (context) => colorForHeatValue(toNumber(context.raw?.v, 0)),
                        borderColor: (context) => {
                            const rowKey = context.raw?.featureKey;
                            if (state.highlightedFeatureKey && rowKey === state.highlightedFeatureKey) {
                                return 'rgba(34, 211, 238, 0.95)';
                            }
                            return 'rgba(255, 255, 255, 0.22)';
                        },
                        borderWidth: (context) => {
                            const rowKey = context.raw?.featureKey;
                            return state.highlightedFeatureKey && rowKey === state.highlightedFeatureKey ? 2 : 1;
                        },
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const raw = items[0]?.raw;
                                return `${raw?.featureName || ''} | ${raw?.window || ''}`;
                            },
                            label: (item) => {
                                const value = toNumber(item.raw?.v, 0);
                                const neutralBand = Math.max((state.heatmapScale.max - state.heatmapScale.min) * 0.03, 0.01);
                                const impact = describeImpact(value, neutralBand);
                                const sign = value >= 0 ? '+' : '';
                                return [`Impact: ${sign}${value.toFixed(3)}`, `Direction: ${impact.direction}`, `Meaning: ${impact.meaning}`];
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        type: 'linear',
                        min: -0.5,
                        max: xLabels.length - 0.5,
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: {
                            stepSize: 1,
                            callback: (value) => xLabels[value] || '',
                            color: '#8b9bb4',
                        },
                    },
                    y: {
                        type: 'linear',
                        min: -0.5,
                        max: yLabels.length - 0.5,
                        grid: { color: 'rgba(255, 255, 255, 0.06)' },
                        ticks: {
                            stepSize: 1,
                            callback: (value) => {
                                const index = yLabels.length - Number(value) - 1;
                                return formatFeatureName(yLabels[index] || '');
                            },
                            color: '#8b9bb4',
                        },
                    },
                },
                onHover: (_, elements) => {
                    els.heatmapCanvas.style.cursor = elements.length ? 'pointer' : 'default';
                },
            },
        });

        if (state.highlightedFeatureKey) {
            state.heatmapChart.update('none');
        }
    }

    function selectedPayload() {
        return {
            model: state.model,
            asset: state.asset,
            horizon: state.horizon,
        };
    }

    function deriveTopFeaturesFromHeatmap(payload) {
        if (!payload) return [];
        const yLabels = Array.isArray(payload.yLabels) ? payload.yLabels : [];
        const matrix = Array.isArray(payload.matrix) ? payload.matrix : [];
        if (!yLabels.length || !matrix.length) return [];

        const derived = yLabels.map((label, rowIndex) => {
            const row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex].map((value) => toNumber(value, 0)) : [];
            if (!row.length) {
                return { name: label, value: 0 };
            }

            const avg = row.reduce((sum, value) => sum + value, 0) / row.length;
            return { name: label, value: avg };
        });

        return derived.sort((a, b) => Math.abs(toNumber(b.value, 0)) - Math.abs(toNumber(a.value, 0)));
    }

    async function refreshAll() {
        if (!window.api) {
            notifyError('API client is not available on this page.');
            return;
        }

        setLoading(true);
        try {
            const payload = selectedPayload();
            const [prediction, heatmap, performance] = await Promise.all([
                api.getModelExplorerPrediction(payload),
                api.getModelExplorerHeatmap(payload),
                api.getModelExplorerPerformance(payload),
            ]);

            const predictionTopFeatures = prediction?.explanation?.topFeatures;
            const fallbackTopFeatures = deriveTopFeaturesFromHeatmap(heatmap);
            const normalizedPrediction = { ...(prediction || {}) };
            if (!Array.isArray(predictionTopFeatures) || predictionTopFeatures.length === 0) {
                normalizedPrediction.explanation = {
                    ...(prediction?.explanation || {}),
                    topFeatures: fallbackTopFeatures,
                };
            }

            renderPrediction(normalizedPrediction);
            renderHeatmap(heatmap);
            renderPerformance(performance);
        } catch (error) {
            notifyError(`Model explorer refresh failed: ${error.message || error}`);
        } finally {
            setLoading(false);
        }
    }

    async function initCatalog() {
        if (!window.api) return;

        try {
            const [modelsRes, assetsRes, healthRes] = await Promise.all([
                api.getModelExplorerModels(),
                api.getModelExplorerAssets(),
                api.getModelExplorerHealth(),
            ]);

            renderMeta({
                mode: healthRes.mode,
                modelVersion: healthRes.modelVersion,
                timestamp: healthRes.loadedAt,
            });

            const models = Array.isArray(modelsRes.models) ? modelsRes.models : [];
            if (!models.some((model) => model.id === state.model) && models.length > 0) {
                state.model = models[0].id;
            }

            const assets = Array.isArray(assetsRes.assets) ? assetsRes.assets : [];
            state.assetHorizonMap = {};
            assets.forEach((asset) => {
                state.assetHorizonMap[asset.symbol] = Array.isArray(asset.horizons) ? asset.horizons : ['1H', '4H', '1D', '3D'];
            });

            if (els.assetSelect) {
                els.assetSelect.innerHTML = assets.map((asset) => `<option value="${asset.symbol}">${asset.label}</option>`).join('');
                if (!assets.some((asset) => asset.symbol === state.asset) && assets.length > 0) {
                    state.asset = assets[0].symbol;
                }
                els.assetSelect.value = state.asset;
            }

            syncHorizonAvailability();
        } catch (error) {
            notifyError(`Catalog load failed: ${error.message || error}`);
        }
    }

    function bindEvents() {
        els.modelButtons.forEach((button) => {
            const selectModel = () => {
                const selected = getModelFromButton(button);
                if (!selected || selected === state.model) return;
                state.model = selected;
                applyButtonStates();
                refreshAll();
            };

            button.addEventListener('click', selectModel);
            if (button.tagName !== 'BUTTON') {
                button.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectModel();
                    }
                });
            }
        });

        els.horizonButtons.forEach((button) => {
            button.addEventListener('click', () => {
                if (button.disabled) return;
                const selected = getHorizonFromButton(button);
                if (!selected || selected === state.horizon) return;
                state.horizon = selected;
                applyButtonStates();
                refreshAll();
            });
        });

        if (els.assetSelect) {
            els.assetSelect.addEventListener('change', (event) => {
                state.asset = event.target.value;
                syncHorizonAvailability();
                applyButtonStates();
                refreshAll();
            });
        }

        if (els.refreshButton) {
            els.refreshButton.addEventListener('click', () => {
                refreshAll();
            });
        }
    }

    async function init() {
        collectElements();
        bindEvents();
        applyButtonStates();
        await initCatalog();
        applyButtonStates();
        await refreshAll();
    }

    document.addEventListener('DOMContentLoaded', init);
})();
