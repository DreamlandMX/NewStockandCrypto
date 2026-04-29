const crypto = require('crypto');
const fs = require('fs');

function buildServiceBaseUrl(scheme, host, port) {
    const normalizedScheme = String(scheme || 'http').toLowerCase() === 'https' ? 'https' : 'http';
    const normalizedHost = String(host || '').trim();
    const numericPort = Number(port);
    const isDefaultPort = (normalizedScheme === 'https' && numericPort === 443)
        || (normalizedScheme === 'http' && numericPort === 80);
    const portSuffix = normalizedHost && Number.isFinite(numericPort) && !isDefaultPort
        ? `:${numericPort}`
        : '';
    return `${normalizedScheme}://${normalizedHost}${portSuffix}`;
}

function getStatusClass(statusCode) {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500 && statusCode < 600) return '5xx';
    return 'other';
}

function createRequestMetrics() {
    return {
        total: 0,
        inFlight: 0,
        byMethod: Object.create(null),
        byStatusClass: {
            '2xx': 0,
            '3xx': 0,
            '4xx': 0,
            '5xx': 0,
            other: 0
        },
        errors: 0,
        lastRequestAt: null,
        lastErrorAt: null
    };
}

function logEvent(level, event, details = {}) {
    const entry = {
        ts: new Date().toISOString(),
        level,
        event,
        ...details
    };
    const serialized = JSON.stringify(entry);

    if (level === 'error') {
        console.error(serialized);
        return;
    }

    console.log(serialized);
}

function createRuntimeService(config) {
    const {
        appVersion,
        startedAt,
        appDataDir,
        isRenderRuntime,
        requestLoggingEnabled,
        modelExplorer,
        stores,
        sendJson
    } = config;
    const fetchImpl = config.fetchImpl || fetch;
    const requestMetrics = createRequestMetrics();

    function beginRequestTracking(req, res) {
        const requestId = crypto.randomUUID();
        const startedAtNs = process.hrtime.bigint();
        requestMetrics.inFlight += 1;
        requestMetrics.byMethod[req.method] = (requestMetrics.byMethod[req.method] || 0) + 1;
        res.setHeader('X-Request-Id', requestId);

        res.once('finish', () => {
            const elapsedMs = Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
            const statusClass = getStatusClass(res.statusCode || 0);
            requestMetrics.inFlight = Math.max(0, requestMetrics.inFlight - 1);
            requestMetrics.total += 1;
            requestMetrics.byStatusClass[statusClass] = (requestMetrics.byStatusClass[statusClass] || 0) + 1;
            requestMetrics.lastRequestAt = new Date().toISOString();

            if ((res.statusCode || 0) >= 500) {
                requestMetrics.errors += 1;
                requestMetrics.lastErrorAt = requestMetrics.lastRequestAt;
            }

            if (requestLoggingEnabled) {
                logEvent((res.statusCode || 0) >= 500 ? 'error' : 'info', 'http_request', {
                    requestId,
                    method: req.method,
                    path: req.url,
                    statusCode: res.statusCode,
                    durationMs: Number(elapsedMs.toFixed(2))
                });
            }
        });

        return requestId;
    }

    async function probeModelExplorerHealth() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const target = `${buildServiceBaseUrl(modelExplorer.scheme, modelExplorer.host, modelExplorer.port)}/health`;

        try {
            const response = await fetchImpl(target, {
                method: 'GET',
                signal: controller.signal,
                headers: { Accept: 'application/json' }
            });
            return {
                ok: response.ok,
                statusCode: response.status,
                target
            };
        } catch (error) {
            return {
                ok: false,
                statusCode: null,
                target,
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    function buildMetricsSnapshot() {
        const memory = process.memoryUsage();
        return {
            ok: true,
            service: 'newstockandcrypto',
            version: appVersion,
            startedAt: startedAt.toISOString(),
            uptimeSec: Math.round(process.uptime()),
            requests: {
                ...requestMetrics,
                byMethod: { ...requestMetrics.byMethod },
                byStatusClass: { ...requestMetrics.byStatusClass }
            },
            memory: {
                rss: memory.rss,
                heapTotal: memory.heapTotal,
                heapUsed: memory.heapUsed,
                external: memory.external
            },
            storage: {
                appDataDir,
                authDbPath: stores.auth.dbPath,
                chatDbPath: stores.chat.dbPath,
                notesDbPath: stores.notes.dbPath,
                positionsDbPath: stores.positions.dbPath
            }
        };
    }

    function buildSystemConfigSnapshot() {
        return {
            ok: true,
            service: 'newstockandcrypto',
            version: appVersion,
            runtime: {
                isRender: isRenderRuntime,
                appVersion
            },
            features: {
                quantRouterVisible: !isRenderRuntime
            }
        };
    }

    async function buildHealthSnapshot() {
        const modelExplorerStatus = await probeModelExplorerHealth();
        const authDbExists = fs.existsSync(stores.auth.dbPath);
        const chatDbExists = fs.existsSync(stores.chat.dbPath);
        const notesDbExists = fs.existsSync(stores.notes.dbPath);
        const positionsDbExists = fs.existsSync(stores.positions.dbPath);
        const storageReady = authDbExists && chatDbExists && notesDbExists && positionsDbExists;
        const degraded = !modelExplorerStatus.ok;

        return {
            ok: storageReady,
            status: storageReady ? (degraded ? 'degraded' : 'ok') : 'error',
            service: 'newstockandcrypto',
            version: appVersion,
            startedAt: startedAt.toISOString(),
            uptimeSec: Math.round(process.uptime()),
            dependencies: {
                storage: {
                    appDataDir,
                    authDbExists,
                    chatDbExists,
                    notesDbExists,
                    positionsDbExists
                },
                modelExplorer: modelExplorerStatus
            }
        };
    }

    async function handleSystemHealthRoute(req, res) {
        if (req.method !== 'GET') {
            sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
            return;
        }

        const payload = await buildHealthSnapshot();
        sendJson(res, payload.ok ? 200 : 503, payload);
    }

    function handleSystemMetricsRoute(req, res) {
        if (req.method !== 'GET') {
            sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
            return;
        }

        sendJson(res, 200, buildMetricsSnapshot());
    }

    return {
        beginRequestTracking,
        buildHealthSnapshot,
        buildMetricsSnapshot,
        buildSystemConfigSnapshot,
        handleSystemHealthRoute,
        handleSystemMetricsRoute,
        probeModelExplorerHealth
    };
}

module.exports = {
    buildServiceBaseUrl,
    createRuntimeService
};
