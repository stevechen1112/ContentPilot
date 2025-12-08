const SerperService = require('../services/serperService');
const KeywordModel = require('../models/keywordModel');

class ResearchController {
  /**
   * 分析單一關鍵字的 SERP
   * POST /api/research/analyze-keyword
   */
  static async analyzeKeyword(req, res) {
    try {
      const { keyword } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
      }

      const analysis = await SerperService.analyzeKeyword(keyword);

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
      const { project_id, keywords } = req.body;

      if (!project_id || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'Project ID and keywords array are required' });
      }

      // 執行批量分析
      const analyses = await SerperService.analyzeKeywordBatch(keywords);

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

      // 如果有 project_id，可以選擇直接儲存
      let savedKeywords = [];
      if (project_id && expandedKeywords.length > 0) {
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
