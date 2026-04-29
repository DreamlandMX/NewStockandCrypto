const { getNumberAfter, getTextAfter, runRoute } = require('./route-helpers');

function createSiteNotesRoutes(context) {
    return function routeNotesRequest(req, res, parsedUrl) {
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/notebooks') {
            return runRoute(context, res, context.handleNotebooksCollectionRoute(req, res), 'NOTEBOOKS_FAILED');
        }
        if (/^\/api\/notebooks\/\d+$/.test(pathname)) {
            const notebookId = getNumberAfter(pathname, '/api/notebooks/');
            return runRoute(context, res, context.handleNotebookItemRoute(req, res, notebookId), 'NOTEBOOK_ITEM_FAILED');
        }
        if (pathname === '/api/notes') {
            return runRoute(context, res, context.handleNotesCollectionRoute(req, res, parsedUrl), 'NOTES_FAILED');
        }
        if (pathname.startsWith('/api/notes/share/')) {
            const shareId = getTextAfter(pathname, '/api/notes/share/');
            return runRoute(context, res, context.handleNoteShareRoute(req, res, shareId), 'NOTE_SHARE_FAILED');
        }
        if (/^\/api\/notes\/\d+\/versions$/.test(pathname)) {
            const noteId = getNumberAfter(pathname, '/api/notes/');
            return runRoute(context, res, context.handleNoteVersionsRoute(req, res, noteId, parsedUrl), 'NOTE_VERSIONS_FAILED');
        }
        if (/^\/api\/notes\/\d+$/.test(pathname)) {
            const noteId = getNumberAfter(pathname, '/api/notes/');
            return runRoute(context, res, context.handleNoteItemRoute(req, res, noteId), 'NOTE_ITEM_FAILED');
        }

        return false;
    };
}

module.exports = {
    createSiteNotesRoutes
};
