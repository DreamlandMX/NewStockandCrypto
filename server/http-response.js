function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    });
    res.end(body);
}

function handleAsyncRoute(res, promise, errorCode = 'REQUEST_FAILED') {
    Promise.resolve(promise).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        const statusCode = Number(error?.status) || 500;
        const resolvedErrorCode = error?.code || errorCode;
        console.error(`${resolvedErrorCode}: ${message}`);
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
        if (res.writableEnded) {
            return;
        }
        sendJson(res, statusCode, {
            success: false,
            error: resolvedErrorCode,
            message
        });
    });
}

module.exports = {
    handleAsyncRoute,
    sendJson
};
