// Set before the body paints. If the main module fails, restore visible content.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && CSS.supports('mask-image', 'linear-gradient(white, white)')) {
  document.documentElement.classList.add('dither-boot');
  setTimeout(() => document.documentElement.classList.remove('dither-boot'), 2500);
}
