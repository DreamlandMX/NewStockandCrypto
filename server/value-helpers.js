function parseNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value, fallback) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, timeoutMs, message) {
    let timer = null;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        })
    ]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

module.exports = {
    clamp,
    deepCopy,
    parseInteger,
    parseNumber,
    sleep,
    withTimeout
};
