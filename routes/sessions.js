const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Teacher creates a session — only for a subject they actually teach
router.post('/', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const { subject_id, title, description, date, start_time, type } = req.body;
    if (!subject_id || !title || !type) {
      return res.status(400).json({ success: false, error: 'subject_id, title and type are required' });
    }
    if (!['live', 'material'].includes(type)) {
      return res.status(400).json({ success: false, error: 'type must be live or material' });
    }

    // The gatekeeper check: does this teacher teach this subject?
    const [teaches] = await db.query(
      'SELECT id FROM teachersubjects WHERE teacher_id = ? AND subject_id = ?',
      [req.user.id, subject_id]
    );
    if (teaches.length === 0) {
      return res.status(403).json({ success: false, error: 'You are not assigned to this subject' });
    }

    const [result] = await db.query(
      'INSERT INTO sessions (subject_id, teacher_id, title, description, date, start_time, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [subject_id, req.user.id, title, description || null, date || null, start_time || null, type]
    );

    res.status(201).json({ success: true, message: 'Session created', session_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student feed — ONLY sessions for subjects they're enrolled in
router.get('/feed', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sess.id, sess.title, sess.description, sess.date, sess.start_time, sess.type,
              sub.code AS subject_code, sub.title AS subject_title,
              u.name AS teacher_name
       FROM sessions sess
       JOIN subjects sub ON sess.subject_id = sub.id
       JOIN users u ON sess.teacher_id = u.id
       JOIN studentsubjects ss ON ss.subject_id = sess.subject_id
       WHERE ss.student_id = ?
       ORDER BY sess.date, sess.start_time`,
      [req.user.id]
    );
    res.json({ success: true, sessions: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;