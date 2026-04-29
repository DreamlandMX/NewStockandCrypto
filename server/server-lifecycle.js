const http = require('http');

function formatUnhandledRejection(reason) {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    return `UNHANDLED_REJECTION: ${message}`;
}

function startUnifiedHttpServer({
    appRouter,
    host,
    port,
    httpModule = http,
    processObject = process,
    logger = console,
    onStarted = () => {}
}) {
    const server = httpModule.createServer(appRouter);

    processObject.on('unhandledRejection', (reason) => {
        logger.error(formatUnhandledRejection(reason));
    });

    server.listen(port, host, onStarted);
    return server;
}

module.exports = {
    formatUnhandledRejection,
    startUnifiedHttpServer
};
