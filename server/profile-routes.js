const { normalizeProfilePayload } = require('./payload-normalizers');

const METHOD_NOT_ALLOWED = {
    success: false,
    error: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed.'
};

function createProfileRoutes(config) {
    const {
        profileStore,
        uploadStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleProfileRoute(req, res) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) {
            return;
        }

        if (req.method === 'GET') {
            const profile = profileStore.getProfile(user);
            sendJson(res, 200, { success: true, profile });
            return;
        }

        if (req.method === 'PATCH' || req.method === 'PUT') {
            const body = await readJsonBody(req);
            const profile = profileStore.updateProfile(user, normalizeProfilePayload(body));
            sendJson(res, 200, { success: true, profile });
            return;
        }

        sendJson(res, 405, METHOD_NOT_ALLOWED);
    }

    async function handleProfileAvatarRoute(req, res) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) {
            return;
        }

        if (req.method !== 'POST') {
            sendJson(res, 405, METHOD_NOT_ALLOWED);
            return;
        }

        const body = await readJsonBody(req, 4 * 1024 * 1024);
        const upload = uploadStore.saveAvatar(user.id, body, { maxBytes: 2 * 1024 * 1024 });
        const profile = profileStore.updateProfile(user, { avatar_url: upload.url });
        sendJson(res, 200, { success: true, avatarUrl: upload.url, profile });
    }

    async function handleNoteImageUploadRoute(req, res) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) {
            return;
        }

        if (req.method !== 'POST') {
            sendJson(res, 405, METHOD_NOT_ALLOWED);
            return;
        }

        const body = await readJsonBody(req, 8 * 1024 * 1024);
        const file = uploadStore.saveNoteImage(user.id, body, { maxBytes: 5 * 1024 * 1024 });
        sendJson(res, 200, { success: true, file });
    }

    return {
        handleNoteImageUploadRoute,
        handleProfileAvatarRoute,
        handleProfileRoute
    };
}

module.exports = {
    createProfileRoutes
};
