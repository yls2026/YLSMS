# Youth Lions Society Management System (YLSMS)

A complete, free-to-run admin dashboard for managing a Youth Lions Society — members, attendance, membership fees, birthdays, and reports. Built with plain HTML5, CSS3 and JavaScript (Bootstrap 5) on the frontend, and Google Apps Script + Google Sheets as a free backend/database. Designed to be hosted on GitHub Pages at no cost.

There are two access levels: anyone can **view** members, attendance, fees and birthdays without logging in, while logging in as one of **6 committee accounts** (President, Vice President, Secretary, Assistant Secretary, Treasurer, Media & PR Officer) is required to add, edit, delete, or mark anything — every change is recorded in an Activity Log.

---

## 1. Features

- Responsive dashboard with summary cards (total/male/female members, upcoming birthdays, attendance rate, fee collection rate)
- **Public view / Committee edit:** anyone can browse members, member numbers, attendance and fee records, and birthdays without logging in. Adding, editing, deleting, or marking attendance/fees requires logging in as one of 6 committee accounts (see §4a below).
- **Year archiving & browsing:** Attendance and Fees have a `< 2026 >` style year switcher — click "Start New Year" on Settings to archive the current year and start the next one blank; flip back to any past year to view it (read-only).
- **Activity Log:** every login, logout, and change (add/edit/delete member, mark attendance/fee, settings change, password reset, etc.) is recorded with who/when/what — viewable and exportable from Reports → Activity Log.
- Members module: add/edit/delete, auto-generated `YLS/YYYY/001` IDs, search, filter, sort, pagination
- **Configurable phone country codes:** the Add/Edit Member form has a country-code dropdown (defaults to 🇱🇰 +94 Sri Lanka) instead of a fixed prefix — add or remove countries in `assets/js/countryCodes.js`
- Attendance register: a Jan–Dec checkbox grid per member with instant auto-save
- Membership fees tracker: a Jan–Dec Paid/Pending dropdown grid per member with instant auto-save and monthly statistics
- Birthday tracking with automatic age calculation and "today's birthday" highlighting
- Reports module: Member, Attendance, Fee Collection and Birthday reports, each exportable as PDF, Excel, or CSV
- Settings page for organization name, WhatsApp group link, fee amount, system theme, your own profile/password (My Profile), and — President only — resetting another committee account's password (Manage Committee Accounts)
- Works fully in **demo mode** out of the box (sample data, no backend needed) so you can preview every screen immediately

---

## 2. Folder Structure

```
/
├── index.html                  → redirects to pages/dashboard.html
├── assets/
│   ├── css/style.css           → theme, layout, components
│   ├── js/
│   │   ├── config.js           → API URL + demo mode toggle
│   │   ├── auth.js             → Admin login/logout, session token, view-vs-edit UI gating
│   │   ├── countryCodes.js     → list of country calling codes for the phone fields
│   │   ├── api.js              → API layer (talks to Apps Script / demo data)
│   │   ├── utils.js             → shared helpers (toasts, validation, dates)
│   │   ├── components.js       → loads sidebar/navbar, mobile nav, wires admin login UI
│   │   ├── dashboard.js / members.js / attendance.js / fees.js / reports.js / settings.js
│   ├── icons/                  → put a favicon/logo here
│   └── images/                 → put screenshots/images here
├── pages/
│   ├── dashboard.html
│   ├── members.html
│   ├── attendance.html
│   ├── fees.html
│   ├── reports.html
│   └── settings.html
├── components/
│   ├── sidebar.html
│   └── navbar.html
├── backend/
│   ├── Code.gs                 → Apps Script backend (paste into the Apps Script editor)
│   └── appsscript.json         → Apps Script manifest
└── README.md
```

---

## 3. Quick Start (Demo Mode)

The project works immediately without any setup: open `index.html` (or upload it to GitHub Pages) and every page runs on sample, in-memory data. A gold banner at the top of each page reminds you that you're in demo mode. This is the fastest way to see the design before connecting a real spreadsheet.

To go live with your own data, follow the steps below.

---

## 4a. Committee Login & Public View

YLSMS has 6 permanent login accounts — one per committee position, **not** one per person:

| Username | Position | Default display name |
|---|---|---|
| `president` | President | Lahiru Sampath |
| `vice_president` | Vice President | Nipuna Sanjeewa |
| `secretary` | Secretary | Chandima Ishan |
| `assistant_secretary` | Assistant Secretary | Milan Jeewantha |
| `treasurer` | Treasurer | Gothama Nandeera |
| `media_pr` | Media & Public Relations Officer | Kasun Harshana |

The **username always represents the position**, never the person — because office-holders change every year or two. When someone new takes over a position:
1. They log in with that position's existing username + password (ask the outgoing officer or the President for it).
2. They go to **Settings → My Profile** and update the Display Name (and optionally a Photo URL) to themselves — the username and position never change.
3. They go to **Settings → Change My Password** to set a password only they know.

If they don't know the current password, the **President** can reset it for them from **Settings → Manage Committee Accounts** (President-only).

- **Anyone** who opens the site can view the Members list, member numbers, attendance records, fee records, and birthdays — no login needed.
- To **add, edit, or delete** a member, mark attendance, mark fee status, change Settings, or start a new year, you must log in as one of the 6 accounts (top-right of the navbar, or the chip at the bottom of the sidebar — pick your name, enter your password).
- Every account's default password is **`changeme123`**. **Change it immediately** after your first deployment (Settings → Change My Password).
- A login lasts for the current browser session (about 6 hours, or until you close the tab/browser or tap **Logout**).
- In **demo mode** (no backend connected yet), every account uses the fixed demo password `changeme123` shown right on the login form — this is for previewing the UI only and never touches real data.
- Even if someone tampered with the page's JavaScript in their browser, the Apps Script backend independently re-checks the session token on every write request, so guest visitors can't write data no matter what they do in the browser.
- Passwords are never stored in plain text — they're salted and SHA-256 hashed in the `Users` sheet.
- Every login, logout, and change is recorded in the `ActivityLog` sheet (who, when, what) — viewable and exportable from **Reports → Activity Log**.

---

## 4b. Year Archiving (Attendance & Fees)

Attendance and Fees don't have a year column — the Jan-Dec columns always mean "the current year". The `< 2026 >` arrows above the Attendance/Fees tables let you browse past years once they exist:

1. When a year ends, go to **Settings → Start New Year**, confirm the year to archive, and submit.
2. This copies the live `Attendance`/`Fees` sheets to `Attendance 2026`/`Fees 2026` (read-only archives) and clears Jan-Dec back to blank on the live sheets — member records are never touched.
3. The `< >` arrows on the Attendance/Fees pages now let everyone flip back to 2026 (view-only) or forward to the live year (editable, if logged in).

---

## 4. Google Sheets Setup

1. Go to [sheets.google.com](https://sheets.google.com) and create a new, blank spreadsheet. Name it e.g. **"YLSMS Database"**.
2. You do **not** need to create any tabs or headers by hand — the backend script creates the `Members`, `Attendance`, `Fees`, and `Settings` sheets automatically the first time it runs (see step 2 below).

---

## 5. Google Apps Script Deployment

1. In your new spreadsheet, open **Extensions → Apps Script**.
2. Delete the default empty `Code.gs` content and paste in the entire contents of `backend/Code.gs` from this project.
3. Click the gear icon (Project Settings) → check **"Show appsscript.json manifest file in editor"**. Open the manifest and replace its contents with `backend/appsscript.json` from this project.
4. Back in the editor, select the `setup` function from the function dropdown at the top and click **Run**. The first run will ask you to authorize permissions — review and accept them (you'll see an "unverified app" warning since this is your own private script; click **Advanced → Go to project (unsafe) → Allow**, this is expected and safe for a script you control).
5. After it runs once, check your spreadsheet — you should now see four new tabs: `Members`, `Attendance`, `Fees`, `Settings`.
6. Click **Deploy → New deployment**.
   - Select type: **Web app**
   - Description: `YLSMS API`
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy**, then **Authorize access** again if prompted.
8. Copy the **Web app URL** shown (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).

> **Re-deploying:** Any time you change `Code.gs`, you must create a **New deployment** (or use "Manage deployments → Edit → New version") for the changes to take effect on the live URL.

---

## 6. Connect the Frontend to Your Backend

1. Open `assets/js/config.js`.
2. Replace the placeholder with your deployment URL:
   ```js
   const CONFIG = {
     API_URL: 'https://script.google.com/macros/s/PASTE_YOUR_ID_HERE/exec',
     ORG_NAME_FALLBACK: 'Youth Lions Society',
     DEMO_MODE: true
   };
   ```
3. Save the file. `DEMO_MODE` will automatically switch to `false` once a real URL is present — you don't need to edit that line yourself.

---

## 7. GitHub Pages Deployment

1. Create a new GitHub repository (e.g. `ylsms`) and push the entire project folder to it, keeping the folder structure intact.
2. In the repository, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to **Deploy from a branch**, choose the `main` branch and the `/ (root)` folder, then **Save**.
4. After a minute, GitHub will show your live URL, e.g. `https://yourusername.github.io/ylsms/`.
5. Visit that URL — it will redirect to the dashboard automatically.

---

## 8. Member ID Rules

- Format: `YLS/YYYY/NNN` (e.g. `YLS/2026/001`).
- The next number is auto-suggested when you open "Add Member", based on the highest existing ID for the current year.
- The suggested ID is editable before saving, and leading zeros are always preserved (`001`, `010`, `100`).

---

## 9. Screenshots

Add your own screenshots to `assets/images/` and reference them here, for example:

```
![Dashboard](assets/images/dashboard.png)
![Members](assets/images/members.png)
![Attendance](assets/images/attendance.png)
```

---

## 10. Troubleshooting

**The app shows the gold "demo mode" banner even after I added my URL.**
Make sure `CONFIG.API_URL` in `assets/js/config.js` doesn't start with `PASTE_YOUR` and has no extra spaces or quotes missing.

**I get a generic network/fetch error when saving data.**
Confirm the Apps Script deployment's "Who has access" is set to **Anyone**, and that you copied the `/exec` URL (not the `/dev` editor URL).

**Changes I make in the Apps Script editor don't show up.**
You must create a **new deployment version** after editing `Code.gs` — saving the file alone does not update the live web app.

**Attendance/fee checkboxes don't save.**
Open your browser's developer console (F12) for the exact error. The most common cause is an outdated deployment URL or a spreadsheet that was deleted/moved after deployment.

**PDF/Excel export buttons don't do anything.**
These features rely on the jsPDF and SheetJS CDN scripts loaded on the Reports page — make sure you have an internet connection, since they're not bundled locally.

**The sidebar doesn't appear on a page.**
Each page under `/pages/` loads `components/sidebar.html` and `components/navbar.html` via `fetch()`, so this project must be served over `http://` or `https://` (e.g. GitHub Pages, or a local server like `npx serve`) — opening the HTML file directly via `file://` will block those fetch requests in most browsers.

**I want to change the color theme.**
Go to **Settings → System Theme** for the three built-in options, or edit the CSS variables at the top of `assets/css/style.css` for full custom control.

**"Unauthorized. Please log in to make changes" when saving.**
Your login session expired (sessions last ~6 hours) or you're not logged in yet — click **Log In** in the navbar/sidebar, pick your name, and enter your password again.

**I forgot my password / a former officer's account is locked.**
Log in as the **President** account, go to **Settings → Manage Committee Accounts**, pick the account, and reset its password. If even the President's password is lost, open your Google Sheet directly, go to the `Users` tab, and delete that account's row entirely — the next page load auto-recreates any missing default account with the original default password (`changeme123`), which you can then change normally.

**I want to add/remove a country in the phone dropdown.**
Edit the `COUNTRY_CODES` array at the top of `assets/js/countryCodes.js` — every dropdown and the phone-parsing logic for editing existing members reads from that single list.

---

## 11a. Security Note

This password gate is designed for a small club's honor-system needs, not bank-grade security: 6 shared committee accounts manage the club, and the Apps Script web app is reachable by anyone on the internet. For better protection:
- Pick passwords that aren't easily guessed, and have the President reset an account's password whenever its holder's term ends.
- Treat the Google Sheet itself as the source of truth — only share *edit* access to it with people you trust, since anyone with sheet access can read the `Users` tab's password hashes (though not recover the actual passwords from them) or read the full `ActivityLog`.
- Passwords are salted + SHA-256 hashed before being stored — never in plain text — but this still isn't audited, professional-grade cryptography; don't reuse a sensitive password here.
- This system does not encrypt data in transit beyond standard HTTPS. Every write is attributed to a specific committee account in the Activity Log, but since accounts are shared by position (not by person), the log identifies *which position* made a change, not necessarily *which individual* was logged in at the time.

---

## 11. Tech Stack

HTML5 · CSS3 · Vanilla JavaScript (ES6) · Bootstrap 5 · Bootstrap Icons · Google Apps Script · Google Sheets · jsPDF · SheetJS · GitHub Pages

No paid services, frameworks, or build steps are required.
