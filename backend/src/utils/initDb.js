const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env.local') });
const fs = require('fs');
const { pgPool } = require('../config/db');

const initDb = async () => {
  try {
    console.log('🔄 Initializing Database...');
    console.log('Connection Config:', {
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      user: process.env.POSTGRES_USER,
      db: process.env.POSTGRES_DB,
      passwordLength: process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.length : 0
    });
    
    const schemaPath = path.join(__dirname, '../models/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pgPool.query(schemaSql);
    
    console.log('✅ Database Schema Applied Successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database Initialization Failed:', error);
    process.exit(1);
  }
};

initDb();
