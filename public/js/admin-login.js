const TOKEN_KEY = 'shudong_counselor_token';
const INVITE_CODE = '52510086';
const DASHBOARD_URL = '/dashboard';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const authError = document.getElementById('authError');
const authSuccess = document.getElementById('authSuccess');
const tabs = document.querySelectorAll('.auth-tab');

if (localStorage.getItem(TOKEN_KEY)) {
  window.location.href = DASHBOARD_URL;
}

function showError(msg) {
  authSuccess.classList.add('hidden');
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function showSuccess(msg) {
  authError.classList.add('hidden');
  authSuccess.textContent = msg;
  authSuccess.classList.remove('hidden');
}

function clearMessages() {
  authError.classList.add('hidden');
  authSuccess.classList.add('hidden');
}

function switchTab(tab) {
  tabs.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  loginForm.classList.toggle('hidden', tab !== 'login');
  registerForm.classList.toggle('hidden', tab !== 'register');
  clearMessages();
}

tabs.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = loginForm.querySelector('.auth-submit');

  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/counselor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || data.message || '登录失败');
      return;
    }

    localStorage.setItem(TOKEN_KEY, data.token);
    window.location.href = DASHBOARD_URL;
  } catch {
    showError('网络错误，请稍后再试');
  } finally {
    btn.disabled = false;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessages();

  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const accessKey = document.getElementById('accessKey').value.trim();
  const btn = registerForm.querySelector('.auth-submit');

  if (!accessKey) {
    showError('请填写准入密钥');
    return;
  }

  if (accessKey !== INVITE_CODE) {
    showError('准入密钥错误，无法注册为咨询师');
    return;
  }

  btn.disabled = true;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
        inviteCode: INVITE_CODE
      })
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || '注册失败');
      return;
    }

    if (data.user?.role !== 'counselor') {
      showError('注册未获得咨询师权限，请检查准入密钥');
      return;
    }

    showSuccess('注册成功，正在跳转...');

    const loginRes = await fetch('/api/auth/counselor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const loginData = await loginRes.json();

    if (loginRes.ok && loginData.token) {
      localStorage.setItem(TOKEN_KEY, loginData.token);
      setTimeout(() => { window.location.href = DASHBOARD_URL; }, 600);
    } else {
      showSuccess('注册成功，请切换到登录');
      switchTab('login');
    }
  } catch {
    showError('网络错误，请稍后再试');
  } finally {
    btn.disabled = false;
  }
});
