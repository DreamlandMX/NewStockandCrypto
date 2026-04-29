(function initAuthFormUi(root) {
    'use strict';

    function ensureMessageContainer(form) {
        let container = form.querySelector('.auth-message');
        if (!container) {
            container = root.document.createElement('div');
            container.className = 'auth-message';
            container.style.marginBottom = '1rem';
            container.style.padding = '0.75rem 0.9rem';
            container.style.borderRadius = '10px';
            container.style.fontSize = '0.875rem';
            container.style.display = 'none';
            form.prepend(container);
        }
        return container;
    }

    function renderFormMessage(form, message, type = 'error') {
        const container = ensureMessageContainer(form);
        if (!message) {
            container.textContent = '';
            container.style.display = 'none';
            return;
        }

        container.textContent = message;
        container.style.display = 'block';
        if (type === 'success' || type === 'info') {
            container.style.border = '1px solid rgba(16, 185, 129, 0.35)';
            container.style.background = 'rgba(16, 185, 129, 0.12)';
            container.style.color = '#A7F3D0';
            return;
        }

        container.style.border = '1px solid rgba(248, 113, 113, 0.35)';
        container.style.background = 'rgba(127, 29, 29, 0.18)';
        container.style.color = '#FECACA';
    }

    function setButtonBusy(button, busy, label) {
        if (!button) return;
        if (busy) {
            button.dataset.originalLabel = button.textContent;
            button.textContent = label || 'Please wait...';
            button.disabled = true;
            return;
        }

        button.textContent = button.dataset.originalLabel || button.textContent;
        button.disabled = false;
    }

    const api = {
        renderFormMessage,
        setButtonBusy
    };

    root.StockAuthFormUi = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
