// A single, on-demand GLB viewer. Reuses the source site's pinned Three.js release.
let libraries;
function loadScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => { script.remove(); reject(new Error('Library request timed out')); }, 15000);
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('Library unavailable')); };
    document.head.append(script);
  });
}
function loadLibraries() {
  if (!libraries) libraries = (async () => {
    if (!window.THREE) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'sha384-CI3ELBVUz9XQO+97x6nwMDPosPR5XvsxW2ua7N1Xeygeh1IxtgqtCkGfQY9WWdHu');
    if (!window.THREE.GLTFLoader) await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js', 'sha384-fljlqkjWlmSFjkESkQvm77heIZpoWmXEOzlCA7kOpGUH+95Zk0yGfQieWM2q136E');
    return window.THREE;
  })().catch(error => { libraries = undefined; throw error; });
  return libraries;
}
function disposeObject(object) {
  object?.traverse(child => {
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(material => {
      Object.values(material).forEach(value => { if (value?.isTexture) value.dispose(); });
      material.dispose();
    });
  });
}

export function createViewer(container, url) {
  container.innerHTML = `<div class="viewer-stage"><canvas tabindex="0" role="img" aria-label="Interactive 3D model. Use arrow keys to rotate."></canvas><p class="viewer-status" role="status">Loading the 3D model…</p></div><div class="viewer-toolbar"><button type="button" data-turn="-1" aria-label="Rotate model left">← Rotate</button><button type="button" data-reset>Reset view</button><button type="button" data-turn="1" aria-label="Rotate model right">Rotate →</button></div><p class="viewer-hint">Move your pointer over the model, use the rotation buttons, or focus the model and use arrow keys.</p>`;
  const canvas = container.querySelector('canvas');
  const stage = container.querySelector('.viewer-stage');
  const status = container.querySelector('.viewer-status');
  canvas.focus({ preventScroll: true });
  const abort = new AbortController();
  let renderer, observer, model, scene, camera, holder;
  let disposed = false;
  const timer = setTimeout(() => abort.abort(), 60000);

  function render() { if (renderer && model && !disposed) renderer.render(scene, camera); }
  function rotate(x, y = 0) {
    if (!holder) return;
    holder.rotation.y += x;
    holder.rotation.x += y;
    render();
  }
  container.querySelectorAll('[data-turn]').forEach(button => {
    button.addEventListener('click', () => rotate(Number(button.dataset.turn) * Math.PI / 8), { signal: abort.signal });
  });
  container.querySelector('[data-reset]').addEventListener('click', () => {
    if (holder) { holder.rotation.set(0, 0, 0); render(); }
  }, { signal: abort.signal });
  canvas.addEventListener('pointermove', event => {
    if (!holder || (event.pointerType !== 'mouse' && !event.buttons)) return;
    const box = canvas.getBoundingClientRect();
    holder.rotation.y = ((event.clientX - box.left) / box.width - .5) * Math.PI * 2;
    holder.rotation.x = ((event.clientY - box.top) / box.height - .5) * Math.PI;
    render();
  }, { signal: abort.signal });
  canvas.addEventListener('keydown', event => {
    const steps = { ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, -.2], ArrowDown: [0, .2] };
    if (steps[event.key]) { event.preventDefault(); rotate(...steps[event.key]); }
  }, { signal: abort.signal });

  (async () => {
    try {
      const THREE = await loadLibraries();
      if (disposed) return;
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.25));
      const light = new THREE.DirectionalLight(0xffffff, 1.4);
      light.position.set(3, 5, 6);
      scene.add(light);
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error('Model unavailable');
      const bytes = await response.arrayBuffer();
      if (disposed) return;
      model = await new Promise((resolve, reject) => new THREE.GLTFLoader().parse(bytes, '', gltf => resolve(gltf.scene), reject));
      if (disposed) { disposeObject(model); return; }
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const scale = 2.6 / Math.max(size.x, size.y, size.z, .001);
      model.scale.setScalar(scale);
      model.position.copy(bounds.getCenter(new THREE.Vector3()).multiplyScalar(-scale));
      holder = new THREE.Group();
      holder.add(model);
      scene.add(holder);
      observer = new ResizeObserver(() => {
        const { width, height } = stage.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.z = 5.8 / Math.min(camera.aspect, 1);
        camera.updateProjectionMatrix();
        render();
      });
      observer.observe(stage);
      status.hidden = true;
    } catch {
      if (!disposed) {
        status.textContent = 'The 3D preview could not load. You can still explore the photos below.';
        canvas.hidden = true;
        container.querySelector('.viewer-toolbar').hidden = true;
        container.querySelector('.viewer-hint').hidden = true;
      }
    } finally { clearTimeout(timer); }
  })();

  return () => {
    disposed = true;
    clearTimeout(timer);
    abort.abort();
    observer?.disconnect();
    disposeObject(model);
    renderer?.dispose();
    renderer?.forceContextLoss();
  };
}
