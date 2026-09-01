const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Lecturer registers an AR model for a session they own
router.post('/:sessionId', verifyToken, requireRole('lecturer'), async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { model_url, label_data } = req.body || {};

    if (!model_url) {
      return res.status(400).json({ success: false, error: 'model_url is required' });
    }

    const [sessionRows] = await db.query(
      'SELECT id, lecturer_id FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (sessionRows[0].lecturer_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You do not own this session' });
    }

    const [result] = await db.query(
      'INSERT INTO ar_models (session_id, model_url, label_data) VALUES (?, ?, ?)',
      [sessionId, model_url, JSON.stringify(label_data || {})]
    );

    res.status(201).json({ success: true, message: 'AR model registered', ar_model_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Anyone logged in (student or lecturer) fetches the AR model for a session
router.get('/:sessionId', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, model_url, label_data, created_at FROM ar_models WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.params.sessionId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No AR model found for this session' });
    }
    res.json({ success: true, ar_model: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;