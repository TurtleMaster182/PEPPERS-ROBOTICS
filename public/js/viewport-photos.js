// Native loading="lazy" may fetch far ahead of the viewport. Keep the source
// unset until intersection instead; matching <noscript> images cover no-JS use.
export function loadViewportPhoto(photo) {
  const source = photo.dataset.viewportSrc;
  if (!source) return;
  photo.loading = 'eager';
  photo.src = source;
  delete photo.dataset.viewportSrc;
}

export function initViewportPhotos() {
  const photos = [...document.querySelectorAll('img[data-viewport-src]')];
  if (!('IntersectionObserver' in globalThis)) {
    photos.forEach(loadViewportPhoto);
    return;
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loadViewportPhoto(entry.target);
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px', threshold: 0 });
  photos.forEach(photo => observer.observe(photo));
}
