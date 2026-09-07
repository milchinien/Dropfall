/* =========================================================================
   tools/tree-png.ts — Zeichnet das Baumlayout in ein PNG.

   Die Metriken in layout-check.ts sagen, ob sich etwas beruehrt. Ob der Baum
   verwinkelt AUSSIEHT, sagt nur ein Bild. Deshalb hier ein minimaler
   Renderer ohne Canvas: Pixelpuffer, zlib, fertig.

   Aufruf: sh tools/build-and-run.sh tools/tree-png.ts
   ========================================================================= */

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { layoutTree, parentOf } from "../src/layout";
import { NODES } from "../src/upgrades";

const W = 1400;
const H = 1400;
const buf = Buffer.alloc(W * H * 3, 0x24);

const px = (x: number, y: number, r: number, g: number, b: number): void => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
};

function line(x1: number, y1: number, x2: number, y2: number, d: number, c: number[]): void {
  const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1)) * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t);
    for (let oy = -d; oy <= d; oy++) for (let ox = -d; ox <= d; ox++) px(x + ox, y + oy, c[0], c[1], c[2]);
  }
}

function box(cx: number, cy: number, h: number, c: number[]): void {
  for (let y = Math.round(cy - h); y <= cy + h; y++)
    for (let x = Math.round(cx - h); x <= cx + h; x++) px(x, y, c[0], c[1], c[2]);
}

const pos = layoutTree(NODES);
let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
for (const p of pos.values()) {
  x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
  y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
}
const pad = 60;
const s = Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0));
const sx = (x: number) => pad + (x - x0) * s;
const sy = (y: number) => pad + (y - y0) * s;

for (const n of NODES) {
  const p = parentOf(n);
  if (!p || !pos.has(p)) continue;
  const A = pos.get(p)!, B = pos.get(n.id)!;
  line(sx(A.x), sy(A.y), sx(B.x), sy(B.y), 1, [244, 241, 250]);
}
for (const n of NODES) {
  const p = pos.get(n.id);
  if (!p) continue;
  box(sx(p.x), sy(p.y), Math.max(2, (30 * (n.capstone ? 1.28 : 1)) * s), [46, 211, 174]);
}

/* ------------------------------------------------------------- PNG --- */
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}
const chunk = (typ: string, data: Buffer): Buffer => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(typ, "ascii"), data]);
  const crcT: number[] = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  let crc = 0xffffffff;
  for (const byte of body) crc = crcT[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const cb = Buffer.alloc(4); cb.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, cb]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
writeFileSync("tools/.out-tree.png", Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
]));
console.log("tools/.out-tree.png");
