const TOKEN_KEY = 'shudong_counselor_token';

const loginScreen = document.getElementById('loginScreen');
const adminApp = document.getElementById('adminApp');
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const messageList = document.getElementById('messageList');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const pendingCount = document.getElementById('pendingCount');

let pollTimer = null;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  adminApp.classList.add('hidden');
  if (pollTimer) clearInterval(pollTimer);
}

function showAdmin() {
  loginScreen.classList.add('hidden');
  adminApp.classList.remove('hidden');
  loadConversations();
  startPolling();
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function lastMessage(conversation) {
  const msgs = conversation.messages;
  return msgs.length ? msgs[msgs.length - 1] : null;
}

function needsReply(conversation) {
  const last = lastMessage(conversation);
  return !last || last.role === 'user';
}

function renderBubble(msg) {
  const isUser = msg.role === 'user';
  const emotion = msg.emotionTag
    ? `<span class="bubble-emotion">${escapeHtml(msg.emotionTag)}</span>`
    : '';
  return `
    <div class="admin-bubble ${isUser ? 'user' : 'counselor'}">
      <div class="admin-bubble-inner">
        ${emotion}
        <p>${escapeHtml(msg.content)}</p>
        <span class="bubble-time">${formatTime(msg.createdAt)}</span>
      </div>
    </div>
  `;
}

function renderConversation(conv) {
  const card = document.createElement('article');
  card.className = 'message-card';
  card.dataset.id = conv.id;
  const pending = needsReply(conv);
  const bubbles = conv.messages.map(renderBubble).join('');

  card.innerHTML = `
    <div class="message-meta">
      <div>
        <span class="conv-code">#${escapeHtml(conv.queryCode)}</span>
        <span class="message-time">${formatTime(conv.updatedAt)}</span>
      </div>
      <span class="status-badge ${pending ? 'pending' : 'replied'}">
        ${pending ? '待回复' : '已回复'}
      </span>
    </div>
    <div class="admin-chat-history">${bubbles || '<p class="empty-chat">暂无消息</p>'}</div>
    <form class="reply-form" data-id="${conv.id}">
      <textarea placeholder="写下温暖的回复..." rows="2"></textarea>
      <div class="reply-actions">
        <button type="submit" class="reply-btn">发送回复</button>
      </div>
    </form>
  `;

  const form = card.querySelector('.reply-form');
  const history = card.querySelector('.admin-chat-history');
  history.scrollTop = history.scrollHeight;
  form.addEventListener('submit', (e) => handleReply(e, conv.id));

  return card;
}

async function handleReply(e, id) {
  e.preventDefault();
  const form = e.target;
  const textarea = form.querySelector('textarea');
  const btn = form.querySelector('.reply-btn');
  const content = textarea.value.trim();

  if (!content) {
    showAdminToast('请填写回复内容');
    return;
  }

  btn.disabled = true;
  btn.textContent = '发送中...';

  try {
    const res = await fetch(`/api/chat/${id}/reply`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content })
    });
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      clearToken();
      showLogin();
      showLoginError('登录已过期，请重新登录');
      return;
    }

    if (!res.ok) throw new Error(data.error || data.message || '回复失败');
    textarea.value = '';
    await loadConversations();
  } catch (err) {
    showAdminToast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '发送回复';
  }
}

function showAdminToast(text) {
  let el = document.getElementById('adminToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'adminToast';
    el.className = 'admin-toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function updateStats(conversations) {
  const pending = conversations.filter(needsReply).length;
  totalCount.textContent = `共 ${conversations.length} 个会话`;
  pendingCount.textContent = `待回复 ${pending} 个`;
}

async function loadConversations() {
  if (!getToken()) return;

  loading.classList.remove('hidden');
  emptyState.classList.add('hidden');
  messageList.innerHTML = '';

  try {
    const res = await fetch('/api/chat', { headers: authHeaders() });
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      clearToken();
      showLogin();
      showLoginError(res.status === 403 ? '无权访问，仅咨询师可登录' : '登录已过期，请重新登录');
      return;
    }

    if (!res.ok) throw new Error(data.error || '加载失败');

    updateStats(data);

    if (data.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      data.forEach((conv) => {
        messageList.appendChild(renderConversation(conv));
      });
    }
  } catch {
    messageList.innerHTML = '<p style="text-align:center;color:#9a5a50;">加载失败，请刷新页面重试</p>';
  } finally {
    loading.classList.add('hidden');
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(loadConversations, 5000);
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const username = loginUsername.value.trim();
  const password = loginPassword.value;

  try {
    const res = await fetch('/api/auth/counselor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showLoginError(data.error || data.message || '登录失败');
      return;
    }

    setToken(data.token);
    loginPassword.value = '';
    showAdmin();
  } catch {
    showLoginError('网络错误，请稍后再试');
  }
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  showLogin();
});

if (getToken()) {
  showAdmin();
} else {
  showLogin();
}
