// Pixel flames along the bottom of the screen. They start as embers at the top of
// the page and grow into a full fire by the footer; fast scrolling fans them briefly.
// Classic "fire spread" cellular automaton, drawn one canvas pixel per 5 × 5 CSS cell
// so it matches the dither reveal grid.
import { onScroll } from './scroll-fx.js';

const CELL = 5;
const ROWS = 46;
const LEVELS = 36;
const STEP_MS = 1000 / 30;

// Transparent → deep red → brand red → orange → yellow.
const STOPS = [
  [0, 0, 0, 0, 0], [5, 90, 0, 0, 160], [14, 255, 0, 0, 235],
  [24, 255, 96, 0, 255], [32, 255, 190, 30, 255], [36, 255, 236, 150, 255]
];
export const FLAME_PALETTE = Array.from({ length: LEVELS + 1 }, (_, level) => {
  const upper = STOPS.findIndex(stop => stop[0] >= level);
  const b = STOPS[upper], a = STOPS[Math.max(0, upper - 1)];
  const t = b[0] === a[0] ? 1 : (level - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((value, i) => Math.round(value + (b[i + 1] - value) * t));
});

// Embers at the top of the page that build slowly while reading, then a full fire once
// the footer is on screen. footerShown is 0 → 1 as the footer scrolls into view.
export function flameIntensity(progress, footerShown = 0) {
  const clamp = value => Math.min(1, Math.max(0, value));
  return Math.min(1, 0.14 + 0.3 * clamp(progress) + 0.56 * clamp(footerShown));
}
export function scrollFlare(velocity) {
  return Math.min(0.3, Math.abs(velocity) * 0.01);
}

// Feed the bottom row. Low intensity lights only some columns, which reads as embers.
export function feedFire(fire, columns, rows, intensity, random = Math.random) {
  const base = (rows - 1) * columns;
  const lit = 0.25 + intensity * 0.75;
  for (let x = 0; x < columns; x++) {
    fire[base + x] = random() < lit ? Math.round(LEVELS * intensity * (0.7 + 0.3 * random())) : 0;
  }
}

// Each cell rises one row, drifts sideways a little, and cools as it goes.
export function spreadFire(fire, columns, rows, random = Math.random) {
  for (let x = 0; x < columns; x++) {
    for (let y = 1; y < rows; y++) {
      const source = y * columns + x;
      const heat = fire[source];
      const target = Math.max(0, source - columns - ((random() * 3) | 0) + 1);
      fire[target] = heat === 0 ? 0 : Math.max(0, heat - ((random() * 2.6) | 0));
    }
  }
}

export function initHeatFlames() {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.className = 'heat-flames';
  canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) return;
  const colors = new Uint32Array(FLAME_PALETTE.map(([r, g, b, a]) => (a << 24) | (b << 16) | (g << 8) | r));
  const footer = document.querySelector('.site-footer');
  let columns = 0, fire, pixels, view, frame, last = 0, base = flameIntensity(0), flare = 0, stopScroll;

  function resize() {
    // Stretched to the viewport width (cells stay within a fraction of a pixel of 5 px).
    columns = Math.ceil(window.innerWidth / CELL);
    canvas.width = columns;
    canvas.height = ROWS;
    canvas.style.height = `${ROWS * CELL}px`;
    fire = new Uint8Array(columns * ROWS);
    pixels = context.createImageData(columns, ROWS);
    view = new Uint32Array(pixels.data.buffer);
  }

  function draw(now) {
    frame = requestAnimationFrame(draw);
    if (now - last < STEP_MS) return;
    last = now;
    feedFire(fire, columns, ROWS, Math.min(1, base + flare));
    flare *= 0.9;
    spreadFire(fire, columns, ROWS);
    for (let i = 0; i < fire.length; i++) view[i] = colors[fire[i]];
    context.putImageData(pixels, 0, 0);
  }

  function start() {
    if (frame !== undefined) return;
    resize();
    document.body.append(canvas);
    window.addEventListener('resize', resize);
    stopScroll = onScroll(({ progress, velocity }) => {
      const box = footer?.getBoundingClientRect();
      const footerShown = box ? (window.innerHeight - box.top) / Math.min(box.height, window.innerHeight) : 0;
      base = flameIntensity(progress, footerShown);
      flare = Math.max(flare, scrollFlare(velocity));
    });
    frame = requestAnimationFrame(draw);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = undefined;
    stopScroll?.();
    window.removeEventListener('resize', resize);
    canvas.remove();
  }

  if (!motion.matches) start();
  motion.addEventListener('change', () => (motion.matches ? stop() : start()));
}
