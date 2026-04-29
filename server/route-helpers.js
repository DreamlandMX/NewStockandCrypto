function getNumberAfter(pathname, prefix) {
    return Number(pathname.slice(prefix.length).split('/')[0]);
}

function getTextAfter(pathname, prefix) {
    return decodeURIComponent(pathname.slice(prefix.length));
}

function runRoute(context, res, promise, errorCode) {
    context.handleAsyncRoute(res, promise, errorCode);
    return true;
}

module.exports = {
    getNumberAfter,
    getTextAfter,
    runRoute
};
