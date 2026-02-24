const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy — 必要設定，系統透過 nginx 反向代理部署
// 若不設定，req.ip 永遠是 nginx 的 IP，Rate Limiter 形同虛設
app.set('trust proxy', 1);

// ===== Rate Limiting =====
// 全域基礎限流：同一 IP 每分鐘最多 60 次請求
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// AI 生成嚴格限流：同一 IP 每分鐘最多 5 次
const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI generation rate limit exceeded. Please wait before generating again.' }
});

// 研究分析限流：同一 IP 每分鐘最多 10 次
const researchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Research API rate limit exceeded. Please try again later.' }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'
}));
app.use(express.json());
app.use(morgan('dev'));
app.use(globalLimiter);

// Connect to Databases
connectDB();

// Routes
const authRoutes = require('./src/routes/authRoutes');
const projectRoutes = require('./src/routes/projectRoutes');
const keywordRoutes = require('./src/routes/keywordRoutes');
const researchRoutes = require('./src/routes/researchRoutes');
const articleRoutes = require('./src/routes/articleRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/keywords', keywordRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/articles', articleRoutes);

// Basic Routes
app.get('/', (req, res) => {
  res.json({ 
    service: 'ContentPilot Backend API',
    version: '0.1.0',
    status: 'running' 
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// Backward-compatible API health endpoint (used by external scripts/monitoring)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
});
