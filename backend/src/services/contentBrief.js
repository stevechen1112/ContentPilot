function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeStringList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,|、/)
      .map((s) => String(s).trim())
      .filter(Boolean);
  }
  return [];
}

function pickFirstNonEmpty(...values) {
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : v;
    if (s) return v;
  }
  return undefined;
}

function detectDomainFromKeyword(keyword) {
  const text = String(keyword || '').trim();
  const lower = text.toLowerCase();

  const financeTokens = ['理財', '投資', '股票', 'etf', '基金', '債券', '資產配置', '退休', '保險', '貸款', '信用卡'];
  const healthTokens = ['失眠', '睡眠', '健康', '飲食', '疼痛', '上背痛', '運動', '疾病', '症狀'];

  if (financeTokens.some((t) => text.includes(t) || lower.includes(t))) return 'finance';
  if (healthTokens.some((t) => text.includes(t) || lower.includes(t))) return 'health';
  return 'general';
}

function defaultMinSourcesByDomain(domain) {
  if (domain === 'finance') return 2;
  if (domain === 'health') return 2;
  return 0;
}

function ensureArrayHasAtLeastOne(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

function applyContentBriefDefaults(brief, options = {}) {
  if (!brief || typeof brief !== 'object') return brief;

  const keyword = String(brief.keyword || options.keyword || '').trim();
  const domain = options.domain || detectDomainFromKeyword(keyword);

  const out = JSON.parse(JSON.stringify(brief));

  // Purpose & action
  if (!out.purpose) out.purpose = 'guide';
  if (!out.desiredAction) out.desiredAction = '完成一個可直接執行的下一步';

  // TA
  out.targetAudience = out.targetAudience || {};
  if (!out.targetAudience.level) {
    const isBeginner = /(新手|入門|初學)/.test(keyword);
    out.targetAudience.level = isBeginner ? 'beginner' : 'intermediate';
  }
  if (!out.targetAudience.scenario) out.targetAudience.scenario = '希望快速得到可照做的建議，避免踩雷。';

  // Author
  out.author = out.author || {};
  if (!out.author.identity) out.author.identity = '內容編輯';
  if (!ensureArrayHasAtLeastOne(out.author.values)) out.author.values = ['務實', '可落地', '不誇大'];
  if (!out.author.tone) out.author.tone = '白話但嚴謹';

  // Deliverables
  out.deliverables = out.deliverables || {};
  if (!ensureArrayHasAtLeastOne(out.deliverables.mustInclude)) out.deliverables.mustInclude = ['steps'];
  if (!out.deliverables.depth) out.deliverables.depth = 'standard';

  // Credibility
  out.credibility = out.credibility || {};
  if (typeof out.credibility.requireSources !== 'boolean') {
    out.credibility.requireSources = domain === 'finance' || domain === 'health';
  }
  if (out.credibility.requireSources) {
    if (!Number.isFinite(Number(out.credibility.minSources))) {
      out.credibility.minSources = defaultMinSourcesByDomain(domain);
    }

    if (!ensureArrayHasAtLeastOne(out.credibility.allowedSourceTypes)) {
      out.credibility.allowedSourceTypes =
        domain === 'finance'
          ? ['government', 'regulator', 'exchange', 'academic']
          : domain === 'health'
            ? ['government', 'academic']
            : [];
    }
  }

  return out;
}

function validateContentBriefRequiredFields(brief, options = {}) {
  const issues = [];
  const b = brief && typeof brief === 'object' ? brief : {};
  const keyword = String(b.keyword || options.keyword || '').trim();

  // Required (per CONTENT_CONFIG_SCHEMA.md)
  if (!keyword) issues.push({ field: 'keyword', message: '主要關鍵字（keyword）為必填' });
  if (!b.purpose) issues.push({ field: 'purpose', message: '文章目的（purpose）為必填' });
  if (!b.desiredAction) issues.push({ field: 'desiredAction', message: '讀完要做的事（desiredAction）為必填' });

  const ta = b.targetAudience || {};
  if (!ta.level) issues.push({ field: 'targetAudience.level', message: 'TA 程度（targetAudience.level）為必填' });
  if (!ta.scenario) issues.push({ field: 'targetAudience.scenario', message: 'TA 情境（targetAudience.scenario）為必填' });

  const author = b.author || {};
  if (!author.identity) issues.push({ field: 'author.identity', message: '作者身分（author.identity）為必填' });
  if (!ensureArrayHasAtLeastOne(author.values)) issues.push({ field: 'author.values', message: '作者價值觀（author.values）至少 1 條' });
  if (!author.tone) issues.push({ field: 'author.tone', message: '作者口吻（author.tone）為必填' });

  const deliverables = b.deliverables || {};
  if (!ensureArrayHasAtLeastOne(deliverables.mustInclude)) {
    issues.push({ field: 'deliverables.mustInclude', message: '交付形式（deliverables.mustInclude）至少 1 個' });
  }
  if (!deliverables.depth) issues.push({ field: 'deliverables.depth', message: '內容深度（deliverables.depth）為必填' });

  const cred = b.credibility || {};
  if (typeof cred.requireSources !== 'boolean') {
    issues.push({ field: 'credibility.requireSources', message: '是否強制要求來源（credibility.requireSources）為必填' });
  }

  return issues;
}

/**
 * Normalize incoming content brief.
 *
 * Design goals:
 * - Keep backwards-compatibility with legacy request fields.
 * - Keep the object small; only include what downstream needs.
 * - Avoid new layers: this is a thin normalizer + formatter.
 */
function normalizeContentBrief(input = {}, options = {}) {
  const {
    brief,
    keyword: keywordFallback,
    tone,
    target_audience,
    author_bio,
    author_values,
    unique_angle,
    expected_outline,
    personal_experience
  } = input || {};

  const rawBrief = isPlainObject(brief) ? brief : {};

  const keyword = pickFirstNonEmpty(rawBrief.keyword, rawBrief?.keywords?.primary, keywordFallback);
  const secondaryKeywords = normalizeStringList(rawBrief.secondaryKeywords);

  const desiredAction = pickFirstNonEmpty(rawBrief.desiredAction);
  const purpose = pickFirstNonEmpty(rawBrief.purpose);

  const author = isPlainObject(rawBrief.author) ? rawBrief.author : {};
  const targetAudience = isPlainObject(rawBrief.targetAudience) ? rawBrief.targetAudience : {};
  const deliverables = isPlainObject(rawBrief.deliverables) ? rawBrief.deliverables : {};
  const originality = isPlainObject(rawBrief.originality) ? rawBrief.originality : {};
  const credibility = isPlainObject(rawBrief.credibility) ? rawBrief.credibility : {};

  const normalized = {
    keyword,
    secondaryKeywords,
    purpose,
    desiredAction,

    author: {
      identity: pickFirstNonEmpty(author.identity, author_bio),
      values: normalizeStringList(pickFirstNonEmpty(author.values, author_values)),
      tone: pickFirstNonEmpty(author.tone, tone),
      bannedPhrases: normalizeStringList(author.bannedPhrases)
    },

    targetAudience: {
      level: pickFirstNonEmpty(targetAudience.level),
      persona: pickFirstNonEmpty(targetAudience.persona),
      scenario: pickFirstNonEmpty(targetAudience.scenario, target_audience),
      taboos: normalizeStringList(targetAudience.taboos)
    },

    deliverables: {
      mustInclude: normalizeStringList(deliverables.mustInclude),
      optionalSections: normalizeStringList(deliverables.optionalSections),
      depth: pickFirstNonEmpty(deliverables.depth),
      targetH2Count: isPlainObject(deliverables.targetH2Count) ? deliverables.targetH2Count : undefined
    },

    originality: {
      uniqueAngles: normalizeStringList(pickFirstNonEmpty(originality.uniqueAngles, unique_angle)),
      commonPitfalls: normalizeStringList(originality.commonPitfalls),
      allowedCaseNotes: pickFirstNonEmpty(originality.allowedCaseNotes, personal_experience)
    },

    credibility: {
      requireSources: Boolean(credibility.requireSources),
      minSources: Number.isFinite(Number(credibility.minSources)) ? Number(credibility.minSources) : undefined,
      allowedSourceTypes: normalizeStringList(credibility.allowedSourceTypes)
    },

    expectedOutline: pickFirstNonEmpty(rawBrief.expectedOutline, expected_outline)
  };

  const shouldApplyDefaults = Boolean(options && options.applyDefaults);
  const defaulted = shouldApplyDefaults
    ? applyContentBriefDefaults(normalized, {
        keyword: normalized.keyword || keywordFallback,
        domain: options.domain
      })
    : normalized;

  // Trim empty fields to reduce prompt length.
  if (!defaulted.keyword) delete defaulted.keyword;
  if (!defaulted.secondaryKeywords.length) delete defaulted.secondaryKeywords;
  if (!defaulted.purpose) delete defaulted.purpose;
  if (!defaulted.desiredAction) delete defaulted.desiredAction;
  if (!defaulted.expectedOutline) delete defaulted.expectedOutline;

  if (defaulted.author) {
    if (!defaulted.author.identity) delete defaulted.author.identity;
    if (!defaulted.author.values || !defaulted.author.values.length) delete defaulted.author.values;
    if (!defaulted.author.tone) delete defaulted.author.tone;
    if (!defaulted.author.bannedPhrases || !defaulted.author.bannedPhrases.length) delete defaulted.author.bannedPhrases;
    if (Object.keys(defaulted.author).length === 0) delete defaulted.author;
  }

  if (defaulted.targetAudience) {
    if (!defaulted.targetAudience.level) delete defaulted.targetAudience.level;
    if (!defaulted.targetAudience.persona) delete defaulted.targetAudience.persona;
    if (!defaulted.targetAudience.scenario) delete defaulted.targetAudience.scenario;
    if (!defaulted.targetAudience.taboos || !defaulted.targetAudience.taboos.length) delete defaulted.targetAudience.taboos;
    if (Object.keys(defaulted.targetAudience).length === 0) delete defaulted.targetAudience;
  }

  if (defaulted.deliverables) {
    if (!defaulted.deliverables.mustInclude || !defaulted.deliverables.mustInclude.length) delete defaulted.deliverables.mustInclude;
    if (!defaulted.deliverables.optionalSections || !defaulted.deliverables.optionalSections.length) delete defaulted.deliverables.optionalSections;
    if (!defaulted.deliverables.depth) delete defaulted.deliverables.depth;
    if (!defaulted.deliverables.targetH2Count) delete defaulted.deliverables.targetH2Count;
    if (Object.keys(defaulted.deliverables).length === 0) delete defaulted.deliverables;
  }

  if (defaulted.originality) {
    if (!defaulted.originality.uniqueAngles || !defaulted.originality.uniqueAngles.length) delete defaulted.originality.uniqueAngles;
    if (!defaulted.originality.commonPitfalls || !defaulted.originality.commonPitfalls.length) delete defaulted.originality.commonPitfalls;
    if (!defaulted.originality.allowedCaseNotes) delete defaulted.originality.allowedCaseNotes;
    if (Object.keys(defaulted.originality).length === 0) delete defaulted.originality;
  }

  // Keep credibility even if requireSources=false when minSources is present.
  if (defaulted.credibility) {
    const keepCred =
      defaulted.credibility.requireSources ||
      typeof defaulted.credibility.minSources === 'number' ||
      (defaulted.credibility.allowedSourceTypes && defaulted.credibility.allowedSourceTypes.length > 0);
    if (!keepCred) delete defaulted.credibility;
  }

  return defaulted;
}

function formatContentBriefForPrompt(brief) {
  if (!brief || typeof brief !== 'object') return '';

  const lines = [];

  if (brief.purpose) lines.push(`- 文章目的: ${brief.purpose}`);
  if (brief.desiredAction) lines.push(`- 讀完後行動: ${brief.desiredAction}`);

  if (brief.targetAudience) {
    if (brief.targetAudience.level) lines.push(`- TA 程度: ${brief.targetAudience.level}`);
    if (brief.targetAudience.persona) lines.push(`- TA 角色: ${brief.targetAudience.persona}`);
    if (brief.targetAudience.scenario) lines.push(`- TA 情境/痛點: ${brief.targetAudience.scenario}`);
    if (brief.targetAudience.taboos && brief.targetAudience.taboos.length) {
      lines.push(`- TA 禁忌: ${brief.targetAudience.taboos.join('、')}`);
    }
  }

  if (brief.author) {
    if (brief.author.identity) lines.push(`- 作者身分: ${brief.author.identity}`);
    if (brief.author.values && brief.author.values.length) lines.push(`- 作者價值觀: ${brief.author.values.join('、')}`);
    if (brief.author.tone) lines.push(`- 口吻: ${brief.author.tone}`);
    if (brief.author.bannedPhrases && brief.author.bannedPhrases.length) {
      lines.push(`- 禁止句型: ${brief.author.bannedPhrases.join('、')}`);
    }
  }

  if (brief.deliverables) {
    if (brief.deliverables.mustInclude && brief.deliverables.mustInclude.length) {
      lines.push(`- 必交付: ${brief.deliverables.mustInclude.join('、')}`);
    }
    if (brief.deliverables.optionalSections && brief.deliverables.optionalSections.length) {
      lines.push(`- 可選小節: ${brief.deliverables.optionalSections.join('、')}`);
    }
    if (brief.deliverables.depth) lines.push(`- 深度: ${brief.deliverables.depth}`);
    if (brief.deliverables.targetH2Count && (brief.deliverables.targetH2Count.min || brief.deliverables.targetH2Count.max)) {
      lines.push(`- H2 目標數: ${brief.deliverables.targetH2Count.min || ''}-${brief.deliverables.targetH2Count.max || ''}`);
    }
  }

  if (brief.originality) {
    if (brief.originality.uniqueAngles && brief.originality.uniqueAngles.length) {
      lines.push(`- 獨家觀點/框架: ${brief.originality.uniqueAngles.join('、')}`);
    }
    if (brief.originality.commonPitfalls && brief.originality.commonPitfalls.length) {
      lines.push(`- 常見誤區/反例: ${brief.originality.commonPitfalls.join('、')}`);
    }
  }

  if (brief.expectedOutline) {
    lines.push(`- 必須呼應的大綱/重點: ${String(brief.expectedOutline).trim()}`);
  }

  if (brief.credibility) {
    if (brief.credibility.requireSources) lines.push(`- 來源要求: 必須提供來源`);
    if (typeof brief.credibility.minSources === 'number') lines.push(`- 最少來源數: ${brief.credibility.minSources}`);
    if (brief.credibility.allowedSourceTypes && brief.credibility.allowedSourceTypes.length) {
      lines.push(`- 允許來源類型: ${brief.credibility.allowedSourceTypes.join('、')}`);
    }
  }

  if (!lines.length) return '';
  return `## 🧾 內容 Brief（必須遵守，優先於一般寫作習慣）\n${lines.join('\n')}`;
}

module.exports = {
  normalizeContentBrief,
  formatContentBriefForPrompt,
  validateContentBriefRequiredFields,
  detectDomainFromKeyword,
  defaultMinSourcesByDomain
};
