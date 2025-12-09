const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

/**
 * JWT 驗證中間件
 */
function authenticateToken(req, res, next) {
  // Bypass authentication for local dev/no-login mode
  req.user = {
    id: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID format
    email: 'admin@example.com'
  };
  next();
}

/**
 * Optional Auth - 允許未登入用戶訪問，但如果有 token 則解析
 */
function optionalAuth(req, res, next) {
  req.user = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'guest@example.com'
  };
  next();
}

module.exports = { authenticateToken, optionalAuth };
