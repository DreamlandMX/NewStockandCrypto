const test = require('node:test');
const assert = require('node:assert/strict');
const {
    isEditMethod,
    methodNotAllowedPayload,
    notFoundPayload,
    sendMethodNotAllowed,
    sendNotFound
} = require('../server/route-response-helpers');

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

test('methodNotAllowedPayload explains a 405 response', () => {
    assert.deepEqual(methodNotAllowedPayload(), {
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed.'
    });
});

test('sendNotFound sends a clear 404 response', () => {
    const res = fakeResponse();

    sendNotFound(sendJson, res, 'Note not found.');

    assert.equal(res.status, 404);
    assert.deepEqual(res.payload, notFoundPayload('Note not found.'));
});

test('isEditMethod accepts PUT and PATCH only', () => {
    assert.equal(isEditMethod({ method: 'PUT' }), true);
    assert.equal(isEditMethod({ method: 'PATCH' }), true);
    assert.equal(isEditMethod({ method: 'POST' }), false);
});

test('sendMethodNotAllowed sends the shared 405 payload', () => {
    const res = fakeResponse();

    sendMethodNotAllowed(sendJson, res);

    assert.equal(res.status, 405);
    assert.deepEqual(res.payload, methodNotAllowedPayload());
});
