const test = require('node:test');
const assert = require('node:assert/strict');
const { createQuantRouterRoutes } = require('../server/quant-router-routes');

function createHarness() {
    const calls = [];
    const req = {};
    const res = {};
    const quantRouter = {
        handleRuns() {
            calls.push({ name: 'handleRuns', args: [...arguments] });
            return 'runs-promise';
        },
        handleLatest() {
            calls.push({ name: 'handleLatest', args: [...arguments] });
            return 'latest-promise';
        },
        handleFile() {
            calls.push({ name: 'handleFile', args: [...arguments] });
            return 'file-promise';
        },
        handleRun() {
            calls.push({ name: 'handleRun', args: [...arguments] });
            return 'run-promise';
        }
    };
    const handleAsyncRoute = (response, promise, errorCode) => {
        calls.push({ response, promise, errorCode });
    };
    const routeQuantRouterRequest = createQuantRouterRoutes({ quantRouter, handleAsyncRoute });
    return { calls, req, res, routeQuantRouterRequest };
}

test('quant router routes dispatch the runs list', () => {
    const { calls, req, res, routeQuantRouterRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/quant/router/runs');

    const matched = routeQuantRouterRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleRuns');
    assert.equal(calls[1].errorCode, 'QUANT_ROUTER_RUNS_FAILED');
});

test('quant router routes dispatch a run file with decoded names', () => {
    const { calls, req, res, routeQuantRouterRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/quant/router/runs/demo%201/file/equity.csv');

    const matched = routeQuantRouterRequest(req, res, parsedUrl);

    assert.equal(matched, true);
    assert.equal(calls[0].name, 'handleFile');
    assert.equal(calls[0].args[2], 'demo 1');
    assert.equal(calls[0].args[3], 'equity.csv');
    assert.equal(calls[1].errorCode, 'QUANT_ROUTER_FILE_FAILED');
});

test('quant router routes return false for other paths', () => {
    const { calls, req, res, routeQuantRouterRequest } = createHarness();
    const parsedUrl = new URL('http://local/api/crypto/prices');

    const matched = routeQuantRouterRequest(req, res, parsedUrl);

    assert.equal(matched, false);
    assert.equal(calls.length, 0);
});
