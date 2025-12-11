/**
 * 内容质量验证器 - 领域无关的通用标准
 * 适用于所有主题的文章生成
 */

class ContentQualityValidator {
  /**
   * 通用质量标准（适用所有领域）
   */
  static QUALITY_STANDARDS = {
    // 结构标准
    structure: {
      minWordsPerH3: 200,
      maxWordsPerH3: 600,
      minH3PerSection: 1,
      maxH3PerSection: 3
    },

    // 必须包含的元素（领域无关）
    requiredElements: {
      // 每个段落必须有具体内容（数字、名称、场景）
      concreteDetails: {
        min: 2,
        patterns: [
          /\d+%/,                    // 百分比数据
          /\d+个/,                   // 数量
          /\d+年/,                   // 时间
          /例如|譬如|比如/,           // 举例标记
          /步骤[一二三四五1-5]/,     // 步骤标记
          /[A-Z][a-z]+|[A-Za-z0-9]+/ // 专有名词（英文）
        ]
      },

      // 可执行建议（行动导向）
      actionableAdvice: {
        min: 1,
        patterns: [
          /建議|推薦|可以|應該/,
          /步驟|方法|技巧/,
          /注意|避免|記住/
        ]
      },

      // 对比或比较
      contrastComparison: {
        min: 0, // 不强制，但鼓励
        patterns: [
          /相比|對比|而/,
          /但|然而|不過/,
          /優點|缺點|差異/
        ]
      }
    },

    // 禁止的空泛用词
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

    // HTML格式规范
    htmlFormat: {
      requiredTags: ['h3', 'p'],
      allowedTags: ['h3', 'p', 'ul', 'ol', 'li', 'strong', 'a'],
      forbiddenTags: ['h1', 'h2'], // section中不应该有h2
      attributeRules: {
        'a': ['href', 'target', 'rel'] // a标签只允许这些属性
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
   * 验证HTML格式规范
   */
  static validateHtmlFormat(html) {
    const errors = [];

    // 检查是否包含禁止的标签
    this.QUALITY_STANDARDS.htmlFormat.forbiddenTags.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>`, 'gi');
      if (regex.test(html)) {
        errors.push(`不应包含 <${tag}> 标签`);
      }
    });

    // 检查是否以H2开头（section不应该重复标题）
    if (/^\s*<h2>/i.test(html)) {
      errors.push('内容不应以 <h2> 开头（系统会自动添加）');
    }

    // 检查是否有未闭合的标签
    const openTags = (html.match(/<[^/][^>]*>/g) || []).length;
    const closeTags = (html.match(/<\/[^>]+>/g) || []).length;
    if (openTags !== closeTags) {
      errors.push('HTML标签未正确闭合');
    }

    return errors;
  }

  /**
   * 计算字数（中文+英文）
   */
  static countWords(text) {
    // 移除HTML标签
    const plainText = text.replace(/<[^>]+>/g, '');
    // 计算中文字符
    const chineseChars = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
    // 计算英文单词
    const englishWords = (plainText.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 生成质量反馈报告（用于重新生成时的Prompt）
   */
  static generateFeedback(validationResult) {
    if (validationResult.passed) {
      return '内容质量良好';
    }

    let feedback = '**上次生成的内容存在以下问题，请改进：**\n\n';
    
    if (validationResult.errors.length > 0) {
      feedback += '❌ 必须修正的问题：\n';
      validationResult.errors.forEach((error, i) => {
        feedback += `${i + 1}. ${error}\n`;
      });
      feedback += '\n';
    }

    if (validationResult.warnings.length > 0) {
      feedback += '⚠️ 建议改进的地方：\n';
      validationResult.warnings.forEach((warning, i) => {
        feedback += `${i + 1}. ${warning}\n`;
      });
      feedback += '\n';
    }

    // 添加具体改进建议
    feedback += '**改进建议：**\n';
    
    if (!validationResult.stats.hasConcreteDetails) {
      feedback += '- 添加具体的数字、百分比、案例名称或专有名词\n';
    }
    
    if (!validationResult.stats.hasActionableAdvice) {
      feedback += '- 提供明确的操作步骤或建议（"建议..."、"可以..."、"步骤..."）\n';
    }
    
    if (validationResult.stats.hasBannedPhrases) {
      feedback += '- 删除空泛描述，改用具体说明\n';
    }

    if (validationResult.stats.wordCount < 200) {
      feedback += '- 扩充内容，每个H3至少200字\n';
    }

    return feedback;
  }

  /**
   * 验证引言质量
   */
  static validateIntroduction(html, plainText) {
    const errors = [];
    const warnings = [];
    
    const wordCount = this.countWords(plainText);
    
    // 引言字数检查（较宽松）
    if (wordCount < 80) {
      errors.push(`引言过短: ${wordCount}字 (建议至少80字)`);
    }
    
    if (wordCount > 250) {
      warnings.push(`引言过长: ${wordCount}字 (建议不超过250字)`);
    }

    // 检查是否包含hook元素
    const hasQuestion = /[？?]/.test(plainText);
    const hasStatistic = /\d+%|\d+个/.test(plainText);
    const hasPainPoint = /困擾|問題|挑戰|難題/.test(plainText);
    
    if (!hasQuestion && !hasStatistic && !hasPainPoint) {
      warnings.push('建议添加吸引读者的元素：问题、数据或痛点');
    }

    // HTML格式检查
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
   * 验证结论质量
   */
  static validateConclusion(html, plainText) {
    const errors = [];
    const warnings = [];
    
    const wordCount = this.countWords(plainText);
    
    if (wordCount < 80) {
      errors.push(`结论过短: ${wordCount}字 (建议至少80字)`);
    }

    // 检查是否有CTA
    const hasCTA = /立即|開始|現在|嘗試|實踐/.test(plainText);
    if (!hasCTA) {
      warnings.push('建议添加明确的行动呼吁（CTA）');
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
