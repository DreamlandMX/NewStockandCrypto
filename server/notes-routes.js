const { createNotebookRouteHandlers } = require('./notebook-route-handlers');
const { createNoteRouteHandlers } = require('./note-route-handlers');

function createNotesRoutes(config) {
    return {
        ...createNotebookRouteHandlers(config),
        ...createNoteRouteHandlers(config)
    };
}

module.exports = {
    createNotesRoutes
};
