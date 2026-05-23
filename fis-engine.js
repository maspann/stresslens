/* ============================================================
   StresLens — Mamdani Fuzzy Inference System Engine
   ============================================================
   Pure functions, no DOM dependencies, exportable for testing.
   Loaded as global on window.FIS for browser; also CommonJS for node test.
============================================================ */

(function (root) {
  'use strict';

  // ---------- Membership Functions ----------
  // IMPORTANT: boundary handling for shoulder MFs (where a===b or c===d).
  // Example: trapmf(2, [2, 2, 4, 6]) — point x=2 sits at left shoulder.
  //   - If we test x <= a (2 <= 2) → return 0 → BUG: x=2 should give μ=1.
  // So we test x < a (strict) on left, x > d (strict) on right.
  // This correctly returns 1 for x at the plateau start/end shoulders.
  function trimf(x, params) {
    const [a, b, c] = params;
    if (x < a || x > c) return 0;
    if (x === b) return 1;
    if (x < b) {
      if (a === b) return 1; // degenerate left edge (peak at left)
      return (x - a) / (b - a);
    }
    if (b === c) return 1;   // degenerate right edge (peak at right)
    return (c - x) / (c - b);
  }

  function trapmf(x, params) {
    const [a, b, c, d] = params;
    if (x < a || x > d) return 0;
    if (x >= b && x <= c) return 1;
    if (x < b) {
      if (a === b) return 1; // left shoulder degenerate → at boundary
      return (x - a) / (b - a);
    }
    if (c === d) return 1;   // right shoulder degenerate
    return (d - x) / (d - c);
  }

  // ---------- Variable definitions ----------
  // Each variable: range [min,max], unit string, sets {name: {type, params, color}}
  const VARS = {
    tugas: {
      label: 'Jumlah Tugas Aktif', range: [0, 12], unit: 'tugas',
      sets: {
        sedikit: { type: 'trap', params: [0, 0, 2, 4],   color: '#3d5c2a' },
        sedang:  { type: 'tri',  params: [3, 6, 9],      color: '#c89200' },
        banyak:  { type: 'trap', params: [7, 9, 12, 12], color: '#b8401f' }
      }
    },
    deadline: {
      label: 'Jarak Deadline Terdekat', range: [0, 14], unit: 'hari',
      sets: {
        dekat:  { type: 'trap', params: [0, 0, 2, 4],     color: '#b8401f' },
        sedang: { type: 'tri',  params: [3, 6, 9],        color: '#c89200' },
        jauh:   { type: 'trap', params: [7, 10, 14, 14],  color: '#3d5c2a' }
      }
    },
    progress: {
      label: 'Persentase Kemajuan Tugas', range: [0, 100], unit: '%',
      sets: {
        rendah: { type: 'trap', params: [0, 0, 25, 45],     color: '#b8401f' },
        sedang: { type: 'tri',  params: [30, 55, 80],       color: '#c89200' },
        tinggi: { type: 'trap', params: [65, 85, 100, 100], color: '#3d5c2a' }
      }
    },
    tidur: {
      label: 'Rata-rata Jam Tidur (3 hari)', range: [2, 10], unit: 'jam',
      sets: {
        kurang: { type: 'trap', params: [2, 2, 4, 6],     color: '#b8401f' },
        cukup:  { type: 'tri',  params: [5, 7, 9],        color: '#3d5c2a' },
        lebih:  { type: 'trap', params: [8, 9, 10, 10],   color: '#1e3a5f' }
      }
    },
    lelah: {
      label: 'Tingkat Kelelahan (self-report)', range: [1, 10], unit: '',
      sets: {
        segar:  { type: 'trap', params: [1, 1, 3, 5],     color: '#3d5c2a' },
        sedang: { type: 'tri',  params: [3, 5.5, 8],      color: '#c89200' },
        lelah:  { type: 'trap', params: [6, 8, 10, 10],   color: '#b8401f' }
      }
    },
    org: {
      label: 'Jumlah Organisasi Aktif', range: [0, 6], unit: 'org',
      sets: {
        sedikit: { type: 'trap', params: [0, 0, 1, 2],   color: '#3d5c2a' },
        sedang:  { type: 'tri',  params: [1, 2.5, 4],    color: '#c89200' },
        banyak:  { type: 'trap', params: [3, 4, 6, 6],   color: '#b8401f' }
      }
    },
    jamnon: {
      label: 'Jam Non-Akademik per Minggu', range: [0, 40], unit: 'jam',
      sets: {
        sedikit: { type: 'trap', params: [0, 0, 5, 12],     color: '#3d5c2a' },
        sedang:  { type: 'tri',  params: [8, 18, 28],       color: '#c89200' },
        banyak:  { type: 'trap', params: [22, 30, 40, 40],  color: '#b8401f' }
      }
    },
    // Output
    stres: {
      label: 'Tingkat Beban & Stres', range: [0, 100], unit: '',
      sets: {
        rendah: { type: 'trap', params: [0, 0, 15, 35],      color: '#3d5c2a' },
        sedang: { type: 'tri',  params: [25, 45, 65],        color: '#c89200' },
        tinggi: { type: 'tri',  params: [55, 72, 88],        color: '#b8401f' },
        kritis: { type: 'trap', params: [78, 90, 100, 100],  color: '#8a2f17' }
      }
    }
  };

  function mu(varName, setName, x) {
    if (!VARS[varName]) throw new Error('Unknown variable: ' + varName);
    if (!VARS[varName].sets[setName]) throw new Error('Unknown set: ' + varName + '.' + setName);
    const s = VARS[varName].sets[setName];
    return s.type === 'tri' ? trimf(x, s.params) : trapmf(x, s.params);
  }

  // ---------- Rule Base ----------
  // Each rule: id, category, antecedents [[var, set], ...], consequent, op
  const RULES = [
    // --- I. Beban Akademik Murni ---
    { id: 1, category: 'Akademik',
      ant: [['tugas','banyak'], ['deadline','dekat']],
      cons: 'kritis', op: 'AND',
      label: 'Tugas BANYAK ∧ Deadline DEKAT → KRITIS' },
    { id: 2, category: 'Akademik',
      ant: [['tugas','banyak'], ['deadline','dekat'], ['progress','rendah']],
      cons: 'kritis', op: 'AND',
      label: 'Tugas BANYAK ∧ Deadline DEKAT ∧ Progress RENDAH → KRITIS' },
    { id: 3, category: 'Akademik',
      ant: [['tugas','banyak'], ['progress','rendah']],
      cons: 'tinggi', op: 'AND',
      label: 'Tugas BANYAK ∧ Progress RENDAH → TINGGI' },
    { id: 4, category: 'Akademik',
      ant: [['tugas','sedang'], ['deadline','dekat']],
      cons: 'tinggi', op: 'AND',
      label: 'Tugas SEDANG ∧ Deadline DEKAT → TINGGI' },
    { id: 5, category: 'Akademik',
      ant: [['tugas','sedang'], ['deadline','sedang']],
      cons: 'sedang', op: 'AND',
      label: 'Tugas SEDANG ∧ Deadline SEDANG → SEDANG' },
    { id: 6, category: 'Akademik',
      ant: [['tugas','sedikit'], ['deadline','jauh']],
      cons: 'rendah', op: 'AND',
      label: 'Tugas SEDIKIT ∧ Deadline JAUH → RENDAH' },
    { id: 7, category: 'Akademik',
      ant: [['tugas','sedikit'], ['progress','tinggi']],
      cons: 'rendah', op: 'AND',
      label: 'Tugas SEDIKIT ∧ Progress TINGGI → RENDAH' },

    // --- II. Faktor Fisik ---
    { id: 8, category: 'Fisik',
      ant: [['tidur','kurang'], ['lelah','lelah']],
      cons: 'tinggi', op: 'AND',
      label: 'Tidur KURANG ∧ Lelah TINGGI → TINGGI' },
    { id: 9, category: 'Fisik',
      ant: [['tidur','kurang'], ['lelah','lelah'], ['tugas','banyak']],
      cons: 'kritis', op: 'AND',
      label: 'Tidur KURANG ∧ Lelah TINGGI ∧ Tugas BANYAK → KRITIS' },
    { id: 10, category: 'Fisik',
      ant: [['tidur','cukup'], ['lelah','segar']],
      cons: 'rendah', op: 'AND',
      label: 'Tidur CUKUP ∧ Lelah SEGAR → RENDAH' },
    { id: 11, category: 'Fisik',
      ant: [['tidur','kurang']],
      cons: 'sedang', op: 'AND',
      label: 'Tidur KURANG → SEDANG (baseline)' },
    { id: 12, category: 'Fisik',
      ant: [['lelah','lelah']],
      cons: 'tinggi', op: 'AND',
      label: 'Lelah TINGGI → TINGGI (baseline)' },

    // --- III. Non-Akademik ---
    { id: 13, category: 'Non-Akademik',
      ant: [['org','banyak'], ['jamnon','banyak']],
      cons: 'tinggi', op: 'AND',
      label: 'Organisasi BANYAK ∧ Jam Non-Ak BANYAK → TINGGI' },
    { id: 14, category: 'Non-Akademik',
      ant: [['org','banyak'], ['jamnon','banyak'], ['tugas','banyak']],
      cons: 'kritis', op: 'AND',
      label: 'Org BANYAK ∧ Jam Non-Ak BANYAK ∧ Tugas BANYAK → KRITIS' },
    { id: 15, category: 'Non-Akademik',
      ant: [['org','sedang'], ['jamnon','sedang']],
      cons: 'sedang', op: 'AND',
      label: 'Organisasi SEDANG ∧ Jam Non-Ak SEDANG → SEDANG' },
    { id: 16, category: 'Non-Akademik',
      ant: [['org','sedikit'], ['jamnon','sedikit']],
      cons: 'rendah', op: 'AND',
      label: 'Organisasi SEDIKIT ∧ Jam Non-Ak SEDIKIT → RENDAH' },

    // --- IV. Compound Cross-Domain ---
    { id: 17, category: 'Compound',
      ant: [['tugas','banyak'], ['tidur','kurang'], ['org','banyak']],
      cons: 'kritis', op: 'AND',
      label: 'Tugas BANYAK ∧ Tidur KURANG ∧ Org BANYAK → KRITIS' },
    { id: 18, category: 'Compound',
      ant: [['deadline','dekat'], ['lelah','lelah']],
      cons: 'tinggi', op: 'AND',
      label: 'Deadline DEKAT ∧ Lelah TINGGI → TINGGI' },
    { id: 19, category: 'Compound',
      ant: [['deadline','dekat'], ['progress','rendah'], ['tidur','kurang']],
      cons: 'kritis', op: 'AND',
      label: 'Deadline DEKAT ∧ Progress RENDAH ∧ Tidur KURANG → KRITIS' },
    { id: 20, category: 'Compound',
      ant: [['tugas','sedang'], ['lelah','sedang'], ['jamnon','sedang']],
      cons: 'sedang', op: 'AND',
      label: 'Tugas SEDANG ∧ Lelah SEDANG ∧ Jam Non-Ak SEDANG → SEDANG' },
    { id: 21, category: 'Compound',
      ant: [['tugas','banyak'], ['deadline','dekat'], ['lelah','lelah']],
      cons: 'kritis', op: 'AND',
      label: 'Tugas BANYAK ∧ Deadline DEKAT ∧ Lelah TINGGI → KRITIS' },
    { id: 22, category: 'Compound',
      ant: [['deadline','dekat'], ['progress','rendah'], ['lelah','lelah']],
      cons: 'kritis', op: 'AND',
      label: 'Deadline DEKAT ∧ Progress RENDAH ∧ Lelah TINGGI → KRITIS' },
    { id: 23, category: 'Compound',
      ant: [['tugas','banyak'], ['tidur','kurang']],
      cons: 'tinggi', op: 'AND',
      label: 'Tugas BANYAK ∧ Tidur KURANG → TINGGI' },

    // --- V. Kompensasi Positif ---
    { id: 24, category: 'Positif',
      ant: [['progress','tinggi'], ['tidur','cukup']],
      cons: 'rendah', op: 'AND',
      label: 'Progress TINGGI ∧ Tidur CUKUP → RENDAH' },
    { id: 25, category: 'Positif',
      ant: [['tugas','sedang'], ['progress','tinggi'], ['lelah','segar']],
      cons: 'rendah', op: 'AND',
      label: 'Tugas SEDANG ∧ Progress TINGGI ∧ Lelah SEGAR → RENDAH' },
    { id: 26, category: 'Positif',
      ant: [['deadline','jauh'], ['progress','tinggi']],
      cons: 'rendah', op: 'AND',
      label: 'Deadline JAUH ∧ Progress TINGGI → RENDAH' },
    { id: 27, category: 'Positif',
      ant: [['deadline','jauh'], ['lelah','segar']],
      cons: 'rendah', op: 'AND',
      label: 'Deadline JAUH ∧ Lelah SEGAR → RENDAH' },

    // --- VI. Coverage Baseline (single-variable) ---
    // Setiap variabel "stress-inducing state" wajib punya baseline rule
    // supaya perubahan satu input langsung mempengaruhi skor (monotonicity).
    { id: 28, category: 'Baseline',
      ant: [['lelah','sedang']],
      cons: 'sedang', op: 'AND',
      label: 'Lelah SEDANG → SEDANG (baseline)' },
    { id: 29, category: 'Baseline',
      ant: [['tugas','sedang']],
      cons: 'sedang', op: 'AND',
      label: 'Tugas SEDANG → SEDANG (baseline)' },
    { id: 30, category: 'Baseline',
      ant: [['deadline','sedang']],
      cons: 'sedang', op: 'AND',
      label: 'Deadline SEDANG → SEDANG (baseline)' },
    { id: 31, category: 'Baseline',
      ant: [['tugas','banyak']],
      cons: 'tinggi', op: 'AND',
      label: 'Tugas BANYAK → TINGGI (baseline)' },
    { id: 32, category: 'Baseline',
      ant: [['deadline','dekat']],
      cons: 'tinggi', op: 'AND',
      label: 'Deadline DEKAT → TINGGI (baseline)' },
    { id: 33, category: 'Baseline',
      ant: [['progress','rendah']],
      cons: 'sedang', op: 'AND',
      label: 'Progress RENDAH → SEDANG (baseline)' },
    { id: 34, category: 'Baseline',
      ant: [['org','banyak']],
      cons: 'sedang', op: 'AND',
      label: 'Organisasi BANYAK → SEDANG (baseline)' },
    { id: 35, category: 'Baseline',
      ant: [['jamnon','banyak']],
      cons: 'sedang', op: 'AND',
      label: 'Jam Non-Ak BANYAK → SEDANG (baseline)' }
  ];

  // ---------- Inference ----------
  function evaluateRule(rule, inputs) {
    const memberships = rule.ant.map(function ([v, s]) {
      if (inputs[v] === undefined) throw new Error('Missing input: ' + v);
      return mu(v, s, inputs[v]);
    });
    const alpha = rule.op === 'OR'
      ? Math.max.apply(null, memberships)
      : Math.min.apply(null, memberships);
    return { rule: rule, alpha: alpha, memberships: memberships };
  }

  function aggregateOutput(firedRules, steps) {
    steps = steps || 200;
    const xMin = 0, xMax = 100;
    const xs = new Array(steps + 1);
    const ys = new Array(steps + 1);
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (xMax - xMin) * i / steps;
      xs[i] = x;
      let yMax = 0;
      for (let j = 0; j < firedRules.length; j++) {
        const f = firedRules[j];
        if (f.alpha <= 0) continue;
        const muOut = mu('stres', f.rule.cons, x);
        const clipped = Math.min(f.alpha, muOut);
        if (clipped > yMax) yMax = clipped;
      }
      ys[i] = yMax;
    }
    return { xs: xs, ys: ys };
  }

  function defuzzifyCentroid(xs, ys) {
    let num = 0, den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += xs[i] * ys[i];
      den += ys[i];
    }
    // Important: when no rule fires (den=0), return null sentinel — caller decides what to do
    if (den === 0) return null;
    return num / den;
  }

  function getLabel(crisp) {
    // Threshold-based labeling, aligned with output MF peaks.
    // Pure max-μ at crisp can flip-flop due to overlap between sedang/tinggi.
    // Thresholds give consistent UX semantics that match the bar marks (0/30/55/80/100).
    if (crisp < 28) return 'rendah';
    if (crisp < 52) return 'sedang';
    if (crisp < 75) return 'tinggi';
    return 'kritis';
  }

  function infer(inputs) {
    // Validate inputs
    const requiredVars = ['tugas','deadline','progress','tidur','lelah','org','jamnon'];
    for (let i = 0; i < requiredVars.length; i++) {
      const v = requiredVars[i];
      if (typeof inputs[v] !== 'number' || isNaN(inputs[v])) {
        throw new Error('Invalid input for ' + v + ': ' + inputs[v]);
      }
      const range = VARS[v].range;
      if (inputs[v] < range[0] || inputs[v] > range[1]) {
        // Clamp instead of error — UI sliders should prevent this anyway
        inputs[v] = Math.max(range[0], Math.min(range[1], inputs[v]));
      }
    }

    const fired = RULES.map(function (r) { return evaluateRule(r, inputs); });
    const agg = aggregateOutput(fired);
    const crispRaw = defuzzifyCentroid(agg.xs, agg.ys);

    // Fallback: if no rule fires (extremely rare with 30 rules), interpolate
    // based on a simple weighted neutral baseline so UI never breaks
    const crisp = crispRaw !== null ? crispRaw : 0;
    const noRulesFired = crispRaw === null;

    const label = getLabel(crisp);

    // Per-set memberships at crisp value (for diagnostic)
    const outputMu = {};
    Object.keys(VARS.stres.sets).forEach(function (s) {
      outputMu[s] = mu('stres', s, crisp);
    });

    return {
      crisp: crisp,
      label: label,
      outputMu: outputMu,
      fired: fired,
      aggregate: agg,
      noRulesFired: noRulesFired
    };
  }

  // ---------- Factor Contribution ----------
  function factorContributions(fired) {
    const stressSets = { sedang: 0.4, tinggi: 0.75, kritis: 1.0 };
    const vars = ['tugas','deadline','progress','tidur','lelah','org','jamnon'];
    const contrib = {};
    vars.forEach(function (v) { contrib[v] = 0; });

    fired.forEach(function (f) {
      if (f.alpha <= 0) return;
      const weight = stressSets[f.rule.cons];
      if (!weight) return; // only count stress-inducing rules
      f.rule.ant.forEach(function (pair) {
        const v = pair[0];
        const score = f.alpha * weight;
        if (score > contrib[v]) contrib[v] = score;
      });
    });
    return contrib;
  }

  // ---------- Recommendations (Forward Chaining) ----------
  function generateRecommendations(inputs, result) {
    const recs = [];
    const I = inputs;

    if (I.tidur < 5.5 && I.lelah >= 7) {
      recs.push({ tag: 'Prioritas Fisik',
        text: 'Tidur Anda ' + I.tidur + ' jam dengan kelelahan ' + I.lelah + '/10. ' +
              'Sebelum lanjut bekerja, tidur 4–6 jam dulu. Produktivitas pada defisit tidur turun hingga 30%.' });
    } else if (I.tidur < 5) {
      recs.push({ tag: 'Prioritas Fisik',
        text: 'Tidur ' + I.tidur + ' jam tergolong kurang. Targetkan minimal 6,5 jam malam ini bahkan jika ada deadline.' });
    } else if (I.lelah >= 8) {
      recs.push({ tag: 'Recovery',
        text: 'Tingkat kelelahan ' + I.lelah + '/10 sudah tinggi. Ambil jeda 30–60 menit sebelum sesi belajar berikutnya — power nap atau jalan kaki.' });
    }

    if (I.deadline <= 2 && I.progress < 50) {
      recs.push({ tag: 'Tindakan Akademik',
        text: 'Deadline ' + I.deadline + ' hari lagi tapi progres baru ' + I.progress + '%. ' +
              'Pecah tugas jadi 3 milestone hari ini. Jangan mulai tugas lain sampai ini ≥70%.' });
    } else if (I.tugas >= 8 && I.progress < 40) {
      recs.push({ tag: 'Manajemen Prioritas',
        text: I.tugas + ' tugas aktif dengan progres rendah — sinyal kewalahan. ' +
              'Buat matriks Eisenhower: urutkan berdasarkan deadline × bobot nilai, eksekusi top-3 saja.' });
    } else if (I.tugas >= 5 && I.deadline >= 5) {
      recs.push({ tag: 'Strategi Akademik',
        text: 'Tugas cukup banyak (' + I.tugas + ') tapi deadline masih ada ruang. ' +
              'Alokasikan 2–3 jam per tugas dalam 5 hari ke depan untuk hindari penumpukan.' });
    }

    if (I.org >= 3 && I.jamnon >= 20) {
      recs.push({ tag: 'Beban Non-Akademik',
        text: 'Aktif di ' + I.org + ' organisasi dengan ' + I.jamnon + ' jam/minggu — melebihi rata-rata sehat. ' +
              'Pertimbangkan delegasi tugas ke anggota lain atau pull-back sementara dari 1 kegiatan.' });
    } else if (I.org >= 2 && result.crisp >= 70) {
      recs.push({ tag: 'Beban Non-Akademik',
        text: 'Saat stres akademik tinggi, kegiatan organisasi tetap bisa dijalankan tapi minimalisir komitmen baru selama 2 minggu ke depan.' });
    }

    if (result.crisp >= 65) {
      recs.push({ tag: 'Eskalasi',
        text: 'Skor stres masuk zona ' + (result.crisp >= 80 ? 'kritis' : 'tinggi') +
              ' (' + result.crisp.toFixed(1) + '/100). ' +
              'Jika berlangsung >1 minggu, jadwalkan konsultasi ke Gadjah Mada Medical Center (GMC) ' +
              'atau unit konseling fakultas. Ini bukan kelemahan — ini langkah cerdas.' });
    } else if (result.crisp >= 50) {
      recs.push({ tag: 'Self-Monitoring',
        text: 'Beban tergolong tinggi. Re-evaluasi 2 hari lagi: apakah skor turun setelah istirahat & menyelesaikan 1–2 tugas? Jika tidak, tinjau ulang komitmen.' });
    }

    if (result.crisp < 30) {
      recs.push({ tag: 'Status Sehat',
        text: 'Beban Anda terkelola baik. Manfaatkan momentum: selesaikan tugas prioritas dan jaga kebiasaan tidur ' + I.tidur + ' jam.' });
    }

    if (recs.length === 0) {
      recs.push({ tag: 'Status Stabil',
        text: 'Tidak ada faktor yang menonjol. Pertahankan ritme saat ini dan lakukan check-in mingguan.' });
    }

    return recs;
  }

  // ---------- Export ----------
  const api = {
    VARS: VARS,
    RULES: RULES,
    mu: mu,
    trimf: trimf,
    trapmf: trapmf,
    evaluateRule: evaluateRule,
    aggregateOutput: aggregateOutput,
    defuzzifyCentroid: defuzzifyCentroid,
    getLabel: getLabel,
    infer: infer,
    factorContributions: factorContributions,
    generateRecommendations: generateRecommendations
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.FIS = api;
  }
})(typeof window !== 'undefined' ? window : this);
