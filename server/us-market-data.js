const { US_SESSION_TIMEZONE } = require('./us-market-session');
const { parseNumber } = require('./value-helpers');

const STOOQ_BATCH_BASE = 'https://stooq.com/q/l/?f=sd2t2ohlcv&h&e=csv&s=';
const YAHOO_SPARK_BASE = 'https://query1.finance.yahoo.com/v7/finance/spark';

function buildStooqBatchUrl(symbols) {
    const symbolPart = symbols.map((symbol) => encodeURIComponent(symbol)).join('+');
    return `${STOOQ_BATCH_BASE}${symbolPart}`;
}

function stooqSymbolToYahooSymbol(symbol) {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (normalized === '^SPX') return '^GSPC';
    if (normalized.endsWith('.US')) return normalized.replace(/\.US$/, '').replace(/\./g, '-');
    return normalized;
}

function yahooSymbolToStooqSymbol(symbol) {
    const normalized = String(symbol || '').trim().toUpperCase();
    if (normalized === '^GSPC') return '^SPX';
    if (normalized.startsWith('^')) return normalized;
    return `${normalized}.US`;
}

function buildYahooSparkUrl(symbols, range = '1d', interval = '1m') {
    const symbolPart = symbols.map((symbol) => encodeURIComponent(symbol)).join(',');
    const rangePart = encodeURIComponent(range);
    const intervalPart = encodeURIComponent(interval);
    return `${YAHOO_SPARK_BASE}?symbols=${symbolPart}&range=${rangePart}&interval=${intervalPart}`;
}

function isStooqRateLimitText(payloadText) {
    const text = String(payloadText || '');
    return /daily hits limit/i.test(text) || /too many requests/i.test(text);
}

function parseStooqCsvRows(csvText) {
    const payloadText = String(csvText || '').trim();
    if (!payloadText) throw new Error('Empty Stooq response');
    if (isStooqRateLimitText(payloadText)) throw new Error('Stooq daily hits limit exceeded');

    const lines = payloadText.split(/\r?\n/);
    const header = String(lines[0] || '').replace(/^\uFEFF/, '').trim().toLowerCase();
    if (header !== 'symbol,date,time,open,high,low,close,volume') {
        throw new Error(`Unexpected Stooq CSV header: ${header || '<empty>'}`);
    }

    return lines.slice(1).map(parseStooqCsvLine).filter((row) => row !== null);
}

function parseStooqCsvLine(line) {
    const cells = String(line || '').trim().split(',');
    if (cells.length < 8) return null;

    const symbol = String(cells[0] || '').trim().toUpperCase();
    const date = String(cells[1] || '').trim();
    const time = String(cells[2] || '').trim();
    const open = parseNumber(cells[3]);
    const high = parseNumber(cells[4]);
    const low = parseNumber(cells[5]);
    const close = parseNumber(cells[6]);
    const volume = parseNumber(cells[7]);
    const changePct = Number.isFinite(open) && Number.isFinite(close) && open !== 0
        ? Number((((close - open) / open) * 100).toFixed(4))
        : null;

    return { symbol, date, time, open, high, low, price: close, volume, changePct };
}

function firstFiniteNumber(values) {
    if (!Array.isArray(values)) return null;
    for (const value of values) {
        const parsed = parseNumber(value);
        if (parsed !== null) return parsed;
    }
    return null;
}

function lastFiniteNumber(values) {
    if (!Array.isArray(values)) return null;
    for (let i = values.length - 1; i >= 0; i -= 1) {
        const parsed = parseNumber(values[i]);
        if (parsed !== null) return parsed;
    }
    return null;
}

function minFiniteNumber(values) {
    const numbers = finiteNumbers(values);
    return numbers.length ? Math.min(...numbers) : null;
}

function maxFiniteNumber(values) {
    const numbers = finiteNumbers(values);
    return numbers.length ? Math.max(...numbers) : null;
}

function finiteNumbers(values) {
    if (!Array.isArray(values)) return [];
    return values.map((value) => parseNumber(value)).filter((value) => value !== null);
}

function formatEpochToEtDateTime(epochSeconds) {
    if (!Number.isFinite(epochSeconds)) return { date: null, time: null };

    const dt = new Date(epochSeconds * 1000);
    if (!Number.isFinite(dt.getTime())) return { date: null, time: null };

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: US_SESSION_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = Object.fromEntries(formatter.formatToParts(dt).map((part) => [part.type, part.value]));
    if (!parts.year || !parts.month || !parts.day) return { date: null, time: null };

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: parts.hour && parts.minute && parts.second ? `${parts.hour}:${parts.minute}:${parts.second}` : null
    };
}

function parseYahooSparkQuoteRow(entry) {
    const yahooSymbol = String(entry?.symbol || '').trim().toUpperCase();
    if (!yahooSymbol) return null;

    const stooqSymbol = yahooSymbolToStooqSymbol(yahooSymbol);
    const response = Array.isArray(entry?.response) ? entry.response[0] : null;
    const meta = response?.meta || {};
    const closes = response?.indicators?.quote?.[0]?.close || [];
    const price = parseNumber(meta.regularMarketPrice) ?? lastFiniteNumber(closes);
    if (price === null) return null;

    const previousClose = parseNumber(meta.previousClose) ?? parseNumber(meta.chartPreviousClose);
    const changePct = previousClose !== null && previousClose !== 0
        ? Number((((price - previousClose) / previousClose) * 100).toFixed(4))
        : null;
    const dateTime = formatEpochToEtDateTime(parseNumber(meta.regularMarketTime));

    return {
        symbol: stooqSymbol,
        date: dateTime.date,
        time: dateTime.time,
        open: firstFiniteNumber(closes) ?? parseNumber(meta.chartPreviousClose) ?? parseNumber(meta.previousClose),
        high: parseNumber(meta.regularMarketDayHigh) ?? maxFiniteNumber(closes),
        low: parseNumber(meta.regularMarketDayLow) ?? minFiniteNumber(closes),
        price,
        volume: parseNumber(meta.regularMarketVolume),
        changePct
    };
}

function parseAlphaGlobalQuote(payload) {
    const row = payload?.['Global Quote'];
    if (!row || typeof row !== 'object') return null;

    const price = parseNumber(row['05. price']);
    if (price === null) return null;

    return {
        symbol: String(row['01. symbol'] || '').toUpperCase(),
        open: parseNumber(row['02. open']),
        high: parseNumber(row['03. high']),
        low: parseNumber(row['04. low']),
        price,
        volume: parseNumber(row['06. volume']),
        changePct: parseNumber(String(row['10. change percent'] || '').replace('%', '').trim())
    };
}

function normalizeUsSourceSymbol(symbol) {
    return `${String(symbol || '').trim().toUpperCase().replace(/\./g, '-')}.US`;
}

function normalizeUsSymbol(rawSymbol) {
    return String(rawSymbol || '')
        .trim()
        .toUpperCase()
        .replace(/\.US$/, '')
        .replace(/-/g, '.');
}

function usQuoteFromStooqRow(stooqRow) {
    if (!stooqRow) return null;
    return {
        open: stooqRow.open,
        high: stooqRow.high,
        low: stooqRow.low,
        price: stooqRow.price,
        volume: stooqRow.volume,
        changePct: stooqRow.changePct,
        quoteDate: stooqRow.date || null,
        quoteTime: stooqRow.time || null,
        quoteTimezone: 'ET'
    };
}

function appendProviderSource(baseSource, providerTag) {
    const parts = String(baseSource || '')
        .split('+')
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.includes(providerTag)) parts.push(providerTag);
    return parts.join('+');
}

function buildUsCoverageStats(quoteMap, symbols) {
    const total = symbols.length;
    if (!total) return { total: 0, live: 0, pct: 0 };

    let live = 0;
    for (const symbol of symbols) {
        const quote = usQuoteFromStooqRow(quoteMap.get(symbol));
        if (quote && Number.isFinite(quote.price)) live += 1;
    }

    return {
        total,
        live,
        pct: Number(((live / total) * 100).toFixed(2))
    };
}

module.exports = {
    appendProviderSource,
    buildStooqBatchUrl,
    buildUsCoverageStats,
    buildYahooSparkUrl,
    firstFiniteNumber,
    formatEpochToEtDateTime,
    isStooqRateLimitText,
    lastFiniteNumber,
    maxFiniteNumber,
    minFiniteNumber,
    normalizeUsSourceSymbol,
    normalizeUsSymbol,
    parseAlphaGlobalQuote,
    parseStooqCsvRows,
    parseYahooSparkQuoteRow,
    stooqSymbolToYahooSymbol,
    usQuoteFromStooqRow,
    yahooSymbolToStooqSymbol
};
