# Ollama Integration Guide

## 概述

ContentPilot 現已整合本地 LLM 服務 Ollama。為了獲得最佳效能與台灣繁體中文支援，預設模型已更新為 `kenneth85/llama-3-taiwan:8b-instruct`。

## 優勢

✅ **完全免費** - 無需 API 金鑰
✅ **速度極快** - 8B 輕量化模型，支援 GPU 加速
✅ **台灣在地化** - 專為台灣繁體中文優化
✅ **低硬體需求** - 僅需 6GB+ VRAM 即可完整 GPU 運行

## 配置說明

### 1. 環境變數 (.env) (已更新)

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=kenneth85/llama-3-taiwan:8b-instruct
OLLAMA_TEMPERATURE=0.7
```

### 2. GPU 加速檢查

如果您發現生成速度慢且 GPU 無負載：
1. **檢查 VRAM**: 32B 模型需 20GB+ VRAM，8B 模型僅需 6GB。
2. **Ollama 日誌**: 啟動 Ollama 時查看 Log 是否顯示 `detected GPU`。
3. **工作管理員**: Windows 工作管理員 -> 效能 -> GPU -> 檢查 "Cuda" 或 "Compute" 使用率。

## 使用方式

### 自動使用

系統已將預設 AI Provider 設定為 `ollama`，所有 AI 生成功能會自動使用本地模型。

### 測試腳本

```bash
# 測試 Ollama 基礎功能與速度
cd backend
node test-ollama.js
```

### 切換模型

如需測試其他模型（如 deepseek-r1:32b），修改 `.env` 中的 `OLLAMA_MODEL` 即可，但請注意硬體需求。

---

**更新日期**: 2025-12-07
**模型版本**: Llama-3-Taiwan-8B-Instruct
