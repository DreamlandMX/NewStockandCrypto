(function initAuthLegacyApi(root) {
    'use strict';

    const DEFAULT_RENDER_WAKEUP_MESSAGE = 'Sign-in service is temporarily unreachable. Render may be waking up or redeploying; please retry in a moment.';

    function createLegacyAuthApi(options = {}) {
        const fetchImpl = options.fetchImpl || root.fetch?.bind(root);
        const wait = options.delay || (() => Promise.resolve());
        const baseUrl = options.baseUrl || `${root.location?.origin || ''}/api/auth`;
        const meUrl = options.meUrl || `${baseUrl}/me?optional=1`;
        const logoutUrl = options.logoutUrl || `${baseUrl}/logout`;

        if (!fetchImpl) {
            throw new Error('A fetch implementation is required for legacy auth.');
        }

        async function request(endpoint, requestOptions = {}) {
            const response = await fetchWithOneRetry(`${baseUrl}${endpoint}`, requestOptions);
            const payload = await readJson(response);

            if (!response.ok) {
                throwHttpError(response, payload);
            }

            return payload;
        }

        async function fetchUser() {
            try {
                const response = await fetchImpl(meUrl, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { Accept: 'application/json' }
                });

                if (!response.ok) {
                    return null;
                }

                const payload = await readJson(response);
                return payload.user || null;
            } catch (error) {
                return null;
            }
        }

        async function clearSession() {
            try {
                await fetchImpl(logoutUrl, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json'
                    },
                    body: '{}'
                });
            } catch (error) {
                // Local session cleanup is best-effort only.
            }
        }

        function login(email, password, rememberMe = false) {
            return request('/login', {
                method: 'POST',
                body: { email, password, rememberMe }
            });
        }

        function register(fullName, email, password, confirmPassword) {
            return request('/register', {
                method: 'POST',
                body: { fullName, email, password, confirmPassword }
            });
        }

        async function fetchWithOneRetry(url, requestOptions) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    return await fetchImpl(url, buildFetchOptions(requestOptions));
                } catch (error) {
                    if (attempt === 0) {
                        await wait(900);
                        continue;
                    }
                    throwNetworkError(error);
                }
            }
            return null;
        }

        return {
            clearSession,
            fetchUser,
            login,
            register,
            request
        };
    }

    function buildFetchOptions(options = {}) {
        return {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...(options.headers || {})
            },
            credentials: 'same-origin',
            body: options.body ? JSON.stringify(options.body) : undefined
        };
    }

    async function readJson(response) {
        return response.json().catch(() => ({}));
    }

    function throwHttpError(response, payload) {
        const error = new Error(payload.message || payload.error || `Legacy auth HTTP ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    function throwNetworkError(cause) {
        const error = new Error(DEFAULT_RENDER_WAKEUP_MESSAGE);
        error.status = 0;
        error.cause = cause;
        throw error;
    }

    const api = {
        createLegacyAuthApi
    };

    root.StockAuthLegacyApi = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
