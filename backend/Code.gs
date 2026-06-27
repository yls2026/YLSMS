/**
 * ============================================================================
 *  YOUTH LIONS SOCIETY MANAGEMENT SYSTEM (YLSMS) - BACKEND
 *  Google Apps Script + Google Sheets database
 * ============================================================================
 *
 *  DEPLOYMENT NOTES (see README.md for full walkthrough):
 *  1. Create a new Google Sheet. Copy its ID from the URL.
 *  2. Open Extensions > Apps Script, paste this file as Code.gs and the
 *     contents of appsscript.json into the manifest (View > Show manifest).
 *  3. Run the `setup` function once from the editor to create all sheets
 *     and headers automatically. Grant the requested permissions.
 *  4. Deploy > New deployment > type: Web app.
 *       - Execute as: Me
 *       - Who has access: Anyone
 *  5. Copy the deployment URL into assets/js/config.js (API_URL).
 *
 *  All requests/responses use JSON. GET is used for read-only calls, POST
 *  (sent as text/plain by the frontend to avoid CORS preflight) is used for
 *  all writes.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

var SHEET_MEMBERS = 'Members';
var SHEET_ATTENDANCE = 'Attendance';
var SHEET_FEES = 'Fees';
var SHEET_SETTINGS = 'Settings';
var SHEET_USERS = 'Users';
var SHEET_ACTIVITY_LOG = 'ActivityLog';

var MEMBERS_HEADERS = ['ID', 'Position', 'Name', 'Birthday', 'Gender', 'Address', 'Email', 'Phone', 'WhatsApp'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var ATTENDANCE_HEADERS = ['ID', 'Name'].concat(MONTHS);
var FEES_HEADERS = ['ID', 'Name'].concat(MONTHS);
var USERS_HEADERS = ['Username', 'PasswordHash', 'Salt', 'DisplayName', 'Position', 'PhotoURL'];
var ACTIVITY_LOG_HEADERS = ['Timestamp', 'Username', 'DisplayName', 'Position', 'Action', 'Details'];

var DEFAULT_SETTINGS = {
  orgName: 'Youth Lions Society',
  whatsappLink: '',
  feeAmount: '500',
  theme: 'default'
};

/**
 * The 6 committee positions are permanent login accounts — the USERNAME
 * always represents the position (e.g. "president"), never the person.
 * When someone new takes over a position, don't create a new account:
 * just update that account's DisplayName/Photo (My Profile) and/or reset
 * its password (President > Manage Users). CHANGE THESE DEFAULT
 * PASSWORDS immediately after first login!
 */
var DEFAULT_USERS = [
  { username: 'president', displayName: 'Lahiru Sampath', position: 'President', password: 'changeme123' },
  { username: 'vice_president', displayName: 'Nipuna Sanjeewa', position: 'Vice President', password: 'changeme123' },
  { username: 'secretary', displayName: 'Chandima Ishan', position: 'Secretary', password: 'changeme123' },
  { username: 'assistant_secretary', displayName: 'Milan Jeewantha', position: 'Assistant Secretary', password: 'changeme123' },
  { username: 'treasurer', displayName: 'Gothama Nandeera', position: 'Treasurer', password: 'changeme123' },
  { username: 'media_pr', displayName: 'Kasun Harshana', position: 'Media & Public Relations Officer', password: 'changeme123' }
];

var USER_SESSION_SECONDS = 6 * 60 * 60; // 6 hours
var WRITE_ACTIONS_REQUIRING_AUTH = [
  'addMember', 'updateMember', 'deleteMember',
  'updateAttendance', 'updateFees',
  'saveSettings', 'startNewYear',
  'changeOwnPassword', 'resetUserPassword', 'updateUserProfile'
];

// ---------------------------------------------------------------------------
// ENTRY POINTS
// ---------------------------------------------------------------------------

function doGet(e) {
  try {
    var action = e.parameter.action;
    var result;

    switch (action) {
      case 'getMembers':
        result = getMembers();
        break;
      case 'getAttendance':
        result = getAttendance(e.parameter.year);
        break;
      case 'getFees':
        result = getFees(e.parameter.year);
        break;
      case 'getSettings':
        result = getSettings();
        break;
      case 'getUsersPublic':
        result = getUsersPublic();
        break;
      case 'listArchivedYears':
        result = listArchivedYears();
        break;
      case 'getActivityLog':
        result = getActivityLog(e.parameter.token);
        break;
      case 'ping':
        result = { ok: true, time: new Date().toISOString() };
        break;
      default:
        return jsonResponse({ success: false, error: 'Unknown or missing action: ' + action });
    }

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    var action = body.action;
    var data = body.data || {};
    var result;
    var actingUser = null;

    if (WRITE_ACTIONS_REQUIRING_AUTH.indexOf(action) > -1) {
      actingUser = requireAdmin_(body.token);
    }

    switch (action) {
      case 'addMember':
        result = addMember(data, actingUser);
        break;
      case 'updateMember':
        result = updateMember(data, actingUser);
        break;
      case 'deleteMember':
        result = deleteMember(data, actingUser);
        break;
      case 'updateAttendance':
        result = updateAttendance(data, actingUser);
        break;
      case 'updateFees':
        result = updateFees(data, actingUser);
        break;
      case 'saveSettings':
        result = saveSettings(data, actingUser);
        break;
      case 'login':
        result = login(data);
        break;
      case 'logout':
        result = logout(data);
        break;
      case 'changeOwnPassword':
        result = changeOwnPassword(data, actingUser);
        break;
      case 'resetUserPassword':
        result = resetUserPassword(data, actingUser);
        break;
      case 'updateUserProfile':
        result = updateUserProfile(data, actingUser);
        break;
      case 'startNewYear':
        result = startNewYear(data, actingUser);
        break;
      default:
        return jsonResponse({ success: false, error: 'Unknown or missing action: ' + action });
    }

    return jsonResponse({ success: true, data: result });
  } catch (err) {
    return jsonResponse({ success: false, error: err && err.message ? err.message : String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// SETUP / SHEET HELPERS
// ---------------------------------------------------------------------------

/**
 * Run this once manually from the Apps Script editor to bootstrap the
 * spreadsheet with all required sheets, headers and default settings.
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_MEMBERS, MEMBERS_HEADERS);
  ensureSheet_(ss, SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  ensureSheet_(ss, SHEET_FEES, FEES_HEADERS);
  ensureSheet_(ss, SHEET_SETTINGS, ['Setting', 'Value']);
  ensureSheet_(ss, SHEET_USERS, USERS_HEADERS);
  ensureSheet_(ss, SHEET_ACTIVITY_LOG, ACTIVITY_LOG_HEADERS);

  var settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (settingsSheet.getLastRow() < 2) {
    Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
      settingsSheet.appendRow([key, DEFAULT_SETTINGS[key]]);
    });
  }

  ensureUsersSeeded_();
  return 'Setup complete';
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ensureSheet_(ss, name, headers);
}

function sheetToObjects_(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = values.slice(1);
  return rows
    .filter(function (row) { return row.join('') !== ''; })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        obj[h] = row[i];
      });
      return obj;
    });
}

function findRowById_(sheet, id) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      return i + 1; // 1-indexed sheet row
    }
  }
  return -1;
}

// ---------------------------------------------------------------------------
// MEMBERS
// ---------------------------------------------------------------------------

function getMembers() {
  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  return sheetToObjects_(sheet).map(formatMember_);
}

function formatMember_(m) {
  if (m.Birthday instanceof Date) {
    m.Birthday = Utilities.formatDate(m.Birthday, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return m;
}

function generateMemberId_(year) {
  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  var ids = sheet.getDataRange().getValues().slice(1).map(function (r) { return String(r[0]); });
  var prefix = 'YLS/' + year + '/';
  var max = 0;
  ids.forEach(function (id) {
    if (id.indexOf(prefix) === 0) {
      var num = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  var next = max + 1;
  return prefix + ('000' + next).slice(-3);
}

function addMember(data, actingUser) {
  if (!data.Name) throw new Error('Member name is required.');

  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  var year = data.Birthday ? new Date().getFullYear() : new Date().getFullYear();
  var id = data.ID && String(data.ID).trim() !== '' ? data.ID : generateMemberId_(year);

  var phone = normalizePhone_(data.Phone);
  var whatsapp = normalizePhone_(data.WhatsApp || data.Phone);

  var row = [
    id,
    data.Position || 'Member',
    data.Name,
    data.Birthday || '',
    data.Gender || '',
    data.Address || '',
    data.Email || '',
    phone,
    whatsapp
  ];
  sheet.appendRow(row);

  // Create matching rows in Attendance and Fees so every member appears there.
  var attSheet = getSheet_(SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  attSheet.appendRow([id, data.Name].concat(MONTHS.map(function () { return ''; })));

  var feeSheet = getSheet_(SHEET_FEES, FEES_HEADERS);
  feeSheet.appendRow([id, data.Name].concat(MONTHS.map(function () { return ''; })));

  if (actingUser) logActivity_(actingUser, 'Add Member', 'Added ' + data.Name + ' (' + id + ')');

  return { ID: id, Position: row[1], Name: row[2], Birthday: row[3], Gender: row[4], Address: row[5], Email: row[6], Phone: row[7], WhatsApp: row[8] };
}

function updateMember(data, actingUser) {
  if (!data.ID) throw new Error('Member ID is required for update.');
  var sheet = getSheet_(SHEET_MEMBERS, MEMBERS_HEADERS);
  var rowIndex = findRowById_(sheet, data.ID);
  if (rowIndex === -1) throw new Error('Member not found: ' + data.ID);

  var phone = normalizePhone_(data.Phone);
  var whatsapp = normalizePhone_(data.WhatsApp || data.Phone);

  var newRow = [
    data.ID,
    data.Position || '',
    data.Name || '',
    data.Birthday || '',
    data.Gender || '',
    data.Address || '',
    data.Email || '',
    phone,
    whatsapp
  ];
  sheet.getRange(rowIndex, 1, 1, MEMBERS_HEADERS.length).setValues([newRow]);

  // Keep the Name column in sync on Attendance and Fees sheets.
  syncNameAcrossSheets_(data.ID, data.Name);

  if (actingUser) logActivity_(actingUser, 'Update Member', 'Updated ' + data.Name + ' (' + data.ID + ')');

  return { ID: data.ID, updated: true };
}

function syncNameAcrossSheets_(id, name) {
  if (!name) return;
  [SHEET_ATTENDANCE, SHEET_FEES].forEach(function (sheetName) {
    var headers = sheetName === SHEET_ATTENDANCE ? ATTENDANCE_HEADERS : FEES_HEADERS;
    var sheet = getSheet_(sheetName, headers);
    var rowIndex = findRowById_(sheet, id);
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 2).setValue(name);
    }
  });
}

function deleteMember(data, actingUser) {
  if (!data.ID) throw new Error('Member ID is required for delete.');

  [
    [SHEET_MEMBERS, MEMBERS_HEADERS],
    [SHEET_ATTENDANCE, ATTENDANCE_HEADERS],
    [SHEET_FEES, FEES_HEADERS]
  ].forEach(function (pair) {
    var sheet = getSheet_(pair[0], pair[1]);
    var rowIndex = findRowById_(sheet, data.ID);
    if (rowIndex > -1) sheet.deleteRow(rowIndex);
  });

  if (actingUser) logActivity_(actingUser, 'Delete Member', 'Deleted ' + data.ID);

  return { ID: data.ID, deleted: true };
}

function normalizePhone_(phone) {
  if (!phone) return '';
  var str = String(phone).trim();
  // Already a full international number (e.g. "+447911123456") chosen
  // via the country-code dropdown — keep it as-is.
  if (str.indexOf('+') === 0) return str;
  // Fallback for legacy/raw input with no "+": assume Sri Lanka.
  var digits = str.replace(/[^\d]/g, '');
  if (digits.indexOf('94') === 0) {
    return '+' + digits;
  }
  if (digits.indexOf('0') === 0) {
    digits = digits.substring(1);
  }
  return '+94' + digits;
}

// ---------------------------------------------------------------------------
// ATTENDANCE
// ---------------------------------------------------------------------------

function getAttendance(year) {
  var liveYear = new Date().getFullYear();
  if (year && String(year).trim() !== '' && String(year) !== String(liveYear)) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var archived = ss.getSheetByName('Attendance ' + year);
    if (!archived) throw new Error('No archived Attendance found for ' + year + '.');
    return sheetToObjects_(archived);
  }
  var sheet = getSheet_(SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  return sheetToObjects_(sheet);
}

function updateAttendance(data, actingUser) {
  // data: { id, month, value } -- value is "Present" | "Absent" | "" (blank/Empty)
  // Also accepts legacy boolean true/false for backward compatibility.
  if (!data.id || !data.month) throw new Error('id and month are required.');
  var sheet = getSheet_(SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  var rowIndex = findRowById_(sheet, data.id);
  if (rowIndex === -1) throw new Error('Member not found in Attendance: ' + data.id);

  var colIndex = ATTENDANCE_HEADERS.indexOf(data.month) + 1;
  if (colIndex < 1) throw new Error('Invalid month: ' + data.month);

  var monthIndex = MONTHS.indexOf(data.month);
  var currentMonthIndex = new Date().getMonth(); // 0 = Jan ... 11 = Dec
  if (monthIndex > currentMonthIndex) {
    throw new Error('Cannot mark attendance for a future month.');
  }

  var cellValue;
  if (data.value === true || data.value === 'true' || data.value === 'Present') {
    cellValue = 'Present';
  } else if (data.value === false || data.value === 'false' || data.value === 'Absent') {
    cellValue = 'Absent';
  } else {
    cellValue = ''; // Empty — genuinely blank cell
  }
  sheet.getRange(rowIndex, colIndex).setValue(cellValue);

  if (actingUser) {
    logActivity_(actingUser, 'Mark Attendance', data.id + ' — ' + data.month + ': ' + (cellValue || 'Empty'));
  }

  return { id: data.id, month: data.month, value: cellValue, saved: true };
}

// ---------------------------------------------------------------------------
// FEES
// ---------------------------------------------------------------------------

function getFees(year) {
  var liveYear = new Date().getFullYear();
  if (year && String(year).trim() !== '' && String(year) !== String(liveYear)) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var archived = ss.getSheetByName('Fees ' + year);
    if (!archived) throw new Error('No archived Fees found for ' + year + '.');
    return sheetToObjects_(archived);
  }
  var sheet = getSheet_(SHEET_FEES, FEES_HEADERS);
  return sheetToObjects_(sheet);
}

function updateFees(data, actingUser) {
  // data: { id, month, value } -- value is "Paid" | "Pending" | "" (blank/Empty)
  if (!data.id || !data.month) throw new Error('id and month are required.');
  var sheet = getSheet_(SHEET_FEES, FEES_HEADERS);
  var rowIndex = findRowById_(sheet, data.id);
  if (rowIndex === -1) throw new Error('Member not found in Fees: ' + data.id);

  var colIndex = FEES_HEADERS.indexOf(data.month) + 1;
  if (colIndex < 1) throw new Error('Invalid month: ' + data.month);

  var cellValue;
  if (data.value === 'Paid') {
    cellValue = 'Paid';
  } else if (!data.value) {
    cellValue = ''; // Empty — leaves the cell genuinely blank, not a text value
  } else {
    cellValue = 'Pending';
  }
  sheet.getRange(rowIndex, colIndex).setValue(cellValue);

  if (actingUser) {
    logActivity_(actingUser, 'Mark Fee', data.id + ' — ' + data.month + ': ' + (cellValue || 'Empty'));
  }

  return { id: data.id, month: data.month, value: cellValue, saved: true };
}

// ---------------------------------------------------------------------------
// SETTINGS
// ---------------------------------------------------------------------------

function getSettings() {
  return getRawSettings_();
}

function getRawSettings_() {
  var sheet = getSheet_(SHEET_SETTINGS, ['Setting', 'Value']);
  var rows = sheet.getDataRange().getValues().slice(1);
  var settings = Object.assign({}, DEFAULT_SETTINGS);
  rows.forEach(function (row) {
    if (row[0]) settings[row[0]] = row[1];
  });
  return settings;
}

function saveSettings(data, actingUser) {
  var sheet = getSheet_(SHEET_SETTINGS, ['Setting', 'Value']);
  var keys = Object.keys(DEFAULT_SETTINGS);
  keys.forEach(function (key) {
    if (typeof data[key] === 'undefined') return;
    var rowIndex = findRowById_(sheet, key);
    if (rowIndex > -1) {
      sheet.getRange(rowIndex, 2).setValue(data[key]);
    } else {
      sheet.appendRow([key, data[key]]);
    }
  });
  if (actingUser) logActivity_(actingUser, 'Save Settings', 'Updated organization settings');
  return getSettings();
}

// ---------------------------------------------------------------------------
// USERS / LOGIN / SESSIONS
// ---------------------------------------------------------------------------
//
// There are 6 permanent committee accounts (see DEFAULT_USERS) — the
// USERNAME always represents the POSITION, never the person, since
// office-holders change periodically. Passwords are stored as a salted
// SHA-256 hash, never in plain text. A correct login earns the caller a
// random session token cached server-side for a few hours; the cached
// value is the user's identity (username/displayName/position/photo) so
// every later request can know who's acting without re-reading the sheet.
// Every write action must present a still-valid token. Anyone can still
// view members, attendance, fees and birthdays without logging in.

function ensureUsersSeeded_() {
  var sheet = getSheet_(SHEET_USERS, USERS_HEADERS);
  var existingUsernames = sheet.getDataRange().getValues().slice(1).map(function (row) {
    return String(row[0]).toLowerCase();
  });
  DEFAULT_USERS.forEach(function (u) {
    if (existingUsernames.indexOf(u.username.toLowerCase()) > -1) return; // already exists, leave it alone
    var salt = generateSalt_();
    var hash = hashPassword_(u.password, salt);
    sheet.appendRow([u.username, hash, salt, u.displayName, u.position, '']);
  });
}

function generateSalt_() {
  return Utilities.getUuid();
}

function hashPassword_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + password);
  return bytes.map(function (b) {
    var v = b < 0 ? b + 256 : b;
    return (v < 16 ? '0' : '') + v.toString(16);
  }).join('');
}

function findRowByUsername_(sheet, username) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase() === String(username).toLowerCase()) return i + 1;
  }
  return -1;
}

/** Public — used to populate the "who are you?" picker on the login form. Never includes password data. */
function getUsersPublic() {
  ensureUsersSeeded_();
  var sheet = getSheet_(SHEET_USERS, USERS_HEADERS);
  return sheetToObjects_(sheet).map(function (r) {
    return { username: r.Username, displayName: r.DisplayName, position: r.Position, photoUrl: r.PhotoURL || '' };
  });
}

function login(data) {
  ensureUsersSeeded_();
  var username = data && data.username;
  var password = data && data.password;
  if (!username || !password) throw new Error('Please choose your name and enter your password.');

  var sheet = getSheet_(SHEET_USERS, USERS_HEADERS);
  var rowIndex = findRowByUsername_(sheet, username);
  if (rowIndex === -1) throw new Error('Incorrect username or password.');

  var row = sheet.getRange(rowIndex, 1, 1, USERS_HEADERS.length).getValues()[0];
  var hash = row[1], salt = row[2], displayName = row[3], position = row[4], photoUrl = row[5];
  if (hashPassword_(password, salt) !== hash) throw new Error('Incorrect username or password.');

  var token = Utilities.getUuid();
  var userInfo = { username: row[0], displayName: displayName, position: position, photoUrl: photoUrl || '' };
  CacheService.getScriptCache().put('user_session_' + token, JSON.stringify(userInfo), USER_SESSION_SECONDS);
  logActivity_(userInfo, 'Login', '');

  var result = { token: token };
  Object.keys(userInfo).forEach(function (k) { result[k] = userInfo[k]; });
  return result;
}

function logout(data) {
  var token = data && data.token;
  if (token) {
    var user = getSessionUser_(token);
    if (user) logActivity_(user, 'Logout', '');
    CacheService.getScriptCache().remove('user_session_' + token);
  }
  return { ok: true };
}

function getSessionUser_(token) {
  if (!token) return null;
  var raw = CacheService.getScriptCache().get('user_session_' + token);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/** Throws unless `token` belongs to a currently logged-in user; returns that user's identity. */
function requireAdmin_(token) {
  var user = getSessionUser_(token);
  if (!user) throw new Error('Unauthorized. Please log in to make changes.');
  return user;
}

/** Throws unless `token` belongs to the President specifically. */
function requirePresident_(token) {
  var user = requireAdmin_(token);
  if (user.position !== 'President') {
    throw new Error('Only the President account can do this.');
  }
  return user;
}

function changeOwnPassword(data, actingUser) {
  var currentPassword = data && data.currentPassword;
  var newPassword = data && data.newPassword;
  if (!newPassword || String(newPassword).trim().length < 4) {
    throw new Error('New password must be at least 4 characters.');
  }
  var sheet = getSheet_(SHEET_USERS, USERS_HEADERS);
  var rowIndex = findRowByUsername_(sheet, actingUser.username);
  if (rowIndex === -1) throw new Error('User not found.');

  var storedHash = sheet.getRange(rowIndex, 2).getValue();
  var storedSalt = sheet.getRange(rowIndex, 3).getValue();
  if (hashPassword_(currentPassword, storedSalt) !== storedHash) {
    throw new Error('Your current password is incorrect.');
  }

  var newSalt = generateSalt_();
  sheet.getRange(rowIndex, 2).setValue(hashPassword_(newPassword, newSalt));
  sheet.getRange(rowIndex, 3).setValue(newSalt);
  logActivity_(actingUser, 'Change Password', 'Changed own password');
  return { ok: true };
}

/** President-only: reset ANOTHER account's password (e.g. forgot password, or handing the role to a new officer). */
function resetUserPassword(data, actingUser) {
  if (actingUser.position !== 'President') throw new Error('Only the President account can do this.');
  var targetUsername = data && data.username;
  var newPassword = data && data.newPassword;
  if (!targetUsername) throw new Error('Username is required.');
  if (!newPassword || String(newPassword).trim().length < 4) {
    throw new Error('New password must be at least 4 characters.');
  }
  var sheet = getSheet_(SHEET_USERS, USERS_HEADERS);
  var rowIndex = findRowByUsername_(sheet, targetUsername);
  if (rowIndex === -1) throw new Error('User not found: ' + targetUsername);

  var newSalt = generateSalt_();
  sheet.getRange(rowIndex, 2).setValue(hashPassword_(newPassword, newSalt));
  sheet.getRange(rowIndex, 3).setValue(newSalt);
  logActivity_(actingUser, 'Reset Password', 'Reset password for ' + targetUsername);
  return { ok: true };
}

/** Self-service: update YOUR OWN display name / photo (e.g. a new officer taking over a position). Username/Position never change. */
function updateUserProfile(data, actingUser) {
  var sheet = getSheet_(SHEET_USERS, USERS_HEADERS);
  var rowIndex = findRowByUsername_(sheet, actingUser.username);
  if (rowIndex === -1) throw new Error('User not found.');

  if (typeof data.displayName === 'string' && data.displayName.trim()) {
    sheet.getRange(rowIndex, 4).setValue(data.displayName.trim());
  }
  if (typeof data.photoUrl === 'string') {
    sheet.getRange(rowIndex, 6).setValue(data.photoUrl.trim());
  }
  logActivity_(actingUser, 'Update Profile', 'Updated own profile');
  return getUsersPublic();
}

// ---------------------------------------------------------------------------
// ACTIVITY LOG
// ---------------------------------------------------------------------------

function logActivity_(user, action, details) {
  var sheet = getSheet_(SHEET_ACTIVITY_LOG, ACTIVITY_LOG_HEADERS);
  sheet.appendRow([new Date(), user.username, user.displayName, user.position, action, details || '']);
}

/** Any logged-in user can view the log (transparency for the whole committee). Most recent first, capped at 500 rows. */
function getActivityLog(token) {
  requireAdmin_(token);
  var sheet = getSheet_(SHEET_ACTIVITY_LOG, ACTIVITY_LOG_HEADERS);
  var rows = sheetToObjects_(sheet);
  rows.forEach(function (r) {
    if (r.Timestamp instanceof Date) {
      r.Timestamp = Utilities.formatDate(r.Timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    }
  });
  rows.reverse();
  return rows.slice(0, 500);
}

// ---------------------------------------------------------------------------
// START NEW YEAR
// ---------------------------------------------------------------------------
//
// Attendance/Fees have no "year" column — the Jan-Dec columns always mean
// "this year". To roll over into a new year: copy the current Attendance
// and Fees sheets into dated archive sheets (e.g. "Attendance 2026"), then
// wipe the Jan-Dec values on the live sheets (keeping every member's ID
// and Name) so the new year starts blank/Empty for everyone.

function startNewYear(data, actingUser) {
  var year = (data && data.year) ? String(data.year).trim() : String(new Date().getFullYear());
  if (!/^\d{4}$/.test(year)) throw new Error('Please provide a valid 4-digit year.');

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  archiveSheet_(ss, SHEET_ATTENDANCE, 'Attendance ' + year);
  archiveSheet_(ss, SHEET_FEES, 'Fees ' + year);

  clearMonthlyValues_(SHEET_ATTENDANCE, ATTENDANCE_HEADERS);
  clearMonthlyValues_(SHEET_FEES, FEES_HEADERS);

  if (actingUser) logActivity_(actingUser, 'Start New Year', 'Archived ' + year + ' and reset live Attendance/Fees sheets');

  return { ok: true, year: year };
}

/**
 * Years the Attendance/Fees year-picker can navigate to: the current
 * (live, editable) year plus every year that has an "Attendance YYYY"
 * archive sheet from a previous Start New Year run.
 */
function listArchivedYears() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var liveYear = new Date().getFullYear();
  var years = {};
  years[liveYear] = true;
  ss.getSheets().forEach(function (sheet) {
    var match = /^Attendance (\d{4})$/.exec(sheet.getName());
    if (match) years[match[1]] = true;
  });
  return Object.keys(years).map(Number).sort(function (a, b) { return a - b; });
}

function archiveSheet_(ss, sourceName, archiveName) {
  if (ss.getSheetByName(archiveName)) {
    throw new Error('An archive sheet named "' + archiveName + '" already exists. Rename or delete it first if you want to redo this.');
  }
  var source = ss.getSheetByName(sourceName);
  if (!source) throw new Error('Sheet not found: ' + sourceName);
  var copy = source.copyTo(ss);
  copy.setName(archiveName);
}

function clearMonthlyValues_(sheetName, headers) {
  var sheet = getSheet_(sheetName, headers);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return; // no member rows yet
  var monthStartCol = 3; // 1 = ID, 2 = Name, 3..14 = Jan..Dec
  var numMonthCols = headers.length - 2;
  sheet.getRange(2, monthStartCol, lastRow - 1, numMonthCols).clearContent();
}
