let currentUser = null;
let currentNote = null;
let relatedIdeas = [];
let noteVersions = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForSupabaseClient();
        await initializeNoteDetail();
    } catch (error) {
        console.error('Failed to initialize note detail:', error);
        showError();
    }
});

function waitForSupabaseClient(timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (window.SupabaseClient) {
            resolve();
            return;
        }
        const start = Date.now();
        const timer = setInterval(() => {
            if (window.SupabaseClient) {
                clearInterval(timer);
                resolve();
                return;
            }
            if (Date.now() - start > timeout) {
                clearInterval(timer);
                reject(new Error('SupabaseClient load timeout'));
            }
        }, 100);
    });
}

async function initializeNoteDetail() {
    await window.SupabaseClient.init();

    const authState = window.Auth?.ready
        ? await window.Auth.ready()
        : null;

    currentUser = authState?.user
        || authState?.legacyUser
        || null;

    const params = new URLSearchParams(window.location.search);
    const noteId = params.get('id');
    if (!noteId) {
        showError();
        return;
    }

    try {
        const payload = await window.SupabaseClient.communityNotes.getNote(noteId);
        currentNote = payload.note || null;
        relatedIdeas = payload.related || [];

        if (!currentNote) {
            showError();
            return;
        }

        renderArticle();
        await loadVersions();
        bindControls();

        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('articleState').style.display = 'block';

        if (window.location.hash === '#share') {
            document.getElementById('shareLink')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    } catch (error) {
        console.error('Failed to load idea article:', error);
        showError();
    }
}

async function renderArticle() {
    const noteBody = document.getElementById('noteBody');
    const marketClass = getMarketClass(currentNote.market);
    const visibilityText = currentNote.is_public ? 'Public Idea' : 'Private Draft';
    const visibilityTone = currentNote.is_public ? 'success' : 'warning';
    const authorName = currentNote.author?.display_name || 'Community Member';
    const shareLink = currentNote.share_id ? `${window.location.origin}/note-view.html?share=${currentNote.share_id}` : '';

    document.getElementById('noteTitle').textContent = currentNote.title || 'Untitled Idea';
    document.getElementById('noteMarket').textContent = currentNote.market || 'General';
    document.getElementById('noteMarket').className = `status-badge ${marketClass}`;
    document.getElementById('articleVisibility').textContent = visibilityText;
    document.getElementById('articleVisibility').className = `section-tag ${visibilityTone}`;
    document.getElementById('noteAuthor').textContent = `By ${authorName}`;
    document.getElementById('noteDate').textContent = `Created ${formatDate(currentNote.created_at)}`;
    document.getElementById('noteUpdated').textContent = `Updated ${formatDate(currentNote.updated_at)}`;
    document.getElementById('noteReadTime').textContent = `${currentNote.stats?.read_minutes || estimateReadMinutes(currentNote.content)} min read`;
    document.getElementById('authorName').textContent = authorName;
    document.getElementById('authorBadge').textContent = authorName.charAt(0).toUpperCase() || 'C';
    document.getElementById('authorRole').textContent = currentNote.is_owner ? 'Your published desk idea' : 'Community contributor';
    document.getElementById('publicToggle').checked = Boolean(currentNote.is_public);
    document.getElementById('shareLink').value = currentNote.is_public ? shareLink : '';
    document.getElementById('pinBtn').textContent = currentNote.is_pinned ? 'Unpin' : 'Pin';
    document.getElementById('favoriteBtn').textContent = currentNote.is_favorite ? 'Unfavorite' : 'Favorite';

    const html = window.MarkdownRenderer
        ? await window.MarkdownRenderer.renderSafe(currentNote.content || '')
        : escapeHtml(currentNote.content || '');
    noteBody.innerHTML = html;

    renderTags();
    renderStats();
    renderRelatedIdeas();
    updateOwnerControls();
}

function updateOwnerControls() {
    const isOwner = Boolean(currentNote?.is_owner);
    const editBtn = document.getElementById('editBtn');
    const pinBtn = document.getElementById('pinBtn');
    const favoriteBtn = document.getElementById('favoriteBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const publicToggle = document.getElementById('publicToggle');

    [editBtn, pinBtn, favoriteBtn, deleteBtn, publicToggle].forEach((element) => {
        if (!element) return;
        element.disabled = !isOwner;
        if (!isOwner && element.tagName === 'BUTTON') {
            element.style.display = 'none';
        }
    });

    if (!isOwner) {
        document.getElementById('shareBox').querySelector('button').textContent = 'Copy Public Link';
    }
}

function renderTags() {
    const tagList = document.getElementById('tagList');
    const tags = currentNote.tags || [];
    tagList.innerHTML = tags.length
        ? tags.map((tag) => `<span class="status-badge info">${escapeHtml(tag)}</span>`).join('')
        : '<span class="status-badge secondary">No tags</span>';
}

function renderStats() {
    const content = String(currentNote.content || '');
    const plain = content.replace(/\s+/g, ' ').trim();
    const wordCount = plain ? plain.split(' ').length : 0;
    document.getElementById('wordCount').textContent = wordCount.toLocaleString();
    document.getElementById('charCount').textContent = content.length.toLocaleString();
    document.getElementById('readTime').textContent = `${currentNote.stats?.read_minutes || estimateReadMinutes(content)} min`;
}

function renderRelatedIdeas() {
    const container = document.getElementById('relatedIdeas');
    if (!relatedIdeas.length) {
        container.innerHTML = '<span style="color: var(--text-secondary);">No related ideas yet.</span>';
        return;
    }

    container.innerHTML = relatedIdeas.map((idea) => `
        <a class="related-card" href="note-detail.html?id=${idea.id}">
            <span class="status-badge ${getMarketClass(idea.market)}">${escapeHtml(idea.market || 'General')}</span>
            <h4>${escapeHtml(idea.title || 'Untitled Idea')}</h4>
            <p style="margin:0; color: var(--text-secondary); font-size: 0.86rem; line-height: 1.55;">${escapeHtml(idea.excerpt || '')}</p>
        </a>
    `).join('');
}

async function loadVersions() {
    const container = document.getElementById('versionList');
    if (!currentNote?.is_owner) {
        container.innerHTML = '<span style="color: var(--text-secondary);">Version history is available for the author only.</span>';
        return;
    }

    try {
        noteVersions = await window.SupabaseClient.notes.getVersions(currentNote.id, 8);
        if (!noteVersions.length) {
            container.innerHTML = '<span style="color: var(--text-secondary);">No prior versions yet.</span>';
            return;
        }

        container.innerHTML = noteVersions.map((version, index) => `
            <div class="related-card">
                <strong style="display:block; margin-bottom:0.25rem;">Snapshot ${noteVersions.length - index}</strong>
                <div style="color: var(--text-secondary); font-size: 0.84rem;">${formatDate(version.created_at)}</div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load versions:', error);
        container.innerHTML = '<span style="color: var(--text-secondary);">Version history unavailable.</span>';
    }
}

function bindControls() {
    document.getElementById('editBtn')?.addEventListener('click', () => {
        window.location.href = `notes.html?edit=${currentNote.id}`;
    });

    document.getElementById('pinBtn')?.addEventListener('click', async () => {
        await toggleOwnerState(() => window.SupabaseClient.notes.update(currentNote.id, { is_pinned: !currentNote.is_pinned }));
    });

    document.getElementById('favoriteBtn')?.addEventListener('click', async () => {
        await toggleOwnerState(() => window.SupabaseClient.notes.update(currentNote.id, { is_favorite: !currentNote.is_favorite }));
    });

    document.getElementById('publicToggle')?.addEventListener('change', async (event) => {
        if (!currentNote.is_owner) {
            event.preventDefault();
            return;
        }
        try {
            currentNote = await window.SupabaseClient.notes.update(currentNote.id, { is_public: event.target.checked });
            const payload = await window.SupabaseClient.communityNotes.getNote(currentNote.id);
            currentNote = payload.note;
            relatedIdeas = payload.related || [];
            await renderArticle();
            showToast(currentNote.is_public ? 'Idea published to the feed.' : 'Idea returned to private draft mode.', 'success');
        } catch (error) {
            console.error('Failed to update publish state:', error);
            event.target.checked = !event.target.checked;
            showToast('Unable to update publish state.', 'error');
        }
    });

    document.getElementById('shareBtn')?.addEventListener('click', async () => {
        await copyShareLink();
    });

    document.getElementById('copyShareBtn')?.addEventListener('click', async () => {
        await copyShareLink();
    });

    document.getElementById('deleteBtn')?.addEventListener('click', async () => {
        if (!currentNote.is_owner) return;
        if (!window.confirm('Delete this idea permanently?')) return;
        try {
            await window.SupabaseClient.notes.delete(currentNote.id);
            showToast('Idea deleted.', 'success');
            window.setTimeout(() => {
                window.location.href = 'notes.html';
            }, 500);
        } catch (error) {
            console.error('Failed to delete idea:', error);
            showToast('Unable to delete the idea.', 'error');
        }
    });
}

async function toggleOwnerState(updateAction) {
    if (!currentNote.is_owner) return;
    try {
        currentNote = await updateAction();
        const payload = await window.SupabaseClient.communityNotes.getNote(currentNote.id);
        currentNote = payload.note;
        relatedIdeas = payload.related || [];
        await renderArticle();
    } catch (error) {
        console.error('Failed to update owner state:', error);
        showToast('Unable to update the article.', 'error');
    }
}

async function copyShareLink() {
    if (!currentNote.is_public) {
        if (!currentNote.is_owner) {
            showToast('This idea is private and cannot be shared publicly.', 'error');
            return;
        }

        try {
            currentNote = await window.SupabaseClient.notes.update(currentNote.id, { is_public: true });
            const payload = await window.SupabaseClient.communityNotes.getNote(currentNote.id);
            currentNote = payload.note;
            relatedIdeas = payload.related || [];
            await renderArticle();
        } catch (error) {
            console.error('Failed to publish before sharing:', error);
            showToast('Publish the idea before sharing it.', 'error');
            return;
        }
    }

    const shareUrl = `${window.location.origin}/note-view.html?share=${currentNote.share_id}`;
    await copyToClipboard(shareUrl);
    showToast('Public share link copied.', 'success');
}

function showError() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
}

function getMarketClass(market) {
    if (market === 'Crypto') return 'success';
    if (market === 'CN A-Shares') return 'warning';
    if (market === 'US Equities') return 'info';
    return 'secondary';
}

function formatDate(value) {
    const date = new Date(value);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function estimateReadMinutes(content) {
    const words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function copyToClipboard(value) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const input = document.createElement('textarea');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
}

function showToast(message, type = 'info') {
    if (window.showToast?.[type]) {
        window.showToast[type](message);
        return;
    }

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        padding: 0.85rem 1rem;
        border-radius: 14px;
        background: rgba(8, 12, 29, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: white;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
    `;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2600);
}
