const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Public/student dropdown — only approved subjects
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, code, title, department FROM subjects WHERE status = 'approved'"
    );
    res.json({ success: true, subjects: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Admin rejects a proposed subject
router.patch('/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE subjects SET status = 'rejected' WHERE id = ? AND status = 'pending'",
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pending subject not found'
      });
    }

    res.json({
      success: true,
      message: 'Subject rejected'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Teacher proposes a new subject — goes in as pending
router.post('/propose', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const { code, title, department } = req.body;
    if (!code || !title) {
      return res.status(400).json({ success: false, error: 'Code and title are required' });
    }

    const [result] = await db.query(
      "INSERT INTO Subjects (code, title, department, status, proposed_by) VALUES (?, ?, ?, 'pending', ?)",
      [code, title, department || null, req.user.id]
    );

    res.status(201).json({
      success: true,
      message: 'Subject proposed — pending admin approval.',
      subject_id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: list pending subjects
router.get('/pending', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, u.name AS proposed_by_name 
       FROM subjects s 
       LEFT JOIN users u ON s.proposed_by = u.id 
       WHERE s.status = 'pending'`
    );
    res.json({ success: true, subjects: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: approve a proposed subject (also links the proposing teacher to it)
router.patch('/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [subjectRows] = await db.query('SELECT * FROM subjects WHERE id = ?', [id]);
    if (subjectRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    await db.query("UPDATE subjects SET status = 'approved' WHERE id = ?", [id]);

    const subject = subjectRows[0];
    if (subject.proposed_by) {
      await db.query(
        'INSERT IGNORE INTO teachersubjects (teacher_id, subject_id) VALUES (?, ?)',
        [subject.proposed_by, id]
      );
    }

    res.json({ success: true, message: 'Subject approved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; 