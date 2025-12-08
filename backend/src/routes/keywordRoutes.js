const express = require('express');
const router = express.Router();
const keywordController = require('../controllers/keywordController');
const { authenticateToken } = require('../middleware/auth');

// 所有路由都需要身份驗證
router.use(authenticateToken);

// 創建單個關鍵字
router.post('/', keywordController.create);

// 批量創建關鍵字
router.post('/batch', keywordController.batchCreate);

// 獲取專案的所有關鍵字
router.get('/project/:projectId', keywordController.getByProject);

// 獲取單個關鍵字
router.get('/:id', keywordController.getById);

// 更新關鍵字
router.put('/:id', keywordController.update);

// 刪除關鍵字
router.delete('/:id', keywordController.delete);

module.exports = router;
