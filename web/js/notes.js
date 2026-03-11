// ========================================
// StockandCrypto - Notes Page Logic
// Supabase Integration
// ========================================

let currentUser = null;
let autoSaveTimer = null;
let currentNoteId = null;

// Wait for SupabaseClient to be available
function waitForSupabaseClient(timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (typeof window.SupabaseClient !== 'undefined') {
            resolve();
            return;
        }
        const startTime = Date.now();
        const interval = setInterval(() => {
            if (typeof window.SupabaseClient !== 'undefined') {
                clearInterval(interval);
                resolve();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error('SupabaseClient load timeout'));
            }
        }, 100);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await waitForSupabaseClient();
        await initializeNotesPage();
    } catch (error) {
        console.error('Failed to initialize:', error);
        showToast('Failed to load. Please refresh the page.', 'error');
    }
});

async function initializeNotesPage() {
    try {
        // Initialize Supabase
        await window.SupabaseClient.init();
        
        // Check auth state
        const user = await window.SupabaseClient.auth.getCurrentUser();
        currentUser = user;
        
        if (!currentUser) {
            showAuthRequired();
            return;
        }
        
        // Load notes
        await loadNotes();
        
        // Setup editor
        initializeNoteEditor();
        initializeAutoSave();
        
        // Update user info
        updateUserInfo();
    } catch (error) {
        console.error('Init error:', error);
        showToast('Failed to initialize. Please refresh.', 'error');
    }
}

function showAuthRequired() {
    const main = document.querySelector('main');
    main.innerHTML = `
        <div class="container" style="padding-top: 100px; text-align: center;">
            <div class="card" style="max-width: 400px; margin: 0 auto;">
                <div class="card-body">
                    <h2 style="margin-bottom: 1rem;">Sign in Required</h2>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">
                        Please sign in to access your notes and join the community chat.
                    </p>
                    <a href="login.html" class="btn btn-primary" style="width: 100%; margin-bottom: 0.5rem;">
                        Sign In
                    </a>
                    <a href="register.html" class="btn btn-secondary" style="width: 100%;">
                        Create Account
                    </a>
                </div>
            </div>
        </div>
    `;
}

async function loadNotes(filter = {}) {
    try {
        const notes = await window.SupabaseClient.notes.get({ ...filter, limit: 50 });
        updateNotesList(notes);
        updateStats(notes);
    } catch (error) {
        console.error('Load notes error:', error);
        showToast('Failed to load notes', 'error');
    }
}

function updateNotesList(notes) {
    const tbody = document.querySelector('.data-table tbody');
    if (!tbody) return;
    
    if (!notes || notes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    No notes yet. Create your first note!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = notes.map(note => `
        <tr data-note-id="${note.id}">
            <td>
                <strong>${escapeHtml(note.title)}</strong>
                ${note.updated_at !== note.created_at ? '<span class="status-badge info" style="font-size: 0.65rem; margin-left: 0.5rem;">edited</span>' : ''}
            </td>
            <td>
                <span class="status-badge">${escapeHtml(note.market || 'General')}</span>
            </td>
            <td>
                ${(note.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join(' ')}
            </td>
            <td style="color: var(--text-muted); font-size: 0.85rem;">
                ${formatDate(note.created_at)}
            </td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editNote('${note.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteNote('${note.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function updateStats(notes) {
    const totalEl = document.querySelector('[data-stat="total"]');
    const weekEl = document.querySelector('[data-stat="week"]');
    const cryptoEl = document.querySelector('[data-stat="crypto"]');
    const equityEl = document.querySelector('[data-stat="equity"]');
    
    if (totalEl) totalEl.textContent = notes.length;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = notes.filter(n => new Date(n.created_at) > weekAgo).length;
    if (weekEl) weekEl.textContent = `+${thisWeek}`;
    
    const cryptoNotes = notes.filter(n => n.market === 'Crypto').length;
    if (cryptoEl) cryptoEl.textContent = cryptoNotes;
    
    const equityNotes = notes.filter(n => n.market === 'CN A-Shares' || n.market === 'US Equities').length;
    if (equityEl) equityEl.textContent = equityNotes;
}

function initializeNoteEditor() {
    const titleInput = document.querySelector('input[placeholder*="title"]');
    const contentInput = document.querySelector('textarea[placeholder*="Write"]');
    const marketSelect = document.querySelector('select');
    const tagsInput = document.querySelector('input[placeholder*="Tags"]');
    const saveBtn = document.querySelector('.btn-primary');
    const clearBtn = document.querySelector('.btn-secondary');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveNote);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearEditor);
    }
}

function initializeAutoSave() {
    const contentInput = document.querySelector('textarea[placeholder*="Write"]');
    if (contentInput) {
        contentInput.addEventListener('input', () => {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => {
                autoSave();
            }, 2000);
        });
    }
}

async function autoSave() {
    const title = document.querySelector('input[placeholder*="title"]')?.value?.trim();
    const content = document.querySelector('textarea[placeholder*="Write"]')?.value?.trim();
    
    if (!title || !content) return;
    
    try {
        if (currentNoteId) {
            await window.SupabaseClient.notes.update(currentNoteId, { title, content });
        } else {
            const note = await window.SupabaseClient.notes.create({ title, content });
            currentNoteId = note.id;
        }
        showToast('Auto-saved', 'success');
    } catch (error) {
        console.error('Auto-save error:', error);
    }
}

async function saveNote() {
    const title = document.querySelector('input[placeholder*="title"]')?.value?.trim();
    const content = document.querySelector('textarea[placeholder*="Write"]')?.value?.trim();
    const market = document.querySelector('select')?.value || 'General';
    const tagsStr = document.querySelector('input[placeholder*="Tags"]')?.value || '';
    const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
    
    if (!title) {
        showToast('Please enter a title', 'error');
        return;
    }
    
    try {
        if (currentNoteId) {
            await window.SupabaseClient.notes.update(currentNoteId, { title, content, market, tags });
            showToast('Note updated!', 'success');
        } else {
            await window.SupabaseClient.notes.create({ title, content, market, tags });
            showToast('Note saved!', 'success');
        }
        
        clearEditor();
        await loadNotes();
    } catch (error) {
        console.error('Save error:', error);
        showToast('Failed to save note', 'error');
    }
}

function clearEditor() {
    const titleInput = document.querySelector('input[placeholder*="title"]');
    const contentInput = document.querySelector('textarea[placeholder*="Write"]');
    const marketSelect = document.querySelector('select');
    const tagsInput = document.querySelector('input[placeholder*="Tags"]');
    
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (marketSelect) marketSelect.value = 'General';
    if (tagsInput) tagsInput.value = '';
    
    currentNoteId = null;
}

async function editNote(noteId) {
    try {
        const note = await window.SupabaseClient.notes.getOne(noteId);
        
        const titleInput = document.querySelector('input[placeholder*="title"]');
        const contentInput = document.querySelector('textarea[placeholder*="Write"]');
        const marketSelect = document.querySelector('select');
        const tagsInput = document.querySelector('input[placeholder*="Tags"]');
        
        if (titleInput) titleInput.value = note.title;
        if (contentInput) contentInput.value = note.content || '';
        if (marketSelect) marketSelect.value = note.market || 'General';
        if (tagsInput) tagsInput.value = (note.tags || []).join(', ');
        
        currentNoteId = noteId;
        showToast('Editing note...', 'info');
    } catch (error) {
        console.error('Edit error:', error);
        showToast('Failed to load note', 'error');
    }
}

async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
        await window.SupabaseClient.notes.delete(noteId);
        showToast('Note deleted', 'success');
        await loadNotes();
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Failed to delete note', 'error');
    }
}

function updateUserInfo() {
    const userInfoEl = document.querySelector('.user-info');
    if (userInfoEl && currentUser) {
        userInfoEl.textContent = `Hi, ${currentUser.email}`;
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--primary-accent)'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        animation: fadeIn 0.3s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
