const ArticleModel = require('../models/articleModel');
const ProjectModel = require('../models/projectModel');
const KeywordModel = require('../models/keywordModel');
const OutlineService = require('../services/outlineService');
const ArticleService = require('../services/articleService');
const QualityService = require('../services/qualityService');
const ExperienceGapService = require('../services/experienceGapService');

class ArticleController {
  /**
   * 生成文章大綱
   * POST /api/articles/generate-outline
   */
  static async generateOutline(req, res) {
    try {
      const { keyword, project_id, serp_data, tone, target_audience } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
      }

      // 如果有 project_id，驗證權限
      if (project_id) {
        const project = await ProjectModel.findById(project_id);
        if (!project || project.user_id !== req.user.id) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const outline = await OutlineService.generateOutline(keyword, {
        serp_data,
        tone,
        target_audience
      });

      res.json({
        message: 'Outline generated successfully',
        data: outline
      });
    } catch (error) {
      console.error('Generate outline error:', error);
      res.status(500).json({ error: 'Failed to generate outline' });
    }
  }

  /**
   * 生成完整文章
   * POST /api/articles/generate
   */
  static async generateArticle(req, res) {
    try {
      const { project_id, keyword_id, outline, serp_data, tone, target_audience } = req.body;

      if (!project_id || !outline) {
        return res.status(400).json({ error: 'Project ID and outline are required' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // 生成文章（傳遞 serp_data 以供 E-E-A-T 和 SEO 優化使用）
      const article = await ArticleService.generateArticle(outline, {
        serp_data,
        style_guide: tone ? { tone } : undefined,
        target_audience
      });

      // 儲存到資料庫
      const savedArticle = await ArticleModel.create({
        project_id,
        keyword_id,
        title: article.title,
        content_draft: article,
        assigned_to: req.user.id
      });

      // 如果有 keyword_id，更新關鍵字狀態
      if (keyword_id) {
        await KeywordModel.update(keyword_id, { status: 'completed' });
      }

      res.json({
        message: 'Article generated successfully',
        data: {
          article_id: savedArticle.id,
          ...savedArticle,
          content: savedArticle.content_draft // Map content_draft to content for frontend
        }
      });
    } catch (error) {
      console.error('Generate article error:', error);
      res.status(500).json({ error: 'Failed to generate article' });
    }
  }

  /**
   * Stream 模式生成段落
   * POST /api/articles/generate-section-stream
   */
  static async generateSectionStream(req, res) {
    try {
      const { section, outline } = req.body;

      if (!section || !outline) {
        return res.status(400).json({ error: 'Section and outline are required' });
      }

      // 設定 SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let fullContent = '';

      await ArticleService.generateSectionStream(
        section,
        outline,
        { provider: 'gemini' },
        (chunk) => {
          fullContent += chunk;
          res.write(`data: ${JSON.stringify({ chunk, full: fullContent })}\n\n`);
        }
      );

      res.write(`data: ${JSON.stringify({ done: true, full: fullContent })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Generate section stream error:', error);
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
      res.end();
    }
  }

  /**
   * 改寫段落（融合使用者經驗）
   * POST /api/articles/rewrite-section
   */
  static async rewriteSection(req, res) {
    try {
      const { article_id, section_index, original_content, user_input } = req.body;

      if (!article_id || original_content === undefined || !user_input) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // 驗證權限
      const article = await ArticleModel.findById(article_id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // 改寫段落
      const rewritten = await ArticleService.rewriteSection(original_content, user_input, {
        provider: 'claude'
      });

      // 更新文章內容
      const contentDraft = article.content_draft;
      if (section_index !== undefined && contentDraft.content?.sections?.[section_index]) {
        contentDraft.content.sections[section_index] = {
          ...contentDraft.content.sections[section_index],
          ...rewritten,
          user_contributed: true
        };

        await ArticleModel.update(article_id, {
          content_draft: contentDraft
        });
      }

      res.json({
        message: 'Section rewritten successfully',
        data: rewritten
      });
    } catch (error) {
      console.error('Rewrite section error:', error);
      res.status(500).json({ error: 'Failed to rewrite section' });
    }
  }

  /**
   * 綜合品質檢查（新版 S6）
   * POST /api/articles/:id/comprehensive-quality-check
   */
  static async comprehensiveQualityCheck(req, res) {
    try {
      const { id } = req.params;
      const { target_keyword, serp_data } = req.body;

      const article = await ArticleModel.findById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const qualityReport = await QualityService.comprehensiveQualityCheck(article.content_draft, {
        target_keyword,
        serp_data,
        provider: 'claude'
      });

      // 更新評分
      await ArticleModel.update(id, {
        quality_score: qualityReport.overall_score,
        eeat_score: qualityReport.checks?.eeat?.score || 0,
        seo_score: qualityReport.checks?.seo?.score || 0
      });

      res.json({
        message: 'Comprehensive quality check completed',
        data: qualityReport
      });
    } catch (error) {
      console.error('Comprehensive quality check error:', error);
      res.status(500).json({ error: 'Failed to perform comprehensive quality check' });
    }
  }

  /**
   * 檢測經驗缺口（S8 核心功能）
   * POST /api/articles/:id/detect-experience-gaps
   */
  static async detectExperienceGaps(req, res) {
    try {
      const { id } = req.params;
      const { target_keyword } = req.body;

      const article = await ArticleModel.findById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const gapAnalysis = await ExperienceGapService.detectExperienceGaps(article, {
        target_keyword,
        provider: 'claude'
      });

      res.json({
        message: 'Experience gaps detected successfully',
        data: gapAnalysis
      });
    } catch (error) {
      console.error('Experience gap detection error:', error);
      res.status(500).json({ error: 'Failed to detect experience gaps' });
    }
  }

  /**
   * 智能融合重寫（S8）
   * POST /api/articles/:id/smart-rewrite
   */
  static async smartRewrite(req, res) {
    try {
      const { id } = req.params;
      const { section_id, user_experience, section_heading } = req.body;

      if (user_experience === undefined || section_id === undefined) {
        return res.status(400).json({ error: 'section_id and user_experience are required' });
      }

      const article = await ArticleModel.findById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // 獲取原始段落內容
      const sections = article.content_draft?.content?.sections || article.content_draft?.sections || [];
      const originalSection = sections[section_id];

      if (!originalSection) {
        return res.status(404).json({ error: 'Section not found' });
      }

      const originalContent = originalSection.html || originalSection.plain_text || originalSection.content || '';

      // 執行智能重寫
      const rewriteResult = await ExperienceGapService.smartRewrite(originalContent, user_experience, {
        section_heading: section_heading || originalSection.heading,
        provider: 'claude'
      });

      res.json({
        message: 'Smart rewrite completed',
        data: rewriteResult
      });
    } catch (error) {
      console.error('Smart rewrite error:', error);
      res.status(500).json({ error: 'Failed to perform smart rewrite' });
    }
  }

  /**
   * 品質檢查（舊版，保留兼容性）
   * POST /api/articles/:id/quality-check
   */
  static async qualityCheck(req, res) {
    try {
      const { id } = req.params;
      const { target_keyword } = req.body;

      const article = await ArticleModel.findById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const qualityReport = await ArticleService.qualityCheck(article.content_draft, {
        target_keyword,
        provider: 'claude'
      });

      // 更新評分
      await ArticleModel.update(id, {
        quality_score: qualityReport.overall_score,
        eeat_score: qualityReport.eeat_score,
        seo_score: qualityReport.seo_score
      });

      res.json({
        message: 'Quality check completed',
        data: qualityReport
      });
    } catch (error) {
      console.error('Quality check error:', error);
      res.status(500).json({ error: 'Failed to perform quality check' });
    }
  }

  /**
   * 取得文章列表
   * GET /api/articles?project_id=xxx
   */
  static async getArticles(req, res) {
    try {
      const { project_id, status } = req.query;

      if (!project_id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const articles = await ArticleModel.findByProjectId(project_id, { status });
      const statistics = await ArticleModel.getStatsByProject(project_id);

      res.json({
        message: 'Articles retrieved successfully',
        data: articles,
        statistics
      });
    } catch (error) {
      console.error('Get articles error:', error);
      res.status(500).json({ error: 'Failed to retrieve articles' });
    }
  }

  /**
   * 取得單一文章
   * GET /api/articles/:id
   */
  static async getArticleById(req, res) {
    try {
      const { id } = req.params;

      const article = await ArticleModel.findById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json({
        message: 'Article retrieved successfully',
        data: {
          ...article,
          content: article.content_draft // Map for frontend
        }
      });
    } catch (error) {
      console.error('Get article error:', error);
      res.status(500).json({ error: 'Failed to retrieve article' });
    }
  }

  /**
   * 更新文章
   * PUT /api/articles/:id
   */
  static async updateArticle(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const article = await ArticleModel.findById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedArticle = await ArticleModel.update(id, updates);

      res.json({
        message: 'Article updated successfully',
        data: updatedArticle
      });
    } catch (error) {
      console.error('Update article error:', error);
      res.status(500).json({ error: 'Failed to update article' });
    }
  }

  /**
   * 刪除文章
   * DELETE /api/articles/:id
   */
  static async deleteArticle(req, res) {
    try {
      const { id } = req.params;

      const article = await ArticleModel.findById(id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // 驗證權限
      const project = await ProjectModel.findById(article.project_id);
      if (!project || project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await ArticleModel.delete(id);

      res.json({
        message: 'Article deleted successfully'
      });
    } catch (error) {
      console.error('Delete article error:', error);
      res.status(500).json({ error: 'Failed to delete article' });
    }
  }
}

module.exports = ArticleController;
