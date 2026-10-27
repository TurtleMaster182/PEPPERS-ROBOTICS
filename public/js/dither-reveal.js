import { randomInkStart, requestInkField } from './ink-solver.js';
import { loadViewportPhoto } from './viewport-photos.js';
import { writeDitherPattern } from './dither-pattern.js';

const REVEAL_DURATION = 1450 / 1.2;
const SVG = 'http://www.w3.org/2000/svg';
let maskId = 0;

function node(name, attributes, parent) {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  parent?.append(element);
  return element;
}

// Cell size is in CSS pixels, independent of photo resolution and cropping.
export function ditherCellSize(element) {
  const requested = Number.parseFloat(getComputedStyle(element).getPropertyValue('--dither-pixel-size'));
  return Number.isFinite(requested) && requested > 0 ? requested : 5;
}

// A single threshold image avoids a huge animation atlas for high-resolution photos.
async function createPlumeField(element, signal) {
  const { width, height } = element.getBoundingClientRect();
  const cellSize = ditherCellSize(element);
  const columns = Math.max(1, Math.ceil(width / cellSize));
  const rows = Math.max(1, Math.ceil(height / cellSize));
  const start = randomInkStart(columns, rows);
  const thresholds = await requestInkField({ columns, rows, ...start }, signal);
  if (signal.aborted) throw new Error('Ink preparation cancelled');
  const canvas = document.createElement('canvas');
  // Five subpixels per cell reproduce the supplied loading stages exactly.
  canvas.width = columns * 5;
  canvas.height = rows * 5;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Dither canvas unavailable');
  const pixels = context.createImageData(canvas.width, canvas.height);
  writeDitherPattern(pixels.data, thresholds, columns, rows);
  context.putImageData(pixels, 0, 0);
  const source = canvas.toDataURL();
  canvas.width = canvas.height = 0;
  const thresholdImage = new Image();
  thresholdImage.src = source;

  const id = `dither-mask-${++maskId}`;
  const svg = node('svg', { class: 'dither-defs', 'aria-hidden': 'true' });
  const defs = node('defs', {}, svg);
  const filter = node('filter', {
    id: `${id}-threshold`, filterUnits: 'userSpaceOnUse',
    x: 0, y: 0, width, height, 'color-interpolation-filters': 'sRGB'
  }, defs);
  const transfer = node('feComponentTransfer', {}, filter);
  // Turn each fixed alpha threshold on as the reveal advances.
  const alpha = node('feFuncA', { type: 'linear', slope: -255, intercept: 0 }, transfer);
  const mask = node('mask', {
    id, maskUnits: 'userSpaceOnUse', maskContentUnits: 'userSpaceOnUse',
    x: 0, y: 0, width, height, 'mask-type': 'alpha'
  }, defs);
  node('image', {
    href: source, width: columns * cellSize, height: rows * cellSize,
    preserveAspectRatio: 'none', 'image-rendering': 'pixelated', filter: `url(#${id}-threshold)`
  }, mask);
  document.body.append(svg);
  return {
    mask: `url("#${id}")`, ready: thresholdImage.decode(),
    paint: progress => alpha.setAttribute('intercept', progress * 255),
    destroy: () => svg.remove()
  };
}

export function initDitherReveals() {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || !CSS.supports('mask-image', 'linear-gradient(white, white)')) {
    document.documentElement.classList.remove('dither-boot');
    return;
  }
  const candidates = [...document.querySelectorAll([
    '.opening-photo', '.hero-copy > *', '.hero-build', '.section-heading > *',
    '.season-card', '.event-controls', '.event-card', '.support-grid > article',
    '.join-grid > div', '.album-button', '.contact-section', '.site-footer > div'
  ].join(','))];
  const selected = new Set(candidates);
  const targets = candidates.filter(element => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (selected.has(parent)) return false;
    }
    return true;
  });
  const active = new Map();
  const waves = new Map();
  const preparationTimers = new Map();
  const preparations = new Map();
  let frame;

  function finish(element) {
    active.delete(element);
    preparations.get(element)?.abort();
    preparations.delete(element);
    clearTimeout(preparationTimers.get(element));
    preparationTimers.delete(element);
    waves.get(element)?.destroy();
    waves.delete(element);
    element.classList.remove('dither-pending', 'dither-running');
    element.style.removeProperty('--dither-mask');
    element.dataset.revealState = 'done';
  }

  function paint(now) {
    frame = undefined;
    active.forEach((state, element) => {
      const progress = Math.min(1, (now - state.start) / REVEAL_DURATION);
      if (progress >= 1) { finish(element); return; }
      const level = Math.floor(progress * 254);
      if (level !== state.level) {
        state.level = level;
        waves.get(element).paint(level / 254);
      }
    });
    if (active.size) frame = requestAnimationFrame(paint);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      observer.unobserve(element);
      if (element.dataset.revealState === 'done') return;
      element.dataset.revealState = 'preparing';
      const preparation = new AbortController();
      preparations.set(element, preparation);
      // A stalled photo or solver must never leave content hidden indefinitely.
      preparationTimers.set(element, setTimeout(() => finish(element), 3000));
      // Decode photos before starting their reveal.
      const photos = element.matches('img') ? [element] : [...element.querySelectorAll('img:not(.heat-word)')];
      photos.forEach(loadViewportPhoto);
      Promise.all(photos.map(photo => photo.decode().catch(() => {}))).then(async () => {
        if (element.dataset.revealState === 'done' || motion.matches) return;
        const wave = await createPlumeField(element, preparation.signal);
        if (element.dataset.revealState === 'done' || motion.matches) { wave.destroy(); return; }
        waves.set(element, wave);
        return wave.ready.then(() => {
          if (element.dataset.revealState === 'done' || motion.matches) return;
          clearTimeout(preparationTimers.get(element));
          preparationTimers.delete(element);
          preparations.delete(element);
          element.style.setProperty('--dither-mask', wave.mask);
          element.classList.replace('dither-pending', 'dither-running');
          element.dataset.revealState = 'revealing';
          active.set(element, { start: performance.now(), level: 0 });
          if (frame === undefined) frame = requestAnimationFrame(paint);
        });
      }).catch(() => finish(element));
    });
  }, { threshold: 0, rootMargin: '0px' });

  targets.forEach(element => {
    element.classList.add('dither-pending');
    element.dataset.revealState = 'pending';
    observer.observe(element);
    // A keyboard user can immediately interact with any revealed control.
    element.addEventListener('focusin', () => { observer.unobserve(element); finish(element); });
  });
  document.documentElement.classList.remove('dither-boot');
  // Avoid stretching an in-flight cell grid when the viewport changes size.
  window.addEventListener('resize', () => {
    targets.forEach(element => {
      if (['preparing', 'revealing'].includes(element.dataset.revealState)) finish(element);
    });
  });
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    targets.forEach(finish);
  });
}
