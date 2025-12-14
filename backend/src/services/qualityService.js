const AIService = require('./aiService');

class QualityService {
  /**
   * 綜合品質檢查（85分基準線驗證）
   */
  static async comprehensiveQualityCheck(article, options = {}) {
    try {
      const {
        target_keyword = '',
        serp_data = null,
        provider = 'gemini'
      } = options;

      // 並行執行多個檢查
      const [eeatCheck, originalityCheck, seoCheck] = await Promise.all([
        this.checkEEAT(article, provider),
        this.checkOriginality(article),
        this.checkSEO(article, target_keyword)
      ]);

      // 計算綜合分數
      const overallScore = this.calculateOverallScore({
        eeat: eeatCheck.score,
        originality: originalityCheck.score,
        seo: seoCheck.score
      });

      // 生成改進建議
      const improvements = this.generateImprovements({
        eeatCheck,
        originalityCheck,
        seoCheck,
        overallScore
      });

      return {
        overall_score: overallScore,
        pass_threshold: overallScore >= 85,
        checks: {
          eeat: eeatCheck,
          originality: originalityCheck,
          seo: seoCheck
        },
        improvements,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Comprehensive quality check error:', error);
      throw error;
    }
  }

  /**
   * E-E-A-T 檢查清單驗證
   */
  static async checkEEAT(article, provider = 'gemini') {
    const prompt = `你是一位專業的內容品質審核專家。請根據 Google 的 E-E-A-T 標準，檢查以下文章。

## 文章內容
${JSON.stringify(article, null, 2)}

## E-E-A-T 檢查清單

### Experience (經驗) - 25分
- [ ] 包含第一手實際經驗描述
- [ ] 具體的操作步驟或實例
- [ ] 真實的場景與細節
- [ ] 個人見解與反思

### Expertise (專業) - 25分
- [ ] 使用專業術語正確
- [ ] 引用可靠的數據或研究
- [ ] 內容深度足夠
- [ ] 邏輯清晰，論證充分

### Authoritativeness (權威) - 25分
- [ ] 引用權威來源 (.gov, .edu, 知名機構)
- [ ] 提及專家意見或研究
- [ ] 內容引用有可追溯性
- [ ] 來源標註明確

### Trustworthiness (信任) - 25分
- [ ] 資訊準確無誤
- [ ] 避免誇大或誤導性宣稱
- [ ] 提供完整的引用連結
- [ ] 語氣客觀中立

## 評分標準
- 90-100: 優秀，完全符合 E-E-A-T 標準
- 80-89: 良好，大部分符合標準
- 70-79: 及格，需要改進
- <70: 不及格，需要大幅修改

## 輸出格式（JSON）
\`\`\`json
{
  "score": 85,
  "experience": {
    "score": 20,
    "passed": true,
    "issues": ["缺少具體實例"],
    "suggestions": ["建議補充實際操作範例"]
  },
  "expertise": {
    "score": 22,
    "passed": true,
    "issues": [],
    "suggestions": ["可以引用更多專業研究"]
  },
  "authoritativeness": {
    "score": 23,
    "passed": true,
    "issues": [],
    "suggestions": []
  },
  "trustworthiness": {
    "score": 20,
    "passed": true,
    "issues": ["部分來源未標註"],
    "suggestions": ["補充來源連結"]
  },
  "summary": "整體符合 E-E-A-T 標準，建議補充更多實際經驗描述。"
}
\`\`\`

請直接輸出 JSON，不要有其他說明。`;

    const result = await AIService.generate(prompt, { provider, temperature: 0.3 });

    try {
      let cleanContent = result.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '');
      }
      return JSON.parse(cleanContent);
    } catch (error) {
      console.error('Failed to parse E-E-A-T check result:', error);
      return {
        score: 0,
        parse_error: true,
        raw_content: result.content
      };
    }
  }

  /**
   * 原創性檢查
   */
  static async checkOriginality(article) {
    // 簡化版：檢查重複段落和常見模板語句
    const content = this.extractTextContent(article);
    
    // 檢查段落重複
    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 50);
    const uniqueParagraphs = new Set(paragraphs);
    const duplicateRate = (paragraphs.length - uniqueParagraphs.size) / Math.max(paragraphs.length, 1);

    // 檢查常見模板語句
    const templatePhrases = [
      '在本文中，我們將探討',
      '讓我們一起來看看',
      '希望本文對您有所幫助',
      '如果您有任何問題',
      '歡迎留言討論'
    ];

    const templateCount = templatePhrases.filter(phrase => content.includes(phrase)).length;

    // 計算分數
    let score = 100;
    score -= duplicateRate * 50; // 重複率扣分
    score -= templateCount * 5; // 模板語句扣分

    const issues = [];
    if (duplicateRate > 0.1) issues.push(`檢測到 ${(duplicateRate * 100).toFixed(1)}% 的重複段落`);
    if (templateCount > 2) issues.push(`使用了 ${templateCount} 個常見模板語句`);

    return {
      score: Math.max(Math.round(score), 0),
      passed: score >= 80,
      duplicate_rate: Math.round(duplicateRate * 100),
      template_count: templateCount,
      issues,
      suggestions: issues.length > 0 ? ['建議使用更原創的表達方式', '避免重複段落結構'] : []
    };
  }

  /**
   * SEO 檢查
   */
  static async checkSEO(article, targetKeyword) {
    const htmlContent = this.extractHtmlContent(article);
    const textContent = this.extractTextContent(article);
    // SEO 統計採「空白不敏感」：避免 "失眠 怎麼改善" 因為空白而被判定密度 0。
    const normalizedText = textContent.replace(/\s+/g, '');
    const normalizedKeyword = String(targetKeyword || '').replace(/\s+/g, '');
    const wordCount = normalizedText.length;

    console.log('--- SEO Check Debug ---');
    console.log('Target Keyword:', targetKeyword);
    console.log('HTML Content Length:', htmlContent.length);
    console.log('Text Content Length:', textContent.length);
    console.log('HTML Sample:', htmlContent.substring(0, 200));
    
    let score = 100;
    const issues = [];
    const suggestions = [];

    // 關鍵字密度檢查（需 escape + 空白不敏感）
    const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keywordCount = escapedKeyword
      ? (normalizedText.match(new RegExp(escapedKeyword, 'gi')) || []).length
      : 0;
    // 密度計算：KeywordLen * Count / TotalChars
    const keywordDensity = wordCount > 0 ? ((keywordCount * normalizedKeyword.length) / wordCount) * 100 : 0;

    if (keywordDensity < 0.8) { // 提高標準至 0.8% (原 0.5%)
      score -= 10; // 降低扣分權重 (原 15)
      issues.push(`關鍵字密度過低 (${keywordDensity.toFixed(2)}%)`);
      suggestions.push(`增加「${targetKeyword}」的使用頻率，目標密度 0.8%-1.2%`);
    } else if (keywordDensity > 2.5) { // 降低上限 (原 3%)
      score -= 20;
      issues.push(`關鍵字密度過高 (${keywordDensity.toFixed(2)}%)，可能被視為堆砌`);
      suggestions.push('減少關鍵字使用，更自然地融入內容');
    }

    // 字數檢查
    if (wordCount < 1500) { // 提高字數標準 (原 800)
      score -= 20;
      issues.push(`文章字數不足 (${wordCount}字)`);
      suggestions.push('建議至少 1500 字以上以覆蓋完整主題');
    }

    // 標題檢查
    const h2Count = (htmlContent.match(/<h2>/gi) || []).length;
    const h3Count = (htmlContent.match(/<h3>/gi) || []).length;

    if (h2Count < 3) { // 提高標準 (原 2)
      score -= 10;
      issues.push('缺少足夠的 H2 標題');
      suggestions.push('建議至少使用 3-5 個 H2 標題');
    }

    // 連結檢查
    const externalLinks = (htmlContent.match(/<a href="http/gi) || []).length;
    // 內部連結檢查 (如果沒有內部連結系統，暫時放寬扣分)
    const internalLinks = (htmlContent.match(/<a href="\/|<a href="[^h]/gi) || []).length;

    if (externalLinks < 3) { // 提高標準 (原 2)
      score -= 10;
      issues.push('外部連結不足');
      suggestions.push('建議引用 3-5 個權威外部來源');
    }

    if (internalLinks < 1) {
      // score -= 5; // 暫時移除內部連結扣分，直到內部連結系統完善
      suggestions.push('建議添加內部連結以改善網站結構');
    }

    return {
      score: Math.max(Math.round(score), 0),
      passed: score >= 70,
      metrics: {
        word_count: wordCount,
        keyword_density: Math.round(keywordDensity * 10) / 10,
        h2_count: h2Count,
        h3_count: h3Count,
        external_links: externalLinks,
        internal_links: internalLinks
      },
      issues,
      suggestions
    };
  }

  /**
   * 計算綜合分數
   */
  static calculateOverallScore({ eeat, originality, seo }) {
    // 加權平均：E-E-A-T 50%, 原創性 30%, SEO 20%
    const weightedScore = (eeat * 0.5) + (originality * 0.3) + (seo * 0.2);
    return Math.round(weightedScore);
  }

  /**
   * 生成改進建議
   */
  static generateImprovements({ eeatCheck, originalityCheck, seoCheck, overallScore }) {
    const improvements = [];

    // 根據分數添加優先級標記
    if (overallScore < 85) {
      improvements.push({
        priority: '🔴 高',
        category: '整體品質',
        issue: `目前分數 ${overallScore} 分，未達 85 分基準線`,
        action: '請優先處理以下高優先級問題'
      });
    }

    // E-E-A-T 問題
    if (eeatCheck.score < 80) {
      ['experience', 'expertise', 'authoritativeness', 'trustworthiness'].forEach(aspect => {
        const aspectData = eeatCheck[aspect];
        if (aspectData && aspectData.score < 20) {
          aspectData.suggestions?.forEach(suggestion => {
            improvements.push({
              priority: '🔴 高',
              category: `E-E-A-T - ${aspect}`,
              issue: aspectData.issues?.[0] || '需要改進',
              action: suggestion
            });
          });
        }
      });
    }

    // 原創性問題
    if (originalityCheck.score < 80) {
      originalityCheck.suggestions?.forEach(suggestion => {
        improvements.push({
          priority: '🟡 中',
          category: '原創性',
          issue: originalityCheck.issues?.[0] || '原創性不足',
          action: suggestion
        });
      });
    }

    // SEO 問題
    if (seoCheck.score < 70) {
      seoCheck.suggestions?.forEach((suggestion, index) => {
        improvements.push({
          priority: '🟢 低',
          category: 'SEO 優化',
          issue: seoCheck.issues?.[index] || 'SEO 需要改進',
          action: suggestion
        });
      });
    }

    return improvements;
  }

  /**
   * 提取 HTML 內容 (保留標籤)
   */
  static extractHtmlContent(article) {
    let text = '';

    if (typeof article === 'string') {
      text = article;
    } else if (article.content) {
      if (typeof article.content === 'string') {
        text = article.content;
      } else {
        // 處理結構化內容
        if (article.content.introduction) {
          text += article.content.introduction.html || article.content.introduction.plain_text || '';
        }
        if (article.content.sections) {
          article.content.sections.forEach(section => {
            text += section.html || section.plain_text || section.content || '';
          });
        }
        if (article.content.conclusion) {
          text += article.content.conclusion.html || article.content.conclusion.plain_text || '';
        }
      }
    }
    return text;
  }

  /**
   * 提取純文字內容
   */
  static extractTextContent(article) {
    const html = this.extractHtmlContent(article);
    // 移除 HTML 標籤
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

module.exports = QualityService;
