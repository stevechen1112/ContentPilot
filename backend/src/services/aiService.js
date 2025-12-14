const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

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
        responseSchema = null  // 新增：支援結構化輸出
      } = options;

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

      const result = await geminiModel.generateContent(prompt);
      const response = result.response;
      const text = response.text();

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
      console.error('Google Gemini API Error:', error);
      throw new Error(`Gemini API failed: ${error.message}`);
    }
  }


  /**
   * 通用 AI 呼叫（支援 Gemini 和 OpenAI）
   */
  static async generate(prompt, options = {}) {
    const provider = String(options.provider || process.env.AI_PROVIDER || 'openai').toLowerCase();

    if (provider === 'gemini') {
      try {
        return await this.callGemini(prompt, options);
      } catch (error) {
        // Best-effort fallback to OpenAI if configured.
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'dummy-key-not-used') {
          console.warn(`⚠️ Gemini 失敗，改用 OpenAI：${error.message}`);
          return await this.callOpenAI(prompt, options);
        }
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
        response_format = null
      } = options;

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

      const response = await client.chat.completions.create(requestParams);

      return {
        content: response.choices[0].message.content,
        usage: {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        },
        model: model
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API failed: ${error.message}`);
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
