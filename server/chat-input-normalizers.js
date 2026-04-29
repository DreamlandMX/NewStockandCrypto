const { normalizeTextContent } = require('./store-helpers');

function normalizeBoardName(value, fallback = 'New Lounge') {
    const next = String(value || '').trim();
    return next || fallback;
}

function normalizeBoardTopic(value) {
    return String(value || '').trim();
}

function normalizeMessageContent(value) {
    return normalizeTextContent(value).trim();
}

module.exports = {
    normalizeBoardName,
    normalizeBoardTopic,
    normalizeMessageContent
};
