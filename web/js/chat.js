// ========================================
// StockandCrypto - Community Chat Logic
// Supabase Realtime Integration
// ========================================

let currentUser = null;
let currentBoard = null;
let subscription = null;

document.addEventListener('DOMContentLoaded', function() {
  initializeChat();
});

async function initializeChat() {
  try {
    // Initialize Supabase
    await SupabaseClient.init();
    
    // Check auth state
    currentUser = await SupabaseClient.auth.getCurrentUser();
    
    updateAuthUI();
    
    // Load available boards
    await loadBoards();
    
    // Setup event listeners
    setupEventListeners();
    
  } catch (error) {
    console.error('Init error:', error);
    showToast('Failed to initialize chat', 'error');
  }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

async function loadBoards() {
  try {
    const boards = await SupabaseClient.chat.getBoards();
    renderBoards(boards);
  } catch (error) {
    console.error('Load boards error:', error);
    // Show default boards as fallback
    renderDefaultBoards();
  }
}

function renderDefaultBoards() {
  const defaultBoards = [
    { id: 'crypto-main', name: 'Crypto General', topic: 'All things cryptocurrency', members: 0 },
    { id: 'btc', name: 'Bitcoin', topic: 'BTC price analysis and discussion', members: 0 },
    { id: 'eth', name: 'Ethereum', topic: 'ETH and DeFi ecosystem', members: 0 },
    { id: 'cn-equity', name: 'A-Shares', topic: 'Chinese stock market', members: 0 },
    { id: 'us-equity', name: 'US Stocks', topic: 'US equity markets', members: 0 },
    { id: 'trading', name: 'Trading Strategies', topic: 'Share your strategies', members: 0 }
  ];
  renderBoards(defaultBoards);
}

function renderBoards(boards) {
  const container = document.getElementById('boardsList');
  if (!container) return;
  
  if (!boards || boards.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 1rem; color: var(--text-muted);">No channels available</div>';
    return;
  }
  
  container.innerHTML = boards.map(board => `
    <div class="board-item" data-board-id="${board.id}" onclick="selectBoard('${board.id}', '${escapeHtml(board.name)}', '${escapeHtml(board.topic || '')}')">
      <div class="board-item-name">${escapeHtml(board.name)}</div>
      <div class="board-item-topic">${escapeHtml(board.topic || 'General discussion')}</div>
      <div class="board-item-members">${board.members || 0} members</div>
    </div>
  `).join('');
}

async function selectBoard(boardId, boardName, boardTopic) {
  // Update UI
  document.querySelectorAll('.board-item').forEach(el => el.classList.remove('active'));
  const selectedEl = document.querySelector(`[data-board-id="${boardId}"]`);
  if (selectedEl) selectedEl.classList.add('active');
  
  document.getElementById('currentBoardName').textContent = boardName;
  document.getElementById('currentBoardTopic').textContent = boardTopic || 'General discussion';
  
  currentBoard = { id: boardId, name: boardName, topic: boardTopic };
  
  // Check if user can access
  if (!currentUser) {
    showAuthRequired();
    return;
  }
  
  // Show input area
  document.getElementById('inputArea').style.display = 'flex';
  document.getElementById('joinBtn').style.display = 'none';
  
  // Unsubscribe from previous board
  if (subscription) {
    SupabaseClient.chat.unsubscribe(subscription);
  }
  
  // Load messages
  await loadMessages(boardId);
  
  // Subscribe to new messages
  subscription = SupabaseClient.chat.subscribe(boardId, (message) => {
    appendMessage(message);
  });
}

function showAuthRequired() {
  const container = document.getElementById('messagesContainer');
  container.innerHTML = `
    <div class="empty-chat">
      <h3>🔐 Sign in to Chat</h3>
      <p style="margin-bottom: 1rem;">You need to be signed in to participate in discussions</p>
      <a href="login.html" class="btn btn-primary">Sign In</a>
    </div>
  `;
  document.getElementById('inputArea').style.display = 'none';
  document.getElementById('joinBtn').style.display = 'inline-flex';
}

async function loadMessages(boardId) {
  try {
    const messages = await SupabaseClient.chat.getMessages(boardId, 100);
    renderMessages(messages || []);
  } catch (error) {
    console.error('Load messages error:', error);
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '<div class="empty-chat"><h3>Start the conversation</h3><p>Be the first to send a message!</p></div>';
  }
}

function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  
  if (!messages || messages.length === 0) {
    container.innerHTML = '<div class="empty-chat"><h3>Start the conversation</h3><p>Be the first to send a message!</p></div>';
    return;
  }
  
  container.innerHTML = messages.map(msg => formatMessage(msg)).join('');
  
  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function formatMessage(msg) {
  const isOwn = currentUser && msg.user_id === currentUser.id;
  const username = msg.users?.username || msg.username || 'Anonymous';
  const avatar = username.charAt(0).toUpperCase();
  const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  return `
    <div class="message ${isOwn ? 'own' : ''}">
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-header">
          <span class="message-username">${escapeHtml(username)}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${escapeHtml(msg.content)}</div>
      </div>
    </div>
  `;
}

function appendMessage(message) {
  const container = document.getElementById('messagesContainer');
  
  // Remove empty state if present
  const emptyState = container.querySelector('.empty-chat');
  if (emptyState) {
    emptyState.remove();
  }
  
  const msgHtml = formatMessage(message);
  container.insertAdjacentHTML('beforeend', msgHtml);
  container.scrollTop = container.scrollHeight;
}

function setupEventListeners() {
  // Send button
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
  
  // Enter key
  const input = document.getElementById('messageInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await SupabaseClient.auth.signOut();
        window.location.href = 'login.html';
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (!content || !currentBoard || !currentUser) return;
  
  input.value = '';
  
  try {
    await SupabaseClient.chat.send(currentBoard.id, content);
  } catch (error) {
    console.error('Send error:', error);
    showToast('Failed to send message', 'error');
    input.value = content; // Restore message
  }
}

// Helper functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 10000;
    background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--primary-accent)'};
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
