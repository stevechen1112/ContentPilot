const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticateToken } = require('../middleware/auth');

// 所有 project routes 都需要驗證
router.use(authenticateToken);

// 專案管理
router.post('/', projectController.createProject);
router.get('/', projectController.getUserProjects);
router.get('/:id', projectController.getProjectById);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// 關鍵字管理
router.post('/:id/keywords', projectController.addKeywords);
router.get('/:id/keywords', projectController.getProjectKeywords);
router.put('/:projectId/keywords/:keywordId', projectController.updateKeyword);
router.delete('/:projectId/keywords/:keywordId', projectController.deleteKeyword);

module.exports = router;
