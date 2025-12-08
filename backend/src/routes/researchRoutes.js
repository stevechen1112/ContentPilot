const express = require('express');
const router = express.Router();
const researchController = require('../controllers/researchController');
const { authenticateToken } = require('../middleware/auth');

// 所有 research routes 都需要驗證
router.use(authenticateToken);

// SERP 分析
router.post('/analyze-keyword', researchController.analyzeKeyword);
router.post('/analyze-batch', researchController.analyzeBatch);
router.get('/related-searches', researchController.getRelatedSearches);
router.post('/expand-keywords', researchController.expandKeywords);

module.exports = router;
