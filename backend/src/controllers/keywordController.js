const KeywordModel = require('../models/keywordModel');
const Project = require('../models/projectModel');

class KeywordController {
  // ?�建?�個�??��?
  async create(req, res) {
    try {
      const { project_id, keyword, search_volume, difficulty_score } = req.body;
      const userId = req.user.id;

      if (!project_id || !keyword) {
        return res.status(400).json({
          success: false,
          message: 'Project ID and keyword are required'
        });
      }

      // 驗�?專�?存在且屬?�該?�戶
      const project = await Project.findById(project_id);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      if (project.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const newKeyword = await KeywordModel.create({
        project_id,
        keyword,
        search_volume,
        difficulty_score
      });

      res.status(201).json({
        success: true,
        message: 'Keyword created successfully',
        data: newKeyword
      });
    } catch (error) {
      console.error('Create keyword error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create keyword',
        error: error.message
      });
    }
  }

  // ?��??�建?�鍵�?
  async batchCreate(req, res) {
    try {
      const { project_id, keywords } = req.body;
      const userId = req.user.id;

      if (!project_id || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Project ID and keywords array are required'
        });
      }

      // 驗�?專�?存在且屬?�該?�戶
      const project = await Project.findById(project_id);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      if (project.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const newKeywords = await KeywordModel.createBatch(project_id, keywords);

      res.status(201).json({
        success: true,
        message: `${newKeywords.length} keywords created successfully`,
        data: newKeywords
      });
    } catch (error) {
      console.error('Batch create keywords error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create keywords',
        error: error.message
      });
    }
  }

  // ?��?專�??��??��??��?
  async getByProject(req, res) {
    try {
      const { projectId } = req.params;
      const userId = req.user.id;

      // 驗�?專�?存在且屬?�該?�戶
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found'
        });
      }

      if (project.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const keywords = await KeywordModel.findByProjectId(projectId);

      res.json({
        success: true,
        data: keywords
      });
    } catch (error) {
      console.error('Get keywords error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get keywords',
        error: error.message
      });
    }
  }

  // ?��??�個�??��?
  async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const keyword = await KeywordModel.findById(id);
      if (!keyword) {
        return res.status(404).json({
          success: false,
          message: 'Keyword not found'
        });
      }

      // 驗�?權�?
      const project = await Project.findById(keyword.project_id);
      if (project.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      res.json({
        success: true,
        data: keyword
      });
    } catch (error) {
      console.error('Get keyword error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get keyword',
        error: error.message
      });
    }
  }

  // ?�新?�鍵�?
  async update(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const keyword = await KeywordModel.findById(id);
      if (!keyword) {
        return res.status(404).json({
          success: false,
          message: 'Keyword not found'
        });
      }

      // 驗�?權�?
      const project = await Project.findById(keyword.project_id);
      if (project.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const updatedKeyword = await KeywordModel.update(id, updateData);

      res.json({
        success: true,
        message: 'Keyword updated successfully',
        data: updatedKeyword
      });
    } catch (error) {
      console.error('Update keyword error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update keyword',
        error: error.message
      });
    }
  }

  // ?�除?�鍵�?
  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const keyword = await KeywordModel.findById(id);
      if (!keyword) {
        return res.status(404).json({
          success: false,
          message: 'Keyword not found'
        });
      }

      // 驗證權限
      const project = await Project.findById(keyword.project_id);
      if (project.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      await KeywordModel.delete(id);

      res.json({
        success: true,
        message: 'Keyword deleted successfully'
      });
    } catch (error) {
      console.error('Delete keyword error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete keyword',
        error: error.message
      });
    }
  }
}

module.exports = new KeywordController();
