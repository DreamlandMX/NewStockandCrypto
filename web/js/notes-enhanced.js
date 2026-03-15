let currentUser = null;
let currentAuthState = null;
let currentNoteId = null;
let isPreviewMode = false;
let currentFilters = {
    search: '',
    market: '',
    visibility: '',
    sortBy: 'updated_at',
    sortOrder: 'desc'
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForSupabaseClient();
        await initializeNotesPage();
    } catch (error) {
        console.error('Notes page init failed:', error);
        renderFeedMessage('Failed to load the ideas feed. Refresh and try again.');
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

async function initializeNotesPage() {
    await window.SupabaseClient.init();

    currentAuthState = window.Auth?.ready
        ? await window.Auth.ready()
        : null;

    currentUser = currentAuthState?.user
        || currentAuthState?.legacyUser
        || null;

    setupComposer();
    setupFilters();
    updateComposerAccess();
    await loadIdeasFeed();

    const editId = new URLSearchParams(window.location.search).get('edit');
    if (editId && currentUser) {
        await editIdea(editId);
    }
}

function setupComposer() {
    document.getElementById('focusComposerBtn')?.addEventListener('click', () => {
        document.getElementById('composerCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('noteTitle')?.focus();
    });

    document.getElementById('saveBtn')?.addEventListener('click', saveIdea);
    document.getElementById('clearBtn')?.addEventListener('click', clearComposer);
    document.getElementById('previewBtn')?.addEventListener('click', togglePreview);

    const toolbar = document.querySelector('.markdown-toolbar');
    toolbar?.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        applyMarkdownAction(button.dataset.action);
    });
}

function setupFilters() {
    const debouncedSearch = debounce(async (value) => {
        currentFilters.search = value.trim();
        await loadIdeasFeed();
    }, 220);

    document.getElementById('searchInput')?.addEventListener('input', (event) => {
        debouncedSearch(event.target.value);
    });

    document.getElementById('marketFilter')?.addEventListener('change', async (event) => {
        currentFilters.market = event.target.value;
        await loadIdeasFeed();
    });

    document.getElementById('visibilityFilter')?.addEventListener('change', async (event) => {
        currentFilters.visibility = event.target.value;
        await loadIdeasFeed();
    });

    document.getElementById('sortSelect')?.addEventListener('change', async (event) => {
        const [sortBy, sortOrder] = String(event.target.value || 'updated_at:desc').split(':');
        currentFilters.sortBy = sortBy;
        currentFilters.sortOrder = sortOrder || 'desc';
        await loadIdeasFeed();
    });
}

function updateComposerAccess() {
    const gate = document.getElementById('composerGate');
    const formWrap = document.getElementById('composerFormWrap');
    const autoSaveStatus = document.getElementById('autoSaveStatus');

    if (!currentUser) {
        gate.style.display = 'flex';
        formWrap.style.display = 'none';
        autoSaveStatus.textContent = 'Browse only';
        autoSaveStatus.className = 'status-badge warning';
        return;
    }

    gate.style.display = 'none';
    formWrap.style.display = 'block';
    autoSaveStatus.textContent = currentNoteId ? 'Editing' : 'Ready to publish';
    autoSaveStatus.className = 'status-badge success';
}

async function loadIdeasFeed() {
    const feed = document.getElementById('ideasFeed');
    feed.innerHTML = '<div class="ideas-empty">Loading ideas feed...</div>';

    try {
        const payload = await window.SupabaseClient.communityNotes.listIdeas({
            search: currentFilters.search || undefined,
            market: currentFilters.market || undefined,
            visibility: currentFilters.visibility || undefined,
            sortBy: currentFilters.sortBy,
            sortOrder: currentFilters.sortOrder,
            limit: 24
        });

        const ideas = payload.ideas || [];
        renderIdeasFeed(ideas, currentFilters.search);
        updateQuickPulse(ideas);
        updatePopularTags(ideas);
        document.getElementById('feedCountBadge').textContent = `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}`;
    } catch (error) {
        console.error('Failed to load ideas feed:', error);
        renderFeedMessage('Ideas feed unavailable right now. Please refresh in a moment.');
    }
}

function renderIdeasFeed(ideas, searchQuery = '') {
    const feed = document.getElementById('ideasFeed');
    if (!ideas.length) {
        renderFeedMessage('No ideas matched the current filters yet.');
        return;
    }

    feed.innerHTML = ideas.map((idea) => renderIdeaCard(idea, searchQuery)).join('');
}

function renderIdeaCard(idea, searchQuery) {
    const marketClass = getMarketClass(idea.market);
    const title = highlightSearch(escapeHtml(idea.title || 'Untitled Idea'), searchQuery);
    const excerpt = highlightSearch(escapeHtml(idea.excerpt || ''), searchQuery);
    const createdLabel = formatDate(idea.created_at);
    const updatedLabel = formatDate(idea.updated_at);
    const authorName = escapeHtml(idea.author?.display_name || 'Community Member');
    const authorInitial = authorName.charAt(0).toUpperCase() || 'C';
    const tags = (idea.tags || []).slice(0, 4).map((tag) => `<button type="button" class="idea-tag" onclick="filterByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>`).join('');
    const visibilityLabel = idea.is_public ? 'Public' : 'Private';
    const visibilityTone = idea.is_public ? 'success' : 'warning';
    const viewHref = `note-detail.html?id=${idea.id}`;

    return `
        <article class="idea-card">
            <div class="idea-cover market-${marketClass}">
                <span class="status-badge ${marketClass} idea-cover-market">${escapeHtml(idea.market || 'General')}</span>
                <span class="idea-visibility status-badge ${visibilityTone}">${visibilityLabel}</span>
            </div>
            <div class="idea-body">
                <div class="idea-meta">
                    <div class="idea-author">
                        <span class="idea-author-badge">${authorInitial}</span>
                        <span class="idea-author-text">
                            <span class="idea-author-name">${authorName}</span>
                            <span>${idea.is_owner ? 'Your desk' : 'Community idea'}</span>
                        </span>
                    </div>
                    <span>${createdLabel}</span>
                </div>
                <h3 class="idea-title">${title}</h3>
                <p class="idea-excerpt">${excerpt || 'Open the article to read the full thesis.'}</p>
                <div class="idea-tags">${tags || '<span class="idea-tag">No tags</span>'}</div>
                <div class="idea-stats">
                    <span>${idea.stats?.read_minutes || 1} min read</span>
                    <span class="idea-engagement">
                        <span>${idea.engagement?.reactions || 0} reactions</span>
                        <span>${idea.engagement?.comments || 0} comments</span>
                        <span>Updated ${updatedLabel}</span>
                    </span>
                </div>
                <div class="idea-actions">
                    <div class="idea-actions-left">
                        <a href="${viewHref}" class="btn btn-primary btn-sm">View</a>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="shareIdea('${idea.id}', ${idea.is_public ? 'true' : 'false'}, '${escapeHtml(idea.share_id || '')}')">Share</button>
                    </div>
                    <div class="idea-actions-right">
                        ${idea.is_owner ? `
                            <button type="button" class="btn btn-secondary btn-sm" onclick="editIdea('${idea.id}')">Edit</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="togglePin('${idea.id}')">${idea.is_pinned ? 'Unpin' : 'Pin'}</button>
                            <button type="button" class="btn btn-secondary btn-sm" onclick="toggleFavorite('${idea.id}')">${idea.is_favorite ? 'Unfavorite' : 'Favorite'}</button>
                            <button type="button" class="btn btn-danger btn-sm" onclick="deleteIdea('${idea.id}')">Delete</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </article>
    `;
}

function updateQuickPulse(ideas) {
    const total = ideas.length;
    const publicIdeas = ideas.filter((idea) => idea.is_public).length;
    const privateIdeas = ideas.filter((idea) => !idea.is_public).length;
    const markets = new Set(ideas.map((idea) => idea.market).filter(Boolean));

    document.getElementById('totalIdeasStat').textContent = total;
    document.getElementById('publicIdeasStat').textContent = publicIdeas;
    document.getElementById('privateIdeasStat').textContent = privateIdeas;
    document.getElementById('marketCoverageStat').textContent = markets.size;
}

function updatePopularTags(ideas) {
    const container = document.getElementById('tagsContainer');
    const counts = new Map();
    ideas.forEach((idea) => {
        (idea.tags || []).forEach((tag) => {
            counts.set(tag, (counts.get(tag) || 0) + 1);
        });
    });

    const tags = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    container.innerHTML = tags.length
        ? tags.map(([tag, count]) => `<button type="button" class="idea-tag" onclick="filterByTag('${escapeHtml(tag)}')">${escapeHtml(tag)} (${count})</button>`).join('')
        : '<span class="idea-tag">No tags yet</span>';
}

async function saveIdea() {
    if (!currentUser) {
        showToast('Sign in to publish ideas.', 'error');
        return;
    }

    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const market = document.getElementById('noteMarket').value || 'General';
    const tags = document.getElementById('noteTags').value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    const is_public = document.getElementById('notePublicToggle').checked;
    const is_pinned = document.getElementById('notePinToggle').checked;

    if (!title || !content) {
        showToast('Add both a title and a thesis before publishing.', 'error');
        return;
    }

    setSaveBusy(true);

    try {
        if (currentNoteId) {
            await window.SupabaseClient.notes.update(currentNoteId, {
                title,
                content,
                market,
                tags,
                is_public,
                is_pinned
            });
            showToast('Idea updated.', 'success');
        } else {
            const note = await window.SupabaseClient.notes.create({
                title,
                content,
                market,
                tags,
                is_public,
                is_pinned
            });
            currentNoteId = note.id;
            showToast(is_public ? 'Idea published.' : 'Private draft saved.', 'success');
        }

        clearComposer();
        await loadIdeasFeed();
    } catch (error) {
        console.error('Save idea failed:', error);
        showToast('Unable to save the idea right now.', 'error');
    } finally {
        setSaveBusy(false);
    }
}

function setSaveBusy(isBusy) {
    const button = document.getElementById('saveBtn');
    if (!button) return;
    if (isBusy) {
        button.dataset.label = button.textContent;
        button.textContent = 'Saving...';
        button.disabled = true;
        return;
    }
    button.textContent = button.dataset.label || 'Publish Idea';
    button.disabled = false;
}

async function editIdea(noteId) {
    try {
        const note = await window.SupabaseClient.notes.getOne(noteId);
        currentNoteId = note.id;
        document.getElementById('noteTitle').value = note.title || '';
        document.getElementById('noteContent').value = note.content || '';
        document.getElementById('noteMarket').value = note.market || 'General';
        document.getElementById('noteTags').value = (note.tags || []).join(', ');
        document.getElementById('notePublicToggle').checked = Boolean(note.is_public);
        document.getElementById('notePinToggle').checked = Boolean(note.is_pinned);
        document.getElementById('composerTitle').textContent = 'Edit Idea';
        document.getElementById('composerStatus').textContent = 'You are editing an existing idea. Saving keeps the public link stable.';
        document.getElementById('autoSaveStatus').textContent = 'Editing';
        document.getElementById('autoSaveStatus').className = 'status-badge warning';
        document.getElementById('composerCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('noteTitle')?.focus();
    } catch (error) {
        console.error('Edit idea failed:', error);
        showToast('Unable to load that idea into the composer.', 'error');
    }
}

function clearComposer() {
    currentNoteId = null;
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteMarket').value = 'General';
    document.getElementById('noteTags').value = '';
    document.getElementById('notePublicToggle').checked = false;
    document.getElementById('notePinToggle').checked = false;
    document.getElementById('composerTitle').textContent = 'Create Idea';
    document.getElementById('composerStatus').textContent = 'Create a public idea or save a private draft. Sharing is available from the full article page.';
    document.getElementById('autoSaveStatus').textContent = 'Ready to publish';
    document.getElementById('autoSaveStatus').className = 'status-badge success';
    if (isPreviewMode) {
        togglePreview();
    }
}

async function togglePin(noteId) {
    try {
        await window.SupabaseClient.notes.togglePin(noteId);
        await loadIdeasFeed();
    } catch (error) {
        console.error('Toggle pin failed:', error);
        showToast('Unable to update pin state.', 'error');
    }
}

async function toggleFavorite(noteId) {
    try {
        await window.SupabaseClient.notes.toggleFavorite(noteId);
        await loadIdeasFeed();
    } catch (error) {
        console.error('Toggle favorite failed:', error);
        showToast('Unable to update favorite state.', 'error');
    }
}

async function deleteIdea(noteId) {
    if (!window.confirm('Delete this idea permanently?')) {
        return;
    }

    try {
        await window.SupabaseClient.notes.delete(noteId);
        if (String(currentNoteId) === String(noteId)) {
            clearComposer();
        }
        showToast('Idea deleted.', 'success');
        await loadIdeasFeed();
    } catch (error) {
        console.error('Delete idea failed:', error);
        showToast('Unable to delete the idea.', 'error');
    }
}

async function shareIdea(noteId, isPublic, shareId) {
    if (isPublic && shareId) {
        const shareUrl = `${window.location.origin}/note-view.html?share=${shareId}`;
        await copyToClipboard(shareUrl);
        showToast('Public share link copied.', 'success');
        return;
    }

    window.location.href = `note-detail.html?id=${noteId}#share`;
}

function togglePreview() {
    const textarea = document.getElementById('noteContent');
    const preview = document.getElementById('notePreview');
    const button = document.getElementById('previewBtn');
    isPreviewMode = !isPreviewMode;

    if (isPreviewMode) {
        updatePreview();
        textarea.style.display = 'none';
        preview.style.display = 'block';
        button.textContent = 'Edit';
        return;
    }

    textarea.style.display = 'block';
    preview.style.display = 'none';
    button.textContent = 'Preview';
}

async function updatePreview() {
    const preview = document.getElementById('notePreview');
    const content = document.getElementById('noteContent').value || '';
    if (window.MarkdownRenderer) {
        preview.innerHTML = await window.MarkdownRenderer.renderSafe(content);
        return;
    }
    preview.textContent = content;
}

function applyMarkdownAction(action) {
    const textarea = document.getElementById('noteContent');
    if (!textarea) return;

    const actions = {
        bold: { prefix: '**', suffix: '**', placeholder: 'bold thesis' },
        italic: { prefix: '*', suffix: '*', placeholder: 'italics' },
        code: { prefix: '`', suffix: '`', placeholder: 'price level' },
        link: { prefix: '[', suffix: '](https://)', placeholder: 'reference link' },
        heading: { prefix: '## ', suffix: '', placeholder: 'Key thesis' },
        list: { prefix: '- ', suffix: '', placeholder: 'bullet point' },
        quote: { prefix: '> ', suffix: '', placeholder: 'quote or takeaway' }
    };

    const config = actions[action];
    if (!config) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || config.placeholder;
    textarea.value = `${textarea.value.slice(0, start)}${config.prefix}${selected}${config.suffix}${textarea.value.slice(end)}`;
    textarea.focus();
    textarea.setSelectionRange(start + config.prefix.length, start + config.prefix.length + selected.length);

    if (isPreviewMode) {
        updatePreview();
    }
}

function filterByTag(tag) {
    document.getElementById('searchInput').value = tag;
    currentFilters.search = tag;
    loadIdeasFeed();
}

function renderFeedMessage(message) {
    document.getElementById('ideasFeed').innerHTML = `<div class="ideas-empty">${escapeHtml(message)}</div>`;
}

function highlightSearch(value, query) {
    if (!query) return value;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return value.replace(regex, '<span class="search-highlight">$1</span>');
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMarketClass(market) {
    if (market === 'Crypto') return 'success';
    if (market === 'CN A-Shares') return 'warning';
    if (market === 'US Equities') return 'info';
    return 'secondary';
}

function formatDate(value) {
    const date = new Date(value);
    const diff = Date.now() - date.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), wait);
    };
}

function showToast(message, type = 'info') {
    if (window.showToast?.[type]) {
        window.showToast[type](message);
        return;
    }

    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
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

window.editIdea = editIdea;
window.togglePin = togglePin;
window.toggleFavorite = toggleFavorite;
window.deleteIdea = deleteIdea;
window.shareIdea = shareIdea;
window.filterByTag = filterByTag;
