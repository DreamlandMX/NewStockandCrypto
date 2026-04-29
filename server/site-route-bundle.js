const { createChatRoutes } = require('./chat-routes');
const { createCommunityRoutes } = require('./community-routes');
const { createNotesRoutes } = require('./notes-routes');
const { createPositionsRoutes } = require('./positions-routes');
const { createProfileRoutes } = require('./profile-routes');
const { createSiteAuth } = require('./site-auth');
const { createSiteRoutes } = require('./site-routes');

function createSiteRouteBundle(config) {
    const {
        authStore,
        profileStore,
        uploadStore,
        notesStore,
        positionsStore,
        chatStore,
        readJsonBody,
        sendJson,
        handleAsyncRoute
    } = config;

    const siteAuth = createSiteAuth({ authStore, sendJson });
    const profileRoutes = createProfileRoutes({
        profileStore,
        uploadStore,
        readJsonBody,
        requireAuthenticatedSiteUser: siteAuth.requireAuthenticatedSiteUser,
        sendJson
    });
    const notesRoutes = createNotesRoutes({
        notesStore,
        readJsonBody,
        requireAuthenticatedSiteUser: siteAuth.requireAuthenticatedSiteUser,
        sendJson
    });
    const positionsRoutes = createPositionsRoutes({
        positionsStore,
        readJsonBody,
        requireAuthenticatedSiteUser: siteAuth.requireAuthenticatedSiteUser,
        sendJson
    });
    const chatRoutes = createChatRoutes({
        chatStore,
        readJsonBody,
        requireAuthenticatedSiteUser: siteAuth.requireAuthenticatedSiteUser,
        sendJson
    });
    const communityRoutes = createCommunityRoutes({
        notesStore,
        getAuthenticatedSiteUser: siteAuth.getAuthenticatedSiteUser,
        sendJson
    });
    const routeSiteRequest = createSiteRoutes({
        authStore,
        sendJson,
        readJsonBody,
        handleAsyncRoute,
        ...profileRoutes,
        ...notesRoutes,
        ...positionsRoutes,
        ...chatRoutes,
        ...communityRoutes
    });

    return {
        getAuthenticatedSiteUser: siteAuth.getAuthenticatedSiteUser,
        requireAuthenticatedSiteUser: siteAuth.requireAuthenticatedSiteUser,
        routeSiteRequest
    };
}

module.exports = {
    createSiteRouteBundle
};
