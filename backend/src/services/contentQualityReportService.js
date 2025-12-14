const { getQualityRules } = require('./qualityRulesRegistry');

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pushField(fields, field, value, kind) {
  if (value == null) return;
  const raw = String(value);
  const text = kind === 'html' ? stripHtml(raw) : raw.trim();
  if (!text) return;
  fields.push({ field, text, raw, kind: kind || 'text' });
}

function extractFields(article) {
  const fields = [];

  pushField(fields, 'title', article?.title, 'text');
  pushField(fields, 'meta_description', article?.meta_description, 'text');

  const intro = article?.content?.introduction;
  pushField(fields, 'content.introduction.html', intro?.html, 'html');
  pushField(fields, 'content.introduction.plain_text', intro?.plain_text, 'text');

  const sections = Array.isArray(article?.content?.sections) ? article.content.sections : [];
  sections.forEach((section, idx) => {
    pushField(fields, `content.sections[${idx}].heading`, section?.heading, 'text');
    pushField(fields, `content.sections[${idx}].html`, section?.html, 'html');
    pushField(fields, `content.sections[${idx}].plain_text`, section?.plain_text, 'text');
  });

  const conclusion = article?.content?.conclusion;
  pushField(fields, 'content.conclusion.html', conclusion?.html, 'html');
  pushField(fields, 'content.conclusion.plain_text', conclusion?.plain_text, 'text');

  return fields;
}

class ContentQualityReportService {
  /**
   * Generate a deterministic quality report for the *final* article output.
   *
   * @param {object} article - full article object
   * @param {object} options
   * @returns {object} quality report
   */
  static generateReport(article, options = {}) {
    const rules = getQualityRules();
    const fields = extractFields(article);

    const domain = options.domain || 'general';

    // Concatenate all field text (raw for html, cleaned for text) for article-scope rules.
    const articleText = fields
      .map((f) => (f.kind === 'html' ? String(f.raw || '') : String(f.text || '')))
      .join('\n')
      .trim();

    const findings = [];

    for (const r of rules) {
      if (Array.isArray(r.domains) && r.domains.length > 0 && !r.domains.includes(domain)) {
        continue;
      }

      let total = 0;
      const perField = [];

      if (r.scope === 'article') {
        const result = r.matcher(articleText);
        const count = Number(result?.count || 0);
        if (count) {
          total += count;
          perField.push({
            field: 'article',
            count,
            samples: Array.isArray(result?.samples) ? result.samples : [],
          });
        }
      } else {
        for (const f of fields) {
          const result = r.matcher(f.kind === 'html' ? f.raw : f.text);
          const count = Number(result?.count || 0);
          if (!count) continue;

          total += count;
          perField.push({
            field: f.field,
            count,
            samples: Array.isArray(result?.samples) ? result.samples : [],
          });
        }
      }

      if (total > 0) {
        findings.push({
          rule_id: r.id,
          severity: r.severity,
          message: r.message,
          total_count: total,
          fields: perField,
        });
      }
    }

    const counts = findings.reduce(
      (acc, f) => {
        acc.total += 1;
        if (f.severity === 'error') acc.error += 1;
        else if (f.severity === 'warn') acc.warn += 1;
        else acc.info += 1;
        return acc;
      },
      { total: 0, error: 0, warn: 0, info: 0 }
    );

    return {
      pass: counts.error === 0,
      summary: {
        total_rules_hit: counts.total,
        error_rules_hit: counts.error,
        warn_rules_hit: counts.warn,
        info_rules_hit: counts.info,
      },
      findings,
      options: {
        domain,
      },
      generated_at: new Date().toISOString(),
    };
  }
}

module.exports = ContentQualityReportService;
