const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getNoteFilters,
    getPositionFilters,
    getStopOrderFilters
} = require('../server/site-query-helpers');

test('getNoteFilters reads all note list filters from the URL', () => {
    const parsedUrl = new URL('http://local/api/notes?notebookId=book-1&market=crypto&tag=btc&ascending=true&limit=5');

    assert.deepEqual(getNoteFilters(parsedUrl), {
        notebook_id: 'book-1',
        market: 'crypto',
        tag: 'btc',
        search: null,
        pinned: null,
        favorite: null,
        recent: null,
        sortBy: null,
        sortOrder: 'asc',
        limit: '5',
        offset: null
    });
});

test('getPositionFilters reads status and limit', () => {
    const parsedUrl = new URL('http://local/api/site-positions?status=open&limit=10');

    assert.deepEqual(getPositionFilters(parsedUrl), {
        status: 'open',
        limit: '10'
    });
});

test('getStopOrderFilters reads status', () => {
    const parsedUrl = new URL('http://local/api/site-stop-orders?status=active');

    assert.deepEqual(getStopOrderFilters(parsedUrl), {
        status: 'active'
    });
});
