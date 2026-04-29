const test = require('node:test');
const assert = require('node:assert/strict');
const {
    computeUsMarketSession,
    makeNewYorkDate,
    nextUsTradingDateKey,
    previousUsTradingDateKey,
    toNewYorkNow
} = require('../server/us-market-session');

test('US market session reads New York time parts from a UTC date', () => {
    const ny = toNewYorkNow(new Date('2026-04-28T14:00:00.000Z'));

    assert.equal(ny.dateKey, '2026-04-28');
    assert.equal(ny.hour, 10);
    assert.equal(ny.minute, 0);
    assert.equal(ny.weekday, 'Tue');
});

test('US market session builds New York dates as UTC instants', () => {
    const date = makeNewYorkDate('2026-04-28', 9, 30);

    assert.equal(date.toISOString(), '2026-04-28T13:30:00.000Z');
    assert.equal(Number.isNaN(makeNewYorkDate('bad', 9, 30).getTime()), true);
});

test('US market session skips weekends and holidays', () => {
    const mondayAfterHoliday = makeNewYorkDate('2026-07-06', 12, 0);

    assert.equal(nextUsTradingDateKey(mondayAfterHoliday), '2026-07-07');
    assert.equal(previousUsTradingDateKey(mondayAfterHoliday), '2026-07-02');
});

test('US market session reports active regular trading and next phase', () => {
    const session = computeUsMarketSession(new Date('2026-04-28T14:00:00.000Z'));

    assert.equal(session.phaseCode, 'REGULAR');
    assert.equal(session.phaseTone, 'success');
    assert.equal(session.nextPhaseCode, 'AFTER_HOURS');
    assert.equal(session.countdownSec, 6 * 60 * 60);
});
