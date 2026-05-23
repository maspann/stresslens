/* ============================================================
   StresLens — Shared UI Utilities
   ============================================================ */

(function (root) {
  'use strict';

  // ---------- Slider Bindings ----------
  const INPUT_META = {
    tugas:    { id: 'i-tugas',    valId: 'v-tugas',    fmt: function (v) { return v + ' tugas'; }, parse: 'int' },
    deadline: { id: 'i-deadline', valId: 'v-deadline', fmt: function (v) { return v + ' hari'; },  parse: 'int' },
    progress: { id: 'i-progress', valId: 'v-progress', fmt: function (v) { return v + '%'; },      parse: 'int' },
    tidur:    { id: 'i-tidur',    valId: 'v-tidur',    fmt: function (v) { return v + ' jam'; },   parse: 'float' },
    lelah:    { id: 'i-lelah',    valId: 'v-lelah',    fmt: function (v) { return v + ' / 10'; },  parse: 'int' },
    org:      { id: 'i-org',      valId: 'v-org',      fmt: function (v) { return v + ' organisasi'; }, parse: 'int' },
    jamnon:   { id: 'i-jamnon',   valId: 'v-jamnon',   fmt: function (v) { return v + ' jam'; },   parse: 'int' }
  };

  function getInputsFromDOM() {
    const out = {};
    Object.keys(INPUT_META).forEach(function (k) {
      const el = document.getElementById(INPUT_META[k].id);
      if (el) out[k] = parseFloat(el.value);
    });
    return out;
  }

  function setInputsToDOM(inputs) {
    Object.keys(INPUT_META).forEach(function (k) {
      const el = document.getElementById(INPUT_META[k].id);
      if (el && inputs[k] !== undefined) {
        el.value = inputs[k];
        updateSliderFill(el);
        const valEl = document.getElementById(INPUT_META[k].valId);
        if (valEl) valEl.textContent = INPUT_META[k].fmt(inputs[k]);
      }
    });
  }

  function updateSliderFill(el) {
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    const pct = ((parseFloat(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--fill', pct + '%');
  }

  function refreshAllSliderFills() {
    Object.keys(INPUT_META).forEach(function (k) {
      const el = document.getElementById(INPUT_META[k].id);
      if (el) updateSliderFill(el);
    });
  }

  // ---------- MF Plot Drawing ----------
  function drawMFPlot(svgId, varName, inputValue, options) {
    options = options || {};
    const svg = document.getElementById(svgId);
    if (!svg) return;

    // Responsive viewBox — keep dimensions fixed, container scales
    const W = 500, H = 220;
    const padL = 38, padR = 12, padT = 18, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const v = window.FIS.VARS[varName];
    if (!v) {
      svg.innerHTML = '<text x="' + (W/2) + '" y="' + (H/2) + '" text-anchor="middle" fill="#8a2f17">Variable not found: ' + varName + '</text>';
      return;
    }

    const xMin = v.range[0], xMax = v.range[1];

    let svgContent = '';

    // Grid lines (4 horizontal)
    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH * i / 4;
      svgContent += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W-padR) + '" y2="' + y + '" stroke="rgba(26,22,18,0.06)" stroke-width="1"/>';
    }

    // X-axis labels
    for (let i = 0; i <= 4; i++) {
      const x = padL + plotW * i / 4;
      const xv = xMin + (xMax - xMin) * i / 4;
      const label = Number.isInteger(xv) ? xv : xv.toFixed(1);
      svgContent += '<text x="' + x + '" y="' + (H-padB+16) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#8a8074">' + label + (v.unit ? ' ' + v.unit : '') + '</text>';
    }

    // Y-axis labels
    svgContent += '<text x="' + (padL-8) + '" y="' + (padT+5) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#8a8074">μ=1</text>';
    svgContent += '<text x="' + (padL-8) + '" y="' + (padT+plotH+3) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#8a8074">0</text>';

    // Axes
    svgContent += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT+plotH) + '" stroke="#1a1612" stroke-width="1"/>';
    svgContent += '<line x1="' + padL + '" y1="' + (padT+plotH) + '" x2="' + (W-padR) + '" y2="' + (padT+plotH) + '" stroke="#1a1612" stroke-width="1"/>';

    // Draw each fuzzy set curve
    const setEntries = Object.entries(v.sets);
    const samples = 120;

    setEntries.forEach(function (entry, idx) {
      const sname = entry[0];
      const sdef = entry[1];
      let pts = '';
      for (let i = 0; i <= samples; i++) {
        const x = xMin + (xMax - xMin) * i / samples;
        const y = window.FIS.mu(varName, sname, x);
        const px = padL + plotW * i / samples;
        const py = padT + plotH - y * plotH;
        pts += px + ',' + py + ' ';
      }
      svgContent += '<polyline points="' + pts + '" fill="none" stroke="' + sdef.color + '" stroke-width="2" stroke-linejoin="round"/>';
      // Set label
      const labelX = padL + plotW * (0.13 + idx * 0.30);
      svgContent += '<text x="' + labelX + '" y="' + (padT-4) + '" font-family="JetBrains Mono, monospace" font-size="10" fill="' + sdef.color + '" font-weight="500">' + sname + '</text>';
    });

    // Current input vertical line + crossing points
    if (inputValue !== null && inputValue !== undefined) {
      const px = padL + plotW * (inputValue - xMin) / (xMax - xMin);
      svgContent += '<line x1="' + px + '" y1="' + padT + '" x2="' + px + '" y2="' + (padT+plotH) + '" stroke="#1a1612" stroke-width="1.5" stroke-dasharray="3,3"/>';

      setEntries.forEach(function (entry) {
        const sname = entry[0];
        const y = window.FIS.mu(varName, sname, inputValue);
        if (y > 0.001) {
          const py = padT + plotH - y * plotH;
          svgContent += '<circle cx="' + px + '" cy="' + py + '" r="3.5" fill="' + entry[1].color + '" stroke="#f4efe6" stroke-width="1.5"/>';
        }
      });
      const labelStr = Number.isInteger(inputValue) ? inputValue : inputValue.toFixed(1);
      svgContent += '<text x="' + (px+5) + '" y="' + (padT+plotH+25) + '" font-family="JetBrains Mono, monospace" font-size="10" fill="#1a1612" font-weight="600">x = ' + labelStr + '</text>';
    }

    svg.innerHTML = svgContent;
  }

  function drawOutputAggregate(svgId, result) {
    const svg = document.getElementById(svgId);
    if (!svg) return;

    const W = 500, H = 220;
    const padL = 38, padR = 12, padT = 18, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const v = window.FIS.VARS.stres;
    const xMin = 0, xMax = 100;

    let svgContent = '';

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = padT + plotH * i / 4;
      svgContent += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W-padR) + '" y2="' + y + '" stroke="rgba(26,22,18,0.06)" stroke-width="1"/>';
    }
    // X-axis labels
    for (let i = 0; i <= 4; i++) {
      const x = padL + plotW * i / 4;
      const xv = xMin + (xMax - xMin) * i / 4;
      svgContent += '<text x="' + x + '" y="' + (H-padB+16) + '" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#8a8074">' + xv + '</text>';
    }
    svgContent += '<text x="' + (padL-8) + '" y="' + (padT+5) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#8a8074">μ=1</text>';
    svgContent += '<text x="' + (padL-8) + '" y="' + (padT+plotH+3) + '" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#8a8074">0</text>';

    // Axes
    svgContent += '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT+plotH) + '" stroke="#1a1612" stroke-width="1"/>';
    svgContent += '<line x1="' + padL + '" y1="' + (padT+plotH) + '" x2="' + (W-padR) + '" y2="' + (padT+plotH) + '" stroke="#1a1612" stroke-width="1"/>';

    // Output set curves (thin background)
    const setEntries = Object.entries(v.sets);
    const samples = 120;
    setEntries.forEach(function (entry, idx) {
      const sname = entry[0], sdef = entry[1];
      let pts = '';
      for (let i = 0; i <= samples; i++) {
        const x = xMin + (xMax - xMin) * i / samples;
        const y = window.FIS.mu('stres', sname, x);
        const px = padL + plotW * i / samples;
        const py = padT + plotH - y * plotH;
        pts += px + ',' + py + ' ';
      }
      svgContent += '<polyline points="' + pts + '" fill="none" stroke="' + sdef.color + '" stroke-width="1" stroke-dasharray="2,3" opacity="0.55"/>';
      const labelX = padL + plotW * (0.10 + idx * 0.23);
      svgContent += '<text x="' + labelX + '" y="' + (padT-4) + '" font-family="JetBrains Mono, monospace" font-size="9.5" fill="' + sdef.color + '" font-weight="500">' + sname + '</text>';
    });

    // Aggregated output (filled)
    if (result && result.aggregate) {
      const xs = result.aggregate.xs, ys = result.aggregate.ys;
      let pts = '';
      pts += padL + ',' + (padT+plotH) + ' ';
      for (let i = 0; i < xs.length; i++) {
        const px = padL + plotW * (xs[i] - xMin) / (xMax - xMin);
        const py = padT + plotH - ys[i] * plotH;
        pts += px + ',' + py + ' ';
      }
      pts += (padL+plotW) + ',' + (padT+plotH) + ' ';
      svgContent += '<polygon points="' + pts + '" fill="#b8401f" fill-opacity="0.20" stroke="#b8401f" stroke-width="2"/>';

      // Centroid line + marker
      if (result.crisp !== null && result.crisp !== undefined && !result.noRulesFired) {
        const cx = padL + plotW * (result.crisp - xMin) / (xMax - xMin);
        svgContent += '<line x1="' + cx + '" y1="' + padT + '" x2="' + cx + '" y2="' + (padT+plotH) + '" stroke="#1a1612" stroke-width="1.5" stroke-dasharray="3,3"/>';
        svgContent += '<circle cx="' + cx + '" cy="' + (padT+plotH-2) + '" r="5" fill="#1a1612"/>';
        svgContent += '<text x="' + (cx+7) + '" y="' + (padT+plotH+25) + '" font-family="JetBrains Mono, monospace" font-size="10" fill="#1a1612" font-weight="600">centroid = ' + result.crisp.toFixed(1) + '</text>';
      }
    }

    svg.innerHTML = svgContent;
  }

  // ---------- Render Verdict ----------
  function renderVerdict(result, elIds) {
    elIds = elIds || {
      verdict: 'verdict', level: 'v-leveltext', score: 'v-scorenum', barFill: 'v-barfill'
    };
    const labelMap = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', kritis: 'Kritis' };
    const verdEl = document.getElementById(elIds.verdict);
    if (verdEl) verdEl.setAttribute('data-level', result.label);

    const levelEl = document.getElementById(elIds.level);
    if (levelEl) levelEl.textContent = labelMap[result.label];

    const scoreEl = document.getElementById(elIds.score);
    if (scoreEl) scoreEl.textContent = result.crisp.toFixed(1);

    const barEl = document.getElementById(elIds.barFill);
    if (barEl) barEl.style.width = result.crisp + '%';
  }

  // ---------- Render Factor Contributions ----------
  function renderFactors(containerId, contrib) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const labels = {
      tugas: 'Tugas aktif',
      deadline: 'Kedekatan deadline',
      progress: 'Kekurangan progres',
      tidur: 'Defisit tidur',
      lelah: 'Kelelahan fisik',
      org: 'Beban organisasi',
      jamnon: 'Jam non-akademik'
    };
    const sorted = Object.entries(contrib).sort(function (a, b) { return b[1] - a[1]; }).filter(function (e) { return e[1] > 0.05; });
    if (sorted.length === 0) {
      el.innerHTML = '<div style="font-size:12.5px; color:var(--ink-mute); font-style:italic; padding:8px 0;">Tidak ada faktor yang memberi kontribusi signifikan terhadap stres. Kondisi terkelola.</div>';
      return;
    }
    const maxVal = sorted[0][1];
    el.innerHTML = sorted.slice(0, 5).map(function (e, i) {
      const v = e[0], c = e[1];
      const pct = Math.round((c / Math.max(maxVal, 0.01)) * 100);
      const dominant = i === 0 ? ' dominant' : '';
      return '<div class="factor-bar' + dominant + '">' +
        '<div class="factor-row"><span class="label">' + labels[v] + '</span><span class="val">α = ' + c.toFixed(2) + '</span></div>' +
        '<div class="factor-track"><div class="fill" style="width:' + pct + '%"></div></div>' +
        '</div>';
    }).join('');
  }

  // ---------- Render Recommendations ----------
  function renderRecommendations(containerId, recs) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = recs.map(function (r) {
      return '<div class="rec-item"><span class="tag">' + r.tag + '</span>' + r.text + '</div>';
    }).join('');
  }

  // ---------- Render Input Summary (for non-home pages) ----------
  function renderInputSummary(containerId, inputs, result) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const fmt = function (label, val, unit) {
      return '<span class="item">' + label + ': <strong>' + val + (unit ? ' ' + unit : '') + '</strong></span>';
    };
    const labelMap = { rendah: 'RENDAH', sedang: 'SEDANG', tinggi: 'TINGGI', kritis: 'KRITIS' };
    el.innerHTML =
      '<span class="label-title">Input saat ini:</span>' +
      fmt('Tugas', inputs.tugas, 'aktif') +
      fmt('Deadline', inputs.deadline, 'hari') +
      fmt('Progress', inputs.progress, '%') +
      fmt('Tidur', inputs.tidur, 'jam') +
      fmt('Lelah', inputs.lelah, '/10') +
      fmt('Org', inputs.org) +
      fmt('Non-Ak', inputs.jamnon, 'jam') +
      '<span class="verdict-mini" data-level="' + result.label + '">' + labelMap[result.label] + ' · ' + result.crisp.toFixed(1) + '</span>';
  }

  // ---------- Nav highlighting ----------
  function highlightNav(currentPath) {
    const links = document.querySelectorAll('.nav-bar a');
    links.forEach(function (a) {
      if (a.getAttribute('href') === currentPath) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  // ---------- Export ----------
  root.StresUI = {
    INPUT_META: INPUT_META,
    getInputsFromDOM: getInputsFromDOM,
    setInputsToDOM: setInputsToDOM,
    updateSliderFill: updateSliderFill,
    refreshAllSliderFills: refreshAllSliderFills,
    drawMFPlot: drawMFPlot,
    drawOutputAggregate: drawOutputAggregate,
    renderVerdict: renderVerdict,
    renderFactors: renderFactors,
    renderRecommendations: renderRecommendations,
    renderInputSummary: renderInputSummary,
    highlightNav: highlightNav
  };
})(window);
