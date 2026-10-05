/* ==========================================================================
 * lt-char.js  —  《灵田天机》角色人物 + 动作（QQ 农场 Q 版卡通，自包含零外部图片）
 * 接口（冻结，见施工契约 §1.2 / v4）：
 *   window.LTChar = {
 *     draw(ctx, x, y, opts, t),            // y = 脚底基线
 *     drawLineup(ctx, cx, cy, n, opts, t),// n 人并排居中，cy = 整排底部
 *     SIZE: { w: 36, h: 78 }
 *   }
 *   opts: { kind:'farmer'|'thief'|'mate',
 *           pose:'idle'|'harvest'|'walk'|'sneak'|'cheer',
 *           scale:1.0, flip:false, color:'#xx'(可选服装主色), firstIsLeader? }
 *   绘制顺序：影子 → 腿/鞋 → 衣服/背带裤 → 手臂 → 头 → 帽子/发型 → 道具
 *   风格：QQ 农场 Q 版，大头（占身高 ~1/3），明亮肤色 #ffd9b0 + 红腮红 + 弯月笑眼；
 *         农夫 = 宽檐草帽 + 黄衬衫 + 蓝背带裤；
 *         小偷 = 鸭舌帽 + 灰蓝衣 + 背包 + 鬼祟眼神；
 *         队友 = 同款 Q 版，多色衣循环。
 * ========================================================================== */
(function () {
  'use strict';

  /* ============================== 调色板 ============================== */
  var SKIN = '#ffd9b0';        // 明亮肤色（契约硬性）
  var SKIN_SHADE = '#f0b87a';
  var OUTLINE = 'rgba(36,28,18,.55)';
  var BLUSH = '#ff8a7a';       // 红色腮红
  var EYE_DARK = '#33240f';
  var CHEEK_LIGHT = '#ffe1c4';
  var HAIR_FARM = '#5a3a1a';
  var HAIR_THIEF = '#2b1f12';
  var HAIR_MATE = '#3a2614';

  /* 三种角色的主配色 ------------------------------------------------------- */
  var KIND = {
    // 农夫：宽檐草帽 + 黄色衬衫 + 蓝色背带裤
    farmer: {
      hat:        { main: '#e8b86f', dark: '#a8743a', band: '#c8402f' }, // 草帽 + 红帽带
      shirt:      '#f6c544',                                          // 黄衬衫
      shirtDark:  '#d4a02a',
      strap:      '#3a78c8',                                          // 蓝背带
      strapDark:  '#2a5a98',
      pant:       '#3a78c8',                                          // 蓝裤
      pantDark:   '#2a5a98',
      shoe:       '#5a3a1a',
      skin:       SKIN,
      hair:       HAIR_FARM
    },
    // 小偷：鸭舌帽 + 灰蓝衣 + 鬼祟眼神
    thief: {
      hat:        { main: '#3a4858', dark: '#202a36', brim: '#222a36', logo: '#e8b86f' },
      shirt:      '#5d6f86',
      shirtDark:  '#3f4d62',
      strap:      '#4a5a6e',
      strapDark:  '#2e3a4a',
      pant:       '#4a5566',
      pantDark:   '#2e3a48',
      shoe:       '#1f2632',
      skin:       '#f4c79a',
      hair:       HAIR_THIEF,
      bag:        '#5a4632',
      bagDark:    '#3a2c1e'
    },
    // 队友：同 Q 版，多色衣
    mate: {
      hat:        { main: '#e8b86f', dark: '#a8743a', band: '#c8402f' },
      shirt:      '#7fa66a',
      shirtDark:  '#5b8650',
      strap:      '#a8743a',
      strapDark:  '#6f4a20',
      pant:       '#5b8650',
      pantDark:   '#3e6036',
      shoe:       '#5a3a1a',
      skin:       SKIN,
      hair:       HAIR_MATE
    }
  };
  // 队友循环色（覆盖 shirt / pant）
  var MATE_PAL = [
    { shirt: '#f6c544', pant: '#3a78c8' }, // 黄蓝
    { shirt: '#e07a5f', pant: '#5b8650' }, // 橘绿
    { shirt: '#a06cd5', pant: '#f0b037' }, // 紫黄
    { shirt: '#5bbf8f', pant: '#d4a02a' }, // 绿黄
    { shirt: '#f08aa6', pant: '#3a78c8' }, // 粉蓝
    { shirt: '#f0b037', pant: '#5d6f86' }, // 黄灰
    { shirt: '#ff9a5a', pant: '#3a78c8' }, // 橙蓝
    { shirt: '#7fc7e8', pant: '#e07a5f' }  // 蓝橘
  ];

  /* ============================== 工具 ============================== */
  function hex2rgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function shade(hex, amt) {
    if (typeof hex !== 'string' || hex.charAt(0) !== '#') return hex;
    var c = hex2rgb(hex);
    var f = function (v) { v = Math.round(v * (1 + amt)); return v < 0 ? 0 : v > 255 ? 255 : v; };
    return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
  }
  function ell(ctx, x, y, rx, ry) {
    var k = 0.5523;
    ctx.beginPath();
    ctx.moveTo(x + rx, y);
    ctx.bezierCurveTo(x + rx, y + ry * k, x + rx * k, y + ry, x, y + ry);
    ctx.bezierCurveTo(x - rx * k, y + ry, x - rx, y + ry * k, x - rx, y);
    ctx.bezierCurveTo(x - rx, y - ry * k, x - rx * k, y - ry, x, y - ry);
    ctx.bezierCurveTo(x + rx * k, y - ry, x + rx, y - ry * k, x + rx, y);
    ctx.closePath();
  }
  function line(ctx, x1, y1, x2, y2, color, w, cap) {
    ctx.strokeStyle = color; ctx.lineWidth = w || 5;
    ctx.lineCap = cap || 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function fillEll(ctx, x, y, rx, ry, color) {
    ell(ctx, x, y, rx, ry);
    ctx.fillStyle = color; ctx.fill();
  }
  function strokeEll(ctx, x, y, rx, ry, color, w) {
    ell(ctx, x, y, rx, ry);
    ctx.strokeStyle = color; ctx.lineWidth = w || 1; ctx.stroke();
  }
  function star(ctx, cx, cy, R, color) {
    var r = R * 0.42, i;
    ctx.beginPath();
    for (i = 0; i < 10; i++) {
      var ang = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2) ? r : R;
      var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
  }
  function lockIcon(ctx, cx, cy, size, color) {
    var s = size;
    ctx.save();
    ctx.translate(cx, cy);
    // 锁身
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.1);
    ctx.lineTo(-s * 0.55, s * 0.5);
    ctx.quadraticCurveTo(-s * 0.55, s * 0.7, -s * 0.35, s * 0.7);
    ctx.lineTo(s * 0.35, s * 0.7);
    ctx.quadraticCurveTo(s * 0.55, s * 0.7, s * 0.55, s * 0.5);
    ctx.lineTo(s * 0.55, -s * 0.1);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    // 锁梁
    ctx.beginPath();
    ctx.arc(0, -s * 0.1, s * 0.32, Math.PI, 0);
    ctx.strokeStyle = color; ctx.lineWidth = s * 0.12; ctx.stroke();
    // 钥匙孔
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, s * 0.18, s * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ============================== 身体部件 ============================== */

  // 影子（贴地）
  function drawShadow(ctx, pose) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#000';
    var rx = pose === 'sneak' ? 17 : 15, ry = 4.4;
    ell(ctx, 0, 1.5, rx, ry); ctx.fill();
    ctx.restore();
  }

  // 鞋
  function drawShoe(ctx, K, x, y, scaleX) {
    scaleX = scaleX || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scaleX, 1);
    ell(ctx, 0, 0, 5, 3);
    ctx.fillStyle = K.shoe; ctx.fill();
    ctx.strokeStyle = shade(K.shoe, -0.25); ctx.lineWidth = 1; ctx.stroke();
    // 鞋面高光
    ctx.beginPath();
    ctx.ellipse(0, -0.8, 3.2, 1.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(K.shoe, 0.25); ctx.fill();
    ctx.restore();
  }

  // 裤腿（带裤脚阴影）
  function drawPants(ctx, K, pose, legA) {
    var a = pose === 'walk' ? legA * 5 : (pose === 'sneak' ? 3 : 0);
    var b = pose === 'walk' ? -legA * 5 : 0;
    var hipY = -22, kneeY = -12, footY = -1.5;
    // 左
    ctx.strokeStyle = K.pant; ctx.lineWidth = 7.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-4.5, hipY); ctx.lineTo(-4.5 + a, footY); ctx.stroke();
    ctx.strokeStyle = K.pantDark; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-1.8, hipY); ctx.lineTo(-1.8 + a, footY); ctx.stroke();
    // 右
    ctx.strokeStyle = K.pant; ctx.lineWidth = 7.2;
    ctx.beginPath(); ctx.moveTo(4.5, hipY); ctx.lineTo(4.5 + b, footY); ctx.stroke();
    ctx.strokeStyle = K.pantDark; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(1.8, hipY); ctx.lineTo(1.8 + b, footY); ctx.stroke();
  }

  // 衬衫（衣服主体）
  function shirtPath(ctx, pose) {
    var hemY = pose === 'sneak' ? -16 : -20;
    ctx.beginPath();
    ctx.moveTo(-9, -38);
    ctx.bezierCurveTo(-14, -32, -15, -26, -15, hemY + 4);
    ctx.quadraticCurveTo(-15, hemY + 6, -12, hemY + 6);
    ctx.lineTo(12, hemY + 6);
    ctx.quadraticCurveTo(15, hemY + 6, 15, hemY + 4);
    ctx.bezierCurveTo(15, -26, 14, -32, 9, -38);
    ctx.closePath();
  }
  function drawShirt(ctx, K, pose) {
    shirtPath(ctx, pose);
    var g = ctx.createLinearGradient(-15, -38, 15, -16);
    g.addColorStop(0, shade(K.shirt, 0.12));
    g.addColorStop(1, shade(K.shirt, -0.10));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
    // 衣襟亮面
    ctx.save();
    shirtPath(ctx, pose); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.moveTo(-2, -38); ctx.lineTo(2, -38); ctx.lineTo(4, -16); ctx.lineTo(-4, -16);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 背带裤前片（盖在衬衫下半部）
  function drawOveralls(ctx, K, pose) {
    var topY = -32, botY = pose === 'sneak' ? -16 : -20;
    // 主裤前片（梯形）
    ctx.beginPath();
    ctx.moveTo(-13, topY);
    ctx.bezierCurveTo(-15, -27, -14, -22, -14, botY + 4);
    ctx.lineTo(14, botY + 4);
    ctx.bezierCurveTo(14, -22, 15, -27, 13, topY);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, topY, 0, botY + 6);
    g.addColorStop(0, shade(K.strap, 0.08));
    g.addColorStop(1, shade(K.strap, -0.10));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.stroke();
    // 中缝
    ctx.strokeStyle = shade(K.strap, -0.20); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, topY); ctx.lineTo(0, botY + 4); ctx.stroke();
    // 口袋（胸前小方袋）
    ctx.fillStyle = shade(K.strap, 0.10);
    ctx.fillRect(-7, topY + 4, 6, 5);
    ctx.strokeStyle = shade(K.strap, -0.25); ctx.lineWidth = 0.8;
    ctx.strokeRect(-7, topY + 4, 6, 5);
    // 大口袋
    ctx.fillStyle = shade(K.strap, 0.05);
    ctx.beginPath();
    ctx.moveTo(-8, botY - 8);
    ctx.lineTo(8, botY - 8);
    ctx.lineTo(9, botY + 3);
    ctx.lineTo(-9, botY + 3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(K.strap, -0.30); ctx.lineWidth = 1; ctx.stroke();
    // 大口袋铜扣
    fillEll(ctx, 0, botY - 3, 1.2, 1.2, '#f5d06f');
    // 裤腿接缝（露出）
    ctx.strokeStyle = shade(K.strap, -0.25); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-7, botY + 4); ctx.lineTo(-6, -16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, botY + 4); ctx.lineTo(6, -16); ctx.stroke();
  }

  // 背带（肩带，两条细带，从肩到前片顶）
  function drawStraps(ctx, K, topY) {
    ctx.strokeStyle = K.strap; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-7, topY); ctx.lineTo(-9, -28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, topY); ctx.lineTo(9, -28); ctx.stroke();
    ctx.strokeStyle = shade(K.strap, -0.30); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-5.2, topY); ctx.lineTo(-7.2, -28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.2, topY); ctx.lineTo(7.2, -28); ctx.stroke();
    // 铜扣
    fillEll(ctx, -9, -28, 1.6, 1.2, '#f5d06f');
    fillEll(ctx, 9, -28, 1.6, 1.2, '#f5d06f');
  }

  // 领口
  function drawCollar(ctx, K, pose) {
    var skin = K.skin || SKIN;
    // V 领口（露出脖子/衬衫内层）
    ctx.beginPath();
    ctx.moveTo(-7, -38); ctx.quadraticCurveTo(-3, -33, 0, -32);
    ctx.quadraticCurveTo(3, -33, 7, -38);
    ctx.closePath();
    ctx.fillStyle = shade(K.shirt, -0.18); ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.stroke();
    // 颈子
    fillEll(ctx, 0, -38, 3.2, 2.4, shade(skin, -0.10));
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 0.8; ctx.stroke();
  }

  // 手臂（袖子）
  function drawArms(ctx, K, pose, phase, breathe, kind) {
    var armColor = K.shirt;
    var armDark = K.shirtDark;
    var skin = K.skin || SKIN;
    var swing = Math.sin(phase * 6);
    var Lsh = [-7.5, -36], Rsh = [7.5, -36];
    var lh, rh;
    if (pose === 'walk') {
      lh = [-12 + swing * 5, -19];
      rh = [12 - swing * 5, -19];
    } else if (pose === 'sneak') {
      lh = [-9, -28];
      rh = [9, -26];
    } else if (pose === 'cheer') {
      lh = [-15, -62];
      rh = [15, -62];
    } else if (pose === 'harvest') {
      var p = (Math.sin(phase * 2.2 - 1.2) + 1) / 2; // 0..1 抬手→下摘
      rh = [12 + p * 3, -64 + 50 * p];
      lh = [-11, -22 + breathe * 0.4];
    } else {
      lh = [-12, -19 + breathe * 0.5];
      rh = [12, -19 - breathe * 0.5];
    }
    // 上臂（袖子）
    line(ctx, Lsh[0], Lsh[1], lh[0], lh[1], armColor, 6.4);
    line(ctx, Rsh[0], Rsh[1], rh[0], rh[1], armColor, 6.4);
    // 袖口深色
    ctx.strokeStyle = armDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(lh[0], lh[1], 3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(rh[0], rh[1], 3, 0, Math.PI * 2); ctx.stroke();
    // 手
    fillEll(ctx, lh[0], lh[1], 3.2, 3.2, skin);
    strokeEll(ctx, lh[0], lh[1], 3.2, 3.2, OUTLINE, 0.9);
    fillEll(ctx, rh[0], rh[1], 3.2, 3.2, skin);
    strokeEll(ctx, rh[0], rh[1], 3.2, 3.2, OUTLINE, 0.9);

    return { lh: lh, rh: rh };
  }

  // 头（大头 Q 版）
  function drawHead(ctx, K, pose, kind) {
    var skin = K.skin || SKIN;
    var headCx = 0, headCy = -54, headRx = 13, headRy = 13.2;
    // 脸
    var faceGrad = ctx.createRadialGradient(headCx - 3, headCy - 4, 1, headCx, headCy, headRx + 1);
    faceGrad.addColorStop(0, shade(skin, 0.08));
    faceGrad.addColorStop(1, shade(skin, -0.12));
    ell(ctx, headCx, headCy, headRx, headRy);
    ctx.fillStyle = faceGrad; ctx.fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.1; ctx.stroke();
    // 脸颊（亮）
    fillEll(ctx, headCx - 8, headCy + 1, 2.4, 1.6, CHEEK_LIGHT);
    fillEll(ctx, headCx + 8, headCy + 1, 2.4, 1.6, CHEEK_LIGHT);

    // 腮红（红色，Q 版标志）
    ctx.globalAlpha = 0.55;
    fillEll(ctx, headCx - 7.5, headCy + 3, 2.6, 1.6, BLUSH);
    fillEll(ctx, headCx + 7.5, headCy + 3, 2.6, 1.6, BLUSH);
    ctx.globalAlpha = 1;

    // 头发（帽子下露出）
    if (kind === 'thief') {
      // 鸭舌帽下前额碎发
      ctx.beginPath();
      ctx.moveTo(-12, headCy - 4);
      ctx.quadraticCurveTo(-11, headCy - 10, -4, headCy - 11);
      ctx.quadraticCurveTo(-8, headCy - 8, -10, headCy - 3);
      ctx.closePath();
      ctx.fillStyle = K.hair; ctx.fill();
    } else {
      // 农夫 / 队友：草帽下小刘海
      ctx.beginPath();
      ctx.moveTo(-11, headCy - 7);
      ctx.quadraticCurveTo(-8, headCy - 13, -2, headCy - 12);
      ctx.quadraticCurveTo(2, headCy - 12, 6, headCy - 11);
      ctx.quadraticCurveTo(2, headCy - 8, -2, headCy - 9);
      ctx.quadraticCurveTo(-7, headCy - 8, -11, headCy - 7);
      ctx.closePath();
      ctx.fillStyle = K.hair; ctx.fill();
    }

    // 眼睛 / 嘴
    var sneaky = (pose === 'sneak' || kind === 'thief');
    if (sneaky) {
      // 眯眼（弯月/斜视，鬼祟）
      ctx.strokeStyle = EYE_DARK; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(headCx - 7, headCy - 1.5);
      ctx.quadraticCurveTo(headCx - 4, headCy - 4, headCx - 1.5, headCy - 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(headCx + 1.5, headCy - 1.8);
      ctx.quadraticCurveTo(headCx + 4, headCy - 4, headCx + 7, headCy - 1.5);
      ctx.stroke();
      // 眉毛微挑（鬼祟）
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(headCx - 7, headCy - 6); ctx.lineTo(headCx - 2, headCy - 5.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(headCx + 2, headCy - 5.2); ctx.lineTo(headCx + 7, headCy - 6); ctx.stroke();
    } else {
      // 弯月笑眼
      ctx.strokeStyle = EYE_DARK; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(headCx - 4.5, headCy - 1.5, 2.2, Math.PI * 1.15, Math.PI * 1.95);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(headCx + 4.5, headCy - 1.5, 2.2, Math.PI * 1.05, Math.PI * 1.85);
      ctx.stroke();
      // 小圆眼珠（亮）
      ctx.fillStyle = EYE_DARK;
      fillEll(ctx, headCx - 4.5, headCy + 0.3, 1.0, 1.2, EYE_DARK);
      fillEll(ctx, headCx + 4.5, headCy + 0.3, 1.0, 1.2, EYE_DARK);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      fillEll(ctx, headCx - 4.9, headCy - 0.2, 0.4, 0.4, '#fff');
      fillEll(ctx, headCx + 4.1, headCy - 0.2, 0.4, 0.4, '#fff');
    }

    // 嘴
    ctx.strokeStyle = EYE_DARK; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath();
    if (pose === 'cheer') {
      // 张大嘴（笑喊）
      ctx.fillStyle = '#7a3424';
      ctx.arc(headCx, headCy + 5, 3.0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = EYE_DARK; ctx.lineWidth = 1.2; ctx.stroke();
      // 舌头
      ctx.fillStyle = '#ff8a7a';
      ctx.beginPath();
      ctx.arc(headCx, headCy + 6, 1.6, 0, Math.PI);
      ctx.fill();
    } else if (sneaky) {
      // 偷笑嘴
      ctx.moveTo(headCx - 2.6, headCy + 4.6);
      ctx.quadraticCurveTo(headCx, headCy + 6, headCx + 2.6, headCy + 4.6);
    } else {
      // 大笑脸
      ctx.moveTo(headCx - 3.2, headCy + 4.2);
      ctx.quadraticCurveTo(headCx, headCy + 8, headCx + 3.2, headCy + 4.2);
    }
    ctx.stroke();

    // 小鼻子（点）
    ctx.fillStyle = shade(skin, -0.18);
    ctx.beginPath();
    ctx.arc(headCx, headCy + 2.4, 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // 帽子：宽檐草帽（农夫/队友）
  function drawStrawHat(ctx, K) {
    var crownCx = 0, crownCy = -67;
    var brimY = -58;
    // 宽檐
    ctx.beginPath();
    ctx.ellipse(crownCx, brimY, 22, 6, 0, 0, Math.PI * 2);
    var brimGrad = ctx.createRadialGradient(crownCx, brimY - 1, 2, crownCx, brimY, 22);
    brimGrad.addColorStop(0, shade(K.hat.main, 0.10));
    brimGrad.addColorStop(1, shade(K.hat.main, -0.18));
    ctx.fillStyle = brimGrad; ctx.fill();
    ctx.strokeStyle = K.hat.dark; ctx.lineWidth = 1.2; ctx.stroke();
    // 帽顶
    ctx.beginPath();
    ctx.ellipse(crownCx, crownCy, 13, 9, 0, Math.PI, Math.PI * 2);
    var crownGrad = ctx.createLinearGradient(0, crownCy - 9, 0, crownCy);
    crownGrad.addColorStop(0, shade(K.hat.main, 0.18));
    crownGrad.addColorStop(1, shade(K.hat.main, -0.10));
    ctx.fillStyle = crownGrad; ctx.fill();
    // 帽顶底部边
    ctx.beginPath();
    ctx.ellipse(crownCx, crownCy, 13, 9, 0, 0, Math.PI);
    ctx.fillStyle = shade(K.hat.main, -0.20); ctx.fill();
    ctx.strokeStyle = K.hat.dark; ctx.lineWidth = 1; ctx.stroke();
    // 红帽带
    ctx.strokeStyle = K.hat.band; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(crownCx, crownCy, 13, 9, 0, 0, Math.PI);
    ctx.stroke();
    // 草帽编织纹
    ctx.strokeStyle = shade(K.hat.main, -0.20); ctx.lineWidth = 0.5; ctx.globalAlpha = 0.5;
    for (var i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(crownCx + i * 3.2, crownCy - 8.5);
      ctx.lineTo(crownCx + i * 3.2, crownCy - 0.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 帽顶小圆点（草编结）
    fillEll(ctx, crownCx, crownCy - 9, 1.4, 1.4, shade(K.hat.dark, -0.10));
    // 帽檐高光
    ctx.strokeStyle = shade(K.hat.main, 0.45); ctx.lineWidth = 0.8; ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(crownCx, brimY - 3, 18, 1.2, 0, 0, Math.PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // 帽子：鸭舌帽（thief）
  function drawCap(ctx, K) {
    var capCx = 0, capCy = -67;
    // 帽冠
    ctx.beginPath();
    ctx.moveTo(-13, capCy);
    ctx.bezierCurveTo(-14, capCy - 12, -8, capCy - 16, 0, capCy - 16);
    ctx.bezierCurveTo(8, capCy - 16, 14, capCy - 12, 13, capCy);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, capCy - 16, 0, capCy);
    g.addColorStop(0, shade(K.hat.main, 0.18));
    g.addColorStop(1, shade(K.hat.main, -0.20));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = K.hat.dark; ctx.lineWidth = 1; ctx.stroke();
    // 帽中线（5 瓣结构）
    ctx.strokeStyle = shade(K.hat.main, -0.25); ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(0, capCy - 16); ctx.lineTo(0, capCy); ctx.stroke();
    ctx.globalAlpha = 1;
    // 帽檐（鸭舌，前伸）
    ctx.beginPath();
    ctx.moveTo(-13, capCy + 0.5);
    ctx.quadraticCurveTo(-2, capCy + 6, 14, capCy + 4);
    ctx.quadraticCurveTo(13, capCy + 1.5, -13, capCy - 1);
    ctx.closePath();
    var brimG = ctx.createLinearGradient(0, capCy, 0, capCy + 6);
    brimG.addColorStop(0, K.hat.dark);
    brimG.addColorStop(1, shade(K.hat.dark, -0.25));
    ctx.fillStyle = brimG; ctx.fill();
    ctx.strokeStyle = K.hat.dark; ctx.lineWidth = 1; ctx.stroke();
    // 帽 logo（金色小方/标签）
    fillEll(ctx, 0, capCy - 8, 3, 2.4, K.hat.logo);
    ctx.strokeStyle = shade(K.hat.logo, -0.30); ctx.lineWidth = 0.6; ctx.stroke();
    // 帽顶小纽
    fillEll(ctx, 0, capCy - 16, 1.4, 1.0, K.hat.dark);
  }

  // 背包（thief 专用，背在身后）
  function drawBackpack(ctx, K, pose) {
    if (pose === 'sneak') return;        // sneak 时弓背藏在身下，少画
    var cx = 0, cy = -25;
    // 主体
    var bw = 14, bh = 16;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 + 1, cy - bh / 2);
    ctx.lineTo(cx + bw / 2 - 1, cy - bh / 2);
    ctx.quadraticCurveTo(cx + bw / 2 + 1, cy - bh / 2, cx + bw / 2 + 1, cy - bh / 2 + 3);
    ctx.lineTo(cx + bw / 2 + 1, cy + bh / 2 - 3);
    ctx.quadraticCurveTo(cx + bw / 2 + 1, cy + bh / 2 + 1, cx + bw / 2 - 1, cy + bh / 2 + 1);
    ctx.lineTo(cx - bw / 2 + 1, cy + bh / 2 + 1);
    ctx.quadraticCurveTo(cx - bw / 2 - 1, cy + bh / 2 + 1, cx - bw / 2 - 1, cy + bh / 2 - 3);
    ctx.lineTo(cx - bw / 2 - 1, cy - bh / 2 + 3);
    ctx.quadraticCurveTo(cx - bw / 2 - 1, cy - bh / 2, cx - bw / 2 + 1, cy - bh / 2);
    ctx.closePath();
    var g = ctx.createLinearGradient(cx, cy - bh / 2, cx, cy + bh / 2);
    g.addColorStop(0, shade(K.bag, 0.16));
    g.addColorStop(1, shade(K.bag, -0.20));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = K.bagDark; ctx.lineWidth = 1; ctx.stroke();
    // 顶盖
    ctx.fillStyle = K.bagDark;
    ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, 3);
    // 背带（左右从肩下来）
    ctx.strokeStyle = K.bagDark; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-7, -34); ctx.lineTo(-7, -16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -34); ctx.lineTo(7, -16); ctx.stroke();
    // 小口袋
    ctx.fillStyle = shade(K.bag, -0.15);
    ctx.fillRect(cx - 3, cy + 2, 6, 4);
    ctx.strokeStyle = K.bagDark; ctx.lineWidth = 0.8; ctx.strokeRect(cx - 3, cy + 2, 6, 4);
  }

  // 道具：农夫提菜篮 / 小偷抱萝卜 / 收获时拿作物
  function drawProp(ctx, K, kind, pose, lh, rh) {
    if (kind === 'farmer') {
      if (pose === 'cheer') return;       // 举手时不拿
      if (pose === 'harvest') {
        // 右手摘到的菜（番茄）
        var hx = rh[0], hy = rh[1] + 3;
        fillEll(ctx, hx, hy, 3.2, 3.2, '#e53935');
        ctx.strokeStyle = '#7a1d12'; ctx.lineWidth = 0.8; ctx.stroke();
        // 高光
        fillEll(ctx, hx - 1, hy - 1, 1, 0.8, '#ff8a7a');
        // 蒂
        ctx.strokeStyle = '#3a6b1e'; ctx.lineWidth = 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hx, hy - 3); ctx.lineTo(hx + 0.5, hy - 5); ctx.stroke();
      } else {
        // 左手提菜篮
        drawBasket(ctx, lh[0], lh[1] + 6);
      }
    } else if (kind === 'thief') {
      if (pose === 'sneak') {
        // 抱着的菜（藏在胸前）
        ctx.save();
        fillEll(ctx, 0, -29, 6.5, 5.8, '#4caf7d');
        ctx.strokeStyle = '#2d6b48'; ctx.lineWidth = 1; ctx.stroke();
        // 叶子
        ctx.fillStyle = '#7ed07f';
        ctx.beginPath();
        ctx.moveTo(0, -34); ctx.quadraticCurveTo(-3, -39, -5, -38);
        ctx.quadraticCurveTo(-2, -35, 0, -34); ctx.closePath(); ctx.fill();
        // 萝卜头（露一点）
        fillEll(ctx, 4, -29, 1.8, 1.4, '#ff6b5a');
        ctx.restore();
      } else {
        // 普通状态：右手拿麻袋（！）
        var sx = rh[0] + 2, sy = rh[1] + 4;
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy - 3); ctx.lineTo(sx + 4, sy - 3);
        ctx.lineTo(sx + 5, sy + 5); ctx.lineTo(sx - 5, sy + 5);
        ctx.closePath();
        ctx.fillStyle = '#8a7548'; ctx.fill();
        ctx.strokeStyle = '#5a4a28'; ctx.lineWidth = 0.8; ctx.stroke();
        // 袋口扎绳
        ctx.strokeStyle = '#5a4a28'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(sx - 4, sy - 2); ctx.lineTo(sx + 4, sy - 2); ctx.stroke();
        // $ 标记
        ctx.fillStyle = '#f5d06f';
        ctx.font = 'bold 5px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', sx, sy + 1.5);
      }
    }
    // mate 不主动画道具（pose 不为 harvest/cheer 时）
  }

  // 菜篮
  function drawBasket(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    // 篮身
    ctx.beginPath();
    ctx.moveTo(-7, -5);
    ctx.lineTo(7, -5);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, -5, 0, 6);
    g.addColorStop(0, '#c98a4a');
    g.addColorStop(1, '#7a5222');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#4a3010'; ctx.lineWidth = 1; ctx.stroke();
    // 编织纹
    ctx.strokeStyle = '#6f4a20'; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(-5.5, 0); ctx.lineTo(5.5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -2.5); ctx.lineTo(5, -2.5); ctx.stroke();
    ctx.globalAlpha = 1;
    // 提梁
    ctx.strokeStyle = '#7a5222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -5, 6.5, Math.PI, 0); ctx.stroke();
    // 菜（番茄+叶）
    fillEll(ctx, -3, -7, 2.6, 2.2, '#e53935');
    fillEll(ctx, 2.6, -7.4, 2.2, 1.8, '#f5d06f');
    fillEll(ctx, 0, -8.5, 2.0, 1.6, '#4caf7d');
    ctx.fillStyle = '#3a6b1e';
    ctx.fillRect(-0.5, -10, 1, 1.5);
    ctx.restore();
  }

  // 脚下尘土（sneak / walk）
  function drawDust(ctx, pose, phase) {
    if (pose !== 'sneak' && pose !== 'walk') return;
    var n = pose === 'sneak' ? 4 : 3;
    var base = pose === 'sneak' ? -16 : -12;
    for (var i = 0; i < n; i++) {
      var ph = phase * 3 + i * 1.3;
      var k = (Math.sin(ph) + 1) / 2;
      var dx = base - i * 4.5 - k * 4;
      var dy = -1 - k * 5;
      ctx.globalAlpha = 0.45 * (1 - k * 0.7);
      ctx.fillStyle = '#a89878';
      ell(ctx, dx, dy, 2 + i * 0.4, 1.5 + i * 0.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ============================== 主绘制 ============================== */
  function draw(ctx, x, y, opts, t) {
    if (!ctx) return;
    opts = opts || {};
    var kind = opts.kind || 'farmer';
    var K = JSON.parse(JSON.stringify(KIND[kind] || KIND.farmer));  // 深拷贝防止污染
    var pose = opts.pose || (kind === 'thief' ? 'sneak' : 'idle');
    var s = opts.scale || 1;
    var flip = !!opts.flip;
    t = t || 0;
    var phase = t / 1000;
    var breathe = Math.sin(phase * 2.0);

    // 队友循环色覆盖
    if (kind === 'mate' && opts.mateIdx !== undefined) {
      var pal = MATE_PAL[opts.mateIdx % MATE_PAL.length];
      K.shirt = pal.shirt;
      K.shirtDark = shade(pal.shirt, -0.18);
      K.pant = pal.pant;
      K.pantDark = shade(pal.pant, -0.25);
    }
    // opts.color 直接覆盖 shirt 主色
    if (opts.color) {
      K.shirt = opts.color;
      K.shirtDark = shade(opts.color, -0.20);
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip ? -s : s, s);

    // 动画位移
    var bob = 0, lean = 0, legA = Math.sin(phase * 6);
    if (pose === 'idle') bob = breathe * 0.6;
    else if (pose === 'walk') bob = Math.abs(Math.sin(phase * 6)) * 1.4 - 0.7;
    else if (pose === 'sneak') bob = Math.sin(phase * 4) * 0.5;
    else if (pose === 'cheer') bob = -Math.abs(Math.sin(phase * 5)) * 3.0;
    else if (pose === 'harvest') bob = breathe * 0.4;
    if (pose === 'sneak') lean = -0.22;

    ctx.translate(0, bob);
    if (lean) { ctx.translate(0, -20); ctx.rotate(lean); ctx.translate(0, 20); }

    // ====== 绘制顺序：影子 → 腿/鞋 → 衣服 → 手臂 → 头 → 帽子 → 道具 ======
    drawShadow(ctx, pose);
    drawPants(ctx, K, pose, legA);
    // 鞋
    var shoeA = pose === 'walk' ? legA * 5 : (pose === 'sneak' ? 3 : 0);
    var shoeB = pose === 'walk' ? -legA * 5 : 0;
    drawShoe(ctx, K, -4.5 + shoeA, -1, 1);
    drawShoe(ctx, K, 4.5 + shoeB, -1, 1);
    // 衬衫
    drawShirt(ctx, K, pose);
    // 背带（画在衬衫上，再被前片压住一半）
    drawStraps(ctx, K, -16);
    // 背带裤前片
    drawOveralls(ctx, K, pose);
    // 领口（脖子）
    drawCollar(ctx, K, pose);
    // 手臂
    var armInfo = drawArms(ctx, K, pose, phase, breathe, kind);
    // 头
    drawHead(ctx, K, pose, kind);
    // 帽子
    if (kind === 'thief') drawCap(ctx, K);
    else drawStrawHat(ctx, K);
    // 小偷背包（画在身体之后保持背面感）
    if (kind === 'thief') drawBackpack(ctx, K, pose);
    // 道具（基于手位置）
    drawProp(ctx, K, kind, pose, armInfo.lh, armInfo.rh);
    // 尘土
    drawDust(ctx, pose, phase);

    ctx.restore();
  }

  /* ============================== 队长标 ============================== */
  function leaderMark(ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    var sway = Math.sin((t || 0) / 500) * 2.2;
    // 旗杆
    line(ctx, 10, -70, 10, -98, '#7a5222', 1.8);
    // 三角旗
    ctx.beginPath();
    ctx.moveTo(10, -97);
    ctx.quadraticCurveTo(22 + sway, -94, 27 + sway, -89);
    ctx.quadraticCurveTo(20 + sway, -88, 10, -86);
    ctx.closePath();
    ctx.fillStyle = '#f5d06f'; ctx.fill();
    ctx.strokeStyle = '#b8912a'; ctx.lineWidth = 1; ctx.stroke();
    // 旗面高光
    ctx.fillStyle = 'rgba(255,255,255,.30)';
    ctx.beginPath();
    ctx.moveTo(12, -95);
    ctx.lineTo(20 + sway, -92);
    ctx.lineTo(20 + sway, -90);
    ctx.lineTo(12, -92);
    ctx.closePath(); ctx.fill();
    // 星
    star(ctx, 0, -88, 5.4, '#fff6c2');
    ctx.globalAlpha = 0.95;
    star(ctx, 0, -88, 3.0, '#f5d06f');
    ctx.globalAlpha = 1;
    // 旗杆顶小球
    fillEll(ctx, 10, -98, 1.4, 1.4, '#e53935');
    ctx.restore();
  }

  /* ============================== 列队 ============================== */
  function drawLineup(ctx, cx, cy, n, opts, t) {
    opts = opts || {};
    n = Math.max(1, n | 0);
    var s = opts.scale || 1;
    var sp = 34 * s;                // 间距
    var total = (n - 1) * sp;
    var x0 = cx - total / 2;
    for (var i = 0; i < n; i++) {
      var o = {
        kind: opts.kind || 'mate',
        pose: opts.pose || 'idle',
        scale: s,
        flip: opts.flip,
        mateIdx: i
      };
      if (opts.firstIsLeader && i === 0 && opts.leaderKind) o.kind = opts.leaderKind;
      if (opts.color) o.color = opts.color;
      draw(ctx, x0 + i * sp, cy, o, (t || 0) + i * 130);
      if (opts.firstIsLeader && i === 0) leaderMark(ctx, x0, cy, s, t || 0);
    }
  }

  var LTChar = {
    draw: draw,
    drawLineup: drawLineup,
    SIZE: { w: 36, h: 78 }
  };

  if (typeof window !== 'undefined') window.LTChar = LTChar;
  if (typeof module !== 'undefined' && module.exports) module.exports = LTChar;
})();
