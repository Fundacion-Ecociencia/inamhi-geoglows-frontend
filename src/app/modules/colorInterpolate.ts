// color-interp.ts
export type RGBA = { r: number; g: number; b: number; a: number };

/** Utilidades de color e interpolación lineal entre stops. */
export class ColorInterp {
  static clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
  }

  static hexToRgba(hex: string): RGBA {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const int = parseInt(h, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
      a: 1,
    };
  }

  static rgbStrToRgba(s: string): RGBA {
    const m = s
      .replace(/\s+/g, '')
      .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([.\d]+))?\)$/i);
    if (!m) return { r: 255, g: 255, b: 255, a: 1 };
    const [, r, g, b, a] = m;
    return { r: +r, g: +g, b: +b, a: a === undefined ? 1 : +a };
  }

  static parseColor(c: string): RGBA {
    if (!c) return { r: 255, g: 255, b: 255, a: 1 };
    const s = c.trim().toLowerCase();
    if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (s.startsWith('#')) return this.hexToRgba(s);
    if (s.startsWith('rgb')) return this.rgbStrToRgba(s);
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  static rgbaToCss(c: RGBA): string {
    const r = Math.round(c.r);
    const g = Math.round(c.g);
    const b = Math.round(c.b);
    return `rgba(${r},${g},${b},${c.a})`;
  }

  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  static lerpRgba(c0: RGBA, c1: RGBA, t: number): RGBA {
    const tt = this.clamp01(t);
    return {
      r: this.lerp(c0.r, c1.r, tt),
      g: this.lerp(c0.g, c1.g, tt),
      b: this.lerp(c0.b, c1.b, tt),
      a: this.lerp(c0.a, c1.a, tt),
    };
  }

  /** Interpola entre stops [valor, color] (lineal en el dominio). */
  static interpolateStops(
    val: number,
    stops: Array<[number, string]>
  ): RGBA {
    if (!stops.length) return { r: 255, g: 255, b: 255, a: 1 };
    const arr = [...stops].sort((a, b) => a[0] - b[0]);
    if (val <= arr[0][0]) return this.parseColor(arr[0][1]);

    for (let i = 0; i < arr.length - 1; i++) {
      const [v0, c0] = arr[i];
      const [v1, c1] = arr[i + 1];
      if (val <= v1) {
        const t = v1 === v0 ? 0 : (val - v0) / (v1 - v0);
        return this.lerpRgba(this.parseColor(c0), this.parseColor(c1), t);
      }
    }
    return this.parseColor(arr[arr.length - 1][1]);
  }
}
