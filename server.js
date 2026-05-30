const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const authRoutes = require('./routes/auth');
const authorizeRole = require('./middleware/authorizeRole');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'messages.json');
const ALLOWED_EMOTIONS = ['焦虑', '迷茫', '开心', '吐槽'];

app.use(express.json());

// 页面路由（需在 static 之前注册）
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
      return;
    }
    if (/\.(js|css)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));
app.use('/api/auth', authRoutes);

function readRawData() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeConversations(conversations) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(conversations, null, 2), 'utf-8');
}

function generateQueryCode(existingCodes) {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const used = new Set(existingCodes);

  for (let attempt = 0; attempt < 100; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += i % 2 === 0
        ? letters[Math.floor(Math.random() * letters.length)]
        : digits[Math.floor(Math.random() * digits.length)];
    }
    if (!used.has(code)) return code;
  }

  throw new Error('无法生成唯一查询码');
}

function migrateToConversations(raw) {
  if (!Array.isArray(raw)) return [];

  if (raw.length > 0 && Array.isArray(raw[0].messages)) {
    return raw;
  }

  const existingCodes = [];
  const conversations = raw.map((item) => {
    const queryCode = item.queryCode || generateQueryCode(existingCodes);
    existingCodes.push(queryCode);

    const messages = [{
      id: crypto.randomUUID(),
      role: 'user',
      content: item.content,
      emotionTag: item.emotionTag || null,
      createdAt: item.createdAt
    }];

    if (item.reply) {
      messages.push({
        id: crypto.randomUUID(),
        role: 'counselor',
        content: item.reply,
        createdAt: item.repliedAt || item.createdAt
      });
    }

    return {
      id: item.id || crypto.randomUUID(),
      queryCode,
      createdAt: item.createdAt,
      updatedAt: item.repliedAt || item.createdAt,
      messages
    };
  });

  if (conversations.length > 0) {
    writeConversations(conversations);
  }

  return conversations;
}

function readConversations() {
  return migrateToConversations(readRawData());
}

function findByQueryCode(conversations, code) {
  return conversations.find((c) => c.queryCode === code);
}

function findById(conversations, id) {
  return conversations.find((c) => c.id === id);
}

function lastMessage(conversation) {
  const msgs = conversation.messages;
  return msgs.length ? msgs[msgs.length - 1] : null;
}

function needsReply(conversation) {
  const last = lastMessage(conversation);
  return !last || last.role === 'user';
}

// 用户获取会话（含全部聊天记录）
app.get('/api/chat/:queryCode', (req, res) => {
  const code = req.params.queryCode.trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return res.status(400).json({ error: '无效的会话号码' });
  }

  const conversations = readConversations();
  const found = findByQueryCode(conversations, code);

  if (!found) {
    return res.status(404).json({ error: '未找到会话' });
  }

  res.json(found);
});

// 用户发送消息（无 queryCode 则创建新会话）
app.post('/api/chat/messages', (req, res) => {
  const { queryCode, content, emotionTag } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: '请输入消息内容' });
  }

  if (emotionTag && !ALLOWED_EMOTIONS.includes(emotionTag)) {
    return res.status(400).json({ error: '无效的情绪标签' });
  }

  const conversations = readConversations();
  const now = new Date().toISOString();
  const userMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    content: content.trim(),
    emotionTag: emotionTag || null,
    createdAt: now
  };

  if (queryCode) {
    const code = queryCode.trim().toUpperCase();
    const index = conversations.findIndex((c) => c.queryCode === code);

    if (index === -1) {
      return res.status(404).json({ error: '会话不存在' });
    }

    conversations[index].messages.push(userMessage);
    conversations[index].updatedAt = now;
    writeConversations(conversations);

    return res.json({
      success: true,
      queryCode: code,
      conversation: conversations[index]
    });
  }

  const code = generateQueryCode(conversations.map((c) => c.queryCode));
  const conversation = {
    id: crypto.randomUUID(),
    queryCode: code,
    createdAt: now,
    updatedAt: now,
    messages: [userMessage]
  };

  conversations.unshift(conversation);
  writeConversations(conversations);

  res.status(201).json({
    success: true,
    queryCode: code,
    conversation,
    isNew: true
  });
});

// 咨询师获取所有会话（需咨询师身份）
function listAllConversations(req, res) {
  const conversations = readConversations();
  const sorted = [...conversations].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  res.json(sorted);
}

app.get('/api/chat', authorizeRole, listAllConversations);

// 咨询师回复消息（需咨询师身份）
app.post('/api/chat/:id/reply', authorizeRole, (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: '请填写回复内容' });
  }

  const conversations = readConversations();
  const index = conversations.findIndex((c) => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: '未找到该会话' });
  }

  const now = new Date().toISOString();
  const counselorMessage = {
    id: crypto.randomUUID(),
    role: 'counselor',
    content: content.trim(),
    createdAt: now
  };

  conversations[index].messages.push(counselorMessage);
  conversations[index].updatedAt = now;
  writeConversations(conversations);

  res.json({ success: true, conversation: conversations[index] });
});

// 兼容旧接口（同样受权限保护）
app.get('/api/messages', authorizeRole, listAllConversations);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`心理树洞服务已启动，端口: ${PORT}`);
  console.log(`咨询师登录: /admin-login`);
  console.log(`咨询师后台: /dashboard`);
});
