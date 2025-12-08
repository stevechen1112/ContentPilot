const { GoogleGenerativeAI } = require('@google/generative-ai');

// 懶加載 AI 客戶端（只在需要時初始化）
let gemini = null;

function getGeminiClient() {
  if (!gemini) {
    gemini = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY || 'dummy-key-not-used');
  }
  return gemini;
}

class AIService {
  /**
   * 呼叫 Google Gemini API
   */
  static async callGemini(prompt, options = {}) {
    try {
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
   * 通用 AI 呼叫（強制使用 Gemini）
   */
  static async generate(prompt, options = {}) {
    // 忽略 provider 參數，強制使用 Gemini
    return await this.callGemini(prompt, options);
  }

  /**
   * Stream 模式生成（強制使用 Gemini）
   */
  static async generateStream(prompt, options = {}, onChunk) {
    // 忽略 provider 參數，強制使用 Gemini
    return await this.streamGemini(prompt, options, onChunk);
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
