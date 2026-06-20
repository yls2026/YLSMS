/**
 * COMPONENT LOADER
 * Fetches the shared sidebar/navbar partials and injects them into every
 * page, then wires up active-link highlighting, the mobile offcanvas
 * toggle, and the organization name in the navbar.
 */

async function loadComponent(url, placeholderId) {
  const placeholder = document.getElementById(placeholderId);
  if (!placeholder) return;
  try {
    const res = await fetch(url);
    placeholder.innerHTML = await res.text();
  } catch (err) {
    console.error('Failed to load component:', url, err);
  }
}

function highlightActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href.endsWith(current)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function initSidebarToggle() {
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggleButtons = document.querySelectorAll('.sidebar-toggle-btn');

  const openSidebar = () => {
    sidebar?.classList.add('show');
    backdrop?.classList.add('show');
  };
  const closeSidebar = () => {
    sidebar?.classList.remove('show');
    backdrop?.classList.remove('show');
  };

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebar?.classList.contains('show') ? closeSidebar() : openSidebar();
    });
  });
  backdrop?.addEventListener('click', closeSidebar);
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 992) closeSidebar();
    });
  });
}

async function setNavbarOrgName() {
  const el = document.getElementById('navOrgName');
  try {
    const settings = await Api.fetchSettings();
    if (el) el.textContent = settings.orgName || CONFIG.ORG_NAME_FALLBACK;
    if (settings.theme && settings.theme !== 'default') {
      document.body.setAttribute('data-theme', settings.theme);
    }
  } catch {
    if (el) el.textContent = CONFIG.ORG_NAME_FALLBACK;
  }
}

function showDemoBanner() {
  if (!CONFIG.DEMO_MODE) return;
  const banner = document.getElementById('demoModeBanner');
  if (banner) banner.classList.remove('d-none');
}

/**
 * Call this once near the top of every page after the DOM is ready.
 * @param {string} basePath '../' from /pages/*.html, '' from root index.html
 */
async function initLayout(basePath) {
  await Promise.all([
    loadComponent(basePath + 'components/sidebar.html', 'sidebar-placeholder'),
    loadComponent(basePath + 'components/navbar.html', 'navbar-placeholder')
  ]);
  highlightActiveNav();
  initSidebarToggle();
  setNavbarOrgName();
  showDemoBanner();
  wireAuthUI();
  applyAuthUI();
}
