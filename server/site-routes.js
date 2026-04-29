const { createAuthRoutes } = require('./auth-routes');
const { createSiteChatRoutes } = require('./site-chat-routes');
const { createSiteCommunityRoutes } = require('./site-community-routes');
const { createSiteNotesRoutes } = require('./site-notes-routes');
const { createSitePositionRoutes } = require('./site-position-routes');
const { createSiteProfileRoutes } = require('./site-profile-routes');

function createSiteRoutes(context) {
    const routeAuthRequest = createAuthRoutes(context);
    const routeChatRequest = createSiteChatRoutes(context);
    const routeCommunityRequest = createSiteCommunityRoutes(context);
    const routeNotesRequest = createSiteNotesRoutes(context);
    const routePositionRequest = createSitePositionRoutes(context);
    const routeProfileRequest = createSiteProfileRoutes(context);

    return function routeSiteRequest(req, res, parsedUrl) {
        if (routeAuthRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeProfileRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeChatRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeNotesRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routeCommunityRequest(req, res, parsedUrl)) {
            return true;
        }

        if (routePositionRequest(req, res, parsedUrl)) {
            return true;
        }

        return false;
    };
}

module.exports = {
    createSiteRoutes
};
