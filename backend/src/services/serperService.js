const axios = require('axios');

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_BASE_URL = 'https://google.serper.dev';

const SERPER_TIMEOUT_MS = Number(process.env.SERPER_TIMEOUT_MS || 15000);
const SERPER_MAX_RETRIES = Number(process.env.SERPER_MAX_RETRIES || 2);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const serperHttp = axios.create({
  timeout: SERPER_TIMEOUT_MS
});

class SerperService {
  /**
   * 執行 Google 搜尋（SERP 分析）
   */
  static async search(query, options = {}) {
    try {
      const {
        num = 10,        // 結果數量
        gl = 'tw',       // 地區（台灣）
        hl = 'zh-TW',    // 語言
        type = 'search'  // search, news, images
      } = options;

      const url = `${SERPER_BASE_URL}/${type}`;
      const payload = { q: query, num, gl, hl };
      const config = {
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json'
        }
      };

      let lastError;
      for (let attempt = 0; attempt <= SERPER_MAX_RETRIES; attempt++) {
        try {
          const response = await serperHttp.post(url, payload, config);
          return response.data;
        } catch (error) {
          lastError = error;
          const status = error.response?.status;
          const code = error.code;
          const isRetryableHttp = status === 429 || (status >= 500 && status < 600);
          const isRetryableNetwork = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'ENOTFOUND'].includes(code);

          if (attempt >= SERPER_MAX_RETRIES || (!isRetryableHttp && !isRetryableNetwork)) {
            break;
          }

          // 指數退避 + 少量抖動，降低觸發 rate limit
          const backoffMs = Math.min(4000, 600 * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
          await sleep(backoffMs);
        }
      }

      console.error('Serper API Error:', lastError.response?.data || lastError.message);
      throw new Error('Failed to fetch search results');
    } catch (error) {
      console.error('Serper API Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch search results');
    }
  }

  /**
   * 分析關鍵字的 SERP 結果（提取競爭對手內容結構）
   */
  static async analyzeKeyword(keyword) {
    try {
      const searchResults = await this.search(keyword, { num: 10 });

      // 提取有機搜尋結果
      const organicResults = searchResults.organic || [];

      // 評估每個結果的可信度與相關性
      const enrichedResults = organicResults.slice(0, 10).map(result => {
        const credibilityScore = this.calculateCredibilityScore(result.link);
        const relevanceScore = this.calculateRelevanceScore(keyword, result.title, result.snippet);
        
        // 判斷是否為高品質結果
        // 放寬判定標準，避免過濾掉所有結果
        // 1. 可信度高且相關性及格 (60/20) - 降低相關性門檻
        // 2. 可信度極高（權威媒體）且相關性尚可 (80/15)
        // 3. 相關性極高且可信度及格 (50/40)
        const isHighQuality = (credibilityScore >= 60 && relevanceScore >= 20) || 
                              (credibilityScore >= 80 && relevanceScore >= 15) ||
                              (credibilityScore >= 50 && relevanceScore >= 40);

        return {
          position: result.position,
          title: result.title,
          link: result.link,
          snippet: result.snippet,
          date: result.date,
          credibility_score: credibilityScore,
          relevance_score: relevanceScore,
          is_high_quality: isHighQuality
        };
      });

      // 過濾低品質結果
      const filteredResults = enrichedResults.filter(r => r.is_high_quality);

      // 分析結果
      const analysis = {
        keyword,
        totalResults: searchResults.searchInformation?.totalResults || 0,
        topResults: filteredResults,
        allResults: enrichedResults, // 保留所有結果供參考
        peopleAlsoAsk: searchResults.peopleAlsoAsk || [],
        relatedSearches: searchResults.relatedSearches || [],
        // 提取常見內容結構特徵
        contentPatterns: this.extractContentPatterns(filteredResults),
        qualityMetrics: {
          total_results: enrichedResults.length,
          high_quality_results: filteredResults.length,
          avg_credibility: this.calculateAverage(enrichedResults.map(r => r.credibility_score)),
          avg_relevance: this.calculateAverage(enrichedResults.map(r => r.relevance_score))
        }
      };

      return analysis;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 批量分析多個關鍵字
   */
  static async analyzeKeywordBatch(keywords, delay = 1000) {
    const results = [];

    for (const keyword of keywords) {
      try {
        const analysis = await this.analyzeKeyword(keyword);
        results.push({
          keyword,
          success: true,
          data: analysis
        });

        // 避免觸發 rate limit
        if (keywords.indexOf(keyword) < keywords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        results.push({
          keyword,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * 提取內容結構特徵（分析標題與摘要）
   */
  static extractContentPatterns(organicResults) {
    const titleKeywords = new Map();
    const snippetKeywords = new Map();

    organicResults.forEach(result => {
      // 簡單的關鍵詞頻率統計（實際應用可用更精細的 NLP）
      const titleWords = result.title?.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [];
      const snippetWords = result.snippet?.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || [];

      titleWords.forEach(word => {
        if (word.length > 1) {
          titleKeywords.set(word, (titleKeywords.get(word) || 0) + 1);
        }
      });

      snippetWords.forEach(word => {
        if (word.length > 1) {
          snippetKeywords.set(word, (snippetKeywords.get(word) || 0) + 1);
        }
      });
    });

    // 轉換為陣列並排序
    const topTitleKeywords = Array.from(titleKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word, count]) => ({ word, count }));

    const topSnippetKeywords = Array.from(snippetKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    return {
      topTitleKeywords,
      topSnippetKeywords
    };
  }

  /**
   * 取得相關搜尋建議
   */
  static async getRelatedSearches(keyword) {
    try {
      const searchResults = await this.search(keyword);
      return {
        peopleAlsoAsk: searchResults.peopleAlsoAsk || [],
        relatedSearches: searchResults.relatedSearches || []
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 計算來源可信度分數 (0-100)
   * 根據網域名評估可信度
   */
  static calculateCredibilityScore(url) {
    if (!url) return 50; // 預設中等分數

    const urlLower = url.toLowerCase();

    // 最高可信度：政府與教育機構 (90-100)
    if (urlLower.includes('.gov.tw') || urlLower.includes('.gov')) return 95;
    if (urlLower.includes('.edu.tw') || urlLower.includes('.edu')) return 92;
    if (urlLower.includes('.ac.') || urlLower.includes('scholar.google')) return 90;

    // 高可信度：知名媒體與專業網站 (75-89)
    const reputableDomains = [
      'wikipedia.org', 'bbc.com', 'nytimes.com', 'reuters.com',
      'nature.com', 'science.org', 'ncbi.nlm.nih.gov', 'who.int',
      'cdc.gov', 'mayo.clinic', 'webmd.com', 'healthline.com',
      // 台灣權威媒體與健康網站
      'commonhealth.com.tw', 'heho.com.tw', 'helloyishi.com.tw',
      'edh.tw', 'top1health.com', 'health.udn.com', 'cw.com.tw',
      'businessweekly.com.tw', 'cna.com.tw', 'storm.mg', 'ettoday.net',
      'news.yahoo.com', 'mohw.gov.tw', 'taichung.gov.tw', 'ntuh.gov.tw'
    ];
    if (reputableDomains.some(domain => urlLower.includes(domain))) return 85;

    // 醫療健康相關關鍵字加分
    if (urlLower.includes('health') || urlLower.includes('med') || urlLower.includes('hosp') || urlLower.includes('clinic')) {
      return 75;
    }

    // 中等可信度：一般新聞與內容網站 (60-74)
    if (urlLower.includes('medium.com') || urlLower.includes('forbes.com')) return 70;
    if (urlLower.includes('.com') || urlLower.includes('.org')) return 65;

    // 低可信度：部落格、個人網站 (40-59)
    if (urlLower.includes('blog') || urlLower.includes('wordpress')) return 55;
    if (urlLower.includes('blogspot') || urlLower.includes('tumblr')) return 50;

    // 非常低：論壇、社交媒體 (30-39)
    if (urlLower.includes('reddit.com') || urlLower.includes('quora.com')) return 40;
    if (urlLower.includes('facebook.com') || urlLower.includes('twitter.com')) return 35;

    return 60; // 預設分數
  }

  /**
   * 計算內容相關性分數 (0-100)
   * 檢查關鍵字在標題和摘要中的出現情況
   */
  static calculateRelevanceScore(keyword, title, snippet) {
    if (!keyword || (!title && !snippet)) return 0;

    const keywordLower = keyword.toLowerCase();
    const titleLower = (title || '').toLowerCase();
    const snippetLower = (snippet || '').toLowerCase();
    const isChinese = /[\u4e00-\u9fa5]/.test(keywordLower);

    // Debug Log
    // console.log(`[Relevance] Key: ${keyword}, Title: ${title}, Score Start`);

    let score = 0;

    // 輔助函數：計算中文 Bigram 匹配率
    const calculateBigramMatch = (text, key) => {
      if (!key || key.length < 2) return 0;
      let matchCount = 0;
      let bigramCount = 0;
      for (let i = 0; i < key.length - 1; i++) {
        const bigram = key.substring(i, i + 2);
        bigramCount++;
        if (text.includes(bigram)) {
          matchCount++;
        }
      }
      return bigramCount > 0 ? matchCount / bigramCount : 0;
    };

    // 輔助函數：關鍵字單詞匹配 (Token Match)
    const calculateTokenMatch = (text, key) => {
      // 簡單分詞：移除常見虛詞，保留實詞
      const tokens = key.replace(/[如何|怎麼|什麼|的|了|嗎]/g, ' ').split(/\s+/).filter(t => t.length >= 1);
      let matchedTokens = 0;
      tokens.forEach(token => {
        if (text.includes(token)) matchedTokens++;
      });
      return tokens.length > 0 ? matchedTokens / tokens.length : 0;
    };

    // 標題包含關鍵字 (+50)
    if (titleLower.includes(keywordLower)) {
      score += 50;
    } else {
      if (isChinese) {
        // 中文 Bigram 匹配
        const matchRate = calculateBigramMatch(titleLower, keywordLower);
        // 中文 Token 匹配 (補救 Bigram 失敗的情況)
        const tokenRate = calculateTokenMatch(titleLower, keywordLower);
        
        const effectiveRate = Math.max(matchRate, tokenRate);

        if (effectiveRate > 0.6) score += 45;
        else if (effectiveRate > 0.4) score += 35;
        else if (effectiveRate > 0.2) score += 25;
        else if (effectiveRate > 0.1) score += 15;
      } else {
        // 英文/空格分隔語言的部分匹配
        const keywordWords = keywordLower.split(/\s+/);
        const matchedWords = keywordWords.filter(word => titleLower.includes(word));
        score += (matchedWords.length / keywordWords.length) * 25;
      }
    }

    // 摘要包含關鍵字 (+30)
    if (snippetLower.includes(keywordLower)) {
      score += 30;
    } else {
      if (isChinese) {
        // 中文 Bigram 匹配
        const matchRate = calculateBigramMatch(snippetLower, keywordLower);
        const tokenRate = calculateTokenMatch(snippetLower, keywordLower);
        const effectiveRate = Math.max(matchRate, tokenRate);

        if (effectiveRate > 0.6) score += 25;
        else if (effectiveRate > 0.4) score += 20;
        else if (effectiveRate > 0.2) score += 15;
        else if (effectiveRate > 0.1) score += 10;
      } else {
        // 英文/空格分隔語言的部分匹配
        const keywordWords = keywordLower.split(/\s+/);
        const matchedWords = keywordWords.filter(word => snippetLower.includes(word));
        score += (matchedWords.length / keywordWords.length) * 15;
      }
    }

    // 標題長度合理性 (+10)
    if (title && title.length >= 10 && title.length <= 80) { // 放寬中文標題長度下限
      score += 10;
    }

    // 摘要長度合理性 (+10)
    if (snippet && snippet.length >= 30 && snippet.length <= 300) { // 放寬中文摘要長度下限
      score += 10;
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * 資訊去重（基於標題相似度）
   */
  static deduplicateResults(results) {
    if (!results || results.length === 0) return [];

    const uniqueResults = [];
    const seenTitles = new Set();

    for (const result of results) {
      // 標準化標題（移除空白、轉小寫）
      const normalizedTitle = (result.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
      
      // 檢查是否已存在相似標題
      let isDuplicate = false;
      for (const seenTitle of seenTitles) {
        if (this.calculateSimilarity(normalizedTitle, seenTitle) > 0.8) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueResults.push(result);
        seenTitles.add(normalizedTitle);
      }
    }

    return uniqueResults;
  }

  /**
   * 計算兩個字串的相似度 (0-1)
   * 使用簡單的 Jaccard 相似度
   */
  static calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * 計算平均值
   */
  static calculateAverage(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sum = numbers.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / numbers.length) * 10) / 10;
  }
}

module.exports = SerperService;
