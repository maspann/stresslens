/* ============================================================
   StresLens — Shared State (localStorage)
   ============================================================
   Stores input values across pages so navigating to /visualisasi
   or /rules still reflects the same scenario from the home page.
============================================================ */

(function (root) {
  'use strict';

  const KEY = 'streslens.inputs.v1';
  const DEFAULTS = {
    tugas: 3, deadline: 5, progress: 40,
    tidur: 6, lelah: 5,
    org: 2, jamnon: 10
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      const parsed = JSON.parse(raw);
      // Defensive: ensure all keys present and numeric
      const result = {};
      Object.keys(DEFAULTS).forEach(function (k) {
        const v = parsed[k];
        result[k] = (typeof v === 'number' && !isNaN(v)) ? v : DEFAULTS[k];
      });
      return result;
    } catch (e) {
      // localStorage may be disabled (e.g. file:// in some browsers)
      console.warn('State load failed, using defaults:', e);
      return Object.assign({}, DEFAULTS);
    }
  }

  function save(inputs) {
    try {
      localStorage.setItem(KEY, JSON.stringify(inputs));
    } catch (e) {
      console.warn('State save failed:', e);
    }
  }

  function reset() {
    save(Object.assign({}, DEFAULTS));
    return load();
  }

  function preset(name) {
    const presets = {
      default: { tugas: 3, deadline: 5, progress: 40, tidur: 6, lelah: 5, org: 2, jamnon: 10 },
      krisis:  { tugas: 10, deadline: 1, progress: 15, tidur: 4, lelah: 9, org: 4, jamnon: 25 },
      sehat:   { tugas: 1, deadline: 10, progress: 80, tidur: 7.5, lelah: 3, org: 1, jamnon: 5 },
      tidur_ekstrim: { tugas: 0, deadline: 14, progress: 100, tidur: 2, lelah: 1, org: 0, jamnon: 0 }
    };
    const p = presets[name] || presets.default;
    save(p);
    return Object.assign({}, p);
  }

  root.StresState = {
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    reset: reset,
    preset: preset
  };
})(window);
