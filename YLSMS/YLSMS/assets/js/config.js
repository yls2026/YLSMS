/**
 * GLOBAL CONFIGURATION
 * ---------------------------------------------------------------------
 * Paste your deployed Google Apps Script Web App URL below. You get this
 * URL after Deploy > New deployment > Web app in the Apps Script editor.
 * It looks like: https://script.google.com/macros/s/XXXXXXXXXXXX/exec
 *
 * Until this is set, the app runs in DEMO MODE with sample data stored
 * only in memory, so every page works for preview purposes immediately.
 */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbx1kCrw2BD3-e3BtLwGZ1SZaoB1ohBv70yealeHMY4qAj2NiFhgpK0fRDRhmf2DXfzQ/exec',
  ORG_NAME_FALLBACK: 'Youth Lions Society',
  DEMO_MODE: true // automatically set to false once API_URL is a real URL
};

CONFIG.DEMO_MODE = !CONFIG.API_URL || CONFIG.API_URL.indexOf('PASTE_YOUR') === 0;
