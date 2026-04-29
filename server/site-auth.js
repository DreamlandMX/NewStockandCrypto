function createSiteAuth({ authStore, sendJson }) {
    function getAuthenticatedSiteUser(req) {
        return authStore.getSessionUser(req);
    }

    function requireAuthenticatedSiteUser(req, res) {
        const user = getAuthenticatedSiteUser(req);
        if (user) {
            return user;
        }

        sendJson(res, 401, {
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Sign in is required.'
        });
        return null;
    }

    return {
        getAuthenticatedSiteUser,
        requireAuthenticatedSiteUser
    };
}

module.exports = {
    createSiteAuth
};
