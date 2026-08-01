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

// Student's own enrolled subjects
router.get('/mine', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.id, s.code, s.title, s.department
       FROM studentsubjects ss
       JOIN subjects s ON ss.subject_id = s.id
       WHERE ss.student_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, subjects: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student enrolls in an approved subject
router.post('/:id/enroll', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const [subjectRows] = await db.query(
      "SELECT id FROM subjects WHERE id = ? AND status = 'approved'",
      [req.params.id]
    );
    if (subjectRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subject not found or not approved' });
    }

    await db.query(
      'INSERT INTO studentsubjects (student_id, subject_id) VALUES (?, ?)',
      [req.user.id, req.params.id]
    );

    res.status(201).json({ success: true, message: 'Enrolled successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Already enrolled in this subject' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student drops a subject
router.delete('/:id/enroll', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM studentsubjects WHERE student_id = ? AND subject_id = ?',
      [req.user.id, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'You are not enrolled in this subject' });
    }
    res.json({ success: true, message: 'Subject dropped' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Teacher requests to teach an EXISTING approved subject
router.post('/:id/request', verifyToken, requireRole('teacher'), async (req, res) => {
  try {
    const subjectId = req.params.id;

    const [subjectRows] = await db.query(
      "SELECT id FROM subjects WHERE id = ? AND status = 'approved'",
      [subjectId]
    );
    if (subjectRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Subject not found or not approved' });
    }

    const [already] = await db.query(
      'SELECT id FROM teachersubjects WHERE teacher_id = ? AND subject_id = ?',
      [req.user.id, subjectId]
    );
    if (already.length > 0) {
      return res.status(409).json({ success: false, error: 'You already teach this subject' });
    }

    const [pending] = await db.query(
      "SELECT id FROM teachersubjectrequests WHERE teacher_id = ? AND subject_id = ? AND status = 'pending'",
      [req.user.id, subjectId]
    );
    if (pending.length > 0) {
      return res.status(409).json({ success: false, error: 'You already have a pending request for this subject' });
    }

    await db.query(
      'INSERT INTO teachersubjectrequests (teacher_id, subject_id) VALUES (?, ?)',
      [req.user.id, subjectId]
    );

    res.status(201).json({ success: true, message: 'Request sent — pending admin approval.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: list pending teacher-subject requests
router.get('/requests/pending', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.id, r.status, r.created_at,
              u.name AS teacher_name, u.email AS teacher_email,
              s.code AS subject_code, s.title AS subject_title
       FROM teachersubjectrequests r
       JOIN users u ON r.teacher_id = u.id
       JOIN subjects s ON r.subject_id = s.id
       WHERE r.status = 'pending'`
    );
    res.json({ success: true, requests: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: approve a teacher-subject request → creates the real link
router.patch('/requests/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [reqRows] = await db.query(
      "SELECT * FROM teachersubjectrequests WHERE id = ? AND status = 'pending'",
      [req.params.id]
    );
    if (reqRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pending request not found' });
    }

    const request = reqRows[0];
    await db.query("UPDATE teachersubjectrequests SET status = 'approved' WHERE id = ?", [request.id]);
    await db.query(
      'INSERT IGNORE INTO teachersubjects (teacher_id, subject_id) VALUES (?, ?)',
      [request.teacher_id, request.subject_id]
    );

    res.json({ success: true, message: 'Request approved — teacher linked to subject' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: reject a teacher-subject request
router.patch('/requests/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const [result] = await db.query(
      "UPDATE teachersubjectrequests SET status = 'rejected' WHERE id = ? AND status = 'pending'",
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Pending request not found' });
    }
    res.json({ success: true, message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

console.log('>>> subjects.js WITH request routes LOADED');