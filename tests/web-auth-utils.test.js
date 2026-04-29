const test = require('node:test');
const assert = require('node:assert/strict');
const {
    escapeHtml,
    getBaseFileName,
    getRedirectTarget,
    normalizeAuthError,
    withTimeout
} = require('../web/js/auth-utils');

test('auth utils escape HTML before writing markup', () => {
    assert.equal(escapeHtml('<b>"Ava"</b>'), '&lt;b&gt;&quot;Ava&quot;&lt;/b&gt;');
});

test('auth utils read the current page file name from a path', () => {
    assert.equal(getBaseFileName('/folder/login.html'), 'login.html');
    assert.equal(getBaseFileName('/folder/'), 'index.html');
});

test('auth utils read redirect targets with a safe default', () => {
    assert.equal(getRedirectTarget('?redirect=profile.html'), 'profile.html');
    assert.equal(getRedirectTarget(''), 'index.html');
});

test('auth utils explain Render wakeup fetch failures clearly', () => {
    const message = normalizeAuthError(new Error('Failed to fetch'));

    assert.match(message, /Render waking up/);
});

test('auth utils resolve timeout fallbacks', async () => {
    const result = await withTimeout(new Promise(() => {}), 5, 'fallback');

    assert.equal(result, 'fallback');
});
