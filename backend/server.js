require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*'
}));
app.use(express.json());
app.use(morgan('dev'));

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
