/**
 * Supabase Client for StockandCrypto
 * Handles: Authentication, Notes, Chat (Realtime)
 */

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
    console.log('✅ Supabase initialized');
    window.SupabaseClient.supabase = supabase;
    return supabase;
  } catch (e) {
    console.error('❌ Supabase init failed:', e);
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

// ==================== NOTES ====================

async function getNotes(options = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  let query = supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (options.market) query = query.eq('market', options.market);
  if (options.tag) query = query.contains('tags', [options.tag]);
  if (options.limit) query = query.limit(options.limit);
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function getNote(noteId) {
  const { data, error } = await supabase.from('notes').select('*').eq('id', noteId).single();
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
      tags: note.tags || []
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

// ==================== CHAT ====================

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

async function getMessages(boardId, limit = 50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*, users(username, avatar_url)')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function sendMessage(boardId, content) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ board_id: boardId, user_id: user.id, content: content })
    .select()
    .single();
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
    }, (payload) => {
      onMessage(payload.new);
    })
    .subscribe();
}

function unsubscribe(subscription) {
  if (subscription) {
    supabase.removeChannel(subscription);
  }
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
    delete: deleteNote
  },
  chat: {
    getBoards: getChatBoards,
    getMyBoards,
    join: joinBoard,
    leave: leaveBoard,
    getMessages,
    send: sendMessage,
    subscribe: subscribeToMessages,
    unsubscribe
  },
  likes: {
    toggle: toggleLike,
    getCount: getLikeCount
  }
};

console.log('✅ SupabaseClient module loaded');
