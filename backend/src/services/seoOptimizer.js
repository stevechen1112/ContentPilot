/**
 * SEO 優化服務
 * 負責關鍵字密度優化、標題結構、內部連結等 SEO 相關優化
 */

class SEOOptimizer {
  /**
   * 優化文章的關鍵字密度
   */
  static optimizeKeywordDensity(content, targetKeyword, options = {}) {
    const {
      targetDensity = 0.008, // 目標密度降至 0.8% (避免 Keyword Stuffing)
      minDensity = 0.003,   // 最低密度 0.3%
      maxDensity = 0.012    // 最高密度 1.2%
    } = options;

    if (!content || !targetKeyword) {
      return content;
    }

    // 處理不同類型的輸入
    let isObject = false;
    let originalContent = content;
    
    if (typeof content === 'object') {
      isObject = true;
      content = JSON.stringify(content);
    }

    // 計算當前密度
    const stats = this.calculateKeywordStats(content, targetKeyword);
    const currentDensity = stats.density;

    console.log(`📊 關鍵字「${targetKeyword}」分析:`);
    console.log(`  - 當前出現次數: ${stats.count}次`);
    console.log(`  - 總字數: ${stats.totalChars}字`);
    console.log(`  - 當前密度: ${(currentDensity * 100).toFixed(2)}%`);
    console.log(`  - 目標密度: ${(targetDensity * 100).toFixed(2)}%`);

    // 如果已達標，不需要優化
    if (currentDensity >= minDensity && currentDensity <= maxDensity) {
      console.log('✅ 關鍵字密度已達標，無需優化');
      return originalContent;
    }

    // 密度過低，僅提供建議（不自動修改）
    if (currentDensity < minDensity) {
      const targetCount = Math.ceil(stats.totalChars * targetDensity);
      const needAdd = targetCount - stats.count;
      
      console.log(`⚠️ 關鍵字密度過低，建議增加 ${needAdd} 次（系統不會自動插入）`);
    }

    // 密度過高，僅提供警告
    if (currentDensity > maxDensity) {
      console.log(`⚠️ 關鍵字密度過高 (${(currentDensity * 100).toFixed(2)}%)，建議手動調整`);
    }

    // 恢復原始類型
    if (isObject) {
      try {
        return JSON.parse(content);
      } catch (error) {
        console.error('❌ JSON解析失敗:', error.message);
        return originalContent;
      }
    }

    return content;
  }

  /**
   * 計算關鍵字統計資訊
   */
  static calculateKeywordStats(text, keyword) {
    if (!text || !keyword) {
      return { count: 0, totalChars: 0, density: 0 };
    }

    // 計算總字數（排除HTML標籤和空白）
    const plainText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, '');
    const totalChars = plainText.length;

    // 計算關鍵字出現次數（不區分大小寫）
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.match(regex);
    const count = matches ? matches.length : 0;

    // 計算密度
    const density = totalChars > 0 ? count / totalChars : 0;

    return {
      count,
      totalChars,
      density,
      plainText
    };
  }

  /**
   * 自然地添加關鍵字到內容中
   * ⚠️ 已停用：強制插入關鍵字會導致 Keyword Stuffing
   * 保留此方法僅供參考，實際上不再使用
   */
  static addKeywordNaturally(content, keyword, needAdd) {
    // ❌ 此功能已停用，直接返回原內容
    console.log(`  ℹ️ addKeywordNaturally 已停用，不會自動插入關鍵字`);
    return content;
  }

  /**
   * 找出適合插入關鍵字的位置
   * ⚠️ 已停用：配合 addKeywordNaturally 停用
   */
  static findInsertPositions(content, keyword, maxCount) {
    // ❌ 此功能已停用
    return [];
    const positions = [];

    // 策略1: 在段落開頭插入（<p> 標籤後）
    const paragraphStarts = [...content.matchAll(/<p>\s*/gi)];
    paragraphStarts.forEach(match => {
      if (positions.length < maxCount) {
        const index = match.index + match[0].length;
        const context = content.substring(index, index + 100);
        
        // 檢查附近是否已有關鍵字（避免過度密集）
        const nearbyText = content.substring(Math.max(0, index - 50), index + 50);
        if (!nearbyText.includes(keyword)) {
          positions.push({
            index,
            context,
            type: 'paragraph_start'
          });
        }
      }
    });

    // 策略2: 在 H3 標籤後插入
    const h3Starts = [...content.matchAll(/<\/h3>\s*/gi)];
    h3Starts.forEach(match => {
      if (positions.length < maxCount) {
        const index = match.index + match[0].length;
        const context = content.substring(index, index + 100);
        
        const nearbyText = content.substring(Math.max(0, index - 50), index + 50);
        if (!nearbyText.includes(keyword)) {
          positions.push({
            index,
            context,
            type: 'after_heading'
          });
        }
      }
    });

    // 策略3: 在列表項目前插入
    const listItems = [...content.matchAll(/<li>\s*/gi)];
    listItems.forEach(match => {
      if (positions.length < maxCount * 0.5) { // 列表項目不要太多
        const index = match.index + match[0].length;
        const context = content.substring(index, index + 50);
        
        const nearbyText = content.substring(Math.max(0, index - 50), index + 50);
        if (!nearbyText.includes(keyword)) {
          positions.push({
            index,
            context,
            type: 'list_item'
          });
        }
      }
    });

    // 按位置排序
    positions.sort((a, b) => a.index - b.index);

    return positions.slice(0, maxCount);
  }

  /**
   * 生成自然的關鍵字短語
   * ⚠️ 已停用：這些模板式短語正是關鍵字堆砌的根源
   */
  static generateNaturalPhrase(keyword, context, type) {
    // ❌ 此功能已停用
    // 原因：即使使用「自然」模板，仍會產生機械式重複（如「在探討...的過程中」）
    console.log(`  ℹ️ generateNaturalPhrase 已停用`);
    return null;
  }

  /**
   * 分析並優化整篇文章的 SEO 結構
   * 🆕 改為「驗證器」角色：僅檢查和提供建議，不自動修改內容
   */
  static optimizeArticleStructure(article, options = {}) {
    const {
      targetKeyword = '',
      targetDensity = 0.01,
      domain = 'health'
    } = options;

    console.log('🔍 開始 SEO 結構驗證...');

    if (!article || !targetKeyword) {
      console.log('⚠️ 缺少文章內容或目標關鍵字，跳過驗證');
      return article;
    }

    try {
      // ✅ 保留：生成 SEO 報告（僅統計，不修改）
      const seoReport = this.generateSEOReport(article, targetKeyword);
      console.log('\n📊 SEO 驗證報告:');
      console.log(`  - 總字數: ${seoReport.totalWords}`);
      console.log(`  - 關鍵字出現次數: ${seoReport.keywordCount}`);
      console.log(`  - 關鍵字密度: ${seoReport.keywordDensity}%`);
      console.log(`  - H2 數量: ${seoReport.h2Count}`);
      console.log(`  - 外部連結: ${seoReport.externalLinks}`);
      console.log(`  - 內部連結: ${seoReport.internalLinks}`);

      // 🆕 提供優化建議（但不自動修改）
      const suggestions = [];
      const density = parseFloat(seoReport.keywordDensity);
      
      if (density < 0.3) {
        suggestions.push(`關鍵字密度過低 (${seoReport.keywordDensity}%)，建議在內容中自然提及「${targetKeyword}」`);
      } else if (density > 1.5) {
        suggestions.push(`⚠️ 關鍵字密度過高 (${seoReport.keywordDensity}%)，可能被視為 Keyword Stuffing`);
      } else {
        console.log(`  ✅ 關鍵字密度正常 (${seoReport.keywordDensity}%)`);
      }

      if (seoReport.h2Count < 3) {
        suggestions.push('H2 標題數量不足，建議至少 3-5 個');
      }

      if (seoReport.externalLinks < 2) {
        suggestions.push('外部連結不足，建議引用 2-5 個權威來源');
      }

      if (suggestions.length > 0) {
        console.log('\n💡 優化建議:');
        suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
      }

      console.log('✅ SEO 結構驗證完成\n');

      // ❌ 移除：不再自動修改內容，直接返回原文章
      return article;

    } catch (error) {
      console.error('❌ SEO 驗證過程中發生錯誤:', error);
      return article;
    }
  }

  /**
   * 生成 SEO 報告
   */
  static generateSEOReport(article, targetKeyword) {
    const fullContent = JSON.stringify(article);
    const stats = this.calculateKeywordStats(fullContent, targetKeyword);

    // 計算標題數量
    const h2Matches = fullContent.match(/<h2>/g);
    const h2Count = h2Matches ? h2Matches.length : 0;

    const h3Matches = fullContent.match(/<h3>/g);
    const h3Count = h3Matches ? h3Matches.length : 0;

    // 計算連結數量
    const externalLinkMatches = fullContent.match(/<a href="http/g);
    const externalLinks = externalLinkMatches ? externalLinkMatches.length : 0;

    const internalLinkMatches = fullContent.match(/<a href="[^h]/g);
    const internalLinks = internalLinkMatches ? internalLinkMatches.length : 0;

    return {
      totalWords: stats.totalChars,
      keywordCount: stats.count,
      keywordDensity: (stats.density * 100).toFixed(2),
      h2Count,
      h3Count,
      externalLinks,
      internalLinks,
      passed: stats.density >= 0.005 && stats.density <= 0.015
    };
  }

  /**
   * 計算總字數
   */
  static calculateTotalWordCount(article) {
    let totalChars = 0;

    if (article.content?.introduction?.plain_text) {
      totalChars += article.content.introduction.plain_text.length;
    }

    if (article.content?.sections) {
      article.content.sections.forEach(section => {
        if (section.plain_text) {
          totalChars += section.plain_text.length;
        }
      });
    }

    if (article.content?.conclusion?.plain_text) {
      totalChars += article.content.conclusion.plain_text.length;
    }

    return totalChars;
  }

  /**
   * 移除 HTML 標籤
   */
  static stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * 檢查 SEO 品質
   */
  static checkSEOQuality(article, targetKeyword) {
    const report = this.generateSEOReport(article, targetKeyword);
    const issues = [];
    const suggestions = [];

    // 檢查關鍵字密度
    const density = parseFloat(report.keywordDensity);
    if (density < 0.5) {
      issues.push('關鍵字密度過低');
      suggestions.push(`增加「${targetKeyword}」的使用頻率至 0.8-1.2%`);
    } else if (density > 2.0) {
      issues.push('關鍵字密度過高，可能被視為關鍵字堆砌');
      suggestions.push(`減少「${targetKeyword}」的使用頻率至 0.8-1.2%`);
    }

    // 檢查標題結構
    if (report.h2Count < 3) {
      issues.push('H2 標題數量不足');
      suggestions.push('建議至少使用 3-5 個 H2 標題');
    }

    // 檢查外部連結
    if (report.externalLinks < 2) {
      issues.push('外部連結不足');
      suggestions.push('建議引用 2-5 個權威外部來源');
    }

    // 檢查字數
    if (report.totalWords < 800) {
      issues.push('文章字數不足');
      suggestions.push('建議至少 1000 字以上');
    }

    return {
      passed: issues.length === 0,
      score: Math.max(0, 100 - issues.length * 20),
      report,
      issues,
      suggestions
    };
  }
}

module.exports = SEOOptimizer;
