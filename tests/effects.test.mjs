import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPage } from '../scripts/build.mjs';
import { scrollProgress } from '../public/js/scroll-fx.js';
import { FLAME_PALETTE, flameIntensity, scrollFlare, feedFire, spreadFire } from '../public/js/heat-flames.js';
import { swingStep, stringLength, isResting } from '../public/js/hanging-peppers.js';
import { initShowcase } from '../public/modules/showcase/index.js';

test('scroll progress runs from 0 at the top to 1 at the bottom, including short pages', () => {
  assert.equal(scrollProgress(0, 3000, 1000), 0);
  assert.equal(scrollProgress(1000, 3000, 1000), 0.5);
  assert.equal(scrollProgress(5000, 3000, 1000), 1);
  assert.equal(scrollProgress(0, 800, 1000), 1);
});

test('flames are embers while reading and a full fire once the footer is on screen', () => {
  assert.equal(FLAME_PALETTE.length, 37);
  assert.deepEqual(FLAME_PALETTE[0], [0, 0, 0, 0]);
  assert.ok(flameIntensity(0) < 0.2);
  assert.ok(flameIntensity(0.9, 0) < 0.5, 'mid-page flames must not cover content');
  assert.equal(flameIntensity(1, 1), 1);
  assert.ok(flameIntensity(0.5) > flameIntensity(0.2));
  assert.equal(scrollFlare(1000), 0.3);
  assert.equal(scrollFlare(-1000), 0.3);
});

test('heat rises from the fed bottom row, cools, and stays within the palette', () => {
  const columns = 40, rows = 30;
  const fire = new Uint8Array(columns * rows);
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let step = 0; step < 60; step++) {
    feedFire(fire, columns, rows, 1, random);
    spreadFire(fire, columns, rows, random);
  }
  assert.ok(fire.every(value => value >= 0 && value <= 36));
  const rowHeat = y => fire.slice(y * columns, (y + 1) * columns).reduce((a, b) => a + b, 0);
  assert.ok(rowHeat(rows - 2) > rowHeat(rows - 12), 'flames are hotter near the base');
  assert.ok(rowHeat(rows - 12) > 0, 'flames rise above the base');
  feedFire(fire, columns, rows, 0, () => 0.99);
  assert.ok(fire.slice((rows - 1) * columns).every(value => value === 0));
});

test('hanging peppers swing back to rest and tuck up as the page scrolls', () => {
  const state = { angle: 0.8, speed: 0 };
  let crossed = false;
  for (let i = 0; i < 60; i++) {
    swingStep(state, 1 / 60, 60);
    if (state.angle < 0) crossed = true;
  }
  assert.ok(crossed, 'a released pepper swings through the middle');
  for (let i = 0; i < 1200; i++) swingStep(state, 1 / 60, 60);
  assert.ok(isResting(state));
  swingStep(state, 1 / 60, 60, 5000);
  assert.ok(Math.abs(state.angle) <= 1.25);
  assert.equal(stringLength(100, 0, 900), 100);
  assert.equal(Math.round(stringLength(100, 5000, 900)), 40);
});

const saved = Object.getOwnPropertyDescriptor(globalThis, 'document');
afterEach(() => { if (saved) Object.defineProperty(globalThis, 'document', saved); else delete globalThis.document; });

test('project and award tabs switch panels by click and arrow keys', () => {
  const panels = { 'panel-projects': { hidden: false }, 'panel-awards': { hidden: false } };
  const tab = (controls, selected) => {
    const attributes = { 'aria-controls': controls, 'aria-selected': selected };
    const listeners = {};
    return {
      focused: false,
      getAttribute: name => attributes[name] ?? null,
      setAttribute: (name, value) => { attributes[name] = value; },
      addEventListener: (name, listener) => { listeners[name] = listener; },
      emit: (name, event = {}) => listeners[name]({ preventDefault() {}, ...event }),
      focus() { this.focused = true; }
    };
  };
  const tabs = [tab('panel-projects', 'true'), tab('panel-awards', 'false')];
  globalThis.document = { querySelectorAll: () => tabs, getElementById: id => panels[id] };
  initShowcase();
  assert.equal(panels['panel-awards'].hidden, true);
  tabs[1].emit('click');
  assert.equal(panels['panel-projects'].hidden, true);
  assert.equal(panels['panel-awards'].hidden, false);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0].getAttribute('tabindex'), '-1');
  tabs[1].emit('keydown', { key: 'ArrowRight' });
  assert.equal(tabs[0].getAttribute('aria-selected'), 'true');
  assert.equal(tabs[0].focused, true);
});

test('sponsor bar, benefits table, and showcase counts are consistent', async () => {
  const html = await renderPage();
  const chips = [...html.matchAll(/<a class="sponsor-chip[^"]*" href="([^"]+)" data-sponsor-tier="([^"]+)"><span class="sponsor-logo">(.+?)<\/span><span class="sponsor-info">(.+?)<\/span><\/a>/g)];
  assert.ok(chips.length >= 3, 'the sponsor bar needs enough items to scroll');
  assert.equal(chips.length, (html.match(/class="sponsor-chip/g) || []).length, 'every sponsor needs a tier, name, and info line');
  const table = html.match(/<table class="tier-table">([\s\S]+?)<\/table>/)[1];
  const tiers = (table.match(/<thead>[\s\S]+?<\/thead>/)[0].match(/<th scope="col">/g) || []).length - 1;
  for (const row of table.match(/<tr><th scope="row">.+?<\/tr>/g)) assert.equal((row.match(/<td>/g) || []).length, tiers);
  assert.match(html, /data-subscribe/);
  const projects = (html.match(/class="project-card"/g) || []).length;
  const awards = html.match(/<ol class="award-list">([\s\S]+?)<\/ol>/)[1].match(/<li/g).length;
  assert.match(html, new RegExp(`Projects <span>${projects}</span>`));
  assert.match(html, new RegExp(`Awards <span>${awards}</span>`));
  const facts = readFileSync(new URL('../lib/team-info.mjs', import.meta.url), 'utf8');
  assert.equal(awards, (facts.match(/\{ season: '/g) || []).length, 'awards should match the bot’s team facts');
});
