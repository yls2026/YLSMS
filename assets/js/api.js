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
    ...blankMonthObject(''),
    ...(i % 2 === 0 ? { Jan: 'Present', Feb: 'Present', Mar: 'Present' } : { Jan: 'Present', Feb: 'Absent', Mar: 'Present' })
  }));

  const demoFees = demoMembers.map((m, i) => ({
    ID: m.ID,
    Name: m.Name,
    ...blankMonthObject(''),
    ...(i % 2 === 0 ? { Jan: 'Paid', Feb: 'Paid' } : { Jan: 'Paid', Feb: 'Pending' })
  }));

  const demoSettings = {
    orgName: 'Youth Lions Society - Negombo',
    whatsappLink: 'https://chat.whatsapp.com/example',
    feeAmount: '500',
    theme: 'default'
  };

  // year (number) -> { attendance: [...], fees: [...] } — populated by
  // Api.startNewYear() in demo mode so the year-picker has something to
  // browse, just like real "Attendance 2026" / "Fees 2026" archive sheets.
  const demoArchives = {};

  const DEMO_PASSWORD = 'changeme123';
  const demoUsers = [
    { username: 'president', displayName: 'Lahiru Sampath', position: 'President', password: DEMO_PASSWORD, photoUrl: '' },
    { username: 'vice_president', displayName: 'Nipuna Sanjeewa', position: 'Vice President', password: DEMO_PASSWORD, photoUrl: '' },
    { username: 'secretary', displayName: 'Chandima Ishan', position: 'Secretary', password: DEMO_PASSWORD, photoUrl: '' },
    { username: 'assistant_secretary', displayName: 'Milan Jeewantha', position: 'Assistant Secretary', password: DEMO_PASSWORD, photoUrl: '' },
    { username: 'treasurer', displayName: 'Gothama Nandeera', position: 'Treasurer', password: DEMO_PASSWORD, photoUrl: '' },
    { username: 'media_pr', displayName: 'Kasun Harshana', position: 'Media & Public Relations Officer', password: DEMO_PASSWORD, photoUrl: '' }
  ];
  const demoActivityLog = [];
  const demoTokens = {}; // token -> username

  function demoLog(user, action, details) {
    demoActivityLog.push({
      Timestamp: new Date().toLocaleString('en-GB'),
      Username: user.username,
      DisplayName: user.displayName,
      Position: user.position,
      Action: action,
      Details: details || ''
    });
  }

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

  async function apiGet(action, params = {}) {
    const qs = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${CONFIG.API_URL}?${qs}`, { method: 'GET' });
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
      demoAttendance.push({ ID: id, Name: member.Name, ...blankMonthObject('') });
      demoFees.push({ ID: id, Name: member.Name, ...blankMonthObject('') });
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
  // PUBLIC API — ATTENDANCE / FEES (year-aware: omit `year` for the
  // live/current year, pass a past year to read an archived snapshot)
  // -------------------------------------------------------------------

  async function fetchAttendance(year) {
    const liveYear = new Date().getFullYear();
    if (CONFIG.DEMO_MODE) {
      if (year && Number(year) !== liveYear) {
        const archive = demoArchives[year];
        if (!archive) throw new Error('No archived Attendance found for ' + year + '.');
        return JSON.parse(JSON.stringify(archive.attendance));
      }
      return JSON.parse(JSON.stringify(demoAttendance));
    }
    return apiGet('getAttendance', year ? { year } : {});
  }

  async function saveAttendance(id, month, value) {
    if (CONFIG.DEMO_MODE) {
      const row = demoAttendance.find(a => a.ID === id);
      if (row) row[month] = value;
      return { id, month, value, saved: true };
    }
    return apiPost('updateAttendance', { id, month, value });
  }

  async function fetchFees(year) {
    const liveYear = new Date().getFullYear();
    if (CONFIG.DEMO_MODE) {
      if (year && Number(year) !== liveYear) {
        const archive = demoArchives[year];
        if (!archive) throw new Error('No archived Fees found for ' + year + '.');
        return JSON.parse(JSON.stringify(archive.fees));
      }
      return JSON.parse(JSON.stringify(demoFees));
    }
    return apiGet('getFees', year ? { year } : {});
  }

  async function saveFees(id, month, value) {
    if (CONFIG.DEMO_MODE) {
      const row = demoFees.find(f => f.ID === id);
      if (row) row[month] = value;
      return { id, month, value, saved: true };
    }
    return apiPost('updateFees', { id, month, value });
  }

  async function listArchivedYears() {
    const liveYear = new Date().getFullYear();
    if (CONFIG.DEMO_MODE) {
      const years = new Set([liveYear, ...Object.keys(demoArchives).map(Number)]);
      return [...years].sort((a, b) => a - b);
    }
    return apiGet('listArchivedYears');
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

  async function startNewYear(year) {
    if (CONFIG.DEMO_MODE) {
      const archiveYear = year || new Date().getFullYear();
      if (demoArchives[archiveYear]) {
        throw new Error('An archive for ' + archiveYear + ' already exists. (Demo mode keeps this in memory only.)');
      }
      demoArchives[archiveYear] = {
        attendance: JSON.parse(JSON.stringify(demoAttendance)),
        fees: JSON.parse(JSON.stringify(demoFees))
      };
      demoAttendance.forEach(r => MONTHS.forEach(m => { r[m] = ''; }));
      demoFees.forEach(r => MONTHS.forEach(m => { r[m] = ''; }));
      return { ok: true, year: archiveYear };
    }
    return apiPost('startNewYear', { year });
  }

  // -------------------------------------------------------------------
  // PUBLIC API — USERS / LOGIN (one account per committee position —
  // the username always represents the position, never the person)
  // -------------------------------------------------------------------

  /** Public — no login needed. Used for the "who are you?" picker on the login form. */
  async function getUsersPublic() {
    if (CONFIG.DEMO_MODE) {
      return demoUsers.map(u => ({ username: u.username, displayName: u.displayName, position: u.position, photoUrl: u.photoUrl }));
    }
    return apiGet('getUsersPublic');
  }

  /** Resolves with { token, username, displayName, position, photoUrl } on success, throws on bad credentials. */
  async function login(username, password) {
    if (CONFIG.DEMO_MODE) {
      const user = demoUsers.find(u => u.username === username);
      if (!user || user.password !== password) throw new Error('Incorrect username or password.');
      const token = 'demo-token-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      demoTokens[token] = username;
      demoLog(user, 'Login', '');
      return { token, username: user.username, displayName: user.displayName, position: user.position, photoUrl: user.photoUrl };
    }
    return apiPost('login', { username, password });
  }

  async function logout(token) {
    if (CONFIG.DEMO_MODE) {
      const username = demoTokens[token];
      const user = demoUsers.find(u => u.username === username);
      if (user) demoLog(user, 'Logout', '');
      delete demoTokens[token];
      return { ok: true };
    }
    return apiPost('logout', { token });
  }

  /** username is the CURRENTLY LOGGED IN user (from auth.js) — used to find their record in demo mode. */
  async function changeOwnPassword(username, currentPassword, newPassword) {
    if (CONFIG.DEMO_MODE) {
      const user = demoUsers.find(u => u.username === username);
      if (!user) throw new Error('User not found.');
      if (user.password !== currentPassword) throw new Error('Your current password is incorrect.');
      if (!newPassword || newPassword.trim().length < 4) throw new Error('New password must be at least 4 characters.');
      user.password = newPassword;
      demoLog(user, 'Change Password', 'Changed own password');
      return { ok: true };
    }
    return apiPost('changeOwnPassword', { currentPassword, newPassword });
  }

  /** President-only. actingUsername is who's currently logged in (from auth.js). */
  async function resetUserPassword(actingUsername, targetUsername, newPassword) {
    if (CONFIG.DEMO_MODE) {
      const actingUser = demoUsers.find(u => u.username === actingUsername);
      if (!actingUser || actingUser.position !== 'President') throw new Error('Only the President account can do this.');
      const target = demoUsers.find(u => u.username === targetUsername);
      if (!target) throw new Error('User not found: ' + targetUsername);
      if (!newPassword || newPassword.trim().length < 4) throw new Error('New password must be at least 4 characters.');
      target.password = newPassword;
      demoLog(actingUser, 'Reset Password', 'Reset password for ' + targetUsername);
      return { ok: true };
    }
    return apiPost('resetUserPassword', { username: targetUsername, newPassword });
  }

  /** Self-service: updates the CALLER's own displayName/photoUrl only. */
  async function updateUserProfile(username, displayName, photoUrl) {
    if (CONFIG.DEMO_MODE) {
      const user = demoUsers.find(u => u.username === username);
      if (!user) throw new Error('User not found.');
      if (displayName && displayName.trim()) user.displayName = displayName.trim();
      if (typeof photoUrl === 'string') user.photoUrl = photoUrl.trim();
      demoLog(user, 'Update Profile', 'Updated own profile');
      return demoUsers.map(u => ({ username: u.username, displayName: u.displayName, position: u.position, photoUrl: u.photoUrl }));
    }
    return apiPost('updateUserProfile', { displayName, photoUrl });
  }

  /** Most recent first, capped at 500 rows — same shape in demo mode and real mode. */
  async function getActivityLog() {
    if (CONFIG.DEMO_MODE) {
      return [...demoActivityLog].reverse().slice(0, 500);
    }
    return apiGet('getActivityLog', { token: (typeof getAdminToken === 'function') ? getAdminToken() : '' });
  }

  return {
    fetchMembers, addMember, updateMember, deleteMember,
    fetchAttendance, saveAttendance,
    fetchFees, saveFees,
    listArchivedYears, startNewYear,
    fetchSettings, saveSettings,
    getUsersPublic, login, logout, changeOwnPassword, resetUserPassword, updateUserProfile, getActivityLog,
    MONTHS
  };
})();
