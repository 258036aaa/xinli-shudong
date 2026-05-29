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
const messageSound = document.getElementById('messageSound');
const bgMusic = document.getElementById('bgMusic');
const musicToggle = document.getElementById('musicToggle');
const musicPanel = document.getElementById('musicPanel');
const musicTrackList = document.getElementById('musicTrackList');
const musicStopBtn = document.getElementById('musicStopBtn');

const BGM_TRACKS = [
  { id: 'forest', name: '清晨林间', icon: '🌲', src: 'https://cdn.pixabay.com/audio/2022/10/25/audio_85c2d51f8f.mp3' },
  { id: 'piano', name: '温柔钢琴', icon: '🎹', src: 'https://cdn.pixabay.com/audio/2021/08/04/audio_12b0c7693c.mp3' },
  { id: 'ocean', name: '海风轻漾', icon: '🌊', src: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3' },
  { id: 'night', name: '静夜冥想', icon: '🌙', src: 'https://cdn.pixabay.com/audio/2023/10/11/audio_0ad81c3638.mp3' }
];

const BGM_STORAGE_KEY = 'shudong_bgm';

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
let currentTrackId = null;
let musicPlaying = false;
let autoplayBlocked = false;

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

function renderChatBubble(msg) {
  const isUser = msg.role === 'user';
  const emotionHtml = msg.emotionTag
    ? `<span class="bubble-emotion">${escapeHtml(msg.emotionTag)}</span>`
    : '';

  return `
    <div class="chat-bubble ${isUser ? 'user' : 'counselor'}" data-id="${msg.id}">
      <div class="bubble-inner">
        ${emotionHtml}
        <p class="bubble-text">${escapeHtml(msg.content)}</p>
        <span class="bubble-time">${formatTime(msg.createdAt)}</span>
      </div>
    </div>
  `;
}

function renderConversation(conversation, playSound = false) {
  const prevCount = knownMessageIds.size;
  let newCounselorMsg = false;

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
    if (!knownMessageIds.has(msg.id)) {
      if (msg.role === 'counselor' && knownMessageIds.size > 0) {
        newCounselorMsg = true;
      }
      knownMessageIds.add(msg.id);
    }
    chatMessages.insertAdjacentHTML('beforeend', renderChatBubble(msg));
  });

  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (playSound && newCounselorMsg && prevCount > 0) {
    playMessageSound();
  }
}

async function loadConversation(code, playSound = false) {
  const res = await fetch(`/api/chat/${code}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '加载失败');
  queryCode = code;
  saveIdentity(code);
  updateSessionBadge(code);
  renderConversation(data, playSound);
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
    renderConversation(data.conversation);
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
    if (!queryCode) return;
    try {
      await loadConversation(queryCode, true);
    } catch { /* 静默失败 */ }
  }, POLL_INTERVAL);
}

function initAudio() {
  messageSound.src = 'https://cdn.pixabay.com/audio/2022/03/24/audio_3d6a8ac58b.mp3';
  renderMusicTracks();
  startBgmOnLoad();
  setupAutoplayFallback();
}

function getDefaultTrackId() {
  const { trackId } = getBgmState();
  return trackId && BGM_TRACKS.some((t) => t.id === trackId) ? trackId : BGM_TRACKS[0].id;
}

function startBgmOnLoad() {
  const trackId = getDefaultTrackId();
  startMusic(trackId);
}

function setupAutoplayFallback() {
  const resumeOnInteraction = () => {
    if (!musicPlaying && autoplayBlocked) {
      startMusic(currentTrackId || getDefaultTrackId());
    }
  };
  document.addEventListener('click', resumeOnInteraction, { once: true });
  document.addEventListener('keydown', resumeOnInteraction, { once: true });
}

function renderMusicTracks() {
  musicTrackList.innerHTML = BGM_TRACKS.map((track) => `
    <button
      type="button"
      class="music-track-btn"
      data-track-id="${track.id}"
      aria-pressed="false"
    >
      <span class="track-icon">${track.icon}</span>
      <span class="track-name">${track.name}</span>
    </button>
  `).join('');
}

function getBgmState() {
  try {
    return JSON.parse(localStorage.getItem(BGM_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveBgmState() {
  if (currentTrackId) {
    localStorage.setItem(BGM_STORAGE_KEY, JSON.stringify({ trackId: currentTrackId }));
  }
}

function updateMusicUI() {
  musicToggle.classList.toggle('active', musicPlaying);
  musicToggle.setAttribute('aria-pressed', String(musicPlaying));
  musicToggle.textContent = musicPlaying ? '🔊 播放中' : '🎵 轻音乐';
  musicStopBtn.classList.toggle('hidden', !musicPlaying);

  musicTrackList.querySelectorAll('.music-track-btn').forEach((btn) => {
    const isActive = btn.dataset.trackId === currentTrackId && musicPlaying;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}

function startMusic(trackId) {
  const track = BGM_TRACKS.find((t) => t.id === trackId);
  if (!track) return;

  currentTrackId = trackId;
  bgMusic.src = track.src;
  bgMusic.volume = 0.35;

  return bgMusic.play()
    .then(() => {
      musicPlaying = true;
      autoplayBlocked = false;
      updateMusicUI();
      saveBgmState();
    })
    .catch(() => {
      musicPlaying = false;
      autoplayBlocked = true;
      updateMusicUI();
    });
}

function playTrack(trackId) {
  if (currentTrackId === trackId && musicPlaying) {
    stopMusic();
    return;
  }
  startMusic(trackId);
}

function stopMusic() {
  bgMusic.pause();
  bgMusic.currentTime = 0;
  musicPlaying = false;
  autoplayBlocked = false;
  updateMusicUI();
}

function toggleMusicPanel() {
  const isOpen = !musicPanel.classList.contains('hidden');
  musicPanel.classList.toggle('hidden', isOpen);
  musicToggle.setAttribute('aria-expanded', String(!isOpen));
}

function playMessageSound() {
  messageSound.currentTime = 0;
  messageSound.play().catch(() => {});
}

async function init() {
  showDailyQuote();
  initAudio();

  const savedCode = getIdentity();
  if (savedCode) {
    try {
      knownMessageIds.clear();
      await loadConversation(savedCode);
    } catch {
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

musicToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  if (musicPlaying && musicPanel.classList.contains('hidden')) {
    stopMusic();
    return;
  }
  toggleMusicPanel();
});

musicStopBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  stopMusic();
});

musicTrackList.addEventListener('click', (e) => {
  const btn = e.target.closest('.music-track-btn');
  if (!btn) return;
  playTrack(btn.dataset.trackId);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.music-control')) {
    musicPanel.classList.add('hidden');
    musicToggle.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!welcomeModal.classList.contains('hidden')) {
      hideWelcomeModal();
    }
    musicPanel.classList.add('hidden');
    musicToggle.setAttribute('aria-expanded', 'false');
  }
});

init();
