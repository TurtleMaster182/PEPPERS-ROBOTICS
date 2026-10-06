// Gallery content and models live in one data file; page copy stays in index.html.
export function initDetails() {
  const dialog = document.querySelector('#detailDialog');
  const content = document.querySelector('#detailContent');
  const collections = new Map();
  let disposeViewer;
  let requestId = 0;

  function open(title, label, description) {
    reset();
    document.querySelector('#detailTitle').textContent = title;
    document.querySelector('#detailLabel').textContent = label;
    document.querySelector('#detailDescription').textContent = description;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    dialog.querySelector('[data-close-dialog]').focus({ preventScroll: true });
    document.body.classList.add('dialog-open');
    return requestId;
  }
  function reset() {
    requestId++;
    disposeViewer?.();
    disposeViewer = undefined;
    content.querySelectorAll('video').forEach(video => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    content.replaceChildren();
  }
  dialog.addEventListener('close', () => {
    reset();
    document.body.classList.remove('dialog-open');
  });
  dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
  });

  function readMedia(collection) {
    if (!collections.has(collection)) {
      collections.set(collection, fetch(`data/${collection}.json`).then(response => {
        if (!response.ok) throw new Error('Gallery unavailable');
        return response.json();
      }).catch(error => { collections.delete(collection); throw error; }));
    }
    return collections.get(collection);
  }

  async function openGallery(collection, recordId, title, label, description) {
    const id = open(title, label, description);
    content.textContent = 'Opening the gallery…';
    try {
      const seasons = await readMedia(collection);
      if (!dialog.open || id !== requestId) return;
      const season = seasons[recordId];
      if (!season) throw new Error('Gallery unavailable');
      content.replaceChildren();
      if (season.model) {
        const viewer = document.createElement('div');
        viewer.className = 'viewer';
        const load = document.createElement('button');
        load.className = 'button';
        load.textContent = 'Load 3D preview';
        viewer.append(load);
        content.append(viewer);
        load.addEventListener('click', async () => {
          load.disabled = true;
          load.textContent = 'Opening 3D preview…';
          try {
            const { createViewer } = await import('./viewer.js');
            if (id !== requestId || !dialog.open) return;
            disposeViewer = createViewer(viewer, season.model);
          } catch {
            load.disabled = false;
            load.textContent = 'Preview unavailable — try again';
          }
        });
      }
      const gallery = document.createElement('div');
      gallery.className = 'detail-gallery';
      season.media.forEach(item => {
        const figure = document.createElement('figure');
        const media = document.createElement(item.type === 'video' ? 'video' : 'img');
        media.src = item.src;
        if (item.type === 'video') {
          media.controls = true;
          media.playsInline = true;
          media.preload = 'none';
          if (item.poster) media.poster = item.poster;
        } else {
          media.alt = item.alt;
          media.loading = 'lazy';
          media.decoding = 'async';
        }
        const caption = document.createElement('figcaption');
        caption.textContent = item.alt || 'From the workshop';
        figure.append(media, caption);
        gallery.append(figure);
      });
      content.append(gallery);
      if (!season.media.length) {
        const note = document.createElement('p');
        note.className = 'empty-note';
        note.textContent = 'Photos and videos from this season will be added to the archive soon.';
        content.append(note);
      }
    } catch {
      if (id !== requestId || !dialog.open) return;
      content.replaceChildren();
      const retry = document.createElement('button');
      retry.className = 'button';
      retry.textContent = 'Gallery unavailable — try again';
      retry.addEventListener('click', () => openGallery(collection, recordId, title, label, description));
      content.append(retry);
    }
  }

  function openSeason(card) {
    openGallery('seasons', card.dataset.seasonId, card.querySelector('h3').textContent, card.querySelector('.season-year').textContent, card.querySelector('.season-description').textContent);
  }
  document.querySelectorAll('[data-open-season]').forEach(button => {
    button.addEventListener('click', () => openSeason(button.closest('[data-season-id]')));
  });
  document.querySelectorAll('[data-season-target]').forEach(button => button.addEventListener('click', () => {
    const card = [...document.querySelectorAll('[data-season-id]')].find(item => item.dataset.seasonId === button.dataset.seasonTarget);
    if (card) openSeason(card);
  }));
  document.querySelectorAll('[data-open-album]').forEach(button => button.addEventListener('click', () => {
    openGallery('albums', button.dataset.openAlbum, button.querySelector('strong').textContent, 'Behind the scenes', 'A closer look at the people and the work behind Peppers Robotics.');
  }));
  document.querySelectorAll('[data-open-film]').forEach(button => button.addEventListener('click', () => {
    open('Inside Peppers.', 'The team film', 'A look at life in and around the workshop.');
    const video = document.createElement('video');
    video.className = 'film-player';
    video.src = '2026-2027/movie.webm';
    video.poster = '2026-2027/KICKOFF1.jpeg';
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    content.append(video);
  }));
}
