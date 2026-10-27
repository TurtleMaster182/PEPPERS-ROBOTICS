// A fixed random field lets pixels build in flowing waves without flickering.
function createWaveField(element) {
  const { width, height } = element.getBoundingClientRect();
  const columns = Math.max(1, Math.min(96, Math.ceil(width / 10)));
  const rows = Math.max(1, Math.min(64, Math.ceil(height / 10)));
  const pixel = 4;
  const frames = 37;
  const frameHeight = rows * pixel;
  const canvas = document.createElement('canvas');
  canvas.width = columns * pixel;
  canvas.height = frameHeight * frames;
  const context = canvas.getContext('2d');
  const phase = Math.random() * Math.PI * 2;
  const reverse = Math.random() > .5;
  const ranks = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const u = (reverse ? columns - 1 - x : x) / columns;
      const v = y / rows;
      ranks.push(.65 * u + .16 * v
        + .14 * Math.sin(v * 9 + phase)
        + .08 * Math.sin(u * 11 - v * 5 + phase)
        + .22 * Math.random());
    }
  }
  const min = Math.min(...ranks);
  const range = Math.max(.001, Math.max(...ranks) - min);
  const thresholds = ranks.map(rank => .03 + .94 * (rank - min) / range);
  context.fillStyle = 'white';
  // All frames share one image, so mask changes never wait for a new decode.
  for (let frame = 0; frame < frames; frame++) {
    const progress = frame / (frames - 1);
    for (let y = 0; y < rows; y++) {
      let run = -1;
      for (let x = 0; x <= columns; x++) {
        const visible = x < columns && thresholds[y * columns + x] <= progress;
        if (visible && run < 0) run = x;
        if (!visible && run >= 0) {
          context.fillRect(run * pixel, frame * frameHeight + y * pixel, (x - run) * pixel, pixel);
          run = -1;
        }
      }
    }
  }
  const source = canvas.toDataURL();
  canvas.width = canvas.height = 0;
  const image = new Image();
  image.src = source;
  return { source, ready: image.decode() };
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
  let frame;

  function finish(element) {
    active.delete(element);
    element.classList.remove('dither-pending', 'dither-running');
    element.style.removeProperty('--dither-mask');
    element.style.removeProperty('--dither-position');
    element.style.removeProperty('--dither-opacity');
    element.style.removeProperty('--dither-rise');
    element.dataset.revealState = 'done';
  }

  function paint(now) {
    frame = undefined;
    active.forEach((state, element) => {
      const progress = Math.min(1, (now - state.start) / 1450);
      if (progress >= 1) { finish(element); return; }
      const eased = 1 - (1 - progress) ** 3;
      const level = Math.floor(progress * 36);
      if (level !== state.level) {
        state.level = level;
        element.style.setProperty('--dither-position', `${level / 36 * 100}%`);
      }
      element.style.setProperty('--dither-opacity', String(.3 + .7 * eased));
      element.style.setProperty('--dither-rise', `${(1 - eased) * 36}px`);
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
      const wave = createWaveField(element);
      wave.ready.then(() => {
        if (element.dataset.revealState === 'done' || motion.matches) return;
        element.style.setProperty('--dither-mask', `url("${wave.source}")`);
        element.style.setProperty('--dither-position', '0%');
        element.style.setProperty('--dither-rise', '36px');
        element.classList.replace('dither-pending', 'dither-running');
        element.dataset.revealState = 'revealing';
        active.set(element, { start: performance.now(), level: 0 });
        if (frame === undefined) frame = requestAnimationFrame(paint);
      }).catch(() => finish(element));
    });
  }, { threshold: 0, rootMargin: '0px 0px -35px 0px' });

  targets.forEach(element => {
    element.classList.add('dither-pending');
    element.dataset.revealState = 'pending';
    observer.observe(element);
    // A keyboard user can immediately interact with any revealed control.
    element.addEventListener('focusin', () => { observer.unobserve(element); finish(element); });
  });
  document.documentElement.classList.remove('dither-boot');
  motion.addEventListener('change', () => {
    if (!motion.matches) return;
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    targets.forEach(finish);
  });
}
