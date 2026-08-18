// Base de dados real em ficheiro (SQLite). Fica gravada em disco em "data.db"
// ao lado deste ficheiro — os dados sobrevivem a reinícios do servidor
// (desde que o alojamento tenha disco persistente — ver nota no fim deste ficheiro).
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migração suave: se a base de dados já existir de uma versão anterior
// (sem a coluna is_admin), acrescenta-a sem apagar nada.
try {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
} catch (e) {
  // já existe — ignora
}

// Cria (ou promove) a conta da administradora (Maria Bonita) a partir de
// variáveis de ambiente, para não ser preciso mexer em código nem na base
// de dados diretamente. Ver ADMIN_EMAIL / ADMIN_PASSWORD no .env.example.
function ensureAdminAccount(bcrypt) {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;

  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) {
    if (!existing.is_admin) {
      db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(existing.id);
      console.log(`Conta ${email} promovida a administradora.`);
    }
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (name, email, phone, password_hash, is_admin) VALUES (?, ?, ?, ?, 1)'
  ).run('Maria Bonita', email, '910000000', hash);
  console.log(`Conta de administradora criada: ${email}`);
}

module.exports = db;
module.exports.ensureAdminAccount = ensureAdminAccount;
