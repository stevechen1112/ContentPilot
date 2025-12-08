const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { authenticateToken } = require('../middleware/auth');

// 所有 article routes 都需要驗證
router.use(authenticateToken);

// 大綱與文章生成
router.post('/generate-outline', articleController.generateOutline);
router.post('/generate', articleController.generateArticle);
router.post('/generate-section-stream', articleController.generateSectionStream);

// 文章管理
router.get('/', articleController.getArticles);
router.get('/:id', articleController.getArticleById);
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
