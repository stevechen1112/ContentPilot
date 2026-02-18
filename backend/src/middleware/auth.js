const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

/**
 * 從 Authorization header 提取 JWT token
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;
  // 支援 "Bearer <token>" 格式
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

/**
 * JWT 驗證中間件
 * 必須帶有有效 JWT，否則回傳 401
 */
function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Optional Auth - 允許未登入用戶訪問，但如果有 token 則解析
 * 若 token 無效則忽略（不回傳 401），req.user 為 null
 */
function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
  } catch (error) {
    // Token 無效時靜默忽略，視為未登入
    req.user = null;
  }
  next();
}

module.exports = { authenticateToken, optionalAuth };
