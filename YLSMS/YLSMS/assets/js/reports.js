/**
 * REPORTS PAGE LOGIC
 */

let reportMembers = [];
let reportAttendance = [];
let reportFees = [];
let reportSettings = {};

document.addEventListener('DOMContentLoaded', initReportsPage);

async function initReportsPage() {
  document.getElementById('pageTitle').textContent = 'Reports';
  try {
    [reportMembers, reportAttendance, reportFees, reportSettings] = await Promise.all([
      Api.fetchMembers(), Api.fetchAttendance(), Api.fetchFees(), Api.fetchSettings()
    ]);
    document.getElementById('countMembers').textContent = reportMembers.length;
    document.getElementById('countAttendance').textContent = reportAttendance.length;
    document.getElementById('countFees').textContent = reportFees.length;
    document.getElementById('countBirthdays').textContent = reportMembers.length;
  } catch (err) {
    showAlert(document.getElementById('reportsAlert'), 'Could not load report data: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// DATASET BUILDERS — each returns { headers, rows }
// ---------------------------------------------------------------------------

function buildMemberDataset() {
  const headers = ['ID', 'Position', 'Name', 'Birthday', 'Gender', 'Phone', 'WhatsApp', 'Email', 'Address'];
  const rows = reportMembers.map(m => [m.ID, m.Position, m.Name, m.Birthday, m.Gender, m.Phone, m.WhatsApp, m.Email, m.Address]);
  return { headers, rows };
}

function buildAttendanceDataset() {
  const headers = ['ID', 'Name', ...MONTHS_FULL, 'Rate %'];
  const rows = reportAttendance.map(r => {
    const present = MONTHS_FULL.filter(m => r[m] === true || r[m] === 'true' || r[m] === 'TRUE').length;
    return [r.ID, r.Name, ...MONTHS_FULL.map(m => (r[m] === true || r[m] === 'true' || r[m] === 'TRUE') ? 'Present' : 'Absent'), Math.round((present / 12) * 100)];
  });
  return { headers, rows };
}

function buildFeesDataset() {
  const headers = ['ID', 'Name', ...MONTHS_FULL];
  const rows = reportFees.map(r => [r.ID, r.Name, ...MONTHS_FULL.map(m => r[m] === 'Paid' ? 'Paid' : 'Pending')]);
  return { headers, rows };
}

function buildBirthdayDataset() {
  const headers = ['ID', 'Name', 'Birthday', 'Age', 'Days Until Next Birthday'];
  const rows = reportMembers
    .map(m => ({ m, age: calculateAge(m.Birthday), days: daysUntilBirthday(m.Birthday) }))
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
    .map(({ m, age, days }) => [m.ID, m.Name, formatDateDisplay(m.Birthday), age ?? '—', days ?? '—']);
  return { headers, rows };
}

const REPORT_BUILDERS = {
  member: { build: buildMemberDataset, title: 'Member Report', filename: 'member-report' },
  attendance: { build: buildAttendanceDataset, title: 'Attendance Report', filename: 'attendance-report' },
  fees: { build: buildFeesDataset, title: 'Fee Collection Report', filename: 'fee-collection-report' },
  birthday: { build: buildBirthdayDataset, title: 'Birthday Report', filename: 'birthday-report' }
};

// ---------------------------------------------------------------------------
// PREVIEW
// ---------------------------------------------------------------------------

function togglePreview(type) {
  const container = document.getElementById('preview-' + type);
  if (!container.classList.contains('d-none')) {
    container.classList.add('d-none');
    return;
  }
  const { headers, rows } = REPORT_BUILDERS[type].build();
  container.innerHTML = `
    <table class="app-table">
      <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.length
          ? rows.slice(0, 25).map(row => `<tr>${row.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${headers.length}" class="text-muted text-center py-3">No data available.</td></tr>`}
      </tbody>
    </table>
    ${rows.length > 25 ? `<p class="small text-muted mt-2 mb-0">Showing first 25 of ${rows.length} rows. Export to see the full report.</p>` : ''}`;
  container.classList.remove('d-none');
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------

function exportReport(type, format) {
  const config = REPORT_BUILDERS[type];
  const { headers, rows } = config.build();

  if (!rows.length) {
    showToast('There is no data to export for this report yet.', 'warning');
    return;
  }

  if (format === 'csv') {
    const csv = arrayToCsv([headers, ...rows]);
    downloadBlob(csv, `${config.filename}.csv`, 'text/csv');
  } else if (format === 'excel') {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, config.title.slice(0, 28));
    XLSX.writeFile(wb, `${config.filename}.xlsx`);
  } else if (format === 'pdf') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
    const orgName = reportSettings.orgName || CONFIG.ORG_NAME_FALLBACK;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(106, 26, 33);
    doc.text(orgName, 14, 16);
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
    doc.text(config.title, 14, 24);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, 14, 30);

    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 36,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [106, 26, 33], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [253, 248, 243] }
    });

    doc.save(`${config.filename}.pdf`);
  }

  showToast(`${config.title} exported as ${format.toUpperCase()}.`, 'success');
}
