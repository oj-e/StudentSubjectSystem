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

module.exports = router;