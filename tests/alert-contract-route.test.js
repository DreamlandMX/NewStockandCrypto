const test = require('node:test');
const assert = require('node:assert/strict');
const { createAlertContractRoute } = require('../server/alert-contract-route');

function fakeResponse() {
    return {
        status: null,
        payload: null
    };
}

function sendJson(res, status, payload) {
    res.status = status;
    res.payload = payload;
}

test('alert contract explains the current client-side storage mode', () => {
    const handleAlertContract = createAlertContractRoute({ sendJson });
    const res = fakeResponse();

    handleAlertContract({ method: 'GET' }, res);

    assert.equal(res.status, 501);
    assert.equal(res.payload.route, '/api/alerts');
    assert.equal(res.payload.current_mode, 'client_local_storage');
    assert.equal(res.payload.message, 'Use localStorage key "crypto_alerts_v1" for this phase.');
});

test('alert contract shows the expected future POST request shape', () => {
    const handleAlertContract = createAlertContractRoute({ sendJson });
    const res = fakeResponse();

    handleAlertContract({ method: 'POST' }, res);

    assert.equal(res.status, 501);
    assert.deepEqual(res.payload.expected_request, {
        symbol: 'BTCUSDT',
        type: 'move_gt_pct_24h',
        thresholdPct: 5,
        enabled: true
    });
});
