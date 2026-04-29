const { runRoute } = require('./route-helpers');

function createAuthRoutes(context) {
    return function routeAuthRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/auth/register') {
            return runRoute(context, res, context.authStore.handleRegister(req, res, context.sendJson, context.readJsonBody), 'REGISTER_FAILED');
        }
        if (pathname === '/api/auth/login') {
            return runRoute(context, res, context.authStore.handleLogin(req, res, context.sendJson, context.readJsonBody), 'LOGIN_FAILED');
        }
        if (pathname === '/api/auth/me') {
            return runRoute(context, res, context.authStore.handleMe(req, res, context.sendJson, parsedUrl), 'AUTH_ME_FAILED');
        }
        if (pathname === '/api/auth/logout') {
            return runRoute(context, res, context.authStore.handleLogout(req, res, context.sendJson), 'LOGOUT_FAILED');
        }

        return false;
    };
}

module.exports = {
    createAuthRoutes
};
