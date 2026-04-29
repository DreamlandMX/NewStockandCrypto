const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeLimitStatus,
    detectBoardType,
    detectStFlag,
    resolveLimitPct,
    translateSectorToEnglish
} = require('../server/cn-equity-rules');

test('CN equity rules translate common sector names to English', () => {
    assert.equal(translateSectorToEnglish('\u94f6\u884c'), 'Banking');
    assert.equal(translateSectorToEnglish('\u534a\u5bfc\u4f53'), 'Technology');
    assert.equal(translateSectorToEnglish('unknown sector'), 'Other');
});

test('CN equity rules detect board type from stock code', () => {
    assert.equal(detectBoardType('688001'), 'STAR');
    assert.equal(detectBoardType('300750'), 'CHINEXT');
    assert.equal(detectBoardType('600519'), 'MAIN');
});

test('CN equity rules detect ST stocks from names', () => {
    assert.equal(detectStFlag('*ST Example'), true);
    assert.equal(detectStFlag('\u5e73\u5b89\u94f6\u884c'), false);
});

test('CN equity rules resolve daily limit percentage', () => {
    assert.equal(resolveLimitPct('MAIN', false), 0.1);
    assert.equal(resolveLimitPct('STAR', false), 0.2);
    assert.equal(resolveLimitPct('CHINEXT', false), 0.2);
    assert.equal(resolveLimitPct('MAIN', true), 0.05);
});

test('CN equity rules label limit up and limit down status', () => {
    assert.equal(computeLimitStatus(9.91, 0.1), 'LIMIT_UP');
    assert.equal(computeLimitStatus(-9.91, 0.1), 'LIMIT_DOWN');
    assert.equal(computeLimitStatus(1.23, 0.1), 'NORMAL');
    assert.equal(computeLimitStatus(null, 0.1), 'NORMAL');
});
