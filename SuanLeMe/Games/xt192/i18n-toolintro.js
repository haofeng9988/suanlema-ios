/* i18n-toolintro.js — 工具页(ToolIntro + 页内文案)多语言补丁引擎 v1.2
 * 背景：ToolIntro 的 hero/步骤/备注由 <b>/<br> 拆分，且部分页内文案在 JS 中动态生成，
 *       通用引擎(i18n-deep)按纯文本节点整串匹配，无法命中 → 本引擎按【整段 innerHTML/文本】查表替换。
 *
 * 用法（在页面自身 <script> 内、ToolIntro.mount 之后）：
 *   TIPatch(DICT, EXTRA);
 *     DICT  : { "<源innerHTML（可含<b>/<br>）>": {en:"...",ja:"...",...} }  // hero标题/口号/步骤/备注
 *     EXTRA : { "<源文本>": {en:"...",...} }                              // 页内任意文本节点
 *   前缀键：键以 "*" 结尾 = 前缀匹配（命中文本节点 trim 后以其开头的整段，整段替换）
 *   例：'※ 排盘走算法引擎，*': {en:'※ Charting uses an algorithm engine, ...'}
 *
 * 语言：localStorage.yx_lang（zh 不动作）；zhTW/zhHK 互回退→en；全 10 语言。
 * 特殊：`每日免 N 次` → Free N/day（内置）。
 * 关键：① 文本节点按 trim 比对（元素含前导空白/换行）；② 替换保留首尾空白；
 *       ③ 收费卡由 /api/tool/<t>/access 异步写入 → 延迟 re-scan(500/1500ms)。
 */
(function () {
  var L = 'zh';
  try { L = localStorage.getItem('yx_lang') || 'zh'; L = (window.YX_normalizeLang ? window.YX_normalizeLang(L) : (L==='en'?'en':'zh')); } catch (e) {}
  function pick(o) {
    if (!o) return null;
    if (o[L] !== undefined) return o[L];
    if (L === 'zhHK' && o.zhTW !== undefined) return o.zhTW;
    if (L === 'zhTW' && o.zhHK !== undefined) return o.zhHK;
    if (o.en !== undefined) return o.en;
    return null;
  }
  function nodeText(el) { return ((el.textContent || '')).trim(); }
  function matchDict(DICT, key) {
    if (!key) return null;
    if (DICT[key] !== undefined) return pick(DICT[key]);
    for (var k in DICT) {
      if (k.length > 1 && k.charAt(k.length - 1) === '*') {
        var pre = k.slice(0, -1);
        if (key.indexOf(pre) === 0) return pick(DICT[k]);
      }
    }
    return null;
  }
  var RE_FREE = /^每日免\s*(\d+)\s*次$/;
  function tx(s) {
    if (!s) return s;
    var m = RE_FREE.exec(s);
    if (m) {
      var n = m[1];
      return pick({ en: 'Free ' + n + '/day', ja: '毎日' + n + '回無料', ko: '매일 ' + n + '회 무료', es: 'Gratis ' + n + '/día', fr: 'Gratuit ' + n + '/jour', de: n + '/Tag gratis', pt: 'Grátis ' + n + '/dia', ar: 'مجانًا ' + n + '/يوم', zhTW: '每日免 ' + n + ' 次', zhHK: '每日免 ' + n + ' 次' }) || s;
    }
    // 页面自定义动态规则（window.TIRules: [{re, out:function(m){return {en:..}}}]）
    var R = window.TIRules;
    if (R && R.length) {
      for (var i = 0; i < R.length; i++) {
        var mm = R[i].re.exec(s);
        if (mm) { var v = R[i].out(mm); if (v) return pick(v) || s; }
      }
    }
    return s;
  }
  window.__TIPick = pick;
  window.__TIPick2 = function (DICT, key) { return matchDict(DICT || {}, key); };

  function patchNodes(EXTRA, DICT) {
    try {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var n, todo = [];
      while ((n = w.nextNode())) {
        var v = n.nodeValue;
        if (!v) continue;
        var tv = v.trim();
        if (!tv) continue;
        var rep = matchDict(EXTRA, tv);
        if (rep == null) rep = matchDict(DICT, tv);
        if (rep == null) rep = tx(tv);
        if (rep != null && rep !== tv) todo.push([n, v.replace(tv, rep)]);
      }
      for (var j = 0; j < todo.length; j++) todo[j][0].nodeValue = todo[j][1];
    } catch (e) {}
  }

  function patchMask(DICT) {
    var mask = document.getElementById('tiMask');
    if (!mask) return;
    var h1 = mask.querySelector('.ti-hero h1');
    if (h1) { var s = matchDict(DICT, nodeText(h1)); if (s) h1.textContent = s; }
    var sl = mask.querySelector('.ti-hero .slogan');
    if (sl) { var s2 = matchDict(DICT, sl.innerHTML.trim()); if (s2) sl.innerHTML = s2; }
    var rows = mask.querySelectorAll('.ti-row > span:nth-child(2)');
    for (var i = 0; i < rows.length; i++) { var r = matchDict(DICT, rows[i].innerHTML.trim()); if (r) rows[i].innerHTML = r; }
    var nt = mask.querySelector('.ti-note');
    if (nt) { var s3 = matchDict(DICT, nt.innerHTML.trim()); if (s3) nt.innerHTML = s3; }
  }

  window.TIPatch = function (DICT, EXTRA, opts) {
    if (L === 'zh') return;
    DICT = DICT || {}; EXTRA = EXTRA || {}; opts = opts || {};
    // 累计合并（页面可多次调用 TIPatch，观察器用合并表持续翻译动态重绘文本）
    var ALL = window.__TI_ALL || (window.__TI_ALL = { DICT: {}, EXTRA: {} });
    for (var k in DICT) ALL.DICT[k] = DICT[k];
    for (var k2 in EXTRA) ALL.EXTRA[k2] = EXTRA[k2];
    patchMask(DICT);
    patchNodes(EXTRA, DICT);
    if (opts.defer) { installObserver(); return; }
    setTimeout(function () { patchMask(DICT); patchNodes(EXTRA, DICT); }, 500);
    setTimeout(function () { patchMask(DICT); patchNodes(EXTRA, DICT); }, 1600);
    installObserver();
  };

  // 动态文本（每秒重绘的状态/数值）→ MutationObserver 在微任务里【立即】翻译
  // （微任务在浏览器绘制前执行 → 同帧完成，无闪动；已译文本不再命中→观察器自动收敛，无死循环）
  function installObserver() {
    if (window.__TIObs || typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function () {
      if (window.__TIPatching) return;
      window.__TIPatching = 1;
      try { var A = window.__TI_ALL || { DICT: {}, EXTRA: {} }; patchNodes(A.EXTRA, A.DICT); } catch (e) {}
      window.__TIPatching = 0;
    });
    try { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); window.__TIObs = mo; } catch (e) {}
    // 兜底节拍（覆盖极少数在脚本早期被覆盖、观察器未触发的节点）
    if (!window.__TIInterval) {
      window.__TIInterval = setInterval(function () {
        if (window.__TIPatching) return;
        window.__TIPatching = 1;
        try { var A2 = window.__TI_ALL || { DICT: {}, EXTRA: {} }; patchNodes(A2.EXTRA, A2.DICT); } catch (e) {}
        window.__TIPatching = 0;
      }, 1500);
    }
  }
})();
