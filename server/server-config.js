const path = require('path');

function createServerConfig({ env = process.env, baseDir = process.cwd() } = {}) {
    const isRenderRuntime = Boolean(env.RENDER || env.RENDER_EXTERNAL_URL);
    const newQuantModelRoot = env.NEW_QUANT_MODEL_ROOT || 'E:\\NewQuantModel';
    const newQuantOutputDir = path.join(newQuantModelRoot, 'output');
    const appDataDir = env.APP_DATA_DIR || path.join(baseDir, 'data');

    return {
        host: env.HOST || '127.0.0.1',
        port: Number(env.PORT || 9000),
        apiHost: env.API_HOST || '127.0.0.1',
        apiPort: Number(env.API_PORT || 5001),
        isRenderRuntime,
        modelExplorer: {
            scheme: normalizeScheme(env.MODEL_EXPLORER_SCHEME || (isRenderRuntime ? 'https' : 'http')),
            host: env.MODEL_EXPLORER_HOST || (isRenderRuntime ? 'newstockandcrypto-ml.onrender.com' : '127.0.0.1'),
            port: Number(env.MODEL_EXPLORER_PORT || (isRenderRuntime ? 443 : 8000))
        },
        webRoot: path.join(baseDir, 'web'),
        appDataDir,
        localUploadsRoot: path.join(appDataDir, 'uploads'),
        newQuant: {
            modelRoot: newQuantModelRoot,
            outputDir: newQuantOutputDir,
            runsDir: path.join(newQuantOutputDir, 'runs'),
            archiveDir: path.join(newQuantOutputDir, 'archive'),
            cacheDir: path.join(newQuantOutputDir, 'cache'),
            pipelineStatusPath: path.join(newQuantOutputDir, 'cache', 'pipeline_status.json')
        },
        appVersion: env.RENDER_GIT_COMMIT || env.GITHUB_SHA || 'local',
        requestLoggingEnabled: String(env.REQUEST_LOGGING || 'true').toLowerCase() !== 'false'
    };
}

function normalizeScheme(value) {
    return String(value || '').trim().toLowerCase() === 'https' ? 'https' : 'http';
}

module.exports = {
    createServerConfig,
    normalizeScheme
};
