const messageList = document.getElementById('messageList');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('emptyState');
const totalCount = document.getElementById('totalCount');
const pendingCount = document.getElementById('pendingCount');

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMessage(msg) {
  const card = document.createElement('article');
  card.className = 'message-card';
  card.dataset.id = msg.id;

  const hasReply = Boolean(msg.reply);
  const emotionBadge = msg.emotionTag
    ? `<span class="emotion-badge">${escapeHtml(msg.emotionTag)}</span>`
    : '';

  card.innerHTML = `
    <div class="message-meta">
      <span class="message-time">${formatTime(msg.createdAt)}</span>
      <div class="message-badges">
        ${emotionBadge}
        <span class="status-badge ${hasReply ? 'replied' : 'pending'}">
          ${hasReply ? '已回复' : '待回复'}
        </span>
      </div>
    </div>
    <div class="message-content">${escapeHtml(msg.content)}</div>
    <div class="reply-section">
      <h3>咨询师回复</h3>
      ${hasReply ? `
        <div class="existing-reply">
          ${escapeHtml(msg.reply)}
          <div class="reply-time">回复于 ${formatTime(msg.repliedAt)}</div>
        </div>
      ` : ''}
      <form class="reply-form" data-id="${msg.id}">
        <textarea placeholder="写下温暖的回复..." rows="3">${hasReply ? escapeHtml(msg.reply) : ''}</textarea>
        <div class="reply-actions">
          <button type="submit" class="reply-btn">${hasReply ? '更新回复' : '发送回复'}</button>
        </div>
        <div class="reply-success hidden"></div>
      </form>
    </div>
  `;

  const form = card.querySelector('.reply-form');
  form.addEventListener('submit', (e) => handleReply(e, msg.id));

  return card;
}

async function handleReply(e, id) {
  e.preventDefault();

  const form = e.target;
  const textarea = form.querySelector('textarea');
  const btn = form.querySelector('.reply-btn');
  const successEl = form.querySelector('.reply-success');
  const reply = textarea.value.trim();

  if (!reply) {
    alert('请填写回复内容');
    return;
  }

  btn.disabled = true;
  btn.textContent = '发送中...';

  try {
    const res = await fetch(`/api/messages/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '回复失败');
    }

    successEl.textContent = '回复已保存';
    successEl.classList.remove('hidden');

    setTimeout(() => {
      loadMessages();
    }, 600);
  } catch (err) {
    alert(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = btn.textContent.includes('更新') ? '更新回复' : '发送回复';
  }
}

function updateStats(messages) {
  const pending = messages.filter((m) => !m.reply).length;
  totalCount.textContent = `共 ${messages.length} 条`;
  pendingCount.textContent = `待回复 ${pending} 条`;
}

async function loadMessages() {
  loading.classList.remove('hidden');
  emptyState.classList.add('hidden');
  messageList.innerHTML = '';

  try {
    const res = await fetch('/api/messages');
    const messages = await res.json();

    updateStats(messages);

    if (messages.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      messages.forEach((msg) => {
        messageList.appendChild(renderMessage(msg));
      });
    }
  } catch {
    messageList.innerHTML = '<p style="text-align:center;color:#9a5a50;">加载失败，请刷新页面重试</p>';
  } finally {
    loading.classList.add('hidden');
  }
}

loadMessages();
