import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { crackHash } from './cracker.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 4000;

// In-memory store for demo
// keyed by email: { name, passwordHash, createdAt, otp: {code, expires} }
const users = {};
// simple session map keyed by email -> { expires }
const sessions = {};

app.get('/', (req, res) => res.json({ ok: true, msg: 'Email-OTP demo server' }));

// Register: name + email + password
app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
  const key = email.toLowerCase();
  if (users[key]) return res.status(400).json({ error: 'email already registered' });
  const passwordHash = await bcrypt.hash(password, 10);
  // create a fast demo hash (sha256) for cracking simulation to run quickly
  const fastSalt = crypto.randomBytes(8).toString('hex');
  const fastHash = crypto.createHash('sha256').update(fastSalt + password).digest('hex');
  users[key] = { name, email: key, passwordHash, fastSalt, fastHash, createdAt: Date.now() };
  return res.json({ ok: true, email: key });
});

// Request login OTP (passwordless or second step) — sends OTP to registered email
app.post('/api/request-login-otp', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const key = email.toLowerCase();
  const u = users[key];
  if (!u) return res.status(400).json({ error: 'user not found' });

  // create 6 digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  u.otp = { code, expires };

  // send email using transporter (created during init)
  try {
    const info = await transporter.sendMail({
      from: 'Demo App <no-reply@example.com>',
      to: u.email,
      subject: 'Your login OTP (demo)',
      text: `Your one-time login code is: ${code}\nIt will expire in 5 minutes.`
    });
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    return res.json({ ok: true, previewUrl, message: 'OTP sent (preview url available for dev)' });
  } catch (err) {
    console.error('email send error', err);
    return res.status(500).json({ error: 'failed to send email (check server logs)' });
  }
});

// Verify login OTP
app.post('/api/verify-login-otp', (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'email and code required' });
  const key = email.toLowerCase();
  const u = users[key];
  if (!u || !u.otp) return res.status(400).json({ error: 'no pending OTP for that email' });
  if (Date.now() > u.otp.expires) return res.status(401).json({ error: 'otp expired' });
  if (u.otp.code !== String(code)) return res.status(401).json({ error: 'invalid otp' });

  // create a simple session
  sessions[key] = { expires: Date.now() + 30 * 60 * 1000 }; // 30 minutes
  delete u.otp;
  return res.json({ ok: true, message: 'login verified' });
});

// Simulate cracking — only allowed if session is active for that email
app.post('/api/simulate-crack', async (req, res) => {
  const { email, useFast } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });
  const key = email.toLowerCase();
  const session = sessions[key];
  if (!session || Date.now() > session.expires) return res.status(401).json({ error: 'not authenticated or session expired' });
  const u = users[key];
  if (!u) return res.status(400).json({ error: 'user not found' });

  if (useFast) {
    // target the fast sha256 hash (very fast for demo)
    const result = await crackHash(u.fastHash, { useFast: true, fastSalt: u.fastSalt, maxBruteLen: 4, maxAttempts: 200000 });
    return res.json({ ok: true, email: key, mode: 'fast', result });
  }

  // default: try against bcrypt (slow)
  const result = await crackHash(u.passwordHash, { maxBruteLen: 4, maxAttempts: 200000 });
  return res.json({ ok: true, email: key, mode: 'bcrypt', result });
});

app.get('/api/users', (req, res) => res.json(Object.keys(users)));

// nodemailer transporter will be initialized here
let transporter = null;

async function init() {
  // create ethereal test account for dev email preview
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });

  console.log('Nodemailer test account created. Emails will be available via preview URL returned by /api/request-login-otp responses.');

  app.listen(PORT, () => {
    console.log(`Email-OTP demo server running on http://localhost:${PORT}`);
  });
}

init().catch(err => {
  console.error('Failed to start server', err);
  process.exit(1);
});
