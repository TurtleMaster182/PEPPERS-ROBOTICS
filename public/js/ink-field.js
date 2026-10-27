// Procedural transport front. No textures, map bank, or repeated shape templates.
// Experimental inputs: https://doi.org/10.17863/CAM.44080 (CC BY 4.0).
// See docs/dither-flow.md for the distinction between a front and a fluid solve.
export const INK_CALIBRATION = Object.freeze({
  horizontalRms: .2262646469,
  verticalRms: .2680696976,
  widening: .0759880483
});

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let n = Math.imul(state ^ state >>> 15, state | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

// A new rooted tree of transport channels is grown for each reveal. Jittered
// sites keep the branches distributed across the image without a grid look.
function* branchChannels(columns, rows, originX, originY, random) {
  const channels = new Float32Array(columns * rows);
  const spacing = Math.max(10, Math.min(30, Math.min(columns, rows) / 5));
  const target = Math.max(2, Math.min(140, Math.ceil(columns * rows / (spacing * spacing))));
  const ny = Math.max(1, Math.min(target, Math.round(Math.sqrt(target * rows / columns))));
  const nx = Math.max(1, Math.ceil(target / ny));
  const sites = [{ x: originX, y: originY }];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    sites.push({ x: (x + .15 + .7 * random()) / nx * (columns - 1),
      y: (y + .15 + .7 * random()) / ny * (rows - 1) });
  }
  const connected = new Uint8Array(sites.length);
  const parent = new Int32Array(sites.length);
  const distances = new Float64Array(sites.length).fill(Infinity);
  distances[0] = 0;
  function mark(x, y, strength) {
    if (x < 0 || x >= columns || y < 0 || y >= rows) return;
    const i = y * columns + x;
    channels[i] = Math.max(channels[i], strength);
  }
  function draw(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    const bend = (random() - .5) * length * .45;
    const steps = Math.max(1, Math.ceil(length * 3));
    for (let step = 0; step <= steps; step++) {
      const t = step / steps, curve = Math.sin(t * Math.PI) * bend;
      const x = Math.max(0, Math.min(columns - 1, Math.round(a.x + t * dx - dy / length * curve)));
      const y = Math.max(0, Math.min(rows - 1, Math.round(a.y + t * dy + dx / length * curve)));
      mark(x, y, 1);
      mark(x - 1, y, .25); mark(x + 1, y, .25);
      mark(x, y - 1, .25); mark(x, y + 1, .25);
    }
  }
  // Prim's tree connects each new tip to an existing branch. It contains no
  // preset geometry; both the channel sites and their bends use the fresh seed.
  for (let added = 0; added < sites.length; added++) {
    let best = -1;
    for (let i = 0; i < sites.length; i++) {
      if (!connected[i] && (best < 0 || distances[i] < distances[best])) best = i;
    }
    connected[best] = 1;
    if (best > 0) draw(sites[parent[best]], sites[best]);
    const a = sites[best];
    for (let i = 0; i < sites.length; i++) {
      if (connected[i]) continue;
      const b = sites[i], distance = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (distance < distances[i]) { distances[i] = distance; parent[i] = best; }
    }
    if (added % 8 === 0) yield;
  }
  return channels;
}

// Yield periodically so the same solver can run cooperatively without Workers.
export function* inkArrivalSteps(columns, rows, originX, originY, seed) {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || columns * rows > 4_000_000) {
    throw new RangeError('Ink grid is outside the supported size');
  }
  const count = columns * rows;
  const random = randomGenerator(seed);
  const scale = Math.max(1, Math.min(columns, rows));
  const angle = random() * Math.PI * 2;
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  // Fourier streamfunction, not independent pixel noise. Taking its curl gives
  // a spatially continuous, divergence-free disturbance velocity.
  const modes = Array.from({ length: 12 }, () => {
    const k = (.7 + random() * 4.3) * Math.PI;
    const ky = k * (random() < .5 ? -1 : 1);
    const kx = k * INK_CALIBRATION.verticalRms / INK_CALIBRATION.horizontalRms;
    return { kx, ky, phase: random() * Math.PI * 2,
      amplitude: INK_CALIBRATION.horizontalRms * Math.sqrt(2 / 12) / k };
  });
  const flowX = new Float32Array(count), flowY = new Float32Array(count);
  const spread = new Float32Array(count);
  originX = Math.max(0, Math.min(columns - 1, Math.floor(originX)));
  originY = Math.max(0, Math.min(rows - 1, Math.floor(originY)));
  const channels = yield* branchChannels(columns, rows, originX, originY, random);
  const phase = random() * Math.PI * 2;
  // Sample the smooth velocity field sparsely, then interpolate onto every cell.
  // This reduces trigonometry without reducing the actual arrival matrix.
  const spacing = 8, coarseColumns = Math.ceil(columns / spacing) + 1, coarseRows = Math.ceil(rows / spacing) + 1;
  const coarseX = new Float32Array(coarseColumns * coarseRows);
  const coarseY = new Float32Array(coarseX.length), coarseSpread = new Float32Array(coarseX.length);
  for (let cy = 0; cy < coarseRows; cy++) {
    for (let cx = 0; cx < coarseColumns; cx++) {
      const x = cx * spacing, y = cy * spacing;
      const px = (x - originX) / scale, py = (y - originY) / scale;
      const u = px * cosine + py * sine, v = -px * sine + py * cosine;
      let a = 0, b = 0;
      for (const mode of modes) {
        const wave = mode.amplitude * Math.sin(mode.kx * u + mode.ky * v + mode.phase);
        a -= mode.ky * wave;
        b += mode.kx * wave;
      }
      const i = cy * coarseColumns + cx;
      // Artistic gain makes the measured fluctuations legible at dither scale.
      coarseX[i] = 1.8 * (a * cosine - (b + .12) * sine);
      coarseY[i] = 1.8 * (a * sine + (b + .12) * cosine);
      coarseSpread[i] = .95 + .3 * Math.sin(3 * u + phase) * Math.sin(4 * v - phase)
        + INK_CALIBRATION.widening * Math.min(3, Math.hypot(px, py));
    }
    if (cy % 16 === 0) yield;
  }
  for (let y = 0; y < rows; y++) {
    const cy = Math.floor(y / spacing), fy = y / spacing - cy;
    for (let x = 0; x < columns; x++) {
      const cx = Math.floor(x / spacing), fx = x / spacing - cx;
      const a = cy * coarseColumns + cx, b = a + coarseColumns, i = y * columns + x;
      const w0 = (1 - fx) * (1 - fy), w1 = fx * (1 - fy), w2 = (1 - fx) * fy, w3 = fx * fy;
      flowX[i] = coarseX[a] * w0 + coarseX[a + 1] * w1 + coarseX[b] * w2 + coarseX[b + 1] * w3;
      flowY[i] = coarseY[a] * w0 + coarseY[a + 1] * w1 + coarseY[b] * w2 + coarseY[b + 1] * w3;
      spread[i] = coarseSpread[a] * w0 + coarseSpread[a + 1] * w1 + coarseSpread[b] * w2 + coarseSpread[b + 1] * w3;
    }
    if (y % 16 === 0) yield;
  }

  // Earliest-arrival solution for an advected spreading front:
  //   ΔT = distance / (F + velocity · direction).
  // Dial's bucket queue quantizes edge time to 1/16 unit and avoids a costly
  // heap operation at every photo pixel. All edge costs are <= 151 < 256.
  const unseen = 0xFFFFFFFF;
  const arrival = new Uint32Array(count).fill(unseen);
  const next = new Int32Array(count).fill(-1), previous = new Int32Array(count).fill(-1);
  const buckets = new Int32Array(256).fill(-1);
  let length = 0, clock = 0;
  function update(index, time) {
    const old = arrival[index];
    if (old !== unseen) {
      if (previous[index] >= 0) next[previous[index]] = next[index];
      else buckets[old & 255] = next[index];
      if (next[index] >= 0) previous[next[index]] = previous[index];
      length--;
    }
    arrival[index] = time;
    const bucket = time & 255, head = buckets[bucket];
    next[index] = head; previous[index] = -1;
    if (head >= 0) previous[head] = index;
    buckets[bucket] = index;
    length++;
  }
  function pop() {
    while (buckets[clock & 255] < 0) clock++;
    const index = buckets[clock & 255];
    buckets[clock & 255] = next[index];
    if (next[index] >= 0) previous[next[index]] = -1;
    previous[index] = -2;
    length--;
    return index;
  }
  const origin = originY * columns + originX;
  update(origin, 0);
  let maximum = 0, visited = 0;
  const neighborX = [-1, 1, 0, 0, -1, 1, -1, 1], neighborY = [0, 0, -1, 1, -1, -1, 1, 1];
  while (length) {
    const i = pop(), x = i % columns, y = Math.floor(i / columns);
    maximum = Math.max(maximum, arrival[i]);
    for (let direction = 0; direction < 8; direction++) {
      const dx = neighborX[direction], dy = neighborY[direction], distance = direction < 4 ? 1 : Math.SQRT2;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= columns || ny < 0 || ny >= rows) continue;
      const j = ny * columns + nx;
      if (previous[j] === -2) continue;
      const advection = ((flowX[i] + flowX[j]) * dx + (flowY[i] + flowY[j]) * dy) / (2 * distance);
      // Tips race along the tree while lateral seepage slowly thickens each
      // branch. The same propagation eventually joins the gaps without a wipe.
      const channel = Math.min(channels[i], channels[j]);
      const speed = Math.max(.15, ((spread[i] + spread[j]) / 2 + .3 * advection) * (.18 + 5.82 * channel));
      const time = arrival[i] + Math.max(1, Math.round(16 * distance / speed));
      if (time < arrival[j]) update(j, time);
    }
    if (++visited % 2048 === 0) yield;
  }
  const thresholds = new Uint8Array(count);
  // One continuous spread through the entire image; no separate final wipe.
  for (let i = 0; i < count; i++) thresholds[i] = 1 + Math.round(251 * arrival[i] / (maximum || 1));
  return thresholds;
}

export function generateInkArrival(columns, rows, originX, originY, seed) {
  const steps = inkArrivalSteps(columns, rows, originX, originY, seed);
  let result;
  do { result = steps.next(); } while (!result.done);
  return result.value;
}
