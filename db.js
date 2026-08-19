// Base de dados real usando PostgreSQL. Ao contrário de um ficheiro local,
// uma base de dados alojada (Neon, Supabase, Render Postgres, etc.) nunca
// se perde quando o servidor reinicia ou é reimplantado — vive à parte.
//
// Precisa de uma variável de ambiente DATABASE_URL com a "connection string"
// que o serviço de base de dados te dá (ver .env.example e COMO-POR-ONLINE.md).
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error(
    'Falta a variável de ambiente DATABASE_URL. Cria uma base de dados Postgres ' +
    'gratuita (ex: neon.tech) e cola a connection string nas Environment Variables.'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

async function init() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      service TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migração suave: se a tabela já existir de uma versão anterior sem
  // is_admin, acrescenta a coluna sem apagar nada.
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

// Cria (ou promove) a conta da administradora (Maria Bonita) a partir de
// variáveis de ambiente, para não ser preciso mexer em código nem na base
// de dados diretamente. Ver ADMIN_EMAIL / ADMIN_PASSWORD no .env.example.
async function ensureAdminAccount(bcrypt) {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return;

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const existing = rows[0];

  if (existing) {
    if (!existing.is_admin) {
      await query('UPDATE users SET is_admin = TRUE WHERE id = $1', [existing.id]);
      console.log(`Conta ${email} promovida a administradora.`);
    }
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  await query(
    'INSERT INTO users (name, email, phone, password_hash, is_admin) VALUES ($1, $2, $3, $4, TRUE)',
    ['Maria Bonita', email, '910000000', hash]
  );
  console.log(`Conta de administradora criada: ${email}`);
}

module.exports = { query, init, ensureAdminAccount, pool };
