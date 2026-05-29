const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'messages.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readMessages() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeMessages(messages) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2), 'utf-8');
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
    if (!used.has(code)) {
      return code;
    }
  }

  throw new Error('无法生成唯一查询码');
}

const ALLOWED_EMOTIONS = ['焦虑', '迷茫', '开心', '吐槽'];

// 用户提交心事
app.post('/api/messages', (req, res) => {
  const { content, emotionTag } = req.body;

  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: '请写下你的心事' });
  }

  if (emotionTag !== undefined && emotionTag !== null && emotionTag !== '') {
    if (typeof emotionTag !== 'string' || !ALLOWED_EMOTIONS.includes(emotionTag)) {
      return res.status(400).json({ error: '无效的情绪标签' });
    }
  }

  const messages = readMessages();
  const queryCode = generateQueryCode(messages.map((m) => m.queryCode).filter(Boolean));
  const message = {
    id: crypto.randomUUID(),
    queryCode,
    content: content.trim(),
    emotionTag: emotionTag || null,
    createdAt: new Date().toISOString(),
    reply: null,
    repliedAt: null
  };

  messages.unshift(message);
  writeMessages(messages);

  res.status(201).json({
    success: true,
    message: '你的心事已安全地放进树洞了',
    queryCode
  });
});

// 用户通过查询码查看回复
app.get('/api/messages/lookup/:code', (req, res) => {
  const code = req.params.code.trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return res.status(400).json({ error: '请输入正确的 6 位查询码' });
  }

  const messages = readMessages();
  const found = messages.find((m) => m.queryCode === code);

  if (!found) {
    return res.status(404).json({ error: '未找到对应的心事，请检查查询码是否正确' });
  }

  res.json({
    queryCode: found.queryCode,
    content: found.content,
    emotionTag: found.emotionTag || null,
    createdAt: found.createdAt,
    reply: found.reply,
    repliedAt: found.repliedAt
  });
});

// 咨询师获取所有心事
app.get('/api/messages', (req, res) => {
  const messages = readMessages();
  res.json(messages);
});

// 咨询师回复心事
app.post('/api/messages/:id/reply', (req, res) => {
  const { id } = req.params;
  const { reply } = req.body;

  if (!reply || typeof reply !== 'string' || !reply.trim()) {
    return res.status(400).json({ error: '请填写回复内容' });
  }

  const messages = readMessages();
  const index = messages.findIndex((m) => m.id === id);

  if (index === -1) {
    return res.status(404).json({ error: '未找到该心事' });
  }

  messages[index].reply = reply.trim();
  messages[index].repliedAt = new Date().toISOString();
  writeMessages(messages);

  res.json({ success: true, message: messages[index] });
});

app.listen(PORT, () => {
  console.log(`心理树洞服务已启动: http://localhost:${PORT}`);
  console.log(`咨询师后台: http://localhost:${PORT}/admin.html`);
});
