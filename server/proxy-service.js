const http = require('http');
const https = require('https');

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
};

function answerOptions(req, res, sendJson) {
    if (req.method !== 'OPTIONS') {
        return false;
    }

    sendJson(res, 200, { ok: true });
    return true;
}

function forwardRequest(req, res, options, errorMessage, sendJson) {
    const client = options.scheme === 'https' ? https : http;
    const proxyReq = client.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, {
            ...proxyRes.headers,
            ...CORS_HEADERS
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
        sendJson(res, 502, {
            error: errorMessage,
            detail: error.message
        });
    });

    req.pipe(proxyReq);
}

function createApiProxy(config) {
    const { host, port, sendJson } = config;

    return function proxyApi(req, res) {
        if (answerOptions(req, res, sendJson)) {
            return;
        }

        forwardRequest(req, res, {
            scheme: 'http',
            hostname: host,
            port,
            path: req.url,
            method: req.method,
            headers: {
                ...req.headers,
                host: `${host}:${port}`
            }
        }, 'API proxy failed', sendJson);
    };
}

function createModelExplorerProxy(config) {
    const { scheme, host, port, sendJson } = config;

    return function proxyModelExplorer(req, res, parsedUrl) {
        if (answerOptions(req, res, sendJson)) {
            return;
        }

        const rewrittenPathname = parsedUrl.pathname.replace(/^\/api\/model-explorer/, '') || '/';
        const upstreamPath = `${rewrittenPathname}${parsedUrl.search || ''}`;

        forwardRequest(req, res, {
            scheme,
            hostname: host,
            port,
            path: upstreamPath,
            method: req.method,
            headers: {
                ...req.headers,
                host: `${host}:${port}`
            }
        }, 'Model explorer proxy failed', sendJson);
    };
}

module.exports = {
    createApiProxy,
    createModelExplorerProxy
};
