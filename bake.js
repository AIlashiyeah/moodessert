// Moodessert result-reveal animation: words fall into a bowl, burst into
// particles, and regroup into a 3D point-cloud dessert.
// Three.js r160 only, no assets: every shape is sampled in code.
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const TAU = Math.PI * 2;
const PI = Math.PI;
const MAX_PARTICLES = 18000; // fine grain; pass opts.particles to lower it on weak phones

/* ---------- small maths ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const hex = (h) => {
  h = String(h).replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, f) => [a[0] * f, a[1] * f, a[2] * f];
const WHITE = [1, 1, 1];
const fr = (x) => x - Math.floor(x);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sst = (a, b, x) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const tri = (x) => Math.abs(fr(x) - 0.5) * 2;
const h3 = (x, y, z) => fr(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
function vn(x, y = 0, z = 0) { // value noise, 0..1
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const p = (dz) => l(l(h3(xi, yi, zi + dz), h3(xi + 1, yi, zi + dz), fx), l(h3(xi, yi + 1, zi + dz), h3(xi + 1, yi + 1, zi + dz), fx), fy);
  return l(p(0), p(1), fz);
}
const an = (th, k, s = 0) => vn(Math.cos(th) * k + s + 7, Math.sin(th) * k + 3); // seamless angular noise
function cell(x, y) { // voronoi F2-F1: small near cell borders (cracks)
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const px = xi + dx + h3(xi + dx, yi + dy, 1), py = yi + dy + h3(xi + dx, yi + dy, 2);
    const d = Math.hypot(x - px, y - py);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f2 - f1;
}

/* ---------- surface samplers ----------
   A part = { area, sample(rng) -> [x,y,z,nx,ny,nz,...], col, dens, size, jit, rough, post, xf, count, flat } */
function rect(o, u, v, n, opt = {}) {
  const cx = u[1] * v[2] - u[2] * v[1], cy = u[2] * v[0] - u[0] * v[2], cz = u[0] * v[1] - u[1] * v[0];
  return { ...opt, area: Math.hypot(cx, cy, cz), sample(r) { const a = r(), b = r(); return [o[0] + u[0] * a + v[0] * b, o[1] + u[1] * a + v[1] * b, o[2] + u[2] * a + v[2] * b, n[0], n[1], n[2]]; } };
}
// box centred on x/z, sitting on y0; returns 4 sides + top
function box(sx, sy, sz, y0, sideOpt, topOpt) {
  const x = sx / 2, z = sz / 2;
  return [
    rect([-x, y0, z], [sx, 0, 0], [0, sy, 0], [0, 0, 1], sideOpt),
    rect([-x, y0, -z], [sx, 0, 0], [0, sy, 0], [0, 0, -1], sideOpt),
    rect([x, y0, -z], [0, 0, sz], [0, sy, 0], [1, 0, 0], sideOpt),
    rect([-x, y0, -z], [0, 0, sz], [0, sy, 0], [-1, 0, 0], sideOpt),
    rect([-x, y0 + sy, -z], [sx, 0, 0], [0, 0, sz], [0, 1, 0], topOpt),
  ];
}
// surface of revolution. profile runs bottom -> up the outside -> in over the top.
function lathe(prof, o = {}) {
  const th0 = o.th0 ?? 0, th1 = o.th1 ?? TAU, cx = o.cx ?? 0, cy = o.cy ?? 0, cz = o.cz ?? 0;
  const segs = []; let area = 0;
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    const L = Math.hypot(r1 - r0, y1 - y0); if (L < 1e-6) continue;
    area += L * (r0 + r1) / 2 * (th1 - th0);
    segs.push({ r0, y0, r1, y1, L, acc: area });
  }
  return {
    ...o, area,
    sample(r) {
      const u = r() * area; let s = segs[segs.length - 1];
      for (const q of segs) if (u <= q.acc) { s = q; break; }
      let t = r();
      if (Math.abs(s.r1 - s.r0) > 1e-6) { const rr = Math.sqrt(s.r0 * s.r0 + (s.r1 * s.r1 - s.r0 * s.r0) * t); t = (rr - s.r0) / (s.r1 - s.r0); }
      const th = th0 + r() * (th1 - th0);
      let rr = s.r0 + (s.r1 - s.r0) * t; const y = s.y0 + (s.y1 - s.y0) * t;
      let nr = (s.y1 - s.y0) / s.L, ny = -(s.r1 - s.r0) / s.L, nt = 0;
      if (o.flute) { const f = o.flute, w = f.w ? f.w(y) : 1; rr *= 1 + f.amp * w * Math.cos(f.k * th); nt = f.amp * w * f.k * Math.sin(f.k * th) * 0.6; }
      if (o.flip) { nr = -nr; ny = -ny; }
      const c = Math.cos(th), sn = Math.sin(th);
      return [cx + rr * c, cy + y, cz + rr * sn, nr * c - nt * sn, ny, nr * sn + nt * c, th];
    },
  };
}
const sph = (R, a0, a1, ry = R, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [R * Math.cos(a), ry * Math.sin(a)]; });
// flat cut face of a cake wedge, in the plane through the axis at angle th
function cutFace(th, R, y0, top, sign, o = {}) {
  const tf = typeof top === "number" ? () => top : top;
  let ymax = 0; for (let i = 0; i <= 20; i++) ymax = Math.max(ymax, tf(R * i / 20));
  const c = Math.cos(th), s = Math.sin(th);
  return {
    ...o, area: R * (ymax - y0) * 0.92,
    sample(r) {
      for (let i = 0; i < 40; i++) { const rr = r() * R, y = y0 + r() * (ymax - y0); if (y <= tf(rr)) return [rr * c, y, rr * s, -s * sign, 0, c * sign]; }
      return [R * 0.5 * c, y0, R * 0.5 * s, -s * sign, 0, c * sign];
    },
  };
}
// cake wedge between th=-a and th=0: outer side, top, two cut faces
function wedge({ R, a, top, side, topO, cut }) {
  const tf = typeof top === "number" ? () => top : top;
  const tp = Array.from({ length: 15 }, (_, i) => { const rr = R * (1 - i / 14); return [rr, tf(rr)]; });
  return [
    lathe([[R, 0], [R, tf(R)]], { th0: -a, th1: 0, ...side }),
    lathe(tp, { th0: -a, th1: 0, ...topO }),
    cutFace(0, R, 0, tf, 1, cut),
    cutFace(-a, R, 0, tf, -1, cut),
  ];
}
function torus(R, rt, sq, o = {}) {
  return {
    ...o, area: 4 * PI * PI * R * rt,
    sample(r) {
      const th = r() * TAU; let ph;
      do { ph = r() * TAU; } while (r() > (R + rt * Math.cos(ph)) / (R + rt));
      const cr = Math.cos(ph), sr = Math.sin(ph), c = Math.cos(th), s = Math.sin(th);
      return [(R + rt * cr) * c, rt * sr * sq, (R + rt * cr) * s, cr * c, sr, cr * s, th, ph];
    },
  };
}
// a pile of small cubes; col() sees cube-local coordinates
function cubes(list, o = {}) {
  const N = [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  return {
    ...o, area: list.reduce((a, q) => a + 5.4 * q.s * q.s, 0),
    sample(r) {
      const i = Math.floor(r() * list.length), q = list[i], n = N[Math.floor(r() * 6)];
      const a = (r() - 0.5) * q.s, b = (r() - 0.5) * q.s, h = q.s / 2;
      const p = n[0] ? [n[0] * h, a, b] : n[1] ? [a, n[1] * h, b] : [a, b, n[2] * h];
      return [p[0], p[1], p[2], n[0], n[1], n[2], i];
    },
    xf(pt) { const q = list[pt[6]]; rotY(pt, q.ry || 0); rotX(pt, q.rx || 0); pt[0] += q.c[0]; pt[1] += q.c[1]; pt[2] += q.c[2]; },
  };
}
function rotY(p, a) { if (!a) return; const c = Math.cos(a), s = Math.sin(a); for (const i of [0, 3]) { const x = p[i], z = p[i + 2]; p[i] = c * x + s * z; p[i + 2] = -s * x + c * z; } }
function rotX(p, a) { if (!a) return; const c = Math.cos(a), s = Math.sin(a); for (const i of [0, 3]) { const y = p[i + 1], z = p[i + 2]; p[i + 1] = c * y - s * z; p[i + 2] = s * y + c * z; } }
const tilt = (parts, rx, ry = 0, t = [0, 0, 0]) => parts.flat(Infinity).map((p) => { const inner = p.xf; return { ...p, xf(pt) { if (inner) inner(pt); rotY(pt, ry); rotX(pt, rx); pt[0] += t[0]; pt[1] += t[1]; pt[2] += t[2]; } }; });

/* ---------- the 16 desserts ---------- */
const DESSERTS = {
  "mille-feuille": {
    pal: ["#D9A441", "#F7EBCF", "#3B2314"], yaw: 0.55,
    make([gold, cream, dark]) {
      const band = (y) => (y < 0.13 ? 0 : y < 0.38 ? 1 : y < 0.51 ? 0 : y < 0.76 ? 1 : y < 0.89 ? 0 : 2);
      const side = {
        col: (p, r) => { const b = band(p[1]); return b === 0 ? mix(gold, mul(gold, 0.62), r() * r()) : b === 1 ? cream : mix(cream, WHITE, 0.2); },
        post: (p, r) => { const b = band(p[1]); const d = b === 0 ? 0.035 * r() + 0.01 : b === 1 ? -0.03 : 0; p[0] += p[3] * d; p[2] += p[5] * d; },
        jit: 0.01,
      };
      const top = { col: (p) => (fr((p[0] + 0.1 * tri(p[2] / 0.26)) / 0.21) < 0.3 ? dark : mix(cream, WHITE, 0.25)), dens: 1.3, jit: 0.005 };
      return box(1.7, 0.93, 0.74, 0, side, top);
    },
  },
  opera: {
    pal: ["#2B1810", "#A8744A", "#E6B93F"], yaw: 0.6,
    make([dark, coffee, gold]) {
      const side = { col: (p) => (p[1] > 0.4 ? dark : Math.floor(p[1] / 0.4 * 7) % 2 ? dark : coffee), jit: 0.006, grain: 0.05, dens: 1.5 };
      const top = { col: (p) => mix(dark, WHITE, 0.2 * sst(0.16, 0.0, Math.abs(p[0] * 0.8 + p[2] - 0.1))), jit: 0.004, grain: 0.03 };
      const fleck = { area: 0.05, dens: 3, size: 1.1, col: (p, r) => mix(gold, WHITE, 0.35 * r()), sample(r) { const a = r() * TAU, d = Math.sqrt(r()) * 0.13 * (0.6 + 0.8 * an(a, 2.5, 4)); return [0.42 + d * Math.cos(a), 0.475 + 0.02 * r(), -0.12 + d * Math.sin(a), 0, 1, 0]; }, jit: 0 };
      return [box(1.85, 0.46, 1.05, 0, side, top), fleck];
    },
  },
  "dark-chocolate-tart": {
    pal: ["#C99A5B", "#1D110C", "#6A4632"], yaw: 0,
    make([tan, gan, hi]) {
      const fl = { k: 22, amp: 0.05 };
      const pastry = { col: (p, r) => mix(tan, mul(tan, 0.72), 0.5 * r() + 0.5 * sst(0.1, 0, p[1])), flute: fl };
      return [
        lathe([[0.86, 0], [1.0, 0.32]], pastry),
        lathe([[1.0, 0.32], [0.9, 0.33]], { ...pastry, col: () => mix(tan, WHITE, 0.18), dens: 2 }),
        lathe([[0.9, 0.33], [0.88, 0.26]], { col: () => mul(tan, 0.8), flip: false }),
        lathe([[0.88, 0.26], [0, 0.26]], { col: (p) => { const d = Math.abs(Math.hypot(p[0] + 0.22, p[2] + 0.18) - 0.42); return mix(gan, hi, (p[0] < 0.1 ? 1 : 0) * sst(0.06, 0.0, d)); }, grain: 0.03, jit: 0.004 }),
      ];
    },
  },
  "strawberry-shortcake": {
    pal: ["#F6ECDD", "#EBC56D", "#D62839"], yaw: -0.5,
    make([white, sponge, red]) {
      const R = 1.25, a = 0.95, H = 0.98;
      const cut = {
        col: (p, r) => {
          const y = p[1], rr = Math.hypot(p[0], p[2]);
          for (const c of [0.3, 0.62, 0.94]) { const d = Math.hypot(rr - c, (y - 0.38) * 1.05); if (d < 0.105) return d < 0.045 ? mix(red, WHITE, 0.55) : red; }
          return y < 0.29 || (y > 0.48 && y < 0.78) ? mix(sponge, mul(sponge, 0.8), r() * r()) : white;
        }, grain: 0.04,
      };
      const berry = (rr, th, s) => lathe([[0, 0], [0.11, 0.015], [0.155, 0.09], [0.13, 0.2], [0.06, 0.3], [0, 0.33]].map(([q, y]) => [q * s, y * s]), { cx: rr * Math.cos(th), cz: rr * Math.sin(th), cy: H + 0.05, col: (p, r) => (r() < 0.04 ? mix(red, WHITE, 0.45) : red), dens: 2.2, grain: 0.14 });
      const dollop = (rr, th) => lathe(sph(0.2, 0, PI / 2, 0.09), { cx: rr * Math.cos(th), cz: rr * Math.sin(th), cy: H, col: () => white });
      return [
        wedge({ R, a, top: H, side: { col: () => white }, topO: { col: () => white }, cut }),
        berry(0.92, -a * 0.28, 1.25), berry(0.9, -a * 0.74, 1.2), berry(0.46, -a * 0.5, 1.1),
        dollop(0.92, -a * 0.28), dollop(0.9, -a * 0.74), dollop(0.46, -a * 0.5),
      ];
    },
  },
  tiramisu: {
    pal: ["#3B2416", "#F5E6D3", "#8B5A3C"], yaw: 0.6,
    make([cocoa, cream, coffee]) {
      const side = {
        col: (p, r) => {
          const y = p[1];
          if (y > 0.765) return cocoa;
          const lady = y < 0.16 || (y > 0.38 && y < 0.52);
          if (!lady) return cream;
          const along = Math.abs(p[3]) > 0.5 ? p[2] : p[0];
          const gap = fr(along / 0.2 + 0.5) < 0.14;
          return gap ? mul(coffee, 0.55) : mix(coffee, mul(coffee, 0.7), r());
        },
        post: (p) => { const y = p[1]; const lady = y < 0.16 || (y > 0.38 && y < 0.52); const d = lady ? -0.012 : 0.012; p[0] += p[3] * d; p[2] += p[5] * d; },
        jit: 0.008, grain: 0.05,
      };
      const top = { col: (p, r) => { const e = Math.min(0.575 - Math.abs(p[0]), 0.575 - Math.abs(p[2])); return r() < 0.1 + 0.6 * sst(0.07, 0, e) ? cream : mix(cocoa, coffee, 0.35 * r()); }, dens: 2.2, size: 0.72, rough: 0.012, jit: 0 };
      return box(1.15, 0.8, 1.15, 0, side, top);
    },
  },
  "coffee-jelly": {
    pal: ["#2A150C", "#F4EBDD", "#A9B7C0"], yaw: 0,
    make([coffee, cream, glass], r) {
      const S = 0.4, h = S / 2, list = [];
      [[0.22, 0.27], [0.6, 0.29], [0.97, 0.3]].forEach(([y, rad], k) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + k * 1.05 + r() * 0.3; list.push({ c: [rad * Math.cos(a), y + r() * 0.03, rad * Math.sin(a)], s: S, ry: r() * TAU, rx: (r() - 0.5) * 0.3 }); } });
      list.push({ c: [0, 0.42, 0], s: S, ry: 0.5 }, { c: [0, 0.8, 0], s: S, ry: 1.2 });
      // opaque points cannot be see-through, so the "clear" look is painted on:
      // near-black core, amber glow where the jelly is thin (edges, corners), a bright rim on upper edges
      const deep = mul(coffee, 0.7), glow = mix(coffee, [0.66, 0.31, 0.09], 0.8), shine = mix([1, 0.86, 0.62], WHITE, 0.4);
      const jelly = cubes(list, {
        col: (p) => {
          const n = [p[3], p[4], p[5]], q = [p[0], p[1], p[2]].filter((_, i) => !n[i]).map((v) => Math.abs(v) / h);
          const e = Math.max(q[0], q[1]), top = n[1] > 0.5;
          if (e > 0.9 && (top || p[1] > h * 0.8)) return mix(glow, shine, 0.8);
          if (top && Math.hypot(p[0] + 0.3 * h, p[2] + 0.3 * h) < 0.2 * h) return mix(glow, shine, 0.6);
          return mix(mix(deep, glow, 0.75 * sst(0.5, 1, e)), glow, top ? 0 : 0.3 * sst(h, -h, p[1]));
        }, dens: 1.7, jit: 0.003, grain: 0.03,
      });
      const swirl = {
        area: 2.2, dens: 1.5, col: (p) => mix(cream, mul(cream, 0.84), sst(0.3, -0.7, p[4])), jit: 0.004, grain: 0.03,
        sample(r2) {
          const s = 1 - Math.sqrt(r2()), ang = s * TAU * 2.4, ring = 0.44 * Math.pow(1 - s, 0.85), rho = 0.17 * (1 - 0.7 * s) + 0.025, y = 1.24 + s * 0.42, ph = r2() * TAU;
          const c = Math.cos(ang), sn = Math.sin(ang), cr = Math.cos(ph), sr = Math.sin(ph);
          return [(ring + rho * cr) * c, y + rho * sr, (ring + rho * cr) * sn, cr * c, sr, cr * sn];
        },
      };
      // glass: rim, base and two vertical glints only, so stray points do not speckle the jelly
      const g = { col: () => glass, flat: true, size: 0.6, jit: 0, grain: 0.08 };
      const wall = (y) => 0.62 + 0.15 * y / 1.3;
      const glint = (th) => ({ ...g, size: 0.45, count: 70, col: () => mix(glass, WHITE, 0.45), sample(r2) { const y = 0.06 + r2() * 1.18, t = th + (r2() - 0.5) * 0.05; return [wall(y) * Math.cos(t), y, wall(y) * Math.sin(t), 0, 1, 0]; } });
      return [
        jelly, swirl,
        lathe([[0.74, 1.17], [0, 1.2]], { col: () => mul(cream, 0.95), dens: 1.4, grain: 0.03 }),
        lathe([[0.62, 0], [0.77, 1.3]], { ...g, size: 0.42, dens: 0.1 }),
        lathe([[0.765, 1.29], [0.78, 1.31], [0.76, 1.32]], { ...g, size: 0.7, count: 260 }),
        lathe([[0, 0], [0.62, 0], [0.62, 0.03]], { ...g, size: 0.7, count: 200 }),
        glint(1.0), glint(4.0),
      ];
    },
  },
  "basque-cheesecake": {
    pal: ["#2A1710", "#F3DCA4", "#8A5A2B", "#B79566"], yaw: -0.5,
    make([burnt, custard, caramel, paper]) {
      const R = 1.15, a = 1.0;
      const top = (rr) => { const t = rr / R; return 0.72 + 0.3 * sst(0, 0.72, t) - 0.12 * sst(0.8, 1, t); };
      const jag = (th) => 0.84 + 0.24 * vn(th * 9 + 2, 1.7);
      return [
        wedge({
          R, a, top,
          side: { col: (p) => mix(caramel, burnt, 0.35 + 0.6 * sst(0.2, 0.9, p[1])) },
          topO: { col: (p, r) => (cell(p[0] * 3.6 + 9, p[2] * 3.6) < 0.075 ? mix(caramel, custard, 0.25) : mix(burnt, caramel, 0.4 * vn(p[0] * 3 + 4, p[2] * 3) * r())), post: (p) => { p[1] += 0.03 * (vn(p[0] * 6, p[2] * 6) - 0.5); }, dens: 1.5 },
          cut: {
            col: (p, r) => { const rr = Math.hypot(p[0], p[2]), yt = top(rr), y = p[1]; if (y > yt - 0.075) return burnt; return mix(mix(custard, WHITE, 0.25 * sst(0.5, 0.1, Math.abs(y / yt - 0.45))), caramel, 0.55 * sst(yt - 0.28, yt - 0.075, y) + 0.15 * sst(0.07, 0, y)); },
            grain: 0.04,
          },
        }),
        lathe([[R + 0.04, 0], [R + 0.06, 1.2]], { th0: -a - 0.02, th1: 0.02, col: (p, r) => mix(paper, mul(paper, 0.7), r() * 0.6 + 0.4 * tri(p[6] * 14)), post: (p) => { const j = jag(p[6]); if (p[1] > j) p[1] = j - 0.01 * Math.abs(p[1] - j); const k = 0.02 * Math.sin(p[6] * 46); p[0] *= 1 + k; p[2] *= 1 + k; }, dens: 0.9, size: 0.8, jit: 0 }),
      ];
    },
  },
  souffle: {
    pal: ["#EFE9E1", "#DC9A38", "#FFF7EC"], yaw: 0,
    make([white, golden, sugar]) {
      // smooth white porcelain, no ribs; one soft vertical highlight for the glaze
      const china = (p) => { const t = Math.atan2(p[2], p[0]); return mix(mix(white, [0.7, 0.69, 0.7], 0.35 * sst(0.25, 0, p[1])), WHITE, 0.5 * sst(0.3, 0, Math.abs(fr(t / TAU + 0.3) - 0.5))); };
      const RIM = 0.56;
      return [
        lathe([[0.64, 0], [0.73, 0.03], [0.74, 0.48]], { col: china, grain: 0.02, jit: 0.004, dens: 1.5 }),
        lathe([[0.74, 0.48], [0.8, 0.48], [0.8, RIM], [0.72, RIM]], { col: (p) => mix(china(p), WHITE, 0.25), grain: 0.02, jit: 0.004, dens: 1.8 }),
        // the rise: a tall straight collar, well above the rim, then a browned cap
        lathe([[0.7, RIM], [0.715, 0.8], [0.73, 1.1], [0.735, 1.36], [0.7, 1.5], [0.56, 1.6], [0.3, 1.66], [0, 1.68]], {
          col: (p, r) => {
            const y = p[1], t = Math.atan2(p[2], p[0]);
            if (y > 1.44 && r() < 0.3 * sst(1.42, 1.62, y) + 0.1) return sugar;
            if (y > 1.38) return mix(golden, mul(golden, 0.58), 0.55 * vn(p[0] * 5, y * 5, p[2] * 5) + 0.35 * sst(1.38, 1.6, y));
            return mix(mix(golden, sugar, 0.5), golden, 0.75 * sst(0.9, 1.38, y) + 0.25 * tri(t * 11 / TAU * 3));
          },
          post: (p) => { const l = Math.max(0, p[1] - RIM); p[0] += 0.035 * l; if (p[1] > 1.36) { const b = 1 + 0.05 * (vn(p[0] * 4, p[1] * 4, p[2] * 4) - 0.5); p[0] *= b; p[2] *= b; } },
          dens: 1.7,
        }),
      ];
    },
  },
  "creme-caramel": {
    pal: ["#F2D16B", "#C4741F", "#7C3F12", "#DDD5CA"], yaw: 0,
    make([custard, amber, dark, plate]) {
      const edge = (th) => 0.8 + 0.2 * an(th, 1.6, 2);
      const drip = (th) => 0.1 + 0.42 * Math.pow(an(th, 2.6, 9), 1.6);
      const th = (p) => Math.atan2(p[2], p[0]);
      return [
        lathe([[0.75, 0], [1.0, 0.0], [1.22, 0.085], [1.25, 0.085]], { col: () => plate, flip: true, grain: 0.03 }),
        lathe([[1.02, 0.012], [0, 0.012]], { col: (p) => { const rr = Math.hypot(p[0], p[2]); return rr < edge(th(p)) ? mix(amber, dark, 0.5 * sst(0.9, 0.6, rr)) : plate; }, grain: 0.04 }),
        lathe([[0.68, 0.015], [0.62, 0.32], [0.52, 0.58], [0.46, 0.64], [0, 0.65]], {
          col: (p) => {
            const y = p[1], t = th(p);
            if (y > 0.625) return mix(dark, amber, 0.25 * vn(p[0] * 5, p[2] * 5));
            if (y > 0.64 - drip(t) || y < 0.05) return mix(amber, dark, sst(0.3, 0.64, y) * 0.7);
            return mix(custard, WHITE, 0.3 * sst(0.25, 0, Math.abs(fr(t / TAU + 0.62) - 0.5)));
          }, dens: 1.5, grain: 0.04,
        }),
      ];
    },
  },
  donut: {
    pal: ["#D69F5E", "#F28DB2", "#FFF3D6"], yaw: 0,
    make([dough, glaze, light], r) {
      const R = 0.72, rt = 0.35, sq = 0.88;
      const line = (th) => -0.12 + 0.34 * (an(th, 2.4, 5) - 0.5);
      const glazed = (p) => Math.sin(p[7]) > line(p[6]);
      const ring = torus(R, rt, sq, {
        col: (p) => (glazed(p) ? mix(glaze, WHITE, 0.3 * sst(0.75, 1, Math.sin(p[7])) * sst(0.4, 0, Math.abs(Math.cos(p[7]) + 0.35))) : mix(dough, mix(dough, WHITE, 0.3), sst(0.25, 0, Math.abs(Math.sin(p[7]) + 0.2)))),
        post: (p) => { if (glazed(p)) { p[0] += p[3] * 0.028; p[1] += p[4] * 0.028; p[2] += p[5] * 0.028; } }, jit: 0.006,
      });
      const cols = [light, hex("#4FB8E8"), hex("#FBE04A"), hex("#8CC63F"), hex("#E8552D"), hex("#7B5CD6")];
      const sp = Array.from({ length: 44 }, (_, i) => { const th = r() * TAU, ph = 0.45 + r() * 2.2, d = r() * PI; return { th, ph, d, c: cols[i % cols.length] }; });
      const sprinkles = {
        count: 620, size: 0.85, jit: 0, grain: 0.05, col: (p) => sp[p[6]].c,
        sample(r2) {
          const i = Math.floor(r2() * sp.length), s = sp[i], t = (r2() - 0.5) * 0.15;
          const c = Math.cos(s.th), sn = Math.sin(s.th), cr = Math.cos(s.ph), sr = Math.sin(s.ph);
          const n = [cr * c, sr, cr * sn], tu = [-sn, 0, c], tv = [-sr * c, cr, -sr * sn];
          const dx = Math.cos(s.d), dy = Math.sin(s.d), h = rt + 0.045 + 0.012 * r2(), w = (r2() - 0.5) * 0.022;
          const o = [R * c + n[0] * h, n[1] * h * sq, R * sn + n[2] * h];
          return [o[0] + (tu[0] * dx + tv[0] * dy) * t + (tu[0] * -dy + tv[0] * dx) * w, o[1] + tv[1] * dy * t + tv[1] * dx * w, o[2] + (tu[2] * dx + tv[2] * dy) * t + (tu[2] * -dy + tv[2] * dx) * w, n[0], n[1], n[2], i];
        },
      };
      return tilt([ring, sprinkles], 0.42);
    },
  },
  "mango-bingsu": {
    pal: ["#F3F1EC", "#F5A21B", "#C9A455", "#F6DFA0"], yaw: 0.3,
    make([snow, mango, bowl, milk], r) {
      const list = [];
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; list.push({ c: [0.25 * Math.cos(a), 1.5, 0.25 * Math.sin(a)], s: 0.21, ry: r() * TAU, rx: (r() - 0.5) * 0.6 }); }
      for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; list.push({ c: [0.12 * Math.cos(a), 1.68, 0.12 * Math.sin(a)], s: 0.21, ry: r() * TAU, rx: (r() - 0.5) * 0.6 }); }
      list.push({ c: [0, 1.86, 0], s: 0.21, ry: 0.6, rx: 0.3 }, { c: [0.55, 1.3, 0.3], s: 0.2, ry: 1, rx: 0.4 }, { c: [0.74, 1.06, 0.42], s: 0.2, ry: 2, rx: -0.3 }, { c: [0.86, 0.8, 0.3], s: 0.2, ry: 0.2, rx: 0.5 }, { c: [-0.6, 1.22, 0.38], s: 0.2, ry: 0.7, rx: 0.2 });
      return [
        lathe([[0.36, 0], [0.42, 0.05], [0.78, 0.22], [1.02, 0.52], [1.06, 0.55]], { col: (p) => mix(bowl, mul(bowl, 0.7), sst(0.4, 0, p[1])), grain: 0.05 }),
        lathe([[1.06, 0.55], [0.99, 0.54]], { col: () => mix(bowl, WHITE, 0.3), dens: 2.5 }),
        lathe([[0.99, 0.52], [0.97, 0.74], [0.82, 1.04], [0.58, 1.3], [0.3, 1.47], [0, 1.52]], {
          col: (p) => { const th = Math.atan2(p[2], p[0]); const w = th + 0.35 * Math.sin(p[1] * 9); return p[1] > 0.8 && fr(w / (TAU / 6)) < 0.14 ? milk : mix(snow, [0.78, 0.84, 0.9], 0.55 * vn(p[0] * 7, p[1] * 7, p[2] * 7)); },
          post: (p) => { const b = 1 + 0.08 * (vn(p[0] * 5, p[1] * 5, p[2] * 5) - 0.5); p[0] *= b; p[2] *= b; }, rough: 0.022, dens: 1.2,
        }),
        cubes(list, { col: (p, r2) => mix(mango, mix(mango, WHITE, 0.35), (p[4] > 0.5 ? 0.7 : 0.1) + 0.2 * r2()), dens: 1.8, jit: 0.004 }),
      ];
    },
  },
  brownie: {
    pal: ["#3A2117", "#93603D", "#1F100B"], yaw: 0.65,
    make([choc, crust, crack]) {
      const side = { col: (p, r) => (p[1] > 0.55 ? mix(crust, choc, 0.4) : mix(choc, mul(choc, 0.55), vn(p[0] * 8, p[1] * 8, p[2] * 8) * 0.8 + 0.2 * r())), post: (p) => { const d = 0.03 * (vn(p[0] * 6, p[1] * 9, p[2] * 6) - 0.5) + 0.02 * sst(0.3, 0, p[1]); p[0] += p[3] * d; p[2] += p[5] * d; }, jit: 0.01 };
      const top = {
        col: (p, r) => (cell(p[0] * 3.4 + 3, p[2] * 3.4) < 0.1 ? crack : r() < 0.1 ? mix(crust, WHITE, 0.35) : mix(crust, mul(crust, 0.8), vn(p[0] * 9, p[2] * 9))),
        post: (p) => { if (cell(p[0] * 3.4 + 3, p[2] * 3.4) < 0.1) p[1] -= 0.035; else p[1] += 0.03 * vn(p[0] * 4, p[2] * 4); }, dens: 1.6, jit: 0.004,
      };
      return box(1.15, 0.62, 1.15, 0, side, top);
    },
  },
  macaron: {
    pal: ["#C8A8E2", "#F6EAD7", "#AD86D0"], yaw: 0,
    make([shell, fill, foot]) {
      const dome = [[0.9, 0.17], [0.9, 0.25], [0.86, 0.39], [0.72, 0.5], [0.45, 0.565], [0, 0.58]];
      const feet = [[0.84, 0.075], [0.96, 0.09], [0.97, 0.16], [0.9, 0.17]];
      const neg = (pr) => pr.map(([q, y]) => [q, -y]);
      const sh = { col: (p) => mix(shell, WHITE, 0.28 * sst(0.3, 0, Math.hypot(p[0] + 0.3, p[2] - 0.3) - 0.1) * (p[1] > 0 ? 1 : 0)), grain: 0.04 };
      const ft = { col: (p, r) => mix(foot, mul(foot, 0.75), r() * r()), rough: 0.026, dens: 2.4, size: 0.8, jit: 0 };
      return tilt([
        lathe(dome, sh), lathe(neg(dome), { ...sh, flip: true }),
        lathe(feet, ft), lathe(neg(feet), { ...ft, flip: true }),
        lathe([[0.8, -0.075], [0.87, 0], [0.8, 0.075]], { col: () => fill, dens: 1.6 }),
      ], -0.08);
    },
  },
  "new-york-cheesecake": {
    pal: ["#F5E6BD", "#D9A545", "#9A6A3D"], yaw: -0.5,
    make([cream, golden, crumb]) {
      const R = 1.15, a = 0.9, H = 1.0, B = 0.24;
      const cr = (r) => (r() < 0.12 ? mix(crumb, WHITE, 0.4) : mix(crumb, mul(crumb, 0.55), r()));
      return wedge({
        R, a, top: H,
        side: { col: (p, r) => (p[1] < B ? cr(r) : mix(golden, mul(golden, 0.85), sst(0.5, 1, p[1]))), post: (p) => { if (p[1] < B) { p[0] *= 1.025; p[2] *= 1.025; } } },
        topO: { col: (p) => mix(mix(cream, WHITE, 0.25), golden, sst(R * 0.86, R, Math.hypot(p[0], p[2]))), grain: 0.025, jit: 0.004 },
        cut: { col: (p, r) => (p[1] < B ? cr(r) : p[1] > H - 0.03 ? mix(cream, golden, 0.6) : cream), post: (p, r) => { if (p[1] < B) { const d = 0.02 * r(); p[0] += p[3] * d; p[2] += p[5] * d; } }, grain: 0.03, jit: 0.006 },
      });
    },
  },
  "cream-puff": {
    pal: ["#C98A3C", "#FBF1DD", "#E6BC78"], yaw: 0.3,
    make([choux, cream, cookie]) {
      const bump = (p, cy) => { const b = 1 + 0.07 * (vn(p[0] * 4, p[1] * 4, p[2] * 4) - 0.5); p[0] *= b; p[2] *= b; p[1] = cy + (p[1] - cy) * b; };
      const blobs = [];
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; blobs.push(lathe(sph(0.27, -PI / 2, PI / 2, 0.25), { cx: 0.58 * Math.cos(a), cz: 0.58 * Math.sin(a), cy: 0.98, col: (p, r) => mix(cream, mul(cream, 0.88), sst(0.3, -0.5, p[4]) + 0.08 * r()) })); }
      blobs.push(lathe(sph(0.5, 0, PI / 2, 0.3), { cy: 1.0, col: () => cream }));
      const cap = lathe(sph(0.8, 0.3, PI / 2, 0.6), {
        cy: 0.98, dens: 1.5,
        col: (p, r) => (cell(p[0] * 4.2 + 2, p[2] * 4.2) < 0.085 ? mul(choux, 0.72) : mix(cookie, mix(cookie, WHITE, 0.25), vn(p[0] * 6, p[2] * 6))),
        post: (p) => { if (cell(p[0] * 4.2 + 2, p[2] * 4.2) < 0.085) p[1] -= 0.03; },
      });
      return [
        lathe(sph(0.84, -PI / 2, 0.2, 0.72), { cy: 0.72, col: (p, r) => mix(choux, mul(choux, 0.7), 0.7 * vn(p[0] * 5, p[1] * 5, p[2] * 5) + 0.2 * r()), post: (p) => bump(p, 0.72) }),
        blobs,
        tilt([cap], -0.16, 0, [0, 0.1, 0.04]),
      ];
    },
  },
  "egg-tart": {
    pal: ["#D9A23E", "#F7D354", "#6B3A14"], yaw: 0,
    make([pastry, custard, spot], r) {
      const fl = { k: 14, amp: 0.085, w: (y) => 0.25 + 0.75 * y / 0.6 };
      const spots = Array.from({ length: 4 }, (_, i) => { const a = i / 4 * TAU + r() * 1.1, d = 0.16 + 0.3 * r(); return [d * Math.cos(a), d * Math.sin(a), 0.11 + 0.07 * r()]; });
      return [
        lathe([[0.48, 0], [0.56, 0.06], [0.68, 0.36], [0.86, 0.6]], { flute: fl, col: (p, r2) => mix(pastry, mul(pastry, 0.66), 0.55 * (fr(p[1] * 13) < 0.35 ? 1 : 0) + 0.3 * r2()), rough: 0.008, dens: 1.2 }),
        lathe([[0.86, 0.6], [0.77, 0.61]], { flute: fl, col: () => mix(pastry, WHITE, 0.22), dens: 2.4 }),
        lathe([[0.78, 0.56], [0.5, 0.585], [0, 0.6]], {
          col: (p) => {
            for (const [sx, sz, sr] of spots) { const d = Math.hypot(p[0] - sx, p[2] - sz) / (sr * (0.7 + 0.7 * vn(p[0] * 9, p[2] * 9))); if (d < 1) return mix(spot, mix(custard, spot, 0.5), sst(0.5, 1, d)); }
            return mix(custard, WHITE, 0.35 * sst(0.12, 0, Math.abs(Math.hypot(p[0] + 0.2, p[2] + 0.15) - 0.38)));
          }, dens: 1.6, grain: 0.04, jit: 0.004,
        }),
      ];
    },
  },
};

export const DESSERT_IDS = Object.keys(DESSERTS);

/* ---------- sample a dessert into flat arrays ---------- */
export function sampleDessert(id, palette, N = MAX_PARTICLES) {
  const def = DESSERTS[id];
  if (!def) throw new Error(`bakeDessert: unknown dessert "${id}". Use one of: ${DESSERT_IDS.join(", ")}`);
  const P = def.pal.map(hex);
  (palette || []).forEach((h, i) => { if (h) { try { const c = hex(h); if (c.every(Number.isFinite)) P[i] = c; } catch (e) { /* keep default */ } } });
  const r = mulberry32(hashStr(id));
  const parts = [def.make(P, r)].flat(Infinity);
  let fixed = 0, wsum = 0;
  for (const p of parts) { if (p.count) p.count = Math.round(p.count * N / 5900); p.w = p.count ? 0 : p.area * (p.dens ?? 1); wsum += p.w; fixed += p.count || 0; }
  const free = N - fixed;
  const counts = parts.map((p) => p.count || Math.max(10, Math.floor(free * p.w / wsum)));
  let big = 0; counts.forEach((c, i) => { if (!parts[i].count && c > counts[big]) big = i; });
  counts[big] += N - counts.reduce((a, b) => a + b, 0);

  const position = new Float32Array(N * 3), normal = new Float32Array(N * 3), color = new Float32Array(N * 3), size = new Float32Array(N);
  let k = 0;
  parts.forEach((part, pi) => {
    for (let i = 0; i < counts[pi] && k < N; i++, k++) {
      const pt = part.sample(r);
      if (part.post) part.post(pt, r);
      let c = typeof part.col === "function" ? part.col(pt, r) : part.col || P[0];
      c = mul(c, 1 + (r() - 0.5) * (part.grain ?? 0.08));
      const j = (part.jit ?? 0.02) * r();
      pt[0] -= pt[3] * j; pt[1] -= pt[4] * j; pt[2] -= pt[5] * j;
      if (part.rough) { pt[0] += (r() - 0.5) * 2 * part.rough; pt[1] += (r() - 0.5) * 2 * part.rough; pt[2] += (r() - 0.5) * 2 * part.rough; }
      if (part.xf) part.xf(pt);
      const nl = Math.hypot(pt[3], pt[4], pt[5]) || 1;
      position.set([pt[0], pt[1], pt[2]], k * 3);
      normal.set(part.flat ? [0, 0, 0] : [pt[3] / nl, pt[4] / nl, pt[5] / nl], k * 3);
      color.set([Math.min(c[0], 0.955), Math.min(c[1], 0.955), Math.min(c[2], 0.955)], k * 3);
      size[k] = part.size ?? 1;
    }
  });
  // centre on the bounding box and scale to a unit-ish stage
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < N; i++) for (let a = 0; a < 3; a++) { const v = position[i * 3 + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, cz = (lo[2] + hi[2]) / 2;
  let rad = 0;
  for (let i = 0; i < N; i++) rad = Math.max(rad, Math.hypot(position[i * 3] - cx, position[i * 3 + 2] - cz));
  const s = Math.min(1.02 / rad, 1.5 / (hi[1] - lo[1]));
  for (let i = 0; i < N; i++) { position[i * 3] = (position[i * 3] - cx) * s; position[i * 3 + 1] = (position[i * 3 + 1] - cy) * s; position[i * 3 + 2] = (position[i * 3 + 2] - cz) * s; }
  const point = clamp(2.15 * Math.sqrt(wsum * s * s / free), 0.014, 0.072);
  return { position, normal, color, size, count: N, point, yaw: def.yaw || 0, palette: P };
}

/* ---------- shaders ---------- */
const VERT = /* glsl */ `
attribute vec3 aStart; attribute vec3 aBurst; attribute vec3 aNormal; attribute vec3 aColor;
attribute float aSize; attribute float aSeed;
uniform float uT; uniform float uAngle; uniform float uPx; uniform float uShimmer; uniform vec2 uY;
varying vec3 vCol; varying float vStar;
float backOut(float x){ float c1 = 1.25; float c3 = c1 + 1.0; float y = x - 1.0; return 1.0 + c3*y*y*y + c1*y*y; }
void main(){
  float star = step(1.0, aSeed); float seed = fract(aSeed);
  vStar = star; vCol = aColor;
  if (uT < 1.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  // the finished dessert lands with a soft squash, like something set down on a plate
  vec3 tp = position;
  float land = uT - 3.72;
  float puff = land > 0.0 ? uShimmer * 0.05 * exp(-5.0 * land) * sin(land * 13.0) : 0.0;
  tp.y = uY.x + (tp.y - uY.x) * (1.0 + puff); tp.xz *= 1.0 - 0.6 * puff;
  if (star > 0.5) tp.y += uShimmer * 0.07 * sin(uT * 0.9 + seed * 40.0);
  float ang = star > 0.5 ? -0.55 * uAngle : uAngle;
  float c = cos(ang), s = sin(ang);
  vec3 tgt = vec3(c*tp.x + s*tp.z, tp.y, -s*tp.x + c*tp.z);
  vec3 nrm = vec3(c*aNormal.x + s*aNormal.z, aNormal.y, -s*aNormal.x + c*aNormal.z);
  float pb = clamp((uT - 1.5) / 0.7, 0.0, 1.0);
  float eb = 1.0 - pow(1.0 - pb, 3.0);
  vec3 dir = aBurst - aStart;
  vec3 p = mix(aStart, aBurst, eb) + dir * 0.1 * clamp(uT - 2.2, 0.0, 0.6);
  // it builds from the base up, the way a cake rises
  float hn = clamp((position.y - uY.x) / uY.y, 0.0, 1.0);
  float delay = star > 0.5 ? 0.62 + seed * 0.2 : hn * 0.42 + seed * 0.2;
  float q = clamp((uT - 2.2 - delay) / 1.05, 0.0, 1.0);
  float e = backOut(q);
  vec3 d = mix(p, tgt, e);
  float sw = (1.0 - q) * (1.0 - q) * 1.5 * step(0.0001, q);
  float cs = cos(sw), sn = sin(sw);
  d = vec3(cs*d.x + sn*d.z, d.y, -sn*d.x + cs*d.z);
  float settle = smoothstep(0.6, 1.0, q);
  vec4 mv = modelViewMatrix * vec4(d, 1.0);
  gl_Position = projectionMatrix * mv;
  if (star > 0.5) {
    float tw = mix(0.75, 0.25 + 0.75 * pow(abs(sin(uT * 1.6 + seed * 50.0)), 3.0), uShimmer);
    gl_PointSize = aSize * tw * settle * uPx / gl_Position.w;
    return;
  }
  // warm key light, cool ambient, a little rim so edges glow
  float ndl = dot(nrm, normalize(vec3(0.4, 0.8, 0.45)));
  float rim = pow(1.0 - max(dot(nrm, normalize(cameraPosition - d)), 0.0), 3.0);
  vec3 lit = vec3(0.67, 0.66, 0.69) + vec3(0.40, 0.37, 0.31) * max(ndl, 0.0) + vec3(0.13, 0.11, 0.08) * rim * (0.5 + 0.5 * nrm.y);
  lit *= 0.9 + 0.1 * smoothstep(0.0, 0.22, hn);
  if (dot(aNormal, aNormal) < 0.25) lit = vec3(0.94);
  float hold = smoothstep(3.8, 4.6, uT) * uShimmer;
  float breathe = sin(uT * 2.1 + seed * 43.0) * hold;
  float glint = seed > 0.994 ? pow(max(sin(uT * 2.6 + seed * 900.0), 0.0), 10.0) * hold : 0.0;
  vCol = aColor * mix(vec3(1.08), lit, settle) * (1.0 + 0.04 * breathe) + vec3(0.3, 0.28, 0.22) * glint;
  float grow = smoothstep(1.5, 1.66, uT) * mix(1.3, 1.0, settle) * (1.0 + 0.1 * breathe + 0.3 * glint);
  gl_PointSize = aSize * grow * uPx / gl_Position.w;
}`;
const FRAG = /* glsl */ `
precision mediump float;
varying vec3 vCol; varying float vStar;
void main(){
  vec2 c = gl_PointCoord - 0.5; float d = dot(c, c);
  if (d > 0.25) discard;
  if (vStar > 0.5) { if (abs(c.x) * abs(c.y) > 0.004) discard; gl_FragColor = vec4(vCol, 1.0); return; }
  gl_FragColor = vec4(vCol * (1.0 - 0.1 * smoothstep(0.12, 0.25, d)), 1.0);
}`;
const SHADOW_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vUv; uniform float uO;
void main(){ float r = length(vUv - 0.5) * 2.0; gl_FragColor = vec4(0.22, 0.13, 0.07, uO * smoothstep(1.0, 0.2, r)); }`;
const SHADOW_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const STARS = 64;

/* ---------- word labels ---------- */
const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "Segoe UI", system-ui, sans-serif';
function makeLabel(text, bg) {
  const cv = document.createElement("canvas"), g = cv.getContext("2d"), px = 44, pad = 22;
  g.font = `600 ${px}px ${FONT}`;
  const w = Math.ceil(g.measureText(text).width) + pad * 2, h = px + pad;
  cv.width = w; cv.height = h;
  g.font = `600 ${px}px ${FONT}`;
  const [r, gg, b] = bg, lum = 0.299 * r + 0.587 * gg + 0.114 * b;
  g.fillStyle = `rgb(${r * 255 | 0},${gg * 255 | 0},${b * 255 | 0})`;
  const rad = h / 2;
  g.beginPath(); g.moveTo(rad, 0); g.arcTo(w, 0, w, h, rad); g.arcTo(w, h, 0, h, rad); g.arcTo(0, h, 0, 0, rad); g.arcTo(0, 0, w, 0, rad); g.closePath(); g.fill();
  g.fillStyle = lum > 0.6 ? "#2a1a12" : "#fff8ee";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect: w / h };
}

/* ---------- public API ---------- */
export function bakeDessert(container, opts = {}) {
  const { dessert = "tiramisu", palette, onDone } = opts;
  const words = (opts.words || []).map((w) => String(w).trim()).filter(Boolean).slice(0, 8);
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const still = !!opts.reducedMotion || !!(mq && mq.matches);

  const data = sampleDessert(dessert, palette, clamp(Math.round(opts.particles || MAX_PARTICLES), 2000, 30000));
  const N0 = data.count, N = N0 + STARS, rng = mulberry32((Math.random() * 1e9) | 0);
  let minY = 1e9, maxY = -1e9;
  for (let i = 0; i < N0; i++) { const y = data.position[i * 3 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  // a few slow-twinkling sparkles around the finished dessert, in the same draw call
  const grow = (arr, n) => { const o = new Float32Array(N * n); o.set(arr); return o; };
  data.position = grow(data.position, 3); data.normal = grow(data.normal, 3); data.color = grow(data.color, 3); data.size = grow(data.size, 1);
  const gold = hex("#EDB54A"), blush = mix(data.palette[1] || gold, gold, 0.45);
  for (let i = N0; i < N; i++) {
    const a = rng() * TAU, rr = 1.14 + 0.38 * rng();
    data.position.set([rr * Math.cos(a), minY + 0.15 + rng() * (maxY - minY + 0.35), rr * Math.sin(a)], i * 3);
    data.color.set(rng() < 0.7 ? gold : blush, i * 3);
    data.size[i] = (1.6 + 2.2 * rng()) * 0.034 / data.point;
  }

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.style.cssText = "display:block;width:100%;aspect-ratio:1/1;";
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const FOV = 30, ELEV = 25 * PI / 180, DIST = 5.5;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 30);
  camera.position.set(0, DIST * Math.sin(ELEV), DIST * Math.cos(ELEV));
  camera.lookAt(0, 0, 0);
  // point on the plane facing the camera (x right, y up, d toward the camera)
  const sE = Math.sin(ELEV), cE = Math.cos(ELEV);
  const screen = (x, y, d = 0) => [x, y * cE + d * sE, -y * sE + d * cE];

  // words: where each one lands in the bowl
  const BOWL_Y = -0.62, n = words.length;
  const slots = [[0, 0], [-0.4, 0.06], [0.4, 0.06], [-0.2, 0.2], [0.22, 0.22], [0, 0.38], [-0.46, 0.3], [0.46, 0.32]];
  const labels = words.map((text, i) => {
    const { tex, aspect } = makeLabel(text, data.palette[i % Math.min(3, data.palette.length)]);
    const h = 0.2, w = Math.min(h * aspect, 1.2);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(w, w / aspect, 1); sprite.renderOrder = 2;
    if (!still) scene.add(sprite);
    const land = n > 1 ? 0.6 + 0.9 * i / (n - 1) : 1.5;
    return { sprite, mat, tex, w, h: w / aspect, x: slots[i][0], y: BOWL_Y - 0.3 + slots[i][1], land, x0: slots[i][0] * 0.5 + (rng() - 0.5) * 0.5, rot: (rng() - 0.5) * 0.5 };
  });

  // bowl outline
  const bowlPts = [];
  for (let i = 0; i <= 40; i++) { const a = PI + PI * i / 40; bowlPts.push(new THREE.Vector3(...screen(0.86 * Math.cos(a), BOWL_Y + 0.5 * Math.sin(a)))); }
  for (let i = 0; i <= 48; i++) { const a = TAU * i / 48; bowlPts.push(new THREE.Vector3(...screen(0.86 * Math.cos(a), BOWL_Y + 0.085 * Math.sin(a)))); }
  const bowlGeo = new THREE.BufferGeometry().setFromPoints(bowlPts);
  const bowlMat = new THREE.LineBasicMaterial({ color: 0x9a8b7d, transparent: true, opacity: 0, depthTest: false });
  const bowl = new THREE.Line(bowlGeo, bowlMat); bowl.renderOrder = 1;
  if (!still) scene.add(bowl);

  // particles
  const aStart = new Float32Array(N * 3), aBurst = new Float32Array(N * 3), aSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const L = labels.length ? labels[Math.floor(rng() * labels.length)] : null;
    const sx = L ? L.x + (rng() - 0.5) * L.w : (rng() - 0.5) * 0.7, sy = L ? L.y + (rng() - 0.5) * L.h : BOWL_Y - 0.2 + rng() * 0.2;
    const a = rng() * TAU, m = 0.25 + 0.85 * Math.sqrt(rng());
    const bx = sx * 0.5 + Math.cos(a) * m, by = sy * 0.4 + 0.3 + Math.sin(a) * m * 0.9;
    aStart.set(screen(sx, sy, (rng() - 0.5) * 0.05), i * 3);
    aBurst.set(screen(bx, by, (rng() - 0.5) * 1.2), i * 3);
    aSeed[i] = rng() * 0.999 + (i >= N0 ? 1 : 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(data.position, 3));
  geo.setAttribute("aNormal", new THREE.BufferAttribute(data.normal, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(data.color, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(data.size, 1));
  geo.setAttribute("aStart", new THREE.BufferAttribute(aStart, 3));
  geo.setAttribute("aBurst", new THREE.BufferAttribute(aBurst, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
  const uniforms = { uT: { value: still ? 100 : 0 }, uAngle: { value: data.yaw }, uPx: { value: 1 }, uShimmer: { value: still ? 0 : 1 }, uY: { value: new THREE.Vector2(minY, Math.max(0.01, maxY - minY)) } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  // soft contact shadow so the dessert sits on something
  const shGeo = new THREE.CircleGeometry(1.5, 48);
  const shMat = new THREE.ShaderMaterial({ uniforms: { uO: { value: still ? 0.2 : 0 } }, vertexShader: SHADOW_VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(shGeo, shMat);
  shadow.rotation.x = -PI / 2; shadow.position.y = minY - 0.012;
  scene.add(shadow);

  let dead = false, raf = 0, t0 = null, done = false, stageGone = still;
  function resize() {
    if (dead) return;
    const w = Math.max(1, Math.round(container.clientWidth || 360));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, w, false);
    uniforms.uPx.value = data.point * renderer.domElement.height / (2 * Math.tan(FOV * PI / 360));
    if (still) renderer.render(scene, camera);
  }
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(container); else window.addEventListener("resize", resize);
  resize();

  function clearStage() {
    if (stageGone) return; stageGone = true;
    for (const L of labels) { scene.remove(L.sprite); L.mat.dispose(); L.tex.dispose(); }
    scene.remove(bowl);
  }
  function fireDone() { if (done) return; done = true; if (typeof onDone === "function") { try { onDone(); } catch (e) { console.error(e); } } }

  function frame(now) {
    if (dead) return;
    if (t0 === null) t0 = now;
    const t = (now - t0) / 1000;
    uniforms.uT.value = t;
    // slow turn, eased in so the hold starts without a jolt: one turn per 12 s
    const tau = t - 3.5, om = TAU / 12;
    uniforms.uAngle.value = data.yaw + (tau <= 0 ? 0 : tau < 0.8 ? om * tau * tau / 1.6 : om * (tau - 0.4));
    shMat.uniforms.uO.value = 0.2 * sst(2.7, 4.0, t);
    if (!stageGone) {
      bowlMat.opacity = 0.6 * sst(0, 0.25, t) * (1 - sst(1.5, 2.0, t));
      for (const L of labels) {
        const u = t - (L.land - 0.55);
        if (u < 0) { L.mat.opacity = 0; continue; }
        let y, x = L.x, rot;
        if (u < 0.55) { const f = u / 0.55; y = 1.7 + (L.y - 1.7) * f * f; x = L.x0 + (L.x - L.x0) * f; rot = L.rot * (1 - f) * 2; }
        else { const b = u - 0.55; y = L.y + 0.1 * Math.exp(-5 * b) * Math.abs(Math.sin(10 * b)); rot = L.rot * 0.25 * Math.exp(-4 * b); }
        const out = sst(1.5, 1.85, t);
        L.sprite.position.set(...screen(x, y, 0.02));
        L.mat.rotation = rot;
        L.mat.opacity = sst(0, 0.1, u) * (1 - out);
        L.sprite.scale.set(L.w * (1 + 0.35 * out), L.h * (1 + 0.35 * out), 1);
      }
      if (t > 2.05) clearStage();
    }
    renderer.render(scene, camera);
    if (t >= 4.0) fireDone();
    raf = requestAnimationFrame(frame);
  }
  if (still) { renderer.render(scene, camera); setTimeout(() => { if (!dead) fireDone(); }, 0); }
  else raf = requestAnimationFrame(frame);

  return {
    destroy() {
      if (dead) return; dead = true;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener("resize", resize);
      stageGone = false; clearStage();
      bowlGeo.dispose(); bowlMat.dispose(); geo.dispose(); mat.dispose(); shGeo.dispose(); shMat.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch (e) { /* context already gone */ }
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}

export default bakeDessert;
