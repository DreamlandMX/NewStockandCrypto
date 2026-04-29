function buildStartupSummaryLines(config) {
    return [
        `Unified server listening at http://${config.host}:${config.port}`,
        `API proxy target: http://${config.apiHost}:${config.apiPort}`,
        `Model explorer proxy target: ${config.modelExplorerScheme}://${config.modelExplorerHost}:${config.modelExplorerPort}`,
        `Web root: ${config.webRoot}`,
        `App data dir: ${config.appDataDir}`,
        `App version: ${config.appVersion}`,
        `Loaded CSI300 snapshot rows: ${config.csi300Rows}`,
        `Loaded S&P 500 snapshot rows: ${config.sp500Rows}`
    ];
}

function logStartupSummary(config, logger = console.log) {
    buildStartupSummaryLines(config).forEach((line) => logger(line));
}

module.exports = {
    buildStartupSummaryLines,
    logStartupSummary
};
