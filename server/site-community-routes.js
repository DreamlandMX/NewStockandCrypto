const { getNumberAfter, getTextAfter, runRoute } = require('./route-helpers');

function createSiteCommunityRoutes(context) {
    return function routeCommunityRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/community/ideas') {
            return runRoute(context, res, context.handleCommunityIdeasRoute(req, res, parsedUrl), 'COMMUNITY_IDEAS_FAILED');
        }
        if (pathname.startsWith('/api/community/notes/share/')) {
            const shareId = getTextAfter(pathname, '/api/community/notes/share/');
            return runRoute(context, res, context.handleCommunityShareRoute(req, res, shareId), 'COMMUNITY_SHARE_FAILED');
        }
        if (/^\/api\/community\/notes\/\d+$/.test(pathname)) {
            const noteId = getNumberAfter(pathname, '/api/community/notes/');
            return runRoute(context, res, context.handleCommunityNoteRoute(req, res, noteId), 'COMMUNITY_NOTE_FAILED');
        }

        return false;
    };
}

module.exports = {
    createSiteCommunityRoutes
};
