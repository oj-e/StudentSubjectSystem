const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { role, name, email, department, password, lecturer_id } = req.body;

    if (!role || !name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!['student', 'lecturer'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    if (role === 'lecturer' && !lecturer_id) {
      return res.status(400).json({ success: false, error: 'Lecturer ID is required for lecturer signup' });
    }

    const [existing] = await db.query(
    'SELECT id FROM users WHERE email = ?',
    [email]
);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const status = role === 'lecturer' ? 'pending' : 'approved';

    const [result] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, department, lecturer_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, password_hash, role, department || null, lecturer_id || null, status]
    );

    res.status(201).json({
      success: true,
      message: role === 'lecturer'
        ? 'Account created — pending admin approval before you can log in.'
        : 'Account created successfully.',
      user: { id: result.insertId, name, email, role, status }
    });

  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ success: false, error: err.message || err.toString() });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({ success: false, error: 'Account pending admin approval' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ success: false, error: 'Account was rejected by admin' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const crypto = require('crypto');

// Request a password reset — generates a token (shown on screen, no real email)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      // Don't reveal whether the email exists — generic response either way
      return res.json({ success: true, message: 'If that email exists, a reset link has been generated.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expires, rows[0].id]
    );

    // No real email service configured — the token is returned directly for demo purposes
    res.json({
      success: true,
      message: 'Reset link generated.',
      reset_token: token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Reset the password using a valid token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body || {};
    if (!token || !new_password) {
      return res.status(400).json({ success: false, error: 'Token and new password are required' });
    }

    const [rows] = await db.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = ?',
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }
    if (new Date(rows[0].reset_token_expires) < new Date()) {
      return res.status(400).json({ success: false, error: 'This reset link has expired' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      [password_hash, rows[0].id]
    );

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;