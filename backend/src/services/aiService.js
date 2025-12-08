const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

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
   * 呼叫 Ollama API (本地端)
   */
  static async callOllama(prompt, options = {}) {
    try {
      const {
        model = process.env.OLLAMA_MODEL || 'deepseek-r1:32b',
        temperature = parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.7,
        system = null,
        base_url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
      } = options;

      const messages = [];

      if (system) {
        messages.push({
          role: 'system',
          content: system
        });
      }

      messages.push({
        role: 'user',
        content: prompt
      });

      const response = await axios.post(`${base_url}/api/chat`, {
        model,
        messages,
        stream: false,
        options: {
          temperature
        }
      });

      return {
        content: response.data.message.content,
        usage: {
          prompt_tokens: response.data.prompt_eval_count || 0,
          completion_tokens: response.data.eval_count || 0,
          total_tokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0)
        },
        model: response.data.model
      };
    } catch (error) {
      console.error('Ollama API Error:', error.response?.data || error.message);
      throw new Error(`Ollama API failed: ${error.message}`);
    }
  }

  /**
   * 通用 AI 呼叫（根據設定選擇 Provider）
   */
  static async generate(prompt, options = {}) {
    const { provider = 'ollama', ...restOptions } = options;

    if (provider === 'gemini') {
      return await this.callGemini(prompt, restOptions);
    } else if (provider === 'ollama') {
      return await this.callOllama(prompt, restOptions);
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * Stream 模式生成（用於即時顯示）
   */
  static async generateStream(prompt, options = {}, onChunk) {
    const { provider = 'ollama', ...restOptions } = options;

    if (provider === 'gemini') {
      return await this.streamGemini(prompt, restOptions, onChunk);
    } else if (provider === 'ollama') {
      return await this.streamOllama(prompt, restOptions, onChunk);
    } else {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }
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
   * Ollama Stream
   */
  static async streamOllama(prompt, options = {}, onChunk) {
    const {
      model = process.env.OLLAMA_MODEL || 'deepseek-r1:32b',
      temperature = parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.7,
      system = null,
      base_url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    } = options;

    const messages = [];

    if (system) {
      messages.push({ role: 'system', content: system });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await axios.post(`${base_url}/api/chat`, {
      model,
      messages,
      stream: true,
      options: {
        temperature
      }
    }, {
      responseType: 'stream'
    });

    let fullContent = '';

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              const text = json.message.content;
              fullContent += text;
              if (onChunk) {
                onChunk(text);
              }
            }
            if (json.done) {
              resolve(fullContent);
            }
          } catch (e) {
            // Skip invalid JSON lines
          }
        }
      });

      response.data.on('error', (error) => {
        reject(new Error(`Ollama stream failed: ${error.message}`));
      });
    });
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
