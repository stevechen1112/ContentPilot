const ArticleModel = require('../models/articleModel');
const ProjectModel = require('../models/projectModel');
const KeywordModel = require('../models/keywordModel');
const OutlineService = require('../services/outlineService');
const ArticleService = require('../services/articleService');
const QualityService = require('../services/qualityService');
const ExperienceGapService = require('../services/experienceGapService');
const {
  normalizeContentBrief,
  validateContentBriefRequiredFields
} = require('../services/contentBrief');

class ArticleController {
  /**
   * 生成文章大綱
   * POST /api/articles/generate-outline
   */
  static async generateOutline(req, res) {
    try {
      const {
        keyword,
        project_id,
        serp_data,
        tone,
        target_audience,
        author_bio,
        author_values,
        unique_angle,
        expected_outline,
        personal_experience,
        brief,
        provider,
        brief_strict
      } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
      }

      // Brief preflight validation (per backend/docs/CONTENT_CONFIG_SCHEMA.md)
      // - If brief_strict=true: reject missing required fields.
      // - Otherwise: accept but apply sensible defaults to reduce drift.
      let effectiveBrief = brief;
      if (brief && typeof brief === 'object') {
        const normalizedNoDefaults = normalizeContentBrief(
          {
            brief,
            keyword,
            tone,
            target_audience,
            author_bio,
            author_values,
            unique_angle,
            expected_outline,
            personal_experience
          },
          { applyDefaults: false }
        );

        const missing = validateContentBriefRequiredFields(normalizedNoDefaults, { keyword });
        if (missing.length && brief_strict === true) {
          return res.status(400).json({
            error: 'Brief missing required fields',
            missing
          });
        }

        effectiveBrief = normalizeContentBrief(
          {
            brief,
            keyword,
            tone,
            target_audience,
            author_bio,
            author_values,
            unique_angle,
            expected_outline,
            personal_experience
          },
          { applyDefaults: true }
        );
      }

      // 如果有 project_id，驗證權限（POC 模式跳過）
      if (project_id && req.user) {
        const project = await ProjectModel.findById(project_id);
      }

      const outline = await OutlineService.generateOutline(keyword, {
        serp_data,
        tone,
        target_audience,
        author_bio,
        author_values,
        unique_angle,
        expected_outline,
        personal_experience,
        brief: effectiveBrief,
        provider
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
      let {
        project_id,
        keyword_id,
        outline,
        serp_data,
        tone,
        target_audience,
        author_bio,
        author_values,
        unique_angle,
        expected_outline,
        personal_experience,
        brief,
        provider,
        brief_strict,
        enable_reader_evaluation
      } = req.body;

      const skipDb = String(process.env.SKIP_DB || '').trim().toLowerCase() === 'true';

      if (!outline) {
        return res.status(400).json({ error: 'Outline is required' });
      }

      // Brief preflight validation (per backend/docs/CONTENT_CONFIG_SCHEMA.md)
      let effectiveBrief = brief;
      if (brief && typeof brief === 'object') {
        const normalizedNoDefaults = normalizeContentBrief(
          {
            brief,
            keyword: outline?.keywords?.primary || outline?.title,
            tone,
            target_audience,
            author_bio,
            author_values,
            unique_angle,
            expected_outline,
            personal_experience
          },
          { applyDefaults: false }
        );

        const missing = validateContentBriefRequiredFields(normalizedNoDefaults, {
          keyword: outline?.keywords?.primary || outline?.title
        });
        if (missing.length && brief_strict === true) {
          return res.status(400).json({
            error: 'Brief missing required fields',
            missing
          });
        }

        effectiveBrief = normalizeContentBrief(
          {
            brief,
            keyword: outline?.keywords?.primary || outline?.title,
            tone,
            target_audience,
            author_bio,
            author_values,
            unique_angle,
            expected_outline,
            personal_experience
          },
          { applyDefaults: true }
        );
      }

      // POC/Local mode: allow generation without database persistence
      if (skipDb) {
        const article = await ArticleService.generateArticle(outline, {
          serp_data,
          style_guide: tone ? { tone } : undefined,
          target_audience,
          author_bio,
          author_values,
          unique_angle,
          expected_outline,
          personal_experience,
          brief: effectiveBrief,
          provider,
          enable_reader_evaluation
        });

        const cleanArticle = JSON.parse(JSON.stringify(article).replace(/\\u0000/g, ''));

        return res.json({
          message: 'Article generated successfully (SKIP_DB=true, not persisted)',
          data: {
            article_id: 'local-preview',
            project_id: project_id || 'local-preview',
            keyword_id: keyword_id || null,
            title: cleanArticle.title,
            quality_report: cleanArticle.quality_report || null,
            content_draft: cleanArticle,
            content: cleanArticle
          }
        });
      }

      // POC 模式：如果沒有 project_id，自動建立一個預設專案（使用固定 UUID 避免類型錯誤）
      if (!project_id) {
        const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';
        try {
          const defaultProject = await ProjectModel.create({
            name: '快速生成',
            description: 'Auto-created for quick generation',
            user_id: DEFAULT_USER_ID,
            niche: 'general',
            target_audience: target_audience || '一般讀者'
          });

          if (!defaultProject) {
            console.error('Failed to create default project: ProjectModel returned null/undefined');
            throw new Error('Database error: Failed to create project');
          }

          project_id = defaultProject.id;
        } catch (dbError) {
          console.error('Database error in project creation:', dbError);
          // 嘗試查找現有的預設專案作為 fallback
          const projects = await ProjectModel.findByUserId(DEFAULT_USER_ID);
          if (projects && projects.length > 0) {
            project_id = projects[0].id;
          } else {
            return res.status(500).json({ error: 'System initialization failed: Cannot create project' });
          }
        }
      }

      // 生成文章（傳遞 serp_data 以供 E-E-A-T 和 SEO 優化使用）
      const article = await ArticleService.generateArticle(outline, {
        serp_data,
        style_guide: tone ? { tone } : undefined,
        target_audience,
        author_bio,
        author_values,
        unique_angle,
        expected_outline,
        personal_experience,
        brief: effectiveBrief,
        provider,
        enable_reader_evaluation
      });

      // 清理 PostgreSQL 不支援的 null 字符 (\u0000)
      const cleanArticle = JSON.parse(
        JSON.stringify(article).replace(/\\u0000/g, '')
      );

      // 儲存到資料庫
      const savedArticle = await ArticleModel.create({
        project_id,
        keyword_id,
        title: cleanArticle.title,
        content_draft: cleanArticle,
      });

      // Helper to ensure content is object
      const ensureObject = (data) => {
        if (typeof data === 'string') {
          try { return JSON.parse(data); } catch (e) { return data; }
        }
        return data;
      };

      // 如果有 keyword_id，更新關鍵字狀態
      if (keyword_id) {
        await KeywordModel.update(keyword_id, { status: 'completed' });
      }

      const safeContent = ensureObject(savedArticle.content_draft);

      res.json({
        message: 'Article generated successfully',
        data: {
          article_id: savedArticle.id,
          ...savedArticle,
          quality_report: safeContent?.quality_report || null,
          content_draft: safeContent,
          content: safeContent // Map content_draft to content for frontend
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
      const { section, outline, provider } = req.body;

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
        { provider: provider || process.env.AI_PROVIDER || 'openai' },
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

      const ensureObject = (data) => {
        if (typeof data === 'string') {
          try { return JSON.parse(data); } catch (e) { return data; }
        }
        return data;
      };

      const safeContent = ensureObject(article.content_draft);

      res.json({
        message: 'Article retrieved successfully',
        data: {
          ...article,
          content_draft: safeContent, // Overwrite with parsed object
          content: safeContent // Map for frontend
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
