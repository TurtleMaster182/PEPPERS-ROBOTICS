// Apply before paint. Storage can be unavailable in private or restricted browsers.
document.documentElement.classList.add('js');
try {
  document.documentElement.classList.toggle('light-mode', localStorage.getItem('theme') === 'light-mode');
} catch { /* The default dark palette works without storage. */ }
