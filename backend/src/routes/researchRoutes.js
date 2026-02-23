const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const researchController = require('../controllers/researchController');
const { optionalAuth } = require('../middleware/auth');

// 研究分析限流：同一 IP 每分鐘最多 10 次
const researchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Research API rate limit exceeded. Please try again later.' }
});

// research routes 使用 optionalAuth：有登入就帶入用戶資訊，無登入也允許（rate limit 保護）
router.use(optionalAuth);

// SERP 分析
router.post('/analyze-keyword', researchLimiter, researchController.analyzeKeyword);
router.post('/analyze-batch', researchLimiter, researchController.analyzeBatch);
router.get('/related-searches', researchController.getRelatedSearches);
router.post('/expand-keywords', researchController.expandKeywords);

module.exports = router;
