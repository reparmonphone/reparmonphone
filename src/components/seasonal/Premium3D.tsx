'use client';

// Rendu PREMIUM 3D du thème Halloween (WebGL via three.js). Chargé à la demande par HalloweenTheme.tsx,
// uniquement si le style "Premium 3D" est choisi dans /admin/themes ET que l'appareil le permet.
// Si WebGL est indisponible ou si le contexte est perdu, onFail() est appelé et HalloweenTheme
// retombe automatiquement sur le style Classique : le visiteur ne voit jamais un écran cassé.
//
// Un seul <canvas> transparent en position fixe (pointer-events:none) dessine :
//  - une brume volumétrique (shader GPU, bruit fractal déformé) éclairée par une lueur orange ;
//  - des braises 3D avec profondeur de champ ;
//  - des chauves-souris 3D (ailes articulées, éclairage réaliste, passages à des profondeurs variées) ;
//  - des citrouilles 3D sculptées, à la flamme vacillante, posées sur la colline du pied de page
//    et une citrouille flottante qui suit la souris ;
//  - un léger relief (parallaxe) quand on bouge la souris.
// Rendu net sur écrans 4K/Retina (pixel ratio jusqu'à 2), avec baisse de qualité automatique si
// l'appareil peine (jamais de site qui rame).

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type PremiumFlags = {
  fog: boolean;
  embers: boolean;
  bats: boolean;
  swarm: boolean;
  pumpkins3d: boolean;
  pumpkinHero: boolean;
  parallax: boolean;
};

type Props = { flags: PremiumFlags; mult: number; mobile: boolean; preview: boolean; onFail: () => void };

const FOV = 30;
const CAM_Z = 20;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));

/* ------------------------------------------------------------------ */
/*  Brume volumétrique                                                 */
/* ------------------------------------------------------------------ */

const FOG_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FOG_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uDim;
varying vec2 vUv;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; }
  return v;
}
void main(){
  float asp = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 p = vec2(uv.x * asp, uv.y) + uMouse * 0.05;
  float t = uTime * 0.035;
  vec2 q = vec2(fbm(p * 1.6 + vec2(t, 0.0)), fbm(p * 1.6 + vec2(5.2, 1.3) - t));
  float f  = fbm(p * 1.8 + q * 1.7 + vec2(t * 2.0, 0.0));
  float f2 = fbm(p * 3.7 - q * 1.3 + vec2(-t * 3.0, t));
  float h = uv.y;
  float mask = smoothstep(0.56, 0.0, h + (f - 0.5) * 0.38);
  float side = smoothstep(0.0, 0.5, abs(uv.x - 0.5) * 2.0) * 0.3 * smoothstep(0.85, 0.15, h);
  float dens = clamp(mask * (0.3 + f * 1.0) + side * f2, 0.0, 1.0);
  vec3 col = mix(vec3(0.40, 0.28, 0.76), vec3(0.80, 0.66, 1.0), f2);
  col = mix(col, vec3(1.0, 0.52, 0.16), smoothstep(0.22, 0.0, h) * 0.28);
  float a = dens * 0.62 * uDim;
  gl_FragColor = vec4(col * a, a);
}`;

/* ------------------------------------------------------------------ */
/*  Braises 3D                                                         */
/* ------------------------------------------------------------------ */

const EMBER_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uK;
uniform vec2 uHalf;
uniform vec2 uMouse;
varying float vA;
void main(){
  float z = aSeed.z;
  float fz = (${CAM_Z.toFixed(1)} - z) / ${CAM_Z.toFixed(1)};
  float ny = fract(aSeed.y + uTime * (0.35 + aSeed.w) * 0.012);
  float y = -1.05 + ny * 2.25;
  float x = aSeed.x + sin(uTime * (0.4 + aSeed.w * 0.6) + aSeed.y * 20.0) * 0.045 + sin(uTime * 0.21 + z) * 0.02;
  vec3 p = vec3(x * uHalf.x * fz, y * uHalf.y * fz, z);
  p.xy += uMouse * (z + 9.0) * 0.035;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 0.5 + 0.5 * sin(uTime * (2.0 + aSeed.w * 3.0) + aSeed.y * 40.0);
  float dof = smoothstep(2.0, 9.0, abs(z - 2.0));
  gl_PointSize = (0.11 + aSeed.w * 0.12) * (1.0 + dof * 1.1) * uK / (-mv.z);
  vA = (0.4 + 0.6 * tw) * (1.0 - dof * 0.5) * smoothstep(1.0, 0.6, ny) * smoothstep(0.0, 0.1, ny);
  gl_Position = projectionMatrix * mv;
}`;

const EMBER_FRAG = /* glsl */ `
precision highp float;
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float glow = pow(core, 2.1);
  vec3 col = mix(vec3(1.0, 0.40, 0.05), vec3(1.0, 0.84, 0.38), pow(core, 3.0));
  float a = glow * vA;
  gl_FragColor = vec4(col * a, a);
}`;

/* ------------------------------------------------------------------ */
/*  Citrouille 3D                                                      */
/* ------------------------------------------------------------------ */

function makeFaceTextures() {
  const W = 1024;
  const H = 512;
  const map = document.createElement('canvas');
  const emi = document.createElement('canvas');
  map.width = emi.width = W;
  map.height = emi.height = H;
  const m = map.getContext('2d')!;
  const e = emi.getContext('2d')!;
  m.fillStyle = '#ffffff';
  m.fillRect(0, 0, W, H);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, W, H);

  // Le visage est centré sur u = 0,25 (face tournée vers la caméra).
  const cx = 256;
  const cy = 268;
  const draw = (ctx: CanvasRenderingContext2D, fill: string, blur: number) => {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.shadowColor = fill;
    ctx.shadowBlur = blur;
    ctx.lineJoin = 'round';
    const tri = (pts: number[][]) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    };
    tri([[cx - 78, cy - 14], [cx - 24, cy - 22], [cx - 52, cy - 82]]);
    tri([[cx + 78, cy - 14], [cx + 24, cy - 22], [cx + 52, cy - 82]]);
    tri([[cx - 13, cy + 10], [cx + 13, cy + 10], [cx, cy - 16]]);
    ctx.beginPath();
    ctx.moveTo(cx - 104, cy + 26);
    ctx.lineTo(cx - 70, cy + 18);
    ctx.lineTo(cx - 48, cy + 54);
    ctx.lineTo(cx - 24, cy + 26);
    ctx.lineTo(cx, cy + 60);
    ctx.lineTo(cx + 24, cy + 26);
    ctx.lineTo(cx + 48, cy + 54);
    ctx.lineTo(cx + 70, cy + 18);
    ctx.lineTo(cx + 104, cy + 26);
    ctx.quadraticCurveTo(cx, cy + 150, cx - 104, cy + 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  draw(m, '#1a0900', 0); // chair découpée : sombre
  draw(e, '#ffb347', 26); // lueur
  draw(e, '#fff1b0', 6); // cœur incandescent

  const tm = new THREE.CanvasTexture(map);
  const te = new THREE.CanvasTexture(emi);
  tm.colorSpace = THREE.SRGBColorSpace;
  te.colorSpace = THREE.SRGBColorSpace;
  tm.anisotropy = te.anisotropy = 4;
  return { tm, te };
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,170,60,.85)');
  gr.addColorStop(0.35, 'rgba(255,120,20,.32)');
  gr.addColorStop(1, 'rgba(255,100,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPumpkinGeometry() {
  const g = new THREE.SphereGeometry(1, 96, 72);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const bright = new THREE.Color(0xff8f1f);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const phi = Math.atan2(z, x);
    const t = 1 - Math.abs(y); // 0 aux pôles
    const lobe = Math.cos(10 * phi);
    const amp = 0.09 * Math.pow(Math.max(0, 1 - y * y), 0.55);
    const k = (1 + amp * lobe) * 1.12;
    const pull = 1 - 0.2 * Math.exp(-t * 9);
    const ny = y * 0.82 - Math.sign(y) * 0.17 * Math.exp(-t * 16);
    pos.setXYZ(i, x * k * pull, ny, z * k * pull);
    const rib = 0.55 + 0.45 * (0.5 + 0.5 * lobe);
    const pole = 0.55 + 0.45 * THREE.MathUtils.smoothstep(t, 0.0, 0.4);
    const shade = rib * pole;
    c.copy(bright).multiplyScalar(shade);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  // Recoud la couture de la sphère (u = 0 / u = 1) pour un éclairage continu
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  const wSeg = 96;
  const hSeg = 72;
  for (let iy = 0; iy <= hSeg; iy++) {
    const a = iy * (wSeg + 1);
    const b = a + wSeg;
    const nx = nrm.getX(a) + nrm.getX(b);
    const ny = nrm.getY(a) + nrm.getY(b);
    const nz = nrm.getZ(a) + nrm.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  return g;
}

type Pumpkin = {
  group: THREE.Group;
  body: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  light: THREE.PointLight;
  seed: number;
};

/* ------------------------------------------------------------------ */
/*  Chauve-souris 3D                                                   */
/* ------------------------------------------------------------------ */

function wingShape(pts: number[][], mirror: boolean) {
  const s = new THREE.Shape();
  pts.forEach(([f, sp], i) => (i ? s.lineTo(f, mirror ? -sp : sp) : s.moveTo(f, mirror ? -sp : sp)));
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

type Bat = {
  root: THREE.Group;
  bank: THREE.Group;
  wings: { inner: THREE.Object3D; outer: THREE.Object3D; sign: number }[];
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  t0: number;
  dur: number;
  amp: number;
  wob: number;
  ph: number;
  zamp: number;
  w: number;
  scale: number;
  started: boolean;
};

/* ------------------------------------------------------------------ */

export default function Premium3D({ flags, mult, mobile, preview, onFail }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ flags, mult, mobile, preview, onFail });
  live.current = { flags, mult, mobile, preview, onFail };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true });
      if (!renderer.getContext()) throw new Error('no gl');
    } catch {
      live.current.onFail();
      return;
    }
    renderer.setClearColor(0x000000, 0);

    let W = window.innerWidth;
    let H = window.innerHeight;
    let pr = Math.min(window.devicePixelRatio || 1, live.current.mobile ? 1.5 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);
    camera.position.set(0, 0, CAM_Z);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };

    /* ---- lumières ---- */
    scene.add(new THREE.AmbientLight(0x9a86ff, 0.75));
    const moon = new THREE.DirectionalLight(0xb9cbff, 1.35);
    moon.position.set(-6, 9, 8);
    scene.add(moon);
    const rim = new THREE.DirectionalLight(0xff7a22, 0.7);
    rim.position.set(7, -3, 4);
    scene.add(rim);

    /* ---- brume ---- */
    const fogMat = track(
      new THREE.ShaderMaterial({
        vertexShader: FOG_VERT,
        fragmentShader: FOG_FRAG,
        transparent: true,
        premultipliedAlpha: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uRes: { value: new THREE.Vector2(W, H) },
          uMouse: { value: new THREE.Vector2() },
          uDim: { value: 1 },
        },
      }),
    );
    const fogGeo = track(new THREE.PlaneGeometry(2, 1.6));
    fogGeo.translate(0, -0.2, 0);
    const fog = new THREE.Mesh(fogGeo, fogMat);
    fog.frustumCulled = false;
    fog.renderOrder = -10; // dessinée en premier : les citrouilles et chauves-souris restent nettes devant la brume
    scene.add(fog);

    /* ---- braises ---- */
    const EMBERS = live.current.mobile ? 130 : 380;
    const seed = new Float32Array(EMBERS * 4);
    for (let i = 0; i < EMBERS; i++) {
      seed[i * 4] = Math.random() * 2 - 1;
      seed[i * 4 + 1] = Math.random();
      seed[i * 4 + 2] = -9 + Math.random() * 14;
      seed[i * 4 + 3] = Math.random();
    }
    const emGeo = track(new THREE.BufferGeometry());
    emGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(EMBERS * 3), 3));
    emGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    let quality = 1;
    const halfH0 = TAN * CAM_Z;
    const emMat = track(
      new THREE.ShaderMaterial({
        vertexShader: EMBER_VERT,
        fragmentShader: EMBER_FRAG,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uK: { value: 1 },
          uHalf: { value: new THREE.Vector2(halfH0 * (W / H), halfH0) },
          uMouse: { value: new THREE.Vector2() },
        },
      }),
    );
    const embers = new THREE.Points(emGeo, emMat);
    embers.frustumCulled = false;
    scene.add(embers);

    /* ---- citrouilles ---- */
    const { tm, te } = makeFaceTextures();
    disposables.push(tm, te);
    const glowTex = track(makeGlowTexture());
    const pGeo = track(buildPumpkinGeometry());
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.6, 0),
      new THREE.Vector3(0.03, 0.78, 0),
      new THREE.Vector3(0.15, 0.95, 0.02),
      new THREE.Vector3(0.3, 1.02, 0.04),
    ]);
    const stemGeo = track(new THREE.TubeGeometry(stemCurve, 18, 0.085, 10));
    const stemMat = track(new THREE.MeshStandardMaterial({ color: 0x52701f, roughness: 0.95, transparent: true }));

    const makePumpkin = (i: number): Pumpkin => {
      const mat = track(
        new THREE.MeshStandardMaterial({
          vertexColors: true,
          map: tm,
          emissive: new THREE.Color(0xffc24a),
          emissiveMap: te,
          emissiveIntensity: 2.2,
          roughness: 0.5,
          metalness: 0,
          transparent: true,
        }),
      );
      const group = new THREE.Group();
      const body = new THREE.Mesh(pGeo, mat);
      group.add(body);
      group.add(new THREE.Mesh(stemGeo, stemMat));
      const glow = new THREE.Sprite(
        track(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.8 })),
      );
      glow.scale.set(4.6, 4.6, 1);
      glow.position.set(0, 0, -0.6);
      group.add(glow);
      const light = new THREE.PointLight(0xff8a2a, 4, 9, 1.6);
      light.position.set(0, 0.1, 2.2);
      group.add(light);
      group.visible = false;
      scene.add(group);
      return { group, body, mat, glow, light, seed: i * 1.7 + 0.3 };
    };
    const graveSpec: [number, number, number][] = [
      [560, 140, 0.62],
      [846, 141, 0.9],
      [940, 142, 0.48],
      [1210, 140, 0.7],
    ];
    const gravePumpkins = graveSpec.map((_, i) => makePumpkin(i));
    const hero = makePumpkin(9);
    let heroVis = 0;

    /* ---- chauves-souris ---- */
    const innerPts = [[0.25, 0], [0.5, 0.45], [0.66, 1.0], [0.7, 1.6], [-0.2, 1.6], [-0.42, 1.1], [-0.62, 0.6], [-0.5, 0.1], [-0.2, 0]];
    const outerPts = [[0.7, 0], [1.02, 0.5], [0.92, 1.15], [0.42, 1.9], [0.28, 1.3], [0.1, 1.5], [-0.02, 0.9], [-0.3, 1.0], [-0.38, 0.45], [-0.2, 0]].map(
      ([f, s]) => [f - 0.7, s],
    );
    const innerR = track(wingShape(innerPts, false));
    const innerL = track(wingShape(innerPts, true));
    const outerR = track(wingShape(outerPts, false));
    const outerL = track(wingShape(outerPts, true));
    const membrane = track(
      new THREE.MeshStandardMaterial({ color: 0x1e1433, roughness: 0.85, side: THREE.DoubleSide, flatShading: false, emissive: 0x3a1a6e, emissiveIntensity: 0.3, transparent: true }),
    );
    const furMat = track(new THREE.MeshStandardMaterial({ color: 0x120c1c, roughness: 0.8, transparent: true }));
    const eyeMat = track(new THREE.MeshBasicMaterial({ color: 0xff4a2a, transparent: true }));
    const bodyGeo = track(new THREE.SphereGeometry(0.5, 16, 12));
    const headGeo = track(new THREE.SphereGeometry(0.28, 14, 10));
    const earGeo = track(new THREE.ConeGeometry(0.09, 0.32, 8));
    const eyeGeo = track(new THREE.SphereGeometry(0.045, 8, 6));

    const makeBat = (): Bat => {
      const root = new THREE.Group();
      const bank = new THREE.Group();
      root.add(bank);
      const body = new THREE.Mesh(bodyGeo, furMat);
      body.scale.set(1, 0.42, 0.42);
      bank.add(body);
      const head = new THREE.Mesh(headGeo, furMat);
      head.position.set(0.62, 0, 0.02);
      bank.add(head);
      for (const sy of [-1, 1]) {
        const ear = new THREE.Mesh(earGeo, furMat);
        ear.position.set(0.66, sy * 0.15, 0.1);
        ear.rotation.set(sy * 0.25, 0, -0.35);
        bank.add(ear);
        const eye = new THREE.Mesh(eyeGeo, eyeMat);
        eye.position.set(0.86, sy * 0.1, 0.1);
        bank.add(eye);
      }
      const wings: Bat['wings'] = [];
      for (const sign of [1, -1]) {
        const inner = new THREE.Group();
        inner.position.set(0.1, sign * 0.12, 0);
        inner.add(new THREE.Mesh(sign > 0 ? innerR : innerL, membrane));
        const outer = new THREE.Group();
        outer.position.set(0.7, sign * 1.6, 0);
        outer.add(new THREE.Mesh(sign > 0 ? outerR : outerL, membrane));
        inner.add(outer);
        bank.add(inner);
        wings.push({ inner, outer, sign });
      }
      root.visible = false;
      scene.add(root);
      return {
        root, bank, wings,
        p0: new THREE.Vector3(), p1: new THREE.Vector3(),
        t0: 0, dur: 1, amp: 0, wob: 2, ph: 0, zamp: 0, w: 16, scale: 0.2, started: false,
      };
    };
    const bats: Bat[] = [];
    const pool: Bat[] = [];

    const halfAt = (z: number) => {
      const hh = TAN * (CAM_Z - z);
      return { hh, hw: hh * (W / H) };
    };

    const launch = (b: Bat, now: number, kind: 'fly' | 'swarm', delay = 0) => {
      const L = live.current;
      b.scale = kind === 'swarm' ? 0.1 + Math.random() * 0.1 : 0.1 + Math.random() * 0.19;
      b.w = 14 + Math.random() * 8;
      b.ph = Math.random() * 6.28;
      b.zamp = Math.random() * 1.5;
      if (kind === 'fly') {
        const z = -6 + Math.random() * 12;
        const { hh, hw } = halfAt(z);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y0 = (Math.random() * 1.1 - 0.3) * hh;
        const y1 = y0 + (Math.random() - 0.5) * hh * 0.6;
        b.p0.set(dir > 0 ? -hw - 2.5 : hw + 2.5, y0, z);
        b.p1.set(dir > 0 ? hw + 2.5 : -hw - 2.5, y1, z + (Math.random() - 0.5) * 3);
        b.amp = 0.4 + Math.random() * 1.2;
        b.wob = 2 + Math.random() * 1.8;
        const speed = (2.6 + Math.random() * 1.8) * (L.mobile ? 0.8 : 1);
        b.dur = (b.p0.distanceTo(b.p1) / speed) * 1000;
      } else {
        const z = -4 + Math.random() * 7;
        const { hh, hw } = halfAt(z);
        b.p0.set((Math.random() - 0.5) * hw * 0.5, -hh - 1.2, z);
        b.p1.set(b.p0.x + (Math.random() - 0.5) * hw * 1.5, hh + 2.5, z + (Math.random() - 0.5) * 2);
        b.amp = 0.3 + Math.random() * 0.5;
        b.wob = 1.5 + Math.random() * 1.5;
        b.dur = 2400 + Math.random() * 1800;
      }
      b.t0 = now + delay;
      b.started = false;
      b.root.scale.setScalar(b.scale);
      b.root.visible = false;
      bats.push(b);
    };
    const takeBat = () => pool.pop() ?? makeBat();

    /* ---- entrées utilisateur ---- */
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, px: -1, py: -1 };
    const fine = !!window.matchMedia?.('(pointer: fine)').matches;
    const onMove = (e: MouseEvent) => {
      mouse.tx = (e.clientX / W) * 2 - 1;
      mouse.ty = (e.clientY / H) * 2 - 1;
      mouse.px = e.clientX;
      mouse.py = e.clientY;
    };
    if (fine) window.addEventListener('mousemove', onMove, { passive: true });

    const onResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      renderer.setPixelRatio(pr);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      fogMat.uniforms.uRes.value.set(W, H);
      emMat.uniforms.uHalf.value.set(halfH0 * (W / H), halfH0);
    };
    window.addEventListener('resize', onResize);

    let lost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      live.current.onFail();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    /* ---- boucle ---- */
    let raf = 0;
    let last = performance.now();
    let ema = 16;
    let slow = 0;
    let nextSpawn = last + (live.current.preview ? 600 : 2200);
    let swarmDone = false;
    const clock0 = last;
    const tmpV = new THREE.Vector3();
    const tmpV2 = new THREE.Vector3();
    let dim = 1;

    const place = (p: Pumpkin, cxPx: number, cyPx: number, diamPx: number, vis: number, yaw: number, pitch: number, t: number) => {
      const upp = (2 * TAN * CAM_Z) / H;
      p.group.visible = vis > 0.02;
      if (!p.group.visible) return;
      p.group.position.set((cxPx - W / 2) * upp, (H / 2 - cyPx) * upp, 0);
      p.group.scale.setScalar(((diamPx * upp) / 2.4) * vis);
      p.group.rotation.set(pitch, yaw, 0);
      const fl = 0.5 + 0.5 * (Math.sin(t * 13 + p.seed) * 0.5 + Math.sin(t * 7.3 + p.seed * 2) * 0.35 + Math.sin(t * 23 + p.seed * 3) * 0.15);
      p.mat.emissiveIntensity = 1.7 + fl * 1.1;
      p.light.intensity = 3 + fl * 2.5;
      p.glow.material.opacity = (0.55 + fl * 0.35) * Math.min(1, vis);
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (lost || document.hidden) {
        last = now;
        return;
      }
      const dtMs = Math.min(100, now - last);
      last = now;
      const dt = dtMs / 1000;
      const t = (now - clock0) / 1000;
      const L = live.current;
      const F = L.flags;
      const m = L.mult;

      // qualité adaptative : si l'appareil peine, on baisse la définition puis on allège
      ema = ema * 0.95 + dtMs * 0.05;
      if (ema > 30 && t > 3) {
        slow++;
        if (slow > 80) {
          slow = 0;
          if (pr > 1) {
            pr = Math.max(1, pr * 0.75);
            renderer.setPixelRatio(pr);
            renderer.setSize(W, H, false);
          } else {
            quality = Math.max(0.3, quality * 0.7);
          }
          ema = 16;
        }
      } else slow = Math.max(0, slow - 1);

      // souris lissée (relief)
      const par = F.parallax && fine ? 1 : 0;
      mouse.x += (mouse.tx * par - mouse.x) * 0.06;
      mouse.y += (mouse.ty * par - mouse.y) * 0.06;

      // pied de page / cimetière
      const grave = document.querySelector('.hw-grave') as HTMLElement | null;
      let gr: DOMRect | null = null;
      if (grave) {
        const r = grave.getBoundingClientRect();
        if (r.bottom > 0 && r.top < H) gr = r;
      }
      const targetDim = gr ? 0.45 : 1;
      dim += (targetDim - dim) * 0.08;

      fog.visible = F.fog;
      fogMat.uniforms.uTime.value = t;
      fogMat.uniforms.uMouse.value.set(mouse.x, -mouse.y);
      fogMat.uniforms.uDim.value = dim;

      embers.visible = F.embers;
      emGeo.setDrawRange(0, Math.max(10, Math.round(EMBERS * Math.min(1, m / 1.7) * quality)));
      emMat.uniforms.uTime.value = t;
      emMat.uniforms.uK.value = (pr * H) / (2 * TAN);
      emMat.uniforms.uMouse.value.set(mouse.x, -mouse.y);

      // chauves-souris : apparition
      if (F.bats && now >= nextSpawn && bats.length < Math.max(2, Math.round(3 * m))) {
        launch(takeBat(), now, 'fly');
        if (Math.random() < 0.15 * m) launch(takeBat(), now, 'fly', 450);
        nextSpawn = now + (2600 + Math.random() * 4800) / m;
      }
      if (F.swarm && !swarmDone) {
        swarmDone = true;
        let seen = false;
        try {
          seen = !L.preview && sessionStorage.getItem('hw3d_swarm') === '1';
          if (!L.preview) sessionStorage.setItem('hw3d_swarm', '1');
        } catch {
          /* stockage indisponible : la volée se joue à chaque chargement */
        }
        if (!seen) {
          const n = Math.round((L.mobile ? 7 : 13) * Math.min(1.4, m));
          for (let i = 0; i < n; i++) launch(takeBat(), now, 'swarm', 250 + i * 110 + Math.random() * 120);
        }
      }

      // chauves-souris : mouvement
      for (let i = bats.length - 1; i >= 0; i--) {
        const b = bats[i];
        if (now < b.t0) continue;
        const u = (now - b.t0) / b.dur;
        if (u >= 1) {
          b.root.visible = false;
          bats.splice(i, 1);
          pool.push(b);
          continue;
        }
        const at = (uu: number, out: THREE.Vector3) => {
          out.lerpVectors(b.p0, b.p1, uu);
          out.y += Math.sin(uu * Math.PI * b.wob + b.ph) * b.amp;
          out.z += Math.sin(uu * Math.PI * 1.3 + b.ph * 1.7) * b.zamp;
          return out;
        };
        at(u, tmpV);
        at(Math.min(1, u + 0.012), tmpV2);
        const vx = tmpV2.x - tmpV.x;
        const vy = tmpV2.y - tmpV.y;
        b.root.visible = true;
        b.started = true;
        const lz = tmpV.z;
        b.root.position.set(tmpV.x + mouse.x * lz * 0.1, tmpV.y - mouse.y * lz * 0.07, lz);
        b.root.rotation.z = Math.atan2(vy, vx);
        b.bank.rotation.x = Math.sin(t * 0.9 + b.ph) * 0.28 + 0.12;
        // battement : alternance de coups d'ailes et de planés
        const glide = 0.55 + 0.45 * Math.sin(t * 0.7 + b.ph * 2);
        const a = Math.sin(t * b.w + b.ph) * (0.35 + 0.55 * glide) + 0.1;
        const lag = Math.sin(t * b.w + b.ph - 1.1) * 0.5 * (0.4 + 0.6 * glide);
        for (const w of b.wings) {
          w.inner.rotation.x = w.sign * a * 0.6;
          w.outer.rotation.x = w.sign * (a * 0.7 + lag);
        }
        // apparition / disparition douce par la taille
        const edge = Math.min(1, u * 14, (1 - u) * 14);
        b.root.scale.setScalar(b.scale * (0.35 + 0.65 * edge));
      }

      // citrouilles du cimetière
      const showGrave = F.pumpkins3d && !!gr;
      gravePumpkins.forEach((p, i) => {
        if (!showGrave || !gr) {
          p.group.visible = false;
          return;
        }
        const [sx, sy, psc] = graveSpec[i];
        const s = Math.max(gr.width / 1600, gr.height / 150);
        const ox = gr.left + (gr.width - 1600 * s) / 2;
        const baseY = gr.top + gr.height - (150 - sy) * s;
        const cx = ox + sx * s;
        const cy = baseY - 24 * s * psc;
        const diam = 78 * s * psc * 1.2;
        const toMouse = mouse.px >= 0 && fine ? THREE.MathUtils.clamp((mouse.px - cx) / (W * 0.4), -1, 1) * 0.55 : 0;
        place(p, cx, cy, diam, 1, toMouse + Math.sin(t * 0.7 + p.seed) * 0.16, 0.06 + Math.sin(t * 0.9 + p.seed) * 0.03, t);
      });

      // grosse citrouille flottante
      const wantHero = F.pumpkinHero && W >= 1100 && !live.current.mobile && !gr;
      heroVis += ((wantHero ? 1 : 0) - heroVis) * Math.min(1, dt * 4);
      if (heroVis > 0.02) {
        const D = THREE.MathUtils.clamp(W * 0.085, 96, 150);
        const cx = D * 0.55 + 16;
        const cy = H - D * 0.65 - 118 + Math.sin(t * 1.1) * 7;
        const dx = mouse.px >= 0 && fine ? THREE.MathUtils.clamp((mouse.px - cx) / (W * 0.5), -1, 1) : 0;
        const dy = mouse.py >= 0 && fine ? THREE.MathUtils.clamp((mouse.py - cy) / (H * 0.5), -1, 1) : 0;
        place(hero, cx, cy, D, heroVis, dx * 0.75 + Math.sin(t * 0.6) * 0.2, dy * 0.35, t);
      } else hero.group.visible = false;

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onLost);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 46 }}
    />
  );
}
