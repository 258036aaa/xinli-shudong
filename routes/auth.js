const express = require('express');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

const router = express.Router();

/** 咨询师邀请码：匹配则 role=counselor，否则 role=user */
const COUNSELOR_INVITE_CODE = process.env.COUNSELOR_INVITE_CODE || '52510086';

function resolveRoleFromInviteCode(inviteCode) {
  if (inviteCode && String(inviteCode).trim() === COUNSELOR_INVITE_CODE) {
    return User.USER_ROLES.COUNSELOR;
  }
  return User.USER_ROLES.USER;
}

function registerUser(req, res) {
  const { username, password, inviteCode } = req.body;

  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: '请填写用户名' });
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }

  const role = resolveRoleFromInviteCode(inviteCode);

  try {
    const user = User.createUser({
      username,
      passwordHash: hashPassword(password),
      role
    });

    const isCounselor = role === User.USER_ROLES.COUNSELOR;

    res.status(201).json({
      success: true,
      message: isCounselor ? '咨询师账号注册成功' : '用户注册成功',
      user
    });
  } catch (err) {
    if (err.message === '用户名已存在') {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: '注册失败，请稍后再试' });
  }
}

// 通用用户注册（可选 inviteCode，正确则为咨询师，否则为普通用户）
router.post('/register', registerUser);

// 兼容旧路径，逻辑与 /register 相同
router.post('/counselor/register', registerUser);

// 咨询师登录（签发 JWT）
router.post('/counselor/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '请填写用户名和密码' });
  }

  const user = User.findByUsername(username);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (user.role !== User.USER_ROLES.COUNSELOR) {
    return res.status(403).json({ error: '非咨询师账号，无法登录后台' });
  }

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role
  });

  res.json({
    success: true,
    token,
    user: User.sanitizeUser(user)
  });
});

module.exports = router;
