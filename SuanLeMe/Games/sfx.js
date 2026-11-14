/* sfx.js — 算了吗游戏通用音效引擎 v1.0
 * 纯 Web Audio 合成（无音频文件、0 依赖）。
 * 用法：
 *   SFX.click()           // 按钮/点击
 *   SFX.correct()         // 答对（上扬叮）
 *   SFX.wrong()           // 答错（下坠）
 *   SFX.win()             // 通关/中奖（和弦）
 *   SFX.lose()            // 失败/结束
 *   SFX.popCombo(n)       // 消除 pop（n=连击数，音高随 n 升）
 *   SFX.coin()            // 易币/收益
 *   SFX.levelup()         // 升级/突破
 *   SFX.tap()             // 轻微触碰
 *   SFX.play('name')      // 通用
 *   SFX.toggle()          // 开关音效，返回新状态(true=开)
 *   SFX.enabled           // 当前是否开启
 *   SFX.mountToggle(el)   // 把开关挂到元素（点击切换）
 * 存储：localStorage 'yx_sfx' = 'on'|'off'（默认 on）
 */
(function () {
  var KEY = 'yx_sfx';
  var enabled = true;
  try { enabled = (localStorage.getItem(KEY) || 'on') !== 'off'; } catch (e) {}

  var ctx = null;
  var master = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;      // 总音量（适中，不炸耳）
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }
  // 浏览器自动播放策略：首次用户交互后 resume
  function unlock() {
    if (!ensure()) return;
    try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }
  ['touchstart', 'mousedown', 'keydown', 'click'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { once: true, passive: true });
  });

  // 单个音符
  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    try {
      if (c.state === 'suspended') c.resume();
      var t0 = c.currentTime + (delay || 0);
      var osc = c.createOscillator();
      var g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
      var v = (vol === undefined ? 1 : vol);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  // 和弦
  function chord(freqs, dur, type, vol, delay) {
    for (var i = 0; i < freqs.length; i++) tone(freqs[i], dur, type || 'triangle', vol || 0.6, (delay || 0) + i * 0.02);
  }

  var SFX = {
    get enabled() { return enabled; },
    unlock: unlock,
    set: function (on) {
      enabled = !!on;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
      // 广播（供其他页/组件同步 UI）
      try { window.dispatchEvent(new CustomEvent('yx_sfx_changed', { detail: enabled })); } catch (e) {}
      return enabled;
    },
    toggle: function () { return SFX.set(!enabled); },

    click: function () { tone(660, 0.06, 'triangle', 0.5, 0, 620); },
    tap:   function () { tone(520, 0.045, 'sine', 0.35); },
    // 答对：C5→E5 双音上扬
    correct: function () {
      tone(523.25, 0.1, 'triangle', 0.6, 0);
      tone(783.99, 0.18, 'triangle', 0.55, 0.08);
    },
    // 答错：A3→F3 下坠
    wrong: function () {
      tone(220, 0.18, 'sawtooth', 0.4, 0, 138);
      tone(174, 0.22, 'sawtooth', 0.35, 0.12);
    },
    // 通关/中奖：C-E-G-C 和弦
    win: function () {
      chord([523.25, 659.25, 783.99], 0.32, 'triangle', 0.6);
      tone(1046.5, 0.4, 'triangle', 0.5, 0.22);
    },
    // 失败
    lose: function () {
      tone(392, 0.22, 'sine', 0.5, 0);
      tone(311.13, 0.26, 'sine', 0.45, 0.16);
      tone(233.08, 0.4, 'sine', 0.4, 0.32);
    },
    // 消除 pop（连击越高越清脆/越高）
    popCombo: function (n) {
      n = Math.max(1, n || 1);
      var base = 523.25 * Math.pow(1.059463, Math.min(n, 12)); // 每连击升半音
      tone(base, 0.09, 'sine', 0.5, 0, base * 1.6);
    },
    // 易币/收益：两三声清脆
    coin: function () {
      tone(987.77, 0.07, 'square', 0.32, 0);
      tone(1318.5, 0.12, 'square', 0.28, 0.07);
    },
    // 升级/突破：上行琶音
    levelup: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.16, 'triangle', 0.55, i * 0.07); });
    },
    // 抽卡/开箱：闪亮
    draw: function () {
      tone(880, 0.08, 'sine', 0.4, 0);
      tone(1174.66, 0.1, 'sine', 0.38, 0.06);
      tone(1567.98, 0.2, 'triangle', 0.4, 0.12);
    },

    /* ===== 百万富翁专属（模仿原版）===== */
    // 悬念弦乐床：低频持续颤动（进入题目时启动，答完停）
    tensionStart: function () {
      if (!enabled) return;
      var c = ensure(); if (!c) return;
      try {
        if (c.state === 'suspended') c.resume();
        if (SFX._tension) return;
        var osc = c.createOscillator(), osc2 = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lfoG = c.createGain();
        osc.type = 'sawtooth'; osc.frequency.value = 55;   // A1 低音
        osc2.type = 'sawtooth'; osc2.frequency.value = 82.4; // E2 五度
        lfo.type = 'sine'; lfo.frequency.value = 5.5;        // 颤动
        lfoG.gain.value = 3.5;
        lfo.connect(lfoG); lfoG.connect(osc.frequency);
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.055, c.currentTime + 0.6); // 很轻的底噪
        osc.connect(g); osc2.connect(g); g.connect(master);
        var filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 320;
        g.disconnect(); g.connect(filt); filt.connect(master);
        osc.start(); osc2.start(); lfo.start();
        SFX._tension = { osc: osc, osc2: osc2, lfo: lfo, g: g };
      } catch (e) {}
    },
    tensionStop: function () {
      var t = SFX._tension; if (!t) return;
      try {
        var c = ctx;
        t.g.gain.cancelScheduledValues(c.currentTime);
        t.g.gain.setValueAtTime(t.g.gain.value, c.currentTime);
        t.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4);
        t.osc.stop(c.currentTime + 0.5); t.osc2.stop(c.currentTime + 0.5); t.lfo.stop(c.currentTime + 0.5);
      } catch (e) {}
      SFX._tension = null;
    },
    // 倒计时滴答（越急越响）
    tick: function (urgent) {
      tone(urgent ? 1200 : 880, 0.035, 'square', urgent ? 0.28 : 0.16);
    },
    // 锁答：最终答案顿音（打击感）
    lock: function () {
      tone(196, 0.12, 'sawtooth', 0.5, 0, 160);
      tone(98, 0.16, 'sine', 0.4, 0.02);
    },
    // 揭晓正确：上行叮当
    revealCorrect: function () {
      tone(659.25, 0.1, 'triangle', 0.55, 0);
      tone(987.77, 0.16, 'triangle', 0.5, 0.09);
      tone(1318.5, 0.28, 'triangle', 0.5, 0.19);
    },
    // 揭晓错误：下行闷响
    revealWrong: function () {
      tone(196, 0.22, 'sawtooth', 0.42, 0, 92);
      tone(147, 0.3, 'sine', 0.38, 0.14);
    },
    // 单题通过的小奖励音（走梯子）
    ladderStep: function () {
      tone(587.33, 0.09, 'triangle', 0.5, 0);
      tone(880, 0.14, 'triangle', 0.45, 0.07);
    },
    // 百万大奖：辉煌长和弦（通关）
    jackpot: function () {
      chord([523.25, 659.25, 783.99, 1046.5], 0.5, 'triangle', 0.6);
      [1046.5, 1318.5, 1567.98, 2093].forEach(function (f, i) { tone(f, 0.5, 'triangle', 0.45, 0.28 + i * 0.1); });
    },
    play: function (name) { var f = SFX[name]; if (typeof f === 'function') { try { f(); } catch (e) {} } },

    // 全局点击代理：所有 button / .btn / [data-sfx] 自动发声（避免逐页改）
    installClickProxy: function () {
      if (window.__sfxProxyInstalled) return;
      window.__sfxProxyInstalled = true;
      document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('button,.btn,[data-sfx],a.btn,.game-card,.cat,.tab') : null;
        if (!el) return;
        var want = el.getAttribute && el.getAttribute('data-sfx');
        if (want) { SFX.play(want); return; }
        SFX.click();
      }, true);
    },

    // 角落静音开关（inline:true + into:元素 → 渲染成菜单内的一行，而非右下角浮钮）
    mountToggle: function (opts) {
      opts = opts || {};
      if (opts.into) return SFX._renderToggleInline(opts.into);
      if (document.getElementById('sfxToggle')) return;

      // 顺便自动安装点击代理
      SFX.installClickProxy();

      var st = document.createElement('style');
      st.textContent = '#sfxToggle{position:fixed;z-index:9998;width:40px;height:40px;border-radius:50%;' +
        'background:rgba(26,22,18,.82);border:1px solid rgba(212,175,55,.55);color:#d4af37;font-size:18px;' +
        'line-height:38px;text-align:center;cursor:pointer;user-select:none;-webkit-user-select:none;' +
        'box-shadow:0 2px 10px rgba(0,0,0,.5);backdrop-filter:blur(4px);transition:transform .12s}' +
        '#sfxToggle:active{transform:scale(.9)}' +
        '.sfx-off{opacity:.55}';
      document.head.appendChild(st);

      var el = document.createElement('div');
      el.id = 'sfxToggle';
      el.title = '音效开关';
      // 位置：默认右下角，避开底部导航
      el.style.right = (opts.right || '10px');
      el.style.bottom = (opts.bottom || '82px');
      document.body.appendChild(el);

      function render() {
        el.textContent = enabled ? '🔊' : '🔇';
        el.classList.toggle('sfx-off', !enabled);
      }
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = SFX.toggle();
        render();
        if (on) SFX.click();   // 开了给个反馈音
      });
      window.addEventListener('yx_sfx_changed', render);
      render();
      return el;
    },

    // 把音效开关渲染到指定容器内（用于菜单，非浮动）
    _renderToggleInline: function (container) {
      if (!container) return;
      if (container.querySelector('[data-sfx-inline]')) return;
      SFX.installClickProxy();
      var row = document.createElement('button');
      row.type = 'button';
      row.setAttribute('data-sfx-inline', '1');
      row.className = 'sfx-inline-row';
      row.style.cssText =
        'display:flex;align-items:center;width:100%;gap:10px;padding:12px 14px;border:1px solid var(--c2,#3a2e1e);' +
        'background:var(--c1,#2a2218);border-radius:10px;color:var(--gold,#d4af37);font-size:15px;font-weight:700;' +
        'cursor:pointer;font-family:inherit;margin-top:1px';
      function render() {
        var on = SFX.enabled;
        row.innerHTML = '<span style="font-size:18px">' + (on ? '🔊' : '🔇') + '</span>'
          + '<span style="flex:1;text-align:left">音效 / 背景音</span>'
          + '<span style="font-size:13px;font-weight:800;color:' + (on ? '#7bd88a' : '#a99a78') + '">'
          + (on ? '开启' : '已静音') + '</span>';
      }
      row.addEventListener('click', function (e) {
        e.stopPropagation();
        var on = SFX.toggle();
        render();
        if (on) SFX.click();
      });
      window.addEventListener('yx_sfx_changed', render);
      render();
      container.appendChild(row);
      return row;
    }
  };

  window.SFX = SFX;

  // 自动挂载：若页面 <body data-sfx-toggle="1"> 或全局变量 SFX_AUTO=1
  function autoMount() {
    if (window.SFX_AUTO || (document.body && document.body.getAttribute('data-sfx-toggle') === '1')) {
      try { SFX.mountToggle(); } catch (e) {}
    }
    // 若页面已声明 data-sfx-toggle，且需要手动，不自动；否则若声明 auto 就挂
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
