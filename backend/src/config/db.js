const { Pool } = require('pg');
const { createClient } = require('redis');

const isTruthy = (value) => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y';
};

const shouldSkipDb = isTruthy(process.env.SKIP_DB);
const shouldRequireDb =
  isTruthy(process.env.REQUIRE_DB) || (!('REQUIRE_DB' in process.env) && process.env.NODE_ENV === 'production');

// PostgreSQL Configuration
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'contentpilot_dev',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
});

// Redis Client
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const redisPassword = process.env.REDIS_PASSWORD || '';
const redisUrl = process.env.REDIS_URL || (redisPassword
  ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
  : `redis://${redisHost}:${redisPort}`);
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('Redis Client Error', err));

const connectDB = async () => {
  if (shouldSkipDb) {
    console.warn('⚠️  SKIP_DB=true: database connections are disabled');
    return { pgPool, redisClient };
  }

  const errors = [];

  // 1. Connect to PostgreSQL
  try {
    await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL Connected');
  } catch (error) {
    errors.push({ name: 'PostgreSQL', error });
  }

  // 2. Connect to Redis
  try {
    await redisClient.connect();
    console.log('✅ Redis Connected');
  } catch (error) {
    errors.push({ name: 'Redis', error });
  }

  if (errors.length > 0) {
    console.error('❌ Database Connection Issues:');
    for (const entry of errors) {
      console.error(`   - ${entry.name}:`, entry.error?.message || entry.error);
    }

    if (shouldRequireDb) {
      console.error('❌ REQUIRE_DB=true (or production default): exiting');
      process.exit(1);
    }

    console.warn('⚠️  Continuing without full DB connectivity (REQUIRE_DB!=true)');
  }

  return { pgPool, redisClient };
};

module.exports = {
  connectDB,
  pgPool,
  redisClient
};
