function getParam(parsedUrl, name) {
    return parsedUrl.searchParams.get(name);
}

function getNoteFilters(parsedUrl) {
    return {
        notebook_id: getParam(parsedUrl, 'notebook_id') || getParam(parsedUrl, 'notebookId'),
        market: getParam(parsedUrl, 'market'),
        tag: getParam(parsedUrl, 'tag'),
        search: getParam(parsedUrl, 'search'),
        pinned: getParam(parsedUrl, 'pinned'),
        favorite: getParam(parsedUrl, 'favorite'),
        recent: getParam(parsedUrl, 'recent'),
        sortBy: getParam(parsedUrl, 'sortBy') || getParam(parsedUrl, 'orderBy'),
        sortOrder: getParam(parsedUrl, 'sortOrder') || (getParam(parsedUrl, 'ascending') === 'true' ? 'asc' : 'desc'),
        limit: getParam(parsedUrl, 'limit'),
        offset: getParam(parsedUrl, 'offset')
    };
}

function getPositionFilters(parsedUrl) {
    return {
        status: getParam(parsedUrl, 'status'),
        limit: getParam(parsedUrl, 'limit')
    };
}

function getStopOrderFilters(parsedUrl) {
    return {
        status: getParam(parsedUrl, 'status')
    };
}

module.exports = {
    getNoteFilters,
    getPositionFilters,
    getStopOrderFilters
};
