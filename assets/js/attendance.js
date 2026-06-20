/**
 * ATTENDANCE PAGE LOGIC
 */

let attendanceRows = [];

document.addEventListener('DOMContentLoaded', initAttendancePage);

async function initAttendancePage() {
  document.getElementById('pageTitle').textContent = 'Attendance';
  document.getElementById('attendanceYearPill').textContent = new Date().getFullYear();

  document.getElementById('attendanceSearch').addEventListener('input', debounce(renderAttendanceTable, 200));
  document.getElementById('btnExportAttendance').addEventListener('click', exportAttendanceCsv);

  await loadAttendance();
}

window.addEventListener('ylsms:authchanged', () => {
  if (document.getElementById('attendanceBody')) renderAttendanceTable();
});

async function loadAttendance() {
  try {
    attendanceRows = await Api.fetchAttendance();
    renderAttendanceTable();
  } catch (err) {
    showAlert(document.getElementById('attendanceAlert'), 'Could not load attendance: ' + err.message);
  }
}

function isPresent(val) {
  return val === true || val === 'true' || val === 'TRUE';
}

function renderAttendanceTable() {
  const body = document.getElementById('attendanceBody');
  const empty = document.getElementById('attendanceEmpty');
  const q = document.getElementById('attendanceSearch').value.trim().toLowerCase();

  const rows = attendanceRows.filter(r =>
    !q || String(r.ID).toLowerCase().includes(q) || String(r.Name).toLowerCase().includes(q)
  );

  if (!rows.length) {
    body.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  body.innerHTML = rows.map(r => {
    const presentCount = MONTHS_FULL.filter(m => isPresent(r[m])).length;
    const rate = Math.round((presentCount / 12) * 100);
    const monthCells = MONTHS_FULL.map(m => `
      <td class="text-center">
        <input type="checkbox" class="attendance-checkbox" ${isPresent(r[m]) ? 'checked' : ''} ${isAdmin() ? '' : 'disabled'}
          onchange="toggleAttendance('${escapeHtml(r.ID)}', '${m}', this.checked, this)">
      </td>`).join('');

    return `
      <tr>
        <td class="cell-sticky" style="left:0;"><span class="pill pill-maroon">${escapeHtml(r.ID)}</span></td>
        <td class="cell-sticky fw-semibold" style="left:140px;">${escapeHtml(r.Name)}</td>
        ${monthCells}
        <td class="text-center"><span class="pill ${rate >= 75 ? 'pill-paid' : rate >= 40 ? 'pill-gold' : 'pill-pending'}">${rate}%</span></td>
      </tr>`;
  }).join('');
}

async function toggleAttendance(id, month, checked, checkboxEl) {
  if (!isAdmin()) {
    checkboxEl.checked = !checked;
    showToast('Please log in as Admin to mark attendance.', 'warning');
    return;
  }
  const statusEl = document.getElementById('attendanceSaveStatus');
  checkboxEl.disabled = true;
  try {
    await Api.saveAttendance(id, month, checked);
    const row = attendanceRows.find(r => r.ID === id);
    if (row) row[month] = checked;
    statusEl.innerHTML = '<i class="bi bi-check-circle-fill"></i> Saved';
    setTimeout(() => { statusEl.innerHTML = ''; }, 1500);
    // refresh just the rate badge for this row without a full re-render
    renderAttendanceTable();
  } catch (err) {
    checkboxEl.checked = !checked;
    showToast('Could not save attendance: ' + err.message, 'danger');
  } finally {
    checkboxEl.disabled = false;
  }
}

function exportAttendanceCsv() {
  const header = ['ID', 'Name', ...MONTHS_FULL, 'Rate %'];
  const rows = attendanceRows.map(r => {
    const presentCount = MONTHS_FULL.filter(m => isPresent(r[m])).length;
    return [r.ID, r.Name, ...MONTHS_FULL.map(m => isPresent(r[m]) ? 'Present' : 'Absent'), Math.round((presentCount / 12) * 100)];
  });
  const csv = arrayToCsv([header, ...rows]);
  downloadBlob(csv, `attendance-${new Date().getFullYear()}.csv`, 'text/csv');
  showToast('Attendance report exported.', 'success');
}
