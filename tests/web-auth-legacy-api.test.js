const test = require('node:test');
const assert = require('node:assert/strict');
const { createLegacyAuthApi } = require('../web/js/auth-legacy-api');

test('legacy auth API sends login as JSON to the local auth service', async () => {
    const requests = [];
    const api = createLegacyAuthApi({
        baseUrl: 'http://site.test/api/auth',
        fetchImpl: async (url, options) => {
            requests.push({ url, options });
            return okResponse({ user: { email: 'ava@example.com' } });
        }
    });

    const result = await api.login('ava@example.com', 'secret', true);

    assert.deepEqual(result, { user: { email: 'ava@example.com' } });
    assert.equal(requests[0].url, 'http://site.test/api/auth/login');
    assert.equal(requests[0].options.method, 'POST');
    assert.equal(requests[0].options.credentials, 'same-origin');
    assert.equal(requests[0].options.body, JSON.stringify({
        email: 'ava@example.com',
        password: 'secret',
        rememberMe: true
    }));
});

test('legacy auth API retries one fetch failure before reporting Render wakeup', async () => {
    let attempts = 0;
    const api = createLegacyAuthApi({
        baseUrl: 'http://site.test/api/auth',
        delay: async () => {},
        fetchImpl: async () => {
            attempts += 1;
            throw new Error('Failed to fetch');
        }
    });

    await assert.rejects(
        () => api.login('ava@example.com', 'secret'),
        /temporarily unreachable/
    );
    assert.equal(attempts, 2);
});

test('legacy auth API returns null when optional current user is unavailable', async () => {
    const api = createLegacyAuthApi({
        meUrl: 'http://site.test/api/auth/me?optional=1',
        fetchImpl: async () => okResponse({}, false, 401)
    });

    const user = await api.fetchUser();

    assert.equal(user, null);
});

test('legacy auth API clears local session with a best-effort logout request', async () => {
    const requests = [];
    const api = createLegacyAuthApi({
        logoutUrl: 'http://site.test/api/auth/logout',
        fetchImpl: async (url, options) => {
            requests.push({ url, options });
            return okResponse({});
        }
    });

    await api.clearSession();

    assert.equal(requests[0].url, 'http://site.test/api/auth/logout');
    assert.equal(requests[0].options.method, 'POST');
    assert.equal(requests[0].options.body, '{}');
});

function okResponse(payload, ok = true, status = 200) {
    return {
        ok,
        status,
        json: async () => payload
    };
}
