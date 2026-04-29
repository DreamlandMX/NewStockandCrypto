const METHOD_NOT_ALLOWED = {
    success: false,
    error: 'METHOD_NOT_ALLOWED',
    message: 'Method not allowed.'
};

const NOTE_NOT_FOUND = {
    success: false,
    error: 'NOT_FOUND',
    message: 'Note not found.'
};

function viewerSummary(viewer) {
    if (!viewer) {
        return null;
    }

    return {
        id: viewer.id,
        displayName: viewer.displayName,
        email: viewer.email
    };
}

function createCommunityRoutes(config) {
    const {
        notesStore,
        getAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleCommunityIdeasRoute(req, res, parsedUrl) {
        if (req.method !== 'GET') {
            sendJson(res, 405, METHOD_NOT_ALLOWED);
            return;
        }

        const viewer = getAuthenticatedSiteUser(req);
        const ideas = notesStore.listIdeas(viewer?.id ?? null, {
            market: parsedUrl.searchParams.get('market'),
            tag: parsedUrl.searchParams.get('tag'),
            search: parsedUrl.searchParams.get('search'),
            visibility: parsedUrl.searchParams.get('visibility'),
            sortBy: parsedUrl.searchParams.get('sortBy') || parsedUrl.searchParams.get('orderBy'),
            sortOrder: parsedUrl.searchParams.get('sortOrder') || (parsedUrl.searchParams.get('ascending') === 'true' ? 'asc' : 'desc'),
            limit: parsedUrl.searchParams.get('limit'),
            offset: parsedUrl.searchParams.get('offset')
        });

        sendJson(res, 200, {
            success: true,
            ideas,
            viewer: viewerSummary(viewer)
        });
    }

    async function handleCommunityNoteRoute(req, res, noteId) {
        if (req.method !== 'GET') {
            sendJson(res, 405, METHOD_NOT_ALLOWED);
            return;
        }

        const viewer = getAuthenticatedSiteUser(req);
        const note = notesStore.getNoteForViewer(viewer?.id ?? null, noteId);
        if (!note) {
            sendJson(res, 404, NOTE_NOT_FOUND);
            return;
        }

        const related = notesStore.getRelatedIdeas(viewer?.id ?? null, note, 4);
        sendJson(res, 200, {
            success: true,
            note,
            related
        });
    }

    async function handleCommunityShareRoute(req, res, shareId) {
        if (req.method !== 'GET') {
            sendJson(res, 405, METHOD_NOT_ALLOWED);
            return;
        }

        const note = notesStore.getSharedIdea(shareId);
        if (!note) {
            sendJson(res, 404, NOTE_NOT_FOUND);
            return;
        }

        const related = notesStore.getRelatedIdeas(null, note, 4);
        sendJson(res, 200, {
            success: true,
            note,
            related
        });
    }

    return {
        handleCommunityIdeasRoute,
        handleCommunityNoteRoute,
        handleCommunityShareRoute
    };
}

module.exports = {
    createCommunityRoutes
};
