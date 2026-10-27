export function initSeasons() {
  // Models live on the page again; load only as they approach the viewport.
  const modelObserver = new IntersectionObserver(entries => {
    entries.forEach(async entry => {
      if (!entry.isIntersecting) return;
      modelObserver.unobserve(entry.target);
      const { createViewer } = await import('../../js/viewer.js');
      const mount = document.createElement('div');
      mount.className = 'inline-viewer';
      entry.target.append(mount);
      createViewer(mount, entry.target.dataset.inlineModel, { autofocus: false });
    });
  }, { rootMargin: '160px' });
  document.querySelectorAll('[data-inline-model]').forEach(element => modelObserver.observe(element));
}
