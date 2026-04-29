const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createAppRouter } = require('../server/app-router');

function createResponse() {
    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    res.body = '';
    res.setHeader = (name, value) => {
        res.headers[name] = value;
    };
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

function createRouterHarness(overrides = {}) {
    const calls = [];
    const sendJson = (res, status, payload) => {
        calls.push({ name: 'sendJson', status, payload });
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
    };
    const handler = (name, returns = false) => (...args) => {
        calls.push({ name, args });
        return returns;
    };
    const route = createAppRouter({
        host: '127.0.0.1',
        port: 9000,
        sendJson,
        handleAsyncRoute: handler('handleAsyncRoute'),
        runtime: {
            beginRequestTracking: handler('beginRequestTracking'),
            handleSystemHealthRoute: handler('handleSystemHealthRoute', 'health-promise'),
            handleSystemMetricsRoute: handler('handleSystemMetricsRoute'),
            buildSystemConfigSnapshot: () => ({ ok: true, service: 'test' })
        },
        serveUploads: handler('serveUploads'),
        routeSiteRequest: handler('routeSiteRequest', false),
        routeMarketRequest: handler('routeMarketRequest', false),
        routeQuantRouterRequest: handler('routeQuantRouterRequest', false),
        handleAlertContract: handler('handleAlertContract'),
        proxyModelExplorer: handler('proxyModelExplorer'),
        proxyApi: handler('proxyApi'),
        serveStatic: handler('serveStatic'),
        ...overrides
    });

    return { calls, route };
}

test('app router returns a clear error for an empty URL', () => {
    const { calls, route } = createRouterHarness();
    const req = {};
    const res = createResponse();

    route(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(calls[0].name, 'sendJson');
    assert.deepEqual(calls[0].payload, { error: 'Empty URL' });
});

test('app router serves system config directly', () => {
    const { calls, route } = createRouterHarness();
    const req = { url: '/api/system/config', headers: {} };
    const res = createResponse();

    route(req, res);

    assert.equal(calls[0].name, 'beginRequestTracking');
    assert.equal(calls[1].name, 'sendJson');
    assert.deepEqual(calls[1].payload, { ok: true, service: 'test' });
});

test('app router stops after the first matching app route', () => {
    const { calls, route } = createRouterHarness({
        routeSiteRequest: (...args) => {
            calls.push({ name: 'routeSiteRequest', args });
            return true;
        }
    });
    const req = { url: '/api/auth/login', headers: {} };
    const res = createResponse();

    route(req, res);

    assert.equal(calls[1].name, 'routeSiteRequest');
    assert.equal(calls.some((call) => call.name === 'routeMarketRequest'), false);
});

test('app router sends unknown api requests to the legacy proxy', () => {
    const { calls, route } = createRouterHarness();
    const req = { url: '/api/legacy/thing', headers: {} };
    const res = createResponse();

    route(req, res);

    assert.equal(calls.at(-1).name, 'proxyApi');
});

test('app router serves favicon with no body', () => {
    const { route } = createRouterHarness();
    const req = { url: '/favicon.ico', headers: {} };
    const res = createResponse();

    route(req, res);

    assert.equal(res.statusCode, 204);
    assert.equal(res.body, '');
});
