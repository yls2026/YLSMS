/**
 * MEMBERS PAGE LOGIC
 */

let allMembers = [];
let filteredMembers = [];
let currentPage = 1;
const PAGE_SIZE = 8;
let sortState = { field: 'ID', dir: 'asc' };
let editingId = null;

document.addEventListener('DOMContentLoaded', initMembersPage);

async function initMembersPage() {
  setTimeout(async () => {
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
      pageTitle.textContent = 'Members';
    }

    populateCountryCodeSelect(document.getElementById('fieldPhoneCode'), '+94');
    populateCountryCodeSelect(document.getElementById('fieldWhatsAppCode'), '+94');

    wireFilterEvents();
    wireFormEvents();
    await loadMembers();
  }, 200);
}

window.addEventListener('ylsms:authchanged', () => {
  if (document.getElementById('membersBody')) renderTable();
});

async function loadMembers() {
  try {
    allMembers = await Api.fetchMembers();
    applyFiltersAndRender();
  } catch (err) {
    showAlert(document.getElementById('membersAlert'), 'Could not load members: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// FILTER / SEARCH / SORT
// ---------------------------------------------------------------------------

function wireFilterEvents() {
  document.getElementById('searchInput').addEventListener('input', debounce(() => {
    currentPage = 1;
    applyFiltersAndRender();
  }, 200));
  document.getElementById('filterPosition').addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
  document.getElementById('filterGender').addEventListener('change', () => { currentPage = 1; applyFiltersAndRender(); });
  document.getElementById('btnResetFilters').addEventListener('click', resetFilters);
  document.getElementById('btnEmptyReset').addEventListener('click', resetFilters);

  document.querySelectorAll('th.sortable').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortState.field === field) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState = { field, dir: 'asc' };
      }
      applyFiltersAndRender();
    });
  });
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('filterPosition').value = '';
  document.getElementById('filterGender').value = '';
  currentPage = 1;
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const pos = document.getElementById('filterPosition').value;
  const gender = document.getElementById('filterGender').value;

  filteredMembers = allMembers.filter(m => {
    const matchesSearch = !q ||
      String(m.ID).toLowerCase().includes(q) ||
      String(m.Name).toLowerCase().includes(q) ||
      String(m.Phone).toLowerCase().includes(q);
    const matchesPosition = !pos || m.Position === pos;
    const matchesGender = !gender || m.Gender === gender;
    return matchesSearch && matchesPosition && matchesGender;
  });

  filteredMembers.sort((a, b) => {
    const av = (a[sortState.field] || '').toString().toLowerCase();
    const bv = (b[sortState.field] || '').toString().toLowerCase();
    if (av < bv) return sortState.dir === 'asc' ? -1 : 1;
    if (av > bv) return sortState.dir === 'asc' ? 1 : -1;
    return 0;
  });

  renderTable();
  renderPagination();
}

// ---------------------------------------------------------------------------
// TABLE + PAGINATION
// ---------------------------------------------------------------------------

function renderTable() {
  const body = document.getElementById('membersBody');
  const empty = document.getElementById('membersEmpty');

  if (!filteredMembers.length) {
    body.innerHTML = '';
    empty.classList.remove('d-none');
    document.getElementById('paginationInfo').textContent = '';
    return;
  }
  empty.classList.add('d-none');

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredMembers.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageItems.map(m => `
    <tr class="fade-in">
      <td><span class="pill pill-maroon">${escapeHtml(m.ID)}</span></td>
      <td>${escapeHtml(m.Position)}</td>
      <td class="fw-semibold">${escapeHtml(m.Name)}</td>
      <td>${formatDateDisplay(m.Birthday)}</td>
      <td>${escapeHtml(m.Gender)}</td>
      <td>${escapeHtml(m.Phone)}</td>
      <td>${escapeHtml(m.WhatsApp)}</td>
      <td class="text-end">
        ${isAdmin() ? `
        <button class="btn btn-icon btn-outline-primary me-1" title="Edit" onclick="openEditModal('${escapeHtml(m.ID)}')"><i class="bi bi-pencil-fill"></i></button>
        <button class="btn btn-icon btn-outline-danger" title="Delete" onclick="openDeleteModal('${escapeHtml(m.ID)}')"><i class="bi bi-trash3-fill"></i></button>
        ` : `<span class="text-muted small"><i class="bi bi-eye"></i> View only</span>`}
      </td>
    </tr>`).join('');

  document.getElementById('paginationInfo').textContent =
    `Showing ${start + 1}–${Math.min(start + PAGE_SIZE, filteredMembers.length)} of ${filteredMembers.length} members`;
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  const controls = document.getElementById('paginationControls');

  let html = `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
    <button class="page-link" onclick="goToPage(${currentPage - 1})"><i class="bi bi-chevron-left"></i></button></li>`;

  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && Math.abs(i - currentPage) > 2 && i !== 1 && i !== totalPages) {
      if (i === 2 || i === totalPages - 1) html += `<li class="page-item disabled"><span class="page-link">…</span></li>`;
      continue;
    }
    html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
      <button class="page-link" onclick="goToPage(${i})">${i}</button></li>`;
  }

  html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
    <button class="page-link" onclick="goToPage(${currentPage + 1})"><i class="bi bi-chevron-right"></i></button></li>`;

  controls.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  renderPagination();
}

// ---------------------------------------------------------------------------
// ADD / EDIT MODAL
// ---------------------------------------------------------------------------

function nextSuggestedId() {
  const year = new Date().getFullYear();
  const prefix = `YLS/${year}/`;
  const max = allMembers
    .map(m => m.ID)
    .filter(id => id && id.startsWith(prefix))
    .map(id => parseInt(id.split('/')[2], 10))
    .reduce((a, b) => Math.max(a, b), 0);
  return prefix + String(max + 1).padStart(3, '0');
}

function openAddModal() {
  if (!isAdmin()) { showToast('Please log in as Admin to add members.', 'warning'); return; }
  editingId = null;
  document.getElementById('memberModalLabel').innerHTML = '<i class="bi bi-person-plus-fill me-2"></i>Add Member';
  document.getElementById('memberForm').reset();
  document.getElementById('fieldId').value = nextSuggestedId();
  document.getElementById('fieldId').removeAttribute('readonly');
  document.getElementById('sameAsPhone').checked = true;
  populateCountryCodeSelect(document.getElementById('fieldPhoneCode'), '+94');
  populateCountryCodeSelect(document.getElementById('fieldWhatsAppCode'), '+94');
  clearAlert(document.getElementById('formAlert'));
  clearAllFieldErrors();
  new bootstrap.Modal(document.getElementById('memberModal')).show();
}

function openEditModal(id) {
  if (!isAdmin()) { showToast('Please log in as Admin to edit members.', 'warning'); return; }
  const member = allMembers.find(m => m.ID === id);
  if (!member) return;
  editingId = id;
  document.getElementById('memberModalLabel').innerHTML = '<i class="bi bi-pencil-fill me-2"></i>Edit Member';
  clearAlert(document.getElementById('formAlert'));
  clearAllFieldErrors();

  document.getElementById('fieldId').value = member.ID;
  document.getElementById('fieldId').setAttribute('readonly', 'readonly');
  document.getElementById('fieldPosition').value = member.Position || 'Member';
  document.getElementById('fieldName').value = member.Name || '';
  document.getElementById('fieldBirthday').value = member.Birthday || '';
  document.getElementById('fieldGender').value = member.Gender || '';
  document.getElementById('fieldEmail').value = member.Email || '';
  document.getElementById('fieldAddress').value = member.Address || '';

  const phoneSplit = splitPhoneByCountryCode(member.Phone);
  populateCountryCodeSelect(document.getElementById('fieldPhoneCode'), phoneSplit.code);
  document.getElementById('fieldPhone').value = phoneSplit.number;

  const whatsappSplit = splitPhoneByCountryCode(member.WhatsApp);
  populateCountryCodeSelect(document.getElementById('fieldWhatsAppCode'), whatsappSplit.code);
  document.getElementById('fieldWhatsApp').value = whatsappSplit.number;

  document.getElementById('sameAsPhone').checked = member.Phone === member.WhatsApp;

  new bootstrap.Modal(document.getElementById('memberModal')).show();
}

function openDeleteModal(id) {
  if (!isAdmin()) { showToast('Please log in as Admin to delete members.', 'warning'); return; }
  const member = allMembers.find(m => m.ID === id);
  if (!member) return;
  document.getElementById('deleteMemberName').textContent = `${member.Name} (${member.ID})`;
  const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
  document.getElementById('btnConfirmDelete').onclick = async () => {
    const btn = document.getElementById('btnConfirmDelete');
    setButtonLoading(btn, true, 'Deleting…');
    try {
      await Api.deleteMember(id);
      modal.hide();
      showToast(`${member.Name} was deleted.`, 'success');
      await loadMembers();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'danger');
    } finally {
      setButtonLoading(btn, false);
    }
  };
  modal.show();
}

function clearAllFieldErrors() {
  ['fieldName', 'fieldBirthday', 'fieldGender', 'fieldPosition', 'fieldEmail', 'fieldPhone'].forEach(id => {
    clearFieldError(document.getElementById(id));
  });
}

// ---------------------------------------------------------------------------
// FORM EVENTS / VALIDATION / SUBMIT
// ---------------------------------------------------------------------------

function wireFormEvents() {
  document.getElementById('btnAddMember').addEventListener('click', openAddModal);

  document.getElementById('sameAsPhone').addEventListener('change', e => {
    if (e.target.checked) {
      document.getElementById('fieldWhatsApp').value = document.getElementById('fieldPhone').value;
      document.getElementById('fieldWhatsAppCode').value = document.getElementById('fieldPhoneCode').value;
    }
  });
  document.getElementById('fieldPhone').addEventListener('input', e => {
    if (document.getElementById('sameAsPhone').checked) {
      document.getElementById('fieldWhatsApp').value = e.target.value;
    }
  });
  document.getElementById('fieldPhoneCode').addEventListener('change', e => {
    if (document.getElementById('sameAsPhone').checked) {
      document.getElementById('fieldWhatsAppCode').value = e.target.value;
    }
  });

  document.getElementById('memberForm').addEventListener('submit', handleMemberSubmit);
}

function validateMemberForm(data) {
  clearAllFieldErrors();
  let valid = true;

  if (!data.Name || !data.Name.trim()) {
    setFieldError(document.getElementById('fieldName'), 'Name is required.');
    valid = false;
  }
  if (!data.Position) {
    setFieldError(document.getElementById('fieldPosition'), 'Position is required.');
    valid = false;
  }
  if (!data.Gender) {
    setFieldError(document.getElementById('fieldGender'), 'Gender is required.');
    valid = false;
  }
  if (!data.Birthday) {
    setFieldError(document.getElementById('fieldBirthday'), 'Birthday is required.');
    valid = false;
  }
  if (!isValidPhone(data.Phone)) {
    setFieldError(document.getElementById('fieldPhone'), 'Enter a valid phone number.');
    valid = false;
  }
  if (data.Email && !isValidEmail(data.Email)) {
    setFieldError(document.getElementById('fieldEmail'), 'Enter a valid email address.');
    valid = false;
  }
  return valid;
}

async function handleMemberSubmit(e) {
  e.preventDefault();
  if (!isAdmin()) {
    showAlert(document.getElementById('formAlert'), 'Please log in as Admin to save changes.');
    return;
  }

  const data = {
    ID: document.getElementById('fieldId').value.trim(),
    Position: document.getElementById('fieldPosition').value,
    Name: document.getElementById('fieldName').value.trim(),
    Birthday: document.getElementById('fieldBirthday').value,
    Gender: document.getElementById('fieldGender').value,
    Address: document.getElementById('fieldAddress').value.trim(),
    Email: document.getElementById('fieldEmail').value.trim(),
    Phone: formatPhoneInput(document.getElementById('fieldPhoneCode').value, document.getElementById('fieldPhone').value),
    WhatsApp: formatPhoneInput(
      document.getElementById('fieldWhatsAppCode').value,
      document.getElementById('fieldWhatsApp').value || document.getElementById('fieldPhone').value
    )
  };

  if (!validateMemberForm(data)) {
    showAlert(document.getElementById('formAlert'), 'Please fix the highlighted fields before saving.');
    return;
  }
  clearAlert(document.getElementById('formAlert'));

  const btn = document.getElementById('btnSaveMember');
  setButtonLoading(btn, true);
  try {
    if (editingId) {
      await Api.updateMember(data);
      showToast(`${data.Name} was updated.`, 'success');
    } else {
      await Api.addMember(data);
      showToast(`${data.Name} was added as ${data.ID}.`, 'success');
    }
    bootstrap.Modal.getInstance(document.getElementById('memberModal')).hide();
    await loadMembers();
  } catch (err) {
    showAlert(document.getElementById('formAlert'), 'Could not save member: ' + err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}
