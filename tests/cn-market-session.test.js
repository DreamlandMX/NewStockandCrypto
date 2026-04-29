const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeMarketSession,
    makeShanghaiDate,
    nextTradingDateKey,
    normalizeClockHour,
    previousShanghaiTradingDateKey,
    toShanghaiNow
} = require('../server/cn-market-session');

test('CN market session reads Beijing time parts from a UTC date', () => {
    const shanghai = toShanghaiNow(new Date('2026-04-28T02:00:00.000Z'));

    assert.equal(shanghai.dateKey, '2026-04-28');
    assert.equal(shanghai.hour, 10);
    assert.equal(shanghai.minute, 0);
    assert.equal(shanghai.weekday, 'Tue');
});

test('CN market session normalizes midnight to hour zero', () => {
    const shanghai = toShanghaiNow(new Date('2026-04-29T16:06:39.000Z'));

    assert.equal(shanghai.dateKey, '2026-04-30');
    assert.equal(shanghai.hour, 0);
    assert.equal(shanghai.minute, 6);
    assert.equal(shanghai.date.toISOString(), '2026-04-29T16:06:39.000Z');
});

test('normalizes Intl midnight hour into a normal 24-hour clock value', () => {
    assert.equal(normalizeClockHour('24'), 0);
    assert.equal(normalizeClockHour('00'), 0);
    assert.equal(normalizeClockHour('7'), 7);
});

test('CN market session builds Shanghai dates as UTC instants', () => {
    const date = makeShanghaiDate('2026-04-28', 9, 30);

    assert.equal(date.toISOString(), '2026-04-28T01:30:00.000Z');
    assert.equal(Number.isNaN(makeShanghaiDate('bad', 9, 30).getTime()), true);
});

test('CN market session skips weekends when choosing nearby trading dates', () => {
    const friday = makeShanghaiDate('2026-05-01', 12, 0);

    assert.equal(nextTradingDateKey(friday), '2026-05-04');
    assert.equal(previousShanghaiTradingDateKey(friday), '2026-04-30');
});

test('CN market session reports active continuous trading and next phase', () => {
    const session = computeMarketSession(new Date('2026-04-28T02:00:00.000Z'));

    assert.equal(session.phaseCode, 'CONTINUOUS_AM');
    assert.equal(session.phaseTone, 'success');
    assert.equal(session.nextPhaseCode, 'LUNCH_BREAK');
    assert.equal(session.countdownSec, 90 * 60);
});
