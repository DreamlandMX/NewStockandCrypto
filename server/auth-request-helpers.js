function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function parseCookies(headerValue) {
    const cookies = {};
    if (!headerValue) {
        return cookies;
    }

    headerValue.split(';').forEach((part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex === -1) {
            return;
        }

        const key = part.slice(0, separatorIndex).trim();
        const value = part.slice(separatorIndex + 1).trim();
        if (key) {
            cookies[key] = decodeURIComponent(value);
        }
    });

    return cookies;
}

function serializeCookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];
    if (options.maxAge) {
        parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
    }
    if (options.expires) {
        parts.push(`Expires=${options.expires.toUTCString()}`);
    }
    parts.push(`Path=${options.path || '/'}`);
    if (options.httpOnly !== false) {
        parts.push('HttpOnly');
    }
    if (options.sameSite) {
        parts.push(`SameSite=${options.sameSite}`);
    }
    if (options.secure) {
        parts.push('Secure');
    }
    return parts.join('; ');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSecureRequest(req) {
    if (req.socket && req.socket.encrypted) {
        return true;
    }

    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
    return forwardedProto.includes('https');
}

function getClientIp(req) {
    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwardedFor) {
        return forwardedFor;
    }

    return req.socket?.remoteAddress || null;
}

module.exports = {
    getClientIp,
    isSecureRequest,
    isValidEmail,
    normalizeEmail,
    parseCookies,
    serializeCookie
};
