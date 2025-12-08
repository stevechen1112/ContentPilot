const AIService = require('./aiService');
const SerperService = require('./serperService');
const CompetitorAnalysisService = require('./competitorAnalysisService');

class OutlineService {
  /**
   * 生成文章大綱
   */
  static async generateOutline(keyword, options = {}) {
    try {
      const {
        serp_data = null,
        target_audience = '一般讀者',
        tone = '專業但易懂',
        word_count = 2000,
        provider = 'ollama'
      } = options;

      // 混合模式策略：大綱生成屬於高智商任務，強制使用 Gemini
      const effectiveProvider = provider === 'hybrid' ? 'gemini' : provider;
      console.log(`🤖 大綱生成模型: ${effectiveProvider} ${provider === 'hybrid' ? '(Hybrid Mode)' : ''}`);
      console.log(`DEBUG: provider=${provider}, effectiveProvider=${effectiveProvider}`);

      // S2 & S3: 使用 SERP 資料與競爭對手分析
      let serpAnalysis = serp_data || {
        topResults: [],
        peopleAlsoAsk: [],
        relatedSearches: []
      };

      // S3: 深度競爭對手分析 (若有 SERP 資料)
      let competitorInsights = [];
      if (serp_data && serp_data.topResults && serp_data.topResults.length > 0) {
        console.log('   [S3] 正在執行競爭對手深度分析 (Competitor Analysis)...');
        // 取前 3 名高品質結果進行爬取
        const topUrls = serp_data.topResults.slice(0, 3).map(r => r.link);
        
        try {
          // 並行爬取，但限制錯誤不影響主流程
          const analysisPromises = topUrls.map(url => 
            CompetitorAnalysisService.analyzeCompetitorContent(url)
              .then(result => ({ 
                url, 
                title: serp_data.topResults.find(r => r.link === url)?.title,
                structure: result.structure 
              }))
              .catch(err => null) // 忽略單一失敗
          );
          
          const results = await Promise.all(analysisPromises);
          competitorInsights = results.filter(r => r !== null);
          console.log(`   [S3] 完成 ${competitorInsights.length} 個競爭對手分析`);
        } catch (error) {
          console.warn('   [S3] 競爭對手分析部分失敗，將僅使用 SERP 摘要:', error.message);
        }
      }

      // 建構 Prompt
      const prompt = this.buildOutlinePrompt(keyword, serpAnalysis, competitorInsights, {
        target_audience,
        tone,
        word_count
      });

      // 呼叫 AI 生成大綱
      const result = await AIService.generate(prompt, {
        provider: effectiveProvider,
        temperature: 0.6,
        max_tokens: 2048
      });

      // 解析 AI 回應（假設返回 JSON 格式）
      const outline = this.parseOutlineResponse(result.content);

      // 🔧 修復：直接返回 outline 的內容，避免多層嵌套
      return {
        ...outline,  // 展開 outline 的所有屬性（title, sections, keywords 等）
        keyword,
        serp_insights: {
          total_results: serpAnalysis.totalResults,
          people_also_ask: serpAnalysis.peopleAlsoAsk?.slice(0, 5) || [],
          related_searches: serpAnalysis.relatedSearches?.slice(0, 5) || []
        },
        metadata: {
          target_audience,
          tone,
          estimated_word_count: word_count,
          generated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Generate outline error:', error);
      throw error;
    }
  }

  /**
   * 建構大綱生成 Prompt
   */
  static buildOutlinePrompt(keyword, serpAnalysis, competitorInsights, options) {
    const { target_audience, tone, word_count } = options;

    // 提取 SERP 關鍵資訊 (S2)
    const topTitles = serpAnalysis.topResults?.slice(0, 5).map(r => r.title).join('\n- ') || '';
    const peopleAlsoAsk = serpAnalysis.peopleAlsoAsk?.slice(0, 5).map(q => q.question).join('\n- ') || '';
    const relatedSearches = serpAnalysis.relatedSearches?.slice(0, 5).map(rs => rs.query).join('\n- ') || '';

    // 提取競爭對手結構 (S3)
    let competitorStructureInfo = '';
    if (competitorInsights && competitorInsights.length > 0) {
      competitorStructureInfo = competitorInsights.map((insight, index) => {
        const h2s = insight.structure?.h2?.slice(0, 5).join('; ') || '無 H2';
        return `競爭對手 ${index + 1} (${insight.title}):\n   - H2 架構: ${h2s}`;
      }).join('\n');
    }

    const prompt = `你是一位專業的 SEO 內容策劃師。請根據以下資訊，為「${keyword}」這個主題設計一份完整的文章大綱。
    
    注意：提供的 SERP 分析資料可能包含不相關的內容。請務必過濾這些雜訊，僅參考與「${keyword}」高度相關的資訊。

## 任務要求

### 用戶輸入主題/概念
${keyword}

### 目標受眾
${target_audience}

### 寫作風格
${tone}

### 目標字數
約 ${word_count} 字

### S2 搜尋意圖分析（Google 前 5 名標題）
- ${topTitles}

### S3 競爭對手深度結構分析
${competitorStructureInfo || '無詳細結構資料，請參考上方標題'}

### 使用者常見問題（People Also Ask）
- ${peopleAlsoAsk}

### 相關搜尋
- ${relatedSearches}

## 輸出格式要求

請以 JSON 格式輸出，結構如下：

\`\`\`json
{
  "title": "SEO 優化後的文章標題（請基於你分析出的核心關鍵字，設計一個高點擊率的標題）",
  "meta_description": "請撰寫 140-160 字的精彩 meta description，需包含：1) 主要關鍵字 2) 核心價值主張 3) 行動呼籲或獨特賣點。範例：『想解決 XXX 問題？本文提供 5 個經專家驗證的方法，幫助你在 30 天內看到成效。立即了解如何...』",
  "introduction": {
    "hook": "開場吸引句（痛點或好奇心）",
    "context": "背景說明",
    "thesis": "本文主旨與價值主張"
  },
  "sections": [
    {
      "heading": "H2 標題",
      "key_points": ["要點1", "要點2", "要點3"],
      "subsections": [
        {
          "heading": "H3 標題",
          "description": "這個段落要寫什麼"
        }
      ],
      "estimated_words": 300
    }
  ],
  "conclusion": {
    "summary": "總結要點",
    "call_to_action": "行動呼籲"
  },
  "keywords": {
    "primary": "請從用戶主題中提取最核心的 SEO 關鍵字（例如：若主題是『小型電商如何用 AI 客服省錢』，核心關鍵字應為『小型電商 AI 客服』）",
    "secondary": ["次要關鍵字1", "次要關鍵字2"],
    "lsi": ["LSI關鍵字1", "LSI關鍵字2"]
  }
}
\`\`\`

## 注意事項
1. 標題需符合 SEO 最佳實踐（包含關鍵字、60字以內）
2. 結構需涵蓋使用者搜尋意圖（informational, navigational, transactional）
3. 每個 section 需有明確的價值，避免空洞內容
4. 參考競爭對手的結構優點，但需創新
5. 回答 People Also Ask 的問題
6. 確保內容符合 E-E-A-T 原則（經驗、專業、權威、信任）

請直接輸出 JSON，不要有其他說明文字。
請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    return prompt;
  }

  /**
   * 解析 AI 回應的大綱
   */
  static parseOutlineResponse(content) {
    try {
      // 移除可能的 markdown code block 標記
      let cleanContent = content.trim();

      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '');
      }

      // 移除思考過程標記（DeepSeek/GPT-OSS 常見）
      cleanContent = cleanContent.replace(/^Thinking\.\.\.\n[\s\S]*?\.\.\.done thinking\.\n/gm, '');
      cleanContent = cleanContent.replace(/^<think>[\s\S]*?<\/think>\n?/gm, '');

      // 提取純 JSON 部分（第一個 { 到最後一個 }）
      const firstBrace = cleanContent.indexOf('{');
      const lastBrace = cleanContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
      }

      // 🔧 嘗試修復常見的 JSON 格式錯誤
      // 1. 移除尾部多餘的逗號 (Trailing commas)
      cleanContent = cleanContent.replace(/,(\s*[}\]])/g, '$1');
      
      // 2. 嘗試修復未閉合的引號 (這比較難，但可以處理簡單情況)
      // cleanContent = cleanContent.replace(/([^\\])"\s*\n/g, '$1",\n'); 

      let parsed;
      try {
        parsed = JSON.parse(cleanContent);
      } catch (jsonError) {
        console.warn('⚠️ JSON parse failed, attempting to repair...');
        
        // 🔧 進階修復：嘗試使用 dirty-json 邏輯或正則表達式修復截斷的 JSON
        // 如果 JSON 被截斷（通常發生在 max_tokens 不足時），嘗試補全
        if (cleanContent.lastIndexOf('}') < cleanContent.lastIndexOf('{')) {
           cleanContent += '}]}'; // 嘗試補全結構
        } else if (cleanContent.lastIndexOf(']') < cleanContent.lastIndexOf('[')) {
           cleanContent += ']';
        }

        try {
            // 再次嘗試解析
            cleanContent = cleanContent.replace(/[\u0000-\u001F]+/g, '');
            parsed = JSON.parse(cleanContent);
        } catch (e2) {
            console.error('❌ JSON repair failed:', e2.message);
            // 最後手段：返回一個最小可行的大綱結構，避免程式崩潰
            return {
                title: "生成失敗，請重試",
                introduction: { hook: "", context: "", thesis: "" },
                sections: [],
                keywords: { primary: "", secondary: [] },
                parse_error: true
            };
        }
      }

      // Remove parse_error flag if parsing succeeded
      if (parsed && typeof parsed === 'object') {
        delete parsed.parse_error;
      }

      return parsed;
    } catch (error) {
      console.error('Failed to parse outline JSON:', error);
      console.error('Content preview:', content.substring(0, 500));
      // 如果解析失敗，返回原始內容
      return {
        raw_content: content,
        parse_error: true
      };
    }
  }

  /**
   * 優化現有大綱（人工修改後重新調整）
   */
  static async optimizeOutline(outline, feedback, options = {}) {
    const { provider = 'ollama' } = options;

    const prompt = `你是一位 SEO 內容策劃師。請根據使用者的反饋，優化以下文章大綱。

## 原始大綱
${JSON.stringify(outline, null, 2)}

## 使用者反饋
${feedback}

## 要求
1. 保持原有的結構優點
2. 根據反饋進行調整
3. 確保優化後的大綱更符合 SEO 最佳實踐
4. 輸出完整的優化後大綱（JSON 格式）

請直接輸出 JSON，不要有其他說明文字。
請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, {
      provider,
      temperature: 0.6
    });

    return this.parseOutlineResponse(result.content);
  }

  /**
   * 建構大綱審查 Prompt (Refinement)
   */
  static buildRefinementPrompt(keyword, outline) {
    return `你是一位嚴格的內容主編。請審查以下文章大綱，確保其邏輯性、完整性與 SEO 價值。

## 關鍵字
${keyword}

## 待審查大綱
${JSON.stringify(outline, null, 2)}

## 審查標準
1. **邏輯流暢度**：段落順序是否合理？是否有跳躍？
2. **內容完整性**：是否遺漏了重要子題？是否回答了使用者可能的問題？
3. **SEO 價值**：標題與 H2 是否包含關鍵字？結構是否利於閱讀？
4. **獨特性**：是否有獨特的觀點或價值主張？

## 任務
請輸出優化後的完整大綱（JSON 格式）。如果原大綱已經很完美，請直接輸出原大綱。
如果有修改，請確保修改後的內容更勝一籌。

請直接輸出 JSON，不要有其他說明文字。`;
  }
}

module.exports = OutlineService;
