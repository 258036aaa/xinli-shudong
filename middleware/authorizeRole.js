const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * 从 Authorization 头提取 Bearer JWT，验证后将用户信息挂载到 req.user，
 * 并校验 role 是否为 counselor。
 */
function authorizeRole(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供身份令牌，请先登录' });
  }

  const token = authHeader.slice(7);

  try {
    const decoded = verifyToken(token);
    const user = User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ error: '用户不存在或令牌已失效' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    if (req.user.role !== User.USER_ROLES.COUNSELOR) {
      return res.status(403).json({ error: 'Forbidden', message: '仅咨询师可访问此资源' });
    }

    next();
  } catch {
    return res.status(401).json({ error: '身份令牌无效或已过期' });
  }
}

module.exports = authorizeRole;
