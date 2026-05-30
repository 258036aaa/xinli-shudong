const TOKEN_KEY = 'shudong_counselor_token';
const LOGIN_URL = '/admin-login';
const POLL_INTERVAL = 5000;

const logoutBtn = document.getElementById('logoutBtn');
const messageList = document.getElementById('messageList');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const pendingCount = document.getElementById('pendingCount');

let pollTimer = null;
const conversationFingerprints = new Map();

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
}

function redirectToLogin(message) {
  if (message) sessionStorage.setItem('admin_auth_msg', message);
  clearToken();
  window.location.href = LOGIN_URL;
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

function getConversationFingerprint(conv) {
  const msgIds = conv.messages.map((msg) => msg.id).join(',');
  return `${conv.updatedAt}|${msgIds}`;
}

function captureReplyDrafts() {
  const drafts = new Map();
  messageList.querySelectorAll('.reply-form').forEach((form) => {
    const textarea = form.querySelector('textarea');
    drafts.set(form.dataset.id, {
      value: textarea.value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
      focused: document.activeElement === textarea
    });
  });
  return drafts;
}

function restoreReplyDraft(form, draft) {
  if (!draft || !form) return;
  const textarea = form.querySelector('textarea');
  textarea.value = draft.value;
  if (draft.focused) {
    textarea.focus();
    textarea.setSelectionRange(draft.selectionStart, draft.selectionEnd);
  }
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

function renderChatHistory(conv) {
  return conv.messages.map(renderBubble).join('') || '<p class="empty-chat">暂无消息</p>';
}

function updateConversationMeta(card, conv) {
  const pending = needsReply(conv);
  card.querySelector('.conv-code').textContent = `#${conv.queryCode}`;
  card.querySelector('.message-time').textContent = formatTime(conv.updatedAt);

  const badge = card.querySelector('.status-badge');
  badge.className = `status-badge ${pending ? 'pending' : 'replied'}`;
  badge.textContent = pending ? '待回复' : '已回复';
}

function updateConversationHistory(card, conv) {
  const history = card.querySelector('.admin-chat-history');
  const stickToBottom =
    history.scrollHeight - history.scrollTop - history.clientHeight < 40;

  history.innerHTML = renderChatHistory(conv);

  if (stickToBottom) {
    history.scrollTop = history.scrollHeight;
  }
}

function updateConversationCard(card, conv, draft) {
  updateConversationMeta(card, conv);
  updateConversationHistory(card, conv);
  restoreReplyDraft(card.querySelector('.reply-form'), draft);
}

function renderConversation(conv, draft) {
  const card = document.createElement('article');
  card.className = 'message-card';
  card.dataset.id = conv.id;
  const pending = needsReply(conv);

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
    <div class="admin-chat-history">${renderChatHistory(conv)}</div>
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
  restoreReplyDraft(form, draft);

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
      redirectToLogin('登录已过期，请重新登录');
      return;
    }

    if (!res.ok) throw new Error(data.error || data.message || '回复失败');
    textarea.value = '';
    conversationFingerprints.delete(id);
    await loadConversations(false);
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

function syncConversationList(conversations, drafts) {
  const conversationIds = new Set(conversations.map((conv) => conv.id));

  messageList.querySelectorAll('.message-card').forEach((card) => {
    if (!conversationIds.has(card.dataset.id)) {
      card.remove();
      conversationFingerprints.delete(card.dataset.id);
    }
  });

  conversations.forEach((conv, index) => {
    const fingerprint = getConversationFingerprint(conv);
    const draft = drafts.get(conv.id);
    let card = messageList.querySelector(`.message-card[data-id="${conv.id}"]`);

    if (card && conversationFingerprints.get(conv.id) === fingerprint) {
      if (messageList.children[index] !== card) {
        messageList.insertBefore(card, messageList.children[index] || null);
      }
      return;
    }

    if (card) {
      updateConversationCard(card, conv, draft);
    } else {
      card = renderConversation(conv, draft);
      messageList.appendChild(card);
    }

    conversationFingerprints.set(conv.id, fingerprint);

    if (messageList.children[index] !== card) {
      messageList.insertBefore(card, messageList.children[index] || null);
    }
  });
}

async function loadConversations(isPoll = false) {
  if (!getToken()) {
    redirectToLogin();
    return;
  }

  const drafts = isPoll ? captureReplyDrafts() : new Map();

  if (!isPoll) {
    loading.classList.remove('hidden');
    emptyState.classList.add('hidden');
    messageList.innerHTML = '';
    conversationFingerprints.clear();
  }

  try {
    const res = await fetch('/api/chat', { headers: authHeaders() });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('加载失败');
    }
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      redirectToLogin(res.status === 403 ? '无权访问，仅咨询师可登录' : '登录已过期，请重新登录');
      return;
    }

    if (!res.ok) throw new Error(data.error || '加载失败');

    updateStats(data);

    if (data.length === 0) {
      messageList.innerHTML = '';
      conversationFingerprints.clear();
      emptyState.classList.remove('hidden');
      return;
    }

    emptyState.classList.add('hidden');

    if (isPoll) {
      syncConversationList(data, drafts);
    } else {
      data.forEach((conv) => {
        const card = renderConversation(conv);
        conversationFingerprints.set(conv.id, getConversationFingerprint(conv));
        messageList.appendChild(card);
      });
    }
  } catch {
    if (!isPoll) {
      messageList.innerHTML = '<p style="text-align:center;color:#9a5a50;">加载失败，请刷新页面重试</p>';
    }
  } finally {
    if (!isPoll) {
      loading.classList.add('hidden');
    }
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    if (document.hidden) return;
    loadConversations(true);
  }, POLL_INTERVAL);
}

logoutBtn.addEventListener('click', () => {
  redirectToLogin();
});

if (!getToken()) {
  redirectToLogin();
} else {
  loadConversations(false);
  startPolling();
}
