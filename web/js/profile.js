// ========================================
// StockandCrypto - User Profile Logic
// Profile management, DM list, Settings
// ========================================

let currentUser = null;
let userProfile = null;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        await waitForSupabaseClient();
        await initializeProfile();
    } catch (error) {
        console.error('Failed to initialize:', error);
        window.location.href = 'login.html';
    }
});

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

async function initializeProfile() {
    // Initialize Supabase
    await window.SupabaseClient.init();

    // Check auth
    const authState = window.Auth?.ready
        ? await window.Auth.ready()
        : null;
    currentUser = authState?.user || await window.SupabaseClient.auth.getCurrentUser();
    if (!currentUser) {
        const redirectTarget = window.location.pathname.split('/').pop() || 'profile.html';
        const reason = authState?.legacyMismatch ? 'legacy-session' : 'signin-required';
        window.location.href = `login.html?reason=${encodeURIComponent(reason)}&redirect=${encodeURIComponent(redirectTarget)}`;
        return;
    }

    // Load profile
    await loadProfile();

    // Load stats
    await loadStats();

    // Setup event listeners
    setupEventListeners();

    // Load DMs
    await loadDirectMessages();
}

async function loadProfile() {
    try {
        userProfile = await window.SupabaseClient.profile.get(currentUser.id);

        if (userProfile) {
            displayProfile();
        } else {
            // Create profile if not exists
            userProfile = await window.SupabaseClient.profile.update({
                username: currentUser.email.split('@')[0]
            });
            displayProfile();
        }
    } catch (error) {
        console.error('Load profile error:', error);
        // Show default values
        document.getElementById('displayUsername').textContent = currentUser.email.split('@')[0];
        document.getElementById('displayEmail').textContent = currentUser.email;
        document.getElementById('avatarLetter').textContent = currentUser.email.charAt(0).toUpperCase();
    }
}

function displayProfile() {
    const username = userProfile?.username || currentUser.email.split('@')[0];
    const bio = userProfile?.bio || 'No bio yet...';
    const avatarUrl = userProfile?.avatar_url;

    document.getElementById('displayUsername').textContent = username;
    document.getElementById('displayEmail').textContent = currentUser.email;
    document.getElementById('displayBio').textContent = bio;
    document.getElementById('avatarLetter').textContent = username.charAt(0).toUpperCase();

    // Set avatar image if exists
    if (avatarUrl) {
        document.getElementById('profileAvatar').innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
    }

    // Edit form values
    document.getElementById('editUsername').value = userProfile?.username || '';
    document.getElementById('editBio').value = userProfile?.bio || '';
    document.getElementById('editWebsite').value = userProfile?.website || '';
    document.getElementById('editLocation').value = userProfile?.location || '';
}

async function loadStats() {
    try {
        // Get notes count
        const notes = await window.SupabaseClient.notes.get({ limit: 1000 });
        document.getElementById('notesCount').textContent = notes?.length || 0;

        // Get messages count (approximate)
        const { count } = await window.SupabaseClient.supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id);
        document.getElementById('messagesCount').textContent = count || 0;

        // Member since
        const created = new Date(currentUser.created_at);
        document.getElementById('memberSince').textContent = created.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short'
        });

    } catch (error) {
        console.error('Load stats error:', error);
    }
}

async function loadDirectMessages() {
    const container = document.getElementById('dmList');
    
    try {
        // Get unique conversations
        const { data: sentMessages } = await window.SupabaseClient.supabase
            .from('direct_messages')
            .select('receiver_id, users:receiver_id(username, avatar_url), content, created_at, read_at')
            .eq('sender_id', currentUser.id)
            .order('created_at', { ascending: false });

        const { data: receivedMessages } = await window.SupabaseClient.supabase
            .from('direct_messages')
            .select('sender_id, users:sender_id(username, avatar_url), content, created_at, read_at')
            .eq('receiver_id', currentUser.id)
            .order('created_at', { ascending: false });

        // Merge and dedupe conversations
        const conversations = new Map();

        (sentMessages || []).forEach(msg => {
            if (!conversations.has(msg.receiver_id)) {
                conversations.set(msg.receiver_id, {
                    userId: msg.receiver_id,
                    username: msg.users?.username || 'User',
                    avatarUrl: msg.users?.avatar_url,
                    lastMessage: msg.content,
                    lastTime: msg.created_at,
                    unread: 0
                });
            }
        });

        (receivedMessages || []).forEach(msg => {
            const existing = conversations.get(msg.sender_id);
            if (existing) {
                if (new Date(msg.created_at) > new Date(existing.lastTime)) {
                    existing.lastMessage = msg.content;
                    existing.lastTime = msg.created_at;
                }
                if (!msg.read_at) {
                    existing.unread++;
                }
            } else {
                conversations.set(msg.sender_id, {
                    userId: msg.sender_id,
                    username: msg.users?.username || 'User',
                    avatarUrl: msg.users?.avatar_url,
                    lastMessage: msg.content,
                    lastTime: msg.created_at,
                    unread: msg.read_at ? 0 : 1
                });
            }
        });

        if (conversations.size === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    <p>No conversations yet</p>
                    <p style="font-size: 0.85rem;">Start a conversation from the chat!</p>
                </div>
            `;
            return;
        }

        const html = Array.from(conversations.values())
            .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime))
            .map(conv => `
                <div class="dm-item" onclick="openDM('${conv.userId}')">
                    <div class="dm-avatar">
                        ${conv.avatarUrl 
                            ? `<img src="${conv.avatarUrl}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` 
                            : conv.username.charAt(0).toUpperCase()
                        }
                    </div>
                    <div class="dm-preview">
                        <div class="dm-preview-header">
                            <span class="dm-username">${escapeHtml(conv.username)}</span>
                            <span class="dm-time">${formatTime(conv.lastTime)}</span>
                        </div>
                        <div class="dm-message">${escapeHtml(conv.lastMessage)}</div>
                    </div>
                    ${conv.unread > 0 ? `<span class="dm-unread">${conv.unread}</span>` : ''}
                </div>
            `).join('');

        container.innerHTML = html;

    } catch (error) {
        console.error('Load DMs error:', error);
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
                Failed to load conversations
            </div>
        `;
    }
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // Edit profile
    document.getElementById('editProfileBtn')?.addEventListener('click', () => {
        document.getElementById('viewMode').classList.add('hidden');
        document.getElementById('editMode').classList.add('active');
        document.getElementById('avatarUploadWrapper').style.display = 'block';
    });

    // Cancel edit
    document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
        document.getElementById('viewMode').classList.remove('hidden');
        document.getElementById('editMode').classList.remove('active');
        document.getElementById('avatarUploadWrapper').style.display = 'none';
    });

    // Save profile
    document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);

    // Avatar upload
    document.getElementById('avatarInput')?.addEventListener('change', handleAvatarUpload);

    // Online status
    document.getElementById('onlineStatus')?.addEventListener('change', async (e) => {
        try {
            await window.SupabaseClient.presence.update(e.target.value);
            showToast('Status updated', 'success');
        } catch (error) {
            console.error('Status update error:', error);
        }
    });

    // Browser notifications
    document.getElementById('browserNotifications')?.addEventListener('change', (e) => {
        if (e.target.checked) {
            requestNotificationPermission();
        }
    });

    // Delete account
    document.getElementById('deleteAccountBtn')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete your account? This cannot be undone.')) {
            if (confirm('This will permanently delete all your data. Are you absolutely sure?')) {
                try {
                    // In production, this would call a server function
                    showToast('Account deletion requested', 'info');
                    await window.SupabaseClient.auth.signOut();
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Delete account error:', error);
                }
            }
        }
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.profile-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
}

async function saveProfile() {
    const username = document.getElementById('editUsername').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    const website = document.getElementById('editWebsite').value.trim();
    const location = document.getElementById('editLocation').value.trim();

    if (!username) {
        showToast('Username is required', 'error');
        return;
    }

    try {
        await window.SupabaseClient.profile.update({
            username,
            bio,
            website,
            location
        });

        showToast('Profile updated!', 'success');

        // Reload profile
        await loadProfile();

        // Switch to view mode
        document.getElementById('viewMode').classList.remove('hidden');
        document.getElementById('editMode').classList.remove('active');
        document.getElementById('avatarUploadWrapper').style.display = 'none';

    } catch (error) {
        console.error('Save profile error:', error);
        showToast('Failed to save profile', 'error');
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('Please upload an image file', 'error');
        return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
        showToast('Image must be under 2MB', 'error');
        return;
    }

    try {
        showToast('Uploading...', 'info');
        
        const avatarUrl = await window.SupabaseClient.profile.uploadAvatar(file);
        
        document.getElementById('profileAvatar').innerHTML = `<img src="${avatarUrl}" alt="Avatar">`;
        showToast('Avatar updated!', 'success');

    } catch (error) {
        console.error('Avatar upload error:', error);
        showToast('Failed to upload avatar', 'error');
    }
}

function openDM(userId) {
    window.location.href = `dm.html?user=${userId}`;
}

function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showToast('Notifications enabled!', 'success');
            } else {
                showToast('Notifications blocked', 'error');
                document.getElementById('browserNotifications').checked = false;
            }
        });
    } else {
        showToast('Notifications not supported', 'error');
    }
}

function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Make functions globally available
window.openDM = openDM;

console.log('✅ Profile module loaded');
