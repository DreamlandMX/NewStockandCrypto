// ========================================
// StockandCrypto - Enhanced Supabase Client
// Extended API for Notes & Chat enhancements
// ========================================

const SUPABASE_URL = 'https://odvelrdzdbnbfjuqrbtl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sC7xCGB5GqtQwxV-zT35yQ_4vfRSF4p';

let supabase = null;

// Wait for Supabase SDK to load
function waitForSupabase(timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (typeof window.supabase !== 'undefined') {
            resolve(window.supabase);
            return;
        }
        const startTime = Date.now();
        const interval = setInterval(() => {
            if (typeof window.supabase !== 'undefined') {
                clearInterval(interval);
                resolve(window.supabase);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                reject(new Error('Supabase SDK load timeout'));
            }
        }, 100);
    });
}

// Initialize the client
async function initSupabase() {
    try {
        await waitForSupabase();
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase initialized');
        window.SupabaseClient.supabase = supabase;
        return supabase;
    } catch (e) {
        console.error('Supabase init failed:', e);
        throw e;
    }
}

// ==================== AUTH ====================

async function signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });
    if (error) throw error;
    return data;
}

async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}

// ==================== NOTES (Enhanced) ====================

async function getNotes(options = {}) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id);

    // Sorting
    if (options.sortBy) {
        const ascending = options.sortOrder !== 'desc';
        query = query.order(options.sortBy, { ascending });
    } else {
        query = query.order('is_pinned', { ascending: false });
        query = query.order('created_at', { ascending: false });
    }

    // Filters
    if (options.market) query = query.eq('market', options.market);
    if (options.tag) query = query.contains('tags', [options.tag]);
    if (options.is_pinned !== undefined) query = query.eq('is_pinned', options.is_pinned);
    if (options.is_favorite !== undefined) query = query.eq('is_favorite', options.is_favorite);
    if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`);
    }

    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

async function getNote(noteId) {
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
        .single();
    if (error) throw error;
    return data;
}

async function createNote(note) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('notes')
        .insert({
            user_id: user.id,
            title: note.title,
            content: note.content,
            market: note.market || 'General',
            tags: note.tags || [],
            is_pinned: note.is_pinned || false,
            is_favorite: note.is_favorite || false
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function updateNote(noteId, updates) {
    const { data, error } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function deleteNote(noteId) {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) throw error;
}

async function togglePin(noteId) {
    const { data: note } = await supabase.from('notes').select('is_pinned').eq('id', noteId).single();
    const newValue = !note.is_pinned;
    
    const { data, error } = await supabase
        .from('notes')
        .update({ is_pinned: newValue })
        .eq('id', noteId)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function toggleFavorite(noteId) {
    const { data: note } = await supabase.from('notes').select('is_favorite').eq('id', noteId).single();
    const newValue = !note.is_favorite;
    
    const { data, error } = await supabase
        .from('notes')
        .update({ is_favorite: newValue })
        .eq('id', noteId)
        .select()
        .single();
    
    if (error) throw error;
    return data;
}

async function getNoteVersions(noteId) {
    const { data, error } = await supabase
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) throw error;
    return data;
}

async function searchNotes(query) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// ==================== CHAT (Enhanced) ====================

async function getChatBoards() {
    const { data, error } = await supabase
        .from('chat_boards')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function getMyBoards() {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('chat_members')
        .select('board_id, role, joined_at, chat_boards(*)')
        .eq('user_id', user.id);

    if (error) throw error;
    return data;
}

async function joinBoard(boardId) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('chat_members')
        .insert({ board_id: boardId, user_id: user.id, role: 'member' })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function leaveBoard(boardId) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('chat_members')
        .delete()
        .eq('board_id', boardId)
        .eq('user_id', user.id);

    if (error) throw error;
}

async function getMessages(boardId, limit = 100) {
    const { data, error } = await supabase
        .from('chat_messages')
        .select('*, users(username, avatar_url), reply_to:chat_messages(id, content, users(username))')
        .eq('board_id', boardId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) throw error;
    return data;
}

async function sendMessage(boardId, content, options = {}) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    // Extract mentions from content
    const mentions = extractMentions(content);

    const { data, error } = await supabase
        .from('chat_messages')
        .insert({
            board_id: boardId,
            user_id: user.id,
            content: content,
            reply_to: options.replyTo || null,
            mentions: mentions.length > 0 ? mentions : null,
            attachment_url: options.attachmentUrl || null,
            attachment_type: options.attachmentType || null
        })
        .select()
        .single();

    if (error) throw error;

    // Send notifications to mentioned users
    if (mentions.length > 0) {
        await sendMentionNotifications(mentions, boardId, data.id);
    }

    return data;
}

async function editMessage(messageId, newContent) {
    const { data, error } = await supabase
        .from('chat_messages')
        .update({
            content: newContent,
            is_edited: true,
            edited_at: new Date().toISOString(),
            mentions: extractMentions(newContent)
        })
        .eq('id', messageId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function deleteMessage(messageId) {
    const { data, error } = await supabase
        .from('chat_messages')
        .update({
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            content: '[message deleted]'
        })
        .eq('id', messageId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function addReaction(messageId, emoji) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('message_reactions')
        .insert({
            message_id: messageId,
            user_id: user.id,
            emoji: emoji
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function removeReaction(messageId, emoji) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);

    if (error) throw error;
}

async function getMessageReactions(messageId) {
    const { data, error } = await supabase
        .from('message_reactions')
        .select('emoji, user_id, users(username)')
        .eq('message_id', messageId);

    if (error) throw error;
    return data;
}

function subscribeToMessages(boardId, onMessage) {
    return supabase
        .channel(`board:${boardId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `board_id=eq.${boardId}`
        }, (payload) => onMessage(payload.new))
        .subscribe();
}

function subscribeToReactions(boardId, onReaction) {
    return supabase
        .channel(`reactions:${boardId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'message_reactions'
        }, (payload) => onReaction(payload))
        .subscribe();
}

function unsubscribe(subscription) {
    if (subscription) {
        supabase.removeChannel(subscription);
    }
}

// ==================== DIRECT MESSAGES ====================

async function getDirectMessages(otherUserId, limit = 100) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) throw error;
    return data;
}

async function sendDirectMessage(receiverId, content, options = {}) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('direct_messages')
        .insert({
            sender_id: user.id,
            receiver_id: receiverId,
            content: content,
            attachment_url: options.attachmentUrl || null
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function markDirectMessageRead(messageId) {
    const { error } = await supabase
        .from('direct_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

    if (error) throw error;
}

// ==================== USER PROFILES ====================

async function getUserProfile(userId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

async function updateUserProfile(updates) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: user.id,
            ...updates,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function uploadAvatar(file) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

    // Update profile
    await updateUserProfile({ avatar_url: publicUrl });

    return publicUrl;
}

// ==================== PRESENCE ====================

async function updatePresence(status, channelId = null) {
    const user = await getCurrentUser();
    if (!user) return;

    await supabase
        .from('user_presence')
        .upsert({
            user_id: user.id,
            status: status,
            current_channel: channelId,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
}

async function setTypingStatus(channelId, isTyping) {
    const user = await getCurrentUser();
    if (!user) return;

    await supabase
        .from('user_presence')
        .update({
            typing_in: isTyping ? channelId : null,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
}

async function getOnlineUsers(channelId) {
    let query = supabase
        .from('user_presence')
        .select('user_id, status, last_seen, user_profiles(username, avatar_url)')
        .neq('status', 'offline');

    if (channelId) {
        query = query.eq('current_channel', channelId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

function subscribeToPresence(channelId, onPresence) {
    return supabase
        .channel(`presence:${channelId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'user_presence'
        }, (payload) => onPresence(payload))
        .subscribe();
}

// ==================== NOTIFICATIONS ====================

async function getNotifications(limit = 50) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return data;
}

async function markNotificationRead(notificationId) {
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

    if (error) throw error;
}

async function markAllNotificationsRead() {
    const user = await getCurrentUser();
    if (!user) return;

    await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
}

async function sendMentionNotifications(userIds, channelId, messageId) {
    const user = await getCurrentUser();
    if (!user) return;

    for (const mentionedId of userIds) {
        if (mentionedId === user.id) continue;

        await supabase.from('notifications').insert({
            user_id: mentionedId,
            type: 'mention',
            title: 'You were mentioned',
            content: `${user.email} mentioned you in a chat`,
            data: { channel_id: channelId, message_id: messageId }
        });
    }
}

function subscribeToNotifications(onNotification) {
    const user = getCurrentUser();

    return supabase
        .channel('notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications'
        }, (payload) => onNotification(payload.new))
        .subscribe();
}

// ==================== CUSTOM CHANNELS ====================

async function createChannel(channelData) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data: channel, error: channelError } = await supabase
        .from('custom_channels')
        .insert({
            name: channelData.name,
            description: channelData.description || '',
            topic: channelData.topic || '',
            created_by: user.id,
            is_public: channelData.isPublic !== false
        })
        .select()
        .single();

    if (channelError) throw channelError;

    // Add creator as owner
    await supabase
        .from('channel_members')
        .insert({
            channel_id: channel.id,
            user_id: user.id,
            role: 'owner'
        });

    return channel;
}

async function getCustomChannels() {
    const { data, error } = await supabase
        .from('custom_channels')
        .select('*, channel_members(count)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

// ==================== FILE UPLOADS ====================

async function uploadAttachment(file, type = 'image') {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(fileName);

    return {
        url: publicUrl,
        type: type,
        name: file.name
    };
}

// ==================== HELPERS ====================

function extractMentions(content) {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
    const mentions = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
        if (!mentions.includes(match[1])) {
            mentions.push(match[1]);
        }
    }

    return mentions;
}

// ==================== LIKES ====================

async function toggleLike(noteId) {
    const user = await getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data: existing } = await supabase
        .from('likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('note_id', noteId)
        .single();

    if (existing) {
        await supabase.from('likes').delete().eq('id', existing.id);
        return { liked: false };
    } else {
        await supabase.from('likes').insert({ user_id: user.id, note_id: noteId });
        return { liked: true };
    }
}

async function getLikeCount(noteId) {
    const { count, error } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('note_id', noteId);

    if (error) throw error;
    return count;
}

// ==================== EXPORT ====================

window.SupabaseClient = {
    init: initSupabase,
    supabase: supabase,

    auth: {
        signUp,
        signIn,
        signOut,
        getCurrentUser,
        onAuthStateChange
    },

    notes: {
        get: getNotes,
        getOne: getNote,
        create: createNote,
        update: updateNote,
        delete: deleteNote,
        togglePin,
        toggleFavorite,
        getVersions: getNoteVersions,
        search: searchNotes
    },

    chat: {
        getBoards: getChatBoards,
        getMyBoards,
        join: joinBoard,
        leave: leaveBoard,
        getMessages,
        send: sendMessage,
        edit: editMessage,
        delete: deleteMessage,
        addReaction,
        removeReaction,
        getReactions: getMessageReactions,
        subscribe: subscribeToMessages,
        subscribeReactions: subscribeToReactions,
        unsubscribe
    },

    dm: {
        get: getDirectMessages,
        send: sendDirectMessage,
        markRead: markDirectMessageRead
    },

    profile: {
        get: getUserProfile,
        update: updateUserProfile,
        uploadAvatar
    },

    presence: {
        update: updatePresence,
        setTyping: setTypingStatus,
        getOnline: getOnlineUsers,
        subscribe: subscribeToPresence
    },

    notifications: {
        get: getNotifications,
        markRead: markNotificationRead,
        markAllRead: markAllNotificationsRead,
        subscribe: subscribeToNotifications
    },

    channels: {
        create: createChannel,
        getPublic: getCustomChannels
    },

    files: {
        upload: uploadAttachment
    },

    likes: {
        toggle: toggleLike,
        getCount: getLikeCount
    }
};

console.log('Enhanced SupabaseClient module loaded');
