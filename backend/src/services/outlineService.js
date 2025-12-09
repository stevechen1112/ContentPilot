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
        word_count = 2500,
        provider = process.env.AI_PROVIDER || 'openai',
        author_bio,
        author_values
      } = options;

      // 全面使用 Gemini
      console.log(`🤖 大綱生成模型: ${provider}`);

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
        word_count,
        author_bio,
        author_values,
        provider  // 傳入 provider 以調整 prompt 長度
      });

      // 定義大綱的 JSON Schema（用於 Gemini 3 結構化輸出）
      const outlineSchema = {
        type: "object",
        properties: {
          title: { type: "string", description: "SEO 優化後的文章標題" },
          meta_description: { type: "string", description: "140-160 字的 meta description" },
          introduction: {
            type: "object",
            properties: {
              hook: { type: "string" },
              context: { type: "string" },
              thesis: { type: "string" }
            },
            required: ["hook", "context", "thesis"]
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                key_points: { type: "array", items: { type: "string" } },
                subsections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      heading: { type: "string" },
                      description: { type: "string" }
                    },
                    required: ["heading", "description"]
                  }
                },
                estimated_words: { type: "integer" }
              },
              required: ["heading", "key_points", "estimated_words"]
            }
          },
          conclusion: {
            type: "object",
            properties: {
              summary: { type: "string" },
              call_to_action: { type: "string" }
            },
            required: ["summary", "call_to_action"]
          },
          keywords: {
            type: "object",
            properties: {
              primary: { type: "string" },
              secondary: { type: "array", items: { type: "string" } },
              lsi: { type: "array", items: { type: "string" } }
            },
            required: ["primary", "secondary", "lsi"]
          }
        },
        required: ["title", "meta_description", "introduction", "sections", "conclusion", "keywords"]
      };

      // 呼叫 AI 生成大綱
      const aiOptions = {
        temperature: 0.6,
        max_tokens: 8192  // 增加到 8192 以確保 JSON 完整
      };

      // Gemini 支援結構化輸出，OpenAI 使用純文字 JSON
      if (provider === 'gemini') {
        aiOptions.responseSchema = outlineSchema;
      }

      const result = await AIService.generate(prompt, aiOptions);

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
    const { target_audience, tone, word_count, author_bio, author_values, provider = 'openai' } = options;

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

    // OpenAI 簡化版 Prompt (節省 token)
    if (provider === 'openai') {
      const targetSections = Math.min(Math.max(Math.ceil(word_count / 600), 4), 5); // 4-5個章節
      const wordsPerSection = Math.floor((word_count - 400) / targetSections); // 扣除前言+結論
      
      return `你是專業 SEO 策劃師，為「${keyword}」設計文章大綱。

**嚴格限制**
- 總字數: ${word_count} 字
- 主章節: ${targetSections} 個（H2，必須是 SCQA 對應章節）
- 每章字數: ${wordsPerSection} 字
- 子標題: 1-2 個/章（H3，不要超過2個）
- 受眾: ${target_audience} | 風格: ${tone}
${author_bio ? `
**作者身分與觀點（必須貫穿全文）**
- 背景: ${author_bio}
- 核心價值觀: ${author_values}
- 要求：每個章節標題與內容都要反映此作者的獨特視角，避免泛泛而談。` : ''}

**SERP 參考**
${topTitles}

**讀者痛點（FAQ）**
${peopleAlsoAsk}

**結構約束（SCQA 必須明確對應 H2）**
1. 引言：S（現狀）+ C（衝突/問題）
2. H2-1：Q（核心問題）—— 標題需含問句或痛點關鍵字
3. H2-2 至 H2-${targetSections-1}：A（解答/方法）—— 每個 H2 對應一個主要解決方案
4. H2-${targetSections}：結論與行動呼籲
5. 每個 H2 下必須有 1-2 個 H3 子標題（不超過2個），形成完整層級。

**標題要求**
- H2 標題需含語意化關鍵字（如「${keyword}」的變形詞）
- 禁止使用「深入探討」「全面解析」等空泛詞，改用具體動作詞（如「3步驟掌握」「5大誤區避免」）

**JSON輸出（無其他文字）：**
\`\`\`json
{
  "title": "含${keyword}，60字內，加誘因詞（如：新手必讀/完整攻略/3步驟）",
  "meta_description": "140-160字，重申${keyword}，含行動呼籲",
  "introduction": {"hook":"吸睛開場（統計數據/故事/痛點）","context":"S現狀+C衝突","thesis":"Q核心問題陳述"},
  "sections": [{"heading":"主標題文字（SCQA-Q或A階段，含關鍵字變形，不要加H2:前綴）","key_points":["具體重點1","具體重點2"],"subsections":[{"heading":"子主題（不要加H3:前綴）","description":"1-2句說明"}],"estimated_words":${wordsPerSection}}],
  "conclusion": {"summary":"總結核心價值","call_to_action":"明確CTA（如：立即下載/開始實踐）"},
  "keywords": {"primary":"${keyword}","secondary":["次要詞2-3個"],"lsi":["LSI詞5-8個"]}
}
\`\`\``;
    }

    // Gemini 完整版 Prompt
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

### 作者 Persona 與價值觀 (重要！)
${author_bio ? `- 作者背景: ${author_bio}` : ''}
${author_values ? `- 核心價值觀: ${author_values}` : ''}
請務必將上述作者的觀點與風格融入大綱設計中，確保內容具有獨特性與個人色彩。

### S2 搜尋意圖分析（Google 前 5 名標題）
- ${topTitles}

### S3 競爭對手深度結構分析
${competitorStructureInfo || '無詳細結構資料，請參考上方標題'}

### 使用者常見問題（People Also Ask）
- ${peopleAlsoAsk}

### 相關搜尋
- ${relatedSearches}

## 結構要求：SCQA 架構
請採用 **SCQA (Situation, Complication, Question, Answer)** 架構來組織文章結構：
1. **Situation (情境)**: 在前言或第一段建立讀者共鳴的背景情境。
2. **Complication (衝突)**: 指出讀者面臨的痛點、挑戰或矛盾。
3. **Question (問題)**: 明確提出本文要解決的核心問題。
4. **Answer (答案)**: 透過文章的主體段落提供完整的解決方案。

## 其他注意事項
1. 標題需符合 SEO 最佳實踐（包含關鍵字、60字以內）
2. 結構需涵蓋使用者搜尋意圖（informational, navigational, transactional）
3. 每個 section 需有明確的價值，避免空洞內容
5. 回答 People Also Ask 的問題
6. 確保內容符合 E-E-A-T 原則（經驗、專業、權威、信任）
7. 請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容
8. **重要**：標題文字請直接撰寫，不要加「H2:」或「H3:」等前綴標記

## 輸出格式
請**只輸出**符合以下 JSON 結構的大綱，不要包含任何其他文字或說明：
\`\`\`json
{
  "title": "SEO 優化後的文章標題（60字以內，包含關鍵字）",
  "meta_description": "140-160 字的 meta description",
  "introduction": {
    "hook": "開場引言（吸引讀者注意）",
    "context": "背景介紹（建立情境 - SCQA 的 S）",
    "thesis": "文章主旨（指出問題與解答 - SCQA 的 C+Q）"
  },
  "sections": [
    {
      "title": "章節標題（直接寫標題，不要加H2:前綴）",
      "description": "章節摘要說明（簡述本章節要解決的問題或提供的價值）",
      "subsections": ["子標題 1（直接寫，不要加H3:）", "子標題 2", "..."]
    }
  ],
  "conclusion": {
    "summary": "總結要點",
    "call_to_action": "行動呼籲"
  },
  "keywords": {
    "primary": "主要關鍵字",
    "secondary": ["次要關鍵字 1", "次要關鍵字 2"],
    "lsi": ["LSI 關鍵字 1", "LSI 關鍵字 2"]
  }
}
\`\`\`

請立即產生上述 JSON 格式的完整大綱，不要有其他任何說明文字。`;

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
    const { provider = process.env.AI_PROVIDER || 'openai' } = options;

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
