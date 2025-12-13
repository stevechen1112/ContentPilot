/**
 * 競爭對手內容爬取與分析模組
 * 
 * 目的：深度分析排名前3的競爭對手文章，提取以下情報：
 * 1. 內容結構（H1/H2/H3 標題層次）
 * 2. 內容深度（字數、段落數、列表數量）
 * 3. 內容格式（表格、圖片、引用、代碼塊）
 * 4. 內容質量（E-E-A-T 信號、來源引用數量）
 * 5. 用戶體驗（可讀性、視覺元素）
 */

const axios = require('axios');
const cheerio = require('cheerio'); // 需安裝: npm install cheerio

const COMPETITOR_FETCH_TIMEOUT_MS = Number(process.env.COMPETITOR_FETCH_TIMEOUT_MS || 15000);

class CompetitorAnalysisService {
  
  /**
   * 分析競爭對手文章的完整內容結構
   * 
   * 使用場景：
   * - 生成大綱時：參考競爭對手的標題結構
   * - 生成內容時：了解每個段落應該寫多深
   * - 質量檢查時：對比我們的內容是否足夠深入
   */
  static async analyzeCompetitorContent(url) {
    try {
      // 1. 爬取網頁 HTML
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml'
        },
        timeout: COMPETITOR_FETCH_TIMEOUT_MS
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // 2. 提取內容結構
      const structure = this.extractContentStructure($);
      
      // 3. 分析內容深度
      const depth = this.analyzeContentDepth($);
      
      // 4. 檢測 E-E-A-T 信號
      const eeatSignals = this.detectEEATSignals($);
      
      // 5. 分析用戶體驗元素
      const uxElements = this.analyzeUXElements($);

      return {
        url,
        structure,      // 標題層次
        depth,          // 內容深度
        eeatSignals,    // 可信度信號
        uxElements,     // 用戶體驗元素
        crawled_at: new Date()
      };

    } catch (error) {
      console.error(`Failed to analyze competitor: ${url}`, error.message);
      return null;
    }
  }

  /**
   * 提取內容結構（標題層次）
   * 
   * 目的：了解競爭對手如何組織內容
   * 應用：生成大綱時參考這個結構
   */
  static extractContentStructure($) {
    const structure = {
      h1: [],
      h2: [],
      h3: [],
      hierarchy: []  // 完整的層次結構
    };

    // 提取 H1（通常是文章標題）
    $('h1').each((i, el) => {
      const text = $(el).text().trim();
      if (text) structure.h1.push(text);
    });

    // 提取 H2（主要段落標題）
    $('h2').each((i, el) => {
      const text = $(el).text().trim();
      if (text) {
        structure.h2.push(text);
        structure.hierarchy.push({ level: 2, text, index: i });
      }
    });

    // 提取 H3（子段落標題）
    $('h3').each((i, el) => {
      const text = $(el).text().trim();
      if (text) {
        structure.h3.push(text);
        structure.hierarchy.push({ level: 3, text, index: i });
      }
    });

    return structure;
  }

  /**
   * 分析內容深度（字數、段落、元素）
   * 
   * 目的：了解競爭對手投入了多少內容
   * 應用：設定我們的內容目標（至少要匹配或超越）
   */
  static analyzeContentDepth($) {
    // 提取主要內容區域（通常在 article, main, .content 等）
    const mainContent = $('article, main, .content, .post-content, [role="main"]').first();
    
    const depth = {
      total_words: 0,
      total_paragraphs: 0,
      avg_paragraph_length: 0,
      lists: {
        ul_count: 0,
        ol_count: 0,
        total_items: 0
      },
      media: {
        images: 0,
        videos: 0,
        tables: 0
      },
      code_blocks: 0,
      blockquotes: 0
    };

    if (mainContent.length > 0) {
      // 統計段落
      const paragraphs = mainContent.find('p');
      depth.total_paragraphs = paragraphs.length;

      // 統計字數
      let totalWords = 0;
      paragraphs.each((i, el) => {
        const text = $(el).text().trim();
        // 中文字數 + 英文單詞數
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
        totalWords += chineseChars + englishWords;
      });
      depth.total_words = totalWords;
      depth.avg_paragraph_length = Math.round(totalWords / (depth.total_paragraphs || 1));

      // 統計列表
      depth.lists.ul_count = mainContent.find('ul').length;
      depth.lists.ol_count = mainContent.find('ol').length;
      depth.lists.total_items = mainContent.find('li').length;

      // 統計媒體元素
      depth.media.images = mainContent.find('img').length;
      depth.media.videos = mainContent.find('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
      depth.media.tables = mainContent.find('table').length;

      // 統計其他元素
      depth.code_blocks = mainContent.find('pre, code').length;
      depth.blockquotes = mainContent.find('blockquote').length;
    }

    return depth;
  }

  /**
   * 檢測 E-E-A-T 信號（經驗、專業、權威、信任）
   * 
   * 目的：了解競爭對手如何建立可信度
   * 應用：在我們的內容中加入類似的信號
   */
  static detectEEATSignals($) {
    const signals = {
      author_info: false,           // 是否有作者資訊
      publication_date: false,      // 是否有發布日期
      last_updated: false,          // 是否有更新日期
      external_citations: 0,        // 外部來源引用數量
      internal_links: 0,            // 內部連結數量
      expert_quotes: 0,             // 專家引用（粗略估計）
      statistics_data: 0,           // 數據統計（粗略估計）
      credential_keywords: []       // 可信度關鍵詞
    };

    // 檢測作者資訊
    if ($('.author, [rel="author"], .byline, .post-author').length > 0) {
      signals.author_info = true;
    }

    // 檢測日期
    if ($('time, .date, .published, [datetime]').length > 0) {
      signals.publication_date = true;
    }
    if ($('.updated, .modified, [class*="update"]').length > 0) {
      signals.last_updated = true;
    }

    // 統計引用連結
    const mainContent = $('article, main, .content').first();
    if (mainContent.length > 0) {
      // 外部來源（target="_blank" 或 域名不同）
      signals.external_citations = mainContent.find('a[target="_blank"], a[rel*="nofollow"]').length;
      
      // 內部連結
      const allLinks = mainContent.find('a[href^="/"], a[href^="http"]').length;
      signals.internal_links = allLinks - signals.external_citations;
    }

    // 檢測可信度關鍵詞
    const bodyText = $('body').text();
    const credibilityKeywords = [
      '研究顯示', '專家指出', '根據調查', '實驗證明', '數據顯示',
      '學者表示', '報告指出', '分析發現', '證據表明', '統計數據'
    ];
    
    credibilityKeywords.forEach(keyword => {
      const matches = (bodyText.match(new RegExp(keyword, 'g')) || []).length;
      if (matches > 0) {
        signals.credential_keywords.push({ keyword, count: matches });
        signals.expert_quotes += matches;
      }
    });

    // 檢測統計數據（數字 + 百分比）
    const numberPattern = /\d+%|\d+\.\d+%|[0-9,]+\s*(人|次|個|項|條)/g;
    signals.statistics_data = (bodyText.match(numberPattern) || []).length;

    return signals;
  }

  /**
   * 分析用戶體驗元素
   * 
   * 目的：了解競爭對手如何提升可讀性
   * 應用：在內容生成時加入類似的格式建議
   */
  static analyzeUXElements($) {
    return {
      has_table_of_contents: $('[class*="toc"], [id*="toc"], .table-of-contents').length > 0,
      has_summary_box: $('[class*="summary"], [class*="tldr"], [class*="key-points"]').length > 0,
      has_faq_section: $('[class*="faq"], [itemtype*="FAQPage"]').length > 0,
      has_call_to_action: $('[class*="cta"], .button, [class*="action"]').length > 0,
      has_social_share: $('[class*="share"], [class*="social"]').length > 0,
      readability_features: {
        short_paragraphs: true,  // 可進一步分析段落長度
        bullet_points: $('ul, ol').length,
        bold_emphasis: $('strong, b').length,
        headings_used: $('h1, h2, h3, h4, h5, h6').length
      }
    };
  }

  /**
   * 批量分析 SERP 前3名競爭對手
   * 
   * 使用時機：生成大綱前，先分析競爭對手
   */
  static async analyzeTopCompetitors(serpResults, limit = 3) {
    const topCompetitors = serpResults.topResults?.slice(0, limit) || 
                          serpResults.allResults?.slice(0, limit) || [];
    
    const analyses = [];
    
    for (const competitor of topCompetitors) {
      console.log(`分析競爭對手: ${competitor.title}`);
      const analysis = await this.analyzeCompetitorContent(competitor.link);
      
      if (analysis) {
        analyses.push({
          ...competitor,  // 保留原有的 SERP 數據
          content_analysis: analysis
        });
      }
      
      // 延遲避免被封
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return analyses;
  }

  /**
   * 生成內容策略建議（基於競爭對手分析）
   * 
   * 目的：告訴 AI 應該創作什麼樣的內容才能超越競爭對手
   */
  static generateContentStrategy(competitorAnalyses) {
    if (!competitorAnalyses || competitorAnalyses.length === 0) {
      return null;
    }

    // 計算平均值
    const avgWordCount = Math.round(
      competitorAnalyses.reduce((sum, c) => sum + (c.content_analysis?.depth?.total_words || 0), 0) 
      / competitorAnalyses.length
    );

    const avgH2Count = Math.round(
      competitorAnalyses.reduce((sum, c) => sum + (c.content_analysis?.structure?.h2?.length || 0), 0) 
      / competitorAnalyses.length
    );

    const avgListCount = Math.round(
      competitorAnalyses.reduce((sum, c) => sum + (c.content_analysis?.depth?.lists?.ul_count || 0) + (c.content_analysis?.depth?.lists?.ol_count || 0), 0) 
      / competitorAnalyses.length
    );

    const avgImageCount = Math.round(
      competitorAnalyses.reduce((sum, c) => sum + (c.content_analysis?.depth?.media?.images || 0), 0) 
      / competitorAnalyses.length
    );

    const avgCitations = Math.round(
      competitorAnalyses.reduce((sum, c) => sum + (c.content_analysis?.eeatSignals?.external_citations || 0), 0) 
      / competitorAnalyses.length
    );

    // 提取所有 H2 標題（了解競爭對手覆蓋了哪些主題）
    const allH2Titles = competitorAnalyses.flatMap(c => 
      c.content_analysis?.structure?.h2 || []
    );

    return {
      target_word_count: Math.max(avgWordCount * 1.2, avgWordCount + 300), // 超越20%或+300字
      target_h2_count: avgH2Count + 1,  // 比競爭對手多1個段落
      target_list_count: avgListCount + 1,
      target_image_count: avgImageCount,
      target_citations: Math.max(avgCitations + 1, 3),  // 至少3個來源
      
      competitor_topics_covered: allH2Titles,  // 競爭對手覆蓋的主題
      
      content_recommendations: [
        `字數目標: ${Math.round(avgWordCount * 1.2)} 字（競爭對手平均 ${avgWordCount} 字）`,
        `段落數目標: ${avgH2Count + 1} 個 H2 標題（競爭對手平均 ${avgH2Count} 個）`,
        `列表使用: 至少 ${avgListCount + 1} 個列表`,
        `視覺元素: 至少 ${avgImageCount} 張圖片`,
        `來源引用: 至少 ${Math.max(avgCitations + 1, 3)} 個外部來源`,
        '建議增加競爭對手未覆蓋的獨特角度'
      ],
      
      competitive_advantages: this.findCompetitiveGaps(competitorAnalyses)
    };
  }

  /**
   * 找出競爭對手的內容缺口（我們可以補足的點）
   */
  static findCompetitiveGaps(competitorAnalyses) {
    const gaps = [];

    // 檢查是否都沒有 FAQ
    const hasFAQ = competitorAnalyses.some(c => 
      c.content_analysis?.uxElements?.has_faq_section
    );
    if (!hasFAQ) {
      gaps.push('建議增加 FAQ 區塊（競爭對手都沒有）');
    }

    // 檢查是否都沒有總結
    const hasSummary = competitorAnalyses.some(c => 
      c.content_analysis?.uxElements?.has_summary_box
    );
    if (!hasSummary) {
      gaps.push('建議增加重點摘要框（提升可讀性）');
    }

    // 檢查表格使用
    const avgTables = competitorAnalyses.reduce((sum, c) => 
      sum + (c.content_analysis?.depth?.media?.tables || 0), 0
    ) / competitorAnalyses.length;
    
    if (avgTables < 1) {
      gaps.push('建議使用表格整理資訊（競爭對手較少使用）');
    }

    return gaps;
  }
}

module.exports = CompetitorAnalysisService;
