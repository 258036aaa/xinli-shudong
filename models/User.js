const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

/** 允许的用户角色 */
const USER_ROLES = {
  USER: 'user',
  COUNSELOR: 'counselor'
};

/** role 字段默认值 */
const DEFAULT_ROLE = USER_ROLES.USER;

/**
 * User 数据表结构（Schema）
 *
 * @typedef {Object} User
 * @property {string} id          - 用户唯一 ID
 * @property {string} username    - 登录用户名
 * @property {string} passwordHash - 密码哈希（注册/登录时使用）
 * @property {'user'|'counselor'} role - 用户角色，默认 user
 * @property {string} createdAt   - 创建时间（ISO 8601）
 * @property {string} updatedAt   - 更新时间（ISO 8601）
 */

const userSchema = {
  id: { type: 'string', required: true },
  username: { type: 'string', required: true },
  passwordHash: { type: 'string', required: true },
  role: {
    type: 'string',
    enum: Object.values(USER_ROLES),
    default: DEFAULT_ROLE
  },
  createdAt: { type: 'string', required: true },
  updatedAt: { type: 'string', required: true }
};

function readUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    const users = JSON.parse(data);
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function normalizeRole(role) {
  if (!role) return DEFAULT_ROLE;
  const value = String(role).toLowerCase();
  if (!Object.values(USER_ROLES).includes(value)) {
    throw new Error(`无效的角色: ${role}，仅允许 ${Object.values(USER_ROLES).join(' / ')}`);
  }
  return value;
}

function validateUser(user) {
  if (!user.username || typeof user.username !== 'string') {
    throw new Error('username 为必填字段');
  }
  if (!user.passwordHash || typeof user.passwordHash !== 'string') {
    throw new Error('passwordHash 为必填字段');
  }
  normalizeRole(user.role);
  return true;
}

/**
 * 创建用户记录，role 未传时默认为 'user'
 */
function createUser({ username, passwordHash, role = DEFAULT_ROLE }) {
  const users = readUsers();
  const normalizedUsername = username.trim();

  if (users.some((u) => u.username === normalizedUsername)) {
    throw new Error('用户名已存在');
  }

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    username: normalizedUsername,
    passwordHash,
    role: normalizeRole(role),
    createdAt: now,
    updatedAt: now
  };

  validateUser(user);
  users.push(user);
  writeUsers(users);

  return sanitizeUser(user);
}

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function findById(id) {
  const user = readUsers().find((u) => u.id === id);
  return user ? sanitizeUser(user) : null;
}

function findByUsername(username) {
  return readUsers().find((u) => u.username === username.trim()) || null;
}

function findByIdWithPassword(id) {
  return readUsers().find((u) => u.id === id) || null;
}

function isCounselor(user) {
  return user && user.role === USER_ROLES.COUNSELOR;
}

module.exports = {
  userSchema,
  USER_ROLES,
  DEFAULT_ROLE,
  readUsers,
  writeUsers,
  createUser,
  findById,
  findByUsername,
  findByIdWithPassword,
  isCounselor,
  normalizeRole,
  sanitizeUser
};
