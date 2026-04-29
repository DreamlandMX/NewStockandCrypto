const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { readJsonBody } = require('../server/http-body');

function requestFromText(text) {
    return Readable.from([text]);
}

test('readJsonBody returns an empty object for an empty request', async () => {
    const body = await readJsonBody(requestFromText(''));
    assert.deepEqual(body, {});
});

test('readJsonBody parses a JSON request body', async () => {
    const body = await readJsonBody(requestFromText('{"name":"Ava"}'));
    assert.deepEqual(body, { name: 'Ava' });
});

test('readJsonBody rejects invalid JSON with a clear error code', async () => {
    await assert.rejects(
        readJsonBody(requestFromText('{bad json')),
        (error) => {
            assert.equal(error.status, 400);
            assert.equal(error.code, 'INVALID_JSON');
            return true;
        }
    );
});

test('readJsonBody rejects bodies over the size limit', async () => {
    await assert.rejects(
        readJsonBody(requestFromText('abcdef'), 3),
        (error) => {
            assert.equal(error.status, 413);
            assert.equal(error.code, 'PAYLOAD_TOO_LARGE');
            return true;
        }
    );
});
