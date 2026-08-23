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

// Student's own attendance history across all sessions
// NOTE: must come before /:id/attendance so Express doesn't treat "attendance" as an :id
router.get('/attendance/mine', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id AS session_id, s.title, sub.code AS subject_code, sub.title AS subject_title, sp.joined_at
       FROM sessionparticipants sp
       JOIN sessions s ON sp.session_id = s.id
       JOIN subjects sub ON s.subject_id = sub.id
       WHERE sp.student_id = ?
       ORDER BY sp.joined_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, attendance: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student joins a session — attendance auto-recorded
router.post('/:id/attend', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const sessionId = req.params.id;

    const [sessionRows] = await db.query(
      'SELECT id, subject_id FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const subjectId = sessionRows[0].subject_id;
    const [enrolled] = await db.query(
      'SELECT id FROM studentsubjects WHERE student_id = ? AND subject_id = ?',
      [req.user.id, subjectId]
    );
    if (enrolled.length === 0) {
      return res.status(403).json({ success: false, error: 'You are not enrolled in this subject' });
    }

    await db.query(
      'INSERT INTO sessionparticipants (session_id, student_id) VALUES (?, ?)',
      [sessionId, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Attendance recorded' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(200).json({ success: true, message: 'Already marked present' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Teacher views attendance for a session they teach
router.get('/:id/attendance', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const sessionId = req.params.id;

    const [sessionRows] = await db.query(
      'SELECT id, teacher_id, title FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (sessionRows[0].teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You do not teach this session' });
    }

    const [rows] = await db.query(
      `SELECT u.id AS student_id, u.name, u.email, sp.joined_at
       FROM sessionparticipants sp
       JOIN users u ON sp.student_id = u.id
       WHERE sp.session_id = ?
       ORDER BY sp.joined_at ASC`,
      [sessionId]
    );

    res.json({ success: true, session_title: sessionRows[0].title, attendance: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



module.exports = router;