/**
 * COMMITTEE LOGIN / AUTH
 * ---------------------------------------------------------------------
 * YLSMS has 6 permanent login accounts — one per committee position
 * (President, Vice President, Secretary, Assistant Secretary, Treasurer,
 * Media & PR Officer). The USERNAME always represents the position, not
 * the person, since office-holders change periodically; whoever holds a
 * position today just updates that account's display name/photo (My
 * Profile on the Settings page) instead of getting a brand new account.
 *
 * Anyone can browse the site read-only (members, attendance, fees,
 * birthdays, reports) without logging in. Adding, editing, deleting, or
 * marking anything requires logging in as one of the 6 committee
 * accounts. Logging in calls the backend's "login" action with a
 * username + password; on success the backend returns a random session
 * token (never the password) plus the account's display name/position/
 * photo. That token is kept in sessionStorage (cleared automatically
 * when the browser tab is closed) and sent along with every write
 * request; the backend re-checks it on every write.
 */

const AUTH_USER_KEY = 'ylsms_user';
let _cachedUsersPublic = null; // small cache so the login modal doesn't re-fetch every open

function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  try {
    sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch (e) { /* ignore */ }
}

function clearCurrentUser() {
  try {
    sessionStorage.removeItem(AUTH_USER_KEY);
  } catch (e) { /* ignore */ }
}

function getAdminToken() {
  const user = getCurrentUser();
  return user ? user.token || '' : '';
}

function isAdmin() {
  return !!getCurrentUser();
}

function isPresident() {
  const user = getCurrentUser();
  return !!user && user.position === 'President';
}

function getInitials(name) {
  if (!name) return 'G';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ? parts[0][0] : '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || 'G';
}

/** Throws on incorrect username/password. Resolves with nothing on success. */
async function loginAdmin(username, password) {
  const result = await Api.login(username, password);
  setCurrentUser(result);
}

async function logoutAdmin() {
  const token = getAdminToken();
  clearCurrentUser();
  if (token) {
    try { await Api.logout(token); } catch (e) { /* best effort */ }
  }
}

/**
 * Toggles every login-gated element on the current page to match the
 * current session, and fills in the logged-in user's name/position/photo
 * wherever it's referenced. Call this after the layout (navbar/sidebar)
 * has loaded, and again right after a successful login/logout.
 *
 * - ".admin-only"      → hidden unless someone is logged in
 * - ".guest-only"       → hidden once someone is logged in
 * - ".admin-editable"   → disabled unless someone is logged in
 * - ".president-only"   → hidden unless the logged-in account is President
 */
function applyAuthUI() {
  const user = getCurrentUser();
  const admin = !!user;
  const president = admin && user.position === 'President';

  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('d-none', !admin));
  document.querySelectorAll('.guest-only').forEach(el => el.classList.toggle('d-none', admin));
  document.querySelectorAll('.admin-editable').forEach(el => { el.disabled = !admin; });
  document.querySelectorAll('.president-only').forEach(el => el.classList.toggle('d-none', !president));

  document.querySelectorAll('.js-auth-name').forEach(el => { el.textContent = admin ? user.displayName : 'Guest'; });
  document.querySelectorAll('.js-auth-role').forEach(el => { el.textContent = admin ? user.position : 'View-only access'; });
  document.querySelectorAll('.js-auth-avatar').forEach(el => {
    if (admin && user.photoUrl) {
      el.innerHTML = `<img src="${user.photoUrl}" alt="${getInitials(user.displayName)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
      el.innerHTML = '';
      el.textContent = admin ? getInitials(user.displayName) : 'G';
    }
  });
  document.querySelectorAll('.js-auth-login-btn').forEach(el => { el.classList.toggle('d-none', admin); });
  document.querySelectorAll('.js-auth-logout-btn').forEach(el => { el.classList.toggle('d-none', !admin); });
}

/**
 * Wires up every "Log In" trigger and the shared login modal that
 * components/navbar.html injects on every page, including populating the
 * "who are you?" picker from the public user list. Also wires logout
 * buttons. Safe to call multiple times.
 */
function wireAuthUI() {
  const modalEl = document.getElementById('adminLoginModal');
  const form = document.getElementById('adminLoginForm');
  const userSelect = document.getElementById('adminLoginUser');
  const passwordInput = document.getElementById('adminLoginPassword');
  const alertBox = document.getElementById('adminLoginAlert');

  document.querySelectorAll('.js-auth-login-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!modalEl) return;
      if (alertBox) alertBox.innerHTML = '';
      if (passwordInput) passwordInput.value = '';
      const demoHint = document.getElementById('adminLoginDemoHint');
      if (demoHint) demoHint.classList.toggle('d-none', !CONFIG.DEMO_MODE);

      if (userSelect) {
        userSelect.disabled = true;
        userSelect.innerHTML = '<option>Loading…</option>';
        try {
          if (!_cachedUsersPublic) _cachedUsersPublic = await Api.getUsersPublic();
          userSelect.innerHTML = _cachedUsersPublic
            .map(u => `<option value="${u.username}">${escapeHtml(u.displayName)} — ${escapeHtml(u.position)}</option>`)
            .join('');
        } catch (err) {
          userSelect.innerHTML = '<option value="">Could not load users</option>';
        } finally {
          userSelect.disabled = false;
        }
      }
      new bootstrap.Modal(modalEl).show();
    });
  });

  document.querySelectorAll('.js-auth-logout-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await logoutAdmin();
      applyAuthUI();
      showToast('Logged out. You are now in view-only mode.', 'info');
      window.dispatchEvent(new Event('ylsms:authchanged'));
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('adminLoginSubmit');
      setButtonLoading(btn, true, 'Checking…');
      try {
        await loginAdmin(userSelect.value, passwordInput.value);
        bootstrap.Modal.getInstance(modalEl).hide();
        applyAuthUI();
        showToast('Logged in as ' + getCurrentUser().displayName + '.', 'success');
        window.dispatchEvent(new Event('ylsms:authchanged'));
      } catch (err) {
        if (alertBox) {
          alertBox.innerHTML = `<div class="alert alert-danger alert-dismissible fade show" role="alert">${escapeHtml(err.message)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
        }
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }
}
