// Univers 3D flottant : nébuleuse floue, étoiles, trois planètes (une par matière) et astéroïdes.
// La caméra descend dans l'univers au fil du défilement et suit légèrement la souris.
import * as THREE from 'three';

const canvas = document.getElementById('universe');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); }
catch { throw new Error('WebGL indisponible : le fond CSS reste affiché.'); }
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

// ---------- Nébuleuse (shader plein écran) ----------
const bgScene = new THREE.Scene();
const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const bgU = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uScroll: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) } };
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: bgU, depthTest: false, depthWrite: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
  precision highp float;
  uniform float uTime, uScroll; uniform vec2 uRes, uMouse; varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }
  void main(){
    vec2 p = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
    p.y -= uScroll * 0.6;
    p += (uMouse - 0.5) * 0.08;
    float t = uTime * 0.03;
    vec2 q = vec2(fbm(p*1.4 + t), fbm(p*1.4 - t + 4.0));
    float n = fbm(p*1.6 + q*1.8);
    vec3 col = vec3(0.043, 0.063, 0.15);
    col = mix(col, vec3(0.24, 0.30, 0.95), smoothstep(0.45, 0.85, n) * 0.55);
    col = mix(col, vec3(0.62, 0.32, 0.95), smoothstep(0.55, 0.95, fbm(p*1.1 - q + 9.0)) * 0.45);
    col = mix(col, vec3(0.95, 0.71, 0.09), smoothstep(0.68, 1.0, fbm(p*0.9 + q*2.2 + 3.0)) * 0.30);
    col *= 1.0 - 0.35 * length(vUv - 0.5);
    col += (hash(vUv * uRes + fract(uTime)) - 0.5) * 0.02;
    gl_FragColor = vec4(col, 1.0);
  }`,
})));

// ---------- Scène 3D ----------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b1026, 0.018);
const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
cam.position.set(0, 0, 14);
scene.add(new THREE.AmbientLight(0x8090ff, 0.5));
const sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(-6, 8, 10); scene.add(sun);
const rim = new THREE.DirectionalLight(0x6f80ff, 1.5); rim.position.set(8, -4, -6); scene.add(rim);

// Texture douce pour étoiles et halos (générée, aucun fichier).
function softDot(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
const dot = softDot([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.8)'], [1, 'rgba(255,255,255,0)']]);

// Étoiles : trois couches de tailles différentes pour la profondeur.
const DEPTH = 70; // hauteur de l'univers parcourue au défilement
function stars(count, size, color, opacity) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 1] = 20 - Math.random() * (DEPTH + 50);
    pos[i * 3 + 2] = -Math.random() * 90 + 5;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ size, map: dot, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const p = new THREE.Points(geo, m); scene.add(p); return p;
}
const starLayers = [stars(2200, 0.18, 0xffffff, 0.9), stars(500, 0.38, 0xc9d1ff, 0.8), stars(120, 0.7, 0xffe2a0, 0.7)];

// Planètes : texture procédurale à bandes + halo + anneau / lune.
function planetTexture(a, b) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = a; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 40; i++) {
    g.globalAlpha = 0.08 + Math.random() * 0.18; g.fillStyle = Math.random() > 0.5 ? b : '#ffffff';
    const y = Math.random() * 256, hgt = 4 + Math.random() * 22; g.fillRect(0, y, 512, hgt);
  }
  g.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const planets = [];
function planet({ r, a, b, pos, ring, moon, glow }) {
  const grp = new THREE.Group(); grp.position.set(...pos);
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 64), new THREE.MeshStandardMaterial({ map: planetTexture(a, b), roughness: 0.75, metalness: 0.05 }));
  body.rotation.z = 0.35; grp.add(body);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot([[0, glow + 'aa'], [0.45, glow + '33'], [1, glow + '00']]), depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(r * 4.2); grp.add(halo);
  if (ring) {
    const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.45, r * 2.1, 96), new THREE.MeshBasicMaterial({ color: ring, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }));
    rg.rotation.x = Math.PI / 2.4; rg.rotation.y = 0.3; grp.add(rg);
  }
  let moonMesh = null;
  if (moon) {
    moonMesh = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 32, 32), new THREE.MeshStandardMaterial({ color: moon, roughness: 0.9 }));
    grp.add(moonMesh);
  }
  scene.add(grp); planets.push({ grp, body, moonMesh, r, base: pos.slice(), ph: planets.length * 2.1 });
}
// Une planète par matière : Informatique (bleu), Bureautique (or), Numérique (menthe).
planet({ r: 2.2, a: '#4f63ff', b: '#1c2a9c', pos: [12.5, 5.2, -8], ring: 0xaab6ff, glow: '#6f80ff' });
planet({ r: 1.7, a: '#f2b418', b: '#c46a10', pos: [-8, -20, -8], moon: 0xe8e2d0, glow: '#f2b418' });
planet({ r: 2.0, a: '#34d3b0', b: '#0f7d6a', pos: [8, -38, -9], ring: 0x9ff0dc, glow: '#34d3b0' });
planet({ r: 1.2, a: '#a35bff', b: '#5a22b8', pos: [-7, -56, -7], moon: 0xffffff, glow: '#a35bff' });

// Astéroïdes / petites formes flottantes.
const rocks = [];
const rockMats = [0xf2b418, 0x6f80ff, 0x34d3b0, 0xff8a6b, 0xffffff].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.2, flatShading: true }));
for (let i = 0; i < 26; i++) {
  const geo = i % 3 ? new THREE.IcosahedronGeometry(0.15 + Math.random() * 0.35, 0) : new THREE.OctahedronGeometry(0.2 + Math.random() * 0.3, 0);
  const m = new THREE.Mesh(geo, rockMats[i % rockMats.length]);
  const side = i % 2 ? 1 : -1;
  m.position.set(side * (5 + Math.random() * 7), 6 - Math.random() * (DEPTH + 6), -2 - Math.random() * 12);
  m.userData = { y: m.position.y, sp: 0.3 + Math.random() * 0.8, ph: Math.random() * 6, rx: Math.random() * 0.01, ry: Math.random() * 0.012 };
  scene.add(m); rocks.push(m);
}

// ---------- Interaction ----------
const mouse = new THREE.Vector2(0.5, 0.5), mouseS = new THREE.Vector2(0.5, 0.5);
addEventListener('pointermove', (e) => mouse.set(e.clientX / innerWidth, e.clientY / innerHeight), { passive: true });
let scrollP = 0, scrollS = 0;
const readScroll = () => { const max = Math.max(1, document.documentElement.scrollHeight - innerHeight); scrollP = scrollY / max; };
addEventListener('scroll', () => { readScroll(); if (reduce) draw(0); }, { passive: true });

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); bgU.uRes.value.set(w, h);
  cam.aspect = w / h; cam.updateProjectionMatrix();
  // Écran étroit : planètes rapprochées du centre mais derrière le contenu.
  const narrow = w < 900;
  planets.forEach((p) => { p.grp.position.x = p.base[0] * (narrow ? 0.55 : 1); p.grp.position.z = p.base[2] - (narrow ? 6 : 0); });
}
addEventListener('resize', () => { resize(); if (reduce) draw(0); });
resize(); readScroll();

// ---------- Boucle ----------
const t0 = performance.now();
function draw(now) {
  const t = reduce ? 0 : (now - t0) / 1000;
  scrollS += (scrollP - scrollS) * (reduce ? 1 : 0.06);
  mouseS.lerp(mouse, reduce ? 1 : 0.05);
  bgU.uTime.value = t; bgU.uScroll.value = scrollS; bgU.uMouse.value.copy(mouseS);

  cam.position.y = -scrollS * DEPTH;
  cam.position.x = (mouseS.x - 0.5) * 1.6;
  cam.lookAt(cam.position.x * 0.3, cam.position.y - (mouseS.y - 0.5) * 1.2, 0);

  planets.forEach((p, i) => {
    p.grp.position.y = p.base[1] + Math.sin(t * 0.5 + p.ph) * 0.4;
    p.body.rotation.y = t * (0.08 + i * 0.02);
    if (p.moonMesh) { const a = t * 0.6 + p.ph; p.moonMesh.position.set(Math.cos(a) * p.r * 1.9, Math.sin(a * 0.7) * p.r * 0.4, Math.sin(a) * p.r * 1.9); }
  });
  rocks.forEach((m) => { const u = m.userData; m.position.y = u.y + Math.sin(t * u.sp + u.ph) * 0.5; m.rotation.x += reduce ? 0 : u.rx; m.rotation.y += reduce ? 0 : u.ry; });
  starLayers.forEach((s, i) => { s.rotation.y = t * 0.004 * (i + 1); });

  renderer.clear(); renderer.render(bgScene, bgCam); renderer.clearDepth(); renderer.render(scene, cam);
}
function loop(now) { if (!document.hidden) draw(now); requestAnimationFrame(loop); }
if (reduce) draw(0); else requestAnimationFrame(loop);
canvas.classList.add('on');
