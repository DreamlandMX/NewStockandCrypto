const test = require('node:test');
const assert = require('node:assert/strict');
const {
    clamp,
    deepCopy,
    parseInteger,
    parseNumber,
    sleep,
    withTimeout
} = require('../server/value-helpers');

test('value helpers parse numbers and integers with safe fallbacks', () => {
    assert.equal(parseNumber('12.5'), 12.5);
    assert.equal(parseNumber('bad'), null);
    assert.equal(parseInteger('42', 1), 42);
    assert.equal(parseInteger('bad', 1), 1);
});

test('value helpers clamp values inside a range', () => {
    assert.equal(clamp(10, 1, 5), 5);
    assert.equal(clamp(-1, 1, 5), 1);
    assert.equal(clamp(3, 1, 5), 3);
});

test('value helpers deep copy plain objects', () => {
    const original = { nested: { value: 1 } };
    const copy = deepCopy(original);

    copy.nested.value = 2;

    assert.equal(original.nested.value, 1);
});

test('value helpers sleep and timeout promises', async () => {
    await sleep(1);
    await assert.rejects(
        () => withTimeout(new Promise(() => {}), 1, 'too slow'),
        /too slow/
    );
    assert.equal(await withTimeout(Promise.resolve('ok'), 100, 'too slow'), 'ok');
});
