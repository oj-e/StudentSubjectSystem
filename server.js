require('dotenv').config();
const materialRoutes = require('./routes/materials');
const express = require('express');
const db = require('./db');
const authRoutes = require('./routes/auth');
const subjectRoutes = require('./routes/subjects');
const adminRoutes = require('./routes/admin');
const arModelRoutes = require('./routes/armodels');
const cors = require('cors');
const quizRoutes = require('./routes/quizzes');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/armodels', arModelRoutes);
app.use('/api/sessions', require('./routes/sessions'));
app.use('/uploads', express.static('public/uploads'));
app.use('/api/materials', materialRoutes);
app.get('/', (req, res) => {
  res.send('API is running');
});

app.get('/test-db', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({ success: true, result: rows[0].result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});