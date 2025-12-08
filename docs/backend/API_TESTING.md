# ContentPilot Backend API 測試指南

## API 端點總覽

### 1. 認證 API
```bash
# 註冊
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'

# 登入
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. 專案管理 API
```bash
# 建立專案（需要 JWT Token）
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "我的第一個專案",
    "domain": "https://example.com",
    "industry": "科技",
    "target_audience": "軟體開發者"
  }'

# 取得所有專案
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 取得單一專案
curl -X GET http://localhost:3000/api/projects/{PROJECT_ID} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. 關鍵字管理 API
```bash
# 新增關鍵字到專案（批量）
curl -X POST http://localhost:3000/api/projects/{PROJECT_ID}/keywords \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "keywords": [
      {
        "keyword": "React 教學",
        "search_volume": 5000,
        "difficulty_score": 60,
        "priority": "high"
      },
      {
        "keyword": "Node.js 入門",
        "search_volume": 3000,
        "difficulty_score": 45,
        "priority": "medium"
      }
    ]
  }'

# 取得專案的關鍵字列表
curl -X GET "http://localhost:3000/api/projects/{PROJECT_ID}/keywords?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. 關鍵字研究 API
```bash
# 分析單一關鍵字（SERP）
curl -X POST http://localhost:3000/api/research/analyze-keyword \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "keyword": "SEO 優化技巧"
  }'

# 取得相關搜尋建議
curl -X GET "http://localhost:3000/api/research/related-searches?keyword=SEO優化" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 智能關鍵字擴展
curl -X POST http://localhost:3000/api/research/expand-keywords \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "seed_keyword": "內容行銷",
    "project_id": "YOUR_PROJECT_ID"
  }'
```

### 5. 文章大綱生成 API
```bash
# 生成文章大綱
curl -X POST http://localhost:3000/api/articles/generate-outline \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "keyword": "React Hooks 完整教學",
    "project_id": "YOUR_PROJECT_ID"
  }'
```

### 6. 文章生成 API
```bash
# 根據大綱生成完整文章
curl -X POST http://localhost:3000/api/articles/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "project_id": "YOUR_PROJECT_ID",
    "keyword_id": "YOUR_KEYWORD_ID",
    "outline": {
      "title": "React Hooks 完整教學：從入門到精通",
      "sections": [
        {
          "heading": "什麼是 React Hooks？",
          "key_points": ["定義", "優勢", "使用場景"],
          "estimated_words": 300
        }
      ]
    }
  }'

# 取得文章列表
curl -X GET "http://localhost:3000/api/articles?project_id=YOUR_PROJECT_ID" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 取得單一文章
curl -X GET http://localhost:3000/api/articles/{ARTICLE_ID} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7. 智能二修 API
```bash
# 改寫段落（融合使用者經驗）
curl -X POST http://localhost:3000/api/articles/rewrite-section \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "article_id": "YOUR_ARTICLE_ID",
    "section_index": 0,
    "original_content": "<p>原始 AI 生成的內容...</p>",
    "user_input": "我個人的實戰經驗是..."
  }'

# 品質檢查
curl -X POST http://localhost:3000/api/articles/{ARTICLE_ID}/quality-check \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "target_keyword": "React Hooks"
  }'
```

## 測試流程範例

### 完整工作流程測試

1. **註冊並登入**
2. **建立專案**
3. **新增關鍵字**（手動輸入或透過關鍵字研究）
4. **生成文章大綱**
5. **生成完整文章**
6. **品質檢查**
7. **人工補充經驗**
8. **改寫融合**

## 注意事項

1. 所有需要認證的 API 都需要在 Header 加入 `Authorization: Bearer YOUR_JWT_TOKEN`
2. JWT Token 在登入或註冊後會返回
3. Serper API 和 AI API 需要有效的 API Key（已在 .env.local 設定）
4. Stream API (`generate-section-stream`) 使用 Server-Sent Events (SSE)

## 健康檢查

```bash
# 基本健康檢查
curl http://localhost:3000/health

# 服務資訊
curl http://localhost:3000/
```
