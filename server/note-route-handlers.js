const { normalizeNotePayload } = require('./payload-normalizers');
const {
    isEditMethod,
    sendMethodNotAllowed,
    sendNotFound
} = require('./route-response-helpers');
const { getNoteFilters } = require('./site-query-helpers');

const NOTE_NOT_FOUND = 'Note not found.';

function createNoteRouteHandlers(config) {
    const {
        notesStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleNotesCollectionRoute(req, res, parsedUrl) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const notes = notesStore.listNotes(user.id, getNoteFilters(parsedUrl));
            sendJson(res, 200, { success: true, notes });
            return;
        }

        if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const note = notesStore.createNote(user.id, normalizeNotePayload(body));
            sendJson(res, 201, { success: true, note });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    async function handleNoteItemRoute(req, res, noteId) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const note = notesStore.getNoteForUser(user.id, noteId, { touch: true });
            if (!note) {
                sendNotFound(sendJson, res, NOTE_NOT_FOUND);
                return;
            }
            sendJson(res, 200, { success: true, note });
            return;
        }

        if (isEditMethod(req)) {
            const body = await readJsonBody(req);
            const note = notesStore.updateNote(user.id, noteId, normalizeNotePayload(body));
            if (!note) {
                sendNotFound(sendJson, res, NOTE_NOT_FOUND);
                return;
            }
            sendJson(res, 200, { success: true, note });
            return;
        }

        if (req.method === 'DELETE') {
            const deleted = notesStore.deleteNote(user.id, noteId);
            if (!deleted) {
                sendNotFound(sendJson, res, NOTE_NOT_FOUND);
                return;
            }
            sendJson(res, 200, { success: true });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    async function handleNoteVersionsRoute(req, res, noteId, parsedUrl) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method !== 'GET') {
            sendMethodNotAllowed(sendJson, res);
            return;
        }

        const versions = notesStore.getNoteVersions(user.id, noteId, parsedUrl.searchParams.get('limit'));
        if (!versions) {
            sendNotFound(sendJson, res, NOTE_NOT_FOUND);
            return;
        }

        sendJson(res, 200, { success: true, versions });
    }

    async function handleNoteShareRoute(req, res, shareId) {
        if (req.method !== 'GET') {
            sendMethodNotAllowed(sendJson, res);
            return;
        }

        const note = notesStore.getNoteByShareId(shareId);
        if (!note) {
            sendNotFound(sendJson, res, NOTE_NOT_FOUND);
            return;
        }

        sendJson(res, 200, { success: true, note });
    }

    return {
        handleNoteItemRoute,
        handleNotesCollectionRoute,
        handleNoteShareRoute,
        handleNoteVersionsRoute
    };
}

module.exports = {
    createNoteRouteHandlers
};
