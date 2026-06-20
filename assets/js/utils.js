/**
 * UTILITY HELPERS
 * Shared across every page: toasts, validation, date/age math, debounce,
 * and small DOM helpers.
 */

// ---------------------------------------------------------------------------
// TOASTS / ALERTS
// ---------------------------------------------------------------------------

function ensureToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1080';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Shows a Bootstrap toast.
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} type
 */
function showToast(message, type = 'success') {
  const container = ensureToastContainer();
  const id = 'toast-' + Date.now();
  const icon = {
    success: 'bi-check-circle-fill',
    danger: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  }[type] || 'bi-info-circle-fill';

  const toastEl = document.createElement('div');
  toastEl.id = id;
  toastEl.className = `toast align-items-center text-bg-${type === 'info' ? 'dark' : type} border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body"><i class="bi ${icon} me-2"></i>${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

/**
 * Renders a dismissible Bootstrap alert into a given container element.
 */
function showAlert(containerEl, message, type = 'danger') {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(message)}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
}

function clearAlert(containerEl) {
  if (containerEl) containerEl.innerHTML = '';
}

// ---------------------------------------------------------------------------
// VALIDATION
// ---------------------------------------------------------------------------

function isValidEmail(email) {
  if (!email) return true; // email is optional in the form
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone) {
  if (!phone) return false;
  const digits = String(phone).replace(/[^\d]/g, '');
  // Generic sanity check across countries: most national numbers are
  // 7-12 digits once the country code is removed.
  return digits.length >= 7 && digits.length <= 12;
}

/**
 * Combines a country calling code (e.g. "+94") with a locally-entered
 * number, stripping a leading 0 and any non-digit characters, into a
 * single E.164-style string (e.g. "+94771234567").
 */
function formatPhoneInput(countryCode, value) {
  let digits = String(value || '').replace(/[^\d]/g, '');
  if (digits.indexOf('0') === 0) digits = digits.substring(1);
  const code = countryCode || '+94';
  return digits ? code + digits : '';
}

function setFieldError(inputEl, message) {
  inputEl.classList.add('is-invalid');
  let feedback = inputEl.parentElement.querySelector('.invalid-feedback');
  if (!feedback) {
    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    inputEl.parentElement.appendChild(feedback);
  }
  feedback.textContent = message;
}

function clearFieldError(inputEl) {
  inputEl.classList.remove('is-invalid');
}

// ---------------------------------------------------------------------------
// DATE / AGE / BIRTHDAY MATH
// ---------------------------------------------------------------------------

function calculateAge(birthdayStr) {
  if (!birthdayStr) return null;
  const birth = new Date(birthdayStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Days until the next occurrence of this birthday (0 = today). */
function daysUntilBirthday(birthdayStr) {
  if (!birthdayStr) return null;
  const birth = new Date(birthdayStr);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  next.setHours(0, 0, 0, 0);
  if (next < today) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return Math.round((next - today) / (1000 * 60 * 60 * 24));
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MONTHS_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthShortName(index) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index];
}

// ---------------------------------------------------------------------------
// GENERAL HELPERS
// ---------------------------------------------------------------------------

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(null, args), delay);
  };
}

function initialsOf(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function setButtonLoading(btn, isLoading, loadingText = 'Saving…') {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${loadingText}`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) btn.innerHTML = btn.dataset.originalText;
  }
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function arrayToCsv(rows) {
  return rows
    .map(row => row.map(cell => {
      const val = cell === null || cell === undefined ? '' : String(cell);
      if (/[",\n]/.test(val)) return '"' + val.replace(/"/g, '""') + '"';
      return val;
    }).join(','))
    .join('\n');
}
