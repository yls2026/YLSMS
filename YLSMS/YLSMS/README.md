# Youth Lions Society Management System (YLSMS)

A complete, free-to-run admin dashboard for managing a Youth Lions Society — members, attendance, membership fees, birthdays, and reports. Built with plain HTML5, CSS3 and JavaScript (Bootstrap 5) on the frontend, and Google Apps Script + Google Sheets as a free backend/database. Designed to be hosted on GitHub Pages at no cost.

There is only one role: **Admin**.

---

## 1. Features

- Responsive dashboard with summary cards (total/male/female members, upcoming birthdays, attendance rate, fee collection rate)
- Members module: add/edit/delete, auto-generated `YLS/YYYY/001` IDs, search, filter, sort, pagination
- Attendance register: a Jan–Dec checkbox grid per member with instant auto-save
- Membership fees tracker: a Jan–Dec Paid/Pending dropdown grid per member with instant auto-save and monthly statistics
- Birthday tracking with automatic age calculation and "today's birthday" highlighting
- Reports module: Member, Attendance, Fee Collection and Birthday reports, each exportable as PDF, Excel, or CSV
- Settings page for organization name, WhatsApp group link, fee amount, and system theme
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
│   │   ├── api.js              → API layer (talks to Apps Script / demo data)
│   │   ├── utils.js             → shared helpers (toasts, validation, dates)
│   │   ├── components.js       → loads sidebar/navbar, mobile nav
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

---

## 11. Tech Stack

HTML5 · CSS3 · Vanilla JavaScript (ES6) · Bootstrap 5 · Bootstrap Icons · Google Apps Script · Google Sheets · jsPDF · SheetJS · GitHub Pages

No paid services, frameworks, or build steps are required.
