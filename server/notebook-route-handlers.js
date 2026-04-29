const { normalizeNotebookPayload } = require('./payload-normalizers');
const {
    isEditMethod,
    sendMethodNotAllowed,
    sendNotFound
} = require('./route-response-helpers');

const NOTEBOOK_NOT_FOUND = 'Notebook not found.';

function createNotebookRouteHandlers(config) {
    const {
        notesStore,
        readJsonBody,
        requireAuthenticatedSiteUser,
        sendJson
    } = config;

    async function handleNotebooksCollectionRoute(req, res) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const notebooks = notesStore.listNotebooks(user.id);
            sendJson(res, 200, { success: true, notebooks });
            return;
        }

        if (req.method === 'POST') {
            const body = await readJsonBody(req);
            const notebook = notesStore.createNotebook(user.id, normalizeNotebookPayload(body));
            sendJson(res, 201, { success: true, notebook });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    async function handleNotebookItemRoute(req, res, notebookId) {
        const user = requireAuthenticatedSiteUser(req, res);
        if (!user) return;

        if (req.method === 'GET') {
            const notebook = notesStore.getNotebook(user.id, notebookId);
            if (!notebook) {
                sendNotFound(sendJson, res, NOTEBOOK_NOT_FOUND);
                return;
            }
            sendJson(res, 200, { success: true, notebook });
            return;
        }

        if (isEditMethod(req)) {
            const body = await readJsonBody(req);
            const notebook = notesStore.updateNotebook(user.id, notebookId, normalizeNotebookPayload(body));
            if (!notebook) {
                sendNotFound(sendJson, res, NOTEBOOK_NOT_FOUND);
                return;
            }
            sendJson(res, 200, { success: true, notebook });
            return;
        }

        if (req.method === 'DELETE') {
            const result = notesStore.deleteNotebook(user.id, notebookId);
            if (!result.ok) {
                const isDefaultNotebook = result.reason === 'default_notebook';
                sendJson(res, isDefaultNotebook ? 400 : 404, {
                    success: false,
                    error: isDefaultNotebook ? 'DEFAULT_NOTEBOOK' : 'NOT_FOUND',
                    message: isDefaultNotebook ? 'The default notebook cannot be deleted.' : NOTEBOOK_NOT_FOUND
                });
                return;
            }
            sendJson(res, 200, { success: true, ...result });
            return;
        }

        sendMethodNotAllowed(sendJson, res);
    }

    return {
        handleNotebookItemRoute,
        handleNotebooksCollectionRoute
    };
}

module.exports = {
    createNotebookRouteHandlers
};
