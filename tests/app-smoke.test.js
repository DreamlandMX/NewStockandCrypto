const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = 9300 + Math.floor(Math.random() * 400);
const REPO_ROOT = path.resolve(__dirname, '..');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'nsac-smoke-'));
const APP_DATA_DIR = path.join(TEMP_ROOT, 'data');

let serverProcess = null;

async function waitForServer(url, timeoutMs = 20000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
        } catch (error) {
            // Retry until timeout.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out waiting for ${url}`);
}

async function requestJson(pathname, options = {}) {
    const response = await fetch(`http://${HOST}:${PORT}${pathname}`, {
        ...options,
        headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        }
    });
    const rawText = await response.text();
    let payload = null;
    if (rawText) {
        payload = JSON.parse(rawText);
    }
    return { response, payload };
}

function cookieFromResponse(response) {
    const rawCookie = response.headers.get('set-cookie');
    return rawCookie ? rawCookie.split(';')[0] : '';
}

test.before(async () => {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });

    serverProcess = spawn(process.execPath, ['unified-server.js'], {
        cwd: REPO_ROOT,
        env: {
            ...process.env,
            HOST,
            PORT: String(PORT),
            API_PORT: '59999',
            MODEL_EXPLORER_SCHEME: 'http',
            MODEL_EXPLORER_HOST: HOST,
            MODEL_EXPLORER_PORT: '59998',
            APP_DATA_DIR,
            REQUEST_LOGGING: 'false'
        },
        stdio: 'pipe'
    });

    let stderr = '';
    serverProcess.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });
    serverProcess.on('exit', (code) => {
        if (code && code !== 0) {
            console.error(stderr);
        }
    });

    await waitForServer(`http://${HOST}:${PORT}/healthz`);
});

test.after(async () => {
    if (serverProcess && !serverProcess.killed) {
        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };

            serverProcess.once('exit', finish);
            serverProcess.kill('SIGTERM');
            setTimeout(() => {
                if (!settled) {
                    serverProcess.kill('SIGKILL');
                }
            }, 1500);
        });
    }
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
});

test('health and metrics endpoints expose runtime state', async () => {
    const { response, payload } = await requestJson('/healthz');
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.ok(['ok', 'degraded'].includes(payload.status));
    assert.equal(payload.dependencies.storage.authDbExists, true);

    const metricsResult = await requestJson('/api/system/metrics');
    assert.equal(metricsResult.response.status, 200);
    assert.equal(metricsResult.payload.ok, true);
    assert.equal(metricsResult.payload.service, 'newstockandcrypto');
    assert.equal(metricsResult.payload.storage.appDataDir, APP_DATA_DIR);
});

test('local auth, notes, and chat work end-to-end against a temp data dir', async () => {
    const email = `qa.smoke.${Date.now()}@example.com`;
    const password = 'Password123!';

    const registerResult = await requestJson('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            fullName: 'Smoke Test User',
            email,
            password,
            confirmPassword: password
        })
    });

    assert.equal(registerResult.response.status, 201);
    assert.equal(registerResult.payload.success, true);

    const cookie = cookieFromResponse(registerResult.response);
    assert.ok(cookie.startsWith('sc_session='));

    const meResult = await requestJson('/api/auth/me', {
        headers: { Cookie: cookie }
    });
    assert.equal(meResult.response.status, 200);
    assert.equal(meResult.payload.user.email, email);

    const noteResult = await requestJson('/api/notes', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({
            title: 'Smoke note',
            content: '## Setup\n\n- Entry\n- Risk\n\n> Watchlist',
            market: 'Crypto',
            tags: ['smoke', 'test'],
            is_public: true
        })
    });
    assert.equal(noteResult.response.status, 201);
    assert.equal(noteResult.payload.note.title, 'Smoke note');

    const notesResult = await requestJson('/api/notes', {
        headers: { Cookie: cookie }
    });
    assert.equal(notesResult.response.status, 200);
    assert.equal(notesResult.payload.notes.length, 1);

    const boardsResult = await requestJson('/api/chat/boards', {
        headers: { Cookie: cookie }
    });
    assert.equal(boardsResult.response.status, 200);
    assert.ok(boardsResult.payload.boards.length >= 3);

    const boardId = boardsResult.payload.boards[0].id;
    const joinResult = await requestJson(`/api/chat/boards/${boardId}/join`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({})
    });
    assert.equal(joinResult.response.status, 200);

    const messageResult = await requestJson(`/api/chat/boards/${boardId}/messages`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: JSON.stringify({ content: 'Smoke test message' })
    });
    assert.equal(messageResult.response.status, 201);
    assert.equal(messageResult.payload.message.content, 'Smoke test message');

    const messagesResult = await requestJson(`/api/chat/boards/${boardId}/messages`, {
        headers: { Cookie: cookie }
    });
    assert.equal(messagesResult.response.status, 200);
    assert.ok(messagesResult.payload.messages.some((message) => message.content === 'Smoke test message'));
});
