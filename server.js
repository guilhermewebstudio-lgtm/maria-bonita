require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');
const { sendEmail } = require('./email');

const app = express();
app.use(cors());
app.use(express.json());

// O servidor serve também o próprio site (a pasta "public"), para tudo
// ficar no mesmo endereço — não precisas de configurar nada mais.
app.use(express.static(require('path').join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-muda-isto';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// Cria/promove a conta da Maria Bonita se ADMIN_EMAIL e ADMIN_PASSWORD
// estiverem definidos nas variáveis de ambiente.
db.ensureAdminAccount(bcrypt);

/* ---------------------------------------------------------------- */
/* Utilitários                                                       */
/* ---------------------------------------------------------------- */

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, is_admin: !!row.is_admin };
}

function makeToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Sessão em falta. Inicie sessão.' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: 'Sessão inválida ou expirada. Inicie sessão novamente.' });
  }
}

// Só deixa passar se o utilizador autenticado for a administradora (Maria Bonita).
function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user || !user.is_admin) return res.status(403).json({ message: 'Acesso restrito à Maria Bonita.' });
  next();
}

function isValidPhone(phone) {
  return /^9\d{8}$/.test(String(phone).replace(/\s/g, ''));
}

/* ---------------------------------------------------------------- */
/* AUTENTICAÇÃO                                                      */
/* ---------------------------------------------------------------- */

app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password } = req.body || {};

  if (!name || String(name).trim().length < 2)
    return res.status(400).json({ message: 'Indique o seu nome.' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return res.status(400).json({ message: 'Email inválido.' });
  if (!isValidPhone(phone))
    return res.status(400).json({ message: 'Telemóvel inválido (9 dígitos, a começar em 9).' });
  if (!password || password.length < 6)
    return res.status(400).json({ message: 'A password deve ter pelo menos 6 caracteres.' });

  const emailNorm = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailNorm);
  if (existing) return res.status(409).json({ message: 'Já existe uma conta com este email.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), emailNorm, phone.trim(), passwordHash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: makeToken(user), ...publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const emailNorm = String(email || '').trim().toLowerCase();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailNorm);
  if (!user) return res.status(401).json({ message: 'Email ou password incorretos.' });

  const ok = await bcrypt.compare(password || '', user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Email ou password incorretos.' });

  res.json({ token: makeToken(user), ...publicUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ message: 'Utilizador não encontrado.' });
  res.json(publicUser(user));
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const emailNorm = String(req.body?.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(emailNorm);

  // Responde sempre da mesma forma, mesmo que o email não exista — evita
  // que alguém use isto para descobrir quais emails têm conta.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora
    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
      .run(token, expires, user.id);

    const resetLink = `${FRONTEND_URL}/reset-password.html?token=${token}`;
    await sendEmail(
      user.email,
      'Recuperação de password — Maria Bonita',
      `Olá ${user.name},\n\nRecebemos um pedido para repor a sua password.\n\n` +
      `Clique neste link para escolher uma password nova (válido durante 1 hora):\n${resetLink}\n\n` +
      `Se não foi você a pedir isto, ignore este email.\n\nMaria Bonita`
    );
  }

  res.json({ message: 'Se existir uma conta com este email, foi enviado um email de recuperação.' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || newPassword.length < 6)
    return res.status(400).json({ message: 'Pedido inválido.' });

  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user || !user.reset_token_expires || new Date(user.reset_token_expires) < new Date())
    return res.status(400).json({ message: 'Token inválido ou expirado. Peça uma nova recuperação de password.' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?')
    .run(passwordHash, user.id);

  res.json({ message: 'Password alterada com sucesso. Já pode entrar.' });
});

/* ---------------------------------------------------------------- */
/* MARCAÇÕES                                                         */
/* ---------------------------------------------------------------- */

const VALID_SERVICES = [
  'Cabelo', 'Unhas', 'Estética Facial', 'Sobrancelhas & Pestanas', 'Depilação', 'Noiva & Eventos'
];

app.post('/api/bookings', auth, (req, res) => {
  const { service, date, time, notes } = req.body || {};

  if (!VALID_SERVICES.includes(service))
    return res.status(400).json({ message: 'Serviço inválido.' });

  const todayStr = new Date().toISOString().slice(0, 10);
  if (!date || date < todayStr)
    return res.status(400).json({ message: 'Escolha uma data a partir de hoje.' });

  if (!time || time < '09:30' || time > '19:30')
    return res.status(400).json({ message: 'Escolha uma hora entre as 9h30 e as 19h30.' });

  // Toda a marcação nova nasce "pendente" — só fica confirmada quando a
  // Maria Bonita a aceitar na área dela.
  const info = db.prepare(
    'INSERT INTO bookings (user_id, service, date, time, notes, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.userId, service, date, time, notes || null, 'pendente');

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(booking);
});

app.get('/api/bookings', auth, (req, res) => {
  const bookings = db.prepare(
    'SELECT * FROM bookings WHERE user_id = ? ORDER BY date DESC, time DESC'
  ).all(req.userId);
  res.json(bookings);
});

app.post('/api/bookings/:id/cancel', auth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.userId);

  if (!booking) return res.status(404).json({ message: 'Marcação não encontrada.' });
  if (booking.status !== 'confirmada' && booking.status !== 'pendente')
    return res.status(400).json({ message: 'Esta marcação já não pode ser cancelada.' });

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelada', booking.id);
  res.json({ message: 'Marcação cancelada.' });
});

/* ---------------------------------------------------------------- */
/* ÁREA DA MARIA BONITA (administração)                              */
/* ---------------------------------------------------------------- */

// Lista todas as marcações de todos os clientes, com o nome/contacto de
// cada um, para a Maria Bonita gerir a agenda toda num único sítio.
app.get('/api/admin/bookings', auth, requireAdmin, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, u.name AS client_name, u.phone AS client_phone, u.email AS client_email
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    ORDER BY b.date ASC, b.time ASC
  `).all();
  res.json(bookings);
});

app.post('/api/admin/bookings/:id/accept', auth, requireAdmin, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Marcação não encontrada.' });

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('confirmada', booking.id);
  res.json({ message: 'Marcação aceite.' });
});

app.post('/api/admin/bookings/:id/cancel', auth, requireAdmin, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Marcação não encontrada.' });

  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelada', booking.id);
  res.json({ message: 'Marcação cancelada.' });
});

// Apagar remove mesmo a marcação da base de dados — desaparece por
// completo (diferente de cancelar, que fica visível no histórico).
app.delete('/api/admin/bookings/:id', auth, requireAdmin, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Marcação não encontrada.' });

  db.prepare('DELETE FROM bookings WHERE id = ?').run(booking.id);
  res.json({ message: 'Marcação apagada.' });
});

/* ---------------------------------------------------------------- */

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API da Maria Bonita a correr em http://localhost:${PORT}`));
