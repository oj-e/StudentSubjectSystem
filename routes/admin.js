const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

router.get('/lecturers/pending', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, lecturer_id, department, created_at FROM users WHERE role = 'lecturer' AND status = 'pending'"
    );
    res.json({ success: true, lecturers: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/lecturers/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE users SET status = 'approved' WHERE id = ? AND role = 'lecturer'", [req.params.id]);
    res.json({ success: true, message: 'Lecturer approved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/lecturers/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await db.query("UPDATE users SET status = 'rejected' WHERE id = ? AND role = 'lecturer'", [req.params.id]);
    res.json({ success: true, message: 'Lecturer rejected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: list all users
router.get('/users', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, status, department, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, users: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: list all subjects/courses with status
router.get('/subjects', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.code, s.title, s.department, s.status, u.name AS proposed_by_name
       FROM subjects s
       LEFT JOIN users u ON s.proposed_by = u.id
       ORDER BY s.id DESC`
    );
    res.json({ success: true, subjects: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: basic platform-wide stats
router.get('/stats', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [[{ total_users }]] = await db.query('SELECT COUNT(*) AS total_users FROM users');
    const [[{ total_students }]] = await db.query("SELECT COUNT(*) AS total_students FROM users WHERE role = 'student'");
    const [[{ total_lecturers }]] = await db.query("SELECT COUNT(*) AS total_lecturers FROM users WHERE role = 'lecturer' AND status = 'approved'");
    const [[{ total_subjects }]] = await db.query('SELECT COUNT(*) AS total_subjects FROM subjects');
    const [[{ total_sessions }]] = await db.query('SELECT COUNT(*) AS total_sessions FROM sessions');

    res.json({
      success: true,
      stats: { total_users, total_students, total_lecturers, total_subjects, total_sessions }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;