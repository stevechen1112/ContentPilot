const { Pool } = require('pg');
const mongoose = require('mongoose');
const { createClient } = require('redis');

// PostgreSQL Configuration
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'contentpilot_dev',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

// Redis Client
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

const connectDB = async () => {
  try {
    // 1. Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected');

    // 2. Connect to PostgreSQL
    await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL Connected');

    // 3. Connect to Redis
    await redisClient.connect();
    console.log('✅ Redis Connected');

    return { pgPool, redisClient };
  } catch (error) {
    console.error('❌ Database Connection Failed:', error);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
  pgPool,
  redisClient,
  mongoose
};
