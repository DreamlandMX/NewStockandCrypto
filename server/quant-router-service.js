const fs = require('fs');
const path = require('path');

const DEMO_RUN_ID = 'demo-btc-regime-router';

function readJson(filePath, fallback = null) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

async function readCsv(filePath) {
    try {
        const content = await fs.promises.readFile(filePath, 'utf8');
        return content.trim() ? content.trim().split(/\r?\n/g).map(parseCsvLine) : [];
    } catch {
        return [];
    }
}

function parseCsvLine(line) {
    const cells = [];
    let value = '';
    let quoted = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"') {
            if (quoted && next === '"') {
                value += '"';
                index += 1;
            } else {
                quoted = !quoted;
            }
        } else if (char === ',' && !quoted) {
            cells.push(value);
            value = '';
        } else {
            value += char;
        }
    }
    cells.push(value);
    return cells;
}

function withStaleFlag(manifest) {
    if (!manifest) return null;
    const staleAfterHours = Number(manifest.staleAfterHours || 24);
    const generatedAtMs = Date.parse(manifest.generatedAt || '');
    const stale = Number.isFinite(generatedAtMs)
        ? (Date.now() - generatedAtMs) > staleAfterHours * 60 * 60 * 1000
        : Boolean(manifest.stale);
    return {
        ...manifest,
        stale,
        latestSignal: {
            ...(manifest.latestSignal || {}),
            stale
        }
    };
}

function buildDemoRun() {
    const generatedAt = new Date().toISOString();
    const start = Date.UTC(2026, 3, 1);
    const regimes = ['neutral', 'bull', 'bull', 'neutral', 'bear', 'neutral', 'bull', 'bull'];
    const moduleBreakdown = [
        { module: 'momentum_breakout', totalReturn: 0.057, sharpeRatio: 1.81, totalTrades: 13, winRate: 0.615 },
        { module: 'mean_reversion', totalReturn: 0.021, sharpeRatio: 1.12, totalTrades: 9, winRate: 0.556 },
        { module: 'shock_defense', totalReturn: 0.006, sharpeRatio: 0.94, totalTrades: 6, winRate: 0.667 }
    ];
    const benchmarks = [
        { name: 'Buy & Hold BTC', totalReturn: 0.052 },
        { name: 'Equal Weight Modules', totalReturn: 0.039 }
    ];
    const deploymentSummary = {
        total_return: 0.084,
        sharpe_ratio: 1.72,
        max_drawdown: -0.041,
        total_trades: 28,
        win_rate: 0.607,
        module_breakdown: moduleBreakdown,
        benchmarks
    };

    return {
        manifest: withStaleFlag({
            runId: DEMO_RUN_ID,
            mode: 'demo',
            status: 'success',
            sectionName: 'BTC Regime Router',
            generatedAt,
            staleAfterHours: 24 * 365,
            currentRegime: 'bull',
            championStatus: 'pass',
            championSource: 'demo',
            championCandidateId: 'router_momentum_v3',
            benchmarkEdge: 0.184,
            latestSignal: { action: 'monitor', side: 'long', module: 'momentum_breakout' },
            files: {}
        }),
        backtestSummary: {
            deploymentSummary,
            champion: { candidateId: 'router_momentum_v3', summary: deploymentSummary },
            candidates: [
                { candidateId: 'router_momentum_v3', status: 'pass', benchmarkEdge: 0.184, summary: { sharpe_ratio: 1.72, max_drawdown: -0.041 } },
                { candidateId: 'router_balanced_v2', status: 'watch', benchmarkEdge: 0.097, summary: { sharpe_ratio: 1.31, max_drawdown: -0.052 } },
                { candidateId: 'router_defensive_v1', status: 'reject', benchmarkEdge: -0.016, summary: { sharpe_ratio: 0.82, max_drawdown: -0.036 } }
            ]
        },
        walkForward: { folds: [
            { foldId: 'W1', sharpeRatio: 1.24 },
            { foldId: 'W2', sharpeRatio: 1.68 },
            { foldId: 'W3', sharpeRatio: 1.49 },
            { foldId: 'W4', sharpeRatio: 1.91 }
        ] },
        monteCarlo: { q10Return: -0.018, q50Return: 0.071, q90Return: 0.163 },
        pineExport: { strategyName: 'Demo BTC Regime Router' },
        alertTemplate: { action: 'monitor', side: 'long', module: 'momentum_breakout' },
        equity: regimes.map((regime, index) => {
            const equity = 100000 * (1 + [0, 0.018, 0.043, 0.034, 0.012, 0.028, 0.061, 0.084][index]);
            return {
                timestamp: new Date(start + index * 24 * 60 * 60 * 1000).toISOString(),
                equity: Number(equity.toFixed(2)),
                drawdown: Number(Math.min(0, (equity - 108400) / 108400).toFixed(4)),
                regime
            };
        }),
        regimeSeries: regimes.map((state, index) => ({
            timestamp: new Date(start + index * 24 * 60 * 60 * 1000).toISOString(),
            state,
            bullProb: state === 'bull' ? 0.67 : state === 'bear' ? 0.18 : 0.38,
            bearProb: state === 'bear' ? 0.58 : state === 'bull' ? 0.12 : 0.23,
            neutralProb: state === 'neutral' ? 0.48 : 0.21,
            shockScore: Number((0.08 + index * 0.015).toFixed(3))
        }))
    };
}

function createQuantRouterService(config) {
    const cache = {
        runs: null,
        status: null,
        latest: null,
        bundles: new Map()
    };

    function defaultStatus() {
        return {
            stage: 'idle',
            updating: false,
            currentMode: null,
            startedAt: null,
            finishedAt: null,
            lastSuccessfulRunId: null,
            error: null
        };
    }

    function readStatus() {
        return readJson(config.pipelineStatusPath, defaultStatus());
    }

    async function listRuns() {
        const roots = [
            { root: config.runsDir, archived: false },
            { root: config.archiveDir, archived: true }
        ];
        const runs = [];
        for (const rootInfo of roots) {
            const dirents = await fs.promises.readdir(rootInfo.root, { withFileTypes: true }).catch(() => []);
            for (const dirent of dirents) {
                if (!dirent.isDirectory()) continue;
                const manifest = withStaleFlag(readJson(path.join(rootInfo.root, dirent.name, 'manifest.json'), null));
                if (manifest) runs.push({ runId: dirent.name, archived: rootInfo.archived, manifest });
            }
        }
        if (!runs.length && !config.isRenderRuntime) {
            const demo = buildDemoRun();
            return [{ runId: DEMO_RUN_ID, archived: false, manifest: demo.manifest }];
        }
        return runs.sort((left, right) => String(right.manifest.generatedAt || '').localeCompare(String(left.manifest.generatedAt || '')));
    }

    async function findRunDir(runId) {
        for (const root of [config.runsDir, config.archiveDir]) {
            const runDir = path.join(root, runId);
            try {
                await fs.promises.access(path.join(runDir, 'manifest.json'));
                return runDir;
            } catch {
                // Try the archive if the active run is missing.
            }
        }
        return null;
    }

    async function readRun(runId) {
        if (runId === DEMO_RUN_ID && !config.isRenderRuntime) return buildDemoRun();

        const runDir = await findRunDir(runId);
        if (!runDir) return null;
        const manifest = withStaleFlag(readJson(path.join(runDir, 'manifest.json'), null));
        if (!manifest) return null;

        const [backtestSummary, walkForward, monteCarlo, pineExport, alertTemplate, equityRows, regimeRows] = await Promise.all([
            readJson(path.join(runDir, 'backtest_summary.json'), {}),
            readJson(path.join(runDir, 'walk_forward.json'), {}),
            readJson(path.join(runDir, 'monte_carlo.json'), {}),
            readJson(path.join(runDir, 'pine_export.json'), {}),
            readJson(path.join(runDir, 'alert_template.json'), manifest.latestSignal || {}),
            readCsv(path.join(runDir, 'equity_curve.csv')),
            readCsv(path.join(runDir, 'regime_series.csv'))
        ]);

        return {
            manifest,
            backtestSummary,
            walkForward,
            monteCarlo,
            pineExport,
            alertTemplate,
            equity: equityRows.slice(1).map((row) => ({
                timestamp: row[0] || '',
                equity: Number(row[1] || 0),
                drawdown: Number(row[2] || 0),
                regime: row[3] || 'neutral'
            })),
            regimeSeries: regimeRows.slice(1).map((row) => ({
                timestamp: row[0] || '',
                state: row[1] || 'neutral',
                bullProb: Number(row[2] || 0),
                bearProb: Number(row[3] || 0),
                neutralProb: Number(row[4] || 0),
                shockScore: Number(row[5] || 0)
            }))
        };
    }

    async function loadRuns() {
        try {
            const runs = await listRuns();
            const status = readStatus();
            cache.runs = runs;
            cache.status = status;
            return { runs, status, degraded: false, cached: false };
        } catch (error) {
            if (!cache.runs) throw error;
            return { runs: cache.runs, status: cache.status || readStatus(), degraded: true, cached: true, error: error.message };
        }
    }

    async function loadRun(runId) {
        try {
            const run = await readRun(runId);
            const status = readStatus();
            if (!run) return { run: null, status, degraded: false, cached: false };
            cache.bundles.set(runId, run);
            cache.latest = run;
            cache.status = status;
            return { run, status, degraded: false, cached: false };
        } catch (error) {
            const cachedRun = cache.bundles.get(runId);
            if (!cachedRun) throw error;
            return { run: cachedRun, status: cache.status || readStatus(), degraded: true, cached: true, error: error.message };
        }
    }

    async function handleRuns(req, res) {
        if (req.method !== 'GET') return config.sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        try {
            const payload = await loadRuns();
            config.sendJson(res, 200, {
                ok: true,
                runs: payload.runs.map((run) => ({
                    runId: run.runId,
                    archived: run.archived,
                    generatedAt: run.manifest.generatedAt,
                    status: run.manifest.status,
                    championStatus: run.manifest.championStatus,
                    championSource: run.manifest.championSource || 'new',
                    stale: Boolean(run.manifest.stale),
                    updating: Boolean(payload.status?.updating)
                })),
                status: payload.status,
                degraded: payload.degraded,
                cached: payload.cached,
                error: payload.error || null
            });
        } catch (error) {
            config.sendJson(res, 503, { ok: false, error: 'QUANT_ROUTER_UNAVAILABLE', detail: error.message });
        }
    }

    async function handleLatest(req, res) {
        if (req.method !== 'GET') return config.sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        try {
            const runsPayload = await loadRuns();
            const latestRunId = runsPayload.runs[0]?.runId;
            if (!latestRunId) {
                return config.sendJson(res, 200, { ok: true, run: null, status: runsPayload.status, degraded: runsPayload.degraded, cached: runsPayload.cached });
            }
            const runPayload = await loadRun(latestRunId);
            cache.latest = runPayload.run;
            config.sendJson(res, 200, {
                ok: true,
                run: runPayload.run,
                status: runPayload.status,
                degraded: Boolean(runsPayload.degraded || runPayload.degraded),
                cached: Boolean(runsPayload.cached || runPayload.cached),
                error: runPayload.error || runsPayload.error || null
            });
        } catch (error) {
            if (!cache.latest) return config.sendJson(res, 503, { ok: false, error: 'QUANT_ROUTER_UNAVAILABLE', detail: error.message });
            config.sendJson(res, 200, { ok: true, run: cache.latest, status: cache.status || readStatus(), degraded: true, cached: true, error: error.message });
        }
    }

    async function handleRun(req, res, runId) {
        if (req.method !== 'GET') return config.sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        try {
            const payload = await loadRun(runId);
            if (!payload.run) return config.sendJson(res, 404, { ok: false, error: 'RUN_NOT_FOUND' });
            config.sendJson(res, 200, { ok: true, run: payload.run, status: payload.status, degraded: payload.degraded, cached: payload.cached, error: payload.error || null });
        } catch (error) {
            config.sendJson(res, 503, { ok: false, error: 'QUANT_ROUTER_UNAVAILABLE', detail: error.message });
        }
    }

    async function handleFile(req, res, runId, fileName) {
        if (req.method !== 'GET') return config.sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
        const runDir = await findRunDir(runId);
        if (!runDir) return config.sendJson(res, 404, { ok: false, error: 'RUN_NOT_FOUND' });

        const targetPath = path.join(runDir, path.basename(fileName));
        try {
            await fs.promises.access(targetPath);
            res.writeHead(200);
            fs.createReadStream(targetPath).pipe(res);
        } catch {
            config.sendJson(res, 404, { ok: false, error: 'FILE_NOT_FOUND' });
        }
    }

    return { handleRuns, handleLatest, handleRun, handleFile };
}

module.exports = { createQuantRouterService };
