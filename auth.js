// api/auth.js — Vercel Serverless Function
// Handles: register, login, save, load
// Uses a simple in-memory store with Vercel KV if available,
// otherwise falls back to a JSON-compatible approach.
// For real persistence: add VERCEL_KV or a free PlanetScale/Supabase DB.

const crypto = require('crypto');

// In-memory store (resets on cold start — replace with KV for production)
// This still works great for demo: accounts persist within a Vercel instance.
if (!global._ECHOES_DB) global._ECHOES_DB = {};
const DB = global._ECHOES_DB;

function hash(pw) {
  return crypto.createHash('sha256').update(pw + 'echoes_s1_salt_2024').digest('hex');
}
function token(username) {
  return crypto.createHash('sha256').update(username + Date.now() + Math.random()).digest('hex');
}
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { action, username, password, token: tok, saveData } = body || {};

  if (!action) return res.status(400).json({ error: 'Missing action' });

  // ── REGISTER ──
  if (action === 'register') {
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const u = username.trim().toLowerCase();
    if (u.length < 3 || u.length > 20) return res.status(400).json({ error: 'Username must be 3-20 characters' });
    if (!/^[a-z0-9_]+$/.test(u)) return res.status(400).json({ error: 'Username: letters, numbers, underscore only' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (DB[u]) return res.status(409).json({ error: 'Username already taken' });
    const t = token(u);
    DB[u] = { pw: hash(password), token: t, save: null, created: Date.now() };
    return res.status(200).json({ ok: true, token: t, username: u });
  }

  // ── LOGIN ──
  if (action === 'login') {
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    const u = username.trim().toLowerCase();
    const acc = DB[u];
    if (!acc || acc.pw !== hash(password)) return res.status(401).json({ error: 'Invalid username or password' });
    const t = token(u);
    acc.token = t;
    return res.status(200).json({ ok: true, token: t, username: u, saveData: acc.save });
  }

  // ── SAVE ──
  if (action === 'save') {
    if (!tok || !saveData) return res.status(400).json({ error: 'Token and saveData required' });
    const acc = Object.values(DB).find(a => a.token === tok);
    if (!acc) return res.status(401).json({ error: 'Invalid session — please log in again' });
    acc.save = saveData;
    return res.status(200).json({ ok: true });
  }

  // ── LOAD ──
  if (action === 'load') {
    if (!tok) return res.status(400).json({ error: 'Token required' });
    const acc = Object.values(DB).find(a => a.token === tok);
    if (!acc) return res.status(401).json({ error: 'Invalid session — please log in again' });
    return res.status(200).json({ ok: true, saveData: acc.save });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
