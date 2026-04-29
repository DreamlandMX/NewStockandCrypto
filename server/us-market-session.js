const US_SESSION_TIMEZONE = 'America/New_York';
const US_BEIJING_LABEL = 'Beijing Time (CST, UTC+8)';

const US_HOLIDAYS_2026 = new Set([
    '2026-01-01',
    '2026-01-19',
    '2026-02-16',
    '2026-04-03',
    '2026-05-25',
    '2026-07-03',
    '2026-09-07',
    '2026-11-26',
    '2026-12-25'
]);

const US_EARLY_CLOSE_2026 = new Set([
    '2026-07-03',
    '2026-11-27',
    '2026-12-24'
]);

function parseOffsetMinutes(offsetValue) {
    const normalized = String(offsetValue || '').replace('GMT', '').trim();
    const match = normalized.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (!match) return 0;

    const sign = match[1] === '-' ? -1 : 1;
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    return sign * (hours * 60 + minutes);
}

function offsetMinutesToIso(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const abs = Math.abs(minutes);
    const hh = String(Math.floor(abs / 60)).padStart(2, '0');
    const mm = String(abs % 60).padStart(2, '0');
    return `${sign}${hh}:${mm}`;
}

function getTimeZoneOffsetMinutes(timeZone, refDate) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'shortOffset'
    });
    const tzPart = formatter.formatToParts(refDate).find((part) => part.type === 'timeZoneName');
    return parseOffsetMinutes(tzPart?.value || 'GMT+0');
}

function toNewYorkNow(now = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: US_SESSION_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        hour12: false
    });
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    const offsetMinutes = getTimeZoneOffsetMinutes(US_SESSION_TIMEZONE, now);
    const isoOffset = offsetMinutesToIso(offsetMinutes);
    const date = new Date(`${dateKey}T${parts.hour}:${parts.minute}:${parts.second}${isoOffset}`);

    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour: Number(parts.hour),
        minute: Number(parts.minute),
        second: Number(parts.second),
        weekday: parts.weekday,
        dateKey,
        date,
        offsetMinutes
    };
}

function makeNewYorkDate(dateKey, hour, minute, second = 0) {
    const [year, month, day] = String(dateKey).split('-').map((value) => Number(value));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return new Date(NaN);
    }

    const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const offsetMinutes = getTimeZoneOffsetMinutes(US_SESSION_TIMEZONE, probe);
    const isoOffset = offsetMinutesToIso(offsetMinutes);
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    const ss = String(second).padStart(2, '0');
    return new Date(`${dateKey}T${hh}:${mm}:${ss}${isoOffset}`);
}

function isUsTradingDate(dateKey, weekday) {
    if (weekday === 'Sat' || weekday === 'Sun') return false;
    if (US_HOLIDAYS_2026.has(dateKey)) return false;
    return true;
}

function nextUsTradingDateKey(currentDate) {
    const date = new Date(currentDate.getTime());
    while (true) {
        date.setUTCDate(date.getUTCDate() + 1);
        const ny = toNewYorkNow(date);
        if (isUsTradingDate(ny.dateKey, ny.weekday)) return ny.dateKey;
    }
}

function previousUsTradingDateKey(currentDate) {
    const date = new Date(currentDate.getTime());
    while (true) {
        date.setUTCDate(date.getUTCDate() - 1);
        const ny = toNewYorkNow(date);
        if (isUsTradingDate(ny.dateKey, ny.weekday)) return ny.dateKey;
    }
}

function buildUsTradingPhases(ny) {
    if (!isUsTradingDate(ny.dateKey, ny.weekday)) return [];

    const isEarlyClose = US_EARLY_CLOSE_2026.has(ny.dateKey);
    const closeHour = isEarlyClose ? 13 : 16;

    return [
        { code: 'PREMARKET', label: 'Pre-market', tone: 'info', start: makeNewYorkDate(ny.dateKey, 4, 0), end: makeNewYorkDate(ny.dateKey, 9, 30) },
        { code: 'REGULAR', label: 'Regular Hours', tone: 'success', start: makeNewYorkDate(ny.dateKey, 9, 30), end: makeNewYorkDate(ny.dateKey, closeHour, 0) },
        { code: 'AFTER_HOURS', label: 'After-hours', tone: 'warning', start: makeNewYorkDate(ny.dateKey, closeHour, 0), end: makeNewYorkDate(ny.dateKey, 20, 0) }
    ];
}

function findActivePhase(phases, nowMs) {
    return phases.find((phase) => nowMs >= phase.start.getTime() && nowMs < phase.end.getTime()) || null;
}

function findNextPhase(phases, activePhase, ny, nowMs) {
    const premarketStart = makeNewYorkDate(ny.dateKey, 4, 0);
    const afterHoursEnd = makeNewYorkDate(ny.dateKey, 20, 0);

    if (activePhase) {
        const currentIndex = phases.findIndex((phase) => phase.code === activePhase.code);
        const nextTradingPhase = phases[currentIndex + 1];
        if (nextTradingPhase) {
            return { code: nextTradingPhase.code, label: nextTradingPhase.label, at: nextTradingPhase.start };
        }
        return { code: 'CLOSED', label: 'Closed', at: afterHoursEnd };
    }

    if (phases.length > 0 && nowMs < premarketStart.getTime()) {
        return { code: 'PREMARKET', label: 'Pre-market', at: premarketStart };
    }

    const nextDateKey = nextUsTradingDateKey(ny.date);
    return { code: 'PREMARKET', label: 'Pre-market', at: makeNewYorkDate(nextDateKey, 4, 0) };
}

function computeUsMarketSession(now = new Date()) {
    const ny = toNewYorkNow(now);
    const phases = buildUsTradingPhases(ny);
    const nowMs = ny.date.getTime();
    const activePhase = findActivePhase(phases, nowMs) || { code: 'CLOSED', label: 'Closed', tone: 'danger' };
    const nextPhase = findNextPhase(phases, activePhase.code === 'CLOSED' ? null : activePhase, ny, nowMs);
    const countdownSec = Math.max(0, Math.floor((nextPhase.at.getTime() - nowMs) / 1000));

    return {
        timezone: US_SESSION_TIMEZONE,
        timezoneLabel: 'New York Time (ET)',
        beijingLabel: US_BEIJING_LABEL,
        phaseCode: activePhase.code,
        phaseLabel: activePhase.label,
        phaseTone: activePhase.tone,
        nextPhaseCode: nextPhase.code,
        nextPhaseLabel: nextPhase.label,
        nextPhaseAt: nextPhase.at.toISOString(),
        countdownSec,
        isHoliday: US_HOLIDAYS_2026.has(ny.dateKey),
        isEarlyClose: US_EARLY_CLOSE_2026.has(ny.dateKey)
    };
}

module.exports = {
    US_EARLY_CLOSE_2026,
    US_HOLIDAYS_2026,
    US_SESSION_TIMEZONE,
    computeUsMarketSession,
    isUsTradingDate,
    makeNewYorkDate,
    nextUsTradingDateKey,
    previousUsTradingDateKey,
    toNewYorkNow
};
