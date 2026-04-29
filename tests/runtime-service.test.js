const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { buildServiceBaseUrl, createRuntimeService } = require('../server/runtime-service');

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function fakeResponse() {
    let statusCode = null;
    let payload = null;
    return {
        writeHead(status) {
            statusCode = status;
        },
        end(body) {
            payload = JSON.parse(body);
        },
        get statusCode() {
            return statusCode;
        },
        get payload() {
            return payload;
        }
    };
}

test('buildServiceBaseUrl hides default ports and keeps custom ports', () => {
    assert.equal(buildServiceBaseUrl('https', 'example.com', 443), 'https://example.com');
    assert.equal(buildServiceBaseUrl('http', '127.0.0.1', 8000), 'http://127.0.0.1:8000');
});

test('runtime service reports storage and model explorer health', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-service-'));
    const dbPath = path.join(tempDir, 'store.db');
    fs.writeFileSync(dbPath, '');

    const runtime = createRuntimeService({
        appVersion: 'test-version',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        appDataDir: tempDir,
        isRenderRuntime: false,
        requestLoggingEnabled: false,
        modelExplorer: {
            scheme: 'http',
            host: '127.0.0.1',
            port: 8000
        },
        stores: {
            auth: { dbPath },
            chat: { dbPath },
            notes: { dbPath },
            positions: { dbPath }
        },
        fetchImpl: async () => ({ ok: true, status: 200 }),
        sendJson
    });
    const req = { method: 'GET' };
    const res = fakeResponse();

    try {
        await runtime.handleSystemHealthRoute(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.payload.ok, true);
        assert.equal(res.payload.status, 'ok');
        assert.equal(res.payload.dependencies.modelExplorer.ok, true);
        assert.equal(res.payload.dependencies.storage.authDbExists, true);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
