export function initEvents() {
  const status = document.querySelector('#eventFilterStatus');
  if (!status) return;
  const eventCards = [...document.querySelectorAll('[data-event-kind]')];
  const filters = [...document.querySelectorAll('[data-event-filter]')];
  filters.forEach(button => button.addEventListener('click', () => {
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    const kind = button.dataset.eventFilter;
    eventCards.forEach(card => { card.hidden = kind !== 'all' && card.dataset.eventKind !== kind; });
    const count = eventCards.filter(card => !card.hidden).length;
    status.textContent = kind === 'all' ? `Showing all ${count} events` : `Showing ${count} ${kind} ${count === 1 ? 'event' : 'events'}`;
  }));
}

// Wikipedia-style preview: hovering an event card (after a short pause) or clicking it
// shows a small card with the date, place, and details. The preview stays open while
// the pointer is over it, so its link can be used. Clicking pins it until Escape, the
// close button, or a click elsewhere. Without JavaScript the <details> still expands.
export function initEventPreviews() {
  const cards = [...document.querySelectorAll('.event-card')];
  if (!cards.length) return;
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const popup = document.createElement('div');
  popup.className = 'event-popup';
  popup.id = 'eventPopup';
  popup.setAttribute('role', 'dialog');
  popup.tabIndex = -1;
  popup.hidden = true;
  document.body.append(popup);
  let current, pinned = false, showTimer, hideTimer;

  const text = (card, selector) => card.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || '';

  function fill(card) {
    const date = card.querySelector('time')?.getAttribute('datetime');
    const when = date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const title = card.querySelector('h3').innerHTML.replace(/<br\s*\/?>/gi, ' ');
    popup.innerHTML = `<button type="button" class="event-popup-close" aria-label="Close event preview">×</button>
      <p class="eyebrow"></p><strong class="event-popup-title"></strong><p class="event-popup-meta"></p><div class="event-popup-body"></div>`;
    popup.querySelector('.eyebrow').textContent = [text(card, '.event-category'), when].filter(Boolean).join(' · ');
    const heading = popup.querySelector('.event-popup-title');
    heading.innerHTML = title;
    popup.setAttribute('aria-label', heading.textContent);
    popup.querySelector('.event-popup-meta').textContent = [text(card, '.event-location'), text(card, '.event-time')].filter(Boolean).join(' · ');
    const body = popup.querySelector('.event-popup-body');
    card.querySelectorAll('.event-more > *').forEach(node => body.append(node.cloneNode(true)));
    popup.querySelector('.event-popup-close').addEventListener('click', () => hide(true));
  }

  function place(card) {
    const anchor = card.querySelector('h3').getBoundingClientRect();
    const box = card.getBoundingClientRect();
    const width = popup.offsetWidth, height = popup.offsetHeight;
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, box.left + 16));
    const below = anchor.bottom + 14;
    const fitsBelow = below + height < window.innerHeight - 16 || anchor.top - height - 14 < 80;
    const top = fitsBelow ? below : anchor.top - height - 14;
    popup.style.left = `${left + window.scrollX}px`;
    popup.style.top = `${top + window.scrollY}px`;
    popup.style.setProperty('--notch', `${Math.max(18, Math.min(width - 18, anchor.left + 40 - left))}px`);
    popup.classList.toggle('is-above', !fitsBelow);
  }

  function show(card, { pin = false, focus = false } = {}) {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    if (current !== card) {
      current?.querySelector('summary')?.setAttribute('aria-expanded', 'false');
      current = card;
      fill(card);
    }
    pinned = pinned && current === card ? true : pin;
    popup.hidden = false;
    place(card);
    card.querySelector('summary')?.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => popup.classList.add('is-visible'));
    if (focus) popup.focus({ preventScroll: true });
  }

  function hide(returnFocus = false) {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    if (!current) return;
    const summary = current.querySelector('summary');
    summary?.setAttribute('aria-expanded', 'false');
    popup.classList.remove('is-visible');
    popup.hidden = true;
    if (returnFocus && popup.contains(document.activeElement)) summary?.focus({ preventScroll: true });
    current = undefined;
    pinned = false;
  }

  function scheduleHide() {
    if (pinned) return;
    clearTimeout(showTimer);
    hideTimer = setTimeout(() => hide(), 220);
  }

  cards.forEach(card => {
    const summary = card.querySelector('summary');
    summary?.setAttribute('aria-controls', popup.id);
    summary?.setAttribute('aria-haspopup', 'dialog');
    summary?.setAttribute('aria-expanded', 'false');
    card.classList.add('has-preview');
    card.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !hover.matches) return;
      clearTimeout(hideTimer);
      if (current === card) return;
      showTimer = setTimeout(() => show(card), current ? 0 : 280);
    });
    card.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') scheduleHide(); });
    card.addEventListener('click', event => {
      if (event.target.closest('a')) return;
      event.preventDefault(); // The preview replaces the inline <details>.
      const keyboard = event.detail === 0;
      if (pinned && current === card) { hide(keyboard); return; }
      show(card, { pin: true, focus: keyboard });
    });
  });

  popup.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  popup.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') scheduleHide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && current) hide(true); });
  document.addEventListener('click', event => {
    if (current && !popup.contains(event.target) && !event.target.closest('.event-card')) hide();
  });
  document.querySelectorAll('[data-event-filter]').forEach(button => button.addEventListener('click', () => hide()));
  window.addEventListener('resize', () => { if (current) place(current); });
}
