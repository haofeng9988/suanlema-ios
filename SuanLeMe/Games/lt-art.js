/* ============================================================================
 * lt-art.js  ·  《灵田天机》美术模块 A —— 农田场景 + 灵植精灵
 * ----------------------------------------------------------------------------
 * v4 重写版（QQ 农场明亮卡通风）
 * 纯 Canvas 2D 矢量绘制（ctx 路径），零外部图片，自包含。
 *
 * 冻结接口（与 v3 兼容 + 新增 drawHUD）：
 *   window.LTArt = {
 *     THEME,
 *     drawFarm(ctx, W, H, t, hour),
 *     drawPlot(ctx, x, y, w, h, plot, t),
 *     drawPlant(ctx, cx, cy, plot, t),
 *     drawProgressRing(ctx, cx, cy, r, progress, t),
 *     drawGlow(ctx, cx, cy, r, t),
 *     drawHUD(ctx, W, H, state, t)
 *   }
 * ==========================================================================*/
(function () {
  'use strict';

  /* ============================== 主题常量 ============================== */
  var THEME = {
    // 三段渐变天空
    sky:  ['#4dabee', '#9fd8f7', '#e3f6ff'],
    sun:  '#ffd93b',
    sunGlow: '#fff6c2',
    cloud: '#ffffff',

    // 草地（亮绿到深绿渐变）
    grassTop:  '#9adf63',
    grassBot:  '#63bb46',
    grassDark: '#4ea338',
    grassLight:'#c4ec8a',
    grassShadow:'rgba(60,120,50,.25)',

    // 土块（菱形砖）
    soilTop:  '#b57a45',
    soilBot:  '#8a5528',
    soilEdge: '#6d4422',
    soilHi:   '#d39a64',

    // 木屋/栅栏
    wood:      '#a9743a',
    woodDark:  '#6a4422',
    woodLight: '#e8b86f',
    woodShade: 'rgba(60,30,10,.30)',

    // 茅草屋
    barn:      '#c8402f',
    barnDark:  '#8f2a1e',
    barnTrim:  '#f1c16a',
    roofThatch:'#e8b86f',
    roofTile:  '#a55a3a',

    fence:     '#c98a4a',
    fenceLight:'#f6e3c4',

    // 皮肤 / 角色辅助
    skin:      '#ffd9b0',
    skinShade: '#f0b87a',

    // 远山/中景树林
    mountainFar:  '#7fb29b',
    mountainNear: '#5e9e6a',
    treeMidDark:  '#3f7a4d',
    treeMidMid:   '#58a361',

    // 水/涟漪
    water:      '#4fb3e8',
    waterDark:  '#2a86bd',
    waterHi:    '#bee7f7',

    // 五行色彩（用于 progress ring / glow 微调 / 灵植点缀）
    elColor: {
      mu:   '#6fd055',
      huo:  '#ff5a4d',
      tu:   '#e0b53c',
      jin:  '#f2d879',
      shui: '#4fb3e8'
    },

    // 散落小花
    flowerColors: ['#fff3a8', '#ff9a8a', '#cfe8ff', '#f5b8e0', '#ffc8c8']
  };

  /* ============================== 颜色工具 ============================== */
  function _toRgb(c) {
    if (typeof c !== 'string') return [0, 0, 0];
    c = c.trim();
    if (c.charAt(0) === '#') {
      var h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    var m = c.match(/rgba?\(([^)]+)\)/);
    if (m) {
      var p = m[1].split(',');
      return [parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2])];
    }
    return [0, 0, 0];
  }
  function _mix(a, b, k) {
    k = k < 0 ? 0 : (k > 1 ? 1 : k);
    var A = _toRgb(a), B = _toRgb(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * k) + ',' +
                    Math.round(A[1] + (B[1] - A[1]) * k) + ',' +
                    Math.round(A[2] + (B[2] - A[2]) * k) + ')';
  }
  function _rgba(c, a) {
    var r = _toRgb(c);
    return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + a + ')';
  }
  function _darken(c, k) { return _mix(c, '#000000', k); }
  function _lighten(c, k) { return _mix(c, '#ffffff', k); }

  /* ============================== 路径工具 ============================== */
  function roundRectPath(ctx, x, y, w, h, r) {
    if (typeof r !== 'number') r = 8;
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
  function _ellipse(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath();
    if (ctx.ellipse) ctx.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2);
    else {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0);
      ctx.scale(rx, ry); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore();
    }
  }
  // 简易伪随机（基于种子取 0-1）
  function _rand(seed) {
    var s = Math.sin(seed * 9301 + 49297) * 233280;
    return s - Math.floor(s);
  }

  /* ============================== 时辰 -> 天色 ============================== */
  // 简化为「白天为主」的明亮卡通风，只在边缘时段略暗
  function _skyForHour(hour) {
    if (typeof hour !== 'number' || isNaN(hour)) {
      var d = new Date();
      hour = d.getHours() + d.getMinutes() / 60;
    }
    hour = ((hour % 24) + 24) % 24;
    // 06-08 黄昏→白天，08-17 白天，17-19 白天→黄昏，19-20 黄昏
    var top, bot, night = 0;
    if (hour < 6)       { top = '#243a64'; bot = '#5e6ea6'; night = 0.45; }
    else if (hour < 8)  { var k = (hour - 6) / 2; top = _mix('#243a64', THEME.sky[0], k); bot = _mix('#5e6ea6', THEME.sky[1], k); night = 0.45 * (1 - k); }
    else if (hour < 17) { top = THEME.sky[0]; bot = THEME.sky[1]; night = 0; }
    else if (hour < 19) { var k2 = (hour - 17) / 2; top = _mix(THEME.sky[0], '#ffb37a', k2 * 0.7); bot = _mix(THEME.sky[1], '#ffd2a0', k2); night = 0; }
    else if (hour < 20) { top = '#ff9866'; bot = '#ffcfa0'; night = 0.15; }
    else                { top = '#243a64'; bot = '#5e6ea6'; night = 0.45; }
    return { top: top, bot: bot, night: night };
  }

  /* ============================== 单元素小图元 ============================== */
  // 尖顶球形树（QQ 农场经典树）：粗树干 + 圆球冠 + 顶部三角尖顶
  function _spireTree(ctx, cx, baseY, h, opts) {
    opts = opts || {};
    var trunkW = (opts.trunkW || 12) * (h / 90);
    var canopyW = h * 0.78; // 球冠加宽
    var ballCY = baseY - h * 0.42;   // 球冠中心
    var ballR = canopyW * 0.62;
    var tipY = ballCY - ballR * 0.95; // 三角尖顶底部（球冠上沿）
    // 树干（短粗）
    ctx.save();
    ctx.fillStyle = _darken(THEME.wood, 0.22);
    roundRectPath(ctx, cx - trunkW / 2, baseY - h * 0.20, trunkW, h * 0.20, 1.6);
    ctx.fill();
    ctx.fillStyle = _darken(THEME.wood, 0.40);
    ctx.fillRect(cx - trunkW / 2 + trunkW * 0.62, baseY - h * 0.20, trunkW * 0.38, h * 0.20);
    // 树根阴影
    ctx.fillStyle = _rgba('#1e2818', 0.30);
    ctx.beginPath(); ctx.ellipse(cx, baseY + 1.5, trunkW * 1.6, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 球冠（亮绿渐变）
    ctx.save();
    var grad = ctx.createRadialGradient(cx - ballR * 0.35, ballCY - ballR * 0.40, 2, cx, ballCY + ballR * 0.10, ballR * 1.05);
    grad.addColorStop(0, _lighten('#6fd055', 0.10));
    grad.addColorStop(0.55, '#5cb85a');
    grad.addColorStop(1, '#3f8c46');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, ballCY, ballR, 0, Math.PI * 2); ctx.fill();
    // 暗面（右下）
    ctx.fillStyle = _rgba('#2c6a35', 0.28);
    ctx.beginPath(); ctx.arc(cx + ballR * 0.18, ballCY + ballR * 0.20, ballR * 0.65, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 顶部三角尖顶（草绿）
    ctx.save();
    var tipBaseW = ballR * 0.55;
    var tipHeight = ballR * 0.55;
    ctx.fillStyle = '#56b04a';
    ctx.beginPath();
    ctx.moveTo(cx, ballCY - ballR - tipHeight * 0.10);
    ctx.quadraticCurveTo(cx + tipBaseW * 0.95, ballCY - ballR * 0.65, cx + tipBaseW * 0.55, ballCY - ballR * 0.10);
    ctx.lineTo(cx - tipBaseW * 0.55, ballCY - ballR * 0.10);
    ctx.quadraticCurveTo(cx - tipBaseW * 0.95, ballCY - ballR * 0.65, cx, ballCY - ballR - tipHeight * 0.10);
    ctx.closePath();
    ctx.fill();
    // 尖顶高光面
    ctx.fillStyle = _rgba('#ffffff', 0.28);
    ctx.beginPath();
    ctx.moveTo(cx, ballCY - ballR - tipHeight * 0.10);
    ctx.quadraticCurveTo(cx - tipBaseW * 0.30, ballCY - ballR * 0.70, cx - tipBaseW * 0.40, ballCY - ballR * 0.15);
    ctx.lineTo(cx - tipBaseW * 0.05, ballCY - ballR * 0.15);
    ctx.quadraticCurveTo(cx - tipBaseW * 0.10, ballCY - ballR * 0.70, cx, ballCY - ballR - tipHeight * 0.10);
    ctx.closePath();
    ctx.fill();
    // 球冠左上加几个小斑点（叶子群感）
    ctx.fillStyle = _rgba('#ffffff', 0.20);
    ctx.beginPath(); ctx.arc(cx - ballR * 0.40, ballCY - ballR * 0.45, ballR * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ballR * 0.05, ballCY - ballR * 0.25, ballR * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 圆形灌木丛（带小高光）
  function _roundBush(ctx, cx, baseY, w, h, col) {
    col = col || '#5cb85a';
    ctx.save();
    var grad = ctx.createRadialGradient(cx - w * 0.15, baseY - h * 0.55, 2, cx, baseY - h * 0.45, w * 0.7);
    grad.addColorStop(0, _lighten(col, 0.22));
    grad.addColorStop(1, _darken(col, 0.18));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, baseY - h * 0.50, w * 0.5, h * 0.50, 0, 0, Math.PI * 2);
    ctx.fill();
    // 暗面
    ctx.fillStyle = _rgba('#1f5028', 0.25);
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.10, baseY - h * 0.30, w * 0.35, h * 0.30, 0, 0, Math.PI * 2);
    ctx.fill();
    // 高光小圆
    ctx.fillStyle = _rgba('#ffffff', 0.30);
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.18, baseY - h * 0.65, w * 0.10, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 一朵小花（5 瓣）
  function _flower(ctx, cx, cy, s, col) {
    s = s || 4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = col;
    for (var i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i / 5) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.55, s * 0.42, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#fff8c4';
    ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 一朵胖云（3 圆组合）
  function _cloud(ctx, cx, cy, s, t) {
    s = s || 1;
    var bob = Math.sin((t || 0) / 1800 + cx * 0.013) * 1.6;
    cy += bob;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.beginPath();
    ctx.arc(cx - 14 * s, cy + 2 * s, 12 * s, 0, Math.PI * 2);
    ctx.arc(cx + 14 * s, cy + 2 * s, 11 * s, 0, Math.PI * 2);
    ctx.arc(cx,         cy - 6 * s, 14 * s, 0, Math.PI * 2);
    ctx.arc(cx - 6 * s, cy - 2 * s, 12 * s, 0, Math.PI * 2);
    ctx.arc(cx + 7 * s, cy - 1 * s, 12 * s, 0, Math.PI * 2);
    ctx.fill();
    // 阴影侧
    ctx.fillStyle = 'rgba(180,205,230,.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8 * s, 22 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 一颗远山（柔和三角）
  function _mountain(ctx, W, hz, amp, col, seed) {
    ctx.beginPath();
    var seg = Math.max(8, Math.round(W / 38));
    ctx.moveTo(0, hz + 4);
    for (var i = 0; i <= seg; i++) {
      var x = (i / seg) * W;
      var y = hz - (0.40 + 0.60 * Math.abs(Math.sin(i * 0.95 + seed))) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, hz + 4);
    ctx.lineTo(W, hz + 80);
    ctx.lineTo(0, hz + 80);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
  }

  // 一棵树的中景剪影（远景）
  function _treeSilhouette(ctx, cx, baseY, h, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - h * 0.10, baseY);
    ctx.lineTo(cx + h * 0.10, baseY);
    ctx.lineTo(cx + h * 0.05, baseY - h * 0.25);
    ctx.lineTo(cx + h * 0.18, baseY - h * 0.50);
    ctx.lineTo(cx + h * 0.06, baseY - h * 0.55);
    ctx.lineTo(cx + h * 0.16, baseY - h * 0.80);
    ctx.lineTo(cx,             baseY - h);
    ctx.lineTo(cx - h * 0.16, baseY - h * 0.80);
    ctx.lineTo(cx - h * 0.06, baseY - h * 0.55);
    ctx.lineTo(cx - h * 0.18, baseY - h * 0.50);
    ctx.lineTo(cx - h * 0.05, baseY - h * 0.25);
    ctx.closePath();
    ctx.fill();
  }

  // 茅草屋（带烟囱+冒烟+草顶+木墙+门+窗+花盆）
  function _thatchHouse(ctx, cx, baseY, w, h, t) {
    var bodyW = w, bodyH = h * 0.62;
    var bx = cx - bodyW / 2, by = baseY - bodyH;
    var roofH = h * 0.50;
    var roofY = by - roofH;
    ctx.save();
    // 屋身阴影
    ctx.fillStyle = _rgba('#1e2818', 0.18);
    ctx.beginPath(); ctx.ellipse(cx, baseY + 2, bodyW * 0.58, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 屋身（木墙）
    var wallGrad = ctx.createLinearGradient(bx, by, bx, baseY);
    wallGrad.addColorStop(0, _lighten(THEME.wood, 0.08));
    wallGrad.addColorStop(1, _darken(THEME.wood, 0.10));
    ctx.fillStyle = wallGrad;
    roundRectPath(ctx, bx, by, bodyW, bodyH, 4);
    ctx.fill();
    // 木墙纹路
    ctx.strokeStyle = _rgba('#5b3a14', 0.30);
    ctx.lineWidth = 1;
    for (var i = 1; i < 4; i++) {
      var ly = by + (bodyH / 4) * i;
      ctx.beginPath(); ctx.moveTo(bx + 2, ly); ctx.lineTo(bx + bodyW - 2, ly); ctx.stroke();
    }
    // 茅草顶（梯形+稻草纹理）
    ctx.fillStyle = THEME.roofThatch;
    ctx.beginPath();
    ctx.moveTo(bx - 8, by + 4);
    ctx.lineTo(cx, roofY);
    ctx.lineTo(bx + bodyW + 8, by + 4);
    ctx.lineTo(bx + bodyW + 4, by + 14);
    ctx.lineTo(bx - 4, by + 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = _rgba('#7a4a14', 0.35);
    ctx.lineWidth = 1.2;
    for (var j = 0; j < 6; j++) {
      var lx = bx + (bodyW / 6) * j;
      ctx.beginPath();
      ctx.moveTo(lx, roofY + 6);
      ctx.lineTo(lx + (j % 2 ? 2 : -2), by + 12);
      ctx.stroke();
    }
    // 屋顶尖饰
    ctx.fillStyle = _darken(THEME.wood, 0.25);
    ctx.beginPath(); ctx.arc(cx, roofY - 2, 3, 0, Math.PI * 2); ctx.fill();
    // 烟囱（右侧）
    var cxC = bx + bodyW * 0.78, cyC = roofY + roofH * 0.32;
    ctx.fillStyle = '#a87444';
    ctx.fillRect(cxC - 5, cyC, 10, 22);
    ctx.fillStyle = '#7a4a20';
    ctx.fillRect(cxC - 6, cyC - 2, 12, 4);
    // 烟（淡白圈）
    for (var k = 0; k < 3; k++) {
      var op = 0.55 - k * 0.16;
      var dr = k * 6;
      var dy = cyC - 14 - k * 16 - Math.sin((t || 0) / 1200 + k) * 1.5;
      var dx = cxC + Math.sin((t || 0) / 1100 + k * 0.8) * 1.5;
      ctx.fillStyle = _rgba('#ffffff', op);
      ctx.beginPath();
      ctx.arc(dx, dy, 6 + dr * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 门
    var doorW = bodyW * 0.22, doorH = bodyH * 0.62;
    var dx = cx - doorW / 2, dy = baseY - doorH;
    ctx.fillStyle = _darken(THEME.wood, 0.30);
    roundRectPath(ctx, dx, dy, doorW, doorH, 3);
    ctx.fill();
    ctx.strokeStyle = _rgba('#3a220a', 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    // 门把手
    ctx.fillStyle = THEME.barnTrim;
    ctx.beginPath(); ctx.arc(dx + doorW - 4, dy + doorH / 2, 1.6, 0, Math.PI * 2); ctx.fill();
    // 窗（左）
    var wW = bodyW * 0.16, wH = bodyH * 0.30;
    var wx1 = bx + bodyW * 0.14, wy1 = by + bodyH * 0.18;
    ctx.fillStyle = '#ffe89a';
    roundRectPath(ctx, wx1, wy1, wW, wH, 2);
    ctx.fill();
    ctx.strokeStyle = _darken(THEME.wood, 0.30);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx1 + wW / 2, wy1); ctx.lineTo(wx1 + wW / 2, wy1 + wH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx1, wy1 + wH / 2); ctx.lineTo(wx1 + wW, wy1 + wH / 2); ctx.stroke();
    // 窗（右）
    var wx2 = bx + bodyW * 0.86 - bodyW * 0.16;
    ctx.fillStyle = '#ffe89a';
    roundRectPath(ctx, wx2, wy1, wW, wH, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx2 + wW / 2, wy1); ctx.lineTo(wx2 + wW / 2, wy1 + wH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx2, wy1 + wH / 2); ctx.lineTo(wx2 + wW, wy1 + wH / 2); ctx.stroke();
    // 花盆（门前左）
    ctx.fillStyle = '#c66f3a';
    roundRectPath(ctx, bx + bodyW * 0.08, baseY - 9, 9, 9, 1.5);
    ctx.fill();
    ctx.fillStyle = '#e7505a';
    ctx.beginPath(); ctx.arc(bx + bodyW * 0.08 + 4.5, baseY - 12, 4.5, 0, Math.PI * 2); ctx.fill();
    // 花盆（门前右）
    ctx.fillStyle = '#c66f3a';
    roundRectPath(ctx, bx + bodyW * 0.92 - 9, baseY - 9, 9, 9, 1.5);
    ctx.fill();
    ctx.fillStyle = '#f7d452';
    ctx.beginPath(); ctx.arc(bx + bodyW * 0.92 - 4.5, baseY - 12, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 尖顶小木屋（带尖三角顶+红墙+门窗+窗）
  function _spireHouse(ctx, cx, baseY, w, h, t, accent) {
    accent = accent || THEME.barn;
    var bodyW = w * 0.92, bodyH = h * 0.60;
    var bx = cx - bodyW / 2, by = baseY - bodyH;
    var roofH = h * 0.58;
    var roofTip = by - roofH;
    ctx.save();
    // 阴影
    ctx.fillStyle = _rgba('#1e2818', 0.18);
    ctx.beginPath(); ctx.ellipse(cx, baseY + 2, bodyW * 0.58, 5, 0, 0, Math.PI * 2); ctx.fill();
    // 屋身
    var wallGrad = ctx.createLinearGradient(bx, by, bx, baseY);
    wallGrad.addColorStop(0, accent);
    wallGrad.addColorStop(1, _darken(accent, 0.22));
    ctx.fillStyle = wallGrad;
    roundRectPath(ctx, bx, by, bodyW, bodyH, 4);
    ctx.fill();
    // 木檐
    ctx.fillStyle = _darken(THEME.wood, 0.20);
    ctx.fillRect(bx - 4, by - 3, bodyW + 8, 5);
    // 尖顶（深色三角）
    var roofGrad = ctx.createLinearGradient(cx, roofTip, cx, by);
    roofGrad.addColorStop(0, _darken(accent, 0.45));
    roofGrad.addColorStop(1, _darken(accent, 0.20));
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(cx, roofTip);
    ctx.lineTo(bx - 8, by + 6);
    ctx.lineTo(bx + bodyW + 8, by + 6);
    ctx.closePath();
    ctx.fill();
    // 屋顶高光面（左）
    ctx.fillStyle = _rgba('#ffffff', 0.18);
    ctx.beginPath();
    ctx.moveTo(cx, roofTip);
    ctx.lineTo(cx + (bx + bodyW + 8 - cx) * 0.4, by + 6);
    ctx.lineTo(cx + (bx + bodyW + 8 - cx) * 0.4, by + 6);
    ctx.closePath();
    ctx.fill();
    // 顶旗杆
    ctx.fillStyle = _darken(THEME.wood, 0.30);
    ctx.fillRect(cx - 0.6, roofTip - 6, 1.2, 8);
    // 旗（小三角）
    ctx.fillStyle = '#f2d879';
    ctx.beginPath();
    ctx.moveTo(cx + 0.6, roofTip - 5);
    ctx.lineTo(cx + 7, roofTip - 2.5);
    ctx.lineTo(cx + 0.6, roofTip);
    ctx.closePath();
    ctx.fill();
    // 窗
    var wW = bodyW * 0.22, wH = bodyH * 0.34;
    var wx1 = bx + bodyW * 0.10, wy1 = by + bodyH * 0.10;
    ctx.fillStyle = '#ffe89a';
    roundRectPath(ctx, wx1, wy1, wW, wH, 2);
    ctx.fill();
    ctx.strokeStyle = _darken(accent, 0.30);
    ctx.lineWidth = 1.6;
    roundRectPath(ctx, wx1, wy1, wW, wH, 2);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx1 + wW / 2, wy1); ctx.lineTo(wx1 + wW / 2, wy1 + wH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx1, wy1 + wH / 2); ctx.lineTo(wx1 + wW, wy1 + wH / 2); ctx.stroke();
    // 窗（右）
    var wx2 = bx + bodyW - bodyW * 0.10 - wW;
    ctx.fillStyle = '#ffe89a';
    roundRectPath(ctx, wx2, wy1, wW, wH, 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx2 + wW / 2, wy1); ctx.lineTo(wx2 + wW / 2, wy1 + wH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx2, wy1 + wH / 2); ctx.lineTo(wx2 + wW, wy1 + wH / 2); ctx.stroke();
    // 门
    var doorW = bodyW * 0.20, doorH = bodyH * 0.60;
    var dx = cx - doorW / 2, dy = baseY - doorH;
    ctx.fillStyle = _darken(THEME.wood, 0.34);
    roundRectPath(ctx, dx, dy, doorW, doorH, 3);
    ctx.fill();
    ctx.strokeStyle = _rgba('#3a220a', 0.5);
    ctx.lineWidth = 1;
    roundRectPath(ctx, dx, dy, doorW, doorH, 3);
    ctx.stroke();
    // 门把手
    ctx.fillStyle = THEME.barnTrim;
    ctx.beginPath(); ctx.arc(dx + doorW - 3, dy + doorH / 2, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 小池塘（左下角，可选）
  function _pond(ctx, cx, cy, rx, ry, t) {
    ctx.save();
    var grad = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.2, 2, cx, cy, rx);
    grad.addColorStop(0, THEME.waterHi);
    grad.addColorStop(1, THEME.waterDark);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    // 水波纹
    ctx.strokeStyle = _rgba('#ffffff', 0.45);
    ctx.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      var off = ((t || 0) / 600 + i * 0.5) % 1;
      ctx.globalAlpha = 1 - off;
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry * 0.15, rx * (0.30 + off * 0.5), ry * (0.20 + off * 0.45), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 荷叶 1~2 片
    ctx.fillStyle = '#3f8f5a';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.35, cy - ry * 0.10, rx * 0.18, ry * 0.55, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#56a96a';
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.40, cy + ry * 0.20, rx * 0.14, ry * 0.42, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 栅栏（一段 2 立柱 + 横杆）
  function _fenceSeg(ctx, x1, x2, baseY, h) {
    var step = 18;
    h = h || 16;
    ctx.save();
    // 横杆
    ctx.fillStyle = _lighten(THEME.fence, 0.05);
    ctx.fillRect(x1, baseY - h * 0.55, x2 - x1, 2.5);
    ctx.fillRect(x1, baseY - h * 0.25, x2 - x1, 2.5);
    // 立柱
    ctx.fillStyle = THEME.fence;
    for (var x = x1; x <= x2; x += step) {
      roundRectPath(ctx, x - 2, baseY - h, 4, h, 1.2);
      ctx.fill();
      ctx.fillStyle = _lighten(THEME.fenceLight, 0.05);
      ctx.fillRect(x - 1, baseY - h + 1, 1.4, h - 2);
      ctx.fillStyle = THEME.fence;
    }
    ctx.restore();
  }

  // 稻草人
  function _scarecrow(ctx, cx, baseY, h, t) {
    h = h || 64;
    ctx.save();
    // 杆
    ctx.strokeStyle = '#7a4a1a';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - h * 0.05, baseY);
    ctx.lineTo(cx + h * 0.05, baseY - h);
    ctx.moveTo(cx - h * 0.45, baseY - h * 0.45);
    ctx.lineTo(cx + h * 0.45, baseY - h * 0.55);
    ctx.stroke();
    // 头（草帽+圆头）
    var hy = baseY - h * 0.78;
    ctx.fillStyle = THEME.skinShade;
    ctx.beginPath(); ctx.arc(cx, hy, h * 0.10, 0, Math.PI * 2); ctx.fill();
    // 眼睛 + 嘴
    ctx.fillStyle = '#3a220a';
    ctx.beginPath();
    ctx.arc(cx - h * 0.04, hy - h * 0.01, 1, 0, Math.PI * 2);
    ctx.arc(cx + h * 0.04, hy - h * 0.01, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a220a';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, hy + h * 0.03, h * 0.04, 0, Math.PI); ctx.stroke();
    // 草帽
    ctx.fillStyle = THEME.roofThatch;
    ctx.beginPath(); ctx.ellipse(cx, hy - h * 0.05, h * 0.30, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = _darken(THEME.roofThatch, 0.18);
    ctx.beginPath();
    ctx.moveTo(cx - h * 0.16, hy - h * 0.05);
    ctx.lineTo(cx, hy - h * 0.30);
    ctx.lineTo(cx + h * 0.16, hy - h * 0.05);
    ctx.closePath();
    ctx.fill();
    // 身体（稻草捆）
    ctx.fillStyle = '#d8a85c';
    ctx.beginPath(); ctx.ellipse(cx, baseY - h * 0.40, h * 0.10, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* =======================================================================
   *  drawFarm —— QQ 农场背景（v5）
   *  地平线约 30%；上方天空+远山+树林带+屋群；下方整片绿地（田块是绿地里的浅色格）
   *  屋在田后、池塘在左前、鹅卵石小路蜿蜒、散落小花
   * =====================================================================*/
  function drawFarm(ctx, W, H, t, hour) {
    t = t || 0;
    var s = _skyForHour(hour);
    var hz = H * 0.30;                       // 地平线

    // ---- 天空 ----
    var skyG = ctx.createLinearGradient(0, 0, 0, hz + 12);
    skyG.addColorStop(0, s.top);
    skyG.addColorStop(1, s.bot);
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, hz + 12);

    // ---- 太阳 ----
    var sunX = W * 0.80, sunY = hz * 0.40, sunR = Math.min(W, H) * 0.052;
    var halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.5, sunX, sunY, sunR * 3.2);
    halo.addColorStop(0, _rgba(THEME.sunGlow, 0.60));
    halo.addColorStop(1, _rgba(THEME.sunGlow, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = THEME.sun; ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = _rgba('#ffffff', 0.5);
    ctx.beginPath(); ctx.arc(sunX - sunR * 0.30, sunY - sunR * 0.30, sunR * 0.30, 0, Math.PI * 2); ctx.fill();

    // ---- 云 ----
    _cloud(ctx, W * 0.22, hz * 0.34, 1.00, t);
    _cloud(ctx, W * 0.56, hz * 0.16, 0.82, t);
    _cloud(ctx, W * 0.10, hz * 0.62, 0.70, t);

    // ---- 远山（两层）----
    _mountain(ctx, W, hz + 2, H * 0.085, THEME.mountainFar, 0.6);
    _mountain(ctx, W, hz + 8, H * 0.060, THEME.mountainNear, 2.4);

    // ---- 中景树林带 ----
    for (var mi = 0; mi < 20; mi++) {
      var mxx = (mi + 0.5) * (W / 20) + Math.sin(mi * 2.1) * 3;
      var mhh = 11 + Math.abs(Math.sin(mi * 1.7)) * 12;
      _treeSilhouette(ctx, mxx, hz + 6, mhh, mi % 2 ? THEME.treeMidDark : THEME.treeMidMid);
    }

    // ---- 草地（地平线以下整片绿）----
    var gG = ctx.createLinearGradient(0, hz, 0, H);
    gG.addColorStop(0, THEME.grassTop);
    gG.addColorStop(0.45, THEME.grassBot);
    gG.addColorStop(1, THEME.grassDark);
    ctx.fillStyle = gG;
    ctx.fillRect(0, hz, W, H - hz);
    // 草簇纹理
    ctx.save();
    ctx.strokeStyle = _rgba(THEME.grassDark, 0.30);
    ctx.lineWidth = 1;
    for (var gi = 0; gi < 80; gi++) {
      var gx = _rand(gi * 7.13 + 11) * W;
      var gy2 = hz + 22 + _rand(gi * 3.71 + 5) * (H - hz - 34);
      var gh = 3 + _rand(gi * 1.91 + 3) * 3.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy2);
      ctx.lineTo(gx + (_rand(gi * 0.71 + 7) - 0.5) * 2, gy2 - gh);
      ctx.stroke();
    }
    ctx.restore();

    // ---- 屋群（田后方，贴地平线；不与田块 y=0.38~0.56 重叠）----
    _thatchHouse(ctx, W * 0.18, hz + H * 0.030, W * 0.30, H * 0.105, t);   // 大茅草屋在左
    _spireHouse(ctx, W * 0.62, hz + H * 0.015, W * 0.20, H * 0.095, t, '#d27540'); // 尖顶木屋在中右

    // ---- 背景树（错落，靠地平线一带；x 与田块错开）----
    _spireTree(ctx, W * 0.045, hz + H * 0.020, H * 0.105);   // 最左
    _spireTree(ctx, W * 0.96,  hz + H * 0.030, H * 0.110);   // 最右
    _spireTree(ctx, W * 0.50,  hz + H * 0.020, H * 0.085);   // 屋前中
    _spireTree(ctx, W * 0.42,  hz + H * 0.075, H * 0.090);   // 田左后

    // ---- 鹅卵石小路（屋前右下，避开田块 x=0.225~0.775 y=0.38~0.56）----
    ctx.save();
    for (var si = 0; si < 22; si++) {
      var sf = si / 21;
      var sx = W * (0.92 - sf * 0.18) + Math.sin(sf * 3.0) * W * 0.045;
      var sy = hz + H * (0.18 + sf * 0.78);
      var sw = 7 + sf * 5, sh = sw * 0.55;
      ctx.fillStyle = _rgba('#e7d6b3', 0.92);
      ctx.beginPath(); ctx.ellipse(sx, sy, sw, sh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = _rgba('#c9b58a', 0.9);
      ctx.beginPath(); ctx.ellipse(sx, sy + sh * 0.35, sw * 0.82, sh * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = _rgba('#7a5a30', 0.28); ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(sx, sy, sw, sh, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();

    // ---- 池塘（左前方，但避开田块 x=0.225~0.775；放到更左下一点）----
    _pond(ctx, W * 0.11, hz + H * 0.34, W * 0.085, H * 0.030, t);

    // ---- 散落小花（散布在草地各处，避开田块核心区）----
    var flowers = [
      { x: W * 0.04,  y: hz + H * 0.40, s: 3.4, c: THEME.flowerColors[0] },
      { x: W * 0.93,  y: hz + H * 0.42, s: 3.6, c: THEME.flowerColors[1] },
      { x: W * 0.10,  y: hz + H * 0.78, s: 3.4, c: THEME.flowerColors[2] },
      { x: W * 0.93,  y: hz + H * 0.78, s: 3.6, c: THEME.flowerColors[3] },
      { x: W * 0.04,  y: hz + H * 0.20, s: 3.2, c: THEME.flowerColors[0] },
      { x: W * 0.95,  y: hz + H * 0.18, s: 3.4, c: THEME.flowerColors[4] }
    ];
    for (var fi = 0; fi < flowers.length; fi++) {
      _flower(ctx, flowers[fi].x, flowers[fi].y, flowers[fi].s, flowers[fi].c);
    }

    // ---- 稻草人（田的左下/右下外侧）----
    _scarecrow(ctx, W * 0.04, hz + H * 0.46, H * 0.10, t);
  }

  /* =======================================================================
   *  drawPlot —— v5 绿草地块（QQ 农场：田是绿地里的浅绿格）
   *  3D 抬高感：底面深绿侧壁 + 顶面亮绿渐变；中央有浅土种植穴
   *  locked：灰绿；empty：浅色 + 淡「＋」提示
   * =====================================================================*/
  function drawPlot(ctx, x, y, w, h, plot, t) {
    var pl = plot || {};
    var st = pl.state || (pl.locked ? 'locked' : 'empty');
    var locked = (st === 'locked');
    var empty = (st === 'empty' || !st);
    var selected = !!(pl.selected || pl.sel);
    var r = Math.min(w, h) * 0.18;

    // ---- 3D 侧壁（下沿）----
    ctx.save();
    roundRectPath(ctx, x, y + 4, w, h - 4, r);
    ctx.fillStyle = locked ? '#8a8f78' : '#4a9633';
    ctx.fill();
    ctx.restore();

    // ---- 顶面 ----
    ctx.save();
    roundRectPath(ctx, x, y, w, h - 5, r);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (locked) {
      g.addColorStop(0, '#bcbfa8');
      g.addColorStop(1, '#9a9d86');
    } else {
      g.addColorStop(0, '#aae06d');
      g.addColorStop(0.55, '#8ccf57');
      g.addColorStop(1, '#72bb43');
    }
    ctx.fillStyle = g;
    ctx.fill();
    // 高光（顶面左上）
    ctx.save();
    roundRectPath(ctx, x, y, w, h - 5, r);
    ctx.clip();
    var hi = ctx.createLinearGradient(0, y, 0, y + h * 0.42);
    hi.addColorStop(0, _rgba('#ffffff', locked ? 0.18 : 0.34));
    hi.addColorStop(1, _rgba('#ffffff', 0));
    ctx.fillStyle = hi;
    ctx.fillRect(x, y, w, h * 0.42);
    ctx.restore();
    ctx.restore();

    // ---- 边框 ----
    ctx.save();
    roundRectPath(ctx, x + 0.5, y + 0.5, w - 1, h - 5, r);
    ctx.lineWidth = selected ? 2.6 : 1.4;
    if (selected) {
      ctx.strokeStyle = '#fff6c2';
      ctx.shadowColor = 'rgba(255,217,59,.72)';
      ctx.shadowBlur = 11;
    } else {
      ctx.strokeStyle = _rgba(locked ? '#6b6f58' : '#4e8a34', 0.80);
    }
    ctx.stroke();
    ctx.restore();

    // ---- 中央种植穴（浅土圈，植物落脚）----
    if (!locked && !empty) {
      ctx.save();
      var ccx = x + w / 2, ccy = y + (h - 5) * 0.60, crr = Math.min(w, h) * 0.32;
      var hg = ctx.createRadialGradient(ccx, ccy, 2, ccx, ccy, crr);
      hg.addColorStop(0, _rgba('#7a4a1e', 0.28));
      hg.addColorStop(1, _rgba('#7a4a1e', 0));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.ellipse(ccx, ccy, crr, crr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // ---- 空格：淡「＋」提示 ----
    if (empty) {
      var ex = x + w / 2, ey = y + (h - 5) / 2;
      var er = Math.min(w, h) * 0.16;
      ctx.save();
      ctx.strokeStyle = _rgba('#ffffff', 0.70);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - er, ey); ctx.lineTo(ex + er, ey);
      ctx.moveTo(ex, ey - er); ctx.lineTo(ex, ey + er);
      ctx.stroke();
      ctx.restore();
    }

    // ---- 锁格：金黄小锁 ----
    if (locked) {
      var lcx = x + w / 2, lcy = y + (h - 5) / 2;
      var lr = Math.min(w, h) * 0.20;
      ctx.save();
      ctx.fillStyle = _rgba('#000000', 0.16);
      ctx.beginPath(); ctx.arc(lcx + 1, lcy + 1.5, lr * 0.95, 0, Math.PI * 2); ctx.fill();
      var lkG = ctx.createLinearGradient(lcx, lcy - lr, lcx, lcy + lr);
      lkG.addColorStop(0, '#fff3a8');
      lkG.addColorStop(1, '#c98a4a');
      ctx.fillStyle = lkG;
      roundRectPath(ctx, lcx - lr * 0.62, lcy - lr * 0.12, lr * 1.24, lr * 0.92, lr * 0.18);
      ctx.fill();
      ctx.strokeStyle = _rgba('#5b3a14', 0.65);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#5b3a14';
      ctx.beginPath(); ctx.arc(lcx, lcy + lr * 0.10, lr * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(lcx - lr * 0.04, lcy + lr * 0.10, lr * 0.08, lr * 0.28);
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = lr * 0.16;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(lcx, lcy - lr * 0.26, lr * 0.40, Math.PI, 0); ctx.stroke();
      ctx.restore();
    }
  }

  /* =======================================================================
   *  drawPlant —— 真实蔬菜造型（参考图风格）
   *  木=嫩苗 / 火=红番茄 / 土=粟谷穗 / 金=金麦穗 / 水=荷叶+粉莲
   *  阶段：seedling（嫩苗）/ growing（长大）/ ripe（成熟带微光）
   * =====================================================================*/
  function _stageScale(stage) { return stage === 'seedling' ? 0.52 : (stage === 'growing' ? 0.80 : 1.0); }

  // 通用：土堆阴影
  function _mound(ctx, cx, cy, rx) {
    ctx.save();
    ctx.fillStyle = _rgba('#3b2710', 0.30);
    _ellipse(ctx, cx, cy, rx, rx * 0.32, 0);
    ctx.fill();
    ctx.restore();
  }

  // ---- 木 · 嫩绿小苗（双叶） ----
  function _plantMu(ctx, cx, cy, stage, prog, t, ripe) {
    var s = _stageScale(stage);
    var base = cy + 14;
    _mound(ctx, cx, base, 18 * s);
    // 茎
    ctx.strokeStyle = '#3f9c46';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    var topY = base - 32 * s;
    ctx.beginPath();
    ctx.moveTo(cx, base);
    ctx.quadraticCurveTo(cx + 3 * s, (base + topY) / 2, cx, topY);
    ctx.stroke();
    // 双叶
    var leafCols = ['#5cb85a', '#6fd055', '#84dc66'];
    var pairs = stage === 'seedling' ? 1 : (stage === 'growing' ? 2 : 3);
    for (var i = 0; i < pairs; i++) {
      var f = (i + 1) / (pairs + 0.6);
      var y = base - (base - topY) * f * 0.92;
      var len = (16 - i * 2.0) * s;
      var wid = (10 - i * 1.2) * s;
      _leafShape(ctx, cx, y, -1.0, len, wid, leafCols[i % 3]);
      _leafShape(ctx, cx, y,  1.0, len, wid, leafCols[(i + 1) % 3]);
    }
    // 顶部嫩芽
    if (ripe) {
      ctx.fillStyle = '#ff6e6e';
      ctx.beginPath(); ctx.arc(cx, topY - 2 * s, 2.4 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  function _leafShape(ctx, x, y, ang, len, wid, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, -len * 0.45, 0, -len);
    ctx.quadraticCurveTo(-wid, -len * 0.45, 0, 0);
    ctx.closePath();
    ctx.fill();
    // 叶脉
    ctx.strokeStyle = _rgba('#2c6a35', 0.50);
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(0, -len * 0.06); ctx.lineTo(0, -len * 0.92); ctx.stroke();
    ctx.restore();
  }

  // ---- 火 · 红番茄（圆胖带蒂+叶+可选笑脸） ----
  function _plantHuo(ctx, cx, cy, stage, prog, t, ripe) {
    var s = _stageScale(stage);
    var base = cy + 14;
    _mound(ctx, cx, base, 22 * s);
    // 茎
    ctx.strokeStyle = '#3f6b35';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    var stemTop = base - 14 * s;
    ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, stemTop); ctx.stroke();
    // 叶子（3 瓣五角）
    var leafY = base - 9 * s;
    for (var i = -1; i <= 1; i++) {
      var a = i * 1.05;
      ctx.save();
      ctx.translate(cx, leafY);
      ctx.rotate(a);
      ctx.fillStyle = '#5cb85a';
      ctx.beginPath();
      ctx.ellipse(0, -7 * s, 4.5 * s, 9 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 番茄（圆胖）
    var fruitR = 14 * s;
    var fcx = cx, fcy = stemTop - 4 * s;
    // 番茄阴影底
    var fG = ctx.createRadialGradient(fcx - fruitR * 0.30, fcy - fruitR * 0.40, fruitR * 0.10, fcx, fcy + fruitR * 0.10, fruitR * 1.05);
    fG.addColorStop(0, '#ff7a6e');
    fG.addColorStop(0.5, '#ff5a4d');
    fG.addColorStop(1, '#c8372a');
    ctx.fillStyle = fG;
    ctx.beginPath();
    // 略压扁的圆（番茄胖）
    ctx.ellipse(fcx, fcy + fruitR * 0.10, fruitR, fruitR * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    // 顶部小蒂（深绿）
    ctx.fillStyle = '#2f6a30';
    ctx.beginPath();
    ctx.moveTo(fcx - 5 * s, fcy - fruitR * 0.85);
    ctx.lineTo(fcx + 5 * s, fcy - fruitR * 0.85);
    ctx.lineTo(fcx + 2 * s, fcy - fruitR * 0.50);
    ctx.lineTo(fcx - 2 * s, fcy - fruitR * 0.50);
    ctx.closePath();
    ctx.fill();
    // 高光
    ctx.fillStyle = _rgba('#ffffff', 0.55);
    ctx.beginPath();
    ctx.ellipse(fcx - fruitR * 0.35, fcy - fruitR * 0.30, fruitR * 0.30, fruitR * 0.20, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 笑脸（ripe 阶段更萌）
    if (ripe) {
      ctx.fillStyle = '#3a1010';
      ctx.beginPath();
      ctx.arc(fcx - fruitR * 0.30, fcy - fruitR * 0.10, 1.2 * s, 0, Math.PI * 2);
      ctx.arc(fcx + fruitR * 0.30, fcy - fruitR * 0.10, 1.2 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a1010';
      ctx.lineWidth = 1.4 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(fcx, fcy + fruitR * 0.10, fruitR * 0.30, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (stage === 'growing') {
      // 小绿番茄（未熟）
      ctx.fillStyle = '#7ab85a';
      ctx.beginPath();
      ctx.ellipse(fcx, fcy + fruitR * 0.10, fruitR * 0.85, fruitR * 0.80, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = _rgba('#ffffff', 0.40);
      ctx.beginPath();
      ctx.ellipse(fcx - fruitR * 0.30, fcy - fruitR * 0.30, fruitR * 0.22, fruitR * 0.16, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- 土 · 黄粟谷穗 ----
  function _plantTu(ctx, cx, cy, stage, prog, t, ripe) {
    var s = _stageScale(stage);
    var base = cy + 14;
    _mound(ctx, cx, base, 22 * s);
    // 茎（中线）
    ctx.strokeStyle = ripe ? '#a98c40' : '#7fae4e';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    var top = base - 46 * s;
    ctx.beginPath(); ctx.moveTo(cx, base); ctx.lineTo(cx, top + 6 * s); ctx.stroke();
    // 两侧叶片（细长）
    ctx.strokeStyle = '#6f9a45';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(cx, base - 6 * s);
    ctx.quadraticCurveTo(cx - 16 * s, base - 26 * s, cx - 20 * s, base - 40 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, base - 10 * s);
    ctx.quadraticCurveTo(cx + 16 * s, base - 28 * s, cx + 20 * s, base - 42 * s);
    ctx.stroke();
    // 谷粒（沿垂弧）
    var n = stage === 'seedling' ? 0 : (stage === 'growing' ? 5 : 11);
    var col = ripe ? '#e8c25a' : '#bcc56b';
    var colDark = ripe ? '#a07a3a' : '#8aa44e';
    for (var i = 0; i < n; i++) {
      var f = n === 1 ? 0 : i / (n - 1);
      var gx = cx + Math.sin(f * Math.PI) * 3 * s + (f - 0.5) * 1.6 * s;
      var gy = top + 8 * s + (18 * s) * f;
      ctx.fillStyle = col;
      _ellipse(ctx, gx, gy, 2.6 * s, 4.0 * s, 0);
      ctx.fill();
      ctx.strokeStyle = _rgba(colDark, 0.7);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 2.4 * s);
      ctx.lineTo(gx + (f < 0.5 ? -3 : 3) * s, gy - 8 * s);
      ctx.stroke();
    }
    // 顶部穗头
    ctx.fillStyle = ripe ? '#e8c25a' : '#bcc56b';
    _ellipse(ctx, cx, top + 4 * s, 2.8 * s, 5.2 * s, 0);
    ctx.fill();
    // 刺芒
    ctx.strokeStyle = ripe ? '#a07a3a' : '#7a9a44';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, top - 12 * s);
    ctx.moveTo(cx, top + 4 * s);
    ctx.lineTo(cx - 8 * s, top - 6 * s);
    ctx.moveTo(cx, top + 4 * s);
    ctx.lineTo(cx + 8 * s, top - 6 * s);
    ctx.stroke();
  }

  // ---- 金 · 金黄麦穗（3 束向外弯） ----
  function _plantJin(ctx, cx, cy, stage, prog, t, ripe) {
    var s = _stageScale(stage);
    var base = cy + 14;
    _mound(ctx, cx, base, 24 * s);
    var col = ripe ? '#f2d879' : '#a9bd6e';
    var stem = ripe ? '#c9b45e' : '#6f9a45';
    var dirs = [-1, 0, 1];
    for (var k = 0; k < 3; k++) {
      var dir = dirs[k];
      var hgt = (42 + (k === 1 ? 4 : 0)) * s;
      var tipx = cx + dir * 14 * s, tipy = base - hgt;
      ctx.strokeStyle = stem;
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, base);
      ctx.quadraticCurveTo(cx + dir * 5 * s, base - hgt * 0.6, tipx, tipy);
      ctx.stroke();
      var n = stage === 'seedling' ? 0 : (stage === 'growing' ? 4 : 7);
      for (var i = 0; i < n; i++) {
        var f2 = (i + 1) / n;
        var rx = (1 - f2) * (1 - f2) * cx + 2 * (1 - f2) * f2 * (cx + dir * 5 * s) + f2 * f2 * tipx;
        var ry = (1 - f2) * (1 - f2) * base + 2 * (1 - f2) * f2 * (base - hgt * 0.6) + f2 * f2 * tipy;
        ctx.fillStyle = col;
        _ellipse(ctx, rx, ry, 1.8 * s, 3.2 * s, dir * 0.25);
        ctx.fill();
        // 麦芒
        ctx.strokeStyle = _rgba(stem, 0.7);
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(rx, ry - 3 * s);
        ctx.lineTo(rx + dir * 2 * s, ry - 7 * s);
        ctx.stroke();
      }
    }
  }

  // ---- 水 · 荷叶 + 粉莲 ----
  function _lotusPad(ctx, x, y, r, col) {
    ctx.save();
    col = col || '#3f8f5a';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0.30 * Math.PI, 2.70 * Math.PI);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
    // 径向叶脉
    ctx.strokeStyle = _rgba('#1f5230', 0.45);
    ctx.lineWidth = 0.8;
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(1.5 * Math.PI + i * 0.5) * r, y + Math.sin(1.5 * Math.PI + i * 0.5) * r * 0.8);
      ctx.stroke();
    }
    // 高光
    ctx.fillStyle = _rgba('#ffffff', 0.20);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.30, y - r * 0.10, r * 0.45, r * 0.10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function _lotusBloom(ctx, x, y, r, col) {
    col = col || '#f5b8e0';
    ctx.save();
    // 花瓣（6 片外层）
    for (var i = 0; i < 6; i++) {
      var ang = Math.PI + (i - 2.5) * 0.42;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = i % 2 ? _lighten(col, 0.16) : col;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.85, -r * 1.10, 0, -r * 2.00);
      ctx.quadraticCurveTo(-r * 0.85, -r * 1.10, 0, 0);
      ctx.closePath();
      ctx.fill();
      // 瓣尖高光
      ctx.fillStyle = _rgba('#ffffff', 0.30);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.30, -r * 0.80, 0, -r * 1.70);
      ctx.quadraticCurveTo(-r * 0.10, -r * 0.80, 0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // 花心（嫩黄）
    ctx.fillStyle = '#f7d452';
    ctx.beginPath();
    ctx.arc(x, y - r * 0.30, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = _rgba('#ffffff', 0.40);
    ctx.beginPath();
    ctx.arc(x - r * 0.10, y - r * 0.40, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function _lotusBud(ctx, x, y, r, col) {
    col = col || '#e8a0b8';
    ctx.save();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.70);
    ctx.quadraticCurveTo(x + r * 1.05, y - r * 0.50, x + r * 0.50, y + r * 0.35);
    ctx.quadraticCurveTo(x, y + r * 0.60, x - r * 0.50, y + r * 0.35);
    ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.50, x, y - r * 1.70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = _rgba('#ffffff', 0.30);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.20, y - r * 0.50, r * 0.20, r * 0.70, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function _plantShui(ctx, cx, cy, stage, prog, t, ripe) {
    var s = _stageScale(stage);
    var base = cy + 14;
    // 水波（浅蓝填充+深蓝边）
    ctx.save();
    for (var i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.85 - i * 0.20;
      ctx.fillStyle = _rgba(THEME.elColor.shui, 0.18 - i * 0.05);
      _ellipse(ctx, cx, base, (16 + i * 9) * s, (16 + i * 9) * s * 0.34, 0);
      ctx.fill();
      ctx.strokeStyle = _rgba(THEME.elColor.shui, 0.65);
      ctx.lineWidth = 1.2;
      _ellipse(ctx, cx, base, (16 + i * 9) * s, (16 + i * 9) * s * 0.34, 0);
      ctx.stroke();
    }
    ctx.restore();
    // 荷叶（2 片）
    var padScale = ripe ? 1.20 : 1.0;
    _lotusPad(ctx, cx - 14 * s, base - 2, 13 * s * padScale, '#3f8f5a');
    _lotusPad(ctx, cx + 14 * s, base - 2, 13 * s * padScale, '#56a96a');
    // 花
    if (ripe) _lotusBloom(ctx, cx, base - 30 * s, 10 * s, '#f5b8e0');
    else if (stage === 'growing') _lotusBud(ctx, cx, base - 22 * s, 8 * s, '#e8a0b8');
    else _lotusBud(ctx, cx, base - 10 * s, 5 * s, '#cfe0ef');
  }

  var _ELEM = { mu: _plantMu, huo: _plantHuo, tu: _plantTu, jin: _plantJin, shui: _plantShui };

  /* =======================================================================
   *  drawGlow —— 金色呼吸光晕（弱化版，仅 ripe 时由 drawPlant 内部调用）
   * =====================================================================*/
  function drawGlow(ctx, cx, cy, r, t) {
    t = t || 0;
    var pulse = 0.55 + 0.45 * Math.sin(t / 360);
    ctx.save();
    var g = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
    g.addColorStop(0, _rgba(THEME.sunGlow, 0.30 * pulse + 0.08));
    g.addColorStop(0.55, _rgba(THEME.sun, 0.14 * pulse));
    g.addColorStop(1, _rgba(THEME.sun, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // 旋转金色微粒（数量减少 + 半径更小）
    for (var i = 0; i < 4; i++) {
      var ang = t / 800 + i * (Math.PI * 2 / 4);
      var sx = cx + Math.cos(ang) * r * 0.72;
      var sy = cy + Math.sin(ang) * r * 0.72;
      ctx.globalAlpha = 0.20 + 0.40 * Math.abs(Math.sin(t / 600 + i));
      ctx.fillStyle = THEME.sunGlow;
      ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* =======================================================================
   *  drawPlant —— 入口
   * =====================================================================*/
  function drawPlant(ctx, cx, cy, plot, t) {
    if (!plot) return;
    var st = plot.state;
    if (!st || st === 'empty' || st === 'locked') return;
    t = t || 0;
    var el = plot.element || 'mu';
    var prog = plot.progress == null ? 1 : plot.progress;
    prog = prog < 0 ? 0 : (prog > 1 ? 1 : prog);
    var ripe = (st === 'ripe' || plot.ripe === true || (st !== 'growing' && prog >= 1));
    var stage = ripe ? 'ripe' : (prog < 0.34 ? 'seedling' : 'growing');

    if (ripe) drawGlow(ctx, cx, cy - 6, 32, t);

    ctx.save();
    var fn = _ELEM[el] || _ELEM.mu;
    fn(ctx, cx, cy, stage, prog, t, ripe);
    ctx.restore();
  }

  /* =======================================================================
   *  drawProgressRing —— 进度环（保留 v3）
   * =====================================================================*/
  function drawProgressRing(ctx, cx, cy, r, progress, t) {
    t = t || 0;
    progress = progress == null ? 0 : (progress < 0 ? 0 : (progress > 1 ? 1 : progress));
    ctx.save();
    ctx.lineCap = 'round';
    // 环底
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = _rgba('#3b2710', 0.35); ctx.lineWidth = 3.2; ctx.stroke();
    // 进度弧
    var a0 = -Math.PI / 2;
    var a1 = a0 + Math.PI * 2 * progress;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1);
    ctx.strokeStyle = THEME.sun; ctx.lineWidth = 4;
    ctx.shadowColor = _rgba(THEME.sun, 0.65); ctx.shadowBlur = 6;
    ctx.stroke();
    // 端点
    if (progress > 0.01) {
      var hx = cx + Math.cos(a1) * r;
      var hy = cy + Math.sin(a1) * r;
      ctx.shadowBlur = 0;
      ctx.fillStyle = THEME.sunGlow;
      ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* =======================================================================
   *  drawHUD —— 顶部金棕圆角头像卡 + 右侧金币/钻石条
   *  state = { me: { name, exp, level, maxExp, avatar? }, coins, diamonds }
   *  state 可选（缺失则用默认示例数据）
   * =====================================================================*/
  function drawHUD(ctx, W, H, state, t) {
    t = t || 0;
    state = state || {};
    var me = state.me || {};
    var name = me.name || '小小农夫';
    var level = me.level != null ? me.level : 1;
    var exp = me.exp || 0;
    var maxExp = me.maxExp || 100;
    var coins = state.coins != null ? state.coins : 10000;
    var diamonds = state.diamonds != null ? state.diamonds : 0;
    var avatar = me.avatar; // 可选：图片/canvas 等
    var avatarColor = me.avatarColor || '#ffd9b0';

    // 顶部安全边距（按 W 缩放）
    var padX = Math.max(8, Math.round(W * 0.025));
    var topY = Math.max(6, Math.round(H * 0.012));

    /* --- 头像卡（左上） --- */
    var cardH = Math.max(40, Math.round(W * 0.16));
    var cardW = W * 0.62;
    var cardX = padX;
    var cardY = topY;
    var cardR = cardH * 0.42;

    ctx.save();
    // 阴影
    ctx.fillStyle = _rgba('#3b2710', 0.20);
    roundRectPath(ctx, cardX + 1, cardY + 2, cardW, cardH, cardR);
    ctx.fill();
    // 卡片底（金棕渐变）
    var cardG = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    cardG.addColorStop(0, _lighten(THEME.woodLight, 0.05));
    cardG.addColorStop(0.5, THEME.wood);
    cardG.addColorStop(1, _darken(THEME.wood, 0.12));
    ctx.fillStyle = cardG;
    roundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    // 边框
    ctx.strokeStyle = _darken(THEME.wood, 0.34);
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.stroke();
    // 顶部高光
    ctx.beginPath();
    roundRectPath(ctx, cardX + 2, cardY + 1, cardW - 4, cardH * 0.45, cardR - 1);
    ctx.clip();
    var hi = ctx.createLinearGradient(0, cardY, 0, cardY + cardH * 0.45);
    hi.addColorStop(0, _rgba('#ffffff', 0.30));
    hi.addColorStop(1, _rgba('#ffffff', 0));
    ctx.fillStyle = hi;
    ctx.fillRect(cardX, cardY, cardW, cardH * 0.45);
    ctx.restore();

    // 头像圆
    var avR = cardH * 0.34;
    var avCx = cardX + cardR + avR * 0.4;
    var avCy = cardY + cardH * 0.5;
    ctx.save();
    // 头像底
    var avBgG = ctx.createRadialGradient(avCx - avR * 0.30, avCy - avR * 0.40, 1, avCx, avCy, avR);
    avBgG.addColorStop(0, _lighten(THEME.barnTrim, 0.10));
    avBgG.addColorStop(1, THEME.wood);
    ctx.fillStyle = avBgG;
    ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2); ctx.fill();
    // 头像边框
    ctx.strokeStyle = _darken(THEME.wood, 0.30);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(avCx, avCy, avR, 0, Math.PI * 2); ctx.stroke();
    // 头像内容
    if (avatar && typeof avatar === 'object' && (avatar.tagName === 'CANVAS' || avatar.tagName === 'IMG')) {
      ctx.save();
      ctx.beginPath(); ctx.arc(avCx, avCy, avR - 1, 0, Math.PI * 2); ctx.clip();
      try {
        ctx.drawImage(avatar, avCx - avR, avCy - avR, avR * 2, avR * 2);
      } catch (e) {
        _avatarFallback(ctx, avCx, avCy, avR, avatarColor);
      }
      ctx.restore();
    } else {
      _avatarFallback(ctx, avCx, avCy, avR, avatarColor);
    }
    ctx.restore();

    // 名字 + 等级文字
    ctx.save();
    var textX = avCx + avR + 6;
    ctx.fillStyle = '#fff8e8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '700 ' + Math.round(cardH * 0.30) + 'px -apple-system, PingFang SC, sans-serif';
    ctx.fillText(name, textX, cardY + cardH * 0.16);

    // 经验条
    var expBarX = textX;
    var expBarY = cardY + cardH * 0.58;
    var expBarW = cardW - (expBarX - cardX) - 8;
    var expBarH = Math.max(5, cardH * 0.14);
    // 底
    ctx.fillStyle = _rgba('#3b2710', 0.55);
    roundRectPath(ctx, expBarX, expBarY, expBarW, expBarH, expBarH / 2);
    ctx.fill();
    // 进度
    var expK = maxExp > 0 ? (exp / maxExp) : 0;
    expK = expK < 0 ? 0 : (expK > 1 ? 1 : expK);
    var expFillW = expBarW * expK;
    if (expFillW > 1) {
      var expG = ctx.createLinearGradient(expBarX, expBarY, expBarX, expBarY + expBarH);
      expG.addColorStop(0, _lighten(THEME.sun, 0.10));
      expG.addColorStop(1, THEME.sun);
      ctx.fillStyle = expG;
      roundRectPath(ctx, expBarX, expBarY, expFillW, expBarH, expBarH / 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = _rgba('#ffffff', 0.35);
      roundRectPath(ctx, expBarX + 1, expBarY + 1, expFillW - 2, expBarH * 0.4, expBarH / 2);
      ctx.fill();
    }
    // 等级文字（右上角内）
    ctx.fillStyle = '#fff8e8';
    ctx.font = '700 ' + Math.round(cardH * 0.24) + 'px -apple-system, PingFang SC, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lv ' + level, textX, cardY + cardH * 0.36);
    // 经验数字
    ctx.font = '500 ' + Math.round(cardH * 0.22) + 'px -apple-system, PingFang SC, sans-serif';
    ctx.fillStyle = _rgba('#fff8e8', 0.85);
    ctx.textBaseline = 'top';
    ctx.fillText(exp + '/' + maxExp, expBarX, expBarY + expBarH + 2);
    ctx.restore();

    /* --- 金币/钻石条（右上） --- */
    var cBarW = W - cardX - cardW - padX - 8;
    var cBarX = cardX + cardW + 6;
    var cBarH = cardH * 0.46;
    var cBarY1 = cardY + 1;
    var cBarY2 = cBarY1 + cBarH + 4;

    // 金币条
    ctx.save();
    var coinG = ctx.createLinearGradient(cBarX, cBarY1, cBarX, cBarY1 + cBarH);
    coinG.addColorStop(0, _lighten(THEME.sun, 0.06));
    coinG.addColorStop(1, THEME.sun);
    ctx.fillStyle = coinG;
    roundRectPath(ctx, cBarX, cBarY1, cBarW, cBarH, cBarH / 2);
    ctx.fill();
    ctx.strokeStyle = _darken(THEME.barn, 0.10);
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, cBarX, cBarY1, cBarW, cBarH, cBarH / 2);
    ctx.stroke();
    // 金币图标
    var cIcR = cBarH * 0.36;
    var cIcX = cBarX + cIcR + 4, cIcY = cBarY1 + cBarH / 2;
    ctx.fillStyle = _lighten(THEME.sun, 0.20);
    ctx.beginPath(); ctx.arc(cIcX, cIcY, cIcR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = THEME.barn;
    ctx.font = '700 ' + Math.round(cIcR * 1.4) + 'px -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('¥', cIcX, cIcY + 0.5);
    // 数值
    ctx.fillStyle = '#5b3a14';
    ctx.font = '700 ' + Math.round(cBarH * 0.46) + 'px -apple-system, PingFang SC, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(_fmtNum(coins), cIcX + cIcR + 4, cBarY1 + cBarH / 2);
    ctx.restore();

    // 钻石条
    ctx.save();
    var diaG = ctx.createLinearGradient(cBarX, cBarY2, cBarX, cBarY2 + cBarH);
    diaG.addColorStop(0, _lighten('#7be0d4', 0.10));
    diaG.addColorStop(1, '#4ec5b6');
    ctx.fillStyle = diaG;
    roundRectPath(ctx, cBarX, cBarY2, cBarW, cBarH, cBarH / 2);
    ctx.fill();
    ctx.strokeStyle = _darken('#4ec5b6', 0.20);
    ctx.lineWidth = 1.2;
    roundRectPath(ctx, cBarX, cBarY2, cBarW, cBarH, cBarH / 2);
    ctx.stroke();
    // 钻石图标（菱形）
    var dIcX = cBarX + 9, dIcY = cBarY2 + cBarH / 2;
    ctx.fillStyle = '#bff6ec';
    ctx.beginPath();
    ctx.moveTo(dIcX, dIcY - cBarH * 0.32);
    ctx.lineTo(dIcX + cBarH * 0.32, dIcY);
    ctx.lineTo(dIcX, dIcY + cBarH * 0.32);
    ctx.lineTo(dIcX - cBarH * 0.32, dIcY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4ec3a8';
    ctx.beginPath();
    ctx.moveTo(dIcX, dIcY - cBarH * 0.32);
    ctx.lineTo(dIcX, dIcY);
    ctx.lineTo(dIcX - cBarH * 0.32, dIcY);
    ctx.closePath();
    ctx.fill();
    // 数值
    ctx.fillStyle = '#1c5f57';
    ctx.font = '700 ' + Math.round(cBarH * 0.46) + 'px -apple-system, PingFang SC, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(_fmtNum(diamonds), dIcX + cBarH * 0.42, cBarY2 + cBarH / 2);
    ctx.restore();
  }

  // 头像兜底：画一个 Q 版小农夫头像
  function _avatarFallback(ctx, cx, cy, r, skin) {
    skin = skin || '#ffd9b0';
    ctx.save();
    // 头（圆）
    var headG = ctx.createRadialGradient(cx - r * 0.30, cy - r * 0.40, 1, cx, cy, r * 0.95);
    headG.addColorStop(0, _lighten(skin, 0.10));
    headG.addColorStop(1, skin);
    ctx.fillStyle = headG;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.80, 0, Math.PI * 2); ctx.fill();
    // 草帽（半圆+帽檐）
    ctx.fillStyle = THEME.roofThatch;
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.30, r * 1.05, r * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = _darken(THEME.roofThatch, 0.20);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.50, cy - r * 0.30);
    ctx.lineTo(cx, cy - r * 0.95);
    ctx.lineTo(cx + r * 0.50, cy - r * 0.30);
    ctx.closePath();
    ctx.fill();
    // 帽带（红）
    ctx.fillStyle = THEME.barn;
    ctx.fillRect(cx - r * 0.50, cy - r * 0.32, r, r * 0.05);
    // 笑眼
    ctx.fillStyle = '#3a220a';
    ctx.beginPath();
    ctx.arc(cx - r * 0.22, cy + r * 0.10, r * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.22, cy + r * 0.10, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // 嘴（笑）
    ctx.strokeStyle = '#3a220a';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.30, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // 腮红
    ctx.fillStyle = _rgba('#ff8a8a', 0.50);
    ctx.beginPath();
    ctx.arc(cx - r * 0.38, cy + r * 0.28, r * 0.10, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.38, cy + r * 0.28, r * 0.10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 千分位格式化（万/亿）
  function _fmtNum(n) {
    n = Math.floor(Number(n) || 0);
    if (n < 10000) return String(n);
    if (n < 100000000) return (n / 10000).toFixed(n < 100000 ? 1 : 0) + '万';
    return (n / 100000000).toFixed(1) + '亿';
  }

  /* ============================== 天气叠层（晴天/阴天/雨天）============================== */
  // 在场景绘制后叠一层天气效果：雨天雨丝+积水压暗、阴天灰蒙、晴天暖光
  function drawWeather(ctx, W, H, t, key) {
    t = t || 0;
    if (!key || key === 'sunny') {
      // 晴天：暖阳光晕（右上），极淡
      ctx.save();
      var g = ctx.createRadialGradient(W * 0.80, H * 0.10, 4, W * 0.80, H * 0.10, W * 0.75);
      g.addColorStop(0, _rgba('#fff2b0', 0.20));
      g.addColorStop(1, _rgba('#fff2b0', 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    if (key === 'cloudy') {
      // 阴天：整体灰蒙 + 云影
      ctx.save();
      ctx.fillStyle = _rgba('#5a6470', 0.16);
      ctx.fillRect(0, 0, W, H);
      var g2 = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      g2.addColorStop(0, _rgba('#8a94a0', 0.18));
      g2.addColorStop(1, _rgba('#8a94a0', 0));
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H * 0.5);
      // 几朵阴云缓慢飘
      for (var ci = 0; ci < 4; ci++) {
        var cx2 = ((ci * 0.27 + t * 0.006) % 1.2 - 0.1) * W;
        _cloud(ctx, cx2, H * 0.08 + ci * 8, 1.1, t + ci * 40);
      }
      ctx.restore();
      return;
    }
    if (key === 'rainy') {
      // 雨天：冷色压暗 + 雨丝 + 涟漪
      ctx.save();
      ctx.fillStyle = _rgba('#2c3a4e', 0.20);
      ctx.fillRect(0, 0, W, H);
      // 雨丝（斜向下）
      ctx.strokeStyle = _rgba('#cfe6ff', 0.42);
      ctx.lineWidth = 1.2;
      var RN = 90;
      for (var i = 0; i < RN; i++) {
        var sx = _rand(i * 3.7 + 1) * W;
        var sy = ((_rand(i * 1.9 + 3) * H) + t * (0.55 + _rand(i * 0.7) * 0.5)) % (H + 40) - 20;
        var len = 9 + _rand(i * 2.3 + 5) * 10;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - len * 0.32, sy + len);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
  }

  /* ============================== 导出 ============================== */
  var LTArt = {
    THEME: THEME,
    drawFarm: drawFarm,
    drawPlot: drawPlot,
    drawPlant: drawPlant,
    drawProgressRing: drawProgressRing,
    drawGlow: drawGlow,
    drawHUD: drawHUD,
    drawWeather: drawWeather,
    VERSION: '5.0.0-A'
  };

  if (typeof window !== 'undefined') window.LTArt = LTArt;
  if (typeof module !== 'undefined' && module.exports) module.exports = LTArt;
})();