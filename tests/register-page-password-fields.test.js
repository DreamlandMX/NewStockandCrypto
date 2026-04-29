const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const registerHtml = fs.readFileSync(path.resolve(__dirname, '../web/register.html'), 'utf8');
const loginHtml = fs.readFileSync(path.resolve(__dirname, '../web/login.html'), 'utf8');

function getInputTag(html, id) {
    const match = html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 'i'));
    return match ? match[0] : '';
}

function getAttribute(tag, name) {
    const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
    return match ? match[1] : '';
}

test('register password fields use readable ASCII placeholders', () => {
    const passwordPlaceholder = getAttribute(getInputTag(registerHtml, 'password'), 'placeholder');
    const confirmPlaceholder = getAttribute(getInputTag(registerHtml, 'confirmPassword'), 'placeholder');

    assert.equal(passwordPlaceholder, 'Enter password');
    assert.equal(confirmPlaceholder, 'Repeat password');
});

test('register password fields use the shared password input style', () => {
    const passwordClass = getAttribute(getInputTag(registerHtml, 'password'), 'class');
    const confirmClass = getAttribute(getInputTag(registerHtml, 'confirmPassword'), 'class');

    assert.match(passwordClass, /\bpassword-input\b/);
    assert.match(confirmClass, /\bpassword-input\b/);
});

test('login password field uses the shared readable password style', () => {
    const passwordTag = getInputTag(loginHtml, 'password');

    assert.equal(getAttribute(passwordTag, 'placeholder'), 'Enter password');
    assert.match(getAttribute(passwordTag, 'class'), /\bpassword-input\b/);
});
