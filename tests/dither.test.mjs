import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ditherCellSize, initDitherReveals } from '../public/js/dither-reveal.js';
import { generateInkArrival } from '../public/js/ink-field.js';
import { randomInkStart, requestInkField } from '../public/js/ink-solver.js';
import { initViewportPhotos, loadViewportPhoto } from '../public/js/viewport-photos.js';
import { writeDitherPattern, DITHER_STAGE_STEP } from '../public/js/dither-pattern.js';

test('each cell follows the exact four reference patterns before filling its corners', () => {
  const data = new Uint8ClampedArray(5 * 5 * 4);
  writeDitherPattern(data, new Uint8Array([1]), 1, 1);
  const stages = [
    ['.....', '.....', '..#..', '.....', '.....'],
    ['.....', '..#..', '.###.', '..#..', '.....'],
    ['.....', '.###.', '.###.', '.###.', '.....'],
    ['.###.', '#####', '#####', '#####', '.###.'],
    ['#####', '#####', '#####', '#####', '#####']
  ];
  for (let stage = 0; stage < stages.length; stage++) {
    const level = 1 + stage * DITHER_STAGE_STEP;
    const actual = Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 5 }, (_, x) => data[(y * 5 + x) * 4 + 3] <= level ? '#' : '.').join(''));
    assert.deepEqual(actual, stages[stage]);
  }
});

test('adjacent cells keep their own fluid arrival times and all stages finish before cleanup', () => {
  const arrivals = new Uint8Array([1, 252, 90, 160]);
  const data = new Uint8ClampedArray(10 * 10 * 4);
  writeDitherPattern(data, arrivals, 2, 2);
  const alpha = (x, y) => data[(y * 10 + x) * 4 + 3];
  assert.equal(alpha(2, 2), 1);
  assert.equal(alpha(7, 2), 185);
  assert.equal(alpha(5, 0), 253);
  assert.ok(alpha(2, 7) > alpha(2, 2) && alpha(7, 7) > alpha(2, 7));
  for (let i = 0; i < data.length; i += 4) {
    assert.equal(data[i], 255);
    assert.ok(data[i + 3] >= 1 && data[i + 3] <= 253);
  }
  assert.throws(() => writeDitherPattern(new Uint8ClampedArray(4), arrivals, 2, 2), RangeError);
});

test('independent draws choose the origin column, row, and flow seed', () => {
  const draws = [.2, .8, .123];
  assert.deepEqual(randomInkStart(100, 50, () => draws.shift()),
    { originX: 20, originY: 40, seed: Math.floor(.123 * 4294967296) });
  assert.equal(draws.length, 0);
});

test('the exact n by m field grows from its origin, fills completely, and changes with flow seed', () => {
  const columns = 71, rows = 49, x = 11, y = 32;
  const a = generateInkArrival(columns, rows, x, y, 42);
  assert.equal(a.length, columns * rows);
  assert.equal(a[y * columns + x], 1);
  assert.ok(a.every(t => Number.isFinite(t) && t >= 1 && t <= 252));
  assert.deepEqual(a, generateInkArrival(columns, rows, x, y, 42));
  assert.notDeepEqual(a, generateInkArrival(columns, rows, x, y, 43));
  assert.notDeepEqual(a, generateInkArrival(columns, rows, 60, 4, 42));
  // Every visible cell must be connected to the origin at every tested stage.
  for (const threshold of [1, 30, 80, 150, 220, 252]) {
    const seen = new Set([y * columns + x]), queue = [...seen];
    for (let n = 0; n < queue.length; n++) {
      const i = queue[n], px = i % columns, py = Math.floor(i / columns);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (px + dx < 0 || px + dx >= columns || py + dy < 0 || py + dy >= rows) continue;
        const j = (py + dy) * columns + px + dx;
        if (!seen.has(j) && a[j] <= threshold) { seen.add(j); queue.push(j); }
      }
    }
    assert.equal(seen.size, a.filter(t => t <= threshold).length);
  }
});

test('single cells, narrow strips and edge origins have finite arrival times', () => {
  for (const [w, h, x, y] of [[1, 1, 0, 0], [1, 45, 0, 44], [1, 600, 0, 300], [80, 1, 79, 0], [80, 30, 0, 0]]) {
    const field = generateInkArrival(w, h, x, y, 0);
    assert.equal(field.length, w * h);
    assert.ok(field.every(t => t >= 1 && t <= 252));
    assert.equal(field[y * w + x], 1);
  }
  assert.throws(() => generateInkArrival(0, 5, 0, 0, 0), RangeError);
});

test('early growth sends sparse branches far ahead of the filled area', () => {
  const columns = 220, rows = 130, originX = 95, originY = 92;
  for (const seed of [17, 42, 89]) {
    const field = generateInkArrival(columns, rows, originX, originY, seed);
    let filled = 0, reach = 0;
    for (let i = 0; i < field.length; i++) {
      if (field[i] > 50) continue;
      filled++;
      reach = Math.max(reach, Math.hypot(i % columns - originX, Math.floor(i / columns) - originY));
    }
    assert.ok(reach > rows * .6, 'tips should extend well beyond a small central blob');
    assert.ok(filled / field.length < .25, 'the branches should leave open space between them');
  }
});

function environment(t, { reduced = false, failedImage = false, stalled = false } = {}) {
  const names = ['document', 'window', 'CSS', 'Image', 'Worker', 'IntersectionObserver',
    'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'setTimeout', 'clearTimeout'];
  const saved = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  t.after(() => names.forEach(name => {
    if (saved.get(name)) Object.defineProperty(globalThis, name, saved.get(name));
    else delete globalThis[name];
  }));
  const definitions = new Set(), frames = new Map(), timers = new Map(), listeners = {};
  const jobs = [];
  let next = 0, observer, writes = 0;
  const levels = [];
  const targets = [[800, 40], [280, 400]].map(([width, height]) => {
    const classes = new Set(), styles = new Map(), events = {};
    return {
      dataset: {}, parentElement: null, getBoundingClientRect: () => ({ width, height }),
      matches: () => false, querySelector: () => null, querySelectorAll: () => [],
      classList: { add: c => classes.add(c), remove: (...cs) => cs.forEach(c => classes.delete(c)),
        replace: (a, b) => { classes.delete(a); classes.add(b); } },
      style: { setProperty: (k, v) => styles.set(k, v), removeProperty: k => styles.delete(k) },
      addEventListener: (event, fn) => { events[event] = fn; }, classes, styles, events
    };
  });
  const motion = { matches: reduced, addEventListener: (_, fn) => { listeners.motion = fn; } };
  globalThis.document = {
    documentElement: { classList: { remove() {} } }, querySelectorAll: () => targets,
    createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => { writes++; } }), toDataURL: () => 'data:image/png;base64,test' }),
    createElementNS: (_, name) => ({
      setAttribute: (key, value) => { if (name === 'feFuncA' && key === 'intercept') levels.push(Number(value)); },
      append() {}, remove() { definitions.delete(this); }
    }), body: { append: node => definitions.add(node) }
  };
  globalThis.window = { matchMedia: () => motion, addEventListener: (event, fn) => { listeners[event] = fn; } };
  globalThis.CSS = { supports: () => true };
  globalThis.Image = class { decode() { return failedImage ? Promise.reject(new Error('decode failed')) : Promise.resolve(); } };
  globalThis.Worker = class {
    postMessage(data) {
      jobs.push(data);
      if (stalled) return;
      queueMicrotask(() => {
        if (this.terminated) return;
        const { id, columns, rows, originX, originY, seed } = data;
        this.onmessage({ data: { id, thresholds: generateInkArrival(columns, rows, originX, originY, seed) } });
      });
    }
    terminate() { this.terminated = true; }
  };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '5' });
  globalThis.IntersectionObserver = class {
    constructor(fn) { observer = this; this.notify = fn; }
    observe() {} unobserve() {} disconnect() {}
  };
  globalThis.requestAnimationFrame = fn => { const id = ++next; frames.set(id, fn); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.setTimeout = fn => { const id = ++next; timers.set(id, fn); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  initDitherReveals();
  return { targets, jobs, definitions, frames, timers, listeners, motion, levels,
    writes: () => writes,
    start: async () => {
      observer.notify(targets.map(target => ({ target, isIntersecting: true })));
      for (let i = 0; i < 25; i++) await Promise.resolve();
    },
    frame: now => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); }
  };
}

test('matrices are allocated only on intersection and frames only advance visibility', async t => {
  const env = environment(t);
  assert.equal(env.jobs.length, 0);
  await env.start();
  assert.deepEqual(env.jobs.map(j => [j.columns, j.rows]), [[160, 8], [56, 80]]);
  assert.ok(env.targets.every(e => e.dataset.revealState === 'revealing'));
  assert.equal(env.definitions.size, 2);
  assert.equal(env.timers.size, 0);
  const now = performance.now();
  env.frame(now + 250);
  const a = env.levels.slice(-2);
  env.frame(now + 700);
  assert.ok(env.levels.slice(-2).every((n, i) => n >= a[i]));
  assert.equal(env.writes(), 2);
  assert.equal(env.jobs.length, 2);
  for (const element of env.targets) assert.deepEqual([...element.styles.keys()], ['--dither-mask']);
  env.frame(now + 1500);
  assert.ok(env.targets.every(e => e.dataset.revealState === 'done' && e.styles.size === 0));
  assert.equal(env.definitions.size, 0);
  assert.equal(env.frames.size, 0);
});

test('focus, resize, and reduced motion expose content and release masks', async t => {
  const env = environment(t);
  await env.start();
  env.targets[0].events.focusin();
  assert.equal(env.targets[0].dataset.revealState, 'done');
  env.listeners.resize();
  assert.ok(env.targets.every(e => e.dataset.revealState === 'done'));
  env.motion.matches = true;
  env.listeners.motion();
  assert.equal(env.definitions.size, 0);
  assert.equal(env.frames.size, 0);
});

test('an initial reduced-motion preference does not allocate any matrix', t => {
  const env = environment(t, { reduced: true });
  assert.ok(env.targets.every(e => !e.dataset.revealState));
  assert.equal(env.jobs.length, 0);
});

test('failed mask decoding exposes content and releases definitions', async t => {
  const env = environment(t, { failedImage: true });
  await env.start();
  assert.ok(env.targets.every(e => e.dataset.revealState === 'done'));
  assert.equal(env.definitions.size, 0);
});

test('a deadline cancels stalled solvers; focus can cancel before a matrix starts', async t => {
  const env = environment(t, { stalled: true });
  await env.start();
  env.targets[0].events.focusin();
  for (const fn of [...env.timers.values()]) fn();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.ok(env.targets.every(e => e.dataset.revealState === 'done'));
  assert.equal(env.definitions.size, 0);
});

test('below-fold photo URLs are assigned only after an intersection', t => {
  const savedDocument = globalThis.document, savedObserver = globalThis.IntersectionObserver;
  t.after(() => {
    if (savedDocument) globalThis.document = savedDocument; else delete globalThis.document;
    if (savedObserver) globalThis.IntersectionObserver = savedObserver; else delete globalThis.IntersectionObserver;
  });
  const photos = [{ dataset: { viewportSrc: 'one.jpg' } }, { dataset: { viewportSrc: 'two.jpg' } }];
  let notify;
  globalThis.document = { querySelectorAll: () => photos };
  globalThis.IntersectionObserver = class { constructor(fn) { notify = fn; } observe() {} unobserve() {} };
  initViewportPhotos();
  assert.ok(photos.every(photo => !photo.src));
  notify([{ target: photos[0], isIntersecting: false }]);
  assert.equal(photos[0].src, undefined);
  notify([{ target: photos[1], isIntersecting: true }]);
  assert.equal(photos[1].src, 'two.jpg');
  assert.equal(photos[0].src, undefined);
  assert.equal(photos[1].loading, 'eager');
  loadViewportPhoto(photos[1]);
  assert.equal(photos[1].src, 'two.jpg');
});

test('the cooperative fallback matches the worker formula and honors cancellation', async () => {
  const parameters = { columns: 40, rows: 30, originX: 10, originY: 23, seed: 567 };
  const field = await requestInkField(parameters);
  assert.deepEqual(field, generateInkArrival(40, 30, 10, 23, 567));
  const controller = new AbortController();
  const pending = requestInkField(parameters, controller.signal);
  controller.abort();
  await assert.rejects(pending, /cancelled/);
  await assert.rejects(requestInkField(parameters, controller.signal), /cancelled/);
});

test('dither cells stay five screen pixels through photo crops and resizing', t => {
  const saved = globalThis.getComputedStyle;
  t.after(() => { if (saved) globalThis.getComputedStyle = saved; else delete globalThis.getComputedStyle; });
  let requested = '5';
  let fit = 'cover';
  let box = { width: 500, height: 400 };
  const photo = { naturalWidth: 2000, naturalHeight: 1000, getBoundingClientRect: () => box };
  const element = { matches: () => false, querySelector: () => photo };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => requested, objectFit: fit });
  assert.equal(ditherCellSize(element), 5);
  box = { width: 250, height: 200 };
  assert.equal(ditherCellSize(element), 5);
  requested = '10';
  assert.equal(ditherCellSize(element), 10);
  fit = 'contain';
  assert.equal(ditherCellSize(element), 10);
  fit = 'none';
  assert.equal(ditherCellSize(element), 10);
  fit = 'scale-down';
  box = { width: 4000, height: 2000 };
  assert.equal(ditherCellSize(element), 10);
});

test('non-photo elements use screen pixels and invalid settings fall back to five', t => {
  const saved = globalThis.getComputedStyle;
  t.after(() => { if (saved) globalThis.getComputedStyle = saved; else delete globalThis.getComputedStyle; });
  let requested = '8';
  const element = { matches: () => false, querySelector: () => null };
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => requested });
  assert.equal(ditherCellSize(element), 8);
  for (requested of ['0', '-2', '', 'invalid', 'Infinity']) {
    assert.equal(ditherCellSize(element), 5);
  }
});
