(function initAuthUtils(root) {
    'use strict';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getBaseFileName(pathname = root.location?.pathname || '') {
        const fileName = String(pathname).split('/').pop();
        return fileName || 'index.html';
    }

    function isAuthPage(pathname = root.location?.pathname || '') {
        const page = getBaseFileName(pathname);
        return page === 'login.html' || page === 'register.html';
    }

    function getRedirectTarget(search = root.location?.search || '') {
        const params = new URLSearchParams(search);
        return params.get('redirect') || 'index.html';
    }

    function withTimeout(promise, timeoutMs, fallbackValue = null) {
        return Promise.race([
            promise,
            new Promise((resolve) => {
                root.setTimeout(() => resolve(fallbackValue), timeoutMs);
            })
        ]);
    }

    function delay(ms) {
        return new Promise((resolve) => root.setTimeout(resolve, ms));
    }

    function waitFor(predicate, timeout = 10000, intervalMs = 100) {
        return new Promise((resolve, reject) => {
            const existing = predicate();
            if (existing) {
                resolve(existing);
                return;
            }

            const startedAt = Date.now();
            const timer = root.setInterval(() => {
                const result = predicate();
                if (result) {
                    root.clearInterval(timer);
                    resolve(result);
                    return;
                }

                if (Date.now() - startedAt > timeout) {
                    root.clearInterval(timer);
                    reject(new Error('Timed out while waiting for auth dependencies.'));
                }
            }, intervalMs);
        });
    }

    function injectScript(src, id) {
        return new Promise((resolve, reject) => {
            if (id && root.document?.getElementById(id)) {
                resolve();
                return;
            }

            const script = root.document.createElement('script');
            if (id) script.id = id;
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            root.document.head.appendChild(script);
        });
    }

    function normalizeAuthError(error, mode = 'login') {
        const raw = error?.message || error?.error_description || error?.description || 'Authentication failed.';
        const message = String(raw);
        const lower = message.toLowerCase();

        if (lower.includes('email address') && lower.includes('invalid')) {
            return 'Use a real deliverable email address. Demo or fake domains may be rejected by Supabase.';
        }
        if (lower.includes('invalid login credentials')) {
            return 'Invalid login credentials. If this account was created with the local site account flow, use that password and the app will keep you on the local community session.';
        }
        if (lower.includes('local_site_credentials_not_found')) {
            return 'No matching local site account was found for this email and password. Please check the password, or create a new site account with Sign up.';
        }
        if (
            lower.includes('failed to fetch')
            || lower.includes('networkerror')
            || lower.includes('load failed')
            || lower.includes('temporarily unreachable')
        ) {
            return 'Sign-in service is temporarily unreachable. This is usually Render waking up or redeploying, not a database password issue. Please wait a few seconds and try again.';
        }
        if (lower.includes('email not confirmed')) {
            return 'Check your inbox and confirm the email address before signing in.';
        }
        if (lower.includes('email rate limit exceeded')) {
            return 'Too many confirmation emails were requested. Wait a few minutes before trying again.';
        }
        if (mode === 'register' && lower.includes('user already registered')) {
            return 'This email is already registered. Try signing in instead.';
        }

        return message;
    }

    const api = {
        delay,
        escapeHtml,
        getBaseFileName,
        getRedirectTarget,
        injectScript,
        isAuthPage,
        normalizeAuthError,
        waitFor,
        withTimeout
    };

    root.StockAuthUtils = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
