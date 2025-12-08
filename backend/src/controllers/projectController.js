const ProjectModel = require('../models/projectModel');
const KeywordModel = require('../models/keywordModel');

class ProjectController {
  /**
   * 建立新專案
   * POST /api/projects
   */
  static async createProject(req, res) {
    try {
      const { name, domain, industry, target_audience } = req.body;
      const user_id = req.user.id; // 從 auth middleware 取得

      if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      const project = await ProjectModel.create({
        user_id,
        name,
        domain,
        industry,
        target_audience
      });

      res.status(201).json({
        message: 'Project created successfully',
        data: project
      });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }

  /**
   * 取得使用者的所有專案
   * GET /api/projects
   */
  static async getUserProjects(req, res) {
    try {
      const user_id = req.user.id;
      const projects = await ProjectModel.findByUserId(user_id);

      res.json({
        message: 'Projects retrieved successfully',
        data: projects
      });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ error: 'Failed to retrieve projects' });
    }
  }

  /**
   * 取得單一專案詳情
   * GET /api/projects/:id
   */
  static async getProjectById(req, res) {
    try {
      const { id } = req.params;
      const project = await ProjectModel.findById(id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // 驗證專案擁有者
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // 取得統計資料
      const statistics = await ProjectModel.getStatistics(id);

      res.json({
        message: 'Project retrieved successfully',
        data: {
          ...project,
          statistics
        }
      });
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({ error: 'Failed to retrieve project' });
    }
  }

  /**
   * 更新專案資訊
   * PUT /api/projects/:id
   */
  static async updateProject(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // 驗證專案擁有者
      const project = await ProjectModel.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedProject = await ProjectModel.update(id, updates);

      res.json({
        message: 'Project updated successfully',
        data: updatedProject
      });
    } catch (error) {
      console.error('Update project error:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  }

  /**
   * 刪除專案
   * DELETE /api/projects/:id
   */
  static async deleteProject(req, res) {
    try {
      const { id } = req.params;

      // 驗證專案擁有者
      const project = await ProjectModel.findById(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await ProjectModel.delete(id);

      res.json({
        message: 'Project deleted successfully'
      });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }

  /**
   * 新增關鍵字到專案（批量）
   * POST /api/projects/:id/keywords
   */
  static async addKeywords(req, res) {
    try {
      const { id: project_id } = req.params;
      const { keywords } = req.body; // Array of {keyword, search_volume, difficulty_score, priority}

      // 驗證專案擁有者
      const project = await ProjectModel.findById(project_id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'Keywords array is required' });
      }

      const createdKeywords = await KeywordModel.createBatch(project_id, keywords);

      res.status(201).json({
        message: `${createdKeywords.length} keywords added successfully`,
        data: createdKeywords
      });
    } catch (error) {
      console.error('Add keywords error:', error);
      res.status(500).json({ error: 'Failed to add keywords' });
    }
  }

  /**
   * 取得專案的關鍵字列表
   * GET /api/projects/:id/keywords
   */
  static async getProjectKeywords(req, res) {
    try {
      const { id: project_id } = req.params;
      const { status, priority } = req.query;

      // 驗證專案擁有者
      const project = await ProjectModel.findById(project_id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const keywords = await KeywordModel.findByProjectId(project_id, {
        status,
        priority
      });

      // 取得統計
      const statistics = await KeywordModel.getStatsByProject(project_id);

      res.json({
        message: 'Keywords retrieved successfully',
        data: keywords,
        statistics
      });
    } catch (error) {
      console.error('Get keywords error:', error);
      res.status(500).json({ error: 'Failed to retrieve keywords' });
    }
  }

  /**
   * 更新關鍵字
   * PUT /api/projects/:projectId/keywords/:keywordId
   */
  static async updateKeyword(req, res) {
    try {
      const { projectId, keywordId } = req.params;
      const updates = req.body;

      // 驗證專案擁有者
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const keyword = await KeywordModel.findById(keywordId);
      if (!keyword || keyword.project_id !== projectId) {
        return res.status(404).json({ error: 'Keyword not found' });
      }

      const updatedKeyword = await KeywordModel.update(keywordId, updates);

      res.json({
        message: 'Keyword updated successfully',
        data: updatedKeyword
      });
    } catch (error) {
      console.error('Update keyword error:', error);
      res.status(500).json({ error: 'Failed to update keyword' });
    }
  }

  /**
   * 刪除關鍵字
   * DELETE /api/projects/:projectId/keywords/:keywordId
   */
  static async deleteKeyword(req, res) {
    try {
      const { projectId, keywordId } = req.params;

      // 驗證專案擁有者
      const project = await ProjectModel.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const keyword = await KeywordModel.findById(keywordId);
      if (!keyword || keyword.project_id !== projectId) {
        return res.status(404).json({ error: 'Keyword not found' });
      }

      await KeywordModel.delete(keywordId);

      res.json({
        message: 'Keyword deleted successfully'
      });
    } catch (error) {
      console.error('Delete keyword error:', error);
      res.status(500).json({ error: 'Failed to delete keyword' });
    }
  }
}

module.exports = ProjectController;
