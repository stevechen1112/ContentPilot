const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const ObservabilityService = require('./observabilityService');

// 懶加載 AI 客戶端（只在需要時初始化）
let gemini = null;
let openai = null;

function getGeminiClient() {
  if (!gemini) {
    gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || 'dummy-key-not-used');
  }
  return gemini;
}

function getOpenAIClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key-not-used'
    });
  }
  return openai;
}

class AIService {
  static resolveErrorCode(error, provider = 'unknown') {
    const rawCode = String(error?.code || '').toUpperCase();
    const text = `${error?.message || ''} ${error?.statusText || ''}`.toUpperCase();

    if (rawCode === 'AI_TIMEOUT' || text.includes('TIMEOUT')) return 'AI_TIMEOUT';
    if (text.includes('API_KEY') || text.includes('INVALID_API_KEY') || text.includes('API KEY EXPIRED')) {
      return `${String(provider).toUpperCase()}_AUTH_INVALID`;
    }
    if (text.includes('RATE LIMIT') || rawCode === '429') return `${String(provider).toUpperCase()}_RATE_LIMIT`;
    if (text.includes('BAD REQUEST') || rawCode === '400') return `${String(provider).toUpperCase()}_BAD_REQUEST`;
    if (text.includes('ECONN') || text.includes('NETWORK') || text.includes('FETCH')) return `${String(provider).toUpperCase()}_NETWORK_ERROR`;
    return `${String(provider).toUpperCase()}_UNKNOWN_ERROR`;
  }

  static withTimeout(promise, timeoutMs = 180000) {
    const safeTimeout = Math.max(1000, Number(timeoutMs) || 180000);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const timeoutError = new Error(`AI request timeout after ${safeTimeout}ms`);
        timeoutError.code = 'AI_TIMEOUT';
        reject(timeoutError);
      }, safeTimeout);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  /**
   * 呼叫 Google Gemini API
   */
  static async callGemini(prompt, options = {}) {
    try {
      const {
        model = process.env.GOOGLE_GEMINI_MODEL || 'gemini-3-pro-preview',
        temperature = parseFloat(process.env.GOOGLE_GEMINI_TEMPERATURE) || 1.0,  // Gemini 3 建議使用預設值 1.0
        max_tokens = parseInt(process.env.GOOGLE_GEMINI_MAX_TOKENS) || 8192,
        system = null,
        responseSchema = null,  // 新增：支援結構化輸出
        timeout_ms = parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10) || 180000
      } = options;

      const requestStartedAt = Date.now();
      const runId = options.observability_run_id || null;

      ObservabilityService.logEvent('ai.request.started', {
        run_id: runId,
        provider: 'gemini',
        model,
        timeout_ms,
        max_tokens,
        temperature
      });

      const genAI = getGeminiClient();
      
      // 建構 generationConfig
      const generationConfig = {
        temperature,
        maxOutputTokens: max_tokens,
      };

      // 如果提供了 responseSchema，使用結構化輸出
      if (responseSchema) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = responseSchema;
      }

      const geminiModel = genAI.getGenerativeModel({ 
        model,
        generationConfig,
        systemInstruction: system || undefined
      });

      const result = await this.withTimeout(geminiModel.generateContent(prompt), timeout_ms);
      const response = result.response;
      const text = response.text();

      ObservabilityService.logEvent('ai.request.succeeded', {
        run_id: runId,
        provider: 'gemini',
        model,
        latency_ms: Date.now() - requestStartedAt,
        output_chars: String(text || '').length,
        total_tokens: response.usageMetadata?.totalTokenCount || 0,
        prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
        completion_tokens: response.usageMetadata?.candidatesTokenCount || 0
      });

      return {
        content: text,
        usage: {
          prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.usageMetadata?.totalTokenCount || 0
        },
        model: model
      };
    } catch (error) {
      const code = this.resolveErrorCode(error, 'gemini');
      error.code = error.code || code;
      ObservabilityService.logEvent('ai.request.failed', {
        run_id: options.observability_run_id || null,
        provider: 'gemini',
        model: options.model || process.env.GOOGLE_GEMINI_MODEL || 'gemini-3-pro-preview',
        error_code: code,
        message: error.message
      }, 'error');
      console.error('Google Gemini API Error:', error);
      const wrapped = new Error(`Gemini API failed: ${error.message}`);
      wrapped.code = error.code || code;
      throw wrapped;
    }
  }


  /**
   * 通用 AI 呼叫（支援 Gemini 和 OpenAI）
   */
  static async generate(prompt, options = {}) {
    const provider = String(options.provider || process.env.AI_PROVIDER || 'openai').toLowerCase();
    const runId = options.observability_run_id || null;

    if (provider === 'gemini') {
      try {
        return await this.callGemini(prompt, options);
      } catch (error) {
        const reasonCode = this.resolveErrorCode(error, 'gemini');
        // Best-effort fallback to OpenAI if configured.
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy-key-not-used') {
          ObservabilityService.recordFallback(runId, {
            from_provider: 'gemini',
            to_provider: 'openai',
            reason_code: reasonCode
          });
          console.warn(`⚠️ Gemini 失敗，改用 OpenAI：${error.message}`);
          return await this.callOpenAI(prompt, options);
        }
        error.code = error.code || reasonCode;
        throw error;
      }
    }

    return await this.callOpenAI(prompt, options);
  }

  /**
   * 呼叫 OpenAI API
   */
  static async callOpenAI(prompt, options = {}) {
    try {
      const {
        model = process.env.OPENAI_MODEL || 'gpt-5-mini',
        temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
        max_tokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 4096,
        system = null,
        response_format = null,
        timeout_ms = parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10) || 180000
      } = options;

      const requestStartedAt = Date.now();
      const runId = options.observability_run_id || null;

      ObservabilityService.logEvent('ai.request.started', {
        run_id: runId,
        provider: 'openai',
        model,
        timeout_ms,
        max_tokens,
        temperature
      });

      const client = getOpenAIClient();

      // 防禦：確保 prompt 為非空字串
      const safePrompt = (typeof prompt === 'string' && prompt.trim().length > 0)
        ? prompt
        : '請產生一份文章大綱（台灣繁體中文）。';
      
      const messages = [];
      if (system) {
        messages.push({ role: 'system', content: system });
      }
      messages.push({ role: 'user', content: safePrompt });

      const requestParams = {
        model,
        messages
      };

      if (response_format) {
        requestParams.response_format = response_format;
      }

      // gpt-5 系列限制
      if (model.startsWith('gpt-5')) {
        requestParams.max_completion_tokens = max_tokens;
        // gpt-5-mini 只支援 temperature=1（預設值），不設定即可
        if (temperature !== 1) {
          console.warn(`⚠️ gpt-5-mini 只支援 temperature=1，已忽略設定值 ${temperature}`);
        }
      } else {
        requestParams.max_tokens = max_tokens;
        requestParams.temperature = temperature;
      }

      const response = await this.withTimeout(client.chat.completions.create(requestParams), timeout_ms);
      const output = response.choices[0].message.content;

      ObservabilityService.logEvent('ai.request.succeeded', {
        run_id: runId,
        provider: 'openai',
        model,
        latency_ms: Date.now() - requestStartedAt,
        output_chars: String(output || '').length,
        total_tokens: response.usage?.total_tokens || 0,
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0
      });

      return {
        content: output,
        usage: {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        },
        model: model
      };
    } catch (error) {
      const code = this.resolveErrorCode(error, 'openai');
      error.code = error.code || code;
      ObservabilityService.logEvent('ai.request.failed', {
        run_id: options.observability_run_id || null,
        provider: 'openai',
        model: options.model || process.env.OPENAI_MODEL || 'gpt-5-mini',
        error_code: code,
        message: error.message
      }, 'error');
      console.error('OpenAI API Error:', error);
      const wrapped = new Error(`OpenAI API failed: ${error.message}`);
      wrapped.code = error.code || code;
      throw wrapped;
    }
  }

  /**
   * Stream 模式生成（支援 Gemini 和 OpenAI）
   */
  static async generateStream(prompt, options = {}, onChunk) {
    const provider = process.env.AI_PROVIDER || 'openai';
    
    if (provider === 'openai') {
      return await this.streamOpenAI(prompt, options, onChunk);
    } else {
      return await this.streamGemini(prompt, options, onChunk);
    }
  }

  /**
   * OpenAI Stream
   */
  static async streamOpenAI(prompt, options = {}, onChunk) {
    const {
      model = process.env.OPENAI_MODEL || 'gpt-5-mini',
      temperature = parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
      max_tokens = parseInt(process.env.OPENAI_MAX_TOKENS) || 4096,
      system = null
    } = options;

    const client = getOpenAIClient();
    
    const messages = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: prompt });

    const requestParams = {
      model,
      messages,
      stream: true
    };

    // gpt-5 系列限制
    if (model.startsWith('gpt-5')) {
      requestParams.max_completion_tokens = max_tokens;
      // gpt-5-mini 只支援 temperature=1（預設值），不設定即可
      if (temperature !== 1) {
        console.warn(`⚠️ gpt-5-mini 只支援 temperature=1，已忽略設定值 ${temperature}`);
      }
    } else {
      requestParams.max_tokens = max_tokens;
      requestParams.temperature = temperature;
    }

    const stream = await client.chat.completions.create(requestParams);

    let fullContent = '';

    for await (const chunk of stream) {
      const chunkText = chunk.choices[0]?.delta?.content || '';
      fullContent += chunkText;
      if (onChunk && chunkText) {
        onChunk(chunkText);
      }
    }

    return fullContent;
  }

  /**
   * Gemini Stream
   */
  static async streamGemini(prompt, options = {}, onChunk) {
    const {
      model = process.env.GOOGLE_GEMINI_MODEL || 'gemini-2.0-flash-exp',
      temperature = parseFloat(process.env.GOOGLE_GEMINI_TEMPERATURE) || 0.7,
      max_tokens = parseInt(process.env.GOOGLE_GEMINI_MAX_TOKENS) || 8192,
      system = null
    } = options;

    const genAI = getGeminiClient();
    const geminiModel = genAI.getGenerativeModel({ 
      model,
      generationConfig: {
        temperature,
        maxOutputTokens: max_tokens,
      },
      systemInstruction: system || undefined
    });

    const result = await geminiModel.generateContentStream(prompt);

    let fullContent = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullContent += chunkText;
      if (onChunk) {
        onChunk(chunkText);
      }
    }

    return fullContent;
  }


  /**
   * 批量生成（多個 prompt 並行處理）
   */
  static async generateBatch(prompts, options = {}) {
    const promises = prompts.map(prompt => this.generate(prompt, options));
    return await Promise.all(promises);
  }
}

module.exports = AIService;
