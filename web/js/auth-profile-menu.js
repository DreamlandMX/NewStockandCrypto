(function initAuthProfileMenu(root) {
    'use strict';

    const utils = root.StockAuthUtils || (typeof require === 'function' ? require('./auth-utils') : null);
    if (!utils) {
        throw new Error('auth-utils.js must load before auth-profile-menu.js');
    }

    const { escapeHtml } = utils;

    function buildMenuIcon(name) {
        const icons = {
            profile: `
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M10 10a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"></path>
                    <path d="M4.5 16.25a5.5 5.5 0 0 1 11 0"></path>
                </svg>
            `,
            upgrade: `
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M7 13 13 7"></path>
                    <path d="M8 7h5v5"></path>
                    <path d="M5.75 9.75v4.5h4.5"></path>
                </svg>
            `,
            logout: `
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M8 4.75H5.75A1.75 1.75 0 0 0 4 6.5v7a1.75 1.75 0 0 0 1.75 1.75H8"></path>
                    <path d="M11.5 7.25 15 10l-3.5 2.75"></path>
                    <path d="M15 10H7.5"></path>
                </svg>
            `
        };
        return icons[name] || '';
    }

    function buildProfileAvatarMarkup(displayName, avatarUrl) {
        const initial = escapeHtml(String(displayName || 'U').charAt(0).toUpperCase() || 'U');
        if (avatarUrl) {
            return `<span class="profile-chip-avatar"><img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName || 'User')} avatar"></span>`;
        }
        return `<span class="profile-chip-avatar">${initial}</span>`;
    }

    function buildProfileChipMarkup({ displayName, compactDisplayName, avatarUrl, legacy = false, asButton = false }) {
        const eyebrow = legacy ? 'Legacy' : 'Profile';
        const classes = legacy ? 'profile-chip profile-chip-legacy' : 'profile-chip';
        const title = legacy ? `${displayName} (Legacy session)` : displayName;
        const body = `
            ${buildProfileAvatarMarkup(displayName, avatarUrl)}
            <span class="profile-chip-copy">
                <span class="profile-chip-eyebrow">${eyebrow}</span>
                <span class="profile-chip-name">${escapeHtml(compactDisplayName)}</span>
            </span>
        `;

        if (asButton) {
            return `
                <button
                    type="button"
                    class="${classes} profile-menu-trigger"
                    title="${escapeHtml(title)}"
                    aria-label="Open account menu for ${escapeHtml(displayName)}"
                    aria-haspopup="menu"
                    aria-expanded="false"
                    data-profile-menu-trigger
                >
                    ${body}
                    <span class="profile-menu-caret" aria-hidden="true"></span>
                </button>
            `;
        }

        return `
            <a href="profile.html" class="${classes}" title="${escapeHtml(title)}" aria-label="Open profile for ${escapeHtml(displayName)}">
                ${body}
            </a>
        `;
    }

    function buildProfileMenuLink({ href, label, tone = 'default', description = '', icon = '' }) {
        const classes = tone === 'danger'
            ? 'profile-menu-link profile-menu-link-danger'
            : tone === 'accent'
                ? 'profile-menu-link profile-menu-link-accent'
                : 'profile-menu-link';
        const descriptionMarkup = description
            ? `<span class="profile-menu-link-desc">${escapeHtml(description)}</span>`
            : '';
        return `
            <a href="${href}" class="${classes}" role="menuitem">
                <span class="profile-menu-link-row">
                    <span class="profile-menu-link-icon" aria-hidden="true">${buildMenuIcon(icon)}</span>
                    <span class="profile-menu-link-label">${escapeHtml(label)}</span>
                </span>
                ${descriptionMarkup}
            </a>
        `;
    }

    function buildProfileMenuAction({ label, tone = 'default', dataAction, description = '', icon = '' }) {
        const classes = tone === 'danger'
            ? 'profile-menu-link profile-menu-link-danger'
            : tone === 'accent'
                ? 'profile-menu-link profile-menu-link-accent'
                : 'profile-menu-link';
        const descriptionMarkup = description
            ? `<span class="profile-menu-link-desc">${escapeHtml(description)}</span>`
            : '';
        return `
            <button type="button" class="${classes}" role="menuitem" ${dataAction}>
                <span class="profile-menu-link-row">
                    <span class="profile-menu-link-icon" aria-hidden="true">${buildMenuIcon(icon)}</span>
                    <span class="profile-menu-link-label">${escapeHtml(label)}</span>
                </span>
                ${descriptionMarkup}
            </button>
        `;
    }

    function buildProfileMenuSummary({ displayName, avatarUrl, email = '', legacy = false }) {
        const detail = legacy ? 'Local legacy session' : 'Full community account';
        const emailMarkup = email ? `<span class="profile-menu-summary-email">${escapeHtml(email)}</span>` : '';
        return `
            <div class="profile-menu-summary">
                ${buildProfileAvatarMarkup(displayName, avatarUrl)}
                <div class="profile-menu-summary-copy">
                    <span class="profile-menu-summary-title">${escapeHtml(displayName)}</span>
                    <span class="profile-menu-summary-detail">${escapeHtml(detail)}</span>
                    ${emailMarkup}
                </div>
            </div>
        `;
    }

    function buildProfileMenuMarkup({ displayName, compactDisplayName, avatarUrl, email = '', legacy = false }) {
        const menuItems = [
            buildProfileMenuLink({
                href: 'profile.html',
                label: 'Profile',
                icon: 'profile',
                description: 'Avatar, bio, and account details'
            })
        ];

        if (legacy) {
            menuItems.push(
                buildProfileMenuLink({
                    href: 'login.html?reason=legacy-session',
                    label: 'Upgrade',
                    tone: 'accent',
                    icon: 'upgrade',
                    description: 'Connect the full community account'
                })
            );
        }

        menuItems.push(
            buildProfileMenuAction({
                label: 'Logout',
                tone: 'danger',
                icon: 'logout',
                dataAction: 'data-auth-logout',
                description: 'End this session on this device'
            })
        );

        return `
            <div class="profile-menu${legacy ? ' profile-menu-legacy' : ''}">
                ${buildProfileChipMarkup({ displayName, compactDisplayName, avatarUrl, legacy, asButton: true })}
                <div class="profile-menu-panel" role="menu" aria-label="Account menu">
                    ${buildProfileMenuSummary({ displayName, avatarUrl, email, legacy })}
                    ${menuItems.join('')}
                </div>
            </div>
        `;
    }

    const api = {
        buildProfileAvatarMarkup,
        buildProfileChipMarkup,
        buildProfileMenuMarkup
    };

    root.StockAuthProfileMenu = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
