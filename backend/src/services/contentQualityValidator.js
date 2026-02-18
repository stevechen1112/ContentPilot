/**
 * 內容品質驗證器 - 領域無關的通用標準
 * 適用於所有主題的文章生成
 */

class ContentQualityValidator {
  /**
   * 通用品質標準（適用所有領域）
   */
  static QUALITY_STANDARDS = {
    // 結構標準
    structure: {
      minWordsPerH3: 200,
      maxWordsPerH3: 600,
      minH3PerSection: 1,
      maxH3PerSection: 3
    },

    // 必須包含的元素（領域無關）
    requiredElements: {
      // 每個段落必須有具體內容（數字、名稱、場景）
      concreteDetails: {
        min: 2,
        patterns: [
          /\d+%/,                    // 百分比數據
          /\d+個/,                   // 數量
          /\d+年/,                   // 時間
          /例如|譬如|比如/,           // 舉例標記
          /步驟[一二三四五1-5]/,     // 步驟標記
          /[A-Z][a-z]+|[A-Za-z0-9]+/ // 專有名詞（英文）
        ]
      },

      // 可執行建議（行動導向）
      actionableAdvice: {
        min: 1,
        patterns: [
          /建議|推薦|可以|應該/,
          /步驟|方法|技巧/,
          /注意|避免|記住/
        ]
      },

      // 對比或比較
      contrastComparison: {
        min: 0, // 不強制，但鼓勵
        patterns: [
          /相比|對比|而/,
          /但|然而|不過/,
          /優點|缺點|差異/
        ]
      }
    },

    // 禁止的空泛用詞
    bannedPhrases: {
      vagueDescriptions: [
        '深入探討', '全面解析', '詳細分析',
        '值得注意', '不容忽視', '至關重要',
        '非常重要', '相當關鍵', '十分顯著',
        '需要仔細考量', '這很重要', '這是必要的'
      ],
      weakVerbs: [
        '進行了解', '執行操作', '實施計畫',
        '開展工作', '推動發展'
      ],
      fillerWords: [
        '眾所周知', '毋庸置疑', '顯而易見',
        '不言而喻', '理所當然'
      ]
    },

    // HTML 格式規範
    htmlFormat: {
      requiredTags: ['h3', 'p'],
      allowedTags: ['h3', 'p', 'ul', 'ol', 'li', 'strong', 'a'],
      forbiddenTags: ['h1', 'h2'], // section 中不應該有 h2
      attributeRules: {
        'a': ['href', 'target', 'rel'] // a 標籤只允許這些屬性
      }
    }
  };

  /**
   * 验证段落内容质量
   */
  static validateSectionContent(html, plainText) {
    const errors = [];
    const warnings = [];
    const stats = {
      wordCount: this.countWords(plainText),
      h3Count: (html.match(/<h3>/g) || []).length,
      hasConcreteDetails: false,
      hasActionableAdvice: false,
      hasBannedPhrases: false
    };

    // 1. 检查字数
    if (stats.wordCount < 150) {
      errors.push(`内容过短: ${stats.wordCount}字 (最低150字)`);
    }

    // 2. 检查H3数量
    if (stats.h3Count < this.QUALITY_STANDARDS.structure.minH3PerSection) {
      errors.push(`缺少子标题: ${stats.h3Count}个 (至少${this.QUALITY_STANDARDS.structure.minH3PerSection}个)`);
    }
    if (stats.h3Count > this.QUALITY_STANDARDS.structure.maxH3PerSection) {
      warnings.push(`子标题过多: ${stats.h3Count}个 (建议不超过${this.QUALITY_STANDARDS.structure.maxH3PerSection}个)`);
    }

    // 3. 检查是否有具体细节
    const concreteMatches = this.QUALITY_STANDARDS.requiredElements.concreteDetails.patterns
      .filter(pattern => pattern.test(plainText));
    
    stats.hasConcreteDetails = concreteMatches.length >= this.QUALITY_STANDARDS.requiredElements.concreteDetails.min;
    
    if (!stats.hasConcreteDetails) {
      errors.push(`缺少具体细节: 需要包含数字、案例或专有名词 (至少${this.QUALITY_STANDARDS.requiredElements.concreteDetails.min}个)`);
    }

    // 4. 检查是否有可执行建议
    const actionableMatches = this.QUALITY_STANDARDS.requiredElements.actionableAdvice.patterns
      .filter(pattern => pattern.test(plainText));
    
    stats.hasActionableAdvice = actionableMatches.length >= this.QUALITY_STANDARDS.requiredElements.actionableAdvice.min;
    
    if (!stats.hasActionableAdvice) {
      warnings.push('缺少可执行建议: 建议包含具体的行动指引');
    }

    // 5. 检查禁用词
    const bannedFound = [];
    Object.values(this.QUALITY_STANDARDS.bannedPhrases).forEach(phraseList => {
      phraseList.forEach(phrase => {
        if (plainText.includes(phrase)) {
          bannedFound.push(phrase);
        }
      });
    });

    if (bannedFound.length > 0) {
      stats.hasBannedPhrases = true;
      warnings.push(`发现空泛用词: ${bannedFound.slice(0, 3).join(', ')}${bannedFound.length > 3 ? '...' : ''}`);
    }

    // 6. 检查HTML格式
    const htmlErrors = this.validateHtmlFormat(html);
    errors.push(...htmlErrors);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      stats
    };
  }

  /**
   * 驗證 HTML 格式規範
   */
  static validateHtmlFormat(html) {
    const errors = [];

    // 檢查是否包含禁止的標籤
    this.QUALITY_STANDARDS.htmlFormat.forbiddenTags.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
      if (regex.test(html)) {
        errors.push(`不應包含 <${tag}> 標籤`);
      }
    });

    // 檢查是否以 H2 開頭（section 不應該重複標題）
    if (/^\s*<h2>/i.test(html)) {
      errors.push('內容不應以 <h2> 開頭（系統會自動添加）');
    }

    // 檢查是否有未閉合的標籤
    const openTags = (html.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (html.match(/<\/[^>]+>/g) || []).length;
    if (openTags !== closeTags) {
      errors.push('HTML 標籤未正確閉合');
    }

    return errors;
  }

  /**
   * 計算字數（中文+英文）
   */
  static countWords(text) {
    // 移除 HTML 標籤
    const plainText = text.replace(/<[^>]+>/g, '');
    // 計算中文字元
    const chineseChars = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
    // 計算英文單詞
    const englishWords = (plainText.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 產生品質回饋報告（用於重新生成時的 Prompt）
   */
  static generateFeedback(validationResult) {
    if (validationResult.passed) {
      return '內容品質良好';
    }

    let feedback = '**上次生成的內容存在以下問題，請改進：**\n\n';
    
    if (validationResult.errors.length > 0) {
      feedback += '❌ 必須修正的問題：\n';
      validationResult.errors.forEach((error, i) => {
        feedback += `${i + 1}. ${error}\n`;
      });
      feedback += '\n';
    }

    if (validationResult.warnings.length > 0) {
      feedback += '⚠️ 建議改進的地方：\n';
      validationResult.warnings.forEach((warning, i) => {
        feedback += `${i + 1}. ${warning}\n`;
      });
      feedback += '\n';
    }

    // 添加具體改進建議
    feedback += '**改進建議：**\n';
    
    if (!validationResult.stats.hasConcreteDetails) {
      feedback += '- 添加具體的數字、百分比、案例名稱或專有名詞\n';
    }
    
    if (!validationResult.stats.hasActionableAdvice) {
      feedback += '- 提供明確的操作步驟或建議（「建議...」、「可以...」、「步驟...」）\n';
    }
    
    if (validationResult.stats.hasBannedPhrases) {
      feedback += '- 刪除空泛描述，改用具體說明\n';
    }

    if (validationResult.stats.wordCount < 200) {
      feedback += '- 擴充內容，每個 H3 至少 200 字\n';
    }

    return feedback;
  }

  /**
   * 驗證引言品質
   */
  static validateIntroduction(html, plainText) {
    const errors = [];
    const warnings = [];
    
    const wordCount = this.countWords(plainText);
    
    // 引言字數檢查（較寬鬆）
    if (wordCount < 80) {
      errors.push(`引言過短: ${wordCount}字 (建議至少80字)`);
    }
    
    if (wordCount > 250) {
      warnings.push(`引言過長: ${wordCount}字 (建議不超過250字)`);
    }

    // 檢查是否包含 hook 元素
    const hasQuestion = /[？?]/.test(plainText);
    const hasStatistic = /\d+%|\d+個/.test(plainText);
    const hasPainPoint = /困擾|問題|挑戰|難題/.test(plainText);
    
    if (!hasQuestion && !hasStatistic && !hasPainPoint) {
      warnings.push('建議添加吸引讀者的元素：問題、數據或痛點');
    }

    // HTML 格式檢查
    const htmlErrors = this.validateHtmlFormat(html);
    errors.push(...htmlErrors);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      stats: { wordCount }
    };
  }

  /**
   * 驗證結論品質
   */
  static validateConclusion(html, plainText) {
    const errors = [];
    const warnings = [];
    
    const wordCount = this.countWords(plainText);
    
    if (wordCount < 80) {
      errors.push(`結論過短: ${wordCount}字 (建議至少80字)`);
    }

    // 檢查是否有 CTA
    const hasCTA = /立即|開始|現在|嘗試|實踐/.test(plainText);
    if (!hasCTA) {
      warnings.push('建議添加明確的行動呼籲（CTA）');
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
      stats: { wordCount }
    };
  }
}

module.exports = ContentQualityValidator;
