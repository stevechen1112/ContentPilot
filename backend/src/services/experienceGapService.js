const AIService = require('./aiService');

class ExperienceGapService {
  /**
   * 智能檢測經驗缺口（核心功能）
   * 分析每個段落的「體驗空白度」並生成引導式補充提示
   */
  static async detectExperienceGaps(article, options = {}) {
    try {
      const { provider = 'gemini', target_keyword = '' } = options;

      // 提取段落
      const sections = this.extractSections(article);

      // 並行分析各段落經驗空白度（分批，每批最多 3 個避免 API rate limit）
      const BATCH_SIZE = 3;
      const analysisResults = [];
      for (let i = 0; i < sections.length; i += BATCH_SIZE) {
        const batch = sections.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(section => this.analyzeSectionExperience(section, target_keyword, provider))
        );
        analysisResults.push(...batchResults);

        // 批次之間短暫延遲，降低 API 壓力
        if (i + BATCH_SIZE < sections.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // 統計資訊
      const stats = this.calculateStats(analysisResults);

      return {
        gaps: analysisResults,
        statistics: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Experience gap detection error:', error);
      throw error;
    }
  }

  /**
   * 分析單一段落的經驗空白度
   */
  static async analyzeSectionExperience(section, targetKeyword, provider) {
    const prompt = `你是一位專業的內容品質分析師，專門評估文章的「實際經驗」豐富度。

## 任務
分析以下段落，評估其「體驗空白度」，並生成引導式補充提示。

## 段落內容
標題：${section.heading || '無標題'}
內容：
${section.content}

## 目標關鍵字
${targetKeyword}

## 評估標準

### 🟢 低優先級 (80-100分) - 已有足夠經驗
- 包含具體的實際操作步驟
- 有真實的數據或案例
- 描述了親身體驗的細節
- 有個人見解或反思

### 🟡 中優先級 (50-79分) - 經驗描述薄弱
- 內容偏向理論或常識
- 缺少具體實例
- 描述較籠統
- 需要補充實際操作細節

### 🔴 高優先級 (0-49分) - 完全缺乏體驗
- 純理論或抄襲常見內容
- 沒有任何個人經驗
- 空洞的描述
- 讀者無法獲得實用資訊

## 輸出格式（JSON）
\`\`\`json
{
  "score": 45,
  "priority": "🔴",
  "level": "high",
  "gap_type": "缺少實際操作步驟",
  "current_issues": [
    "內容過於理論化",
    "沒有具體案例",
    "缺少實際數據"
  ],
  "guided_prompts": [
    {
      "question": "你在實際使用 [產品/方法] 時，遇到過哪些具體問題？",
      "example": "例如：我在設定時發現介面不直觀，花了10分鐘才找到XX功能。",
      "why": "補充真實遇到的困難，能讓讀者產生共鳴"
    },
    {
      "question": "你能分享一個具體的操作流程嗎？",
      "example": "例如：第一步先開啟XX，然後點選YY，接著會看到ZZ畫面...",
      "why": "具體步驟能幫助讀者實際操作"
    },
    {
      "question": "這個方法實際效果如何？有具體數據嗎？",
      "example": "例如：使用後流量提升了30%，轉換率從2%提高到5%。",
      "why": "數據化的結果更有說服力"
    }
  ],
  "enhancement_suggestions": [
    "補充實際操作的截圖或步驟說明",
    "加入親身經歷的案例",
    "提供具體的數據或成效"
  ]
}
\`\`\`

## 注意事項
1. priority 必須是 "🔴", "🟡", "🟢" 其中之一
2. level 必須是 "high", "medium", "low" 其中之一
3. guided_prompts 至少提供 2-3 個具體問題
4. 每個問題都要有範例和說明原因

請直接輸出 JSON，不要有其他說明。`;

    const result = await AIService.generate(prompt, { provider, temperature: 0.5 });

    try {
      let cleanContent = result.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '');
      }

      const analysis = JSON.parse(cleanContent);

      // 添加段落資訊
      return {
        section_id: section.id,
        section_heading: section.heading,
        section_content: section.content,
        ...analysis
      };
    } catch (error) {
      console.error('Failed to parse experience gap analysis:', error);
      return {
        section_id: section.id,
        section_heading: section.heading,
        score: 50,
        priority: '🟡',
        level: 'medium',
        gap_type: '無法分析',
        parse_error: true,
        raw_content: result.content
      };
    }
  }

  /**
   * 智能融合重寫
   * 將使用者補充的經驗無縫融入原文
   */
  static async smartRewrite(originalContent, userExperience, options = {}) {
    const { provider = 'gemini', section_heading = '' } = options;

    const prompt = `你是一位專業的內容編輯，擅長將個人經驗自然地融入文章中。

## 任務
將使用者補充的實際經驗，自然地融合到原文中，保持語氣一致且流暢。

## 原文內容
${section_heading ? `### ${section_heading}\n` : ''}
${originalContent}

## 使用者補充的經驗
${userExperience}

## 改寫要求
1. **保持原文結構**：不要大幅改變段落順序或主要論點
2. **自然融合**：將新內容無縫插入適當位置，不要突兀
3. **語氣一致**：保持與原文相同的專業度和語氣
4. **增強可信度**：用實際經驗強化原有論點
5. **保留 HTML 格式**：如果原文有 <h2>, <h3>, <p>, <ul> 等標籤，保持相同格式
6. **補充細節**：在適當位置加入具體的操作步驟、數據或案例

## 融合策略
- 如果使用者提供具體步驟，插入到操作說明段落
- 如果使用者提供數據，加入到效果說明處
- 如果使用者提供案例，作為實例補充
- 如果使用者提供困難/解決方案，加入到相關段落

## 輸出格式
直接輸出改寫後的完整段落，使用 HTML 格式。
不要有 "改寫後："、"以下是..." 等說明文字。
請務必使用台灣繁體中文 (Traditional Chinese)。`;

    const result = await AIService.generate(prompt, { provider, temperature: 0.6 });

    return {
      rewritten_content: result.content,
      original_content: originalContent,
      user_experience: userExperience
    };
  }

  /**
   * 提取文章段落
   */
  static extractSections(article) {
    const sections = [];

    if (article.content_draft?.content?.sections) {
      // 結構化格式
      article.content_draft.content.sections.forEach((section, index) => {
        sections.push({
          id: index,
          heading: section.heading,
          content: section.html || section.plain_text || section.content || ''
        });
      });
    } else if (article.content_draft?.sections) {
      // 簡化格式
      article.content_draft.sections.forEach((section, index) => {
        sections.push({
          id: index,
          heading: section.heading,
          content: section.html || section.plain_text || section.content || ''
        });
      });
    } else if (typeof article.content_draft === 'string') {
      // 純文字格式，嘗試分段
      const htmlSections = article.content_draft.split(/<h2[^>]*>/i);
      htmlSections.forEach((section, index) => {
        if (index === 0 && !section.trim()) return; // 跳過空白開頭
        
        const headingMatch = section.match(/^([^<]+)<\/h2>/i);
        const heading = headingMatch ? headingMatch[1].trim() : `段落 ${index}`;
        const content = section.replace(/^[^<]+<\/h2>/i, '').trim();

        if (content) {
          sections.push({
            id: index - 1,
            heading,
            content
          });
        }
      });
    }

    return sections;
  }

  /**
   * 計算統計資訊
   */
  static calculateStats(analysisResults) {
    const total = analysisResults.length;
    const high = analysisResults.filter(r => r.level === 'high').length;
    const medium = analysisResults.filter(r => r.level === 'medium').length;
    const low = analysisResults.filter(r => r.level === 'low').length;

    const avgScore = analysisResults.reduce((sum, r) => sum + (r.score || 0), 0) / total;

    return {
      total_sections: total,
      high_priority: high,
      medium_priority: medium,
      low_priority: low,
      average_score: Math.round(avgScore),
      completion_rate: Math.round((low / total) * 100)
    };
  }
}

module.exports = ExperienceGapService;
