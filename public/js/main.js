const messageInput = document.getElementById('messageInput');
const submitBtn = document.getElementById('submitBtn');
const charCount = document.getElementById('charCount');
const toast = document.getElementById('toast');
const emotionTags = document.getElementById('emotionTags');
const lookupInput = document.getElementById('lookupInput');
const lookupBtn = document.getElementById('lookupBtn');
const lookupResult = document.getElementById('lookupResult');
const dailyQuoteText = document.getElementById('dailyQuoteText');
const successModal = document.getElementById('successModal');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalQueryCode = document.getElementById('modalQueryCode');
const modalCopyBtn = document.getElementById('modalCopyBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

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

function showDailyQuote() {
  const quote = WARM_QUOTES[Math.floor(Math.random() * WARM_QUOTES.length)];
  dailyQuoteText.textContent = `“${quote}”`;
}

showDailyQuote();

messageInput.addEventListener('input', () => {
  const len = messageInput.value.length;
  charCount.textContent = `${len} / ${MAX_LENGTH}`;
});

lookupInput.addEventListener('input', () => {
  lookupInput.value = lookupInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
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
    emotionTags.querySelectorAll('.emotion-tag').forEach((tag) => {
      tag.classList.toggle('active', tag.dataset.emotion === emotion);
    });
  }
});

function resetEmotionTags() {
  selectedEmotion = null;
  emotionTags.querySelectorAll('.emotion-tag').forEach((tag) => {
    tag.classList.remove('active');
  });
}

function showToast(text, isError = false) {
  toast.textContent = text;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

function showSuccessModal(queryCode) {
  modalQueryCode.textContent = queryCode;
  successModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  modalCloseBtn.focus();
}

function hideSuccessModal() {
  successModal.classList.add('hidden');
  document.body.style.overflow = '';
}

function formatTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('zh-CN', {
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

function renderLookupResult(data) {
  const hasReply = Boolean(data.reply);
  const emotionHtml = data.emotionTag
    ? `<span class="result-emotion">${escapeHtml(data.emotionTag)}</span>`
    : '';

  lookupResult.innerHTML = `
    <div class="result-block">
      <h3>你的心事 ${emotionHtml}</h3>
      <p class="result-content">${escapeHtml(data.content)}</p>
      <p class="result-meta">提交于 ${formatTime(data.createdAt)}</p>
    </div>
    <div class="result-block ${hasReply ? 'has-reply' : 'no-reply'}">
      <h3>咨询师回复</h3>
      ${
        hasReply
          ? `<p class="result-content">${escapeHtml(data.reply)}</p>
             <p class="result-meta">回复于 ${formatTime(data.repliedAt)}</p>`
          : '<p class="result-pending">咨询师尚未回复，请稍后再来查看</p>'
      }
    </div>
  `;
  lookupResult.classList.remove('hidden');
}

submitBtn.addEventListener('click', async () => {
  const content = messageInput.value.trim();

  if (!content) {
    showToast('请先写下你的心事', true);
    messageInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '正在放入...';

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        emotionTag: selectedEmotion
      })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '提交失败，请稍后再试');
    }

    messageInput.value = '';
    charCount.textContent = `0 / ${MAX_LENGTH}`;
    resetEmotionTags();
    showSuccessModal(data.queryCode);
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '扔进树洞';
  }
});

modalCopyBtn.addEventListener('click', async () => {
  const code = modalQueryCode.textContent;
  try {
    await navigator.clipboard.writeText(code);
    modalCopyBtn.textContent = '已复制';
    setTimeout(() => {
      modalCopyBtn.textContent = '复制号码';
    }, 2000);
  } catch {
    showToast('复制失败，请手动记下号码', true);
  }
});

modalCloseBtn.addEventListener('click', hideSuccessModal);
modalBackdrop.addEventListener('click', hideSuccessModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !successModal.classList.contains('hidden')) {
    hideSuccessModal();
  }
});

lookupBtn.addEventListener('click', async () => {
  const code = lookupInput.value.trim();

  if (code.length !== 6) {
    showToast('请输入 6 位查询码', true);
    lookupInput.focus();
    return;
  }

  lookupBtn.disabled = true;
  lookupBtn.textContent = '查询中...';
  lookupResult.classList.add('hidden');

  try {
    const res = await fetch(`/api/messages/lookup/${code}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || '查询失败，请稍后再试');
    }

    renderLookupResult(data);
  } catch (err) {
    showToast(err.message, true);
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = '查询';
  }
});

lookupInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    lookupBtn.click();
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    submitBtn.click();
  }
});
