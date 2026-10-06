import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const publicRoot = new URL('../public/', import.meta.url);
const html = readFileSync(new URL('index.html', publicRoot), 'utf8');
const seasons = JSON.parse(readFileSync(new URL('data/seasons.json', publicRoot), 'utf8'));
const albums = JSON.parse(readFileSync(new URL('data/albums.json', publicRoot), 'utf8'));
const values = name => [...html.matchAll(new RegExp(`\\s${name}="([^"]+)"`, 'g'))].map(match => match[1]);

test('page anchors and local resources resolve, with no duplicate IDs or dead links', () => {
  const ids = values('id');
  assert.equal(ids.length, new Set(ids).size);
  for (const path of [...values('src'), ...values('href')]) {
    if (path.startsWith('#')) assert.ok(ids.includes(path.slice(1)), `Missing anchor: ${path}`);
    else if (path.startsWith('mailto:')) assert.match(new URL(path).pathname, /^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    else if (!path.startsWith('https:')) assert.ok(existsSync(new URL(path, publicRoot)), `Missing asset: ${path}`);
  }
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(html, /href="#"|mailto:[^"]*\.example|Lorem ipsum/);
  for (const id of values('aria-controls')) assert.ok(ids.includes(id), `Missing controlled panel: ${id}`);
  for (const id of values('data-season-target')) assert.ok(seasons[id], `Missing featured build: ${id}`);
});

test('every season has a gallery entry and every local gallery asset exists', () => {
  assert.deepEqual(values('data-season-id').sort(), Object.keys(seasons).sort());
  assert.deepEqual(values('data-open-album').sort(), Object.keys(albums).sort());
  for (const season of [...Object.values(seasons), ...Object.values(albums)]) {
    if (season.model) assert.ok(existsSync(new URL(season.model, publicRoot)));
    for (const item of season.media) {
      assert.ok(item.alt, 'Gallery media needs an accessible description');
      if (!item.src.startsWith('https:')) assert.ok(existsSync(new URL(item.src, publicRoot)));
    }
  }
});

test('upcoming event cards have valid dates and matching category controls', () => {
  const kinds = values('data-event-kind');
  const filters = values('data-event-filter');
  assert.ok(kinds.length > 0, 'The upcoming events list must remain populated');
  assert.ok(filters.includes('all'));
  for (const kind of kinds) assert.ok(filters.includes(kind), `Missing event filter: ${kind}`);
  const dates = values('datetime');
  assert.equal(dates.length, kinds.length);
  for (const date of dates) {
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(date).toISOString().slice(0, 10), date);
  }
});

test('the permanent Coming Soon pug retains its ID, image, and popup entry', () => {
  const pug = 'https://picsum.photos/id/1025/700/440';
  assert.match(html, /id="coming-soon" data-season-id="coming-soon"/);
  assert.ok(html.includes(pug));
  assert.equal(seasons['coming-soon'].media[0].src, pug);
});

test('3D libraries stay deferred and their pinned URLs are permitted by CSP', () => {
  assert.doesNotMatch(html, /<script[^>]+(?:three|GLTFLoader)/);
  const viewer = readFileSync(new URL('js/viewer.js', publicRoot), 'utf8');
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const csp = config.headers[0].headers.find(item => item.key === 'Content-Security-Policy').value;
  const urls = [...viewer.matchAll(/loadScript\('(https:[^']+)', '(sha384-[^']+)'\)/g)];
  assert.equal(urls.length, 2);
  for (const [, url] of urls) assert.ok(csp.includes(url));
});
