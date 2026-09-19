function showMessage(el, text, type) {
  el.textContent = text;
  el.className = `form-message ${type}`;
}

function setLoading(button, isLoading, defaultText) {
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Please wait...' : defaultText;
}

function redirectByRole(role) {
  if (role === 'student') window.location.href = 'student-dashboard.html';
  else if (role === 'lecturer') window.location.href = 'lecturer-dashboard.html';
  else if (role === 'admin') window.location.href = 'admin-dashboard.html';
}

async function doLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return res.json();
}

// LOGIN
const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('form-message');
    const submitBtn = document.getElementById('submit-btn');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setLoading(submitBtn, true, 'Log in');
    try {
      const data = await doLogin(email, password);
      if (!data.success) {
        showMessage(messageEl, data.error || 'Login failed', 'error');
        setLoading(submitBtn, false, 'Log in');
        return;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      redirectByRole(data.user.role);
    } catch (err) {
      showMessage(messageEl, 'Could not reach the server. Is it running?', 'error');
      setLoading(submitBtn, false, 'Log in');
    }
  });
}

// REGISTER
const registerForm = document.getElementById('register-form');
if (registerForm) {
  const roleSelect = document.getElementById('role');
  const lecturerIdField = document.getElementById('lecturer-id-field');
  const lecturerIdInput = document.getElementById('lecturer_id');

  roleSelect.addEventListener('change', () => {
    const isLecturer = roleSelect.value === 'lecturer';
    lecturerIdField.style.display = isLecturer ? 'block' : 'none';
    lecturerIdInput.required = isLecturer;
    if (!isLecturer) lecturerIdInput.value = '';
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('form-message');
    const submitBtn = document.getElementById('submit-btn');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const payload = {
      role: roleSelect.value,
      name: document.getElementById('name').value.trim(),
      email,
      password,
      lecturer_id: document.getElementById('lecturer_id').value.trim() || undefined
    };

    setLoading(submitBtn, true, 'Create account');
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        showMessage(messageEl, data.error || 'Registration failed', 'error');
        setLoading(submitBtn, false, 'Create account');
        return;
      }

      if (payload.role === 'student') {
        const loginData = await doLogin(email, password);
        if (loginData.success) {
          localStorage.setItem('token', loginData.token);
          localStorage.setItem('user', JSON.stringify(loginData.user));
          window.location.href = 'subject-select.html';
          return;
        }
      }

      showMessage(messageEl, data.message, 'success');
      registerForm.reset();
      lecturerIdField.style.display = 'none';
      lecturerIdInput.required = false;
      setLoading(submitBtn, false, 'Create account');
    } catch (err) {
      showMessage(messageEl, 'Could not reach the server. Is it running?', 'error');
      setLoading(submitBtn, false, 'Create account');
    }
  });
}

// Password toggle
document.querySelectorAll('.password-toggle').forEach(toggle => {
  toggle.addEventListener('click', function () {
    const input = document.getElementById(this.dataset.target);
    if (input.type === 'password') {
      input.type = 'text';
      this.textContent = 'Hide';
    } else {
      input.type = 'password';
      this.textContent = 'Show';
    }
  });
});