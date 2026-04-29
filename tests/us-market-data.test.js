const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildStooqBatchUrl,
    buildYahooSparkUrl,
    appendProviderSource,
    buildUsCoverageStats,
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
} = require('../server/us-market-data');

test('US market data converts symbols between Stooq and Yahoo', () => {
    assert.equal(stooqSymbolToYahooSymbol('BRK.B.US'), 'BRK-B');
    assert.equal(stooqSymbolToYahooSymbol('^SPX'), '^GSPC');
    assert.equal(yahooSymbolToStooqSymbol('BRK-B'), 'BRK-B.US');
    assert.equal(yahooSymbolToStooqSymbol('^GSPC'), '^SPX');
});

test('US market data builds upstream quote URLs', () => {
    assert.equal(
        buildStooqBatchUrl(['AAPL.US', 'MSFT.US']),
        'https://stooq.com/q/l/?f=sd2t2ohlcv&h&e=csv&s=AAPL.US+MSFT.US'
    );
    assert.equal(
        buildYahooSparkUrl(['AAPL', '^GSPC'], '1d', '1m'),
        'https://query1.finance.yahoo.com/v7/finance/spark?symbols=AAPL,%5EGSPC&range=1d&interval=1m'
    );
});

test('US market data parses Stooq CSV rows', () => {
    const rows = parseStooqCsvRows([
        'Symbol,Date,Time,Open,High,Low,Close,Volume',
        'AAPL.US,2026-04-28,15:59:00,100,105,99,104,12345'
    ].join('\n'));

    assert.deepEqual(rows[0], {
        symbol: 'AAPL.US',
        date: '2026-04-28',
        time: '15:59:00',
        open: 100,
        high: 105,
        low: 99,
        price: 104,
        volume: 12345,
        changePct: 4
    });
});

test('US market data detects Stooq rate limit text', () => {
    assert.equal(isStooqRateLimitText('Daily hits limit exceeded'), true);
    assert.equal(isStooqRateLimitText('Too many requests'), true);
    assert.equal(isStooqRateLimitText('normal csv'), false);
});

test('US market data finds finite numbers in arrays', () => {
    const values = ['bad', undefined, '3', 5, '2'];

    assert.equal(firstFiniteNumber(values), 3);
    assert.equal(lastFiniteNumber(values), 2);
    assert.equal(minFiniteNumber(values), 2);
    assert.equal(maxFiniteNumber(values), 5);
});

test('US market data formats epoch seconds in New York time', () => {
    const dateTime = formatEpochToEtDateTime(Date.parse('2026-04-28T14:00:00.000Z') / 1000);

    assert.equal(dateTime.date, '2026-04-28');
    assert.equal(dateTime.time, '10:00:00');
});

test('US market data parses Yahoo Spark rows', () => {
    const row = parseYahooSparkQuoteRow({
        symbol: 'AAPL',
        response: [{
            meta: {
                regularMarketPrice: 104,
                previousClose: 100,
                regularMarketDayHigh: 105,
                regularMarketDayLow: 99,
                regularMarketVolume: 12345,
                regularMarketTime: Date.parse('2026-04-28T14:00:00.000Z') / 1000
            },
            indicators: { quote: [{ close: [100, 101, 104] }] }
        }]
    });

    assert.equal(row.symbol, 'AAPL.US');
    assert.equal(row.price, 104);
    assert.equal(row.changePct, 4);
    assert.equal(row.time, '10:00:00');
});

test('US market data parses Alpha Vantage global quote rows', () => {
    const quote = parseAlphaGlobalQuote({
        'Global Quote': {
            '01. symbol': 'AAPL',
            '02. open': '100',
            '03. high': '105',
            '04. low': '99',
            '05. price': '104',
            '06. volume': '12345',
            '10. change percent': '4%'
        }
    });

    assert.equal(quote.symbol, 'AAPL');
    assert.equal(quote.changePct, 4);
});

test('US market data normalizes S&P source symbols', () => {
    assert.equal(normalizeUsSymbol('BRK-B.US'), 'BRK.B');
    assert.equal(normalizeUsSourceSymbol('BRK.B'), 'BRK-B.US');
});

test('US market data converts Stooq rows into quote objects', () => {
    const quote = usQuoteFromStooqRow({
        date: '2026-04-28',
        time: '15:59:00',
        open: 100,
        high: 105,
        low: 99,
        price: 104,
        volume: 12345,
        changePct: 4
    });

    assert.equal(quote.quoteTimezone, 'ET');
    assert.equal(quote.price, 104);
});

test('US market data appends provider names once', () => {
    assert.equal(appendProviderSource('stooq+yahoo', 'alpha'), 'stooq+yahoo+alpha');
    assert.equal(appendProviderSource('stooq+yahoo', 'yahoo'), 'stooq+yahoo');
});

test('US market data summarizes live quote coverage', () => {
    const quoteMap = new Map([
        ['AAPL.US', { price: 104 }],
        ['MSFT.US', { price: null }]
    ]);

    assert.deepEqual(buildUsCoverageStats(quoteMap, ['AAPL.US', 'MSFT.US']), {
        total: 2,
        live: 1,
        pct: 50
    });
});
