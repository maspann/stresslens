/* ============================================================
   StresLens — Shared Layout (Masthead, Nav, Footer)
   ============================================================ */

(function (root) {
  'use strict';

  const NAV_LINKS = [
    { href: 'index.html', label: 'Diagnostik' },
    { href: 'pages/visualisasi.html', label: 'Visualisasi' },
    { href: 'pages/rules.html', label: 'Basis Aturan' },
    { href: 'pages/trace.html', label: 'Rule Trace' },
    { href: 'pages/tentang.html', label: 'Tentang' }
  ];

  // Compute relative path adjustments based on current page depth
  function relativizePath(href, currentPagePath) {
    // currentPagePath is path from root (e.g. 'index.html' or 'pages/rules.html')
    const currentDepth = currentPagePath.split('/').length - 1;
    if (currentDepth === 0) return href; // Already at root
    // At depth 1 (pages/*), root files need ../
    if (href.indexOf('pages/') === 0) {
      // pages/X from pages/Y → just X
      return href.substring('pages/'.length);
    }
    return '../' + href;
  }

  function renderMasthead(currentPagePath, meta) {
    meta = meta || {};
    const navHtml = NAV_LINKS.map(function (link) {
      const href = relativizePath(link.href, currentPagePath);
      const isActive = link.href === currentPagePath;
      return '<a href="' + href + '"' + (isActive ? ' class="active"' : '') + '>' + link.label + '</a>';
    }).join('');

    const homeHref = currentPagePath === 'index.html' ? 'index.html' : '../index.html';

    return '<header class="masthead">' +
      '<div class="meta-l">' + (meta.left || 'Vol. I · No. 01 · Ed. Mei 2026') + '</div>' +
      '<div class="brand">' +
        '<h1><a href="' + homeHref + '">Stres<span class="lens">·</span><em>Lens</em></a></h1>' +
        '<div class="tagline">Sistem Pakar Fuzzy &middot; Diagnostik Beban Akademik</div>' +
      '</div>' +
      '<div class="meta-r">' + (meta.right || 'Mamdani FIS · 7 Inputs · 35 Rules') + '</div>' +
    '</header>' +
    '<nav class="nav-bar">' + navHtml + '</nav>';
  }

  function renderFooter() {
    return '<footer>' +
      '<div>StresLens © 2026 — Sistem indikatif, bukan diagnosis klinis</div>' +
      '<div>Mamdani · Centroid Defuzzification</div>' +
    '</footer>';
  }

  function injectLayout(currentPagePath, meta) {
    const head = document.getElementById('streslens-header');
    if (head) head.innerHTML = renderMasthead(currentPagePath, meta);
    const foot = document.getElementById('streslens-footer');
    if (foot) foot.innerHTML = renderFooter();
  }

  root.StresLayout = {
    NAV_LINKS: NAV_LINKS,
    renderMasthead: renderMasthead,
    renderFooter: renderFooter,
    injectLayout: injectLayout
  };
})(window);
