/**
 * MEMBERSHIP FEES PAGE LOGIC
 */

let feeRows = [];
let feeSettings = { feeAmount: '500' };

document.addEventListener('DOMContentLoaded', initFeesPage);

async function initFeesPage() {
  document.getElementById('pageTitle').textContent = 'Membership Fees';
  document.getElementById('feesYearPill').textContent = new Date().getFullYear();

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

  await loadFees();
}

async function loadFees() {
  try {
    const [rows, settings] = await Promise.all([Api.fetchFees(), Api.fetchSettings()]);
    feeRows = rows;
    feeSettings = settings;
    renderFeesTable();
    renderFeeStats();
  } catch (err) {
    showAlert(document.getElementById('feesAlert'), 'Could not load fees: ' + err.message);
  }
}

function renderFeeStats() {
  const currentMonth = monthShortName(new Date().getMonth());
  const amount = Number(feeSettings.feeAmount) || 0;
  const total = feeRows.length;
  const paid = feeRows.filter(r => r[currentMonth] === 'Paid').length;
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
    if (month) return r[month] === status;
    return MONTHS_FULL.some(m => r[m] === status);
  });
}

function renderFeesTable() {
  const body = document.getElementById('feesBody');
  const empty = document.getElementById('feesEmpty');
  const rows = getFilteredFeeRows();

  if (!rows.length) {
    body.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  body.innerHTML = rows.map(r => {
    const monthCells = MONTHS_FULL.map(m => {
      const status = r[m] === 'Paid' ? 'Paid' : 'Pending';
      return `
        <td class="text-center">
          <select class="fee-select ${status === 'Paid' ? 'is-paid' : 'is-pending'}"
            onchange="toggleFee('${escapeHtml(r.ID)}', '${m}', this.value, this)">
            <option value="Paid" ${status === 'Paid' ? 'selected' : ''}>Paid</option>
            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>Pending</option>
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
  selectEl.disabled = true;
  selectEl.classList.remove('is-paid', 'is-pending');
  try {
    await Api.saveFees(id, month, value);
    const row = feeRows.find(r => r.ID === id);
    if (row) row[month] = value;
    selectEl.classList.add(value === 'Paid' ? 'is-paid' : 'is-pending');
    showToast(`${month} fee marked ${value.toLowerCase()}.`, value === 'Paid' ? 'success' : 'warning');
    renderFeeStats();
  } catch (err) {
    selectEl.value = value === 'Paid' ? 'Pending' : 'Paid';
    selectEl.classList.add(value === 'Paid' ? 'is-pending' : 'is-paid');
    showToast('Could not save fee status: ' + err.message, 'danger');
  } finally {
    selectEl.disabled = false;
  }
}

function exportFeesCsv() {
  const header = ['ID', 'Name', ...MONTHS_FULL];
  const rows = feeRows.map(r => [r.ID, r.Name, ...MONTHS_FULL.map(m => r[m] === 'Paid' ? 'Paid' : 'Pending')]);
  const csv = arrayToCsv([header, ...rows]);
  downloadBlob(csv, `fees-${new Date().getFullYear()}.csv`, 'text/csv');
  showToast('Fee report exported.', 'success');
}
