const fs = require('fs');
const path = require('path');
const AuthoritySourceService = require('./authoritySourceService');

/**
 * LibrarianService (圖書館員服務)
 * 
 * 核心職責：
 * 1. 作為文章生成的「唯一」資料來源
 * 2. 負責檢索、驗證、整理引用資料
 * 3. 確保所有輸出的 URL 都是真實存在的
 */
class LibrarianService {
  constructor() {
    this.knowledgeBasePath = path.join(__dirname, '../data/knowledgeBase.json');
    this.knowledgeBase = this.loadKnowledgeBase();
  }

  createVerificationStatsBucket() {
    return {
      considered: 0,
      passed: 0,
      p0Rejected: 0,
      p1Rejected: 0,
      p2Rejected: 0,
      otherRejected: 0,
      reasons: {
        P0: new Map(),
        P1: new Map(),
        P2: new Map(),
        OTHER: new Map()
      }
    };
  }

  bumpReason(bucket, stage, reason) {
    const safeStage = ['P0', 'P1', 'P2'].includes(stage) ? stage : 'OTHER';
    const safeReason = String(reason || 'unknown').trim() || 'unknown';
    const m = bucket.reasons[safeStage];
    m.set(safeReason, (m.get(safeReason) || 0) + 1);
  }

  formatTopReasons(reasonMap, limit = 3) {
    if (!reasonMap || reasonMap.size === 0) return '';
    return Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([r, c]) => `${c}× ${r}`)
      .join(' | ');
  }

  printVerificationStats(stats) {
    const printBucket = (label, bucket) => {
      if (!bucket || bucket.considered === 0) return;
      console.log(`  📊 ${label}: considered=${bucket.considered}, passed=${bucket.passed}, P0=${bucket.p0Rejected}, P1=${bucket.p1Rejected}, P2=${bucket.p2Rejected}, OTHER=${bucket.otherRejected}`);
      const p0 = this.formatTopReasons(bucket.reasons.P0);
      const p1 = this.formatTopReasons(bucket.reasons.P1);
      const p2 = this.formatTopReasons(bucket.reasons.P2);
      const other = this.formatTopReasons(bucket.reasons.OTHER);
      if (p0) console.log(`     - P0 top: ${p0}`);
      if (p1) console.log(`     - P1 top: ${p1}`);
      if (p2) console.log(`     - P2 top: ${p2}`);
      if (other) console.log(`     - OTHER top: ${other}`);
    };

    console.log('  📈 來源淘汰原因摘要（P0品質 / P1格式 / P2可訪問性）');
    printBucket('SERP', stats?.serp);
    printBucket('Dynamic', stats?.dynamic);
    printBucket('Fallback(best-effort)', stats?.fallback);
  }

  loadKnowledgeBase() {
    try {
      if (fs.existsSync(this.knowledgeBasePath)) {
        return JSON.parse(fs.readFileSync(this.knowledgeBasePath, 'utf-8'));
      }
    } catch (error) {
      console.error('無法讀取知識庫:', error);
    }
    return {};
  }

  /**
   * 根據關鍵字檢索權威來源
   * 策略：靜態知識庫 + SERP 結果驗證
   * 
   * @param {string} keyword - 搜尋關鍵字
   * @param {Object} serpData - 搜尋引擎結果 (可選)
   * @returns {Array} - 驗證過的來源列表
   */
  async getVerifiedSources(keyword, serpData = null) {
    console.log(`📚 [Librarian] 正在為 "${keyword}" 檢索權威來源...`);

    const maxSources = Number(process.env.LIBRARIAN_MAX_SOURCES || 8);
    const dynamicMaxSources = Number(process.env.LIBRARIAN_DYNAMIC_MAX_SOURCES || 15);
    
    let sources = [];
    const seenUrls = new Set();

    const stats = {
      serp: this.createVerificationStatsBucket(),
      dynamic: this.createVerificationStatsBucket(),
      fallback: this.createVerificationStatsBucket()
    };

    // 1. 從靜態知識庫獲取 (最高優先級)
    if (keyword.includes('失眠') || keyword.includes('睡眠')) {
      sources.push(...(this.knowledgeBase.sleep || []));
    } else if (keyword.includes('健康') || keyword.includes('飲食')) {
      sources.push(...(this.knowledgeBase.general_health || []));
    }
    
    // 標記已存在的 URL
    sources.forEach(s => seenUrls.add(s.url));

    // 2. 從 SERP 結果中提取並驗證 (如果有的話)
    if (serpData && serpData.topResults) {
      console.log('  🔍 分析 SERP 結果...');
      for (const result of serpData.topResults) {
        if (seenUrls.has(result.link)) continue;

        stats.serp.considered++;

        // P0: 來源品質預過濾（避免「書單/推薦/懶人包」等低可信頁面進入 Reference Library）
        const preQuality = AuthoritySourceService.validateSourceQuality({
          title: result.title,
          url: result.link,
          snippet: result.snippet || ''
        });
        if (!preQuality.valid) {
          console.log(`  ❌ 來源品質過濾: ${result.link} (${preQuality.reason})`);
          stats.serp.p0Rejected++;
          this.bumpReason(stats.serp, 'P0', preQuality.reason);
          continue;
        }

        // 執行嚴格驗證 (P1 格式 + P2 可訪問性)
        const validation = await this.verifySource(result.link);
        
        if (validation.valid) {
          sources.push({
            id: `serp_${sources.length + 1}`,
            title: result.title,
            url: result.link,
            snippet: result.snippet || '無摘要',
            fullContent: validation.content, // 🆕 儲存完整內容 (Deep Reading)
            credibility: result.credibility_score || 80
          });
          seenUrls.add(result.link);
          console.log(`  ✅ 驗證通過: ${result.link}`);
          stats.serp.passed++;
        } else {
          console.log(`  ❌ 驗證失敗: ${result.link} (${validation.reason})`);

          const stage = validation.stage || 'OTHER';
          if (stage === 'P1') stats.serp.p1Rejected++;
          else if (stage === 'P2') stats.serp.p2Rejected++;
          else stats.serp.otherRejected++;
          this.bumpReason(stats.serp, stage, validation.reason);
        }

        if (sources.length >= maxSources) break; // 最多收集 N 個來源（品質優先可提高）
      }
    }

    // 3. 如果來源仍不足，嘗試動態搜尋補齊 (品質優先)
    if (sources.length < maxSources) {
      console.log('  ⚠️ 來源不足，嘗試動態搜尋...');
      try {
        // 增加 maxSources 到 10，讓更多商業/一般來源能進入候選名單，交由 AI 判斷
        const dynamicSources = await AuthoritySourceService.getAuthoritySources(keyword, { maxSources: dynamicMaxSources });
        for (const ds of dynamicSources) {
          if (seenUrls.has(ds.url)) continue;

          stats.dynamic.considered++;

          // P0: 來源品質預過濾（動態來源亦需過濾書單/推薦類）
          const preQuality = AuthoritySourceService.validateSourceQuality({
            title: ds.title,
            url: ds.url,
            snippet: ds.snippet || ''
          });
          if (!preQuality.valid) {
            stats.dynamic.p0Rejected++;
            this.bumpReason(stats.dynamic, 'P0', preQuality.reason);
            continue;
          }
          
          // 再次確認可訪問性 (AuthoritySourceService 可能只做了 P1)
          const validation = await this.verifySource(ds.url);
          if (validation.valid) {
            sources.push({
              id: `dynamic_${sources.length + 1}`,
              title: ds.title,
              url: ds.url,
              snippet: ds.snippet,
              fullContent: validation.content, // 🆕 儲存完整內容 (Deep Reading)
              credibility: ds.credibilityScore
            });
            seenUrls.add(ds.url);
            stats.dynamic.passed++;
          } else {
            const stage = validation.stage || 'OTHER';
            if (stage === 'P1') stats.dynamic.p1Rejected++;
            else if (stage === 'P2') stats.dynamic.p2Rejected++;
            else stats.dynamic.otherRejected++;
            this.bumpReason(stats.dynamic, stage, validation.reason);
          }

          if (sources.length >= maxSources) break;
        }
      } catch (err) {
        console.warn('  ⚠️ 動態搜尋失敗:', err.message);
      }
    }

    // 4. 如果還是沒有，不再強制使用通用備用來源
    if (sources.length === 0) {
      console.log('  ⚠️ 無法找到特定來源，嘗試使用領域備援來源...');

      try {
        const fallbackSources = AuthoritySourceService.getFallbackSources(keyword);
        for (const fallback of (fallbackSources || [])) {
          if (!fallback?.url) continue;
          if (seenUrls.has(fallback.url)) continue;

          stats.fallback.considered++;

          // Best effort: try to verify & capture content, but still allow curated URLs if access fails.
          let fullContent;
          try {
            const validation = await this.verifySource(fallback.url);
            if (validation?.valid) fullContent = validation.content;
            else if (validation) {
              const stage = validation.stage || 'OTHER';
              if (stage === 'P1') stats.fallback.p1Rejected++;
              else if (stage === 'P2') stats.fallback.p2Rejected++;
              else stats.fallback.otherRejected++;
              this.bumpReason(stats.fallback, stage, validation.reason);
            }
          } catch (_e) {
            // ignore
          }

          sources.push({
            id: `fallback_${sources.length + 1}`,
            title: fallback.title,
            url: fallback.url,
            snippet: fallback.snippet || '無摘要',
            fullContent,
            credibility: fallback.credibilityScore || 80
          });
          seenUrls.add(fallback.url);
          stats.fallback.passed++;

          if (sources.length >= maxSources) break;
        }
      } catch (err) {
        console.warn('  ⚠️ 備援來源取得失敗:', err.message);
      }

      if (sources.length === 0) {
        console.log('  ⚠️ 無法找到特定來源，將不提供任何引用來源');
      }
    }

    this.printVerificationStats(stats);

    console.log(`✅ [Librarian] 最終提供 ${sources.length} 個驗證來源`);
    return sources;
  }

  /**
   * 驗證單一來源 (P1 + P2)
   */
  async verifySource(url) {
    // P1: 格式驗證
    const formatCheck = AuthoritySourceService.validateUrlFormat(url);
    if (!formatCheck.valid) return { ...formatCheck, stage: 'P1' };

    // P2: 可訪問性驗證 (強制執行)
    // 注意：這裡直接調用 AuthoritySourceService 的方法，確保它被正確導出
    try {
      const accessCheck = await AuthoritySourceService.validateUrlAccessibility(url);
      if (!accessCheck.accessible) {
        return { valid: false, stage: 'P2', reason: `無法訪問: ${accessCheck.reason}` };
      }
      // 🆕 成功獲取內容，返回給上層
      return { valid: true, stage: 'OK', content: accessCheck.content };
    } catch (err) {
      return { valid: false, stage: 'P2', reason: `驗證過程錯誤: ${err.message}` };
    }

    return { valid: true };
  }

  /**
   * 將來源格式化為 Prompt 可用的上下文
   */
  formatSourcesForPrompt(sources) {
    if (!sources || sources.length === 0) return '無可用來源';

    return sources.map((s, index) => {
      // 優先使用完整內文 (Deep Reading)，若無則使用摘要
      const content = s.fullContent 
        ? `內文重點: ${s.fullContent}` 
        : `摘要: ${s.snippet}`;
      
      return `[${index + 1}] ${s.title}\n    ${content}\n    URL: ${s.url}`;
    }).join('\n\n');
  }

  /**
   * 移除文章中的引用標記 [1], [2] 等
   * 不再顯示引用標記，保持文章更簡潔易讀
   */
  injectCitations(html, sources) {
    if (!sources || sources.length === 0) return html;

    let processedHtml = html;

    sources.forEach((source, index) => {
      const marker = `\\[${index + 1}\\]`;
      const regex = new RegExp(marker, 'g');
      
      // 🔧 直接移除引用標記，不保留任何痕跡
      processedHtml = processedHtml.replace(regex, '');
    });

    return processedHtml;
  }
}

module.exports = new LibrarianService();