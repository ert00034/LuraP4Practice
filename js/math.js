import * as THREE from "https://unpkg.com/three@0.165.0/build/three.module.js";
import { state } from './state.js';
import { scale } from './config.js';

export function w2v(p, y = 0) { return new THREE.Vector3(p.x * scale, y, p.y * scale); }
export function polar(a, r) { return { x: Math.cos(a) * r, y: Math.sin(a) * r }; }
export function add2(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub2(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
export function mul2(a, n) { return { x: a.x * n, y: a.y * n }; }
export function len2(a) { return Math.hypot(a.x, a.y); }
export function norm2(a) { const l = len2(a) || 1; return { x: a.x / l, y: a.y / l }; }
export function angleOf(p) { return Math.atan2(p.y, p.x); }
export function normalizeAngle(a) { while (a <= -Math.PI) a += Math.PI * 2; while (a > Math.PI) a -= Math.PI * 2; return a; }
export function angularDelta(f, t) { return normalizeAngle(t - f); }
export function rotate2(v, a) { const c = Math.cos(a), s = Math.sin(a); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function lerp(a, b, p) { return a + (b - a) * p; }
export function smooth(p) { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); }
export function rand() { state.seed = (state.seed * 1664525 + 1013904223) >>> 0; return state.seed / 4294967296; }
export function makeRing(radius, color, opacity, tube = 0.04) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius * scale, tube, 12, 96),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity }));
  m.rotation.x = Math.PI / 2; return m;
}
export function makeCyl(color, emissive = 0, rT = 0.19, rB = 0.19, h = 0.68) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 8),
    new THREE.MeshStandardMaterial({ color, emissive, roughness: .6, metalness: .1 }));
}
export function orientCylBetween(m, s3, e3) {
  const dir = e3.clone().sub(s3), len = dir.length();
  if (len < .001) { m.visible = false; return; }
  m.scale.y = len; m.position.copy(s3.clone().add(e3).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); m.visible = true;
}
