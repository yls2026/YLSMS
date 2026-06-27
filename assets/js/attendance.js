/**
 * ATTENDANCE PAGE LOGIC
 */

let attendanceRows = [];
let attendanceAvailableYears = [];
let attendanceViewYear = new Date().getFullYear();

onLayoutReady(initAttendancePage);

async function initAttendancePage() {
  document.getElementById('pageTitle').textContent = 'Attendance';

  document.getElementById('attendanceSearch').addEventListener('input', debounce(renderAttendanceTable, 200));
  document.getElementById('btnExportAttendance').addEventListener('click', exportAttendanceCsv);
  document.getElementById('attendanceYearPrev').addEventListener('click', () => stepAttendanceYear(-1));
  document.getElementById('attendanceYearNext').addEventListener('click', () => stepAttendanceYear(1));

  try {
    attendanceAvailableYears = await Api.listArchivedYears();
  } catch (err) {
    attendanceAvailableYears = [attendanceViewYear];
  }
  if (!attendanceAvailableYears.includes(attendanceViewYear)) attendanceAvailableYears.push(attendanceViewYear);

  updateAttendanceYearControls();
  await loadAttendance();
}

window.addEventListener('ylsms:authchanged', () => {
  if (document.getElementById('attendanceBody')) renderAttendanceTable();
});

function isLiveAttendanceYear() {
  return attendanceViewYear === new Date().getFullYear();
}

function updateAttendanceYearControls() {
  document.getElementById('attendanceYearPill').textContent = attendanceViewYear;
  const idx = attendanceAvailableYears.indexOf(attendanceViewYear);
  document.getElementById('attendanceYearPrev').disabled = idx <= 0;
  document.getElementById('attendanceYearNext').disabled = idx === -1 || idx >= attendanceAvailableYears.length - 1;
  document.getElementById('attendanceArchiveBanner').classList.toggle('d-none', isLiveAttendanceYear());
}

async function stepAttendanceYear(direction) {
  const idx = attendanceAvailableYears.indexOf(attendanceViewYear);
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= attendanceAvailableYears.length) return;
  attendanceViewYear = attendanceAvailableYears[nextIdx];
  updateAttendanceYearControls();
  await loadAttendance();
}

async function loadAttendance() {
  try {
    attendanceRows = isLiveAttendanceYear()
      ? await Api.fetchAttendance()
      : await Api.fetchAttendance(attendanceViewYear);
    renderAttendanceTable();
  } catch (err) {
    showAlert(document.getElementById('attendanceAlert'), 'Could not load attendance: ' + err.message);
  }
}

/**
 * An Attendance cell has 3 possible states:
 * - "Present" → explicitly marked present (✅ green)
 * - "Absent"  → explicitly marked absent (❎ red)
 * - ""/blank  → no value yet (white "Empty" — also forced for any month
 *               that hasn't happened yet, for the live year)
 * Accepts legacy boolean TRUE/FALSE values from older sheet rows too.
 * (attendanceStatus/attendanceStatusClass live in utils.js — shared with
 * dashboard.js and reports.js.)
 */

/** Index (0 = Jan … 11 = Dec) of the last "real" month for the year being viewed. */
function lastElapsedMonthIndex() {
  return isLiveAttendanceYear() ? new Date().getMonth() : 11; // archived years are fully in the past
}

function renderAttendanceTable() {
  const body = document.getElementById('attendanceBody');
  const empty = document.getElementById('attendanceEmpty');
  const footer = document.getElementById('attendanceFooter');
  const q = document.getElementById('attendanceSearch').value.trim().toLowerCase();
  const curMonth = lastElapsedMonthIndex();
  const editable = isAdmin() && isLiveAttendanceYear();

  const rows = attendanceRows.filter(r =>
    !q || String(r.ID).toLowerCase().includes(q) || String(r.Name).toLowerCase().includes(q)
  );

  if (!rows.length) {
    body.innerHTML = '';
    if (footer) footer.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  body.innerHTML = rows.map(r => {
    const elapsedMonths = MONTHS_FULL.slice(0, curMonth + 1);
    const presentCount = elapsedMonths.filter(m => attendanceStatus(r[m]) === 'Present').length;
    const rate = elapsedMonths.length ? Math.round((presentCount / elapsedMonths.length) * 100) : 0;

    const monthCells = MONTHS_FULL.map((m, idx) => {
      if (idx > curMonth) {
        // Upcoming month (only possible on the live year) — always blank and locked.
        return `<td class="text-center attendance-future-cell" title="Upcoming month">—</td>`;
      }
      const status = attendanceStatus(r[m]);
      return `
        <td class="text-center">
          <select class="attendance-select ${attendanceStatusClass(status)}" data-prev="${status === 'Empty' ? '' : status}" ${editable ? '' : 'disabled'}
            onchange="toggleAttendance('${escapeHtml(r.ID)}', '${m}', this.value, this)">
            <option value="Present" ${status === 'Present' ? 'selected' : ''}>✅ Present</option>
            <option value="Absent" ${status === 'Absent' ? 'selected' : ''}>❎ Absent</option>
            <option value="" ${status === 'Empty' ? 'selected' : ''}>Empty</option>
          </select>
        </td>`;
    }).join('');

    return `
      <tr>
        <td class="cell-sticky" style="left:0;"><span class="pill pill-maroon">${escapeHtml(r.ID)}</span></td>
        <td class="cell-sticky fw-semibold" style="left:140px;">${escapeHtml(r.Name)}</td>
        ${monthCells}
        <td class="text-center"><span class="pill ${rate >= 75 ? 'pill-paid' : rate >= 40 ? 'pill-gold' : 'pill-pending'}">${rate}%</span></td>
      </tr>`;
  }).join('');

  renderAttendanceFooter(rows, curMonth);
}

/**
 * Month-end summary footer: for every month that has already happened,
 * shows how many of the (currently filtered) members were marked Present
 * and what percentage of the group that is. Upcoming months (live year
 * only) show "—".
 */
function renderAttendanceFooter(rows, curMonth) {
  const footer = document.getElementById('attendanceFooter');
  if (!footer) return;

  const totalCells = MONTHS_FULL.map((m, idx) => {
    if (idx > curMonth) return `<td class="text-center attendance-future-cell">—</td>`;
    const count = rows.filter(r => attendanceStatus(r[m]) === 'Present').length;
    return `<td class="text-center">${count} / ${rows.length}</td>`;
  }).join('');

  const percentCells = MONTHS_FULL.map((m, idx) => {
    if (idx > curMonth) return `<td class="text-center attendance-future-cell">—</td>`;
    const count = rows.filter(r => attendanceStatus(r[m]) === 'Present').length;
    const pct = rows.length ? Math.round((count / rows.length) * 100) : 0;
    return `<td class="text-center">${pct}%</td>`;
  }).join('');

  footer.innerHTML = `
    <tr class="attendance-footer-row">
      <td class="cell-sticky attendance-footer-label" colspan="2" style="left:0;">Total Present</td>
      ${totalCells}
      <td></td>
    </tr>
    <tr class="attendance-footer-row">
      <td class="cell-sticky attendance-footer-label" colspan="2" style="left:0;">Attendance %</td>
      ${percentCells}
      <td></td>
    </tr>`;
}

async function toggleAttendance(id, month, value, selectEl) {
  const previousValue = selectEl.dataset.prev || '';
  if (!isAdmin() || !isLiveAttendanceYear()) {
    selectEl.value = previousValue;
    showToast(isLiveAttendanceYear() ? 'Please log in to mark attendance.' : 'Archived years are read-only.', 'warning');
    return;
  }
  const statusEl = document.getElementById('attendanceSaveStatus');
  selectEl.disabled = true;
  selectEl.classList.remove('is-present', 'is-absent', 'is-empty');
  try {
    await Api.saveAttendance(id, month, value);
    const row = attendanceRows.find(r => r.ID === id);
    if (row) row[month] = value;
    selectEl.dataset.prev = value;
    selectEl.classList.add(attendanceStatusClass(attendanceStatus(value)));
    statusEl.innerHTML = '<i class="bi bi-check-circle-fill"></i> Saved';
    setTimeout(() => { statusEl.innerHTML = ''; }, 1500);
    // re-render so the Rate column and month-end totals reflect the change
    renderAttendanceTable();
  } catch (err) {
    selectEl.value = previousValue;
    selectEl.classList.add(attendanceStatusClass(attendanceStatus(previousValue)));
    showToast('Could not save attendance: ' + err.message, 'danger');
  } finally {
    selectEl.disabled = false;
  }
}

function exportAttendanceCsv() {
  const curMonth = lastElapsedMonthIndex();
  const elapsedMonths = MONTHS_FULL.slice(0, curMonth + 1);
  const header = ['ID', 'Name', ...MONTHS_FULL, 'Rate %'];
  const rows = attendanceRows.map(r => {
    const presentCount = elapsedMonths.filter(m => attendanceStatus(r[m]) === 'Present').length;
    const rate = elapsedMonths.length ? Math.round((presentCount / elapsedMonths.length) * 100) : 0;
    const monthValues = MONTHS_FULL.map((m, idx) => idx > curMonth ? '' : attendanceStatus(r[m]).replace('Empty', ''));
    return [r.ID, r.Name, ...monthValues, rate];
  });
  const csv = arrayToCsv([header, ...rows]);
  downloadBlob(csv, `attendance-${attendanceViewYear}.csv`, 'text/csv');
  showToast('Attendance report exported.', 'success');
}
