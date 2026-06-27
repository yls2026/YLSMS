/**
 * REPORTS PAGE LOGIC
 */

let reportMembers = [];
let reportAttendance = [];
let reportFees = [];
let reportSettings = {};
let reportActivity = [];

onLayoutReady(initReportsPage);

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
  await loadActivityReport();
}

window.addEventListener('ylsms:authchanged', loadActivityReport);

/** The Activity Log is only visible/fetchable once logged in (the card itself is .admin-only). */
async function loadActivityReport() {
  if (!isAdmin()) {
    reportActivity = [];
    return;
  }
  try {
    reportActivity = await Api.getActivityLog();
    const countEl = document.getElementById('countActivity');
    if (countEl) countEl.textContent = reportActivity.length;
  } catch (err) {
    reportActivity = [];
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
  const curMonth = new Date().getMonth();
  const elapsedMonths = MONTHS_FULL.slice(0, curMonth + 1);
  const rows = reportAttendance.map(r => {
    const present = elapsedMonths.filter(m => attendanceStatus(r[m]) === 'Present').length;
    const rate = elapsedMonths.length ? Math.round((present / elapsedMonths.length) * 100) : 0;
    const monthValues = MONTHS_FULL.map((m, idx) => {
      if (idx > curMonth) return ''; // upcoming month — left genuinely blank
      const status = attendanceStatus(r[m]);
      return status === 'Empty' ? '' : status;
    });
    return [r.ID, r.Name, ...monthValues, rate];
  });
  return { headers, rows };
}

/**
 * Month-end summary rows for the Attendance PDF: how many members were
 * Present that month (out of the whole group) and what percentage that
 * is. Upcoming months show "—" since they haven't happened yet. Used as
 * the PDF table's footer — not shown in CSV/Excel exports.
 */
function buildAttendanceFooterRows() {
  const curMonth = new Date().getMonth();
  const totalMembers = reportAttendance.length;
  const labelStyles = { halign: 'right', fontStyle: 'bold' };
  const totalRow = [{ content: 'Total Present', colSpan: 2, styles: labelStyles }];
  const pctRow = [{ content: 'Attendance %', colSpan: 2, styles: labelStyles }];

  MONTHS_FULL.forEach((m, idx) => {
    if (idx > curMonth) {
      totalRow.push('—');
      pctRow.push('—');
      return;
    }
    const count = reportAttendance.filter(r => attendanceStatus(r[m]) === 'Present').length;
    const pct = totalMembers ? Math.round((count / totalMembers) * 100) : 0;
    totalRow.push(`${count}/${totalMembers}`);
    pctRow.push(`${pct}%`);
  });

  totalRow.push(''); // Rate % column doesn't apply to these summary rows
  pctRow.push('');
  return [totalRow, pctRow];
}

function buildFeesDataset() {
  const headers = ['ID', 'Name', ...MONTHS_FULL];
  const rows = reportFees.map(r => [r.ID, r.Name, ...MONTHS_FULL.map(m => {
    if (r[m] === 'Paid') return 'Paid';
    if (!r[m]) return ''; // genuinely blank — no member fee record for that month yet
    return 'Not Paid';
  })]);
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

function buildActivityLogDataset() {
  const headers = ['Timestamp', 'Name', 'Position', 'Action', 'Details'];
  const rows = reportActivity.map(r => [r.Timestamp, r.DisplayName, r.Position, r.Action, r.Details]);
  return { headers, rows };
}

const REPORT_BUILDERS = {
  member: { build: buildMemberDataset, title: 'Member Report', filename: 'member-report' },
  attendance: { build: buildAttendanceDataset, title: 'Attendance Report', filename: 'attendance-report', buildFoot: buildAttendanceFooterRows },
  fees: { build: buildFeesDataset, title: 'Fee Collection Report', filename: 'fee-collection-report' },
  birthday: { build: buildBirthdayDataset, title: 'Birthday Report', filename: 'birthday-report' },
  activity: { build: buildActivityLogDataset, title: 'Activity Log', filename: 'activity-log' }
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

    // "Positive" words get a green tint, "negative" words get a red tint —
    // makes Attendance (Present/Absent) and Fees (Paid/Not Paid) reports
    // easy to scan at a glance instead of squinting at plain text.
    const POSITIVE_VALUES = ['Present', 'Paid'];
    const NEGATIVE_VALUES = ['Absent', 'Not Paid'];

    doc.autoTable({
      head: [headers],
      body: rows,
      foot: config.buildFoot ? config.buildFoot() : undefined,
      startY: 36,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [106, 26, 33], textColor: [255, 255, 255] },
      footStyles: { fillColor: [253, 248, 243], textColor: [106, 26, 33], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 248, 243] },
      didParseCell: (data) => {
        if (data.section !== 'body') return;
        const value = data.cell.raw;
        if (POSITIVE_VALUES.includes(value)) {
          data.cell.styles.fillColor = [220, 245, 224];
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        } else if (NEGATIVE_VALUES.includes(value)) {
          data.cell.styles.fillColor = [253, 226, 226];
          data.cell.styles.textColor = [153, 27, 27];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`${config.filename}.pdf`);
  }

  showToast(`${config.title} exported as ${format.toUpperCase()}.`, 'success');
}
