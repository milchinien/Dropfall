/* =========================================================================
   tools/arena-png.ts — Zeichnet die Arenen aus src/arenas.ts in PNGs.

   Kein Spielcode: ein minimaler Rasterizer ohne Canvas (Pixelpuffer,
   zlib, fertig), damit man jede Arena ansehen kann, ohne das Spiel zu
   starten. Aufruf:

     sh tools/build-and-run.sh tools/arena-png.ts          alle
     sh tools/build-and-run.sh tools/arena-png.ts 3 7 12   nur diese Level
   ========================================================================= */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import {
  ARENAS,
  BALL_R,
  BUMPER_R,
  PEG_R,
  profileAt,
  type ArenaDef,
} from "../src/arenas";

/* ------------------------------------------------------------ Farben --- */

const COL = {
  page:      [0x2a, 0x25, 0x36],
  field:     [0x24, 0x1f, 0x30],
  frame:     [0x2e, 0xd3, 0xae],
  frameDark: [0x1b, 0x9c, 0x80],
  pegTop:    [0x5c, 0x55, 0x73],
  pegBase:   [0x35, 0x31, 0x3f],
  pegLive:   [0x2e, 0xd3, 0xae],
  pegLiveB:  [0x1a, 0x7a, 0x64],
  amber:     [0xed, 0xb4, 0x43],
  amberDark: [0xb8, 0x87, 0x1f],
  magenta:   [0xe4, 0x34, 0x8f],
  wall:      [0x1b, 0x9c, 0x80],
  wallDark:  [0x12, 0x6b, 0x58],
  shadow:    [0x18, 0x14, 0x22],
  barGlow:   [0xb8, 0x16, 0x16],
  barEdge:   [0xef, 0x4d, 0x18],
  barFill:   [0xa5, 0x0f, 0x0f],
  barRivet:  [0xf4, 0x69, 0x1f],
  ball:      [0xf4, 0xf1, 0xfa],
};

/* --------------------------------------------------- Mini-Rasterizer --- */

const SS = 3;

class Img {
  w: number;
  h: number;
  buf: Uint8Array;

  constructor(w: number, h: number, bg: number[]) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.buf[i * 3] = bg[0];
      this.buf[i * 3 + 1] = bg[1];
      this.buf[i * 3 + 2] = bg[2];
    }
  }

  px(x: number, y: number, c: number[]): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }

  circle(cx: number, cy: number, r: number, c: number[]): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      const dy = y - cy;
      const s = Math.sqrt(Math.max(0, r2 - dy * dy));
      for (let x = Math.floor(cx - s); x <= cx + s; x++) this.px(x, y, c);
    }
  }

  capsule(x1: number, y1: number, x2: number, y2: number, r: number, c: number[]): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const x0 = Math.floor(Math.min(x1, x2) - r);
    const x3 = Math.ceil(Math.max(x1, x2) + r);
    const y0 = Math.floor(Math.min(y1, y2) - r);
    const y3 = Math.ceil(Math.max(y1, y2) + r);
    for (let y = y0; y <= y3; y++) {
      for (let x = x0; x <= x3; x++) {
        let t = ((x - x1) * dx + (y - y1) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        if ((x - px) ** 2 + (y - py) ** 2 <= r * r) this.px(x, y, c);
      }
    }
  }

  rrect(cx: number, cy: number, hx: number, hy: number, rad: number, deg: number, c: number[]): void {
    const a = (deg * Math.PI) / 180;
    const co = Math.cos(a);
    const si = Math.sin(a);
    const reach = Math.ceil(Math.hypot(hx, hy)) + 2;
    const ix = Math.max(0, hx - rad);
    const iy = Math.max(0, hy - rad);
    for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
      for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const lx = Math.abs(dx * co + dy * si) - ix;
        const ly = Math.abs(-dx * si + dy * co) - iy;
        const qx = lx > 0 ? lx : 0;
        const qy = ly > 0 ? ly : 0;
        if (qx * qx + qy * qy <= rad * rad) this.px(x, y, c);
      }
    }
  }

  poly(pts: Array<[number, number]>, c: number[]): void {
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
    for (let y = Math.floor(y0); y <= y1; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (a[1] === b[1]) continue;
        const lo = Math.min(a[1], b[1]);
        const hi = Math.max(a[1], b[1]);
        if (y < lo || y >= hi) continue;
        xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k]); x <= xs[k + 1]; x++) this.px(x, y, c);
      }
    }
  }

  down(f: number): Img {
    const out = new Img(Math.floor(this.w / f), Math.floor(this.h / f), [0, 0, 0]);
    for (let y = 0; y < out.h; y++) {
      for (let x = 0; x < out.w; x++) {
        let r = 0, g = 0, b = 0;
        for (let sy = 0; sy < f; sy++) {
          for (let sx = 0; sx < f; sx++) {
            const i = ((y * f + sy) * this.w + (x * f + sx)) * 3;
            r += this.buf[i];
            g += this.buf[i + 1];
            b += this.buf[i + 2];
          }
        }
        const n = f * f;
        out.px(x, y, [Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
      }
    }
    return out;
  }
}

/* --------------------------------------------------------------- PNG --- */

const CRC_T: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_T[n] = c >>> 0;
}

function chunk(typ: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(typ, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_T[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const cb = Buffer.alloc(4);
  cb.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, cb]);
}

function writePng(path: string, img: Img): void {
  const stride = img.w * 3 + 1;
  const raw = Buffer.alloc(img.h * stride);
  for (let y = 0; y < img.h; y++) {
    raw[y * stride] = 0;
    Buffer.from(img.buf.buffer, img.buf.byteOffset, img.buf.length).copy(
      raw, y * stride + 1, y * img.w * 3, (y + 1) * img.w * 3
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

/* ======================================================== Zeichnen ===== */

const PAD = 34;
const FRAME = 24;

function render(m: ArenaDef): Img {
  const W = m.w + (PAD + FRAME) * 2;
  const H = m.h + (PAD + FRAME) * 2;
  const img = new Img(W * SS, H * SS, COL.page);
  const O = (PAD + FRAME) * SS;
  const S = (v: number) => v * SS;
  const fx = (x: number) => O + S(x);
  const fy = (y: number) => O + S(y);

  const N = 120;
  const shell = (o: number): Array<[number, number]> => {
    const pts: Array<[number, number]> = [];
    pts.push([fx(profileAt(m.left, 0) * m.w) - S(o), fy(0) - S(o)]);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push([fx(profileAt(m.left, t) * m.w) - S(o), fy(t * m.h)]);
    }
    pts.push([fx(profileAt(m.left, 1) * m.w) - S(o), fy(m.h) + S(o)]);
    pts.push([fx(profileAt(m.right, 1) * m.w) + S(o), fy(m.h) + S(o)]);
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      pts.push([fx(profileAt(m.right, t) * m.w) + S(o), fy(t * m.h)]);
    }
    pts.push([fx(profileAt(m.right, 0) * m.w) + S(o), fy(0) - S(o)]);
    return pts;
  };
  img.poly(shell(FRAME), COL.frame);
  img.poly(shell(8), COL.frameDark);
  img.poly(shell(0), COL.field);

  // Rampen und Abfluss
  const ry = m.h * m.rampTop;
  const lx = profileAt(m.left, m.rampTop) * m.w;
  const rx = profileAt(m.right, m.rampTop) * m.w;
  const dcx = m.w * m.drainX;
  const dh = m.drainWidth / 2;
  const ramp = (ax: number, bx: number, r: number, c: number[]) =>
    img.capsule(fx(ax), fy(ry), fx(bx), fy(m.h - 4), S(r), c);
  ramp(lx, dcx - dh, 9, COL.wallDark);
  ramp(rx, dcx + dh, 9, COL.wallDark);
  ramp(lx, dcx - dh, 6.5, COL.wall);
  ramp(rx, dcx + dh, 6.5, COL.wall);
  img.poly([
    [fx(dcx - dh), fy(m.h - 14)], [fx(dcx + dh), fy(m.h - 14)],
    [fx(dcx + dh), fy(m.h)], [fx(dcx - dh), fy(m.h)],
  ], COL.magenta);

  // Emitter und Kugel an der Startposition
  const ew = Math.min(90, m.w * 0.34);
  const ex = m.w * m.spawnX;
  img.poly([
    [fx(ex - ew / 2), fy(14)], [fx(ex + ew / 2), fy(14)],
    [fx(ex + ew / 2), fy(44)], [fx(ex - ew / 2), fy(44)],
  ], COL.amberDark);
  img.poly([
    [fx(ex - ew / 2), fy(14)], [fx(ex + ew / 2), fy(14)],
    [fx(ex + ew / 2), fy(37)], [fx(ex - ew / 2), fy(37)],
  ], COL.amber);
  img.circle(fx(ex), fy(62), S(BALL_R), COL.ball);

  // Rotoren
  for (const ro of m.rotors) {
    for (let i = 0; i < 240; i++) {
      if (i % 10 < 5) continue;
      const a = (i / 240) * Math.PI * 2;
      img.circle(fx(ro.x + Math.cos(a) * ro.r), fy(ro.y + Math.sin(a) * ro.r), S(1.5), COL.wallDark);
    }
    for (let a = 0; a < ro.arms; a++) {
      const ang = ro.phase + (a / ro.arms) * Math.PI * 2;
      const ax = ro.x + Math.cos(ang) * ro.r;
      const ay = ro.y + Math.sin(ang) * ro.r;
      img.capsule(fx(ro.x), fy(ro.y), fx(ax), fy(ay), S(6.5), COL.wallDark);
      img.capsule(fx(ro.x), fy(ro.y), fx(ax), fy(ay), S(4.5), COL.wall);
      img.circle(fx(ax), fy(ay + 3), S(PEG_R), COL.pegLiveB);
      img.circle(fx(ax), fy(ay), S(PEG_R), COL.pegLive);
    }
    img.circle(fx(ro.x), fy(ro.y), S(10), COL.wallDark);
    img.circle(fx(ro.x), fy(ro.y), S(5), COL.frame);
  }

  // Barren
  for (const b of m.barren) {
    const hx = b.len / 2;
    const hy = b.hgt / 2;
    const shellB = (oy: number, in0: number, rad: number, c: number[]) =>
      img.rrect(fx(b.x), fy(b.y + oy), S(hx - in0), S(hy - in0), S(rad), b.deg, c);
    shellB(4, 0, b.rad, COL.shadow);
    shellB(0, 0, b.rad, COL.barGlow);
    shellB(0, 2, b.rad - 0.8, COL.barEdge);
    shellB(0, 4.5, Math.max(1, b.rad - 1.8), COL.barFill);
    const a = (b.deg * Math.PI) / 180;
    for (const k of [-0.27, 0.27]) {
      img.circle(fx(b.x + Math.cos(a) * b.len * k), fy(b.y + Math.sin(a) * b.len * k), S(2.7), COL.barRivet);
    }
  }

  // Bumper
  for (const [bx, by] of m.bumpers) {
    img.circle(fx(bx), fy(by + 5), S(BUMPER_R), COL.shadow);
    img.circle(fx(bx), fy(by), S(BUMPER_R), COL.amberDark);
    img.circle(fx(bx), fy(by - 3), S(BUMPER_R - 1), COL.amber);
  }

  // Pegs
  for (const p of m.pegs) {
    img.circle(fx(p.x), fy(p.y + 3), S(PEG_R), COL.pegBase);
    img.circle(fx(p.x), fy(p.y), S(PEG_R), COL.pegTop);
  }

  return img.down(SS);
}

/* ---------------------------------------------------------- Ausgabe --- */

const wanted = process.argv.slice(2).map((s) => parseInt(s, 10)).filter((n) => !isNaN(n));
const list = wanted.length ? ARENAS.filter((a) => wanted.includes(a.id + 1)) : ARENAS;

for (const a of list) {
  const id = String(a.id + 1).padStart(2, "0");
  const file = "tools/.out-arena-" + id + "-" + a.name.toLowerCase() + ".png";
  writePng(file, render(a));
  console.log(file);
}
