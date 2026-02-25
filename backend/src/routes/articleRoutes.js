const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const articleController = require('../controllers/articleController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// AI 生成嚴格限流：同一 IP 每分鐘最多 5 次
const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI generation rate limit exceeded. Please wait before generating again.' }
});

// 大綱與文章生成 - 使用 optionalAuth 允許無需登入即可使用（POC 模式）
router.post('/generate-outline', aiGenerationLimiter, optionalAuth, articleController.generateOutline);
router.post('/generate', aiGenerationLimiter, optionalAuth, articleController.generateArticle);
router.get('/:id', optionalAuth, articleController.getArticleById);

// 其他路由需要驗證
router.use(authenticateToken);
router.post('/generate-section-stream', articleController.generateSectionStream);

// 文章管理
router.get('/', articleController.getArticles);
router.get('/observability/summary', articleController.getObservabilitySummary);
router.put('/:id', articleController.updateArticle);
router.delete('/:id', articleController.deleteArticle);

// 智能二修功能
router.post('/rewrite-section', articleController.rewriteSection);
router.post('/:id/quality-check', articleController.qualityCheck); // 舊版（兼容性）

// S6 綜合品質檢查
router.post('/:id/comprehensive-quality-check', articleController.comprehensiveQualityCheck);

// S8 經驗缺口檢測（核心功能）
router.post('/:id/detect-experience-gaps', articleController.detectExperienceGaps);
router.post('/:id/smart-rewrite', articleController.smartRewrite);

module.exports = router;
