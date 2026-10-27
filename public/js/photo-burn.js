// Peppers mode: the top photo catches at its bottom edge, chars, drops, and leaves as ash.
// The paper itself is drawn by a WebGL shader; flames, sparks, smoke, and ash share one 2D canvas.
const BURN_MS = 2300;
const CHAR = 0.05;
const PROGRESS_START = -0.03;
const PROGRESS_END = 1 + CHAR * 1.1 + 0.035;
const FIELD_WIDTH = 192;
const LIMITS = { ash: 1900, flame: 1400, smoke: 240, spark: 320 };

const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos;
  gl_Position = vec4(aPos.x * 2. - 1., 1. - aPos.y * 2., 0., 1.);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPhoto;
uniform sampler2D uField;
uniform float uProgress;
uniform float uTime;
uniform float uAspect;
const float CHAR = ${CHAR.toFixed(3)};
const float SCORCH = .11;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.07 + 13.1; a *= .5; }
  return v;
}

void main() {
  vec2 p = vUv * vec2(uAspect, 1.);
  float grain = fbm(p * 26.);
  float b = uProgress - (texture2D(uField, vUv).r + (grain - .5) * .05);

  // Hot air ripples the paper just ahead of the flames.
  float heat = smoothstep(-.14, 0., b) * (1. - smoothstep(0., .02, b));
  vec2 shimmer = vec2(noise(p * 18. + vec2(0., uTime * 4.)), noise(p * 18. - vec2(uTime * 3., 0.))) - .5;
  vec3 color = texture2D(uPhoto, vUv + shimmer * .007 * heat).rgb;

  // Ahead of the front the paper yellows, then browns.
  float scorch = smoothstep(-SCORCH, 0., b);
  color = mix(color, color * vec3(.86, .64, .4), smoothstep(0., .5, scorch));
  color = mix(color, vec3(.24, .12, .05) * (.6 + .5 * grain), smoothstep(.45, 1., scorch) * .92);

  // Behind it: black char, then a crumbling fringe of grey ash.
  float charred = smoothstep(0., CHAR * .3, b);
  color = mix(color, vec3(.03, .026, .022) + .05 * fbm(p * 60.), charred);
  float crumble = noise(p * 140.);
  float ash = smoothstep(CHAR * .72, CHAR * .9, b);
  color = mix(color, vec3(.36, .34, .32) * (.7 + .6 * crumble), ash * step(.45, crumble) * .85);

  // Glowing edge, scattered embers in the char, and firelight on the paper ahead.
  float flicker = .65 + .35 * noise(p * 22. + vec2(uTime * 5., -uTime * 3.));
  float e = (b - CHAR * .62) / (CHAR * .2);
  float edge = exp(-e * e);
  float embers = smoothstep(.72, .95, noise(p * 55. + uTime * .6)) * smoothstep(CHAR * .1, CHAR * .5, b) * (1. - ash);
  vec3 glow = vec3(1., .32, .04) * edge * 2.8 * flicker
    + vec3(1., .78, .4) * edge * edge * edge * edge * 1.6 * flicker
    + vec3(1., .4, .08) * embers * flicker * 1.2
    + vec3(1., .45, .12) * smoothstep(-.06, 0., b) * (1. - charred) * .6 * flicker;

  float alpha = 1. - smoothstep(CHAR * .88, CHAR * 1.02, b + (crumble - .5) * .012);
  gl_FragColor = vec4(color * alpha + glow * mix(.25, 1., alpha), alpha);
}`;

function hash(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, seed) {
  let value = 0, amplitude = .5, total = 0;
  for (let i = 0; i < 4; i++) {
    value += amplitude * valueNoise(x, y, seed + i * 17);
    total += amplitude;
    x *= 2.03;
    y *= 2.03;
    amplitude *= .5;
  }
  return value / total;
}

// Normalised time-of-ignition for every cell: 0 at the bottom middle, 1 at the last corner to go.
// Fire climbs faster than it spreads sideways, and warped noise keeps the front ragged.
function buildField(aspect) {
  const width = FIELD_WIDTH;
  const height = Math.max(48, Math.round(width / aspect));
  const values = new Float32Array(width * height);
  const seed = Math.floor(Math.random() * 1e6);
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + .5) / width, v = (y + .5) / height;
      const px = u * aspect * 2.4, py = v * 2.4;
      const warpX = fbm(px + 3.1, py, seed) - .5;
      const warpY = fbm(px, py + 7.7, seed + 5) - .5;
      const dx = (u - .5 + warpX * .16) * aspect;
      const dy = 1 - v + warpY * .16;
      const value = Math.hypot(dx * 1.2, dy * .82) + (fbm(px * 2.6, py * 2.6, seed + 9) - .5) * .32;
      values[y * width + x] = value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }
  const bytes = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    values[i] = (values[i] - min) / (max - min);
    bytes[i] = Math.round(values[i] * 255);
  }
  const order = new Uint32Array(values.length).map((_, i) => i).sort((a, b) => values[a] - values[b]);
  const sorted = Float32Array.from(order, i => values[i]);
  return { width, height, bytes, order, sorted };
}

// Draw an image into its box the way CSS object-fit lays it out (centred).
function drawFitted(ctx, image, left, top, width, height) {
  if (!image.naturalWidth) return;
  const fit = getComputedStyle(image).objectFit;
  if (fit !== 'contain' && fit !== 'cover') {
    ctx.drawImage(image, left, top, width, height);
    return;
  }
  const scale = Math[fit === 'cover' ? 'max' : 'min'](width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, height);
  ctx.clip();
  ctx.drawImage(image, left + (width - w) / 2, top + (height - h) / 2, w, h);
  ctx.restore();
}

// Redraw the card (paper, photo, caption) so the shader can burn it.
async function snapshot(card, scale) {
  const box = card.getBoundingClientRect();
  const image = card.querySelector('img');
  if (!image.complete) await image.decode().catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(box.width * scale);
  canvas.height = Math.round(box.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const caption = card.querySelector('figcaption');
  const cardStyle = getComputedStyle(card);
  ctx.fillStyle = cardStyle.backgroundColor;
  ctx.fillRect(0, 0, box.width, box.height);
  ctx.strokeStyle = cardStyle.borderTopColor;
  ctx.strokeRect(.5, .5, box.width - 1, box.height - 1);

  const frame = image.getBoundingClientRect();
  const left = frame.left - box.left, top = frame.top - box.top;
  // Keep rounded photo corners (e.g. liquid glass) in the burning copy.
  const imageStyle = getComputedStyle(image);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left, top, frame.width, frame.height, parseFloat(imageStyle.borderTopLeftRadius) || 0);
  ctx.clip();
  ctx.fillStyle = imageStyle.backgroundColor;
  ctx.fillRect(left, top, frame.width, frame.height);
  drawFitted(ctx, image, left, top, frame.width, frame.height);
  ctx.restore();

  const line = caption.getBoundingClientRect();
  const textStyle = getComputedStyle(caption);
  const padding = parseFloat(textStyle.paddingLeft) || 0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(line.left - box.left, line.top - box.top, line.width, line.height);
  ctx.clip();
  ctx.font = `${textStyle.fontStyle} ${textStyle.fontWeight} ${textStyle.fontSize} ${textStyle.fontFamily}`;
  ctx.fillStyle = textStyle.color;
  ctx.textBaseline = 'middle';
  ctx.fillText(caption.textContent, line.left - box.left + padding, line.top - box.top + line.height / 2);
  ctx.restore();
  return canvas;
}

function createPaper(canvas, photo, field) {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = (unit, upload) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    upload();
  };
  texture(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo));
  texture(1, () => {
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, field.width, field.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, field.bytes);
  });
  gl.uniform1i(gl.getUniformLocation(program, 'uPhoto'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uField'), 1);
  gl.uniform1f(gl.getUniformLocation(program, 'uAspect'), canvas.width / canvas.height);
  const progress = gl.getUniformLocation(program, 'uProgress');
  const time = gl.getUniformLocation(program, 'uTime');
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);

  return {
    draw(value, seconds) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(progress, value);
      gl.uniform1f(time, seconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    dispose() { gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  };
}

function sprite(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return canvas;
}

// Irregular flake outlines; each flake picks one and tumbles it.
function flakeShapes() {
  return Array.from({ length: 8 }, () => {
    const path = new Path2D();
    const points = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2 + Math.random() * .5;
      const radius = .45 + Math.random() * .55;
      path[i ? 'lineTo' : 'moveTo'](Math.cos(angle) * radius, Math.sin(angle) * radius * (.6 + Math.random() * .4));
    }
    path.closePath();
    return path;
  });
}

const ASH_COLORS = ['#131110', '#1a1715', '#211d1a', '#29251f', '#322d28', '#3d3732', '#514b45', '#6f6963'];

export function createBurner(host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'burn-particles';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const sprites = {
    flame: sprite([[0, 'rgba(255,244,214,1)'], [.22, 'rgba(255,184,72,.9)'], [.55, 'rgba(236,84,12,.38)'], [1, 'rgba(190,36,0,0)']]),
    deep: sprite([[0, 'rgba(255,128,32,.85)'], [.5, 'rgba(170,38,4,.32)'], [1, 'rgba(120,20,0,0)']]),
    spark: sprite([[0, 'rgba(255,250,225,1)'], [.3, 'rgba(255,190,90,.8)'], [1, 'rgba(255,90,10,0)']]),
    smoke: sprite([[0, 'rgba(112,108,104,.55)'], [.6, 'rgba(112,108,104,.2)'], [1, 'rgba(112,108,104,0)']])
  };
  const shapes = flakeShapes();
  const particles = { ash: [], flame: [], smoke: [], spark: [] };
  const burns = new Set();
  let frame = 0;
  let last = 0;
  let clock = 0;
  let scale = 1;
  let darkTheme = true;

  function resize() {
    scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(innerWidth * scale), height = Math.round(innerHeight * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function add(kind, particle) {
    if (particles[kind].length < LIMITS[kind]) particles[kind].push(particle);
  }

  function spawn(burn, dt) {
    const { field, card } = burn;
    const box = card.getBoundingClientRect();
    const cos = Math.cos(burn.rotation), sin = Math.sin(burn.rotation);
    const size = burn.size;
    const at = index => {
      const u = (index % field.width + Math.random()) / field.width;
      const v = (Math.floor(index / field.width) + Math.random()) / field.height;
      const lx = (u - .5) * burn.width, ly = (v - .5) * burn.height;
      return [box.left + box.width / 2 + burn.sway + lx * cos - ly * sin, box.top + box.height / 2 + burn.drop + lx * sin + ly * cos];
    };

    // Cells whose ember line just passed crumble into flakes.
    const ashLine = burn.progress - CHAR * .88;
    while (burn.ashCursor < field.sorted.length && field.sorted[burn.ashCursor] < ashLine) {
      if (Math.random() < .11) {
        const [x, y] = at(field.order[burn.ashCursor]);
        const big = Math.random() < .08;
        add('ash', {
          x, y,
          vx: (Math.random() - .5) * 30,
          vy: burn.velocity * .8 + (Math.random() - .5) * 24 - 10,
          size: (big ? 4.5 + Math.random() * 4.5 : 1 + Math.random() * 3.2) * size,
          angle: Math.random() * Math.PI * 2,
          spin: (Math.random() - .5) * 7,
          flip: Math.random() * Math.PI * 2,
          flipSpeed: 2 + Math.random() * 6,
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          color: ASH_COLORS[Math.floor(Math.random() * ASH_COLORS.length)],
          glow: Math.random() < .45 ? .4 + Math.random() * .9 : 0,
          wind: burn.wind * (.7 + Math.random() * .6),
          seed: Math.random() * 100,
          age: 0,
          life: 2.6 + Math.random() * 2.4
        });
      }
      burn.ashCursor++;
    }
    while (burn.frontCursor < field.sorted.length && field.sorted[burn.frontCursor] < burn.progress) burn.frontCursor++;

    // Flames, smoke, and sparks rise from whatever is burning right now.
    const start = Math.min(burn.ashCursor, burn.frontCursor);
    const band = burn.frontCursor - start;
    if (!band) return;
    const pick = () => at(field.order[start + Math.floor(Math.random() * band)]);
    const growth = Math.min(1, band / 600);
    burn.flameDebt += (band * .8 + 40) * dt;
    burn.smokeDebt += band * .03 * dt;
    burn.sparkDebt += (band * .035 + 6) * dt;
    for (; burn.flameDebt >= 1; burn.flameDebt--) {
      const [x, y] = pick();
      add('flame', { x, y, vx: (Math.random() - .5) * 20, vy: burn.velocity * .5 - 40 - Math.random() * 70, size: (8 + Math.random() * 16) * size * (.6 + .4 * growth), seed: Math.random() * 100, age: 0, life: .35 + Math.random() * .5 });
    }
    for (; burn.smokeDebt >= 1; burn.smokeDebt--) {
      const [x, y] = pick();
      add('smoke', { x, y, vx: (Math.random() - .5) * 16, vy: -30 - Math.random() * 30, size: (12 + Math.random() * 14) * size, wind: burn.wind, seed: Math.random() * 100, age: 0, life: 1.6 + Math.random() * 1.4 });
    }
    for (; burn.sparkDebt >= 1; burn.sparkDebt--) {
      const [x, y] = pick();
      add('spark', { x, y, vx: (Math.random() - .5) * 140, vy: -90 - Math.random() * 230, size: (1 + Math.random() * 1.6) * size, seed: Math.random() * 100, age: 0, life: .5 + Math.random() * .9 });
    }
  }

  function step(list, dt, update) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list[i] = list[list.length - 1];
        list.pop();
      } else update(p, p.age / p.life);
    }
  }

  function simulate(dt) {
    const t = clock;
    step(particles.ash, dt, (p, k) => {
      // Light ash lifts in the heat, then a strengthening gust carries it off.
      const gust = 45 + 190 * Math.min(1, p.age / 1.8) * (.75 + .25 * Math.sin(t * 1.3 + p.seed));
      const swirlX = Math.sin(p.y * .013 + t * 1.7 + p.seed) * 46 + Math.sin(p.x * .009 - t * 1.1 + p.seed * 2) * 28;
      const swirlY = Math.cos(p.x * .012 + t * 1.5 + p.seed) * 34;
      p.vx += (p.wind * gust + swirlX) * dt;
      p.vy += (swirlY - 34 * Math.max(0, 1 - p.age / 1.2) + 14) * dt;
      p.vx *= 1 - .8 * dt;
      p.vy *= 1 - .9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.flip += p.flipSpeed * dt;
      p.glow = Math.max(0, p.glow - dt * 1.4);
      p.alpha = k < .55 ? 1 : 1 - (k - .55) / .45;
    });
    step(particles.flame, dt, p => {
      p.vy -= 150 * dt;
      p.vx += Math.sin(t * 9 + p.seed) * 60 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    step(particles.smoke, dt, p => {
      p.vx += (p.wind * 55 + Math.sin(t * .9 + p.seed) * 20) * dt;
      p.vy -= 10 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    step(particles.spark, dt, p => {
      p.vy += 60 * dt;
      p.vx += Math.sin(t * 6 + p.seed) * 90 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = scale;
    const flameMode = darkTheme ? 'lighter' : 'source-over';

    ctx.globalCompositeOperation = 'source-over';
    for (const p of particles.smoke) {
      const k = p.age / p.life;
      const r = p.size * (1 + k * 2.6);
      ctx.globalAlpha = Math.min(1, k * 6) * (1 - k) * (darkTheme ? .3 : .22);
      ctx.drawImage(sprites.smoke, (p.x - r) * s, (p.y - r) * s, r * 2 * s, r * 2 * s);
    }

    ctx.globalAlpha = 1;
    for (const p of particles.ash) {
      const sx = p.size * s, sy = p.size * s * Math.max(.12, Math.abs(Math.cos(p.flip)));
      const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
      ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, p.x * s, p.y * s);
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fill(p.shape);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff6a14';
    for (const p of particles.ash) {
      if (!p.glow) continue;
      const sx = p.size * s * .8, sy = sx * Math.max(.12, Math.abs(Math.cos(p.flip)));
      const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
      ctx.setTransform(cos * sx, sin * sx, -sin * sy, cos * sy, p.x * s, p.y * s);
      ctx.globalAlpha = Math.min(1, p.glow) * p.alpha * (.6 + .4 * Math.sin(clock * 30 + p.seed));
      ctx.fill(p.shape);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.globalCompositeOperation = flameMode;
    for (const p of particles.flame) {
      const k = p.age / p.life;
      const w = p.size * (1 - Math.pow(k, 1.6)) * (.85 + .15 * Math.sin(clock * 40 + p.seed));
      const h = w * 1.7;
      const fadeIn = Math.min(1, k / .12);
      ctx.globalAlpha = fadeIn * (1 - k) * (1 - k) * .9;
      ctx.drawImage(sprites.flame, (p.x - w) * s, (p.y - h * .62) * s, w * 2 * s, h * 2 * s);
      ctx.globalAlpha = fadeIn * k * (1 - k) * 1.6;
      ctx.drawImage(sprites.deep, (p.x - w * 1.2) * s, (p.y - h * .8) * s, w * 2.4 * s, h * 2.2 * s);
    }
    for (const p of particles.spark) {
      const k = p.age / p.life;
      const r = p.size * 3 * (1 - k * .6);
      ctx.globalAlpha = (1 - k) * (.55 + .45 * Math.sin(clock * 50 + p.seed));
      ctx.drawImage(sprites.spark, (p.x - r) * s, (p.y - r) * s, r * 2 * s, r * 2 * s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000 || .016);
    last = now;
    clock += dt;
    resize();
    for (const burn of burns) {
      burn.elapsed += dt * 1000;
      const s = Math.min(1, burn.elapsed / BURN_MS);
      burn.progress = PROGRESS_START + (PROGRESS_END - PROGRESS_START) * (.5 * s + .5 * s * s);
      // The paper sags and slowly falls as the fire eats it.
      const drop = burn.height * .42 * Math.pow(s, 2.2);
      burn.velocity = (drop - burn.drop) / dt;
      burn.drop = drop;
      burn.rotation = (burn.tilt * 7 * s * s + Math.sin(s * Math.PI * 2) * 1.2) * Math.PI / 180;
      burn.sway = Math.sin(s * Math.PI * 1.6) * burn.width * .012 * burn.tilt;
      // The surface lives in a fixed layer, so it follows the element as the page scrolls.
      const box = burn.card.getBoundingClientRect();
      burn.canvas.style.left = `${box.left}px`;
      burn.canvas.style.top = `${box.top}px`;
      burn.canvas.style.transform = `translate(${burn.sway}px, ${burn.drop}px) rotate(${burn.rotation}rad)`;
      burn.paper.draw(burn.progress, clock);
      spawn(burn, dt);
      if (s >= 1) burn.finish(true);
    }
    simulate(dt);
    render();
    const alive = burns.size || Object.values(particles).some(list => list.length);
    frame = alive ? requestAnimationFrame(tick) : 0;
    if (!alive) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function run() {
    if (frame) return;
    if (!canvas.isConnected) host.append(canvas);
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }

  return {
    // Resolves true once the card has burned away, false if it could not burn or was cancelled.
    async burn(card) {
      const box = card.getBoundingClientRect();
      const pixels = Math.min(window.devicePixelRatio || 1, 2, 1600 / Math.max(box.width, box.height));
      const photo = await snapshot(card, pixels);
      const surface = document.createElement('canvas');
      surface.className = 'burn-surface';
      surface.width = photo.width;
      surface.height = photo.height;
      surface.style.width = `${box.width}px`;
      surface.style.height = `${box.height}px`;
      const field = buildField(box.width / box.height);
      let paper;
      try { paper = createPaper(surface, photo, field); } catch { paper = null; }
      if (!paper) return false;
      darkTheme = (() => {
        const [r, g, b] = getComputedStyle(host).backgroundColor.match(/\d+/g).map(Number);
        return .2126 * r + .7152 * g + .0722 * b < 128;
      })();
      surface.style.left = `${box.left}px`;
      surface.style.top = `${box.top}px`;
      host.append(surface);
      card.classList.add('is-burning');
      return new Promise(resolve => {
        const burn = {
          card, canvas: surface, paper, field,
          width: box.width, height: box.height,
          size: Math.max(.55, Math.min(1.25, box.width / 700)),
          tilt: Math.random() < .5 ? -1 : 1,
          wind: Math.random() < .5 ? -1 : 1,
          elapsed: 0, progress: PROGRESS_START, drop: 0, velocity: 0, rotation: 0, sway: 0,
          ashCursor: 0, frontCursor: 0, flameDebt: 0, smokeDebt: 0, sparkDebt: 0,
          finish(done) {
            burns.delete(burn);
            paper.dispose();
            surface.remove();
            card.classList.remove('is-burning');
            resolve(done);
          }
        };
        burn.paper.draw(PROGRESS_START, clock);
        burns.add(burn);
        run();
      });
    },
    dispose() {
      cancelAnimationFrame(frame);
      frame = 0;
      for (const burn of [...burns]) burn.finish(false);
      Object.values(particles).forEach(list => { list.length = 0; });
      canvas.remove();
    }
  };
}
