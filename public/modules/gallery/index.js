import { onScroll } from '../../js/scroll-fx.js';
import { loadViewportPhoto } from '../../js/viewport-photos.js';

// The memory wall rows slide in opposite directions while the section is on screen.
export function initGallery() {
  const wall = document.querySelector('[data-memory-wall]');
  if (!wall) return;
  // Photos past the clipped row edges never intersect on their own, so load the wall together.
  const loader = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    wall.querySelectorAll('img[data-viewport-src]').forEach(loadViewportPhoto);
    loader.disconnect();
  }, { rootMargin: '300px 0px' });
  loader.observe(wall);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rows = [...wall.querySelectorAll('[data-drift]')];
  onScroll(() => {
    const box = wall.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) return;
    // -1 when the wall enters at the bottom, +1 when it leaves at the top.
    const travel = 1 - (box.top + box.height) / (window.innerHeight + box.height) * 2;
    rows.forEach(row => row.style.setProperty('--drift', `${(travel * 180 * Number(row.dataset.drift)).toFixed(1)}px`));
  });
}
