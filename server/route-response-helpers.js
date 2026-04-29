function methodNotAllowedPayload() {
    return {
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'Method not allowed.'
    };
}

function notFoundPayload(message) {
    return {
        success: false,
        error: 'NOT_FOUND',
        message
    };
}

function sendMethodNotAllowed(sendJson, res) {
    sendJson(res, 405, methodNotAllowedPayload());
}

function sendNotFound(sendJson, res, message) {
    sendJson(res, 404, notFoundPayload(message));
}

function isEditMethod(req) {
    return req.method === 'PUT' || req.method === 'PATCH';
}

module.exports = {
    isEditMethod,
    methodNotAllowedPayload,
    notFoundPayload,
    sendMethodNotAllowed,
    sendNotFound
};
