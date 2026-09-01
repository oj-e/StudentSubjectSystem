const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const router = express.Router();

// Multer config: save to public/uploads with a unique filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Lecturer uploads a material to a session they own
router.post('/:sessionId/upload', verifyToken, requireRole('lecturer'), upload.single('file'), async (req, res) => {
  try {
    const sessionId = req.params.sessionId;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const [sessionRows] = await db.query(
      'SELECT id, lecturer_id FROM sessions WHERE id = ?',
      [sessionId]
    );
    if (sessionRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (sessionRows[0].lecturer_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You do not teach this session' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileType = path.extname(req.file.originalname).replace('.', '');

    const [result] = await db.query(
      'INSERT INTO materials (session_id, file_url, file_type, original_name) VALUES (?, ?, ?, ?)',
      [sessionId, fileUrl, fileType, req.file.originalname]
    );

    res.status(201).json({
      success: true,
      message: 'Material uploaded',
      material_id: result.insertId,
      file_url: fileUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Student (enrolled) views materials for a session
router.get('/:sessionId', verifyToken, requireRole('student'), async (req, res) => {
  try {
    const sessionId = req.params.sessionId;

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

    const [rows] = await db.query(
      'SELECT id, file_url, file_type, original_name, uploaded_at FROM materials WHERE session_id = ? ORDER BY uploaded_at DESC',
      [sessionId]
    );

    res.json({ success: true, materials: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;