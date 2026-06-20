/**
 * API LAYER
 * ---------------------------------------------------------------------
 * Every page talks to the backend exclusively through the functions in
 * this file. When CONFIG.DEMO_MODE is true (no Apps Script URL configured
 * yet) all calls operate on an in-memory dataset so the UI is fully
 * explorable out of the box.
 */

const Api = (() => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // -------------------------------------------------------------------
  // DEMO DATA (used only when CONFIG.DEMO_MODE === true)
  // -------------------------------------------------------------------
  const demoMembers = [
    { ID: 'YLS/2026/001', Position: 'President', Name: 'Nadeesha Perera', Birthday: '1999-06-22', Gender: 'Female', Address: '12 Lake Road, Negombo', Email: 'nadeesha@example.com', Phone: '+94771234567', WhatsApp: '+94771234567' },
    { ID: 'YLS/2026/002', Position: 'Vice President', Name: 'Kasun Silva', Birthday: '1998-07-02', Gender: 'Male', Address: '45 Beach Road, Negombo', Email: 'kasun@example.com', Phone: '+94712345678', WhatsApp: '+94712345678' },
    { ID: 'YLS/2026/003', Position: 'Secretary', Name: 'Ishara Fernando', Birthday: '2000-12-15', Gender: 'Female', Address: '8 Church Street, Negombo', Email: 'ishara@example.com', Phone: '+94701122334', WhatsApp: '+94701122334' },
    { ID: 'YLS/2026/004', Position: 'Treasurer', Name: 'Dimuthu Jayasuriya', Birthday: '1997-03-05', Gender: 'Male', Address: '21 Main Street, Negombo', Email: 'dimuthu@example.com', Phone: '+94765566778', WhatsApp: '+94765566778' },
    { ID: 'YLS/2026/005', Position: 'Committee Member', Name: 'Hashini Madushani', Birthday: '2001-06-30', Gender: 'Female', Address: '3 Temple Lane, Negombo', Email: 'hashini@example.com', Phone: '+94759988776', WhatsApp: '+94759988776' },
    { ID: 'YLS/2026/006', Position: 'Member', Name: 'Tharindu Bandara', Birthday: '1999-01-18', Gender: 'Male', Address: '67 Station Road, Negombo', Email: 'tharindu@example.com', Phone: '+94778877665', WhatsApp: '+94778877665' }
  ];

  function blankMonthObject(fillValue) {
    const obj = {};
    MONTHS.forEach(m => (obj[m] = fillValue));
    return obj;
  }

  const demoAttendance = demoMembers.map((m, i) => ({
    ID: m.ID,
    Name: m.Name,
    ...blankMonthObject(false),
    ...(i % 2 === 0 ? { Jan: true, Feb: true, Mar: true } : { Jan: true, Feb: false, Mar: true })
  }));

  const demoFees = demoMembers.map((m, i) => ({
    ID: m.ID,
    Name: m.Name,
    ...blankMonthObject('Pending'),
    ...(i % 2 === 0 ? { Jan: 'Paid', Feb: 'Paid' } : { Jan: 'Paid', Feb: 'Pending' })
  }));

  const demoSettings = {
    orgName: 'Youth Lions Society - Negombo',
    whatsappLink: 'https://chat.whatsapp.com/example',
    feeAmount: '500',
    theme: 'default'
  };

  function generateDemoId() {
    const year = new Date().getFullYear();
    const prefix = `YLS/${year}/`;
    const max = demoMembers
      .map(m => m.ID)
      .filter(id => id.startsWith(prefix))
      .map(id => parseInt(id.split('/')[2], 10))
      .reduce((a, b) => Math.max(a, b), 0);
    return prefix + String(max + 1).padStart(3, '0');
  }

  function normalizePhone(phone) {
    if (!phone) return '';
    const str = String(phone).trim();
    // Already a full international number (e.g. "+447911123456") —
    // leave the country code the user/admin chose untouched.
    if (str.indexOf('+') === 0) return str;
    // Fallback for legacy/raw input with no "+": assume Sri Lanka.
    let digits = str.replace(/[^\d]/g, '');
    if (digits.startsWith('94')) return '+' + digits;
    if (digits.startsWith('0')) digits = digits.substring(1);
    return '+94' + digits;
  }

  // -------------------------------------------------------------------
  // LOW LEVEL TRANSPORT (real backend)
  // -------------------------------------------------------------------

  async function apiGet(action) {
    const url = `${CONFIG.API_URL}?action=${encodeURIComponent(action)}`;
    const res = await fetch(url, { method: 'GET' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Request failed');
    return json.data;
  }

  async function apiPost(action, data) {
    // Sent as text/plain to avoid a CORS preflight (Apps Script can't
    // respond to OPTIONS requests), the backend still parses it as JSON.
    const token = (typeof getAdminToken === 'function') ? getAdminToken() : '';
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data, token })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Request failed');
    return json.data;
  }

  // -------------------------------------------------------------------
  // PUBLIC API — MEMBERS
  // -------------------------------------------------------------------

  async function fetchMembers() {
    if (CONFIG.DEMO_MODE) return JSON.parse(JSON.stringify(demoMembers));
    return apiGet('getMembers');
  }

  async function addMember(member) {
    if (CONFIG.DEMO_MODE) {
      const id = member.ID && member.ID.trim() ? member.ID : generateDemoId();
      const record = { ...member, ID: id, Phone: normalizePhone(member.Phone), WhatsApp: normalizePhone(member.WhatsApp || member.Phone) };
      demoMembers.push(record);
      demoAttendance.push({ ID: id, Name: member.Name, ...blankMonthObject(false) });
      demoFees.push({ ID: id, Name: member.Name, ...blankMonthObject('Pending') });
      return record;
    }
    return apiPost('addMember', member);
  }

  async function updateMember(member) {
    if (CONFIG.DEMO_MODE) {
      const idx = demoMembers.findIndex(m => m.ID === member.ID);
      if (idx === -1) throw new Error('Member not found');
      demoMembers[idx] = { ...demoMembers[idx], ...member, Phone: normalizePhone(member.Phone), WhatsApp: normalizePhone(member.WhatsApp || member.Phone) };
      const att = demoAttendance.find(a => a.ID === member.ID);
      if (att) att.Name = member.Name;
      const fee = demoFees.find(f => f.ID === member.ID);
      if (fee) fee.Name = member.Name;
      return demoMembers[idx];
    }
    return apiPost('updateMember', member);
  }

  async function deleteMember(id) {
    if (CONFIG.DEMO_MODE) {
      const idx = demoMembers.findIndex(m => m.ID === id);
      if (idx > -1) demoMembers.splice(idx, 1);
      const ai = demoAttendance.findIndex(a => a.ID === id);
      if (ai > -1) demoAttendance.splice(ai, 1);
      const fi = demoFees.findIndex(f => f.ID === id);
      if (fi > -1) demoFees.splice(fi, 1);
      return { ID: id, deleted: true };
    }
    return apiPost('deleteMember', { ID: id });
  }

  // -------------------------------------------------------------------
  // PUBLIC API — ATTENDANCE
  // -------------------------------------------------------------------

  async function fetchAttendance() {
    if (CONFIG.DEMO_MODE) return JSON.parse(JSON.stringify(demoAttendance));
    return apiGet('getAttendance');
  }

  async function saveAttendance(id, month, value) {
    if (CONFIG.DEMO_MODE) {
      const row = demoAttendance.find(a => a.ID === id);
      if (row) row[month] = value;
      return { id, month, value, saved: true };
    }
    return apiPost('updateAttendance', { id, month, value });
  }

  // -------------------------------------------------------------------
  // PUBLIC API — FEES
  // -------------------------------------------------------------------

  async function fetchFees() {
    if (CONFIG.DEMO_MODE) return JSON.parse(JSON.stringify(demoFees));
    return apiGet('getFees');
  }

  async function saveFees(id, month, value) {
    if (CONFIG.DEMO_MODE) {
      const row = demoFees.find(f => f.ID === id);
      if (row) row[month] = value;
      return { id, month, value, saved: true };
    }
    return apiPost('updateFees', { id, month, value });
  }

  // -------------------------------------------------------------------
  // PUBLIC API — SETTINGS
  // -------------------------------------------------------------------

  async function fetchSettings() {
    if (CONFIG.DEMO_MODE) return { ...demoSettings };
    return apiGet('getSettings');
  }

  async function saveSettings(settings) {
    if (CONFIG.DEMO_MODE) {
      Object.assign(demoSettings, settings);
      return { ...demoSettings };
    }
    return apiPost('saveSettings', settings);
  }

  // -------------------------------------------------------------------
  // PUBLIC API — ADMIN LOGIN
  // -------------------------------------------------------------------

  /** Resolves with a session token on success, throws on bad password. */
  async function adminLogin(password) {
    if (CONFIG.DEMO_MODE) {
      throw new Error('adminLogin() should not be called directly in demo mode — use loginAdmin() in auth.js.');
    }
    const result = await apiPost('adminLogin', { password });
    return result.token;
  }

  async function adminLogout(token) {
    if (CONFIG.DEMO_MODE) return { ok: true };
    return apiPost('adminLogout', { token });
  }

  async function changeAdminPassword(newPassword) {
    if (CONFIG.DEMO_MODE) return { ok: true };
    return apiPost('changeAdminPassword', { newPassword });
  }

  return {
    fetchMembers, addMember, updateMember, deleteMember,
    fetchAttendance, saveAttendance,
    fetchFees, saveFees,
    fetchSettings, saveSettings,
    adminLogin, adminLogout, changeAdminPassword,
    MONTHS
  };
})();
