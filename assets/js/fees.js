/**
 * MEMBERSHIP FEES PAGE LOGIC
 */

let feeRows = [];
let feeSettings = { feeAmount: '500' };
let feesAvailableYears = [];
let feesViewYear = new Date().getFullYear();

onLayoutReady(initFeesPage);

async function initFeesPage() {
  document.getElementById('pageTitle').textContent = 'Membership Fees';

  const monthSelect = document.getElementById('feesMonthFilter');
  MONTHS_FULL.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    monthSelect.appendChild(opt);
  });

  document.getElementById('feesSearch').addEventListener('input', debounce(renderFeesTable, 200));
  document.getElementById('feesMonthFilter').addEventListener('change', renderFeesTable);
  document.getElementById('feesStatusFilter').addEventListener('change', renderFeesTable);
  document.getElementById('btnExportFees').addEventListener('click', exportFeesCsv);
  document.getElementById('feesYearPrev').addEventListener('click', () => stepFeesYear(-1));
  document.getElementById('feesYearNext').addEventListener('click', () => stepFeesYear(1));

  try {
    feesAvailableYears = await Api.listArchivedYears();
  } catch (err) {
    feesAvailableYears = [feesViewYear];
  }
  if (!feesAvailableYears.includes(feesViewYear)) feesAvailableYears.push(feesViewYear);

  updateFeesYearControls();
  await loadFees();
}

window.addEventListener('ylsms:authchanged', () => {
  if (document.getElementById('feesBody')) renderFeesTable();
});

function isLiveFeesYear() {
  return feesViewYear === new Date().getFullYear();
}

function updateFeesYearControls() {
  document.getElementById('feesYearPill').textContent = feesViewYear;
  const idx = feesAvailableYears.indexOf(feesViewYear);
  document.getElementById('feesYearPrev').disabled = idx <= 0;
  document.getElementById('feesYearNext').disabled = idx === -1 || idx >= feesAvailableYears.length - 1;
  document.getElementById('feesArchiveBanner').classList.toggle('d-none', isLiveFeesYear());
}

async function stepFeesYear(direction) {
  const idx = feesAvailableYears.indexOf(feesViewYear);
  const nextIdx = idx + direction;
  if (nextIdx < 0 || nextIdx >= feesAvailableYears.length) return;
  feesViewYear = feesAvailableYears[nextIdx];
  updateFeesYearControls();
  await loadFees();
}

async function loadFees() {
  try {
    const [rows, settings] = await Promise.all([
      isLiveFeesYear() ? Api.fetchFees() : Api.fetchFees(feesViewYear),
      Api.fetchSettings()
    ]);
    feeRows = rows;
    feeSettings = settings;
    renderFeesTable();
    renderFeeStats();
  } catch (err) {
    showAlert(document.getElementById('feesAlert'), 'Could not load fees: ' + err.message);
  }
}

function renderFeeStats() {
  // Archived years are fully in the past, so summarize December instead
  // of "the current month" (which only makes sense for the live year).
  const statsMonth = isLiveFeesYear() ? monthShortName(new Date().getMonth()) : 'Dec';
  const amount = Number(feeSettings.feeAmount) || 0;
  const total = feeRows.length;
  const paid = feeRows.filter(r => r[statsMonth] === 'Paid').length;
  const pending = total - paid;
  const rate = total ? Math.round((paid / total) * 100) : 0;

  document.getElementById('feeStatExpected').textContent = formatLkr(total * amount);
  document.getElementById('feeStatCollected').textContent = formatLkr(paid * amount);
  document.getElementById('feeStatRate').textContent = rate + '%';
  document.getElementById('feeStatPending').textContent = pending;
}

function formatLkr(n) {
  return 'Rs. ' + n.toLocaleString('en-LK');
}

function getFilteredFeeRows() {
  const q = document.getElementById('feesSearch').value.trim().toLowerCase();
  const month = document.getElementById('feesMonthFilter').value;
  const status = document.getElementById('feesStatusFilter').value;

  return feeRows.filter(r => {
    const matchesSearch = !q || String(r.ID).toLowerCase().includes(q) || String(r.Name).toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (!status) return true;
    if (status === '__EMPTY__') {
      return month ? !r[month] : MONTHS_FULL.some(m => !r[m]);
    }
    if (month) return r[month] === status;
    return MONTHS_FULL.some(m => r[m] === status);
  });
}

/**
 * A Fees cell has 3 possible states:
 * - "Paid"      → explicitly marked paid (green)
 * - "Pending"   → explicitly marked not paid (red)
 * - "" / blank  → no value at all in the sheet yet (white/neutral "Empty")
 */
function feeStatus(value) {
  if (value === 'Paid') return 'Paid';
  if (!value) return 'Empty';
  return 'Pending';
}

function feeStatusClass(status) {
  return status === 'Paid' ? 'is-paid' : status === 'Pending' ? 'is-pending' : 'is-empty';
}

function renderFeesTable() {
  const body = document.getElementById('feesBody');
  const empty = document.getElementById('feesEmpty');
  const rows = getFilteredFeeRows();
  const editable = isAdmin() && isLiveFeesYear();

  if (!rows.length) {
    body.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  body.innerHTML = rows.map(r => {
    const monthCells = MONTHS_FULL.map(m => {
      const status = feeStatus(r[m]);
      return `
        <td class="text-center">
          <select class="fee-select ${feeStatusClass(status)}" data-prev="${r[m] || ''}" ${editable ? '' : 'disabled'}
            onchange="toggleFee('${escapeHtml(r.ID)}', '${m}', this.value, this)">
            <option value="Paid" ${status === 'Paid' ? 'selected' : ''}>Paid</option>
            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Not Paid</option>
            <option value="" ${status === 'Empty' ? 'selected' : ''}>Empty</option>
          </select>
        </td>`;
    }).join('');

    return `
      <tr>
        <td class="cell-sticky" style="left:0;"><span class="pill pill-maroon">${escapeHtml(r.ID)}</span></td>
        <td class="cell-sticky fw-semibold" style="left:140px;">${escapeHtml(r.Name)}</td>
        ${monthCells}
      </tr>`;
  }).join('');
}

async function toggleFee(id, month, value, selectEl) {
  const previousValue = selectEl.dataset.prev || '';
  if (!isAdmin() || !isLiveFeesYear()) {
    selectEl.value = previousValue;
    showToast(isLiveFeesYear() ? 'Please log in to mark fee status.' : 'Archived years are read-only.', 'warning');
    return;
  }
  selectEl.disabled = true;
  selectEl.classList.remove('is-paid', 'is-pending', 'is-empty');
  try {
    await Api.saveFees(id, month, value);
    const row = feeRows.find(r => r.ID === id);
    if (row) row[month] = value;
    selectEl.dataset.prev = value;
    const status = feeStatus(value);
    selectEl.classList.add(feeStatusClass(status));
    const label = status === 'Paid' ? 'paid' : status === 'Pending' ? 'not paid' : 'empty';
    showToast(`${month} fee marked ${label}.`, status === 'Paid' ? 'success' : status === 'Pending' ? 'warning' : 'info');
    renderFeeStats();
  } catch (err) {
    selectEl.value = previousValue;
    selectEl.classList.add(feeStatusClass(feeStatus(previousValue)));
    showToast('Could not save fee status: ' + err.message, 'danger');
  } finally {
    selectEl.disabled = false;
  }
}

function exportFeesCsv() {
  const header = ['ID', 'Name', ...MONTHS_FULL];
  const rows = feeRows.map(r => [r.ID, r.Name, ...MONTHS_FULL.map(m => {
    const status = feeStatus(r[m]);
    return status === 'Empty' ? '' : (status === 'Pending' ? 'Not Paid' : status);
  })]);
  const csv = arrayToCsv([header, ...rows]);
  downloadBlob(csv, `fees-${feesViewYear}.csv`, 'text/csv');
  showToast('Fee report exported.', 'success');
}
