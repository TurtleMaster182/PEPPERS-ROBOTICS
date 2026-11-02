import { createHoverPreview } from '../../js/hover-preview.js';

// Accessible tabs: click or arrow keys switch between projects and awards.
export function initShowcase() {
  const tabs = [...document.querySelectorAll('[data-tab]')];
  if (!tabs.length) return;
  function select(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.setAttribute('tabindex', selected ? '0' : '-1');
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (event.key === 'Home') select(tabs[0], true);
      else if (event.key === 'End') select(tabs[tabs.length - 1], true);
      else if (step) select(tabs[(index + step + tabs.length) % tabs.length], true);
      else return;
      event.preventDefault();
    });
  });
  select(tabs.find(tab => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
}

// Wikipedia-style preview cards for projects and awards (js/hover-preview.js).
// The card text comes from each item's markup; `.preview-only` text is shown in the
// card instead of in the list (it stays visible when JavaScript is off).
const textOf = node => node?.textContent.replace(/\s+/g, ' ').trim() || '';
function line(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

export function initShowcasePreviews() {
  createHoverPreview({
    items: [...document.querySelectorAll('.project-card')],
    id: 'projectPreview',
    label: 'Project preview',
    fill(card, body) {
      const title = textOf(card.querySelector('h3'));
      const ask = document.createElement('a');
      ask.className = 'button';
      ask.href = `mailto:contact@peppers-robotics.ro?subject=${encodeURIComponent(title)}`;
      ask.innerHTML = 'Ask about this project <span aria-hidden="true">↗</span>';
      body.append(
        line('p', 'eyebrow', textOf(card.querySelector('.project-tag'))),
        line('strong', 'hover-preview-title', title),
        line('p', 'hover-preview-text', textOf(card.querySelector('.preview-only'))),
        ask
      );
    }
  });
  createHoverPreview({
    items: [...document.querySelectorAll('.award-list li')],
    id: 'awardPreview',
    label: 'Award preview',
    fill(row, body) {
      const [where] = row.querySelectorAll('div > p:not(.preview-only)');
      body.append(
        line('p', 'eyebrow', `${textOf(row.querySelector('.award-year'))} season`),
        line('strong', 'hover-preview-title', textOf(row.querySelector('h3'))),
        line('p', 'hover-preview-meta', textOf(where)),
        line('p', 'hover-preview-text', textOf(row.querySelector('.award-more')))
      );
    }
  });
}
