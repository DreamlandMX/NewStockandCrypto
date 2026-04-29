const MARKET_SESSION_TIMEZONE = 'Asia/Shanghai';
const MARKET_SESSION_TIMEZONE_LABEL = 'Beijing Time (CST, UTC+8)';

function normalizeClockHour(value) {
    const hour = Number(value);
    return hour === 24 ? 0 : hour;
}

function toShanghaiNow(now = new Date()) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: MARKET_SESSION_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        hourCycle: 'h23'
    });
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = normalizeClockHour(parts.hour);
    const minute = Number(parts.minute);
    const second = Number(parts.second);
    const weekday = parts.weekday;
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
    const date = new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
    return { year, month, day, hour, minute, second, weekday, dateKey, date };
}

function makeShanghaiDate(dateKey, hour, minute, second = 0) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || '').trim());
    if (!match) {
        return new Date(Number.NaN);
    }
    const [, yearRaw, monthRaw, dayRaw] = match;
    const normalizedHour = normalizeClockHour(hour);
    return new Date(Date.UTC(
        Number(yearRaw),
        Number(monthRaw) - 1,
        Number(dayRaw),
        normalizedHour - 8,
        Number(minute),
        Number(second)
    ));
}

function nextTradingDateKey(currentDate) {
    const date = new Date(currentDate.getTime());
    while (true) {
        date.setUTCDate(date.getUTCDate() + 1);
        const shanghai = toShanghaiNow(date);
        if (isWeekday(shanghai.weekday)) {
            return shanghai.dateKey;
        }
    }
}

function previousShanghaiTradingDateKey(currentDate) {
    const date = new Date(currentDate.getTime());
    while (true) {
        date.setUTCDate(date.getUTCDate() - 1);
        const shanghai = toShanghaiNow(date);
        if (isWeekday(shanghai.weekday)) {
            return shanghai.dateKey;
        }
    }
}

function computeMarketSession(now = new Date()) {
    const shanghai = toShanghaiNow(now);
    const isWeekend = !isWeekday(shanghai.weekday);
    const phases = buildTradingPhases(shanghai.dateKey);
    const nowMs = shanghai.date.getTime();
    const current = phases.find((phase) => nowMs >= phase.start.getTime() && nowMs < phase.end.getTime()) || null;
    const nextPhase = findNextPhase({ current, isWeekend, nowMs, phases, shanghai });
    const activePhase = current || {
        code: 'CLOSED',
        label: 'Post-Market Closed',
        tone: 'danger'
    };

    return {
        timezone: MARKET_SESSION_TIMEZONE,
        timezoneLabel: MARKET_SESSION_TIMEZONE_LABEL,
        phaseCode: activePhase.code,
        phaseLabel: activePhase.label,
        phaseTone: activePhase.tone,
        nextPhaseCode: nextPhase ? nextPhase.code : null,
        nextPhaseLabel: nextPhase ? nextPhase.label : null,
        nextPhaseAt: nextPhase ? nextPhase.at.toISOString() : null,
        countdownSec: nextPhase ? Math.max(0, Math.floor((nextPhase.at.getTime() - nowMs) / 1000)) : 0
    };
}

function buildTradingPhases(dateKey) {
    const preOpenStart = makeShanghaiDate(dateKey, 9, 15);
    const preOpenEnd = makeShanghaiDate(dateKey, 9, 25);
    const amStart = makeShanghaiDate(dateKey, 9, 30);
    const amEnd = makeShanghaiDate(dateKey, 11, 30);
    const pmStart = makeShanghaiDate(dateKey, 13, 0);
    const closeAuctionStart = makeShanghaiDate(dateKey, 14, 57);
    const marketClose = makeShanghaiDate(dateKey, 15, 0);

    return [
        { code: 'PRE_OPEN_AUCTION', label: 'Pre-Open Auction', tone: 'warning', start: preOpenStart, end: preOpenEnd },
        { code: 'CONTINUOUS_AM', label: 'Continuous Trading', tone: 'success', start: amStart, end: amEnd },
        { code: 'LUNCH_BREAK', label: 'Lunch Break', tone: 'muted', start: amEnd, end: pmStart },
        { code: 'CONTINUOUS_PM', label: 'Continuous Trading', tone: 'success', start: pmStart, end: closeAuctionStart },
        { code: 'CLOSE_AUCTION', label: 'Close Auction', tone: 'warning', start: closeAuctionStart, end: marketClose }
    ];
}

function findNextPhase({ current, isWeekend, nowMs, phases, shanghai }) {
    if (isWeekend) {
        return preOpenOnNextTradingDate(shanghai.date);
    }
    if (current) {
        const currentIndex = phases.findIndex((phase) => phase.code === current.code);
        if (currentIndex > -1 && currentIndex < phases.length - 1) {
            const candidate = phases[currentIndex + 1];
            return { code: candidate.code, label: candidate.label, at: candidate.start };
        }
        return preOpenOnNextTradingDate(shanghai.date);
    }

    const upcomingToday = phases.find((phase) => nowMs < phase.start.getTime());
    if (upcomingToday) {
        return { code: upcomingToday.code, label: upcomingToday.label, at: upcomingToday.start };
    }
    return preOpenOnNextTradingDate(shanghai.date);
}

function preOpenOnNextTradingDate(date) {
    const nextTrading = nextTradingDateKey(date);
    return {
        code: 'PRE_OPEN_AUCTION',
        label: 'Pre-Open Auction',
        at: makeShanghaiDate(nextTrading, 9, 15)
    };
}

function isWeekday(weekday) {
    return weekday !== 'Sat' && weekday !== 'Sun';
}

module.exports = {
    MARKET_SESSION_TIMEZONE,
    MARKET_SESSION_TIMEZONE_LABEL,
    computeMarketSession,
    makeShanghaiDate,
    nextTradingDateKey,
    normalizeClockHour,
    previousShanghaiTradingDateKey,
    toShanghaiNow
};
