// Preset cepat untuk foto JPG, diturunkan dari preset Lightroom milik fotografer (file .xmp).
// Angka di bawah disalin dari file aslinya. Mesin penerapannya ada di preset-engine.ts.
// Tidak diterapkan: Texture, Clarity, Sharpness, noise reduction, lens profile, masking (mis. kulit
// pada Film Look), Point Color, dan profil kamera "Adobe Color/Standard".

export type Curve = [number, number][];

export type Preset = {
  id: string;
  name: string;
  /** Kesan singkat yang tampil di tombol. */
  feel: string;
  /** Selisih Temperature terhadap AsShot (mired, + = lebih biru) dan Tint (+ = magenta). */
  wbMired?: number;
  tint?: number;
  /** Exposure EV. Diperkecil oleh EXPOSURE_FACTOR karena dibuat untuk foto tertentu. */
  exposure?: number;
  contrast?: number;
  highlights?: number;
  shadows?: number;
  whites?: number;
  blacks?: number;
  dehaze?: number;
  vibrance?: number;
  saturation?: number;
  /** Parametric curve: [shadows, darks, lights, highlights] dan titik pisah [s1, s2, s3] (0-100). */
  parametric?: { amounts: [number, number, number, number]; splits: [number, number, number] };
  curve?: Curve;
  curveR?: Curve;
  curveG?: Curve;
  curveB?: Curve;
  /** Urutan band: merah, oranye, kuning, hijau, aqua, biru, ungu, magenta. */
  hsl?: { hue?: number[]; sat?: number[]; lum?: number[] };
  split?: { shadowHue: number; shadowSat: number; highlightHue: number; highlightSat: number; balance?: number };
  calibration?: { redHue?: number; redSat?: number; greenHue?: number; greenSat?: number; blueHue?: number; blueSat?: number };
  grain?: number;
  vignette?: number;
};

/** Exposure dari preset dipakai separuh: nilai aslinya disetel untuk satu foto, bukan semua foto. */
export const EXPOSURE_FACTOR = 0.5;

export const PRESETS: Preset[] = [
  {
    id: "vintage-vibe",
    name: "Vintage Vibe",
    feel: "Lembut, sedikit pudar",
    highlights: -64, shadows: 41, whites: 18, blacks: -16,
    vibrance: 18, saturation: 4,
    curve: [[0, 0], [47, 36], [128, 124], [187, 198], [255, 255]],
  },
  {
    id: "all-of-everything",
    name: "All of Everything",
    feel: "Cerah, hijau redup",
    exposure: 0.79, contrast: 12, highlights: -77, shadows: -2, whites: -16, blacks: -56, dehaze: 12,
    hsl: {
      hue: [0, 5, -23, 53, 0, 0, 0, 0],
      sat: [10, -7, -22, -77, 0, 0, 0, 0],
      lum: [7, 2, 2, 12, 0, 0, 0, 0],
    },
    split: { shadowHue: 79, shadowSat: 13, highlightHue: 242, highlightSat: 12 },
    vignette: -11,
  },
  {
    id: "lake",
    name: "Lake",
    feel: "Matte, sejuk",
    highlights: -22, shadows: 22, whites: -22, blacks: 20,
    parametric: { amounts: [-15, 6, 0, -10], splits: [19, 50, 75] },
    curve: [[0, 52], [47, 67], [98, 98], [174, 172], [255, 255]],
    curveR: [[0, 0], [48, 22], [117, 123], [178, 199], [255, 255]],
    curveG: [[0, 0], [50, 23], [118, 122], [176, 198], [255, 255]],
    curveB: [[0, 0], [47, 17], [82, 62], [117, 123], [178, 198], [255, 255]],
    hsl: {
      hue: [10, 10, 10, 12, 6, -4, 8, 22],
      sat: [-18, -4, -4, -24, -12, -10, 0, -18],
      lum: [-18, 0, 0, 0, 0, -12, 0, 0],
    },
    calibration: { redHue: 28, redSat: -12, greenHue: 52, greenSat: -12, blueHue: -14, blueSat: -15 },
    grain: 18,
  },
  {
    id: "film-look",
    name: "Film Look",
    feel: "Film, kulit hangat",
    // Temperature 4700 K vs as-shot 5150 K, Tint +11 vs +36.
    wbMired: 1e6 / 4700 - 1e6 / 5150, tint: 11 - 36,
    exposure: 0.53, contrast: 28, highlights: -26, shadows: 35, whites: 14, blacks: -19,
    parametric: { amounts: [-15, 6, 0, -10], splits: [19, 50, 75] },
    curve: [[0, 28], [53, 54], [90, 86], [255, 255]],
    hsl: {
      hue: [0, 4, 0, -42, 0, 0, 0, 0],
      sat: [42, -11, 0, 0, 0, 0, 0, 0],
      lum: [7, 51, 0, 12, 0, 0, 0, 0],
    },
    split: { shadowHue: 203, shadowSat: 8, highlightHue: 242, highlightSat: 6 },
    calibration: { redSat: -37 },
    grain: 26,
    vignette: -5,
  },
  {
    id: "spooky-area",
    name: "Spooky Area",
    feel: "Muted, gelap",
    contrast: -49, highlights: -41, shadows: -26, whites: -18, blacks: 85, dehaze: 14,
    vibrance: 31, saturation: 5,
    curve: [[0, 16], [37, 28], [91, 87], [146, 156], [233, 239], [255, 236]],
    curveR: [[0, 0], [32, 9], [73, 50], [111, 115], [142, 158], [170, 188], [210, 222], [255, 248]],
    curveG: [[0, 0], [32, 10], [73, 50], [111, 115], [142, 158], [170, 188], [211, 222], [255, 249]],
    curveB: [[0, 0], [32, 9], [73, 50], [111, 116], [142, 158], [170, 188], [210, 223], [255, 249]],
    hsl: {
      hue: [8, -4, -25, -16, 16, 17, 47, 49],
      sat: [-60, -60, -77, -87, -86, -87, -91, -93],
      lum: [-23, -23, -9, -41, -6, -13, 0, 0],
    },
    split: { shadowHue: 35, shadowSat: 7, highlightHue: 31, highlightSat: 8 },
  },
  {
    id: "painting-of-altalune",
    name: "Painting of Altalune",
    feel: "Hangat, seperti lukisan",
    // Temperature 4544 K vs as-shot 4750 K, Tint +9 vs +15.
    wbMired: 1e6 / 4544 - 1e6 / 4750, tint: 9 - 15,
    exposure: 0.5, contrast: 12, highlights: -77, shadows: 42, whites: -16, blacks: -40, dehaze: 12,
    parametric: { amounts: [36, 0, 0, 0], splits: [25, 50, 75] },
    hsl: {
      hue: [0, 5, -23, 53, 0, 0, 0, 0],
      sat: [-5, -18, -22, -77, 0, 0, 0, 8],
      lum: [37, 66, 2, 12, 0, 0, 0, 39],
    },
    split: { shadowHue: 79, shadowSat: 13, highlightHue: 242, highlightSat: 12 },
    vignette: 18,
  },
];
