/**
 * SETTINGS PAGE LOGIC
 */

onLayoutReady(initSettingsPage);

async function initSettingsPage() {
  document.getElementById('pageTitle').textContent = 'Settings';
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);
  document.getElementById('profileForm').addEventListener('submit', handleProfileSubmit);
  document.getElementById('changePasswordForm').addEventListener('submit', handleChangePasswordSubmit);
  document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPasswordSubmit);
  document.getElementById('newYearForm').addEventListener('submit', handleStartNewYearSubmit);
  document.getElementById('btnConfirmStartNewYear').addEventListener('click', confirmStartNewYear);
  document.getElementById('archiveYear').value = new Date().getFullYear();

  const demoHint = document.getElementById('demoPasswordHint');
  if (demoHint) {
    demoHint.textContent = CONFIG.DEMO_MODE
      ? 'Demo mode: every account\'s password is "changeme123" and changes here aren\'t saved permanently.'
      : 'Choose a password only you know. You\'ll need it again next time you log in.';
  }

  await loadOrgSettings();
  fillMyProfileForm();
  if (isPresident()) await loadUsersTable();
}

window.addEventListener('ylsms:authchanged', () => {
  fillMyProfileForm();
  if (isPresident()) loadUsersTable();
});

async function loadOrgSettings() {
  try {
    const settings = await Api.fetchSettings();
    document.getElementById('orgName').value = settings.orgName || '';
    document.getElementById('whatsappLink').value = settings.whatsappLink || '';
    document.getElementById('feeAmount').value = settings.feeAmount || '';
    document.getElementById('systemTheme').value = settings.theme || 'default';
  } catch (err) {
    showAlert(document.getElementById('settingsAlert'), 'Could not load settings: ' + err.message);
  }
}

function fillMyProfileForm() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById('profileDisplayName').value = user.displayName || '';
  document.getElementById('profilePhotoUrl').value = user.photoUrl || '';
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('settingsAlert'));
  if (!isAdmin()) {
    showAlert(document.getElementById('settingsAlert'), 'Please log in to save settings.');
    return;
  }

  const data = {
    orgName: document.getElementById('orgName').value.trim(),
    whatsappLink: document.getElementById('whatsappLink').value.trim(),
    feeAmount: document.getElementById('feeAmount').value || '0',
    theme: document.getElementById('systemTheme').value
  };

  if (!data.orgName) {
    showAlert(document.getElementById('settingsAlert'), 'Organization name is required.');
    return;
  }

  const btn = document.getElementById('btnSaveSettings');
  setButtonLoading(btn, true);
  try {
    await Api.saveSettings(data);
    document.body.setAttribute('data-theme', data.theme === 'default' ? '' : data.theme);
    const orgLabel = document.getElementById('navOrgName');
    if (orgLabel) orgLabel.textContent = data.orgName;
    showToast('Settings saved successfully.', 'success');
  } catch (err) {
    showAlert(document.getElementById('settingsAlert'), 'Could not save settings: ' + err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('profileAlert'));
  const user = getCurrentUser();
  if (!user) {
    showAlert(document.getElementById('profileAlert'), 'Please log in first.');
    return;
  }

  const displayName = document.getElementById('profileDisplayName').value.trim();
  const photoUrl = document.getElementById('profilePhotoUrl').value.trim();
  if (!displayName) {
    showAlert(document.getElementById('profileAlert'), 'Display name is required.');
    return;
  }

  const btn = document.getElementById('btnSaveProfile');
  setButtonLoading(btn, true);
  try {
    await Api.updateUserProfile(user.username, displayName, photoUrl);
    // Update the locally-stored session so the navbar/sidebar reflect the
    // change immediately without needing to log out and back in.
    setCurrentUser({ ...user, displayName, photoUrl });
    applyAuthUI();
    showToast('Profile updated.', 'success');
  } catch (err) {
    showAlert(document.getElementById('profileAlert'), 'Could not update profile: ' + err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('passwordAlert'));
  const user = getCurrentUser();
  if (!user) {
    showAlert(document.getElementById('passwordAlert'), 'Please log in first.');
    return;
  }

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newAdminPassword').value;
  const confirmPassword = document.getElementById('confirmAdminPassword').value;

  if (newPassword.length < 4) {
    showAlert(document.getElementById('passwordAlert'), 'New password must be at least 4 characters.');
    return;
  }
  if (newPassword !== confirmPassword) {
    showAlert(document.getElementById('passwordAlert'), 'Passwords do not match.');
    return;
  }

  const btn = document.getElementById('btnChangePassword');
  setButtonLoading(btn, true, 'Updating…');
  try {
    await Api.changeOwnPassword(user.username, currentPassword, newPassword);
    document.getElementById('changePasswordForm').reset();
    showToast(CONFIG.DEMO_MODE ? 'Demo mode: password not actually changed permanently.' : 'Your password has been updated.', 'success');
  } catch (err) {
    showAlert(document.getElementById('passwordAlert'), 'Could not update password: ' + err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

async function loadUsersTable() {
  const select = document.getElementById('resetUsername');
  const tbody = document.getElementById('usersTableBody');
  try {
    const users = await Api.getUsersPublic();
    select.innerHTML = users.map(u => `<option value="${escapeHtml(u.username)}">${escapeHtml(u.displayName)} — ${escapeHtml(u.position)}</option>`).join('');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><code>${escapeHtml(u.username)}</code></td>
        <td>${escapeHtml(u.displayName)}</td>
        <td>${escapeHtml(u.position)}</td>
      </tr>`).join('');
  } catch (err) {
    showAlert(document.getElementById('manageUsersAlert'), 'Could not load committee accounts: ' + err.message);
  }
}

async function handleResetPasswordSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('manageUsersAlert'));
  const user = getCurrentUser();
  if (!user || user.position !== 'President') {
    showAlert(document.getElementById('manageUsersAlert'), 'Only the President account can do this.');
    return;
  }

  const targetUsername = document.getElementById('resetUsername').value;
  const newPassword = document.getElementById('resetNewPassword').value;
  if (newPassword.length < 4) {
    showAlert(document.getElementById('manageUsersAlert'), 'New password must be at least 4 characters.');
    return;
  }

  const btn = document.getElementById('btnResetPassword');
  setButtonLoading(btn, true, 'Resetting…');
  try {
    await Api.resetUserPassword(user.username, targetUsername, newPassword);
    document.getElementById('resetPasswordForm').reset();
    showToast(`Password reset for ${targetUsername}.`, 'success');
  } catch (err) {
    showAlert(document.getElementById('manageUsersAlert'), 'Could not reset password: ' + err.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

function handleStartNewYearSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('newYearAlert'));
  if (!isAdmin()) {
    showAlert(document.getElementById('newYearAlert'), 'Please log in to do this.');
    return;
  }

  const year = document.getElementById('archiveYear').value.trim();
  if (!/^\d{4}$/.test(year)) {
    showAlert(document.getElementById('newYearAlert'), 'Please enter a valid 4-digit year.');
    return;
  }

  document.getElementById('confirmAttSheetName').textContent = `Attendance ${year}`;
  document.getElementById('confirmFeeSheetName').textContent = `Fees ${year}`;
  new bootstrap.Modal(document.getElementById('newYearConfirmModal')).show();
}

async function confirmStartNewYear() {
  const year = document.getElementById('archiveYear').value.trim();
  const btn = document.getElementById('btnConfirmStartNewYear');
  setButtonLoading(btn, true, 'Archiving…');
  try {
    await Api.startNewYear(year);
    bootstrap.Modal.getInstance(document.getElementById('newYearConfirmModal')).hide();
    showToast(
      CONFIG.DEMO_MODE
        ? 'Demo mode: archived in memory only — refresh the page and it resets.'
        : `Archived as "Attendance ${year}" / "Fees ${year}" — Jan-Dec is now blank for the new year.`,
      'success'
    );
  } catch (err) {
    showAlert(document.getElementById('newYearAlert'), 'Could not start new year: ' + err.message);
    bootstrap.Modal.getInstance(document.getElementById('newYearConfirmModal')).hide();
  } finally {
    setButtonLoading(btn, false);
  }
}
