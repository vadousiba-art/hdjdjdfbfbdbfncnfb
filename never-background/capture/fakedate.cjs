// Shifts the clock by FAKE_DATE_SHIFT_MS so the local demo server renders the
// app outside any seasonal window (YORU's Halloween logo is date-based, see
// src/lib/season.ts). Loaded with NODE_OPTIONS=--require. Capture-only.
const shift = Number(process.env.FAKE_DATE_SHIFT_MS || 0);
if (shift) {
  const Real = Date;
  class Shifted extends Real {
    constructor(...a) {
      if (a.length === 0) super(Real.now() + shift);
      else super(...a);
    }
    static now() {
      return Real.now() + shift;
    }
  }
  // Copy the statics explicitly: some runtimes copy own properties only.
  for (const k of ["parse", "UTC"]) Object.defineProperty(Shifted, k, { value: Real[k], writable: true, configurable: true });
  globalThis.Date = Shifted;
}
