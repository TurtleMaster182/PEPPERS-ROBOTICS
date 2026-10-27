export function initAbout() {
  // Links into the joining section open the relevant answer before scrolling.
  function openLinkedAnswer(hash) {
    const target = document.getElementById(hash.slice(1));
    if (target?.matches('details')) target.open = true;
  }
  document.addEventListener('click', event => {
    const href = event.target.closest('a')?.getAttribute('href');
    if (href?.startsWith('#')) openLinkedAnswer(href);
  });
  window.addEventListener('hashchange', () => openLinkedAnswer(location.hash));
  openLinkedAnswer(location.hash);
}
