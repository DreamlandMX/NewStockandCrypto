const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApiProxy, createModelExplorerProxy } = require('../server/proxy-service');

const HOST = '127.0.0.1';

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

async function listen(server) {
    await new Promise((resolve) => server.listen(0, HOST, resolve));
    return server.address().port;
}

async function close(server) {
    if (!server.listening) return;
    await new Promise((resolve) => server.close(resolve));
}

test('api proxy forwards the original request to the API service', async () => {
    const apiServer = http.createServer((req, res) => {
        assert.equal(req.method, 'POST');
        assert.equal(req.url, '/api/legacy/ping?x=1');

        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            sendJson(res, 201, { ok: true, body });
        });
    });

    const apiPort = await listen(apiServer);
    const proxy = http.createServer(createApiProxy({
        host: HOST,
        port: apiPort,
        sendJson
    }));
    const proxyPort = await listen(proxy);

    try {
        const response = await fetch(`http://${HOST}:${proxyPort}/api/legacy/ping?x=1`, {
            method: 'POST',
            body: JSON.stringify({ hello: 'world' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const payload = await response.json();

        assert.equal(response.status, 201);
        assert.deepEqual(payload, {
            ok: true,
            body: '{"hello":"world"}'
        });
    } finally {
        await close(proxy);
        await close(apiServer);
    }
});

test('model explorer proxy removes the browser-facing prefix', async () => {
    const modelServer = http.createServer((req, res) => {
        assert.equal(req.method, 'GET');
        assert.equal(req.url, '/health?verbose=1');
        sendJson(res, 200, { ok: true });
    });

    const modelPort = await listen(modelServer);
    const proxyModelExplorer = createModelExplorerProxy({
        scheme: 'http',
        host: HOST,
        port: modelPort,
        sendJson
    });
    const proxy = http.createServer((req, res) => {
        const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
        proxyModelExplorer(req, res, parsedUrl);
    });
    const proxyPort = await listen(proxy);

    try {
        const response = await fetch(`http://${HOST}:${proxyPort}/api/model-explorer/health?verbose=1`);
        const payload = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(payload, { ok: true });
    } finally {
        await close(proxy);
        await close(modelServer);
    }
});
