/* DM-VAE animated method explainer.
   Everything on the stage is a pure function of the timeline position, so the
   bar can be scrubbed freely. Virtual stage: 1600 x 900. */
(function () {
  'use strict';
  var root = document.getElementById('dmx');
  if (!root) return;
  var W = 1600, H = 900;
  var BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  var stage = root.querySelector('.dmx-stage');
  var cv = root.querySelector('canvas');
  var c = cv.getContext('2d');
  var capEl = root.querySelector('.dmx-caption');
  var labelRoot = root.querySelector('.dmx-labels');
  var chRoot = root.querySelector('.dmx-chapters');
  var playBtn = root.querySelector('.dmx-play');
  var bigPlay = root.querySelector('.dmx-bigplay');
  var timeEl = root.querySelector('.dmx-time');

  /* ---------- helpers ---------- */
  function clamp(x, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.min(b, Math.max(a, x)); }
  function ez(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function seg(t, a, b) { return ez(clamp((t - a) / (b - a))); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function win(t, a, b, f) { f = f || 0.6; var v = seg(t, a, a + f); if (b != null) v = Math.min(v, 1 - seg(t, b - f, b)); return v; }
  function frac(x) { return x - Math.floor(x); }

  var C = {
    ink: '#0f172a', muted: '#64748b', line: '#b6bcc8', accent: '#5b3cc4',
    net: '#b392c9', netSoft: '#dccbe6', lat: '#f2b083', latEdge: '#e2925c',
    green: '#8fbf7a', greenSoft: '#cfe3c3', red: '#d9485f', good: '#2f9e6e',
    hi: [188, 164, 220], lo: [150, 200, 132]
  };

  var IM = {};
  ['x', 'rec', 'skel', 'detail', 'ood_raw', 'ood_rae'].forEach(function (k) {
    var im = new Image();
    im.onload = function () { im.ok = true; render(); };
    im.src = BASE + k + '.jpg';
    IM[k] = im;
  });
  var tmp = document.createElement('canvas');

  var GA = 1;
  function al(v) { c.globalAlpha = clamp(GA * v); }

  function rr(x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function box(cx, cy, w, h, fill, stroke, r) {
    rr(cx - w / 2, cy - h / 2, w, h, r == null ? 12 : r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  function trap(cx, cy, w, hl, hr, fill) {
    c.beginPath();
    c.moveTo(cx - w / 2, cy - hl / 2); c.lineTo(cx + w / 2, cy - hr / 2);
    c.lineTo(cx + w / 2, cy + hr / 2); c.lineTo(cx - w / 2, cy + hl / 2); c.closePath();
    c.fillStyle = fill; c.lineJoin = 'round'; c.lineWidth = 8; c.strokeStyle = fill; c.fill(); c.stroke();
  }
  function node(cx, cy, r, fill, edge, hollow) {
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fillStyle = hollow ? '#ffffff' : fill; c.fill();
    c.lineWidth = hollow ? 3 : 2; c.strokeStyle = edge || fill; c.stroke();
  }
  function arrow(x1, y1, x2, y2, p, o) {
    o = o || {}; p = p == null ? 1 : p; if (p <= 0.01) return;
    var ex = lerp(x1, x2, p), ey = lerp(y1, y2, p);
    var a = Math.atan2(y2 - y1, x2 - x1), hd = o.head || 13, w = o.width || 4;
    c.strokeStyle = c.fillStyle = o.color || C.line; c.lineWidth = w; c.lineCap = 'round';
    c.setLineDash(o.dash || []);
    c.beginPath();
    c.moveTo(x1 + (o.both ? Math.cos(a) * hd * 0.8 : 0), y1 + (o.both ? Math.sin(a) * hd * 0.8 : 0));
    c.lineTo(ex - Math.cos(a) * hd * 0.8, ey - Math.sin(a) * hd * 0.8); c.stroke();
    c.setLineDash([]);
    function head(x, y, ang) {
      c.beginPath(); c.moveTo(x, y);
      c.lineTo(x - Math.cos(ang - 0.42) * hd * 1.5, y - Math.sin(ang - 0.42) * hd * 1.5);
      c.lineTo(x - Math.cos(ang + 0.42) * hd * 1.5, y - Math.sin(ang + 0.42) * hd * 1.5);
      c.closePath(); c.fill();
    }
    head(ex, ey, a);
    if (o.both) head(x1, y1, a + Math.PI);
  }
  function img(im, cx, cy, s, res) {
    var x = cx - s / 2, y = cy - s / 2;
    c.save(); rr(x, y, s, s, 10); c.clip();
    if (im && im.ok) {
      if (res && res < s - 2) {
        var r = Math.max(8, Math.round(res)); tmp.width = tmp.height = r;
        var tc = tmp.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(im, 0, 0, r, r);
        c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'; c.drawImage(tmp, x, y, s, s);
      } else c.drawImage(im, x, y, s, s);
    } else { c.fillStyle = '#e8eef3'; c.fillRect(x, y, s, s); }
    c.restore();
    rr(x, y, s, s, 10); c.lineWidth = 1.5; c.strokeStyle = 'rgba(15,23,42,0.18)'; c.stroke();
  }
  function text(s, x, y, o) {
    o = o || {};
    c.font = (o.weight || 500) + ' ' + (o.size || 22) + 'px ' + (o.serif ? "'Source Serif 4', Georgia, serif" : "Inter, -apple-system, sans-serif");
    c.fillStyle = o.color || C.ink; c.textAlign = o.align || 'center'; c.textBaseline = 'middle';
    c.fillText(s, x, y);
  }
  function stack(cx, cy, n, s) {
    s = s || 100;
    for (var k = n - 1; k >= 0; k--) {
      var o = (k - (n - 1) / 2) * 7;
      rr(cx + o - s / 2, cy - o - s / 2, s, s, 8);
      c.fillStyle = C.lat; c.fill(); c.lineWidth = 1.6; c.strokeStyle = '#ffffff'; c.stroke();
    }
  }

  /* ---------- isometric height-field surface ---------- */
  function hS(u, v) {
    return 0.36 * Math.exp(-((u + 0.3) * (u + 0.3) + (v - 0.15) * (v - 0.15)) / 0.5)
         + 0.24 * Math.exp(-((u - 0.5) * (u - 0.5) + (v + 0.45) * (v + 0.45)) / 0.3);
  }
  var RF = [[5.1, 2.3, 0.4], [-3.2, 6.7, 1.9], [8.3, -4.1, 3.3], [2.2, 9.4, 5.1], [-7.7, -6.2, 0.7], [11.3, 3.1, 2.2]];
  function hR(u, v) {
    var s = 0;
    for (var i = 0; i < RF.length; i++) s += Math.sin(RF[i][0] * u + RF[i][1] * v + RF[i][2]);
    return s * 0.05;
  }
  function P(o, u, v, h) { return [o.cx + (u - v) * o.s * 0.72, o.cy + (u + v) * o.s * 0.3 - h * o.s * 0.62]; }
  function surface(o, hf, alpha) {
    var N = o.N || 38, i, j, g = [], a0 = c.globalAlpha;
    for (i = 0; i <= N; i++) { g[i] = []; for (j = 0; j <= N; j++) { var u = -1 + 2 * i / N, v = -1 + 2 * j / N, h = hf(u, v); var p = P(o, u, v, h); g[i][j] = [p[0], p[1], h]; } }
    c.globalAlpha = a0 * (alpha == null ? 1 : alpha);
    c.lineWidth = 0.7; c.lineJoin = 'round';
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      var a = g[i][j], b = g[i + 1][j], d = g[i + 1][j + 1], e = g[i][j + 1];
      var gu = (b[2] - a[2]) * N / 2, gv = (e[2] - a[2]) * N / 2;
      var lum = clamp(0.97 - 0.3 * gu + 0.14 * gv + 0.1 * a[2], 0.6, 1.14);
      var col = 'rgb(' + Math.min(255, o.rgb[0] * lum | 0) + ',' + Math.min(255, o.rgb[1] * lum | 0) + ',' + Math.min(255, o.rgb[2] * lum | 0) + ')';
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(e[0], e[1]); c.closePath();
      c.fillStyle = col; c.strokeStyle = col; c.fill(); c.stroke();
    }
    c.beginPath();
    for (i = 0; i <= N; i++) c[i ? 'lineTo' : 'moveTo'](g[i][0][0], g[i][0][1]);
    for (j = 1; j <= N; j++) c.lineTo(g[N][j][0], g[N][j][1]);
    for (i = N - 1; i >= 0; i--) c.lineTo(g[i][N][0], g[i][N][1]);
    for (j = N - 1; j >= 0; j--) c.lineTo(g[0][j][0], g[0][j][1]);
    c.strokeStyle = 'rgba(15,23,42,0.28)'; c.lineWidth = 1.2; c.stroke();
    c.globalAlpha = a0;
  }
  /* sampled latents travelling across the manifold; they lift off where it is rugged */
  function particles(o, hf, t, R, n) {
    n = n || 8; var a0 = c.globalAlpha;
    for (var k = 0; k < n; k++) {
      var ph = frac(t * 0.11 + k / n + 0.03 * k);
      var u = -0.92 + 1.84 * ph, v = -0.75 + 1.5 * frac(k * 0.381 + 0.13) + 0.12 * Math.sin(ph * 6 + k);
      v = clamp(v, -0.92, 0.92);
      var dk = (k % 4 === 3) ? 0 : 0.2 + 0.26 * frac(k * 0.73);
      var drift = R * dk * seg(ph, 0.18, 0.6);
      var h = hf(u, v), on = P(o, u, v, h), p = P(o, u, v, h + drift);
      var fade = Math.min(seg(ph, 0, 0.08), 1 - seg(ph, 0.9, 1));
      var off = drift > 0.035;
      c.globalAlpha = a0 * fade;
      if (off) {
        c.setLineDash([4, 5]); c.strokeStyle = C.red; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(on[0], on[1]); c.lineTo(p[0], p[1]); c.stroke(); c.setLineDash([]);
        c.beginPath(); c.arc(on[0], on[1], 3, 0, 7); c.fillStyle = 'rgba(217,72,95,0.45)'; c.fill();
      }
      c.beginPath(); c.arc(p[0], p[1], 7.5, 0, 7);
      c.fillStyle = off ? C.red : C.ink; c.fill(); c.lineWidth = 2; c.strokeStyle = '#ffffff'; c.stroke();
    }
    c.globalAlpha = a0;
  }

  /* ---------- scenes ---------- */
  var M = function (s) { return '$' + s; };
  var T = {
    x: 'x', xh: '\\hat{x}', z: 'z', zh: '\\hat{z}', E: '\\mathcal{E}', D: '\\mathcal{D}',
    zlow: 'z_{\\text{low}}', Dlow: '\\mathcal{D}_{\\text{low}}', xlow: '\\hat{x}_{\\text{low}}',
    Pd: '\\mathcal{P}_{\\text{down}}', Pu: '\\mathcal{P}_{\\text{up}}', Pa: '\\mathcal{P}_{\\text{align}}'
  };
  var W1 = { color: '#ffffff', size: 34 }, N1 = { color: '#5a3210', size: 28 };

  var scenes = [
    /* ===== Chapter 1: motivation ===== */
    {
      ch: 0, dur: 8, cap: 'A wider latent reconstructs better.',
      labels: [
        [230, 345, M(T.x), 0.2, null, { size: 30 }], [520, 500, M(T.E), 0.7, null, W1],
        [800, 372, M(T.z), 1.2, null, { size: 30 }], [1090, 500, M(T.D), 1.5, null, W1],
        [1385, 345, M(T.xh), 1.9, null, { size: 30 }]
      ],
      draw: function (t) {
        var y = 500, p = seg(t, 3, 6);
        al(win(t, 0.2)); img(IM.x, 230, y, 230);
        al(win(t, 0.5)); arrow(362, y, 428, y);
        al(win(t, 0.7)); trap(520, y, 140, 250, 130, C.net);
        al(win(t, 1.0)); arrow(612, y, 678, y);
        al(win(t, 1.2)); stack(800, y, Math.round(lerp(8, 16, p)));
        al(win(t, 1.5)); arrow(922, y, 988, y); trap(1090, y, 140, 130, 250, C.net); arrow(1182, y, 1248, y);
        al(win(t, 1.9)); img(IM.x, 1385, y, 230, lerp(84, 230, p));
        al(win(t, 2.2));
        text('latent channels', 800, y + 150, { size: 22, color: C.muted });
        text('d' + Math.round(lerp(32, 64, p)), 800, y + 200, { size: 46, weight: 700 });
        text('reconstruction rFID', 1385, y + 150, { size: 22, color: C.muted });
        text(lerp(0.26, 0.17, p).toFixed(2), 1385, y + 200, { size: 46, weight: 700, color: C.good });
        text('SD-VAE, f16', 230, y + 150, { size: 22, color: C.muted });
      }
    },
    {
      ch: 0, dur: 9, cap: 'But the high-dimensional manifold turns rugged,<br>and generated latents drift off it.',
      labels: [
        [170, 720, M('\\mathcal{M}_Z'), 0.6, null, { size: 32, color: '#6d4bb0' }],
        [560, 262, '<span style="color:#d9485f;font-weight:600">off-manifold samples</span>', 5.2, null, { size: 24 }]
      ],
      draw: function (t) {
        var o = { cx: 560, cy: 600, s: 320, rgb: C.hi }, p = seg(t, 2, 5.5), R = lerp(0.08, 1, p);
        var hf = function (u, v) { return hS(u, v) + R * hR(u, v); };
        al(win(t, 0.2)); surface(o, hf); particles(o, hf, t + 3, R);
        al(win(t, 0.8));
        text('SD-VAE  ·  DiT-XL  ·  80 epochs', 1290, 300, { size: 22, color: C.muted });
        text('d' + Math.round(lerp(32, 64, p)), 1290, 362, { size: 46, weight: 700 });
        text('rFID', 1180, 470, { size: 22, color: C.muted });
        text(lerp(0.26, 0.17, p).toFixed(2), 1180, 524, { size: 50, weight: 700, color: C.good });
        text('gFID', 1400, 470, { size: 22, color: C.muted });
        text(lerp(10.59, 17.24, p).toFixed(2), 1400, 524, { size: 50, weight: 700, color: p > 0.05 ? C.red : C.ink });
        al(win(t, 5.6));
        text('reconstruction improves,', 1290, 620, { size: 24, color: C.muted });
        text('generation collapses', 1290, 656, { size: 24, weight: 600, color: C.red });
      }
    },
    {
      ch: 0, dur: 9, cap: 'A frozen foundation model can smooth it,<br>but ties the latent to an external prior.',
      labels: [
        [130, 310, M(T.x), 0.2, null, { size: 28 }], [310, 400, M(T.E), 0.4, null, W1], [480, 400, M(T.z), 0.6, null, N1],
        [650, 400, M(T.D), 0.8, null, W1], [830, 310, M(T.xh), 1.0, null, { size: 28 }],
        [480, 605, '<span style="color:#fff;font-weight:600">DINOv2</span> <span style="color:#efe6f7">· frozen</span>', 1.6, null, { size: 24 }],
        [556, 506, 'align', 2.0, null, { size: 22, color: C.muted }]
      ],
      draw: function (t) {
        var y = 400;
        al(win(t, 0.2)); img(IM.x, 130, y, 130);
        al(win(t, 0.4)); arrow(208, y, 240, y); trap(310, y, 110, 190, 100, C.net);
        al(win(t, 0.6)); arrow(378, y, 418, y); node(480, y, 46, C.lat, C.latEdge);
        al(win(t, 0.8)); arrow(540, y, 580, y); trap(650, y, 110, 100, 190, C.net);
        al(win(t, 1.0)); arrow(718, y, 752, y); img(IM.rec, 830, y, 130);
        al(win(t, 1.6)); box(480, 605, 260, 84, '#8f6bb0');
        al(win(t, 2.0)); arrow(480, 458, 480, 552, 1, { color: C.latEdge, both: true, width: 5 });
        var a = win(t, 3.6);
        al(a * 0.5); c.strokeStyle = C.line; c.lineWidth = 2; c.setLineDash([8, 8]);
        c.beginPath(); c.moveTo(960, 230); c.lineTo(960, 760); c.stroke(); c.setLineDash([]);
        al(a); text('out-of-distribution input (zero-shot)', 1270, 250, { size: 23, color: C.muted });
        img(IM.ood_raw, 1125, 430, 260); text('raw', 1125, 590, { size: 23, color: C.muted });
        al(win(t, 4.4)); img(IM.ood_rae, 1415, 430, 260); text('RAE (DINOv2 latent)', 1415, 590, { size: 23, color: C.muted });
        al(win(t, 5.4)); text('OOD rFID  9.85', 1270, 672, { size: 34, weight: 700, color: C.red });
        text('details outside the prior are lost', 1270, 718, { size: 23, color: C.muted });
      }
    },
    /* ===== Chapter 2: dual manifold ===== */
    {
      ch: 1, dur: 8, cap: 'Observation: a <em>low-dimensional</em> latent is naturally smooth.',
      labels: [
        [420, 742, '<b>low-dimensional latent</b>', 0.4, null, { size: 25 }],
        [420, 782, 'smooth, generation-friendly · loses detail', 1.0, null, { size: 21, color: C.muted }],
        [1180, 742, '<b>high-dimensional latent</b>', 2.4, null, { size: 25 }],
        [1180, 782, 'sharp reconstruction · rugged', 3.0, null, { size: 21, color: C.muted }]
      ],
      draw: function (t) {
        var a = { cx: 420, cy: 510, s: 250, rgb: C.lo }, b = { cx: 1180, cy: 510, s: 250, rgb: C.hi };
        var hb = function (u, v) { return hS(u, v) + hR(u, v); };
        al(win(t, 0.3)); surface(a, hS); particles(a, hS, t + 2, 0, 6);
        al(win(t, 2.2)); surface(b, hb); particles(b, hb, t + 5, 1, 6);
      }
    },
    {
      ch: 1, dur: 12, cap: 'DM-VAE pairs the two: project down to a skeleton,<br>lift it back, and align.',
      labels: [
        [170, 228, M(T.x), 0.2, null, { size: 28 }], [390, 330, M(T.E), 0.4, null, W1], [620, 330, M(T.z), 0.6, null, N1],
        [850, 330, M(T.D), 0.8, null, W1], [1080, 228, M(T.xh), 1.0, null, { size: 28 }],
        [1290, 330, 'Rec + GAN', 1.2, null, { size: 22, color: C.muted }],
        [462, 652, M(T.Pd), 2.4, null, { size: 23 }], [620, 790, M(T.zlow), 3.0, null, { size: 24, color: '#22421a' }],
        [900, 790, M(T.Dlow), 4.6, null, { size: 26 }], [1120, 688, M(T.xlow), 5.0, null, { size: 26 }],
        [1330, 790, 'Rec only · no GAN', 5.4, null, { size: 22, color: C.muted }],
        [778, 652, M(T.Pu), 6.6, null, { size: 23 }], [620, 530, M(T.zh), 7.2, null, { size: 28, color: '#22421a' }],
        [1160, 500, M('\\mathcal{L}_{\\text{DM}}=\\mathbb{E}_x\\big[\\lVert z-\\hat{z}\\rVert_2^2\\big]'), 8.6, null, { size: 30, color: C.accent }],
        [1160, 550, 'the lifted skeleton anchors the high-dimensional latent', 9.2, null, { size: 20, color: C.muted }]
      ],
      draw: function (t) {
        var y = 330;
        al(win(t, 0.2)); img(IM.x, 170, y, 140);
        al(win(t, 0.4)); arrow(254, y, 300, y); trap(390, y, 120, 200, 104, C.net);
        al(win(t, 0.6)); arrow(466, y, 550, y); node(620, y, 50, C.lat, C.latEdge);
        al(win(t, 0.8)); arrow(690, y, 774, y); trap(850, y, 120, 104, 200, C.net);
        al(win(t, 1.0)); arrow(926, y, 990, y); img(IM.rec, 1080, y, 140);
        /* low branch */
        al(win(t, 2.4)); arrow(576, 368, 500, 598, seg(t, 2.4, 3.2)); trap(462, 652, 150, 60, 60, C.netSoft);
        al(win(t, 3.0)); arrow(500, 700, 566, 752, seg(t, 3.0, 3.6)); node(620, 790, 50, C.green, '#6da455');
        al(win(t, 4.6)); arrow(688, 790, 812, 790, seg(t, 4.6, 5.2)); trap(900, 790, 110, 76, 150, C.netSoft);
        al(win(t, 5.0)); arrow(972, 790, 1030, 790); img(IM.skel, 1120, 790, 140);
        /* lift back */
        al(win(t, 6.6)); arrow(674, 752, 742, 700, seg(t, 6.6, 7.2)); trap(778, 652, 150, 60, 60, C.netSoft);
        al(win(t, 7.2)); arrow(742, 608, 672, 560, seg(t, 7.2, 7.8)); node(620, 530, 50, C.green, '#6da455');
        /* align */
        var pulse = 1 + 0.25 * Math.sin(t * 5) * win(t, 8.6);
        al(win(t, 8.4)); arrow(620, 388, 620, 472, 1, { color: C.accent, both: true, width: 5 * pulse });
        al(win(t, 8.6) * 0.5); c.setLineDash([7, 7]); c.strokeStyle = C.accent; c.lineWidth = 2;
        rr(548, 262, 144, 336, 40); c.stroke(); c.setLineDash([]);
      }
    },
    {
      ch: 1, dur: 8, cap: 'The high-dimensional manifold is pulled into a thin tube<br>around the smooth skeleton.',
      labels: [
        [250, 500, M('\\mathcal{M}_Z'), 0.4, null, { size: 32, color: '#6d4bb0' }],
        [250, 740, M('\\mathcal{M}_{\\text{base}}'), 0.4, null, { size: 32, color: '#3f7d2c' }],
        [1310, 330, M('z = z^{\\text{base}} + z^{\\text{detail}}'), 5.4, null, { size: 32 }],
        [1310, 392, M('|\\cos(z^{\\text{base}},\\, z^{\\text{detail}})| = 0.0047'), 6.0, null, { size: 24, color: C.muted }]
      ],
      draw: function (t) {
        var o = { cx: 800, cy: 640, s: 350, rgb: C.lo, N: 36 }, p = seg(t, 1.8, 5.2);
        var off = lerp(0.42, 0.06, p), amp = lerp(1, 0.2, p);
        var hz = function (u, v) { return hS(u, v) + off + amp * hR(u, v); };
        al(win(t, 0.3)); surface(o, hS);
        var o2 = { cx: o.cx, cy: o.cy, s: o.s, rgb: C.hi, N: 36 };
        surface(o2, hz, lerp(0.78, 0.5, p));
        particles(o2, hz, t + 1, (1 - p) * 0.9, 7);
      }
    },
    {
      ch: 1, dur: 7, cap: 'The latent splits cleanly into structure and detail.',
      labels: [
        [330, 668, M('\\mathcal{D}(z)'), 0.3, null, { size: 28 }], [330, 714, 'full reconstruction', 0.3, null, { size: 21, color: C.muted }],
        [800, 668, M('\\mathcal{D}(\\hat{z})'), 1.8, null, { size: 28 }], [800, 714, 'skeleton · global structure', 1.8, null, { size: 21, color: C.muted }],
        [1270, 668, M('\\mathcal{D}(z)-\\mathcal{D}(\\hat{z})'), 3.0, null, { size: 28 }], [1270, 714, 'detail · high-frequency residual', 3.0, null, { size: 21, color: C.muted }]
      ],
      draw: function (t) {
        al(win(t, 0.3)); img(IM.rec, 330, 470, 290);
        al(win(t, 1.6)); text('=', 565, 470, { size: 64, weight: 400, color: C.muted });
        al(win(t, 1.8)); img(IM.skel, 800, 470, 290);
        al(win(t, 2.8)); text('+', 1035, 470, { size: 64, weight: 400, color: C.muted });
        al(win(t, 3.0)); img(IM.detail, 1270, 470, 290);
      }
    },
    /* ===== Chapter 3: TRA and IG_TS ===== */
    {
      ch: 2, dur: 9, cap: 'Training (TRA): a mid-layer feature learns to predict the skeleton.',
      labels: [
        [420, 232, M('z_t'), 0.2, null, N1], [420, 392, '<span style="color:#fff;font-weight:600">DiT block <i>i</i></span>', 0.5, null, { size: 24 }],
        [420, 592, '<span style="color:#fff;font-weight:600">DiT block <i>L</i></span>', 0.8, null, { size: 24 }],
        [420, 770, M('v_\\theta'), 1.1, null, N1],
        [706, 492, M(T.Pa), 2.2, null, { size: 24 }], [940, 492, M('\\tilde{z}_{\\text{low}}'), 2.8, null, { size: 24, color: '#22421a' }],
        [940, 282, M(T.zlow), 4.0, null, { size: 24, color: '#22421a' }],
        [1016, 282, M('=\\;\\mathcal{P}_{\\text{down}}(z_1)'), 4.0, null, { size: 26, left: 1 }],
        [1016, 322, 'clean skeleton of the data latent', 4.4, null, { size: 20, color: C.muted, left: 1 }],
        [1010, 388, M('\\mathcal{L}_{\\text{TRA}}'), 5.4, null, { size: 30, color: C.accent, left: 1 }],
        [1100, 388, 'cosine alignment', 5.4, null, { size: 21, color: C.muted, left: 1 }],
        [1180, 640, 'structure is learned early,<br>away from high-frequency noise', 6.4, null, { size: 23, color: C.muted }]
      ],
      draw: function (t) {
        al(win(t, 0.2)); node(420, 232, 44, C.lat, C.latEdge);
        al(win(t, 0.5)); arrow(420, 284, 420, 334); box(420, 392, 270, 96, C.net);
        al(win(t, 0.8)); arrow(420, 448, 420, 534); box(420, 592, 270, 96, C.net);
        al(win(t, 1.1)); arrow(420, 648, 420, 716); node(420, 770, 44, C.lat, C.latEdge);
        al(win(t, 2.2)); arrow(432, 492, 606, 492, seg(t, 2.2, 2.9)); trap(706, 492, 150, 96, 60, C.netSoft);
        al(win(t, 2.8)); arrow(792, 492, 874, 492, seg(t, 2.8, 3.3)); node(940, 492, 50, C.greenSoft, '#6da455');
        al(win(t, 4.0)); node(940, 282, 50, C.green, '#6da455');
        var pulse = 1 + 0.25 * Math.sin(t * 5) * win(t, 5.4);
        al(win(t, 5.2)); arrow(940, 342, 940, 432, 1, { color: C.accent, both: true, width: 5 * pulse });
      }
    },
    {
      ch: 2, dur: 11, cap: 'Inference (IG<sub>TS</sub>): one pass, guide only the skeleton,<br>leave the detail untouched.',
      labels: [
        [200, 218, M('z_t'), 0.2, null, N1],
        [200, 462, '<span style="color:#fff;font-weight:600">DiT</span>', 0.4, null, { size: 30 }],
        [200, 506, '<span style="color:#f3ecf8">one forward pass</span>', 0.4, null, { size: 19 }],
        [470, 380, M('\\tilde{z}_1^{\\text{base}}'), 1.0, null, { size: 21, color: '#5a3210' }],
        [470, 300, 'mid-layer skeleton', 1.0, null, { size: 19, color: C.muted }],
        [470, 600, M('\\hat{z}_1'), 1.6, null, { size: 24, color: '#5a3210' }],
        [680, 520, M('\\hat{z}_1^{\\text{base}}'), 2.2, null, { size: 21, color: '#5a3210' }],
        [680, 690, M('\\hat{z}_1^{\\text{detail}}'), 2.2, null, { size: 20, color: '#22421a' }],
        [930, 712, M('\\tilde{z}_1^{\\text{base}}'), 3.2, null, { size: 24 }],
        [1120, 640, M('\\hat{z}_1^{\\text{base}}'), 3.6, null, { size: 24 }],
        [1420, 600, M('(\\omega-1)\\,(\\hat{z}_1^{\\text{base}}-\\tilde{z}_1^{\\text{base}})'), 4.8, null, { size: 22, color: '#c2691f' }],
        [1010, 470, M('\\hat{z}_1^{\\text{detail}}'), 6.4, null, { size: 22, color: '#3f7d2c' }],
        [1318, 300, M('\\hat{z}_1^{\\text{guided}}'), 7.6, null, { size: 28, color: C.accent }],
        [800, 826, M('\\hat{z}_1^{\\text{guided}}=\\hat{z}_1^{\\text{base}}+(\\omega-1)\\,(\\hat{z}_1^{\\text{base}}-\\tilde{z}_1^{\\text{base}})+\\hat{z}_1^{\\text{detail}}'), 8.2, null, { size: 27 }]
      ],
      draw: function (t) {
        al(win(t, 0.2)); node(200, 218, 42, C.lat, C.latEdge); arrow(200, 268, 200, 312);
        al(win(t, 0.4)); box(200, 480, 250, 300, C.net, null, 16);
        al(win(t, 1.0)); arrow(332, 380, 404, 380, seg(t, 1.0, 1.5)); node(470, 380, 52, '#fff', C.latEdge, true);
        al(win(t, 1.6)); arrow(332, 600, 404, 600, seg(t, 1.6, 2.1)); node(470, 600, 52, C.lat, C.latEdge);
        al(win(t, 2.2)); arrow(520, 578, 620, 540, seg(t, 2.2, 2.7)); node(680, 520, 52, C.lat, C.latEdge);
        arrow(520, 622, 620, 668, seg(t, 2.2, 2.7)); node(680, 690, 52, C.green, '#6da455');
        /* vector picture */
        var A = [940, 668], B = [1110, 592], G = [1280, 516], d = [-52, -168];
        al(win(t, 3.0) * 0.6); c.setLineDash([8, 8]); c.strokeStyle = C.line; c.lineWidth = 2;
        c.beginPath(); c.moveTo(820, 210); c.lineTo(820, 760); c.stroke(); c.setLineDash([]);
        al(win(t, 3.2)); node(A[0], A[1], 12, '#fff', C.latEdge, true);
        al(win(t, 3.6)); arrow(A[0] + 12, A[1] - 5, B[0] - 14, B[1] + 6, seg(t, 3.6, 4.2), { color: C.line, width: 3, dash: [6, 7] });
        node(B[0], B[1], 13, C.lat, C.latEdge);
        al(win(t, 4.6)); arrow(B[0] + 14, B[1] - 6, G[0] - 4, G[1] + 2, seg(t, 4.6, 5.8), { color: '#e2925c', width: 6 });
        al(win(t, 6.2)); arrow(B[0], B[1] - 16, B[0] + d[0], B[1] + d[1] + 10, seg(t, 6.2, 6.9), { color: C.green, width: 5 });
        var q = seg(t, 7.0, 7.8);
        al(win(t, 7.0)); arrow(G[0], G[1] - 4, G[0] + d[0], G[1] + d[1] + 14, q, { color: C.green, width: 5 });
        al(win(t, 7.6)); node(G[0] + d[0], G[1] + d[1], 15, C.accent, C.accent);
        al(win(t, 8.8)); text('no extra network evaluation', 200, 690, { size: 20, color: C.muted });
      }
    },
    {
      ch: 2, dur: 10, cap: 'No foundation model: better reconstruction <em>and</em> better generation.',
      labels: [
        [1290, 268, '<span style="color:#5b3cc4;font-weight:700">0.12</span> rFID', 6.6, null, { size: 44 }],
        [1290, 318, 'ImageNet 256×256, f16d64', 6.6, null, { size: 20, color: C.muted }],
        [1290, 452, '<span style="color:#5b3cc4;font-weight:700">1.28 / 1.20</span>', 7.2, null, { size: 44 }],
        [1290, 502, 'FID<sub>50K</sub> without / with CFG, f16d64', 7.2, null, { size: 20, color: C.muted }],
        [1290, 636, '<span style="color:#5b3cc4;font-weight:700">1.12</span> OOD rFID', 7.8, null, { size: 44 }],
        [1290, 686, 'zero-shot Anime-Faces · RAE 9.85', 7.8, null, { size: 20, color: C.muted }]
      ],
      draw: function (t) {
        var x0 = 190, x1 = 960, y0 = 210, y1 = 770;
        function fx(r) { return x0 + (0.30 - r) / 0.20 * (x1 - x0); }
        function fy(g) { return y0 + (g - 4) / 14 * (y1 - y0); }
        al(win(t, 0.2));
        c.strokeStyle = '#eef1f5'; c.lineWidth = 1.5;
        var g, r;
        for (g = 4; g <= 18; g += 2) { c.beginPath(); c.moveTo(x0, fy(g)); c.lineTo(x1, fy(g)); c.stroke(); text(String(g), x0 - 22, fy(g), { size: 19, color: C.muted, align: 'right' }); }
        for (r = 0.30; r > 0.095; r -= 0.05) { c.beginPath(); c.moveTo(fx(r), y0); c.lineTo(fx(r), y1); c.stroke(); text(r.toFixed(2), fx(r), y1 + 28, { size: 19, color: C.muted }); }
        c.strokeStyle = C.ink; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x1, y1); c.stroke();
        text('rFID  (lower is better →)', (x0 + x1) / 2, y1 + 68, { size: 21, color: C.muted });
        c.save(); c.translate(x0 - 86, (y0 + y1) / 2); c.rotate(-Math.PI / 2); text('gFID, DiT-XL 80 epochs  (lower is better →)', 0, 0, { size: 21, color: C.muted }); c.restore();
        function series(a, b, ta, col, name, dash, lw, na, nb) {
          var p = seg(t, ta, ta + 1.3), v = win(t, ta);
          al(v);
          var ax = fx(a[0]), ay = fy(a[1]), bx = fx(b[0]), by = fy(b[1]);
          c.strokeStyle = col; c.lineWidth = lw || 4; c.setLineDash(dash || []); c.lineCap = 'round';
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(lerp(ax, bx, p), lerp(ay, by, p)); c.stroke(); c.setLineDash([]);
          c.fillStyle = col; c.beginPath(); c.arc(ax, ay, 10, 0, 7); c.fill();
          text('d32', ax + na[0], ay + na[1], { size: 19, weight: 600, color: col });
          al(v * seg(t, ta + 1.0, ta + 1.4));
          c.beginPath(); c.arc(bx, by, 10, 0, 7); c.fill();
          text('d64', bx + nb[0], by + nb[1], { size: 19, weight: 600, color: col });
          var parts = name.split('|');
          text(parts[0], bx + nb[2], by + nb[3], { size: 21, weight: 600, color: col });
          if (parts[1]) { var tw = c.measureText(parts[0]).width; text(parts[1], bx + nb[2] + tw / 2 + 2, by + nb[3] + 8, { size: 14, weight: 600, color: col, align: 'left' }); }
        }
        series([0.26, 10.59], [0.17, 17.24], 0.8, '#222831', 'SD-VAE', null, 4, [-34, 26], [44, 2, -84, 6]);
        series([0.28, 8.22], [0.14, 11.98], 2.2, '#2f7fb8', 'VA-VAE', [10, 9], 4, [-40, -4], [42, 8, -62, 34]);
        series([0.21, 8.89], [0.12, 10.40], 3.6, '#a98bd0', 'DM-VAE', null, 4, [-40, 10], [44, 4, -200, -62]);
        series([0.21, 5.16], [0.12, 5.44], 5.0, C.accent, 'DM-VAE + IG|TS', null, 6, [-40, -6], [44, 2, -160, -34]);
        al(win(t, 5.0) * seg(t, 5.0, 5.8));
        arrow(fx(0.21), fy(8.89) - 16, fx(0.21), fy(5.16) + 16, 1, { color: C.accent, width: 2.5, dash: [5, 6], head: 9 });
        al(win(t, 6.0) * seg(t, 6.0, 6.6));
        arrow(fx(0.12), fy(10.40) - 16, fx(0.12), fy(5.44) + 16, 1, { color: C.accent, width: 2.5, dash: [5, 6], head: 9 });
      }
    }
  ];
  var CHAPTERS = ['Motivation', 'Dual Manifold', 'TRA &amp; IG<sub>TS</sub>'];

  /* ---------- build timeline + DOM ---------- */
  var total = 0;
  scenes.forEach(function (s) { s.t0 = total; total += s.dur; });
  var chStart = [], chDur = [];
  scenes.forEach(function (s) { if (chStart[s.ch] == null) { chStart[s.ch] = s.t0; chDur[s.ch] = 0; } chDur[s.ch] += s.dur; });

  function tex(src) {
    if (window.katex) { try { return window.katex.renderToString(src, { throwOnError: false }); } catch (e) { } }
    return src;
  }
  scenes.forEach(function (s) {
    var el = document.createElement('div'); el.className = 'dmx-scene'; s.el = el;
    s.labels.forEach(function (L) {
      var d = document.createElement('div'), o = L[5] || {};
      d.className = 'dmx-l' + (o.left ? ' left' : '');
      d.style.left = (L[0] / W * 100) + '%'; d.style.top = (L[1] / H * 100) + '%';
      d.style.fontSize = ((o.size || 22) / 16) + 'cqw';
      if (o.color) d.style.color = o.color;
      d.innerHTML = L[2].charAt(0) === '$' ? tex(L[2].slice(1)) : L[2];
      L.el = d; el.appendChild(d);
    });
    labelRoot.appendChild(el);
  });
  var chEls = CHAPTERS.map(function (name, i) {
    var d = document.createElement('div'); d.className = 'dmx-ch'; d.style.flex = chDur[i] + ' 1 0';
    d.innerHTML = '<div class="dmx-ch-track"><div class="dmx-ch-fill"></div></div><div class="dmx-ch-name">' + name + '</div>';
    chRoot.appendChild(d); return d;
  });

  /* ---------- render ---------- */
  var time = 0, playing = false, last = 0, cur = null, capScene = null;
  function fit() {
    var r = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.width * 9 / 16 * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function fmt(s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function render() {
    fit();
    var t = clamp(time, 0, total - 0.001), s = scenes[0];
    for (var i = 0; i < scenes.length; i++) if (t >= scenes[i].t0) s = scenes[i];
    var lt = t - s.t0, last1 = s === scenes[scenes.length - 1];
    GA = Math.min(seg(lt, 0, 0.5), last1 ? 1 : 1 - seg(lt, s.dur - 0.45, s.dur));
    c.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
    c.globalAlpha = 1; c.clearRect(0, 0, W, H);
    s.draw(lt);
    c.globalAlpha = 1;
    if (cur !== s) { if (cur) cur.el.classList.remove('on'); s.el.classList.add('on'); cur = s; }
    for (var k = 0; k < s.labels.length; k++) { var L = s.labels[k]; L.el.style.opacity = (GA * win(lt, L[3], L[4])).toFixed(3); }
    if (capScene !== s) { capEl.innerHTML = '<span>' + s.cap + '</span>'; capScene = s; }
    capEl.style.opacity = GA.toFixed(3);
    chEls.forEach(function (el, j) {
      el.firstChild.firstChild.style.width = (clamp((t - chStart[j]) / chDur[j]) * 100).toFixed(2) + '%';
      el.classList.toggle('active', j === s.ch);
    });
    timeEl.textContent = fmt(t) + ' / ' + fmt(total);
  }
  function tick(now) {
    if (!playing) return;
    time += Math.min(0.1, (now - last) / 1000); last = now;
    if (time >= total) { time = total; setPlaying(false); render(); return; }
    render(); requestAnimationFrame(tick);
  }
  function setPlaying(p) {
    if (p && time >= total - 0.01) time = 0;
    playing = p; root.classList.toggle('paused', !p);
    playBtn.innerHTML = p ? '&#10074;&#10074;' : '&#9654;';
    playBtn.setAttribute('aria-label', p ? 'Pause' : 'Play');
    if (p) { last = performance.now(); requestAnimationFrame(tick); }
  }
  function seek(t) { time = clamp(t, 0, total); render(); }

  /* ---------- controls ---------- */
  var userPaused = false;
  function toggle() { userPaused = playing; setPlaying(!playing); }
  playBtn.addEventListener('click', toggle);
  stage.addEventListener('click', toggle);
  function seekFromEvent(e) {
    for (var i = 0; i < chEls.length; i++) {
      var r = chEls[i].getBoundingClientRect();
      if (e.clientX <= r.right + 4 || i === chEls.length - 1) { seek(chStart[i] + clamp((e.clientX - r.left) / r.width) * chDur[i]); return; }
    }
  }
  var dragging = false;
  chRoot.addEventListener('pointerdown', function (e) { dragging = true; chRoot.setPointerCapture(e.pointerId); seekFromEvent(e); });
  chRoot.addEventListener('pointermove', function (e) { if (dragging) seekFromEvent(e); });
  chRoot.addEventListener('pointerup', function () { dragging = false; });
  chRoot.addEventListener('pointercancel', function () { dragging = false; });
  root.tabIndex = 0;
  root.addEventListener('keydown', function (e) {
    if (e.key === ' ') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight') seek(time + 3);
    else if (e.key === 'ArrowLeft') seek(time - 3);
  });
  window.addEventListener('resize', render);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    new IntersectionObserver(function (es) {
      var vis = es[0].isIntersecting;
      if (vis && !playing && !userPaused && time < total - 0.01) setPlaying(true);
      else if (!vis && playing) setPlaying(false);
    }, { threshold: 0.35 }).observe(stage);
  }
  setPlaying(false);
  render();
  window.__dmx = { seek: seek, play: function () { setPlaying(true); }, pause: function () { setPlaying(false); }, total: total };
})();
