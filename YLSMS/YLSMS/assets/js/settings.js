/**
 * SETTINGS PAGE LOGIC
 */

document.addEventListener('DOMContentLoaded', initSettingsPage);

async function initSettingsPage() {
  document.getElementById('pageTitle').textContent = 'Settings';
  document.getElementById('settingsForm').addEventListener('submit', handleSettingsSubmit);

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

async function handleSettingsSubmit(e) {
  e.preventDefault();
  clearAlert(document.getElementById('settingsAlert'));

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
