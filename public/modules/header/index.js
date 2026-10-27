export function initHeader() {
  const themeButton = document.querySelector('#themeToggle');
  const menuButton = document.querySelector('#menuToggle');
  const navigation = document.querySelector('#siteNav');
  if (!themeButton || !menuButton || !navigation) return;
  function updateThemeButton() {
    const light = document.documentElement.classList.contains('light-mode');
    themeButton.setAttribute('aria-pressed', String(light));
    themeButton.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
  }
  themeButton.addEventListener('click', () => {
    const light = document.documentElement.classList.toggle('light-mode');
    try { localStorage.setItem('theme', light ? 'light-mode' : 'dark-mode'); } catch { /* Optional persistence. */ }
    updateThemeButton();
  });
  updateThemeButton();

  function closeMenu() {
    navigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }
  menuButton.addEventListener('click', () => {
    const open = navigation.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  window.matchMedia('(min-width: 761px)').addEventListener('change', closeMenu);
}
