const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createStaticFileService, safeJoin } = require('../server/static-file-service');

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

test('safeJoin keeps requests inside the configured folder', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'static-safe-'));

    try {
        assert.equal(safeJoin(root, '../secret.txt'), null);
        assert.equal(safeJoin(root, 'images/logo.png'), path.join(root, 'images', 'logo.png'));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('static file service serves web files and uploads with simple routes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'static-service-'));
    const webRoot = path.join(root, 'web');
    const uploadsRoot = path.join(root, 'uploads');
    fs.mkdirSync(webRoot, { recursive: true });
    fs.mkdirSync(uploadsRoot, { recursive: true });
    fs.writeFileSync(path.join(webRoot, 'index.html'), '<h1>Hello</h1>');
    fs.writeFileSync(path.join(uploadsRoot, 'note.txt'), 'saved upload');

    const staticFiles = createStaticFileService({ webRoot, uploadsRoot, sendJson });
    const server = http.createServer((req, res) => {
        if (req.url.startsWith('/uploads/')) {
            staticFiles.serveUploads(req, res);
            return;
        }
        staticFiles.serveStatic(req, res);
    });
    const port = await listen(server);

    try {
        const homeResponse = await fetch(`http://${HOST}:${port}/`);
        assert.equal(homeResponse.status, 200);
        assert.equal(homeResponse.headers.get('content-type'), 'text/html; charset=utf-8');
        assert.equal(await homeResponse.text(), '<h1>Hello</h1>');

        const uploadResponse = await fetch(`http://${HOST}:${port}/uploads/note.txt`);
        assert.equal(uploadResponse.status, 200);
        assert.equal(await uploadResponse.text(), 'saved upload');

        const emptyUploadResponse = await fetch(`http://${HOST}:${port}/uploads/`);
        assert.equal(emptyUploadResponse.status, 404);
        assert.deepEqual(await emptyUploadResponse.json(), { error: 'Not found' });
    } finally {
        await close(server);
        fs.rmSync(root, { recursive: true, force: true });
    }
});
