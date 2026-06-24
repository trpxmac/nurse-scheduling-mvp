import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow large JSON payloads (roster/schedule data can be large)

// Connection Pool to Neon PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon DB connection
  },
});

// Initialize Database Table
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nss_store (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✨ Database Table "nss_store" checked/created successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  }
}

// Routes

// 1. Get a specific key from PostgreSQL
app.get('/api/data/:key', async (req, res) => {
  const { key } = req.params;
  try {
    const result = await pool.query('SELECT value FROM nss_store WHERE key = $1', [key]);
    if (result.rows.length > 0) {
      res.json({ success: true, value: result.rows[0].value });
    } else {
      res.status(404).json({ success: false, error: 'Key not found' });
    }
  } catch (err) {
    console.error(`❌ Error fetching key "${key}":`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Set a specific key to PostgreSQL
app.post('/api/data/:key', async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  if (value === undefined) {
    return res.status(400).json({ success: false, error: 'Missing value' });
  }

  try {
    await pool.query(`
      INSERT INTO nss_store (key, value, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
    `, [key, JSON.stringify(value)]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(`❌ Error pushing key "${key}" to database:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Reset/Clear all data
app.post('/api/sync/reset', async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE nss_store');
    console.log('🗑️ Database has been truncated (reset).');
    res.json({ success: true, message: 'Database reset successful' });
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
});
