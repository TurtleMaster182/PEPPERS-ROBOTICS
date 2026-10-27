import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPage, renderPage } from '../scripts/build.mjs';
import { initHeader } from '../public/modules/header/index.js';
import { initEvents } from '../public/modules/events/index.js';
import { initAbout } from '../public/modules/about/index.js';

const publicRoot = new URL('../public/', import.meta.url);

test('all page stylesheet, font, and JavaScript module dependencies resolve', async () => {
  const html = await renderPage();
  assert.doesNotMatch(html, /<!-- include:/);
  const queue = [...html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g)].map(match => new URL(match[1], publicRoot));
  const visited = new Set();
  while (queue.length) {
    const url = queue.pop();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const source = await readFile(url, 'utf8');
    const references = url.pathname.endsWith('.css')
      ? [...source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(match => match[1])
      : [...source.matchAll(/(?:\bfrom\s*|\bimport\s*\()\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
    for (const path of references) {
      if (/^(https?:|data:|blob:)/.test(path)) continue;
      const dependency = new URL(path, url);
      await readFile(dependency); // Includes fonts and other non-code assets.
      if (/\.(js|css)$/.test(dependency.pathname)) queue.push(dependency);
    }
  }
  assert.ok(visited.has(new URL('modules/header/index.js', publicRoot).href));
  assert.ok(visited.has(new URL('modules/details/index.js', publicRoot).href));
  assert.ok(visited.has(new URL('css/theme.css', publicRoot).href));
});

test('HTML assembly produces a complete static page and reports broken includes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'peppers-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'public/modules/example'), { recursive: true });
  const template = join(root, 'src/index.html');
  const section = join(root, 'public/modules/example/section.html');
  await writeFile(template, '<!doctype html>\n<main>\n  <!-- include: modules/example/section.html -->\n</main>');
  await writeFile(section, '<section id="example">Original</section>\n');
  await buildPage(root);
  assert.match(await readFile(join(root, 'public/index.html'), 'utf8'), /<main>\n  <section id="example">Original<\/section>\n<\/main>/);
  await writeFile(section, '<section id="example">Updated</section>\n');
  assert.match(await renderPage(root), /Updated/); // Refreshes see edits without cached fragments.
  await writeFile(template, '<!-- include: modules/missing/section.html -->');
  await assert.rejects(renderPage(root), { code: 'ENOENT' });
  await writeFile(template, '<!-- include: ../outside.html -->');
  await assert.rejects(renderPage(root), /outside public/);
  await writeFile(template, '<!-- include: modules/example/section.html -->');
  await writeFile(section, '<!-- include: modules/another/section.html -->');
  await assert.rejects(renderPage(root), /Nested includes/);
  await writeFile(template, '<main><!-- include: modules/example/section.html --></main>');
  await assert.rejects(renderPage(root), /Invalid include/);
});

// Small event-driven controls let us check section behavior without a browser or network.
function control(attributes = {}) {
  const listeners = new Map();
  const classes = new Set();
  return {
    dataset: {}, hidden: false, focused: false,
    getAttribute: name => attributes[name] ?? null,
    setAttribute: (name, value) => { attributes[name] = value; },
    classList: {
      contains: name => classes.has(name),
      remove: name => classes.delete(name),
      toggle(name) { if (classes.has(name)) { classes.delete(name); return false; } classes.add(name); return true; },
    },
    addEventListener(name, listener) { const list = listeners.get(name) || []; list.push(listener); listeners.set(name, list); },
    emit(name, event = {}) { for (const listener of listeners.get(name) || []) listener(event); },
    focus() { this.focused = true; },
  };
}
const globals = ['document', 'window', 'localStorage', 'location'];
const saved = Object.fromEntries(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
afterEach(() => {
  for (const name of globals) {
    if (saved[name]) Object.defineProperty(globalThis, name, saved[name]);
    else delete globalThis[name];
  }
});

test('header theme changes persist and the mobile menu closes on Escape and outside click', () => {
  const document = control();
  const theme = control(), menu = control(), navigation = control(), root = control(), viewport = control();
  document.documentElement = root;
  document.querySelector = selector => ({ '#themeToggle': theme, '#menuToggle': menu, '#siteNav': navigation })[selector];
  globalThis.document = document;
  globalThis.window = { matchMedia: () => viewport };
  const preferences = new Map();
  globalThis.localStorage = { setItem: (name, value) => preferences.set(name, value) };
  initHeader();
  assert.equal(theme.getAttribute('aria-label'), 'Switch to light theme');
  theme.emit('click');
  assert.equal(root.classList.contains('light-mode'), true);
  assert.equal(theme.getAttribute('aria-pressed'), 'true');
  assert.equal(theme.getAttribute('aria-label'), 'Switch to dark theme');
  assert.equal(preferences.get('theme'), 'light-mode');
  menu.emit('click');
  assert.equal(navigation.classList.contains('is-open'), true);
  document.emit('keydown', { key: 'Escape' });
  assert.equal(menu.getAttribute('aria-expanded'), 'false');
  assert.equal(menu.focused, true);
  menu.emit('click');
  document.emit('click', { target: { closest: () => null } });
  assert.equal(navigation.classList.contains('is-open'), false);
  menu.emit('click');
  viewport.emit('change');
  assert.equal(navigation.classList.contains('is-open'), false);
});

test('event filters show the matching cards and update the accessible count', () => {
  const cards = ['competition', 'community', 'competition'].map(kind => Object.assign(control(), { dataset: { eventKind: kind } }));
  const filters = ['all', 'competition', 'community'].map(kind => Object.assign(control(), { dataset: { eventFilter: kind } }));
  const status = {};
  globalThis.document = {
    querySelector: () => status,
    querySelectorAll: selector => selector === '[data-event-kind]' ? cards : filters,
  };
  initEvents();
  filters[2].emit('click');
  assert.deepEqual(cards.map(card => card.hidden), [true, false, true]);
  assert.equal(status.textContent, 'Showing 1 community event');
  assert.equal(filters[2].getAttribute('aria-pressed'), 'true');
  assert.equal(filters[0].getAttribute('aria-pressed'), 'false');
  filters[1].emit('click');
  assert.equal(status.textContent, 'Showing 2 competition events');
  filters[0].emit('click');
  assert.ok(cards.every(card => !card.hidden));
  assert.equal(status.textContent, 'Showing all 3 events');
});

test('FAQ answers open from direct hashes and internal links', () => {
  const document = control(), window = control();
  const answer = { open: false, matches: selector => selector === 'details' };
  document.getElementById = id => id === 'join-info' ? answer : null;
  globalThis.document = document;
  globalThis.window = window;
  globalThis.location = { hash: '#join-info' };
  initAbout();
  assert.equal(answer.open, true);
  answer.open = false;
  document.emit('click', { target: { closest: () => ({ getAttribute: () => '#join-info' }) } });
  assert.equal(answer.open, true);
  answer.open = false;
  window.emit('hashchange');
  assert.equal(answer.open, true);
});
