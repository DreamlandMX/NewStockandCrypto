const { runRoute } = require('./route-helpers');

function createSiteProfileRoutes(context) {
    return function routeProfileRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/profile') {
            return runRoute(context, res, context.handleProfileRoute(req, res), 'PROFILE_FAILED');
        }
        if (pathname === '/api/profile/avatar') {
            return runRoute(context, res, context.handleProfileAvatarRoute(req, res), 'PROFILE_AVATAR_FAILED');
        }
        if (pathname === '/api/uploads/note-images') {
            return runRoute(context, res, context.handleNoteImageUploadRoute(req, res), 'NOTE_IMAGE_UPLOAD_FAILED');
        }

        return false;
    };
}

module.exports = {
    createSiteProfileRoutes
};
