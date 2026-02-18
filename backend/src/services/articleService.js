const AIService = require('./aiService');
const ContentFilterService = require('./contentFilterService');
const SEOOptimizer = require('./seoOptimizer');
const AuthoritySourceService = require('./authoritySourceService');
const ContentQualityValidator = require('./contentQualityValidator');
const ContentQualityReportService = require('./contentQualityReportService');
const ObservabilityService = require('./observabilityService');
const {
  normalizeContentBrief,
  formatContentBriefForPrompt,
  validateContentBriefRequiredFields
} = require('./contentBrief');

// ─── Sub-modules (ARCH-01) ────────────────────────────────────────────────────
const {
  parseCountTokenToNumber: _parseCountTokenToNumber,
  numberToChineseNumeral: _numberToChineseNumeral,
  extractCountPromiseFromHeading: _extractCountPromiseFromHeading,
  countLabeledSubheadings: _countLabeledSubheadings,
  extractLabeledOrdinalSet: _extractLabeledOrdinalSet,
  buildPromiseGuardForPrompt: _buildPromiseGuardForPrompt,
} = require('./article/chineseNumerals');

const {
  stripLinksAndUrls: _stripLinksAndUrls,
  stripHtml: _stripHtml,
  cleanMarkdownArtifacts: _cleanMarkdownArtifacts,
  sanitizeArticleLinks: _sanitizeArticleLinks,
  stripTemplateFooters: _stripTemplateFooters,
  hasUnsupportedStatClaims: _hasUnsupportedStatClaims,
  hasListicleOrBooklistCues: _hasListicleOrBooklistCues,
} = require('./article/htmlPurifier');

const {
  detectDomain: _detectDomain,
  minSourcesForDomain: _minSourcesForDomain,
  computeRequiredSources: _computeRequiredSources,
  buildSchemaValidation: _buildSchemaValidation,
  buildSourceAvailability: _buildSourceAvailability,
  computeSourceCoverage: _computeSourceCoverage,
  evaluateActionSafety: _evaluateActionSafety,
  determineDomain: _determineDomain,
  generateDomainAwareDisclaimer: _generateDomainAwareDisclaimer,
} = require('./article/domainUtils');
// ─────────────────────────────────────────────────────────────────────────────

class ArticleService {
  // ── chineseNumerals delegates ─────────────────────────────────────────────
  static parseCountTokenToNumber(token) { return _parseCountTokenToNumber(token); }
  static numberToChineseNumeral(n) { return _numberToChineseNumeral(n); }
  static extractCountPromiseFromHeading(heading) { return _extractCountPromiseFromHeading(heading); }
  static countLabeledSubheadings(html, label) { return _countLabeledSubheadings(html, label); }
  static extractLabeledOrdinalSet(html, label) { return _extractLabeledOrdinalSet(html, label); }
  static buildPromiseGuardForPrompt(sectionHeading, promise) { return _buildPromiseGuardForPrompt(sectionHeading, promise); }

  // ── htmlPurifier delegates ────────────────────────────────────────────────
  static stripLinksAndUrls(html) { return _stripLinksAndUrls(html); }
  static stripHtml(html) { return _stripHtml(html); }
  static cleanMarkdownArtifacts(content) { return _cleanMarkdownArtifacts(content); }
  static sanitizeArticleLinks(article) { return _sanitizeArticleLinks(article); }
  static stripTemplateFooters(article) { return _stripTemplateFooters(article); }
  static hasUnsupportedStatClaims(html) { return _hasUnsupportedStatClaims(html); }
  static hasListicleOrBooklistCues(html) { return _hasListicleOrBooklistCues(html); }

  // ── domainUtils delegates ─────────────────────────────────────────────────
  static detectDomain(outline) { return _detectDomain(outline); }
  static minSourcesForDomain(domain) { return _minSourcesForDomain(domain); }
  static computeRequiredSources(brief, domain) { return _computeRequiredSources(brief, domain); }
  static buildSchemaValidation(brief, keyword, domain) { return _buildSchemaValidation(brief, keyword, domain); }
  static buildSourceAvailability(v, min, domain) { return _buildSourceAvailability(v, min, domain); }
  static computeSourceCoverage(article, v, domain, min) { return _computeSourceCoverage(article, v, domain, min); }
  static evaluateActionSafety(article, domain) { return _evaluateActionSafety(article, domain); }
  static determineDomain(title) { return _determineDomain(title); }
  static generateDomainAwareDisclaimer(domain, usedSources = [], options = {}) { return _generateDomainAwareDisclaimer(domain, usedSources, options); }

  // ── Quality summary helpers (non-extracted) ───────────────────────────────
  static recomputeQualitySummary(report) {
    const counts = { error: 0, warn: 0, info: 0, total: 0 };
    const findings = Array.isArray(report?.findings) ? report.findings : [];
    findings.forEach((f) => {
      counts.total += 1;
      if (f.severity === 'error') counts.error += 1;
      else if (f.severity === 'warn') counts.warn += 1;
      else counts.info += 1;
    });
    report.summary = {
      total_rules_hit: counts.total || 0,
      error_rules_hit: counts.error,
      warn_rules_hit: counts.warn,
      info_rules_hit: counts.info
    };
    report.pass = counts.error === 0;
    return report;
  }

  static appendQualityFinding(report, finding) {
    if (!report.findings) report.findings = [];
    report.findings.push(finding);
    return this.recomputeQualitySummary(report);
  }

  static async appendMissingPromisedItemsIfNeeded(sectionHeading, html, outline, options) {
    const promise = this.extractCountPromiseFromHeading(sectionHeading);
    if (!promise) return html;

    // Hard enforcement for trap/myth/mistake/step only.
    const enforceable = ['trap', 'myth', 'mistake', 'question', 'step'].includes(promise.kind);
    if (!enforceable) return html;

    const label = promise.label;
    const deliveredSet = this.extractLabeledOrdinalSet(html, label);
    const delivered = deliveredSet.size;
    if (delivered >= promise.count) return html;

    const missingOrdinals = [];
    for (let i = 1; i <= promise.count; i++) {
      if (!deliveredSet.has(i)) missingOrdinals.push(i);
    }
    if (missingOrdinals.length === 0) return html;

    const missingCount = missingOrdinals.length;
    console.log(`   ⚠️  [Promise] 「${sectionHeading}」承諾 ${promise.count} 個${label}，目前只交付 ${delivered} 個，補齊剩餘 ${missingCount} 個...`);

    const { provider } = options || {};
    const safeProvider = provider || 'openai';
    const cleanExisting = this.stripLinksAndUrls(String(html || ''));

    const ordinalHeadings = missingOrdinals.map((n) => {
      if (promise.kind === 'step') return `${label}${n}`;
      return `${label}${this.numberToChineseNumeral(n)}`;
    });

    const ordinalExample = promise.kind === 'step'
      ? `<h3>${label}${missingOrdinals[0]}：…</h3>`
      : `<h3>${label}${this.numberToChineseNumeral(missingOrdinals[0])}：…</h3>`;

    const promptFixed = `你是一位非常嚴格的資深內容編輯。以下段落標題承諾「${promise.count} 個${label}」，但目前只交付 ${delivered} 個。\n\n## 段落標題（H2）\n${sectionHeading}\n\n## 既有段落 HTML（不要重寫、不要刪改）\n${cleanExisting}\n\n## 你缺少的項目序號\n- ${ordinalHeadings.join('\n- ')}\n\n## 你的任務\n- **只輸出缺少的部分**，用 <h3> 子標題補齊到剛好 ${promise.count} 個。\n- 每個缺少的 ${label} 都要有具體可執行建議（可用 <ul>）。\n- 子標題格式示例：${ordinalExample}\n- **禁止**輸出 H2/H1、禁止 URL、禁止 <a>、禁止 Markdown、禁止引用標記 [1]。\n\n請直接輸出 HTML（只包含新增的 <h3>...）。`;

    try {
      const result = await AIService.generate(promptFixed, { provider: safeProvider, temperature: 0.3, max_tokens: 900 });
      let addHtml = this.cleanMarkdownArtifacts(String(result.content || '').trim());
      addHtml = this.stripLinksAndUrls(addHtml);
      if (!addHtml) return html;

      const merged = `${cleanExisting}\n${addHtml}`;
      // Best-effort re-check. If still short, keep merged anyway (do not loop forever).
      const finalDelivered = this.countLabeledSubheadings(merged, label);
      if (finalDelivered < promise.count) {
        console.warn(`   ⚠️  [Promise] 補齊後仍不足（${finalDelivered}/${promise.count}），保留已補內容。`);
      }
      return merged;
    } catch (e) {
      console.warn(`   ⚠️  [Promise] 補齊失敗，保留原段落: ${e.message}`);
      return html;
    }
  }

  static redactReferenceFullContent(article) {
    // Remove potentially large/copyright-sensitive fields from returned outputs.
    // Keep url/title/snippet/credibility for traceability, but drop fullContent.
    const visited = new WeakSet();

    const walk = (node) => {
      if (!node || typeof node !== 'object') return;
      if (visited.has(node)) return;
      visited.add(node);

      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }

      for (const key of Object.keys(node)) {
        if (key === 'fullContent') {
          delete node[key];
          continue;
        }
        walk(node[key]);
      }
    };

    walk(article);
    return article;
  }

  static extractTravelItineraryFromIntroduction(introduction) {
    const plain = String(introduction?.plain_text || '').trim();
    const html = String(introduction?.html || '').trim();
    const text = plain || this.stripHtml(html);
    if (!text) return '';

    const lines = [];
    const re = /Day\s*([1-9]\d*)\s*[：:]\s*([^\n]+)/gi;
    let m;
    while ((m = re.exec(text)) !== null) {
      const day = m[1];
      const desc = String(m[2] || '').trim();
      if (day && desc) lines.push(`Day ${day}：${desc}`);
      if (m.index === re.lastIndex) re.lastIndex++;
    }

    return lines.join('\n');
  }

  static pickPeopleAlsoAskQuestions(outline, serp_data) {
    const candidates = [];

    const serpPaa = serp_data?.peopleAlsoAsk;
    if (Array.isArray(serpPaa)) {
      for (const item of serpPaa) {
        if (!item) continue;
        if (typeof item === 'string') candidates.push(item);
        else if (typeof item === 'object') {
          if (typeof item.question === 'string') candidates.push(item.question);
          else if (typeof item.title === 'string') candidates.push(item.title);
        }
      }
    }

    const outlinePaa = outline?.serp_insights?.people_also_ask;
    if (Array.isArray(outlinePaa)) {
      for (const item of outlinePaa) {
        if (typeof item === 'string') candidates.push(item);
        else if (item && typeof item.question === 'string') candidates.push(item.question);
      }
    }

    const unique = [];
    const seen = new Set();
    for (const q of candidates) {
      const trimmed = String(q).trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      unique.push(trimmed);
      if (unique.length >= 5) break;
    }
    return unique;
  }

  static extractTravelTopicFromKeyword(keyword) {
    const s = String(keyword || '').trim();
    if (!s) return '';

    // Prefer destination names that appear before common travel intent tokens.
    // Examples:
    // - 東京自由行 5天4夜 行程規劃 -> 東京
    // - 大阪 3天2夜 行程 -> 大阪
    const m = s.match(/([\u4e00-\u9fff]{1,8})\s*(?:自由行|旅遊|旅行|行程|景點|攻略)/);
    if (m && m[1]) return String(m[1]).trim();

    // Fallback: first CJK chunk.
    const m2 = s.match(/([\u4e00-\u9fff]{1,8})/);
    if (m2 && m2[1]) return String(m2[1]).trim();

    return '';
  }

  static extractFaqTopicFromKeyword(keyword) {
    const raw = String(keyword || '').trim();
    if (!raw) return '';

    // Normalize whitespace first.
    let s = raw.replace(/\s+/g, ' ').trim();

    // If the keyword contains an explicit "how/what" intent tail, keep the part before it.
    // Examples:
    // - 失眠 怎麼改善 -> 失眠
    // - iPhone 備份到電腦 怎麼做 -> iPhone 備份到電腦
    // - XXX 如何... -> XXX
    const intentCut = s.match(/^(.*?)(?:\s*(?:怎麼做|怎麼辦|怎麼改善|怎麼選|怎麼看|怎麼寫|怎麼講|如何|怎樣)\b.*)?$/);
    if (intentCut && intentCut[1]) {
      s = String(intentCut[1]).trim();
    }

    // Remove common SEO suffixes that should not be repeated verbatim in every FAQ title.
    s = s
      .replace(/\s*(?:完整攻略|完整指南|新手必讀|懶人包|攻略|教學|入門)\s*$/g, '')
      .replace(/\s*(?:範例與架構|範例|架構|流程|步驟|方法)\s*$/g, '')
      .trim();

    // Final fallback: if stripping removed everything, return the original.
    return s || raw.replace(/\s+/g, ' ').trim();
  }

  static normalizeTravelFaqQuestion(question, outline) {
    let q = String(question || '').trim();
    if (!q) return '';

    const primaryKeyword = String(outline?.keywords?.primary || '').trim();
    const topic = this.extractTravelTopicFromKeyword(primaryKeyword || outline?.title || '') || '';

    // If the question contains the full primary keyword, replace it with a short topic (e.g. 東京).
    if (primaryKeyword && q.includes(primaryKeyword)) {
      q = q.split(primaryKeyword).join(topic || '');
    }

    // Light cleanup for common awkward remnants.
    q = q.replace(/\s+/g, ' ').trim();
    q = q.replace(/^新手排\s+/, '新手 ');
    q = q.replace(/\s+\?/g, '?').replace(/\s+？/g, '？');

    // If we replaced to empty and left a leading connector, trim again.
    q = q.replace(/^[-–—:：]+\s*/, '').trim();

    return q;
  }

  static normalizeTravelFaqHeadingsHtml(html, outline) {
    let out = String(html || '');
    if (!out) return out;

    const primaryKeyword = String(outline?.keywords?.primary || '').trim();
    const topic = this.extractTravelTopicFromKeyword(primaryKeyword || outline?.title || '') || '';
    const primaryKeywordCollapsed = primaryKeyword ? primaryKeyword.replace(/\s+/g, '') : '';

    // Deterministic safety net: only touches <h3> question titles.
    out = out.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_m, inner) => {
      let t = String(inner || '');

      if (primaryKeyword && t.includes(primaryKeyword)) {
        t = t.split(primaryKeyword).join(topic || '');
      }

      // Handle cases where the model removes spaces inside the keyword.
      if (primaryKeywordCollapsed && t.includes(primaryKeywordCollapsed)) {
        t = t.split(primaryKeywordCollapsed).join(topic || '');
      }

      // Normalize whitespace.
      t = t.replace(/\s+/g, ' ').trim();
      // Ensure numbering has a single space: "1." -> "1. "
      t = t.replace(/^(\d+)\.\s*/, '$1. ');
      // Avoid duplicate topic: "東京 東京..." -> "東京..."
      if (topic) {
        const dup = new RegExp(`${topic}\\s+${topic}`, 'g');
        t = t.replace(dup, topic);
      }

      return `<h3>${t}</h3>`;
    });

    return out;
  }

  static buildFallbackFaqQuestions(outline, contentDomain) {
    const kw = (outline?.keywords?.primary || outline?.title || '').toString().trim();
    if (!kw) return [];

    const topic = contentDomain === 'travel'
      ? this.extractTravelTopicFromKeyword(kw) || kw
      : this.extractFaqTopicFromKeyword(kw) || kw;

    if (contentDomain === 'finance') {
      return [
        `新手投資理財入門應該先做什麼？`,
        `緊急預備金要存多少才夠？`,
        `每月只有 3000 元可以怎麼開始投資？`,
        `ETF 和基金差在哪裡，新手該怎麼選？`,
        `新手最常見的投資理財錯誤有哪些？`
      ];
    }

    if (contentDomain === 'health') {
      return [
        `${topic} 常見原因是什麼？`,
        `${topic} 有哪些先做的自我檢查？`,
        `${topic} 什麼情況需要就醫？`,
        `${topic} 有哪些居家改善方法？`,
        `${topic} 有哪些常見迷思需要避免？`
      ];
    }

    if (contentDomain === 'travel') {
      const topic = this.extractTravelTopicFromKeyword(kw);
      const topicPrefix = topic ? `${topic}` : '';
      return [
        `${topicPrefix ? `${topicPrefix} ` : ''}行程要怎麼排比較順？`,
        `${topicPrefix ? `第一次去${topicPrefix}，` : ''}新手最容易踩的雷是什麼？`,
        `${topicPrefix ? `${topicPrefix} ` : ''}交通票券要怎麼選？`,
        `${topicPrefix ? `${topicPrefix} ` : ''}住宿選哪個區域比較方便？`,
        `${topicPrefix ? `${topicPrefix} ` : ''}預算大概要抓多少？`
      ];
    }

    return [
      `${topic} 是什麼？`,
      `新手開始「${topic}」時，第一步該做什麼？`,
      `${topic} 有哪些常見錯誤？`,
      `${topic} 需要準備哪些工具或資料？`,
      `${topic} 如何評估效果與調整？`
    ];
  }

  static normalizeFaqHeadingsHtml(html, outline, contentDomain = 'general') {
    let out = String(html || '');
    if (!out) return out;

    const primaryKeyword = String(outline?.keywords?.primary || '').trim();
    const primaryKeywordCollapsed = primaryKeyword ? primaryKeyword.replace(/\s+/g, '') : '';

    const topic = contentDomain === 'travel'
      ? (this.extractTravelTopicFromKeyword(primaryKeyword || outline?.title || '') || '')
      : (this.extractFaqTopicFromKeyword(primaryKeyword || outline?.title || '') || '');

    const collapse = (s) => String(s || '').replace(/[\s_]+/g, '').trim();

    // Deterministic safety net: only touches <h3> question titles.
    out = out.replace(/<h3>([\s\S]*?)<\/h3>/gi, (_m, inner) => {
      let t = String(inner || '');

      // 1) Try to shorten the subject phrase based on common question cues.
      // Example: "面試自我介紹 範例與架構 是什麼？" -> "面試自我介紹 是什麼？"
      // This is intentionally domain-agnostic and does not rely on outline.keyword being long.
      {
        const m = t.match(/^\s*(\d+)\.\s*([\s\S]*)$/);
        const numberPrefix = m ? `${m[1]}. ` : '';
        let body = (m ? m[2] : t).trim();

        const cues = [
          '是什麼',
          '新手',
          '有哪些',
          '需要',
          '該如何',
          '如何',
          '怎麼',
          '要怎麼',
          '怎樣'
        ];

        let cutIdx = -1;
        for (const cue of cues) {
          const idx = body.indexOf(cue);
          if (idx > 0 && (cutIdx === -1 || idx < cutIdx)) cutIdx = idx;
        }

        if (cutIdx > 0) {
          const subject = body.slice(0, cutIdx).trim();
          const slim = this.extractFaqTopicFromKeyword(subject);
          if (slim && slim.length > 0 && slim.length < subject.length) {
            body = `${slim}${body.slice(cutIdx)}`;
            t = `${numberPrefix}${body}`;
          }
        }
      }

      // If the heading begins with a keyword-like prefix (even with different spacing), replace it.
      // This targets the common bad pattern: "<keyword> 是什麼？" / "<keyword> 新手怎麼開始？" etc.
      if (topic && primaryKeywordCollapsed) {
        const m = t.match(/^\s*(\d+)\.\s*([\s\S]*)$/);
        const numberPrefix = m ? `${m[1]}. ` : '';
        const body = (m ? m[2] : t).trim();
        const bodyCollapsed = collapse(body);

        if (bodyCollapsed.startsWith(primaryKeywordCollapsed)) {
          let acc = '';
          for (let i = 0; i < body.length; i++) {
            acc += body[i];
            const accCollapsed = collapse(acc);
            if (accCollapsed.length >= primaryKeywordCollapsed.length) {
              if (accCollapsed.slice(0, primaryKeywordCollapsed.length) === primaryKeywordCollapsed) {
                const replacedBody = `${topic}${body.slice(i + 1)}`;
                t = `${numberPrefix}${replacedBody}`;
              }
              break;
            }
          }
        }
      }

      if (topic) {
        if (primaryKeyword && t.includes(primaryKeyword)) {
          t = t.split(primaryKeyword).join(topic);
        }
        // Also handle cases where the heading contains a whitespace-free keyword string.
        if (primaryKeywordCollapsed && t.includes(primaryKeywordCollapsed)) {
          t = t.split(primaryKeywordCollapsed).join(topic);
        }
      }

      t = t.replace(/\s+/g, ' ').trim();
      t = t.replace(/^(\d+)\.\s*/, '$1. ');
      t = t.replace(/\s+\?/g, '?').replace(/\s+？/g, '？');

      return `<h3>${t}</h3>`;
    });

    return out;
  }

  static async rewriteHtmlStrict(html, outline, options, purpose) {
    const { provider, style_guide } = options || {};
    const prompt = `你是一位極度嚴格的資深編輯。請重寫以下 HTML，使其符合規則。

## 目的
${purpose || '修正內容合規與自然度'}

## 絕對規則（必須遵守）
1. **禁止**任何外部連結、<a> 標籤、完整 URL。
2. **禁止**「根據調查/根據統計/超過70%/83%」等具體統計或百分比（除非你能在文內保留明確 [x] 引用標記，但目前不允許新增）。
3. **禁止**提到「書單/推薦/懶人包/排行榜/top N/幾本」等來源型態或用文章標題當證據。
4. 保留原本的重點與段落結構（<p>, <ul>, <ol>, <strong>, <h3>）。
5. 務必使用台灣繁體中文，語氣：${style_guide?.tone || '專業、務實、親切'}。

## 原始 HTML
${html}

只輸出修正版 HTML，不要任何解釋。`;

    const result = await AIService.generate(prompt, {
      provider,
      temperature: 0.2,
      max_tokens: 1400,
      observability_run_id: options?.observability_run_id
    });

    return this.stripLinksAndUrls(this.cleanMarkdownArtifacts(result.content || '').trim());
  }

  /**
   * 根據大綱生成完整文章
   */
  static async generateArticle(outline, options = {}) {
    try {
      const {
        provider = process.env.AI_PROVIDER || 'openai',
        style_guide = null,
        additional_context = null,
        serp_data = null,
        author_bio,
        author_values,
        target_audience,
        unique_angle,
        expected_outline,
        personal_experience,
        brief,
        observability_run_id
      } = options;

      console.log('📝 開始生成文章...');

      const contentDomain = this.detectDomain(outline);

      const normalizedBriefForValidation = normalizeContentBrief(
        {
          brief,
          keyword: outline?.keywords?.primary || outline?.title,
          tone: style_guide?.tone,
          target_audience,
          author_bio,
          author_values,
          unique_angle,
          expected_outline,
          personal_experience
        },
        { applyDefaults: false, domain: contentDomain }
      );

      const schemaCheck = this.buildSchemaValidation(
        normalizedBriefForValidation,
        outline?.keywords?.primary || outline?.title || '',
        contentDomain
      );

      const normalizedBrief = normalizeContentBrief(
        {
          brief,
          keyword: outline?.keywords?.primary || outline?.title,
          tone: style_guide?.tone,
          target_audience,
          author_bio,
          author_values,
          unique_angle,
          expected_outline,
          personal_experience
        },
        { applyDefaults: Boolean(brief), domain: contentDomain }
      );

      const briefBlock = formatContentBriefForPrompt(normalizedBrief);
      const effectiveTone = normalizedBrief?.author?.tone || style_guide?.tone;
      const effectiveStyleGuide = effectiveTone ? { ...(style_guide || {}), tone: effectiveTone } : style_guide;

      const effectiveAuthorBio = normalizedBrief?.author?.identity || author_bio;
      const effectiveAuthorValues = (normalizedBrief?.author?.values || []).join('、') || author_values;
      const effectiveAudience = normalizedBrief?.targetAudience?.scenario || target_audience;
      const effectiveUniqueAngle = (normalizedBrief?.originality?.uniqueAngles || []).join('、') || unique_angle;
      const effectiveExpectedOutline = normalizedBrief?.expectedOutline || expected_outline;
      const effectivePersonalExperience = normalizedBrief?.originality?.allowedCaseNotes || personal_experience;
      const minSourcesRequired = this.computeRequiredSources(normalizedBrief, contentDomain);

      // 🆕 RAG 架構：預先檢索權威來源 (LibrarianService)
      // 確保整篇文章使用同一組驗證過的來源，避免重複檢索與不一致
      const LibrarianService = require('./librarianService');
      console.log('🔍 [Librarian] 正在檢索權威來源...');
      const verifiedSources = await LibrarianService.getVerifiedSources(outline.title || outline.keywords?.primary);
      console.log(`✅ [Librarian] 獲取 ${verifiedSources.length} 個驗證來源`);

      const sourceAvailability = this.buildSourceAvailability(verifiedSources, minSourcesRequired, contentDomain);
      if (!sourceAvailability.passed) {
        const err = new Error(`source_minimum_not_met: 需要至少 ${minSourcesRequired} 個來源，實得 ${sourceAvailability.available}`);
        err.code = 'SOURCE_MINIMUM_NOT_MET';
        throw err;
      }

      // 逐段生成文章
      // 全面使用 Gemini 模型
      console.log(`🤖 模型策略: 全面使用 ${provider}`);

      const introduction = await this.generateIntroduction(outline, { 
        provider, 
        style_guide: effectiveStyleGuide,
        serp_data,
        contentDomain,
        verifiedSources, // 傳遞來源
        author_bio: effectiveAuthorBio,
        author_values: effectiveAuthorValues,
        target_audience: effectiveAudience,
        unique_angle: effectiveUniqueAngle,
        expected_outline: effectiveExpectedOutline,
        personal_experience: effectivePersonalExperience,
        brief: normalizedBrief,
        briefBlock,
        observability_run_id
      });

      const travelItinerary = contentDomain === 'travel'
        ? this.extractTravelItineraryFromIntroduction(introduction)
        : '';

      const sections = [];
      for (const section of outline.sections || []) {
        const sectionContent = await this.generateSection(section, outline, { 
          provider, 
          style_guide: effectiveStyleGuide,
          serp_data,
          contentDomain,
          verifiedSources, // 傳遞來源
          travelItinerary,
          author_bio: effectiveAuthorBio,
          author_values: effectiveAuthorValues,
          target_audience: effectiveAudience,
          unique_angle: effectiveUniqueAngle,
          expected_outline: effectiveExpectedOutline,
          personal_experience: effectivePersonalExperience,
          brief: normalizedBrief,
          briefBlock,
          observability_run_id
        });
        sections.push(sectionContent);

        // 避免 API rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 🆕 SEO: 追加 FAQ 區塊（優先用 PAA 問題，吃長尾流量）
      let faqQuestions = this.pickPeopleAlsoAskQuestions(outline, serp_data);
      if (faqQuestions.length === 0) {
        faqQuestions = this.buildFallbackFaqQuestions(outline, contentDomain);
      }
      if (faqQuestions.length > 0) {
        const faqSection = await this.generateFaqSection(faqQuestions, outline, {
          provider,
          style_guide: effectiveStyleGuide,
          serp_data,
          contentDomain,
          verifiedSources,
          travelItinerary,
          author_bio: effectiveAuthorBio,
          author_values: effectiveAuthorValues,
          target_audience: effectiveAudience,
          unique_angle: effectiveUniqueAngle,
          expected_outline: effectiveExpectedOutline,
          personal_experience: effectivePersonalExperience,
          brief: normalizedBrief,
          briefBlock,
          observability_run_id
        });
        sections.push(faqSection);
      }

      const conclusion = await this.generateConclusion(outline, sections, { 
        provider, 
        style_guide: effectiveStyleGuide,
        contentDomain,
        verifiedSources, // 傳遞來源
        travelItinerary,
        author_bio: effectiveAuthorBio,
        author_values: effectiveAuthorValues,
        target_audience: effectiveAudience,
        unique_angle: effectiveUniqueAngle,
        personal_experience: effectivePersonalExperience,
        brief: normalizedBrief,
        briefBlock,
        observability_run_id
      });

      // 保障標題與 meta 有值，避免 undefined 注入到 HTML
      const { title: safeTitle, meta_description: safeMeta } = this.resolveTitleMeta(
        outline,
        outline?.keywords?.primary || outline?.keyword || '',
        contentDomain
      );

      const primaryKeyword = outline.keywords?.primary || outline.keyword || outline.title || '';

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
        domain: contentDomain,
        skipHTML: false,
        keyword: primaryKeyword,
        brief: normalizedBrief,
        outlineTitle: outline?.title || ''
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

      // Redact deep-reading raw content from outputs to avoid leaking long source text.
      fullArticle = this.redactReferenceFullContent(fullArticle);

      // 🆕 P1優化：增強 E-E-A-T (添加領域感知的作者簡介與免責聲明)
      if (fullArticle.content?.conclusion?.html) {
        const domain = this.determineDomain(outline.title);
        const disclaimer = this.generateDomainAwareDisclaimer(domain, verifiedSources || [], {
          authorBio: effectiveAuthorBio,
          authorValues: effectiveAuthorValues,
          keyword: primaryKeyword,
        });
        
        fullArticle.content.conclusion.html += disclaimer;
        fullArticle.content.conclusion.plain_text += this.stripHtml(disclaimer);
      }

      // 🆕 P2: 確保目標關鍵字至少出現 2 次，避免密度為 0
      const targetKeyword = primaryKeyword;
      fullArticle = this.ensureKeywordPresence(fullArticle, targetKeyword);

      // 🆕 Final scrub: 移除殘留 <a>/URL，避免格式規則被破壞
      fullArticle = this.sanitizeArticleLinks(fullArticle);

      // 🆕 去除模板化 footer，避免重複聲明污染結尾
      fullArticle = this.stripTemplateFooters(fullArticle);

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

      // 🆕 Quality Stage: deterministic report (for gating + debugging)
      const deterministicReport = ContentQualityReportService.generateReport(fullArticle, {
        domain: contentDomain
      });

      // Keep existing heuristic checks (mechanical patterns, traceability, keyword density)
      try {
        deterministicReport.heuristics = ContentFilterService.generateQualityReport(
          fullArticle,
          outline.keywords?.primary || outline.title || '',
          { brief: normalizedBrief, outlineTitle: outline?.title || '' }
        );
      } catch (e) {
        deterministicReport.heuristics = {
          passed: false,
          error: 'failed_to_generate_heuristics_report'
        };
      }

      // Make the top-level pass reflect both rule-based findings and heuristic checks.
      if (deterministicReport.heuristics && typeof deterministicReport.heuristics.passed === 'boolean') {
        deterministicReport.pass = Boolean(deterministicReport.pass && deterministicReport.heuristics.passed);
      }

      // 🆕 Reader/editor evaluation loop (from backend/docs/CONTENT_EVALUATION_PROMPT.md)
      // Opt-in via options.enable_reader_evaluation / options.enableReaderEvaluation or env ENABLE_READER_EVALUATION=true.
      try {
        const envRaw = String(process.env.ENABLE_READER_EVALUATION || '').trim().toLowerCase();
        const envDefault = envRaw === '' ? true : envRaw === 'true';
        const optFlag =
          options?.enable_reader_evaluation ?? options?.enableReaderEvaluation;
        const enable = optFlag === false ? false : optFlag === true ? true : envDefault;

        if (enable) {
          const ReaderEvaluationService = require('./readerEvaluationService');
          const taText =
            normalizedBrief?.targetAudience?.scenario ||
            normalizedBrief?.targetAudience?.level ||
            target_audience ||
            '';

          deterministicReport.reader_evaluation = await ReaderEvaluationService.evaluateArticle({
            keyword: outline?.keywords?.primary || outline?.title || '',
            ta: taText,
            brief: normalizedBrief,
            title: fullArticle?.title || outline?.title || '',
            contentHtml: allHtml,
            provider
          });
        }
      } catch (e) {
        deterministicReport.reader_evaluation = {
          error: 'failed_to_run_reader_evaluation',
          message: e?.message || String(e)
        };
      }

      const actionSafetyCheck = this.evaluateActionSafety(fullArticle, contentDomain);
      const sourceCoverage = this.computeSourceCoverage(fullArticle, verifiedSources, contentDomain, minSourcesRequired);

      // 🆕 SEO 專家建議驗證
      const wordCountCheck = this.validateWordCount(fullArticle, 2200);
      const titleLengthCheck = this.validateTitleLength(fullArticle.title);
      const introStructureCheck = this.validateIntroStructure(
        fullArticle.content?.introduction?.html || fullArticle.content_draft?.introduction?.html
      );
      const casePresenceCheck = this.validateCasePresence(fullArticle);

      deterministicReport.checks = {
        ...(deterministicReport.checks || {}),
        schema: schemaCheck,
        source_minimum: sourceAvailability,
        source_coverage: sourceCoverage,
        action_safety: actionSafetyCheck,
        reader_evaluation: deterministicReport.reader_evaluation || null,
        // SEO 專家建議檢查
        word_count: wordCountCheck,
        title_length: titleLengthCheck,
        intro_structure: introStructureCheck,
        case_presence: casePresenceCheck
      };

      if (!schemaCheck.passed) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'schema.required_fields',
          severity: 'error',
          message: '內容 brief 缺少必填欄位，請補齊再生成',
          total_count: schemaCheck.missing.length,
          fields: schemaCheck.missing.map((m) => ({ field: m.field, count: 1, samples: [m.message] }))
        });
      }

      if (!sourceAvailability.passed) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'source.min_required',
          severity: 'error',
          message: `來源不足，需至少 ${sourceAvailability.required} 個可信來源` ,
          total_count: 1,
          fields: [{ field: 'sources', count: 1, samples: [`available=${sourceAvailability.available}`] }]
        });
      }

      if (!sourceCoverage.passed) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'source.coverage',
          severity: contentDomain === 'health' ? 'error' : 'warn',
          message: '來源覆蓋不足，需覆蓋核心段落並達到最低來源數',
          total_count: 1,
          fields: [{
            field: 'sources.coverage',
            count: 1,
            samples: [`available=${sourceCoverage.available}, coverage=${sourceCoverage.coverageRatio.toFixed(2)}`]
          }]
        });
      }

      // 🆕 SEO 專家建議檢查的 warnings
      if (!wordCountCheck.passed) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'seo.word_count.too_long',
          severity: 'warn',
          message: wordCountCheck.recommendation || `字數超標 ${wordCountCheck.overBy} 字，建議精簡至 2000 字內`,
          total_count: 1,
          fields: [{ field: 'word_count', count: 1, samples: [`actual=${wordCountCheck.actual}, max=${wordCountCheck.max}`] }]
        });
      }

      if (!titleLengthCheck.passed) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: titleLengthCheck.tooShort ? 'seo.title.too_short' : 'seo.title.too_long',
          severity: 'warn',
          message: titleLengthCheck.recommendation || '標題長度不符合長尾關鍵字要求（35-55字）',
          total_count: 1,
          fields: [{ field: 'title', count: 1, samples: [`length=${titleLengthCheck.length}`] }]
        });
      }

      if (!introStructureCheck.passed) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'seo.intro.second_para_answer',
          severity: 'warn',
          message: introStructureCheck.recommendation || '引言第二段應直接回答核心問題（Featured Snippet 優化）',
          total_count: 1,
          fields: [{ field: 'introduction', count: 1, samples: [`paragraphs=${introStructureCheck.paragraphCount}, hasAnswer=${introStructureCheck.hasAnswerInSecondPara}`] }]
        });
      }

      if (!casePresenceCheck.passed) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'seo.case.missing',
          severity: 'warn',
          message: casePresenceCheck.recommendation || '建議加入具體案例或解決方案（提升 E-E-A-T）',
          total_count: 1,
          fields: [{ field: 'content', count: 1, samples: ['無明顯案例/故事/解決方案標記'] }]
        });
      }

      if (!actionSafetyCheck.action_block) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'action.framework.missing',
          severity: 'error',
          message: '缺少行動框架/可執行步驟，請加入具體清單或流程',
          total_count: 1,
          fields: [{ field: 'content', count: 1, samples: ['需要至少一個含步驟/清單的行動段落'] }]
        });
      }

      if (!actionSafetyCheck.safety_block) {
        this.appendQualityFinding(deterministicReport, {
          rule_id: 'safety.missing',
          severity: contentDomain === 'health' ? 'error' : 'warn',
          message: '缺少安全/禁忌/就醫提示，請在相關段落補充',
          total_count: 1,
          fields: [{ field: 'content', count: 1, samples: ['需有風險/禁忌/何時就醫等提示'] }]
        });
      }

      const readerScores = deterministicReport.reader_evaluation?.parsed || null;

      fullArticle.quality_score = readerScores?.total ?? null;
      fullArticle.eeat_score = readerScores?.persuasiveness ?? null;
      fullArticle.seo_score = readerScores?.seo ?? null;

      fullArticle.metadata = {
        ...(fullArticle.metadata || {}),
        domain: contentDomain,
        sources: {
          required: minSourcesRequired,
          available: sourceAvailability.available,
          coverageCount: sourceCoverage.coverageCount,
          coverageRatio: sourceCoverage.coverageRatio
        },
        checks: deterministicReport.checks,
        reader_scores: readerScores
      };

      fullArticle.quality_report = deterministicReport;

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
    const { provider, style_guide, serp_data, contentDomain = 'general', verifiedSources: passedSources, author_bio, author_values, target_audience, unique_angle, expected_outline, personal_experience, brief, briefBlock } = options;

    console.log('🔍 [Librarian] 正在檢索權威來源...');
    
    // 🆕 使用 LibrarianService 獲取真實來源
    const LibrarianService = require('./librarianService');
    const verifiedSources = passedSources || await LibrarianService.getVerifiedSources(outline.title || outline.keywords?.primary);
    // 段落生成使用「輕量來源上下文」，避免 fullContent 造成 prompt 過長導致模型輸出過短
    const sectionSourceContext = (verifiedSources || []).slice(0, 4).map((source, index) => {
      const fallbackText = String(source?.fullContent || source?.snippet || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 260);
      const summary = String(source?.snippet || fallbackText || '無摘要')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 260);
      return `[${index + 1}] ${source?.title || '未命名來源'}\n摘要: ${summary}`;
    }).join('\n\n');
    const formattedSources = sectionSourceContext || '無可用來源';

    // 用戶常見問題（來自 People Also Ask）
    const userQuestionsList = this.pickPeopleAlsoAskQuestions(outline, serp_data).slice(0, 3);
    const userQuestions = userQuestionsList.length ? userQuestionsList.map(q => `- ${q}`).join('\n') : '';

    // 熱門關鍵詞（來自競爭對手內容分析）
    const topKeywords = serp_data?.contentPatterns?.topSnippetKeywords?.slice(0, 8).map(k => k.word).join('、') || '';

      const travelDeliverable = contentDomain === 'travel' ? `
  ## 🧳 旅遊文章交付物（必須做到，避免模板文）
  1. **開場先交付，不要鋪陳**：第一段第一句不要用問句（例如「你是否曾…」），不要用情緒鋪陳；直接一句話帶出「你可以直接照抄的 5 天快覽」。
      - **加強版**：第一句也不要用「想要…但不知從何開始？」這種套話。
  2. **先給可直接照做的行程快覽**：引言中必須包含一段 <ul> 行程清單，至少 3 天（若題目是「5天4夜」就請寫 Day1～Day5）。
    - 每天至少 1 句：地區/主軸 + 2-3 個行動點（景點/吃什麼/怎麼移動/備案）。
  3. **先交代行程假設**：用 3-5 個要點講清楚：季節/抵達時間大概落點/住宿區域建議/同行者（親子/情侶/朋友）/步調（輕鬆或衝刺）。
    4. **不要寫「本文將/在這篇文章中/在這篇《…》中」**：直接把行程與決策重點端出來。
    5. **自我檢查（必做）**：輸出前請快速檢查：
      - 不要有任何「在這篇」起頭的句子
      - 不要有任何開場問句
      若不符合，請自行重寫直到符合。
  ` : '';

      const normalizedBriefBlock = briefBlock || formatContentBriefForPrompt(brief);

    const prompt = `你是一位擁有 10 年以上經驗的領域專家與內容寫手。請根據以下大綱，撰寫文章的引言部分。目標是讓讀者看完引言就能開始執行，而不是只覺得「講得很對」。

  ${normalizedBriefBlock}

## 文章標題
${outline.title}

## 引言結構
${JSON.stringify(outline.introduction, null, 2)}

## 主要關鍵字
${outline.keywords?.primary || ''}

## 目標受眾
${target_audience || '一般讀者'}

## 🔍 競爭對手內容分析
高頻關鍵詞：${topKeywords || '無數據'}

## 👥 用戶常見問題（People Also Ask）
${userQuestions ? `- ${userQuestions}` : '無數據'}

## 📚 參考文獻庫 (Reference Library)
${formattedSources}

## 👤 作者 Persona 與價值觀 (重要！)
${author_bio ? `- 作者背景: ${author_bio}` : ''}
${author_values ? `- 核心價值觀: ${author_values}` : ''}
${unique_angle ? `- 獨特觀點/立場: ${unique_angle}` : ''}
${personal_experience ? `- 可引用的真實經驗/案例: ${personal_experience}` : ''}
請務必將上述作者的觀點與風格融入寫作中，確保內容具有獨特性與個人色彩。

${expected_outline ? `## 期望涵蓋的大綱/重點（需呼應）
${expected_outline}
` : ''}

${travelDeliverable}

## 🎯 核心結構：「第二段回答」原則（SEO Featured Snippet 優化）
**引言必須包含 3 段結構（這是 Google Featured Snippet 擷取的關鍵）：**

1. **第一段（痛點情境）**：30-50字，直接點出讀者情境/問題
   - ❌ 不要：問句開場、模板鋪陳（「你是否也曾...」）
   - ✅ 範例：「月薪3萬，扣完房租生活費剩不多，但又怕錢放著貶值——這是多數小資族面對『投資理財』的第一道坎。」

2. **第二段（核心答案摘要）**：80-120字，**直接給出答案摘要**
   - 這段是 Google Featured Snippet 擷取的關鍵！必須直接回答標題/關鍵字的核心問題。
   - ✅ 範例：「簡單說：先存3-6個月緊急預備金，再用『631法則』分配：60%生活開銷、30%儲蓄投資、10%自我提升。投資部分建議從低成本的 ETF（如0050）開始，每月定期定額3000元即可。」
   - ✅ 範例：「關鍵在於：睡前2小時停用3C、室溫控制在18-22度、固定時間上床。若仍無法入睡超過20分鐘，起身做輕鬆活動，等有睡意再回床上。」

3. **第三段（本文預告）**：40-60字，說明文章會提供什麼
   - ✅ 範例：「下面我會帶你走過：預備金怎麼算、哪些工具適合新手、以及 3 個最常踩的雷怎麼避開。」

**自我檢查（輸出前必做）**：確認第二段是否**直接回答標題/關鍵字的核心問題**？若否，請重寫。

## 寫作要求
1. **專業但誠實**：使用第三人稱或客觀描述，避免虛構個人經驗。
2. **痛點共鳴**：開場直接切入讀者痛點，可用情境/例子/普遍觀察；**不要硬塞百分比統計**。
3. **稱呼一致**：全篇一律使用「你／你的」，不要使用「您／您的」。
4. **避免口號句**：不要寫「讓我們一起啟程吧／一起開始吧」這類口號；用更直接的資訊與可執行建議取代。
5. **自然融入關鍵字**：主要關鍵字「${outline.keywords?.primary}」必須在引言中出現至少2次，以自然的方式融入句子中，避免堆砌或生硬插入。目標密度0.8%-1.2%。
6. 字數控制在 250-350 字（含三段結構）
7. 語氣：${style_guide?.tone || '專業、親切且具權威感'}
${style_guide ? `8. 品牌風格：${JSON.stringify(style_guide)}` : ''}

## 事實與數據規則（非常重要）
1. **禁止編造統計**：不要寫「根據統計、超過70%、多數人」這類具體百分比或數量，除非參考文獻庫中有清楚的對應描述。
2. **若沒有可信來源**：用「許多人/不少人/常見情況」等定性描述替代，或乾脆不寫。

## **E-E-A-T 引用規範（Citation Protocol）**：

**核心原則：引用是為了增強可信度，不是為了炫耀來源。只在真正需要時才引用。**

### 絕對禁止的引用/連結
- **禁止**引用或連結任何「書單、推薦、必看、懶人包、排行榜」類文章（即使它出現在參考文獻庫）。
- **禁止**使用「根據《文章標題》顯示/指出」這種學生式句型。

### 何時需要引用？
✅ **必須引用的情況**：
   - 具體統計數據（例如：「70%的上班族有失眠問題」）
   - 專業研究結論（例如：「研究證實CBD對焦慮症有緩解效果」）
   - 爭議性或非常識性論點（例如：「間歇性斷食可能損害女性荷爾蒙」）
   - 專業建議或治療方法（例如：「美國心臟協會建議每週運動150分鐘」）

❌ **不需要引用的情況**：
   - 普遍常識（例如：「運動有益健康」、「睡眠不足影響工作效率」）
   - 基礎定義（例如：「上背痛是指肩胛骨區域的疼痛」）
   - 一般性建議（例如：「建議保持良好坐姿」、「定時休息很重要」）
   - 邏輯推論（例如：「長時間久坐會導致肌肉緊張」）

### 來源品質判斷
**嚴格禁止自行編造 URL。你只能使用「參考文獻庫」中提供的資料。**

1. **來源選擇標準**：
   - ✅ 優先引用：政府機關、學術機構、大型醫療機構、知名媒體、專業協會
   - ⚠️ 謹慎評估：券商報告、企業白皮書（可能有商業偏見）
   - ❌ 直接忽略：個人部落格、內容農場、書目清單、年度新書目錄、論壇討論

2. **引用方式**（自然且簡潔）：
  - ✅ 好的引用：「研究指出，長期分散投資可降低波動風險。」
  - ✅ 好的引用：「在實務上常見的做法是先準備緊急預備金，再開始投資。」
  - ❌ 壞的引用：「根據《XX推薦書單》顯示...」（書單/推薦類來源不具權威性）

3. **禁止事項**：
  ❌ 不要寫出完整的 URL (例如 https://...)
  ❌ 不要寫 <a href="..."> 標籤
   ❌ 不要寫引用標記如 [1], [2], [3] 等
   ❌ 不要引用參考文獻庫以外的來源
   ❌ 不要為常識性內容強行添加引用

4. **最終原則**：
   - **如果「參考文獻庫」為空或無高品質來源，請依據專業知識撰寫，不要勉強引用。**
   - **寧可0引用，也不要引用低品質或不相關的來源。**
   - **內容的專業性來自你的知識，不是來源的數量。**

## 📋 HTML 輸出格式規範（嚴格遵守）

**✅ 必須遵守：**
1. 直接以 <p> 段落開始，不要任何 <h1>, <h2> 標題
2. 使用標準HTML標籤：<p>, <strong>, <ul>, <ol>, <li>
3. 所有標籤必須正確閉合
4. 不要包含任何 Markdown 語法
5. 不要輸出任何解釋文字，只輸出HTML代碼

**❌ 禁止事項：**
- 不要寫 <h2> 或 <h1> 標籤
- 不要在開頭重複文章標題
- 不要包含參考文獻列表
- 不要使用 [1], [2] 等引用標記

## 🎯 質量標準示範

**❌ 禁止這樣寫（空泛農場文）：**
"投資理財是很重要的事情。我們需要仔細規劃，並選擇合適的工具。這對未來很有幫助。"

**✅ 必須這樣寫（具體專業內容）：**
**✅ 必須這樣寫（具體、可執行、非模板）：**
"如果你正在找『新手投資理財入門』的做法，最容易卡關的通常不是工具太少，而是不知道先後順序：先把緊急預備金與負債整理好，再決定用定期定額或一次性投入。下面我會先給你一個可照做的決策流程，並列出新手最常踩的 5 個雷，讓你不用靠猜。"

請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, {
      provider,
      temperature: 0.7,
      observability_run_id: options?.observability_run_id
    });
    
    // 🆕 清理 Markdown 代碼塊標記
    let cleanedContent = this.cleanMarkdownArtifacts(result.content);
    
    // 🆕 Post-processing: 移除引用標記、並強制去除外部連結/URL
    let processedHtml = LibrarianService.injectCitations(cleanedContent, verifiedSources);
    processedHtml = this.stripLinksAndUrls(processedHtml);

    // P0: 介紹段落防回歸（統計/書單/推薦類措辭）
    if (this.hasUnsupportedStatClaims(processedHtml) || this.hasListicleOrBooklistCues(processedHtml)) {
      processedHtml = await this.rewriteHtmlStrict(
        processedHtml,
        outline,
        options,
        '移除不可靠統計/書單式引用，讓引言更自然可信'
      );
    }

    // P0 (travel): remove template openings + opening questions deterministically, via rewrite.
    if (contentDomain === 'travel') {
      const introText = this.stripHtml(processedHtml);
      const templateOpeningRe = /(在(?:這篇|本篇)文章中|在這篇《|在本文中|本文將|這篇文章將|本篇文章將|在文章中|文章整理了|將介紹)/;
      const terminatorIdxCandidates = [
        introText.indexOf('。'),
        introText.indexOf('！'),
        introText.indexOf('？'),
        introText.indexOf('?'),
        introText.indexOf('\n')
      ].filter((i) => i >= 0);
      const firstTerminatorIdx = terminatorIdxCandidates.length ? Math.min(...terminatorIdxCandidates) : Math.min(introText.length, 160);
      const openingSpan = String(introText || '').slice(0, Math.min(introText.length, firstTerminatorIdx + 1));
      const hasOpeningQuestion = /[？?]/.test(openingSpan);
      const hasDuplicateBridge = /(接下來)[，,]\s*\1/.test(introText);

      if (templateOpeningRe.test(introText) || hasOpeningQuestion || hasDuplicateBridge) {
        processedHtml = await this.rewriteHtmlStrict(
          processedHtml,
          outline,
          options,
          '移除模板式開場（例如「在本篇文章中/本文將…」）、開場問句與重複銜接詞（如「接下來，接下來」）；第一句直接交付行程快覽'
        );
        processedHtml = this.stripLinksAndUrls(processedHtml);
      }
    }

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
    const { provider, style_guide, serp_data, internal_links, contentDomain = 'general', verifiedSources: passedSources, author_bio, author_values, target_audience, unique_angle, expected_outline, personal_experience, travelItinerary, brief, briefBlock, observability_run_id } = options;

    // 🔧 兼容性處理：支援 title 或 heading
    const sectionHeading = section.heading || section.title || '未命名段落';
    const subsectionsText = section.subsections
      ? section.subsections.map(sub => {
          const subHeading = sub.heading || sub.title || sub;
          const subDescription = sub.description || '';
          return typeof sub === 'string' ? `### ${sub}` : `### ${subHeading}\n${subDescription}`;
        }).join('\n\n')
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
    // 內部連結建議（注意：全站禁止輸出 URL / <a>，僅能提及錨文字本身）
    const internalLinksText = internal_links?.slice(0, 3).map(link => `- ${link.anchor_text}`).join('\n') || '';

    const travelSectionDeliverable = contentDomain === 'travel' ? `
  ## 🧳 旅遊段落寫法（避免模板文，務必可落地）
  1. 每個小節至少提供 3 個「可以照做」的細節：時間/路線/區域選擇/票券決策/避雷。
  2. 至少提供 1 個備案（例如：雨天/人潮爆炸/體力不足時怎麼改）。
  3. 避免抽象形容詞（例如「很方便」「很值得」），要說清楚「為什麼」與「怎麼做」。
  4. **一致性硬規則**：若本段落要提到「第X天/DayX」或把景點分配到某一天，必須與「行程快覽」一致；不確定就不要寫第幾天。
  ` : '';

    const travelItineraryBlock = contentDomain === 'travel' && String(travelItinerary || '').trim()
      ? `\n## ✅ 行程快覽（請以此為準，不得矛盾）\n${String(travelItinerary).trim()}\n`
      : '';

    const normalizedBriefBlock = briefBlock || formatContentBriefForPrompt(brief);
    const deliverablesReminder = Array.isArray(brief?.deliverables?.mustInclude) && brief.deliverables.mustInclude.length
      ? `\n## ✅ 必交付（全文至少要交付一次）\n- ${brief.deliverables.mustInclude.map((v) => String(v)).join('\n- ')}\n`
      : '';

    const promise = this.extractCountPromiseFromHeading(sectionHeading);
    const promiseGuard = this.buildPromiseGuardForPrompt(sectionHeading, promise);

    const prompt = `你是一位擁有 10 年以上經驗的領域專家與 SEO 內容寫手${author_bio ? `，你的身分是：${author_bio}` : ''}。請根據以下要求，撰寫文章的段落內容。

  ${normalizedBriefBlock}
  ${deliverablesReminder}
  ${promiseGuard}

## 段落標題（H2）
${sectionHeading}

${author_values ? `## 👤 作者價值觀（必須反映在內容中）
${author_values}
- 每個論點、建議都要符合此價值觀，否則請刪除或改寫。
` : ''}
${unique_angle ? `## 🎯 獨特觀點 / 核心立場
- ${unique_angle}
請在段落中多次呼應此觀點，避免泛泛而談。
` : ''}
## 要寫的重點
${section.key_points?.join('\n- ') || ''}

## 子段落結構（必須使用 H3）
${subsectionsText}
**重要**：每個子主題必須用 <h3> 標籤標示，形成清晰層級（H2 > H3 > 段落）。

## 目標字數
約 ${section.estimated_words || 300} 字

## 目標受眾
${target_audience || '一般讀者'}

## 相關關鍵字
主要：${outline.keywords?.primary || ''}
次要：${outline.keywords?.secondary?.join(', ') || ''}
LSI：${outline.keywords?.lsi?.join(', ') || ''}

**關鍵字使用策略**：
- 主關鍵字「${outline.keywords?.primary}」在本段落自然出現 0-1 次（不強求，視語境）。
- 次要關鍵字與 LSI 詞自然融入，不刻意堆砌。

## 🔍 競爭對手內容分析
**高頻關鍵詞**：${topKeywords || '無數據'}

**競爭對手如何描述這個主題**（參考但不抄襲）：
${competitorInsights || '無數據'}

## 📚 參考文獻庫 (Reference Library)
${formattedSources}

## 🔗 內部連結建議（如有）
${internalLinksText || '無可用內部連結'}

${travelItineraryBlock}

## 👤 作者 Persona 與價值觀 (重要！)
${author_bio ? `- 作者背景: ${author_bio}` : ''}
${author_values ? `- 核心價值觀: ${author_values}` : ''}
${unique_angle ? `- 獨特觀點/角度: ${unique_angle}` : ''}
${personal_experience ? `- 可引用的真實經驗/案例: ${personal_experience}` : ''}
請務必將上述作者的觀點與風格融入寫作中，確保內容具有獨特性與個人色彩。

${expected_outline ? `## 期望涵蓋的大綱/重點（需呼應）
${expected_outline}
` : ''}

${travelSectionDeliverable}

## ✍️ 寫作風格約束（避免 AI 常見問題）
1. **可讀性優先**：
   - 每段 3-4 句話，每句 15-25 字。
   - 避免長複句，讓國中生也能輕鬆理解。
  - 多用「你可以」「建議」「直接做法」等行動導向詞，避免空泛的「以下步驟」。
2. **禁用 AI 慣用詞**：避免「深入探討」「全面解析」「不容忽視」「至關重要」「值得注意的是」等填充詞。
3. **具體化**：用數據、案例、操作細節、比喻取代抽象描述。例如：「風險很高」→「損失可能超過本金 30%」。
4. **口吻自然**：像對朋友說話，不要像教科書或官方文件。

## 寫作要求
1. **⛔ 範圍嚴格限制 (Scope Control)**：
   - **你現在只負責撰寫「${section.heading}」這個段落。**
   - ❌ **絕對禁止** 撰寫引言 (Introduction) 或結語 (Conclusion)。
   - ❌ **絕對禁止** 提及其他段落的內容（例如不要在這裡寫「下一段我們將討論...」）。
   - 請專注於本段落的 \`key_points\`，深入挖掘，不要廣泛帶過。

2. **⛔ 格式嚴格限制 (Structure Control)**：
   - ❌ **不要** 在開頭重複寫出章節標題「${section.heading}」（系統會自動添加 H2）。
   - 直接以 H3 子標題或內文段落開始。
   - 必須使用 <h3> 標籤標示子主題，形成 H2 > H3 > 段落的清晰層級。
   - **禁止**使用 H1 或 H2 標題。

3. **拒絕空話 (No Fluff)**：
   - ❌ 禁止：「選擇適合的工具很重要」、「這需要仔細考量」等廢話。
  - ✅ 必須：「建議使用 Firstrade 或 Schwab，因為...」、「手續費通常為 0 元，但需注意...」。
  - 請提供**具體的名稱、數字、操作動作、比較**。

3. **專家視角與實戰建議**：
   - 以專家的口吻撰寫，提供"見解"（Insight）而非僅是資訊堆疊。
   - 在解釋概念時，提供實際操作的建議或注意事項（「在實務上，建議...」）。

3. **自然融入關鍵字**：主要關鍵字「${outline.keywords?.primary}」在本段落中自然融入即可（可不出現），避免為了出現而硬塞。SEO 會在全篇層級處理。

4. **結構化輸出**：
  - 若 brief 要求 steps/checklist 才用 <ol>/<ul> 交付；一般情況用要點清單或小標，避免「第1步/Step 1」模板。
   - 若涉及比較，請嘗試用文字清楚描述差異（如：A券商適合X，B券商適合Y）。

5. 每個子標題（H3）需有 150-200 字的內容（較長內容利於SEO排名）
6. 語氣：${style_guide?.tone || '專業、親切且具權威感'}
${style_guide ? `7. 品牌風格：${JSON.stringify(style_guide)}` : ''}

## **E-E-A-T 引用規範（Citation Protocol）**：

**核心原則：引用是為了增強可信度，不是為了炀耀來源。只在真正需要時才引用。**

### 何時需要引用？
✅ **必須引用的情況**：
   - 具體統計數據（例如：「70%的上班族有失眠問題」）
   - 專業研究結論（例如：「研究證實CBD對焦慮症有緩解效果」）
   - 爭議性或非常識性論點（例如：「間歇性斷食可能損害女性荷爾蒙」）
   - 專業建議或治療方法（例如：「美國心臟協會建議每週運動150分鐘」）

❌ **不需要引用的情況**：
   - 普遍常識（例如：「運動有益健康」、「睡眠不足影響工作效率」）
   - 基礎定義（例如：「上背痛是指肩胛骨區域的疼痛」）
   - 一般性建議（例如：「建議保持良好坐姿」、「定時休息很重要」）
   - 邏輯推論（例如：「長時間久坐會導致肌肉緊張」）

### 引用方式與語氣
- **✅ 自然融入（推薦）**：
  - 「專家普遍建議，緊急預備金應至少涵蓋 3-6 個月的生活費。」（將來源資訊轉化為通用建議）
  - 「研究指出，長期定期定額投資能有效降低平均成本。」（歸納多個來源的結論）
  - 「根據衛福部 2023 年的統計...」（引用具權威機構的特定數據）

- **❌ 生硬引用（禁止）**：
  - 「根據《2021新手理財推薦書單》這篇文章顯示...」（禁止引用文章標題）
  - 「根據《10個必看的投資觀念》指出...」（禁止引用農場文標題）
  - 「資料來源顯示...」（太像機器人）

### 來源品質判斷與過濾
**嚴格禁止自行編造 URL。你只能使用「參考文獻庫」中提供的資料。**
**即使參考文獻庫中有這些資料，你也必須主動過濾：**
1. **忽略標題為「書單」、「推薦」、「懶人包」、「必看」的來源標題**，只提取其中的知識點，不要提及該文章標題。
2. **嚴格禁止**引用「博客來」、「金石堂」等電商頁面或「個人部落格」作為權威依據。
3. **只引用**：政府機關、學術機構、大型金融機構、知名新聞媒體。

### 最終原則
**你的目標是寫出一篇「專家級」的文章，而不是一篇「讀書心得報告」。**
- 專家會說：「建議你先存下 3 個月生活費。」
- 學生會說：「根據網路上的一篇文章說，要存 3 個月薪水。」
**請扮演專家，直接給出建議，除非是引用「數據」或「法規」，否則不要刻意強調「根據...」。**

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
- **禁止**輸出任何 URL 或 <a> 連結（外部/內部都不行）。
- 如果有提供內部連結建議，只能自然提到「錨文本」本身，不要放連結。

## 📋 HTML 輸出格式規範（嚴格遵守）

**✅ 正確結構：**
\`\`\`html
<h3>第一個子主題</h3>
<p>具體內容，包含數字、案例或專有名詞...</p>
<ul>
  <li>具體要點1</li>
  <li>具體要點2</li>
</ul>

<h3>第二個子主題</h3>
<p>更多具體內容...</p>
\`\`\`

**❌ 禁止事項：**
1. 不要重複寫 <h2>主標題（系統會自動添加）
2. 不要使用 <h1> 標籤
3. 不要在開頭寫解釋文字
4. 不要包含參考文獻列表
5. 不要使用 [1], [2] 引用標記
6. 所有標籤必須正確閉合

## 🎯 質量標準示範（領域無關）

**❌ 禁止這樣寫（空泛農場文）：**
\`\`\`html
<h3>基本概念</h3>
<p>這個概念很重要，需要仔細理解。我們應該深入探討相關內容，全面掌握核心知識。</p>
\`\`\`
**問題：**無具體內容、空泛描述、禁用詞彙

**✅ 必須這樣寫（具體專業內容）：**
\`\`\`html
<h3>ETF 定期定額：金額與節奏怎麼定</h3>
<p>新手最常卡在「要放多少錢、多久扣一次」。下面的設定可以直接照做，不用猜：</p>
<ul>
  <li><strong>金額：</strong>先抓月收入 10% 當試運作額度（例如收入 6 萬就先扣 6 千），3 個月後再依波動調整。</li>
  <li><strong>下單節奏：</strong>選每月固定同一天扣款，避開臨時加碼；把「臨時想加碼」改成每季一次的檢查日。</li>
  <li><strong>風險控制：</strong>若 3 個月內最大回撤超過 8%，先把扣款金額減半並檢查持有標的是否過度集中。</li>
</ul>
<p>這樣的做法把「金額、頻率、風險上限」都先定義好，讀者可以直接套用，再依自身波動耐受度微調。</p>
\`\`\`
**優點：**直接給可落地的設定，沒有模板式「第1步/第2步」橋段，也沒有硬塞統計或虛構案例

## 🎯 內容質量標準（通用要求）

**每個段落必須包含：**
1. **具體細節**（至少2個）：
  - 數字/區間（例如：「每週 1 次」、「3-6 個月」）
   - 專有名詞（「Firstrade券商」、「斜方肌」）
   - 時間/數量（「3個月內」、「每週2次」）
   
2. **可執行建議**（至少1個）：
  - 行動指令（「先設月扣款上限…」、「遇到X時改Y」）
  - 具體建議（「建議使用...」）
   - 注意事項（「避免...」、「記住...」）

3. **每個H3至少200字**：
   - 不要只寫2-3句話就結束
   - 展開說明、提供範例

**禁止使用空泛詞彙：**
❌ 深入探討、全面解析、值得注意、至關重要、相當關鍵
❌ 這很重要、需要仔細考量、不容忽視
✅ 改用具體描述：「投入比例超過你能承受的波動」、「建議每週固定 1 次檢視」

（提醒：避免捏造具體百分比或虛構案例；如果沒有可信來源，就用定性描述或給出可驗證的操作規則。）

直接輸出 HTML，不要有任何解釋文字。
請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    // 動態調整 max_tokens 根據 estimated_words（提高輸出上限，避免段落被截斷）
    const targetWords = section.estimated_words || 350;
    const maxTokens = Math.min(Math.ceil(targetWords * 3), 3000);
    const minSectionChars = Math.max(160, Math.floor(targetWords * 0.45));
    const countChineseChars = (text) => (String(text || '').match(/[\u4e00-\u9fff]/g) || []).length;
    const hasValidH3Block = (html) => /<h3\b[^>]*>[\s\S]*?<\/h3>/i.test(String(html || ''));

    const ensureSectionQuality = async (initialHtml) => {
      let candidate = String(initialHtml || '').trim();

      for (let attempt = 1; attempt <= 2; attempt++) {
        const plain = this.stripHtml(candidate);
        const chars = countChineseChars(plain);
        if (chars >= minSectionChars && hasValidH3Block(candidate)) {
          return candidate;
        }

        const retryProvider = attempt === 2 && provider === 'gemini' ? 'openai' : provider;
        const reasonCode = 'SECTION_CONTENT_TOO_SHORT';
        console.warn(`  ⚠️ 段落內容過短（${chars}字），啟動重試 #${attempt}（provider=${retryProvider}）...`);
        ObservabilityService.recordRetry(observability_run_id, {
          stage: `section:${sectionHeading}`,
          reason_code: reasonCode,
          provider: retryProvider
        });

        if (retryProvider !== provider) {
          ObservabilityService.recordFallback(observability_run_id, {
            from_provider: provider,
            to_provider: retryProvider,
            reason_code: 'SECTION_RETRY_PROVIDER_SWITCH'
          });
        }

        const retryPrompt = `你是一位專業內容編輯。上一版「${sectionHeading}」內容過短，請完整重寫。\n\n## 段落標題（H2）\n${sectionHeading}\n\n## 要點\n${section.key_points?.join('\n- ') || '請依標題延伸重點'}\n\n## 子主題（若有）\n${subsectionsText || '請自行補足 2-3 個 H3 子主題'}\n\n## 必須遵守\n1. 只輸出 HTML，不要解釋。\n2. 至少 2 個 <h3> 子標題，每個 <h3> 後至少 1 個 <p>。\n3. 全段至少 ${minSectionChars} 字中文內容。\n4. 禁止 H1/H2、禁止 Markdown、禁止 URL 與 <a>。\n5. 務必使用台灣繁體中文。`;

        const retryResult = await AIService.generate(retryPrompt, {
          provider: retryProvider,
          temperature: 0.5,
          max_tokens: Math.min(Math.ceil(targetWords * 3.2), 3200),
          observability_run_id
        });

        candidate = this.cleanMarkdownArtifacts(retryResult.content || '');
        candidate = this.stripLinksAndUrls(candidate);

        const retryH2Pattern = /^<h2[^>]*>.*?<\/h2>\s*/i;
        if (retryH2Pattern.test(candidate)) {
          candidate = candidate.replace(retryH2Pattern, '');
        }
      }

      return candidate;
    };

    const result = await AIService.generate(prompt, {
      provider,
      temperature: 0.6,
      max_tokens: maxTokens,
      observability_run_id
    });

    // 🔍 調試：查看 OpenAI 原始返回
    console.log(`  🔍 API 返回長度: ${result.content?.length || 0} 字符`);
    if (!result.content || result.content.trim().length === 0) {
      console.error(`  ❌ OpenAI 沒有返回內容！Prompt:\n${prompt.substring(0, 500)}...`);
    }

    // 🔧 清理 Markdown 標記並移除 AI 可能生成的重複 h2 標題
    let cleanedHtml = this.cleanMarkdownArtifacts(result.content);
    
    // 🔍 調試：檢查初稿長度
    const draftLength = (cleanedHtml.match(/[\u4e00-\u9fa5]/g) || []).length;
    console.log(`  📊 清理後字數: ${draftLength} 字`);
    
    // 移除開頭的 <h2>標題</h2>（可能與 section.heading 重複）
    const h2Pattern = /^<h2[^>]*>.*?<\/h2>\s*/i;
    if (h2Pattern.test(cleanedHtml)) {
      cleanedHtml = cleanedHtml.replace(h2Pattern, '');
      console.log(`  ℹ️ 已移除段落「${sectionHeading}」的重複 h2 標題`);
    }

    cleanedHtml = await ensureSectionQuality(cleanedHtml);

    // 🌟 Quality Assurance Loop (Two-Pass Generation)
    // 用戶明確表示願意犧牲速度換取品質，因此我們增加「自我審查與修潤」步驟
    if (draftLength > 0) {
      console.log(`  ✨ 正在進行深度修潤 (Deep Refinement) - ${sectionHeading}...`);
      cleanedHtml = await this.refineSection(cleanedHtml, section, outline, options);
    } else {
      console.warn(`  ⚠️ 初稿為空，跳過修潤步驟`);
    }

    // 若修潤後又變短，再做一次硬性保底
    cleanedHtml = await ensureSectionQuality(cleanedHtml);

    // 🆕 Post-processing: 移除引用標記、並強制去除外部連結/URL
    cleanedHtml = LibrarianService.injectCitations(cleanedHtml, verifiedSources);
    cleanedHtml = this.stripLinksAndUrls(cleanedHtml);

    // P0: 段落防回歸（書單/推薦/懶人包、以及無來源的統計字眼）
    if (this.hasUnsupportedStatClaims(cleanedHtml) || this.hasListicleOrBooklistCues(cleanedHtml)) {
      cleanedHtml = await this.rewriteHtmlStrict(
        cleanedHtml,
        outline,
        options,
        '移除書單/推薦/懶人包式引用與不可靠統計，保留專家建議與可執行步驟'
      );
    }

    // Promise enforcement: ensure promised counts (e.g., 3大陷阱) are actually delivered.
    cleanedHtml = await this.appendMissingPromisedItemsIfNeeded(sectionHeading, cleanedHtml, outline, options);

    // 🆕 最终质量验证
    const finalContent = {
      heading: sectionHeading,
      html: cleanedHtml,
      plain_text: this.stripHtml(cleanedHtml)
    };

    const validation = ContentQualityValidator.validateSectionContent(
      finalContent.html,
      finalContent.plain_text
    );

    // 记录验证结果（但不阻断流程，因为已经过refinement）
    if (validation.warnings.length > 0) {
      console.log(`   ⚠️  [${sectionHeading}] 质量提示: ${validation.warnings[0]}`);
    }
    if (!validation.passed) {
      console.log(`   ⚠️  [${sectionHeading}] 未完全达标，但已发布（已过refinement）`);
    } else {
      console.log(`   ✅ [${sectionHeading}] 质量验证通过`);
    }

    return finalContent;
  }

  /**
   * 深度修潤機制 (Refinement Loop)
   * 讓 AI 擔任「嚴格編輯」，檢查並優化初稿
   */
  static async refineSection(draftHtml, section, outline, options) {
    const { provider, style_guide, author_bio, author_values } = options;
    
    const sectionHeading = section?.heading || section?.title || '';
    const promise = this.extractCountPromiseFromHeading(sectionHeading);
    const promiseGuard = this.buildPromiseGuardForPrompt(sectionHeading, promise);

    const prompt = `你是一位極度嚴格的資深主編 (Editor-in-Chief)。請審核並重寫以下文章段落（初稿）。

## 你的任務
1. **消除重複**：檢查是否有重複的語句或鬼打牆的論述，將其精簡。
2. **事實查核**：
   - 確保所有數據引用都有 [x] 標記，且語氣客觀。
   - 如果出現沒有對應來源的 [x] 標記，立即刪除。
  - 如果出現「根據統計/超過70%」等具體數字但沒有可靠來源支撐，請改寫為不含具體數字的定性描述。
  - 如果出現「書單/推薦/必看/懶人包」類來源的引用或連結，立即刪除並改寫。
3. **結構修正**：
   - 確保**沒有** H1 或 H2 標題（最高層級只能是 H3）。
   - 確保每個子主題都有 <h3> 標籤，形成清晰層級。
   - 確保沒有「引言」或「結語」類型的廢話，直接切入重點。
4. **SEO 優化**：確保關鍵字「${outline.keywords?.primary}」自然出現，但不要堆砌。
5. **可讀性強化**：
   - 每段 3-4 句，每句 15-25 字。
   - 刪除 AI 慣用詞（如「深入探討」「不容忽視」「值得注意的是」）。
   - 將抽象描述改為具體案例或數據。
   - 確保國中生也能看懂。
6. **語氣潤飾**：${style_guide?.tone || '專業、權威且易讀'}，口吻自然像對朋友說話。
7. **稱呼一致**：全篇一律使用「你／你的」，不要使用「您／您的」。
8. **刪除口號句**：如果出現「讓我們一起」「一起開始/啟程」等句子，請刪掉並用實用建議取代。

${promiseGuard ? `## ✅ 承諾交付檢查（必做）\n${promiseGuard}` : ''}

## 👤 作者 Persona 與價值觀一致性檢查 (重要！)
${author_bio ? `- 作者背景: ${author_bio}` : ''}
${author_values ? `- 核心價值觀: ${author_values}` : ''}
請檢查初稿是否符合上述作者的風格與價值觀。如果不符合，請進行大幅度改寫，使其聽起來像是這位作者親筆撰寫的。
例如：
- 如果作者強調「長期投資」，請刪除任何鼓勵「短線投機」的建議。
- 如果作者重視「人性化管理」，請將冷冰冰的制度建議改為溫暖的溝通技巧。
   - 每段 3-4 句，每句 15-25 字。
   - 刪除 AI 慣用詞（如「深入探討」「不容忽視」「值得注意的是」）。
   - 將抽象描述改為具體案例或數據。
   - 確保國中生也能看懂。
6. **語氣潤飾**：${style_guide?.tone || '專業、權威且易讀'}，口吻自然像對朋友說話。

## 👤 作者 Persona 與價值觀一致性檢查 (重要！)
${author_bio ? `- 作者背景: ${author_bio}` : ''}
${author_values ? `- 核心價值觀: ${author_values}` : ''}
請檢查初稿是否符合上述作者的風格與價值觀。如果不符合，請進行大幅度改寫，使其聽起來像是這位作者親筆撰寫的。
例如：
- 如果作者強調「長期投資」，請刪除任何鼓勵「短線投機」的建議。
- 如果作者重視「人性化管理」，請將冷冰冰的制度建議改為溫暖的溝通技巧。

## 原始初稿
${draftHtml}

## 輸出要求
- 直接輸出修潤後的 HTML。
- 保持 HTML 標籤結構（<p>, <ul>, <h3>）。
- **禁止**生成 H2 標題、完整 URL、或任何外部連結。
- 不要解釋你改了什麼，直接給出最終成品。
- 務必使用台灣繁體中文。`;

    try {
      // 動態調整 max_tokens（修潤時略微增加空間，但仍受限）
      const originalLength = (draftHtml.match(/[\u4e00-\u9fa5]/g) || []).length;
      const maxTokens = Math.min(Math.ceil(originalLength * 2.2), 2500); // 原文*2.2，最多2500

      const result = await AIService.generate(prompt, {
        provider,
        temperature: 0.3, // 低溫模式，確保穩定性與精確度
        max_tokens: maxTokens,
        observability_run_id: options?.observability_run_id
      });

      // 🔧 清理 Markdown 標記
      let refinedHtml = this.cleanMarkdownArtifacts(result.content.trim());

      // 再次清理可能產生的 H2 (雙重保險)
      const h2Pattern = /^<h2[^>]*>.*?<\/h2>\s*/i;
      if (h2Pattern.test(refinedHtml)) {
        refinedHtml = refinedHtml.replace(h2Pattern, '');
      }

      // 防止模型自行加外連/URL
      refinedHtml = this.stripLinksAndUrls(refinedHtml);

      // 防回歸：不可靠統計、書單/懶人包式來源
      if (this.hasUnsupportedStatClaims(refinedHtml) || this.hasListicleOrBooklistCues(refinedHtml)) {
        refinedHtml = await this.rewriteHtmlStrict(
          refinedHtml,
          outline,
          options,
          '移除書單/統計等不可靠內容並保持段落品質'
        );
      }

      return refinedHtml;
    } catch (error) {
      console.warn('  ⚠️ 修潤過程失敗，將使用初稿:', error.message);
      return draftHtml;
    }
  }

  /**
   * 生成 FAQ 區塊（作為一個額外的段落，段內使用 H3 Q/A）
   */
  static async generateFaqSection(questions, outline, options = {}) {
    const { provider, style_guide, target_audience, author_bio, author_values, contentDomain = 'general', travelItinerary, brief, briefBlock } = options;

    const normalizedQuestions = contentDomain === 'travel'
      ? questions.map((q) => this.normalizeTravelFaqQuestion(q, outline)).filter(Boolean)
      : questions;

    const qList = normalizedQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n');

    const kwPrimary = String(outline.keywords?.primary || '').trim();
    const faqTopic = contentDomain === 'travel'
      ? (this.extractTravelTopicFromKeyword(kwPrimary || outline.title || '') || '東京')
      : (this.extractFaqTopicFromKeyword(kwPrimary || outline.title || '') || kwPrimary || outline.title || '');

    const faqTitleGuard = `
## ✅ FAQ 標題自然化（重要）
- **請用自然的問題標題**，不要每一題都硬塞「${kwPrimary}」當主詞開頭。
- 允許用更短的主題詞（例如「${faqTopic}」），也允許省略主題詞（因為本文主題已經交代）。
- 範例：不要寫「${kwPrimary} 新手該如何開始？」；可以寫「新手該從哪一步開始？」或「${faqTopic} 新手該從哪一步開始？」。
`;

    const travelFaqGuard = contentDomain === 'travel' ? `

  ## 🧳 旅遊 FAQ 一致性硬規則（重要）
  1. **FAQ 內容不得發明新的「第X天/DayX 行程範例」**（這很容易與行程快覽矛盾）。
     - 若需要舉例，只能用「把相近景點放同一天」這種不帶 Day 編號的例子。
  2. 若你真的必須提到 Day1～Day5（不建議），只能認列下方行程快覽；不得新增或改動每日景點。
  ${String(travelItinerary || '').trim() ? `
  ## ✅ 行程快覽（供你對照，不得矛盾）
  ${String(travelItinerary).trim()}
  ` : ''}

  ${faqTitleGuard}
  ` : '';

    const normalizedBriefBlock = briefBlock || formatContentBriefForPrompt(brief);

    const prompt = `你是一位專業的 SEO 內容寫手。請撰寫文章的 FAQ 段落，專門回答新手最常問的問題。

  ${normalizedBriefBlock}

## 主題
${outline.title}

## 主要關鍵字
${outline.keywords?.primary || ''}

## 目標受眾
${target_audience || '一般讀者'}

## FAQ 題目（必須逐題回答）
${qList}

${faqTitleGuard}

${travelFaqGuard}

## 寫作要求
1. 請直接輸出 HTML（使用多個 <h3> 作為問題標題，每題至少 2 段 <p> 回答）。
2. 每題要有「可執行建議」或「注意事項」，可以用 <ul> 條列。
3. **禁止**寫出完整 URL、禁止外部連結、禁止 <a> 標籤、禁止 [1] 引用標記。
4. **禁止**捏造任何統計數字或百分比。
5. 語氣：${style_guide?.tone || '專業、親切且具權威感'}。
6. **稱呼一致**：全篇一律使用「你／你的」，不要使用「您／您的」。

## 👤 作者 Persona
${author_bio ? `- 作者背景: ${author_bio}` : ''}
${author_values ? `- 核心價值觀: ${author_values}` : ''}

只輸出 HTML，不要任何解釋。`;

    const result = await AIService.generate(prompt, {
      provider,
      temperature: 0.4,
      max_tokens: 1800,
      observability_run_id: options?.observability_run_id
    });

    let cleanedHtml = this.cleanMarkdownArtifacts(result.content || '').trim();
    cleanedHtml = this.stripLinksAndUrls(cleanedHtml);

    cleanedHtml = this.normalizeFaqHeadingsHtml(cleanedHtml, outline, contentDomain);

    if (contentDomain === 'travel') {
      cleanedHtml = this.normalizeTravelFaqHeadingsHtml(cleanedHtml, outline);
    }

    return {
      heading: '常見問題（FAQ）',
      html: cleanedHtml,
      plain_text: this.stripHtml(cleanedHtml)
    };
  }

  /**
   * 生成結論段落
   */
  static async generateConclusion(outline, sections, options = {}) {
    const { provider, style_guide, contentDomain = 'general', verifiedSources: passedSources, author_bio, author_values, target_audience, unique_angle, personal_experience, travelItinerary, brief, briefBlock } = options;

    const mainPoints = sections.map(s => s.heading).join('\n- ');

    const travelConclusionGuidance = contentDomain === 'travel' ? `
## 🧳 旅遊結語要求（避免跨域殘留）
- 禁止出現理財/投資語彙或行動（例如「收支盤點、投資、資產配置、報酬」）。
- CTA 要回到旅遊可執行：例如「把 Day1～Day5 快覽貼到行事曆、把住宿區域定案、先選交通票券」。
  - 若要提到第幾天/DayX，必須與行程快覽一致。
  ${String(travelItinerary || '').trim() ? `\n## ✅ 行程快覽（供你對照，不得矛盾）\n${String(travelItinerary).trim()}\n` : ''}
` : '';

    const ctaExample = contentDomain === 'travel'
      ? '例如「今天先把 Day1～Day5 快覽貼進行事曆，並把住宿區域/交通票券先定下來」'
      : '例如「今天先挑 1 個最小可行的下一步開始做」';

    const normalizedBriefBlock = briefBlock || formatContentBriefForPrompt(brief);
    const mustInclude = Array.isArray(brief?.deliverables?.mustInclude) ? brief.deliverables.mustInclude : [];
    const checklistRequirement = mustInclude.some((v) => String(v || '').trim().toLowerCase() === 'checklist')
      ? '\n8. 若 Brief 要求「checklist」，請在結尾附上一段「重點檢查清單」並用 <ul> 列出 5-8 個可勾選要點。'
      : '';

    const prompt = `你是一位專業的 SEO 內容寫手。請根據以下資訊，撰寫文章的結論部分。

  ${normalizedBriefBlock}

## 文章標題
${outline.title}

## 已討論的主要段落
- ${mainPoints}

## 結論結構
${JSON.stringify(outline.conclusion, null, 2)}

## 👤 作者 Persona 與價值觀 (重要！)
${author_bio ? `- 作者背景: ${author_bio}` : ''}
${author_values ? `- 核心價值觀: ${author_values}` : ''}
${unique_angle ? `- 獨特觀點/角度: ${unique_angle}` : ''}
${personal_experience ? `- 可引用的真實經驗/案例: ${personal_experience}` : ''}
請務必將上述作者的觀點與風格融入寫作中，確保內容具有獨特性與個人色彩。

## 目標受眾
${target_audience || '一般讀者'}

${travelConclusionGuidance}

## 寫作要求
1. 總結文章的核心要點
2. 強調讀者的收穫與價值
3. 包含明確的行動呼籲（Call to Action），但要務實（${ctaExample}）；**不要**出現推銷式語句（如「立即下載免費表格」）。
4. **自然融入關鍵字**：主要關鍵字至少自然出現 1-2 次，避免堆砌。
5. 若前文已引用來源，結論可重申 1 個關鍵來源以強化可信度（不要新造來源）。
6. 字數控制在 150-200 字
7. 語氣：${style_guide?.tone || '專業但易懂'}
${checklistRequirement}
${style_guide ? `8. 品牌風格：${JSON.stringify(style_guide)}` : ''}

## **E-E-A-T 引用規範（Citation Protocol）**：

**核心原則：引用是為了增強可信度，不是為了炫耀來源。只在真正需要時才引用。**

### 何時需要引用？
✅ **必須引用**：具體數據、專業研究、爭議性論點、專業建議
❌ **不需引用**：普遍常識、基礎定義、一般建議、邏輯推論

### 來源品質判斷
**嚴格禁止自行編造 URL。你只能使用「參考文獻庫」中提供的資料。**

- ✅ 優先：政府機關、學術機構、大型醫療機構、知名媒體
- ❌ 忽略：部落格、農場、書目清單、年度新書目錄、論壇

### 最終原則
**寧可0引用，也不要引用低品質或不相關的來源。內容的專業性來自你的知識，不是來源的數量。**
❌ 不要寫出引用標記如 [1], [2] 等
❌ 不要寫出完整的 URL

## 輸出格式
- 使用 HTML 格式
- 包含 <h2> 標題、<p> 段落、<ul> 列表
- 字數約 150-200 字
- 不要包含任何引用標記
- 直接輸出 HTML，無需其他說明

請務必使用台灣繁體中文 (Traditional Chinese) 撰寫所有內容。`;

    const result = await AIService.generate(prompt, {
      provider,
      temperature: 0.7,
      observability_run_id: options?.observability_run_id
    });

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

    // Enforce no URL/links in conclusion output (defensive; also covered by quality rules).
    cleanedHtml = this.stripLinksAndUrls(cleanedHtml);

    // Travel-specific conclusion cleanup: avoid rhetorical questions + template-y closers.
    if (contentDomain === 'travel') {
      const conclusionText = this.stripHtml(cleanedHtml);
      const hasAnyQuestion = /[？?]/.test(conclusionText);
      const hasDuplicateBridge = /(接下來)[，,]\s*\1/.test(conclusionText);
      const templateClosingRe = /(準備好.*了嗎|接下來享受|讓我們一起)/;
      const genericDayStartRe = /(從[^。！？\n]{0,40}第\s*[一二三四五六七八九十\d]{1,3}\s*天開始|第\s*[一二三四五六七八九十\d]{1,3}\s*天開始)/;

      if (hasAnyQuestion || hasDuplicateBridge || templateClosingRe.test(conclusionText) || genericDayStartRe.test(conclusionText)) {
        cleanedHtml = await this.rewriteHtmlStrict(
          cleanedHtml,
          outline,
          options,
          '旅遊結語請避免問句式 CTA、模板化收尾（例如「準備好…了嗎」「接下來享受…」）以及「從第一天開始…」這種容易造成行程矛盾的泛用說法；改成務實的下一步清單'
        );
        cleanedHtml = this.stripLinksAndUrls(cleanedHtml);
      }
    }
    
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
    const { provider = 'gemini' } = options;

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
   * SEO 專家建議 - 驗證字數控制（目標 ~2000 字）
   */
  static validateWordCount(article, maxWords = 2200) {
    const wordCount = this.calculateWordCount(article.content || article.content_draft || {});
    return {
      actual: wordCount,
      max: maxWords,
      passed: wordCount <= maxWords,
      overBy: Math.max(0, wordCount - maxWords),
      recommendation: wordCount > maxWords ? `建議精簡內容，目前超出 ${wordCount - maxWords} 字` : null
    };
  }

  /**
   * SEO 專家建議 - 驗證標題長度（長尾關鍵字要求 35-55 字）
   */
  static validateTitleLength(title, minChars = 25, maxChars = 60) {
    const len = String(title || '').trim().length;
    return {
      length: len,
      passed: len >= minChars && len <= maxChars,
      tooShort: len < minChars,
      tooLong: len > maxChars,
      recommendation: len < minChars ? '標題過短，建議加入具體情境/數字/對象（長尾關鍵字）' : 
                      len > maxChars ? '標題過長，建議精簡至 55 字內' : null
    };
  }

  /**
   * SEO 專家建議 - 驗證引言結構（第二段回答核心問題）
   */
  static validateIntroStructure(introHtml) {
    const paragraphs = (introHtml || '').match(/<p>[\s\S]*?<\/p>/gi) || [];
    const hasMinParagraphs = paragraphs.length >= 2;
    
    // 檢查第二段是否包含答案型內容
    const secondPara = paragraphs[1] || '';
    const secondParaText = this.stripHtml(secondPara);
    const hasAnswerSignals = /(簡單說|答案是|關鍵在於|重點是|首先|步驟|方法|做法|建議|可以|應該)/.test(secondParaText);
    const secondParaLength = secondParaText.length;
    
    return {
      paragraphCount: paragraphs.length,
      secondParagraphLength: secondParaLength,
      hasAnswerInSecondPara: hasAnswerSignals && secondParaLength >= 60,
      passed: hasMinParagraphs && hasAnswerSignals && secondParaLength >= 60,
      recommendation: !hasMinParagraphs ? '引言需至少 2 段' :
                      !hasAnswerSignals || secondParaLength < 60 ? '第二段應直接回答核心問題（80-120字）' : null
    };
  }

  /**
   * SEO 專家建議 - 驗證案例存在（真實經驗與解決方案）
   */
  static validateCasePresence(article) {
    const allHtml = [
      article.content?.introduction?.html || article.content_draft?.introduction?.html,
      ...(article.content?.sections || article.content_draft?.sections || []).map(s => s.html),
      article.content?.conclusion?.html || article.content_draft?.conclusion?.html
    ].filter(Boolean).join('\n');
    
    const caseSignals = [
      /<h3[^>]*>[^<]*(案例|實例|故事|經驗|情境)[^<]*<\/h3>/i,
      /(案例|實例|故事|情境)[：:]/,
      /月薪\s*\d+[KkＫ萬]?\s*[的]?(上班族|新手|小資|年輕人)/,
      /\d+\s*(年|個月).*存到?\s*\d+\s*(萬|元)/,
      /常見(錯誤|問題|迷思).*解(法|決|答)/i,
      /<h[23][^>]*>[^<]*(解決方案|如何解決|常見問題|避免錯誤)[^<]*<\/h[23]>/i
    ];
    
    const hasCaseContent = caseSignals.some(pattern => pattern.test(allHtml));
    
    return {
      passed: hasCaseContent,
      recommendation: hasCaseContent ? null : '建議加入具體案例或常見問題解法（提升 E-E-A-T 與 SEO 競爭力）'
    };
  }

  /**
   * 品質檢查
   */
  static async qualityCheck(article, options = {}) {
    const { provider = 'gemini', target_keyword } = options;

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
  static resolveTitleMeta(source = {}, fallbackKeyword = '', contentDomain = 'general') {
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

    const trimmedMeta = metaCandidate.trim();

    return {
      title: titleCandidate.trim(),
      meta_description: this.sanitizeMetaDescription(trimmedMeta, {
        contentDomain,
        keyword: fallbackKeyword || source.keywords?.primary || source.keyword || ''
      })
    };
  }

  /**
   * 針對特定領域的 meta description 做最小必要的去模板化
   */
  static sanitizeMetaDescription(meta, { contentDomain = 'general', keyword = '' } = {}) {
    if (typeof meta !== 'string') return meta;

    let result = meta.trim();
    result = this.scrubPlaceholders(result, keyword);

    if (contentDomain === 'travel') {
      // 1) 去掉強 CTA
      result = result
        .replace(/立即參考|立即查看|立即了解|立刻|馬上|現在就|快來/g, '可直接參考')
        .replace(/下載(?:免費)?(?:行程表|行程規劃|表格|攻略|清單)/g, '可直接參考')
        .replace(/(?:行程表|表格)下載/g, '可直接參考')
        .replace(/下載/g, '')
        .replace(/立即/g, '')
        .replace(/[!！]+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      // 2) 進一步把收尾的導流式用語拿掉（保留描述本身）
      result = result
        .replace(/[,，]?\s*(?:開始規劃|開始計畫|開始安排行程)\s*$/u, '')
        .replace(/[,，]?\s*(?:開始規劃|開始計畫|開始安排行程)[。.]?$/u, '')
        .trim();

      // 3) 避免變成空字串
      if (result.length < 12) {
        const safeKeyword = (keyword || '').trim();
        result = safeKeyword
          ? `整理 ${safeKeyword} 的行程快覽、交通與住宿重點，方便直接套用。`
          : '整理行程快覽、交通與住宿重點，方便直接套用。';
      }
    }

    return result;
  }

  static scrubPlaceholders(text, keyword = '') {
    if (text === null || text === undefined) return text;
    const safeKw = String(keyword || '').trim();
    let out = String(text);
    out = out.replace(/--keyword/gi, safeKw || '');
    out = out.replace(/\{keyword\}/gi, safeKw || '');
    out = out.replace(/--qualityGate/gi, '');
    out = out.replace(/--brief/gi, '');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  static normalizeKeywordForMatch(text = '') {
    return String(text || '').replace(/\s+/g, '').trim();
  }

  static countKeywordInText(text = '', keyword = '') {
    const normalizedText = this.normalizeKeywordForMatch(this.stripHtml(String(text || '')));
    const normalizedKeyword = this.normalizeKeywordForMatch(keyword);
    if (!normalizedText || !normalizedKeyword) return 0;
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'g');
    return (normalizedText.match(pattern) || []).length;
  }

  static deriveCoreKeyword(keyword = '') {
    let core = String(keyword || '').trim();
    core = core.replace(/^\d{4}\s*/u, '');
    core = core
      .replace(/(全攻略|懶人包|完整指南|指南|攻略|推薦|教學|入門)$/u, '')
      .trim();
    return core || String(keyword || '').trim();
  }

  static calculateKeywordTargets(totalChars = 0) {
    const chars = Number(totalChars) || 0;
    const exactTarget = Math.min(8, Math.max(3, Math.round(chars * 0.0012)));
    const coreTarget = Math.min(20, Math.max(8, Math.round(chars * 0.0035)));
    return { exactTarget, coreTarget };
  }

  static appendSentenceToPart(part, sentence) {
    if (!part || !sentence) return;
    part.html = (part.html || '') + sentence;
    part.plain_text = (part.plain_text || '') + this.stripHtml(sentence);
  }

  static buildArticlePlainText(article) {
    if (!article?.content) return '';
    const intro = article.content.introduction?.plain_text || article.content.introduction?.html || '';
    const sections = (article.content.sections || []).map((s) => s?.plain_text || s?.html || '').join('\n');
    const conclusion = article.content.conclusion?.plain_text || article.content.conclusion?.html || '';
    return this.stripHtml([intro, sections, conclusion].join('\n'));
  }

  /**
   * P0：關鍵字密度補強（可控、位置固定、避免機械堆砌）
   */
  static ensureKeywordPresence(article, keyword) {
    const safeKeyword = String(keyword || '').trim();
    if (!article || !safeKeyword) return article;

    // 全域移除佔位符（--keyword / {keyword} 等），避免殘留到輸出
    try {
      article = JSON.parse(this.scrubPlaceholders(JSON.stringify(article), safeKeyword));
    } catch (e) {
      // 若序列化失敗，略過不阻塞流程
    }

    const plainText = this.buildArticlePlainText(article);
    const totalChars = this.normalizeKeywordForMatch(plainText).length;
    const coreKeyword = this.deriveCoreKeyword(safeKeyword);

    let exactCount = this.countKeywordInText(plainText, safeKeyword);
    let coreCount = this.countKeywordInText(plainText, coreKeyword);

    const { exactTarget, coreTarget } = this.calculateKeywordTargets(totalChars);

    console.log(`📌 [P0密度補強] keyword=${safeKeyword}`);
    console.log(`   - 當前: exact=${exactCount}, core=${coreCount}, chars=${totalChars}`);
    console.log(`   - 目標: exact>=${exactTarget}, core>=${coreTarget}`);

    if (exactCount >= exactTarget && coreCount >= coreTarget) {
      return article;
    }

    const slots = [];
    if (article.content?.introduction) slots.push(article.content.introduction);
    if (Array.isArray(article.content?.sections) && article.content.sections[0]) slots.push(article.content.sections[0]);
    if (Array.isArray(article.content?.sections) && article.content.sections[1]) slots.push(article.content.sections[1]);
    if (article.content?.conclusion) slots.push(article.content.conclusion);

    const exactSentences = [
      `<p>這篇內容以「${safeKeyword}」為核心，整理可直接執行的判斷重點與步驟。</p>`,
      `<p>若你正在搜尋「${safeKeyword}」，可先依本文的優先順序逐項檢查與調整。</p>`
    ];
    const coreSentences = [
      `<p>你可以先掌握${coreKeyword}的核心原則，再依自身情境做小幅度調整。</p>`,
      `<p>實務上，${coreKeyword}最重要的是先做基礎盤點，再逐步優化細節。</p>`
    ];

    let exactIdx = 0;
    let coreIdx = 0;
    let slotIdx = 0;
    let inserted = 0;

    while (slotIdx < slots.length && inserted < 6 && (exactCount < exactTarget || coreCount < coreTarget)) {
      const slot = slots[slotIdx];
      let sentence = '';

      if (exactCount < exactTarget) {
        sentence = exactSentences[exactIdx % exactSentences.length];
        exactIdx += 1;
      } else if (coreCount < coreTarget) {
        sentence = coreSentences[coreIdx % coreSentences.length];
        coreIdx += 1;
      }

      if (!sentence) break;

      this.appendSentenceToPart(slot, sentence);
      inserted += 1;
      slotIdx += 1;

      exactCount += this.countKeywordInText(sentence, safeKeyword);
      coreCount += this.countKeywordInText(sentence, coreKeyword);
    }

    const refreshedText = this.buildArticlePlainText(article);
    const finalExact = this.countKeywordInText(refreshedText, safeKeyword);
    const finalCore = this.countKeywordInText(refreshedText, coreKeyword);
    console.log(`   - 補強後: exact=${finalExact}, core=${finalCore}, inserted=${inserted}`);

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

        // Keep only institution/title text for traceability.
        const sourceName = source.institutionName || source.title || '權威來源';
        const replacement = `根據${sourceName}的資料顯示`;
        
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
        // Keep only safe visible text; do not emit URLs or <a>.
        const replacementText = item.linkText || source.institutionName || source.title || source.name || '權威來源';
        cleanedHtml = cleanedHtml.replace(item.fullMatch, replacementText);
        console.log(`  🔄 替換為真實來源（僅保留文字，不輸出URL）: ${source.url}`);
        replaceCount++;
      } else {
        // 策略2: 移除<a>標籤但保留文字
        cleanedHtml = cleanedHtml.replace(item.fullMatch, item.linkText);
        console.log(`  🗑️ 移除幻覺連結但保留文字: "${item.linkText}"`);
        removeCount++;
      }
    }

    // Final safety: strip any remaining <a> tags / raw URLs.
    cleanedHtml = this.stripLinksAndUrls(cleanedHtml);
    
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
