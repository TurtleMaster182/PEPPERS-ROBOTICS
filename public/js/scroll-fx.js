// One scroll reader for every scroll-driven effect, measured once per frame.
// Subscribers receive { y, progress, velocity } where progress runs 0 → 1 down the page.
const listeners = new Set();
let frame;
let lastY = 0;
let lastTime = 0;
let velocity = 0;

export function scrollProgress(y, scrollHeight, viewportHeight) {
  const range = scrollHeight - viewportHeight;
  return range > 0 ? Math.min(1, Math.max(0, y / range)) : 1;
}

function measure(now) {
  frame = undefined;
  const y = window.scrollY;
  const elapsed = Math.max(1, now - lastTime);
  // Pixels per 16 ms, smoothed so a single jump does not dominate.
  velocity = velocity * 0.6 + ((y - lastY) / elapsed) * 16 * 0.4;
  lastY = y;
  lastTime = now;
  const state = { y, velocity, progress: scrollProgress(y, document.documentElement.scrollHeight, window.innerHeight) };
  listeners.forEach(listener => listener(state));
}

function request() {
  if (frame === undefined) frame = requestAnimationFrame(measure);
}

export function onScroll(listener) {
  if (!listeners.size) {
    lastY = window.scrollY;
    lastTime = performance.now();
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
  }
  listeners.add(listener);
  request();
  return () => listeners.delete(listener);
}

// A thin progress line under the header and any [data-scroll-spin] badges.
export function initScrollIndicators() {
  const bar = document.querySelector('[data-scroll-progress]');
  const spinners = [...document.querySelectorAll('[data-scroll-spin]')];
  if (!bar && !spinners.length) return;
  onScroll(({ y, progress }) => {
    bar?.style.setProperty('--progress', progress.toFixed(4));
    spinners.forEach(element => element.style.setProperty('--spin', `${(y * 0.12).toFixed(1)}deg`));
  });
}
