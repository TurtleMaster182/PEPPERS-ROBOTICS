// Apply before paint. Storage can be unavailable in private or restricted browsers.
document.documentElement.classList.add('js');
try {
  document.documentElement.classList.toggle('light-mode', localStorage.getItem('theme') === 'light-mode');
} catch { /* The default dark palette works without storage. */ }
// Colour palette: ?palette=team or ?palette=lava in the address switches and remembers it.
try {
  const palettes = ['lava', 'team'];
  const asked = new URLSearchParams(location.search).get('palette');
  if (palettes.includes(asked)) localStorage.setItem('palette', asked);
  const palette = palettes.includes(asked) ? asked : localStorage.getItem('palette');
  if (palette === 'team') document.documentElement.dataset.palette = 'team';
} catch { /* Without storage the default palette is used. */ }
