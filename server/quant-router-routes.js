function runRoute(context, res, promise, errorCode) {
    context.handleAsyncRoute(res, promise, errorCode);
    return true;
}

function createQuantRouterRoutes(context) {
    const { quantRouter } = context;

    return function routeQuantRouterRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/quant/router/runs') {
            return runRoute(context, res, quantRouter.handleRuns(req, res), 'QUANT_ROUTER_RUNS_FAILED');
        }

        if (pathname === '/api/quant/router/runs/latest') {
            return runRoute(context, res, quantRouter.handleLatest(req, res), 'QUANT_ROUTER_LATEST_FAILED');
        }

        if (/^\/api\/quant\/router\/runs\/[^/]+\/file\/[^/]+$/.test(pathname)) {
            const segments = pathname.split('/');
            const runId = decodeURIComponent(segments[5]);
            const fileName = decodeURIComponent(segments[7]);
            return runRoute(context, res, quantRouter.handleFile(req, res, runId, fileName), 'QUANT_ROUTER_FILE_FAILED');
        }

        if (/^\/api\/quant\/router\/runs\/[^/]+$/.test(pathname)) {
            const runId = decodeURIComponent(pathname.replace('/api/quant/router/runs/', ''));
            return runRoute(context, res, quantRouter.handleRun(req, res, runId), 'QUANT_ROUTER_RUN_FAILED');
        }

        return false;
    };
}

module.exports = {
    createQuantRouterRoutes
};
