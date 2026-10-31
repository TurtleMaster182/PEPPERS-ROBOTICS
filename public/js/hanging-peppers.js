// Peppers hanging from the header like ornaments. Each one is a damped pendulum:
// scrolling and hovering nudge it, a click sends it spinning. Strings shorten as the
// visitor scrolls so the peppers tuck under the header instead of covering content.
import { onScroll } from './scroll-fx.js';

const GRAVITY = 2400; // px/s², tuned for a lazy ornament swing
const DAMPING = 1.5;
const MAX_ANGLE = 1.25;

export function swingStep(state, dt, length, push = 0) {
  const acceleration = -(GRAVITY / length) * Math.sin(state.angle) - DAMPING * state.speed;
  state.speed += (acceleration + push) * dt;
  state.angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, state.angle + state.speed * dt));
  if (Math.abs(state.angle) === MAX_ANGLE) state.speed *= -0.4;
  return state;
}

export function stringLength(base, scrollY, viewportHeight) {
  return base * (1 - 0.6 * Math.min(1, scrollY / (viewportHeight * 0.8)));
}

export function isResting(state) {
  return Math.abs(state.angle) < 0.002 && Math.abs(state.speed) < 0.002;
}

export function initHangingPeppers() {
  const peppers = [...document.querySelectorAll('[data-pepper]')].map((element, index) => ({
    element,
    base: Number.parseFloat(getComputedStyle(element).getPropertyValue('--len')) || 60,
    length: 60,
    weight: 0.8 + (index % 3) * 0.15,
    state: { angle: 0, speed: 0 }
  }));
  if (!peppers.length) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame, last = 0;

  function render(pepper) {
    pepper.element.style.setProperty('--string', `${pepper.length.toFixed(1)}px`);
    pepper.element.style.setProperty('--swing', `${pepper.state.angle.toFixed(4)}rad`);
  }

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
    last = now;
    let moving = false;
    for (const pepper of peppers) {
      swingStep(pepper.state, dt, pepper.length);
      render(pepper);
      if (!isResting(pepper.state)) moving = true;
    }
    frame = moving ? requestAnimationFrame(tick) : undefined;
  }

  function wake() {
    if (motion.matches || frame !== undefined) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  const garland = peppers[0].element.parentElement;
  onScroll(({ y, velocity }) => {
    // Once tucked up over the content, peppers stop catching clicks meant for the page.
    garland.classList.toggle('is-tucked', y > window.innerHeight * 0.5);
    for (const pepper of peppers) {
      pepper.length = stringLength(pepper.base, y, window.innerHeight);
      if (!motion.matches) pepper.state.speed += velocity * 0.012 * pepper.weight;
      render(pepper);
    }
    wake();
  });

  for (const pepper of peppers) {
    const body = pepper.element.querySelector('.pepper-body');
    body.addEventListener('pointermove', event => {
      if (motion.matches) return;
      pepper.state.speed += Math.max(-1.5, Math.min(1.5, event.movementX * 0.06));
      wake();
    });
    body.addEventListener('click', () => {
      pepper.element.classList.remove('is-hot');
      void pepper.element.offsetWidth; // Restart the sizzle animation.
      pepper.element.classList.add('is-hot');
      if (motion.matches) return;
      pepper.state.speed += (pepper.state.speed >= 0 ? 1 : -1) * 9;
      wake();
    });
  }
}
