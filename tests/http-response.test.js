const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { handleAsyncRoute, sendJson } = require('../server/http-response');

function createResponse() {
    const res = new EventEmitter();
    res.headers = {};
    res.body = '';
    res.writeHead = (status, headers = {}) => {
        res.statusCode = status;
        res.headers = { ...res.headers, ...headers };
    };
    res.end = (body = '') => {
        res.body = body;
        res.writableEnded = true;
        res.emit('finish');
    };
    return res;
}

test('sendJson writes a JSON response with CORS headers', () => {
    const res = createResponse();

    sendJson(res, 201, { ok: true });

    assert.equal(res.statusCode, 201);
    assert.equal(res.headers['Content-Type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
    assert.deepEqual(JSON.parse(res.body), { ok: true });
});

test('handleAsyncRoute turns rejected route promises into JSON errors', async () => {
    const res = createResponse();
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
        handleAsyncRoute(res, Promise.reject(new Error('boom')), 'TEST_FAILED');
        await new Promise((resolve) => setImmediate(resolve));

        assert.equal(res.statusCode, 500);
        assert.deepEqual(JSON.parse(res.body), {
            success: false,
            error: 'TEST_FAILED',
            message: 'boom'
        });
    } finally {
        console.error = originalConsoleError;
    }
});
