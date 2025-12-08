const AIService = require('./aiService');
const SerperService = require('./serperService');

/**
 * 權威來源動態搜尋服務
 * 根據主題動態識別領域並搜尋權威來源，而非使用固定來源庫
 */
class AuthoritySourceService {
  /**
   * 🛡️ P1: URL格式驗證層
   */
  static validateUrlFormat(url) {
    // 檢查1: 基本URL格式
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { valid: false, reason: 'URL格式錯誤' };
    }

    // 檢查2: 禁止中文字符
    if (/[\u4e00-\u9fa5]/.test(url)) {
      return { valid: false, reason: 'URL包含中文字符（技術上不可能）' };
    }

    // 檢查3: 禁止明顯的連續數字參數（AI幻覺特徵）
    // 擴展檢查：1234系列 (1234, 1235, 1236...)、5678系列、12345等
    const suspiciousPatterns = [
      /[?&](pid|id|nodeid|n|TitleID)=(123[0-9])\b/,      // 1230-1239
      /[?&](pid|id|nodeid|n|TitleID)=(456[0-9])\b/,      // 4560-4569
      /[?&](pid|id|nodeid|n|TitleID)=(567[0-9])\b/,      // 5670-5679
      /[?&](pid|id|nodeid|n|TitleID)=(12345|23456)\b/,   // 長連續數字
      /[?&](pid|id|nodeid|n|TitleID)=(111|222|333|444|555|666|777|888|999)\b/, // 重複數字
      /[?&](pid|id|nodeid|n|TitleID)=(\d)\1{2,}\b/       // 任意數字連續重複3次以上
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        return { valid: false, reason: 'URL包含明顯編造的參數值（連續或重複數字模式）' };
      }
    }

    // 檢查4: 必須是https
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, reason: '必須使用HTTPS協議' };
    }

    // 檢查5: 域名黑名單（過濾已知內容農場與低質量網站）
    // 移除原本的白名單限制，改為開放策略，讓 AI 自行判斷內容價值
    const blockedDomains = [
      'kknews.cc', 'read01.com', 'ppfocus.com', 'zhuanlan.zhihu.com', 
      'pixnet.net', 'xuite.net', 'blogspot.com', 'wordpress.com',
      'dailyheadlines.cc', 'twgreatdaily.com',
      'ppg.ly.gov.tw', // 立法院公報 (通常是會議記錄，非教學內容)
      'gazette.nat.gov.tw' // 政府公報 (同上)
    ];
    
    const isBlocked = blockedDomains.some(d => parsedUrl.hostname.includes(d));
    if (isBlocked) {
      return { valid: false, reason: '網域在黑名單中（內容農場、部落格平台或原始公報）' };
    }

    return { valid: true };
  }

  /**
   * 🌐 P2: URL可訪問性驗證層
   */
  static async validateUrlAccessibility(url, timeout = 5000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 改用 GET 請求以獲取內容進行 Soft 404 檢測
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 
          'User-Agent': 'ContentPilot-Validator/1.0',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });

      clearTimeout(timeoutId);

      if (response.status >= 200 && response.status < 400) {
        // 🆕 Soft 404 檢測：檢查內容是否包含錯誤訊息
        const text = await response.text();
        const lowerText = text.toLowerCase();
        const errorKeywords = [
          '網址不存在', 'page not found', '404 not found', 
          '找不到網頁', '頁面不存在', '無法找到該頁面',
          'sorry, the page you are looking for could not be found'
        ];

        if (errorKeywords.some(kw => lowerText.includes(kw))) {
           return { accessible: false, reason: 'Soft 404: 頁面內容顯示不存在' };
        }

        // 🆕 成功獲取內容，返回給調用者以便進一步分析 (Deep Reading)
        // 簡單清理 HTML 標籤，只保留文字
        const plainText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1500);

        return { 
          accessible: true, 
          status: response.status,
          content: plainText // 返回前 1500 字的純文字內容
        };
      }
      return { accessible: false, reason: `HTTP ${response.status}` };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { accessible: false, reason: '請求超時（5秒）' };
      }
      return { accessible: false, reason: error.message };
    }
  }

  /**
   * 📄 P3: 內容相關性驗證層（簡化版 - 僅檢查標題和URL）
   * 完整版需要爬取頁面內容，這裡先用輕量級方法
   */
  static validateUrlRelevance(source, keyword) {
    // 將關鍵字拆分為tokens
    const keywordTokens = keyword.toLowerCase().split(/[\s,，、]+/);
    
    // 檢查URL和標題中是否包含關鍵字的任何token
    const textToCheck = `${source.url} ${source.title || ''}`.toLowerCase();
    
    const matchedTokens = keywordTokens.filter(token => 
      token.length > 1 && textToCheck.includes(token)
    );
    
    const relevanceRatio = keywordTokens.length > 0 
      ? matchedTokens.length / keywordTokens.length 
      : 0;
    
    // 至少匹配30%的關鍵字tokens才算相關
    const isRelevant = relevanceRatio >= 0.3;
    
    return {
      relevant: isRelevant,
      relevanceRatio: (relevanceRatio * 100).toFixed(0) + '%',
      matchedTokens: matchedTokens.length,
      totalTokens: keywordTokens.length,
      reason: isRelevant 
        ? `匹配${matchedTokens.length}/${keywordTokens.length}個關鍵詞` 
        : `僅匹配${matchedTokens.length}/${keywordTokens.length}個關鍵詞（需至少30%）`
    };
  }

  /**
   * 🎯 核心方法：為給定主題動態生成權威來源
   */
  static async getAuthoritySources(keyword, options = {}) {
    const { provider = 'gemini', maxSources = 3 } = options;

    try {
      // 步驟 1: AI 識別領域與權威關鍵詞
      const domainInfo = await this.identifyDomain(keyword, { provider });
      
      // 步驟 2: 根據領域生成搜尋策略
      const searchQueries = this.generateSearchQueries(keyword, domainInfo);
      
      // 步驟 3: 執行搜尋並驗證來源（P1-P3）
      const sources = await this.searchAndValidateSources(searchQueries, domainInfo, keyword);
      
      // 步驟 4: 按可信度排序並返回 top N
      return sources
        .sort((a, b) => b.credibilityScore - a.credibilityScore)
        .slice(0, maxSources);
    } catch (error) {
      console.error('❌ 權威來源搜尋失敗:', error.message);
      // 降級處理：不再強制返回通用來源，而是返回空陣列
      // 讓上層服務決定是否要使用無引用生成
      return [];
    }
  }

  /**
   * 步驟 1: 使用 AI 識別文章領域並列出權威機構關鍵詞
   */
  static async identifyDomain(keyword, options = {}) {
    const { provider } = options;

    const prompt = `你是一位專業的內容分類專家。請分析以下主題，判斷其所屬領域並列出該領域的權威機構。

## 主題
${keyword}

## 任務
1. 判斷主題所屬領域（請選擇最精確的一個，若無適合可自定義）：
   - health（健康醫療）
   - finance（財經投資）
   - tech（科技資訊）
   - education（教育職涯）
   - lifestyle（生活旅遊）
   - agriculture（農業園藝）
   - science（自然科學）
   - arts（藝術人文）
   - law（法律政策）
   - business（商業管理）
   - general（綜合通識）

2. 針對該「具體主題」，列出台灣最相關的 3-5 個權威機構。
   - **關鍵要求**：請盡量具體，優先列出專門的公協會、學會或研究機構，而非僅列出上級主管機關。
   - 例如主題是「糖尿病」，請列出「糖尿病衛教學會」而非僅列出「衛福部」。
   - 例如主題是「多肉植物」，請列出「多肉植物協會」或「特有生物研究中心」而非僅列出「農委會」。

3. 列出搜尋這些機構時應使用的關鍵詞（機構簡稱、別名）

## 輸出格式（JSON）
\`\`\`json
{
  "domain": "agriculture",
  "domainLabel": "農業園藝",
  "authorityInstitutions": [
    {
      "name": "行政院農業委員會特有生物研究保育中心",
      "shortName": "特生中心",
      "searchKeywords": ["特生中心", "ESRI"],
      "expectedDomain": "gov.tw",
      "reason": "台灣本土生態與物種研究權威"
    },
    {
      "name": "台灣多肉植物協會",
      "shortName": "多肉協會",
      "searchKeywords": ["多肉植物協會"],
      "expectedDomain": "org.tw",
      "reason": "該主題的專門民間組織"
    }
  ],
  "searchStrategy": "優先搜尋專門研究機構與協會，其次才搜尋上級主管機關"
}
\`\`\`

請直接輸出 JSON，不要有其他說明文字。`;

    const result = await AIService.generate(prompt, { 
      provider, 
      temperature: 0.3,
      max_tokens: 1000
    });

    try {
      let cleanContent = result.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '').replace(/```\n?$/g, '');
      }
      return JSON.parse(cleanContent);
    } catch (error) {
      console.error('❌ AI 領域識別結果解析失敗:', error.message);
      // 降級：使用簡單關鍵詞匹配
      return this.simpleDomainDetection(keyword);
    }
  }

  /**
   * 步驟 2: 生成搜尋查詢（使用 AI 建議的權威機構關鍵詞）
   * 🆕 引入「多角度查詢擴展 (Query Expansion)」以確保多元性
   */
  static generateSearchQueries(keyword, domainInfo) {
    const queries = [];
    
    // 1. 針對 AI 識別出的特定權威機構進行搜尋
    domainInfo.authorityInstitutions?.forEach(institution => {
      queries.push({
        query: `${keyword} ${institution.name}`,
        institution: institution,
        type: 'specific_institution',
        priority: 'high'
      });
    });

    // 2. 🆕 強制多元性擴展：針對不同性質的機構進行廣泛搜尋
    // 這是為了避免 AI 識別遺漏，主動去撈取該領域的各類組織
    
    // (A) 政府部門 (.gov.tw) - 僅在特定領域尋找法規
    // 修正：不再對所有主題強制搜尋「法規 政策」，這會導致「立法院公報」等無關文件泛濫
    if (domainInfo.domain === 'law' || domainInfo.domain === 'general') {
      queries.push({
        query: `${keyword} 法規 政策 site:gov.tw`,
        type: 'sector_gov',
        priority: 'high'
      });
    } else if (domainInfo.domain === 'finance') {
       // 財經領域改搜「監管」或「稅務」，避免搜到無關的公報
       queries.push({
        query: `${keyword} 稅務 監管 site:gov.tw`,
        type: 'sector_gov',
        priority: 'medium'
      });
    }

    // (B) 專業協會/非營利組織 (.org.tw) - 尋找實務指引與社群觀點
    queries.push({
      query: `${keyword} 協會 學會 聯盟 site:org.tw`,
      type: 'sector_org',
      priority: 'medium'
    });

    // (C) 學術研究機構 (.edu.tw) - 尋找研究報告與論文
    queries.push({
      query: `${keyword} 研究報告 論文 site:edu.tw`,
      type: 'sector_edu',
      priority: 'medium'
    });

    // (D) 統計數據 - 尋找客觀數據支持
    queries.push({
      query: `${keyword} 統計數據 調查報告`,
      type: 'data_statistics',
      priority: 'medium'
    });

    // (E) 一般權威來源 (開放網域) - 尋找知名企業、券商與媒體報導
    // 這是為了回應「為什麼不能引用券商教學」的需求，納入優質商業內容
    queries.push({
      query: `${keyword} 完整指南 教學 攻略`,
      type: 'sector_general',
      priority: 'high'
    });

    return queries;
  }

  /**
   * 步驟 3: 執行搜尋並驗證來源可信度（P1-P3多層驗證）
   * 使用 SerperService 進行真實搜尋，若失敗則回退到 AI 模擬
   */
  static async searchAndValidateSources(searchQueries, domainInfo, keyword) {
    const allSources = [];

    for (const query of searchQueries.slice(0, 5)) { // 限制查詢數量避免過慢
      // 使用真實搜尋替代模擬搜尋
      const sources = await this.performRealSearch(query, domainInfo);
      allSources.push(...sources);
    }

    console.log(`🔍 搜尋到 ${allSources.length} 個候選來源，開始多層驗證...`);

    // 🛡️ P1 & P2 & P3: 格式 + 可訪問性 + 相關性驗證
    const validatedSources = [];
    const seenUrls = new Set();
    
    for (const source of allSources) {
      if (seenUrls.has(source.url)) continue; // 去重
      
      // P1: 格式驗證
      const formatValidation = this.validateUrlFormat(source.url);
      if (!formatValidation.valid) {
        // console.log(`❌ [P1格式] ${source.url.substring(0, 60)}... - ${formatValidation.reason}`);
        continue;
      }
      
      // P2: 可訪問性驗證（選擇性啟用，避免太慢）
      const enableAccessibilityCheck = process.env.ENABLE_URL_ACCESSIBILITY_CHECK === 'true';
      if (enableAccessibilityCheck) {
        const accessibilityValidation = await this.validateUrlAccessibility(source.url);
        if (!accessibilityValidation.accessible) {
          console.log(`❌ [P2可訪問] ${source.url.substring(0, 60)}... - ${accessibilityValidation.reason}`);
          continue;
        }
        // console.log(`✅ [P2可訪問] ${source.url.substring(0, 60)}... - HTTP ${accessibilityValidation.status}`);
      }
      
      // P3: 內容相關性驗證（輕量級 - 基於URL和標題）
      const relevanceValidation = this.validateUrlRelevance(source, keyword);
      if (!relevanceValidation.relevant) {
        // console.log(`⚠️ [P3相關性] ${source.title?.substring(0, 40)}... - ${relevanceValidation.reason}`);
        // 不直接跳過，只降低評分
        source.relevancePenalty = -15; // 扣15分
      } else {
        // console.log(`✅ [P3相關性] ${source.title?.substring(0, 40)}... - ${relevanceValidation.reason}`);
        source.relevancePenalty = 0;
      }
      
      seenUrls.add(source.url);
      // 評分可信度（考慮相關性懲罰）
      source.credibilityScore = this.calculateCredibilityScore(source, domainInfo) + (source.relevancePenalty || 0);
      validatedSources.push(source);
    }

    console.log(`✅ 驗證完成: ${allSources.length}個候選 → ${validatedSources.length}個通過驗證`);
    return validatedSources;
  }

  /**
   * 執行真實搜尋 (使用 Serper API)
   */
  static async performRealSearch(searchQuery, domainInfo) {
    try {
      // console.log(`🔍 執行真實搜尋: ${searchQuery.query}`);
      const results = await SerperService.search(searchQuery.query, { num: 5 });
      
      if (!results.organic) return [];

      return results.organic.map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        domain: new URL(item.link).hostname,
        institutionName: item.title.split(/[ -_]/)[0], // 簡單猜測機構名
        institutionType: this.guessInstitutionType(item.link),
        sourceType: 'real_search'
      }));
    } catch (error) {
      console.error(`⚠️ 真實搜尋失敗 (${searchQuery.query}):`, error.message);
      // 如果真實搜尋失敗 (例如 API Key 無效)，回退到模擬搜尋
      return this.simulateSearch(searchQuery, domainInfo);
    }
  }

  static guessInstitutionType(url) {
    if (url.includes('.gov')) return 'government';
    if (url.includes('.edu')) return 'academic';
    if (url.includes('.org')) return 'professional_org';
    return 'general';
  }

  /**
   * 🔍 模擬搜尋（實際應替換為真實 SERP API）
   * 🆕 升級為「意圖感知模擬」，根據查詢類型返回對應性質的來源
   */
  static async simulateSearch(searchQuery, domainInfo) {
    const { provider = 'gemini' } = {};

    // 根據查詢類型調整 Prompt，強制 AI 模擬出該類型的來源
    let specificInstruction = '';
    if (searchQuery.type === 'sector_gov') {
      specificInstruction = '請專注於尋找「政府部門 (.gov.tw)」的法規或政策頁面。';
    } else if (searchQuery.type === 'sector_org') {
      specificInstruction = '請專注於尋找「專業協會、學會或非營利組織 (.org.tw)」的頁面。';
    } else if (searchQuery.type === 'sector_edu') {
      specificInstruction = '請專注於尋找「大學或學術研究機構 (.edu.tw)」的研究報告或論文頁面。';
    } else if (searchQuery.type === 'data_statistics') {
      specificInstruction = '請專注於尋找包含「具體統計數據」或「調查報告」的頁面。';
    }

    const prompt = `你是一位網路搜尋專家。請根據以下資訊，模擬搜尋結果並返回相關的權威來源。

## 搜尋查詢
${searchQuery.query}

## 領域資訊
領域：${domainInfo.domainLabel}
查詢類型：${searchQuery.type || 'general'}

## 任務
請列出 1-2 個真實存在的台灣官方/專業網站，這些網站應該：
1. 與查詢主題高度相關
2. 符合查詢類型的性質（如要求政府則必須是 .gov.tw）
3. ${specificInstruction}

## 輸出格式（JSON）
\`\`\`json
[
  {
    "title": "範例標題",
    "url": "https://www.example.gov.tw/page",
    "snippet": "範例描述...",
    "domain": "example.gov.tw",
    "institutionName": "範例機構",
    "institutionType": "government"
  }
]
\`\`\`

**重要**：請僅返回真實存在的台灣官方網站，不要編造。如果不確定，返回空陣列 []。
請直接輸出 JSON 陣列。`;

    try {
      const result = await AIService.generate(prompt, { 
        provider, 
        temperature: 0.2,
        max_tokens: 800
      });

      let cleanContent = result.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/```\n?/g, '').replace(/```\n?$/g, '');
      }
      
      const sources = JSON.parse(cleanContent);
      return Array.isArray(sources) ? sources : [];
    } catch (error) {
      console.error('⚠️ 搜尋模擬失敗:', error.message);
      return [];
    }
  }

  /**
   * 步驟 4: 計算來源可信度分數（0-100）
   * 🆕 根據領域動態調整評分權重
   */
  static calculateCredibilityScore(source, domainInfo) {
    let score = 0;
    const domain = source.domain || source.url?.split('/')[2] || '';
    const currentDomain = domainInfo.domain || 'general';

    // 領域權重配置
    const weights = {
      health: { gov: 40, edu: 35, org: 30, com: 10 }, // 健康領域：嚴格偏好官方/學術
      law: { gov: 45, edu: 30, org: 25, com: 10 },    // 法律領域：政府法規至上
      finance: { gov: 20, edu: 20, org: 25, com: 35 }, // 財經領域：商業機構/券商通常更有實戰價值
      tech: { gov: 10, edu: 30, org: 20, com: 40 },    // 科技領域：商業/技術部落格最新最快
      lifestyle: { gov: 10, edu: 10, org: 20, com: 40 }, // 生活領域：商業/媒體內容為主
      general: { gov: 30, edu: 30, org: 30, com: 25 }  // 預設：均衡
    };

    const w = weights[currentDomain] || weights.general;

    // 1. 域名類型評分（40分）
    if (domain.endsWith('.gov.tw')) {
      score += w.gov;
    } else if (domain.endsWith('.edu.tw')) {
      score += w.edu;
    } else if (domain.endsWith('.org.tw')) {
      score += w.org;
    } else if (domain.includes('gov') || domain.includes('edu')) {
      score += (w.gov + w.edu) / 2;
    } else {
      score += w.com; 
    }

    // 2. 機構類型評分（30分）
    // 對於財經/科技，商業機構(commercial)的權重應該提升
    if (source.institutionType === 'government') {
      score += (currentDomain === 'finance' || currentDomain === 'tech') ? 15 : 30;
    } else if (source.institutionType === 'academic') {
      score += 25;
    } else if (source.institutionType === 'professional_org') {
      score += 20;
    } else {
      // 商業機構/一般網站
      score += (currentDomain === 'finance' || currentDomain === 'tech' || currentDomain === 'lifestyle') ? 30 : 10;
    }

    // 3. 機構名稱匹配度（20分）
    const institutionNames = domainInfo.authorityInstitutions?.map(i => i.name.toLowerCase()) || [];
    const sourceName = (source.institutionName || '').toLowerCase();
    
    if (institutionNames.some(name => sourceName.includes(name) || name.includes(sourceName))) {
      score += 20;
    } else if (institutionNames.some(name => {
      const keywords = name.split(/[、，]/);
      return keywords.some(kw => sourceName.includes(kw));
    })) {
      score += 10;
    }

    // 4. 內容相關性（10分）- 根據 snippet 長度和關鍵詞
    if (source.snippet && source.snippet.length > 50) {
      score += 10;
    } else if (source.snippet && source.snippet.length > 20) {
      score += 5;
    }
    
    // 5. 負面懲罰 (針對特定無用來源)
    // 降低「公報」、「會議記錄」等非教學類政府文件的分數
    if (source.title?.includes('公報') || source.title?.includes('會議記錄') || source.url?.includes('gazette')) {
      score -= 30;
    }

    return Math.min(score, 100);
  }

  /**
   * 降級處理：簡單關鍵詞匹配判斷領域
   */
  static simpleDomainDetection(keyword) {
    const keywordLower = keyword.toLowerCase();

    const patterns = {
      health: ['健康', '醫療', '睡眠', '失眠', '疾病', '症狀', '治療', '飲食', '營養'],
      finance: ['投資', '理財', '股票', 'etf', '基金', '保險', '貸款'],
      tech: ['ai', '人工智慧', '科技', '軟體', '程式', '網路'],
      education: ['學習', '教育', '轉職', '職涯', '培訓'],
      lifestyle: ['旅遊', '親子', '生活', '休閒']
    };

    for (const [domain, keywords] of Object.entries(patterns)) {
      if (keywords.some(kw => keywordLower.includes(kw))) {
        return {
          domain,
          domainLabel: domain,
          authorityInstitutions: [],
          searchStrategy: 'fallback'
        };
      }
    }

    return {
      domain: 'general',
      domainLabel: '綜合',
      authorityInstitutions: [],
      searchStrategy: 'fallback'
    };
  }

  /**
   * 最終降級：當所有搜尋失敗時，返回固定的通用官方來源
   */
  static getFallbackSources(keyword) {
    // 🆕 支援直接傳入 domain key (如 'finance')
    let domainKey = 'general';
    const validDomains = ['health', 'finance', 'tech', 'education', 'lifestyle'];
    
    if (validDomains.includes(keyword)) {
      domainKey = keyword;
    } else {
      const domainInfo = this.simpleDomainDetection(keyword);
      domainKey = domainInfo.domain;
    }

    const fallbackMap = {
      health: [
        {
          title: '衛生福利部',
          url: 'https://www.mohw.gov.tw',
          snippet: '中華民國衛生福利部官方網站',
          domain: 'mohw.gov.tw',
          institutionName: '衛生福利部',
          institutionType: 'government',
          credibilityScore: 90
        },
        {
          title: '國民健康署',
          url: 'https://www.hpa.gov.tw',
          snippet: '提供國民健康資訊與疾病預防指引',
          domain: 'hpa.gov.tw',
          institutionName: '衛生福利部國民健康署',
          institutionType: 'government',
          credibilityScore: 90
        }
      ],
      finance: [
        {
          title: '金融監督管理委員會證券期貨局',
          url: 'https://www.sfb.gov.tw',
          snippet: '主管台灣證券期貨市場，包含海外投資規範',
          domain: 'sfb.gov.tw',
          institutionName: '金管會證期局',
          institutionType: 'government',
          credibilityScore: 95
        },
        {
          title: '臺灣證券交易所',
          url: 'https://www.twse.com.tw',
          snippet: '提供投資人教育資料與市場數據',
          domain: 'twse.com.tw',
          institutionName: '臺灣證券交易所',
          institutionType: 'government',
          credibilityScore: 90
        },
        {
          title: 'U.S. Securities and Exchange Commission (SEC)',
          url: 'https://www.sec.gov',
          snippet: '美國證券市場監管機構，提供投資人教育內容',
          domain: 'sec.gov',
          institutionName: '美國證券交易委員會',
          institutionType: 'government',
          credibilityScore: 95
        },
        {
          title: 'FINRA',
          url: 'https://www.finra.org',
          snippet: '美國金融業監管局，提供券商背景查詢',
          domain: 'finra.org',
          institutionName: '美國金融業監管局',
          institutionType: 'professional_org',
          credibilityScore: 90
        }
      ],
      tech: [
        {
          title: '資策會產業情報研究所',
          url: 'https://mic.iii.org.tw',
          snippet: '科技產業趨勢分析與市場研究',
          domain: 'mic.iii.org.tw',
          institutionName: '資策會MIC',
          institutionType: 'professional_org',
          credibilityScore: 80
        }
      ],
      education: [
        {
          title: '勞動部勞動力發展署',
          url: 'https://www.wda.gov.tw',
          snippet: '職業訓練、技能檢定與就業服務',
          domain: 'wda.gov.tw',
          institutionName: '勞動部勞動力發展署',
          institutionType: 'government',
          credibilityScore: 90
        }
      ],
      lifestyle: [
        {
          title: '交通部觀光署',
          url: 'https://www.taiwan.net.tw',
          snippet: '國內旅遊景點、低碳旅遊資訊',
          domain: 'taiwan.net.tw',
          institutionName: '交通部觀光署',
          institutionType: 'government',
          credibilityScore: 85
        }
      ],
      general: [
        {
          title: '行政院',
          url: 'https://www.ey.gov.tw',
          snippet: '政府政策、公共服務與施政資訊',
          domain: 'ey.gov.tw',
          institutionName: '行政院',
          institutionType: 'government',
          credibilityScore: 90
        }
      ]
    };

    return fallbackMap[domainInfo.domain] || fallbackMap.general;
  }

  /**
   * 🎨 格式化來源為 prompt 可用的文本
   */
  static formatSourcesForPrompt(sources) {
    if (!sources || sources.length === 0) {
      return '無可用權威來源';
    }

    return sources.map(s => 
      `- **${s.title}** (${s.url})\n  ${s.snippet || '無描述'}\n  可信度：${s.credibilityScore}/100`
    ).join('\n\n');
  }
}

module.exports = AuthoritySourceService;
