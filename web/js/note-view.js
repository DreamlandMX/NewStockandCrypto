document.addEventListener('DOMContentLoaded', async () => {
    try {
        await waitForSupabaseClient();
        await initializeSharedView();
    } catch (error) {
        console.error('Shared idea page failed:', error);
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

async function initializeSharedView() {
    await window.SupabaseClient.init();
    const shareId = new URLSearchParams(window.location.search).get('share');
    if (!shareId) {
        showError();
        return;
    }

    try {
        const payload = await window.SupabaseClient.communityNotes.getSharedNote(shareId);
        const note = payload.note || null;
        const related = payload.related || [];

        if (!note) {
            showError();
            return;
        }

        await renderSharedNote(note, related);
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('publicState').style.display = 'block';
    } catch (error) {
        console.error('Failed to load shared note:', error);
        showError();
    }
}

async function renderSharedNote(note, relatedIdeas) {
    document.getElementById('noteTitle').textContent = note.title || 'Untitled Idea';
    document.getElementById('noteMarket').textContent = note.market || 'General';
    document.getElementById('noteMarket').className = `status-badge ${getMarketClass(note.market)}`;
    document.getElementById('noteAuthor').textContent = `By ${note.author?.display_name || 'Community Member'}`;
    document.getElementById('noteDate').textContent = `Published ${formatDate(note.created_at)}`;
    document.getElementById('noteReadTime').textContent = `${note.stats?.read_minutes || estimateReadMinutes(note.content)} min read`;
    document.getElementById('tagList').innerHTML = (note.tags || []).length
        ? note.tags.map((tag) => `<span class="status-badge info">${escapeHtml(tag)}</span>`).join('')
        : '<span class="status-badge secondary">No tags</span>';

    const html = window.MarkdownRenderer
        ? await window.MarkdownRenderer.renderSafe(note.content || '')
        : escapeHtml(note.content || '');
    document.getElementById('noteBody').innerHTML = html;

    const related = document.getElementById('relatedIdeas');
    related.innerHTML = relatedIdeas.length
        ? relatedIdeas
            .filter((idea) => idea.is_public)
            .map((idea) => `
                <a class="related-card" href="note-view.html?share=${idea.share_id}">
                    <span class="status-badge ${getMarketClass(idea.market)}">${escapeHtml(idea.market || 'General')}</span>
                    <h4>${escapeHtml(idea.title || 'Untitled Idea')}</h4>
                    <p style="margin:0; color: var(--text-secondary); font-size: 0.86rem; line-height: 1.55;">${escapeHtml(idea.excerpt || '')}</p>
                </a>
            `).join('')
        : '<span style="color: var(--text-secondary);">No related public ideas yet.</span>';
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
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
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
