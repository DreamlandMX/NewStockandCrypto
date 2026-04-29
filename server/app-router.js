function createAppRouter(config) {
    const {
        host,
        port,
        sendJson,
        handleAsyncRoute,
        runtime,
        serveUploads,
        routeSiteRequest,
        routeMarketRequest,
        routeQuantRouterRequest,
        handleAlertContract,
        proxyModelExplorer,
        proxyApi,
        serveStatic
    } = config;

    return function appRouter(req, res) {
        if (!req.url) {
            sendJson(res, 400, { error: 'Empty URL' });
            return;
        }

        runtime.beginRequestTracking(req, res);
        const parsedUrl = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);

        if (parsedUrl.pathname === '/healthz' || parsedUrl.pathname === '/api/system/health') {
            handleAsyncRoute(res, runtime.handleSystemHealthRoute(req, res), 'SYSTEM_HEALTH_FAILED');
            return;
        }
        if (parsedUrl.pathname === '/api/system/metrics') {
            runtime.handleSystemMetricsRoute(req, res);
            return;
        }
        if (parsedUrl.pathname === '/api/system/config') {
            sendJson(res, 200, runtime.buildSystemConfigSnapshot());
            return;
        }

        if (parsedUrl.pathname.startsWith('/uploads/')) {
            serveUploads(req, res);
            return;
        }

        if (routeSiteRequest(req, res, parsedUrl)) {
            return;
        }

        if (routeMarketRequest(req, res, parsedUrl)) {
            return;
        }

        if (routeQuantRouterRequest(req, res, parsedUrl)) {
            return;
        }

        if (parsedUrl.pathname === '/api/alerts') {
            handleAlertContract(req, res);
            return;
        }

        if (parsedUrl.pathname.startsWith('/api/model-explorer')) {
            proxyModelExplorer(req, res, parsedUrl);
            return;
        }

        if (parsedUrl.pathname.startsWith('/api/')) {
            proxyApi(req, res);
            return;
        }

        if (parsedUrl.pathname === '/favicon.ico') {
            res.writeHead(204);
            res.end();
            return;
        }

        serveStatic(req, res);
    };
}

module.exports = {
    createAppRouter
};
