const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStartupSummaryLines } = require('../server/startup-summary');

test('startup summary lines describe the local server setup', () => {
    const lines = buildStartupSummaryLines({
        host: '127.0.0.1',
        port: 9000,
        apiHost: '127.0.0.1',
        apiPort: 5001,
        modelExplorerScheme: 'http',
        modelExplorerHost: '127.0.0.1',
        modelExplorerPort: 8000,
        webRoot: 'E:\\NewStockandCrypto\\web',
        appDataDir: 'E:\\NewStockandCrypto\\data',
        appVersion: 'local',
        csi300Rows: 300,
        sp500Rows: 500
    });

    assert.deepEqual(lines, [
        'Unified server listening at http://127.0.0.1:9000',
        'API proxy target: http://127.0.0.1:5001',
        'Model explorer proxy target: http://127.0.0.1:8000',
        'Web root: E:\\NewStockandCrypto\\web',
        'App data dir: E:\\NewStockandCrypto\\data',
        'App version: local',
        'Loaded CSI300 snapshot rows: 300',
        'Loaded S&P 500 snapshot rows: 500'
    ]);
});
