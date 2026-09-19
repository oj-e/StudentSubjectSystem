const API_BASE = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

async function authFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
    ...(options.headers || {})
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res.json();
}
function requireRole(role) {
  const user = getUser();
  if (!getToken() || !user || user.role !== role) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

function showToast(message, type = '') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <p>${message}</p>
        <div class="modal-actions">
          <button class="confirm-no">Cancel</button>
          <button class="confirm-yes">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
    overlay.querySelector('.confirm-no').onclick = () => { overlay.remove(); resolve(false); };
  });
}