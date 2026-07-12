const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/teachers/pending', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, teacher_id, department, created_at FROM Users WHERE role = 'teacher' AND status = 'pending'"
    );
    res.json({ success: true, teachers: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/teachers/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE Users SET status = 'approved' WHERE id = ? AND role = 'teacher'", [req.params.id]);
    res.json({ success: true, message: 'Teacher approved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/teachers/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE Users SET status = 'rejected' WHERE id = ? AND role = 'teacher'", [req.params.id]);
    res.json({ success: true, message: 'Teacher rejected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;