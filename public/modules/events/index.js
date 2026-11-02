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
