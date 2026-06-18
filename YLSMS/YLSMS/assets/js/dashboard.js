/**
 * DASHBOARD PAGE LOGIC
 */

document.addEventListener('DOMContentLoaded', initDashboard);

async function initDashboard() {
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = 'Dashboard';

  try {
    const [members, attendance, fees] = await Promise.all([
      Api.fetchMembers(),
      Api.fetchAttendance(),
      Api.fetchFees()
    ]);

    renderStatCards(members, attendance, fees);
    renderRecentMembers(members);
    renderBirthdayWidget(members);
  } catch (err) {
    console.error(err);
    showToast('Could not load dashboard data: ' + err.message, 'danger');
  }
}

function renderStatCards(members, attendance, fees) {
  const total = members.length;
  const male = members.filter(m => m.Gender === 'Male').length;
  const female = members.filter(m => m.Gender === 'Female').length;

  const upcoming = members.filter(m => {
    const days = daysUntilBirthday(m.Birthday);
    return days !== null && days <= 30;
  }).length;

  const currentMonth = monthShortName(new Date().getMonth());

  const attendanceRate = percentTrue(attendance, currentMonth);
  const feeRate = percentPaid(fees, currentMonth);

  document.getElementById('statTotalMembers').textContent = total;
  document.getElementById('statMaleMembers').textContent = male;
  document.getElementById('statFemaleMembers').textContent = female;
  document.getElementById('statBirthdays').textContent = upcoming;
  document.getElementById('statAttendanceRate').textContent = attendanceRate;
  document.getElementById('statFeeRate').textContent = feeRate;
}

function percentTrue(rows, month) {
  if (!rows.length) return '0%';
  const present = rows.filter(r => r[month] === true || r[month] === 'true' || r[month] === 'TRUE').length;
  return Math.round((present / rows.length) * 100) + '%';
}

function percentPaid(rows, month) {
  if (!rows.length) return '0%';
  const paid = rows.filter(r => r[month] === 'Paid').length;
  return Math.round((paid / rows.length) * 100) + '%';
}

function renderRecentMembers(members) {
  const body = document.getElementById('recentMembersBody');
  const empty = document.getElementById('recentMembersEmpty');
  if (!members.length) {
    body.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');
  const recent = [...members].slice(-5).reverse();
  body.innerHTML = recent.map(m => `
    <tr class="fade-in">
      <td><span class="pill pill-maroon">${escapeHtml(m.ID)}</span></td>
      <td>${escapeHtml(m.Name)}</td>
      <td>${escapeHtml(m.Position)}</td>
      <td>${escapeHtml(m.Gender)}</td>
      <td>${escapeHtml(m.Phone)}</td>
    </tr>`).join('');
}

function renderBirthdayWidget(members) {
  const wrap = document.getElementById('birthdayWidget');
  const empty = document.getElementById('birthdayEmpty');

  const upcoming = members
    .map(m => ({ ...m, daysUntil: daysUntilBirthday(m.Birthday), age: calculateAge(m.Birthday) }))
    .filter(m => m.daysUntil !== null && m.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (!upcoming.length) {
    wrap.innerHTML = '';
    empty.classList.remove('d-none');
    return;
  }
  empty.classList.add('d-none');

  wrap.innerHTML = upcoming.slice(0, 6).map(m => {
    const isToday = m.daysUntil === 0;
    const label = isToday ? '🎉 Today' : (m.daysUntil === 1 ? 'Tomorrow' : `In ${m.daysUntil} days`);
    return `
      <div class="birthday-item ${isToday ? 'is-today' : ''}">
        <div class="birthday-avatar">${initialsOf(m.Name)}</div>
        <div class="flex-grow-1">
          <div class="fw-semibold">${escapeHtml(m.Name)}</div>
          <div class="small text-muted">Turning ${m.age + 1} • ${label}</div>
        </div>
      </div>`;
  }).join('');
}
