import { createBurner } from './photo-burn.js';

export function createPhotoDeck(media, keyboardTarget) {
  const deck = document.createElement('div');
  deck.className = 'photo-deck';
  deck.id = 'photoDeck';
  deck.tabIndex = 0;
  deck.setAttribute('role', 'region');
  deck.setAttribute('aria-label', 'Photo shuffle');
  deck.setAttribute('aria-describedby', 'deckHint');
  deck.innerHTML = `<div class="deck-stage"></div><div class="deck-controls"><p id="deckHint">Click the arrow or press → to shuffle</p><span id="deckCount"></span><button type="button" class="deck-next" aria-label="Next photo" aria-controls="photoDeck">›</button></div><p class="deck-status" id="deckStatus" role="status" aria-live="polite"></p>`;
  for (const item of media) {
    const card = document.createElement('figure');
    card.className = 'deck-card';
    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt;
    image.draggable = false;
    image.decoding = 'async';
    const caption = document.createElement('figcaption');
    caption.textContent = item.alt;
    card.append(image, caption);
    deck.querySelector('.deck-stage').append(card);
  }
  const abort = new AbortController();
  let disposed = false;
  let animation;
  const stage = deck.querySelector('.deck-stage');
  const cards = [...stage.querySelectorAll('.deck-card')];
  const next = deck.querySelector('.deck-next');
  const status = deck.querySelector('#deckStatus');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;
  let typed = '';
  let lastKeyTime = 0;
  let burner;

  function arrange() {
    [...stage.children].forEach((card, depth) => {
      card.dataset.depth = String(depth);
      card.style.zIndex = String(cards.length - depth);
      card.setAttribute('aria-hidden', String(depth !== 0));
    });
    const current = cards.indexOf(stage.firstElementChild) + 1;
    deck.querySelector('#deckCount').textContent = `${current} / ${cards.length}`;
  }

  async function shuffle() {
    if (busy || cards.length < 2) return;
    busy = true;
    next.setAttribute('aria-disabled', 'true');
    const card = stage.firstElementChild;
    try {
      if (burner && !reducedMotion.matches && await burnAway(card)) return;
      if (disposed) return;
      if (!reducedMotion.matches) {
        animation = card.animate([
          { transform: 'translate(0, 0) rotate(0deg)' },
          { transform: 'translate(-58%, -38%) rotate(-18deg)' }
        ], { duration: 340, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
        await animation.finished;
        if (disposed) return;
      }
      stage.append(card);
      arrange();
      if (!reducedMotion.matches) {
        animation?.cancel();
        const destination = getComputedStyle(card).transform;
        animation = card.animate([
          { transform: 'translate(-58%, -38%) rotate(-18deg)' },
          { transform: destination }
        ], { duration: 340, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
        await animation.finished;
        if (disposed) return;
      }
      status.textContent = stage.firstElementChild.querySelector('img').alt;
    } catch {
      // A cancelled animation should never lock the shuffle controls.
    } finally {
      animation?.cancel();
      busy = false;
      next.removeAttribute('aria-disabled');
    }
  }

  // Peppers mode: the top photo burns away, then the rest of the stack slides forward.
  async function burnAway(card) {
    if (!await burner.burn(card) || disposed) return false;
    const moving = [...stage.children].slice(1, 4);
    const before = moving.map(item => getComputedStyle(item).transform);
    stage.append(card);
    arrange();
    moving.forEach((item, index) => item.animate([{ transform: before[index] }, { transform: getComputedStyle(item).transform }], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' }));
    card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200, fill: 'backwards' });
    status.textContent = stage.firstElementChild.querySelector('img').alt;
    return true;
  }

  next.addEventListener('click', shuffle, { signal: abort.signal });
  stage.addEventListener('click', () => deck.focus({ preventScroll: true }), { signal: abort.signal });
  keyboardTarget.addEventListener('keydown', event => {
    if (event.target.closest('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      shuffle();
      return;
    }
    if (event.key.length !== 1 || !/^[a-z]$/i.test(event.key)) { typed = ''; return; }
    const now = Date.now();
    if (now - lastKeyTime > 2500) typed = '';
    lastKeyTime = now;
    typed = (typed + event.key.toLowerCase()).slice(-7);
    if (typed === 'peppers' && deck.dataset.peppersMode !== 'true') {
      deck.dataset.peppersMode = 'true';
      burner = createBurner(keyboardTarget);
      deck.dispatchEvent(new CustomEvent('peppers:activate', { bubbles: true }));
      status.textContent = 'Peppers mode activated.';
      typed = '';
    }
  }, { signal: abort.signal });
  arrange();
  return {
    element: deck,
    dispose() {
      disposed = true;
      abort.abort();
      animation?.cancel();
      burner?.dispose();
    }
  };
}
