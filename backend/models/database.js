import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'readium.db');

let db = null;

// Save database to file — call after every write

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Initialize and create tables
async function initDatabase() {
  const SQL = await initSqlJs();

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database file or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign key constraints (sql.js disables them by default)
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT,
      file_path TEXT NOT NULL,
      current_page INTEGER DEFAULT 1,
      zoom REAL DEFAULT 1.0,
      total_pages INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      page_number INTEGER,
      highlight_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      position TEXT NOT NULL,
      color TEXT DEFAULT '#FFEB3B',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reflections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      highlight_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      agent_style TEXT NOT NULL DEFAULT 'philosophy',
      user_note TEXT DEFAULT '',
      reflection TEXT NOT NULL,
      recommendations TEXT DEFAULT '[]',
      conversation TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(highlight_id, agent_style),
      FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_concepts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      book_title TEXT NOT NULL,
      highlight_id INTEGER NOT NULL,
      agent_style TEXT NOT NULL,
      concept TEXT NOT NULL,
      context TEXT NOT NULL,
      source_text TEXT DEFAULT '',
      page_number TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (highlight_id) REFERENCES highlights(id) ON DELETE CASCADE
    )
  `);

  // Add columns if they don't exist (safe to run multiple times on existing DB)
  try { db.run(`ALTER TABLE user_concepts ADD COLUMN source_text TEXT DEFAULT ''`); } catch(e) {}
  try { db.run(`ALTER TABLE user_concepts ADD COLUMN page_number TEXT DEFAULT ''`); } catch(e) {}

  // Save to disk after init
  saveDatabase();

  console.log('Database initialized at', DB_PATH);
  return db;
}

// Helper: Get all rows
function getAll(sql, params = []) {
  if (!db) return [];
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: Get one row
function getOne(sql, params = []) {
  if (!db) return null;
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

// Helper: Run query and persist
function run(sql, params = []) {
  if (!db) return { lastInsertRowid: 0 };
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as id");
  // Persist every write
  saveDatabase();
  return { lastInsertRowid: result[0]?.values[0][0] || 0 };
}

export { db, initDatabase, getAll, getOne, run };