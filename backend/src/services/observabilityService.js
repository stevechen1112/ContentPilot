class ObservabilityService {
  constructor() {
    this.activeRuns = new Map();
    this.completedRuns = [];
    this.maxCompletedRuns = 1000;
  }

  nowIso() {
    return new Date().toISOString();
  }

  buildRunId() {
    const rand = Math.random().toString(36).slice(2, 8);
    return `run_${Date.now()}_${rand}`;
  }

  logEvent(event, payload = {}, level = 'info') {
    const envelope = {
      ts: this.nowIso(),
      level,
      event,
      ...payload
    };

    // 若事件包含 token 資料且關聯到某個 run，累加到 run 統計
    if (payload.run_id && payload.total_tokens) {
      const run = this.activeRuns.get(payload.run_id);
      if (run) {
        run.total_tokens += Number(payload.total_tokens) || 0;
        run.prompt_tokens += Number(payload.prompt_tokens) || 0;
        run.completion_tokens += Number(payload.completion_tokens) || 0;
      }
    }

    const line = JSON.stringify(envelope);
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  startRun({ pipeline = 'article_generation', provider = 'unknown', meta = {} } = {}) {
    const runId = this.buildRunId();
    const run = {
      run_id: runId,
      pipeline,
      provider,
      meta,
      started_at: Date.now(),
      retries: 0,
      fallbacks: 0,
      fallback_reasons: [],
      retry_reasons: [],
      stages: [],
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      error_code: null,
      quality_score: null,
      quality_bucket: 'unknown',
      success: null,
      duration_ms: null
    };

    this.activeRuns.set(runId, run);
    this.logEvent('pipeline.started', {
      run_id: runId,
      pipeline,
      provider,
      meta
    });

    return runId;
  }

  recordStage(runId, { stage, status = 'ok', duration_ms = null, error_code = null } = {}) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.stages.push({
      stage,
      status,
      duration_ms,
      error_code,
      ts: this.nowIso()
    });

    this.logEvent('pipeline.stage', {
      run_id: runId,
      pipeline: run.pipeline,
      stage,
      status,
      duration_ms,
      error_code
    }, status === 'error' ? 'error' : 'info');
  }

  recordRetry(runId, { stage = 'unknown', reason_code = 'RETRY_UNKNOWN', provider = null } = {}) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.retries += 1;
    run.retry_reasons.push(reason_code);

    this.logEvent('pipeline.retry', {
      run_id: runId,
      pipeline: run.pipeline,
      stage,
      provider,
      reason_code,
      retry_count: run.retries
    }, 'warn');
  }

  recordFallback(runId, { from_provider = 'unknown', to_provider = 'unknown', reason_code = 'FALLBACK_UNKNOWN' } = {}) {
    const run = this.activeRuns.get(runId);
    if (!run) return;

    run.fallbacks += 1;
    run.fallback_reasons.push(reason_code);

    this.logEvent('pipeline.fallback', {
      run_id: runId,
      pipeline: run.pipeline,
      from_provider,
      to_provider,
      reason_code,
      fallback_count: run.fallbacks
    }, 'warn');
  }

  finishRun(runId, { success = true, error_code = null, quality_score = null } = {}) {
    const run = this.activeRuns.get(runId);
    if (!run) return null;

    run.success = Boolean(success);
    run.error_code = error_code || null;
    run.duration_ms = Date.now() - run.started_at;

    if (quality_score !== null && quality_score !== undefined && Number.isFinite(Number(quality_score))) {
      run.quality_score = Number(quality_score);
      run.quality_bucket = this.toQualityBucket(run.quality_score);
    }

    this.activeRuns.delete(runId);
    this.completedRuns.push(run);

    if (this.completedRuns.length > this.maxCompletedRuns) {
      this.completedRuns.splice(0, this.completedRuns.length - this.maxCompletedRuns);
    }

    this.logEvent('pipeline.finished', {
      run_id: runId,
      pipeline: run.pipeline,
      success: run.success,
      error_code: run.error_code,
      duration_ms: run.duration_ms,
      retries: run.retries,
      fallbacks: run.fallbacks,
      total_tokens: run.total_tokens,
      prompt_tokens: run.prompt_tokens,
      completion_tokens: run.completion_tokens,
      quality_score: run.quality_score,
      quality_bucket: run.quality_bucket
    }, run.success ? 'info' : 'error');

    return run;
  }

  toQualityBucket(score) {
    if (!Number.isFinite(score)) return 'unknown';
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 55) return 'fair';
    return 'poor';
  }

  getSummary({ window_minutes = 60 * 24 } = {}) {
    const windowMs = Math.max(1, Number(window_minutes) || 60) * 60 * 1000;
    const since = Date.now() - windowMs;

    const runs = this.completedRuns.filter((run) => run.started_at >= since);
    const total = runs.length;
    const successRuns = runs.filter((run) => run.success);
    const failedRuns = runs.filter((run) => !run.success);

    const totalDuration = runs.reduce((acc, run) => acc + (run.duration_ms || 0), 0);
    const avgDurationMs = total > 0 ? Math.round(totalDuration / total) : 0;

    const totalRetries = runs.reduce((acc, run) => acc + (run.retries || 0), 0);
    const totalFallbacks = runs.reduce((acc, run) => acc + (run.fallbacks || 0), 0);
    const runsWithRetries = runs.filter((run) => (run.retries || 0) > 0).length;
    const runsWithFallbacks = runs.filter((run) => (run.fallbacks || 0) > 0).length;

    const retryRate = total > 0 ? Number((runsWithRetries / total).toFixed(4)) : 0;
    const fallbackRate = total > 0 ? Number((runsWithFallbacks / total).toFixed(4)) : 0;
    const avgRetriesPerRun = total > 0 ? Number((totalRetries / total).toFixed(4)) : 0;
    const avgFallbacksPerRun = total > 0 ? Number((totalFallbacks / total).toFixed(4)) : 0;
    const successRate = total > 0 ? Number((successRuns.length / total).toFixed(4)) : 0;

    const slaTargetMs = Number(process.env.GENERATION_SLA_MS || 300000);
    const withinSla = successRuns.filter((run) => (run.duration_ms || Number.MAX_SAFE_INTEGER) <= slaTargetMs).length;
    const slaPassRate = successRuns.length > 0 ? Number((withinSla / successRuns.length).toFixed(4)) : 0;

    const errorCodeDistribution = {};
    const qualityDistribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      unknown: 0
    };

    for (const run of runs) {
      if (!run.success) {
        const key = run.error_code || 'UNKNOWN_ERROR';
        errorCodeDistribution[key] = (errorCodeDistribution[key] || 0) + 1;
      }
      const bucket = run.quality_bucket || 'unknown';
      qualityDistribution[bucket] = (qualityDistribution[bucket] || 0) + 1;
    }

    return {
      window_minutes: Number(window_minutes) || 60,
      total_runs: total,
      success_runs: successRuns.length,
      failed_runs: failedRuns.length,
      success_rate: successRate,
      avg_duration_ms: avgDurationMs,
      total_retries: totalRetries,
      retry_rate: retryRate,
      avg_retries_per_run: avgRetriesPerRun,
      total_fallbacks: totalFallbacks,
      fallback_rate: fallbackRate,
      avg_fallbacks_per_run: avgFallbacksPerRun,
      token_usage: {
        total_tokens: runs.reduce((acc, run) => acc + (run.total_tokens || 0), 0),
        prompt_tokens: runs.reduce((acc, run) => acc + (run.prompt_tokens || 0), 0),
        completion_tokens: runs.reduce((acc, run) => acc + (run.completion_tokens || 0), 0),
        avg_tokens_per_run: total > 0 ? Math.round(runs.reduce((acc, run) => acc + (run.total_tokens || 0), 0) / total) : 0
      },
      sla: {
        target_ms: slaTargetMs,
        pass_runs: withinSla,
        pass_rate: slaPassRate
      },
      quality_distribution: qualityDistribution,
      error_code_distribution: errorCodeDistribution,
      active_runs: this.activeRuns.size
    };
  }
}

module.exports = new ObservabilityService();
