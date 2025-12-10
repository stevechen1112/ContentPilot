import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// 建立 axios 實例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000,  // 增加到 10 分鐘（文章生成需要更長時間）
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request 攔截器：自動附加 JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response 攔截器：處理錯誤
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token 過期或無效，清除並跳轉登入
      // localStorage.removeItem('auth_token');
      // localStorage.removeItem('user');
      // window.location.href = '/login';
      console.warn('API 401 Unauthorized - Ignoring in dev mode');
    }
    return Promise.reject(error);
  }
);

// ==================== Auth API ====================
export const authAPI = {
  register: (data: any) => apiClient.post('/auth/register', data),
  login: (data: any) => apiClient.post('/auth/login', data),
};

// ==================== Project API ====================
export const projectAPI = {
  create: (data: any) => apiClient.post('/projects', data),
  getAll: () => apiClient.get('/projects'),
  getById: (id: string) => apiClient.get(`/projects/${id}`),
  update: (id: string, data: any) => apiClient.put(`/projects/${id}`, data),
  delete: (id: string) => apiClient.delete(`/projects/${id}`),

  // Keywords
  addKeywords: (projectId: string, keywords: any[]) =>
    apiClient.post(`/projects/${projectId}/keywords`, { keywords }),
  getKeywords: (projectId: string, params: any) =>
    apiClient.get(`/projects/${projectId}/keywords`, { params }),
  updateKeyword: (projectId: string, keywordId: string, data: any) =>
    apiClient.put(`/projects/${projectId}/keywords/${keywordId}`, data),
  deleteKeyword: (projectId: string, keywordId: string) =>
    apiClient.delete(`/projects/${projectId}/keywords/${keywordId}`),
};

// ==================== Research API ====================
export const researchAPI = {
  analyzeKeyword: (keyword: string) =>
    apiClient.post('/research/analyze-keyword', { keyword }),
  analyzeBatch: (projectId: string, keywords: string[]) =>
    apiClient.post('/research/analyze-batch', { project_id: projectId, keywords }),
  getRelatedSearches: (keyword: string) =>
    apiClient.get('/research/related-searches', { params: { keyword } }),
  expandKeywords: (seedKeyword: string, projectId: string) =>
    apiClient.post('/research/expand-keywords', { seed_keyword: seedKeyword, project_id: projectId }),
};

// ==================== Article API ====================
export const articleAPI = {
  generateOutline: (keyword: string, projectId: string, serpData: any, options: any = {}) =>
    apiClient.post('/articles/generate-outline', {
      keyword,
      project_id: projectId,
      serp_data: serpData,
      ...options
    }),
  generate: (projectId: string, keywordId: string | null, outline: any, options: any = {}) =>
    apiClient.post('/articles/generate', {
      project_id: projectId,
      keyword_id: keywordId,
      outline,
      ...options
    }),
  getAll: (projectId: string, status?: string) =>
    apiClient.get('/articles', { params: { project_id: projectId, status } }),
  getById: (id: string) => apiClient.get(`/articles/${id}`),
  update: (id: string, data: any) => apiClient.put(`/articles/${id}`, data),
  delete: (id: string) => apiClient.delete(`/articles/${id}`),

  // Smart Rewrite
  rewriteSection: (articleId: string, sectionIndex: number, originalContent: string, userInput: string) =>
    apiClient.post('/articles/rewrite-section', {
      article_id: articleId,
      section_index: sectionIndex,
      original_content: originalContent,
      user_input: userInput
    }),

  // Quality Check (舊版，兼容性)
  qualityCheck: (id: string, targetKeyword: string) =>
    apiClient.post(`/articles/${id}/quality-check`, { target_keyword: targetKeyword }),

  // S6 綜合品質檢查（新版）
  comprehensiveQualityCheck: (id: string, targetKeyword: string, serpData: any = null) =>
    apiClient.post(`/articles/${id}/comprehensive-quality-check`, {
      target_keyword: targetKeyword,
      serp_data: serpData
    }),

  // S8 經驗缺口檢測（核心功能）
  detectExperienceGaps: (id: string, targetKeyword: string) =>
    apiClient.post(`/articles/${id}/detect-experience-gaps`, { target_keyword: targetKeyword }),

  // S8 智能融合重寫
  smartRewrite: (id: string, sectionId: number, userExperience: string, sectionHeading: string = '') =>
    apiClient.post(`/articles/${id}/smart-rewrite`, {
      section_id: sectionId,
      user_experience: userExperience,
      section_heading: sectionHeading
    }),
};

export default apiClient;
