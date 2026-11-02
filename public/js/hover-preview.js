// Wikipedia-style preview cards. Hovering an item (after a short pause) or clicking /
// tapping it shows a small card next to it. The card stays open while the pointer is
// over it, so links inside work; a click pins it until Escape, × or a click elsewhere.
// Styles: public/css/preview.css.
//
// createHoverPreview({ items, id, label, fill, anchor })
//   items  – elements that open a preview
//   fill   – (item, body) => void; put the preview content into `body`
//   anchor – (item) => element the card points at (default: the item's h3)
export function createHoverPreview({ items, id, label = 'Preview', fill, anchor = item => item.querySelector('h3') || item }) {
  if (!items.length) return;
  const hover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const popup = document.createElement('div');
  popup.className = 'hover-preview';
  popup.id = id;
  popup.setAttribute('role', 'dialog');
  popup.tabIndex = -1;
  popup.hidden = true;
  popup.innerHTML = `<button type="button" class="hover-preview-close" aria-label="Close ${label.toLowerCase()}">×</button><div class="hover-preview-body"></div>`;
  const body = popup.querySelector('.hover-preview-body');
  document.body.append(popup);
  let current, pinned = false, showTimer, hideTimer;

  function place(item) {
    const target = anchor(item).getBoundingClientRect();
    const box = item.getBoundingClientRect();
    const width = popup.offsetWidth, height = popup.offsetHeight;
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, box.left + 16));
    const below = target.bottom + 14;
    const fitsBelow = below + height < window.innerHeight - 16 || target.top - height - 14 < 80;
    popup.style.left = `${left + window.scrollX}px`;
    popup.style.top = `${(fitsBelow ? below : target.top - height - 14) + window.scrollY}px`;
    popup.style.setProperty('--notch', `${Math.max(18, Math.min(width - 18, target.left + 30 - left))}px`);
    popup.classList.toggle('is-above', !fitsBelow);
  }

  function show(item, { pin = false, focus = false } = {}) {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    if (current !== item) {
      current?.setAttribute('aria-expanded', 'false');
      current = item;
      pinned = false;
      body.replaceChildren();
      fill(item, body);
      popup.setAttribute('aria-label', body.querySelector('.hover-preview-title')?.textContent || label);
    }
    pinned = pinned || pin;
    popup.hidden = false;
    place(item);
    item.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => popup.classList.add('is-visible'));
    if (focus) popup.focus({ preventScroll: true });
  }

  function hide(returnFocus = false) {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    if (!current) return;
    current.setAttribute('aria-expanded', 'false');
    if (returnFocus && popup.contains(document.activeElement)) current.focus({ preventScroll: true });
    popup.classList.remove('is-visible');
    popup.hidden = true;
    current = undefined;
    pinned = false;
  }

  function scheduleHide() {
    clearTimeout(showTimer);
    if (!pinned) hideTimer = setTimeout(() => hide(), 220);
  }

  function toggle(item, keyboard) {
    if (pinned && current === item) hide(keyboard);
    else show(item, { pin: true, focus: keyboard });
  }

  items.forEach(item => {
    item.classList.add('has-preview');
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-haspopup', 'dialog');
    item.setAttribute('aria-controls', id);
    item.setAttribute('aria-expanded', 'false');
    item.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !hover.matches) return;
      clearTimeout(hideTimer);
      if (current === item) return;
      if (pinned) return; // A pinned card stays until it is closed.
      showTimer = setTimeout(() => show(item), current ? 0 : 280);
    });
    item.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') scheduleHide(); });
    item.addEventListener('click', event => {
      if (event.target.closest('a, button')) return;
      toggle(item, event.detail === 0);
    });
    item.addEventListener('keydown', event => {
      if (event.target !== item || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      toggle(item, true);
    });
  });

  popup.querySelector('.hover-preview-close').addEventListener('click', () => hide(true));
  popup.addEventListener('pointerenter', () => clearTimeout(hideTimer));
  popup.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') scheduleHide(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && current) hide(true); });
  document.addEventListener('click', event => {
    if (current && !popup.contains(event.target) && !items.some(item => item.contains(event.target))) hide();
  });
  window.addEventListener('resize', () => { if (current) place(current); });
  return { hide };
}
