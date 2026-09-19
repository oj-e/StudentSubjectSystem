# StudentSubjectSystem (EduVerse AR)

A role-based Node.js/Express + MySQL system for a school subject-enrollment and session-management platform. Students only see sessions for subjects they enroll in; lecturers only create sessions for subjects they're approved to teach.

Backend is feature-complete against the core roadmap (auth, subjects, sessions, attendance, materials, AR model registration, admin). Frontend is in early development, currently covers login, registration, and post-registration subject selection; dashboards and remaining pages are still being built.

# Features
- JWT authentication with three roles: student, lecturer, admin
- Lecturer accounts require admin approval before login
- Subject dropdown with two admin-gated pathways: propose a new subject not included in the dropdown, or request to teach an existing one, both auto-link the lecturer on approval
- Student self-enrollment with duplicate protection at the database
- Session creation guarded by a lecturer-subject ownership check
- Enrollment-filtered session feed
- Session editing (partial update) and soft-cancel (cancelled sessions disappear from the student feed)
- Auto-generated Jitsi room name per session
- Attendance: auto-logged on join, lecturer view per session, student's own history
- Materials: upload/view per session (lecturer uploads, enrolled students view)
- AR Models: register a 3D model URL + interactive label data per session
- Admin: approve/reject lecturers, view all users, view all subjects, basic platform stats
- Basic frontend (plain HTML/CSS/JS): login, registration, and post-registration subject selection (students pick a subject to enroll in; lecturers request an existing subject or propose a new one)

# Tech Stack
- Node.js + Express
- MySQL (phpMyAdmin/XAMPP)
- bcrypt, jsonwebtoken, multer, cors

Setup
- Clone the repo and run npm install
- Create a MySQL database and import schema.sql
- Create a .env file in the project root:
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=student_subject_system
JWT_SECRET=random_secret

- Run node server.js — the API serves at http://localhost:5000/api
- Frontend pages are served as static files from /public — open public/login.html via a local server (e.g. VS Code Live Server) to use them

# Main Endpoints

**Auth**
- POST /api/auth/register, POST /api/auth/login

**Subjects**
- GET /api/subjects — approved subjects
- POST /api/subjects/:id/enroll, DELETE /api/subjects/:id/enroll, GET /api/subjects/mine (student)
- POST /api/subjects/propose, POST /api/subjects/:id/request (lecturer)
- GET /api/subjects/pending, PATCH /api/subjects/:id/approve, PATCH /api/subjects/:id/reject (admin)
- GET /api/subjects/requests/pending, PATCH /api/subjects/requests/:id/approve, PATCH /api/subjects/requests/:id/reject (admin)

**Sessions**
- POST /api/sessions (lecturer), GET /api/sessions/feed (student)
- PATCH /api/sessions/:id (edit), PATCH /api/sessions/:id/cancel (lecturer, owned sessions only)
- POST /api/sessions/:id/attend, GET /api/sessions/:id/attendance, GET /api/sessions/attendance/mine

**Materials**
- POST /api/materials/:sessionId/upload (lecturer), GET /api/materials/:sessionId (enrolled students)

**AR Models**
- POST /api/armodels/:sessionId (lecturer), GET /api/armodels/:sessionId (any logged-in user)

**Admin**
- GET /api/admin/lecturers/pending, PATCH /api/admin/lecturers/:id/approve, PATCH /api/admin/lecturers/:id/reject
- GET /api/admin/users, GET /api/admin/subjects, GET /api/admin/stats

# Not yet built
- Basic Quiz (create/take/auto-grade)
- Forgot Password
- Full student/lecturer dashboards (currently only login/register/subject-selection pages exist)