const STORAGE_KEY = 'shudong_identity';
const POLL_INTERVAL = 4000;

const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const toast = document.getElementById('toast');
const emotionTags = document.getElementById('emotionTags');
const dailyQuoteText = document.getElementById('dailyQuoteText');
const sessionBadge = document.getElementById('sessionBadge');
const sessionCode = document.getElementById('sessionCode');
const restoreInput = document.getElementById('restoreInput');
const restoreBtn = document.getElementById('restoreBtn');
const welcomeModal = document.getElementById('welcomeModal');
const welcomeBackdrop = document.getElementById('welcomeBackdrop');
const welcomeCode = document.getElementById('welcomeCode');
const welcomeCopyBtn = document.getElementById('welcomeCopyBtn');
const welcomeCloseBtn = document.getElementById('welcomeCloseBtn');

const WARM_QUOTES = [
  '你不必时刻保持坚强，偶尔脆弱，也是对自己温柔的允许。',
  '今天的难过，会在某个清晨悄悄变淡，请再给自己一点时间。',
  '没有人规定你必须一直开心，你的每一种情绪都值得被认真对待。',
  '你已经很努力了，休息不是放弃，而是为了更好地前行。',
  '世界偶尔吵闹，但总有人愿意安静地听你说完那些话。',
  '不必和所有人解释自己，懂你的人，自然会懂你的心意。',
  '就算今天不太顺利，也不代表你的人生就此黯淡无光。',
  '请相信，那些打不倒你的，终会让你变得更温柔也更坚定。',
  '你值得被好好对待，首先从善待自己开始。',
  '有些答案不必急着寻找，时间会慢慢把光亮送到你面前。',
  '允许自己慢下来，花开有花期，你也有自己的节奏。',
  '不必因为别人的期待而委屈自己，你的人生只属于你自己。',
  '每一次倾诉，都是心灵在悄悄为自己疗伤。',
  '你并不是一个人在经历这些，许多人都曾走过相似的路。',
  '请对自己说一句：我已经做得很好了，真的。',
  '就算此刻感到迷茫，也请相信，前方仍有温柔在等你。',
  '把心事轻轻放下，今晚的月光会替你守护这份安宁。',
  '你不需要完美，只需要真实地活着，就已经很了不起。',
  '愿你知道，被理解是一种幸运，而自我接纳是一生的功课。',
  '无论今天怎样，明天太阳升起时，你都还有一次重新开始的机会。'
];

const MAX_LENGTH = 2000;
let selectedEmotion = null;
let queryCode = null;
let knownMessageIds = new Set();
let pollTimer = null;
let lastConversationFingerprint = '';

function getConversationFingerprint(conversation) {
  if (!conversation?.messages?.length) return 'empty';
  return conversation.messages.map((msg) => msg.id).join(',');
}

function getIdentity() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return data?.queryCode || null;
  } catch {
    return null;
  }
}

function saveIdentity(code) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    queryCode: code,
    savedAt: new Date().toISOString()
  }));
}

function showDailyQuote() {
  const quote = WARM_QUOTES[Math.floor(Math.random() * WARM_QUOTES.length)];
  dailyQuoteText.textContent = `“${quote}”`;
}

function showToast(text, isError = false) {
  toast.textContent = text;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateSessionBadge(code) {
  if (!code) {
    sessionBadge.classList.add('hidden');
    return;
  }
  sessionCode.textContent = code;
  sessionBadge.classList.remove('hidden');
}

function showWelcomeModal(code) {
  welcomeCode.textContent = code;
  welcomeModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideWelcomeModal() {
  welcomeModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function renderChatBubble(msg, isNew = false) {
  const isUser = msg.role === 'user';
  const emotionHtml = msg.emotionTag
    ? `<span class="bubble-emotion">${escapeHtml(msg.emotionTag)}</span>`
    : '';
  const newClass = isNew ? ' is-new' : '';

  return `
    <div class="chat-bubble ${isUser ? 'user' : 'counselor'}${newClass}" data-id="${msg.id}">
      <div class="bubble-inner">
        ${emotionHtml}
        <p class="bubble-text">${escapeHtml(msg.content)}</p>
        <span class="bubble-time">${formatTime(msg.createdAt)}</span>
      </div>
    </div>
  `;
}

function renderConversation(conversation, { force = false } = {}) {
  const fingerprint = getConversationFingerprint(conversation);
  if (!force && fingerprint === lastConversationFingerprint) {
    return;
  }
  lastConversationFingerprint = fingerprint;

  const shouldStickToBottom =
    chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 80;

  chatMessages.innerHTML = '';
  if (!conversation.messages.length) {
    chatMessages.innerHTML = `
      <div class="chat-welcome">
        <p>🍃 欢迎来到心理树洞</p>
        <p>写下你想说的话，咨询师会温柔地回应你</p>
      </div>
    `;
    return;
  }

  conversation.messages.forEach((msg) => {
    const isNew = !knownMessageIds.has(msg.id);
    knownMessageIds.add(msg.id);
    chatMessages.insertAdjacentHTML('beforeend', renderChatBubble(msg, isNew));
  });

  if (shouldStickToBottom) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

async function loadConversation(code) {
  const res = await fetch(`/api/chat/${code}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('加载失败');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '加载失败');
  queryCode = code;
  saveIdentity(code);
  updateSessionBadge(code);
  renderConversation(data);
  return data;
}

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content) {
    showToast('请输入消息内容', true);
    messageInput.focus();
    return;
  }

  sendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queryCode,
        content,
        emotionTag: selectedEmotion
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '发送失败');

    if (data.isNew) {
      queryCode = data.queryCode;
      saveIdentity(queryCode);
      updateSessionBadge(queryCode);
      showWelcomeModal(queryCode);
    }

    messageInput.value = '';
    charCount.textContent = `0 / ${MAX_LENGTH}`;
    resetEmotionTags();
    renderConversation(data.conversation, { force: true });
  } catch (err) {
    showToast(err.message, true);
  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function resetEmotionTags() {
  selectedEmotion = null;
  emotionTags.querySelectorAll('.emotion-tag').forEach((t) => t.classList.remove('active'));
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!queryCode || document.hidden) return;
    try {
      await loadConversation(queryCode);
    } catch { /* 静默失败 */ }
  }, POLL_INTERVAL);
}

async function init() {
  showDailyQuote();

  const savedCode = getIdentity();
  if (savedCode) {
    try {
      knownMessageIds.clear();
      lastConversationFingerprint = '';
      await loadConversation(savedCode);
    } catch {
      queryCode = null;
      localStorage.removeItem(STORAGE_KEY);
      showToast('本地会话已失效，请重新发送消息', true);
    }
  }

  startPolling();
}

messageInput.addEventListener('input', () => {
  charCount.textContent = `${messageInput.value.length} / ${MAX_LENGTH}`;
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
});

emotionTags.addEventListener('click', (e) => {
  const btn = e.target.closest('.emotion-tag');
  if (!btn) return;
  const emotion = btn.dataset.emotion;
  if (selectedEmotion === emotion) {
    selectedEmotion = null;
    btn.classList.remove('active');
  } else {
    selectedEmotion = emotion;
    emotionTags.querySelectorAll('.emotion-tag').forEach((t) => {
      t.classList.toggle('active', t.dataset.emotion === emotion);
    });
  }
});

restoreInput.addEventListener('input', () => {
  restoreInput.value = restoreInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

restoreBtn.addEventListener('click', async () => {
  const code = restoreInput.value.trim();
  if (code.length !== 6) {
    showToast('请输入 6 位专属号码', true);
    return;
  }
  restoreBtn.disabled = true;
  try {
    knownMessageIds.clear();
    lastConversationFingerprint = '';
    await loadConversation(code);
    showToast('对话已恢复');
    restoreInput.value = '';
  } catch (err) {
    showToast(err.message, true);
  } finally {
    restoreBtn.disabled = false;
  }
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

welcomeCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(welcomeCode.textContent);
    welcomeCopyBtn.textContent = '已复制';
    setTimeout(() => { welcomeCopyBtn.textContent = '复制号码'; }, 2000);
  } catch {
    showToast('复制失败', true);
  }
});

welcomeCloseBtn.addEventListener('click', hideWelcomeModal);
welcomeBackdrop.addEventListener('click', hideWelcomeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !welcomeModal.classList.contains('hidden')) {
    hideWelcomeModal();
  }
});

init();
