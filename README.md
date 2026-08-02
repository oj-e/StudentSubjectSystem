# StudentSubjectSystem
A role based Node.js/Express + MySql backend for a school subject-enrollment system. Student only see sessions for subjects they enroll in; teachers only create sesions for subjects they are approved to teach.
# Features 
- JWT authentication with three roles: student, teacher, admin
- Teacher accounts require admin approval before login
- Subject dropdown with two admin-gated pathways: propose a new subject not included in the dropdown or request to teach an existing one using autolinks on approval
- Student self-enrollment with duplicate protection at the database
- Session creation gaurded by a teacher and subject ownership check
- Enrollment filtered session 

# Tech Stack
- Node.js + Express
- My SQL (Phpadmin/Xamp)
- bcrypt, jsonwebtoken 

Setup
- Clone the repo and run npm install
- Create a MySQL database and import schema.sql
- Create .env file in the project root:
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=student_subject_system
JWT_SECRET=random_Secret
- Run node server.js - The API serves at http://localhost:5000/api

# Main Endpoints
- POST /api/auth/register, POST /api/auth/login
- GET /api/subjects — approved subjects 
- POST /api/subjects/:id/enroll, DELETE /api/subjects/:id/enroll, GET /api/subjects/mine (student)
- POST /api/subjects/propose, POST /api/subjects/:id/request (teacher)
- Admin: approve/reject teachers, proposed subjects, and teacher subject requests
- POST /api/sessions (teacher), GET /api/sessions/feed (student)