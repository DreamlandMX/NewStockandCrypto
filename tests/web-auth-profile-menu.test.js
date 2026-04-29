const test = require('node:test');
const assert = require('node:assert/strict');

require('../web/js/auth-utils');
const {
    buildProfileAvatarMarkup,
    buildProfileMenuMarkup
} = require('../web/js/auth-profile-menu');

test('profile menu builds an initial avatar when there is no image', () => {
    const markup = buildProfileAvatarMarkup('Ava Trader', '');

    assert.match(markup, />A</);
    assert.match(markup, /profile-chip-avatar/);
});

test('profile menu builds a legacy account menu with upgrade and logout actions', () => {
    const markup = buildProfileMenuMarkup({
        displayName: 'Ava Trader',
        compactDisplayName: 'Ava',
        avatarUrl: '',
        email: 'ava@example.com',
        legacy: true
    });

    assert.match(markup, /Legacy/);
    assert.match(markup, /Upgrade/);
    assert.match(markup, /data-auth-logout/);
    assert.match(markup, /ava@example.com/);
});
