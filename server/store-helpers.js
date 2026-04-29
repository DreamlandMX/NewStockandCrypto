function nowIso() {
    return new Date().toISOString();
}

function clampLimit(value, fallback = 100, max = 500) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(numeric), max);
}

function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null) {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }

    const normalized = String(value).trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function normalizeTextContent(value) {
    return String(value || '')
        .replace(/\r\n?/g, '\n')
        .replace(/`r`n/g, '\n')
        .replace(/`n/g, '\n')
        .replace(/\\n/g, '\n');
}

function parseJsonOrNull(value) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

module.exports = {
    clampLimit,
    normalizeBoolean,
    normalizeTextContent,
    nowIso,
    parseJsonOrNull
};
