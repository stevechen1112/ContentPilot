const AIService = require('./aiService');
const ContentFilterService = require('./contentFilterService');
const SEOOptimizer = require('./seoOptimizer');
const AuthoritySourceService = require('./authoritySourceService');

class ArticleService {
  /**
   * 根據大綱生成完整文章
   */
  static async generateArticle(outline, options = {}) {
    try {
      const {
        provider = 'ollama',
        style_guide = null,
        additional_context = null,
        serp_data = null
      } = options;

      console.log('📝 開始生成文章...');

      // 🆕 RAG 架構：預先檢索權威來源 (LibrarianService)
      // 確保整篇文章使用同一組驗證過的來源，避免重複檢索與不一致
      const LibrarianService = require('./librarianService');
      console.log('🔍 [Librarian] 正在檢索權威來源...');
      const verifiedSources = await LibrarianService.getVerifiedSources(outline.title || outline.keywords?.primary);
      console.log(`✅ [Librarian] 獲取 ${verifiedSources.length} 個驗證來源`);

      // 逐段生成文章
      // 混合模式策略：引言與結論使用高智商模型 (Gemini)，內文使用高效率模型 (Ollama)
      const isHybrid = provider === 'hybrid';
      const brainModel = isHybrid ? 'gemini' : provider;
      const workerModel = isHybrid ? 'ollama' : provider;

      console.log(`🤖 模型策略: [引言/結論: ${brainModel}] [內文: ${workerModel}]`);

      const introduction = await this.generateIntroduction(outline, { 
        provider: brainModel, 
        style_guide,
        serp_data,
        verifiedSources // 傳遞來源
      });

      const sections = [];
      for (const section of outline.sections || []) {
        const sectionContent = await this.generateSection(section, outline, { 
          provider: workerModel, 
          style_guide,
          serp_data,
          verifiedSources // 傳遞來源
        });
        sections.push(sectionContent);

        // 避免 API rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const conclusion = await this.generateConclusion(outline, sections, { 
        provider: brainModel, 
        style_guide,
        verifiedSources // 傳遞來源
      });

      // 保障標題與 meta 有值，避免 undefined 注入到 HTML
      const { title: safeTitle, meta_description: safeMeta } = this.resolveTitleMeta(outline);

      // 組合完整文章
      let fullArticle = {
        title: safeTitle,
        meta_description: safeMeta,
        content: {
          introduction: introduction,
          sections: sections,
          conclusion: conclusion
        },
        metadata: {
          word_count: this.calculateWordCount({ introduction, sections, conclusion }),
          generated_at: new Date().toISOString(),
          provider: provider
        }
      };

      // 🆕 P0優化：應用內容過濾器進行語言統一和術語校正
      console.log('🧹 開始應用內容過濾器...');
      fullArticle = await ContentFilterService.cleanContent(fullArticle, { 
        domain: 'health',
        skipHTML: false 
      });
      console.log('✅ 內容過濾完成');

      // 🆕 P0優化：應用 SEO 優化器提升關鍵字密度
      console.log('🔍 開始 SEO 驗證...');
      console.log('   - 目標關鍵字:', outline.keywords?.primary || outline.title);
      console.log('   - 文章結構:', {
        hasIntroduction: !!fullArticle.content?.introduction,
        sectionsCount: fullArticle.content?.sections?.length || 0,
        hasConclusion: !!fullArticle.content?.conclusion
      });
      
      fullArticle = SEOOptimizer.optimizeArticleStructure(fullArticle, {
        targetKeyword: outline.keywords?.primary || outline.title,
        targetDensity: 0.008, // 降低目標密度至 0.8%
        domain: this.determineDomain(outline.title) // 🆕 動態判斷領域
      });
      console.log('✅ SEO 驗證完成');

      // 🆕 P1優化：增強 E-E-A-T (添加領域感知的作者簡介與免責聲明)
      if (fullArticle.content?.conclusion?.html) {
        const domain = this.determineDomain(outline.title);
        const disclaimer = this.generateDomainAwareDisclaimer(domain);
        
        fullArticle.content.conclusion.html += disclaimer;
        fullArticle.content.conclusion.plain_text += this.stripHtml(disclaimer);
      }

      // 🆕 P2: 確保目標關鍵字至少出現 2 次，避免密度為 0
      const targetKeyword = outline.keywords?.primary || outline.title;
      fullArticle = this.ensureKeywordPresence(fullArticle, targetKeyword);

      // 🆕 P5: RAG 架構最終檢查 (Librarian Check)
      // 雖然我們在生成階段已經使用了 LibrarianService，但為了雙重保險，
      // 我們再次掃描所有 URL，確保沒有任何漏網之魚（例如 AI 偶爾還是會寫出完整 URL）
      console.log('🔍 [Librarian] 執行最終引用審查...');
      
      // 收集所有 HTML
      const allHtml = [
        fullArticle.content.introduction.html,
        ...fullArticle.content.sections.map(s => s.html),
        fullArticle.content.conclusion.html
      ].join('\n');

      // 收集所有需要驗證的HTML片段
      const htmlParts = [];
      if (fullArticle.content?.introduction?.html) htmlParts.push({ type: 'introduction', html: fullArticle.content.introduction.html });
      if (fullArticle.content?.sections) {
        fullArticle.content.sections.forEach((section, idx) => {
          htmlParts.push({ type: `section-${idx}`, html: section.html });
        });
      }
      if (fullArticle.content?.conclusion?.html) htmlParts.push({ type: 'conclusion', html: fullArticle.content.conclusion.html });

      // 對每個部分進行URL驗證與清理
      let totalInvalidUrls = 0;
      let totalValidUrls = 0;
      
      // 使用 LibrarianService 獲取的 verifiedSources 作為白名單
      let authoritySources = verifiedSources;

      for (const part of htmlParts) {
        // 🆕 P4: 自動修正空洞引用 (Auto Fix Empty References)
        // 在最終驗證前，先嘗試修復 "研究顯示" 等空泛描述
        let processedHtml = this.autoFixEmptyReferences(part.html, authoritySources);

        // 🆕 P5: 驗證與清理 URL
        const validation = await this.validateAndCleanUrls(processedHtml, authoritySources);
        part.cleanedHtml = validation.cleanedHtml;
        totalInvalidUrls += validation.stats.invalid;
        totalValidUrls += validation.stats.valid;
        
        // 更新文章內容
        if (part.type === 'introduction') {
          fullArticle.content.introduction.html = validation.cleanedHtml;
          fullArticle.content.introduction.plain_text = this.stripHtml(validation.cleanedHtml);
        } else if (part.type.startsWith('section-')) {
          const idx = parseInt(part.type.split('-')[1]);
          fullArticle.content.sections[idx].html = validation.cleanedHtml;
          fullArticle.content.sections[idx].plain_text = this.stripHtml(validation.cleanedHtml);
        } else if (part.type === 'conclusion') {
          fullArticle.content.conclusion.html = validation.cleanedHtml;
          fullArticle.content.conclusion.plain_text = this.stripHtml(validation.cleanedHtml);
        }
      }

      console.log(`\n✅ [P5驗證完成] 總計: ${totalValidUrls}個有效URL, ${totalInvalidUrls}個幻覺URL已清理\n`);

      return fullArticle;
    } catch (error) {
      console.error('Generate article error:', error);
      throw error;
    }
  }

  /**
   * 生成引言段落
   */
  static async generateIntroduction(outline, options = {}) {
    const { provider, style_guide, serp_data, verifiedSources: passedSources } = options;

    console.log('🔍 [Librarian] 正在檢索權威來源...');
    
    // 🆕 使用 LibrarianService 獲取真實來源
    const LibrarianService = require('./librarianService');
    const verifiedSources = passedSources || await LibrarianService.getVerifiedSources(outline.title || outline.keywords?.primary);
    const formattedSources = LibrarianService.formatSourcesForPrompt(verifiedSources);

    // 用戶常見問題（來自 People Also Ask）
    const userQuestions = serp_data?.peopleAlsoAsk?.slice(0, 3).join('\n- ') || '';

    // 熱門關鍵詞（來自競爭對手內容分析）
    const topKeywords = serp_data?.contentPatterns?.topSnippetKeywords?.slice(0, 8).map(k => k.word).join('、') || '';

    const prompt = `你是一位擁有 10 年以上經驗的領域專家與 SEO 內容寫手。請根據以下大綱，撰寫文章的引言部分。

## 文章標題
${outline.title}

## 引言結構
${JSON.stringify(outline.introduction, null, 2)}

## 主要關鍵字
${outline.keywords?.primary || ''}

## 🔍 競爭對手內容分析
高頻關鍵詞：${topKeywords || '無數據'}

## 👥 用戶常見問題（People Also Ask）
${userQuestions ? `- ${userQuestions}` : '無數據'}

## 📚 參考文獻庫 (Reference Library)
${formattedSources}

## 寫作要求
1. **專業但誠實**：使用第三人稱或客觀描述，避免虛構個人經驗。
2. **痛點共鳴**：開場直接切入讀者痛點，使用客觀事實和研究數據。
3. 清楚說明本文將提供什麼價值
4. **自然融入關鍵字**：主要關鍵字「${outline.keywords?.primary}」必須在引言中出現至少2次，以自然的方式融入句子中，避免堆砌或生硬插入。目標密度0.8%-1.2%。
5. 字數控制在 200-300 字（較長的引言有利於SEO）
6. 語氣：${style_guide?.tone || '專業、親切且具權威感'}
${style_guide ? `7. 品牌風格：${JSON.stringify(style_guide)}` : ''}

## **E-E-A-T 引用規範（Citation Protocol）**：

**嚴格禁止自行編造 URL。你只能使用「參考文獻庫」中提供的資料。**

1. **來源品質判斷（AI Judgment）**：
   - 「參考文獻庫」中包含了搜尋引擎返回的結果，品質可能參差不齊。
   - **請運用你的專業知識判斷來源的可信度**。
   - ✅ 優先引用：知名券商、金融機構、政府機關、大型新聞媒體、學術機構。
   - ❌ 忽略引用：內容農場、個人部落格、論壇討論、品質低劣的網站。
   - 如果某個來源雖然在列表中，但你判斷其內容不可信或不專業，請**不要引用**。

2. **引用標記**：當你引用某個觀點或數據時，請在句尾加上來源編號，例如：
   - "根據研究顯示，長期失眠會增加心血管疾病風險 [1]。"
   - "專家建議睡前應避免使用 3C 產品 [2]。"

3. **禁止事項**：
   ❌ 不要寫出完整的 URL (例如 https://...)
   ❌ 不要寫 <a href="..."> 標籤 (系統會自動處理)
   ❌ 不要引用參考文獻庫以外的來源

4. **引用數量**：
   - 如果「參考文獻庫」中有相關且高品質的來源，請引用 1-2 個。
   - **如果「參考文獻庫」為空或無相關來源，請不要強行引用，也不要編造 [1] 標記。**
   - 寧可不引用，也不要引用錯誤或無關的來源。

## 輸出格式
- 使用 HTML 格式
- **不要**在開頭生成 <h2> 標題（系統會自動處理）
- 直接以 <p> 段落開始撰寫引言內容
- **不要**在輸出中包含 "參考文獻" 列表，只需在文中標註 [1], [2] 即可。
- 直接輸出 HTML，無需其他說明

請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, { provider, temperature: 0.7 });
    
    // 🆕 清理 Markdown 代碼塊標記
    let cleanedContent = this.cleanMarkdownArtifacts(result.content);
    
    // 🆕 Post-processing: 將 [1] 標記轉換為真實連結
    let processedHtml = LibrarianService.injectCitations(cleanedContent, verifiedSources);

    return {
      html: processedHtml,
      plain_text: this.stripHtml(processedHtml),
      sources: verifiedSources // 保存來源以便後續使用
    };
  }

  /**
   * 生成單一段落
   */
  static async generateSection(section, outline, options = {}) {
    const { provider, style_guide, serp_data, internal_links, verifiedSources: passedSources } = options;

    const subsectionsText = section.subsections
      ? section.subsections.map(sub => `### ${sub.heading}\n${sub.description}`).join('\n\n')
      : '';

    // 🆕 動態搜尋該段落主題的權威來源
    // 🆕 使用 LibrarianService 獲取真實來源
    const LibrarianService = require('./librarianService');
    const verifiedSources = passedSources || await LibrarianService.getVerifiedSources(outline.title || outline.keywords?.primary);
    const formattedSources = LibrarianService.formatSourcesForPrompt(verifiedSources);

    // 分析競爭對手如何描述這個主題（從所有結果的 snippet）
    const competitorInsights = serp_data?.allResults?.slice(0, 5).map(r => 
      `- ${r.snippet}`
    ).join('\n') || '';

    // 熱門關鍵詞
    const topKeywords = serp_data?.contentPatterns?.topSnippetKeywords?.slice(0, 10).map(k => k.word).join('、') || '';

    // 內部連結建議
    const internalLinksText = internal_links?.slice(0, 3).map(link => `- ${link.anchor_text} -> ${link.url}`).join('\n') || '';

    const prompt = `你是一位擁有 10 年以上經驗的領域專家與 SEO 內容寫手。請根據以下要求，撰寫文章的段落內容。

## 段落標題（H2）
${section.heading}

## 要寫的重點
${section.key_points?.join('\n- ') || ''}

## 子段落結構
${subsectionsText}

## 目標字數
約 ${section.estimated_words || 300} 字

## 相關關鍵字
主要：${outline.keywords?.primary || ''}
次要：${outline.keywords?.secondary?.join(', ') || ''}
LSI：${outline.keywords?.lsi?.join(', ') || ''}

## 🔍 競爭對手內容分析
**高頻關鍵詞**：${topKeywords || '無數據'}

**競爭對手如何描述這個主題**（參考但不抄襲）：
${competitorInsights || '無數據'}

## 📚 參考文獻庫 (Reference Library)
${formattedSources}

## 🔗 內部連結建議（如有）
${internalLinksText || '無可用內部連結'}

## 寫作要求
1. **⛔ 範圍嚴格限制 (Scope Control)**：
   - **你現在只負責撰寫「${section.heading}」這個段落。**
   - ❌ **絕對禁止** 撰寫引言 (Introduction) 或結語 (Conclusion)。
   - ❌ **絕對禁止** 提及其他段落的內容（例如不要在這裡寫「下一段我們將討論...」）。
   - 請專注於本段落的 \`key_points\`，深入挖掘，不要廣泛帶過。

2. **⛔ 格式嚴格限制 (Structure Control)**：
   - ❌ **不要** 在開頭重複寫出章節標題「${section.heading}」（系統會自動添加 H2）。
   - 直接以 H3 子標題或內文段落開始。
   - 確保內容層級為 H3 -> H4，不要使用 H1 或 H2。

3. **拒絕空話 (No Fluff)**：
   - ❌ 禁止：「選擇適合的工具很重要」、「這需要仔細考量」等廢話。
   - ✅ 必須：「建議使用 Firstrade 或 Schwab，因為...」、「手續費通常為 0 元，但需注意...」。
   - 請提供**具體的名稱、數字、步驟、比較**。

3. **專家視角與實戰建議**：
   - 以專家的口吻撰寫，提供"見解"（Insight）而非僅是資訊堆疊。
   - 在解釋概念時，提供實際操作的建議或注意事項（「在實務上，建議...」）。

3. **自然融入關鍵字**：主要關鍵字「${outline.keywords?.primary}」在本段落中至少出現2次，以自然方式融入句子，避免堆砌或生硬插入。目標密度0.8%-1.2%。

4. **結構化輸出**：
   - 善用列表 (<ul>, <ol>) 來整理步驟或要點。
   - 若涉及比較，請嘗試用文字清楚描述差異（如：A券商適合X，B券商適合Y）。

5. 每個子標題（H3）需有 150-200 字的內容（較長內容利於SEO排名）
6. 語氣：${style_guide?.tone || '專業、親切且具權威感'}
${style_guide ? `7. 品牌風格：${JSON.stringify(style_guide)}` : ''}

## **E-E-A-T 引用規範（Citation Protocol）**：

**嚴格禁止自行編造 URL。你只能使用「參考文獻庫」中提供的資料。**

1. **來源品質判斷（AI Judgment）**：
   - 「參考文獻庫」中包含了搜尋引擎返回的結果，品質可能參差不齊。
   - **請運用你的專業知識判斷來源的可信度**。
   - ✅ 優先引用：知名券商、金融機構、政府機關、大型新聞媒體、學術機構。
   - ❌ 忽略引用：內容農場、個人部落格、論壇討論、品質低劣的網站。
   - 如果某個來源雖然在列表中，但你判斷其內容不可信或不專業，請**不要引用**。

2. **引用標記**：當你引用某個觀點或數據時，請在句尾加上來源編號，例如：
   - "根據研究顯示，長期失眠會增加心血管疾病風險 [1]。"
   - "專家建議睡前應避免使用 3C 產品 [2]。"

3. **禁止事項**：
   ❌ 不要寫出完整的 URL (例如 https://...)
   ❌ 不要寫 <a href="..."> 標籤 (系統會自動處理)
   ❌ 不要引用參考文獻庫以外的來源
   ❌ 不要使用 < > 符號來強調文字（如 <重點>），這會破壞 HTML 結構。請改用 **粗體** 或 「引號」。

4. **引用數量**：
   - 如果「參考文獻庫」中有相關且高品質的來源，請引用 1-2 個。
   - **如果「參考文獻庫」為空或無相關來源，請不要強行引用，也不要編造 [1] 標記。**
   - 寧可不引用，也不要引用錯誤或無關的來源。

### 👤 Experience (經驗) - 關鍵加分項
- **❌ 禁止使用虛假經驗聲稱**：
  - 禁止：「我曾經測試過...」、「根據我們團隊的數據...」
  - 禁止：「例如，我有一位客戶...」、「在我服務的...」
  - 禁止：「根據我的觀察...」、「我個人的經驗是...」

- **✅ 建議替代方式**：
  - 引用研究：「根據研究 [1] 顯示...」
  - 描述實務建議：「實務上常見的作法是...」
  - 區分理論與實踐：「理論上是這樣，但實際操作中常遇到...」

### 🔗 內部連結要求
- 如果有提供內部連結建議，必須自然融入至少 1 個
- 使用格式：<a href="URL">錨文本</a>
- 錨文本需自然融入文章，不強行插入

## 輸出格式
使用 HTML 格式，包含：
- <h2> 主標題
- <h3> 子標題（如有）
- **不要**在輸出中包含 "參考文獻" 列表，只需在文中標註 [1], [2] 即可。
- <p> 段落
- <ul>/<ol> 列表（如需要）
- <strong> 強調重點
- <a> 連結（來源引用與內部連結）

直接輸出 HTML 內容，不要有其他說明。
請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, {
      provider,
      temperature: 0.6,
      max_tokens: 2000
    });

    // 🔧 清理 Markdown 標記並移除 AI 可能生成的重複 h2 標題
    let cleanedHtml = this.cleanMarkdownArtifacts(result.content);
    
    // 移除開頭的 <h2>標題</h2>（可能與 section.heading 重複）
    const h2Pattern = /^<h2[^>]*>.*?<\/h2>\s*/i;
    if (h2Pattern.test(cleanedHtml)) {
      cleanedHtml = cleanedHtml.replace(h2Pattern, '');
      console.log(`  ℹ️ 已移除段落「${section.heading}」的重複 h2 標題`);
    }

    // 🌟 Quality Assurance Loop (Two-Pass Generation)
    // 用戶明確表示願意犧牲速度換取品質，因此我們增加「自我審查與修潤」步驟
    console.log(`  ✨ 正在進行深度修潤 (Deep Refinement) - ${section.heading}...`);
    cleanedHtml = await this.refineSection(cleanedHtml, section, outline, options);

    // 🆕 Post-processing: 將 [1] 標記轉換為真實連結
    cleanedHtml = LibrarianService.injectCitations(cleanedHtml, verifiedSources);

    return {
      heading: section.heading,
      html: cleanedHtml,
      plain_text: this.stripHtml(cleanedHtml)
    };
  }

  /**
   * 深度修潤機制 (Refinement Loop)
   * 讓 AI 擔任「嚴格編輯」，檢查並優化初稿
   */
  static async refineSection(draftHtml, section, outline, options) {
    const { provider, style_guide } = options;
    
    const prompt = `你是一位極度嚴格的資深主編。請審核並重寫以下文章段落（初稿）。

## 你的任務
1. **消除重複**：檢查是否有重複的語句或鬼打牆的論述，將其精簡。
2. **事實查核**：確保所有數據引用都有 [x] 標記，且語氣客觀。
3. **結構修正**：
   - 確保**沒有** H1 或 H2 標題（最高層級只能是 H3）。
   - 確保沒有「引言」或「結語」類型的廢話，直接切入重點。
4. **SEO 優化**：確保關鍵字「${outline.keywords?.primary}」自然出現，但不要堆砌。
5. **語氣潤飾**：${style_guide?.tone || '專業、權威且易讀'}。

## 原始初稿
${draftHtml}

## 輸出要求
- 直接輸出修潤後的 HTML。
- 保持 HTML 標籤結構（<p>, <ul>, <h3>）。
- 不要解釋你改了什麼，直接給出最終成品。
- 務必使用台灣繁體中文。`;

    try {
      const result = await AIService.generate(prompt, {
        provider,
        temperature: 0.3, // 低溫模式，確保穩定性與精確度
        max_tokens: 2000
      });
      
      // 🔧 清理 Markdown 標記
      let refinedHtml = this.cleanMarkdownArtifacts(result.content.trim());
      
      // 再次清理可能產生的 H2 (雙重保險)
      const h2Pattern = /^<h2[^>]*>.*?<\/h2>\s*/i;
      if (h2Pattern.test(refinedHtml)) {
        refinedHtml = refinedHtml.replace(h2Pattern, '');
      }
      
      return refinedHtml;
    } catch (error) {
      console.warn('  ⚠️ 修潤過程失敗，將使用初稿:', error.message);
      return draftHtml;
    }
  }

  /**
   * 生成結論段落
   */
  static async generateConclusion(outline, sections, options = {}) {
    const { provider, style_guide, verifiedSources: passedSources } = options;

    const mainPoints = sections.map(s => s.heading).join('\n- ');

    const prompt = `你是一位專業的 SEO 內容寫手。請根據以下資訊，撰寫文章的結論部分。

## 文章標題
${outline.title}

## 已討論的主要段落
- ${mainPoints}

## 結論結構
${JSON.stringify(outline.conclusion, null, 2)}

## 寫作要求
1. 總結文章的核心要點
2. 強調讀者的收穫與價值
3. 包含明確的行動呼籲（Call to Action）
4. **自然融入關鍵字**：主要關鍵字至少自然出現 1-2 次，避免堆砌。
5. 若前文已引用來源，結論可重申 1 個關鍵來源以強化可信度（不要新造來源）。
6. 字數控制在 150-200 字
7. 語氣：${style_guide?.tone || '專業但易懂'}
${style_guide ? `8. 品牌風格：${JSON.stringify(style_guide)}` : ''}

## **E-E-A-T 引用規範（Citation Protocol）**：
**嚴格禁止自行編造 URL。**
- 如果需要引用，請使用 [1], [2] 標記（對應前文已使用的來源）。
- 不要寫出完整的 URL。

## 輸出格式
- 使用 HTML 格式
- 包含 <h2> 標題、<p> 段落、<ul> 列表
- 字數約 150-200 字
- 直接輸出 HTML，無需其他說明

請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, { provider, temperature: 0.7 });

    // 🔧 清理 Markdown 代碼塊標記
    let cleanedHtml = this.cleanMarkdownArtifacts(result.content);
    
    // 🔧 自動移除 AI 可能生成的重複 h2 標題（如「結論」）
    cleanedHtml = cleanedHtml.trim();
    const h2Pattern = /^<h2[^>]*>.*?<\/h2>\s*/i;
    if (h2Pattern.test(cleanedHtml)) {
      cleanedHtml = cleanedHtml.replace(h2Pattern, '');
      console.log('  ℹ️ 已移除結論的重複 h2 標題');
    }

    // 🆕 Post-processing: 將 [1] 標記轉換為真實連結
    // 注意：結論通常重申已有的來源，這裡我們嘗試再次注入，或者如果沒有新來源，至少保證格式正確
    // 為了簡單起見，我們假設結論重用 introduction 或 sections 的來源
    // 這裡我們重新獲取一次來源（或應該從 context 傳遞，但為了無狀態設計，重新獲取是安全的）
    const LibrarianService = require('./librarianService');
    const verifiedSources = passedSources || await LibrarianService.getVerifiedSources(outline.title || outline.keywords?.primary);
    cleanedHtml = LibrarianService.injectCitations(cleanedHtml, verifiedSources);
    
    return {
      html: cleanedHtml,
      plain_text: this.stripHtml(cleanedHtml)
    };
  }

  /**
   * Stream 模式生成段落（用於即時顯示）
   */
  static async generateSectionStream(section, outline, options = {}, onChunk) {
    const { provider, style_guide } = options;

    const subsectionsText = section.subsections
      ? section.subsections.map(sub => `### ${sub.heading}\n${sub.description}`).join('\n\n')
      : '';

    const prompt = `你是一位專業的 SEO 內容寫手。請根據以下要求，撰寫文章的段落內容。

## 段落標題（H2）
${section.heading}

## 要寫的重點
${section.key_points?.join('\n- ') || ''}

## 子段落結構
${subsectionsText}

## 目標字數
約 ${section.estimated_words || 300} 字

## 寫作要求
1. 內容需實用、具體
2. 自然融入關鍵字
3. 使用 HTML 格式輸出

直接輸出 HTML 內容。
請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const content = await AIService.generateStream(prompt, { provider }, onChunk);

    return {
      heading: section.heading,
      html: content,
      plain_text: this.stripHtml(content)
    };
  }

  /**
   * 改寫段落（人工補充經驗後重新融合）
   */
  static async rewriteSection(originalContent, userInput, options = {}) {
    const { provider = 'ollama' } = options;

    const prompt = `你是一位專業的內容編輯。請將使用者提供的個人經驗，自然地融入到原始內容中。

## 原始 AI 生成內容
${originalContent}

## 使用者補充的真實經驗
${userInput}

## 要求
1. 保持原有的結構與邏輯
2. 將使用者的經驗自然地融入內容
3. 確保語氣一致
4. 調整銜接詞，使內容流暢
5. 保留所有關鍵資訊
6. 使用 HTML 格式輸出

直接輸出改寫後的完整內容（HTML 格式）。
請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, { provider, temperature: 0.6 });

    return {
      html: result.content,
      plain_text: this.stripHtml(result.content)
    };
  }

  /**
   * 計算字數 (修正版本：只計算 plain_text，避免 HTML 與 JSON 干擾)
   */
  static calculateWordCount(content) {
    // 🔧 優先使用 plain_text 來計算純內容字數
    let textToCount = '';
    
    if (content.introduction?.plain_text) {
      textToCount += content.introduction.plain_text + ' ';
    }
    
    if (content.sections && Array.isArray(content.sections)) {
      content.sections.forEach(section => {
        if (section.plain_text) {
          textToCount += section.plain_text + ' ';
        }
      });
    }
    
    if (content.conclusion?.plain_text) {
      textToCount += content.conclusion.plain_text + ' ';
    }
    
    // 如果沒有 plain_text，則從 JSON 字串中提取（降級方案）
    if (!textToCount.trim()) {
      textToCount = JSON.stringify(content);
    }
    
    // 計算中文字與英文字
    const chineseChars = (textToCount.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (textToCount.match(/[a-zA-Z]+/g) || []).length;
    
    return chineseChars + englishWords;
  }

  /**
   * 移除 HTML 標籤
   */
  static stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * 🆕 清理 AI 生成內容中的 Markdown 代碼塊標記 + [x] 佔位符
   */
  static cleanMarkdownArtifacts(content) {
    if (!content) return '';
    
    let cleaned = content.trim();
    
    // 移除開頭的代碼塊標記
    cleaned = cleaned.replace(/^```html\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/i, '');
    
    // 移除結尾的代碼塊標記
    cleaned = cleaned.replace(/\s*```$/i, '');
    
    // 移除中間可能出現的代碼塊標記（但保留內容）
    cleaned = cleaned.replace(/```html\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    
    // 🔧 移除或替換 [x] 佔位符
    // 策略：將 [x] 替換為 "[參考文獻]"，更顯專業且通用
    cleaned = cleaned.replace(/\s*\[x\]/g, ' [參考文獻]');
    
    // 清理過多的相同參考標記
    cleaned = cleaned.replace(/\[參考文獻\]\s*\[參考文獻\]/g, '[參考文獻]');
    
    // 清理多餘空白
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * 🆕 判斷文章領域（根據標題關鍵字）
   */
  static determineDomain(title) {
    // 安全檢查：如果 title 為 undefined 或 null，返回 general
    if (!title || typeof title !== 'string') {
      return 'general';
    }

    const healthKeywords = ['健康', '醫療', '睡眠', '失眠', '飲食', '營養', '運動', '疾病', '症狀', '治療'];
    const financeKeywords = ['投資', '理財', '股票', 'ETF', '基金', '保險', '貸款', '儲蓄', '退休', '財務'];
    const techKeywords = ['AI', '人工智慧', '科技', '軟體', '程式', '網路', '雲端', '數據', '演算法'];
    const educationKeywords = ['學習', '教育', '課程', '培訓', '技能', '證照', '轉職', '職涯', '效率'];
    const lifestyleKeywords = ['旅遊', '親子', '生活', '休閒', '美食', '購物', '居家', '寵物'];

    if (healthKeywords.some(kw => title.includes(kw))) return 'health';
    if (financeKeywords.some(kw => title.includes(kw))) return 'finance';
    if (techKeywords.some(kw => title.includes(kw))) return 'tech';
    if (educationKeywords.some(kw => title.includes(kw))) return 'education';
    if (lifestyleKeywords.some(kw => title.includes(kw))) return 'lifestyle';

    return 'general';
  }

  /**
   * 🆕 生成領域感知的免責聲明
   */
  static generateDomainAwareDisclaimer(domain) {
    const disclaimers = {
      health: {
        title: '醫療免責聲明',
        content: '本文提供的資訊僅供參考，不能替代專業醫療建議、診斷或治療。如有任何健康疑慮，請務必諮詢合格的醫療專業人員。'
      },
      finance: {
        title: '投資免責聲明',
        content: '本文提供的資訊僅供參考，不構成任何投資建議。投資有風險，過去績效不代表未來表現。在進行任何投資決策前，請諮詢合格的財務顧問。'
      },
      tech: {
        title: '技術免責聲明',
        content: '本文提供的技術資訊僅供參考，實際應用時可能因環境差異而有所不同。在實施任何技術方案前，建議諮詢專業技術顧問。'
      },
      education: {
        title: '教育免責聲明',
        content: '本文提供的教育與職涯資訊僅供參考，實際情況可能因個人條件與市場環境而異。建議在做出重大決定前，諮詢專業職涯顧問。'
      },
      lifestyle: {
        title: '內容免責聲明',
        content: '本文提供的生活資訊僅供參考，實際體驗可能因個人喜好與環境而異。文中提及的產品或服務不代表本站推薦或背書。'
      },
      general: {
        title: '免責聲明',
        content: '本文提供的資訊僅供參考，實際情況可能因個人條件與環境而異。在做出任何重大決定前，建議諮詢相關領域的專業人士。'
      }
    };

    const disclaimer = disclaimers[domain] || disclaimers.general;
    
    // 🆕 使用動態來源服務生成參考來源文字（降級時使用通用說明）
    let sourcesText = '相關領域的權威機構與專業組織';
    try {
      const fallbackSources = AuthoritySourceService.getFallbackSources(domain);
      if (fallbackSources && fallbackSources.length > 0) {
        sourcesText = fallbackSources.slice(0, 2).map(s => s.institutionName || s.title).join('、');
      }
    } catch (error) {
      console.error('⚠️ 無法取得來源文字，使用通用說明');
    }

    return `
      <hr />
      <div class="article-footer" style="background-color: #f9f9f9; padding: 20px; margin-top: 30px; border-radius: 8px;">
        <h4>關於作者</h4>
        <p><strong>ContentPilot 編輯團隊</strong></p>
        <p>我們致力於提供經過深入研究、專家審核的專業內容。本文內容參考${sourcesText}等公開資料，旨在為讀者提供實用且可靠的資訊。</p>
        
        <div class="disclaimer" style="font-size: 0.9em; color: #666; margin-top: 15px;">
          <strong>${disclaimer.title}：</strong>${disclaimer.content}
        </div>
      </div>
    `;
  }

  /**
   * 品質檢查
   */
  static async qualityCheck(article, options = {}) {
    const { provider = 'ollama', target_keyword } = options;

    const prompt = `你是一位 SEO 內容品質審核專家。請檢查以下文章的品質。

## 文章內容
${JSON.stringify(article, null, 2)}

## 目標關鍵字
${target_keyword}

## 檢查項目
1. 關鍵字密度與分佈
2. 內容完整性與實用性
3. 結構與可讀性
4. E-E-A-T 原則符合度
5. SEO 最佳實踐

## 輸出格式（JSON）
\`\`\`json
{
  "overall_score": 85,
  "keyword_density": 2.5,
  "readability_score": 80,
  "eeat_score": 75,
  "seo_score": 90,
  "issues": [
    {
      "type": "warning",
      "message": "建議在第2段補充更多實例"
    }
  ],
  "suggestions": [
    "可以在結論加入更明確的數據支持",
    "建議補充作者的實際經驗"
  ]
}
\`\`\`

請直接輸出 JSON。
請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, { provider, temperature: 0.5 });

    try {
      let cleanContent = result.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      }
      return JSON.parse(cleanContent);
    } catch (error) {
      return { raw_content: result.content, parse_error: true };
    }
  }

  /**
   * 確保標題與 meta description 有安全預設值
   * - 取用優先順序：title -> keyword -> keywords.primary -> fallback
   */
  static resolveTitleMeta(source = {}, fallbackKeyword = '') {
    const titleCandidate = [
      source.title,
      source.keyword,
      source.keywords?.primary,
      fallbackKeyword,
      'ContentPilot 文章'
    ].find(t => typeof t === 'string' && t.trim().length > 0) || 'ContentPilot 文章';

    const metaCandidate = [
      source.meta_description,
      source.metadata?.meta_description,
      `${titleCandidate} - 完整指南`
    ].find(t => typeof t === 'string' && t.trim().length > 0) || `${titleCandidate} - 完整指南`;

    return {
      title: titleCandidate.trim(),
      meta_description: metaCandidate.trim()
    };
  }

  /**
   * 確保目標關鍵字至少自然出現 2 次；若不足，於結論補充一句
   */
  static ensureKeywordPresence(article, keyword) {
    if (!article || !keyword) return article;

    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'g');
    const contentText = JSON.stringify(article);
    const count = (contentText.match(pattern) || []).length;

    if (count >= 2) return article;

    const sentence = `<p>本指南聚焦「${keyword}」，提供台北出發、兩小時內的低碳親子旅行建議，方便家庭週末快速採用。</p>`;

    if (article.content?.conclusion) {
      article.content.conclusion.html = (article.content.conclusion.html || '') + sentence;
      article.content.conclusion.plain_text = (article.content.conclusion.plain_text || '') + this.stripHtml(sentence);
    }

    return article;
  }

  /**
   * 🔧 自動修正空泛引用：將「研究顯示」等替換為具體來源
   */
  /**
   * 🔧 P4: 自動修正空洞引用
   * 將"研究顯示"等空泛描述替換為具體的權威來源引用
   */
  static autoFixEmptyReferences(html, authoritySources = []) {
    if (!html || authoritySources.length === 0) return html;

    // 空洞引用模式列表（與contentFilterService保持一致）
    const emptyPatterns = [
      '研究顯示', '研究指出', '研究表明',
      '專家建議', '專家指出', '專家表示',
      '調查顯示', '數據顯示'
    ];

    let fixedHtml = html;
    let fixCount = 0;
    let sourceIndex = 0;

    // 逐個檢查並替換空洞引用
    emptyPatterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'g');
      let match;
      const matches = [];
      
      // 找出所有匹配位置
      while ((match = regex.exec(html)) !== null) {
        matches.push({ index: match.index, text: match[0] });
      }
      
      // 從後往前替換（避免索引變化）
      matches.reverse().forEach(({ index, text }) => {
        // 檢查前50字符是否已有<a href標籤且未關閉
        const contextBefore = html.substring(Math.max(0, index - 50), index);
        const openTagCount = (contextBefore.match(/<a\s+href=/g) || []).length;
        const closeTagCount = (contextBefore.match(/<\/a>/g) || []).length;
        
        // 如果前面有未關閉的<a>標籤，說明已在引用內部，跳過
        if (openTagCount > closeTagCount) {
          return;
        }
        
        // 輪流使用權威來源
        const source = authoritySources[sourceIndex % authoritySources.length];
        sourceIndex++;
        
        const sourceLink = `<a href="${source.url}" target="_blank" rel="noopener">${source.institutionName || source.title}</a>`;
        const replacement = `根據${sourceLink}的資料顯示`;
        
        // 替換
        fixedHtml = fixedHtml.substring(0, index) + replacement + fixedHtml.substring(index + text.length);
        fixCount++;
      });
    });

    if (fixCount > 0) {
      console.log(`  🔧 [P4自動修正] 已替換 ${fixCount} 個空洞引用為具體來源`);
    }

    return fixedHtml;
  }

  /**
   * @deprecated 舊方法名稱，保持向後兼容
   */
  static fixEmptyReferences(html, authoritySources = []) {
    return this.autoFixEmptyReferences(html, authoritySources);
  }

  /**
   * P5: 生成後URL驗證與清理
   * 掃描最終HTML中所有<a href>標籤，移除幻覺URL
   * 
   * @param {string} html - 需要驗證的HTML內容
   * @param {Array} authoritySources - 權威來源列表（用於替換）
   * @returns {Object} { cleanedHtml, invalidUrls, validUrls }
   */
  static async validateAndCleanUrls(html, authoritySources = []) {
    console.log('\n🔍 [P5生成後驗證] 開始掃描HTML中的所有URL...');
    
    const AuthoritySourceService = require('./authoritySourceService');
    const urlRegex = /<a\s+href=['"]([^'"]+)['"][^>]*>([^<]*)<\/a>/gi;
    const foundUrls = [];
    const invalidUrls = [];
    const validUrls = [];
    
    let match;
    while ((match = urlRegex.exec(html)) !== null) {
      const url = match[1];
      const linkText = match[2];
      foundUrls.push({ url, linkText, fullMatch: match[0] });
    }
    
    console.log(`  📊 找到 ${foundUrls.length} 個URL引用`);
    
    // 建立白名單 Set 以加速查找
    const whitelist = new Set(authoritySources.map(s => s.url));

    // 驗證每個URL
    for (const item of foundUrls) {
      // 優先檢查白名單：如果 URL 在 Librarian 提供的來源中，直接視為有效
      if (whitelist.has(item.url)) {
        console.log(`  ✅ [白名單URL] ${item.url}`);
        validUrls.push(item);
        continue;
      }

      // 🆕 Strict Mode: 如果有白名單且 URL 不在白名單中，則視為幻覺
      // 這是為了確保 0 幻覺，只允許 Librarian 核准的 URL 出現
      if (whitelist.size > 0) {
         console.log(`  ❌ [非白名單URL] ${item.url}`);
         console.log(`     原因: URL 不在 Librarian 的驗證來源列表中`);
         console.log(`     引用文字: "${item.linkText}"`);
         invalidUrls.push(item);
         continue;
      }

      const validation = AuthoritySourceService.validateUrlFormat(item.url);
      
      if (!validation.valid) {
        console.log(`  ❌ [幻覺URL] ${item.url}`);
        console.log(`     原因: ${validation.reason}`);
        console.log(`     引用文字: "${item.linkText}"`);
        invalidUrls.push(item);
      } else {
        console.log(`  ✅ [有效URL] ${item.url}`);
        validUrls.push(item);
      }
    }
    
    // 清理幻覺URL
    let cleanedHtml = html;
    let removeCount = 0;
    let replaceCount = 0;
    
    for (const item of invalidUrls) {
      // 策略1: 如果有可用的權威來源，替換為真實URL
      if (authoritySources.length > 0 && replaceCount < authoritySources.length) {
        const source = authoritySources[replaceCount % authoritySources.length];
        const replacement = `<a href="${source.url}">${item.linkText || source.name}</a>`;
        cleanedHtml = cleanedHtml.replace(item.fullMatch, replacement);
        console.log(`  🔄 替換為真實來源: ${source.url}`);
        replaceCount++;
      } else {
        // 策略2: 移除<a>標籤但保留文字
        cleanedHtml = cleanedHtml.replace(item.fullMatch, item.linkText);
        console.log(`  🗑️ 移除幻覺連結但保留文字: "${item.linkText}"`);
        removeCount++;
      }
    }
    
    console.log(`\n📋 [P5驗證結果]`);
    console.log(`  ✅ 有效URL: ${validUrls.length} 個`);
    console.log(`  ❌ 幻覺URL: ${invalidUrls.length} 個`);
    console.log(`  🔄 已替換: ${replaceCount} 個`);
    console.log(`  🗑️ 已移除: ${removeCount} 個`);
    
    return {
      cleanedHtml,
      invalidUrls: invalidUrls.map(i => ({ url: i.url, reason: AuthoritySourceService.validateUrlFormat(i.url).reason })),
      validUrls: validUrls.map(i => i.url),
      stats: {
        total: foundUrls.length,
        valid: validUrls.length,
        invalid: invalidUrls.length,
        replaced: replaceCount,
        removed: removeCount
      }
    };
  }
}

module.exports = ArticleService;
