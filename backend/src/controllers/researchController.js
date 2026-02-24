const SerperService = require('../services/serperService');
const KeywordModel = require('../models/keywordModel');
const ProjectModel = require('../models/projectModel');

class ResearchController {
  static clampInt(value, min, max, fallback) {
    const n = Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  /**
   * 分析單一關鍵字的 SERP
   * POST /api/research/analyze-keyword
   */
  static async analyzeKeyword(req, res) {
    try {
      const { keyword, research_multiplier } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
      }

      const multiplier = ResearchController.clampInt(research_multiplier, 1, 4, 1);
      const analysis = await SerperService.analyzeKeyword(keyword, { multiplier });

      res.json({
        message: 'Keyword analysis completed',
        data: analysis
      });
    } catch (error) {
      console.error('Analyze keyword error:', error);
      res.status(500).json({ error: 'Failed to analyze keyword' });
    }
  }

  /**
   * 批量分析關鍵字並儲存到專案
   * POST /api/research/analyze-batch
   */
  static async analyzeBatch(req, res) {
    try {
      const { project_id, keywords, research_multiplier } = req.body;

      if (!project_id || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'Project ID and keywords array are required' });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'Login required for project-bound batch analysis' });
      }

      // 檢查專案所有權
      const project = await ProjectModel.findById(project_id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (project.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden: not your project' });
      }

      // 執行批量分析
      const multiplier = ResearchController.clampInt(research_multiplier, 1, 4, 1);
      const analyses = await SerperService.analyzeKeywordBatch(keywords, 1000, { multiplier });

      // 準備儲存到資料庫的資料
      const keywordsToSave = analyses
        .filter(a => a.success)
        .map(a => ({
          keyword: a.keyword,
          search_volume: parseInt(a.data.totalResults) || null,
          difficulty_score: null, // 可以根據競爭程度計算
          priority: 'medium'
        }));

      // 儲存關鍵字
      let savedKeywords = [];
      if (keywordsToSave.length > 0) {
        savedKeywords = await KeywordModel.createBatch(project_id, keywordsToSave);
      }

      res.json({
        message: 'Batch analysis completed',
        data: {
          analyzed: analyses.length,
          successful: analyses.filter(a => a.success).length,
          failed: analyses.filter(a => !a.success).length,
          savedKeywords: savedKeywords.length,
          details: analyses
        }
      });
    } catch (error) {
      console.error('Analyze batch error:', error);
      res.status(500).json({ error: 'Failed to analyze batch' });
    }
  }

  /**
   * 取得相關搜尋建議
   * GET /api/research/related-searches?keyword=xxx
   */
  static async getRelatedSearches(req, res) {
    try {
      const { keyword } = req.query;

      if (!keyword) {
        return res.status(400).json({ error: 'Keyword query parameter is required' });
      }

      const related = await SerperService.getRelatedSearches(keyword);

      res.json({
        message: 'Related searches retrieved',
        data: related
      });
    } catch (error) {
      console.error('Get related searches error:', error);
      res.status(500).json({ error: 'Failed to get related searches' });
    }
  }

  /**
   * 智能關鍵字擴展（基於主關鍵字生成變體）
   * POST /api/research/expand-keywords
   */
  static async expandKeywords(req, res) {
    try {
      const { seed_keyword, project_id } = req.body;

      if (!seed_keyword) {
        return res.status(400).json({ error: 'Seed keyword is required' });
      }

      // 取得相關搜尋
      const related = await SerperService.getRelatedSearches(seed_keyword);

      // 合併 People Also Ask 和 Related Searches
      const expandedKeywords = [
        ...related.peopleAlsoAsk.map(q => q.question),
        ...related.relatedSearches.map(rs => rs.query)
      ].filter(Boolean);

      // 如果有 project_id，驗證所有權後儲存
      let savedKeywords = [];
      if (project_id && expandedKeywords.length > 0) {
        if (!req.user) {
          return res.status(401).json({ error: 'Login required for project-bound keyword expansion' });
        }

        const project = await ProjectModel.findById(project_id);
        if (!project || project.user_id !== req.user.id) {
          return res.status(403).json({ error: 'Forbidden: not your project' });
        }
        const keywordsToSave = expandedKeywords.map(kw => ({
          keyword: kw,
          priority: 'low' // 擴展的關鍵字預設為低優先級
        }));

        savedKeywords = await KeywordModel.createBatch(project_id, keywordsToSave);
      }

      res.json({
        message: 'Keywords expanded successfully',
        data: {
          seed_keyword,
          expanded_count: expandedKeywords.length,
          keywords: expandedKeywords,
          saved_count: savedKeywords.length
        }
      });
    } catch (error) {
      console.error('Expand keywords error:', error);
      res.status(500).json({ error: 'Failed to expand keywords' });
    }
  }
}

module.exports = ResearchController;
