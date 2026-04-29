const { nowIso } = require('./store-helpers');

function normalizeText(value, maxLength = 280) {
    return String(value || '').trim().slice(0, maxLength);
}

function deriveDefaultUsername(user) {
    const displayName = normalizeText(user?.displayName || '', 80);
    if (displayName) {
        return displayName;
    }

    const emailName = String(user?.email || '').split('@')[0].trim();
    return normalizeText(emailName || 'User', 80) || 'User';
}

function mapProfileRow(row, fallbackUser = null) {
    if (!row && !fallbackUser) {
        return null;
    }

    const createdAt = row?.created_at || fallbackUser?.createdAt || nowIso();
    const updatedAt = row?.updated_at || createdAt;

    return {
        user_id: row?.user_id ?? fallbackUser?.id ?? null,
        username: normalizeText(row?.username || deriveDefaultUsername(fallbackUser), 80) || 'User',
        bio: normalizeText(row?.bio, 1000),
        website: normalizeText(row?.website, 255),
        location: normalizeText(row?.location, 120),
        avatar_url: row?.avatar_url || null,
        created_at: createdAt,
        updated_at: updatedAt
    };
}

module.exports = {
    deriveDefaultUsername,
    mapProfileRow,
    normalizeText
};
