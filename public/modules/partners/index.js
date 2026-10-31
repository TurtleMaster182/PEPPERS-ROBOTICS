// Sponsor bar: duplicates the list for a seamless loop and shows a preview card
// (name, tier, one line of info) on hover, keyboard focus, or the first tap.
export function initPartners() {
  const marquee = document.querySelector('[data-marquee]');
  if (!marquee) return;
  const track = marquee.querySelector('.marquee-track');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function startLoop() {
    if (motion.matches || marquee.classList.contains('is-running')) return;
    const copies = [...track.children].map(item => {
      const copy = item.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      copy.dataset.marqueeCopy = '';
      copy.querySelectorAll('a').forEach(link => link.setAttribute('tabindex', '-1'));
      return copy;
    });
    track.append(...copies);
    track.style.setProperty('--marquee-duration', `${Math.max(20, track.scrollWidth / 2 / 45)}s`);
    marquee.classList.add('is-running');
  }
  function stopLoop() {
    track.querySelectorAll('[data-marquee-copy]').forEach(copy => copy.remove());
    marquee.classList.remove('is-running');
  }
  startLoop();
  motion.addEventListener('change', () => (motion.matches ? stopLoop() : startLoop()));

  const card = document.createElement('div');
  card.className = 'sponsor-card';
  card.setAttribute('aria-hidden', 'true');
  const tier = Object.assign(document.createElement('p'), { className: 'eyebrow' });
  const name = document.createElement('strong');
  const info = document.createElement('p');
  card.append(tier, name, info);
  document.body.append(card);
  let current;

  function show(chip) {
    current = chip;
    tier.textContent = chip.dataset.sponsorTier || 'Partner';
    name.textContent = chip.querySelector('.sponsor-logo').textContent.trim() || chip.querySelector('img')?.alt || '';
    info.textContent = chip.querySelector('.sponsor-info')?.textContent || '';
    const box = chip.getBoundingClientRect();
    const width = card.offsetWidth, height = card.offsetHeight;
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, box.left + box.width / 2 - width / 2));
    const above = box.top - height - 12;
    card.style.left = `${left}px`;
    card.style.top = `${above > 70 ? above : box.bottom + 12}px`;
    card.classList.add('is-visible');
  }
  function hide() {
    current = undefined;
    card.classList.remove('is-visible');
  }

  track.addEventListener('pointerover', event => {
    const chip = event.target.closest('.sponsor-chip');
    if (chip && chip !== current && event.pointerType === 'mouse') show(chip);
  });
  track.addEventListener('pointerleave', hide);
  track.addEventListener('focusin', event => show(event.target.closest('.sponsor-chip')));
  track.addEventListener('focusout', hide);
  // Touch: the first tap previews, a second tap on the same chip follows the link.
  track.addEventListener('click', event => {
    const chip = event.target.closest('.sponsor-chip');
    if (!chip || event.pointerType === 'mouse' || !event.pointerType) return;
    if (current !== chip) { event.preventDefault(); show(chip); }
  });
  window.addEventListener('scroll', hide, { passive: true });
}
