// Mesin preset: mengubah piksel RGB (sRGB 8 bit) sesuai parameter di presets.ts.
// Murni hitungan, tanpa DOM, sehingga pratinjau dan hasil unduhan memakai jalur yang sama.
import { EXPOSURE_FACTOR, type Curve, type Preset } from "./presets";

const N = 1024; // resolusi tabel kurva
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Kurva titik (0-255) menjadi fungsi monoton lewat interpolasi kubik Fritsch-Carlson. */
function curveFn(points: Curve | undefined): (x: number) => number {
  if (!points || points.length < 2) return (x) => x;
  const xs = points.map((p) => p[0] / 255);
  const ys = points.map((p) => p[1] / 255);
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
    );
  };
}

const BAND_CENTERS = [0, 30, 60, 120, 180, 240, 270, 300];

/** Bobot tiap band HSL (merah ... magenta) untuk satu sudut hue: segitiga yang saling tumpang tindih. */
function bandWeights(deg: number): number[] {
  const w = new Array(8).fill(0);
  for (let i = 0; i < 8; i++) {
    const prev = BAND_CENTERS[(i + 7) % 8];
    const cur = BAND_CENTERS[i];
    const next = BAND_CENTERS[(i + 1) % 8];
    const wrap = (a: number, b: number) => ((b - a + 540) % 360) - 180; // selisih bertanda -180..180
    const dPrev = wrap(cur, deg);
    if (dPrev <= 0) {
      const span = Math.abs(wrap(cur, prev));
      w[i] = Math.max(0, 1 + dPrev / span);
    } else {
      const span = Math.abs(wrap(cur, next));
      w[i] = Math.max(0, 1 - dPrev / span);
    }
  }
  return w;
}

function hueToRgb(h: number): [number, number, number] {
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => 1 - Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [f(5), f(3), f(1)];
}

export type Plan = {
  preset: Preset;
  hasWb: boolean;
  gain: [number, number, number];
  knee: boolean;
  tone: Float32Array; // luma -> luma
  chan: [Float32Array, Float32Array, Float32Array]; // kurva master + RGB
  hasCalib: boolean;
  calib: number[]; // matriks 3x3 baris demi baris
  hasHsv: boolean;
  dh: Float32Array; // pergeseran hue (derajat) per derajat
  ds: Float32Array; // pengali saturasi
  dl: Float32Array; // pengali kecerahan (fraksi)
  glob: { sat: number; vib: number; dehazeSat: number };
  hasSplit: boolean;
  tintS: [number, number, number];
  tintH: [number, number, number];
  splitBalance: number;
  vignette: number;
  grain: number;
};

const SRGB2LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB2LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const LIN_RES = 2048; // entri per 1.0 cahaya linear, rentang 0..4
const LIN2SRGB_PLAIN = new Float32Array(LIN_RES * 4 + 1);
const LIN2SRGB_KNEE = new Float32Array(LIN_RES * 4 + 1);
const enc = (x: number) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
for (let i = 0; i < LIN2SRGB_PLAIN.length; i++) {
  const x = i / LIN_RES;
  LIN2SRGB_PLAIN[i] = enc(Math.min(1, x));
  const k0 = 0.75;
  const xk = x < k0 ? x : k0 + (1 - k0) * (1 - Math.exp(-(x - k0) / (1 - k0)));
  LIN2SRGB_KNEE[i] = enc(Math.min(1, xk));
}

export function buildPlan(p: Preset): Plan {
  const ev = (p.exposure ?? 0) * EXPOSURE_FACTOR;
  const mired = p.wbMired ?? 0;
  const tint = p.tint ?? 0;
  const eg = Math.pow(2, ev);
  const gain: [number, number, number] = [eg * (1 - 0.0025 * mired), eg * (1 - 0.0015 * tint), eg * (1 + 0.0025 * mired)];
  const hasWb = ev !== 0 || mired !== 0 || tint !== 0;
  const knee = gain[0] > 1 || gain[1] > 1 || gain[2] > 1;

  // Tone: highlights, shadows, whites, blacks, kontras, dehaze, parametric.
  const contrast = (p.contrast ?? 0) + 0.8 * (p.dehaze ?? 0);
  const hl = (p.highlights ?? 0) / 100;
  const sh = (p.shadows ?? 0) / 100;
  const wh = (p.whites ?? 0) / 100;
  const bl = (p.blacks ?? 0) / 100;
  const par = p.parametric;
  const sp = par ? par.splits.map((s) => s / 100) : [0.25, 0.5, 0.75];
  const centers = [sp[0] / 2, (sp[0] + sp[1]) / 2, (sp[1] + sp[2]) / 2, (sp[2] + 1) / 2];
  const parAmt = par ? par.amounts.map((a) => a / 100) : [0, 0, 0, 0];
  const parShift = (L: number) => {
    let v: number;
    if (L <= centers[0]) v = parAmt[0];
    else if (L >= centers[3]) v = parAmt[3];
    else {
      let i = 0;
      while (L > centers[i + 1]) i++;
      const t = (L - centers[i]) / (centers[i + 1] - centers[i]);
      v = parAmt[i] * (1 - t) + parAmt[i + 1] * t;
    }
    return v * 0.2;
  };
  const tone = new Float32Array(N);
  let top = 0;
  for (let i = 0; i < N; i++) {
    const L = i / (N - 1);
    let y = L;
    y += 0.25 * sh * (1 - smooth(0, 0.6, L)) * (1 - L * 0.3);
    y += 0.25 * hl * smooth(0.4, 1, L);
    y += 0.15 * wh * smooth(0.7, 1, L);
    y += 0.2 * bl * (1 - smooth(0, 0.3, L));
    y += 1.2 * (contrast / 100) * (L * L * (3 - 2 * L) - L);
    y += parShift(L);
    y = clamp01(y);
    top = Math.max(top, y); // jaga agar tidak membalik urutan terang-gelap
    tone[i] = top;
  }

  const master = curveFn(p.curve);
  const cr = curveFn(p.curveR);
  const cg = curveFn(p.curveG);
  const cb = curveFn(p.curveB);
  const chan: [Float32Array, Float32Array, Float32Array] = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) {
    const m = clamp01(master(i / (N - 1)));
    chan[0][i] = clamp01(cr(m));
    chan[1][i] = clamp01(cg(m));
    chan[2][i] = clamp01(cb(m));
  }

  // Kalibrasi: primer merah, hijau, biru digeser (kolom matriks).
  const c = p.calibration;
  const hasCalib = !!c && Object.values(c).some((v) => v);
  const prim = (hue: number, sat: number, up: [number, number, number], down: [number, number, number], base: number) => {
    const h = 0.25 * (hue / 100);
    const v = [0, 0, 0];
    v[base] = 1 - Math.abs(h);
    const toward = h >= 0 ? up : down;
    for (let k = 0; k < 3; k++) v[k] += Math.abs(h) * toward[k];
    const s = sat / 100;
    return v.map((x) => x + s * (x - 1 / 3));
  };
  const pr = prim(c?.redHue ?? 0, c?.redSat ?? 0, [0, 1, 0], [0, 0, 1], 0);
  const pg = prim(c?.greenHue ?? 0, c?.greenSat ?? 0, [0, 0, 1], [1, 0, 0], 1);
  const pb = prim(c?.blueHue ?? 0, c?.blueSat ?? 0, [1, 0, 0], [0, 1, 0], 2);
  const calib = [pr[0], pg[0], pb[0], pr[1], pg[1], pb[1], pr[2], pg[2], pb[2]];
  // Jumlah tiap baris dibuat 1 supaya abu-abu netral tetap netral.
  for (let row = 0; row < 3; row++) {
    const sum = calib[row * 3] + calib[row * 3 + 1] + calib[row * 3 + 2] || 1;
    for (let k = 0; k < 3; k++) calib[row * 3 + k] /= sum;
  }

  // HSL: tabel per derajat hue.
  const dh = new Float32Array(360);
  const ds = new Float32Array(360).fill(1);
  const dl = new Float32Array(360);
  const hsl = p.hsl;
  let anyHsl = false;
  if (hsl) {
    for (let deg = 0; deg < 360; deg++) {
      const w = bandWeights(deg);
      let h = 0;
      let s = 0;
      let l = 0;
      for (let b = 0; b < 8; b++) {
        h += w[b] * (hsl.hue?.[b] ?? 0);
        s += w[b] * (hsl.sat?.[b] ?? 0);
        l += w[b] * (hsl.lum?.[b] ?? 0);
      }
      dh[deg] = h * 0.3;
      ds[deg] = Math.max(0, 1 + s / 100);
      dl[deg] = l / 100;
      if (h || s || l) anyHsl = true;
    }
  }
  const glob = { sat: (p.saturation ?? 0) / 100, vib: (p.vibrance ?? 0) / 100, dehazeSat: 0.003 * (p.dehaze ?? 0) };
  const hasHsv = anyHsl || glob.sat !== 0 || glob.vib !== 0 || glob.dehazeSat !== 0;

  const sp2 = p.split;
  const hasSplit = !!sp2 && (sp2.shadowSat > 0 || sp2.highlightSat > 0);
  const tv = (hue: number, sat: number): [number, number, number] => {
    const [r, g, b] = hueToRgb(((hue % 360) + 360) % 360);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const k = (sat / 100) * 0.5;
    return [(r - l) * k, (g - l) * k, (b - l) * k];
  };

  return {
    preset: p,
    hasWb,
    gain,
    knee,
    tone,
    chan,
    hasCalib,
    calib,
    hasHsv,
    dh,
    ds,
    dl,
    glob,
    hasSplit,
    tintS: sp2 ? tv(sp2.shadowHue, sp2.shadowSat) : [0, 0, 0],
    tintH: sp2 ? tv(sp2.highlightHue, sp2.highlightSat) : [0, 0, 0],
    splitBalance: (sp2?.balance ?? 0) / 100,
    vignette: (p.vignette ?? 0) / 100,
    grain: (p.grain ?? 0) / 100,
  };
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/**
 * Menerapkan preset ke baris y0 sampai y1 (eksklusif) dari data RGBA. amount 0..1 mencampur dengan aslinya.
 * width dan height dibutuhkan untuk vignette dan grain.
 */
export function processRows(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  y0: number,
  y1: number,
  plan: Plan,
  amount: number,
): void {
  const { gain, knee, tone, chan, calib, glob } = plan;
  const lin2 = knee ? LIN2SRGB_KNEE : LIN2SRGB_PLAIN;
  const TM = N - 1;
  const cell = Math.max(1, Math.round(width / 2400));
  const hw = width / 2;
  const hh = height / 2;
  const vig = plan.vignette;
  const inner = 0.3 + 0.3 * 0.5;

  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const or = data[o], og = data[o + 1], ob = data[o + 2];
      let r = or / 255, g = og / 255, b = ob / 255;

      if (plan.hasCalib) {
        const nr = calib[0] * r + calib[1] * g + calib[2] * b;
        const ng = calib[3] * r + calib[4] * g + calib[5] * b;
        const nb = calib[6] * r + calib[7] * g + calib[8] * b;
        r = clamp01(nr); g = clamp01(ng); b = clamp01(nb);
      }

      if (plan.hasWb) {
        const ir = Math.round(r * 255), ig = Math.round(g * 255), ib = Math.round(b * 255);
        r = lin2[Math.min(LIN_RES * 4, Math.round(SRGB2LIN[ir] * gain[0] * LIN_RES))];
        g = lin2[Math.min(LIN_RES * 4, Math.round(SRGB2LIN[ig] * gain[1] * LIN_RES))];
        b = lin2[Math.min(LIN_RES * 4, Math.round(SRGB2LIN[ib] * gain[2] * LIN_RES))];
      }

      // Tone pada luma, ditambahkan merata ke tiap kanal agar warna tidak bergeser.
      const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const dL = tone[Math.round(clamp01(L) * TM)] - L;
      r = clamp01(r + dL); g = clamp01(g + dL); b = clamp01(b + dL);

      // Kurva master dan RGB.
      r = chan[0][Math.round(r * TM)];
      g = chan[1][Math.round(g * TM)];
      b = chan[2][Math.round(b * TM)];

      if (plan.hasHsv) {
        const mx = r > g ? (r > b ? r : b) : g > b ? g : b;
        const mn = r < g ? (r < b ? r : b) : g < b ? g : b;
        const d = mx - mn;
        if (d > 1e-5) {
          let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
          h *= 60;
          if (h < 0) h += 360;
          const deg = Math.min(359, Math.floor(h));
          let s = d / mx;
          let v = mx;
          h += plan.dh[deg];
          const skin = 1 - 0.5 * smooth(0, 1, 1 - Math.min(1, Math.abs(h - 30) / 30)); // vibrance lebih lembut di warna kulit
          s = s * plan.ds[deg] * (1 + glob.sat + glob.dehazeSat);
          s = s * (1 + glob.vib * (1 - s) * skin);
          v = v * (1 + plan.dl[deg] * 0.5 * Math.min(1, s * 1.5));
          s = clamp01(s);
          v = clamp01(v);
          // HSV ke RGB
          h = ((h % 360) + 360) % 360;
          const c6 = h / 60;
          const i6 = Math.floor(c6);
          const f = c6 - i6;
          const pp = v * (1 - s), qq = v * (1 - s * f), tt = v * (1 - s * (1 - f));
          switch (i6 % 6) {
            case 0: r = v; g = tt; b = pp; break;
            case 1: r = qq; g = v; b = pp; break;
            case 2: r = pp; g = v; b = tt; break;
            case 3: r = pp; g = qq; b = v; break;
            case 4: r = tt; g = pp; b = v; break;
            default: r = v; g = pp; b = qq;
          }
        }
      }

      if (plan.hasSplit) {
        const L2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const xx = clamp01(L2 + plan.splitBalance * 0.25);
        const wS = (1 - xx) * (1 - xx);
        const wH = xx * xx;
        r += plan.tintS[0] * wS + plan.tintH[0] * wH;
        g += plan.tintS[1] * wS + plan.tintH[1] * wH;
        b += plan.tintS[2] * wS + plan.tintH[2] * wH;
      }

      if (vig !== 0) {
        const nx = (x - hw) / hw, ny = (y - hh) / hh;
        const dd = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;
        const w = smooth(inner, 1, dd);
        if (vig < 0) {
          const m = 1 + vig * 0.8 * w;
          r *= m; g *= m; b *= m;
        } else {
          const t = vig * 0.8 * w;
          r += (1 - r) * t; g += (1 - g) * t; b += (1 - b) * t;
        }
      }

      if (plan.grain > 0) {
        const L3 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const n = (hash(Math.floor(x / cell), Math.floor(y / cell)) + hash(Math.floor(y / cell) + 7919, Math.floor(x / cell) + 104729)) / 2;
        const k = plan.grain * 0.18 * (0.3 + 0.7 * 4 * L3 * (1 - L3)) * n;
        r += k; g += k; b += k;
      }

      const R = clamp01(r) * 255, G = clamp01(g) * 255, B = clamp01(b) * 255;
      data[o] = or + (R - or) * amount;
      data[o + 1] = og + (G - og) * amount;
      data[o + 2] = ob + (B - ob) * amount;
    }
  }
}
