import { initDetails } from './details.js';

const themeButton = document.querySelector('#themeToggle');
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

const menuButton = document.querySelector('#menuToggle');
const navigation = document.querySelector('#siteNav');
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

initDetails();

// Each discipline has an accessible tab, including arrow-key navigation.
const teamTabs = [...document.querySelectorAll('.team-tabs [role="tab"]')];
function selectDiscipline(selected) {
  teamTabs.forEach(tab => {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
teamTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectDiscipline(tab));
  tab.addEventListener('keydown', event => {
    const next = { ArrowDown: (index + 1) % teamTabs.length, ArrowUp: (index + teamTabs.length - 1) % teamTabs.length, Home: 0, End: teamTabs.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectDiscipline(teamTabs[next]);
    teamTabs[next].focus();
  });
});

const eventCards = [...document.querySelectorAll('[data-event-kind]')];
const filters = [...document.querySelectorAll('[data-event-filter]')];
filters.forEach(button => button.addEventListener('click', () => {
  filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
  const kind = button.dataset.eventFilter;
  eventCards.forEach(card => { card.hidden = kind !== 'all' && card.dataset.eventKind !== kind; });
  const count = eventCards.filter(card => !card.hidden).length;
  document.querySelector('#eventFilterStatus').textContent = kind === 'all' ? `Showing all ${count} events` : `Showing ${count} ${kind} ${count === 1 ? 'event' : 'events'}`;
}));

// Links into the joining section open the relevant answer before scrolling.
function openLinkedAnswer(hash) {
  const target = document.getElementById(hash.slice(1));
  if (target?.matches('details')) target.open = true;
}
document.addEventListener('click', event => {
  const href = event.target.closest('a')?.getAttribute('href');
  if (href?.startsWith('#')) openLinkedAnswer(href);
});
window.addEventListener('hashchange', () => openLinkedAnswer(location.hash));
openLinkedAnswer(location.hash);

document.querySelectorAll('[data-open-chat]').forEach(button => button.addEventListener('click', () => {
  const launcher = document.querySelector('#ftc-chat-button');
  if (launcher?.getAttribute('aria-expanded') !== 'true') launcher?.click();
  document.querySelector('#ftc-chat-input')?.focus();
}));
