const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Lecturer creates a quiz question for a session they own
router.post('/:sessionId', verifyToken, requireRole('lecturer'), async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { question, options, correct_answer } = req.body || {};

    if (!question || !options || !correct_answer) {
      return res.status(400).json({ success: false, error: 'question, options, and correct_answer are required' });
    }
    if (!Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, error: 'options must be an array with at least 2 choices' });
    }

    const [sessionRows] = await db.query('SELECT id, lecturer_id FROM sessions WHERE id = ?', [sessionId]);
    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (sessionRows[0].lecturer_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You do not own this session' });
    }

    const [result] = await db.query(
      'INSERT INTO quizzes (session_id, question, options, correct_answer) VALUES (?, ?, ?, ?)',
      [sessionId, question, JSON.stringify(options), correct_answer]
    );

    res.status(201).json({ success: true, message: 'Question added', quiz_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Any logged-in user fetches a session's quiz questions (correct_answer hidden from students)
router.get('/:sessionId', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, question, options FROM quizzes WHERE session_id = ?',
      [req.params.sessionId]
    );
    const questions = rows.map(q => ({ ...q, options: JSON.parse(q.options) }));
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student submits answers for a session's quiz — auto-graded
router.post('/:sessionId/submit', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { answers } = req.body || {}; // { quizId: "chosen answer", ... }

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, error: 'answers object is required' });
    }

    const [questions] = await db.query('SELECT id, correct_answer FROM quizzes WHERE session_id = ?', [sessionId]);
    if (questions.length === 0) {
      return res.status(404).json({ success: false, error: 'No quiz found for this session' });
    }

    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct_answer) score++;
    });

    // Need a quiz_id to satisfy the schema — use the first question's id as the representative quiz_id
    const quizId = questions[0].id;

    await db.query(
      'INSERT INTO quiz_results (quiz_id, student_id, session_id, score, total) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE score = VALUES(score), total = VALUES(total)',
      [quizId, req.user.id, sessionId, score, questions.length]
    );

    res.json({ success: true, score, total: questions.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lecturer views quiz results for a session they own
router.get('/:sessionId/results', verifyToken, requireRole('lecturer'), async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const [sessionRows] = await db.query('SELECT lecturer_id FROM sessions WHERE id = ?', [sessionId]);
    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (sessionRows[0].lecturer_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You do not own this session' });
    }

    const [rows] = await db.query(
      `SELECT u.name, u.email, qr.score, qr.total, qr.submitted_at
       FROM quiz_results qr
       JOIN users u ON qr.student_id = u.id
       WHERE qr.session_id = ?
       ORDER BY qr.submitted_at DESC`,
      [sessionId]
    );

    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;