const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createServerConfig } = require('../server/server-config');

test('server config uses local defaults that match the development server', () => {
    const baseDir = path.join('E:', 'NewStockandCrypto');
    const config = createServerConfig({ env: {}, baseDir });

    assert.equal(config.host, '127.0.0.1');
    assert.equal(config.port, 9000);
    assert.equal(config.apiHost, '127.0.0.1');
    assert.equal(config.apiPort, 5001);
    assert.equal(config.isRenderRuntime, false);
    assert.equal(config.modelExplorer.scheme, 'http');
    assert.equal(config.modelExplorer.host, '127.0.0.1');
    assert.equal(config.modelExplorer.port, 8000);
    assert.equal(config.webRoot, path.join(baseDir, 'web'));
    assert.equal(config.appDataDir, path.join(baseDir, 'data'));
    assert.equal(config.localUploadsRoot, path.join(baseDir, 'data', 'uploads'));
    assert.equal(config.appVersion, 'local');
    assert.equal(config.requestLoggingEnabled, true);
});

test('server config switches model explorer defaults for Render runtime', () => {
    const config = createServerConfig({
        env: { RENDER: 'true' },
        baseDir: '/app'
    });

    assert.equal(config.isRenderRuntime, true);
    assert.equal(config.modelExplorer.scheme, 'https');
    assert.equal(config.modelExplorer.host, 'newstockandcrypto-ml.onrender.com');
    assert.equal(config.modelExplorer.port, 443);
});

test('server config keeps explicit environment overrides', () => {
    const config = createServerConfig({
        env: {
            HOST: '0.0.0.0',
            PORT: '7777',
            API_HOST: 'api.internal',
            API_PORT: '7000',
            MODEL_EXPLORER_SCHEME: 'https',
            MODEL_EXPLORER_HOST: 'ml.internal',
            MODEL_EXPLORER_PORT: '9443',
            APP_DATA_DIR: '/tmp/app-data',
            NEW_QUANT_MODEL_ROOT: '/models',
            RENDER_GIT_COMMIT: 'abc123',
            REQUEST_LOGGING: 'false'
        },
        baseDir: '/app'
    });

    assert.equal(config.host, '0.0.0.0');
    assert.equal(config.port, 7777);
    assert.equal(config.apiHost, 'api.internal');
    assert.equal(config.apiPort, 7000);
    assert.equal(config.modelExplorer.scheme, 'https');
    assert.equal(config.modelExplorer.host, 'ml.internal');
    assert.equal(config.modelExplorer.port, 9443);
    assert.equal(config.appDataDir, '/tmp/app-data');
    assert.equal(config.newQuant.runsDir, path.join('/models', 'output', 'runs'));
    assert.equal(config.appVersion, 'abc123');
    assert.equal(config.requestLoggingEnabled, false);
});
